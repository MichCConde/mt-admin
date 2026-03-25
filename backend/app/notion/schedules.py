"""
Schedule data is stored in the VA database as a "Shift Time" rich-text property.

Format (one line per slot):
    8:00AM-10:00AM (Andrea)
    10:00AM-12NN (Justin)
    3:00PM-5:00PM (Andrea)

This module parses that text into structured shift records.
"""
import re
from datetime import date

# Matches:  8:00AM-10:00AM (Andrea)
#           10:00AM-12NN (Justin)
#           3:00PM-5:00PM (Andrea)
_SLOT_RE = re.compile(
    r"(\d{1,2}(?::\d{2})?(?:AM|PM|NN))\s*[-–]\s*(\d{1,2}(?::\d{2})?(?:AM|PM|NN))\s*\(([^)]+)\)",
    re.IGNORECASE,
)

_DAY_MAP = {
    "Monday": 0, "Tuesday": 1, "Wednesday": 2,
    "Thursday": 3, "Friday": 4, "Saturday": 5, "Sunday": 6,
}


def parse_shift_time(raw: str) -> list[dict]:
    """
    Parse a VA's Shift Time text into a list of slot dicts.
    Returns [] if the field is empty or unparseable.
    """
    if not raw:
        return []
    slots = []
    for line in raw.strip().splitlines():
        line = line.strip()
        if not line:
            continue
        m = _SLOT_RE.search(line)
        if m:
            slots.append({
                "time_in":  m.group(1).upper(),
                "time_out": m.group(2).upper(),
                "client":   m.group(3).strip(),
            })
    return slots


def build_schedules_from_vas(vas: list[dict]) -> list[dict]:
    """
    Convert the VA list (which includes shift_time and work_days fields)
    into the schedule format expected by the frontend.
    """
    schedules = []
    for va in vas:
        raw    = va.get("shift_time", "")
        slots  = parse_shift_time(raw)
        w_days = va.get("work_days", [])

        if not slots and not w_days:
            continue

        if slots:
            for slot in slots:
                schedules.append({
                    "id":        f"{va['id']}_{slot['time_in']}",
                    "va_id":     va["id"],
                    "va_name":   va["name"],
                    "type":      va.get("type", ""),
                    "community": va.get("community", ""),
                    "time_in":   slot["time_in"],
                    "time_out":  slot["time_out"],
                    "client":    slot["client"],
                    "shift":     f"{slot['time_in']}–{slot['time_out']}",
                    "work_days": w_days,
                })
        else:
            # VA has work days but no shift time — include with empty times
            schedules.append({
                "id":        va["id"],
                "va_id":     va["id"],
                "va_name":   va["name"],
                "type":      va.get("type", ""),
                "community": va.get("community", ""),
                "time_in":   "",
                "time_out":  "",
                "client":    "",
                "shift":     "",
                "work_days": w_days,
            })
    return schedules


def va_works_on_date(va_id: str, date_str: str, schedules: list[dict] = None) -> bool:
    """
    Returns True if the VA is scheduled to work on date_str.
    Uses pre-built schedule list to avoid extra Notion calls.
    """
    if schedules is None:
        return True   # conservative: assume they work if no schedule data
    target_weekday = date.fromisoformat(date_str).weekday()
    for s in schedules:
        if s["va_id"] != va_id:
            continue
        for day in s.get("work_days", []):
            if _DAY_MAP.get(day) == target_weekday:
                return True
    return False


# Keep this for the __init__.py import — returns empty since there's no schedule DB
def get_all_schedules() -> list[dict]:
    """
    No separate schedule DB — call build_schedules_from_vas() instead.
    This stub exists so existing imports don't break.
    """
    return []