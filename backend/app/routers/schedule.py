import re
from fastapi import APIRouter, HTTPException
from app.notion import get_active_vas

router = APIRouter()

# ── Day mapping ───────────────────────────────────────────────────
SCHEDULE_DAYS = {
    "Mon - Fri": ["Mon", "Tue", "Wed", "Thu", "Fri"],
    "Mon - Sun": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    "Flexible":  [],   # handled separately in response
}

ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


# ── Shift time parser ─────────────────────────────────────────────

def parse_shift_blocks(shift_time_str: str) -> list[dict]:
    """
    Parse freeform Shift Time text into structured time blocks.

    Handles:
      "9:00 AM - 5:00 PM"
      "7:00AM-9:00AM(Neal)<br>10:00AM-4PM(Patrick)"
      "9AM-5PM"

    Shift Time values are entered in EST (client timezone) by admins.
    No timezone conversion needed — these are already EST.

    Returns list of:
      { start_h, start_m, end_h, end_m, label, raw, display }
    """
    if not shift_time_str:
        return []

    # Split on <br>, line breaks, or semicolons
    segments = re.split(r'<br\s*/?>\s*|[\n;]+', shift_time_str, flags=re.IGNORECASE)

    blocks = []
    for seg in segments:
        seg = seg.strip()
        if not seg:
            continue

        # Extract optional client label in parens
        label_match = re.search(r'\(([^)]+)\)', seg)
        label = label_match.group(1).strip() if label_match else ""
        seg_clean = re.sub(r'\([^)]+\)', '', seg).strip()

        # Match time range pattern
        # Covers: "9:00AM-5:00PM", "9:00 AM - 5 PM", "9AM-5PM"
        pattern = (
            r'(\d{1,2}(?::\d{2})?)\s*'   # start time
            r'(AM|PM|am|pm)?\s*'           # start AM/PM
            r'[-–]\s*'                     # separator
            r'(\d{1,2}(?::\d{2})?)\s*'   # end time
            r'(AM|PM|am|pm)?'             # end AM/PM
        )
        m = re.search(pattern, seg_clean, re.IGNORECASE)
        if not m:
            continue

        def to_24h(num_str: str, ampm: str, fallback_ampm: str = "AM") -> tuple[int, int]:
            parts = num_str.split(":")
            h = int(parts[0])
            mins = int(parts[1]) if len(parts) > 1 else 0
            ap = (ampm or fallback_ampm or "AM").upper()
            if ap == "PM" and h != 12:
                h += 12
            elif ap == "AM" and h == 12:
                h = 0
            return h, mins

        start_ampm = m.group(2)
        end_ampm   = m.group(4)

        start_h, start_m = to_24h(m.group(1), start_ampm)
        # If end AM/PM missing, infer from context
        # (e.g. "9AM-5" → assume PM if end < start in 12h)
        inferred_end_ampm = end_ampm or start_ampm
        if not end_ampm and not start_ampm:
            inferred_end_ampm = "AM"
        end_h, end_m = to_24h(m.group(3), end_ampm, inferred_end_ampm)

        # Sanity: if end <= start after conversion, try flipping AM/PM on end
        if end_h <= start_h and not end_ampm:
            end_h_alt, end_m_alt = to_24h(m.group(3), "PM")
            if end_h_alt > start_h:
                end_h, end_m = end_h_alt, end_m_alt

        # Human-readable display string (EST)
        def fmt(h, mins):
            ap = "PM" if h >= 12 else "AM"
            h12 = h % 12 or 12
            return f"{h12}:{str(mins).zfill(2)} {ap}"

        blocks.append({
            "start_h":   start_h,
            "start_m":   start_m,
            "end_h":     end_h,
            "end_m":     end_m,
            "label":     label,
            "raw":       seg.strip(),
            "display":   f"{fmt(start_h, start_m)} – {fmt(end_h, end_m)} EST"
                         + (f" ({label})" if label else ""),
        })

    return blocks


# ── Route ─────────────────────────────────────────────────────────

@router.get("")
def get_schedule():
    """
    Returns all active VA Team VAs with parsed schedule data.
    Shift times are in EST (entered in EST by admins per VA records).
    """
    try:
        vas = get_active_vas()

        enriched = []
        for va in vas:
            raw_schedule = va.get("schedule", "")
            days    = SCHEDULE_DAYS.get(raw_schedule, [])
            blocks  = parse_shift_blocks(va.get("shift_time", ""))
            flexible = raw_schedule == "Flexible"

            enriched.append({
                **va,
                "schedule_days":   days,
                "shift_blocks":    blocks,
                "is_flexible":     flexible,
                "has_shift_data":  len(blocks) > 0,
            })

        return {
            "vas":           enriched,
            "total":         len(enriched),
            "flexible_count": sum(1 for v in enriched if v["is_flexible"]),
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))