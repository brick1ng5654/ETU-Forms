from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app import models
from app.schemas import FormPublishRequest

async def publish_form(db: AsyncSession, payload: FormPublishRequest) -> models.Form:
    form = models.Form(
        user_id=payload.user_id,
        title=payload.title,
        description=payload.description,
        settings_json=payload.settings_json,
        start_at=payload.start_at,
        end_at=payload.end_at,
        access_mode=payload.access_mode.value if hasattr(payload.access_mode, "value") else payload.access_mode,
    )
    db.add(form)
    await db.flush() # получаем form.form_id

    client_to_db_id: dict[str, int] = {}

    # элементы
    for el in sorted(payload.elements, key=lambda x: x.sort_index):
        other = dict(el.other_settings or {})
        other["client_id"] = el.client_id
        other["sort_index"] = el.sort_index

        row = models.FormElement(
            form_id=form.form_id,
            template_id=None,
            widget=el.widget.value if hasattr(el.widget, "value") else el.widget,
            semantic=(el.semantic.value if (el.semantic and hasattr(el.semantic, "value")) else el.semantic),
            label=el.label,
            correct_answer=el.correct_answer,
            text_hint=el.text_hint,
            supportive_text=el.supportive_text if el.supportive_text is not None else el.description,
            required_field=el.required_field,
            position=el.sort_index,
            other_settings=other,
        )
        db.add(row)
        await db.flush() # получаем row.element_id
        client_to_db_id[el.client_id] = row.element_id

    # условия
    for c in payload.conditions:
        source_id = client_to_db_id.get(c.source_client_id)
        target_id = client_to_db_id.get(c.target_client_id)
        if not source_id or not target_id:
            raise ValueError(f"Unknown element client_id in condition: {c.source_client_id} -> {c.target_client_id}")
        
        cond = models.FormElementCondition(
            form_id=form.form_id,
            template_id=None,
            source_element_id=source_id,
            target_element_id=target_id,
            operator=c.operator.value if hasattr(c.operator, "value") else c.operator,
            value=c.value,
        )
        db.add(cond)

    await db.refresh(form)
    return form
