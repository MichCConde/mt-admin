import hashlib
from .client import query_database, prop_text, prop_select, prop_date, prop_number
from app.config import settings


# ── Public API ────────────────────────────────────────────────────────────────

def get_eod_main_for_date(date_str: str) -> list[dict]:
    return _query_eod(settings.notion_eod_main_db_id, date_str)

def get_eod_cba_for_date(date_str: str) -> list[dict]:
    return _query_eod(settings.notion_eod_cba_db_id, date_str)

def get_eod_main_for_range(start: str, end: str) -> list[dict]:
    return _query_eod_range(settings.notion_eod_main_db_id, start, end)

def get_eod_cba_for_range(start: str, end: str) -> list[dict]:
    return _query_eod_range(settings.notion_eod_cba_db_id, start, end)


# ── Internal ──────────────────────────────────────────────────────────────────

def _query_eod(db_id: str, date_str: str) -> list[dict]:
    pages = query_database(db_id, filters={
        "property": "Date",
        "date": {"equals": date_str}
    })
    return [_map_eod(p) for p in pages]


def _query_eod_range(db_id: str, start: str, end: str) -> list[dict]:
    """Batch fetch for EOW — 1 call instead of 6 separate date queries."""
    pages = query_database(db_id, filters={
        "and": [
            {"property": "Date", "date": {"on_or_after": start}},
            {"property": "Date", "date": {"on_or_before": end}},
        ]
    })
    return [_map_eod(p) for p in pages]


def _map_eod(page: dict) -> dict:
    """
    Map raw Notion EOD page to a clean dict.
    ⚠️ Verify property names match your actual Notion EOD database columns.
    """
    name    = prop_text(page, "Name")
    content = prop_text(page, "Report")        # free-text report body
    return {
        "id":           page["id"],
        "name":         name,
        "name_lower":   name.lower().strip(),
        "date":         prop_date(page, "Date"),
        "time_in":      prop_text(page, "Time In"),
        "time_out":     prop_text(page, "Time Out"),
        "report":       content,
        "content_hash": hashlib.md5(content.strip().lower().encode()).hexdigest(),
        # CBA-specific fields (None for Agency VAs)
        "leads":        prop_number(page, "Leads"),
        "email_apps":   prop_number(page, "Email Applications"),
        "status":       prop_select(page, "Status"),
        "created_at":   page.get("created_time", ""),
    }