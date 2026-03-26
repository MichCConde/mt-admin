from fastapi import APIRouter, Depends, Query, HTTPException
from app.middleware.auth import verify_token
from app.firebase import get_db
from datetime import datetime, timezone
import logging

router = APIRouter()
log    = logging.getLogger(__name__)

LOG_TYPES = {
    "EMAIL_SENT":  "email_sent",
    "EOD_CHECK":   "eod_check",
    "SYNC":        "sync",
    "SIGN_IN":     "sign_in",
    "FLAG_ADDED":  "flag_added",
}


def log_activity(action: str, user_uid: str, detail: dict = None):
    try:
        get_db().collection("activity_logs").add({
            "action":     action,
            "user_uid":   user_uid,
            "detail":     detail or {},
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:
        log.warning(f"log_activity failed: {e}")


@router.get("")
def list_activity(limit: int = Query(default=200, le=500), user=Depends(verify_token)):
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
        raise HTTPException(status_code=500, detail=str(e))