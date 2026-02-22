from __future__ import annotations

from datetime import datetime, timedelta, timezone
import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import (
    AccessControl,
    AppUser,
    Form,
    FormElement,
    Response,
    ResponseAnswer,
    UploadedFile,
)
from app.schemas import (
    BuilderElementOut,
    FormStoredResponse,
    FormStoredResponsesResponse,
    FormSubmitAnswersRequest,
    FormSubmitAnswersResponse,
    PublicFormDetailResponse,
)
from app.security.auth_dependencies import get_current_user, get_optional_user
from app.services.forms_mapping import build_form_detail_response

router = APIRouter(prefix="/forms", tags=["forms"])

ANON_EMAIL = "anonymous@etu-forms.local"
ANON_NAME = "Anonymous Respondent"
SNILS_DIGITS_ONLY_RE = re.compile(r"\D")
SNILS_TRIPLE_DIGIT_RE = re.compile(r"(\d)\1\1")
SNILS_FORMATTED_RE = re.compile(r"^\d{3}-\d{3}-\d{3}\s\d{2}$")
SNILS_PLAIN_RE = re.compile(r"^\d{11}$")
SNILS_CHECKSUM_THRESHOLD = 1_001_998
SNILS_INVALID_MSG = "Invalid SNILS"
SNILS_REPEATED_DIGITS_MSG = "Invalid SNILS repeated digits"
SNILS_CHECKSUM_MSG = "Invalid SNILS checksum"


def _enum_value(x: Any) -> Any:
    return x.value if hasattr(x, "value") else x


def _protected_link_key(form: Form) -> str | None:
    settings = form.settings_json if isinstance(form.settings_json, dict) else {}
    raw = settings.get("privateLinkKey")
    return raw if isinstance(raw, str) and raw else None


def _public_settings(form: Form) -> dict[str, Any] | None:
    if not isinstance(form.settings_json, dict):
        return None
    settings = dict(form.settings_json)
    settings.pop("privateLinkKey", None)
    return settings or None


def _increment_link_views(form: Form) -> None:
    settings = dict(form.settings_json) if isinstance(form.settings_json, dict) else {}
    try:
        current = int(settings.get("linkViews", 0))
    except (TypeError, ValueError):
        current = 0
    settings["linkViews"] = max(0, current) + 1
    form.settings_json = settings


def _is_auth_required(form: Form) -> bool:
    return _enum_value(form.access_mode) == "private"


def _now_for_compare(form: Form) -> datetime:
    # Keep timezone compatibility with DB value (aware/naive).
    reference = form.start_at or form.end_at
    if reference is not None and reference.tzinfo is not None:
        return datetime.now(reference.tzinfo)
    return datetime.utcnow()


def _check_form_access(form: Form, key: str | None, current_user: AppUser | None) -> None:
    status_value = _enum_value(form.status)
    if status_value != "submitted":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")

    if _is_auth_required(form) and current_user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    now = _now_for_compare(form)
    if form.start_at is not None and form.start_at > now:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Form is not open yet")
    if form.end_at is not None and form.end_at < now:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Form is closed")

    access_mode = _enum_value(form.access_mode)
    if access_mode in {"private", "unauthenticated"}:
        expected = _protected_link_key(form)
        provided = key.strip() if isinstance(key, str) else None
        if not expected or provided != expected:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid link key")


async def _get_published_form(db: AsyncSession, form_id: int) -> Form:
    result = await db.execute(select(Form).where(Form.form_id == form_id))
    form = result.scalar_one_or_none()
    if not form or form.status == "deleted":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")
    return form


async def _resolve_latest_submitted_form(db: AsyncSession, form: Form) -> Form:
    current = form
    visited = {current.form_id}

    while True:
        result = await db.execute(
            select(Form)
            .where(Form.prev_form_id == current.form_id)
            .where(Form.status == "submitted")
            .order_by(Form.version.desc(), Form.updated_at.desc(), Form.form_id.desc())
            .limit(1)
        )
        next_form = result.scalar_one_or_none()
        if next_form is None:
            break
        if next_form.form_id in visited:
            break
        visited.add(next_form.form_id)
        current = next_form

    return current


async def _get_or_create_anonymous_user(db: AsyncSession) -> AppUser:
    result = await db.execute(select(AppUser).where(AppUser.email == ANON_EMAIL))
    user = result.scalar_one_or_none()
    if user:
        return user

    user = AppUser(
        name=ANON_NAME,
        email=ANON_EMAIL,
        etu_id=None,
        is_admin=False,
    )
    db.add(user)
    await db.flush()
    return user


async def _resolve_responder(
    db: AsyncSession,
    current_user: AppUser | None,
) -> AppUser:
    if current_user is not None:
        return current_user
    return await _get_or_create_anonymous_user(db)


def _extract_file_ids(value: Any) -> list[int]:
    if not isinstance(value, dict):
        return []
    raw_ids = value.get("file_ids")
    if not isinstance(raw_ids, list):
        return []

    normalized: list[int] = []
    for item in raw_ids:
        try:
            file_id = int(item)
        except (TypeError, ValueError):
            continue
        if file_id > 0:
            normalized.append(file_id)
    unique_ids = list(dict.fromkeys(normalized))
    return unique_ids[:10]


def _apply_answer_value(answer_row: ResponseAnswer, value: Any) -> None:
    answer_row.value_text = None
    answer_row.value_number = None
    answer_row.value_bool = None
    answer_row.value_date = None
    answer_row.value_time = None
    answer_row.value_json = None

    if value is None:
        return

    answer_row.value_json = value
    if isinstance(value, bool):
        answer_row.value_bool = value
    elif isinstance(value, int):
        answer_row.value_number = value
    elif isinstance(value, str):
        answer_row.value_text = value


def _snils_checksum(number: str) -> int:
    total = sum(int(digit) * weight for weight, digit in enumerate(reversed(number), start=1))
    if total < 100:
        return total
    if total in (100, 101):
        return 0

    remainder = total % 101
    if remainder in (100, 101):
        return 0
    return remainder


def _validate_snils_value(value: Any) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        return SNILS_INVALID_MSG

    candidate = value.strip()
    if candidate == "":
        return None

    if not (SNILS_PLAIN_RE.fullmatch(candidate) or SNILS_FORMATTED_RE.fullmatch(candidate)):
        return "SNILS must match XXX-XXX-XXX YY or contain 11 digits"

    digits = SNILS_DIGITS_ONLY_RE.sub("", candidate)
    number = digits[:9]
    checksum = digits[9:]

    if SNILS_TRIPLE_DIGIT_RE.search(number):
        return SNILS_REPEATED_DIGITS_MSG

    if int(number) > SNILS_CHECKSUM_THRESHOLD:
        expected = _snils_checksum(number)
        if int(checksum) != expected:
            return SNILS_CHECKSUM_MSG
    return None


def _validate_semantic_answer(element: FormElement, value: Any) -> str | None:
    semantic = _enum_value(element.semantic)
    if semantic == "snils":
        return _validate_snils_value(value)
    return None


def _file_url(file_id: int, token: str) -> str:
    return f"/api/v1/files/{file_id}/download?token={token}"


def _deserialize_answer_value(
    answer_row: ResponseAnswer,
    attachments: list[dict[str, Any]],
) -> Any:
    if attachments:
        return attachments
    if answer_row.value_json is not None:
        return answer_row.value_json
    if answer_row.value_bool is not None:
        return answer_row.value_bool
    if answer_row.value_number is not None:
        return answer_row.value_number
    if answer_row.value_text is not None:
        return answer_row.value_text
    if answer_row.value_date is not None:
        return answer_row.value_date.isoformat()
    if answer_row.value_time is not None:
        return answer_row.value_time.isoformat()
    return None


async def _ensure_editor_or_owner(
    db: AsyncSession,
    form_id: int,
    current_user: AppUser,
    allowed_roles: tuple[str, ...] = ("editor",),
) -> Form:
    result = await db.execute(select(Form).where(Form.form_id == form_id))
    form = result.scalar_one_or_none()
    if not form or form.status == "deleted":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")

    if form.user_id == current_user.user_id:
        return form

    if not allowed_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    access = await db.execute(
        select(AccessControl)
        .where(AccessControl.form_id == form_id)
        .where(AccessControl.user_id == current_user.user_id)
        .where(AccessControl.role.in_(allowed_roles))
    )
    if not access.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return form


@router.get("/{form_id}/public", response_model=PublicFormDetailResponse)
async def get_public_form(
    form_id: int,
    key: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: AppUser | None = Depends(get_optional_user),
):
    form = await _get_published_form(db, form_id)
    form = await _resolve_latest_submitted_form(db, form)
    _check_form_access(form, key, current_user)
    _increment_link_views(form)
    await db.flush()
    # `updated_at` may become expired after flush (onupdate=now()); refresh to avoid async lazy-load.
    await db.refresh(form)

    detail = await build_form_detail_response(db, form)
    elements = [
        BuilderElementOut(**{**element.model_dump(), "correct_answer": None})
        for element in detail.elements
    ]

    return PublicFormDetailResponse(
        form_id=detail.form_id,
        title=detail.title,
        description=detail.description,
        settings_json=_public_settings(form),
        start_at=detail.start_at,
        end_at=detail.end_at,
        access_mode=detail.access_mode,
        status=detail.status,
        version=detail.version,
        prev_form_id=detail.prev_form_id,
        created_at=detail.created_at,
        updated_at=detail.updated_at,
        pages=detail.pages,
        elements=elements,
        conditions=detail.conditions,
    )


@router.post(
    "/{form_id}/responses",
    response_model=FormSubmitAnswersResponse,
    status_code=status.HTTP_201_CREATED,
)
async def submit_form_response(
    form_id: int,
    payload: FormSubmitAnswersRequest,
    key: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: AppUser | None = Depends(get_optional_user),
):
    form = await _get_published_form(db, form_id)
    form = await _resolve_latest_submitted_form(db, form)
    _check_form_access(form, key, current_user)

    responder = await _resolve_responder(db, current_user)
    elements_result = await db.execute(select(FormElement).where(FormElement.form_id == form.form_id))
    form_elements = elements_result.scalars().all()

    by_client_id: dict[str, FormElement] = {}
    for element in form_elements:
        settings = element.other_settings if isinstance(element.other_settings, dict) else {}
        client_id = settings.get("client_id")
        resolved_id = str(client_id) if client_id is not None else str(element.element_id)
        by_client_id[resolved_id] = element

    unknown_ids = [client_id for client_id in payload.answers.keys() if client_id not in by_client_id]
    if unknown_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown element id(s): {', '.join(unknown_ids[:5])}",
        )

    completed_at = datetime.now(timezone.utc)
    started_at = completed_at
    if payload.started_at is not None:
        candidate = payload.started_at
        if candidate.tzinfo is None:
            candidate = candidate.replace(tzinfo=timezone.utc)
        else:
            candidate = candidate.astimezone(timezone.utc)
        if candidate > completed_at:
            candidate = completed_at
        max_history = completed_at - timedelta(hours=24)
        if candidate < max_history:
            candidate = max_history
        started_at = candidate

    response_row = Response(
        user_id=responder.user_id,
        form_id=form.form_id,
        created_at=started_at,
        status="submitted",
        completed_at=completed_at,
    )
    db.add(response_row)
    await db.flush()

    answers_count = 0
    for client_id, value in payload.answers.items():
        element = by_client_id.get(client_id)
        if element is None:
            continue
        semantic_error = _validate_semantic_answer(element, value)
        if semantic_error is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid value for '{client_id}': {semantic_error}",
            )

        answer_row = ResponseAnswer(
            response_id=response_row.response_id,
            element_id=element.element_id,
        )
        _apply_answer_value(answer_row, value)
        db.add(answer_row)
        await db.flush()

        file_ids = _extract_file_ids(value)
        if file_ids:
            await db.execute(
                update(UploadedFile)
                .where(UploadedFile.file_id.in_(file_ids))
                .values(
                    answer_id=answer_row.answer_id,
                    status="submitted",
                    expires_at=None,
                )
            )
        answers_count += 1

    return FormSubmitAnswersResponse(
        response_id=response_row.response_id,
        submitted_at=response_row.completed_at or completed_at,
        answers_count=answers_count,
    )


@router.get("/{form_id}/responses", response_model=FormStoredResponsesResponse)
async def get_form_responses(
    form_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    form = await _ensure_editor_or_owner(db, form_id, current_user, allowed_roles=("editor", "participant"))

    responses_result = await db.execute(
        select(Response)
        .where(Response.form_id == form.form_id)
        .where(Response.status == "submitted")
        .order_by(Response.completed_at.desc(), Response.created_at.desc())
    )
    responses = responses_result.scalars().all()
    if not responses:
        return FormStoredResponsesResponse(responses=[])

    response_ids = [item.response_id for item in responses]
    user_ids = list({item.user_id for item in responses})

    answers_result = await db.execute(
        select(ResponseAnswer).where(ResponseAnswer.response_id.in_(response_ids))
    )
    answer_rows = answers_result.scalars().all()

    elements_result = await db.execute(
        select(FormElement).where(FormElement.form_id == form.form_id)
    )
    elements = elements_result.scalars().all()
    element_client_map: dict[int, str] = {}
    for element in elements:
        settings = element.other_settings if isinstance(element.other_settings, dict) else {}
        client_id = settings.get("client_id")
        element_client_map[element.element_id] = str(client_id) if client_id is not None else str(element.element_id)

    users_result = await db.execute(select(AppUser).where(AppUser.user_id.in_(user_ids)))
    users_map = {user.user_id: user for user in users_result.scalars().all()}

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
                    "url": _file_url(file_row.file_id, file_row.access_token),
                    "content_hash": file_row.content_hash,
                    "status": _enum_value(file_row.status),
                }
            )

    answers_by_response_id: dict[int, dict[str, Any]] = {}
    for answer_row in answer_rows:
        client_id = element_client_map.get(answer_row.element_id, str(answer_row.element_id))
        attachments = files_by_answer_id.get(answer_row.answer_id, [])
        value = _deserialize_answer_value(answer_row, attachments)
        answers_by_response_id.setdefault(answer_row.response_id, {})[client_id] = value

    out: list[FormStoredResponse] = []
    form_version = form.version or 1
    for response_row in responses:
        user = users_map.get(response_row.user_id)
        out.append(
            FormStoredResponse(
                response_id=response_row.response_id,
                form_id=response_row.form_id,
                user_id=response_row.user_id,
                responder_name=user.name if user else f"User {response_row.user_id}",
                responder_email=user.email if user else None,
                status=_enum_value(response_row.status),
                created_at=response_row.created_at,
                completed_at=response_row.completed_at,
                version=form_version,
                answers=answers_by_response_id.get(response_row.response_id, {}),
            )
        )

    return FormStoredResponsesResponse(responses=out)
