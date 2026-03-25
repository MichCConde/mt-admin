from fastapi import APIRouter, Depends, Query, HTTPException
from app.middleware.auth import verify_token
from app.firebase import get_db
import logging

router = APIRouter(prefix="/api/internal/activity", tags=["internal-activity"])
log    = logging.getLogger(__name__)

LOG_TYPES = {
    "EMAIL_SENT":   "email_sent",
    "SYNC":         "sync",
    "REPORT_VIEW":  "report_view",
    "FLAG_ADDED":   "flag_added",
}


def log_activity(action: str, user_uid: str, detail: dict = None):
    """Call this from any router to add to the audit trail."""
    from datetime import datetime, timezone
    get_db().collection("activity_logs").add({
        "action":     action,
        "user_uid":   user_uid,
        "detail":     detail or {},
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


@router.get("")
async def list_activity(
    limit: int = Query(default=50, le=200),
    user=Depends(verify_token),
):
    try:
        db   = get_db()
        docs = (
            db.collection("activity_logs")
            .order_by("created_at", direction="DESCENDING")
            .limit(limit)
            .stream()
        )
        return {"logs": [d.to_dict() for d in docs]}
    except Exception as e:
        log.exception("Activity log error")
        raise HTTPException(status_code=500, detail=str(e))