from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[1]
ENV_FILES = (BASE_DIR / ".env",) if (BASE_DIR / ".env").exists() else (BASE_DIR / ".env.development",)


class Settings(BaseSettings):
    app_env: str = "development"
    api_host: str = "127.0.0.1"
    api_port: int = 8010
    database_url: str = "mysql+pymysql://root:root@127.0.0.1:3306/elevator_service?charset=utf8mb4"
    auth_mode: str = "database"
    payment_mode: str = "manual"
    storage_backend: str = "local"
    notification_mode: str = "outbox"
    local_upload_dir: str = "./data/uploads"
    scheduler_enabled: bool = True
    log_level: str = "DEBUG"
    cors_origins: str = "http://127.0.0.1:5180,http://127.0.0.1:5181"
    jwt_secret: str = "local-development-change-me"
    jwt_expire_minutes: int = 720

    model_config = SettingsConfigDict(
        env_file=ENV_FILES,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


settings = Settings()
