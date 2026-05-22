"""
Convert AI-generated markdown into Notion API blocks and create pages
in the EOM Reports database.

Supports the subset of markdown the AI produces:
- # / ## / ### headings
- Bullet lists (- and *)
- Numbered lists (1.)
- Paragraphs
- Bold (**text**) and italic (*text*) inline
- Tables (markdown pipe format)
- Horizontal rules (---)
"""
from __future__ import annotations
import re
from app.notion import notion, DB


# ── Inline rich-text parsing ──────────────────────────────────────

# Matches **bold** or *italic* or plain runs of text. Order matters.
_INLINE_RE = re.compile(
    r"\*\*(?P<bold>[^*]+?)\*\*"     # **bold**
    r"|\*(?P<italic>[^*]+?)\*"      # *italic*
    r"|(?P<plain>[^*]+)"            # plain run
)


def _rich_text(text: str) -> list:
    """
    Convert a single-line string with **bold**/*italic* markers into a
    Notion rich_text array. Returns an empty list for empty input.
    """
    if not text:
        return []
    out = []
    for m in _INLINE_RE.finditer(text):
        if m.group("bold") is not None:
            out.append({
                "type": "text",
                "text": {"content": m.group("bold")},
                "annotations": {"bold": True},
            })
        elif m.group("italic") is not None:
            out.append({
                "type": "text",
                "text": {"content": m.group("italic")},
                "annotations": {"italic": True},
            })
        elif m.group("plain") is not None:
            content = m.group("plain")
            if content:
                out.append({
                    "type": "text",
                    "text": {"content": content},
                })
    return out


# ── Block conversion ──────────────────────────────────────────────

def _heading_block(level: int, text: str) -> dict:
    key = f"heading_{min(level, 3)}"
    return {
        "type": key,
        key: {"rich_text": _rich_text(text)},
    }


def _paragraph_block(text: str) -> dict:
    return {
        "type": "paragraph",
        "paragraph": {"rich_text": _rich_text(text)},
    }


def _bullet_block(text: str) -> dict:
    return {
        "type": "bulleted_list_item",
        "bulleted_list_item": {"rich_text": _rich_text(text)},
    }


def _numbered_block(text: str) -> dict:
    return {
        "type": "numbered_list_item",
        "numbered_list_item": {"rich_text": _rich_text(text)},
    }


def _divider_block() -> dict:
    return {"type": "divider", "divider": {}}


def _parse_table_block(table_lines: list[str]) -> dict | None:
    """
    Parse a list of consecutive '|'-prefixed lines into a Notion table.
    Skips the markdown separator row ('| --- | --- |').
    """
    rows: list[list[str]] = []
    for line in table_lines:
        s = line.strip()
        if not s.startswith("|"):
            continue
        # Skip separator rows like | --- | :---: |
        if re.match(r"^\|[\s:|-]+\|?\s*$", s):
            continue
        cells = [c.strip() for c in s.strip("|").split("|")]
        rows.append(cells)

    if not rows:
        return None

    width = max(len(r) for r in rows)
    children = []
    for r in rows:
        padded = r + [""] * (width - len(r))
        children.append({
            "type": "table_row",
            "table_row": {
                "cells": [_rich_text(c) for c in padded],
            },
        })

    return {
        "type": "table",
        "table": {
            "table_width":       width,
            "has_column_header": True,
            "has_row_header":    False,
            "children":          children,
        },
    }


def markdown_to_blocks(md: str) -> list[dict]:
    """Convert a markdown string into a list of Notion API block objects."""
    if not md:
        return []
    blocks: list[dict] = []
    lines = md.split("\n")
    i = 0

    while i < len(lines):
        line = lines[i].rstrip()

        # Skip blank lines
        if not line.strip():
            i += 1
            continue

        # Horizontal rule
        if re.match(r"^\s*-{3,}\s*$", line):
            blocks.append(_divider_block())
            i += 1
            continue

        # Headings
        m = re.match(r"^(#{1,3})\s+(.*)$", line)
        if m:
            level = len(m.group(1))
            blocks.append(_heading_block(level, m.group(2).strip()))
            i += 1
            continue

        # Tables — gather all consecutive | lines
        if line.lstrip().startswith("|"):
            table_lines = []
            while i < len(lines) and lines[i].lstrip().startswith("|"):
                table_lines.append(lines[i])
                i += 1
            tb = _parse_table_block(table_lines)
            if tb is not None:
                blocks.append(tb)
            continue

        # Bulleted list items: - or *
        m = re.match(r"^\s*[-*]\s+(.*)$", line)
        if m:
            blocks.append(_bullet_block(m.group(1).strip()))
            i += 1
            continue

        # Numbered list items
        m = re.match(r"^\s*\d+\.\s+(.*)$", line)
        if m:
            blocks.append(_numbered_block(m.group(1).strip()))
            i += 1
            continue

        # Default: paragraph — merge consecutive non-special lines
        # (so a wrapped sentence becomes one paragraph)
        para_lines = [line]
        j = i + 1
        while j < len(lines):
            next_line = lines[j].rstrip()
            if (not next_line.strip()
                or re.match(r"^\s*-{3,}\s*$", next_line)
                or re.match(r"^#{1,3}\s+", next_line)
                or next_line.lstrip().startswith("|")
                or re.match(r"^\s*[-*]\s+", next_line)
                or re.match(r"^\s*\d+\.\s+", next_line)):
                break
            para_lines.append(next_line)
            j += 1
        blocks.append(_paragraph_block(" ".join(para_lines)))
        i = j

    return blocks


# ── Page creation ─────────────────────────────────────────────────

# Notion's create-page endpoint accepts up to 100 children at a time.
# Reports easily exceed that. We create the page with the first batch,
# then append additional batches.
_BATCH_SIZE = 95


def create_eom_report_page(
    *,
    title: str,
    month_start_iso: str,
    month_end_iso: str,
    client_name: str,
    company: str,
    email: str,
    va_name: str,
    body_markdown: str,
) -> dict:
    """
    Create a new page in the EOM Reports database and return Notion's
    response (which includes the new page's id and url).
    """
    properties = {
        "Name": {
            "title": [{"text": {"content": title}}],
        },
        "Month": {
            "date": {
                "start": month_start_iso,
                "end":   month_end_iso,
            },
        },
        "Client": {
            "rich_text": [{"text": {"content": client_name or ""}}],
        },
        "Company": {
            "rich_text": [{"text": {"content": company or ""}}],
        },
        "VA": {
            "rich_text": [{"text": {"content": va_name or ""}}],
        },
    }
    if email:
        properties["Email"] = {"email": email}

    blocks = markdown_to_blocks(body_markdown)
    first_batch = blocks[:_BATCH_SIZE]
    remaining   = blocks[_BATCH_SIZE:]

    page = notion.pages.create(
        parent={"database_id": DB["eom_reports"]},
        properties=properties,
        children=first_batch,
    )

    # Append remaining blocks if the report was longer than the batch limit
    page_id = page["id"]
    while remaining:
        chunk    = remaining[:_BATCH_SIZE]
        remaining = remaining[_BATCH_SIZE:]
        notion.blocks.children.append(block_id=page_id, children=chunk)

    return page