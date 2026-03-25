"""
Keyword flagging for EOD report content.
Keywords are loaded from Firestore so admin can update them without a deploy.
Falls back to hardcoded defaults if Firestore entry doesn't exist.
"""
from app.firebase import get_db

_DEFAULT_KEYWORDS = [
    "resigned", "fired", "complaint", "issue", "problem",
    "late", "absent", "sick", "error", "mistake", "urgent",
    "escalate", "refund", "cancel", "dispute",
]


def get_keywords() -> list[str]:
    """Load keywords from Firestore, falling back to defaults."""
    try:
        db  = get_db()
        doc = db.collection("config").document("keyword_flags").get()
        if doc.exists:
            return doc.to_dict().get("keywords", _DEFAULT_KEYWORDS)
    except Exception:
        pass
    return _DEFAULT_KEYWORDS


def detect_keyword_flags(reports: list[dict]) -> list[dict]:
    """
    Scan report content for keywords that need attention.
    Returns list of flagged reports with matched keywords.
    """
    keywords = [k.lower() for k in get_keywords()]
    flagged  = []

    for r in reports:
        content = (r.get("report") or "").lower()
        matched = [kw for kw in keywords if kw in content]
        if matched:
            flagged.append({
                "va_name":  r["name"],
                "date":     r["date"],
                "keywords": matched,
                "excerpt":  content[:200],
            })
    return flagged