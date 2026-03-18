import smtplib
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException
from app.notion import (
    get_active_vas,
    get_attendance_for_date,
    get_eod_main_for_date,
    get_eod_cba_for_date,
    get_active_contracts_for_va,
    EST,
)

router = APIRouter()

# ── Config ────────────────────────────────────────────────────────

def get_email_config():
    return {
        "sender":     os.getenv("EMAIL_SENDER"),
        "password":   os.getenv("EMAIL_APP_PASSWORD"),
        "recipients": [r.strip() for r in os.getenv("EMAIL_RECIPIENTS", "").split(",") if r.strip()],
    }


# ── Core report builder ───────────────────────────────────────────

def build_missing_report(date_str: str) -> dict:
    """
    Runs the same logic as the EOD checker and returns
    structured data for the email.
    """
    vas        = get_active_vas()
    attendance = get_attendance_for_date(date_str)
    eod_main   = get_eod_main_for_date(date_str)
    eod_cba    = get_eod_cba_for_date(date_str)

    clock_ins     = [a for a in attendance if a["type"] == "IN"]
    clocked_names = {a["raw_name"].strip().lower() for a in clock_ins}

    main_idx: dict[str, list] = {}
    for r in eod_main:
        main_idx.setdefault(r["name"].lower(), []).append(r)

    cba_idx: dict[tuple, list] = {}
    for r in eod_cba:
        cba_idx.setdefault((r["name"].lower(), r["client"].lower()), []).append(r)

    missing, submitted = [], []

    for va in vas:
        key        = va["name"].strip().lower()
        clocked_in = key in clocked_names
        community  = va.get("community", "")

        if community == "Main":
            if main_idx.get(key):
                submitted.extend(main_idx[key])
            else:
                missing.append({**va, "clocked_in": clocked_in, "missing_client": None})

        elif community == "CBA":
            contracts = get_active_contracts_for_va(va.get("contract_ids", []))
            if not contracts:
                reports = [r for r in eod_cba if r["name"].lower() == key]
                if reports: submitted.extend(reports)
                else: missing.append({**va, "clocked_in": clocked_in, "missing_client": None})
                continue
            for contract in contracts:
                client_key = contract["client_name"].lower()
                if cba_idx.get((key, client_key)):
                    submitted.extend(cba_idx[(key, client_key)])
                else:
                    missing.append({**va, "clocked_in": clocked_in, "missing_client": contract["client_name"]})

    # Late submissions
    late = [r for r in submitted if not r.get("punctuality", {}).get("on_time", True)]

    # No clock-in at all
    no_clock_in = [va for va in vas if va["name"].strip().lower() not in clocked_names]

    return {
        "date":           date_str,
        "total_vas":      len(vas),
        "missing":        missing,
        "late":           late,
        "no_clock_in":    no_clock_in,
        "submitted_count": len(submitted),
    }


# ── HTML email template ───────────────────────────────────────────

def build_html_email(report: dict) -> str:
    date_label = datetime.strptime(report["date"], "%Y-%m-%d").strftime("%A, %B %d, %Y")
    missing    = report["missing"]
    late       = report["late"]
    no_clock   = report["no_clock_in"]
    all_clear  = not missing and not late and not no_clock

    def va_row(va, extra=""):
        community = va.get("community", "")
        badge_color = {"Main": "#1D4ED8", "CBA": "#C2410C"}.get(community, "#6B7280")
        client_note = f" — {va['missing_client']}" if va.get("missing_client") else ""
        clocked     = va.get("clocked_in", False)
        clock_tag   = (
            '<span style="background:#FEF3C7;color:#D97706;border-radius:4px;padding:2px 7px;font-size:11px;font-weight:700;margin-left:6px;">Clocked in, no EOD</span>'
            if clocked else
            '<span style="background:#F3F4F6;color:#6B7280;border-radius:4px;padding:2px 7px;font-size:11px;font-weight:700;margin-left:6px;">No clock-in or EOD</span>'
        )
        return f"""
        <tr>
          <td style="padding:10px 16px;border-bottom:1px solid #FEE2E2;">
            <span style="background:{badge_color};color:#fff;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700;margin-right:8px;">{community}</span>
            <strong>{va['name']}</strong>{client_note}
            {clock_tag}
            {extra}
          </td>
        </tr>"""

    missing_section = ""
    if missing:
        rows = "".join(va_row(va) for va in missing)
        missing_section = f"""
        <div style="margin-bottom:24px;">
          <div style="background:#FEF2F2;border:1.5px solid #FECACA;border-radius:10px;overflow:hidden;">
            <div style="background:#FFF5F5;padding:12px 16px;border-bottom:1px solid #FECACA;">
              <strong style="color:#DC2626;font-size:14px;">⚠ {len(missing)} Missing EOD Report{"s" if len(missing)!=1 else ""}</strong>
            </div>
            <table style="width:100%;border-collapse:collapse;">{rows}</table>
          </div>
        </div>"""

    late_section = ""
    if late:
        late_rows = "".join(f"""
        <tr>
          <td style="padding:10px 16px;border-bottom:1px solid #FDE68A;">
            <strong>{r['name']}</strong>
            <span style="background:#FEF3C7;color:#D97706;border-radius:4px;padding:2px 7px;font-size:11px;font-weight:700;margin-left:8px;">
              Submitted {r['punctuality']['submitted_est']} — {r['punctuality']['minutes_late']}m late
            </span>
          </td>
        </tr>""" for r in late)
        late_section = f"""
        <div style="margin-bottom:24px;">
          <div style="background:#FFFBEB;border:1.5px solid #FDE68A;border-radius:10px;overflow:hidden;">
            <div style="background:#FFFDF0;padding:12px 16px;border-bottom:1px solid #FDE68A;">
              <strong style="color:#D97706;font-size:14px;">⏱ {len(late)} Late Submission{"s" if len(late)!=1 else ""}</strong>
            </div>
            <table style="width:100%;border-collapse:collapse;">{late_rows}</table>
          </div>
        </div>"""

    no_clock_section = ""
    if no_clock:
        def community_color(va):
            colors_map = {"Main": "#1D4ED8", "CBA": "#C2410C"}
            return colors_map.get(va.get("community", ""), "#6B7280")

        nc_rows = ""
        for va in no_clock:
            bg    = community_color(va)
            comm  = va.get("community", "")
            name  = va["name"]
            nc_rows += f"""
        <tr>
          <td style="padding:10px 16px;border-bottom:1px solid #FECACA;">
            <span style="background:{bg};color:#fff;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700;margin-right:8px;">{comm}</span>
            <strong>{name}</strong>
          </td>
        </tr>"""

        count = len(no_clock)
        suffix = "s" if count != 1 else ""
        no_clock_section = f"""
        <div style="margin-bottom:24px;">
          <div style="background:#FEF2F2;border:1.5px solid #FECACA;border-radius:10px;overflow:hidden;">
            <div style="background:#FFF5F5;padding:12px 16px;border-bottom:1px solid #FECACA;">
              <strong style="color:#DC2626;font-size:14px;">&#x2717; {count} No Clock-In Record{suffix}</strong>
            </div>
            <table style="width:100%;border-collapse:collapse;">{nc_rows}</table>
          </div>
        </div>"""

    all_clear_section = ""
    if all_clear:
        all_clear_section = """
        <div style="background:#ECFDF5;border:1.5px solid #A7F3D0;border-radius:10px;padding:20px;text-align:center;margin-bottom:24px;">
          <div style="font-size:20px;margin-bottom:6px;">✓</div>
          <strong style="color:#059669;font-size:15px;">All VAs submitted their EOD reports on time.</strong>
        </div>"""

    return f"""
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F2F5F9;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:620px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(13,31,60,0.10);">

    <!-- Header -->
    <div style="background:#0D1F3C;padding:24px 32px;">
      <div style="font-size:22px;font-weight:800;color:#fff;">Monster Task</div>
      <div style="font-size:13px;color:#4A6080;margin-top:2px;">VA Admin — Daily EOD Report</div>
    </div>

    <!-- Date bar -->
    <div style="background:#0CB8A9;padding:12px 32px;">
      <div style="font-size:14px;font-weight:700;color:#fff;">{date_label}</div>
    </div>

    <!-- Body -->
    <div style="padding:28px 32px;">

      <!-- Stats -->
      <div style="display:flex;gap:12px;margin-bottom:28px;">
        <div style="flex:1;background:#F2F5F9;border-radius:10px;padding:14px;text-align:center;">
          <div style="font-size:26px;font-weight:800;color:#0D1F3C;">{report["total_vas"]}</div>
          <div style="font-size:11px;font-weight:700;color:#6B7280;margin-top:3px;">ACTIVE VAs</div>
        </div>
        <div style="flex:1;background:#F2F5F9;border-radius:10px;padding:14px;text-align:center;">
          <div style="font-size:26px;font-weight:800;color:#059669;">{report["submitted_count"]}</div>
          <div style="font-size:11px;font-weight:700;color:#6B7280;margin-top:3px;">SUBMITTED</div>
        </div>
        <div style="flex:1;background:#F2F5F9;border-radius:10px;padding:14px;text-align:center;">
          <div style="font-size:26px;font-weight:800;color:{"#DC2626" if missing else "#059669"};">{len(missing)}</div>
          <div style="font-size:11px;font-weight:700;color:#6B7280;margin-top:3px;">MISSING</div>
        </div>
        <div style="flex:1;background:#F2F5F9;border-radius:10px;padding:14px;text-align:center;">
          <div style="font-size:26px;font-weight:800;color:{"#D97706" if late else "#059669"};">{len(late)}</div>
          <div style="font-size:11px;font-weight:700;color:#6B7280;margin-top:3px;">LATE</div>
        </div>
      </div>

      {all_clear_section}
      {missing_section}
      {late_section}
      {no_clock_section}
    </div>

    <!-- Footer -->
    <div style="background:#F2F5F9;padding:16px 32px;border-top:1px solid #E2E8F0;">
      <div style="font-size:12px;color:#9CA3AF;">
        This is an automated report from MT Admin. All times are in EST.
      </div>
    </div>
  </div>
</body>
</html>"""


# ── Send function ─────────────────────────────────────────────────

def send_email(subject: str, html_body: str):
    cfg = get_email_config()
    if not cfg["sender"] or not cfg["password"] or not cfg["recipients"]:
        raise ValueError("Email config incomplete. Check EMAIL_SENDER, EMAIL_APP_PASSWORD, EMAIL_RECIPIENTS in .env")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"MT Admin <{cfg['sender']}>"
    msg["To"]      = ", ".join(cfg["recipients"])
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(cfg["sender"], cfg["password"])
        server.sendmail(cfg["sender"], cfg["recipients"], msg.as_string())


# ── Routes ────────────────────────────────────────────────────────

@router.post("/send-morning-report")
def send_morning_report():
    """
    Sends the morning EOD digest for the previous day.
    Called automatically by APScheduler every morning,
    and can also be triggered manually from the app.
    """
    try:
        est      = timezone(timedelta(hours=-5))
        yesterday = (datetime.now(est) - timedelta(days=1)).strftime("%Y-%m-%d")
        report   = build_missing_report(yesterday)

        total_issues = len(report["missing"]) + len(report["late"]) + len(report["no_clock_in"])
        subject = (
            f"[MT Admin] ✓ All Clear — {yesterday}"
            if total_issues == 0 else
            f"[MT Admin] {total_issues} Issue{'s' if total_issues!=1 else ''} — EOD Report {yesterday}"
        )

        html = build_html_email(report)
        send_email(subject, html)

        return {
            "sent":      True,
            "date":      yesterday,
            "recipients": get_email_config()["recipients"],
            "summary": {
                "missing":    len(report["missing"]),
                "late":       len(report["late"]),
                "no_clock_in":len(report["no_clock_in"]),
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/send-report/{date}")
def send_report_for_date(date: str):
    """
    Manually send the EOD report for a specific date (YYYY-MM-DD).
    Useful for resending or testing.
    """
    try:
        report  = build_missing_report(date)
        total   = len(report["missing"]) + len(report["late"])
        subject = (
            f"[MT Admin] ✓ All Clear — {date}"
            if total == 0 else
            f"[MT Admin] {total} Issue{'s' if total!=1 else ''} — EOD Report {date}"
        )
        send_email(subject, build_html_email(report))
        return {"sent": True, "date": date}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))