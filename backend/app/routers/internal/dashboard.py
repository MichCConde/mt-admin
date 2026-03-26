# Identical logic to original dashboard.py
from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta
from app.notion import (
    get_active_vas_cached, get_all_active_contracts_by_va_id,
    get_eod_main_for_date, get_eod_cba_for_date,
    va_works_on_date, EST,
)

router = APIRouter()


def prev_workday(d: datetime, offset: int = 1) -> str:
    current = d
    steps   = 0
    while steps < offset:
        current = current - timedelta(days=1)
        if current.weekday() != 6:   # skip Sunday
            steps += 1
    return current.strftime("%Y-%m-%d")


def get_missing_for_date(vas, date_str, contracts_by_va) -> set[str]:
    eod_main = get_eod_main_for_date(date_str)
    eod_cba  = get_eod_cba_for_date(date_str)

    main_idx = {r["name"].lower(): True for r in eod_main}
    cba_idx  = {(r["name"].lower(), r["client"].lower()): True for r in eod_cba}

    missing = set()
    for va in vas:
        if not va_works_on_date(va, date_str):
            continue
        key       = va["name"].strip().lower()
        community = va.get("community", "")

        if community == "Main":
            if not main_idx.get(key):
                missing.add(key)

        elif community == "CBA":
            contracts = contracts_by_va.get(va["id"], [])
            if not contracts:
                if not any(r["name"].lower() == key for r in eod_cba):
                    missing.add(key)
            else:
                for contract in contracts:
                    client_key = contract["client_name"].lower()
                    if not cba_idx.get((key, client_key)):
                        missing.add(key)
                        break

    return missing


@router.get("")
def get_dashboard():
    try:
        now             = datetime.now(tz=EST)
        vas             = get_active_vas_cached()
        contracts_by_va = get_all_active_contracts_by_va_id()

        main_vas = [v for v in vas if v.get("community") == "Main"]
        cba_vas  = [v for v in vas if v.get("community") == "CBA"]

        # CBA client distribution
        client_buckets: dict[int, list[str]] = {1: [], 2: [], 3: [], 4: []}
        for va in cba_vas:
            contracts = contracts_by_va.get(va["id"], [])
            count     = len(contracts) if contracts else 1
            bucket    = min(count, 4)
            client_buckets[bucket].append(va["name"])

        cba_distribution = [
            {"label": "1 Client",   "count": len(client_buckets[1]), "vas": client_buckets[1]},
            {"label": "2 Clients",  "count": len(client_buckets[2]), "vas": client_buckets[2]},
            {"label": "3 Clients",  "count": len(client_buckets[3]), "vas": client_buckets[3]},
            {"label": "4+ Clients", "count": len(client_buckets[4]), "vas": client_buckets[4]},
        ]

        # No-contract VAs
        no_contract_vas = [
            v for v in vas
            if not contracts_by_va.get(v["id"])
        ]

        # Missing reports — yesterday
        yesterday  = prev_workday(now, 1)
        day_before = prev_workday(now, 2)

        missing_yesterday  = get_missing_for_date(vas, yesterday,  contracts_by_va)
        missing_day_before = get_missing_for_date(vas, day_before, contracts_by_va)

        flagged_keys = missing_yesterday & missing_day_before
        flagged_vas  = [v for v in vas if v["name"].strip().lower() in flagged_keys]
        missing_list = [v for v in vas if v["name"].strip().lower() in missing_yesterday]

        return {
            "va_counts": {
                "total":       len(vas),
                "main":        len(main_vas),
                "cba":         len(cba_vas),
                "no_contract": len(no_contract_vas),
            },
            "cba_distribution": cba_distribution,
            "missing": {
                "date":          yesterday,
                "count":         len(missing_yesterday),
                "vas":           missing_list,
                "flagged_count": len(flagged_vas),
                "flagged_vas":   flagged_vas,
            },
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))