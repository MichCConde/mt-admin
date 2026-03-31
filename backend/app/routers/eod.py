from fastapi import APIRouter, Query, HTTPException
from app.notion import (
    get_active_vas, get_active_vas_cached, get_attendance_for_date,
    get_eod_main_for_date, get_eod_cba_for_date,
    get_all_active_contracts_by_va_id, va_works_on_date,
    match_client_name, clock_in_punctuality,
    get_active_contracts_by_id,
)

router = APIRouter()


# ── Name matching helper ──────────────────────────────────────────

def _names_match(va_name: str, eod_name: str) -> bool:
    """
    Check if a VA DB name and an EOD-submitted name refer to the same person.
    Handles middle initials and minor variations.
    "Gillian J. Laguilles" vs "Gillian Laguilles" → True
    """
    va  = va_name.strip().lower().split()
    eod = eod_name.strip().lower().split()
    if not va or not eod:
        return False
    return va[0] == eod[0] and va[-1] == eod[-1]


# ── Original EOD check route ─────────────────────────────────────

@router.get("")
def check_eod(date: str = Query(..., description="YYYY-MM-DD")):
    try:
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

        main_idx: dict[str, list] = {}
        for r in eod_main:
            main_idx.setdefault(r["name"].lower(), []).append(r)

        cba_idx: dict[tuple, list] = {}
        for r in eod_cba:
            cba_idx.setdefault((r["name"].lower(), r["client"].lower()), []).append(r)

        submitted_all, missing = [], []

        for va in vas:
            if not va_works_on_date(va, date):
                continue

            key         = va["name"].strip().lower()
            va_last     = va["name"].strip().split()[-1].lower()
            va_clockins = name_to_clockins.get(key) or name_to_clockins.get(va_last, [])
            clocked_in  = len(va_clockins) > 0
            community   = va.get("community", "")

            if community == "Main":
                reports = main_idx.get(key, [])
                if reports:
                    submitted_all.extend(reports)
                else:
                    missing.append({
                        **va,
                        "clocked_in":     clocked_in,
                        "missing_type":   "clock_in_only" if not clocked_in else "eod_only",
                        "missing_reason": (
                            "No clock-in and no EOD report"
                            if not clocked_in
                            else "Clocked in but no EOD report submitted"
                        ),
                    })

            elif community == "CBA":
                contracts = contracts_by_va.get(va["id"], [])

                if not contracts:
                    reports = [r for r in eod_cba if r["name"].lower() == key]
                    if reports:
                        submitted_all.extend(reports)
                    else:
                        missing.append({
                            **va,
                            "clocked_in":     clocked_in,
                            "missing_type":   "clock_in_only" if not clocked_in else "eod_only",
                            "missing_reason": (
                                "No clock-in and no EOD report"
                                if not clocked_in
                                else "Clocked in but no EOD report submitted"
                            ),
                        })
                    continue

                for contract in contracts:
                    client_key = contract["client_name"].lower()
                    reports    = cba_idx.get((key, client_key), [])

                    contract_clocked_in = False
                    needs_verification  = False
                    for ci in va_clockins:
                        is_match, needs_v = match_client_name(
                            ci["client"], contract["client_name"]
                        )
                        if is_match:
                            contract_clocked_in = True
                            needs_verification  = needs_v
                            break

                    if reports:
                        for r in reports:
                            submitted_all.append({
                                **r,
                                "needs_verification": needs_verification,
                            })
                    else:
                        missing.append({
                            **va,
                            "clocked_in":         contract_clocked_in,
                            "needs_verification": needs_verification,
                            "missing_client":     contract["client_name"],
                            "missing_type":       "clock_in_only" if not contract_clocked_in else "eod_only",
                            "missing_reason": (
                                f"No clock-in and no EOD for client: {contract['client_name']}"
                                if not contract_clocked_in
                                else f"Clocked in but no EOD for client: {contract['client_name']}"
                            ),
                        })

        late = [r for r in submitted_all if not r.get("punctuality", {}).get("on_time", True)]

        return {
            "date":             date,
            "active_va_count":  len(vas),
            "submitted_count":  len(submitted_all),
            "clocked_in_count": len(name_to_clockins),
            "missing_count":    len(missing),
            "late_count":       len(late),
            "eod_submissions":  submitted_all,
            "missing":          missing,
            "late_submissions": late,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Combined Report helpers ───────────────────────────────────────

def _build_report_row(va, client, community, clockin_rec, eod_rec,
                      shift_time_fallback, needs_verification):
    """Build a single row for the combined Reports table."""

    # Per-contract expected start: prefer matched EOD's Time In,
    # then VA's shift time, then default 9 AM
    expected_start = ""
    if eod_rec and eod_rec.get("time_in"):
        expected_start = eod_rec["time_in"]
    if not expected_start:
        expected_start = shift_time_fallback or ""

    # Clock-in
    if clockin_rec:
        ci_p = clock_in_punctuality(clockin_rec["created_time"], expected_start)
        clock_in        = ci_p["clocked_in_est"]
        clock_in_status = ci_p["status"]
        clock_in_late   = ci_p["minutes_late"]
        clock_in_early  = ci_p["minutes_early"]
    else:
        clock_in        = None
        clock_in_status = "missing"
        clock_in_late   = 0
        clock_in_early  = 0

    # Clock-out / EOD submission
    if eod_rec:
        clock_out        = eod_rec["punctuality"]["submitted_est"]
        clock_out_status = eod_rec["punctuality"]["status"]
        clock_out_late   = eod_rec["punctuality"]["minutes_late"]
        clock_out_early  = eod_rec["punctuality"]["minutes_early"]
    else:
        clock_out        = None
        clock_out_status = "missing"
        clock_out_late   = 0
        clock_out_early  = 0

    # Overall status
    statuses = {clock_in_status, clock_out_status}
    if "missing" in statuses:
        status = "missing"
    elif "late" in statuses:
        status = "late"
    elif "early" in statuses:
        status = "early"
    else:
        status = "on_time"

    # Display client
    display_client = client
    if not display_client and eod_rec and eod_rec.get("client"):
        display_client = eod_rec["client"]
    if not display_client and clockin_rec and clockin_rec.get("client"):
        display_client = clockin_rec["client"]

    return {
        "va_name":                 va["name"],
        "client":                  display_client,
        "community":               community,
        "clock_in":                clock_in,
        "clock_in_status":         clock_in_status,
        "clock_in_minutes_late":   clock_in_late,
        "clock_in_minutes_early":  clock_in_early,
        "clock_out":               clock_out,
        "clock_out_status":        clock_out_status,
        "clock_out_minutes_late":  clock_out_late,
        "clock_out_minutes_early": clock_out_early,
        "needs_verification":      needs_verification,
        "status":                  status,
    }


def _fuzzy_find_eod(eod_list: list, client_name: str):
    for r in eod_list:
        is_match, needs_v = match_client_name(r.get("client", ""), client_name)
        if is_match:
            return r, needs_v
    return None, False


def _fuzzy_find_clockin(clockin_list: list, client_name: str):
    for ci in clockin_list:
        is_match, needs_v = match_client_name(ci.get("client", ""), client_name)
        if is_match:
            return ci, needs_v
    return None, False


# ── Combined Report route ─────────────────────────────────────────

@router.get("/report")
def get_combined_report(date: str = Query(..., description="YYYY-MM-DD")):
    try:
        vas        = get_active_vas_cached()
        attendance = get_attendance_for_date(date)
        eod_main   = get_eod_main_for_date(date)
        eod_cba    = get_eod_cba_for_date(date)

        contracts_by_id = get_active_contracts_by_id()

        # ── Index attendance ──────────────────────────────────────
        name_to_clockins: dict[str, list] = {}
        for a in attendance:
            name_to_clockins.setdefault(a["full_name"], []).append(a)
            if a["last_name"] != a["full_name"]:
                name_to_clockins.setdefault(a["last_name"], []).append(a)

        # ── Index EOD reports by VA name ──────────────────────────
        main_eod_by_va: dict[str, list] = {}
        for r in eod_main:
            main_eod_by_va.setdefault(r["name"].strip().lower(), []).append(r)

        cba_eod_by_va: dict[str, list] = {}
        for r in eod_cba:
            cba_eod_by_va.setdefault(r["name"].strip().lower(), []).append(r)

        # ── Shift time fallback (per-VA) ──────────────────────────
        shift_lookup: dict[str, str] = {}
        for va in vas:
            k  = va["name"].strip().lower()
            l  = k.split()[-1]
            st = va.get("shift_time", "")
            if st:
                shift_lookup.setdefault(k, st)
                shift_lookup.setdefault(l, st)

        # ── Build rows ────────────────────────────────────────────
        working_vas = [va for va in vas if va_works_on_date(va, date)]
        rows = []

        for va in working_vas:
            key     = va["name"].strip().lower()
            va_last = key.split()[-1]
            va_cis  = name_to_clockins.get(key) or name_to_clockins.get(va_last, [])
            comm    = va.get("community", "")
            shift_fallback = shift_lookup.get(key) or shift_lookup.get(va_last, "")

            # EOD lookup: exact match, then fuzzy name fallback
            eod_source = main_eod_by_va if comm == "Main" else cba_eod_by_va
            va_eod_list = eod_source.get(key, [])
            if not va_eod_list:
                for eod_name, eod_records in eod_source.items():
                    if _names_match(key, eod_name):
                        va_eod_list = eod_records
                        break

            # Resolve contracts from VA's own relation
            active_contracts = [
                contracts_by_id[cid]
                for cid in va.get("contract_ids", [])
                if cid in contracts_by_id
            ]

            if not active_contracts:
                ci  = va_cis[0] if va_cis else None
                eod = va_eod_list[0] if va_eod_list else None
                rows.append(_build_report_row(
                    va, None, comm, ci, eod, shift_fallback, False
                ))
            else:
                for con in active_contracts:
                    con_client = con["client_name"]
                    con_ci, ci_nv = _fuzzy_find_clockin(va_cis, con_client)
                    con_eod, eod_nv = _fuzzy_find_eod(va_eod_list, con_client)
                    rows.append(_build_report_row(
                        va, con_client, comm,
                        con_ci, con_eod, shift_fallback, ci_nv or eod_nv
                    ))

        # ── Summary stats ─────────────────────────────────────────
        clocked_names = {r["va_name"] for r in rows if r["clock_in_status"] != "missing"}

        return {
            "date": date,
            "rows": rows,
            "stats": {
                "active_vas":    len(working_vas),
                "clocked_in":    len(clocked_names),
                "eod_submitted": sum(1 for r in rows if r["clock_out_status"] != "missing"),
                "missing_eod":   sum(1 for r in rows if r["clock_out_status"] == "missing"),
                "late":          sum(1 for r in rows if r["status"] == "late"),
                "early":         sum(1 for r in rows if r["status"] == "early"),
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))