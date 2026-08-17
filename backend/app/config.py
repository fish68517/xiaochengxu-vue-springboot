from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    app_env: str = "development"
    api_host: str = "127.0.0.1"
    api_port: int = 8010
    database_url: str = "mysql+pymysql://root:root@127.0.0.1:3306/elevator_service?charset=utf8mb4"
    auth_mode: str = "mock"
    payment_mode: str = "mock"
    storage_backend: str = "local"
    notification_mode: str = "mock"
    company_h5_mode: str = "mock"
    local_upload_dir: str = "./data/uploads"
    scheduler_enabled: bool = True
    log_level: str = "DEBUG"
    cors_origins: str = "http://127.0.0.1:5180,http://127.0.0.1:5181"

    model_config = SettingsConfigDict(
        env_file=(BASE_DIR / ".env", BASE_DIR / ".env.development"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


settings = Settings()

