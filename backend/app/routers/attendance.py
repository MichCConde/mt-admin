from fastapi import APIRouter, Query, HTTPException
from app.notion import (
    get_active_vas_cached, get_attendance_for_date,
    get_eod_main_for_date, get_eod_cba_for_date,
    get_all_active_contracts_by_va_id,
    clock_in_punctuality, match_client_name,
)

router = APIRouter()

@router.get("")
def check_attendance(date: str = Query(..., description="YYYY-MM-DD")):
    try:
        vas             = get_active_vas_cached()
        contracts_by_va = get_all_active_contracts_by_va_id()
        attendance      = get_attendance_for_date(date)
        eod_main        = get_eod_main_for_date(date)
        eod_cba         = get_eod_cba_for_date(date)

        # ── Index attendance by full_name + last_name fallback ────
        # All records are clock-ins — no "type" field exists anymore.
        name_to_clockins: dict[str, list] = {}
        for a in attendance:
            name_to_clockins.setdefault(a["full_name"], []).append(a)
            if a["last_name"] != a["full_name"]:
                name_to_clockins.setdefault(a["last_name"], []).append(a)

        # ── Build Time In lookup from EOD submissions ─────────────
        # Keyed by full_name (lowered) with last_name fallback
        eod_time_in: dict[str, str] = {}
        for r in [*eod_main, *eod_cba]:
            key  = r["name"].strip().lower()
            last = key.split()[-1]
            if r.get("time_in"):
                if key not in eod_time_in:
                    eod_time_in[key] = r["time_in"]
                if last not in eod_time_in:
                    eod_time_in[last] = r["time_in"]

        # Fallback: shift time from VA record
        shift_lookup: dict[str, str] = {}
        for va in vas:
            key  = va["name"].strip().lower()
            last = key.split()[-1]
            st   = va.get("shift_time", "")
            if st:
                shift_lookup.setdefault(key, st)
                shift_lookup.setdefault(last, st)

        # ── Enrich each clock-in with punctuality + VA match ──────
        clock_ins_out = []
        verify_count  = 0

        for c in attendance:
            fn   = c["full_name"]
            ln   = c["last_name"]
            time_in = (
                eod_time_in.get(fn) or eod_time_in.get(ln)
                or shift_lookup.get(fn) or shift_lookup.get(ln, "")
            )

            # Resolve the matched VA name for display
            va_name = None
            needs_verification = False
            for va in vas:
                vk = va["name"].strip().lower()
                vl = vk.split()[-1]
                if fn == vk or ln == vl:
                    va_name = va["name"]
                    community = va.get("community", "")

                    # For CBA VAs, check per-contract client match
                    if community == "CBA" and c.get("client"):
                        contracts = contracts_by_va.get(va["id"], [])
                        for contract in contracts:
                            is_match, needs_v = match_client_name(
                                c["client"], contract["client_name"]
                            )
                            if is_match:
                                needs_verification = needs_v
                                break
                    break

            if needs_verification:
                verify_count += 1

            clock_ins_out.append({
                **c,
                "va_name":            va_name,
                "needs_verification": needs_verification,
                "punctuality":        clock_in_punctuality(c["created_time"], time_in),
            })

        # ── VAs with no clock-in record ───────────────────────────
        no_record = []
        for va in vas:
            vk = va["name"].strip().lower()
            vl = vk.split()[-1]
            if not (name_to_clockins.get(vk) or name_to_clockins.get(vl)):
                no_record.append(va)

        late_clock_ins = [c for c in clock_ins_out if not c["punctuality"]["on_time"]]

        return {
            "date":           date,
            "vas":            vas,
            "clock_ins":      clock_ins_out,
            "no_record":      no_record,
            "late_count":     len(late_clock_ins),
            "late_clock_ins": late_clock_ins,
            "verify_count":   verify_count,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))