from fastapi import APIRouter, Depends, Request,  HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app import models
from app.schemas import LoginRequest
from app.security.passwords import verify_passport
from app.security.tokens import create_access_token
from app.security.rate_limiter import rate_limiter, RULE_IP_EMAIL, RULE_IP_GLOBAL

router = APIRouter(prefix="/auth", tags=["auth"])

def get_client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        # первый в списке оригинальный клиент
        return xff.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"

@router.post("/login")
async def login(request: Request, payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    ip = get_client_ip(request)
    email = payload.email.lower().strip()

    key_ip_email = f"login:ip_email:{ip}:{email}"
    key_ip_global = f"login:ip:{ip}"

    allowed, retry_after = await rate_limiter.check(key_ip_global, RULE_IP_GLOBAL)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many login attempts. Try again in {retry_after} seconds.",
            headers={"Retry-After": str(retry_after)},
        )

    allowed, retry_after = await rate_limiter.check(key_ip_email, RULE_IP_EMAIL)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many login attempts for this email from your IP. Try again in {retry_after} seconds.",
            headers={"Retry-After": str(retry_after)},
        )
    
    q = select(models.AppUser).where(models.AppUser.email == payload.email)
    user = (await db.execute(q)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not user.password_hash:
        raise HTTPException(status_code=401, detail="User has no password set")
    
    if not verify_passport(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_access_token(subject=str(user.user_id), expires_minutes=60, extra={"email": user.email})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"user_id": user.user_id, "email": user.email, "name": user.name},
    }
