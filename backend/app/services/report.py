from app.notion import clock_in_punctuality

def build_report_row(va, client, community, clockin_rec, eod_rec,
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