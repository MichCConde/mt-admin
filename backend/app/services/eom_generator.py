"""
Orchestrator for EOM report generation.

generate_eom_reports_for_va(va_name, year, month) does the full pipeline:
  1. Resolve the VA + their active contracts
  2. Fetch client metadata from the Clients DB
  3. Fetch the VA's EOD reports for the month
  4. For each VA-client pairing: call Claude → publish Notion page
  5. Return a structured result with per-client pages + errors
"""
from __future__ import annotations
import calendar
from datetime import date

from app.notion import get_active_vas, get_eod_for_va, match_client_name
from app.data.contracts import get_active_contracts_by_id
from app.data import get_all_clients, _norm_id
from app.services.ai import generate_with_cache
from app.services.eom_prompts import SYSTEM_PROMPT, build_user_prompt
from app.services.eom_publisher import create_eom_report_page
from app.services.matching import names_match


_MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]


def _find_va(va_name: str, vas: list) -> dict | None:
    target = va_name.strip().lower()
    for v in vas:
        if v["name"].strip().lower() == target:
            return v
    # Fuzzy fallback (first + last name match)
    for v in vas:
        if names_match(va_name, v["name"]):
            return v
    return None


def _reports_for_client(all_reports: list, client_name: str) -> list:
    """Filter month-of EOD reports down to those matching a single client."""
    matched = []
    for r in all_reports:
        report_client = r.get("client", "")
        is_match, _ = match_client_name(report_client, client_name)
        if is_match:
            matched.append(r)
    return matched


def generate_eom_reports_for_va(va_name: str, year: int, month: int) -> dict:
    """
    Generate and publish EOM reports for one VA across all their active clients.

    Returns:
      {
        "pages":  [{ "client": str, "url": str, "page_id": str }, ...],
        "errors": [{ "client": str | None, "error": str }, ...],
      }
    """
    result = {"pages": [], "errors": []}

    if not (1 <= month <= 12):
        result["errors"].append({"client": None, "error": f"Invalid month: {month}"})
        return result

    month_name = _MONTH_NAMES[month - 1]

    # ── Resolve VA ────────────────────────────────────────────────
    vas = get_active_vas()
    va  = _find_va(va_name, vas)
    if not va:
        result["errors"].append({
            "client": None,
            "error":  f"VA '{va_name}' not found among active VAs.",
        })
        return result

    community = va.get("community", "Main")

    # ── Resolve VA's contracts ────────────────────────────────────
    contracts_by_id = get_active_contracts_by_id()
    contracts = [
        contracts_by_id[cid]
        for cid in va.get("contract_ids", [])
        if cid in contracts_by_id
    ]
    if not contracts:
        result["errors"].append({
            "client": None,
            "error":  f"{va['name']} has no active contracts.",
        })
        return result

    # ── Fetch client lookup + month-of EOD data ───────────────────
    clients_db   = get_all_clients()
    month_reports = get_eod_for_va(va["name"], community, year, month)

    # Month boundary dates for the Month property (date range)
    month_start = date(year, month, 1)
    last_day    = calendar.monthrange(year, month)[1]
    month_end   = date(year, month, last_day)
    month_start_iso = month_start.isoformat()
    month_end_iso   = month_end.isoformat()

    # ── Generate + publish per contract ───────────────────────────
    for contract in contracts:
        contract_client_name = contract.get("client_name", "") or ""
        contract_client_id   = contract.get("client_id")

        # Look up client metadata (name, email, company) from Clients DB
        client_meta = clients_db.get(_norm_id(contract_client_id or ""), {})
        display_name = client_meta.get("name") or contract_client_name or "(unknown client)"
        company      = client_meta.get("company", "")
        email        = client_meta.get("email", "")

        # Filter EOD reports to just this client's work
        client_reports = _reports_for_client(month_reports, contract_client_name)
        if not client_reports:
            result["errors"].append({
                "client": display_name,
                "error":  "No EOD reports found for this client in the selected month — skipped.",
            })
            continue

        # Generate the report content
        try:
            user_prompt = build_user_prompt(
                va_name     = va["name"].strip(),
                client_name = display_name,
                company     = company,
                month_name  = month_name,
                year        = year,
                community   = community,
                contract    = contract,
                reports     = client_reports,
            )
            report_md = generate_with_cache(SYSTEM_PROMPT, user_prompt)
        except Exception as e:
            result["errors"].append({
                "client": display_name,
                "error":  f"AI generation failed: {e}",
            })
            continue

        # Publish to Notion
        try:
            title = f"EOM {month_name} — {va['name'].strip()}"
            page  = create_eom_report_page(
                title           = title,
                month_start_iso = month_start_iso,
                month_end_iso   = month_end_iso,
                client_name     = display_name,
                company         = company,
                email           = email,
                va_name         = va["name"].strip(),
                body_markdown   = report_md,
            )
            result["pages"].append({
                "client":  display_name,
                "url":     page.get("url", ""),
                "page_id": page.get("id", ""),
            })
        except Exception as e:
            result["errors"].append({
                "client": display_name,
                "error":  f"Notion page creation failed: {e}",
            })

    return result