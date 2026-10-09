"""Boroughs beyond Hammersmith & Fulham: the checked statement the government returns give for each one.

    python3 etl/boroughs.py           build data/build/boroughs/<slug>/statement.json for every borough in data/config/boroughs.json
    python3 etl/boroughs.py --check   fail if any is out of date (CI, after etl/fetch.py)

The same code and checks as Hammersmith & Fulham's (etl/build.py, statement()): council tax for five years, spending by
service against the borough's own section totals, funding against spending, outturn, and the Mayor of London's share,
whose split by body (data/manual/gla_2026-27.csv) must match the borough's own GLA element. What needs the borough's
own budget report (this year's gap, savings, next year) is not built until that report is extracted by hand.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Dict, List

sys.path.insert(0, str(Path(__file__).resolve().parent))

from build import PREV, YEAR, cited_sources, manual_gla, serialise, source_entry, statement  # noqa: E402
from extract import CheckFailed, check, close  # noqa: E402
from fetch import ROOT, load_sources  # noqa: E402
from ods import read_ods  # noqa: E402

CONFIG = ROOT / "data" / "config" / "boroughs.json"
OUT = ROOT / "data" / "build" / "boroughs"


def boroughs() -> List[Dict[str, Any]]:
    """England's boroughs and cities; Scotland's councils are built by etl/scotland.py from Scotland's own returns."""
    return [b for b in json.loads(CONFIG.read_text())["boroughs"] if b.get("nation", "england") == "england"]


def preceptor_band_d(reg: Dict[str, Any], source_id: str, table: str, authority: str) -> float:
    """Band D of one police, fire or combined authority from the government's Tables 8d to 8f."""
    rows = read_ods(str(ROOT / "data" / "raw" / reg[source_id]["file"]))[table]
    found = [r for r in rows if len(r) > 4 and r[2] == authority]
    check(len(found) == 1, f"{reg[source_id]['file']} {table}: {len(found)} rows for {authority!r}")
    return float(found[0][4])


def precepts(reg: Dict[str, Any], b: Dict[str, Any], gla: float, gla_prev: float) -> List[Dict[str, Any]]:
    """Outside London, the rest of the bill split by body (police, fire, a combined authority), from the government's own
    tables, this year and last; the parts must add up to what the area Band D leaves after the council's share."""
    out = []
    for year, sid, want in ((YEAR, "ct_bands_2026-27", gla), (PREV, "ct_bands_2025-26", gla_prev)):
        values: Dict[str, float] = {}
        for part in b["precepts"]:
            v = preceptor_band_d(reg, sid, part["table"], part["authority"]) - sum(values[m] for m in part.get("minus", []))
            values[part["id"]] = round(v, 2)
        check(close(sum(values.values()), want, 0.015), f"{b['slug']} {year}: precepts add up to {sum(values.values()):.2f}, the area Band D leaves {want}")
        out.append(values)
    return [
        {
            "id": part["id"], "label": part["label"], "phrase": part["phrase"], "official_term": part["official_term"],
            "band_d": out[0][part["id"]], "band_d_prev": out[1][part["id"]], "quality": "sourced", "source_id": "ct_bands_2026-27",
            "method_note": f"Council tax levels 2026 to 2027, {part['table'].replace('_', ' ')}: {part['authority']}"
                           + (" less its police functions" if part.get("minus") else "") + "; 2025 to 2026 from the year before's tables.",
        }
        for part in b["precepts"]
    ]


def parish(reg: Dict[str, Any], ons: str) -> Dict[str, Any] | None:
    """Parish and town council precepts, which only homes in a parish pay: Band D on average across the parishes."""
    import re
    rows = read_ods(str(ROOT / "data" / "raw" / reg["ctr_2026-27"]["file"]))[reg["ctr_2026-27"]["extract"]["sheet"]]
    hi = next(i for i, r in enumerate(rows) if r and r[0] == "E-code")
    header = [re.sub(r"\s+", " ", str(h or "")).strip() for h in rows[hi]]
    row = next(r for r in rows[hi + 1 :] if len(r) > 1 and r[1] == ons)
    col = lambda prefix: float(row[next(j for j, h in enumerate(header) if h.startswith(prefix))] or 0)  # noqa: E731
    total, count, base = col("2. Parish precepts (current year)"), col("20. Number of Precepting parishes"), col("20. Tax base of Precepting parishes")
    if not total:
        return None
    return {"count": int(count), "band_d": round(total / base, 2), "quality": "sourced", "source_id": "ctr_2026-27",
            "method_note": "Table 10: parish precepts divided by the tax base of the parishes that set one."}


def build_one(reg: Dict[str, Any], b: Dict[str, Any]) -> Dict[str, Any]:
    st = statement(reg, b["ons"], bool(b.get("returns_differ")))
    now, prev, ctr, bands = st["now"], st["prev"], st["ctr"], st["bands"]
    band_d_gla, band_d_total = st["band_d_gla"], st["band_d_total"]
    out: Dict[str, Any] = {
        "meta": {
            "council": b["council"], "council_short": b["short"], "council_code": b["ons"], "slug": b["slug"], "year": YEAR,
            "note": "Built by etl/boroughs.py from government returns, with the same checks as Hammersmith & Fulham's.",
            "vintage": "",  # set below from the sources this borough cites, so another council's new report does not move it
            "sources": [],
        },
        "bill": {
            "band_d_total": band_d_total, "band_d_council": now["band_d_council"], "band_d_gla": band_d_gla,
            "band_d_total_prev": bands[PREV]["D"], "band_d_council_prev": prev["band_d_council"],
            "council_rise_pct": round((now["band_d_council"] / prev["band_d_council"] - 1) * 100, 2),
            "published_bands": bands[YEAR],
            "gla_note": "Mayor of London: police, fire brigade, transport and other GLA services" if b["ons"].startswith("E09") else b["others"]["name"],
            "gla_split": (manual_gla(reg, band_d_gla, round(bands[PREV]["D"] - prev["band_d_council_incl"], 2)) if b["ons"].startswith("E09")
                          else precepts(reg, b, band_d_gla, round(bands[PREV]["D"] - prev["band_d_council_incl"], 2))),
            **({} if b["ons"].startswith("E09") else {"others": b["others"]}),
            **({"parish": {**pa, **({"names": b["parish_names"]} if b.get("parish_names") else {})}} if (pa := parish(reg, b["ons"])) else {}),
            "quality": "sourced", "source_id": "ctr_2026-27",
            "method_note": "Council element from Table 10; area Band D and all bands from Table 9; GLA element is the difference.",
        },
        "tax_base": {
            "band_d_equivalents": now["tax_base"], "collection_rate": now["collection_rate"], "setting_base": now["setting_base"],
            "quality": "sourced", "source_id": "ctr_2026-27",
        },
        "history": {
            "council_tax": [
                {
                    "year": y, "band_d_council": round(ctr[y]["band_d_council"], 2), "band_d_area": bands[y]["D"],
                    "band_d_gla": round(bands[y]["D"] - round(ctr[y]["band_d_council_incl"], 2), 2),
                    "council_tax_requirement_m": round(ctr[y]["ctr"] / 1e6, 3), "tax_base": ctr[y]["tax_base"],
                    "collection_rate": ctr[y]["collection_rate"], "source_ids": sorted({st["ctr_src"][y], st["bands_src"][y]}),
                }
                for y in st["years"]
            ],
            "budget": st["budget_history"],
            "outturn": st["outturn_history"],
            "quality": "sourced",
        },
        "funding": st["funding_lines"],
        "services": st["services"],
        **({"returns_differ": {
            **st["differ"], "quality": "sourced", "source_id": "ra_2026-27",
            "method_note": "Council tax requirement in the budget return (RA 2026-27 line 990, £000) and in the council tax return (Table 10).",
        }} if st["differ"] else {}),
    }
    cited = set(cited_sources(out))
    out["meta"]["sources"] = [source_entry(reg[k]) for k in reg if k in cited]
    out["meta"]["vintage"] = max(reg[k]["published_on"] for k in cited if "published_on" in reg[k])
    return out


def main(check_only: bool) -> int:
    reg = {s["id"]: s for s in load_sources()}
    stale = []
    for b in boroughs():
        try:
            out = build_one(reg, b)
        except CheckFailed as e:
            print(f"boroughs {b['slug']}: {e}")
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
        print(f"boroughs {b['slug']}: Band D £{bill['band_d_total']:,.2f} (council £{bill['band_d_council']:,.2f}), "
              f"{len(out['services'])} services, budget £{sum(s['m'] for s in out['services']):,.1f}m")
    if stale:
        print(f"boroughs: out of date: {', '.join(stale)}. Run python3 etl/boroughs.py and commit.")
        return 1
    if check_only:
        print("boroughs: every statement is up to date; every check passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main("--check" in sys.argv))
