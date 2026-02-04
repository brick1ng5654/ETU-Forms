from __future__ import annotations

import logging
from typing import Optional
from fastapi import Request

logger = logging.getLogger("auth")

def safe_email(email: Optional[str]) -> str:
    if not email:
        return "-"
    return email.strip().lower()

def client_ip(request: Request) -> str:
    return request.client.host if request.client else "-"

def user_agent(request: Request) -> str:
    return request.headers.get("user-agent", "-")

def log_failed_login(
        request: Request,
        email: Optional[str],
        reason: str = "invalid_credentials",
        extra: Optional[dict] = None,
) -> None:
    payload = {
        "event": "auth_login_failed",
        "email": safe_email(email),
        "ip": client_ip(request),
        "user_agent": user_agent(request),
        "reason": reason
    }
    if extra:
        payload.update(extra)

    logger.warning("Login failed", extra=payload)