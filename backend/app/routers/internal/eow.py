# Identical logic to original eow.py
from fastapi import APIRouter, Query, HTTPException
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
from app.notion import (
    get_active_vas, get_all_active_contracts_by_va_id,
    get_attendance_for_date, get_eod_main_for_date, get_eod_cba_for_date, EST,
)

router = APIRouter()

CLIENT_ISSUE_KEYWORDS = [
    "unresponsive", "no response", "not responding", "unreachable",
    "ghosting", "no reply", "did not respond", "hasn't responded",
    "haven't heard", "no feedback", "no answer", "unavailable",
    "out of office", "on leave",
]


def workdays_in_range(start: str, end: str) -> list[str]:
    result  = []
    current = datetime.strptime(start, "%Y-%m-%d").date()
    end_d   = datetime.strptime(end,   "%Y-%m-%d").date()
    while current <= end_d:
        if current.weekday() != 6:
            result.append(current.strftime("%Y-%m-%d"))
        current += timedelta(days=1)
    return result


def _last_name(full_name: str) -> str:
    return full_name.strip().split()[-1].lower()


def detect_keyword_flags(text: str) -> list[str]:
    if not text:
        return []
    lower = text.lower()
    return [kw for kw in CLIENT_ISSUE_KEYWORDS if kw in lower]


def detect_duplicate_eod(reports: list[dict]) -> list[dict]:
    seen: dict[tuple, str] = {}
    flagged = []
    for r in sorted(reports, key=lambda x: x["date"]):
        sig = (
            r.get("name", "").lower(),
            r.get("client", "").lower(),
            r.get("time_in", "").strip(),
            r.get("time_out", "").strip(),
            str(r.get("new_leads", "")),
            str(r.get("email_apps", "")),
            str(r.get("website_apps", "")),
            str(r.get("follow_ups", "")),
        )
        has_content = any([r.get("time_in"), r.get("time_out"), r.get("new_leads"),
                           r.get("email_apps"), r.get("website_apps"), r.get("follow_ups")])
        if has_content and sig in seen:
            flagged.append({**r, "duplicate_of": seen[sig]})
        else:
            seen[sig] = r["date"]
    return flagged


def _fetch_day(date_str: str):
    return date_str, get_attendance_for_date(date_str), get_eod_main_for_date(date_str), get_eod_cba_for_date(date_str)


def fetch_week_data(workdays: list[str]):
    week_att, week_main, week_cba = {}, {}, {}
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = {pool.submit(_fetch_day, d): d for d in workdays}
        for future in as_completed(futures):
            d, att, main, cba = future.result()
            week_att[d]  = att
            week_main[d] = main
            week_cba[d]  = cba
    return week_att, week_main, week_cba


@router.get("")
def get_eow_report(
    start: str = Query(..., description="YYYY-MM-DD — Monday"),
    end:   str = Query(..., description="YYYY-MM-DD — Saturday"),
):
    try:
        vas             = get_active_vas()
        contracts_by_va = get_all_active_contracts_by_va_id()
        workdays        = workdays_in_range(start, end)

        week_att, week_main, week_cba = fetch_week_data(workdays)

        va_summaries = []
        all_flags    = []

        for va in vas:
            full_key  = va["name"].strip().lower()
            last      = _last_name(va["name"])
            community = va.get("community", "")
            contracts = contracts_by_va.get(va["id"], []) if community == "CBA" else []

            daily, va_all_eod = [], []

            for d in workdays:
                att       = week_att[d]
                clock_ins = [a for a in att if a["type"] == "IN"]
                clocked_in = any(a["last_name"] == last for a in clock_ins)
                clock_notes = " ".join(a.get("notes", "") for a in clock_ins if a["last_name"] == last)

                if community == "Main":
                    reports = [r for r in week_main[d] if r["name"].strip().lower() == full_key]
                    va_all_eod.extend(reports)
                    daily.append({
                        "date": d, "clocked_in": clocked_in,
                        "eod_submitted": len(reports) > 0, "reports": reports,
                        "keyword_flags": list(set(detect_keyword_flags(clock_notes))),
                        "client": None,
                    })

                elif community == "CBA":
                    if not contracts:
                        reports = [r for r in week_cba[d] if r["name"].strip().lower() == full_key]
                        va_all_eod.extend(reports)
                        daily.append({
                            "date": d, "clocked_in": clocked_in,
                            "eod_submitted": len(reports) > 0, "reports": reports,
                            "keyword_flags": list(set(detect_keyword_flags(clock_notes))),
                            "client": None,
                        })
                    else:
                        for contract in contracts:
                            client_key = contract["client_name"].lower()
                            reports = [
                                r for r in week_cba[d]
                                if r["name"].strip().lower() == full_key
                                and r.get("client", "").strip().lower() == client_key
                            ]
                            va_all_eod.extend(reports)
                            daily.append({
                                "date": d, "clocked_in": clocked_in,
                                "eod_submitted": len(reports) > 0, "reports": reports,
                                "keyword_flags": list(set(detect_keyword_flags(clock_notes))),
                                "client": contract["client_name"],
                            })

            duplicates   = detect_duplicate_eod(va_all_eod)
            missing_days = [e for e in daily if not e["eod_submitted"]]
            no_clockin   = [e for e in daily if not e["clocked_in"]]
            all_kw_flags = list({f for e in daily for f in e["keyword_flags"]})
            unique_days  = list({e["date"] for e in daily})
            contract_slots = max(len(contracts), 1) if community == "CBA" else 1

            va_summaries.append({
                "va": va, "community": community, "daily": daily,
                "contract_slots": contract_slots,
                "stats": {
                    "total_days":       len(workdays),
                    "submitted_count":  len(unique_days) - len({e["date"] for e in missing_days}),
                    "missing_count":    len({e["date"] for e in missing_days}),
                    "no_clockin_count": len({e["date"] for e in no_clockin}),
                    "late_count": sum(
                        1 for e in daily for r in e["reports"]
                        if not r.get("punctuality", {}).get("on_time", True)
                    ),
                    "duplicate_count": len(duplicates),
                    "flag_count":      len(all_kw_flags) + len(duplicates),
                },
                "flags": {"keywords": all_kw_flags, "duplicates": duplicates},
            })

            if all_kw_flags or duplicates:
                all_flags.append({
                    "va_name": va["name"], "community": community,
                    "keywords": all_kw_flags, "duplicates": len(duplicates),
                })

        va_summaries.sort(key=lambda x: -x["stats"]["flag_count"])

        return {
            "start": start, "end": end, "workdays": workdays,
            "total_vas": len(vas),
            "va_summaries": va_summaries,
            "flags": all_flags,
            "totals": {
                "missing_eod":       sum(s["stats"]["missing_count"]    for s in va_summaries),
                "possible_eod":      sum(s["contract_slots"] * s["stats"]["total_days"] for s in va_summaries),
                "no_clockin":        sum(s["stats"]["no_clockin_count"] for s in va_summaries),
                "possible_clockins": len(vas) * len(workdays),
                "late":              sum(s["stats"]["late_count"]       for s in va_summaries),
                "duplicates":        sum(s["stats"]["duplicate_count"]  for s in va_summaries),
                "keyword_flags":     sum(len(s["flags"]["keywords"])    for s in va_summaries),
            },
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))