from fastapi import APIRouter, Depends, Header, HTTPException
from app.middleware.auth import verify_token
from app.notion import get_active_vas, get_all_schedules
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
    vas   = get_active_vas()
    batch = db.batch()
    for va in vas:
        ref = db.collection("va_mirror").document(va["id"])
        batch.set(ref, {**va, "_synced_at": _now()})
    batch.commit()
    return len(vas)


def _sync_schedules(db) -> int:
    schedules = get_all_schedules()
    batch     = db.batch()
    for s in schedules:
        ref = db.collection("schedule_mirror").document(s["id"])
        batch.set(ref, {**s, "_synced_at": _now()})
    batch.commit()
    return len(schedules)


@router.post("/notion")
async def manual_sync(user=Depends(verify_token)):
    """Triggered by 'Sync Now' button in the UI."""
    try:
        db      = get_db()
        va_ct   = _sync_vas(db)
        sched_ct = _sync_schedules(db)

        counts = {"vas": va_ct, "schedules": sched_ct}
        db.collection("sync_log").add({"synced_by": user["uid"],
                                       "synced_at": _now(), "counts": counts})
        log_activity("sync", user["uid"], counts)
        return {"status": "ok", "synced": counts, "at": _now()}
    except Exception as e:
        log.exception("Manual sync error")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def sync_status(user=Depends(verify_token)):
    """Returns timestamp of last successful sync for the UI banner."""
    db   = get_db()
    docs = (
        db.collection("sync_log")
        .order_by("synced_at", direction="DESCENDING")
        .limit(1)
        .stream()
    )
    for doc in docs:
        return doc.to_dict()
    return {"synced_at": None}


@router.post("/cron")
async def cron_sync(x_cron_secret: str = Header(None)):
    """Called by Vercel cron every 30 minutes."""
    if not settings.cron_secret or x_cron_secret != settings.cron_secret:
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        db      = get_db()
        va_ct   = _sync_vas(db)
        sched_ct = _sync_schedules(db)
        counts  = {"vas": va_ct, "schedules": sched_ct}
        db.collection("sync_log").add({"synced_by": "cron",
                                       "synced_at": _now(), "counts": counts})
        return {"status": "ok", "synced": counts}
    except Exception as e:
        log.exception("Cron sync error")
        raise HTTPException(status_code=500, detail=str(e))