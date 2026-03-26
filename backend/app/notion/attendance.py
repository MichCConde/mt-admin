"""
Attendance DB queries.
Attendance records have a "Type" property (IN/OUT) — not parsed from title.
Last name is parsed from the title: "IN [Last Name], [Date]"
"""
import re
from .core import get_prop, query_all, DB, est_day_bounds


def _parse_last_name(raw_name: str) -> str:
    """
    "IN Conde, March 20, 2026"  → "conde"
    "OUT dela Cruz, March 20"   → "dela cruz"
    """
    clean     = re.sub(r'^(IN|OUT)\s+', '', raw_name.strip(), flags=re.IGNORECASE)
    last_name = clean.split(',')[0].strip()
    return last_name.lower()


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
            "last_name":    _parse_last_name(get_prop(p, "Name")),
            "type":         get_prop(p, "Type"),   # "IN" or "OUT" — Notion property
            "created_time": p["created_time"],
            "notes":        get_prop(p, "Clock In Notes"),
        }
        for p in pages
    ]