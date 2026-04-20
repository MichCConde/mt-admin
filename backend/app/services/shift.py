"""
Shift time utilities.

Contracts now own the canonical shift time via two Select properties:
  - Start Shift  (e.g. "07:00", "19:30")  — 24-hour format
  - End Shift    (e.g. "09:00", "17:00")  — 24-hour format

This replaces the per-VA "Shift Time" freeform string.
"""

import re

# 24-hour: "07:00", "7:00", "19", "9"
_TIME_RE_24H = re.compile(r'^\s*(\d{1,2})(?::(\d{2}))?\s*$')

# 12-hour fallback: "7:00 AM", "7AM", "7:00PM" (supports legacy VA shift strings)
_TIME_RE_12H = re.compile(r'^\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm)\s*$')


def parse_shift_time(s: str) -> tuple[int, int] | None:
    """
    Parse a shift time string into (hour_24, minute).

    Primary format: 24-hour ("07:00", "19:30").
    Also supports 12-hour with AM/PM suffix as a fallback.

    Returns None if empty or unparseable.
    """
    if not s:
        return None
    s = s.strip()

    # Try 12-hour first — explicit AM/PM marker wins
    m12 = _TIME_RE_12H.match(s)
    if m12:
        h = int(m12.group(1))
        mins = int(m12.group(2) or 0)
        ap = m12.group(3).upper()
        if ap == "PM" and h != 12:
            h += 12
        elif ap == "AM" and h == 12:
            h = 0
        if 0 <= h <= 23 and 0 <= mins <= 59:
            return h, mins

    # 24-hour
    m24 = _TIME_RE_24H.match(s)
    if m24:
        h = int(m24.group(1))
        mins = int(m24.group(2) or 0)
        if 0 <= h <= 23 and 0 <= mins <= 59:
            return h, mins

    return None


def format_shift_time(h: int, m: int) -> str:
    """
    (7, 0) → '7:00AM'. Always outputs 12-hour format with AM/PM because
    that's what clock_in_punctuality expects downstream.
    """
    h12 = 12 if h == 0 else (h - 12 if h > 12 else h)
    ampm = "AM" if h < 12 else "PM"
    return f"{h12}:{m:02d}{ampm}"


def contract_shift_block(contract: dict, label: str = "") -> dict | None:
    """
    Build a shift_block dict (compatible with routers/schedule.py's parse_shift_blocks
    output) from a contract's Start Shift / End Shift fields.

    Returns None if the contract has no Start Shift set.
    """
    start = parse_shift_time(contract.get("start_shift", ""))
    end   = parse_shift_time(contract.get("end_shift", ""))

    if not start:
        return None

    start_h, start_m = start
    end_h, end_m     = end if end else (start_h, start_m)

    def fmt(h, mins):
        ap  = "PM" if h >= 12 else "AM"
        h12 = h % 12 or 12
        return f"{h12}:{str(mins).zfill(2)} {ap}"

    client = label or contract.get("client_name", "")

    return {
        "start_h":   start_h,
        "start_m":   start_m,
        "end_h":     end_h,
        "end_m":     end_m,
        "label":     client,
        "raw":       f"{fmt(start_h, start_m)} - {fmt(end_h, end_m)}",
        "display":   f"{fmt(start_h, start_m)} – {fmt(end_h, end_m)} EST"
                     + (f" ({client})" if client else ""),
    }

def va_shift_block(va: dict) -> dict | None:
    """
    Build a shift_block from a VA's own Start Shift / End Shift fields.
    Used for Main VAs (who don't have contracts) and as fallback for
    CBA VAs whose contracts haven't been populated yet.

    Returns None if the VA has no Start Shift set.
    """
    start = parse_shift_time(va.get("start_shift", ""))
    end   = parse_shift_time(va.get("end_shift", ""))

    if not start:
        return None

    start_h, start_m = start
    end_h, end_m     = end if end else (start_h, start_m)

    def fmt(h, mins):
        ap  = "PM" if h >= 12 else "AM"
        h12 = h % 12 or 12
        return f"{h12}:{str(mins).zfill(2)} {ap}"

    return {
        "start_h":   start_h,
        "start_m":   start_m,
        "end_h":     end_h,
        "end_m":     end_m,
        "label":     "",
        "raw":       f"{fmt(start_h, start_m)} - {fmt(end_h, end_m)}",
        "display":   f"{fmt(start_h, start_m)} – {fmt(end_h, end_m)} EST",
    }