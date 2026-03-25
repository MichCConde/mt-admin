"""
Daily morning report — sent to admin summarising previous day's EOD + attendance.
"""
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query, HTTPException

from app.middleware.auth import verify_token
from app.config import settings
from app.notion import (
    get_eod_main_for_date, get_eod_cba_for_date,
    get_attendance_for_date, get_active_vas, get_all_schedules,
)
from app.services import detect_keyword_flags
from app.services.eod_checker import check_missing_eod, check_missing_attendance
from app.routers.internal.activity import log_activity

router = APIRouter(prefix="/api/email/daily", tags=["email-daily"])
log    = logging.getLogger(__name__)


@router.post("")
async def send_daily_report(
    date: str = Query(default=None),
    user=Depends(verify_token),
):
    target = date or (date.today() - timedelta(days=1)).isoformat()

    try:
        main      = get_eod_main_for_date(target)
        cba       = get_eod_cba_for_date(target)
        att       = get_attendance_for_date(target)
        vas       = get_active_vas()
        schedules = get_all_schedules()

        all_reports     = main + cba
        missing_eod     = check_missing_eod(target, vas, all_reports, schedules)
        missing_att     = check_missing_attendance(target, vas, att, schedules)
        flags           = detect_keyword_flags(all_reports)

        subject = f"[Monster Task] Daily EOD Report — {target}"
        body    = _build_daily_html(target, all_reports, missing_eod, missing_att, flags)

        _send_email(subject, body, recipients=[settings.email_admin])
        log_activity("email_sent", user["uid"], {"type": "daily", "date": target})

        return {"status": "sent", "date": target}
    except Exception as e:
        log.exception("Daily email error for %s", target)
        raise HTTPException(status_code=500, detail=str(e))


def _build_daily_html(date_str, reports, missing_eod, missing_att, flags) -> str:
    def _list(items, key="va_name"):
        if not items:
            return "<li><em>None</em></li>"
        return "".join(f"<li>{i[key]}</li>" for i in items)

    flag_rows = "".join(
        f"<tr><td>{f['va_name']}</td><td>{', '.join(f['keywords'])}</td>"
        f"<td>{f['excerpt'][:120]}…</td></tr>"
        for f in flags
    ) or "<tr><td colspan='3'><em>No flags</em></td></tr>"

    return f"""
    <h2>Daily EOD Report — {date_str}</h2>
    <p><strong>Total Reports:</strong> {len(reports)}</p>

    <h3>Missing EOD Reports ({len(missing_eod)})</h3>
    <ul>{_list(missing_eod)}</ul>

    <h3>Missing Clock-In ({len(missing_att)})</h3>
    <ul>{_list(missing_att)}</ul>

    <h3>Flagged Comments ({len(flags)})</h3>
    <table border="1" cellpadding="4">
        <tr><th>VA</th><th>Keywords</th><th>Excerpt</th></tr>
        {flag_rows}
    </table>
    """


def _send_email(subject: str, html: str, recipients: list[str]):
    msg                   = MIMEMultipart("alternative")
    msg["Subject"]        = subject
    msg["From"]           = settings.smtp_user
    msg["To"]             = ", ".join(recipients)
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as s:
        s.starttls()
        s.login(settings.smtp_user, settings.smtp_pass)
        s.sendmail(settings.smtp_user, recipients, msg.as_string())