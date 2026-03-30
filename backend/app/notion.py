from notion_client import Client
from datetime import datetime, timedelta, timezone
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

EST             = timezone(timedelta(hours=-5))
PHT             = timezone(timedelta(hours=+8))
GRACE_MINUTES   = 15
EOD_CUTOFF_HOUR = 18

# ── Timezone notes ────────────────────────────────────────────────
# Notion API always returns created_time / last_edited_time in UTC.
# The Notion workspace UI displays these in PHT (UTC+8) for PH-based users.
# We always convert UTC -> EST (UTC-5) for display in this app.
# Text fields (Time In, Time Out, Shift Time) are typed by VAs in EST.


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
    """
    Parse a freeform time string like '9:00 AM EST', '17:00', '5PM'
    into (hour_24, minute). Returns None if unparseable.
    """
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


# ── Punctuality helpers ───────────────────────────────────────────

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


# ── Contracts ─────────────────────────────────────────────────────

def get_all_active_contracts_by_va_id() -> dict:
    """
    Query ALL active contracts grouped by VA page ID.
    Used for EOD matching. Do NOT use for client count — use
    len(va["contract_ids"]) from the VA DB instead.
    """
    pages = query_all(DB["contracts"], {
        "property": "Contract Status",
        "select":   {"equals": "Active"},
    })

    result = {}
    for page in pages:
        va_ids      = get_prop(page, "VA")
        client_name = get_prop(page, "Client ").strip()
        contract    = {
            "contract_id":   page["id"],
            "client_name":   client_name,
            "contract_name": get_prop(page, "Contract Name"),
        }
        for va_id in va_ids:
            result.setdefault(va_id, []).append(contract)

    return result


def get_active_contract_id_set() -> set:
    """
    Returns a set of page IDs for all Active contracts.
    Used to filter the VA's Contracts relation to active-only.
    """
    pages = query_all(DB["contracts"], {
        "property": "Contract Status",
        "select":   {"equals": "Active"},
    })
    return {page["id"] for page in pages}


def get_active_contracts_by_id() -> dict:
    """
    Returns a dict keyed by contract page ID for all Active contracts.
    Used in list_vas to resolve client names from the VA's own
    Contracts relation field.
    """
    pages = query_all(DB["contracts"], {
        "property": "Contract Status",
        "select":   {"equals": "Active"},
    })
    return {
        page["id"]: {
            "contract_id":   page["id"],
            "client_name":   get_prop(page, "Client ").strip(),
            "contract_name": get_prop(page, "Contract Name"),
        }
        for page in pages
    }


def get_active_contracts_for_va(contract_ids: list) -> list:
    """Legacy per-VA lookup. Prefer get_all_active_contracts_by_va_id() for bulk use."""
    if not contract_ids:
        return []
    contracts = []
    for cid in contract_ids:
        try:
            page   = notion.pages.retrieve(page_id=cid)
            status = get_prop(page, "Contract Status")
            if status != "Active":
                continue
            contracts.append({
                "contract_id":   cid,
                "client_name":   get_prop(page, "Client ").strip(),
                "contract_name": get_prop(page, "Contract Name"),
            })
        except Exception:
            continue
    return contracts


# ── Attendance ────────────────────────────────────────────────────

def match_client_name(typed: str, actual: str) -> tuple:
    """
    Match a VA-typed client name against the actual contract client name.
    Returns (is_match, needs_verification).

    Exact match            -> (True, False)
    actual.startswith(typed) -> (True, True)   fuzzy, needs review
    No match               -> (False, False)
    """
    t = typed.strip().lower()
    a = actual.strip().lower()
    if not t:
        return False, False
    if t == a:
        return True, False
    if a.startswith(t):
        return True, True
    return False, False


def parse_attendance_name(raw_name: str) -> tuple:
    """
    Parses attendance title into (full_name, last_name) handling both formats:

    New format: "[Full Name], [Date]"
      "Maria Conde, March 20, 2026"    -> ("maria conde", "conde")
      "Juan dela Cruz, March 20, 2026" -> ("juan dela cruz", "cruz")

    Old format (backward compat): "IN [Last Name], [Date]"
      "IN Conde, March 20, 2026"       -> ("conde", "conde")
      "OUT Reyes, March 20, 2026"      -> ("reyes", "reyes")
    """
    before_comma = raw_name.split(",")[0].strip()

    # Detect old format — first word is IN or OUT
    parts = before_comma.split(None, 1)
    if parts and parts[0].upper() in ("IN", "OUT") and len(parts) == 2:
        last = parts[1].strip().lower()
        return last, last

    # New format — full name before the comma
    full = before_comma.lower()
    last = full.split()[-1] if full else ""
    return full, last


def get_attendance_for_date(date_str: str) -> list:
    """
    Fetch all clock-in records for a given EST date.
    All records are clock-ins — no Type field needed.
    Returns both full_name and last_name to support old + new record formats.
    """
    utc_start, utc_end = est_day_bounds(date_str)
    pages = query_all(DB["attendance"], {
        "and": [
            {"timestamp": "created_time", "created_time": {"on_or_after": utc_start}},
            {"timestamp": "created_time", "created_time": {"before":      utc_end}},
        ]
    })
    records = []
    for p in pages:
        raw        = get_prop(p, "Name")
        full, last = parse_attendance_name(raw)
        records.append({
            "id":           p["id"],
            "raw_name":     raw,
            "full_name":    full,
            "last_name":    last,
            "client":       get_prop(p, "Client").strip(),
            "created_time": p["created_time"],
            "notes":        get_prop(p, "Clock In Notes"),
        })
    return records


# ── EOD — shared mapper ───────────────────────────────────────────

def _map_eod(page: dict, community: str) -> dict:
    time_out = get_prop(page, "Time Out")
    return {
        "id":           page["id"],
        "name":         get_prop(page, "Name").strip(),
        "date":         get_prop(page, "Date"),
        "client":       get_prop(page, "Client").strip(),
        "time_in":      get_prop(page, "Time In"),
        "time_out":     time_out,
        "community":    community,
        "submitted_at": page["created_time"],
        "punctuality":  eod_punctuality(page["created_time"], time_out),
    }


def get_eod_main_for_date(date_str: str) -> list:
    pages = query_all(DB["eod_main"], {"property": "Date", "date": {"equals": date_str}})
    return [_map_eod(p, "Main") for p in pages]


def get_eod_cba_for_date(date_str: str) -> list:
    pages = query_all(DB["eod_cba"], {"property": "Date", "date": {"equals": date_str}})
    reports = []
    for p in pages:
        r = _map_eod(p, "CBA")
        r.update({
            "new_leads":    get_prop(p, "New Leads Sourced:"),
            "email_apps":   get_prop(p, "Email Applications Sent:"),
            "website_apps": get_prop(p, "Website Applications Sent:"),
            "follow_ups":   get_prop(p, "Follow Ups Completed:"),
        })
        reports.append(r)
    return reports


# ── VA Inspector — all reports for one VA ─────────────────────────

def get_eod_for_va(va_name: str, community: str,
                   year: int, month: int) -> list:
    """Fetch all EOD reports for a specific VA in a given month."""
    pad        = lambda n: str(n).zfill(2)
    start_date = f"{year}-{pad(month)}-01"
    last_day   = (datetime(year, month % 12 + 1, 1) - timedelta(days=1)).day if month < 12 \
                 else 31
    end_date   = f"{year}-{pad(month)}-{pad(last_day)}"

    f = {
        "and": [
            {"property": "Name", "rich_text": {"contains": va_name}},
            {"property": "Date", "date":      {"on_or_after":  start_date}},
            {"property": "Date", "date":      {"on_or_before": end_date}},
        ]
    }

    db_id = DB["eod_cba"] if community == "CBA" else DB["eod_main"]
    pages = query_all(db_id, f)

    results = []
    for p in pages:
        r = _map_eod(p, community)
        if community == "CBA":
            r.update({
                "new_leads":    get_prop(p, "New Leads Sourced:"),
                "email_apps":   get_prop(p, "Email Applications Sent:"),
                "website_apps": get_prop(p, "Website Applications Sent:"),
                "follow_ups":   get_prop(p, "Follow Ups Completed:"),
            })
        results.append(r)

    return sorted(results, key=lambda r: r["date"])