"""
Contracts DB queries.
Queries ALL active contracts in one call, groups by VA ID.
"""
from .core import get_prop, query_all, DB, notion


def get_all_active_contracts_by_va_id() -> dict[str, list[dict]]:
    pages = query_all(DB["contracts"], {
        "property": "Contract Status",
        "select":   {"equals": "Active"},
    })

    result: dict[str, list[dict]] = {}
    for page in pages:
        va_ids      = get_prop(page, "VA")              # relation → list of VA page IDs
        client_name = get_prop(page, "Client ").strip() # ← trailing space — matches Notion
        contract = {
            "contract_id":   page["id"],
            "client_name":   client_name,
            "contract_name": get_prop(page, "Contract Name"),
        }
        for va_id in va_ids:
            result.setdefault(va_id, []).append(contract)

    return result


def get_active_contracts_for_va(contract_ids: list[str]) -> list[dict]:
    """Legacy per-VA lookup. Use get_all_active_contracts_by_va_id() for bulk."""
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
                "client_name":   get_prop(page, "Client ").strip(),
                "contract_name": get_prop(page, "Contract Name"),
            })
        except Exception:
            continue
    return contracts