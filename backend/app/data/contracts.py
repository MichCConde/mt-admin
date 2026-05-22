import re
from app.notion import *


# ── Contracts ─────────────────────────────────────────────────────

def _build_contract(page: dict) -> dict:
    """Build the standard contract dict from a Notion page."""
    return {
        "contract_id":          page["id"],
        "client_name":          _get_contract_client(page),
        "client_id":            _get_contract_client_id(page),
        "contract_name":        get_prop(page, "Contract Name"),
        "start_shift":          get_prop(page, "Shift Start"),
        "end_shift":            get_prop(page, "Shift End"),
        "package":              get_prop(page, "Package"),
        "is_project_based":     get_prop(page, "Package") == "Project-based",
        "status":               get_prop(page, "Contract Status"),
        "start_date":           get_prop(page, "Start Date"),
        "paused_date":          get_prop(page, "Paused Date"),
        "end_date":             get_prop(page, "End Date"),
        "va_hours_daily":       get_prop(page, "VA Hours (Daily)"),
    }


def get_all_active_contracts_by_va_id() -> dict:
    pages = query_all(DB["contracts"], {
        "property": "Contract Status",
        "select":   {"equals": "Active"},
    })
    result = {}
    for page in pages:
        va_ids   = get_prop(page, "VA")
        contract = _build_contract(page)
        for va_id in va_ids:
            result.setdefault(va_id, []).append(contract)
    return result


def get_active_contract_id_set() -> set:
    """Returns a set of page IDs for all Active contracts."""
    pages = query_all(DB["contracts"], {
        "property": "Contract Status",
        "select":   {"equals": "Active"},
    })
    return {page["id"] for page in pages}


def get_active_contracts_by_id() -> dict:
    pages = query_all(DB["contracts"], {
        "property": "Contract Status",
        "select":   {"equals": "Active"},
    })
    return {page["id"]: _build_contract(page) for page in pages}


def get_active_contracts_for_va(contract_ids: list) -> list:
    if not contract_ids:
        return []
    contracts = []
    for cid in contract_ids:
        try:
            page   = notion.pages.retrieve(page_id=cid)
            status = get_prop(page, "Contract Status")
            if status != "Active":
                continue
            contracts.append(_build_contract(page))
        except Exception:
            continue
    return contracts


def get_all_contracts() -> list:
    """
    Returns ALL contracts across every status.
    Used by /api/dashboard for weekly activity metrics
    (counts of Paused, Ended, Draft, etc.).
    """
    all_pages = []
    for status in ["Active", "Paused", "Ended", "Draft"]:
        pages = query_all(DB["contracts"], {
            "property": "Contract Status",
            "select":   {"equals": status},
        })
        all_pages.extend(pages)
    return [_build_contract(page) for page in all_pages]

# ── Helpers: read Client property regardless of trailing space ────

_UUID_RE = re.compile(r'^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$', re.IGNORECASE)


def _get_contract_client(page: dict) -> str:
    """Read the client name from a Contract page. (Same as before.)"""
    val = get_prop(page, "Client ") or get_prop(page, "Client")

    if isinstance(val, list):
        names = [str(v).strip() for v in val if not _UUID_RE.match(str(v).strip())]
        val = " ".join(names).strip() if names else ""
    else:
        val = str(val).strip()

    if val and _UUID_RE.match(val):
        val = ""

    if not val:
        cn = get_prop(page, "Contract Name")
        if isinstance(cn, list):
            cn = " ".join(str(v) for v in cn)
        cn = str(cn).strip()
        if "|" in cn:
            val = cn.split("|", 1)[1].strip()

    return val


def _get_contract_client_id(page: dict) -> str | None:
    """
    Return the Notion page ID of the linked Client, or None.
    The Client relation can include both names and UUIDs in the same list;
    we want the UUID side so we can look up email/company in the Clients DB.
    """
    val = get_prop(page, "Client ") or get_prop(page, "Client")
    if isinstance(val, list):
        for v in val:
            s = str(v).strip()
            if _UUID_RE.match(s):
                return s
    elif isinstance(val, str):
        s = val.strip()
        if _UUID_RE.match(s):
            return s
    return None