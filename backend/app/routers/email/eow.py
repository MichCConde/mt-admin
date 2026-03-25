"""
End-of-week digest — sent to admin + HR head every Friday/Saturday.
"""
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query, HTTPException, Header

from app.middleware.auth import verify_token
from app.config import settings
from app.routers.internal.eow import get_eow_report   # reuse existing logic
from app.routers.internal.activity import log_activity

router = APIRouter(prefix="/api/email/eow", tags=["email-eow"])
log    = logging.getLogger(__name__)


@router.post("")
async def send_eow_email(
    year:  int  = Query(default=None),
    week:  int  = Query(default=None),
    user=Depends(verify_token),
):
    today = date.today()
    y     = year or today.isocalendar().year
    w     = week or today.isocalendar().week

    try:
        # Reuse the EOW router logic (already cached/optimised)
        report  = await get_eow_report(year=y, week=w, force=False, user=user)
        data    = report["data"]
        subject = f"[Monster Task] EOW Report — Week {w}, {y}"
        body    = _build_eow_html(report["start"], report["end"], data)

        recipients = list({settings.email_admin, settings.email_hr})
        _send_email(subject, body, recipients)
        log_activity("email_sent", user["uid"], {"type": "eow", "week": w, "year": y})

        return {"status": "sent", "week": w, "year": y}
    except Exception as e:
        log.exception("EOW email error")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cron")
async def cron_eow(x_cron_secret: str = Header(None)):
    """Auto-send EOW email on schedule (e.g. every Saturday morning)."""
    if not settings.cron_secret or x_cron_secret != settings.cron_secret:
        raise HTTPException(status_code=403)
    today = date.today()
    y, w, _ = today.isocalendar()
    # Temporarily bypass auth for cron context
    report  = await get_eow_report(year=y, week=w, force=False,
                                   user={"uid": "cron"})
    data    = report["data"]
    subject = f"[Monster Task] EOW Report — Week {w}, {y}"
    body    = _build_eow_html(report["start"], report["end"], data)
    _send_email(subject, body, [settings.email_admin, settings.email_hr])
    return {"status": "sent"}


def _build_eow_html(start, end, data) -> str:
    s   = data["summary"]
    dup = data["duplicates"]
    flg = data["flags"]

    dup_rows = "".join(
        f"<tr><td>{d['va_name']}</td><td>{d['type']}</td><td>{d['detail']}</td></tr>"
        for d in dup
    ) or "<tr><td colspan='3'><em>None</em></td></tr>"

    flg_rows = "".join(
        f"<tr><td>{f['va_name']}</td><td>{f['date']}</td>"
        f"<td>{', '.join(f['keywords'])}</td></tr>"
        for f in flg
    ) or "<tr><td colspan='3'><em>None</em></td></tr>"

    return f"""
    <h2>End-of-Week Report — {start} to {end}</h2>
    <p>Total Reports: {s['total_reports']} |
       Duplicates: {s['total_duplicates']} |
       Flags: {s['total_flags']}</p>

    <h3>Duplicate / Copy-Paste Reports</h3>
    <table border="1" cellpadding="4">
        <tr><th>VA</th><th>Type</th><th>Detail</th></tr>
        {dup_rows}
    </table>

    <h3>Flagged Comments</h3>
    <table border="1" cellpadding="4">
        <tr><th>VA</th><th>Date</th><th>Keywords</th></tr>
        {flg_rows}
    </table>
    """


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