"""
VA database queries.
Preserves original filters: Status=Active, Emp Status=Employee, Team=VA Team.
Community property name has a trailing space: "Community ".
"""
import time
from .core import get_prop, query_all, DB

ACTIVE_STATUSES     = {"Active"}
ACTIVE_EMP_STATUSES = {"Employee"}
ALLOWED_TEAMS       = {"VA Team"}
EXCLUDED_TEAMS      = {"Internal", "Project Based"}

_va_cache: dict = {"data": None, "expires": 0.0}


def get_active_vas_cached() -> list[dict]:
    now = time.time()
    if _va_cache["data"] and now < _va_cache["expires"]:
        return _va_cache["data"]
    result = get_active_vas()
    _va_cache["data"]    = result
    _va_cache["expires"] = now + 300
    return result


def get_active_vas() -> list[dict]:
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

        if not name:                                        continue
        if status     not in ACTIVE_STATUSES:               continue
        if emp_status not in ACTIVE_EMP_STATUSES:           continue
        if not any(t in ALLOWED_TEAMS for t in teams):      continue
        if any(t in EXCLUDED_TEAMS for t in teams):         continue

        vas.append({
            "id":             p["id"],
            "name":           name,
            "community":      get_prop(p, "Community "),   # ← trailing space — matches Notion
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