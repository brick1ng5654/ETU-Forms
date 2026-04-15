from __future__ import annotations

import io
import json
import re
from datetime import datetime
from typing import Any

from app.models import AppUser, FormElement, Response

EXPORT_HEADERS = {
    "ru": {
        "responder_name": "Респондент",
        "responder_email": "Email",
        "status": "Статус",
        "version": "Версия формы",
        "other": "Другое",
    },
    "en": {
        "responder_name": "Responder",
        "responder_email": "Email",
        "status": "Status",
        "version": "Form version",
        "other": "Other",
    },
}

EXPORT_LIST_SEP = "\n"

EXPORT_SHEETS = {
    "ru": {"responses": "Ответы", "summary": "Итоги", "statistics": "Статистика"},
    "en": {"responses": "Responses", "summary": "Summary", "statistics": "Statistics"},
}

EXPORT_SUMMARY = {
    "ru": {
        "metric": "Показатель",
        "value": "Значение",
        "form_title": "Название формы",
        "exported_at": "Дата и время выгрузки",
        "responses_in_export": "Ответов в выгрузке",
        "status_submitted": "Отправлено",
        "status_cancelled": "Отменено",
        "form_version": "Версия формы",
    },
    "en": {
        "metric": "Metric",
        "value": "Value",
        "form_title": "Form title",
        "exported_at": "Export date and time",
        "responses_in_export": "Responses in export",
        "status_submitted": "Submitted",
        "status_cancelled": "Cancelled",
        "form_version": "Form version",
    },
}

EXPORT_STATS = {
    "ru": {
        "dimension": "Показатель",
        "value_col": "Значение",
        "nonempty": "Ответов с данными по полю",
        "min": "Минимум",
        "max": "Максимум",
        "average": "Среднее",
        "distribution": "Распределение",
    },
    "en": {
        "dimension": "Metric",
        "value_col": "Value",
        "nonempty": "Non-empty answers for field",
        "min": "Minimum",
        "max": "Maximum",
        "average": "Average",
        "distribution": "Distribution",
    },
}

EXPORT_COMPLEX_FIELD_LABELS = {
    "ru": {
        "lastName": "Фамилия",
        "firstName": "Имя",
        "patronymic": "Отчество",
        "gender": "Пол",
        "birthDate": "Дата рождения",
        "seriesNumber": "Серия и номер",
        "issuedBy": "Кем выдан",
        "issueDate": "Дата выдачи",
        "departmentCode": "Код подразделения",
        "birthPlace": "Место рождения",
    },
    "en": {
        "lastName": "Last name",
        "firstName": "First name",
        "patronymic": "Middle name",
        "gender": "Gender",
        "birthDate": "Date of birth",
        "seriesNumber": "Series and number",
        "issuedBy": "Issued by",
        "issueDate": "Issue date",
        "departmentCode": "Department code",
        "birthPlace": "Place of birth",
    },
}

EXPORT_COMPLEX_FIELD_ORDER = (
    "lastName",
    "firstName",
    "patronymic",
    "gender",
    "birthDate",
    "seriesNumber",
    "issuedBy",
    "issueDate",
    "departmentCode",
    "birthPlace",
)

EXPORT_GENDER_LABELS = {
    "ru": {"male": "Мужской", "female": "Женский"},
    "en": {"male": "Male", "female": "Female"},
}

_XLSX_CELL_MAX_LEN = 32767
_ILLEGAL_XLSX_CTRL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")


def _enum_value(x: Any) -> Any:
    return x.value if hasattr(x, "value") else x


def _extract_element_client_id(element: FormElement) -> str:
    settings = element.other_settings if isinstance(element.other_settings, dict) else {}
    client_id = settings.get("client_id")
    return str(client_id) if client_id is not None else str(element.element_id)


def _prepare_xlsx_cell_value(value: Any) -> str:
    if value is None:
        text = ""
    else:
        text = str(value)
    text = _ILLEGAL_XLSX_CTRL.sub("", text)
    if len(text) > _XLSX_CELL_MAX_LEN:
        text = text[: _XLSX_CELL_MAX_LEN - 1] + "…"
    return text


def _extract_labeled_dict_parts(value: dict[str, Any], locale: str, list_sep: str) -> list[str]:
    labels = EXPORT_COMPLEX_FIELD_LABELS.get(locale, EXPORT_COMPLEX_FIELD_LABELS["en"])
    ordered_keys = [key for key in EXPORT_COMPLEX_FIELD_ORDER if key in value]
    remaining_keys = [key for key in value.keys() if key not in EXPORT_COMPLEX_FIELD_ORDER]
    out: list[str] = []

    for key in [*ordered_keys, *remaining_keys]:
        raw = value.get(key)
        if raw is None:
            continue
        if isinstance(raw, str):
            text = raw.strip()
        elif key == "gender":
            normalized_gender = str(raw).strip().lower()
            text = EXPORT_GENDER_LABELS.get(locale, EXPORT_GENDER_LABELS["en"]).get(
                normalized_gender, str(raw)
            )
        elif isinstance(raw, dict):
            text = json.dumps(raw, ensure_ascii=False, default=str)
        else:
            text = _stringify_export_value(raw, locale, list_sep).strip()
        if not text:
            continue
        label = labels.get(key, key)
        out.append(f"{label}: {text}")
    return out


def _extract_export_answer_parts(value: Any, locale: str, list_sep: str) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        out: list[str] = []
        for item in value:
            text = _stringify_export_value(item, locale, list_sep)
            if text:
                out.append(text)
        return out
    if isinstance(value, dict):
        if "attachments" in value and isinstance(value.get("attachments"), list):
            return _extract_export_answer_parts(value.get("attachments"), locale, list_sep)
        if "name" in value and isinstance(value.get("name"), str):
            name = str(value.get("name")).strip()
            return [name] if name else []
        if "url" in value and isinstance(value.get("url"), str):
            url = str(value.get("url")).strip()
            return [url] if url else []
        if "selected" in value or "otherSelected" in value:
            selected = value.get("selected")
            selected_parts: list[str] = []
            if isinstance(selected, list):
                selected_parts.extend([str(item) for item in selected if str(item).strip()])
            elif selected is not None and str(selected).strip():
                selected_parts.append(str(selected))
            if value.get("otherSelected"):
                other_text = str(value.get("otherText") or "").strip()
                other_label = EXPORT_HEADERS.get(locale, EXPORT_HEADERS["en"])["other"]
                selected_parts.append(f"{other_label}: {other_text}" if other_text else other_label)
            return selected_parts
        if "date" in value or "time" in value:
            date_part = str(value.get("date") or "").strip()
            time_part = str(value.get("time") or "").strip()
            joined = " ".join([part for part in [date_part, time_part] if part]).strip()
            return [joined] if joined else []
        labeled_parts = _extract_labeled_dict_parts(value, locale, list_sep)
        if labeled_parts:
            return labeled_parts
        text = json.dumps(value, ensure_ascii=False, default=str).strip()
        return [text] if text and text != "{}" else []
    text = _stringify_export_value(value, locale, list_sep).strip()
    return [text] if text else []


def _stringify_export_value(value: Any, locale: str, list_sep: str) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return list_sep.join(_extract_export_answer_parts(value, locale, list_sep))
    if isinstance(value, dict):
        parts = _extract_export_answer_parts(value, locale, list_sep)
        if parts:
            return list_sep.join(parts)
        return json.dumps(value, ensure_ascii=False, default=str)
    return str(value)


def _is_nonempty_export_answer(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, list):
        return len(value) > 0
    if isinstance(value, bool):
        return True
    if isinstance(value, (int, float)):
        return True
    if isinstance(value, dict):
        return True
    return True


def _collect_numeric_values_for_stats(values: list[Any]) -> list[float] | None:
    nums: list[float] = []
    for raw in values:
        if raw is None:
            continue
        if isinstance(raw, bool):
            return None
        if isinstance(raw, (int, float)):
            nums.append(float(raw))
            continue
        if isinstance(raw, str):
            s = raw.strip().replace(",", ".")
            if not s:
                continue
            try:
                nums.append(float(s))
            except ValueError:
                return None
            continue
        return None
    return nums if nums else None


def sanitize_filename_part(value: str) -> str:
    cleaned = re.sub(r'[<>:"/\\|?*\x00-\x1f]+', " ", value or "")
    cleaned = re.sub(r"\s+", " ", cleaned).strip().strip(".")
    return cleaned


def build_export_rows(
    *,
    form_version: int,
    responses: list[Response],
    answer_rows_by_response_id: dict[int, dict[str, Any]],
    users_map: dict[int, AppUser],
    sorted_elements: list[FormElement],
    locale: str,
    list_sep: str,
) -> tuple[list[str], list[list[str]]]:
    element_client_ids = [_extract_element_client_id(element) for element in sorted_elements]
    element_label_by_client_id = {
        _extract_element_client_id(element): (element.label or f"Field {element.element_id}").strip()
        or f"Field {element.element_id}"
        for element in sorted_elements
    }

    labels = EXPORT_HEADERS.get(locale, EXPORT_HEADERS["en"])
    headers = [
        labels["responder_name"],
        labels["responder_email"],
        labels["status"],
        labels["version"],
    ] + [element_label_by_client_id.get(client_id, client_id) for client_id in element_client_ids]

    rows: list[list[str]] = []
    for response_row in responses:
        user = users_map.get(response_row.user_id)
        answers = answer_rows_by_response_id.get(response_row.response_id, {})
        row = [
            (user.name or f"User {response_row.user_id}") if user else f"User {response_row.user_id}",
            (user.email or "") if user else "",
            str(_enum_value(response_row.status)),
            str(form_version),
        ]
        for client_id in element_client_ids:
            row.append(_stringify_export_value(answers.get(client_id), locale, list_sep))
        rows.append(row)
    return headers, rows


def build_summary_export_rows(
    *,
    locale: str,
    form_title: str,
    form_version: int,
    responses: list[Response],
    export_at: datetime,
) -> list[list[str]]:
    labels = EXPORT_SUMMARY.get(locale, EXPORT_SUMMARY["en"])
    submitted = sum(1 for r in responses if _enum_value(r.status) == "submitted")
    cancelled = sum(1 for r in responses if _enum_value(r.status) == "cancelled")
    ts = export_at.isoformat(timespec="seconds")
    return [
        [labels["metric"], labels["value"]],
        [labels["form_title"], form_title],
        [labels["form_version"], str(form_version)],
        [labels["exported_at"], ts],
        [labels["responses_in_export"], str(len(responses))],
        [labels["status_submitted"], str(submitted)],
        [labels["status_cancelled"], str(cancelled)],
    ]


def build_statistics_export_rows(
    *,
    locale: str,
    sorted_elements: list[FormElement],
    answer_rows_by_response_id: dict[int, dict[str, Any]],
    responses: list[Response],
) -> list[list[str]]:
    stats_labels = EXPORT_STATS.get(locale, EXPORT_STATS["en"])
    rows: list[list[str]] = [
        [stats_labels["dimension"], stats_labels["value_col"]],
    ]
    list_sep = EXPORT_LIST_SEP

    for element in sorted_elements:
        widget = _enum_value(element.widget)
        if widget in ("heading", "static_text"):
            continue
        client_id = _extract_element_client_id(element)
        label = (element.label or "").strip() or f"Field {element.element_id}"
        rows.append([f"— {label} —", ""])

        per_response: list[Any] = []
        for response_row in responses:
            raw = answer_rows_by_response_id.get(response_row.response_id, {}).get(client_id)
            per_response.append(raw)

        nonempty = [v for v in per_response if _is_nonempty_export_answer(v)]
        rows.append([stats_labels["nonempty"], str(len(nonempty))])

        if not nonempty:
            rows.append(["", ""])
            continue

        nums = _collect_numeric_values_for_stats(nonempty)
        if (
            nums is not None
            and len(nums) == len(nonempty)
            and widget in ("number_input", "rating")
        ):
            rows.append([stats_labels["min"], str(min(nums))])
            rows.append([stats_labels["max"], str(max(nums))])
            rows.append([stats_labels["average"], str(round(sum(nums) / len(nums), 6))])
            rows.append(["", ""])
            continue

        counter: dict[str, int] = {}
        for v in nonempty:
            for part in _extract_export_answer_parts(v, locale, list_sep):
                p = part.strip()
                if not p:
                    continue
                counter[p] = counter.get(p, 0) + 1
        if not counter:
            rows.append(["", ""])
            continue
        rows.append([stats_labels["distribution"], ""])
        for key in sorted(counter.keys(), key=lambda s: (-counter[s], s)):
            rows.append([key, str(counter[key])])
        rows.append(["", ""])

    while rows and rows[-1] == ["", ""]:
        rows.pop()
    return rows


def _apply_xlsx_sheet_style(sheet: Any) -> None:
    from openpyxl.styles import Alignment, Font

    if not sheet.max_row or not sheet.max_column:
        return
    sheet.freeze_panes = "A2" if sheet.max_row > 1 else None
    for cell in sheet[1]:
        cell.font = Font(bold=True)
        cell.alignment = Alignment(wrap_text=True, vertical="top")
    for col in sheet.iter_cols(min_row=1, max_row=sheet.max_row, min_col=1, max_col=sheet.max_column):
        max_len = 10
        for cell in col:
            value = "" if cell.value is None else str(cell.value)
            max_len = max(max_len, min(len(value), 80))
            cell.alignment = Alignment(wrap_text=True, vertical="top")
        col_letter = col[0].column_letter
        sheet.column_dimensions[col_letter].width = min(max_len + 2, 80)


def build_xlsx_export(
    *,
    locale: str,
    headers: list[str],
    rows: list[list[str]],
    summary_rows: list[list[str]],
    statistics_rows: list[list[str]],
) -> bytes:
    from openpyxl import Workbook

    names = EXPORT_SHEETS.get(locale, EXPORT_SHEETS["en"])
    workbook = Workbook()
    main = workbook.active
    main.title = names["responses"]

    def _append_prepared(ws: Any, row: list[Any]) -> None:
        ws.append([_prepare_xlsx_cell_value(v) for v in row])

    _append_prepared(main, headers)
    for row in rows:
        _append_prepared(main, row)
    _apply_xlsx_sheet_style(main)

    ws_summary = workbook.create_sheet(names["summary"])
    for row in summary_rows:
        _append_prepared(ws_summary, row)
    _apply_xlsx_sheet_style(ws_summary)

    ws_stats = workbook.create_sheet(names["statistics"])
    for row in statistics_rows:
        _append_prepared(ws_stats, row)
    _apply_xlsx_sheet_style(ws_stats)

    stream = io.BytesIO()
    workbook.save(stream)
    return stream.getvalue()
