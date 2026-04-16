from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta
from app.notion import (
    get_active_vas_cached,
    get_all_active_contracts_by_va_id,
    get_active_contract_id_set,
    get_eod_main_for_date, get_eod_cba_for_date,
    get_attendance_for_date,
    va_works_on_date,
    match_client_name,
    to_est, EST,
)
from app.services.matching import names_match

router = APIRouter()


def prev_workday(d: datetime, offset: int = 1) -> str:
    current = d
    steps = 0
    while steps < offset:
        current = current - timedelta(days=1)
        if current.weekday() != 6:
            steps += 1
    return current.strftime("%Y-%m-%d")


def get_missing_for_date(vas: list, date_str: str,
                         contracts_by_va: dict) -> set[str]:
    eod_main = get_eod_main_for_date(date_str)
    eod_cba  = get_eod_cba_for_date(date_str)

    main_idx: dict[str, bool] = {r["name"].lower(): True for r in eod_main}
    cba_idx: dict[tuple, bool] = {
        (r["name"].lower(), r["client"].lower()): True for r in eod_cba
    }

    missing = set()

    for va in vas:
        if not va_works_on_date(va, date_str):
            continue

        key       = va["name"].strip().lower()
        community = va.get("community", "")

        if community == "Main":
            found = main_idx.get(key)
            if not found:
                found = any(names_match(key, r["name"]) for r in eod_main)
            if not found:
                missing.add(key)

        elif community == "CBA":
            contracts = contracts_by_va.get(va["id"], [])
            if not contracts:
                found = any(
                    r["name"].lower() == key or names_match(key, r["name"])
                    for r in eod_cba
                )
                if not found:
                    missing.add(key)
            else:
                for contract in contracts:
                    client_key = contract["client_name"].lower()
                    if cba_idx.get((key, client_key)):
                        continue
                    found = any(
                        (names_match(key, r["name"]) or r["name"].lower() == key)
                        and match_client_name(r.get("client", ""), contract["client_name"])[0]
                        for r in eod_cba
                    )
                    if not found:
                        missing.add(key)
                        break

    return missing


def _build_activity_feed(date_str: str, vas: list) -> list[dict]:
    """
    Build a chronological activity feed for a given date.
    Merges attendance (clock-ins) and EOD submissions into one sorted list.
    """
    attendance = get_attendance_for_date(date_str)
    eod_main   = get_eod_main_for_date(date_str)
    eod_cba    = get_eod_cba_for_date(date_str)

    # Build a quick lookup: lowercase name → VA record (for community info)
    va_lookup = {}
    for va in vas:
        k = va["name"].strip().lower()
        va_lookup[k] = va
        va_lookup[k.split()[-1]] = va

    feed = []

    # Clock-ins
    for a in attendance:
        # Resolve VA name for display
        va_rec = va_lookup.get(a["full_name"]) or va_lookup.get(a["last_name"])
        display_name = va_rec["name"] if va_rec else a["raw_name"].split(",")[0].strip()
        community = va_rec.get("community", "") if va_rec else ""

        est_dt = to_est(a["created_time"])

        feed.append({
            "va_name":   display_name,
            "community": community,
            "action":    "Clock In",
            "client":    a.get("client", "").strip() or "—",
            "time_est":  est_dt.strftime("%I:%M %p").lstrip("0"),
            "sort_key":  est_dt.isoformat(),
        })

    # EOD submissions (Main + CBA)
    for r in [*eod_main, *eod_cba]:
        va_key = r["name"].strip().lower()
        va_rec = va_lookup.get(va_key) or va_lookup.get(va_key.split()[-1])
        display_name = va_rec["name"] if va_rec else r["name"].strip()
        community = va_rec.get("community", "") if va_rec else r.get("community", "")

        est_dt = to_est(r["submitted_at"])

        feed.append({
            "va_name":   display_name,
            "community": community,
            "action":    "EOD Report",
            "client":    r.get("client", "").strip() or "—",
            "time_est":  est_dt.strftime("%I:%M %p").lstrip("0"),
            "sort_key":  est_dt.isoformat(),
        })

    # Sort newest first
    feed.sort(key=lambda x: x["sort_key"], reverse=True)

    return feed


@router.get("")
def get_dashboard():
    try:
        now  = datetime.now(tz=EST)
        vas  = get_active_vas_cached()

        contracts_by_va     = get_all_active_contracts_by_va_id()
        active_contract_ids = get_active_contract_id_set()

        main_vas = [v for v in vas if v.get("community") == "Main"]
        cba_vas  = [v for v in vas if v.get("community") == "CBA"]

        no_contract_vas = [
            v for v in cba_vas
            if not any(cid in active_contract_ids for cid in v.get("contract_ids", []))
        ]

        # Today's activity feed
        today_str = now.strftime("%Y-%m-%d")
        activity_feed = _build_activity_feed(today_str, vas)

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
            "activity_feed": activity_feed,
            "activity_date": today_str,
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