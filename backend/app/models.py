# Зеркальный код БД, но не на SQL, а на понятном Python языке.

from sqlalchemy import Column, Integer, String, Boolean, text, Text, DateTime, ForeignKey, JSON, Enum, CheckConstraint, func, BigInteger, Index
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.dialects.postgresql import ENUM, ARRAY
from app.database import Base
import enum

class FormAccessMode(str, enum.Enum):
    PRIVATE = 'private'
    UNAUTHENTICATED = 'unauthenticated'

class AccessRole(str, enum.Enum):
    EDITOR = 'editor'
    PARTICIPANT = 'participant'

class UserRole(str, enum.Enum):
    FORM_CREATOR = 'form_creator'
    ADMIN = 'admin'

class FormStatus(str, enum.Enum):
    TEMP = 'temp'
    SUBMITTED = 'submitted'
    DELETED = 'deleted'

form_access_mode_enum = ENUM(
    'private', 'unauthenticated',
    name='form_access_mode'
)

form_status_enum = ENUM(
    'temp', 'submitted', 'deleted',
    name='form_status'
)

access_role_enum = ENUM(
    'editor', 'participant',
    name='access_role'
)

user_role_enum = ENUM(
    'form_creator', 'admin',
    name='user_role'
)

response_status_enum = ENUM(
    'draft', 'submitted', 'cancelled',
    name='response_status'
)

widget_type_enum = ENUM(
    'heading','static_text', 'text_input', 'number_input', 'select', 'radio','checkbox', 'datetime', 'email_input', 'rating', 'ranking', 'matrix','file_upload',
    name="widget_type"
)

semantic_type_enum = ENUM(
    'full_name', 'phone', 'email', 'passport', 'inn','snils','bank_account', 'country','ogrn','bik',
    name='semantic_type'
)

condition_operator_enum = ENUM(
    'equals','not_equals','in','not_in','greater_than','less_than','contains','answered',
    name='condition_operator'
)

file_status_enum = ENUM(
    'temp','submitted','deleted',
    name='file_status'
)

class AppUser(Base):
    __tablename__="app_user"

    user_id = Column(Integer, primary_key=True, index=True)
    etu_id = Column(String(50), unique=True, nullable=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    password_hash = Column(Text, nullable=True)
    role = Column(user_role_enum, nullable=True)
    is_admin = Column(Boolean, nullable=False, server_default="false")

    forms = relationship("Form", back_populates="user", cascade="all, delete-orphan")
    responses = relationship("Response", back_populates="user", cascade="all, delete-orphan")
    access_controls = relationship("AccessControl", back_populates="user", cascade="all, delete-orphan")
    templates = relationship("Template", back_populates="owner",cascade="all, delete-orphan",foreign_keys="Template.owner_id",)

class Form(Base):
    __tablename__="form"

    form_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    settings_json = Column(JSON, nullable=True)
    start_at = Column(DateTime(timezone=True), nullable=True)
    end_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    access_mode = Column(form_access_mode_enum, server_default="private")
    status = Column(form_status_enum, nullable=False, server_default="temp")
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), server_default=text("now() + interval '7 days'"))
    version = Column(Integer, default=1)
    prev_form_id = Column(Integer, ForeignKey("form.form_id"), nullable=True)

    __table_args__ = (
        CheckConstraint('start_at IS NULL OR end_at IS NULL OR start_at <= end_at', name='valid_dates'),
        CheckConstraint('version > 0', name = 'valid_version'),
        Index('ix_form_user_status', 'user_id', 'status'),
        Index('ix_form_status_expires', 'status', 'expires_at'),
        Index('ix_form_status_deleted', 'status', 'deleted_at'),
    )

    user = relationship("AppUser", back_populates="forms")
    responses = relationship("Response", back_populates="form", cascade="all, delete-orphan")
    access_controls = relationship("AccessControl", back_populates="form", cascade="all, delete-orphan")
    previous_version = relationship("Form", remote_side=[form_id], backref="next_version")
    elements = relationship("FormElement", back_populates="form", cascade="all, delete-orphan")
    conditions = relationship("FormElementCondition", back_populates="form", cascade="all, delete-orphan")

class Response(Base):
    __tablename__="response"

    response_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False)
    form_id = Column(Integer, ForeignKey("form.form_id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(response_status_enum, nullable=False, server_default="draft")
    respondent_session_token = Column(String(255), nullable=True, index=True)
    revoke_counts_as_attempt_at_revoke = Column(Boolean, nullable=True)

    user = relationship("AppUser", back_populates="responses")
    form = relationship("Form", back_populates="responses")
    answers = relationship("ResponseAnswer", back_populates="response", cascade="all, delete-orphan")

class AccessControl(Base):
    __tablename__="access_control"

    access_id = Column(Integer, primary_key=True, index=True)
    form_id = Column(Integer, ForeignKey("form.form_id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False)
    role = Column(access_role_enum, nullable=False)

    __table_args__ = (
        CheckConstraint('role IN (\'editor\', \'participant\')', name='valid_role'),
    )

    form = relationship("Form", back_populates="access_controls")
    user = relationship("AppUser", back_populates="access_controls")

class Template(Base):
    __tablename__="template"

    template_id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False)
    template_name = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("AppUser",back_populates="templates",foreign_keys=[owner_id],)
    elements = relationship("FormElement", back_populates="template", cascade="all, delete-orphan")
    conditions = relationship("FormElementCondition", back_populates="template", cascade="all, delete-orphan")
    
class FormElement(Base):
    __tablename__="form_element"

    element_id = Column(Integer, primary_key=True, index=True)
    form_id = Column(Integer, ForeignKey("form.form_id", ondelete="CASCADE"), nullable=True)
    template_id = Column(Integer, ForeignKey("template.template_id", ondelete="CASCADE"), nullable=True)
    widget = Column(widget_type_enum, nullable=False)
    semantic = Column(semantic_type_enum, nullable=True)
    label = Column(String(255), nullable=False)
    correct_answer = Column(JSON, nullable=True)
    text_hint = Column(Text, nullable=True)
    supportive_text = Column(Text, nullable=True)
    required_field = Column(Boolean, nullable=False, server_default="false")
    position = Column(Integer, nullable=False)
    other_settings = Column(JSON, nullable=True)
    file_ids = Column(ARRAY(Integer), nullable=False, server_default=text("'{}'::int[]"))

    @property
    def description(self) -> str | None:
        return self.supportive_text

    @description.setter
    def description(self, value: str | None) -> None:
        self.supportive_text = value

    form = relationship("Form", back_populates="elements")
    template = relationship("Template", back_populates="elements")

    answers = relationship("ResponseAnswer", back_populates="form_element", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint('widget NOT IN (\'heading\', \'static_text\') OR semantic IS NULL', name='chk_non_input_semantic'),
        CheckConstraint('(form_id IS NOT NULL AND template_id IS NULL) OR (form_id IS NULL AND template_id IS NOT NULL)', name='chk_element_owner'),
        CheckConstraint('coalesce(array_length(file_ids, 1), 0) <= 10', name='chk_element_file_ids'),
    )


class ResponseAnswer(Base):
    __tablename__="response_answer"

    answer_id = Column(Integer, primary_key=True, index=True)
    response_id = Column(Integer, ForeignKey("response.response_id", ondelete="CASCADE"), nullable=False)
    element_id = Column(Integer, ForeignKey("form_element.element_id", ondelete="CASCADE"), nullable=False)
    value_text = Column(Text, nullable=True)
    value_number = Column(Integer, nullable=True)
    value_bool = Column(Boolean, nullable=True)
    value_date = Column(DateTime(timezone=True), nullable=True)
    value_time = Column(DateTime(timezone=True), nullable=True)
    # DB column name is value_jsonb; keep Python attribute name for compatibility.
    value_json = Column("value_jsonb", JSON, nullable=True)

    response = relationship("Response", back_populates="answers")
    form_element = relationship("FormElement", back_populates="answers")
    files = relationship("UploadedFile", back_populates="response_answer", cascade="all, delete-orphan")

class FormElementCondition(Base):
    __tablename__="form_element_condition"

    condition_id = Column(Integer, primary_key=True, index=True)
    form_id = Column(Integer, ForeignKey("form.form_id", ondelete="CASCADE"), nullable=True)
    template_id = Column(Integer, ForeignKey("template.template_id", ondelete="CASCADE"), nullable=True)
    source_element_id = Column(Integer, ForeignKey("form_element.element_id", ondelete="CASCADE"), nullable=False)
    target_element_id = Column(Integer, ForeignKey("form_element.element_id", ondelete="CASCADE"), nullable=False)
    operator = Column(condition_operator_enum, nullable=False)
    value = Column(JSON, nullable=True)

    form = relationship("Form", back_populates="conditions")
    template = relationship("Template", back_populates="conditions")
    source_element = relationship("FormElement", foreign_keys=[source_element_id])
    target_element = relationship("FormElement", foreign_keys=[target_element_id])

    __table_args__=(
        CheckConstraint('(source_element_id <> target_element_id)', name='no_self_condition'),
        CheckConstraint(
        "(form_id IS NOT NULL AND template_id IS NULL) OR (form_id IS NULL AND template_id IS NOT NULL)",
        name="chk_condition_scope"
        ),
    )

class UploadedFile(Base):
    __tablename__="uploaded_file"

    file_id = Column(Integer, primary_key=True, index=True)
    answer_id = Column(Integer, ForeignKey("response_answer.answer_id", ondelete="CASCADE"), nullable=True)
    access_token = Column(String(64), nullable=False, unique=True, index=True)
    content_hash = Column(String(64), nullable=False, index=True)
    name = Column(String(512), nullable=False)
    mime_type = Column(String(255), nullable=False)
    size_bytes = Column(BigInteger, nullable=False)
    storage_provider = Column(String(50), server_default=text("'local'"))
    storage_path = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), server_default=text("now() + interval '1 day'"))
    status = Column(file_status_enum, nullable=False)

    response_answer = relationship("ResponseAnswer", back_populates="files")
