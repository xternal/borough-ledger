"""Pull Hammersmith & Fulham's figures out of the government returns.

Each function reads one kind of file and checks it against the file's own totals
before returning anything (CLAUDE.md: never trust an extraction without a checksum).
"""
from __future__ import annotations

import csv
import re
from pathlib import Path
from typing import Dict, List, Tuple

from govreturns import LaRow, as_number, read_la_row
from ods import find_rows, read_ods

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
MANUAL = ROOT / "data" / "manual"
BANDS = ["A", "B", "C", "D", "E", "F", "G", "H"]


class CheckFailed(Exception):
    pass


def check(cond: bool, msg: str) -> None:
    if not cond:
        raise CheckFailed(msg)


def close(a: float, b: float, tol: float) -> bool:
    return abs(a - b) <= tol


# ------------------------------------------------------------------ council tax

CTR_FIELDS = {
    "ctr": "1. Council Tax Requirement for billing authority including special expenses",
    "levies": "3a. Levies and special levies",
    "tax_base": "4. Tax base (after council tax reduction scheme)",
    "collection_rate": "5. Estimated collection rate",
    # Payments in lieu for armed forces homes (Class O), added to the base: 0 in most boroughs, about 50 in Kensington and Chelsea.
    "in_lieu": "6. Tax base adjustment (contributions in lieu of Class O exempt dwellings)",
    "setting_base": "7. Council tax base for council tax setting purposes",
    "band_d_council": "9. Average (Band D 2 Adult equivalent) council tax (including Adult Social Care precept and excluding local precepts)",
}


def ctr_data(file: str, sheet: str, years: List[str], ons: str) -> Dict[str, Dict[str, float]]:
    """Council tax requirement data for the previous and current year in one release."""
    rows = read_ods(str(RAW / file))[sheet]
    hi = next(i for i, r in enumerate(rows) if r and r[0] == "E-code")
    header = [re.sub(r"\s+", " ", str(h or "")).strip() for h in rows[hi]]
    row = next(r for r in rows[hi + 1 :] if len(r) > 1 and r[1] == ons)
    out: Dict[str, Dict[str, float]] = {y: {} for y in years}
    for key, prefix in CTR_FIELDS.items():
        for y, when in zip(years, ("(previous year)", "(current year)")):
            cols = [j for j, h in enumerate(header) if h.startswith(prefix) and h.endswith(when)]
            check(len(cols) == 1, f"{file}: {key} {when}: {len(cols)} columns")
            out[y][key] = as_number(row[cols[0]])
    for y, d in out.items():
        # The return's own identity: tax base for setting = tax base × collection rate + payments in lieu; CTR = setting base × Band D.
        check(close(d["tax_base"] * d["collection_rate"] + d["in_lieu"], d["setting_base"], 2.0), f"{file} {y}: tax base × collection rate + payments in lieu ≠ setting base")
        check(close(d["setting_base"] * d["band_d_council"], d["ctr"], 1000.0), f"{file} {y}: setting base × Band D ≠ council tax requirement")
    return out


def area_bands(file: str, sheet: str, ons: str, first_band_col: int = -1) -> Dict[str, float]:
    """Area council tax (council plus GLA) for each band."""
    rows = read_ods(str(RAW / file))[sheet]
    found = [r for r in rows if ons in r]
    check(len(found) == 1, f"{file}: {len(found)} rows for {ons}")
    row = found[0]
    if first_band_col < 0:
        hi = next(i for i, r in enumerate(rows) if r and str(r[0]).strip() in ("E Code", "E-code"))
        first_band_col = rows[hi].index("Band A")
    vals = [as_number(row[first_band_col + i]) for i in range(8)]
    d = vals[3]
    for b, v, num in zip(BANDS, vals, (6, 7, 8, 9, 11, 13, 15, 18)):
        # Published bands must be the statutory ninths of Band D, to the penny.
        check(close(v, d * num / 9, 0.006), f"{file}: band {b} {v} is not {num}/9 of Band D {d}")
    return dict(zip(BANDS, (round(v, 2) for v in vals)))


# ------------------------------------------------------------------ revenue account budget (RA) and grants (SG)

def read_csv(name: str) -> List[Dict[str, str]]:
    with open(MANUAL / name, newline="") as f:
        return list(csv.DictReader(f))


def ra_services(ra: LaRow, strict_lines: bool = False) -> Tuple[Dict[str, float], Dict[str, List[Tuple[str, str, float]]]]:
    """Net current expenditure grouped into resident service groups, £000.

    Returns (group totals, group → [(line, label, value)]) and checks every RA section against its own TOTAL line.
    With strict_lines=False (earlier years, whose forms had slightly different lines) a mapped line that is
    absent counts as zero; the section and grand-total checks still catch any line the mapping misses.
    """
    mapping = read_csv("ra_service_map.csv")
    by_line = {c.line: c for c in ra.columns}
    groups: Dict[str, float] = {}
    detail: Dict[str, List[Tuple[str, str, float]]] = {}
    section_sum: Dict[str, float] = {}
    for m in mapping:
        if m["role"] != "line":
            continue
        c = by_line.get(m["ra_line"])
        if c is None and not strict_lines:
            continue
        check(c is not None, f"RA line {m['ra_line']} ({m['label']}) missing from the return")
        v = as_number(ra.values.get(c.index))  # type: ignore[union-attr]
        groups[m["group"]] = groups.get(m["group"], 0.0) + v
        detail.setdefault(m["group"], []).append((m["ra_line"], m["label"], v))
        section_sum[m["section"]] = section_sum.get(m["section"], 0.0) + v
    # Checksum: each service section adds up to the return's TOTAL line for it.
    for m in mapping:
        if m["role"] == "total" and m["section"] in section_sum and m["ra_line"] not in ("799", "849"):
            total = ra.by_line(m["ra_line"])
            check(close(section_sum[m["section"]], total, 0.5), f"RA {m['label']}: lines sum to {section_sum[m['section']]}, return says {total}")
    service_lines = sum(v for m in mapping if m["role"] == "line" and float(m["ra_line"]) < 799 and m["ra_line"] in by_line
                        for v in [as_number(ra.values.get(by_line[m["ra_line"]].index))])
    check(close(service_lines, ra.by_line("799"), 0.5), f"RA service lines sum to {service_lines}, TOTAL SERVICE EXPENDITURE is {ra.by_line('799')}")
    revenue = sum(groups.values())
    check(close(revenue, ra.by_line("900"), 0.5), f"RA mapped lines sum to {revenue}, REVENUE EXPENDITURE is {ra.by_line('900')}")
    return groups, detail


def _in_range(line: str, spec: str) -> bool:
    if "-" in spec:
        lo, hi = spec.split("-")
        return int(lo) <= int(line) <= int(hi)
    return line == spec


def funding(ra: LaRow, sg: LaRow) -> Tuple[Dict[str, float], Dict[str, List[Tuple[str, float]]]]:
    """Revenue expenditure financing grouped into funding groups, £000, checked against RA and SG totals."""
    mapping = read_csv("funding_map.csv")
    groups: Dict[str, float] = {}
    detail: Dict[str, List[Tuple[str, float]]] = {}
    for m in [m for m in mapping if m["return"] == "ra"]:
        v = ra.by_line(m["line"]) * int(m["sign"])
        groups[m["group"]] = groups.get(m["group"], 0.0) + v
        if v:
            detail.setdefault(m["group"], []).append((next(c.label for c in ra.columns if c.line == m["line"]), v))
    sg_rules = [m for m in mapping if m["return"] == "sg"]
    sg_sum = 0.0
    for c in sg.columns:
        if not (c.line and c.line.isdigit() and int(c.line) < 699):
            continue
        v = as_number(sg.values.get(c.index))
        exact = [m for m in sg_rules if "-" not in m["line"] and m["line"] == c.line]
        rule = exact[0] if exact else next((m for m in sg_rules if "-" in m["line"] and _in_range(c.line, m["line"])), None)
        check(rule is not None, f"SG line {c.line} ({c.label}) has no funding group")
        groups[rule["group"]] = groups.get(rule["group"], 0.0) + v  # type: ignore[index]
        if v:
            detail.setdefault(rule["group"], []).append((c.label, v))  # type: ignore[index]
        sg_sum += v
    check(close(sg_sum, sg.by_line("699"), 0.5), f"SG grant lines sum to {sg_sum}, SG total is {sg.by_line('699')}")
    check(close(sg_sum, -ra.by_line("904"), 0.5), f"SG total {sg_sum} does not match RA line 904 {ra.by_line('904')}")
    total = sum(groups.values())
    check(close(total, ra.by_line("900"), 0.5), f"Funding sums to {total}, REVENUE EXPENDITURE is {ra.by_line('900')}")
    return groups, detail


# ------------------------------------------------------------------ revenue outturn (RS summary, RO5 detail)

STREETS_ENV = ("Street cleansing", "Waste collection", "Waste disposal", "Trade waste", "Recycling", "Waste minimisation",
               "Climate change", "Defences against flooding", "Land drainage", "Coast protection")
NCE = re.compile(r" - Net Current Expenditure")


def outturn(rs: LaRow, ro5: LaRow) -> Dict[str, float]:
    """What the council actually spent, by resident service group, £000.

    Section totals come from the RS summary; environmental services are split between streets and
    community safety with RO5's detail lines, as in the budget mapping. Checked against RS's own
    TOTAL SERVICE EXPENDITURE and REVENUE EXPENDITURE, and RO5's environmental total.
    """
    mapping = read_csv("rs_outturn_map.csv")
    by_label = {c.label: c for c in rs.columns}
    missing = [m["label"] for m in mapping if m["label"] not in by_label]
    check(not missing, f"RS lines missing from the return: {missing[:3]}")
    val = lambda lbl: as_number(rs.values.get(by_label[lbl].index))  # noqa: E731
    groups: Dict[str, float] = {}
    service = 0.0
    for m in mapping:
        if m["role"] != "line":
            continue
        v = val(m["label"])
        groups[m["group"]] = groups.get(m["group"], 0.0) + v
        if m["label"].startswith("Service Expenditure - "):
            service += v
    total_service = val(next(m["label"] for m in mapping if "TOTAL SERVICE EXPENDITURE" in m["label"]))
    revenue = val(next(m["label"] for m in mapping if m["label"].startswith("Revenue Expenditure - REVENUE EXPENDITURE")))
    check(close(service, total_service, 0.5), f"RS service lines add to {service}, TOTAL SERVICE EXPENDITURE is {total_service}")
    check(close(sum(groups.values()), revenue, 0.5), f"RS lines add to {sum(groups.values())}, REVENUE EXPENDITURE is {revenue}")

    env = groups.pop("environmental_split", 0.0)
    nce = [c for c in ro5.columns if NCE.search(c.label)]
    env_total = [c for c in nce if c.label.upper().startswith("TOTAL ENVIRONMENTAL")]
    check(len(env_total) == 1, "RO5: no environmental total")
    check(close(as_number(ro5.values.get(env_total[0].index)), env, 0.5), "RO5 environmental total does not match RS")
    streets_env = sum(as_number(ro5.values.get(c.index)) for c in nce if c.label.startswith(STREETS_ENV))
    groups["streets"] = groups.get("streets", 0.0) + streets_env
    groups["safety_regulation"] = groups.get("safety_regulation", 0.0) + env - streets_env
    return groups


def rs_value(rs: LaRow, starts: str) -> float:
    hits = [c for c in rs.columns if c.label.startswith(starts)]
    check(len(hits) == 1, f"RS: {len(hits)} columns start with {starts!r}")
    return as_number(rs.values.get(hits[0].index))
