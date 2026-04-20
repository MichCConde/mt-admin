import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException
from app.config import settings
from app.notion import (
    get_active_vas, get_attendance_for_date,
    get_eod_main_for_date, get_eod_cba_for_date,
    va_works_on_date, get_active_contracts_by_id,
    EST,
)
from app.services.matching import names_match, fuzzy_find_eod, fuzzy_find_clockin
from app.services.report import build_report_row
from app.middleware.security import validate_date_range_30d, safe_error

router = APIRouter()


# ── Send function ─────────────────────────────────────────────────
def send_email(subject: str, html_body: str):
    if not settings.email_sender or not settings.email_app_password or not settings.email_recipient_list:
        raise ValueError(
            "Email config incomplete. "
            "Check EMAIL_SENDER, EMAIL_APP_PASSWORD, EMAIL_RECIPIENTS in .env"
        )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"MT Admin <{settings.email_sender}>"
    msg["To"]      = ", ".join(settings.email_recipient_list)
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(settings.email_sender, settings.email_app_password)
        server.sendmail(settings.email_sender, settings.email_recipient_list, msg.as_string())


# ── Build report data ─────────────────────────────────────────────

def _build_report(date_str: str) -> dict:

    vas        = get_active_vas()
    attendance = get_attendance_for_date(date_str)
    eod_main   = get_eod_main_for_date(date_str)
    eod_cba    = get_eod_cba_for_date(date_str)

    contracts_by_id = get_active_contracts_by_id()

    name_to_clockins: dict[str, list] = {}
    for a in attendance:
        name_to_clockins.setdefault(a["full_name"], []).append(a)
        if a["last_name"] != a["full_name"]:
            name_to_clockins.setdefault(a["last_name"], []).append(a)

    main_eod_by_va: dict[str, list] = {}
    for r in eod_main:
        main_eod_by_va.setdefault(r["name"].strip().lower(), []).append(r)

    cba_eod_by_va: dict[str, list] = {}
    for r in eod_cba:
        cba_eod_by_va.setdefault(r["name"].strip().lower(), []).append(r)

    working_vas = [va for va in vas if va_works_on_date(va, date_str)]
    rows = []

    for va in working_vas:
        key     = va["name"].strip().lower()
        va_last = key.split()[-1]
        va_cis  = name_to_clockins.get(key) or name_to_clockins.get(va_last, [])
        comm    = va.get("community", "")

        eod_source = main_eod_by_va if comm == "Main" else cba_eod_by_va
        va_eod_list = eod_source.get(key, [])
        if not va_eod_list:
            for eod_name, eod_records in eod_source.items():
                if names_match(key, eod_name):
                    va_eod_list = eod_records
                    break

        active_contracts = [
            contracts_by_id[cid]
            for cid in va.get("contract_ids", [])
            if cid in contracts_by_id
        ]

        if not active_contracts:
            ci  = va_cis[0] if va_cis else None
            eod = va_eod_list[0] if va_eod_list else None
            rows.append(build_report_row(va, None, comm, ci, eod, False, contract=None))
        else:
            for con in active_contracts:
                con_client = con["client_name"]
                con_ci, ci_nv = fuzzy_find_clockin(va_cis, con_client)
                con_eod, eod_nv = fuzzy_find_eod(va_eod_list, con_client)
                rows.append(build_report_row(
                    va, con_client, comm, con_ci, con_eod,
                    ci_nv or eod_nv, contract=con
                ))

    clocked_names = {r["va_name"] for r in rows if r["clock_in_status"] != "missing"}

    missing = [r for r in rows if r["status"] == "missing"]
    late    = [r for r in rows if r["status"] == "late"]
    early   = [r for r in rows if r["status"] == "early"]
    on_time = [r for r in rows if r["status"] == "on_time"]

    return {
        "date":    date_str,
        "rows":    rows,
        "missing": missing,
        "late":    late,
        "early":   early,
        "on_time": on_time,
        "stats": {
            "active_vas":    len(working_vas),
            "clocked_in":    len(clocked_names),
            "eod_submitted": sum(1 for r in rows if r["clock_out_status"] != "missing"),
            "missing_eod":   sum(1 for r in rows if r["clock_out_status"] == "missing"),
            "late":          len(late),
            "early":         len(early),
        },
    }


# ── HTML email builder ────────────────────────────────────────────

def _status_color(status: str) -> str:
    return {"on_time": "#059669", "late": "#D97706", "missing": "#DC2626", "early": "#7C3AED"}.get(status, "#6B7280")


def _status_label(status: str, minutes_late: int, minutes_early: int) -> str:
    if status == "missing":
        return '<span style="color:#DC2626;font-weight:700;">Missing</span>'
    if status == "late":
        return f'<span style="color:#D97706;font-weight:700;">{minutes_late}m late</span>'
    if status == "early":
        return f'<span style="color:#7C3AED;font-weight:700;">{minutes_early}m early</span>'
    return '<span style="color:#059669;font-weight:700;">On-time</span>'


def _comm_badge(community: str) -> str:
    c = {"Main": "#1D4ED8", "CBA": "#C2410C"}.get(community, "#6B7280")
    return f'<span style="background:{c};color:#fff;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700;">{community}</span>'


def _table_html(title: str, title_color: str, border_color: str, bg_color: str, rows: list) -> str:
    if not rows:
        return ""

    th = "padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #E2E8F0;"
    td = "padding:8px 12px;font-size:12px;color:#374151;border-bottom:1px solid #F3F4F6;"

    body_rows = ""
    for i, r in enumerate(rows):
        row_bg  = "#FFFFFF" if i % 2 == 0 else "#F9FAFB"
        client  = r["client"] or "—"
        ci_time = r["clock_in"].replace(" EST", "") if r["clock_in"] else "Missing"
        ci_clr  = _status_color(r["clock_in_status"])
        co_time = r["clock_out"].replace(" EST", "") if r["clock_out"] else "Missing"
        co_clr  = _status_color(r["clock_out_status"])
        verify  = ' <span style="color:#D97706;font-weight:800;">*</span>' if r.get("needs_verification") else ""

        body_rows += f"""
        <tr style="background:{row_bg};">
          <td style="{td}font-weight:600;color:#0D1F3C;">{r["va_name"]}{verify}</td>
          <td style="{td}">{client}</td>
          <td style="{td}text-align:center;">{_comm_badge(r["community"])}</td>
          <td style="{td}color:{ci_clr};">{ci_time}</td>
          <td style="{td}">{_status_label(r["clock_in_status"], r["clock_in_minutes_late"], r["clock_in_minutes_early"])}</td>
          <td style="{td}color:{co_clr};">{co_time}</td>
          <td style="{td}">{_status_label(r["clock_out_status"], r["clock_out_minutes_late"], r["clock_out_minutes_early"])}</td>
        </tr>"""

    return f"""
    <div style="margin-bottom:24px;">
      <div style="background:{bg_color};border:1.5px solid {border_color};border-radius:10px;overflow:hidden;">
        <div style="padding:12px 16px;border-bottom:1px solid {border_color};">
          <strong style="color:{title_color};font-size:14px;">{title}</strong>
        </div>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#F9FAFB;">
              <th style="{th}">Name</th>
              <th style="{th}">Client</th>
              <th style="{th}text-align:center;">Comm</th>
              <th style="{th}">Clock In</th>
              <th style="{th}">Punctuality</th>
              <th style="{th}">Clock Out</th>
              <th style="{th}">Submission</th>
            </tr>
          </thead>
          <tbody>{body_rows}</tbody>
        </table>
      </div>
    </div>"""


def build_html_email(report: dict) -> str:
    date_label = datetime.strptime(report["date"], "%Y-%m-%d").strftime("%A, %B %d, %Y")
    stats      = report["stats"]
    missing    = report["missing"]
    late       = report["late"]
    early      = report.get("early", [])
    all_clear  = not missing and not late and not early

    def stat(value, label, color):
        return f"""
        <div style="flex:1;min-width:80px;background:#F2F5F9;border-radius:10px;padding:14px;text-align:center;">
          <div style="font-size:24px;font-weight:800;color:{color};">{value}</div>
          <div style="font-size:10px;font-weight:700;color:#6B7280;margin-top:3px;">{label}</div>
        </div>"""

    stats_html = f"""
      <div style="display:flex;gap:10px;margin-bottom:28px;flex-wrap:wrap;">
        {stat(stats["active_vas"],    "ACTIVE VAs",    "#0D1F3C")}
        {stat(stats["clocked_in"],    "CLOCKED IN",    "#0CB8A9")}
        {stat(stats["eod_submitted"], "EOD SUBMITTED", "#059669")}
        {stat(stats["missing_eod"],   "MISSING EOD",   "#DC2626" if stats["missing_eod"] else "#059669")}
        {stat(stats["late"],          "LATE",           "#D97706" if stats["late"] else "#059669")}
      </div>"""

    all_clear_html = """
      <div style="background:#ECFDF5;border:1.5px solid #A7F3D0;border-radius:10px;padding:16px 20px;text-align:center;">
        <div style="font-size:18px;font-weight:800;color:#059669;">✓ All Clear</div>
        <div style="font-size:13px;color:#6B7280;margin-top:4px;">All VAs submitted their EOD reports on time.</div>
      </div>""" if all_clear else ""

    missing_html = _table_html(
        title=f"⚠ {len(missing)} Missing Report{'s' if len(missing) != 1 else ''}",
        title_color="#DC2626", border_color="#FECACA", bg_color="#FEF2F2",
        rows=missing,
    )

    late_html = _table_html(
        title=f"⏱ {len(late)} Late Submission{'s' if len(late) != 1 else ''}",
        title_color="#D97706", border_color="#FDE68A", bg_color="#FFFBEB",
        rows=late,
    )

    early_html = _table_html(
        title=f"⏰ {len(early)} Early Submission{'s' if len(early) != 1 else ''}",
        title_color="#7C3AED", border_color="#DDD6FE", bg_color="#F5F3FF",
        rows=early,
    )

    return f"""<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F2F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:700px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:#0D1F3C;padding:24px 32px;">
      <div style="font-size:20px;font-weight:800;color:#fff;">MT Admin</div>
      <div style="font-size:12px;color:#4A6080;margin-top:2px;">Daily EOD Report</div>
    </div>
    <div style="background:#0CB8A9;padding:12px 32px;">
      <div style="font-size:14px;font-weight:700;color:#fff;">{date_label}</div>
    </div>
    <div style="padding:28px 32px;">
      {stats_html}
      {all_clear_html}
      {missing_html}
      {late_html}
      {early_html}
    </div>
    <div style="background:#F2F5F9;padding:16px 32px;border-top:1px solid #E2E8F0;">
      <div style="font-size:12px;color:#9CA3AF;">
        This is an automated report from MT Admin. All times are in EST.
        * indicates clock-in client name needs manual verification.
      </div>
    </div>
  </div>
</body>
</html>"""


# ── Routes ────────────────────────────────────────────────────────

@router.post("/send-morning-report")
def send_morning_report():
    try:
        yesterday = (datetime.now(EST) - timedelta(days=1)).strftime("%Y-%m-%d")
        report    = _build_report(yesterday)
        date = validate_date_range_30d(date)

        total_issues = len(report["missing"]) + len(report["late"])
        subject = (
            f"[MT Admin] ✓ All Clear — {yesterday}"
            if total_issues == 0 else
            f"[MT Admin] {total_issues} Issue{'s' if total_issues != 1 else ''} — EOD Report {yesterday}"
        )
        send_email(subject, build_html_email(report))
        return {
            "sent":       True,
            "date":       yesterday,
            "recipients": settings.email_recipient_list,
            "summary": {
                "missing": len(report["missing"]),
                "late":    len(report["late"]),
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/send-report/{date}")
def send_report_for_date(date: str):
    try:
        report = _build_report(date)
        total  = len(report["missing"]) + len(report["late"])
        subject = (
            f"[MT Admin] ✓ All Clear — {date}"
            if total == 0 else
            f"[MT Admin] {total} Issue{'s' if total != 1 else ''} — EOD Report {date}"
        )
        send_email(subject, build_html_email(report))
        return {"sent": True, "date": date}
    except Exception as e:
        raise safe_error(e)