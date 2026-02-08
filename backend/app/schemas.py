# Этот файл нужен для валидации входящих данных и сериализации ответов API. То есть что принимаем и что отдаём

from pydantic import BaseModel, EmailStr, Field, ConfigDict, model_validator, field_validator
from datetime import datetime
from typing import Optional, Dict, Any, List, Literal
from enum import Enum
from app.security.constants import PASSWORD_MAX_LEN, PASSWORD_MIN_LEN
# Enum
class FormAccessMode(str, Enum):
    PUBLIC = 'public'
    PRIVATE = 'private'
    UNAUTHENTICATED = 'unauthenticated'

class AccessRole(str, Enum):
    EDITOR = 'editor'
    PARTICIPANT = 'participant'

class FormStatus(str, Enum):
    TEMP = 'temp'
    SUBMITTED = 'submitted'
    DELETED = 'deleted'

class ResponseStatus(str, Enum):
    DRAFT = 'draft'
    SUBMITTED = 'submitted'
    CANCELLED = 'cancelled'

class WidgetType(str, Enum):
    HEADING = 'heading'
    STATIC_TEXT = 'static_text'
    TEXT_INPUT = 'text_input'
    NUMBER_INPUT = 'number_input'
    SELECT = 'select'
    RADIO = 'radio'
    CHECKBOX = 'checkbox'
    DATETIME = 'datetime'
    EMAIL_INPUT = 'email_input'
    RATING = 'rating'
    RANKING = 'ranking'
    MATRIX = 'matrix'
    FILE_UPLOAD = 'file_upload'

class SemanticType(str, Enum):
    FULL_NAME = 'full_name'
    PHONE = 'phone'
    EMAIL = 'email'
    PASSPORT = 'passport'
    INN = 'inn'
    SNILS = 'snils'
    BANK_ACCOUNT = 'bank_account'
    COUNTRY = 'country'
    OGRN = 'ogrn'
    BIK = 'bik'

class ConditionOperator(str, Enum):
    EQUALS = 'equals'
    NOT_EQUALS = 'not_equals'
    IN = 'in'
    NOT_IN = 'not_in'
    GREATER_THAN = 'greater_than'
    LESS_THAN = 'less_than'
    CONTAINS = 'contains'
    ANSWERED = 'answered'

class FileStatus(str, Enum):
    TEMP = 'temp'
    SUBMITTED = 'submitted'
    DELETED = 'deleted'


# User SCHEMAS
class UserBase(BaseModel):
    etu_id: Optional[str] = Field(None, max_length=50)
    name: str = Field(..., min_length=1, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    email: EmailStr

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, v: str):
        if isinstance(v, str):
            return v.strip().lower()
        return v
    
class UserCreate(UserBase):
    pass

class UserInDB(UserBase):
    user_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Form SCHEMAS
class FormBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    settings_json: Optional[Dict[str, Any]] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    access_mode: FormAccessMode = FormAccessMode.PRIVATE

class FormCreate(FormBase):
    user_id: Optional[int] = None  # временно, дальше берём из токена

class FormUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    settings_json: Optional[Dict[str, Any]] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    access_mode: Optional[FormAccessMode] = None

class FormResponse(FormBase):
    form_id: int
    user_id: int
    version: int
    prev_form_id: Optional[int] = None
    status: FormStatus
    deleted_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class FormListResponse(BaseModel):
    forms: List["FormSummaryResponse"]
    total: int

class FormSummaryResponse(FormResponse):
    elements_count: int = 0

class FormDetailResponse(FormResponse):
    elements: List["BuilderElementOut"] = Field(default_factory=list)
    conditions: List["BuilderConditionOut"] = Field(default_factory=list)

class PublicFormDetailResponse(BaseModel):
    form_id: int
    title: str
    description: Optional[str] = None
    settings_json: Optional[Dict[str, Any]] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    access_mode: FormAccessMode
    status: FormStatus
    version: int
    prev_form_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    elements: List["BuilderElementOut"] = Field(default_factory=list)
    conditions: List["BuilderConditionOut"] = Field(default_factory=list)

# Response SCHEMAS
class ResponseBase(BaseModel):
    status: ResponseStatus = ResponseStatus.DRAFT
    completed_at: Optional[datetime] = None

class FormSubmitAnswersRequest(BaseModel):
    answers: Dict[str, Any] = Field(default_factory=dict)
    started_at: Optional[datetime] = None

class FormSubmitAnswersResponse(BaseModel):
    response_id: int
    submitted_at: datetime
    answers_count: int

class FormStoredResponse(BaseModel):
    response_id: int
    form_id: int
    user_id: int
    responder_name: str
    responder_email: Optional[str] = None
    status: ResponseStatus
    created_at: datetime
    completed_at: Optional[datetime] = None
    version: int
    answers: Dict[str, Any] = Field(default_factory=dict)

class FormStoredResponsesResponse(BaseModel):
    responses: List[FormStoredResponse] = Field(default_factory=list)

class ResponseCreate(BaseModel):
    form_id: int

class ResponseResponse(ResponseBase):
    response_id: int
    user_id: int
    form_id: int
    created_at: datetime

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

# Template SCHEMAS
class TemplateBase(BaseModel):
    template_name: str = Field(..., min_length=1, max_length=255)

class TemplateCreate(TemplateBase):
    owner_id: int

class TemplateResponse(TemplateBase):
    template_id: int
    owner_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Form Element SCHEMAS
class FormElementBase(BaseModel):
    form_id: Optional[int] = None
    template_id: Optional[int] = None
    widget: WidgetType
    semantic: Optional[SemanticType] = None
    label: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    correct_answer: Optional[Dict[str, Any]] = None
    text_hint: Optional[str] = None
    supportive_text: Optional[str] = None
    required_field: bool = False
    other_settings: Optional[Dict[str, Any]] = None
    file_ids: List[int] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_owner_scope(self):
        if (self.form_id is None) == (self.template_id is None):
            raise ValueError("Exactly one of form_id or template_id must be set")
        return self

    @model_validator(mode="after")
    def validate_semantic_for_static(self):
        if self.widget in (WidgetType.HEADING, WidgetType.STATIC_TEXT) and self.semantic is not None:
            raise ValueError("semantic must be null for heading/static_text")
        return self

    @model_validator(mode="after")
    def validate_file_ids_limit(self):
        if self.file_ids and len(self.file_ids) > 10:
            raise ValueError("file_ids must contain at most 10 items")
        return self
    
class FormElementCreate(FormElementBase):
    pass

class FormElementResponse(FormElementBase):
    element_id: int

    model_config = ConfigDict(from_attributes=True)

# Response Answer SCHEMAS
class ResponseAnswerBase(BaseModel):
    response_id: int
    element_id: int
    value_text: Optional[str] = None
    value_number: Optional[int] = None
    value_bool: Optional[bool] = None
    value_date: Optional[datetime] = None
    value_time: Optional[datetime] = None
    value_json: Optional[Dict[str, Any]] = None

class ResponseAnswerCreate(ResponseAnswerBase):
    pass

class ResponseAnswerResponse(ResponseAnswerBase):
    answer_id: int

    model_config = ConfigDict(from_attributes=True)

# Form Element Condition SCHEMAS
class FormElementConditionBase(BaseModel):
    form_id: Optional[int] = None
    template_id: Optional[int] = None
    source_element_id: int
    target_element_id: int
    operator: ConditionOperator
    value: Optional[Dict[str, Any]] = None

    @model_validator(mode="after")
    def validate_scope(self):
        if (self.form_id is None) == (self.template_id is None):
            raise ValueError("Exactly one of form_id or template_id must be set")
        return self
    
class FormElementConditionCreate(FormElementConditionBase):
    pass

class FormElementConditionResponse(FormElementConditionBase):
    condition_id: int

    model_config = ConfigDict(from_attributes=True)

# Uploaded File SCHEMAS
class UploadedFileBase(BaseModel):
    answer_id: Optional[int] = None
    name: str = Field(..., min_length=1, max_length=512)
    mime_type: str = Field(..., min_length=1, max_length=255)
    storage_provider: str = Field(default="local", max_length=50)
    size_bytes: int = Field(..., gt=0)
    storage_path: str = Field(..., min_length=1)
    status: FileStatus = FileStatus.TEMP

class UploadedFileCreate(UploadedFileBase):
    pass

class UploadedFileResponse(UploadedFileBase):
    file_id: int
    created_at: datetime
    expires_at: datetime
    content_hash: Optional[str] = None
    url: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

# Health and MISC
class HealthResponse(BaseModel):
    status: str
    timestamp: datetime
    environment: str

class ErrorResponse(BaseModel):
    detail: str
    code: Optional[str] = None

class BuilderElementIn(BaseModel):
    client_id: str
    widget: WidgetType
    semantic: Optional[SemanticType] = None
    label: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    required_field: bool = False
    correct_answer: Optional[Dict[str, Any]] = None
    text_hint: Optional[str] = None
    supportive_text: Optional[str] = None
    other_settings: Optional[Dict[str, Any]] = None
    file_ids: List[int] = Field(default_factory=list)
    sort_index: int

    @model_validator(mode="after")
    def validate_file_ids_limit(self):
        if self.file_ids and len(self.file_ids) > 10:
            raise ValueError("file_ids must contain at most 10 items")
        return self

class BuilderElementOut(BuilderElementIn):
    pass

class BuilderConditionIn(BaseModel):
    source_client_id: str
    target_client_id: str
    operator: ConditionOperator
    value: Optional[Dict[str, Any]] = None

class BuilderConditionOut(BuilderConditionIn):
    pass

class FormBuilderPayload(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    settings_json: Optional[Dict[str, Any]] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    access_mode: Optional[FormAccessMode] = None

    elements: List[BuilderElementIn] = Field(default_factory=list)
    conditions: List[BuilderConditionIn] = Field(default_factory=list)

# Отдельные схемы, чтобы пароль не отдавался, где не надо
class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=PASSWORD_MIN_LEN, max_length=PASSWORD_MAX_LEN)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, v: str):
        if isinstance(v, str):
            return v.strip().lower()
        return v
    
class LoginResponse(BaseModel):
    user_id: int
    email: EmailStr
    name: str

    model_config = ConfigDict(from_attributes=True)


FormListResponse.model_rebuild()
FormDetailResponse.model_rebuild()
PublicFormDetailResponse.model_rebuild()

