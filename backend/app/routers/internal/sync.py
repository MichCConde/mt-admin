from fastapi import APIRouter, Depends, Header, HTTPException
from app.middleware.auth import verify_token
from app.notion.vas import get_active_vas
from app.firebase import get_db
from app.config import settings
from app.routers.internal.activity import log_activity
from datetime import datetime, timezone
import logging

router = APIRouter(prefix="/api/internal/sync", tags=["internal-sync"])
log    = logging.getLogger(__name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sync_vas(db) -> int:
    vas   = get_active_vas()   # includes initials, schedule, shift_slots
    batch = db.batch()
    for va in vas:
        ref = db.collection("va_mirror").document(va["id"])
        batch.set(ref, {**va, "_synced_at": _now()})
    batch.commit()
    return len(vas)


@router.post("/notion")
async def manual_sync(user=Depends(verify_token)):
    try:
        db    = get_db()
        va_ct = _sync_vas(db)
        counts = {"vas": va_ct}
        db.collection("sync_log").add({"synced_by": user["uid"],
                                       "synced_at": _now(), "counts": counts})
        log_activity("sync", user["uid"], counts)
        return {"status": "ok", "synced": counts, "at": _now()}
    except Exception as e:
        log.exception("Manual sync error")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def sync_status(user=Depends(verify_token)):
    db   = get_db()
    docs = (db.collection("sync_log")
            .order_by("synced_at", direction="DESCENDING")
            .limit(1).stream())
    for doc in docs:
        return doc.to_dict()
    return {"synced_at": None}


@router.post("/cron")
async def cron_sync(x_cron_secret: str = Header(None)):
    if not settings.cron_secret or x_cron_secret != settings.cron_secret:
        raise HTTPException(status_code=403)
    try:
        db    = get_db()
        va_ct = _sync_vas(db)
        db.collection("sync_log").add({"synced_by": "cron",
                                       "synced_at": _now(), "counts": {"vas": va_ct}})
        return {"status": "ok", "synced": {"vas": va_ct}}
    except Exception as e:
        log.exception("Cron sync error")
        raise HTTPException(status_code=500, detail=str(e))