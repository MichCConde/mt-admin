from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    # ── Notion ────────────────────────────────────────────────────
    notion_token:      str
    va_db_id:          str
    eod_main_db_id:    str
    eod_cba_db_id:     str
    attendance_db_id:  str
    contracts_db_id:   str

    # ── Firebase ──────────────────────────────────────────────────
    # Production: full JSON string of the service account key
    # Local dev:  leave blank and set firebase_service_account_path instead
    firebase_service_account_json: str = ""
    firebase_service_account_path: str = "serviceAccountKey.json"

    # ── App ───────────────────────────────────────────────────────
    frontend_url: str = ""
    cron_secret:  str = ""

    # ── Email ─────────────────────────────────────────────────────
    email_sender:     str = ""
    email_app_password: str = ""
    email_recipients: str = ""   # comma-separated list

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,   # VA_DB_ID → va_db_id automatically
        extra="ignore",         # don't error on unrecognised vars
    )

    @property
    def email_recipient_list(self) -> list[str]:
        """Parse comma-separated recipients into a clean list."""
        return [r.strip() for r in self.email_recipients.split(",") if r.strip()]


@lru_cache
def get_settings() -> Settings:
    """
    Returns a cached Settings instance.
    Pydantic validates all fields on first call — the app will refuse
    to start if any required variable is missing, rather than failing
    silently mid-request with a cryptic None error.
    """
    return Settings()


# Module-level singleton — import this directly in other files
settings = get_settings()