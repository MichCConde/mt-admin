from .client import query_database, prop_text, prop_select, prop_multi_select
from app.config import settings

# ── Helpers ───────────────────────────────────────────────────────────────────

def va_last_name(full_name: str) -> str:
    """Extract last name for attendance matching. Handles 'dela Cruz' etc."""
    parts = full_name.strip().split()
    return parts[-1].lower() if parts else ""


# ── Main query ────────────────────────────────────────────────────────────────

def get_active_vas() -> list[dict]:
    """Return all active VAs from Notion. ~800ms — use Firestore mirror instead."""
    pages = query_database(
        settings.notion_va_db_id,
        filters={"property": "Status", "select": {"equals": "Active"}}
    )
    return [_map_va(p) for p in pages]


def _map_va(page: dict) -> dict:
    """
    Map a raw Notion VA page to a clean dict.
    ⚠️ Verify property names match your actual Notion VA database columns.
    """
    return {
        "id":         page["id"],
        "name":       prop_text(page, "Name"),
        "type":       prop_select(page, "Type"),          # "Agency" | "CBA"
        "community":  prop_select(page, "Community"),
        "client":     prop_text(page, "Client"),
        "email":      prop_text(page, "Email"),
        "status":     prop_select(page, "Status"),
        "tags":       prop_multi_select(page, "Tags"),
        "last_name":  va_last_name(prop_text(page, "Name")),
    }