"""Welsh councils (Cardiff first): the checked statement StatsWales gives, in the same shape as the English boroughs'
(data/build/boroughs/<slug>/statement.json).

    python3 etl/wales.py           build every Welsh council in data/config/boroughs.json
    python3 etl/wales.py --check   fail if any is out of date

What differs from England and Scotland (docs/BOROUGHS.md):
- Nine bands, A to I (data/config/rules_wales.json), and a police precept but no fire precept: the council pays South
  Wales Fire and Rescue a levy out of its own share, which the return leaves out of its service lines.
- Community councils, which only some areas have (Cardiff: six of 36), rather than parishes.
- Spending by service is before specific grants (£318m in Cardiff), which are one funding line, not tied to services.
Every part must add up to the sources' own totals, and every band to Band D times its ratio, or the build stops.
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path
from typing import Any, Dict, List

sys.path.insert(0, str(Path(__file__).resolve().parent))

from build import cited_sources, serialise, source_entry  # noqa: E402
from extract import CheckFailed, check, close, read_csv  # noqa: E402
from fetch import ROOT, load_sources  # noqa: E402

CONFIG = ROOT / "data" / "config" / "boroughs.json"
RULES = ROOT / "data" / "config" / "rules_wales.json"
OUT = ROOT / "data" / "build" / "boroughs"
RAW = ROOT / "data" / "raw"
YEAR, PREV = "2026-27", "2025-26"


def councils() -> List[Dict[str, Any]]:
    return [b for b in json.loads(CONFIG.read_text())["boroughs"] if b.get("nation") == "wales"]


def ratios() -> Dict[str, float]:
    return {band: n / d for band, (n, d) in json.loads(RULES.read_text())["band_ratios"]["value"].items()}


def table(reg: Dict[str, Any], kind: str) -> List[Dict[str, str]]:
    """A StatsWales download (one council's rows) by its extract kind."""
    s = next(s for s in reg.values() if s.get("extract", {}).get("kind") == kind)
    with open(RAW / s["file"], newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def pick(rows: List[Dict[str, str]], **match: str) -> float:
    found = [r for r in rows if all(r.get(k) == v for k, v in match.items())]
    check(len(found) == 1, f"StatsWales: {len(found)} rows for {match}")
    return float(found[0]["Data values"])


def build_one(reg: Dict[str, Any], b: Dict[str, Any]) -> Dict[str, Any]:
    name = b["short"]
    comp, levels, br1 = table(reg, "statswales_composition"), table(reg, "statswales_levels"), table(reg, "statswales_br1")
    spend, fin = table(reg, "statswales_spend"), table(reg, "statswales_financing")
    for rows in (comp, levels, br1, spend, fin):
        check({r["Authority"] for r in rows} == {name}, f"StatsWales: rows for {sorted({r['Authority'] for r in rows})}, not {name}")
    per_d = [r for r in comp if r["Data description"] == "£ per band D"]  # the table also gives the change in %
    c = lambda row, y: pick(per_d, Row=row, Year=y)  # noqa: E731
    b1 = lambda row, y=YEAR: pick(br1, Row=row, Year=y)  # noqa: E731
    k = lambda svc: pick([r for r in spend if r["Data description"] == "£ thousand"], Service=svc, Year=YEAR)  # noqa: E731
    f = lambda src: pick(fin, **{"Source of funding": src, "Year": f"{YEAR} Budget"})  # noqa: E731
    m = lambda x: round(x / 1000, 3)  # noqa: E731

    # ---------------------------------------------------------------- the bill, five years
    years = ["2022-23", "2023-24", "2024-25", "2025-26", YEAR]
    band_d: Dict[str, Dict[str, float]] = {}
    for y in years:
        council, police, community = c("County council CT (exc. community councils)", y), c("Police council tax within county area", y), c("Community council CT", y)
        incl, area = c("County council CT (inc. community councils)", y), c("Total CT for billing authority area", y)
        check(close(council + community, incl, 0.006) and close(incl + police, area, 0.006), f"{name} {y}: Band D parts do not add up")
        base, ct, police_total = b1("Council tax base for tax-setting purposes (number of band D equivalents)", y), b1("Amount to be collected from the council tax", y), b1("Precept of police authority", y)
        # The tax base times each Band D gives what is raised, to the £1,000 of rounding.
        check(close(base * incl / 1000, ct, max(1.0, base * 0.005 / 1000)), f"{name} {y}: tax base × Band D ≠ council tax to be collected")
        check(close(base * police / 1000, police_total, max(1.0, base * 0.005 / 1000)), f"{name} {y}: tax base × police Band D ≠ police precept")
        band_d[y] = {"council": round(council, 2), "police": round(police, 2), "community": community, "ct_m": m(ct), "base": base,
                     "rate": b1("Assumed collection rate (percentage)", y) / 100}
    r9 = ratios()
    area_d = c("Total CT for billing authority area", YEAR)
    for band, ratio in r9.items():
        # The published table is the area average (community councils spread over everyone): Band D times the ratio.
        check(close(pick(levels, Year=YEAR, Band=band), area_d * ratio, 0.006), f"{name}: Band {band} is not Band D × {ratio:.4f}")
    now, prev = band_d[YEAR], band_d[PREV]
    outside = round(now["council"] + now["police"], 2)  # what a home outside a community council pays
    precepts = b1("Community council precepts")
    names = b.get("community_councils", [])  # the councils that set a precept, as the council lists them
    bill = {
        "band_d_total": outside, "band_d_council": now["council"], "band_d_gla": now["police"],
        "band_d_total_prev": round(prev["council"] + prev["police"], 2), "band_d_council_prev": prev["council"],
        "council_rise_pct": round((now["council"] / prev["council"] - 1) * 100, 2),
        "published_bands": {band: round(outside * ratio, 2) for band, ratio in r9.items()},
        "gla_note": b["others"]["name"],
        "gla_split": [{"id": "police", "label": "Police", "phrase": "police", "official_term": "South Wales Police and Crime Commissioner's precept",
                       "band_d": now["police"], "band_d_prev": prev["police"], "quality": "sourced", "source_id": "statswales_ct_composition_cardiff",
                       "method_note": "Composition of average band D council tax: police council tax within the county area, this year and last."}],
        "others": b["others"],
        **({"parish": {"count": len(names), "names": ", ".join(names[:-1]) + " and " + names[-1], "total_m": round(precepts / 1000, 6), "kind": "community", "quality": "sourced", "source_id": "statswales_br1_cardiff",
                       "method_note": "Budget requirement (BR1): community council precepts. The council names the councils that set one."}} if names and precepts > 0 else {}),
        "quality": "sourced", "source_id": "statswales_ct_composition_cardiff",
        "method_note": "Council and police Band D from StatsWales's composition of Band D; every band is Band D times the Welsh ratio (A to I). Outside a community council.",
    }

    # ---------------------------------------------------------------- spending by service, before specific grants
    total_re, gross = k("Revenue expenditure"), f("Gross revenue expenditure")
    check(all(k(x) == 0 for x in ("Total police", "Total Fire service", "Law, order and protective services")), f"{name}: police or fire spending inside the council's lines")
    fire = gross - total_re  # the levy, which the return nets off the service lines (StatsWales release notes)
    check(fire > 0, f"{name}: the gross total is not above the service lines, so there is no fire levy to show")
    services: List[Dict[str, Any]] = []
    for g in sorted(read_csv("wales_service_groups.csv"), key=lambda g: int(g["order"])):
        if g["rows"] == "FIRE":
            v, rows_note = fire, "the financing table's gross revenue expenditure less the spending table's revenue expenditure"
        else:
            parts = g["rows"].split(";")
            v = sum(-k(x[1:]) if x.startswith("-") else k(x) for x in parts)
            rows_note = "; ".join(parts)
        services.append({
            "id": g["id"], "label": g["label"], "official_term": g["official_term"], "desc": g["desc"], "m": m(v), "general_fund_m": m(v),
            "quality": "sourced", "source_id": "statswales_ra_financing_cardiff" if g["rows"] == "FIRE" else "statswales_ra_spend_cardiff",
            "method_note": f"StatsWales, 2026-27 budget, £ thousand: {rows_note}. Before specific grants, which the return does not split by service.",
        })
    check(close(sum(s["m"] for s in services), m(gross), 0.005), f"{name}: services add up to {sum(s['m'] for s in services)}m, the gross total is {m(gross)}m")

    # ---------------------------------------------------------------- funding: the financing table's own identity
    parts = {"specific": f("Specific grants"), "reserves": f("Appropriations from(+) / to(-) reserves"), "ctr": f("Council tax reduction scheme (including RSG element)"),
             "relief": f("Discretionary non-domestic rate relief"), "rsg": f("Revenue support grant"), "ndr": f("Share of re-distributed non-domestic rates"),
             "ct": f("Amount to be collected from council tax"), "ct_payers": f("Amount to be collected from council tax payers"), "adj": f("Adjustments (including amending reports)")}
    check(close(sum(v for kk, v in parts.items() if kk != "ct_payers"), gross, 0.05), f"{name}: the financing lines do not add up to the gross total")
    check(close(parts["ct"] + parts["ctr"], parts["ct_payers"], 0.05) and close(parts["ct"], b1("Amount to be collected from the council tax"), 0.05), f"{name}: council tax lines disagree")
    src = "statswales_ra_financing_cardiff"
    note = lambda rows: f"StatsWales financing of revenue expenditure, 2026-27 budget: {rows}."  # noqa: E731
    funding = [
        {"id": "council_tax", "label": "Council tax", "official_term": "Amount to be collected from council tax payers", "kind": "council_tax", "m": m(parts["ct_payers"]),
         "desc": "What residents pay through the council's part of the bill, after Council Tax Reduction, including what it passes on to community councils",
         "quality": "sourced", "source_id": src, "method_note": note("amount to be collected from council tax payers")},
        {"id": "rsg", "label": "Revenue Support Grant", "official_term": "Revenue support grant", "kind": "grant", "m": m(parts["rsg"]),
         "desc": "The council's main general grant from the Welsh Government, which also pays for Council Tax Reduction",
         "quality": "sourced", "source_id": src, "method_note": note("revenue support grant")},
        {"id": "business_rates", "label": "Business rates (Wales's shared pot)", "official_term": "Share of re-distributed non-domestic rates, less discretionary relief", "kind": "business_rates",
         "m": m(parts["ndr"] + parts["relief"]),
         "desc": "Business rates are pooled across Wales and shared out per head of population, so this is not what local businesses pay; less the rate relief the council gives",
         "quality": "sourced", "source_id": src, "method_note": note("share of re-distributed non-domestic rates and discretionary non-domestic rate relief"),
         "detail": [{"label": "Share of the pool", "m": m(parts["ndr"])}, {"label": "Rate relief the council gives", "m": m(parts["relief"])}]},
        {"id": "specific_grants", "label": "Specific government grants", "official_term": "Specific grants", "kind": "grant", "m": m(parts["specific"]),
         "desc": "Grants for particular purposes, such as housing benefit and schools; the return does not say which services each pays for",
         "quality": "sourced", "source_id": src, "method_note": note("specific grants")},
        {"id": "council_reserves", "label": "Drawn from council reserves", "official_term": "Appropriations from (+) / to (-) reserves", "kind": "reserves", "m": m(parts["reserves"] + parts["adj"]),
         "desc": "One-off: once spent, the gap returns the year after", "gap": True,
         "quality": "sourced", "source_id": src, "method_note": note("appropriations from (+) / to (-) reserves")},
    ]
    check(close(sum(x["m"] for x in funding), sum(s["m"] for s in services), 0.005), f"{name}: funding ≠ spending")

    history = [{
        "year": y, "band_d_council": band_d[y]["council"], "band_d_area": round(band_d[y]["council"] + band_d[y]["police"], 2), "band_d_gla": band_d[y]["police"],
        "council_tax_requirement_m": band_d[y]["ct_m"], "tax_base": band_d[y]["base"], "collection_rate": band_d[y]["rate"],
        "source_ids": ["statswales_br1_cardiff", "statswales_ct_composition_cardiff"],
    } for y in years]

    out: Dict[str, Any] = {
        "meta": {
            "council": b["council"], "council_short": b["short"], "council_code": b["ons"], "slug": b["slug"], "year": YEAR,
            "note": "Built by etl/wales.py from StatsWales, with the same checks as the English boroughs' where Wales's returns allow.",
            "vintage": "", "sources": [],
        },
        "bill": bill,
        "history": {"council_tax": history, "budget": [], "outturn": [], "quality": "sourced"},
        "funding": funding,
        "services": services,
    }
    cited = set(cited_sources(out))
    out["meta"]["sources"] = [source_entry(reg[s]) for s in reg if s in cited]
    out["meta"]["vintage"] = max(reg[s]["published_on"] for s in cited if "published_on" in reg[s])
    return out


def main(check_only: bool) -> int:
    reg = {s["id"]: s for s in load_sources()}
    stale = []
    for b in councils():
        try:
            out = build_one(reg, b)
        except CheckFailed as e:
            print(f"wales {b['slug']}: {e}")
            return 1
        path = OUT / b["slug"] / "statement.json"
        data = serialise(out)
        if check_only:
            if not path.exists() or path.read_bytes() != data:
                stale.append(b["slug"])
            continue
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        bill = out["bill"]
        print(f"wales {b['slug']}: Band D £{bill['band_d_total']:,.2f} (council £{bill['band_d_council']:,.2f}, police £{bill['band_d_gla']:,.2f}), "
              f"{len(out['services'])} services, budget £{sum(s['m'] for s in out['services']):,.1f}m")
    if stale:
        print(f"wales: out of date: {', '.join(stale)}. Run python3 etl/wales.py and commit.")
        return 1
    if check_only:
        print("wales: every statement is up to date; every check passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main("--check" in sys.argv))
