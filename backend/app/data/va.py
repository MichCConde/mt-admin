from datetime import datetime
from typing import Optional
from app.notion import *

# ── VA Database ───────────────────────────────────────────────────

ACTIVE_STATUSES     = {"Active"}
ACTIVE_EMP_STATUSES = {"Employee"}
ALLOWED_TEAMS       = {"VA Team"}
EXCLUDED_TEAMS      = {"Internal", "Project Based"}

_va_cache = {"data": None, "expires": 0.0}


def _extract_rollup_phone(page: dict, prop_name: str = "Phone") -> Optional[str]:
    """Extract a phone number from a Notion rollup property.

    Rollups nest the value inside .rollup.array[i].<source_type>.
    Handles common source types: phone_number, rich_text, title, and
    formula (string or number). Returns the first non-empty value found.
    """
    prop = page.get("properties", {}).get(prop_name)
    if not prop or prop.get("type") != "rollup":
        return None

    rollup = prop.get("rollup", {})
    if rollup.get("type") != "array":
        return None

    for item in rollup.get("array", []):
        item_type = item.get("type")

        if item_type == "phone_number":
            value = item.get("phone_number")
            if value:
                return value

        elif item_type == "rich_text":
            rt = item.get("rich_text", [])
            if rt and rt[0].get("plain_text"):
                return rt[0]["plain_text"]

        elif item_type == "title":
            title = item.get("title", [])
            if title and title[0].get("plain_text"):
                return title[0]["plain_text"]

        elif item_type == "formula":
            formula = item.get("formula", {})
            ftype = formula.get("type")
            if ftype == "string" and formula.get("string"):
                return formula["string"]
            if ftype == "number" and formula.get("number") is not None:
                return str(formula["number"])

    return None


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
            "phone":          _extract_rollup_phone(p),
            "start_date":     get_prop(p, "MT Start Date"),
            "schedule":       get_prop(p, "Schedule"),
            "schedule_notes": get_prop(p, "Schedule Notes"),
            "contract_ids":   get_prop(p, "Contracts"),
            "start_shift":    get_prop(p, "Shift Start"),
            "end_shift":      get_prop(p, "Shift End"),
            "status":         status,
        })
    import json
    if pages.index(p) == 0:   # only the first VA, to keep logs short
        print("PHONE PROP:", json.dumps(p["properties"].get("Phone"), indent=2, default=str))

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