"""Scottish councils (Glasgow first): the checked statement the Scottish Government's returns and Scottish Water's
charges give, in the same shape as the English boroughs' (data/build/boroughs/<slug>/statement.json).

    python3 etl/scotland.py           build every Scottish council in data/config/boroughs.json
    python3 etl/scotland.py --check   fail if any is out of date

What differs from England (docs/BOROUGHS.md):
- Council tax bands use Scotland's ratios (data/config/rules_scotland.json), and there is no police or fire precept.
- Scottish Water's water and sewerage charges are on the same bill, at its own ratios (data/manual/scottish_water.csv).
- The budget is the Provisional Outturn and Budget Estimates (POBE) revenue workbook. It gives each service after its
  own grants, so nothing on the funding side is ring-fenced; the gap is met from reserves and capital money, all one-off.
Every part must add up to the workbook's own totals, and every band to Band D times its ratio, or the build stops.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parent))

from build import cited_sources, serialise, source_entry  # noqa: E402
from extract import CheckFailed, check, close, read_csv  # noqa: E402
from fetch import ROOT, load_sources  # noqa: E402
from xlsx import read_xlsx  # noqa: E402

CONFIG = ROOT / "data" / "config" / "boroughs.json"
RULES = ROOT / "data" / "config" / "rules_scotland.json"
OUT = ROOT / "data" / "build" / "boroughs"
RAW = ROOT / "data" / "raw"
YEAR, PREV = "2026-27", "2025-26"
BANDS = "ABCDEFGH"


def councils() -> List[Dict[str, Any]]:
    return [b for b in json.loads(CONFIG.read_text())["boroughs"] if b.get("nation") == "scotland"]


def ratios(key: str) -> Dict[str, float]:
    rules = json.loads(RULES.read_text())
    return {band: n / d for band, (n, d) in rules[key]["value"].items()}


def first_sheet(reg: Dict[str, Any], source_id: str) -> List[List[Any]]:
    return next(iter(read_xlsx(str(RAW / reg[source_id]["file"])).values()))


def ct_bands(reg: Dict[str, Any], name: str) -> Dict[str, float]:
    """This year's council tax by band from the Scottish Government's table: every band is Band D times Scotland's ratio."""
    sheet = first_sheet(reg, "scot_ct_bands_2026-27")
    rows = [r for r in sheet if r and isinstance(r[0], str) and r[0].strip() == name]
    check(len(rows) == 1, f"council tax by band: {len(rows)} rows for {name!r}")
    bands = dict(zip(BANDS, (float(v) for v in rows[0][1:9])))
    for band, ratio in ratios("band_ratios").items():
        check(abs(bands[band] - bands["D"] * ratio) < 0.005, f"council tax by band {name}: Band {band} {bands[band]} is not Band D × {ratio:.4f}")
    return bands


def band_d_series(reg: Dict[str, Any], name: str) -> Dict[str, float]:
    """Band D for every year from the Scottish Government's series (its "2024-251" carries a footnote mark)."""
    sheet = first_sheet(reg, "scot_band_d_1996-2027")
    header = next(r for r in sheet if r and len(r) > 2 and r[1] == "1996-97")
    rows = [r for r in sheet if r and isinstance(r[0], str) and r[0].strip() == name]
    check(len(rows) == 1, f"Band D series: {len(rows)} rows for {name!r}")
    return {h[:7]: float(rows[0][j]) for j, h in enumerate(header) if isinstance(h, str) and re.match(r"\d{4}-\d{2}", h) and rows[0][j] is not None}


def water() -> Dict[str, Dict[str, Dict[str, Any]]]:
    """Scottish Water's charges by band, from its leaflets (data/manual/scottish_water.csv). Water plus sewerage must be the
    leaflet's own combined row, and every band Band D times Scottish Water's ratio, to the penny."""
    out: Dict[str, Dict[str, Dict[str, Any]]] = {}
    for r in read_csv("scottish_water.csv"):
        w, s, c = float(r["water"]), float(r["sewerage"]), float(r["combined"])
        check(close(w + s, c, 0.005), f"scottish_water.csv {r['year']} {r['band']}: water and sewerage add up to {w + s:.2f}, the leaflet says {c}")
        check(r["reviewed"] in ("no", "checked", "yes"), f"scottish_water.csv {r['year']} {r['band']}: reviewed must be no, checked or yes")
        out.setdefault(r["year"], {})[r["band"]] = {"water": w, "sewerage": s, "combined": c, "source_id": r["source_id"], "page": r["page"], "reviewed": r["reviewed"]}
    for year, bands in out.items():
        check(sorted(bands) == list(BANDS), f"scottish_water.csv {year}: needs every band")
        for band, ratio in ratios("others_band_ratios").items():
            for k in ("water", "sewerage"):
                check(abs(bands[band][k] - round(bands["D"][k] * ratio, 2)) < 0.006, f"scottish_water.csv {year} Band {band} {k}: not Band D × {ratio:.4f}")
    return out


def pobe(reg: Dict[str, Any], name: str) -> Callable[[int, str, str], float]:
    """A council's sheet of the POBE revenue workbook, £000: value(row, year, label) checks the row's label first, so a
    row moved by a new edition stops the build instead of being misread."""
    sheet = read_xlsx(str(RAW / reg["pobe_2026"]["file"]))[name]
    header = next(r for r in sheet if r and any(isinstance(c, str) and c.startswith("2026-27") for c in r))
    cols = {c[:7]: j for j, c in enumerate(header) if isinstance(c, str) and re.match(r"\d{4}-\d{2}", c)}

    def value(row: int, year: str, label: str) -> float:
        r = sheet[row - 1]
        text = next((c for c in r[:4] if isinstance(c, str) and c.strip()), "")
        check(text.strip().lower().startswith(label.lower()), f"POBE {name} row {row}: {text!r} is not {label!r}")
        v = r[cols[year]] if cols[year] < len(r) else None
        return float(v) if isinstance(v, (int, float)) else 0.0

    return value


LABELS = {13: "Education", 14: "Culture and Related", 15: "Social Work", 16: "Roads & Transport", 17: "Road Bridges", 18: "Environmental Services", 22: "Trading Services",
          19: "Building, Planning", 20: "Central Services", 21: "Non-HRA Housing", 23: "Total Net Revenue", 33: "Total Other Income",
          38: "Total General Revenue Grant", 41: "Total NDRI", 42: "Council Tax", 43: "Discretionary Housing", 44: "NDRI - TIF",
          45: "NDRI - BRIS", 46: "Visitor Levy", 47: "Government Grant", 48: "Glasgow City Region", 49: "Capital Grants", 50: "Other",
          51: "Total Taxation", 57: "Surplus (-) or Deficit", 60: "General Fund", 62: "Use of Capital Resources", 63: "Transfers to (+) Capital",
          65: "Transfers to (+) / from (-) Housing Revenue", 66: "Transfers to (+) / from (-) Other", 67: "General Fund", 176: "Cemetery", 178: "Flood Defence", 179: "Environmental Health",
          180: "Trading Standards", 185: "Total Waste", 186: "Total Environmental", 177: "Coast Protection"}


def build_one(reg: Dict[str, Any], b: Dict[str, Any]) -> Dict[str, Any]:
    name = b["scot_name"]
    v = pobe(reg, name)
    k = lambda row, year=YEAR: v(row, year, LABELS[row])  # noqa: E731  £000
    m = lambda x: round(x / 1000, 3)  # noqa: E731

    # ---------------------------------------------------------------- the bill
    bands, series, sw = ct_bands(reg, name), band_d_series(reg, name), water()
    check(close(bands["D"], series[YEAR], 0.005), f"{name}: Band D {bands['D']} in the band table, {series[YEAR]} in the series")
    council, council_prev = round(bands["D"], 2), round(series[PREV], 2)
    wd, wp = sw[YEAR]["D"], sw[PREV]["D"]
    others, others_prev = round(wd["combined"], 2), round(wp["combined"], 2)
    q_water = "sourced" if all(x["reviewed"] == "yes" for y in (YEAR, PREV) for x in sw[y].values()) else "approx"
    parts = [("water", "Water", "water", "Water supply charge"), ("sewerage", "Sewerage", "sewerage", "Waste water collection charge")]
    bill = {
        "band_d_total": round(council + others, 2), "band_d_council": council, "band_d_gla": others,
        "band_d_total_prev": round(council_prev + others_prev, 2), "band_d_council_prev": council_prev,
        "council_rise_pct": round((council / council_prev - 1) * 100, 2),
        "published_bands": {band: round(round(bands[band], 2) + sw[YEAR][band]["combined"], 2) for band in BANDS},
        "gla_note": "Scottish Water: water and sewerage",
        "gla_split": [
            {"id": pid, "label": label, "phrase": phrase, "official_term": term, "band_d": wd[pid], "band_d_prev": wp[pid],
             "quality": q_water, "source_id": wd["source_id"],
             "method_note": f"Scottish Water, unmetered household charges {YEAR.replace('-', '/')}, page {wd['page']}, Band D; {PREV.replace('-', '/')} from that year's leaflet. "
                            "Other bands are Band D times Scottish Water's own ratios (Band H is twice Band D)."}
            for pid, label, phrase, term in parts
        ],
        "others": b["others"],
        "quality": "sourced", "source_id": "scot_ct_bands_2026-27",
        "method_note": "Council tax by band from the Scottish Government's table (each band is Band D times Scotland's ratio); water and sewerage from Scottish Water's leaflet.",
    }

    # ---------------------------------------------------------------- spending by service, after each service's own grants
    env = sum(k(r) for r in (176, 177, 178, 179, 180, 185))
    check(close(env, k(18), 0.5) and close(k(186), k(18), 0.5), f"{name}: environmental services' parts {env} ≠ total {k(18)}")
    services: List[Dict[str, Any]] = []
    for g in sorted(read_csv("scot_service_groups.csv"), key=lambda g: int(g["order"])):
        rows = [int(x) for x in g["pobe_rows"].split(";")]
        total = sum(k(r) for r in rows)
        services.append({
            "id": g["id"], "label": g["label"], "official_term": g["official_term"], "desc": g["desc"], "m": m(total), "general_fund_m": m(total),
            "quality": "sourced", "source_id": "pobe_2026",
            "method_note": f"POBE 2026 revenue workbook, sheet {name!r}, 2026-27 budget estimate, row{'s' if len(rows) > 1 else ''} {', '.join(map(str, rows))} (£000, after the service's own grants).",
        })
    spending = k(23) + k(33)
    check(close(sum(s["m"] for s in services) * 1000, spending, 5), f"{name}: services add up to {sum(s['m'] for s in services)}m, the workbook to {spending / 1000}m")

    # ---------------------------------------------------------------- funding, and the gap met from reserves and capital money
    taxes = sum(k(r) for r in (38, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50))
    check(close(taxes, k(51), 0.5), f"{name}: taxation and grant lines {taxes} ≠ total {k(51)}")
    check(close(k(23) + k(33) + k(51), k(57), 0.5), f"{name}: spending less funding ≠ the deficit in row 57")
    gf_draw = k(67) - k(60)  # balances are credits (negative): a smaller balance at the end is money drawn
    check(close(-k(62) - k(63) - k(65) - k(66) + gf_draw, k(57), 0.5), f"{name}: reserves, capital fund, capital money and council housing transfers do not cover the deficit")
    funding: List[Dict[str, Any]] = []
    for g in sorted(read_csv("scot_funding_groups.csv"), key=lambda g: int(g["order"])):
        parts_k = [(gf_draw if r == "gf" else -k(int(r))) for r in g["pobe_rows"].split(";")]
        total = sum(parts_k)
        if abs(total) < 0.5:
            continue  # a kind of income the council does not have this year
        line: Dict[str, Any] = {
            "id": g["id"], "label": g["label"], "official_term": g["official_term"], "desc": g["desc"], "kind": g["kind"], "m": m(total),
            "quality": "sourced", "source_id": "pobe_2026",
            "method_note": f"POBE 2026 revenue workbook, sheet {name!r}, 2026-27 budget estimate, rows {g['pobe_rows'].replace('gf', '60 and 67 (General Fund balance at the start less at the end)').replace(';', ', ')}.",
        }
        if g["one_off"] == "true":
            line["gap"] = True
        if g["id"] == "council_reserves":
            line["detail"] = [d for d in ({"label": "General Fund balance", "m": m(gf_draw)}, {"label": "Other reserves", "m": m(-k(66))},
                                          {"label": "Transfer to council housing", "m": m(-k(65))}) if abs(d["m"]) >= 0.0005]
        funding.append(line)
    check(close(sum(f["m"] for f in funding), sum(s["m"] for s in services), 0.005), f"{name}: funding ≠ spending")

    # ---------------------------------------------------------------- council tax over the years
    years = [y for y in sorted(series) if y >= "2022-23"]
    history = []
    for y in years:
        w = sw.get(y, {}).get("D")
        history.append({
            "year": y, "band_d_council": round(series[y], 2),
            "band_d_area": round(series[y] + w["combined"], 2) if w else None, "band_d_gla": round(w["combined"], 2) if w else None,
            "council_tax_requirement_m": m(-k(42, y)), "tax_base": None, "collection_rate": None,
            "source_ids": sorted({"scot_band_d_1996-2027", "pobe_2026"} | ({w["source_id"]} if w else set())),
        })

    out: Dict[str, Any] = {
        "meta": {
            "council": b["council"], "council_short": b["short"], "council_code": b["ons"], "slug": b["slug"], "year": YEAR,
            "note": "Built by etl/scotland.py from the Scottish Government's returns and Scottish Water's charges, with the same checks as the English boroughs' where Scotland's returns allow.",
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
            print(f"scotland {b['slug']}: {e}")
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
        print(f"scotland {b['slug']}: Band D £{bill['band_d_total']:,.2f} (council £{bill['band_d_council']:,.2f}, water and sewerage £{bill['band_d_gla']:,.2f}), "
              f"{len(out['services'])} services, budget £{sum(s['m'] for s in out['services']):,.1f}m")
    if stale:
        print(f"scotland: out of date: {', '.join(stale)}. Run python3 etl/scotland.py and commit.")
        return 1
    if check_only:
        print("scotland: every statement is up to date; every check passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main("--check" in sys.argv))
