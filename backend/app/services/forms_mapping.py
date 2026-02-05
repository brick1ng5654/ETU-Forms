from __future__ import annotations

from typing import Dict, List
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

    element_id_to_client: Dict[int, str] = {}
    builder_elements: List[BuilderElementOut] = []

    for index, el in enumerate(elements):
        other_settings = dict(el.other_settings or {})
        client_id = other_settings.pop("client_id", None)
        sort_index = other_settings.pop("sort_index", None)

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
) -> List[FormSummaryResponse]:
    if not forms:
        return []
    form_ids = [f.form_id for f in forms]
    counts_result = await db.execute(
        select(models.FormElement.form_id, func.count(models.FormElement.element_id))
        .where(models.FormElement.form_id.in_(form_ids))
        .group_by(models.FormElement.form_id)
    )
    counts_map = {row[0]: row[1] for row in counts_result.all()}

    summaries: List[FormSummaryResponse] = []
    for form in forms:
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
            )
        )
    return summaries
