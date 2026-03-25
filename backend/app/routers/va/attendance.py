from fastapi import APIRouter, Depends, Query, HTTPException
from app.middleware.auth import verify_token
from app.notion import get_attendance_for_date
from app.cache import cache_get, cache_set, FOREVER, TTL_15MIN
from datetime import date as date_type
import logging

router = APIRouter(prefix="/api/va/attendance", tags=["va-attendance"])
log    = logging.getLogger(__name__)


@router.get("")
async def get_attendance(
    date: str  = Query(default=None),
    force: bool = Query(default=False),
    user=Depends(verify_token),
):
    target    = date or date_type.today().isoformat()
    is_today  = (target == date_type.today().isoformat())
    cache_key = f"attendance:{target}"
    ttl       = TTL_15MIN if is_today else FOREVER

    if not force:
        cached = cache_get(cache_key)
        if cached:
            return {"date": target, "data": cached, "cached": True}

    try:
        records = get_attendance_for_date(target)
        cache_set(cache_key, records, ttl)
        return {"date": target, "data": records, "cached": False}
    except Exception as e:
        log.exception("Error fetching attendance for %s", target)
        raise HTTPException(status_code=500, detail=str(e))