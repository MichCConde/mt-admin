import requests
from app.config import settings

_VERSION = "2022-06-28"
_BASE    = "https://api.notion.com/v1"


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.notion_token}",
        "Notion-Version": _VERSION,
        "Content-Type": "application/json",
    }


def query_database(db_id: str, filters: dict = None, page_size: int = 100) -> list:
    """Query a Notion database, handling pagination automatically."""
    url     = f"{_BASE}/databases/{db_id}/query"
    payload = {"page_size": page_size}
    if filters:
        payload["filter"] = filters

    results = []
    while True:
        res = requests.post(url, headers=_headers(), json=payload, timeout=15)
        res.raise_for_status()
        data = res.json()
        results.extend(data.get("results", []))
        if not data.get("has_more"):
            break
        payload["start_cursor"] = data["next_cursor"]
    return results


def get_database_meta(db_id: str) -> dict:
    """Lightweight health check — just retrieves DB metadata."""
    res = requests.get(f"{_BASE}/databases/{db_id}", headers=_headers(), timeout=10)
    res.raise_for_status()
    return res.json()


# ── Property helpers ──────────────────────────────────────────────────────────

def prop_text(page: dict, key: str) -> str:
    prop = page.get("properties", {}).get(key, {})
    ptype = prop.get("type")
    if ptype == "title":
        return "".join(t["plain_text"] for t in prop.get("title", []))
    if ptype == "rich_text":
        return "".join(t["plain_text"] for t in prop.get("rich_text", []))
    return ""


def prop_select(page: dict, key: str) -> str:
    s = page.get("properties", {}).get(key, {}).get("select")
    return s["name"] if s else ""


def prop_multi_select(page: dict, key: str) -> list[str]:
    items = page.get("properties", {}).get(key, {}).get("multi_select", [])
    return [i["name"] for i in items]


def prop_date(page: dict, key: str) -> str:
    d = page.get("properties", {}).get(key, {}).get("date")
    return d["start"] if d else ""


def prop_number(page: dict, key: str) -> float | None:
    return page.get("properties", {}).get(key, {}).get("number")


def prop_checkbox(page: dict, key: str) -> bool:
    return page.get("properties", {}).get(key, {}).get("checkbox", False)