"""Minimal OpenDocument spreadsheet reader (standard library only).

Government statistics on gov.uk are published as .ods. This reads every sheet into
rows of cell values: float for numeric cells, str for text, None for empty.
"""
from __future__ import annotations

import zipfile
import xml.etree.ElementTree as ET
from typing import Dict, List, Optional, Union

Cell = Optional[Union[float, str]]
Sheet = List[List[Cell]]

T = "urn:oasis:names:tc:opendocument:xmlns:table:1.0"
O = "urn:oasis:names:tc:opendocument:xmlns:office:1.0"
X = "urn:oasis:names:tc:opendocument:xmlns:text:1.0"

# Trailing blank rows/columns are often "repeated" thousands of times; cap them.
MAX_REPEAT = 500


def _text(el: ET.Element) -> str:
    parts: List[str] = []
    for p in el.iter(f"{{{X}}}p"):
        buf: List[str] = []
        def walk(node: ET.Element) -> None:
            if node.text:
                buf.append(node.text)
            for ch in node:
                if ch.tag == f"{{{X}}}s":
                    buf.append(" " * int(ch.get(f"{{{X}}}c", "1")))
                else:
                    walk(ch)
                if ch.tail:
                    buf.append(ch.tail)
        walk(p)
        parts.append("".join(buf))
    return "\n".join(parts)


def _cell(el: ET.Element) -> Cell:
    vt = el.get(f"{{{O}}}value-type")
    if vt in ("float", "percentage", "currency"):
        return float(el.get(f"{{{O}}}value"))  # type: ignore[arg-type]
    t = _text(el).strip()
    return t if t else None


def read_ods(path: str) -> Dict[str, Sheet]:
    with zipfile.ZipFile(path) as z, z.open("content.xml") as f:
        root = ET.parse(f).getroot()
    out: Dict[str, Sheet] = {}
    for table in root.iter(f"{{{T}}}table"):
        rows: Sheet = []
        for row in table.iter(f"{{{T}}}table-row"):
            cells: List[Cell] = []
            for c in row:
                if c.tag not in (f"{{{T}}}table-cell", f"{{{T}}}covered-table-cell"):
                    continue
                n = min(int(c.get(f"{{{T}}}number-columns-repeated", "1")), MAX_REPEAT)
                cells.extend([_cell(c)] * n)
            while cells and cells[-1] is None:
                cells.pop()
            n = min(int(row.get(f"{{{T}}}number-rows-repeated", "1")), MAX_REPEAT)
            rows.extend([list(cells) for _ in range(n)])
        while rows and not rows[-1]:
            rows.pop()
        out[table.get(f"{{{T}}}name", f"sheet{len(out)}")] = rows
    return out


def find_rows(sheet: Sheet, needle: str) -> List[int]:
    """Indexes of rows where any text cell contains `needle` (case-insensitive)."""
    n = needle.lower()
    return [i for i, r in enumerate(sheet) if any(isinstance(c, str) and n in c.lower() for c in r)]
