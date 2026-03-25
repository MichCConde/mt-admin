"""
Ad-hoc alert emails — flagged reports, strike notifications, etc.
"""
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.middleware.auth import verify_token
from app.config import settings
from app.routers.internal.activity import log_activity

router = APIRouter(prefix="/api/email/alerts", tags=["email-alerts"])
log    = logging.getLogger(__name__)


class AlertPayload(BaseModel):
    va_name: str
    reason:  str
    detail:  str = ""
    recipients: list[str] = []


@router.post("")
async def send_alert(payload: AlertPayload, user=Depends(verify_token)):
    try:
        to = payload.recipients or [settings.email_admin]
        subject = f"[Monster Task] Alert — {payload.va_name}"
        body    = f"""
        <h2>Alert: {payload.va_name}</h2>
        <p><strong>Reason:</strong> {payload.reason}</p>
        <p>{payload.detail}</p>
        """
        _send_email(subject, body, to)
        log_activity("email_sent", user["uid"],
                     {"type": "alert", "va": payload.va_name, "reason": payload.reason})
        return {"status": "sent"}
    except Exception as e:
        log.exception("Alert email error")
        raise HTTPException(status_code=500, detail=str(e))


def _send_email(subject, html, recipients):
    msg            = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = settings.smtp_user
    msg["To"]      = ", ".join(recipients)
    msg.attach(MIMEText(html, "html"))
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as s:
        s.starttls()
        s.login(settings.smtp_user, settings.smtp_pass)
        s.sendmail(settings.smtp_user, recipients, msg.as_string())