from fastapi import APIRouter, Query, HTTPException
from app.notion import (
    get_active_vas, get_eod_for_va, get_attendance_for_date,
    get_all_active_contracts_by_va_id,
)
from datetime import date as date_type
import calendar

router = APIRouter()


@router.get("/vas")
def list_vas():
    """
    Return all active VA Team VAs for the VA list and dropdowns.
    contract_ids is enriched from the Contracts DB (queried from that side)
    so the frontend badge shows the correct client count.
    """
    try:
        vas             = get_active_vas()
        contracts_by_va = get_all_active_contracts_by_va_id()

        enriched = []
        for va in vas:
            active_contracts = contracts_by_va.get(va["id"], [])
            enriched.append({
                **va,
                # Override contract_ids with the IDs we actually found
                # so VAListRow can use .length for the badge count
                "contract_ids": [c["contract_id"] for c in active_contracts],
                "contracts":    active_contracts,   # full data for any downstream use
            })

        return {"vas": enriched}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("")
def inspect_va(
    va_name: str = Query(...),
    year:    int = Query(...),
    month:   int = Query(...),
):
    """
    Return all EOD reports for a VA in a given month,
    plus a missing-day analysis comparing against days they clocked in.
    """
    try:
        vas = get_active_vas()
        va  = next((v for v in vas if v["name"].strip().lower() == va_name.strip().lower()), None)
        if not va:
            raise HTTPException(status_code=404, detail="VA not found or not active.")

        community = va.get("community", "Main")
        reports   = get_eod_for_va(va_name, community, year, month)

        submitted_dates = {r["date"] for r in reports}

        days_in_month = calendar.monthrange(year, month)[1]
        missing_days  = []

        for day in range(1, days_in_month + 1):
            date_str = f"{year}-{str(month).zfill(2)}-{str(day).zfill(2)}"
            if date_type(year, month, day) > date_type.today():
                continue
            attendance = get_attendance_for_date(date_str)
            clocked_in = any(
                a["type"] == "IN" and
                va_name.strip().lower() in a["raw_name"].strip().lower()
                for a in attendance
            )
            if clocked_in and date_str not in submitted_dates:
                missing_days.append(date_str)

        on_time_count = sum(1 for r in reports if r.get("punctuality", {}).get("on_time"))
        late_count    = len(reports) - on_time_count

        return {
            "va":              va,
            "year":            year,
            "month":           month,
            "reports":         reports,
            "submitted_count": len(reports),
            "missing_days":    missing_days,
            "on_time_count":   on_time_count,
            "late_count":      late_count,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))