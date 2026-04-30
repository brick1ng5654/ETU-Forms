from __future__ import annotations

import unicodedata
from typing import Any

# Символы, которые считаются экстремистскими
PROHIBITED_CODEPOINTS: set[int] = {0x0FD5, 0x0FD6, 0x534D, 0x5350}
PROHIBITED_TEXT_MESSAGE = (
    "Text contains prohibited symbols. Please remove them; using such symbols is not allowed."
)
# Разновидности пустых символов
PROHIBITED_WHITESPACE_CODEPOINTS: set[int] = {
    0x00A0,
    0x2000,
    0x2001,
    0x2002,
    0x2003,
    0x2004,
    0x2005,
    0x2006,
    0x2007,
    0x2008,
    0x2009,
    0x200A,
    0x2028,
    0x2029,
    0x205F,
    0x3000,
}


def _is_invisible_char(char: str) -> bool:
    cp = ord(char)

    if unicodedata.category(char) == "Cf":
        return True

    if cp in {0x034F, 0x00AD, 0x061C}:
        return True

    if 0xFE00 <= cp <= 0xFE0F or 0xE0100 <= cp <= 0xE01EF:
        return True

    if cp in {0x115F, 0x1160, 0x3164, 0xFFA0, 0x2800}:
        return True

    if cp in PROHIBITED_WHITESPACE_CODEPOINTS:
        return True

    return False


def normalize_text_value(value: str) -> str:
    return unicodedata.normalize("NFKC", value)


def contains_prohibited_symbols(value: str) -> bool:
    return any(ord(ch) in PROHIBITED_CODEPOINTS for ch in value)


def contains_invisible_symbols(value: str) -> bool:
    return any(_is_invisible_char(ch) for ch in value)

# проверка на декоративные символы
def _is_decorative_char(char: str) -> bool:
    cp = ord(char)
    category = unicodedata.category(char)

    if category in {"So", "Sk"}:
        return True

    if category == "Mn":
        return True

    if 0x13000 <= cp <= 0x1345F:
        return True

    return False


def contains_decorative_symbols(value: str) -> bool:
    return any(_is_decorative_char(ch) for ch in value)

# проверка на эмодзи символы
def _is_emoji_char(char: str) -> bool:
    cp = ord(char)
    return (
        0x1F300 <= cp <= 0x1FAFF
        or 0x2600 <= cp <= 0x27BF
        or 0x1F1E6 <= cp <= 0x1F1FF
        or cp in {0x00A9, 0x00AE, 0x203C, 0x2049, 0x2122, 0x2139, 0x3030, 0x303D, 0x3297, 0x3299}
    )


def contains_emoji_symbols(value: str) -> bool:
    return any(_is_emoji_char(ch) for ch in value)


def contains_forbidden_symbols(value: str) -> bool:
    return (
        contains_prohibited_symbols(value)
        or contains_invisible_symbols(value)
        or contains_decorative_symbols(value)
        or contains_emoji_symbols(value)
    )


def normalize_and_validate_text_payload(value: Any) -> tuple[Any, bool]:
    if isinstance(value, str):
        normalized = normalize_text_value(value)
        return (normalized, contains_forbidden_symbols(normalized))

    if isinstance(value, list):
        normalized_items: list[Any] = []
        found_forbidden = False
        for item in value:
            normalized_item, item_has_forbidden = normalize_and_validate_text_payload(item)
            normalized_items.append(normalized_item)
            found_forbidden = found_forbidden or item_has_forbidden
        return normalized_items, found_forbidden

    if isinstance(value, dict):
        normalized_dict: dict[Any, Any] = {}
        found_forbidden = False
        for key, item in value.items():
            normalized_item, item_has_forbidden = normalize_and_validate_text_payload(item)
            normalized_dict[key] = normalized_item
            found_forbidden = found_forbidden or item_has_forbidden
        return normalized_dict, found_forbidden

    return value, False
