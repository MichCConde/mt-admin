"""
EOD report queries for both Main (Agency) and CBA communities.
"""
from datetime import datetime, timedelta
from .core import get_prop, query_all, DB, eod_punctuality


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


def get_eod_for_va(va_name: str, community: str, year: int, month: int) -> list[dict]:
    """All EOD reports for one VA in a given month."""
    pad        = lambda n: str(n).zfill(2)
    start_date = f"{year}-{pad(month)}-01"
    if month < 12:
        last_day = (datetime(year, month + 1, 1) - timedelta(days=1)).day
    else:
        last_day = 31
    end_date = f"{year}-{pad(month)}-{pad(last_day)}"

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