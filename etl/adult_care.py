"""What care for adults costs, for every English council on the site: the government's adult social care finance report
(each council's own return, ASC-FR), 2024/25, into data/build/adult_care.json.

    python3 etl/adult_care.py           build
    python3 etl/adult_care.py --check   fail if out of date

From the report's data tables: gross spending by type of care (Tables 14, 43 and 44, £ thousand) and the average unit
costs the government publishes (Table 52, £ a week in a care or nursing home; Table 51, £ an hour of home care). The
report says not to divide spending by numbers of people to make a unit cost, so only its own unit costs are used.

Checks: each age group's types of long-term care add up to its total; the two age groups add up to Table 14's long-term
care; long-term, short-term and other care add up to the council's total; every council on the site has a row.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parent))

from build import serialise, source_entry  # noqa: E402
from extract import CheckFailed, check, close, read_ods  # noqa: E402
from fetch import ROOT, load_sources  # noqa: E402

SOURCE_ID = "asc_finance_2024-25"
OUT = ROOT / "data" / "build" / "adult_care.json"
YEAR, PREV = "2024 to 2025", "2023 to 2024"
# Types of long-term care, in residents' words, from the columns of Tables 43 and 44.
SETTINGS = {
    "care_homes": ("Nursing", "Residential"),
    "home_care": ("Community: Home care",),
    "supported_living": ("Community: Supported living",),
    "direct_payments": ("Community: Direct payments",),
    "supported_accommodation": ("Supported accommodation",),
    "other_long_term": ("Community: Other Long term care",),
}


def table(book: Dict[str, List[list]], name: str) -> Dict[str, Dict[str, Any]]:
    """One data table as {ONS code: {column: value}}, councils only. "[x]" (not submitted) and "[z]" (not applicable)
    become None."""
    rows = book[name]
    hi = next(i for i, r in enumerate(rows) if r and r[0] == "Geography code")
    head = [str(h).strip() for h in rows[hi]]
    out = {}
    for r in rows[hi + 1:]:
        # Unitaries (E06), metropolitan districts (E08), London boroughs (E09) and county councils (E10): not regions.
        if not r or not isinstance(r[0], str) or not r[0].startswith(("E06", "E08", "E09", "E10")):
            continue
        out[r[0]] = {h: (None if isinstance(v, str) and v.startswith("[") else v) for h, v in zip(head, r)}
    return out


def num(row: Dict[str, Any], col: str) -> Optional[float]:
    v = row.get(col)
    return None if v is None else float(v)


def councils() -> List[Dict[str, str]]:
    """Every English council on the site that runs social care: Hammersmith & Fulham, the single-tier councils in
    data/config/boroughs.json, and the county council of each two-tier area (Oxfordshire for South Oxfordshire)."""
    cfg = json.loads((ROOT / "data" / "config" / "boroughs.json").read_text())["boroughs"]
    seed = json.loads((ROOT / "data" / "seed" / "hf_2026-27.json").read_text())["meta"]
    out = [{"slug": "", "ons": seed["council_code"]}] + [{"slug": b["slug"], "ons": b["ons"]} for b in cfg if b["ons"].startswith("E") and not b.get("county")]
    # In a two-tier area the county runs social care: its figures, not the district's.
    return out + [{"slug": b["slug"], "ons": b["county"]["ons"]} for b in cfg if b.get("county")]


def build(reg: Dict[str, Any]) -> Dict[str, Any]:
    book = read_ods(str(ROOT / "data" / "raw" / reg[SOURCE_ID]["file"]))
    t14, t43, t44, t51, t52 = (table(book, f"Table_{n}") for n in (14, 43, 44, 51, 52))
    out: Dict[str, Any] = {}
    for c in councils():
        ons = c["ons"]
        check(all(ons in t for t in (t14, t43, t44, t51, t52)), f"adult care: no row for {ons} ({c['slug'] or 'Hammersmith & Fulham'})")
        name = t14[ons]["LA name"]
        for t, age in ((t43, "18 to 64"), (t44, "65 and over")):
            parts = sum(num(t[ons], col) or 0 for cols in SETTINGS.values() for col in cols)
            check(close(parts, num(t[ons], "Total"), 0.5), f"adult care {name} {age}: types of long-term care add up to £{parts:,.0f}k, the total is £{num(t[ons], 'Total'):,.0f}k")
        long_term = num(t43[ons], "Total") + num(t44[ons], "Total")
        check(close(long_term, num(t14[ons], "Long term care"), 1.0), f"adult care {name}: the two age groups' long-term care £{long_term:,.0f}k ≠ Table 14's £{num(t14[ons], 'Long term care'):,.0f}k")
        spend = {k: num(t14[ons], col) for k, col in (("total", "Total"), ("long_term", "Long term care"), ("short_term", "Short term care"), ("other", "Other"))}
        check(close(spend["long_term"] + spend["short_term"] + spend["other"], spend["total"], 1.0), f"adult care {name}: long-term, short-term and other care do not add up to the total")
        settings = {k: round(sum(num(t[ons], col) or 0 for t in (t43, t44) for col in cols), 2) for k, cols in SETTINGS.items()}

        def units(year: str) -> Dict[str, Optional[float]]:
            r52, r51 = t52[ons], t51[ons]
            ext, inh = num(r51, f"External: {year}"), num(r51, f"In house: {year}")
            return {
                "residential_65": num(r52, f"Residential: 65 and over, {year}"),
                "nursing_65": num(r52, f"Nursing: 65 and over, {year}"),
                "residential_18_64": num(r52, f"Residential: 18 to 64, {year}"),
                "nursing_18_64": num(r52, f"Nursing: 18 to 64, {year}"),
                # Most councils buy home care from agencies; a council that only provides its own gives that rate.
                "home_care_hour": ext if ext is not None else inh,
            }
        now, prev = units(YEAR), units(PREV)
        out[ons] = {
            "name": name,
            "spend_k": {k: round(v, 2) for k, v in spend.items()},
            "settings_k": settings,
            # Long-term care by age (Tables 43 and 44), which add up to Table 14's long-term care (checked above).
            "long_term_by_age_k": {"working_age": round(num(t43[ons], "Total"), 2), "older": round(num(t44[ons], "Total"), 2)},
            "home_care_from": "agencies" if num(t51[ons], f"External: {YEAR}") is not None else "the council",
            "unit": {k: (round(v, 2) if v is not None else None) for k, v in now.items()},
            "unit_prev": {k: (round(v, 2) if v is not None else None) for k, v in prev.items()},
        }
    return {
        "note": "Generated by etl/adult_care.py from the adult social care finance report. Do not edit by hand; re-run it.",
        "year": "2024-25",
        "prev_year": "2023-24",
        "source": source_entry(reg[SOURCE_ID]),
        "quality": "sourced",
        "source_id": SOURCE_ID,
        "councils": out,
    }


def main(check_only: bool) -> int:
    reg = {s["id"]: s for s in load_sources()}
    try:
        data = serialise(build(reg))
    except CheckFailed as e:
        print(f"adult care: {e}")
        return 1
    if check_only:
        if not OUT.exists() or OUT.read_bytes() != data:
            print("adult care: data/build/adult_care.json is out of date. Run python3 etl/adult_care.py and commit.")
            return 1
        print("adult care: up to date; every check passed.")
        return 0
    OUT.write_bytes(data)
    out = json.loads(data)
    hf = next(iter(out["councils"].values()))
    print(f"adult care: {len(out['councils'])} councils; {hf['name']}: £{hf['spend_k']['total'] / 1000:,.1f}m, care home 65+ £{hf['unit']['residential_65']:,.2f} a week, home care £{hf['unit']['home_care_hour']:.2f} an hour")
    return 0


if __name__ == "__main__":
    sys.exit(main("--check" in sys.argv))
