"""
Shared Notion helpers: client, property extractor, timezone utils,
punctuality calculators, schedule logic.

Preserves 100% of the original notion.py helper logic.
"""
import re
from datetime import datetime, timedelta, timezone
from notion_client import Client
from app.config import settings

notion = Client(auth=settings.notion_token)

DB = {
    "va":         settings.va_db_id,
    "eod_main":   settings.eod_main_db_id,
    "eod_cba":    settings.eod_cba_db_id,
    "attendance": settings.attendance_db_id,
    "contracts":  settings.contracts_db_id,
}

EST           = timezone(timedelta(hours=-5))
PHT           = timezone(timedelta(hours=+8))
GRACE_MINUTES = 15
EOD_CUTOFF_HOUR = 18


def get_prop(page: dict, name: str):
    p = page.get("properties", {}).get(name)
    if not p:
        return ""
    t = p.get("type")
    if t == "title":        return "".join(r["plain_text"] for r in p.get("title", []))
    if t == "rich_text":    return "".join(r["plain_text"] for r in p.get("rich_text", []))
    if t == "select":       return p["select"]["name"] if p.get("select") else ""
    if t == "multi_select": return [o["name"] for o in p.get("multi_select", [])]
    if t == "date":         return p["date"]["start"] if p.get("date") else ""
    if t == "created_time": return p.get("created_time", "")
    if t == "number":       return p.get("number") or 0
    if t == "email":        return p.get("email", "")
    if t == "relation":     return [r["id"] for r in p.get("relation", [])]
    if t == "rollup":
        ro = p.get("rollup", {})
        if ro.get("type") == "array":
            out = []
            for item in ro.get("array", []):
                if item.get("type") == "rich_text":
                    out.append("".join(r["plain_text"] for r in item.get("rich_text", [])))
                elif item.get("type") == "title":
                    out.append("".join(r["plain_text"] for r in item.get("title", [])))
            return out
        return ""
    return ""


def query_all(database_id: str, filter_obj: dict = None) -> list:
    results, cursor = [], None
    while True:
        kwargs = {"database_id": database_id, "page_size": 100}
        if filter_obj: kwargs["filter"] = filter_obj
        if cursor:     kwargs["start_cursor"] = cursor
        res = notion.databases.query(**kwargs)
        results.extend(res.get("results", []))
        if not res.get("has_more"): break
        cursor = res.get("next_cursor")
    return results


def est_day_bounds(date_str: str) -> tuple[str, str]:
    start = datetime.fromisoformat(f"{date_str}T00:00:00").replace(tzinfo=EST)
    return (
        start.astimezone(timezone.utc).isoformat(),
        (start + timedelta(days=1)).astimezone(timezone.utc).isoformat(),
    )


def to_est(iso_str: str) -> datetime:
    return datetime.fromisoformat(
        iso_str.replace("Z", "+00:00")
    ).astimezone(EST)


def parse_time_str(time_str: str) -> tuple[int, int] | None:
    if not time_str:
        return None
    clean = time_str.upper()
    clean = re.sub(r'\s*(EST|CST|PST|EDT|CDT|UTC)\s*', '', clean).strip()
    for fmt in ("%I:%M %p", "%I %p", "%H:%M", "%H"):
        try:
            dt = datetime.strptime(clean, fmt)
            return dt.hour, dt.minute
        except ValueError:
            continue
    return None


def eod_punctuality(submitted_at: str, time_out_str: str) -> dict:
    submitted_est = to_est(submitted_at)
    parsed = parse_time_str(time_out_str)
    if parsed:
        cutoff_h, cutoff_m = parsed
    else:
        cutoff_h, cutoff_m = EOD_CUTOFF_HOUR, 0
    cutoff   = submitted_est.replace(hour=cutoff_h, minute=cutoff_m, second=0, microsecond=0)
    deadline = cutoff + timedelta(minutes=GRACE_MINUTES)
    on_time  = submitted_est <= deadline
    minutes_late = max(0, int((submitted_est - deadline).total_seconds() / 60))
    return {
        "on_time":       on_time,
        "submitted_est": submitted_est.strftime("%I:%M %p EST"),
        "expected_by":   deadline.strftime("%I:%M %p EST"),
        "minutes_late":  minutes_late if not on_time else 0,
    }


def clock_in_punctuality(created_at: str, time_in_str: str) -> dict:
    clocked_est = to_est(created_at)
    parsed = parse_time_str(time_in_str)
    if parsed:
        cutoff_h, cutoff_m = parsed
    else:
        cutoff_h, cutoff_m = 9, 0
    cutoff   = clocked_est.replace(hour=cutoff_h, minute=cutoff_m, second=0, microsecond=0)
    deadline = cutoff + timedelta(minutes=GRACE_MINUTES)
    on_time  = clocked_est <= deadline
    minutes_late = max(0, int((clocked_est - deadline).total_seconds() / 60))
    return {
        "on_time":        on_time,
        "clocked_in_est": clocked_est.strftime("%I:%M %p EST"),
        "expected_by":    deadline.strftime("%I:%M %p EST"),
        "minutes_late":   minutes_late if not on_time else 0,
    }


# Schedule: Mon=0 Tue=1 Wed=2 Thu=3 Fri=4 Sat=5 Sun=6
_SCHEDULE_WORKDAYS: dict[str, set[int]] = {
    "Mon - Fri": {0, 1, 2, 3, 4},
    "Mon - Sun": {0, 1, 2, 3, 4, 5},
    "Flexible":  {0, 1, 2, 3, 4, 5},
}


def va_works_on_date(va: dict, date_str: str) -> bool:
    weekday  = datetime.strptime(date_str, "%Y-%m-%d").weekday()
    schedule = va.get("schedule", "Mon - Fri")
    workdays = _SCHEDULE_WORKDAYS.get(schedule, {0, 1, 2, 3, 4})
    return weekday in workdays