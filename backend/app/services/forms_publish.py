from __future__ import annotations

from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update

from app import models
from app.schemas import FormPublishRequest


def _enum_value(x: Any) -> Any:
    return x.value if hasattr(x, "value") else x


async def publish_form(db: AsyncSession, payload: FormPublishRequest) -> models.Form:
    form = models.Form(
        user_id=payload.user_id,
        title=payload.title,
        description=payload.description,
        settings_json=payload.settings_json,
        start_at=payload.start_at,
        end_at=payload.end_at,
        access_mode=_enum_value(payload.access_mode) if payload.access_mode is not None else "private",
    )
    db.add(form)
    await db.flush()

    client_to_db_id: dict[str, int] = {}
    created_elements: list[models.FormElement] = []

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

        row = models.FormElement(
            form_id=form.form_id,
            template_id=None,
            widget=_enum_value(el.widget),
            semantic=_enum_value(el.semantic) if el.semantic is not None else None,
            label=el.label,
            description=el.description,
            correct_answer=el.correct_answer,
            text_hint=text_hint,
            supportive_text=el.supportive_text if el.supportive_text is not None else None,
            required_field=bool(el.required_field),
            position=el.sort_index,
            other_settings=other,
            file_ids=file_ids,
        )
        db.add(row)
        await db.flush()

        if file_ids:
            await db.execute(
                update(models.UploadedFile)
                .where(models.UploadedFile.file_id.in_(file_ids))
                .values(status="submitted", expires_at=None)
            )

        client_to_db_id[el.client_id] = row.element_id
        created_elements.append(row)

    for c in payload.conditions:
        source_id = client_to_db_id.get(c.source_client_id)
        target_id = client_to_db_id.get(c.target_client_id)
        if not source_id or not target_id:
            raise ValueError(f"Unknown element client_id in condition: {c.source_client_id} -> {c.target_client_id}")

        db.add(
            models.FormElementCondition(
                form_id=form.form_id,
                template_id=None,
                source_element_id=source_id,
                target_element_id=target_id,
                operator=_enum_value(c.operator),
                value=c.value,
            )
        )

    await db.flush()
    await db.refresh(form)
    return form
