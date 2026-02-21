# Подключаем БД
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import text
from sqlalchemy.orm import DeclarativeBase
from app.config import settings
from typing import AsyncGenerator

DATABASE_URL = settings.DATABASE_URL

# Движок базы данных
engine = create_async_engine(
    DATABASE_URL,
    echo=True,
    pool_pre_ping=True,
    pool_recycle=300,
    pool_size=20,
    max_overflow=10
)

# Диспетчер бд, выдает временную сессию
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False
)

class Base(DeclarativeBase):
    # Этот класс нужен для наследования его другими классами.
    pass

# Создает сессию, для каждого запроса, потом закрывает
async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            # Отдаем сессию в эндпоинт
            yield session
            # Если успешно - фиксируем изменения
            await session.commit()
        except Exception as e:
            await session.rollback()
            raise
        finally:
            await session.close()

# Проверяет работоспособность бд
async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Backward-compatible schema additions for access scheduling and invite limits.
        await conn.execute(text("ALTER TABLE access_control ADD COLUMN IF NOT EXISTS starts_at TIMESTAMP WITH TIME ZONE"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_access_starts ON access_control (starts_at)"))
        await conn.execute(text("ALTER TABLE access_invite ADD COLUMN IF NOT EXISTS starts_at TIMESTAMP WITH TIME ZONE"))
        await conn.execute(text("ALTER TABLE access_invite ADD COLUMN IF NOT EXISTS max_accepts INTEGER"))
        await conn.execute(text("ALTER TABLE access_invite ADD COLUMN IF NOT EXISTS accepted_count INTEGER"))
        await conn.execute(text("UPDATE access_invite SET accepted_count = 0 WHERE accepted_count IS NULL"))
        await conn.execute(text("ALTER TABLE access_invite ALTER COLUMN accepted_count SET DEFAULT 0"))
        await conn.execute(text("ALTER TABLE access_invite ALTER COLUMN accepted_count SET NOT NULL"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_access_invite_starts ON access_invite (starts_at)"))

    print("БД инициализирована")

async def close_db():
    await engine.dispose()
    print("Подключения к бд закрыты")
