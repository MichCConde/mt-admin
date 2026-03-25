from .client import query_database, prop_text, prop_select, prop_multi_select
from app.config import settings


def va_last_name(full_name: str) -> str:
    parts = full_name.strip().split()
    return parts[-1].lower() if parts else ""


def get_active_vas() -> list[dict]:
    pages = query_database(
        settings.va_db_id,
        filters={"property": "Status", "select": {"equals": "Active"}}
    )
    return [_map_va(p) for p in pages]


def _map_va(page: dict) -> dict:
    """
    ⚠️ Verify property names match your actual Notion VA database columns.
    Key properties expected:
      - Name (title)
      - Status (select)
      - Type (select): "Agency" | "CBA"
      - Community (select)
      - Client (text)
      - Shift Time (rich_text) — e.g. "8:00AM-10:00AM (Andrea)\n10:00AM-12NN (Justin)"
      - Work Days (multi_select) — e.g. ["Monday","Tuesday","Wednesday"]
    """
    name = prop_text(page, "Name")
    return {
        "id":         page["id"],
        "name":       name,
        "last_name":  va_last_name(name),
        "type":       prop_select(page, "Type"),
        "community":  prop_select(page, "Community"),
        "client":     prop_text(page, "Client"),
        "email":      prop_text(page, "Email"),
        "status":     prop_select(page, "Status"),
        "tags":       prop_multi_select(page, "Tags"),
        # Schedule fields
        "shift_time": prop_text(page, "Shift Time"),
        "work_days":  prop_multi_select(page, "Work Days"),
    }