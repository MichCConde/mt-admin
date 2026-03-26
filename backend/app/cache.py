"""
Server-side cache backed by Firestore.

Why not the old module-level dict?
  Vercel serverless functions spin up a fresh Python process per request,
  wiping any in-memory state. Firestore persists across invocations.

Why Firestore instead of a dedicated Redis service?
  Firebase Admin SDK is already installed and configured — no new
  dependencies, no new env vars, no extra service to manage.

Latency trade-off:
  Firestore read: ~50–150ms  vs  Notion call: ~800ms+
  Well worth it for VA list and contract data that rarely changes.

Graceful degradation:
  If Firestore is unavailable for any reason, cache_get returns None
  and cache_set is a no-op — the app falls back to hitting Notion
  directly. Slower but fully functional.
"""

import json
import logging
from datetime import datetime, timezone, timedelta

log = logging.getLogger(__name__)

# ── TTLs ──────────────────────────────────────────────────────────
TTL_VA_LIST   = 5 * 60    # 5 minutes
TTL_CONTRACTS = 5 * 60    # 5 minutes

# ── Firestore collection ──────────────────────────────────────────
CACHE_COLLECTION = "_cache"

# ── Cache keys ────────────────────────────────────────────────────
KEY_VA_LIST   = "va:active_list"
KEY_CONTRACTS = "contracts:by_va_id"

# ── Client ────────────────────────────────────────────────────────
def _get_db():
    """
    Returns the Firestore client from the already-initialised Firebase
    Admin SDK. Returns None if Firebase isn't ready yet.
    """
    try:
        from firebase_admin import firestore
        return firestore.client()
    except Exception as e:
        log.warning(f"[cache] Firestore client unavailable: {e}")
        return None


# ── Public helpers ────────────────────────────────────────────────

def cache_get(key: str):
    """
    Retrieve a cached value by key.
    Returns the deserialised Python object, or None on miss / expiry / error.
    """
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
            # Expired — delete lazily and treat as miss
            db.collection(CACHE_COLLECTION).document(key).delete()
            return None
        raw = d.get("data")
        return json.loads(raw) if raw else None
    except Exception as e:
        log.warning(f"[cache] GET error for '{key}': {e}")
        return None


def cache_set(key: str, value, ttl: int = 300) -> bool:
    """
    Store a value with a TTL (seconds). Returns True on success.
    """
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
    """Invalidate a cached key immediately."""
    db = _get_db()
    if not db:
        return False
    try:
        db.collection(CACHE_COLLECTION).document(key).delete()
        return True
    except Exception as e:
        log.warning(f"[cache] DELETE error for '{key}': {e}")
        return False