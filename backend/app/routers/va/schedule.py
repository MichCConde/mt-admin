# Identical logic to original schedule.py
import re
from fastapi import APIRouter, HTTPException
from app.notion import get_active_vas

router = APIRouter()

SCHEDULE_DAYS = {
    "Mon - Fri": ["Mon", "Tue", "Wed", "Thu", "Fri"],
    "Mon - Sun": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    "Flexible":  [],
}


def parse_shift_blocks(shift_time_str: str) -> list[dict]:
    if not shift_time_str:
        return []

    segments = re.split(r'<br\s*/?>\s*|[\n;]+', shift_time_str, flags=re.IGNORECASE)
    blocks   = []

    for seg in segments:
        seg = seg.strip()
        if not seg:
            continue

        label_match = re.search(r'\(([^)]+)\)', seg)
        label     = label_match.group(1).strip() if label_match else ""
        seg_clean = re.sub(r'\([^)]+\)', '', seg).strip()

        pattern = (
            r'(\d{1,2}(?::\d{2})?)\s*(AM|PM|am|pm)?\s*[-–]\s*'
            r'(\d{1,2}(?::\d{2})?)\s*(AM|PM|am|pm)?'
        )
        m = re.search(pattern, seg_clean, re.IGNORECASE)
        if not m:
            continue

        def to_24h(num_str, ampm, fallback="AM"):
            parts = num_str.split(":")
            h  = int(parts[0])
            mn = int(parts[1]) if len(parts) > 1 else 0
            ap = (ampm or fallback or "AM").upper()
            if ap == "PM" and h != 12: h += 12
            elif ap == "AM" and h == 12: h = 0
            return h, mn

        start_ampm = m.group(2)
        end_ampm   = m.group(4)

        start_h, start_m = to_24h(m.group(1), start_ampm)
        inferred         = end_ampm or start_ampm or "AM"
        end_h,   end_m   = to_24h(m.group(3), end_ampm, inferred)

        if end_h <= start_h and not end_ampm:
            eh, em = to_24h(m.group(3), "PM")
            if eh > start_h:
                end_h, end_m = eh, em

        def fmt(h, mn):
            ap  = "PM" if h >= 12 else "AM"
            h12 = h % 12 or 12
            return f"{h12}:{str(mn).zfill(2)} {ap}"

        display = f"{fmt(start_h, start_m)} – {fmt(end_h, end_m)} EST"
        if label:
            display += f" ({label})"

        blocks.append({
            "start_h": start_h, "start_m": start_m,
            "end_h":   end_h,   "end_m":   end_m,
            "label":   label,
            "raw":     seg.strip(),
            "display": display,
        })

    return blocks


@router.get("")
def get_schedule():
    try:
        vas = get_active_vas()
        enriched = []
        for va in vas:
            raw_schedule = va.get("schedule", "")
            days     = SCHEDULE_DAYS.get(raw_schedule, [])
            blocks   = parse_shift_blocks(va.get("shift_time", ""))
            flexible = raw_schedule == "Flexible"
            enriched.append({
                **va,
                "schedule_days":  days,
                "shift_blocks":   blocks,
                "is_flexible":    flexible,
                "has_shift_data": len(blocks) > 0,
            })
        return {
            "vas":            enriched,
            "total":          len(enriched),
            "flexible_count": sum(1 for v in enriched if v["is_flexible"]),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))