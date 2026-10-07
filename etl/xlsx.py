"""Minimal Excel (.xlsx) reader (standard library only).

The council publishes its spend data as .xlsx. This reads every sheet into rows of cell values:
float for numeric cells, str for text, None for empty. Dates stay as Excel serial numbers; use
`excel_date` to convert them. Formulas are read as their cached values.
"""
from __future__ import annotations

import re
import zipfile
import xml.etree.ElementTree as ET
from datetime import date, timedelta
from typing import Dict, List, Optional, Union

Cell = Optional[Union[float, str]]
Sheet = List[List[Cell]]

M = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PR = "http://schemas.openxmlformats.org/package/2006/relationships"


def _col(ref: str) -> int:
    """'C12' -> 2 (zero-based column)."""
    n = 0
    for ch in re.match(r"[A-Z]+", ref).group(0):  # type: ignore[union-attr]
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def _si_text(si: ET.Element) -> str:
    return "".join(t.text or "" for t in si.iter(f"{{{M}}}t"))


def read_xlsx(path: str) -> Dict[str, Sheet]:
    with zipfile.ZipFile(path) as z:
        names = set(z.namelist())
        shared: List[str] = []
        if "xl/sharedStrings.xml" in names:
            shared = [_si_text(si) for si in ET.fromstring(z.read("xl/sharedStrings.xml")).iter(f"{{{M}}}si")]
        rels = {r.get("Id"): r.get("Target") for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels")).iter(f"{{{PR}}}Relationship")}
        wb = ET.fromstring(z.read("xl/workbook.xml"))
        out: Dict[str, Sheet] = {}
        for s in wb.iter(f"{{{M}}}sheet"):
            target = rels[s.get(f"{{{R}}}id")] or ""
            target = target.lstrip("/")
            part = target if target.startswith("xl/") else f"xl/{target}"
            rows: Sheet = []
            for row in ET.fromstring(z.read(part)).iter(f"{{{M}}}row"):
                cells: List[Cell] = []
                for i, c in enumerate(row.iter(f"{{{M}}}c")):
                    col = _col(c.get("r")) if c.get("r") else i
                    while len(cells) < col:
                        cells.append(None)
                    t = c.get("t")
                    v = c.find(f"{{{M}}}v")
                    val: Cell
                    if t == "s" and v is not None:
                        val = shared[int(v.text or 0)]
                    elif t == "inlineStr":
                        val = "".join(x.text or "" for x in c.iter(f"{{{M}}}t"))
                    elif t in ("str", "e") and v is not None:
                        val = v.text
                    elif t == "b" and v is not None:
                        val = "TRUE" if v.text == "1" else "FALSE"
                    elif v is not None and v.text not in (None, ""):
                        val = float(v.text)  # type: ignore[arg-type]
                    else:
                        val = None
                    if isinstance(val, str):
                        val = val.strip() or None
                    cells.append(val)
                rows.append(cells)
            out[s.get("name") or part] = rows
        return out


def excel_date(serial: float) -> date:
    """Excel's 1900 date system (with its 1900 leap-year bug, irrelevant after March 1900)."""
    return date(1899, 12, 30) + timedelta(days=int(serial))
