# Identical logic to original attendance.py router
from fastapi import APIRouter, Query, HTTPException
from app.notion import (
    get_active_vas_cached, get_attendance_for_date,
    get_eod_main_for_date, get_eod_cba_for_date,
    clock_in_punctuality,
)

router = APIRouter()


def _last_name(full_name: str) -> str:
    return full_name.strip().split()[-1].lower()


@router.get("")
def check_attendance(date: str = Query(..., description="YYYY-MM-DD")):
    try:
        vas        = get_active_vas_cached()
        attendance = get_attendance_for_date(date)
        eod_main   = get_eod_main_for_date(date)
        eod_cba    = get_eod_cba_for_date(date)

        clock_ins  = [a for a in attendance if a["type"] == "IN"]
        clock_outs = [a for a in attendance if a["type"] == "OUT"]

        eod_time_in: dict[str, str] = {}
        for r in [*eod_main, *eod_cba]:
            last = r["name"].strip().split()[-1].lower()
            if r.get("time_in") and last not in eod_time_in:
                eod_time_in[last] = r["time_in"]

        shift_lookup: dict[str, str] = {
            _last_name(va["name"]): va.get("shift_time", "")
            for va in vas
        }

        clock_ins_out = []
        for c in clock_ins:
            last    = c["last_name"]
            time_in = eod_time_in.get(last) or shift_lookup.get(last, "")
            clock_ins_out.append({
                **c,
                "punctuality": clock_in_punctuality(c["created_time"], time_in),
            })

        clocked_last_names = {c["last_name"] for c in clock_ins}
        no_record          = [va for va in vas if _last_name(va["name"]) not in clocked_last_names]
        late_clock_ins     = [c for c in clock_ins_out if not c["punctuality"]["on_time"]]

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