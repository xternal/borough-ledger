"""The council tax decoder: every English billing authority's Band D bill, split between the council itself, parish or
town councils (on average), the county council or the Greater London Authority, police, fire and the combined authority,
for this year and last, from the government's council tax requirement tables (Table 10, Data_Billing and
Precepting_Bodies), into data/build/council_tax_decoder.json.

    python3 etl/decoder.py           build
    python3 etl/decoder.py --check   fail if out of date

Checks: all 296 billing authorities, each year; the parts add up to the government's own total for the area (line 17:
line 8 plus the four major preceptors), to the penny; last year's figures in this year's table agree with last year's
table; a preceptor is named wherever it takes a share; every page address is unique.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parent))

from build import serialise, source_entry  # noqa: E402
from extract import CheckFailed, check, close, read_ods  # noqa: E402
from fetch import ROOT, load_sources  # noqa: E402

OUT = ROOT / "data" / "build" / "council_tax_decoder.json"
# What the postcode box needs in the browser, and no more: each billing authority's code, page and name.
INDEX = ROOT / "data" / "build" / "council_tax_decoder_index.json"
NOW, PREV = "ctr_2026-27", "ctr_2025-26"
YEAR, PREV_YEAR = "2026-27", "2025-26"
BILLING_AUTHORITIES = 296
PARTS = ("council", "parish", "county", "police", "fire", "combined")
REGION = {"E": "East of England", "EM": "East Midlands", "L": "London", "NE": "North East", "NW": "North West", "SE": "South East",
          "SW": "South West", "WM": "West Midlands", "YH": "Yorkshire and the Humber"}
KIND = {"ILB": "London borough", "OLB": "London borough", "MD": "metropolitan borough", "UA": "unitary council", "SD": "district council"}


def slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower().replace("&", " and ")).strip("-")


# The body that sets the council's own share, where "<name> Council" would be wrong.
COUNCIL_NAME = {"City of London": "the City of London Corporation", "Isles of Scilly": "the Council of the Isles of Scilly", "Durham": "Durham County Council"}
# The place, mid-sentence, where it takes "the" ("a Band D home in the City of London").
PLACE = {"City of London": "the City of London", "Isles of Scilly": "the Isles of Scilly"}


def preceptor(kind: str, raw: Any) -> Optional[str]:
    """The official short name, in plain words: "Thames Valley PCC" is the Thames Valley Police and Crime Commissioner."""
    n = str(raw or "").strip()
    if n in ("", "-", "None"):
        return None
    n = n.replace(" & ", " and ").replace("IOW", "Isle of Wight")
    if kind == "county":
        return "Mayor of London (Greater London Authority)" if n == "Greater London Authority" else f"{n} County Council"
    if n.endswith(" - PCC functions"):
        return f"{n[: -len(' - PCC functions')]} (police)"
    if n.endswith(" - General functions"):
        return f"{n[: -len(' - General functions')]} (the mayor)"
    m = re.fullmatch(r"(.+?) (?:PFCC - |PCC-)(Police|Fire|FRA)", n)
    if m:
        return f"{m.group(1)} Police, Fire and Crime Commissioner ({'police' if m.group(2) == 'Police' else 'fire'})"
    if kind == "police" and n.endswith(" PCC"):
        return f"{n[:-4]} Police and Crime Commissioner"
    if kind == "police" and n == "Essex Police":
        return "Essex Police, Fire and Crime Commissioner (police)"
    if kind == "fire" and n.endswith(" Fire"):
        return f"{n} Authority"
    return n


def table(reg: Dict[str, Any], sid: str) -> Dict[str, Any]:
    book = read_ods(str(ROOT / "data" / "raw" / reg[sid]["file"]))
    rows = book["Data_Billing"]
    hi = next(i for i, r in enumerate(rows) if r and str(r[0]).strip() == "E-code")
    head = [re.sub(r"\s+", " ", str(h or "")).strip() for h in rows[hi]]

    def col(prefix: str, suffix: str) -> int:
        hits = [j for j, h in enumerate(head) if h.startswith(prefix) and h.endswith(suffix)]
        check(len(hits) == 1, f"decoder {sid}: column {prefix!r} {suffix!r} found {len(hits)} times")
        return hits[0]

    c = {
        "with_local": col("8. Average", "(current year)"),
        "without_local": col("9. Average", "(current year)"),
        "prev_with_local": col("8. Average", "(previous year)"),
        "prev_without_local": col("9. Average", "(previous year)"),
        "county": col("16. Average council tax of major precepting", "(county or GLA)"),
        "police": col("16. Average council tax of major precepting", "(police)"),
        "fire": col("16. Average council tax of major precepting", "(fire)"),
        "combined": col("16. Average council tax of major precepting", "(combined authority)"),
        "total": col("17. Average", "16(d))"),
    }
    out = {}
    for r in rows[hi + 1:]:
        if len(r) < 5 or not isinstance(r[1], str) or not re.fullmatch(r"E0[6789]\d{6}", r[1]):
            continue
        v = {k: float(r[j]) for k, j in c.items()}
        parts = {"council": v["without_local"], "parish": round(v["with_local"] - v["without_local"], 2),
                 **{k: v[k] for k in ("county", "police", "fire", "combined")}}
        total = v["total"]
        check(close(sum(parts.values()), total, 0.011), f"decoder {sid} {r[2]}: the parts add up to £{sum(parts.values()):.2f}, the area Band D is £{total:.2f}")
        out[r[1]] = {"name": str(r[2]).strip(), "region": str(r[3]).strip(), "class": str(r[4]).strip(), "parts": {k: round(x, 2) for k, x in parts.items()},
                     "total": round(total, 2), "prev_with_local": v["prev_with_local"], "prev_without_local": v["prev_without_local"]}
    pb = book["Precepting_Bodies"]
    names = {r[2]: {"county": r[4], "police": r[5], "fire": r[6], "combined": r[7]} for r in pb if len(r) > 7 and isinstance(r[2], str) and r[2].startswith("E0")}
    return {"rows": out, "names": names}


def build(reg: Dict[str, Any]) -> Dict[str, Any]:
    now, prev = table(reg, NOW), table(reg, PREV)
    check(len(now["rows"]) == BILLING_AUTHORITIES, f"decoder: {len(now['rows'])} billing authorities in {YEAR}, expected {BILLING_AUTHORITIES}")
    councils: List[Dict[str, Any]] = []
    for ons, r in sorted(now["rows"].items(), key=lambda x: x[1]["name"]):
        p = prev["rows"].get(ons)
        check(p is not None, f"decoder: {r['name']} ({ons}) is not in {PREV_YEAR}'s table")
        # This year's table repeats last year's council figures; they must agree with last year's own table.
        check(close(r["prev_without_local"], p["parts"]["council"], 0.011) and close(r["prev_with_local"], p["parts"]["council"] + p["parts"]["parish"], 0.011),
              f"decoder {r['name']}: last year's Band D differs between the two years' tables")
        names = {k: preceptor(k, now["names"].get(ons, {}).get(k)) for k in ("county", "police", "fire", "combined")}
        for k, n in names.items():
            # Anything that takes a share is named; a body may cover the area and take nothing (East Midlands' combined county authority).
            check(n is not None or r["parts"][k] == 0, f"decoder {r['name']}: {k} takes £{r['parts'][k]:.2f} but no preceptor is named")
        check(r["region"] in REGION and r["class"] in KIND, f"decoder {r['name']}: unknown region {r['region']!r} or class {r['class']!r}")
        councils.append({
            "ons": ons, "name": r["name"], "council_name": COUNCIL_NAME.get(r["name"], f"{r['name']} Council"), "place": PLACE.get(r["name"], r["name"]), "slug": slug(r["name"]), "region": REGION[r["region"]], "kind": KIND[r["class"]],
            "parts": r["parts"], "total": r["total"], "prev_parts": p["parts"], "prev_total": p["total"], "preceptors": names,
        })
    slugs = [c["slug"] for c in councils]
    check(len(set(slugs)) == len(slugs), f"decoder: page addresses repeat: {sorted({s for s in slugs if slugs.count(s) > 1})}")
    return {
        "note": "Generated by etl/decoder.py from the government's council tax requirement tables (Table 10). Do not edit by hand; re-run it.",
        "year": YEAR,
        "prev_year": PREV_YEAR,
        "sources": [source_entry(reg[NOW]), source_entry(reg[PREV])],
        "quality": "sourced",
        "source_id": NOW,
        "method_note": "Average Band D for two adults: the council's own share without parish or town councils (line 9), parish and town councils on average across the area (line 8 less line 9), and each major preceptor (line 16), adding up to the area's Band D (line 17).",
        "councils": councils,
    }


def main(check_only: bool) -> int:
    reg = {s["id"]: s for s in load_sources()}
    try:
        data = serialise(build(reg))
    except CheckFailed as e:
        print(f"decoder: {e}")
        return 1
    index = serialise({"note": "Generated by etl/decoder.py: each English billing authority's ONS code, decoder page and name, for the postcode box.",
                       "councils": {c["ons"]: [c["slug"], c["name"]] for c in json.loads(data)["councils"]}})
    if check_only:
        if not OUT.exists() or OUT.read_bytes() != data or not INDEX.exists() or INDEX.read_bytes() != index:
            print("decoder: data/build/council_tax_decoder.json or its index is out of date. Run python3 etl/decoder.py and commit.")
            return 1
        print("decoder: up to date; every check passed.")
        return 0
    OUT.write_bytes(data)
    INDEX.write_bytes(index)
    out = json.loads(data)
    hf = next(c for c in out["councils"] if c["ons"] == "E09000013")
    print(f"decoder: {len(out['councils'])} billing authorities; {hf['name']}: Band D £{hf['total']:,.2f} ({out['prev_year']} £{hf['prev_total']:,.2f})")
    return 0


if __name__ == "__main__":
    sys.exit(main("--check" in sys.argv))
