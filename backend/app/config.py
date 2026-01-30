from pydantic_settings import BaseSettings
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

class Settings(BaseSettings):
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str
    POSTGRES_HOST: str = "postgres"
    POSTGRES_PORT: int = 5432

    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    ENVIRONMENT: str = "development"

    CORS_ORIGINS: str = "https://localhost,http://localhost:3000,http://localhost:8000"
    FILES_ROOT: str = str(BASE_DIR / "uploads")
    MAX_UPLOAD_MB: int = 20

    @property
    def CORS_ORIGINS_LIST(self):
        if not self.CORS_ORIGINS:
            return []
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
    
    @property
    def DATABASE_URL(self):
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    @property
    def FILES_ROOT_PATH(self) -> Path:
        return Path(self.FILES_ROOT)

    @property
    def MAX_UPLOAD_BYTES(self) -> int:
        return int(self.MAX_UPLOAD_MB) * 1024 * 1024
    
    class Config:
        env_file = BASE_DIR/".env"

settings = Settings()
