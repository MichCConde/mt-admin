from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta
from app.notion import (
    get_active_vas, get_active_vas_cached, get_active_contracts_for_va,
    get_eod_main_for_date, get_eod_cba_for_date,
    EST,
)

router = APIRouter()


def prev_workday(d: datetime, offset: int = 1) -> str:
    """
    Go back `offset` workdays (Mon–Sat) from d and return YYYY-MM-DD.
    Skips Sunday since VAs don't submit EOD reports on Sundays.
    """
    current = d
    steps = 0
    while steps < offset:
        current = current - timedelta(days=1)
        if current.weekday() != 6:   # 6 = Sunday
            steps += 1
    return current.strftime("%Y-%m-%d")


def get_missing_for_date(vas: list, date_str: str) -> set[str]:
    """
    Returns a set of VA names (lowercased) who are missing EOD
    reports for the given date.
    """
    eod_main = get_eod_main_for_date(date_str)
    eod_cba  = get_eod_cba_for_date(date_str)

    main_idx: dict[str, bool] = {r["name"].lower(): True for r in eod_main}
    cba_idx:  dict[tuple, bool] = {
        (r["name"].lower(), r["client"].lower()): True for r in eod_cba
    }

    missing = set()

    for va in vas:
        key       = va["name"].strip().lower()
        community = va.get("community", "")

        if community == "Main":
            if not main_idx.get(key):
                missing.add(key)

        elif community == "CBA":
            contracts = get_active_contracts_for_va(va.get("contract_ids", []))
            if not contracts:
                # No contracts — single report check
                if not any(r["name"].lower() == key for r in eod_cba):
                    missing.add(key)
            else:
                # Missing if ANY contract has no report
                for contract in contracts:
                    client_key = contract["client_name"].lower()
                    if not cba_idx.get((key, client_key)):
                        missing.add(key)
                        break

    return missing


@router.get("")
def get_dashboard():
    try:
        now  = datetime.now(tz=EST)
        vas  = get_active_vas_cached()

        # ── VA counts ─────────────────────────────────────────────
        main_vas = [v for v in vas if v.get("community") == "Main"]
        cba_vas  = [v for v in vas if v.get("community") == "CBA"]

        # ── CBA client distribution ───────────────────────────────
        client_buckets = {1: [], 2: [], 3: [], 4: []}

        for va in cba_vas:
            raw_ids   = va.get("contract_ids", [])
            contracts = get_active_contracts_for_va(raw_ids)

            # Prefer active contract count; fall back to raw relation count
            # so VAs with contracts aren't silently bucketed as "1 client"
            # if get_active_contracts_for_va fails or returns empty.
            if contracts:
                count = len(contracts)
            elif raw_ids:
                count = len(raw_ids)   # raw fallback — includes inactive contracts
            else:
                count = 1              # truly no contract data

            bucket = min(count, 4)     # cap at 4+
            client_buckets[bucket].append(va["name"])

        cba_distribution = [
            { "label": "1 Client",    "count": len(client_buckets[1]), "vas": client_buckets[1] },
            { "label": "2 Clients",   "count": len(client_buckets[2]), "vas": client_buckets[2] },
            { "label": "3 Clients",   "count": len(client_buckets[3]), "vas": client_buckets[3] },
            { "label": "4+ Clients",  "count": len(client_buckets[4]), "vas": client_buckets[4] },
        ]

        # ── Missing reports — yesterday ───────────────────────────
        yesterday      = prev_workday(now, 1)
        day_before     = prev_workday(now, 2)

        missing_yesterday  = get_missing_for_date(vas, yesterday)
        missing_day_before = get_missing_for_date(vas, day_before)

        # Flagged = missed BOTH days (2+ consecutive misses)
        flagged_keys  = missing_yesterday & missing_day_before
        flagged_vas   = [v for v in vas if v["name"].strip().lower() in flagged_keys]
        missing_list  = [v for v in vas if v["name"].strip().lower() in missing_yesterday]

        return {
            "va_counts": {
                "total": len(vas),
                "main":  len(main_vas),
                "cba":   len(cba_vas),
            },
            "cba_distribution": cba_distribution,
            "missing": {
                "date":         yesterday,
                "count":        len(missing_yesterday),
                "vas":          missing_list,
                "flagged_count": len(flagged_vas),
                "flagged_vas":  flagged_vas,
            },
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))