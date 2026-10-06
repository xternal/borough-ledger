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
# Seed sources are kept only while a carried-over value still cites them.


def m(v_thousands: float) -> float:
    """£000 → £m, rounded to the £1,000 the returns are published in."""
    return round(v_thousands / 1000.0, 3)


def source_entry(s: Dict[str, Any]) -> Dict[str, Any]:
    keys = ["id", "title", "publisher", "url", "published_on", "licence", "asset_url", "sha256"]
    return {k: s[k] for k in keys if k in s}


def build() -> Dict[str, Any]:
    reg = {s["id"]: s for s in load_sources()}
    for s in reg.values():
        path = ROOT / "data" / "raw" / s["file"]
        if s.get("manual"):
            # Read by hand into data/manual/; the build does not need the file, but if present it must be the one recorded.
            check(not path.exists() or sha256(path) == s["sha256"], f"{s['file']} does not match its SHA-256 in sources.json")
            continue
        check(path.exists(), f"missing data/raw/{s['file']}: run python3 etl/fetch.py")
        check(sha256(path) == s["sha256"], f"{s['file']} does not match its SHA-256 in sources.json")
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

    # ---------------------------------------------------------- spending history (RA budgets), checked year by year
    budget_history = []
    for s in sorted((x for x in reg.values() if x.get("extract", {}).get("kind") == "ra_history"), key=lambda x: x["extract"]["year"]):
        ex = s["extract"]
        row = read_la_row(str(ROOT / "data/raw" / s["file"]), ex["sheet"], ons)
        try:
            groups_y, _ = ra_services(row, strict_lines=False)
        except CheckFailed as e:
            raise CheckFailed(f"{s['id']}: {e}")
        groups_y.pop("housing_benefit", None)
        budget_history.append({
            "year": ex["year"], "revenue_expenditure_m": m(row.by_line("900")), "council_tax_requirement_m": m(row.by_line("990")),
            "services_m": {k: m(v) for k, v in sorted(groups_y.items())}, "source_id": s["id"],
        })

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
    unalloc_end = ra2.by_asset("resunall_end")
    mny = manual_next_year()
    def cite(key: str) -> Dict[str, str]:
        r = mny[key]
        check(r.get("source_id") in reg, f"next_year_2027-28.csv {key}: unknown source {r.get('source_id')}")
        return {"source_id": r["source_id"], "method_note": f"{reg[r['source_id']]['title'].split(' (')[0]}, PDF page {r['page']}. {r['note']}".strip()}

    gap_src: Dict[str, Any] = (
        {"gap_m": float(mny["gap_m"]["value"]), "quality": "sourced", **cite("gap_m")}
        if "gap_m" in mny else {"gap_m": ny["gap_m"], "quality": ny["quality"], "source_id": ny["source_id"], "todo": ny["todo"]}
    )
    minimum = (
        {"m": float(mny["minimum_safe_m"]["value"]), "quality": "sourced", **cite("minimum_safe_m")}
        if "minimum_safe_m" in mny else
        {"m": ny["reserves"]["minimum_safe_m"], "quality": "test", "source_id": "prototype_test",
         "todo": "TODO(source): the safe minimum set by the finance director in the budget report"}
    )
    rsg_br = fund.get("rsg", 0.0) + fund.get("business_rates", 0.0)
    levers = []
    for lv in ny["levers"]:
        lv = {k: v for k, v in lv.items() if k not in ("limit", "limit_note")}  # the threshold lives in data/config/rules.json
        if lv["id"] == "ct_rise" and "ct_assumed_pct" in mny and "council_tax_m" in mny:
            assumed = float(mny["ct_assumed_pct"]["value"])
            base = float(mny["council_tax_m"]["value"]) / (1 + assumed / 100)
            lv.update(m_per_unit=round(base / 100, 4), assumed=assumed, quality="approx", source_id=mny["council_tax_m"]["source_id"],
                      method_note=f"1% of 2027/28 council tax before the rise: £{mny['council_tax_m']['value']}m ÷ (1 + {assumed}%). "
                                  f"The council's forecast already assumes a {assumed}% rise, so only the difference from it closes or widens the gap.")
            lv.pop("todo", None)
        elif lv["id"] == "ct_rise":
            lv.update(m_per_unit=round(now["ctr"] / 1e6 / 100, 4), quality="approx", source_id="ctr_2026-27",
                      method_note="1% of the 2026/27 council tax requirement. Assumes the tax base stays at its 2026/27 level.")
            lv.pop("todo", None)
        elif lv["id"] == "fees" and "fees_income_m" in mny:
            fees = float(mny["fees_income_m"]["value"])
            lv.update(m_per_unit=round(fees / 100, 4), quality="approx", source_id=mny["fees_income_m"]["source_id"],
                      method_note=f"1% of the £{fees}m of fees and charges income in the 2026/27 budget (Appendix I). "
                                  "Static: it assumes people use services as much at higher prices, and some fees are set by law (PRE_SHIP_REVIEW H5).")
            lv.pop("todo", None)
        elif lv["id"] == "settlement":
            lv.update(m_per_unit=round(rsg_br / 1000 / 100, 4), quality="approx", source_id=ra_src,
                      method_note="1% of 2026/27 Revenue Support Grant plus retained business rates.")
            lv.pop("todo", None)
        elif lv["id"] in ("savings", "reserves"):
            lv.update(quality="modelled", source_id=METHOD["id"], method_note="£1m chosen closes £1m of the gap, by definition.")
            lv.pop("todo", None)
            if lv["id"] == "savings" and "planned_savings_m" in mny:
                lv["label"] = "Further savings"
                lv["method_note"] += f" On top of the £{mny['planned_savings_m']['value']}m of savings the forecast already includes."
        levers.append(lv)
    next_year = {
        "year": ny["year"], **gap_src,
        "reserves": {
            "general": {"m": m(unalloc_end), "quality": "sourced", "source_id": "ra_2026-27_part2",
                        "method_note": "Unallocated reserves the council expects to hold at 31 March 2027 (RA 2026-27 line 1016)."},
            "minimum_safe": minimum,
        },
        "levers": levers,
        "toggles": manual_toggles(ny["toggles"]),
    }

    vintage = max(s["published_on"] for s in reg.values() if "published_on" in s)

    out = {
        "meta": {
            "council": seed["meta"]["council"], "council_short": seed["meta"]["council_short"], "council_code": ons,
            "year": YEAR,
            "note": "Built by etl/build.py from government returns. Values marked test or approx are carried over from data/seed until the council's budget report is extracted into data/manual/.",
            "vintage": vintage,
            "sources": [],
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
            "budget": budget_history,
            "quality": "sourced",
        },
        "funding": funding_lines,
        "services": services,
        "gap_2026_27": manual_gap(seed["gap_2026_27"]),
        "savings": manual_savings(),
        "next_year": next_year,
        "politics": seed["politics"],
    }
    cited = set(cited_sources(out))
    sources = [source_entry(reg[k]) for k in reg] + [METHOD]
    sources += [s for s in seed["meta"]["sources"] if s["id"] in cited and s["id"] not in reg]
    out["meta"]["sources"] = sources
    return out


def cited_sources(x: Any) -> List[str]:
    """Every source id a value in the output cites."""
    found: List[str] = []
    if isinstance(x, dict):
        for k, v in x.items():
            if k == "source_id" and isinstance(v, str):
                found.append(v)
            elif k == "source_ids" and isinstance(v, list):
                found.extend(v)
            else:
                found.extend(cited_sources(v))
    elif isinstance(x, list):
        for v in x:
            found.extend(cited_sources(v))
    return found


GAP_KINDS = ("pressure", "funding", "close", "close_saving", "close_oneoff")


def manual_gap(seed_lines: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """This year's gap waterfall from data/manual/gap_2026-27.csv if it has been extracted, else the seed.

    The CSV holds the report's lines in order, each with its page, plus one `report_total` row: the report's
    own bottom line after every change (zero for a balanced budget). An optional `report_gap` row carries the
    gap if the report states one. Checks: the lines add up to the report's bottom line, which must be zero,
    and to the stated gap if given.
    """
    path = ROOT / "data" / "manual" / "gap_2026-27.csv"
    rows = [r for r in read_csv(path.name) if r["kind"]] if path.exists() else []
    if not rows:
        return seed_lines
    unknown = [r["kind"] for r in rows if r["kind"] not in GAP_KINDS + ("report_total", "report_gap")]
    check(not unknown, f"gap_2026-27.csv: unknown kinds {unknown}")
    totals = [float(r["m"]) for r in rows if r["kind"] == "report_total"]
    check(len(totals) == 1, "gap_2026-27.csv needs exactly one report_total row (the report's own bottom line)")
    lines = [r for r in rows if r["kind"] in GAP_KINDS]
    opened = sum(float(r["m"]) for r in lines if r["kind"] in ("pressure", "funding"))
    closed = sum(float(r["m"]) for r in lines if r["kind"].startswith("close"))
    check(close(opened + closed, totals[0], 0.05), f"gap lines add to £{opened + closed:.1f}m, the report's bottom line is £{totals[0]}m")
    check(close(totals[0], 0.0, 0.05), f"the report's own bottom line is £{totals[0]}m, not a balanced budget")
    for r in rows:
        if r["kind"] == "report_gap":
            check(close(opened, float(r["m"]), 0.05), f"gap lines open £{opened:.1f}m, the report says £{r['m']}m")
    out: List[Dict[str, Any]] = []
    for r in lines:
        if r["kind"].startswith("close") and not any(o["kind"] == "subtotal" for o in out):
            out.append({"label": "Gap to close", "kind": "subtotal"})
        out.append({"label": r["label"], "m": float(r["m"]), "kind": r["kind"], "quality": "sourced", "source_id": "budget_report",
                    "method_note": f"Budget report, PDF page {r['page']}. {r['note']}".strip()})
    out.append({"label": "Balanced", "kind": "total"})
    return out


def manual_savings() -> List[Dict[str, Any]]:
    """Named savings from data/manual/savings_2026-27.csv (budget report Appendix C), checked against each directorate's total."""
    path = ROOT / "data" / "manual" / "savings_2026-27.csv"
    if not path.exists():
        return []
    rows = read_csv(path.name)
    totals = {r["directorate"]: r for r in rows if r["kind"] == "total"}
    items = [r for r in rows if r["kind"] in ("service", "collection_fund")]
    check(len(items) + len(totals) == len(rows), "savings_2026-27.csv: unknown kinds")
    for d, t in totals.items():
        for col in ("k_2026_27", "k_2027_28"):
            got = sum(int(r[col]) for r in items if r["directorate"] == d)
            check(got == int(t[col]), f"savings {d} {col}: lines add to {got}, Appendix C total is {t[col]}")
    check(all(r["directorate"] in totals for r in items), "every savings directorate needs its total row")
    groups = {g["id"] for g in read_csv("service_groups.csv")}
    out = []
    for r in items:
        check(not r["service_group"] or r["service_group"] in groups, f"saving {r['id']}: unknown service group {r['service_group']}")
        now_m, next_m = int(r["k_2026_27"]) / 1000, int(r["k_2027_28"]) / 1000
        item: Dict[str, Any] = {
            "id": r["id"], "label": r["label"], "directorate": r["directorate"], "service": r["service"], "kind": r["kind"],
            # One-off: saves money this year and nothing next year (it comes back as a gap, invariant 4).
            "m": round(-now_m, 3), "m_next_year": round(-next_m, 3), "one_off": now_m != 0 and next_m == 0,
            "quality": "sourced", "source_id": "cabinet_pack_2026-02-09",
            "method_note": f"Budget Appendix C, Cabinet pack PDF page {r['page']}",
        }
        if r["service_group"]:
            item["service_group"] = r["service_group"]
        out.append(item)
    return out


def manual_toggles(toggles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Toggle costs from data/manual/toggles_2027-28.csv where extracted or modelled from the budget report."""
    path = ROOT / "data" / "manual" / "toggles_2027-28.csv"
    over = {r["id"]: r for r in read_csv(path.name)} if path.exists() else {}
    ids = {t["id"] for t in toggles}
    check(set(over) <= ids, f"toggles_2027-28.csv: unknown toggles {set(over) - ids}")
    out = []
    for t in toggles:
        if t["id"] in over:
            r = over[t["id"]]
            t = {k: v for k, v in t.items() if k != "todo"}
            t.update(cost_m=float(r["cost_m"]), quality=r["quality"], source_id="budget_report",
                     method_note=f"Budget report, PDF page {r['page']}: {r['method_note']}")
        out.append(t)
    return out


def manual_next_year() -> Dict[str, Dict[str, str]]:
    """Next year's figures from data/manual/next_year_2027-28.csv (key, value, source_id, page, note), if extracted."""
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
