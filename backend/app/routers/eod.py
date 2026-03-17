# ── backend/app/routers/eod.py ───────────────────────────────────
from fastapi import APIRouter, Query, HTTPException
from app.notion import get_active_vas, get_attendance_for_date, get_eod_for_date

router = APIRouter()

@router.get("/")
def check_eod(date: str = Query(..., description="YYYY-MM-DD")):
    """
    Returns EOD submissions for the given date and highlights
    which active VAs did NOT submit — the core missing-report check.
    """
    try:
        vas        = get_active_vas()
        attendance = get_attendance_for_date(date)
        eod        = get_eod_for_date(date)

        clock_ins      = [a for a in attendance if a["type"] == "IN"]
        submitted_names = {r["name"].strip().lower() for r in eod}
        clocked_names   = {a["raw_name"].strip().lower() for a in clock_ins}

        # Build the missing list with context
        missing = []
        for va in vas:
            va_name_lower = va["name"].strip().lower()
            if va_name_lower not in submitted_names:
                missing.append({
                    **va,
                    "clocked_in": va_name_lower in clocked_names,
                })

        return {
            "date":             date,
            "active_va_count":  len(vas),
            "submitted_count":  len(eod),
            "clocked_in_count": len(clock_ins),
            "missing_count":    len(missing),
            "eod_submissions":  eod,
            "missing":          missing,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))