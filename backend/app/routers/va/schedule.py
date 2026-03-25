from fastapi import APIRouter, Depends, Query, HTTPException
from app.middleware.auth import verify_token
from app.firebase import get_db
from app.notion.vas import get_active_vas
from app.notion.schedules import build_schedules_from_vas
import logging

router = APIRouter(prefix="/api/va/schedule", tags=["va-schedule"])
log    = logging.getLogger(__name__)


def _get_schedules() -> list[dict]:
    """
    Build schedule from VA mirror in Firestore (fast),
    falling back to live Notion fetch if mirror is empty.
    """
    db   = get_db()
    docs = list(db.collection("va_mirror").stream())
    vas  = [d.to_dict() for d in docs] if docs else get_active_vas()
    return build_schedules_from_vas(vas)


@router.get("")
async def list_schedules(user=Depends(verify_token)):
    try:
        return {"schedules": _get_schedules()}
    except Exception as e:
        log.exception("Error fetching schedules")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/available")
async def find_available(
    date: str = Query(...),
    time: str = Query(..., description="HH:MM in 24h format"),
    user=Depends(verify_token),
):
    """Returns VAs whose shift covers the given date + time."""
    try:
        from app.notion.schedules import _DAY_MAP
        from datetime import date as date_type
        import re

        schedules     = _get_schedules()
        target_weekday = date_type.fromisoformat(date).weekday()

        def time_to_minutes(t: str) -> int:
            """Convert '8:00AM', '12NN', '3:30PM' → minutes since midnight."""
            t = t.upper().strip()
            if t in ("12NN", "12:00NN", "NOON"):
                return 12 * 60
            m = re.match(r"(\d{1,2})(?::(\d{2}))?(AM|PM)", t)
            if not m:
                return 0
            h, mn, period = int(m.group(1)), int(m.group(2) or 0), m.group(3)
            if period == "PM" and h != 12:
                h += 12
            if period == "AM" and h == 12:
                h = 0
            return h * 60 + mn

        # Convert query time (HH:MM 24h) to minutes
        qh, qm    = map(int, time.split(":"))
        query_min = qh * 60 + qm

        available = []
        seen      = set()
        for s in schedules:
            if s["va_id"] in seen:
                continue
            works_today = any(
                _DAY_MAP.get(d) == target_weekday
                for d in s.get("work_days", [])
            )
            if not works_today:
                continue
            if s.get("time_in") and s.get("time_out"):
                start = time_to_minutes(s["time_in"])
                end   = time_to_minutes(s["time_out"])
                if start <= query_min <= end:
                    available.append(s)
                    seen.add(s["va_id"])
            else:
                available.append(s)
                seen.add(s["va_id"])

        return {"date": date, "time": time, "available": available}
    except Exception as e:
        log.exception("Error in availability finder")
        raise HTTPException(status_code=500, detail=str(e))