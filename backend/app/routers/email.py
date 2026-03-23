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


def va_last_name(full_name: str) -> str:
    return full_name.strip().split()[-1].lower()


# ── Core report builder ───────────────────────────────────────────

def build_missing_report(date_str: str) -> dict:
    vas        = get_active_vas()
    attendance = get_attendance_for_date(date_str)
    eod_main   = get_eod_main_for_date(date_str)
    eod_cba    = get_eod_cba_for_date(date_str)

    clock_ins          = [a for a in attendance if a["type"] == "IN"]
    # Use last_name field from our updated get_attendance_for_date
    clocked_last_names = {a["last_name"] for a in clock_ins}

    main_idx: dict[str, list] = {}
    for r in eod_main:
        main_idx.setdefault(r["name"].lower(), []).append(r)

    cba_idx: dict[tuple, list] = {}
    for r in eod_cba:
        cba_idx.setdefault((r["name"].lower(), r["client"].lower()), []).append(r)

    missing, submitted = [], []

    for va in vas:
        key        = va["name"].strip().lower()
        last       = va_last_name(va["name"])
        clocked_in = last in clocked_last_names
        community  = va.get("community", "")

        if community == "Main":
            if main_idx.get(key):
                submitted.extend(main_idx[key])
            else:
                missing.append({
                    **va,
                    "clocked_in":    clocked_in,
                    "missing_client": None,
                    "missing_type":  "eod_only" if clocked_in else "clock_in_only",
                })

        elif community == "CBA":
            contracts = get_active_contracts_for_va(va.get("contract_ids", []))
            if not contracts:
                reports = [r for r in eod_cba if r["name"].lower() == key]
                if reports:
                    submitted.extend(reports)
                else:
                    missing.append({
                        **va,
                        "clocked_in":    clocked_in,
                        "missing_client": None,
                        "missing_type":  "eod_only" if clocked_in else "clock_in_only",
                    })
                continue
            for contract in contracts:
                client_key = contract["client_name"].lower()
                if cba_idx.get((key, client_key)):
                    submitted.extend(cba_idx[(key, client_key)])
                else:
                    missing.append({
                        **va,
                        "clocked_in":     clocked_in,
                        "missing_client": contract["client_name"],
                        "missing_type":   "eod_only" if clocked_in else "clock_in_only",
                    })

    late = [r for r in submitted if not r.get("punctuality", {}).get("on_time", True)]

    # VAs with no clock-in at all (matched by last name)
    no_clock_in = [
        va for va in vas
        if va_last_name(va["name"]) not in clocked_last_names
    ]

    return {
        "date":            date_str,
        "total_vas":       len(vas),
        "submitted_count": len(submitted),
        "clocked_in_count": len(clock_ins),
        "missing":         missing,
        "late":            late,
        "no_clock_in":     no_clock_in,
    }


# ── HTML email template ───────────────────────────────────────────

def build_html_email(report: dict) -> str:
    date_label = datetime.strptime(report["date"], "%Y-%m-%d").strftime("%A, %B %d, %Y")
    missing    = report["missing"]
    late       = report["late"]
    no_clock   = report["no_clock_in"]
    all_clear  = not missing and not late and not no_clock

    def community_badge(va):
        community   = va.get("community", "")
        badge_color = {"Main": "#1D4ED8", "CBA": "#C2410C"}.get(community, "#6B7280")
        return f'<span style="background:{badge_color};color:#fff;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700;margin-right:8px;">{community}</span>'

    def missing_type_tag(va):
        """Show clearly whether the VA missed their EOD, clock-in, or both."""
        t = va.get("missing_type", "clock_in_only")
        if t == "eod_only":
            return '<span style="background:#FEF3C7;color:#D97706;border-radius:4px;padding:2px 7px;font-size:11px;font-weight:700;margin-left:6px;">✓ Clocked in · No EOD</span>'
        return '<span style="background:#F3F4F6;color:#6B7280;border-radius:4px;padding:2px 7px;font-size:11px;font-weight:700;margin-left:6px;">✗ No clock-in · No EOD</span>'

    def missing_row(va):
        client_note = f' <span style="color:#6B7280;font-size:12px;">— {va["missing_client"]}</span>' if va.get("missing_client") else ""
        return f"""
        <tr>
          <td style="padding:10px 16px;border-bottom:1px solid #FEE2E2;">
            {community_badge(va)}<strong>{va['name']}</strong>{client_note}{missing_type_tag(va)}
          </td>
        </tr>"""

    def late_row(r):
        return f"""
        <tr>
          <td style="padding:10px 16px;border-bottom:1px solid #FDE68A;">
            <strong>{r['name']}</strong>
            {f'<span style="color:#6B7280;font-size:12px;margin-left:6px;">{r.get("client","")}</span>' if r.get("client") else ""}
            <span style="background:#FEF3C7;color:#D97706;border-radius:4px;padding:2px 7px;font-size:11px;font-weight:700;margin-left:8px;">
              Submitted {r['punctuality']['submitted_est']} — {r['punctuality']['minutes_late']}m late
            </span>
          </td>
        </tr>"""

    def no_clock_row(va, i):
        bg = "#FFF8F8" if i % 2 == 0 else "#FFF2F2"
        return f"""
        <tr style="background:{bg};">
          <td style="padding:10px 16px;border-bottom:1px solid #FEE2E2;">
            {community_badge(va)}<strong>{va['name']}</strong>
            <span style="background:#F3F4F6;color:#6B7280;border-radius:4px;padding:2px 7px;font-size:11px;font-weight:700;margin-left:6px;">No clock-in recorded</span>
          </td>
        </tr>"""

    # ── Sections ──────────────────────────────────────────────────
    all_clear_section = """
      <div style="background:#ECFDF5;border:1.5px solid #A7F3D0;border-radius:10px;padding:16px 20px;text-align:center;">
        <div style="font-size:18px;font-weight:800;color:#059669;">✓ All Clear</div>
        <div style="font-size:13px;color:#6B7280;margin-top:4px;">All VAs submitted their EOD reports on time.</div>
      </div>""" if all_clear else ""

    missing_section = ""
    if missing:
        # Split into two groups for clarity
        eod_only    = [v for v in missing if v.get("missing_type") == "eod_only"]
        both_missing = [v for v in missing if v.get("missing_type") != "eod_only"]

        rows = "".join(missing_row(va) for va in missing)
        missing_section = f"""
        <div style="margin-bottom:24px;">
          <div style="background:#FEF2F2;border:1.5px solid #FECACA;border-radius:10px;overflow:hidden;">
            <div style="background:#FFF5F5;padding:12px 16px;border-bottom:1px solid #FECACA;display:flex;justify-content:space-between;align-items:center;">
              <strong style="color:#DC2626;font-size:14px;">⚠ {len(missing)} Missing EOD Report{"s" if len(missing)!=1 else ""}</strong>
              <span style="font-size:11px;color:#6B7280;">
                {len(eod_only)} clocked in · {len(both_missing)} no clock-in
              </span>
            </div>
            <table style="width:100%;border-collapse:collapse;">{rows}</table>
          </div>
        </div>"""

    late_section = ""
    if late:
        rows = "".join(late_row(r) for r in late)
        late_section = f"""
        <div style="margin-bottom:24px;">
          <div style="background:#FFFBEB;border:1.5px solid #FDE68A;border-radius:10px;overflow:hidden;">
            <div style="background:#FFFDF0;padding:12px 16px;border-bottom:1px solid #FDE68A;">
              <strong style="color:#D97706;font-size:14px;">⏱ {len(late)} Late Submission{"s" if len(late)!=1 else ""}</strong>
            </div>
            <table style="width:100%;border-collapse:collapse;">{rows}</table>
          </div>
        </div>"""

    no_clock_section = ""
    if no_clock:
        rows = "".join(no_clock_row(va, i) for i, va in enumerate(no_clock))
        no_clock_section = f"""
        <div style="margin-bottom:24px;">
          <div style="background:#F9FAFB;border:1.5px solid #E5E7EB;border-radius:10px;overflow:hidden;">
            <div style="background:#F3F4F6;padding:12px 16px;border-bottom:1px solid #E5E7EB;">
              <strong style="color:#374151;font-size:14px;">🔔 {len(no_clock)} VA{"s" if len(no_clock)!=1 else ""} with No Clock-in</strong>
            </div>
            <table style="width:100%;border-collapse:collapse;">{rows}</table>
          </div>
        </div>"""

    return f"""<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F2F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:#0D1F3C;padding:24px 32px;display:flex;align-items:center;gap:16px;">
      <div>
        <div style="font-size:20px;font-weight:800;color:#fff;">MT Admin</div>
        <div style="font-size:12px;color:#4A6080;margin-top:2px;">Daily EOD Report</div>
      </div>
    </div>

    <!-- Date bar -->
    <div style="background:#0CB8A9;padding:12px 32px;">
      <div style="font-size:14px;font-weight:700;color:#fff;">{date_label}</div>
    </div>

    <!-- Body -->
    <div style="padding:28px 32px;">

      <!-- Stats — now includes clock-ins -->
      <div style="display:flex;gap:10px;margin-bottom:28px;flex-wrap:wrap;">
        <div style="flex:1;min-width:80px;background:#F2F5F9;border-radius:10px;padding:14px;text-align:center;">
          <div style="font-size:24px;font-weight:800;color:#0D1F3C;">{report["total_vas"]}</div>
          <div style="font-size:10px;font-weight:700;color:#6B7280;margin-top:3px;">ACTIVE VAs</div>
        </div>
        <div style="flex:1;min-width:80px;background:#F2F5F9;border-radius:10px;padding:14px;text-align:center;">
          <div style="font-size:24px;font-weight:800;color:#0CB8A9;">{report["clocked_in_count"]}</div>
          <div style="font-size:10px;font-weight:700;color:#6B7280;margin-top:3px;">CLOCKED IN</div>
        </div>
        <div style="flex:1;min-width:80px;background:#F2F5F9;border-radius:10px;padding:14px;text-align:center;">
          <div style="font-size:24px;font-weight:800;color:#059669;">{report["submitted_count"]}</div>
          <div style="font-size:10px;font-weight:700;color:#6B7280;margin-top:3px;">EOD SUBMITTED</div>
        </div>
        <div style="flex:1;min-width:80px;background:#F2F5F9;border-radius:10px;padding:14px;text-align:center;">
          <div style="font-size:24px;font-weight:800;color:{"#DC2626" if missing else "#059669"};">{len(missing)}</div>
          <div style="font-size:10px;font-weight:700;color:#6B7280;margin-top:3px;">MISSING EOD</div>
        </div>
        <div style="flex:1;min-width:80px;background:#F2F5F9;border-radius:10px;padding:14px;text-align:center;">
          <div style="font-size:24px;font-weight:800;color:{"#D97706" if late else "#059669"};">{len(late)}</div>
          <div style="font-size:10px;font-weight:700;color:#6B7280;margin-top:3px;">LATE</div>
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
        Attendance matched by last name — format: IN [Last Name], [Date].
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
    try:
        yesterday = (datetime.now(EST) - timedelta(days=1)).strftime("%Y-%m-%d")
        report    = build_missing_report(yesterday)

        total_issues = len(report["missing"]) + len(report["late"]) + len(report["no_clock_in"])
        subject = (
            f"[MT Admin] ✓ All Clear — {yesterday}"
            if total_issues == 0 else
            f"[MT Admin] {total_issues} Issue{'s' if total_issues!=1 else ''} — EOD Report {yesterday}"
        )
        send_email(subject, build_html_email(report))
        return {
            "sent":      True,
            "date":      yesterday,
            "recipients": get_email_config()["recipients"],
            "summary": {
                "missing":     len(report["missing"]),
                "late":        len(report["late"]),
                "no_clock_in": len(report["no_clock_in"]),
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/send-report/{date}")
def send_report_for_date(date: str):
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