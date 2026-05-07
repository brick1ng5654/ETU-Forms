# Эндпоинты для работы с формами
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import datetime, timedelta
from app.database import AsyncSessionLocal
from sqlalchemy import select, func, update, or_, and_

from app.database import get_db
from app.models import Form, AppUser, AccessControl, Response
from app.security.auth_dependencies import (
    get_current_user as get_current_user_dep,
    can_edit_forms,
    ensure_can_edit_forms,
    resolve_user_role,
)
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


def _enum_value(x):
    return x.value if hasattr(x, "value") else x

def _access_not_expired():
    now = datetime.utcnow()
    return and_(
        or_(AccessControl.starts_at.is_(None), AccessControl.starts_at <= now),
        or_(AccessControl.expires_at.is_(None), AccessControl.expires_at > now),
    )


async def _cleanup_expired_temp_forms(db: AsyncSession) -> None:
    now = datetime.utcnow()
    await db.execute(
        update(Form)
        .where(Form.status == "temp")
        .where(Form.expires_at.is_not(None))
        .where(Form.expires_at <= now)
        .values(status="deleted", deleted_at=now)
    )
    await db.commit()


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
    ensure_can_edit_forms(current_user)

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
    await _cleanup_expired_temp_forms(db)
    can_manage_forms = can_edit_forms(current_user)

    access_filter = or_(
        Form.user_id == current_user.user_id,
        and_(
            AccessControl.user_id == current_user.user_id,
            AccessControl.role == "editor",
            _access_not_expired(),
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

    permissions_by_form: dict[int, dict[str, bool]] = {}
    for form in forms:
        status_value = _enum_value(form.status)
        permissions_by_form[form.form_id] = {
            "can_edit": can_manage_forms,
            "can_view_responses": status_value == "submitted",
            "can_continue_passage": status_value == "submitted",
        }

    form_responses = await build_form_summaries(db, forms, permissions_by_form)
    return FormListResponse(forms=form_responses, total=total)


@router.get("/catalog", response_model=FormListResponse)
async def get_forms_catalog(
    db: AsyncSession = Depends(get_db),
    current_user: AppUser = Depends(get_current_user_dep),
):
    await _cleanup_expired_temp_forms(db)
    can_manage_forms = can_edit_forms(current_user)
    is_admin = resolve_user_role(current_user) == "admin"

    query = (
        select(Form, AccessControl.role)
        .outerjoin(
            AccessControl,
            and_(
                AccessControl.form_id == Form.form_id,
                AccessControl.user_id == current_user.user_id,
                _access_not_expired(),
            ),
        )
        .where(Form.status != "deleted")
        .order_by(Form.updated_at.desc(), Form.created_at.desc(), Form.form_id.desc())
    )
    if not is_admin:
        query = query.where(
            or_(
                Form.user_id == current_user.user_id,
                AccessControl.user_id == current_user.user_id,
            )
        )
    result = await db.execute(query)

    forms_by_id: dict[int, Form] = {}
    roles_by_form_id: dict[int, set[str]] = {}
    for form, role in result.all():
        forms_by_id.setdefault(form.form_id, form)
        if role is not None:
            role_value = role.value if hasattr(role, "value") else str(role)
            roles_by_form_id.setdefault(form.form_id, set()).add(role_value)

    accessible_forms: list[Form] = []
    permissions_by_form: dict[int, dict[str, bool]] = {}

    for form in forms_by_id.values():
        status_value = _enum_value(form.status)
        role_set = roles_by_form_id.get(form.form_id, set())
        is_owner = form.user_id == current_user.user_id
        can_edit = is_admin or (can_manage_forms and (is_owner or "editor" in role_set))
        can_view_responses = (
            status_value == "submitted"
            and (is_admin or is_owner or "editor" in role_set or "participant" in role_set)
        )
        can_continue_passage = (
            status_value == "submitted"
            and (is_admin or is_owner or "editor" in role_set or "participant" in role_set)
        )

        if not (can_edit or can_view_responses or can_continue_passage):
            continue

        accessible_forms.append(form)
        permissions_by_form[form.form_id] = {
            "can_edit": can_edit,
            "can_view_responses": can_view_responses,
            "can_continue_passage": can_continue_passage,
        }

    # Формы, где пользователь — респондент (есть ответ), но не в AccessControl
    responded_form_ids_result = await db.execute(
        select(Response.form_id)
        .where(Response.user_id == current_user.user_id)
        .where(Response.status.in_(["submitted", "cancelled"]))
        .distinct()
    )
    responded_form_ids = {row[0] for row in responded_form_ids_result.all()}

    for form_id in responded_form_ids:
        if form_id in permissions_by_form:
            continue
        form_result = await db.execute(
            select(Form).where(Form.form_id == form_id).where(Form.status == "submitted")
        )
        form = form_result.scalar_one_or_none()
        if form:
            accessible_forms.append(form)
            permissions_by_form[form.form_id] = {
                "can_edit": False,
                "can_view_responses": False,
                "can_continue_passage": True,
            }

    summaries = await build_form_summaries(db, accessible_forms, permissions_by_form, current_user.user_id)
    return FormListResponse(forms=summaries, total=len(summaries))


async def _ensure_editor_or_owner(
    db: AsyncSession,
    form_id: int,
    current_user: AppUser,
    allowed_roles: tuple[str, ...] = ("editor",),
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

    if resolve_user_role(current_user) == "admin":
        return form

    if not allowed_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    access = await db.execute(
        select(AccessControl)
        .where(AccessControl.form_id == form_id)
        .where(AccessControl.user_id == current_user.user_id)
        .where(AccessControl.role.in_(allowed_roles))
        .where(_access_not_expired())
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
    form = await _ensure_editor_or_owner(db, form_id, current_user, allowed_roles=("editor", "participant"))
    return await build_form_detail_response(db, form)


@router.put("/{form_id}", response_model=FormDetailResponse)
async def save_form(
    form_id: int,
    payload: FormBuilderPayload,
    in_place: bool = Query(False, description="Update submitted form in place without creating new draft version"),
    db: AsyncSession = Depends(get_db),
    current_user: AppUser = Depends(get_current_user_dep),
):
    ensure_can_edit_forms(current_user)
    form = await _ensure_editor_or_owner(db, form_id, current_user)

    if form.status == "submitted" and not in_place:
        source_form_id = form.form_id
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
        source_access_rows = await db.execute(
            select(AccessControl).where(AccessControl.form_id == source_form_id)
        )
        for row in source_access_rows.scalars().all():
            db.add(
                AccessControl(
                    form_id=draft.form_id,
                    user_id=row.user_id,
                    role=row.role,
                    expires_at=row.expires_at,
                )
            )
        form = draft

    target_status = "submitted" if form.status == "submitted" and in_place else "temp"
    form = await apply_builder_payload(db, form, payload, target_status=target_status)
    await db.commit()
    await db.refresh(form)
    return await build_form_detail_response(db, form)


@router.delete("/{form_id}", response_model=FormResponse)
async def delete_form(
    form_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: AppUser = Depends(get_current_user_dep),
):
    ensure_can_edit_forms(current_user)
    form = await _ensure_editor_or_owner(db, form_id, current_user)
    now = datetime.utcnow()
    form.status = "deleted"
    form.deleted_at = now
    form.expires_at = None
    await db.commit()
    await db.refresh(form)
    return FormResponse.model_validate(form)

