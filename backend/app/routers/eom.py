from fastapi import APIRouter, Query, HTTPException
from datetime import datetime, date as date_type, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
import calendar
from app.notion import (
    get_active_vas, get_eod_for_va, get_attendance_for_date,
    get_active_contracts_by_id, va_works_on_date,
    match_client_name,
)

router = APIRouter()


def _names_match(va_name: str, eod_name: str) -> bool:
    va  = va_name.strip().lower().split()
    eod = eod_name.strip().lower().split()
    if not va or not eod:
        return False
    return va[0] == eod[0] and va[-1] == eod[-1]


def _workdays_in_month(year: int, month: int) -> list[str]:
    days_in_month = calendar.monthrange(year, month)[1]
    today = date_type.today()
    result = []
    for day in range(1, days_in_month + 1):
        d = date_type(year, month, day)
        if d > today:
            break
        if d.weekday() != 6:  # skip Sunday
            result.append(d.strftime("%Y-%m-%d"))
    return result


def _fetch_attendance_parallel(dates: list[str]) -> dict[str, list]:
    results: dict[str, list] = {}
    with ThreadPoolExecutor(max_workers=min(len(dates), 8)) as pool:
        futures = {pool.submit(get_attendance_for_date, d): d for d in dates}
        for future in as_completed(futures):
            date_str = futures[future]
            results[date_str] = future.result()
    return results


@router.get("/data")
def get_eom_data(
    va_name:   str = Query(...),
    year:      int = Query(...),
    month:     int = Query(...),
):
    """
    Compile all monthly data for a single VA — EOD reports, attendance,
    KPIs (CBA), and computed stats. Returns raw structured data that
    the frontend can send to Claude API for AI-assisted summarization.
    """
    try:
        vas = get_active_vas()
        va  = next(
            (v for v in vas if v["name"].strip().lower() == va_name.strip().lower()),
            None,
        )
        if not va:
            # Fuzzy name fallback
            va = next(
                (v for v in vas if _names_match(va_name, v["name"])),
                None,
            )
        if not va:
            raise HTTPException(status_code=404, detail="VA not found or not active.")

        community = va.get("community", "Main")
        reports   = get_eod_for_va(va["name"], community, year, month)

        # Also try fuzzy name match for reports
        if not reports:
            for v in vas:
                if _names_match(va_name, v["name"]) and v["name"] != va["name"]:
                    reports = get_eod_for_va(v["name"], community, year, month)
                    if reports:
                        break

        # ── Resolve contracts ─────────────────────────────────────
        contracts_by_id = get_active_contracts_by_id()
        active_contracts = [
            contracts_by_id[cid]
            for cid in va.get("contract_ids", [])
            if cid in contracts_by_id
        ]

        # ── Attendance for the month ──────────────────────────────
        workdays = _workdays_in_month(year, month)
        attendance_by_date = _fetch_attendance_parallel(workdays)

        va_key  = va["name"].strip().lower()
        va_last = va_key.split()[-1]

        attendance_records = []
        days_clocked_in    = 0
        days_missing_clock = 0
        late_clockins      = 0
        early_clockins     = 0

        for d in workdays:
            if not va_works_on_date(va, d):
                continue

            day_att = attendance_by_date.get(d, [])
            va_cis  = [
                a for a in day_att
                if a["full_name"] == va_key or a["last_name"] == va_last
            ]

            if va_cis:
                days_clocked_in += 1
                for ci in va_cis:
                    attendance_records.append({
                        "date":   d,
                        "client": ci.get("client", ""),
                        "time":   ci["created_time"],
                        "notes":  ci.get("notes", ""),
                    })
            else:
                days_missing_clock += 1

        # ── Compute stats ─────────────────────────────────────────
        submitted_dates = {r["date"] for r in reports}
        expected_workdays = [
            d for d in workdays if va_works_on_date(va, d)
        ]
        missing_eod_dates = [d for d in expected_workdays if d not in submitted_dates]

        on_time_count = sum(1 for r in reports if r.get("punctuality", {}).get("on_time"))
        late_count    = sum(1 for r in reports if r.get("punctuality", {}).get("status") == "late")
        early_count   = sum(1 for r in reports if r.get("punctuality", {}).get("status") == "early")

        stats = {
            "expected_workdays":  len(expected_workdays),
            "reports_submitted":  len(reports),
            "missing_eod_count":  len(missing_eod_dates),
            "missing_eod_dates":  missing_eod_dates,
            "on_time_submissions": on_time_count,
            "late_submissions":   late_count,
            "early_submissions":  early_count,
            "days_clocked_in":    days_clocked_in,
            "days_missing_clock": days_missing_clock,
        }

        # ── CBA KPIs ─────────────────────────────────────────────
        kpis = None
        if community == "CBA":
            kpis = {
                "total_new_leads":    sum(r.get("new_leads", 0) or 0 for r in reports),
                "total_email_apps":   sum(r.get("email_apps", 0) or 0 for r in reports),
                "total_website_apps": sum(r.get("website_apps", 0) or 0 for r in reports),
                "total_follow_ups":   sum(r.get("follow_ups", 0) or 0 for r in reports),
                "days_with_reports":  len(reports),
            }
            if kpis["days_with_reports"] > 0:
                d = kpis["days_with_reports"]
                kpis["avg_new_leads"]    = round(kpis["total_new_leads"]    / d, 1)
                kpis["avg_email_apps"]   = round(kpis["total_email_apps"]   / d, 1)
                kpis["avg_website_apps"] = round(kpis["total_website_apps"] / d, 1)
                kpis["avg_follow_ups"]   = round(kpis["total_follow_ups"]   / d, 1)

        # ── Collect text content for AI summarization ─────────────
        daily_entries = []
        for r in reports:
            entry = {
                "date":   r["date"],
                "client": r.get("client", ""),
            }
            if community == "Main":
                entry["task_completed"] = r.get("task_completed", "")
                entry["daily_summary"]  = r.get("daily_summary", "")
            elif community == "CBA":
                entry["daily_summary"]    = r.get("daily_summary", "")
                entry["total_responses"]  = r.get("total_responses", "")
                entry["other_admin"]      = r.get("other_admin", "")
                entry["new_leads"]        = r.get("new_leads", 0)
                entry["email_apps"]       = r.get("email_apps", 0)
                entry["website_apps"]     = r.get("website_apps", 0)
                entry["follow_ups"]       = r.get("follow_ups", 0)
            daily_entries.append(entry)

        return {
            "va":               va,
            "community":        community,
            "year":             year,
            "month":            month,
            "contracts":        active_contracts,
            "stats":            stats,
            "kpis":             kpis,
            "daily_entries":    daily_entries,
            "attendance":       attendance_records,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))