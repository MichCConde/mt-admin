from datetime import datetime
from typing import Optional
from app.notion import *

# ── VA Database ───────────────────────────────────────────────────

ACTIVE_STATUSES       = {"Active"}
SCHEDULABLE_STATUSES  = {"Active", "Paused"}
ACTIVE_EMP_STATUSES   = {"Employee"}
ALLOWED_TEAMS         = {"VA Team"}
EXCLUDED_TEAMS        = {"Internal", "Project Based"}

_va_cache = {
    "active":             {"data": None, "expires": 0.0},
    "active_and_paused":  {"data": None, "expires": 0.0},
}


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


def get_active_vas_cached(include_paused: bool = False) -> list:
    """Cached wrapper for `get_active_vas`.

    Args:
        include_paused: If True, returns Active + Paused VAs (used by the
                        Schedule endpoint). Default False keeps the existing
                        Active-only behavior for reports.
    """
    import time
    now = time.time()
    cache_key   = "active_and_paused" if include_paused else "active"
    cache_entry = _va_cache[cache_key]

    if cache_entry["data"] and now < cache_entry["expires"]:
        return cache_entry["data"]

    result = get_active_vas(include_paused=include_paused)
    cache_entry["data"]    = result
    cache_entry["expires"] = now + 300
    return result


def get_active_vas(include_paused: bool = False) -> list:
    """Fetch VAs from the Notion VA database.

    By default returns only VAs whose Status is "Active" (used by EOW/EOM
    reports). Pass `include_paused=True` to also include VAs whose Status
    is "Paused" — needed by the Schedule dashboard to surface VAs available
    for new client deployment.
    """
    # Build the Notion-side status filter
    if include_paused:
        status_filter = {
            "or": [
                {"property": "Status", "select": {"equals": "Active"}},
                {"property": "Status", "select": {"equals": "Paused"}},
            ]
        }
        allowed_statuses = SCHEDULABLE_STATUSES
    else:
        status_filter    = {"property": "Status", "select": {"equals": "Active"}}
        allowed_statuses = ACTIVE_STATUSES

    pages = query_all(DB["va"], {
        "and": [
            status_filter,
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
        if status     not in allowed_statuses:          continue
        if emp_status not in ACTIVE_EMP_STATUSES:       continue
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
            "status":         get_prop(p, "Status"),
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
