"""
Firestore-backed cache. Identical to original cache.py.
"""
import json
import logging
from datetime import datetime, timezone, timedelta

log = logging.getLogger(__name__)

TTL_VA_LIST   = 5 * 60
TTL_CONTRACTS = 5 * 60
CACHE_COLLECTION = "_cache"
KEY_VA_LIST   = "va:active_list"
KEY_CONTRACTS = "contracts:by_va_id"


def _get_db():
    try:
        from app.firebase import get_db
        return get_db()
    except Exception as e:
        log.warning(f"[cache] Firestore unavailable: {e}")
        return None


def cache_get(key: str):
    db = _get_db()
    if not db:
        return None
    try:
        doc = db.collection(CACHE_COLLECTION).document(key).get()
        if not doc.exists:
            return None
        d = doc.to_dict()
        expires_at = d.get("expires_at")
        if expires_at and datetime.now(timezone.utc) > expires_at:
            db.collection(CACHE_COLLECTION).document(key).delete()
            return None
        raw = d.get("data")
        return json.loads(raw) if raw else None
    except Exception as e:
        log.warning(f"[cache] GET error for '{key}': {e}")
        return None


def cache_set(key: str, value, ttl: int = 300) -> bool:
    db = _get_db()
    if not db:
        return False
    try:
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=ttl)
        db.collection(CACHE_COLLECTION).document(key).set({
            "data":       json.dumps(value, default=str),
            "expires_at": expires_at,
            "updated_at": datetime.now(timezone.utc),
        })
        return True
    except Exception as e:
        log.warning(f"[cache] SET error for '{key}': {e}")
        return False


def cache_delete(key: str) -> bool:
    db = _get_db()
    if not db:
        return False
    try:
        db.collection(CACHE_COLLECTION).document(key).delete()
        return True
    except Exception as e:
        log.warning(f"[cache] DELETE error for '{key}': {e}")
        return False