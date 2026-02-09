from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import AppUser
from app.security.tokens import decode_token

_bearer = HTTPBearer(auto_error=False)


async def _resolve_user_from_credentials(
    creds: HTTPAuthorizationCredentials | None,
    db: AsyncSession,
) -> AppUser | None:
    if not creds or creds.scheme.lower() != "bearer":
        return None

    try:
        payload = decode_token(creds.credentials)
    except ValueError:
        return None

    subject = payload.get("sub")
    if not subject:
        return None

    try:
        user_id = int(subject)
    except (TypeError, ValueError):
        return None

    result = await db.execute(select(AppUser).where(AppUser.user_id == user_id))
    return result.scalar_one_or_none()


async def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> AppUser:
    user = await _resolve_user_from_credentials(creds, db)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    return user


async def get_optional_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> AppUser | None:
    return await _resolve_user_from_credentials(creds, db)
