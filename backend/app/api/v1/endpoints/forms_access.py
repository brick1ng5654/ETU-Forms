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


def _utc_now_naive() -> datetime:
    return datetime.utcnow()


def _is_not_expired(column):
    now = _utc_now_naive()
    return or_(column.is_(None), column > now)


def _is_started(column):
    now = _utc_now_naive()
    return or_(column.is_(None), column <= now)


def _token() -> str:
    return secrets.token_urlsafe(32)


def _invite_url(token: str) -> str:
    return f"/forms/access-invite/{token}"


def _access_status(starts_at: datetime | None, expires_at: datetime | None) -> str:
    now = _utc_now_naive()
    starts_at_normalized = _to_utc_naive(starts_at)
    expires_at_normalized = _to_utc_naive(expires_at)
    if starts_at_normalized is not None and starts_at_normalized > now:
        return "pending"
    if expires_at_normalized is not None and expires_at_normalized <= now:
        return "expired"
    return "active"


def _invite_status(invite: AccessInvite, now: datetime) -> str:
    status_value = _enum_value(invite.status)
    if status_value != "pending":
        return status_value
    expires_at_normalized = _to_utc_naive(invite.expires_at)
    if expires_at_normalized is not None and expires_at_normalized <= now:
        return "expired"
    max_accepts = invite.max_accepts
    accepted_count = int(invite.accepted_count or 0)
    if max_accepts is not None and accepted_count >= max_accepts:
        return "accepted"
    return "pending"


def _is_same_access_as_invite(invite: AccessInvite, access: AccessControl | None) -> bool:
    if access is None:
        return False
    same_role = _enum_value(access.role) == _enum_value(invite.role)
    same_starts_at = _to_utc_naive(access.starts_at) == _to_utc_naive(invite.starts_at)
    same_expires_at = _to_utc_naive(access.expires_at) == _to_utc_naive(invite.expires_at)
    return same_role and same_starts_at and same_expires_at


def _invite_already_accepted_by_user(
    invite: AccessInvite,
    *,
    user_id: int,
    existing_access: AccessControl | None,
) -> bool:
    status_value = _enum_value(invite.status)
    if invite.invitee_email is not None:
        return status_value == "accepted"

    accepted_count = int(invite.accepted_count or 0)
    if accepted_count <= 0:
        return False
    if invite.accepted_by_user_id is not None:
        return invite.accepted_by_user_id == user_id
    return _is_same_access_as_invite(invite, existing_access)


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
            .where(_is_started(AccessControl.starts_at))
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
    starts_at: datetime | None,
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
            starts_at=starts_at,
            expires_at=expires_at,
        )
        db.add(row)
        await db.flush()
        return row

    existing.role = role
    existing.starts_at = starts_at
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
        status=_access_status(row.starts_at, row.expires_at),
        starts_at=row.starts_at,
        expires_at=row.expires_at,
        requires_accept=False,
        accepted_count=0,
        created_at=None,
    )


def _invite_entry_for_row(invite: AccessInvite, *, now: datetime) -> AccessEntryResponse:
    status_value = _invite_status(invite, now)
    return AccessEntryResponse(
        entry_type="invite",
        invite_id=invite.invite_id,
        user_email=invite.invitee_email,
        role=_enum_value(invite.role),
        status=status_value,
        starts_at=invite.starts_at,
        expires_at=invite.expires_at,
        requires_accept=bool(invite.requires_accept),
        invite_url=_invite_url(invite.token) if status_value == "pending" else None,
        max_accepts=invite.max_accepts,
        accepted_count=int(invite.accepted_count or 0),
        created_at=invite.created_at,
    )


@router.get("/{form_id}/access", response_model=AccessEntriesResponse)
async def list_form_access(
    form_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    await _ensure_manage_access(db, form_id, current_user)

    now = _utc_now_naive()

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
            .where(AccessInvite.status == "pending")
            .order_by(AccessInvite.created_at.desc(), AccessInvite.invite_id.desc())
        )
    ).scalars().all()
    for invite in invite_rows:
        entries.append(_invite_entry_for_row(invite, now=now))

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
    starts_at = _to_utc_naive(payload.starts_at) or _utc_now_naive()
    expires_at = _to_utc_naive(payload.expires_at)
    require_accept = bool(payload.require_accept)
    if starts_at is not None and expires_at is not None and starts_at > expires_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Start date must be before end date")

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
            starts_at=starts_at,
            expires_at=expires_at,
        )
        await db.execute(
            update(AccessInvite)
            .where(AccessInvite.form_id == form_id)
            .where(AccessInvite.invitee_email == email)
            .where(AccessInvite.status == "pending")
            .values(status="revoked", revoked_at=_utc_now_naive())
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
        starts_at=starts_at,
        expires_at=expires_at,
        max_accepts=1,
    )
    db.add(invite)
    await db.flush()

    return _invite_entry_for_row(invite, now=_utc_now_naive())


@router.post("/{form_id}/access/link", response_model=AccessEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_form_access_link(
    form_id: int,
    payload: AccessInviteCreateByLink,
    db: AsyncSession = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    await _ensure_manage_access(db, form_id, current_user)

    starts_at = _to_utc_naive(payload.starts_at) or _utc_now_naive()
    expires_at = _to_utc_naive(payload.expires_at)
    if starts_at is not None and expires_at is not None and starts_at > expires_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Start date must be before end date")

    invite = AccessInvite(
        form_id=form_id,
        inviter_user_id=current_user.user_id,
        invitee_email=None,
        role=_enum_value(payload.role),
        token=_token(),
        requires_accept=True,
        status="pending",
        starts_at=starts_at,
        expires_at=expires_at,
        max_accepts=payload.max_accepts,
    )
    db.add(invite)
    await db.flush()

    return _invite_entry_for_row(invite, now=_utc_now_naive())


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

    starts_at = _to_utc_naive(payload.starts_at)
    expires_at = _to_utc_naive(payload.expires_at)
    if starts_at is not None and expires_at is not None and starts_at > expires_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Start date must be before end date")

    access.role = _enum_value(payload.role)
    access.starts_at = starts_at
    access.expires_at = expires_at
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
    await db.flush()
    return None


@router.delete("/{form_id}/access/me", status_code=status.HTTP_204_NO_CONTENT)
async def leave_own_form_access(
    form_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    form = (
        await db.execute(
            select(Form)
            .where(Form.form_id == form_id)
            .where(Form.status != "deleted")
        )
    ).scalar_one_or_none()
    if form is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")
    if form.user_id == current_user.user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Form owner cannot leave access")

    access = (
        await db.execute(
            select(AccessControl)
            .where(AccessControl.form_id == form_id)
            .where(AccessControl.user_id == current_user.user_id)
        )
    ).scalar_one_or_none()
    if access is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Access entry not found")

    await db.delete(access)
    await db.flush()
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
    invite.revoked_at = _utc_now_naive()
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
    if _enum_value(invite.status) == "revoked":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found")

    form = (
        await db.execute(select(Form).where(Form.form_id == invite.form_id))
    ).scalar_one_or_none()
    if form is None or form.status == "deleted":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")
    if form.user_id == current_user.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are already the form creator")

    if invite.invitee_email and _normalize_email(invite.invitee_email) != _normalize_email(current_user.email):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invite belongs to another email")

    existing_access = (
        await db.execute(
            select(AccessControl)
            .where(AccessControl.form_id == invite.form_id)
            .where(AccessControl.user_id == current_user.user_id)
        )
    ).scalar_one_or_none()

    now = _utc_now_naive()
    status_value = _invite_status(invite, now)
    accepted_by_current_user = _invite_already_accepted_by_user(
        invite,
        user_id=current_user.user_id,
        existing_access=existing_access,
    )
    if status_value == "pending":
        if accepted_by_current_user:
            status_value = "accepted"
    if status_value == "expired":
        status_value = "revoked"

    return AccessInviteResolveResponse(
        form_id=form.form_id,
        form_title=form.title,
        role=_enum_value(invite.role),
        starts_at=invite.starts_at,
        expires_at=invite.expires_at,
        max_accepts=invite.max_accepts,
        accepted_count=int(invite.accepted_count or 0),
        invitee_email=invite.invitee_email,
        status=status_value,
        accepted_by_current_user=accepted_by_current_user,
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
    if _enum_value(invite.status) == "revoked":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found")

    form = (
        await db.execute(select(Form).where(Form.form_id == invite.form_id))
    ).scalar_one_or_none()
    if form is None or form.status == "deleted":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")
    if form.user_id == current_user.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are already the form creator")

    if invite.invitee_email and _normalize_email(invite.invitee_email) != _normalize_email(current_user.email):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invite belongs to another email")

    now = _utc_now_naive()
    invite_starts_at = _to_utc_naive(invite.starts_at)
    invite_expires_at = _to_utc_naive(invite.expires_at)
    if invite_starts_at is not None and invite_starts_at > now:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invite is not active yet")
    if invite_expires_at is not None and invite_expires_at <= now:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invite expired")

    existing_access = (
        await db.execute(
            select(AccessControl)
            .where(AccessControl.form_id == invite.form_id)
            .where(AccessControl.user_id == current_user.user_id)
            .with_for_update()
        )
    ).scalar_one_or_none()

    if _invite_already_accepted_by_user(
        invite,
        user_id=current_user.user_id,
        existing_access=existing_access,
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invite already accepted by this user")

    accepted_count = int(invite.accepted_count or 0)
    if invite.max_accepts is not None and accepted_count >= invite.max_accepts:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invite usage limit reached")

    access = await _upsert_access(
        db,
        form_id=invite.form_id,
        user_id=current_user.user_id,
        role=_enum_value(invite.role),
        starts_at=invite.starts_at,
        expires_at=invite.expires_at,
    )

    invite.accepted_count = accepted_count + 1
    invite.accepted_by_user_id = current_user.user_id
    invite.accepted_at = now
    if invite.invitee_email is not None:
        invite.status = "accepted"
    elif invite.max_accepts is not None and invite.accepted_count >= invite.max_accepts:
        invite.status = "accepted"
    await db.flush()

    return await _access_entry_for_row(db, access)
