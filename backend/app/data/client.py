from notion_client import Client
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
import re
from app.config import settings

notion = Client(auth=settings.notion_token)

DB = {
    "va":         settings.va_db_id,
    "eod_main":   settings.eod_main_db_id,
    "eod_cba":    settings.eod_cba_db_id,
    "attendance": settings.attendance_db_id,
    "contracts":  settings.contracts_db_id,
}

EST             = ZoneInfo("America/New_York")
PHT             = timezone(timedelta(hours=+8))
GRACE_MINUTES   = 15
EOD_CUTOFF_HOUR = 18


# ── Property extractor ────────────────────────────────────────────

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


def est_day_bounds(date_str: str) -> tuple:
    start = datetime.fromisoformat(f"{date_str}T00:00:00").replace(tzinfo=EST)
    return (
        start.astimezone(timezone.utc).isoformat(),
        (start + timedelta(days=1)).astimezone(timezone.utc).isoformat(),
    )


def to_est(iso_str: str) -> datetime:
    return datetime.fromisoformat(
        iso_str.replace("Z", "+00:00")
    ).astimezone(EST)


# ── Time-string parser ────────────────────────────────────────────

def parse_time_str(time_str: str):
    """Parse a freeform time string like '9:00 AM EST', '3:00PM', '5PM' into (hour_24, minute)."""
    if not time_str:
        return None
    clean = time_str.upper()
    # Strip timezone suffixes
    clean = re.sub(r'\s*(EST|CST|PST|EDT|CDT|UTC)\s*', '', clean).strip()
    # Normalize: insert space before AM/PM if missing ("3:00PM" → "3:00 PM")
    clean = re.sub(r'(\d)(AM|PM)', r'\1 \2', clean)

    for fmt in ("%I:%M %p", "%I %p", "%H:%M", "%H"):
        try:
            dt = datetime.strptime(clean, fmt)
            return dt.hour, dt.minute
        except ValueError:
            continue
    return None

