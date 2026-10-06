"""Build data/build/hf_2026-27.json and data/build/manifest.json from the government returns.

    python3 etl/build.py           verify sources, run every check, write data/build/
    python3 etl/build.py --check   verify and rebuild in memory; fail if data/build/ is out of date

What the government returns cannot give yet (this year's pressures and savings, next year's gap,
the safe minimum for reserves, pledge costs) is carried over from data/seed with its test or approx
mark. Those items need the council's budget report, which is extracted by hand into data/manual/.
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path
from typing import Any, Dict, List

sys.path.insert(0, str(Path(__file__).resolve().parent))

from extract import (  # noqa: E402
    CheckFailed,
    area_bands,
    check,
    close,
    ctr_data,
    funding,
    ra_services,
    read_csv,
)
from fetch import ROOT, load_sources, sha256  # noqa: E402
from govreturns import read_la_row  # noqa: E402

BUILD = ROOT / "data" / "build"
SEED = ROOT / "data" / "seed" / "hf_2026-27.json"
YEAR = "2026-27"
PREV = "2025-26"
METHOD = {
    "id": "borough_ledger_method",
    "title": "Borough Ledger method notes (docs/MODEL.md)",
    "publisher": "Borough Ledger",
    "url": "https://github.com/xternal/borough-ledger/blob/main/docs/MODEL.md",
    "note": "TODO(decide): the repository is private; publish the method page before launch.",
}
# Seed sources still cited by values carried over until the budget report is extracted.
KEEP_SEED_SOURCES = {"budget_paper", "budget_report", "election", "prototype_test"}


def m(v_thousands: float) -> float:
    """£000 → £m, rounded to the £1,000 the returns are published in."""
    return round(v_thousands / 1000.0, 3)


def source_entry(s: Dict[str, Any]) -> Dict[str, Any]:
    keys = ["id", "title", "publisher", "url", "published_on", "licence", "asset_url", "sha256"]
    return {k: s[k] for k in keys if k in s}


def build() -> Dict[str, Any]:
    reg = {s["id"]: s for s in load_sources()}
    for s in reg.values():
        check((ROOT / "data" / "raw" / s["file"]).exists(), f"missing data/raw/{s['file']}: run python3 etl/fetch.py")
        check(sha256(ROOT / "data" / "raw" / s["file"]) == s["sha256"], f"{s['file']} does not match its SHA-256 in sources.json")
    seed = json.loads(SEED.read_text())
    ons = seed["meta"]["council_code"]

    # ---------------------------------------------------------- council tax, five years
    ctr: Dict[str, Dict[str, float]] = {}
    ctr_src: Dict[str, str] = {}
    bands: Dict[str, Dict[str, float]] = {}
    bands_src: Dict[str, str] = {}
    for s in reg.values():
        ex = s.get("extract", {})
        if ex.get("kind") == "ctr_data":
            for y, d in ctr_data(s["file"], ex["sheet"], ex["years"], ons).items():
                if y in ctr:
                    # The same year appears in two releases; they must agree (or the later one is a revision).
                    for k in ("band_d_council", "setting_base"):
                        check(close(ctr[y][k], d[k], 0.01), f"council tax {y} {k}: {ctr_src[y]} says {ctr[y][k]}, {s['id']} says {d[k]}")
                if y not in ctr or ex["years"][1] == y:  # prefer the release where y is the current year
                    ctr[y], ctr_src[y] = d, s["id"]
        elif ex.get("kind") == "area_bands":
            bands[ex["year"]] = area_bands(s["file"], ex["sheet"], ons, ex.get("first_band_col", -1))
            bands_src[ex["year"]] = s["id"]
    years = sorted(set(ctr) & set(bands))
    check(YEAR in years and PREV in years, f"council tax data missing for {YEAR} or {PREV}")
    now, prev = ctr[YEAR], ctr[PREV]
    band_d_total = bands[YEAR]["D"]
    band_d_gla = round(band_d_total - now["band_d_council"], 2)

    # ---------------------------------------------------------- budget 2026/27 (RA and SG)
    ra = read_la_row(str(ROOT / "data/raw" / reg["ra_2026-27"]["file"]), "RA_LA_Data_2026-27", ons)
    ra2 = read_la_row(str(ROOT / "data/raw" / reg["ra_2026-27_part2"]["file"]), "RA_LA_Data_2026-27", ons)
    sg = read_la_row(str(ROOT / "data/raw" / reg["sg_2026-27"]["file"]), "SG_LA_Data_2026-27", ons)
    svc, svc_detail = ra_services(ra)
    fund, fund_detail = funding(ra, sg)
    check(close(ra.by_line("990") * 1000, now["ctr"], 1000), f"RA council tax requirement {ra.by_line('990')}k ≠ CTR return {now['ctr']}")

    groups = {g["id"]: g for g in read_csv("service_groups.csv")}
    fgroups = {g["id"]: g for g in read_csv("funding_groups.csv")}
    check(set(svc) <= set(groups), f"unknown service groups {set(svc) - set(groups)}")
    check(set(fund) <= set(fgroups), f"unknown funding groups {set(fund) - set(fgroups)}")
    hb = svc.pop("housing_benefit", 0.0)
    check(abs(hb) < 0.5, f"housing benefit should net to zero against its subsidy; it leaves {hb}k")

    ring: Dict[str, float] = {}
    for fid, v in fund.items():
        to = fgroups[fid]["ring_fenced_to"]
        if to:
            ring[to] = ring.get(to, 0.0) + v

    ra_src = "ra_2026-27"
    services = []
    for gid, v in sorted(svc.items(), key=lambda kv: int(groups[kv[0]]["order"])):
        g = groups[gid]
        lines = ", ".join(sorted({ln for ln, _, val in svc_detail[gid] if val}, key=float))
        services.append({
            "id": gid, "label": g["label"], "official_term": g["official_term"], "desc": g["desc"],
            "m": m(v), "general_fund_m": m(v - ring.get(gid, 0.0)),
            "quality": "sourced", "source_id": ra_src,
            "method_note": f"Net current expenditure, RA 2026-27 lines {lines}, grouped by Borough Ledger (data/manual/ra_service_map.csv).",
        })
    funding_lines = []
    for fid, v in sorted(fund.items(), key=lambda kv: int(fgroups[kv[0]]["order"])):
        if abs(v) < 0.5:
            continue
        g = fgroups[fid]
        src = "ctr_2026-27" if fid == "council_tax" else ("sg_2026-27" if any(k in fid for k in ("grant",)) else ra_src)
        line: Dict[str, Any] = {
            "id": fid, "label": g["label"], "official_term": g["official_term"], "desc": g["desc"], "kind": g["kind"], "m": m(v),
            "quality": "sourced", "source_id": src,
        }
        if g["ring_fenced_to"]:
            line["ring_fenced_to"] = g["ring_fenced_to"]
        if g["one_off"] == "true":
            line["gap"] = True
        if len(fund_detail.get(fid, [])) > 1:
            line["detail"] = [{"label": lbl, "m": m(val)} for lbl, val in sorted(fund_detail[fid], key=lambda x: -x[1])]
        funding_lines.append(line)

    # Identities, to the £1,000 of the published data.
    total_f = sum(f["m"] for f in funding_lines)
    total_s = sum(s["m"] for s in services)
    check(close(total_f, total_s, 0.0015 * len(services)), f"funding £{total_f}m ≠ spending £{total_s}m")
    general = sum(f["m"] for f in funding_lines if "ring_fenced_to" not in f)
    check(close(general, sum(s["general_fund_m"] for s in services), 0.0015 * len(services)), "general funding ≠ general-fund spending")

    # ---------------------------------------------------------- carry over from the seed what still needs the budget report
    ny = seed["next_year"]
    rsg_br = fund.get("rsg", 0.0) + fund.get("business_rates", 0.0)
    levers = []
    for lv in ny["levers"]:
        lv = {k: v for k, v in lv.items() if k not in ("limit", "limit_note")}  # the threshold lives in data/config/rules.json
        if lv["id"] == "ct_rise":
            lv.update(m_per_unit=round(now["ctr"] / 1e6 / 100, 4), quality="approx", source_id="ctr_2026-27",
                      method_note="1% of the 2026/27 council tax requirement. Assumes the tax base stays at its 2026/27 level.")
            lv.pop("todo", None)
        elif lv["id"] == "settlement":
            lv.update(m_per_unit=round(rsg_br / 1000 / 100, 4), quality="approx", source_id=ra_src,
                      method_note="1% of 2026/27 Revenue Support Grant plus retained business rates.")
            lv.pop("todo", None)
        elif lv["id"] in ("savings", "reserves"):
            lv.update(quality="modelled", source_id=METHOD["id"], method_note="£1m chosen closes £1m of the gap, by definition.")
            lv.pop("todo", None)
        levers.append(lv)
    unalloc_end = ra2.by_asset("resunall_end")
    mny = manual_next_year()
    gap_src: Dict[str, Any] = (
        {"gap_m": float(mny["gap_m"]["value"]), "quality": "sourced", "source_id": "budget_report", "method_note": f"Budget report page {mny['gap_m']['page']}"}
        if "gap_m" in mny else {"gap_m": ny["gap_m"], "quality": ny["quality"], "source_id": ny["source_id"], "todo": ny["todo"]}
    )
    minimum = (
        {"m": float(mny["minimum_safe_m"]["value"]), "quality": "sourced", "source_id": "budget_report",
         "method_note": f"Budget report page {mny['minimum_safe_m']['page']}"}
        if "minimum_safe_m" in mny else
        {"m": ny["reserves"]["minimum_safe_m"], "quality": "test", "source_id": "prototype_test",
         "todo": "TODO(source): the safe minimum set by the finance director in the budget report"}
    )
    next_year = {
        "year": ny["year"], **gap_src,
        "reserves": {
            "general": {"m": m(unalloc_end), "quality": "sourced", "source_id": "ra_2026-27_part2",
                        "method_note": "Unallocated reserves the council expects to hold at 31 March 2027 (RA 2026-27 line 1016)."},
            "minimum_safe": minimum,
        },
        "levers": levers,
        "toggles": ny["toggles"],
    }

    sources = [source_entry(reg[k]) for k in reg] + [METHOD]
    sources += [s for s in seed["meta"]["sources"] if s["id"] in KEEP_SEED_SOURCES]
    vintage = max(s["published_on"] for s in reg.values() if "published_on" in s)

    out = {
        "meta": {
            "council": seed["meta"]["council"], "council_short": seed["meta"]["council_short"], "council_code": ons,
            "year": YEAR,
            "note": "Built by etl/build.py from government returns. Values marked test or approx are carried over from data/seed until the council's budget report is extracted into data/manual/.",
            "vintage": vintage,
            "sources": sources,
        },
        "bill": {
            "band_d_total": band_d_total, "band_d_council": now["band_d_council"], "band_d_gla": band_d_gla,
            "band_d_total_prev": bands[PREV]["D"], "band_d_council_prev": prev["band_d_council"],
            "council_rise_pct": round((now["band_d_council"] / prev["band_d_council"] - 1) * 100, 2),
            "published_bands": bands[YEAR],
            "gla_note": seed["bill"]["gla_note"],
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
                    "band_d_gla": round(bands[y]["D"] - round(ctr[y]["band_d_council"], 2), 2),
                    "council_tax_requirement_m": round(ctr[y]["ctr"] / 1e6, 3), "tax_base": ctr[y]["tax_base"],
                    "collection_rate": ctr[y]["collection_rate"], "source_ids": sorted({ctr_src[y], bands_src[y]}),
                }
                for y in years
            ],
            "quality": "sourced",
        },
        "funding": funding_lines,
        "services": services,
        "gap_2026_27": manual_gap(seed["gap_2026_27"]),
        "next_year": next_year,
        "politics": seed["politics"],
    }
    return out


GAP_KINDS = ("pressure", "funding", "close", "close_saving", "close_oneoff")


def manual_gap(seed_lines: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """This year's gap waterfall from data/manual/gap_2026-27.csv if it has been extracted, else the seed.

    The CSV holds the report's lines in order, each with its page, plus one row of kind `report_gap`
    carrying the gap as the report states it. Checks: the lines add up to the report's own gap, and
    the closing lines close it to zero.
    """
    path = ROOT / "data" / "manual" / "gap_2026-27.csv"
    rows = [r for r in read_csv(path.name) if r["kind"]] if path.exists() else []
    if not rows:
        return seed_lines
    stated = [float(r["m"]) for r in rows if r["kind"] == "report_gap"]
    check(len(stated) == 1, "gap_2026-27.csv needs exactly one report_gap row (the gap as the report states it)")
    lines = [r for r in rows if r["kind"] in GAP_KINDS]
    check(len(lines) == len(rows) - 1, f"gap_2026-27.csv: unknown kinds {[r['kind'] for r in rows if r['kind'] not in GAP_KINDS + ('report_gap',)]}")
    opened = sum(float(r["m"]) for r in lines if r["kind"] in ("pressure", "funding"))
    closed = sum(float(r["m"]) for r in lines if r["kind"].startswith("close"))
    check(close(opened, stated[0], 0.05), f"gap lines add to £{opened}m, the report says £{stated[0]}m")
    check(close(opened + closed, 0.0, 0.05), f"the gap does not close: £{opened + closed}m left")
    out: List[Dict[str, Any]] = []
    for r in lines:
        if r["kind"].startswith("close") and not any(o["kind"] == "subtotal" for o in out):
            out.append({"label": "Gap to close", "kind": "subtotal"})
        out.append({"label": r["label"], "m": float(r["m"]), "kind": r["kind"], "quality": "sourced", "source_id": "budget_report",
                    "method_note": f"Budget report page {r['page']}"})
    out.append({"label": "Balanced", "kind": "total"})
    return out


def manual_next_year() -> Dict[str, Dict[str, str]]:
    """Next year's gap and the safe minimum for reserves from data/manual/next_year_2027-28.csv, if extracted."""
    path = ROOT / "data" / "manual" / "next_year_2027-28.csv"
    return {r["key"]: r for r in read_csv(path.name) if r["value"]} if path.exists() else {}


def manifest(out: Dict[str, Any], files: Dict[str, bytes]) -> Dict[str, Any]:
    reg = load_sources()
    counts: Dict[str, int] = {}

    def walk(x: Any) -> None:
        if isinstance(x, dict):
            if "quality" in x and isinstance(x["quality"], str):
                counts[x["quality"]] = counts.get(x["quality"], 0) + 1
            for v in x.values():
                walk(v)
        elif isinstance(x, list):
            for v in x:
                walk(v)

    walk(out)
    manual = sorted(p for p in (ROOT / "data" / "manual").glob("*.csv"))
    return {
        "generated_by": "etl/build.py",
        "inputs": [{"id": s["id"], "file": s["file"], "sha256": s["sha256"]} for s in reg],
        "manual": [{"file": f"data/manual/{p.name}", "sha256": sha256(p)} for p in manual],
        "outputs": [{"file": f"data/build/{k}", "sha256": hashlib.sha256(v).hexdigest()} for k, v in files.items()],
        "quality_counts": dict(sorted(counts.items())),
    }


def serialise(x: Any) -> bytes:
    return (json.dumps(x, indent=1, ensure_ascii=False) + "\n").encode("utf-8")


def main(check_only: bool) -> int:
    try:
        out = build()
    except CheckFailed as e:
        print(f"CHECK FAILED: {e}")
        return 1
    files = {"hf_2026-27.json": serialise(out)}
    files["manifest.json"] = serialise(manifest(out, files))
    if check_only:
        stale = [k for k, v in files.items() if not (BUILD / k).exists() or (BUILD / k).read_bytes() != v]
        if stale:
            print(f"data/build is out of date: {', '.join(stale)}. Run python3 etl/build.py and commit.")
            return 1
        print("data/build is up to date; every check passed.")
        return 0
    BUILD.mkdir(parents=True, exist_ok=True)
    for k, v in files.items():
        (BUILD / k).write_bytes(v)
    q = json.loads(files["manifest.json"])["quality_counts"]
    print(f"wrote data/build ({', '.join(f'{k} {v}' for k, v in q.items())})")
    return 0


if __name__ == "__main__":
    sys.exit(main("--check" in sys.argv))
