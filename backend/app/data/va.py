from datetime import datetime
from app.notion import *

# ── VA Database ───────────────────────────────────────────────────

ACTIVE_STATUSES     = {"Active"}
ACTIVE_EMP_STATUSES = {"Employee"}
ALLOWED_TEAMS       = {"VA Team"}
EXCLUDED_TEAMS      = {"Internal", "Project Based"}

_va_cache = {"data": None, "expires": 0.0}

def get_active_vas_cached() -> list:
    import time
    now = time.time()
    if _va_cache["data"] and now < _va_cache["expires"]:
        return _va_cache["data"]
    result = get_active_vas()
    _va_cache["data"]    = result
    _va_cache["expires"] = now + 300
    return result

def get_active_vas() -> list:
    pages = query_all(DB["va"], {
        "and": [
            {"property": "Status",     "select":       {"equals":   "Active"}},
            {"property": "Emp Status", "select":       {"equals":   "Employee"}},
            {"property": "Team",       "multi_select": {"contains": "VA Team"}},
        ]
    })

    vas = []
    for p in pages:
        name       = get_prop(p, "Name").strip()
        status     = get_prop(p, "Status")
        emp_status = get_prop(p, "Emp Status")
        teams      = get_prop(p, "Team")

        if not name:                                    continue
        if status      not in ACTIVE_STATUSES:          continue
        if emp_status  not in ACTIVE_EMP_STATUSES:      continue
        if not any(t in ALLOWED_TEAMS for t in teams):  continue
        if any(t in EXCLUDED_TEAMS for t in teams):     continue

        vas.append({
            "id":             p["id"],
            "name":           name,
            "community":      get_prop(p, "Community "),
            "email":          get_prop(p, "MT Email Address"),
            "phone":          get_prop(p, "Phone"),
            "start_date":     get_prop(p, "Start Date"),
            "schedule":       get_prop(p, "Schedule"),
            "shift_time":     get_prop(p, "Shift Time"),
            "schedule_notes": get_prop(p, "Schedule Notes"),
            "contract_ids":   get_prop(p, "Contracts"),
            "status":         status,
        })

    return sorted(vas, key=lambda v: v["name"])


# ── Schedule helpers ──────────────────────────────────────────────

_SCHEDULE_WORKDAYS = {
    "Mon - Fri": {0, 1, 2, 3, 4},
    "Mon - Sun": {0, 1, 2, 3, 4, 5},
    "Flexible":  {0, 1, 2, 3, 4, 5},
}

def va_works_on_date(va: dict, date_str: str) -> bool:
    weekday  = datetime.strptime(date_str, "%Y-%m-%d").weekday()
    schedule = va.get("schedule", "Mon - Fri")
    workdays = _SCHEDULE_WORKDAYS.get(schedule, {0, 1, 2, 3, 4})
    return weekday in workdays
