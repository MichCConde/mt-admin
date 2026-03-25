import re
from .client import query_database, prop_text, prop_select
from app.config import settings


# ── Public API ────────────────────────────────────────────────────────────────

def get_attendance_for_date(date_str: str) -> list[dict]:
    pages = query_database(
        settings.notion_attendance_db_id,
        filters={"property": "Date", "date": {"equals": date_str}}
    )
    return [_map_attendance(p) for p in pages]


def get_attendance_for_range(start: str, end: str) -> list[dict]:
    """Batch fetch for EOW — replaces 6 separate date queries."""
    pages = query_database(
        settings.notion_attendance_db_id,
        filters={
            "and": [
                {"property": "Date", "date": {"on_or_after": start}},
                {"property": "Date", "date": {"on_or_before": end}},
            ]
        }
    )
    return [_map_attendance(p) for p in pages]


# ── Internal ──────────────────────────────────────────────────────────────────

# Matches "IN Conde, March 20, 2026" or "OUT Dela Cruz, March 20, 2026"
_NAME_RE = re.compile(r"^(IN|OUT)\s+([^,]+),", re.IGNORECASE)


def _extract_last_name(raw_title: str) -> str:
    m = _NAME_RE.match(raw_title.strip())
    if not m:
        return ""
    # raw name part is "Conde" or "dela Cruz" etc.
    name_part = m.group(2).strip()
    return name_part.split()[-1].lower()


def _map_attendance(page: dict) -> dict:
    title     = prop_text(page, "Name")   # e.g. "IN Conde, March 20, 2026"
    clock_type = "IN" if title.upper().startswith("IN") else "OUT"
    return {
        "id":        page["id"],
        "raw_title": title,
        "last_name": _extract_last_name(title),
        "clock":     clock_type,
        "date":      prop_text(page, "Date"),
        "time":      prop_text(page, "Time"),
        "status":    prop_select(page, "Status"),
        "created_at": page.get("created_time", ""),
    }