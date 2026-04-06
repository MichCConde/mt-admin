from datetime import timedelta
from app.notion import *

# ── Attendance ────────────────────────────────────────────────────

def match_client_name(typed: str, actual: str) -> tuple:
    """
    Match a VA-typed client name against an actual/expected client name.
    Returns (is_match, needs_verification).

    Exact match                          -> (True, False)
    Prefix match (either direction)      -> (True, True)   fuzzy, needs review
    First-name match                     -> (True, True)   fuzzy, needs review
    No match                             -> (False, False)

    Examples:
      ("Ryan Jones", "Ryan Jones")  -> (True, False)   exact
      ("Ryan",       "Ryan Jones")  -> (True, True)    actual starts with typed
      ("Ryan Jones", "Ryan")        -> (True, True)    typed starts with actual
      ("Ryan J",     "Ryan Jones")  -> (True, True)    actual starts with typed
      ("R. Jones",   "Ryan Jones")  -> (False, False)  no match
    """
    t = typed.strip().lower()
    a = actual.strip().lower()
    if not t or not a:
        return False, False
    if t == a:
        return True, False
    # Prefix match — either direction
    if a.startswith(t) or t.startswith(a):
        return True, True
    # First-name fallback: if the first word matches and at least
    # one side is a single word (VA typed just the first name)
    t_first = t.split()[0]
    a_first = a.split()[0]
    if t_first == a_first and (len(t.split()) == 1 or len(a.split()) == 1):
        return True, True
    return False, False


def parse_attendance_name(raw_name: str) -> tuple:
    """
    Parses attendance title into (full_name, last_name) handling both formats:

    New format: "[Full Name], [Date]"
      "Maria Conde, March 20, 2026"    -> ("maria conde", "conde")
      "Juan dela Cruz, March 20, 2026" -> ("juan dela cruz", "cruz")

    Old format (backward compat): "IN [Last Name], [Date]"
      "IN Conde, March 20, 2026"       -> ("conde", "conde")
      "OUT Reyes, March 20, 2026"      -> ("reyes", "reyes")
    """
    before_comma = raw_name.split(",")[0].strip()

    # Detect old format — first word is IN or OUT
    parts = before_comma.split(None, 1)
    if parts and parts[0].upper() in ("IN", "OUT") and len(parts) == 2:
        last = parts[1].strip().lower()
        return last, last

    # New format — full name before the comma
    full = before_comma.lower()
    last = full.split()[-1] if full else ""
    return full, last


def get_attendance_for_date(date_str: str) -> list:
    """
    Fetch all clock-in records for a given EST date.
    All records are clock-ins — no Type field needed.
    Returns both full_name and last_name to support old + new record formats.
    """
    utc_start, utc_end = est_day_bounds(date_str)
    pages = query_all(DB["attendance"], {
        "and": [
            {"timestamp": "created_time", "created_time": {"on_or_after": utc_start}},
            {"timestamp": "created_time", "created_time": {"before":      utc_end}},
        ]
    })
    records = []
    for p in pages:
        raw        = get_prop(p, "Name")
        full, last = parse_attendance_name(raw)
        records.append({
            "id":           p["id"],
            "raw_name":     raw,
            "full_name":    full,
            "last_name":    last,
            "client":       get_prop(p, "Client").strip(),
            "created_time": p["created_time"],
            "notes":        get_prop(p, "Clock In Notes"),
        })
    return records

def clock_in_punctuality(created_at: str, time_in_str: str) -> dict:
    clocked_est = to_est(created_at)

    parsed = parse_time_str(time_in_str)
    if parsed:
        cutoff_h, cutoff_m = parsed
    else:
        cutoff_h, cutoff_m = 9, 0

    cutoff         = clocked_est.replace(hour=cutoff_h, minute=cutoff_m, second=0, microsecond=0)
    late_deadline   = cutoff + timedelta(minutes=GRACE_MINUTES)
    early_boundary  = cutoff - timedelta(minutes=GRACE_MINUTES)

    if clocked_est < early_boundary:
        mins = int((early_boundary - clocked_est).total_seconds() / 60)
        status, on_time, m_late, m_early = "early", False, 0, mins
    elif clocked_est > late_deadline:
        mins = int((clocked_est - late_deadline).total_seconds() / 60)
        status, on_time, m_late, m_early = "late", False, mins, 0
    else:
        status, on_time, m_late, m_early = "on_time", True, 0, 0

    return {
        "on_time":        on_time,
        "status":         status,
        "clocked_in_est": clocked_est.strftime("%I:%M %p EST"),
        "expected_by":    cutoff.strftime("%I:%M %p EST"),
        "minutes_late":   m_late,
        "minutes_early":  m_early,
    }