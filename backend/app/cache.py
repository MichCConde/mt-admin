from datetime import datetime, timezone
from app.firebase import get_db

FOREVER = None          # No expiry — for historical / frozen data
TTL_30MIN = 1800
TTL_15MIN = 900
TTL_5MIN  = 300


def cache_get(key: str) -> dict | None:
    db = get_db()
    doc = db.collection("cache").document(key).get()
    if not doc.exists:
        return None
    data = doc.to_dict()
    ttl = data.get("ttl")
    if ttl is not None:
        stored_at = datetime.fromisoformat(data["stored_at"])
        age = (datetime.now(timezone.utc) - stored_at).total_seconds()
        if age > ttl:
            return None
    return data.get("value")


def cache_set(key: str, value, ttl: int | None = TTL_15MIN):
    db = get_db()
    db.collection("cache").document(key).set({
        "value": value,
        "stored_at": datetime.now(timezone.utc).isoformat(),
        "ttl": ttl
    })


def cache_delete(key: str):
    get_db().collection("cache").document(key).delete()