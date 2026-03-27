from fastapi import APIRouter, Query, HTTPException
from app.notion import (
    get_active_vas, get_active_vas_cached, get_attendance_for_date,
    get_eod_main_for_date, get_eod_cba_for_date,
    get_all_active_contracts_by_va_id, va_works_on_date,
    match_client_name,                              # ← 1. added import
)

router = APIRouter()


@router.get("")
def check_eod(date: str = Query(..., description="YYYY-MM-DD")):
    try:
        vas             = get_active_vas_cached()
        contracts_by_va = get_all_active_contracts_by_va_id()
        attendance      = get_attendance_for_date(date)
        eod_main        = get_eod_main_for_date(date)
        eod_cba         = get_eod_cba_for_date(date)

        # ← 2. removed type/last_name filter, replaced with full_name lookup
        name_to_clockins: dict[str, list] = {}
        for a in attendance:
            name_to_clockins.setdefault(a["full_name"], []).append(a)

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

            key        = va["name"].strip().lower()
            va_clockins = name_to_clockins.get(key, [])
            clocked_in  = len(va_clockins) > 0          # ← 3. full_name match
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

                    # ← 4. per-contract clock-in with fuzzy match
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
            "clocked_in_count": len(name_to_clockins),  # ← updated count source
            "missing_count":    len(missing),
            "late_count":       len(late),
            "eod_submissions":  submitted_all,
            "missing":          missing,
            "late_submissions": late,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))