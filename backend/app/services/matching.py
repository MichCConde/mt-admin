"""
Shared matching helpers — SINGLE source of truth.

Used by: eod.py, eow.py, email.py, dashboard.py, attendance.py, inspector.py
"""

from app.notion import match_client_name


def names_match(va_name: str, eod_name: str) -> bool:
    """
    Check if a VA DB name and an EOD-submitted name refer to the same person.
    Handles middle initials and minor variations.

    "Gillian J. Laguilles" vs "Gillian Laguilles" → True
    "Michelle Ann Conde"   vs "Michelle Conde"    → True
    "Ana Cruz"             vs "Mariana Cruz"       → False (first name differs)
    """
    va  = va_name.strip().lower().split()
    eod = eod_name.strip().lower().split()
    if not va or not eod:
        return False
    return va[0] == eod[0] and va[-1] == eod[-1]


def fuzzy_find_eod(eod_list: list, client_name: str):
    """Find the first EOD record whose client fuzzy-matches the given client name."""
    for r in eod_list:
        is_match, needs_v = match_client_name(r.get("client", ""), client_name)
        if is_match:
            return r, needs_v
    return None, False


def fuzzy_find_clockin(clockin_list: list, client_name: str):
    """Find the first clock-in record whose client fuzzy-matches the given client name."""
    for ci in clockin_list:
        is_match, needs_v = match_client_name(ci.get("client", ""), client_name)
        if is_match:
            return ci, needs_v
    return None, False