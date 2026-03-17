# ── backend/app/routers/attendance.py ───────────────────────────
from fastapi import APIRouter, Query, HTTPException
from app.notion import get_active_vas, get_attendance_for_date

router = APIRouter()

@router.get("/")
def check_attendance(date: str = Query(..., description="YYYY-MM-DD")):
    """
    Returns all active VAs, who clocked in, and who clocked out
    for the given EST date.
    """
    try:
        vas        = get_active_vas()
        attendance = get_attendance_for_date(date)
        clock_ins  = [a for a in attendance if a["type"] == "IN"]
        clock_outs = [a for a in attendance if a["type"] == "OUT"]

        # Names who clocked in (lowercased for matching)
        clocked_in_names = {a["raw_name"].lower() for a in clock_ins}

        # VAs with no record at all
        no_record = [
            va for va in vas
            if va["name"].lower() not in clocked_in_names
        ]

        return {
            "date":       date,
            "vas":        vas,
            "clock_ins":  clock_ins,
            "clock_outs": clock_outs,
            "no_record":  no_record,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))