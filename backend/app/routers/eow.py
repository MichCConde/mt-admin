from fastapi import APIRouter, Query, HTTPException
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
from app.notion import (
    get_active_vas,
    get_attendance_for_date,
    get_eod_main_for_date, get_eod_cba_for_date,
    get_active_contracts_by_id,
    match_client_name,
    EST,
)
from app.services.matching import names_match, fuzzy_find_eod

router = APIRouter()

# ── Keywords that signal a client issue ───────────────────────────
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
            r.get("name",         "").lower(),
            r.get("client",       "").lower(),
            r.get("time_in",      "").strip(),
            r.get("time_out",     "").strip(),
            str(r.get("new_leads",    "")),
            str(r.get("email_apps",   "")),
            str(r.get("website_apps", "")),
            str(r.get("follow_ups",   "")),
        )
        has_content = any([
            r.get("time_in"), r.get("time_out"),
            r.get("new_leads"), r.get("email_apps"),
            r.get("website_apps"), r.get("follow_ups"),
        ])
        if has_content and sig in seen:
            flagged.append({**r, "duplicate_of": seen[sig]})
        else:
            seen[sig] = r["date"]
    return flagged


# ── Parallel week fetcher ─────────────────────────────────────────

def _fetch_day(date_str: str) -> tuple[str, list, list, list]:
    attendance = get_attendance_for_date(date_str)
    eod_main   = get_eod_main_for_date(date_str)
    eod_cba    = get_eod_cba_for_date(date_str)
    return date_str, attendance, eod_main, eod_cba


def fetch_week_data(workdays: list[str]) -> tuple[dict, dict, dict]:
    week_attendance: dict[str, list] = {}
    week_eod_main:   dict[str, list] = {}
    week_eod_cba:    dict[str, list] = {}

    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = {pool.submit(_fetch_day, d): d for d in workdays}
        for future in as_completed(futures):
            date_str, attendance, eod_main, eod_cba = future.result()
            week_attendance[date_str] = attendance
            week_eod_main[date_str]   = eod_main
            week_eod_cba[date_str]    = eod_cba

    return week_attendance, week_eod_main, week_eod_cba


# ── Fuzzy EOD finders (per-day) ───────────────────────────────────

def _find_va_eod_for_day(eod_list: list, full_key: str) -> list:
    """Find all EOD records for a VA in a single day's EOD list, with fuzzy name fallback."""
    exact = [r for r in eod_list if r["name"].strip().lower() == full_key]
    if exact:
        return exact
    return [r for r in eod_list if names_match(full_key, r["name"])]


def _find_va_eod_for_client(va_eod_list: list, client_name: str):
    """Find a single EOD record matching a specific client (fuzzy)."""
    for r in va_eod_list:
        is_match, _ = match_client_name(r.get("client", ""), client_name)
        if is_match:
            return r
    return None


# ── Route ─────────────────────────────────────────────────────────

@router.get("")
def get_eow_report(
    start: str = Query(..., description="YYYY-MM-DD — Monday of the week"),
    end:   str = Query(..., description="YYYY-MM-DD — Saturday of the week"),
):
    try:
        vas              = get_active_vas()
        contracts_by_id  = get_active_contracts_by_id()
        workdays         = workdays_in_range(start, end)

        week_attendance, week_eod_main, week_eod_cba = fetch_week_data(workdays)

        va_summaries = []
        all_flags    = []

        for va in vas:
            full_key  = va["name"].strip().lower()
            va_last   = full_key.split()[-1]
            community = va.get("community", "")

            # Resolve contracts from VA's own relation (same as /report)
            active_contracts = [
                contracts_by_id[cid]
                for cid in va.get("contract_ids", [])
                if cid in contracts_by_id
            ]

            daily      = []
            va_all_eod = []

            for d in workdays:
                att = week_attendance[d]

                # Match attendance by full_name with last_name fallback
                va_clockins = [
                    a for a in att
                    if a["full_name"] == full_key or a["last_name"] == va_last
                ]
                clocked_in  = len(va_clockins) > 0

                clock_notes = " ".join(
                    a.get("notes", "") for a in va_clockins
                )

                # Get this VA's EOD records for the day (fuzzy name match)
                eod_source = week_eod_main[d] if community == "Main" else week_eod_cba[d]
                va_day_eod = _find_va_eod_for_day(eod_source, full_key)

                if not active_contracts:
                    # No contracts — single row per day
                    va_all_eod.extend(va_day_eod)
                    daily.append({
                        "date":          d,
                        "clocked_in":    clocked_in,
                        "eod_submitted": len(va_day_eod) > 0,
                        "reports":       va_day_eod,
                        "keyword_flags": list(set(detect_keyword_flags(clock_notes))),
                        "client":        None,
                    })
                else:
                    # One entry per contract per day
                    for con in active_contracts:
                        con_client = con["client_name"]

                        # Per-contract clock-in (fuzzy)
                        contract_clocked_in = False
                        needs_verification  = False
                        for ci in va_clockins:
                            is_match, needs_v = match_client_name(
                                ci.get("client", ""), con_client
                            )
                            if is_match:
                                contract_clocked_in = True
                                needs_verification  = needs_v
                                break

                        # Per-contract EOD (fuzzy)
                        con_eod = fuzzy_find_eod(va_day_eod, con_client)
                        reports = [con_eod] if con_eod else []
                        va_all_eod.extend(reports)

                        daily.append({
                            "date":               d,
                            "clocked_in":         contract_clocked_in,
                            "eod_submitted":      len(reports) > 0,
                            "reports":            reports,
                            "keyword_flags":      list(set(detect_keyword_flags(clock_notes))),
                            "client":             con_client,
                            "needs_verification": needs_verification,
                        })

            duplicates   = detect_duplicate_eod(va_all_eod)
            missing_days = [e for e in daily if not e["eod_submitted"]]
            no_clockin   = [e for e in daily if not e["clocked_in"]]
            all_kw_flags = list({f for e in daily for f in e["keyword_flags"]})
            unique_days  = list({e["date"] for e in daily})

            contract_slots = max(len(active_contracts), 1)

            va_summaries.append({
                "va":             va,
                "community":      community,
                "daily":          daily,
                "contract_slots": contract_slots,
                "stats": {
                    "total_days":       len(workdays),
                    "submitted_count":  len(unique_days) - len({e["date"] for e in missing_days}),
                    "missing_count":    len({e["date"] for e in missing_days}),
                    "no_clockin_count": len({e["date"] for e in no_clockin}),
                    "late_count": sum(
                        1 for e in daily
                        for r in e["reports"]
                        if not r.get("punctuality", {}).get("on_time", True)
                    ),
                    "duplicate_count": len(duplicates),
                    "flag_count":      len(all_kw_flags) + len(duplicates),
                },
                "flags": {
                    "keywords":   all_kw_flags,
                    "duplicates": duplicates,
                },
            })

            if all_kw_flags or duplicates:
                all_flags.append({
                    "va_name":    va["name"],
                    "community":  community,
                    "keywords":   all_kw_flags,
                    "duplicates": len(duplicates),
                })

        va_summaries.sort(key=lambda x: -x["stats"]["flag_count"])

        total_possible_eod      = sum(s["contract_slots"] * s["stats"]["total_days"] for s in va_summaries)
        total_possible_clockins = len(vas) * len(workdays)

        return {
            "start":        start,
            "end":          end,
            "workdays":     workdays,
            "total_vas":    len(vas),
            "va_summaries": va_summaries,
            "flags":        all_flags,
            "totals": {
                "missing_eod":       sum(s["stats"]["missing_count"]    for s in va_summaries),
                "possible_eod":      total_possible_eod,
                "no_clockin":        sum(s["stats"]["no_clockin_count"] for s in va_summaries),
                "possible_clockins": total_possible_clockins,
                "late":              sum(s["stats"]["late_count"]       for s in va_summaries),
                "duplicates":        sum(s["stats"]["duplicate_count"]  for s in va_summaries),
                "keyword_flags":     sum(len(s["flags"]["keywords"])    for s in va_summaries),
            },
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))