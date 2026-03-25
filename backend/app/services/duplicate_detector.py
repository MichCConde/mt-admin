"""
Detects copy-paste / identical EOD reports.
Checks both structured fields AND content hash.
"""
from collections import defaultdict


def detect_duplicate_eod(reports_by_va: dict[str, list[dict]]) -> list[dict]:
    """
    reports_by_va: { va_name: [report_day1, report_day2, ...] }
    Returns a list of flagged duplicates.
    """
    flags = []

    for va_name, reports in reports_by_va.items():
        if len(reports) < 2:
            continue

        # Check content hash duplicates (verbatim copy-paste)
        hash_counts = defaultdict(list)
        for r in reports:
            if r.get("content_hash"):
                hash_counts[r["content_hash"]].append(r["date"])

        for h, dates in hash_counts.items():
            if len(dates) > 1:
                flags.append({
                    "va_name": va_name,
                    "type":    "identical_content",
                    "dates":   dates,
                    "detail":  f"Same report body submitted on {', '.join(dates)}",
                })

        # Check structured field duplicates (same time_in/time_out/leads)
        struct_counts = defaultdict(list)
        for r in reports:
            key = f"{r.get('time_in')}|{r.get('time_out')}|{r.get('leads')}"
            struct_counts[key].append(r["date"])

        for key, dates in struct_counts.items():
            if len(dates) > 1:
                flags.append({
                    "va_name": va_name,
                    "type":    "identical_fields",
                    "dates":   dates,
                    "detail":  f"Same time/metrics on {', '.join(dates)}",
                })

    return flags


def group_reports_by_va(reports: list[dict]) -> dict[str, list[dict]]:
    """Helper to group a flat list of reports by VA name."""
    grouped = defaultdict(list)
    for r in reports:
        grouped[r["name"]].append(r)
    return dict(grouped)