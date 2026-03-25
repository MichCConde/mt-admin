from fastapi import APIRouter, Depends, HTTPException
from app.middleware.auth import verify_token
from app.firebase import get_db
from app.notion import get_active_vas
from app.cache import cache_get, cache_set, TTL_5MIN
import logging

router = APIRouter(prefix="/api/internal/dashboard", tags=["internal-dashboard"])
log    = logging.getLogger(__name__)


@router.get("")
async def get_dashboard(user=Depends(verify_token)):
    cache_key = "dashboard:summary"
    cached    = cache_get(cache_key)
    if cached:
        return {**cached, "cached": True}

    try:
        db  = get_db()
        vas = [d.to_dict() for d in db.collection("va_mirror").stream()] or get_active_vas()

        agency = [v for v in vas if v.get("type") == "Agency"]
        cba    = [v for v in vas if v.get("type") == "CBA"]
        no_client = [v for v in vas if not v.get("client")]

        # Client breakdown
        client_map: dict[str, int] = {}
        for v in vas:
            c = v.get("client") or "Unassigned"
            client_map[c] = client_map.get(c, 0) + 1

        summary = {
            "total_active":  len(vas),
            "agency_count":  len(agency),
            "cba_count":     len(cba),
            "no_client":     len(no_client),
            "client_breakdown": client_map,
        }
        cache_set(cache_key, summary, TTL_5MIN)
        return {**summary, "cached": False}
    except Exception as e:
        log.exception("Dashboard error")
        raise HTTPException(status_code=500, detail=str(e))