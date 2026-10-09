"""Northern Ireland's councils (Belfast first): domestic rates and the council's budget, checked, in
data/build/boroughs/<slug>/statement.json (packages/schema RatesStatement).

    python3 etl/northern_ireland.py           build every Northern Ireland council in data/config/boroughs.json
    python3 etl/northern_ireland.py --check   fail if any is out of date

What differs from Great Britain (docs/BOROUGHS.md):
- Homes pay rates, not council tax: capital value (at 1 January 2005, capped at £400,000) times the council's district
  rate plus the Executive's regional rate. No bands. The regional rate pays for the Executive's services, not the council's.
- The council's remit is narrower: no schools, care, roads, housing or libraries. Its budget is what it needs from rates
  and government grants after its own fees, charges and other grants (the "amount to be raised").
- The sources are a Department of Finance web table and PDFs (the Department for Communities' rate statistics and the
  council's committee minutes), read by hand into data/manual/ with page numbers. Every figure must agree with the
  others: each year's district rate in the Department of Finance's table and in two circulars; the domestic rate is the
  business rate times the council's conversion factor; the rate times the penny product is what the rate raises; what
  the rate and the grants raise is the amount to be raised; and the committees' budgets add up to it.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Dict, List

sys.path.insert(0, str(Path(__file__).resolve().parent))

from build import cited_sources, serialise, source_entry  # noqa: E402
from extract import CheckFailed, check, close, read_csv  # noqa: E402
from fetch import ROOT, load_sources  # noqa: E402

CONFIG = ROOT / "data" / "config" / "boroughs.json"
OUT = ROOT / "data" / "build" / "boroughs"
YEAR, PREV = "2026-27", "2025-26"
YEARS = ["2022-23", "2023-24", "2024-25", "2025-26", YEAR]
# The figures were read by a person or by Claude ("checked") from documents a script cannot read in CI; they are approx
# until the owner has looked at each table once and marked it "yes".
REVIEWED = ("no", "checked", "yes")


def councils() -> List[Dict[str, Any]]:
    return [b for b in json.loads(CONFIG.read_text())["boroughs"] if b.get("nation") == "northern_ireland"]


def quality(rows: List[Dict[str, str]]) -> str:
    for r in rows:
        check(r["reviewed"] in REVIEWED, f"{r}: reviewed must be no, checked or yes")
    return "sourced" if all(r["reviewed"] == "yes" for r in rows) else "approx"


def poundages(name: str) -> Dict[str, Dict[str, Any]]:
    """The domestic district and regional rates by year (data/manual/ni_poundages.csv), £ per £1 of capital value."""
    out: Dict[str, Dict[str, Any]] = {}
    for r in read_csv("ni_poundages.csv"):
        if r["council"] != name:
            continue
        d, g, t = float(r["domestic_district"]), float(r["domestic_regional"]), float(r["domestic_total"])
        check(close(d + g, t, 5e-7), f"ni_poundages.csv {r['year']}: district and regional rates add up to {d + g:.6f}, the table says {t}")
        check(r["year"] not in out, f"ni_poundages.csv: {r['year']} twice")
        out[r["year"]] = {"district": d, "regional": g, "row": r}
    check(sorted(out) == YEARS, f"ni_poundages.csv: {name} needs {YEARS}, has {sorted(out)}")
    return out


def statistics(name: str) -> Dict[str, Dict[str, Any]]:
    """The council's rows in the Department for Communities' rate statistics (data/manual/ni_rate_statistics.csv), by
    year: each field's value, which must be the same in every circular that gives it."""
    out: Dict[str, Dict[str, Any]] = {}
    for r in read_csv("ni_rate_statistics.csv"):
        if r["council"] != name:
            continue
        year = out.setdefault(r["year"], {"_rows": [], "_sources": set()})
        v = float(r["value"])
        if r["field"] in year:
            check(year[r["field"]] == v, f"ni_rate_statistics.csv {r['year']} {r['field']}: {r['source_id']} says {v}, another circular {year[r['field']]}")
        year[r["field"]] = v
        year["_rows"].append(r)
        year["_sources"].add(r["source_id"])
    return out


def check_year(name: str, year: str, s: Dict[str, Any], pounds: Dict[str, Any]) -> None:
    """One year's circular figures against each other and against the Department of Finance's poundage."""
    check(close(s["domestic_district_rate_p"] / 100, pounds["district"], 5e-9),
          f"{name} {year}: the circulars give a domestic district rate of {s['domestic_district_rate_p']}p, the Department of Finance {pounds['district']}")
    if "conversion_factor" in s:
        # The domestic rate is the business rate times the council's conversion factor, to four places of a penny.
        check(close(round(s["nondomestic_district_rate_p"] * s["conversion_factor"], 4), s["domestic_district_rate_p"], 5e-9),
              f"{name} {year}: {s['nondomestic_district_rate_p']}p × {s['conversion_factor']} is not {s['domestic_district_rate_p']}p")
    if "penny_product_rateable" in s:
        check(close(s["penny_product_rateable"] + s["penny_product_derated"] + s["penny_product_tfg"], s["penny_product_total"], 0.5), f"{name} {year}: penny products do not add up")
        # What the rate raises is the rateable penny product times the business rate in pence; the rate is rounded to
        # four places, so allow that much.
        raised = s["penny_product_rateable"] * s["nondomestic_district_rate_p"]
        check(close(raised, s["district_rates_income"], s["penny_product_rateable"] * 0.00005 + 1),
              f"{name} {year}: penny product × rate is £{raised:,.0f}, the circular says £{s['district_rates_income']:,.0f}")
        via = s["amount_to_be_raised"] + s["rates_support_grant"] + s["balance_applied"]
        check(close(s["district_rates_income"] + s["derating_grant"] + s["transferred_functions_grant"], via, 0.5),
              f"{name} {year}: the rate and the grants do not add up to the amount to be raised")


def build_one(reg: Dict[str, Any], b: Dict[str, Any]) -> Dict[str, Any]:
    name = b["short"]
    pounds = poundages(name)
    stats = statistics(name)
    check(sorted(stats) == YEARS, f"ni_rate_statistics.csv: {name} needs {YEARS}, has {sorted(stats)}")
    for y in YEARS:
        check_year(name, y, stats[y], pounds[y])
    now = stats[YEAR]
    check(now["balance_applied"] == 0 and now["rates_support_grant"] == 0, f"{name}: reserves or Rates Support Grant used; show them as funding lines first")

    # ---------------------------------------------------------------- the budget by committee
    rows = [r for r in read_csv("belfast_budget.csv") if r["year"] == YEAR]
    got = {r["line"]: float(r["amount"]) for r in rows}
    committees = ["people_communities", "strategic_policy_resources", "city_growth_regeneration", "planning", "capital_financing"]
    check(all(k in got for k in committees + ["growth_fund_stated_m", "belfast_investment_fund", "city_deal"]), "belfast_budget.csv: a line is missing")
    # The minutes give the growth fund only as "4.2m": it is what the total leaves once the rest is taken off, and must
    # round to it.
    growth = now["amount_to_be_raised"] - sum(got[k] for k in committees)
    check(close(growth / 1e6, got["growth_fund_stated_m"], 0.05), f"{name}: the growth fund by difference is £{growth:,.0f}, the minutes say £{got['growth_fund_stated_m']}m")
    check(got["belfast_investment_fund"] + got["city_deal"] < got["strategic_policy_resources"], f"{name}: the funds named inside Strategic Policy and Resources exceed it")
    q_budget = quality(rows)
    q_stats = quality(now["_rows"])
    q_pounds = quality([pounds[y]["row"] for y in YEARS])
    m = lambda v: round(v / 1e6, 6)  # noqa: E731
    spr_src = "belfast_spr_2026-02-13"
    cash = lambda what: f"Belfast City Council, Strategic Policy and Resources Committee, 13 February 2026, resolution 2: {what} for {YEAR} (page 3)."  # noqa: E731
    services = [
        {"id": "people_communities", "label": "Bins, streets, parks, leisure and communities", "official_term": "People and Communities Committee cash limit",
         "desc": "Bin collections and recycling, street cleaning, parks and open spaces, leisure centres, community services and environmental health",
         "m": m(got["people_communities"]), "general_fund_m": m(got["people_communities"]), "quality": q_budget, "source_id": spr_src, "method_note": cash("the People and Communities Committee's cash limit")},
        {"id": "strategic_policy_resources", "label": "Running the council, and city funds", "official_term": "Strategic Policy and Resources Committee cash limit",
         "desc": "The council's own finance, staff, property and legal services, with £0.9m for the Belfast Investment Fund and £3.0m towards the Belfast Region City Deal",
         "m": m(got["strategic_policy_resources"]), "general_fund_m": m(got["strategic_policy_resources"]), "quality": q_budget, "source_id": spr_src,
         "method_note": cash("the Strategic Policy and Resources Committee's cash limit, including £900,000 for the Belfast Investment Fund and £3,000,000 for City Deal")},
        {"id": "capital_financing", "label": "Paying for past building projects", "official_term": "Capital financing budget",
         "desc": "Repaying the loans and setting aside money for buildings, parks and other long-term projects",
         "m": m(got["capital_financing"]), "general_fund_m": m(got["capital_financing"]), "quality": q_budget, "source_id": spr_src, "method_note": cash("the Capital Financing Budget")},
        {"id": "city_growth_regeneration", "label": "Jobs, tourism, culture and regeneration", "official_term": "City Growth and Regeneration Committee cash limit",
         "desc": "Help for businesses and jobs, tourism, events, culture and the arts, markets and regenerating the city centre",
         "m": m(got["city_growth_regeneration"]), "general_fund_m": m(got["city_growth_regeneration"]), "quality": q_budget, "source_id": spr_src, "method_note": cash("the City Growth and Regeneration Committee's cash limit")},
        {"id": "growth_fund", "label": "Growth fund", "official_term": "Growth fund",
         "desc": "Set aside for new spending this year. The minutes give it only as £4.2m, so this is what the total leaves once the other lines are taken off",
         "m": m(growth), "general_fund_m": m(growth), "quality": "approx", "source_id": spr_src,
         "method_note": f"The amount to be raised (Department for Communities, Table 1) less the four committees' cash limits and the capital financing budget; the minutes say \"A growth fund of 4.2m\" (page 3)."},
        {"id": "planning", "label": "Planning", "official_term": "Planning Committee cash limit",
         "desc": "Deciding planning applications and preparing the city's plan for how land is used",
         "m": m(got["planning"]), "general_fund_m": m(got["planning"]), "quality": q_budget, "source_id": spr_src, "method_note": cash("the Planning Committee's cash limit")},
    ]
    dfc = "dfc_rate_statistics_2026-27"
    funding = [
        {"id": "district_rates", "label": "District rates (homes and businesses)", "official_term": "Estimated amount to be raised via district rates (rateable)", "kind": "rates",
         "m": m(now["district_rates_income"]),
         "desc": "The council's part of every rates bill, paid by homes and businesses alike. The regional rate on the same bill goes to the Executive, not the council",
         "quality": q_stats, "source_id": dfc, "method_note": "Department for Communities, District Council Rate Statistics 2026/2027, Table 2 (page 2): estimated amount to be raised via district rates."},
        {"id": "derating_grant", "label": "De-rating grant", "official_term": "Estimated de-rating grant", "kind": "grant", "m": m(now["derating_grant"]),
         "desc": "Paid by the Executive to make up the rates that some property, such as factories, is let off",
         "quality": q_stats, "source_id": dfc, "method_note": "Department for Communities, District Council Rate Statistics 2026/2027, Table 2 (page 2): estimated de-rating grant."},
    ]
    total_s, total_f = sum(x["m"] for x in services), sum(x["m"] for x in funding)
    check(close(total_s, m(now["amount_to_be_raised"]), 1e-6) and close(total_f, total_s, 1e-6), f"{name}: funding £{total_f}m, spending £{total_s}m, amount to be raised £{m(now['amount_to_be_raised'])}m")

    p_src = lambda y: pounds[y]["row"]["source_id"]  # noqa: E731
    out: Dict[str, Any] = {
        "meta": {
            "council": b["council"], "council_short": name, "council_code": b["ons"], "slug": b["slug"], "year": YEAR,
            "note": "Built by etl/northern_ireland.py from the Department of Finance's rate poundages, the Department for Communities' rate statistics and the council's minutes, read into data/manual/ and checked against each other.",
            "vintage": "", "sources": [],
        },
        "rates": {
            "district": pounds[YEAR]["district"], "regional": pounds[YEAR]["regional"], "district_prev": pounds[PREV]["district"], "regional_prev": pounds[PREV]["regional"],
            "quality": q_pounds, "source_id": p_src(YEAR),
            "method_note": "Department of Finance, Rate Poundages: domestic district and regional rates for Belfast, in £ per £1 of capital value; each district rate matches the Department for Communities' rate statistics.",
        },
        "example_value": {"value": 123000, "label": "the average capital value of a home in Northern Ireland", "quality": "sourced", "source_id": "dof_regional_rate_2026-27",
                          "method_note": "Department of Finance, 12 February 2026, note 2: the average capital value in the Domestic Valuation List. There is no official average for Belfast."},
        "amount_raised": {"m": m(now["amount_to_be_raised"]), "reserves_m": m(now["balance_applied"]), "quality": q_stats, "source_id": dfc,
                          "method_note": "Department for Communities, District Council Rate Statistics 2026/2027, Table 1 (page 1): total amount to be raised, and the balance applied from reserves (none)."},
        "history": [
            {"year": y, "district": pounds[y]["district"], "regional": pounds[y]["regional"], "amount_raised_m": m(stats[y]["amount_to_be_raised"]),
             "quality": "sourced" if q_pounds == q_stats == "sourced" else "approx", "source_ids": sorted({p_src(y), *stats[y]["_sources"]})}
            for y in YEARS
        ],
        "funding": funding,
        "services": sorted(services, key=lambda x: -x["m"]),
    }
    cited = set(cited_sources(out))
    out["meta"]["sources"] = [source_entry(reg[s]) for s in reg if s in cited]
    missing = cited - set(reg)
    check(not missing, f"{name}: unknown sources {sorted(missing)}")
    out["meta"]["vintage"] = max(reg[s]["published_on"] for s in cited if "published_on" in reg[s])
    return out


def main(check_only: bool) -> int:
    reg = {s["id"]: s for s in load_sources()}
    stale = []
    for b in councils():
        try:
            out = build_one(reg, b)
        except CheckFailed as e:
            print(f"northern ireland {b['slug']}: {e}")
            return 1
        path = OUT / b["slug"] / "statement.json"
        data = serialise(out)
        if check_only:
            if not path.exists() or path.read_bytes() != data:
                stale.append(b["slug"])
            continue
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        r = out["rates"]
        print(f"northern ireland {b['slug']}: district {r['district'] * 100:.4f}p, regional {r['regional'] * 100:.4f}p in the pound; "
              f"{len(out['services'])} budget lines, £{sum(s['m'] for s in out['services']):,.3f}m")
    if stale:
        print(f"northern ireland: out of date: {', '.join(stale)}. Run python3 etl/northern_ireland.py and commit.")
        return 1
    if check_only:
        print("northern ireland: every statement is up to date; every check passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main("--check" in sys.argv))
