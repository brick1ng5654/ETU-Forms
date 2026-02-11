from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app import models
from app.security.passwords import hash_password

DEFAULT_USERS = [
    ("admin@example.com", "Admin", settings.ADMIN_PASSWORD, True),
    ("editor@example.com", "Editor", settings.ADMIN_PASSWORD, False),
    ("participant@example.com", "Participant", settings.ADMIN_PASSWORD, False),
    ("noperms@example.com", "NoPerms", settings.ADMIN_PASSWORD, False),
]

async def _get_user_by_email(db: AsyncSession, email: str) -> models.AppUser | None:
    q = select(models.AppUser).where(models.AppUser.email == email)
    return (await db.execute(q)).scalar_one_or_none()

async def _ensure_user(
        db: AsyncSession,
        email: str,
        name: str,
        password: str,
        is_admin: bool = False,
) -> models.AppUser:
    email_norm = email.strip().lower()

    user = await _get_user_by_email(db, email_norm)
    if user:
        return user
    
    user = models.AppUser(
        email=email_norm,
        name=name,
        is_admin=is_admin,
        password_hash=hash_password(password),
    )
    db.add(user)
    await db.flush()
    return user

async def _ensure_demo_form(db: AsyncSession, owner_id: int) -> models.Form:
    q = (
        select(models.Form)
        .where(models.Form.user_id == owner_id)
        .where(models.Form.status != "deleted")
        .order_by(models.Form.created_at.desc())
        .limit(1)
    )
    form = (await db.execute(q)).scalar_one_or_none()
    if form:
        return form
    
    form = models.Form(
        user_id=owner_id,
        title="Demo Form",
        description="Form for testing roles: editor/participant",
        access_mode="private",
        status="submitted",
        version=1,
    )
    db.add(form)
    await db.flush()
    return form

async def _ensure_access(
        db: AsyncSession,
        form_id: int,
        user_id: int,
        role: str,
) -> None:
    q = select(models.AccessControl).where(
        models.AccessControl.form_id == form_id,
        models.AccessControl.user_id == user_id,
    )
    access = (await db.execute(q)).scalar_one_or_none()
    if access:
        if access.role != role:
            access.role = role
        return
    
    access = models.AccessControl(
        form_id=form_id,
        user_id=user_id,
        role=role,
    )
    db.add(access)

async def seed_users(db: AsyncSession) -> None:
    created = {}
    for email, name, password, is_admin in DEFAULT_USERS:
        user = await _ensure_user(db, email, name, password, is_admin=is_admin)
        created[email.strip().lower()] = user

    admin = created["admin@example.com"]
    demo_form = await _ensure_demo_form(db, owner_id=admin.user_id)

    editor = created["editor@example.com"]
    participant = created["participant@example.com"]

    await _ensure_access(db, form_id=demo_form.form_id, user_id=editor.user_id, role="editor")
    await _ensure_access(db, form_id=demo_form.form_id, user_id=participant.user_id, role="participant")
