import re
from app.notion import *


# ── Contracts ─────────────────────────────────────────────────────

def get_all_active_contracts_by_va_id() -> dict:
    pages = query_all(DB["contracts"], {
        "property": "Contract Status",
        "select":   {"equals": "Active"},
    })
    result = {}
    for page in pages:
        va_ids      = get_prop(page, "VA")
        client_name = _get_contract_client(page)          # ← changed
        contract    = {
            "contract_id":   page["id"],
            "client_name":   client_name,
            "contract_name": get_prop(page, "Contract Name"),
        }
        for va_id in va_ids:
            result.setdefault(va_id, []).append(contract)
    return result


def get_active_contract_id_set() -> set:
    """
    Returns a set of page IDs for all Active contracts.
    Used to filter the VA's Contracts relation to active-only.
    """
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
    return {
        page["id"]: {
            "contract_id":   page["id"],
            "client_name":   _get_contract_client(page),  # ← changed
            "contract_name": get_prop(page, "Contract Name"),
        }
        for page in pages
    }


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
            contracts.append({
                "contract_id":   cid,
                "client_name":   _get_contract_client(page),  # ← changed
                "contract_name": get_prop(page, "Contract Name"),
            })
        except Exception:
            continue
    return contracts

# ── Helper: read Client property regardless of trailing space ─────

_UUID_RE = re.compile(r'^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$', re.IGNORECASE)


def _get_contract_client(page: dict) -> str:
    """
    Read the client name from a Contract page.

    Handles multiple property types and edge cases:
    - Text/rich_text: returns the value directly
    - Relation: returns page IDs (not useful) → falls through to Contract Name
    - Rollup (array of title/rich_text): joins the values
    - Rollup (unhandled item types): returns [] → falls through to Contract Name
    - Property name with or without trailing space

    Final fallback: parse client name from Contract Name field,
    which uses the format "PREFIX | Client Name" (e.g. "GJL | Donald Gray").
    """
    # ── Try reading the Client property directly ──────────────────
    val = get_prop(page, "Client ") or get_prop(page, "Client")

    # Flatten lists (from relation or rollup)
    if isinstance(val, list):
        # Filter out page IDs — they aren't human-readable names
        names = [str(v).strip() for v in val if not _UUID_RE.match(str(v).strip())]
        val = " ".join(names).strip() if names else ""
    else:
        val = str(val).strip()

    # If we got a single UUID (relation page ID), discard it
    if val and _UUID_RE.match(val):
        val = ""

    # ── Fallback: extract from Contract Name ──────────────────────
    # Contract Name format: "GJL | Donald Gray" → "Donald Gray"
    if not val:
        cn = get_prop(page, "Contract Name")
        if isinstance(cn, list):
            cn = " ".join(str(v) for v in cn)
        cn = str(cn).strip()
        if "|" in cn:
            val = cn.split("|", 1)[1].strip()

    return val