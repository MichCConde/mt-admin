import re
from .client import query_database, prop_text, prop_select
from app.config import settings


# ── Public API ────────────────────────────────────────────────────────────────

def get_attendance_for_date(date_str: str) -> list[dict]:
    """
    Attendance has no separate Date property — filter by created_time.
    date_str format: "YYYY-MM-DD"
    """
    pages = query_database(
        settings.attendance_db_id,
        filters={
            "and": [
                {"timestamp": "created_time", "created_time": {"on_or_after": f"{date_str}T00:00:00Z"}},
                {"timestamp": "created_time", "created_time": {"before":     f"{date_str}T23:59:59Z"}},
            ]
        }
    )
    return [_map_attendance(p) for p in pages]


def get_attendance_for_range(start: str, end: str) -> list[dict]:
    """Batch fetch for EOW — replaces 6 separate date queries."""
    pages = query_database(
        settings.attendance_db_id,
        filters={
            "and": [
                {"timestamp": "created_time", "created_time": {"on_or_after": f"{start}T00:00:00Z"}},
                {"timestamp": "created_time", "created_time": {"before":      f"{end}T23:59:59Z"}},
            ]
        }
    )
    return [_map_attendance(p) for p in pages]


# ── Internal ──────────────────────────────────────────────────────────────────

# Matches "IN Conde, December 3, 2025" or "OUT dela Cruz, March 20, 2026"
_NAME_RE = re.compile(r"^(IN|OUT)\s+([^,]+),", re.IGNORECASE)


def _extract_last_name(raw_title: str) -> str:
    m = _NAME_RE.match(raw_title.strip())
    if not m:
        return ""
    name_part = m.group(2).strip()   # e.g. "Conde" or "dela Cruz"
    return name_part.split()[-1].lower()


def _map_attendance(page: dict) -> dict:
    # The title property is called "Name & Date"
    title = prop_text(page, "Name & Date") or prop_text(page, "Name") or ""
    clock_type = "IN" if title.upper().startswith("IN") else "OUT"
    return {
        "id":         page["id"],
        "raw_title":  title,
        "last_name":  _extract_last_name(title),
        "clock":      clock_type,
        "date":       page.get("created_time", "")[:10],  # "YYYY-MM-DD"
        "time":       page.get("created_time", "")[11:16], # "HH:MM"
        "created_at": page.get("created_time", ""),
    }