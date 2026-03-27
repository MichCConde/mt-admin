import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException
from app.config import settings
from app.notion import (
    get_active_vas, get_attendance_for_date,
    get_eod_main_for_date, get_eod_cba_for_date,
    get_all_active_contracts_by_va_id, va_works_on_date,
    match_client_name,
    EST,
)

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


# ── Core report builder ───────────────────────────────────────────

def build_missing_report(date_str: str) -> dict:
    vas             = get_active_vas()
    contracts_by_va = get_all_active_contracts_by_va_id()
    attendance      = get_attendance_for_date(date_str)
    eod_main        = get_eod_main_for_date(date_str)
    eod_cba         = get_eod_cba_for_date(date_str)

    # Build lookup by both full_name (new format) and last_name (old format)
    name_to_clockins: dict[str, list] = {}
    for a in attendance:
        name_to_clockins.setdefault(a["full_name"], []).append(a)
        if a["last_name"] != a["full_name"]:
            name_to_clockins.setdefault(a["last_name"], []).append(a)

    main_idx: dict[str, list] = {}
    for r in eod_main:
        main_idx.setdefault(r["name"].lower(), []).append(r)

    cba_idx: dict[tuple, list] = {}
    for r in eod_cba:
        cba_idx.setdefault((r["name"].lower(), r["client"].lower()), []).append(r)

    missing, submitted = [], []
    working_vas = [va for va in vas if va_works_on_date(va, date_str)]

    for va in working_vas:
        key      = va["name"].strip().lower()
        va_last  = va["name"].strip().split()[-1].lower()
        # Try full name first (new format), fall back to last name (old format)
        va_clockins = name_to_clockins.get(key) or name_to_clockins.get(va_last, [])
        clocked_in  = len(va_clockins) > 0
        community   = va.get("community", "")

        if community == "Main":
            if main_idx.get(key):
                submitted.extend(main_idx[key])
            else:
                missing.append({
                    **va,
                    "clocked_in":         clocked_in,
                    "missing_client":     None,
                    "missing_type":       "eod_only" if clocked_in else "clock_in_only",
                    "needs_verification": False,
                })

        elif community == "CBA":
            contracts = contracts_by_va.get(va["id"], [])
            if not contracts:
                reports = [r for r in eod_cba if r["name"].lower() == key]
                if reports:
                    submitted.extend(reports)
                else:
                    missing.append({
                        **va,
                        "clocked_in":         clocked_in,
                        "missing_client":     None,
                        "missing_type":       "eod_only" if clocked_in else "clock_in_only",
                        "needs_verification": False,
                    })
                continue

            for contract in contracts:
                client_key = contract["client_name"].lower()

                # Per-contract clock-in with fuzzy match
                contract_clocked_in = False
                needs_verification  = False
                for ci in va_clockins:
                    is_match, needs_v = match_client_name(
                        ci.get("client", ""), contract["client_name"]
                    )
                    if is_match:
                        contract_clocked_in = True
                        needs_verification  = needs_v
                        break

                if cba_idx.get((key, client_key)):
                    submitted.extend(cba_idx[(key, client_key)])
                else:
                    missing.append({
                        **va,
                        "clocked_in":         contract_clocked_in,
                        "missing_client":     contract["client_name"],
                        "missing_type":       "eod_only" if contract_clocked_in else "clock_in_only",
                        "needs_verification": needs_verification,
                    })

    late = [r for r in submitted if not r.get("punctuality", {}).get("on_time", True)]
    no_clock_in = [
        va for va in working_vas
        if not (
            name_to_clockins.get(va["name"].strip().lower()) or
            name_to_clockins.get(va["name"].strip().split()[-1].lower())
        )
    ]

    return {
        "date":             date_str,
        "total_vas":        len(working_vas),
        "submitted_count":  len(submitted),
        "clocked_in_count": len(attendance),
        "missing":          missing,
        "late":             late,
        "no_clock_in":      no_clock_in,
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
        t    = va.get("missing_type", "clock_in_only")
        flag = ' <span style="color:#D97706;font-weight:800;" title="Client name needs verification">*</span>' \
               if va.get("needs_verification") else ""
        if t == "eod_only":
            return f'<span style="background:#FEF3C7;color:#D97706;border-radius:4px;padding:2px 7px;font-size:11px;font-weight:700;margin-left:6px;">✓ Clocked in · No EOD</span>{flag}'
        return f'<span style="background:#F3F4F6;color:#6B7280;border-radius:4px;padding:2px 7px;font-size:11px;font-weight:700;margin-left:6px;">✗ No clock-in · No EOD</span>{flag}'

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

    all_clear_section = """
      <div style="background:#ECFDF5;border:1.5px solid #A7F3D0;border-radius:10px;padding:16px 20px;text-align:center;">
        <div style="font-size:18px;font-weight:800;color:#059669;">✓ All Clear</div>
        <div style="font-size:13px;color:#6B7280;margin-top:4px;">All VAs submitted their EOD reports on time.</div>
      </div>""" if all_clear else ""

    missing_section = ""
    if missing:
        eod_only     = [v for v in missing if v.get("missing_type") == "eod_only"]
        both_missing = [v for v in missing if v.get("missing_type") != "eod_only"]
        rows = "".join(missing_row(va) for va in missing)
        missing_section = f"""
        <div style="margin-bottom:24px;">
          <div style="background:#FEF2F2;border:1.5px solid #FECACA;border-radius:10px;overflow:hidden;">
            <div style="background:#FFF5F5;padding:12px 16px;border-bottom:1px solid #FECACA;display:flex;justify-content:space-between;align-items:center;">
              <strong style="color:#DC2626;font-size:14px;">⚠ {len(missing)} Missing EOD Report{"s" if len(missing)!=1 else ""}</strong>
              <span style="font-size:11px;color:#6B7280;">{len(eod_only)} clocked in · {len(both_missing)} no clock-in</span>
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
    <div style="background:#0D1F3C;padding:24px 32px;">
      <div style="font-size:20px;font-weight:800;color:#fff;">MT Admin</div>
      <div style="font-size:12px;color:#4A6080;margin-top:2px;">Daily EOD Report</div>
    </div>
    <div style="background:#0CB8A9;padding:12px 32px;">
      <div style="font-size:14px;font-weight:700;color:#fff;">{date_label}</div>
    </div>
    <div style="padding:28px 32px;">
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
        from datetime import datetime
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
            "sent":       True,
            "date":       yesterday,
            "recipients": settings.email_recipient_list,
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