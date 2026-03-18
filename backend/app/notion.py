from notion_client import Client
from datetime import datetime, timedelta, timezone
import os, re
from dotenv import load_dotenv

load_dotenv()

notion = Client(auth=os.getenv("NOTION_TOKEN"))

DB = {
    "va":         os.getenv("VA_DB_ID"),
    "eod_main":   os.getenv("EOD_MAIN_DB_ID"),
    "eod_cba":    os.getenv("EOD_CBA_DB_ID"),
    "attendance": os.getenv("ATTENDANCE_DB_ID"),
    "contracts":  os.getenv("CONTRACTS_DB_ID"),
}

EST            = timezone(timedelta(hours=-5))
PHT            = timezone(timedelta(hours=+8))
GRACE_MINUTES  = 15    # grace period before marking late
EOD_CUTOFF_HOUR = 18   # fallback EOD cutoff: 6 PM EST

# ── Timezone notes ────────────────────────────────────────────────
# Notion API always returns created_time / last_edited_time in UTC.
# The Notion workspace UI displays these in PHT (UTC+8) for PH-based users.
# We always convert UTC → EST (UTC-5) for display in this app.
# Text fields (Time In, Time Out, Shift Time) are typed by VAs in EST
# (client's timezone) per EOD form instructions — no conversion needed.


# ── Property extractor ────────────────────────────────────────────

def get_prop(page: dict, name: str):
    p = page.get("properties", {}).get(name)
    if not p:
        return ""
    t = p.get("type")
    if t == "title":       return "".join(r["plain_text"] for r in p.get("title", []))
    if t == "rich_text":   return "".join(r["plain_text"] for r in p.get("rich_text", []))
    if t == "select":      return p["select"]["name"] if p.get("select") else ""
    if t == "multi_select":return [o["name"] for o in p.get("multi_select", [])]
    if t == "date":        return p["date"]["start"] if p.get("date") else ""
    if t == "created_time":return p.get("created_time", "")
    if t == "number":      return p.get("number") or 0
    if t == "email":       return p.get("email", "")
    if t == "relation":    return [r["id"] for r in p.get("relation", [])]
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


# ── Time-string parser ────────────────────────────────────────────

def parse_time_str(time_str: str) -> tuple[int, int] | None:
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
    """
    EOD report punctuality.
    Expected submission: around Time Out (from the EOD form).
    Actual:             Submission time (created_time on the Notion page).
    Grace period:       GRACE_MINUTES after Time Out.
    Falls back to EOD_CUTOFF_HOUR (6 PM) if Time Out can't be parsed.
    """
    submitted_est = to_est(submitted_at)

    parsed = parse_time_str(time_out_str)
    if parsed:
        cutoff_h, cutoff_m = parsed
    else:
        cutoff_h, cutoff_m = EOD_CUTOFF_HOUR, 0

    cutoff  = submitted_est.replace(hour=cutoff_h, minute=cutoff_m, second=0, microsecond=0)
    deadline = cutoff + timedelta(minutes=GRACE_MINUTES)
    on_time  = submitted_est <= deadline
    minutes_late = max(0, int((submitted_est - deadline).total_seconds() / 60))

    return {
        "on_time":        on_time,
        "submitted_est":  submitted_est.strftime("%I:%M %p EST"),
        "expected_by":    deadline.strftime("%I:%M %p EST"),
        "minutes_late":   minutes_late if not on_time else 0,
    }


def clock_in_punctuality(created_at: str, time_in_str: str) -> dict:
    """
    Attendance punctuality.
    Expected clock-in: Time In from the VA's EOD report (or shift schedule).
    Actual:            Created time of the attendance record.
    Grace period:      GRACE_MINUTES after scheduled Time In.
    """
    clocked_est = to_est(created_at)

    parsed = parse_time_str(time_in_str)
    if parsed:
        cutoff_h, cutoff_m = parsed
    else:
        cutoff_h, cutoff_m = 9, 0  # fallback: 9:00 AM EST

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


# ── VA Database ───────────────────────────────────────────────────

ACTIVE_STATUSES     = {"Active"}
ACTIVE_EMP_STATUSES = {"Employee"}
ALLOWED_TEAMS       = {"VA Team"}
EXCLUDED_TEAMS      = {"Internal", "Project Based"}   # never show these

def get_active_vas() -> list[dict]:
    """
    Returns Active + Employee + VA Team VAs only.
    Internal and Project Based team members are always excluded.
    Filters applied at Notion API level AND Python level for safety.
    """
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
        teams      = get_prop(p, "Team")   # list of strings

        # Python-level safety guards
        if not name:                                            continue
        if status      not in ACTIVE_STATUSES:                 continue
        if emp_status  not in ACTIVE_EMP_STATUSES:             continue
        if not any(t in ALLOWED_TEAMS for t in teams):         continue
        if any(t in EXCLUDED_TEAMS for t in teams):            continue

        vas.append({
            "id":           p["id"],
            "name":         name,
            "community":    get_prop(p, "Community "),   # trailing space intentional
            "email":        get_prop(p, "MT Email Address"),
            "schedule":     get_prop(p, "Schedule"),       # "Mon - Fri" / "Mon - Sun" / "Flexible"
            "shift_time":   get_prop(p, "Shift Time"),     # freeform EST text
            "schedule_notes": get_prop(p, "Schedule Notes"),
            "contract_ids": get_prop(p, "Contracts"),
            "status":       status,
        })

    return sorted(vas, key=lambda v: v["name"])


# ── Contracts ─────────────────────────────────────────────────────

def get_active_contracts_for_va(contract_ids: list[str]) -> list[dict]:
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

def get_attendance_for_date(date_str: str) -> list[dict]:
    utc_start, utc_end = est_day_bounds(date_str)
    pages = query_all(DB["attendance"], {
        "and": [
            {"timestamp": "created_time", "created_time": {"on_or_after": utc_start}},
            {"timestamp": "created_time", "created_time": {"before":      utc_end}},
        ]
    })
    return [
        {
            "id":           p["id"],
            "raw_name":     get_prop(p, "Name"),
            "type":         get_prop(p, "Type"),
            "created_time": p["created_time"],
            "notes":        get_prop(p, "Clock In Notes"),
        }
        for p in pages
    ]


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
        # Punctuality based on Time Out field vs actual submission time
        "punctuality":  eod_punctuality(page["created_time"], time_out),
    }


def get_eod_main_for_date(date_str: str) -> list[dict]:
    pages = query_all(DB["eod_main"], {"property": "Date", "date": {"equals": date_str}})
    return [_map_eod(p, "Main") for p in pages]


def get_eod_cba_for_date(date_str: str) -> list[dict]:
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
                   year: int, month: int) -> list[dict]:
    """Fetch all EOD reports for a specific VA in a given month."""
    pad       = lambda n: str(n).padStart(2, "0") if False else str(n).zfill(2)
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