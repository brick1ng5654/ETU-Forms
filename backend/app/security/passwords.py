from __future__ import annotations

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from argon2.low_level import Type
from app.config import settings
from app.security.constants import PASSWORD_MAX_LEN, PASSWORD_MIN_LEN

_ph=PasswordHasher(
    time_cost=3, # количество итераций
    memory_cost=65536, # память в KiB
    parallelism=1, # параллельность
    hash_len=32,
    salt_len=16,
    type=Type.ID,
)

def _pepper_password(password: str) -> str:
    pepper = getattr(settings, "PASSWORD_PEPPER", "")
    if not pepper:
        raise RuntimeError("PASSWORD_PEPPER is not set")
    return password + pepper

def _validate_password_length(password: str) -> None:
    if not isinstance(password, str):
        raise TypeError("Password must be a string")
    if len(password) < PASSWORD_MIN_LEN:
        raise ValueError("Password is too short")
    if len(password) > PASSWORD_MAX_LEN:
        raise ValueError("Password is too long")
    
def hash_password(password: str) -> str:
    _validate_password_length(password)
    return _ph.hash(_pepper_password(password))

def verify_passport(password: str, password_hash: str) -> bool:
    _validate_password_length(password)
    try:
        return _ph.verify(password_hash, _pepper_password(password))
    except VerifyMismatchError:
        return False