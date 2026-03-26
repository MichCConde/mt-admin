# Identical logic to original inspector.py
from fastapi import APIRouter, Query, HTTPException
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date as date_type
from app.notion import (
    get_active_vas, get_eod_for_va, get_attendance_for_date,
    get_all_active_contracts_by_va_id,
)
from app.cache import cache_get, cache_set
import calendar

router = APIRouter()

TTL_PAST_MONTH    = 24 * 60 * 60
TTL_CURRENT_MONTH = 5 * 60


def _cache_key(va_name: str, year: int, month: int) -> str:
    safe = va_name.strip().lower().replace(" ", "_")
    return f"inspector:{safe}:{year}:{month:02d}"


def _is_past_month(year: int, month: int) -> bool:
    today = date_type.today()
    return (year, month) < (today.year, today.month)


def _fetch_attendance_parallel(dates: list[str]) -> dict[str, list]:
    results: dict[str, list] = {}
    with ThreadPoolExecutor(max_workers=min(len(dates), 8)) as pool:
        futures = {pool.submit(get_attendance_for_date, d): d for d in dates}
        for future in as_completed(futures):
            results[futures[future]] = future.result()
    return results


@router.get("/vas")
def list_vas():
    try:
        vas             = get_active_vas()
        contracts_by_va = get_all_active_contracts_by_va_id()
        enriched = []
        for va in vas:
            active_contracts = contracts_by_va.get(va["id"], [])
            enriched.append({
                **va,
                "contract_ids": [c["contract_id"] for c in active_contracts],
                "contracts":    active_contracts,
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
    cache_key = _cache_key(va_name, year, month)
    cached    = cache_get(cache_key)
    if cached is not None:
        return cached

    try:
        vas = get_active_vas()
        va  = next((v for v in vas if v["name"].strip().lower() == va_name.strip().lower()), None)
        if not va:
            raise HTTPException(status_code=404, detail="VA not found or not active.")

        community = va.get("community", "Main")
        reports   = get_eod_for_va(va_name, community, year, month)

        submitted_dates = {r["date"] for r in reports}
        days_in_month   = calendar.monthrange(year, month)[1]
        today           = date_type.today()
        check_dates     = [
            f"{year}-{str(month).zfill(2)}-{str(day).zfill(2)}"
            for day in range(1, days_in_month + 1)
            if date_type(year, month, day) <= today
        ]

        attendance_by_date = _fetch_attendance_parallel(check_dates)

        missing_days = []
        for date_str in check_dates:
            attendance = attendance_by_date.get(date_str, [])
            clocked_in = any(
                a["type"] == "IN" and
                va_name.strip().lower() in a["raw_name"].strip().lower()
                for a in attendance
            )
            if clocked_in and date_str not in submitted_dates:
                missing_days.append(date_str)

        on_time_count = sum(1 for r in reports if r.get("punctuality", {}).get("on_time"))
        late_count    = len(reports) - on_time_count

        result = {
            "va":              va,
            "year":            year,
            "month":           month,
            "reports":         reports,
            "submitted_count": len(reports),
            "missing_days":    missing_days,
            "on_time_count":   on_time_count,
            "late_count":      late_count,
        }

        ttl = TTL_PAST_MONTH if _is_past_month(year, month) else TTL_CURRENT_MONTH
        cache_set(cache_key, result, ttl)
        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))