# ════════════════════════════════════════════════════════════════
# backend/app/routers/attendance.py
# ════════════════════════════════════════════════════════════════
from fastapi import APIRouter, Query, HTTPException
from app.notion import (
    get_active_vas, get_attendance_for_date,
    get_eod_main_for_date, get_eod_cba_for_date,
    clock_in_punctuality,
)

router = APIRouter()

@router.get("")
def check_attendance(date: str = Query(..., description="YYYY-MM-DD")):
    """
    Attendance check with punctuality based on the VA's Time In field
    from their EOD report for the same date.
    Falls back to Shift Time from VA record if no EOD submitted yet.
    """
    try:
        vas        = get_active_vas()          # Active + VA Team only
        attendance = get_attendance_for_date(date)
        eod_main   = get_eod_main_for_date(date)
        eod_cba    = get_eod_cba_for_date(date)

        clock_ins  = [a for a in attendance if a["type"] == "IN"]
        clock_outs = [a for a in attendance if a["type"] == "OUT"]

        # Build Time In lookup: name → time_in string
        # EOD report is the primary source; VA shift_time is the fallback
        eod_time_in: dict[str, str] = {}
        for r in [*eod_main, *eod_cba]:
            name_key = r["name"].strip().lower()
            if r.get("time_in") and name_key not in eod_time_in:
                eod_time_in[name_key] = r["time_in"]

        shift_lookup: dict[str, str] = {
            va["name"].strip().lower(): va.get("shift_time", "")
            for va in vas
        }

        clock_ins_out = []
        for c in clock_ins:
            name_key  = c["raw_name"].strip().lower()
            time_in   = eod_time_in.get(name_key) or shift_lookup.get(name_key, "")
            clock_ins_out.append({
                **c,
                "punctuality": clock_in_punctuality(c["created_time"], time_in),
            })

        clocked_names = {c["raw_name"].strip().lower() for c in clock_ins}
        no_record     = [va for va in vas if va["name"].strip().lower() not in clocked_names]
        late_clock_ins = [c for c in clock_ins_out if not c["punctuality"]["on_time"]]

        return {
            "date":           date,
            "vas":            vas,
            "clock_ins":      clock_ins_out,
            "clock_outs":     clock_outs,
            "no_record":      no_record,
            "late_count":     len(late_clock_ins),
            "late_clock_ins": late_clock_ins,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


