from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.schemas import FormBuilderPayload, FormDetailResponse
from app.services.forms_publish import apply_builder_payload
from app.services.forms_mapping import build_form_detail_response
from app.security.auth_dependencies import get_current_user, ensure_can_edit_forms
from app.models import AppUser, Form, AccessControl

router = APIRouter()

async def _ensure_editor_or_owner(
    db: AsyncSession, form_id: int, current_user: AppUser
) -> Form:
    result = await db.execute(select(Form).where(Form.form_id == form_id))
    form = result.scalar_one_or_none()
    if not form or form.status == "deleted":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")

    if form.status == "temp" and form.expires_at and form.expires_at <= datetime.utcnow():
        form.status = "deleted"
        form.deleted_at = datetime.utcnow()
        form.expires_at = None
        await db.commit()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form expired")

    if form.user_id == current_user.user_id:
        return form

    access = await db.execute(
        select(AccessControl)
        .where(AccessControl.form_id == form_id)
        .where(AccessControl.user_id == current_user.user_id)
        .where(AccessControl.role == "editor")
    )
    if not access.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return form


@router.post("/{form_id}/publish", response_model=FormDetailResponse)
async def publish(
    form_id: int,
    payload: FormBuilderPayload,
    db: AsyncSession = Depends(get_db),
    _current_user: AppUser = Depends(get_current_user),
):
    ensure_can_edit_forms(_current_user)
    try:
        form = await _ensure_editor_or_owner(db, form_id, _current_user)
        if form.status != "temp":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only temp forms can be published")
        form = await apply_builder_payload(db, form, payload, target_status="submitted")
        await db.commit()
        await db.refresh(form)
        return await build_form_detail_response(db, form)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
