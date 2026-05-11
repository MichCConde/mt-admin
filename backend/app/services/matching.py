"""
Shared matching helpers — SINGLE source of truth.

Used by: eod.py, eow.py, email.py, dashboard.py, attendance.py, inspector.py
"""
import re
import unicodedata

from app.notion import match_client_name

_MOJIBAKE_FIXES = {
    "\u00e2\u20ac\u2122": "'",   # â€™ → ' (U+2019 right single quote)
    "\u00e2\u20ac\u02dc": "'",   # â€˜ → ' (U+2018 left single quote)
    "\u00e2\u20ac\u0153": '"',   # â€œ → " (U+201C left double quote)
    "\u00e2\u20ac\u009d": '"',   # â€<U+009D> → " (U+201D right double quote)
    "\u00e2\u20ac\u201c": "-",   # â€“ → - (U+2013 en dash)
    "\u00e2\u20ac\u201d": "-",   # â€" → - (U+2014 em dash)
    "\u00e2\u20ac\u00a6": "...", # â€¦ → ... (U+2026 ellipsis)
    "\u00c3\u00a9": "e",         # Ã© → e
    "\u00c3\u00a8": "e",         # Ã¨ → e
    "\u00c3\u00a0": "a",         # Ã  → a
    "\u00c3\u00b1": "n",         # Ã± → n
    "\u00c3\u00b3": "o",         # Ã³ → o
    "\u00c3\u00ad": "i",         # Ã­ → i
    "\u00c3\u00ba": "u",         # Ãº → u
}

# Unicode punctuation that should normalize to ASCII equivalents
_UNICODE_PUNCT = {
    "\u2018": "'", "\u2019": "'",          # curly single quotes
    "\u201C": '"', "\u201D": '"',          # curly double quotes
    "\u2013": "-", "\u2014": "-",          # en/em dashes
    "\u00A0": " ",                          # non-breaking space
    "\u2026": "...",                        # ellipsis
}


def normalize_name(s: str) -> str:
    """
    Normalize a client or VA name for fuzzy matching.

    Handles:
      - Mojibake (Patrick Oâ€™Bryant → patrick obryant)
      - Curly vs straight quotes
      - Accented characters (é → e)
      - Punctuation removal (apostrophes, hyphens, periods)
      - Case folding and whitespace collapse
    """
    if not s:
        return ""

    # 1. Fix mojibake first (longest sequences before shorter)
    for bad, good in sorted(_MOJIBAKE_FIXES.items(), key=lambda x: -len(x[0])):
        s = s.replace(bad, good)

    # 2. Replace Unicode punctuation with ASCII equivalents
    for bad, good in _UNICODE_PUNCT.items():
        s = s.replace(bad, good)

    # 3. Decompose accented characters (é → e + combining accent), then drop accents
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))

    # 4. Lowercase
    s = s.lower()

    # 5. Strip remaining punctuation (apostrophes, hyphens, periods, commas)
    s = re.sub(r"['\"\.,\-_/\\]", "", s)

    # 6. Collapse whitespace
    s = re.sub(r"\s+", " ", s).strip()

    return s


def names_match(va_name: str, eod_name: str) -> bool:
    """
    Check if a VA DB name and an EOD-submitted name refer to the same person.
    Handles middle initials and minor variations.

    "Gillian J. Laguilles" vs "Gillian Laguilles" → True
    "Michelle Ann Conde"   vs "Michelle Conde"    → True
    "Ana Cruz"             vs "Mariana Cruz"       → False (first name differs)
    """
    va  = normalize_name(va_name).split()
    eod = normalize_name(eod_name).split()
    if not va or not eod:
        return False
    return va[0] == eod[0] and va[-1] == eod[-1]


def fuzzy_find_eod(eod_list: list, client_name: str):
    """Find the first EOD record whose client fuzzy-matches the given client name."""
    target = normalize_name(client_name)
    for r in eod_list:
        rec_client = normalize_name(r.get("client", ""))
        # Try normalized exact/substring match first (handles apostrophes/mojibake)
        if rec_client and target and (rec_client == target or target in rec_client or rec_client in target):
            return r, False
        # Fall back to the existing fuzzy match (preserves needs_verification flag)
        is_match, needs_v = match_client_name(r.get("client", ""), client_name)
        if is_match:
            return r, needs_v
    return None, False


def fuzzy_find_clockin(clockin_list: list, client_name: str):
    """Find the first clock-in record whose client fuzzy-matches the given client name."""
    target = normalize_name(client_name)
    for ci in clockin_list:
        ci_client = normalize_name(ci.get("client", ""))
        if ci_client and target and (ci_client == target or target in ci_client or ci_client in target):
            return ci, False
        is_match, needs_v = match_client_name(ci.get("client", ""), client_name)
        if is_match:
            return ci, needs_v
    return None, False

def is_project_based_contract(contract: dict) -> bool:
    """A contract is project-based if Package == 'Project-based'."""
    return contract.get("is_project_based") or contract.get("package") == "Project-based"


def has_only_project_based_contracts(va: dict, contracts_by_id: dict) -> bool:
    """
    True if VA has at least one active contract and ALL are project-based.
    Used to exclude project-based VAs from EOD/clock-in tracking.
    Returns False for VAs with no contracts (they're handled separately).
    """
    cids = va.get("contract_ids", [])
    if not cids:
        return False
    active = [contracts_by_id[c] for c in cids if c in contracts_by_id]
    if not active:
        return False
    return all(is_project_based_contract(c) for c in active)