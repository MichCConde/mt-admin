from notion_client import Client
from datetime import datetime, timedelta, timezone
import os
from dotenv import load_dotenv

load_dotenv()

notion = Client(auth=os.getenv("NOTION_TOKEN"))

DB = {
    "va":         os.getenv("VA_DB_ID"),
    "eod_main":   os.getenv("EOD_MAIN_DB_ID"),
    "eod_cba":    os.getenv("EOD_CBA_DB_ID"),
    "attendance": os.getenv("ATTENDANCE_DB_ID"),
}


# ── Helpers ──────────────────────────────────────────────────────

def get_prop(page: dict, name: str):
    """Safely extract any Notion property value."""
    p = page.get("properties", {}).get(name)
    if not p:
        return ""
    t = p.get("type")
    if t == "title":
        return "".join(r["plain_text"] for r in p["title"])
    if t == "rich_text":
        return "".join(r["plain_text"] for r in p["rich_text"])
    if t == "select":
        return p["select"]["name"] if p["select"] else ""
    if t == "multi_select":
        return [o["name"] for o in p["multi_select"]]
    if t == "date":
        return p["date"]["start"] if p["date"] else ""
    if t == "created_time":
        return p["created_time"]
    if t == "number":
        return p["number"] or 0
    if t == "email":
        return p["email"] or ""
    return ""


def query_all(database_id: str, filter_obj: dict = None) -> list:
    """Paginate through all Notion results (max 100 per request)."""
    results = []
    cursor = None
    while True:
        kwargs = {"database_id": database_id, "page_size": 100}
        if filter_obj:
            kwargs["filter"] = filter_obj
        if cursor:
            kwargs["start_cursor"] = cursor
        res = notion.databases.query(**kwargs)
        results.extend(res["results"])
        if not res.get("has_more"):
            break
        cursor = res["next_cursor"]
    return results


# ── EST date helpers ─────────────────────────────────────────────

def est_day_bounds(date_str: str) -> tuple[str, str]:
    """Return UTC ISO strings for the start and end of a given EST date."""
    est = timezone(timedelta(hours=-5))
    start = datetime.fromisoformat(f"{date_str}T00:00:00").replace(tzinfo=est)
    end   = start + timedelta(days=1)
    return start.astimezone(timezone.utc).isoformat(), end.astimezone(timezone.utc).isoformat()


# ── VA Database ──────────────────────────────────────────────────

def get_active_vas() -> list[dict]:
    pages = query_all(DB["va"], {
        "and": [
            {"property": "Status",     "select":     {"equals": "Active"}},
            {"property": "Emp Status", "select":     {"equals": "Employee"}},
            {"property": "Team",       "multi_select": {"contains": "VA Team"}},
        ]
    })
    return [
        {
            "id":        p["id"],
            "name":      get_prop(p, "Name"),
            "community": get_prop(p, "Community "),  # trailing space is intentional
            "email":     get_prop(p, "MT Email Address"),
            "schedule":  get_prop(p, "Schedule"),
        }
        for p in pages
        if get_prop(p, "Name")
    ]


# ── Attendance Database ──────────────────────────────────────────

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


# ── EOD Databases ────────────────────────────────────────────────

def get_eod_for_date(date_str: str) -> list[dict]:
    f = {"property": "Date", "date": {"equals": date_str}}
    main_pages = query_all(DB["eod_main"], f)
    cba_pages  = query_all(DB["eod_cba"],  f)

    def map_report(p, community):
        return {
            "id":           p["id"],
            "name":         get_prop(p, "Name"),
            "date":         get_prop(p, "Date"),
            "client":       get_prop(p, "Client"),
            "time_in":      get_prop(p, "Time In"),
            "time_out":     get_prop(p, "Time Out"),
            "community":    community,
            "submitted_at": p["created_time"],
        }

    return (
        [map_report(p, "Main") for p in main_pages] +
        [map_report(p, "CBA")  for p in cba_pages]
    )