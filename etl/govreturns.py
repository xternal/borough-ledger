"""Readers for MHCLG local authority returns published as .ods (RA, RO, SG, CTR)."""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Dict, List, Optional

from ods import Sheet, read_ods


@dataclass(frozen=True)
class Column:
    index: int
    asset_id: Optional[str]
    line: Optional[str]
    section: Optional[str]
    label: str


@dataclass
class LaRow:
    """One local authority's row, keyed by the return's column metadata."""
    ons_code: str
    name: str
    columns: List[Column]
    values: Dict[int, object]

    def by_line(self, line: str) -> float:
        hits = [c for c in self.columns if c.line == line]
        if len(hits) != 1:
            raise KeyError(f"line {line}: {len(hits)} columns match")
        return as_number(self.values.get(hits[0].index))

    def by_asset(self, asset_id: str) -> float:
        hits = [c for c in self.columns if c.asset_id == asset_id]
        if len(hits) != 1:
            raise KeyError(f"asset {asset_id}: {len(hits)} columns match")
        return as_number(self.values.get(hits[0].index))


def as_number(v: object) -> float:
    if isinstance(v, float):
        return v
    if v is None or v in ("[x]", "[z]", "[c]", "-"):
        return 0.0
    raise ValueError(f"not a number: {v!r}")


def _clean(s: object) -> Optional[str]:
    if s is None:
        return None
    t = re.sub(r"\s+", " ", str(s)).strip()
    return t or None


def _line(s: object) -> Optional[str]:
    if isinstance(s, float):
        return str(int(s)) if s.is_integer() else str(s)
    return _clean(s)


def read_la_row(path: str, sheet: str, ons_code: str) -> LaRow:
    """Read the row for one authority from an MHCLG 'data by LA' sheet.

    These sheets have, above the 'E-code' header row: an asset ID row, a section row and a line-number row.
    """
    rows: Sheet = read_ods(path)[sheet]
    hi = next(i for i, r in enumerate(rows) if r and r[0] == "E-code")
    meta = {}
    for i in range(max(0, hi - 4), hi):
        tag = str(rows[i][0] or "").lower() if rows[i] else ""
        if "asset id" in tag:
            meta["asset"] = rows[i]
        elif "section heading" in tag:
            meta["section"] = rows[i]
        elif "line number" in tag:
            meta["line"] = rows[i]
    header = rows[hi]
    ons_col = header.index("ONS Code")
    name_col = next(i for i, h in enumerate(header) if h in ("Local authority", "Authority"))
    row = next(r for r in rows[hi + 1 :] if len(r) > ons_col and r[ons_col] == ons_code)
    cols: List[Column] = []
    section = None
    for j, label in enumerate(header):
        if j <= name_col + 3:
            continue
        get = lambda k: meta[k][j] if k in meta and j < len(meta[k]) else None  # noqa: E731
        section = _clean(get("section")) or section
        cols.append(Column(j, _clean(get("asset")), _line(get("line")), section, _clean(label) or ""))
    return LaRow(ons_code, str(row[name_col]), cols, {j: row[j] if j < len(row) else None for j in range(len(header))})
