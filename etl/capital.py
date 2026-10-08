"""The four-year building programme and the council homes budget, from the hand-made tables in data/manual/.

    python3 etl/capital.py           check the tables against their own totals and write data/build/capital.json
    python3 etl/capital.py --check   fail if data/build/capital.json is out of date or any check fails (CI)

data/manual/capital_2026-30.csv is Appendix 1 of the Four Year Capital Programme 2026-30 (Full Council, 25 February
2026), with Table 1's totals and the debt tables, as printed. data/manual/council_homes_2026-27.csv is Table 1 of the
council homes (HRA) budget report to Cabinet on 9 February 2026 and the facts the site quotes from it.

The council's tables are rounded to £0.1m, so each check allows for the rounding of the figures it adds: £0.05m for
each figure added and for the printed total. A line whose note starts "misprint:" is one where the printed total cannot
be right (its year columns and the section totals need another figure); its total is taken from its years and the
misprint is shown on the site. Anything else that does not add up stops the build.

The resolution Full Council passed names £135.5m and £318.8m, while the report's own tables add up to £135.0m and
£317.2m; both are kept and the site says so. Sourced once a person has checked every line (reviewed=yes); approx until.
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path
from typing import Dict, List

ROOT = Path(__file__).resolve().parent.parent
MANUAL = ROOT / "data" / "manual"
OUT = ROOT / "data" / "build" / "capital.json"
YEARS = ["2026-27", "2027-28", "2028-29", "2029-30"]
COLS = ["y2026_27", "y2027_28", "y2028_29", "y2029_30"]
# The resolution as passed (Full Council, 25 February 2026; decisions.json mg-73118), against the tables' totals.
RESOLUTION = {"gf_m": 135.5, "hra_m": 318.8, "decision_id": "mg-73118"}
SECTIONS = {
    "people": ("gf", "Schools and children"),
    "place_gf": ("gf", "Streets, buildings, parks and regeneration"),
    "housing": ("hra", "Repairs and safety in existing council homes"),
    "place_hra": ("hra", "New council homes and regeneration"),
}
FACTS = ["rent_rise_pct", "rent_rise_weekly", "service_charge_rise_weekly", "rent_1bed_weekly", "private_1bed_weekly", "rent_2bed_weekly",
         "private_2bed_weekly", "rent_1pct_m", "reserve_m", "homes", "new_homes_10y", "capital_10y_m", "retrofit_4y_m",
         "interest_to_rent_pct", "interest_to_rent_pct_2035_36", "repairs_per_home", "borrowing_per_home", "borrowing_per_home_2035_36"]


class CheckFailed(Exception):
    pass


def num(s: str) -> float:
    return float(s) if s not in ("", "-") else 0.0


def tol(n: int) -> float:
    """Most a sum of n figures rounded to £0.1m can differ from a printed total rounded the same way."""
    return 0.05 * (n + 1) + 1e-9


def near(a: float, b: float, n: int) -> bool:
    return abs(a - b) <= tol(n)


def read(name: str) -> List[Dict[str, str]]:
    with open(MANUAL / name, newline="") as f:
        return list(csv.DictReader(f))


def line(r: Dict[str, str], misprints: List[dict]) -> dict:
    years = [num(r[c]) for c in COLS]
    total = num(r["total"]) if r["total"] != "" else None
    if total is not None and not near(sum(years), total, sum(1 for y in years if y)):
        if r["note"].startswith("misprint:"):
            misprints.append({"label": r["label"], "section": SECTIONS[r["section"]][1], "used": round(sum(years), 1), "page": int(r["page"]), "note": r["note"].removeprefix("misprint:").strip()})
            total = round(sum(years), 1)
        else:
            raise CheckFailed(f"capital {r['section']} {r['label']}: years add up to {sum(years):.1f}, the printed total is {total}")
    out = {"label": r["label"], "plain": r["plain"] or r["label"], "years": years, "total": total, "page": int(r["page"])}
    if r["pledges"]:
        out["pledges"] = r["pledges"].split()
    if r["note"] and not r["note"].startswith("misprint:"):
        out["note"] = r["note"]
    return out


def add_up(parts: List[dict], whole: dict, what: str) -> None:
    for i, y in enumerate(YEARS):
        got = sum(p["years"][i] for p in parts)
        if not near(got, whole["years"][i], len(parts)):
            raise CheckFailed(f"{what} {y}: parts add up to {got:.1f}, the printed total is {whole['years'][i]}")
    got = sum(p["total"] for p in parts)
    if not near(got, whole["total"], len(parts)):
        raise CheckFailed(f"{what}, four years: parts add up to {got:.1f}, the printed total is {whole['total']}")


def programme() -> dict:
    rows = read("capital_2026-30.csv")
    misprints: List[dict] = []
    sections = []
    for sid, (account, plain) in SECTIONS.items():
        rs = [r for r in rows if r["section"] == sid]
        spend = [r for r in rs if r["kind"] == "spend"]
        groups = []
        for g in dict.fromkeys(r["group"] for r in spend):
            lines = [line(r, misprints) for r in spend if r["group"] == g]
            sub = [r for r in rs if r["kind"] == "subtotal" and r["group"] == g]
            if sub:
                subtotal = line(sub[0], misprints)
                add_up(lines, subtotal, f"capital {sid} {g}")
            else:  # no printed subtotal: the group is the whole section
                subtotal = None
            groups.append({"name": g, "plain": subtotal["plain"] if subtotal else plain, "lines": lines, "subtotal": subtotal})
        total = line(next(r for r in rs if r["kind"] == "total"), misprints)
        add_up([g["subtotal"] or {"years": [sum(l["years"][i] for l in g["lines"]) for i in range(4)], "total": sum(l["total"] for l in g["lines"])} for g in groups],
               total, f"capital {sid} expenditure")
        funding = [line(r, misprints) for r in rs if r["kind"] == "fund"]
        fund_total = line(next(r for r in rs if r["kind"] == "fund_total"), misprints)
        add_up(funding, fund_total, f"capital {sid} funding")
        for i, y in enumerate(YEARS):
            if not near(fund_total["years"][i], total["years"][i], 1):
                raise CheckFailed(f"capital {sid} {y}: funding {fund_total['years'][i]} differs from spending {total['years'][i]}")
        sections.append({"id": sid, "account": account, "plain": plain, "groups": groups, "total": total, "funding": funding})
    summary = {r["account"]: line(r, misprints) for r in rows if r["kind"] == "summary"}
    for account in ("gf", "hra"):
        add_up([s["total"] for s in sections if s["account"] == account], summary[account], f"capital {account} against Table 1")
    add_up([summary["gf"], summary["hra"]], summary["all"], "capital Table 1 total")
    debt = {}
    for r in rows:
        if r["kind"] == "debt":
            opening = float(r["note"].rsplit(":", 1)[1])
            debt[r["account"]] = {"plain": r["plain"], "opening": opening, "years": [num(r[c]) for c in COLS], "page": int(r["page"])}
    return {
        "source_id": "capital_programme_2026-30",
        "quality": "sourced" if all(r["reviewed"] == "yes" for r in rows) else "approx",
        "years": YEARS,
        "sections": sections,
        "summary": summary,
        "resolution": {**RESOLUTION, "gf_gap_m": round(RESOLUTION["gf_m"] - summary["gf"]["total"], 1), "hra_gap_m": round(RESOLUTION["hra_m"] - summary["hra"]["total"], 1)},
        "debt": debt,
        "misprints": misprints,
    }


def council_homes() -> dict:
    rows = read("council_homes_2026-27.csv")
    budget = [r for r in rows if r["kind"] in ("income", "spend")]
    for col, y in (("y2025_26", "2025/26"), ("y2026_27", "2026/27")):
        net = sum(num(r[col]) for r in budget)
        if not near(net, 0.0, len(budget)):
            raise CheckFailed(f"council homes {y}: income and spending leave {net:.1f}; the account must balance")
    facts = {r["key"]: {"label": r["label"], "value": float(r["y2026_27"]), "unit": r["unit"], "page": int(r["page"]), "note": r["note"]} for r in rows if r["kind"] == "fact"}
    missing = [k for k in FACTS if k not in facts]
    if missing:
        raise CheckFailed(f"council homes: facts missing {missing}")
    rent = [r for r in budget if r["key"] == "rents"][0]
    if not near(abs(num(rent["y2026_27"])) / abs(num(rent["y2025_26"])) - 1, facts["rent_rise_pct"]["value"] / 100, 1):
        raise CheckFailed("council homes: the rent line does not rise by about the stated percentage")
    return {
        "source_id": "hra_budget_2026-27",
        "quality": "sourced" if all(r["reviewed"] == "yes" for r in rows) else "approx",
        "years": ["2025-26", "2026-27"],
        "budget": [{"key": r["key"], "kind": r["kind"], "label": r["label"], "plain": r["plain"], "prev": num(r["y2025_26"]), "now": num(r["y2026_27"]), "page": int(r["page"])} for r in budget],
        "facts": facts,
    }


def build() -> dict:
    return {
        "note": "Built by etl/capital.py from data/manual/capital_2026-30.csv and data/manual/council_homes_2026-27.csv. £m unless a fact says otherwise.",
        "programme": programme(),
        "council_homes": council_homes(),
    }


def dump(obj: dict) -> str:
    return json.dumps(obj, ensure_ascii=False, indent=1) + "\n"


def main(argv: List[str]) -> None:
    try:
        out = build()
    except CheckFailed as e:
        raise SystemExit(f"capital: {e}")
    if "--check" in argv:
        if not OUT.exists() or OUT.read_text() != dump(out):
            raise SystemExit("capital: data/build/capital.json is out of date. Run python3 etl/capital.py and commit.")
        print("capital: data/build/capital.json is up to date; every check passed.")
        return
    OUT.write_text(dump(out))
    p = out["programme"]
    print(f"capital: building programme £{p['summary']['gf']['total']}m and council homes £{p['summary']['hra']['total']}m over four years; "
          f"{len(p['misprints'])} misprint(s) noted; resolution differs by £{p['resolution']['gf_gap_m']}m and £{p['resolution']['hra_gap_m']}m")


if __name__ == "__main__":
    main(sys.argv[1:])
