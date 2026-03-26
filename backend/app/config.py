from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    # Notion
    notion_token:     str
    va_db_id:         str
    eod_main_db_id:   str
    eod_cba_db_id:    str
    attendance_db_id: str
    contracts_db_id:  str

    # Firebase
    firebase_service_account_json: str = ""
    firebase_service_account_path: str = "serviceAccountKey.json"

    # App
    frontend_url: str = ""
    cron_secret:  str = ""

    # Email
    email_sender:       str = ""
    email_app_password: str = ""
    email_recipients:   str = ""   # comma-separated

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def email_recipient_list(self) -> list[str]:
        return [r.strip() for r in self.email_recipients.split(",") if r.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()