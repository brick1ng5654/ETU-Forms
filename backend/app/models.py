# Зеркальный код БД, но не на SQL, а на понятном Python языке.

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Enum, CheckConstraint, func
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.dialects.postgresql import ENUM
from app.database import Base
import enum

class FormAccessMode(str, enum.Enum):
    PUBLIC = 'public'
    PRIVATE = 'private'
    UNAUTHENTICATED = 'unauthenticated'

class AccessRole(str, enum.Enum):
    EDITOR = 'editor'
    PARTICIPANT = 'participant'

form_access_mode_enum = ENUM(
    'public', 'private', 'unauthenticated',
    name='form_access_mode'
)

access_role_enum = ENUM(
    'editor', 'participant',
    name='access_role'
)
class AppUser(Base):
    __tablename__="app_user"

    user_id = Column(Integer, primary_key=True, index=True)
    etu_id = Column(String(50), unique=True, nullable=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    forms = relationship("Form", back_populates="user", cascade="all, delete-orphan")
    responses = relationship("Response", back_populates="user", cascade="all, delete-orphan")
    access_controls = relationship("AccessControl", back_populates="user", cascade="all, delete-orphan")

class Form(Base):
    __tablename__="form"

    form_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    structure_json = Column(JSON, nullable=False, default={})
    start_at = Column(DateTime(timezone=True), nullable=True)
    end_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    access_mode = Column(form_access_mode_enum, default='private')
    version = Column(Integer, default=1)
    prev_form_id = Column(Integer, ForeignKey("form.form_id"), nullable=True)

    __table_args__ = (
        CheckConstraint('start_at IS NULL OR end_at IS NULL OR start_at <= end_at', name='valid_dates'),
        CheckConstraint('version > 0', name = 'valid_version')
    )

    user = relationship("AppUser", back_populates="forms")
    responses = relationship("Response", back_populates="form", cascade="all, delete-orphan")
    access_controls = relationship("AccessControl", back_populates="form", cascade="all, delete-orphan")
    previous_version = relationship("Form", remote_side=[form_id], backref="next_version")

class Response(Base):
    __tablename__="response"

    response_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False)
    form_id = Column(Integer, ForeignKey("form.form_id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    response_json = Column(JSON, nullable=False, default={})

    user = relationship("AppUser", back_populates="responses")
    form = relationship("Form", back_populates="responses")

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