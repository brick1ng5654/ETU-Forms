# Эндпоинты для работы с формами
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import datetime, timedelta
from app.database import AsyncSessionLocal
from sqlalchemy import select, func, update, or_, and_

from app.database import get_db
from app.models import Form, AppUser, AccessControl
from app.security.auth_dependencies import get_current_user as get_current_user_dep
from app.schemas import (
    FormCreate,
    FormResponse,
    FormListResponse,
    FormDetailResponse,
    FormBuilderPayload,
)
from app.services.forms_publish import apply_builder_payload, FORM_DRAFT_TTL_DAYS
from app.services.forms_mapping import build_form_detail_response, build_form_summaries

router = APIRouter(prefix="/forms", tags=["forms"])

MAX_TEMP_FORMS_PER_USER = 25


async def _count_active_temp_forms(db: AsyncSession, user_id: int) -> int:
    now = datetime.utcnow()
    await db.execute(
        update(Form)
        .where(Form.user_id == user_id)
        .where(Form.status == "temp")
        .where(Form.expires_at.is_not(None))
        .where(Form.expires_at <= now)
        .values(status="deleted", deleted_at=now)
    )
    await db.commit()
    result = await db.execute(
        select(func.count())
        .select_from(Form)
        .where(Form.user_id == user_id)
        .where(Form.status == "temp")
        .where(or_(Form.expires_at.is_(None), Form.expires_at > now))
    )
    return int(result.scalar() or 0)

# Функции заглушки(Потом будет добавлена проверка JWT токена)
async def get_current_user():
    # Пока что возвращаем первого пользователя из бд
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(AppUser).limit(1))
        user = result.scalar_one_or_none()

        if not user:
            # Если нет пользователя, создадим тестового 
            user = AppUser(
                name="Тестовый пользователь",
                email="test@example.com",
                etu_id="test001"
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)

        return user
    
@router.post("/", response_model=FormResponse, status_code=status.HTTP_201_CREATED)
async def create_form(
    form_data: FormCreate,
    db: AsyncSession = Depends(get_db),
    current_user: AppUser = Depends(get_current_user_dep)
):
    try:
        temp_count = await _count_active_temp_forms(db, current_user.user_id)
        if temp_count >= MAX_TEMP_FORMS_PER_USER:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Temp form limit reached ({MAX_TEMP_FORMS_PER_USER}).",
            )
        payload = form_data.model_dump(exclude={"user_id"})  # <-- главное
        db_form = Form(
            **payload,
            user_id=current_user.user_id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            status="temp",
            expires_at=datetime.utcnow() + timedelta(days=FORM_DRAFT_TTL_DAYS),
        )

        db.add(db_form)
        await db.commit()
        await db.refresh(db_form)

        return FormResponse.model_validate(db_form)

    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при создании формы: {str(e)}"
        )

# Получение списка моих форм с пагинацией
@router.get("/", response_model=FormListResponse)
async def get_my_forms(
    skip: int = Query(0, ge=0, description="Количество пропущенных записей"),
    limit: int = Query(100, ge=1, le=200, description="Лимит записей"),
    db: AsyncSession = Depends(get_db),
    current_user: AppUser = Depends(get_current_user_dep)
):

    now = datetime.utcnow()
    await db.execute(
        update(Form)
        .where(Form.status == "temp")
        .where(Form.expires_at.is_not(None))
        .where(Form.expires_at <= now)
        .values(status="deleted", deleted_at=now)
    )
    await db.commit()

    access_filter = or_(
        Form.user_id == current_user.user_id,
        and_(
            AccessControl.user_id == current_user.user_id,
            AccessControl.role == "editor",
        ),
    )

    count_query = (
        select(func.count(func.distinct(Form.form_id)))
        .select_from(Form)
        .outerjoin(AccessControl, AccessControl.form_id == Form.form_id)
        .where(access_filter)
        .where(Form.status != "deleted")
    )

    total = (await db.execute(count_query)).scalar()

    query = (
        select(Form)
        .outerjoin(AccessControl, AccessControl.form_id == Form.form_id)
        .where(access_filter)
        .where(Form.status != "deleted")
        .order_by(Form.created_at.desc())
        .offset(skip)
        .limit(limit)
        .distinct()
    )

    result = await db.execute(query)
    forms = result.scalars().all()

    form_responses = await build_form_summaries(db, forms)
    return FormListResponse(forms=form_responses, total=total)


async def _ensure_editor_or_owner(
    db: AsyncSession, form_id: int, current_user: AppUser
) -> Form:
    result = await db.execute(select(Form).where(Form.form_id == form_id))
    form = result.scalar_one_or_none()
    if not form or form.status == "deleted":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")

    if form.status == "temp" and form.expires_at and form.expires_at <= datetime.utcnow():
        await db.execute(
            update(Form)
            .where(Form.form_id == form_id)
            .values(status="deleted", deleted_at=datetime.utcnow())
        )
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


@router.get("/{form_id}", response_model=FormDetailResponse)
async def get_form(
    form_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: AppUser = Depends(get_current_user_dep),
):
    form = await _ensure_editor_or_owner(db, form_id, current_user)
    return await build_form_detail_response(db, form)


@router.put("/{form_id}", response_model=FormDetailResponse)
async def save_form(
    form_id: int,
    payload: FormBuilderPayload,
    db: AsyncSession = Depends(get_db),
    current_user: AppUser = Depends(get_current_user_dep),
):
    form = await _ensure_editor_or_owner(db, form_id, current_user)

    if form.status == "submitted":
        temp_count = await _count_active_temp_forms(db, current_user.user_id)
        if temp_count >= MAX_TEMP_FORMS_PER_USER:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Temp form limit reached ({MAX_TEMP_FORMS_PER_USER}).",
            )
        draft = Form(
            user_id=form.user_id,
            title=form.title,
            description=form.description,
            settings_json=form.settings_json,
            start_at=form.start_at,
            end_at=form.end_at,
            access_mode=form.access_mode,
            status="temp",
            version=(form.version or 1) + 1,
            prev_form_id=form.form_id,
            expires_at=datetime.utcnow() + timedelta(days=FORM_DRAFT_TTL_DAYS),
        )
        db.add(draft)
        await db.flush()
        form = draft

    form = await apply_builder_payload(db, form, payload, target_status="temp")
    await db.commit()
    await db.refresh(form)
    return await build_form_detail_response(db, form)


@router.delete("/{form_id}", response_model=FormResponse)
async def delete_form(
    form_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: AppUser = Depends(get_current_user_dep),
):
    form = await _ensure_editor_or_owner(db, form_id, current_user)
    now = datetime.utcnow()
    form.status = "deleted"
    form.deleted_at = now
    form.expires_at = None
    await db.commit()
    await db.refresh(form)
    return FormResponse.model_validate(form)

