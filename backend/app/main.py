from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.config import settings
from app.database import init_db, close_db, AsyncSessionLocal
from app.api.v1.routers import api_router
from app.logging_config import setup_logging
from app.middlewares.error_logging import ServerErrorLoggingMiddleware
from app.services.seed_admin import seed_admin
from app.redis_client import close_redis

# Запуск логера сообщений, должна быть структура
setup_logging(logs_dir="logs/backend", level=getattr(settings, "LOG_LEVEL", "INFO"))

logger = logging.getLogger(__name__)

# Запуск жизненного цикла приложения
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Запуск Form Constructor")
    logger.info(f"Окружение: {settings.ENVIRONMENT}")
    logger.info(f"CORS разпрешены для {settings.CORS_ORIGINS}")

    try:
        await init_db()
        logger.info("База данных готова к работе")
    except Exception as e:
        logger.exception("Ошибка инициализации бд")
        raise

    async with AsyncSessionLocal() as session:
        try:
            await seed_admin(session)
            await session.commit()
        except:
            await session.rollback()
            raise
    yield

    await close_redis()
    logger.info("Остановка Form Constructor")
    await close_db()
    logger.info("Приложение остановлено корректно")

app = FastAPI(
    title="Form Constructor",
    description="Бэкенд для конструктора форм",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(ServerErrorLoggingMiddleware)

#CORS нужны, чтобы frontend мог обращаться к бэкенду
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS_LIST,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")

@app.get("/ping")
def ping():
    return {"status": "ok"}