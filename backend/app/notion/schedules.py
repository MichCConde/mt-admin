from datetime import date

_DAY_MAP = {
    "Monday": 0, "Tuesday": 1, "Wednesday": 2,
    "Thursday": 3, "Friday": 4, "Saturday": 5, "Sunday": 6,
}

# Maps schedule select values to weekday lists
_SCHEDULE_TO_DAYS = {
    "Mon - Fri":  ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    "Mon - Sat":  ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    "Tue - Sat":  ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    "Mon - Sun":  ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    "Weekdays":   ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    "Weekends":   ["Saturday", "Sunday"],
}


def _resolve_work_days(va: dict) -> list[str]:
    """
    Resolve work days from either:
    - 'schedule' select  (e.g. "Mon - Fri")
    - 'work_days' multi-select (legacy)
    """
    # Try schedule select first
    sched = va.get("schedule", "")
    if sched and sched in _SCHEDULE_TO_DAYS:
        return _SCHEDULE_TO_DAYS[sched]
    # Try exact day match (handles "Monday, Wednesday" style selects)
    if sched:
        days = [d.strip() for d in sched.replace("-", ",").split(",")]
        valid = [d for d in days if d in _DAY_MAP]
        if valid:
            return valid
    # Fallback: legacy work_days multi-select
    return va.get("work_days", [])


def build_schedules_from_vas(vas: list[dict]) -> list[dict]:
    schedules = []
    for va in vas:
        slots     = va.get("shift_slots", [])
        work_days = _resolve_work_days(va)

        if not slots and not work_days:
            continue

        if slots:
            for slot in slots:
                schedules.append({
                    "id":        f"{va['id']}_{slot['time_in']}",
                    "va_id":     va["id"],
                    "va_name":   va["name"],
                    "community": va.get("community", ""),
                    "schedule":  va.get("schedule", ""),
                    "time_in":   slot["time_in"],
                    "time_out":  slot["time_out"],
                    "client":    slot["client"],
                    "shift":     f"{slot['time_in']}–{slot['time_out']}",
                    "work_days": work_days,
                })
        else:
            schedules.append({
                "id":        va["id"],
                "va_id":     va["id"],
                "va_name":   va["name"],
                "community": va.get("community", ""),
                "schedule":  va.get("schedule", ""),
                "time_in":   "",
                "time_out":  "",
                "client":    "",
                "shift":     va.get("schedule", ""),  # show "Mon - Fri" as shift
                "work_days": work_days,
            })
    return schedules


def va_works_on_date(va_id: str, date_str: str, schedules: list[dict]) -> bool:
    target = date.fromisoformat(date_str).weekday()
    for s in schedules:
        if s["va_id"] != va_id:
            continue
        if any(_DAY_MAP.get(d) == target for d in s.get("work_days", [])):
            return True
    return False


def get_all_schedules() -> list[dict]:
    return []  # No separate schedule DB