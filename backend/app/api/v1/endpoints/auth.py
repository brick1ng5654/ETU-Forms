from fastapi import APIRouter, Depends, Request,  HTTPException, status, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app import models
from app.schemas import LoginRequest
from app.security.passwords import verify_passport
from app.security.tokens import create_access_token, create_refresh_token, decode_token
from app.security.rate_limiter import rate_limiter, RULE_IP_EMAIL, RULE_IP_GLOBAL
from app.security.auth_logging import log_failed_login
from app.security.login_lockout import login_lockout, DEFAULT_LOCKOUT
import hashlib

router = APIRouter(prefix="/auth", tags=["auth"])

def get_client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        # первый в списке оригинальный клиент
        return xff.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"

def email_key(email: str) -> str:
    # хранить в redis не email, а хеш
    return hashlib.sha256(email.encode("utf-8")).hexdigest()

@router.post("/login")
async def login(request: Request, payload: LoginRequest, response: Response,db: AsyncSession = Depends(get_db)):
    ip = get_client_ip(request)
    email_norm = payload.email.lower().strip()
    email_h = email_key(email_norm)

    key_ip_email = f"rl:login:ip_email:{ip}:{email_h}"
    key_ip_global = f"rl:login:ip:{ip}"

    # lockout keys
    fail_key = f"auth:fail:ip_email:{ip}:{email_h}"
    lock_key = f"auth:lock:ip_email:{ip}:{email_h}"

    locked, lock_ttl = await login_lockout.is_locked(lock_key)
    if locked:
        log_failed_login(request=request, email=email_norm, reason="login_locked")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many login attempts. Try again in {lock_ttl} seconds.",
            headers={"Retry-After": str(lock_ttl)},
        )

    allowed, retry_after = await rate_limiter.check(key_ip_global, RULE_IP_GLOBAL)
    if not allowed:
        log_failed_login(email=email_norm, reason="rate_limit_ip", request=request)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many login attempts. Try again in {retry_after} seconds.",
            headers={"Retry-After": str(retry_after)},
        )

    allowed, retry_after = await rate_limiter.check(key_ip_email, RULE_IP_EMAIL)
    if not allowed:
        log_failed_login(email=email_norm, reason="rate_limit_ip_email", request=request)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many login attempts for this email from your IP. Try again in {retry_after} seconds.",
            headers={"Retry-After": str(retry_after)},
        )
    
    q = select(models.AppUser).where(models.AppUser.email == email_norm)
    user = (await db.execute(q)).scalar_one_or_none()
    invalid = HTTPException(status_code=401, detail="Invalid email or password")
    
    if not user or not user.password_hash:
        locked_now, lock_ttl = await login_lockout.register_failure(
            fail_key=fail_key,
            lock_key=lock_key,
            policy=DEFAULT_LOCKOUT,
        )
        log_failed_login(email=email_norm, reason="invalid credentials", request=request)
        if locked_now:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many login attempts. Try again in {lock_ttl} seconds.",
                headers={"Retry-After": str(lock_ttl)},
            )
        raise invalid
    
    if not verify_passport(payload.password, user.password_hash):
        locked_now, lock_ttl = await login_lockout.register_failure(
            fail_key=fail_key,
            lock_key=lock_key,
            policy=DEFAULT_LOCKOUT,
        )
        log_failed_login(email=email_norm, reason="invalid credentials", request=request)
        if locked_now:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many login attempts. Try again in {lock_ttl} seconds.",
                headers={"Retry-After": str(lock_ttl)},
            )
        raise invalid
    
    await login_lockout.reset(fail_key, lock_key)
    
    access = create_access_token(subject=str(user.user_id), expires_minutes=60, extra={"email": user.email})
    refresh = create_refresh_token(subject=str(user.user_id), expires_days=7, extra={"email": user.email})

    response.set_cookie(
        key="refresh_token",
        value=refresh,
        httponly=True,
        secure=True,
        max_age=60*60*24*7,
        samesite="lax",
        path="/api/v1/auth",
    )

    return {
        "access_token": access,
        "token_type": "bearer",
        "user": {"user_id": user.user_id, "email": user.email, "name": user.name},
    }

@router.post("/refresh")
async def refresh_token(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token missing")

    try:
        payload = decode_token(refresh_token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    token_type = payload.get("type")
    if token_type != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")
    
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    q = select(models.AppUser).where(models.AppUser.user_id == int(sub))
    user = (await db.execute(q)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    access = create_access_token(subject=str(user.user_id), expires_minutes=60, extra={"email": user.email})
    new_refresh = create_refresh_token(subject=str(user.user_id), expires_days=7, extra={"email": user.email})

    response.set_cookie(
        key="refresh_token",
        value=new_refresh,
        httponly=True,
        secure=True,
        max_age=60*60*24*7,
        samesite="lax",
        path="/api/v1/auth",
    )

    return {
        "access_token": access,
        "token_type": "bearer",
    }

@router.post("/logout")
async def logout(response: Response):
    # Удаляем refresh token cookie, access token удалять не нужно, просто перестанет работать после истечения срока
    response.delete_cookie(key="refresh_token", path="/api/v1/auth")
    return {"detail": "Logged out"}