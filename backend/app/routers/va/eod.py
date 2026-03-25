from fastapi import APIRouter, Depends, Query, HTTPException
from app.middleware.auth import verify_token
from app.notion import get_eod_main_for_date, get_eod_cba_for_date
from app.cache import cache_get, cache_set, FOREVER, TTL_15MIN
from datetime import date as date_type
import logging

router = APIRouter(prefix="/api/va/eod", tags=["va-eod"])
log    = logging.getLogger(__name__)


@router.get("")
async def get_eod(
    date: str = Query(default=None),
    force: bool = Query(default=False),
    user=Depends(verify_token),
):
    target    = date or date_type.today().isoformat()
    is_today  = (target == date_type.today().isoformat())
    cache_key = f"eod:{target}"
    ttl       = TTL_15MIN if is_today else FOREVER

    if not force:
        cached = cache_get(cache_key)
        if cached:
            return {"date": target, "data": cached, "cached": True}

    try:
        main = get_eod_main_for_date(target)
        cba  = get_eod_cba_for_date(target)
        data = {"main": main, "cba": cba, "total": len(main) + len(cba)}
        cache_set(cache_key, data, ttl)
        return {"date": target, "data": data, "cached": False}
    except Exception as e:
        log.exception("Error fetching EOD for %s", target)
        raise HTTPException(status_code=500, detail=str(e))