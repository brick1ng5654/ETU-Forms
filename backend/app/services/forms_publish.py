from __future__ import annotations

from typing import Any
from secrets import token_urlsafe
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update, delete

from app import models
from app.schemas import FormBuilderPayload


FORM_DRAFT_TTL_DAYS = 7


def _enum_value(x: Any) -> Any:
    return x.value if hasattr(x, "value") else x


def _draft_expires_at() -> datetime:
    return datetime.utcnow() + timedelta(days=FORM_DRAFT_TTL_DAYS)


def _ensure_form_settings(
    current_settings: Any,
    incoming_settings: Any,
    *,
    form_id: int,
    access_mode: str | None,
) -> dict[str, Any]:
    merged: dict[str, Any] = {}
    if isinstance(current_settings, dict):
        merged.update(current_settings)
    if isinstance(incoming_settings, dict):
        merged.update(incoming_settings)

    merged.setdefault("client_form_id", str(form_id))
    if access_mode in {"private", "unauthenticated"} and not merged.get("privateLinkKey"):
        merged["privateLinkKey"] = token_urlsafe(24)

    return merged


async def _replace_elements_and_conditions(
    db: AsyncSession,
    form_id: int,
    payload: FormBuilderPayload,
    *,
    mark_files_submitted: bool,
) -> None:
    await db.execute(
        delete(models.FormElementCondition).where(models.FormElementCondition.form_id == form_id)
    )
    await db.execute(delete(models.FormElement).where(models.FormElement.form_id == form_id))
    await db.flush()

    client_to_db_id: dict[str, int] = {}

    for el in sorted(payload.elements, key=lambda x: x.sort_index):
        other = dict(el.other_settings or {})

        placeholder = other.pop("placeholder", None)
        text_hint = el.text_hint
        if text_hint is None and isinstance(placeholder, str):
            text_hint = placeholder

        other.pop("conditionalLogic", None)

        other["client_id"] = el.client_id
        other["sort_index"] = el.sort_index

        file_ids = list(dict.fromkeys(el.file_ids or []))
        if len(file_ids) > 10:
            raise ValueError("file_ids must contain at most 10 items")

        supportive_text = el.supportive_text if el.supportive_text is not None else el.description

        row = models.FormElement(
            form_id=form_id,
            template_id=None,
            widget=_enum_value(el.widget),
            semantic=_enum_value(el.semantic) if el.semantic is not None else None,
            label=el.label,
            correct_answer=el.correct_answer,
            text_hint=text_hint,
            supportive_text=supportive_text,
            required_field=bool(el.required_field),
            position=el.sort_index,
            other_settings=other,
            file_ids=file_ids,
        )
        db.add(row)
        await db.flush()

        if mark_files_submitted and file_ids:
            await db.execute(
                update(models.UploadedFile)
                .where(models.UploadedFile.file_id.in_(file_ids))
                .values(status="submitted", expires_at=None)
            )

        client_to_db_id[el.client_id] = row.element_id

    for c in payload.conditions:
        source_id = client_to_db_id.get(c.source_client_id)
        target_id = client_to_db_id.get(c.target_client_id)
        if not source_id or not target_id:
            raise ValueError(f"Unknown element client_id in condition: {c.source_client_id} -> {c.target_client_id}")

        db.add(
            models.FormElementCondition(
                form_id=form_id,
                template_id=None,
                source_element_id=source_id,
                target_element_id=target_id,
                operator=_enum_value(c.operator),
                value=c.value,
            )
        )

    await db.flush()


async def apply_builder_payload(
    db: AsyncSession,
    form: models.Form,
    payload: FormBuilderPayload,
    *,
    target_status: str,
) -> models.Form:
    next_access_mode = _enum_value(payload.access_mode) if payload.access_mode is not None else _enum_value(form.access_mode)
    form.title = payload.title
    form.description = payload.description
    form.settings_json = _ensure_form_settings(
        form.settings_json,
        payload.settings_json,
        form_id=form.form_id,
        access_mode=next_access_mode,
    )
    form.start_at = payload.start_at
    form.end_at = payload.end_at
    if payload.access_mode is not None:
        form.access_mode = next_access_mode

    if target_status == "submitted":
        form.status = "submitted"
        form.expires_at = None
        form.deleted_at = None
    else:
        form.status = "temp"
        form.expires_at = _draft_expires_at()

    await db.flush()

    await _replace_elements_and_conditions(
        db,
        form.form_id,
        payload,
        mark_files_submitted=(target_status == "submitted"),
    )

    await db.refresh(form)
    return form
