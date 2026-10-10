"""What care for children costs, for every English council on the site: the Department for Education's spending on
children looked after (Section 251 outturn, 2024/25) and its count of children in care on 31 March 2025, into
data/build/children_care.json.

    python3 etl/children_care.py           build
    python3 etl/children_care.py --check   fail if out of date

Neither source gives a cost per child, and the Department and the National Audit Office warn that councils' accounts
vary, so no council's spending is divided by its children here. For England only, as context, a year in a children's
home is worked out the National Audit Office's way (spending on children's homes divided by the children living in them)
and marked as our own sum.

Checks: each council's types of spending on children in care add up to its total; the counts by placement never exceed
the total, and equal it where nothing is withheld; every council on the site has a row (or is marked withheld by the
Department, as Wandsworth's spending is for 2024/25).
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parent))

from adult_care import councils  # noqa: E402
from build import serialise, source_entry  # noqa: E402
from extract import CheckFailed, check, close  # noqa: E402
from fetch import ROOT, load_sources  # noqa: E402

OUT = ROOT / "data" / "build" / "children_care.json"
SPEND, RATES, PLACED = "dfe_s251_childrens_2024-25", "dfe_cla_rates_2025", "dfe_cla_31_march_2025"
PERIOD = "202425"
# Spending on children looked after, in residents' words, by the Section 251 line.
LINES = {
    "residential": "3.1.1 Residential care",
    "fostering": "3.1.2 Total fostering services",
    "adoption": "3.1.3 Adoption services",
    "special_guardianship": "3.1.4 Special guardianship support",
    "other": "3.1.5 Other children looked after services",
    "short_breaks": "3.1.6 Short breaks (respite) for looked after disabled children",
    "family_friends": "3.1.7 Children placed with family and friends",
    "education": "3.1.8 Education of looked after children",
    "leaving_care": "3.1.9 Leaving care support services",
    "asylum": "3.1.10 Asylum seeker services children",
}
TOTAL, CHILDRENS = "3.1.11 Total Children Looked After", "5.0.2 Total Children and Young Peoples Services Expenditure (excluding CERA)"
PLACEMENTS = {
    "foster": "Foster placements",
    "childrens_homes": "Secure homes and children's homes",
    "supported_accommodation": "Independent and semi-independent living arrangements/supported accommodation",
    "with_parents": "Placed with parents or other person with parental responsibility",
    "adoption": "Placed for adoption",
    "residential_schools": "Residential schools",
    "other_residential": "Other residential settings",
    "other": "Other placements",
}


def read(reg: Dict[str, Any], sid: str) -> List[Dict[str, str]]:
    with open(ROOT / "data" / "raw" / reg[sid]["file"], newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def count(v: str) -> Optional[int]:
    """A count, or None where the Department withholds it ("c") to protect children's identities."""
    return None if v.strip() in ("c", "x", "z", "") else int(float(v))


def build(reg: Dict[str, Any]) -> Dict[str, Any]:
    spend_rows = [r for r in read(reg, SPEND) if r["time_period"] == PERIOD]
    placed_rows = [r for r in read(reg, PLACED) if r["time_period"] == "2025" and r["characteristic"] == "Placement"]
    out: Dict[str, Any] = {}
    for c in councils():
        ons = c["ons"]
        placed = {r["breakdown"]: r["children_count"] for r in placed_rows if r["geographic_level"] == "Local authority" and r["new_la_code"] == ons}
        check(placed, f"children: no count of children in care for {ons} ({c['slug'] or 'Hammersmith & Fulham'})")
        # The Department's own council number joins the two files (the spending file keeps old codes for some councils).
        code = next(r["old_la_code"] for r in placed_rows if r["new_la_code"] == ons)
        rows = {r["description_of_expenditure"]: r for r in spend_rows if r["geographic_level"] == "Local authority" and r["old_la_code"] == code}
        check(TOTAL in rows and CHILDRENS in rows, f"children: no spending lines for {ons} (council {code})")
        name = rows[TOTAL]["la_name"]
        withheld = rows[TOTAL]["total_expenditure"].strip() == "c"
        spend: Optional[Dict[str, float]] = None
        if not withheld:
            spend = {k: float(rows[line]["total_expenditure"]) for k, line in LINES.items()}
            total = float(rows[TOTAL]["total_expenditure"])
            check(close(sum(spend.values()), total, 10.0), f"children {name}: types of spending add up to £{sum(spend.values()):,.0f}, the total is £{total:,.0f}")
            spend = {**{k: round(v / 1e6, 6) for k, v in spend.items()}, "total": round(total / 1e6, 6), "childrens_services": round(float(rows[CHILDRENS]["total_expenditure"]) / 1e6, 6)}
        total_children = count(placed["Total"])
        check(total_children is not None, f"children {name}: no total count")
        by = {k: count(placed.get(label, "c")) for k, label in PLACEMENTS.items()}
        known = sum(v for v in by.values() if v is not None)
        check(known <= total_children and (known == total_children or any(v is None for v in by.values())), f"children {name}: placements {known} do not fit the total {total_children}")
        out[ons] = {"name": name, "la_code": code, "withheld": withheld, "spend_m": spend, "children": total_children, "placements": by}

    # England, for context: a year in a children's home, the National Audit Office's way (our own sum).
    eng_spend = next(float(r["total_expenditure"]) for r in spend_rows if r["geographic_level"] == "National" and r["description_of_expenditure"] == LINES["residential"])
    eng_total = next(float(r["total_expenditure"]) for r in spend_rows if r["geographic_level"] == "National" and r["description_of_expenditure"] == TOTAL)
    eng = {r["breakdown"]: count(r["children_count"]) for r in placed_rows if r["geographic_level"] == "National"}
    homes = eng[PLACEMENTS["childrens_homes"]] + eng[PLACEMENTS["residential_schools"]]
    return {
        "note": "Generated by etl/children_care.py from the Department for Education's statistics. Do not edit by hand; re-run it.",
        "year": "2024-25",
        "count_date": "2025-03-31",
        "sources": [source_entry(reg[s]) for s in (SPEND, RATES, PLACED)],
        "quality": "sourced",
        "source_ids": [SPEND, PLACED],
        "england": {
            "spend_m": round(eng_total / 1e6, 3),
            "children": eng["Total"],
            "home_year": round(eng_spend / homes),
            "home_year_quality": "modelled",
            "home_year_method": f"Spending on residential care in 2024/25 (£{eng_spend:,.0f}, Section 251 line 3.1.1) divided by children in secure and children's homes and residential schools on 31 March 2025 ({homes:,}), as the National Audit Office did in Managing children's residential care (September 2025). Our own sum: the Department publishes no cost per child.",
        },
        "councils": out,
    }


def main(check_only: bool) -> int:
    reg = {s["id"]: s for s in load_sources()}
    try:
        data = serialise(build(reg))
    except CheckFailed as e:
        print(f"children: {e}")
        return 1
    if check_only:
        if not OUT.exists() or OUT.read_bytes() != data:
            print("children: data/build/children_care.json is out of date. Run python3 etl/children_care.py and commit.")
            return 1
        print("children: up to date; every check passed.")
        return 0
    OUT.write_bytes(data)
    out = json.loads(data)
    hf = out["councils"]["E09000013"]
    print(f"children: {len(out['councils'])} councils ({sum(1 for c in out['councils'].values() if c['withheld'])} withheld); {hf['name']}: £{hf['spend_m']['total']:.1f}m on {hf['children']} children in care; England: a year in a children's home £{out['england']['home_year']:,}")
    return 0


if __name__ == "__main__":
    sys.exit(main("--check" in sys.argv))
