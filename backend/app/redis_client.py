from __future__ import annotations

from redis.asyncio import Redis
from app.config import settings

_redis: Redis | None = None

def get_redis() -> Redis:
    global _redis
    if _redis is None:
        _redis = Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=settings.REDIS_DB,
            password=getattr(settings, "REDIS_PASSWORD", None),
            decode_responses=True, # чтобы строки были str, а не bytes
        )
    return _redis

async def close_redis() -> None:
    global _redis
    if _redis is not None:
        await _redis.close()
        _redis = None