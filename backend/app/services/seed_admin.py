from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import AppUser
from app.security.passwords import hash_password

async def seed_admin(db: AsyncSession) -> None:
    q = select(AppUser).where(AppUser.email == settings.ADMIN_EMAIL)
    res = await db.execute(q)
    admin = res.scalar_one_or_none()

    if admin:
        return
    
    admin = AppUser(
        name=settings.ADMIN_NAME,
        email=settings.ADMIN_EMAIL,
        etu_id=None,
        phone=None,
        is_admin=True,
        password_hash=hash_password(settings.ADMIN_PASSWORD),
    )

    db.add(admin)
    await db.flush()