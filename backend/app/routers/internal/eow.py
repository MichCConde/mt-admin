from fastapi import APIRouter, Depends, Query, HTTPException
from concurrent.futures import ThreadPoolExecutor
from app.middleware.auth import verify_token
from app.notion import (
    get_eod_main_for_range, get_eod_cba_for_range,
    get_attendance_for_range, get_active_vas, get_all_schedules,
)
from app.services import detect_duplicate_eod, detect_keyword_flags
from app.services.duplicate_detector import group_reports_by_va
from app.services.eod_checker import check_missing_eod, check_missing_attendance
from app.cache import cache_get, cache_set, FOREVER, TTL_15MIN
from datetime import date, timedelta
import logging

router = APIRouter(prefix="/api/internal/eow", tags=["internal-eow"])
log    = logging.getLogger(__name__)


def _week_range(year: int, week: int) -> tuple[str, str]:
    mon = date.fromisocalendar(year, week, 1)
    sat = mon + timedelta(days=5)
    return mon.isoformat(), sat.isoformat()


@router.get("")
async def get_eow_report(
    year:  int  = Query(default=None),
    week:  int  = Query(default=None),
    force: bool = Query(default=False),
    user=Depends(verify_token),
):
    today  = date.today()
    y      = year or today.isocalendar().year
    w      = week or today.isocalendar().week
    start, end = _week_range(y, w)
    is_current = (today <= date.fromisoformat(end))

    cache_key = f"eow:{y}:{w}"
    ttl       = TTL_15MIN if is_current else FOREVER

    if not force:
        cached = cache_get(cache_key)
        if cached:
            return {"week": w, "year": y, "start": start, "end": end,
                    "data": cached, "cached": True}

    try:
        # Batch fetch — 2 Notion calls for EOD instead of 12, 1 for attendance
        with ThreadPoolExecutor(max_workers=4) as ex:
            f_main   = ex.submit(get_eod_main_for_range, start, end)
            f_cba    = ex.submit(get_eod_cba_for_range,  start, end)
            f_att    = ex.submit(get_attendance_for_range, start, end)
            f_vas    = ex.submit(get_active_vas)
            f_sched  = ex.submit(get_all_schedules)

        main_reports = f_main.result()
        cba_reports  = f_cba.result()
        attendance   = f_att.result()
        vas          = f_vas.result()
        schedules    = f_sched.result()

        all_reports = main_reports + cba_reports

        # Group by date for per-day analysis
        days = {}
        current = date.fromisoformat(start)
        finish  = date.fromisoformat(end)
        while current <= finish:
            d_str    = current.isoformat()
            day_rpts = [r for r in all_reports  if r["date"] == d_str]
            day_att  = [a for a in attendance    if a["date"] == d_str]
            days[d_str] = {
                "reports":             day_rpts,
                "attendance":          day_att,
                "missing_eod":         check_missing_eod(d_str, vas, day_rpts, schedules),
                "missing_attendance":  check_missing_attendance(d_str, vas, day_att, schedules),
            }
            current += timedelta(days=1)

        grouped    = group_reports_by_va(all_reports)
        duplicates = detect_duplicate_eod(grouped)
        flags      = detect_keyword_flags(all_reports)

        data = {
            "days":       days,
            "duplicates": duplicates,
            "flags":      flags,
            "summary": {
                "total_reports":     len(all_reports),
                "total_duplicates":  len(duplicates),
                "total_flags":       len(flags),
            }
        }
        cache_set(cache_key, data, ttl)
        return {"week": w, "year": y, "start": start, "end": end,
                "data": data, "cached": False}

    except Exception as e:
        log.exception("EOW report error")
        raise HTTPException(status_code=500, detail=str(e))