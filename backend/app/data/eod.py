from datetime import datetime, timedelta
from app.notion import *

# ── Punctuality helpers ───────────────────────────────────────────

def eod_punctuality(submitted_at: str, time_out_str: str) -> dict:
    submitted_est = to_est(submitted_at)

    parsed = parse_time_str(time_out_str)
    if parsed:
        cutoff_h, cutoff_m = parsed
    else:
        cutoff_h, cutoff_m = EOD_CUTOFF_HOUR, 0

    cutoff         = submitted_est.replace(hour=cutoff_h, minute=cutoff_m, second=0, microsecond=0)
    late_deadline   = cutoff + timedelta(minutes=GRACE_MINUTES)
    early_boundary  = cutoff - timedelta(minutes=GRACE_MINUTES)

    if submitted_est < early_boundary:
        mins = int((early_boundary - submitted_est).total_seconds() / 60)
        status, on_time, m_late, m_early = "early", False, 0, mins
    elif submitted_est > late_deadline:
        mins = int((submitted_est - late_deadline).total_seconds() / 60)
        status, on_time, m_late, m_early = "late", False, mins, 0
    else:
        status, on_time, m_late, m_early = "on_time", True, 0, 0

    return {
        "on_time":       on_time,
        "status":        status,
        "submitted_est": submitted_est.strftime("%I:%M %p EST"),
        "expected_by":   cutoff.strftime("%I:%M %p EST"),
        "minutes_late":  m_late,
        "minutes_early": m_early,
    }

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
    """Fetch all EOD reports for a specific VA in a given month, including text fields for EOM."""
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

        # Text fields shared by both communities
        r["daily_summary"] = get_prop(p, "Daily Summary").strip()

        if community == "Main":
            r["task_completed"] = get_prop(p, "Task Completed").strip()
        elif community == "CBA":
            r.update({
                "new_leads":        get_prop(p, "New Leads Sourced:"),
                "email_apps":       get_prop(p, "Email Applications Sent:"),
                "website_apps":     get_prop(p, "Website Applications Sent:"),
                "follow_ups":       get_prop(p, "Follow Ups Completed:"),
                "total_responses":  get_prop(p, "Total Responses From Loads/Routes Today (attach company name):").strip(),
                "other_admin":      get_prop(p, "Other Admin Tasks Completed:").strip(),
            })

        results.append(r)

    return sorted(results, key=lambda r: r["date"])

