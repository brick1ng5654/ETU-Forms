from fastapi import APIRouter, Depends, Request,  HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app import models
from app.schemas import LoginRequest
from app.security.passwords import verify_passport
from app.security.tokens import create_access_token
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
async def login(request: Request, payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    ip = get_client_ip(request)
    email_norm = payload.email.lower().strip()
    email_h = email_key(email_norm)

    key_ip_email = f"rl:login:ip_email:{ip}:{email_h}"
    key_ip_global = f"rl:login:ip:{ip}"

    # lockout keys
    fail_key = f"auth:fail:ip_email:{ip}:{email_h}"
    lock_key = f"auth:lock:ip_email:{ip}:{email_h}"

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
    
    locked, lock_ttl = await login_lockout.is_locked(lock_key)
    if locked:
        log_failed_login(request=request, email=email_norm, reason="login_locked")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many login attempts. Try again in {lock_ttl} seconds.",
            headers={"Retry-After": str(lock_ttl)},
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
    
    token = create_access_token(subject=str(user.user_id), expires_minutes=60, extra={"email": user.email})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"user_id": user.user_id, "email": user.email, "name": user.name},
    }
