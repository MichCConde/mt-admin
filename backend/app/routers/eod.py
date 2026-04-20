from fastapi import APIRouter, Query, HTTPException
from app.notion import (
    get_active_vas_cached, get_attendance_for_date,
    get_eod_main_for_date, get_eod_cba_for_date,
    get_all_active_contracts_by_va_id, va_works_on_date,
    match_client_name, get_active_contracts_by_id,
    get_attendance_for_date, va_works_on_date, EST,
)
from app.services.matching import names_match, fuzzy_find_eod, fuzzy_find_clockin
from app.services.report import build_report_row
from app.routers.schedule import parse_shift_blocks
from datetime import datetime
from app.middleware.security import validate_date, safe_error

router = APIRouter()

# ── EOD check route ─────────────────────────────────────
@router.get("")
def check_eod(date: str = Query(..., description="YYYY-MM-DD")):
    try:
        vas             = get_active_vas_cached()
        contracts_by_va = get_all_active_contracts_by_va_id()
        attendance      = get_attendance_for_date(date)
        eod_main        = get_eod_main_for_date(date)
        eod_cba         = get_eod_cba_for_date(date)
        date            = validate_date(date)

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
        raise safe_error(e)


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
                    if names_match(key, eod_name):
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
                rows.append(build_report_row(
                    va, None, comm, ci, eod, shift_fallback, False
                ))
            else:
                for con in active_contracts:
                    con_client = con["client_name"]
                    con_ci, ci_nv = fuzzy_find_clockin(va_cis, con_client)
                    con_eod, eod_nv = fuzzy_find_eod(va_eod_list, con_client)
                    rows.append(build_report_row(
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


# ── Live Shift Dashboard route ────────────────────────────────────

@router.get("/dashboard")
def get_va_dashboard():
    """
    Real-time shift dashboard for today.
    Returns contract-anchored rows with shift time, clock-in/out status,
    grouped into morning / mid / afternoon buckets.
    """
    try:
        from app.routers.schedule import parse_shift_blocks

        now  = datetime.now(tz=EST)
        date = now.strftime("%Y-%m-%d")

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

        # ── Index EOD ─────────────────────────────────────────────
        main_eod_by_va: dict[str, list] = {}
        for r in eod_main:
            main_eod_by_va.setdefault(r["name"].strip().lower(), []).append(r)

        cba_eod_by_va: dict[str, list] = {}
        for r in eod_cba:
            cba_eod_by_va.setdefault(r["name"].strip().lower(), []).append(r)

        # ── Build rows ────────────────────────────────────────────
        working_vas = [va for va in vas if va_works_on_date(va, date)]
        rows = []

        for va in working_vas:
            key     = va["name"].strip().lower()
            va_last = key.split()[-1]
            va_cis  = name_to_clockins.get(key) or name_to_clockins.get(va_last, [])
            comm    = va.get("community", "")

            # Parse shift blocks for this VA
            shift_blocks = parse_shift_blocks(va.get("shift_time", ""))

            # EOD lookup with fuzzy name fallback
            eod_source = main_eod_by_va if comm == "Main" else cba_eod_by_va
            va_eod_list = eod_source.get(key, [])
            if not va_eod_list:
                for eod_name, eod_records in eod_source.items():
                    if names_match(key, eod_name):
                        va_eod_list = eod_records
                        break

            # Resolve contracts
            active_contracts = [
                contracts_by_id[cid]
                for cid in va.get("contract_ids", [])
                if cid in contracts_by_id
            ]

            if not active_contracts:
                # VA with no contracts — single row
                block = shift_blocks[0] if shift_blocks else None
                ci = va_cis[0] if va_cis else None
                eod = va_eod_list[0] if va_eod_list else None

                rows.append(_build_dashboard_row(
                    va, None, comm, block, ci, eod, now
                ))
            else:
                for con in active_contracts:
                    con_client = con["client_name"]

                    # Match shift block to contract by label
                    block = _match_shift_block(shift_blocks, con_client)

                    # Fuzzy match clock-in to contract
                    con_ci, _ = fuzzy_find_clockin(va_cis, con_client)

                    # Fuzzy match EOD to contract
                    con_eod, _ = fuzzy_find_eod(va_eod_list, con_client)

                    rows.append(_build_dashboard_row(
                        va, con_client, comm, block, con_ci, con_eod, now
                    ))

        # ── Bucket rows by shift period ───────────────────────────
        morning   = []  # 7:00 AM – 9:59 AM start
        mid       = []  # 10:00 AM – 2:59 PM start
        afternoon = []  # 3:00 PM – 5:00 PM+ start

        for r in rows:
            h = r["shift_start_h"]
            if h is not None and h < 10:
                morning.append(r)
            elif h is not None and h < 15:
                mid.append(r)
            else:
                afternoon.append(r)

        # Sort each bucket by shift start time
        sort_key = lambda r: (r["shift_start_h"] or 99, r["shift_start_m"] or 0, r["va_name"])
        morning.sort(key=sort_key)
        mid.sort(key=sort_key)
        afternoon.sort(key=sort_key)

        return {
            "date": date,
            "morning":   morning,
            "mid":       mid,
            "afternoon": afternoon,
            "stats": {
                "total":       len(rows),
                "clocked_in":  sum(1 for r in rows if r["status"] == "Clocked In"),
                "clocked_out": sum(1 for r in rows if r["status"] == "Clocked Out"),
                "absent":      sum(1 for r in rows if r["status"] == "Absent"),
                "upcoming":    sum(1 for r in rows if r["status"] == "Upcoming"),
            },
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _match_shift_block(blocks: list, client_name: str) -> dict | None:
    """Match a shift block to a contract by comparing the block's label to the client name."""
    if not blocks:
        return None
    if len(blocks) == 1:
        return blocks[0]

    # Try label match (block label is the client name in parens)
    client_lower = client_name.strip().lower() if client_name else ""
    for b in blocks:
        label = b.get("label", "").strip().lower()
        if label and client_lower:
            # Fuzzy: label starts with client first name, or client starts with label
            if label == client_lower:
                return b
            if client_lower.startswith(label) or label.startswith(client_lower):
                return b
            # First-name match
            if label.split()[0] == client_lower.split()[0]:
                return b

    # Fallback: return first block
    return blocks[0]


def _build_dashboard_row(va, client, community, shift_block, clockin_rec, eod_rec, now):
    """Build a single row for the VA shift dashboard."""
    from app.notion import clock_in_punctuality

    # Shift time display
    if shift_block:
        shift_display = shift_block.get("raw", "")
        # Clean up: remove client label in parens for display
        import re
        shift_display = re.sub(r'\([^)]+\)', '', shift_display).strip()
        shift_start_h = shift_block["start_h"]
        shift_start_m = shift_block["start_m"]
    else:
        shift_display = "—"
        shift_start_h = None
        shift_start_m = None

    # Expected start for punctuality
    expected_start = ""
    if eod_rec and eod_rec.get("time_in"):
        expected_start = eod_rec["time_in"]
    if not expected_start and shift_block and shift_block.get("start_h") is not None:
        h = shift_block["start_h"]
        m = shift_block.get("start_m") or 0
        h12 = 12 if h == 0 else (h - 12 if h > 12 else h)
        ampm = "AM" if h < 12 else "PM"
        expected_start = f"{h12}:{m:02d}{ampm}"
    if not expected_start and va.get("shift_time"):
        expected_start = va["shift_time"]

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

    # Has the shift started yet?
    shift_started = True
    if shift_start_h is not None:
        shift_time_today = now.replace(
            hour=shift_start_h,
            minute=shift_start_m or 0,
            second=0, microsecond=0,
        )
        shift_started = now >= shift_time_today

    # Status: Clocked In / Clocked Out / Upcoming / Absent
    has_clockin = clockin_rec is not None
    has_eod     = eod_rec is not None

    if has_clockin and has_eod:
        status = "Clocked Out"
    elif has_clockin and not has_eod:
        status = "Clocked In"
    elif not shift_started:
        status = "Upcoming"
    else:
        status = "Absent"

    # Clock-out / EOD (only show if clocked out)
    if status == "Clocked Out" and eod_rec:
        clock_out        = eod_rec["punctuality"]["submitted_est"]
        clock_out_status = eod_rec["punctuality"]["status"]
        clock_out_late   = eod_rec["punctuality"]["minutes_late"]
        clock_out_early  = eod_rec["punctuality"]["minutes_early"]
    else:
        clock_out        = None
        clock_out_status = None
        clock_out_late   = 0
        clock_out_early  = 0

    # Display client
    display_client = client
    if not display_client and eod_rec and eod_rec.get("client"):
        display_client = eod_rec["client"]
    if not display_client and clockin_rec and clockin_rec.get("client"):
        display_client = clockin_rec["client"]

    return {
        "va_name":                 va["name"],
        "client":                  display_client or "—",
        "community":               community,
        "shift_time":              shift_display,
        "shift_start_h":           shift_start_h,
        "shift_start_m":           shift_start_m,
        "clock_in":                clock_in,
        "clock_in_status":         clock_in_status,
        "clock_in_minutes_late":   clock_in_late,
        "clock_in_minutes_early":  clock_in_early,
        "status":                  status,
        "clock_out":               clock_out,
        "clock_out_status":        clock_out_status,
        "clock_out_minutes_late":  clock_out_late,
        "clock_out_minutes_early": clock_out_early,
    }