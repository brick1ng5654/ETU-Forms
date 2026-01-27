from __future__ import annotations

from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.schemas import FormPublishRequest


# Normalize Enum-like values to their raw value for DB storage.
def _enum_value(x: Any) -> Any:
    return x.value if hasattr(x, "value") else x


# Replace client_id references in dependsOn with DB element_id equivalents.
def _rewrite_depends_on(value: Any, client_to_db_id: dict[str, int]) -> Any:
    """
    Поддержка:
      - "abc" -> 123
      - ["a","b"] -> [1,2]
      - 123 -> 123 (уже element_id)
      - None -> None
    """
    if value is None:
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        mapped = client_to_db_id.get(value)
        if mapped is None:
            raise ValueError(f"Unknown dependsOn client_id: {value}")
        return mapped
    if isinstance(value, list):
        out = []
        for item in value:
            if item is None:
                out.append(None)
            elif isinstance(item, int):
                out.append(item)
            elif isinstance(item, str):
                mapped = client_to_db_id.get(item)
                if mapped is None:
                    raise ValueError(f"Unknown dependsOn client_id in list: {item}")
                out.append(mapped)
            else:
                out.append(item)
        return out
    return value


# Extract a condition tuple from other_settings when present.
def _extract_condition_from_other_settings(
    other: dict[str, Any],
    target_element_id: int,
) -> tuple[int, str, Any] | None:
    """
    Пытаемся вытащить условие из other_settings.
    Варианты (примерные):
      - other_settings = {"conditionalLogic": {"dependsOn": 123, "operator": "equals", "value": {...}}}
      - other_settings = {"dependsOn": 123, "operator": "equals", "value": {...}}
    Возвращает: (source_element_id, operator, value) или None.
    """
    if isinstance(other.get("conditionalLogic"), dict):
        cl = other.get("conditionalLogic") or {}
        src = cl.get("dependsOn")
        op = cl.get("operator")
        val = cl.get("value")
        if isinstance(src, int) and op:
            return (src, op, val)

    src = other.get("dependsOn")
    op = other.get("operator")
    val = other.get("value")
    if isinstance(src, int) and op:
        return (src, op, val)

    return None


# Create a form with elements, rewrite dependencies, and persist conditions.
async def publish_form(db: AsyncSession, payload: FormPublishRequest) -> models.Form:
    # 1) создаем форму
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
    await db.flush()  # получаем form.form_id

    client_to_db_id: dict[str, int] = {}
    created_elements: list[models.FormElement] = []

    # 2) создаем элементы (первый проход: НЕ переписываем dependsOn, просто сохраняем как есть)
    for el in sorted(payload.elements, key=lambda x: x.sort_index):
        other = dict(el.other_settings or {})

        placeholder = other.pop("placeholder", None)
        text_hint = el.text_hint
        if text_hint is None and isinstance(placeholder, str):
            text_hint = placeholder

        # полезно для дебага/миграций
        other["client_id"] = el.client_id
        other["sort_index"] = el.sort_index

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
        )
        db.add(row)
        await db.flush()  # получаем row.element_id

        client_to_db_id[el.client_id] = row.element_id
        created_elements.append(row)

    # 3) второй проход: переписываем dependsOn/conditionalLogic.dependsOn уже когда mapping готов
    for row in created_elements:
        other = dict(row.other_settings or {})

        if "dependsOn" in other:
            other["dependsOn"] = _rewrite_depends_on(other.get("dependsOn"), client_to_db_id)

        if isinstance(other.get("conditionalLogic"), dict):
            cl = dict(other.get("conditionalLogic") or {})
            if "dependsOn" in cl:
                cl["dependsOn"] = _rewrite_depends_on(cl.get("dependsOn"), client_to_db_id)
            other["conditionalLogic"] = cl

        row.other_settings = other

    # 4) условия: (A) то, что пришло отдельным массивом payload.conditions
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
