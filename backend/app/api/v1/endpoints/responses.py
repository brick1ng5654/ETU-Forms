from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import AppUser, Form, FormElement, Response, ResponseAnswer, UploadedFile
from app.schemas import FormStoredResponse, FormStoredResponsesResponse
from app.security.auth_dependencies import get_current_user

router = APIRouter(prefix="/responses", tags=["responses"])


def _enum_value(x: Any) -> Any:
    return x.value if hasattr(x, "value") else x


def _deserialize_answer_value(answer_row: ResponseAnswer, attachments: list[dict[str, Any]]) -> Any:
    if answer_row.value_text is not None:
        return answer_row.value_text
    if answer_row.value_number is not None:
        return answer_row.value_number
    if answer_row.value_bool is not None:
        return answer_row.value_bool
    if answer_row.value_date is not None:
        return answer_row.value_date.isoformat()
    if answer_row.value_time is not None:
        return answer_row.value_time.isoformat()
    if answer_row.value_json is not None:
        if attachments:
            result = answer_row.value_json.copy() if isinstance(answer_row.value_json, dict) else {}
            result["attachments"] = attachments
            return result
        return answer_row.value_json
    return None


@router.get("/me", response_model=FormStoredResponsesResponse)
async def get_my_responses(
    db: AsyncSession = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    """Получить все ответы текущего пользователя (submitted и cancelled)"""
    responses_result = await db.execute(
        select(Response)
        .where(Response.user_id == current_user.user_id)
        .where(Response.status.in_(["submitted", "cancelled"]))
        .order_by(Response.completed_at.desc(), Response.created_at.desc())
    )
    responses = responses_result.scalars().all()
    
    if not responses:
        return FormStoredResponsesResponse(responses=[])

    response_ids = [item.response_id for item in responses]
    form_ids = list({item.form_id for item in responses})

    # Получаем формы для информации о них
    forms_result = await db.execute(select(Form).where(Form.form_id.in_(form_ids)))
    forms_map = {form.form_id: form for form in forms_result.scalars().all()}

    # Получаем ответы на элементы
    answers_result = await db.execute(
        select(ResponseAnswer).where(ResponseAnswer.response_id.in_(response_ids))
    )
    answer_rows = answers_result.scalars().all()

    # Получаем элементы форм
    elements_result = await db.execute(
        select(FormElement).where(FormElement.form_id.in_(form_ids))
    )
    elements = elements_result.scalars().all()
    
    # Создаем маппинг element_id -> client_id для каждой формы
    element_client_map: dict[int, str] = {}
    for element in elements:
        settings = element.other_settings if isinstance(element.other_settings, dict) else {}
        client_id = settings.get("client_id")
        element_client_map[element.element_id] = str(client_id) if client_id is not None else str(element.element_id)

    # Получаем файлы
    answer_ids = [row.answer_id for row in answer_rows]
    files_by_answer_id: dict[int, list[dict[str, Any]]] = {}
    if answer_ids:
        files_result = await db.execute(
            select(UploadedFile)
            .where(UploadedFile.answer_id.in_(answer_ids))
            .where(UploadedFile.status != "deleted")
        )
        for file_row in files_result.scalars().all():
            if file_row.answer_id is None:
                continue
            files_by_answer_id.setdefault(file_row.answer_id, []).append(
                {
                    "file_id": file_row.file_id,
                    "name": file_row.name,
                    "mime_type": file_row.mime_type,
                    "size_bytes": file_row.size_bytes,
                    "url": f"/api/v1/files/{file_row.file_id}/download?token={file_row.access_token}",
                    "content_hash": file_row.content_hash,
                    "status": _enum_value(file_row.status),
                }
            )

    # Группируем ответы по response_id
    answers_by_response_id: dict[int, dict[str, Any]] = {}
    for answer_row in answer_rows:
        client_id = element_client_map.get(answer_row.element_id, str(answer_row.element_id))
        attachments = files_by_answer_id.get(answer_row.answer_id, [])
        value = _deserialize_answer_value(answer_row, attachments)
        answers_by_response_id.setdefault(answer_row.response_id, {})[client_id] = value

    # Формируем результат
    out: list[FormStoredResponse] = []
    for response_row in responses:
        form = forms_map.get(response_row.form_id)
        if not form:
            continue
            
        form_version = form.version or 1
        
        out.append(
            FormStoredResponse(
                response_id=response_row.response_id,
                form_id=response_row.form_id,
                user_id=response_row.user_id,
                responder_name=current_user.name,
                responder_email=current_user.email,
                status=_enum_value(response_row.status),
                created_at=response_row.created_at,
                completed_at=response_row.completed_at,
                version=form_version,
                answers=answers_by_response_id.get(response_row.response_id, {}),
            )
        )

    return FormStoredResponsesResponse(responses=out)


@router.post("/{response_id}/revoke", status_code=status.HTTP_200_OK)
async def revoke_response(
    response_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    """Отозвать ответ пользователя"""
    # Получаем ответ
    response_result = await db.execute(
        select(Response).where(Response.response_id == response_id)
    )
    response = response_result.scalar_one_or_none()
    
    if not response:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Response not found"
        )
    
    # Проверяем, что ответ принадлежит текущему пользователю
    if response.user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only revoke your own responses"
        )
    
    # Проверяем, что ответ уже отправлен (нельзя отозвать черновик или уже отозванный)
    if response.status != "submitted":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot revoke response with status '{response.status}'"
        )
    
    # Получаем форму для проверки настроек
    form_result = await db.execute(
        select(Form).where(Form.form_id == response.form_id)
    )
    form = form_result.scalar_one_or_none()
    
    if not form:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Form not found"
        )
    
    # Для публичного опроса отзыв ответа запрещён
    if _enum_value(form.access_mode) == "unauthenticated":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Response revocation is not allowed for public forms"
        )
    
    # Проверяем, разрешен ли отзыв ответов
    settings = form.settings_json if isinstance(form.settings_json, dict) else {}
    allow_revoke = settings.get("allowRevoke", False)
    
    if not allow_revoke:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Response revocation is not allowed for this form"
        )
    
    revoke_counts_as_attempt = settings.get("revokeCountsAsAttempt", False)
    
    # Отзываем ответ (меняем статус на cancelled) и сохраняем правило на момент отзыва
    response.status = "cancelled"
    response.revoke_counts_as_attempt_at_revoke = bool(revoke_counts_as_attempt)
    await db.commit()
    await db.refresh(response)
    
    return {
        "response_id": response.response_id,
        "status": _enum_value(response.status),
        "form_id": form.form_id,
        "form_title": form.title,
    }
