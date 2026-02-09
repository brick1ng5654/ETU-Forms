from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Optional, Dict

from jose import jwt, JWTError, ExpiredSignatureError
from app.config import settings

ALGORITHM = getattr(settings, "JWT_ALGORITHM", "HS256")
SECRET_KEY = settings.SECRET_KEY

def _now_ts() -> int:
    return int(datetime.now(timezone.utc).timestamp())

def create_access_token(subject: str, expires_minutes: int = 30, extra: Optional[dict[str, Any]] = None) -> str:
    now = _now_ts()
    exp = now + expires_minutes * 60
    payload: Dict[str, Any] = {
        "sub": subject,
        "iat": now,
        "exp": exp,
    }

    if extra:
        payload.update(extra)

    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def create_refresh_token(subject: str, expires_days: int = 7, extra: Optional[Dict[str, Any]] = None) -> str:
    now = _now_ts()
    exp = now + expires_days * 24 * 60 * 60
    payload: Dict[str, Any] = {"sub": subject, "iat": now, "exp": exp, "type": "refresh"}
    if extra:
        payload.update(extra)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError as e:
        raise ValueError("Invalid token") from e

