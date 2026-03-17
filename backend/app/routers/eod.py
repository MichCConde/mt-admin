# ════════════════════════════════════════════════════════════════
# backend/app/routers/eod.py
# ════════════════════════════════════════════════════════════════
from fastapi import APIRouter, Query, HTTPException
from app.notion import (
    get_active_vas, get_attendance_for_date,
    get_eod_main_for_date, get_eod_cba_for_date,
    get_active_contracts_for_va,
)

router = APIRouter()

@router.get("/")
def check_eod(date: str = Query(..., description="YYYY-MM-DD")):
    try:
        vas        = get_active_vas()          # Active + VA Team only
        attendance = get_attendance_for_date(date)
        eod_main   = get_eod_main_for_date(date)
        eod_cba    = get_eod_cba_for_date(date)

        clock_ins     = [a for a in attendance if a["type"] == "IN"]
        clocked_names = {a["raw_name"].strip().lower() for a in clock_ins}

        # Index by name (Main) and (name, client) (CBA)
        main_idx: dict[str, list] = {}
        for r in eod_main:
            main_idx.setdefault(r["name"].lower(), []).append(r)

        cba_idx: dict[tuple, list] = {}
        for r in eod_cba:
            cba_idx.setdefault((r["name"].lower(), r["client"].lower()), []).append(r)

        submitted_all, missing = [], []

        for va in vas:
            key        = va["name"].strip().lower()
            clocked_in = key in clocked_names
            community  = va.get("community", "")

            if community == "Main":
                reports = main_idx.get(key, [])
                if reports:
                    submitted_all.extend(reports)
                else:
                    missing.append({**va, "clocked_in": clocked_in,
                                    "missing_reason": "No EOD report submitted"})

            elif community == "CBA":
                contracts = get_active_contracts_for_va(va.get("contract_ids", []))

                if not contracts:
                    # No contracts linked — single report check
                    reports = [r for r in eod_cba if r["name"].lower() == key]
                    if reports: submitted_all.extend(reports)
                    else:
                        missing.append({**va, "clocked_in": clocked_in,
                                        "missing_reason": "No EOD report submitted"})
                    continue

                for contract in contracts:
                    client_key = contract["client_name"].lower()
                    reports    = cba_idx.get((key, client_key), [])
                    if reports:
                        submitted_all.extend(reports)
                    else:
                        missing.append({
                            **va,
                            "clocked_in":    clocked_in,
                            "missing_client": contract["client_name"],
                            "missing_reason": f"No EOD for client: {contract['client_name']}",
                        })

        late = [r for r in submitted_all if not r.get("punctuality", {}).get("on_time", True)]

        return {
            "date":             date,
            "active_va_count":  len(vas),
            "submitted_count":  len(submitted_all),
            "clocked_in_count": len(clock_ins),
            "missing_count":    len(missing),
            "late_count":       len(late),
            "eod_submissions":  submitted_all,
            "missing":          missing,
            "late_submissions": late,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


