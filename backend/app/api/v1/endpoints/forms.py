# Эндпоинты для работы с формами
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import datetime
from app.database import AsyncSessionLocal
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Form, AppUser
from app.security.auth_dependencies import get_current_user as get_current_user_dep
from app.schemas import (
    FormCreate,
    FormResponse,
    FormUpdate,
    FormListResponse
)

router = APIRouter(prefix="/forms", tags=["forms"])

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
        payload = form_data.model_dump(exclude={"user_id"})  # <-- главное
        db_form = Form(
            **payload,
            user_id=current_user.user_id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
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

    count_querry = select(func.count()).select_from(Form).where(
        Form.user_id == current_user.user_id
    )

    total = (await db.execute(count_querry)).scalar()

    query = (
        select(Form)
        .where(Form.user_id == current_user.user_id)
        .order_by(Form.created_at.desc())
        .offset(skip)
        .limit(limit)
    )

    result = await db.execute(query)
    forms = result.scalars().all()

    form_responses = []
    for form in forms:
        form_dict = form.__dict__.copy()
        form_responses.append(FormResponse.model_validate(form_dict))

    return FormListResponse(forms=form_responses, total=total)

