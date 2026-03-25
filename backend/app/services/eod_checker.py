"""
Single source of truth for EOD / attendance matching logic.
Previously duplicated across eod.py, email.py, and eow.py — now lives here only.
"""
from datetime import datetime


def check_missing_eod(
    date_str: str,
    vas: list[dict],
    reports: list[dict],
    schedules: list[dict],
) -> list[dict]:
    """
    Returns a list of VAs who were expected to submit an EOD report
    but did not, respecting their schedule.
    """
    from app.notion.schedules import va_works_on_date

    submitted_names = {r["name_lower"] for r in reports}
    missing = []

    for va in vas:
        if not va_works_on_date(va["id"], date_str, schedules):
            continue
        if va["name"].lower().strip() not in submitted_names:
            missing.append({
                "va_id":   va["id"],
                "va_name": va["name"],
                "type":    va["type"],
                "date":    date_str,
            })
    return missing


def check_missing_attendance(
    date_str: str,
    vas: list[dict],
    attendance: list[dict],
    schedules: list[dict],
) -> list[dict]:
    """
    Returns VAs who were scheduled but have no clock-in record.
    """
    from app.notion.schedules import va_works_on_date

    clocked_in_last_names = {
        a["last_name"] for a in attendance if a["clock"] == "IN"
    }
    missing = []

    for va in vas:
        if not va_works_on_date(va["id"], date_str, schedules):
            continue
        if va["last_name"] not in clocked_in_last_names:
            missing.append({
                "va_id":   va["id"],
                "va_name": va["name"],
                "date":    date_str,
            })
    return missing


def check_late_submissions(
    reports: list[dict],
    grace_minutes: int = 15,
) -> list[dict]:
    """
    Classify submissions by lateness severity.
    Returns list of dicts with va_name, minutes_late, severity.
    """
    flagged = []
    for r in reports:
        if not r.get("time_out") or not r.get("created_at"):
            continue
        try:
            created = datetime.fromisoformat(r["created_at"].replace("Z", "+00:00"))
            # Parse expected submission time from time_out
            # Simple heuristic: report should be submitted within 30 min of time_out
            # Adjust logic to match your actual business rules
            minutes_late = 0  # placeholder — implement per your rules

            if minutes_late <= 0:
                continue
            severity = (
                "soft"     if minutes_late <= 15  else
                "standard" if minutes_late <= 60  else
                "critical"
            )
            flagged.append({
                "va_name":     r["name"],
                "date":        r["date"],
                "minutes_late": minutes_late,
                "severity":    severity,
            })
        except Exception:
            continue
    return flagged