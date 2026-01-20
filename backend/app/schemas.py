# Этот файл нужен для валидации входящих данных и сериализации ответов API. То есть что принимаем и что отдаем

from pydantic import BaseModel, EmailStr, Field, ConfigDict
from datetime import datetime
from typing import Optional, Dict, Any, List
from enum import Enum

# Enum
class FormAccessMode(str, Enum):
    PUBLIC = 'public'
    PRIVATE = 'private'
    UNAUTHENTICATED = 'unauthenticated'

class AccessRole(str, Enum):
    EDITOR = 'editor'
    PARTICIPANT = 'participant'

# User SCHEMAS
class UserBase(BaseModel):
    pass # Позже можно добавить пароль

class UserInDB(UserBase):
    user_id: int
    created_at: datetime

    # Настройки применяются ко всей модели Pydantic целиком, аргумент позволяет автоматически преобразовывать данные.
    model_config = ConfigDict(from_attributes=True)

# Form SCHEMAS
class FormBase(BaseModel):
    # Field - функция для добавления метаданных(настройки), 3 точки означает, что поле - обязательное, и другие настройки
    title: str = Field(..., min_length=1, max_length=255)
    # Optional[str] - означает, что переменной можно присвоить либо str, либо None
    description: Optional[str] = None
    # Dict[str, Any] - словарь, где ключи - строки, а значения любые
    structure_json: Dict[str, Any] = Field(default_factory=dict)
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    access_mode: FormAccessMode = FormAccessMode.PRIVATE

class FormCreate(FormBase):
    pass

class FormUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    structure_json: Optional[Dict[str, Any]] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    access_mode: Optional[FormAccessMode] = None

class FormResponse(FormBase):
    form_id: int
    user_id: int
    version: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class FormListResponse(BaseModel):
    # Список, где каждый элемент типа FormResponse
    forms: List[FormResponse]
    total: int

# Response SCHEMAS
class ResponseBase(BaseModel):
    response_json: Dict[str, Any] = Field(default_factory=dict)

class ResponseCreate(ResponseBase):
    pass

class ResponseResponse(ResponseBase):
    reponse_id: int
    user_id: int
    form_id: int
    created_at: datetime
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

# Access Control SCHEMAS
class AccessControlBase(BaseModel):
    user_id: int
    role: AccessRole

class AccessControlCreate(AccessControlBase):
    pass

class AccessControlResponse(AccessControlBase):
    access_id: int
    form_id: int
    user_email: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

# Health and MISC

class HealthResponse(BaseModel):
    status: str
    timestamp: datetime
    environment: str

class ErrorResponse(BaseModel):
    detail: str
    code: Optional[str] = None