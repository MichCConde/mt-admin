from datetime import date
from .client import query_database, prop_text, prop_select, prop_multi_select
from app.config import settings

_DAY_MAP = {
    "Monday": 0, "Tuesday": 1, "Wednesday": 2,
    "Thursday": 3, "Friday": 4, "Saturday": 5, "Sunday": 6,
}


# ── Public API ────────────────────────────────────────────────────────────────

def get_all_schedules() -> list[dict]:
    pages = query_database(settings.notion_schedule_db_id)
    return [_map_schedule(p) for p in pages]


def va_works_on_date(va_id: str, date_str: str, schedules: list[dict] = None) -> bool:
    """
    Returns True if the VA is scheduled to work on date_str.
    Pass in pre-fetched schedules list to avoid extra Notion calls.
    """
    if schedules is None:
        schedules = get_all_schedules()
    target = date.fromisoformat(date_str)
    target_weekday = target.weekday()   # 0 = Monday

    for s in schedules:
        if s["va_id"] != va_id:
            continue
        for day in s["work_days"]:
            if _DAY_MAP.get(day) == target_weekday:
                return True
    return False


# ── Internal ──────────────────────────────────────────────────────────────────

def _map_schedule(page: dict) -> dict:
    """
    ⚠️ Verify property names match your actual Notion Schedule database columns.
    """
    return {
        "id":        page["id"],
        "va_id":     prop_text(page, "VA ID"),      # relation or text ID
        "va_name":   prop_text(page, "VA Name"),
        "work_days": prop_multi_select(page, "Work Days"),
        "shift":     prop_select(page, "Shift"),    # e.g. "Morning", "Afternoon"
        "time_in":   prop_text(page, "Time In"),
        "time_out":  prop_text(page, "Time Out"),
    }