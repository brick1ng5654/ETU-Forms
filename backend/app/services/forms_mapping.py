from __future__ import annotations

from typing import Any, Dict, List, Mapping
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app import models
from app.schemas import FormDetailResponse, BuilderElementOut, BuilderConditionOut, FormSummaryResponse


def _enum_value(x):
    return x.value if hasattr(x, "value") else x


async def build_form_detail_response(
    db: AsyncSession,
    form: models.Form,
) -> FormDetailResponse:
    elements_result = await db.execute(
        select(models.FormElement)
        .where(models.FormElement.form_id == form.form_id)
        .order_by(models.FormElement.position.asc())
    )
    elements = elements_result.scalars().all()
    file_ids: list[int] = []
    for element in elements:
        for fid in (element.file_ids or []):
            try:
                parsed = int(fid)
            except (TypeError, ValueError):
                continue
            if parsed > 0:
                file_ids.append(parsed)

    file_map: dict[int, models.UploadedFile] = {}
    if file_ids:
        files_result = await db.execute(
            select(models.UploadedFile)
            .where(models.UploadedFile.file_id.in_(list(dict.fromkeys(file_ids))))
            .where(models.UploadedFile.status != "deleted")
        )
        for row in files_result.scalars().all():
            file_map[row.file_id] = row

    element_id_to_client: Dict[int, str] = {}
    builder_elements: List[BuilderElementOut] = []

    for index, el in enumerate(elements):
        other_settings = dict(el.other_settings or {})
        client_id = other_settings.pop("client_id", None)
        sort_index = other_settings.pop("sort_index", None)
        attachments: list[dict[str, Any]] = []
        for file_id in list(el.file_ids or []):
            row = file_map.get(file_id)
            if not row:
                continue
            attachments.append(
                {
                    "file_id": row.file_id,
                    "name": row.name,
                    "mime_type": row.mime_type,
                    "size_bytes": row.size_bytes,
                    "url": f"/api/v1/files/{row.file_id}/download?token={row.access_token}",
                    "content_hash": row.content_hash,
                    "status": _enum_value(row.status),
                }
            )
        if attachments:
            other_settings["attachments"] = attachments

        client_id = str(client_id) if client_id else str(el.element_id)
        sort_index = int(sort_index) if sort_index is not None else (el.position if el.position is not None else index)

        element_id_to_client[el.element_id] = client_id

        builder_elements.append(
            BuilderElementOut(
                client_id=client_id,
                widget=_enum_value(el.widget),
                semantic=_enum_value(el.semantic) if el.semantic is not None else None,
                label=el.label,
                description=el.description,
                required_field=bool(el.required_field),
                correct_answer=el.correct_answer,
                text_hint=el.text_hint,
                supportive_text=el.supportive_text,
                other_settings=other_settings or None,
                file_ids=list(el.file_ids or []),
                sort_index=sort_index,
            )
        )

    conditions_result = await db.execute(
        select(models.FormElementCondition).where(models.FormElementCondition.form_id == form.form_id)
    )
    conditions = conditions_result.scalars().all()
    builder_conditions: List[BuilderConditionOut] = []

    for cond in conditions:
        source_client = element_id_to_client.get(cond.source_element_id)
        target_client = element_id_to_client.get(cond.target_element_id)
        if not source_client or not target_client:
            continue
        builder_conditions.append(
            BuilderConditionOut(
                source_client_id=source_client,
                target_client_id=target_client,
                operator=_enum_value(cond.operator),
                value=cond.value,
            )
        )

    return FormDetailResponse(
        form_id=form.form_id,
        user_id=form.user_id,
        title=form.title,
        description=form.description,
        settings_json=form.settings_json,
        start_at=form.start_at,
        end_at=form.end_at,
        access_mode=_enum_value(form.access_mode),
        status=_enum_value(form.status),
        deleted_at=form.deleted_at,
        expires_at=form.expires_at,
        version=form.version,
        prev_form_id=form.prev_form_id,
        created_at=form.created_at,
        updated_at=form.updated_at,
        elements=builder_elements,
        conditions=builder_conditions,
    )


async def build_form_summaries(
    db: AsyncSession,
    forms: List[models.Form],
    permissions_by_form: Mapping[int, Dict[str, bool]] | None = None,
    current_user_id: int | None = None,
) -> List[FormSummaryResponse]:
    if not forms:
        return []
    form_ids = [f.form_id for f in forms]
    owner_ids = list({f.user_id for f in forms})

    counts_result = await db.execute(
        select(models.FormElement.form_id, func.count(models.FormElement.element_id))
        .where(models.FormElement.form_id.in_(form_ids))
        .group_by(models.FormElement.form_id)
    )
    counts_map = {row[0]: row[1] for row in counts_result.all()}

    owners_result = await db.execute(
        select(models.AppUser.user_id, models.AppUser.name)
        .where(models.AppUser.user_id.in_(owner_ids))
    )
    owner_name_map = {row[0]: row[1] for row in owners_result.all()}

    # Подсчитываем попытки пользователя для каждой формы
    attempts_by_form_id: Dict[int, int] = {}
    if current_user_id is not None and form_ids:
        # Получаем все ответы пользователя на эти формы
        responses_result = await db.execute(
            select(models.Response.form_id, models.Response.status)
            .where(models.Response.form_id.in_(form_ids))
            .where(models.Response.user_id == current_user_id)
        )
        
        # Группируем ответы по формам
        responses_by_form: Dict[int, List[str]] = {}
        for form_id, status in responses_result.all():
            status_value = status.value if hasattr(status, "value") else str(status)
            if form_id not in responses_by_form:
                responses_by_form[form_id] = []
            responses_by_form[form_id].append(status_value)
        
        # Для каждой формы определяем, какие статусы считать попытками
        for form in forms:
            settings = form.settings_json if isinstance(form.settings_json, dict) else {}
            revoke_counts_as_attempt = settings.get("revokeCountsAsAttempt", False)
            
            # Определяем статусы, которые считаются попытками
            status_filter = ["submitted"]
            if revoke_counts_as_attempt:
                status_filter.append("cancelled")
            
            # Подсчитываем попытки для этой формы
            form_responses = responses_by_form.get(form.form_id, [])
            attempts_count = sum(1 for status in form_responses if status in status_filter)
            attempts_by_form_id[form.form_id] = attempts_count

    summaries: List[FormSummaryResponse] = []
    for form in forms:
        status_value = _enum_value(form.status)
        default_permissions = {
            "can_edit": True,
            "can_view_responses": status_value == "submitted",
            "can_continue_passage": status_value == "submitted",
        }
        resolved_permissions = (
            permissions_by_form.get(form.form_id, default_permissions)
            if permissions_by_form
            else default_permissions
        )

        # Вычисляем информацию о попытках
        settings = form.settings_json if isinstance(form.settings_json, dict) else {}
        attempt_limit_type = settings.get("attemptLimitType", "unlimited")
        attempt_limit_value = settings.get("attemptLimit")
        
        attempt_limit: int | None = None
        attempts_used = attempts_by_form_id.get(form.form_id, 0)
        attempts_remaining: int | None = None
        
        if attempt_limit_type == "limited" and attempt_limit_value is not None:
            try:
                attempt_limit = int(attempt_limit_value)
                if attempt_limit > 0:
                    attempts_remaining = max(0, attempt_limit - attempts_used)
            except (TypeError, ValueError):
                pass

        summaries.append(
            FormSummaryResponse(
                form_id=form.form_id,
                user_id=form.user_id,
                title=form.title,
                description=form.description,
                settings_json=form.settings_json,
                start_at=form.start_at,
                end_at=form.end_at,
                access_mode=_enum_value(form.access_mode),
                status=_enum_value(form.status),
                deleted_at=form.deleted_at,
                expires_at=form.expires_at,
                version=form.version,
                prev_form_id=form.prev_form_id,
                created_at=form.created_at,
                updated_at=form.updated_at,
                elements_count=counts_map.get(form.form_id, 0),
                owner_name=owner_name_map.get(form.user_id),
                can_edit=bool(resolved_permissions.get("can_edit", False)),
                can_view_responses=bool(resolved_permissions.get("can_view_responses", False)),
                can_continue_passage=bool(resolved_permissions.get("can_continue_passage", False)),
                attempt_limit=attempt_limit,
                attempts_used=attempts_used,
                attempts_remaining=attempts_remaining,
            )
        )
    return summaries
