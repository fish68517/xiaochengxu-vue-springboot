from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    app_env: str = "development"
    app_name: str = "萌宠生活商城 API"
    database_url: str = f"sqlite:///{(BACKEND_DIR / 'data' / 'pet_life_dev.db').as_posix()}"
    frontend_origins: str = "http://127.0.0.1:5173,http://localhost:5173"
    jwt_secret: str = "pet-life-development-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 720

    model_config = SettingsConfigDict(
        env_file=(BACKEND_DIR / ".env", BACKEND_DIR / ".env.local"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins(self) -> list[str]:
        return [item.strip() for item in self.frontend_origins.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
