from __future__ import annotations

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from app.config import settings

_ph=PasswordHasher(
    time_cost=3, # количество итераций
    memory_cost=65536, # память в KiB
    parallelism=1, # параллельность
    hash_len=32,
    salt_len=16,
)

def _pepper_password(password: str) -> str:
    pepper = getattr(settings, "PASSWORD_PEPPER", "")
    if not pepper:
        raise RuntimeError("PASSWORD_PEPPER is not set")
    return password + pepper

def hash_password(password: str) -> str:
    if not password or len(password) < 8:
        raise ValueError("Password is too short")
    return _ph.hash(_pepper_password(password))

def verify_passport(password: hash, password_hash: str) -> bool:
    try:
        return _ph.verify(password_hash, _pepper_password(password))
    except VerifyMismatchError:
        return False