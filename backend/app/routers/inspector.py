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

# ── Cache TTLs ────────────────────────────────────────────────────
# Past months: data is historical and never changes — cache for 24 hours
TTL_PAST_MONTH    = 24 * 60 * 60
# Current month: data is live — cache for 5 minutes only
TTL_CURRENT_MONTH = 5 * 60


def _inspector_cache_key(va_name: str, year: int, month: int) -> str:
    """Stable Firestore document key for a VA + month combo."""
    safe_name = va_name.strip().lower().replace(" ", "_")
    return f"inspector:{safe_name}:{year}:{month:02d}"


def _is_past_month(year: int, month: int) -> bool:
    """Returns True if the requested month is fully in the past."""
    today = date_type.today()
    return (year, month) < (today.year, today.month)


def _fetch_attendance_parallel(dates: list[str]) -> dict[str, list]:
    """
    Fetch attendance for multiple dates in parallel using a thread pool.
    Returns {date_str: [attendance_records]}.

    Replaces the old sequential loop that made up to 26 Notion calls
    one-at-a-time. All dates now fire simultaneously, reducing wall-clock
    time from ~26 × 800ms → ~1 × 800ms.
    """
    results: dict[str, list] = {}
    with ThreadPoolExecutor(max_workers=min(len(dates), 8)) as pool:
        futures = {pool.submit(get_attendance_for_date, d): d for d in dates}
        for future in as_completed(futures):
            date_str = futures[future]
            results[date_str] = future.result()
    return results


@router.get("/vas")
def list_vas():
    """
    Return all active VA Team VAs for the VA list and dropdowns.
    contract_ids is enriched from the Contracts DB so the badge count is correct.
    """
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
    """
    Return all EOD reports for a VA in a given month plus a missing-day
    analysis. Results are cached in Firestore:
      - Past months: 24-hour TTL (data never changes once the month is over)
      - Current month: 5-minute TTL (still live)
    Attendance is fetched in parallel to avoid 26 sequential Notion calls.
    """
    cache_key = _inspector_cache_key(va_name, year, month)
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

        # Build the list of past dates in this month we need to check
        today      = date_type.today()
        check_dates = [
            f"{year}-{str(month).zfill(2)}-{str(day).zfill(2)}"
            for day in range(1, days_in_month + 1)
            if date_type(year, month, day) <= today
        ]

        # Fetch all attendance in parallel — one thread per day
        attendance_by_date = _fetch_attendance_parallel(check_dates)

        # Find missing days: clocked in but no EOD submitted
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

        # Cache with appropriate TTL based on whether the month is complete
        ttl = TTL_PAST_MONTH if _is_past_month(year, month) else TTL_CURRENT_MONTH
        cache_set(cache_key, result, ttl)

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))