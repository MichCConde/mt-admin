from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Notion
    notion_token: str
    va_db_id: str
    eod_main_db_id: str
    eod_cba_db_id: str
    attendance_db_id: str
    contracts_db_id: str

    # Schedule DB — add NOTION_SCHEDULE_DB_ID to your .env if you have one,
    # otherwise it defaults to empty and schedule features will be skipped.
    notion_schedule_db_id: str = ""

    # Firebase
    firebase_service_account: str = "serviceAccountKey.json"

    # Frontend
    frontend_url: str = ""

    # Email (Gmail App Password)
    email_sender: str = ""
    email_app_password: str = ""
    email_recipients: str = ""   # comma-separated

    # Cron
    cron_secret: str = ""

    # Aliases so the rest of the codebase can use the cleaner names
    @property
    def notion_va_db_id(self) -> str:
        return self.va_db_id

    @property
    def notion_eod_main_db_id(self) -> str:
        return self.eod_main_db_id

    @property
    def notion_eod_cba_db_id(self) -> str:
        return self.eod_cba_db_id

    @property
    def notion_attendance_db_id(self) -> str:
        return self.attendance_db_id

    @property
    def smtp_user(self) -> str:
        return self.email_sender

    @property
    def smtp_pass(self) -> str:
        return self.email_app_password

    @property
    def email_admin(self) -> str:
        recipients = self.email_recipients.split(",")
        return recipients[0].strip() if recipients else ""

    @property
    def email_hr(self) -> str:
        recipients = self.email_recipients.split(",")
        return recipients[1].strip() if len(recipients) > 1 else self.email_admin

    class Config:
        env_file = ".env"
        extra = "ignore"      # ← silently ignores any unrecognised env vars


settings = Settings()