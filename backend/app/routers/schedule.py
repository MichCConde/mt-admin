from fastapi import APIRouter, HTTPException
from app.notion import get_active_vas, get_active_contracts_by_id
from app.services.shift import contract_shift_block, va_shift_block

router = APIRouter()

# ── Day mapping ───────────────────────────────────────────────────
SCHEDULE_DAYS = {
    "Mon - Fri": ["Mon", "Tue", "Wed", "Thu", "Fri"],
    "Mon - Sun": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    "Flexible":  [],
}

ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


# ── Build shift blocks exclusively from contracts ────────────────

def _build_va_shift_blocks(va: dict, contracts_by_id: dict) -> list[dict]:
    """
    Build shift blocks for a VA:
      1. One block per active contract that has Start Shift set
      2. If no contract blocks, fall back to the VA's own Start Shift / End Shift
    """
    active_contracts = [
        contracts_by_id[cid]
        for cid in va.get("contract_ids", [])
        if cid in contracts_by_id
    ]

    blocks = []
    for con in active_contracts:
        b = contract_shift_block(con, label=con["client_name"])
        if b:
            blocks.append(b)

    if blocks:
        return blocks

    # No contract-level shifts found — try VA-level as fallback
    va_block = va_shift_block(va)
    return [va_block] if va_block else []


# ── Schedule page route ──────────────────────────────────────────

@router.get("")
def get_schedule():
    """Returns all active VAs with shift blocks built from their contracts."""
    try:
        vas             = get_active_vas()
        contracts_by_id = get_active_contracts_by_id()

        enriched = []
        for va in vas:
            raw_schedule = va.get("schedule", "")
            days         = SCHEDULE_DAYS.get(raw_schedule, [])
            blocks       = _build_va_shift_blocks(va, contracts_by_id)
            flexible     = raw_schedule == "Flexible"

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


# ── Availability Finder helpers ──────────────────────────────────

MAX_CLIENTS = 4
MORNING_SLOTS   = [(8, 10), (9, 11), (10, 12)]
AFTERNOON_SLOTS = [(12, 14), (13, 15), (14, 16), (15, 17), (16, 18)]


def _fmt_hour(h: int) -> str:
    ap = "PM" if h >= 12 else "AM"
    return f"{h % 12 or 12}:00 {ap}"


def _fmt_slot(s: int, e: int) -> str:
    return f"{_fmt_hour(s)} - {_fmt_hour(e)}"


def _blocks_overlap(slot_start: int, slot_end: int, block: dict) -> bool:
    b_start = block["start_h"] + block["start_m"] / 60
    b_end   = block["end_h"]   + block["end_m"]   / 60
    return slot_start < b_end and b_start < slot_end


def _get_available_slots(shift_blocks: list, slot_defs: list) -> list[str]:
    """Return formatted slot strings where the VA has no overlap."""
    open_slots = []
    for s, e in slot_defs:
        if not any(_blocks_overlap(s, e, b) for b in shift_blocks):
            open_slots.append(_fmt_slot(s, e))
    return open_slots


# ── Availability Finder route ────────────────────────────────────

@router.get("/availability")
def get_availability():
    """CBA VAs with open slots — powered exclusively by contract-level shift blocks."""
    try:
        vas             = get_active_vas()
        contracts_by_id = get_active_contracts_by_id()

        va_list = []
        for va in vas:
            if va.get("community") != "CBA":
                continue

            active_contracts = [
                contracts_by_id[cid]
                for cid in va.get("contract_ids", [])
                if cid in contracts_by_id
            ]
            count = len(active_contracts)
            if count < 1 or count >= MAX_CLIENTS:
                continue

            blocks = _build_va_shift_blocks(va, contracts_by_id)
            if not blocks:
                continue

            morning   = _get_available_slots(blocks, MORNING_SLOTS)
            afternoon = _get_available_slots(blocks, AFTERNOON_SLOTS)
            if not morning and not afternoon:
                continue

            client_names  = ", ".join(c["client_name"] for c in active_contracts)
            shift_display = " | ".join(b["display"] for b in blocks)

            va_list.append({
                "name":            va["name"],
                "client_count":    count,
                "clients":         client_names,
                "schedule":        va.get("schedule", ""),
                "shift_display":   shift_display,
                "morning_slots":   morning,
                "afternoon_slots": afternoon,
                "slots_open":      MAX_CLIENTS - count,
            })

        morning_grouped  = {}
        afternoon_grouped = {}

        for s, e in MORNING_SLOTS:
            key = _fmt_slot(s, e)
            vas_in_slot = [
                {"va_name": v["name"], "clients": v["clients"],
                 "schedule": f"{v['schedule']} ({v['shift_display']})",
                 "slots_open": v["slots_open"]}
                for v in va_list if key in v["morning_slots"]
            ]
            if vas_in_slot:
                morning_grouped[key] = vas_in_slot

        for s, e in AFTERNOON_SLOTS:
            key = _fmt_slot(s, e)
            vas_in_slot = [
                {"va_name": v["name"], "clients": v["clients"],
                 "schedule": f"{v['schedule']} ({v['shift_display']})",
                 "slots_open": v["slots_open"]}
                for v in va_list if key in v["afternoon_slots"]
            ]
            if vas_in_slot:
                afternoon_grouped[key] = vas_in_slot

        return {
            "total_available_vas": len(va_list),
            "vas":                 va_list,
            "morning":             morning_grouped,
            "afternoon":           afternoon_grouped,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))