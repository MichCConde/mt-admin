from fastapi import APIRouter, Depends, Query, HTTPException
from app.middleware.auth import verify_token
from app.firebase import get_db
from app.notion import get_all_schedules
import logging

router = APIRouter(prefix="/api/va/schedule", tags=["va-schedule"])
log    = logging.getLogger(__name__)


def _get_schedules_from_mirror() -> list[dict]:
    db   = get_db()
    docs = list(db.collection("schedule_mirror").stream())
    if docs:
        return [d.to_dict() for d in docs]
    schedules = get_all_schedules()
    _seed_mirror(schedules)
    return schedules


def _seed_mirror(schedules: list[dict]):
    db    = get_db()
    batch = db.batch()
    for s in schedules:
        ref = db.collection("schedule_mirror").document(s["id"])
        batch.set(ref, s)
    batch.commit()


@router.get("")
async def list_schedules(user=Depends(verify_token)):
    try:
        return {"schedules": _get_schedules_from_mirror()}
    except Exception as e:
        log.exception("Error fetching schedules")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/available")
async def find_available(
    date: str = Query(...),
    time: str = Query(..., description="HH:MM in 24h format"),
    user=Depends(verify_token),
):
    """Availability finder — returns VAs whose shift covers the given date+time."""
    try:
        schedules = _get_schedules_from_mirror()
        available = []
        for s in schedules:
            if date not in s.get("work_days_dates", []):
                continue
            # Simple time overlap check
            shift_in  = s.get("time_in", "00:00")
            shift_out = s.get("time_out", "23:59")
            if shift_in <= time <= shift_out:
                available.append(s)
        return {"date": date, "time": time, "available": available}
    except Exception as e:
        log.exception("Error in availability finder")
        raise HTTPException(status_code=500, detail=str(e))