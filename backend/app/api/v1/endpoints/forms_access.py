from __future__ import annotations

from datetime import datetime, timezone
import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import AccessControl, AccessInvite, AppUser, Form
from app.schemas import (
    AccessEntriesResponse,
    AccessEntryResponse,
    AccessInviteCreateByEmail,
    AccessInviteCreateByLink,
    AccessInviteResolveResponse,
    AccessUpdateRequest,
)
from app.security.auth_dependencies import get_current_user

router = APIRouter(prefix="/forms", tags=["forms"])


def _enum_value(x):
    return x.value if hasattr(x, "value") else x


def _normalize_email(value: str) -> str:
    return value.strip().lower()


def _to_utc_naive(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def _is_not_expired(column):
    now = datetime.utcnow()
    return or_(column.is_(None), column > now)


def _token() -> str:
    return secrets.token_urlsafe(32)


def _invite_url(token: str) -> str:
    return f"/forms/access-invite/{token}"


def _access_status(expires_at: datetime | None) -> str:
    if expires_at is not None and expires_at <= datetime.utcnow():
        return "expired"
    return "active"


async def _ensure_manage_access(
    db: AsyncSession,
    form_id: int,
    current_user: AppUser,
) -> Form:
    form = (
        await db.execute(
            select(Form).where(Form.form_id == form_id).where(Form.status != "deleted")
        )
    ).scalar_one_or_none()
    if not form:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")

    if form.user_id == current_user.user_id:
        return form

    access = (
        await db.execute(
            select(AccessControl)
            .where(AccessControl.form_id == form_id)
            .where(AccessControl.user_id == current_user.user_id)
            .where(AccessControl.role == "editor")
            .where(_is_not_expired(AccessControl.expires_at))
        )
    ).scalar_one_or_none()
    if access is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return form


async def _upsert_access(
    db: AsyncSession,
    *,
    form_id: int,
    user_id: int,
    role: str,
    expires_at: datetime | None,
) -> AccessControl:
    existing = (
        await db.execute(
            select(AccessControl)
            .where(AccessControl.form_id == form_id)
            .where(AccessControl.user_id == user_id)
        )
    ).scalar_one_or_none()
    if existing is None:
        row = AccessControl(
            form_id=form_id,
            user_id=user_id,
            role=role,
            expires_at=expires_at,
        )
        db.add(row)
        await db.flush()
        return row

    existing.role = role
    existing.expires_at = expires_at
    await db.flush()
    return existing


async def _access_entry_for_row(db: AsyncSession, row: AccessControl) -> AccessEntryResponse:
    user = (
        await db.execute(select(AppUser).where(AppUser.user_id == row.user_id))
    ).scalar_one_or_none()
    return AccessEntryResponse(
        entry_type="access",
        access_id=row.access_id,
        user_id=row.user_id,
        user_name=user.name if user else None,
        user_email=user.email if user else None,
        role=_enum_value(row.role),
        status=_access_status(row.expires_at),
        expires_at=row.expires_at,
        requires_accept=False,
        created_at=None,
    )


@router.get("/{form_id}/access", response_model=AccessEntriesResponse)
async def list_form_access(
    form_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    await _ensure_manage_access(db, form_id, current_user)

    now = datetime.utcnow()

    access_rows = (
        await db.execute(
            select(AccessControl)
            .where(AccessControl.form_id == form_id)
            .order_by(AccessControl.access_id.asc())
        )
    ).scalars().all()

    entries: list[AccessEntryResponse] = []
    for row in access_rows:
        entries.append(await _access_entry_for_row(db, row))

    invite_rows = (
        await db.execute(
            select(AccessInvite)
            .where(AccessInvite.form_id == form_id)
            .where(AccessInvite.status != "accepted")
            .order_by(AccessInvite.created_at.desc(), AccessInvite.invite_id.desc())
        )
    ).scalars().all()
    for invite in invite_rows:
        status_value = _enum_value(invite.status)
        if status_value == "pending" and invite.expires_at is not None and invite.expires_at <= now:
            status_value = "expired"
        entries.append(
            AccessEntryResponse(
                entry_type="invite",
                invite_id=invite.invite_id,
                user_email=invite.invitee_email,
                role=_enum_value(invite.role),
                status=status_value,
                expires_at=invite.expires_at,
                requires_accept=bool(invite.requires_accept),
                invite_url=_invite_url(invite.token) if status_value == "pending" else None,
                created_at=invite.created_at,
            )
        )

    return AccessEntriesResponse(entries=entries)


@router.post("/{form_id}/access/email", response_model=AccessEntryResponse, status_code=status.HTTP_201_CREATED)
async def grant_form_access_by_email(
    form_id: int,
    payload: AccessInviteCreateByEmail,
    db: AsyncSession = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    await _ensure_manage_access(db, form_id, current_user)

    email = _normalize_email(str(payload.email))
    if email == _normalize_email(current_user.email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You already have access")

    role = _enum_value(payload.role)
    expires_at = _to_utc_naive(payload.expires_at)
    require_accept = bool(payload.require_accept)

    target_user = (
        await db.execute(select(AppUser).where(AppUser.email == email))
    ).scalar_one_or_none()

    if not require_accept:
        if target_user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found. Enable confirmation mode or use link invitation.",
            )

        access_row = await _upsert_access(
            db,
            form_id=form_id,
            user_id=target_user.user_id,
            role=role,
            expires_at=expires_at,
        )
        await db.execute(
            update(AccessInvite)
            .where(AccessInvite.form_id == form_id)
            .where(AccessInvite.invitee_email == email)
            .where(AccessInvite.status == "pending")
            .values(status="revoked", revoked_at=datetime.utcnow())
        )
        return await _access_entry_for_row(db, access_row)

    invite = AccessInvite(
        form_id=form_id,
        inviter_user_id=current_user.user_id,
        invitee_email=email,
        role=role,
        token=_token(),
        requires_accept=True,
        status="pending",
        expires_at=expires_at,
    )
    db.add(invite)
    await db.flush()

    return AccessEntryResponse(
        entry_type="invite",
        invite_id=invite.invite_id,
        user_email=invite.invitee_email,
        role=role,
        status="pending",
        expires_at=invite.expires_at,
        requires_accept=True,
        invite_url=_invite_url(invite.token),
        created_at=invite.created_at,
    )


@router.post("/{form_id}/access/link", response_model=AccessEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_form_access_link(
    form_id: int,
    payload: AccessInviteCreateByLink,
    db: AsyncSession = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    await _ensure_manage_access(db, form_id, current_user)

    invite = AccessInvite(
        form_id=form_id,
        inviter_user_id=current_user.user_id,
        invitee_email=None,
        role=_enum_value(payload.role),
        token=_token(),
        requires_accept=True,
        status="pending",
        expires_at=_to_utc_naive(payload.expires_at),
    )
    db.add(invite)
    await db.flush()

    return AccessEntryResponse(
        entry_type="invite",
        invite_id=invite.invite_id,
        role=_enum_value(invite.role),
        status="pending",
        expires_at=invite.expires_at,
        requires_accept=True,
        invite_url=_invite_url(invite.token),
        created_at=invite.created_at,
    )


@router.patch("/{form_id}/access/users/{access_id}", response_model=AccessEntryResponse)
async def update_form_user_access(
    form_id: int,
    access_id: int,
    payload: AccessUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    await _ensure_manage_access(db, form_id, current_user)

    access = (
        await db.execute(
            select(AccessControl)
            .where(AccessControl.form_id == form_id)
            .where(AccessControl.access_id == access_id)
        )
    ).scalar_one_or_none()
    if access is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Access entry not found")

    access.role = _enum_value(payload.role)
    access.expires_at = _to_utc_naive(payload.expires_at)
    await db.flush()
    return await _access_entry_for_row(db, access)


@router.delete("/{form_id}/access/users/{access_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_form_user_access(
    form_id: int,
    access_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    await _ensure_manage_access(db, form_id, current_user)

    access = (
        await db.execute(
            select(AccessControl)
            .where(AccessControl.form_id == form_id)
            .where(AccessControl.access_id == access_id)
        )
    ).scalar_one_or_none()
    if access is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Access entry not found")
    await db.delete(access)
    return None


@router.delete("/{form_id}/access/invites/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_form_access_invite(
    form_id: int,
    invite_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    await _ensure_manage_access(db, form_id, current_user)

    invite = (
        await db.execute(
            select(AccessInvite)
            .where(AccessInvite.form_id == form_id)
            .where(AccessInvite.invite_id == invite_id)
        )
    ).scalar_one_or_none()
    if invite is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found")

    invite.status = "revoked"
    invite.revoked_at = datetime.utcnow()
    await db.flush()
    return None


@router.get("/access-invites/{token}", response_model=AccessInviteResolveResponse)
async def resolve_access_invite(
    token: str,
    db: AsyncSession = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    invite = (
        await db.execute(select(AccessInvite).where(AccessInvite.token == token))
    ).scalar_one_or_none()
    if invite is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found")

    form = (
        await db.execute(select(Form).where(Form.form_id == invite.form_id))
    ).scalar_one_or_none()
    if form is None or form.status == "deleted":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")

    if invite.invitee_email and _normalize_email(invite.invitee_email) != _normalize_email(current_user.email):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invite belongs to another email")

    status_value = _enum_value(invite.status)
    if status_value == "pending" and invite.expires_at and invite.expires_at <= datetime.utcnow():
        status_value = "revoked"

    return AccessInviteResolveResponse(
        form_id=form.form_id,
        form_title=form.title,
        role=_enum_value(invite.role),
        expires_at=invite.expires_at,
        invitee_email=invite.invitee_email,
        status=status_value,
    )


@router.post("/access-invites/{token}/accept", response_model=AccessEntryResponse)
async def accept_access_invite(
    token: str,
    db: AsyncSession = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    invite = (
        await db.execute(
            select(AccessInvite).where(AccessInvite.token == token).with_for_update()
        )
    ).scalar_one_or_none()
    if invite is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found")

    form = (
        await db.execute(select(Form).where(Form.form_id == invite.form_id))
    ).scalar_one_or_none()
    if form is None or form.status == "deleted":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")

    if invite.invitee_email and _normalize_email(invite.invitee_email) != _normalize_email(current_user.email):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invite belongs to another email")

    status_value = _enum_value(invite.status)
    if status_value == "revoked":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invite was revoked")
    if invite.expires_at is not None and invite.expires_at <= datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invite expired")

    access = await _upsert_access(
        db,
        form_id=invite.form_id,
        user_id=current_user.user_id,
        role=_enum_value(invite.role),
        expires_at=invite.expires_at,
    )

    invite.status = "accepted"
    invite.accepted_by_user_id = current_user.user_id
    invite.accepted_at = datetime.utcnow()
    if invite.invitee_email is None:
        invite.invitee_email = _normalize_email(current_user.email)
    await db.flush()

    return await _access_entry_for_row(db, access)
