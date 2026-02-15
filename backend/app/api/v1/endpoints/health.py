from datetime import datetime, timezone

from fastapi import APIRouter, Response, status
from sqlalchemy import text

from app.config import settings
from app.database import AsyncSessionLocal
from app.schemas import HealthResponse
from app.redis_client import get_redis

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health(response: Response) -> HealthResponse:
    services: dict[str, str] = {}

    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        services["database"] = "ok"
    except Exception as exc:
        services["database"] = f"error:{exc.__class__.__name__}"

    try:
        redis = get_redis()
        redis_ready = await redis.ping()
        services["redis"] = "ok" if redis_ready else "error:ping_failed"
    except Exception as exc:
        services["redis"] = f"error:{exc.__class__.__name__}"

    overall = "ok" if all(value == "ok" for value in services.values()) else "degraded"
    if overall != "ok":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return HealthResponse(
        status=overall,
        timestamp=datetime.now(timezone.utc),
        environment=settings.ENVIRONMENT,
        services=services,
    )
