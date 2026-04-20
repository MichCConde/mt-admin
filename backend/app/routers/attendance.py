from fastapi import APIRouter, Query, HTTPException
from app.notion import (
    get_active_vas_cached, get_attendance_for_date,
    get_eod_main_for_date, get_eod_cba_for_date,
    get_all_active_contracts_by_va_id,
    clock_in_punctuality, match_client_name,
)
from app.services.shift import parse_shift_time, format_shift_time
from app.middleware.security import validate_date, safe_error

router = APIRouter()


@router.get("")
def check_attendance(date: str = Query(..., description="YYYY-MM-DD")):
    try:
        date            = validate_date(date)
        vas             = get_active_vas_cached()
        contracts_by_va = get_all_active_contracts_by_va_id()
        attendance      = get_attendance_for_date(date)
        eod_main        = get_eod_main_for_date(date)
        eod_cba         = get_eod_cba_for_date(date)

        name_to_clockins: dict[str, list] = {}
        for a in attendance:
            name_to_clockins.setdefault(a["full_name"], []).append(a)
            if a["last_name"] != a["full_name"]:
                name_to_clockins.setdefault(a["last_name"], []).append(a)

        # EOD Time In lookup by VA
        eod_time_in: dict[str, str] = {}
        for r in [*eod_main, *eod_cba]:
            key  = r["name"].strip().lower()
            last = key.split()[-1]
            if r.get("time_in"):
                eod_time_in.setdefault(key, r["time_in"])
                eod_time_in.setdefault(last, r["time_in"])

        # Legacy VA shift_time lookup (only used when contract has no Start Shift)
        shift_lookup: dict[str, str] = {}
        for va in vas:
            key  = va["name"].strip().lower()
            last = key.split()[-1]
            st   = va.get("shift_time", "")
            if st:
                shift_lookup.setdefault(key, st)
                shift_lookup.setdefault(last, st)

        # ── Enrich each clock-in with punctuality ─────────────────
        result = []
        for a in attendance:
            full = a["full_name"].strip().lower()
            last = a["last_name"].strip().lower()

            # Find matching VA
            va = next((v for v in vas if v["name"].strip().lower() in (full, last)), None)

            # Per-client expected start — precedence:
            #   1. EOD Time In (if VA already submitted for today)
            #   2. Matching contract's Start Shift
            #   3. Legacy VA shift_time
            expected_start = eod_time_in.get(full) or eod_time_in.get(last, "")

            if not expected_start and va:
                va_contracts = contracts_by_va.get(va["id"], [])
                for con in va_contracts:
                    is_match, _ = match_client_name(a.get("client", ""), con["client_name"])
                    if is_match:
                        parsed = parse_shift_time(con.get("start_shift", ""))
                        if parsed:
                            expected_start = format_shift_time(*parsed)
                        break

            if not expected_start:
                expected_start = shift_lookup.get(full) or shift_lookup.get(last, "")

            punctuality = clock_in_punctuality(a["created_time"], expected_start)

            result.append({
                **a,
                "punctuality":    punctuality,
                "expected_start": expected_start or "9:00AM",
                "va_community":   va.get("community") if va else "",
            })

        return {
            "date":  date,
            "count": len(result),
            "records": result,
        }
    except Exception as e:
        raise safe_error(e)