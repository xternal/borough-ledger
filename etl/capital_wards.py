"""Council building schemes by ward: which ward each capital scheme in the spend files is in.

    python3 etl/capital_wards.py --draft   add new schemes to data/manual/capital_scheme_wards.csv, located with
                                           OpenStreetMap (Nominatim) and the ONS ward boundaries, as reviewed=no
    python3 etl/capital_wards.py           build data/build/payments/wards.json from the built month files and the table
    python3 etl/capital_wards.py --check   check data/build/payments/wards.json matches a fresh build (CI)

The spend files name a scheme in the service area ("Capital - Frank Banfield Park"), never an address. A person checks
each line of the table once (data/manual/README.md); until every line is checked the site marks ward totals approx.

kind: place (one ward), several (more than one ward, listed in `wards`, money not split), borough (a programme across
the borough, such as footways or street lights), outside (the council's own sites beyond the borough, such as its
cemeteries in Richmond), unknown (no single place can be told from the name).
"""
from __future__ import annotations

import csv
import json
import math
import re
import sys
import time
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Optional, Tuple

ROOT = Path(__file__).resolve().parent.parent
MONTHS = ROOT / "data" / "build" / "payments" / "months"
TABLE = ROOT / "data" / "manual" / "capital_scheme_wards.csv"
OUT = ROOT / "data" / "build" / "payments" / "wards.json"
WARDS_YAML = ROOT / "content" / "wards.yaml"
RAW = ROOT / "data" / "raw"
CACHE = RAW / "geocode_cache.json"
UA = "BoroughLedger-ETL/0.1 (independent research; https://github.com/xternal/borough-ledger)"
NOMINATIM = "https://nominatim.openstreetmap.org/search"

FIELDS = ["service_area", "kind", "ward_id", "wards", "query", "lat", "lon", "osm_name", "total", "reviewed", "note"]
KINDS = {"place", "several", "borough", "outside", "unknown"}

# Programmes that run across the borough, never one place. Matched on whole words, case-insensitive.
BOROUGH_WORDS = [
    r"^footways$", r"^carriageways$", r"led programme", r"column replacement", r"adaptations", r"\bdfg\b", r"voids?\b", r"disrepair",
    r"fire doors", r"wet risers", r"compliance", r"electrical upgrades", r"spandrel", r"cycle parking", r"parking zone signage",
    r"containers", r"electric waste vehicles", r"^new home acquisitions$", r"^acquisition of new homes$", r"^site acquisitions$", r"misc", r"responsive capital", r"estate roads", r"garage improvements",
    r"estate security", r"controlled access", r"communal boilers", r"healthy school streets", r"school greening", r"greening schemes",
    r"environmental improvements", r"road danger reduction", r"principal road", r"residential street resurfacing", r"fire risk assessors",
    r"buy backs", r"street properties", r"retrofit demonstrator", r"decarbonisation", r"energy improvement",
    r"school led lighting", r"school downpipe", r"school green vegetation", r"changing places toilets", r"sheltered housing warden",
    r"air conditioning for lift", r"lift motor", r"crime fighting strategy", r"public cctv", r"parking cctv", r"parking policy",
    r"neighbourhood investment fund", r"neighbourhood improvement", r"children's services capital", r"leisure centres investment",
    r"defra air quality", r"family hub", r"major voids", r"complex void", r"landlord", r"capital projects delivery",
    r"tfl cycle parking", r"cs10", r"cycle superhighway",
]

# Words that describe the work, not the place, dropped before searching for the place.
WORK_WORDS = [
    r"\bs ?106\b", r"\bs ?278\b", r"\bpre[- ]?development costs\b", r"\bpre[- ]?development\b", r"\bpre restoration works\b", r"\bdevelopment\b",
    r"\bredevelopment\b", r"\brefurbishment scheme\b", r"\brefurbishment\b", r"\bresidential\b", r"\bmajor ?w(or)?ks\b", r"\bworks?\b",
    r"\bphase \d+\b", r"\bph \d+\b", r"\bplanned maint(enance)?\b", r"\bfire safety\b", r"\bstabilisation\b", r"\bmaintenance\b",
    r"\bimprovements?\b", r"\bpublic realm\b", r"\broof\b", r"\bwindows?\b", r"\breplace(ment)?\b", r"\bstructural repairs\b",
    r"\btemporary highway\b", r"\bsuds\b", r"\bdepave\b", r"\bgrey to green\b", r"\bgreening\b", r"\bfit out\b", r"\bpackage \d+:?\b",
    r"\bwave \d+\b", r"\bshf\b", r"\bshdf\b", r"\bkcyf\b", r"\bffc\b", r"\bloan\b", r"\bacquisition of\b", r"\bacquisition\b", r"\basset purchase\b",
    r"\bcommercial unit(s)?\b", r"\bsolar pv installation\b", r"\bheat network\b", r"\bheating pilot\b", r"\bsports courts\b",
    r"\bmuga/gym\b", r"\bpond\b", r"\bsoakaway project\b", r"\brailings\b", r"\bbalustrades\b", r"\bfootpaths\b", r"\bchanging rooms\b",
    r"\bcaretakers lodge\b", r"\bday centre\b", r"\boptions day service\b", r"\bwildflower verge\b",
    r"\bzebra crossing\b", r"\bpedestrian\b", r"\bdesign vision\b", r"\bwalkng, cyclng, bus priority\b", r"\btra community hall\b",
    r"\blifts?\b", r"\bplanters?\b", r"[()–—:-]",
]


# Council shorthand that OpenStreetMap does not know, written out as the place it names. Each is checked in review.
ALIASES = {
    "ed city": "Bloemfontein Road",  # Education City, White City
    "wksr town hall": "Hammersmith Town Hall",  # West King Street Renewal
    "civic campus": "Hammersmith Town Hall",
    "king st civic campus": "Hammersmith Town Hall",
    "hartopp & lannoy": "Pellant Road",  # Hartopp and Lannoy Points
    "hartopp & lannoy point footways": "Pellant Road",
    "edward woods": "Edward Woods Estate",
}


def place_of(area: str) -> str:
    """'Capital - Frank Banfield Park' -> 'Frank Banfield Park'; work words dropped, shorthand written out."""
    s = re.sub(r"^capital\s*-\s*", "", area, flags=re.I)
    s = s.replace("´", "'").replace("’", "'")
    s = re.sub(r"^schools maintenance\s*-\s*", "", s, flags=re.I)
    for w in WORK_WORDS:
        s = re.sub(w, " ", s, flags=re.I)
    s = re.sub(r"\bSCH\b", "School", s)
    s = re.sub(r"\bCt\b", "Court", s)
    s = re.sub(r"\bRd\b", "Road", s)
    s = re.sub(r"(?<=\w) St\b", " Street", s)
    s = re.sub(r"\b(and|&)\s*$", "", s.strip())
    s = " ".join(s.split()).strip(" ,&/")
    return ALIASES.get(s.lower(), s)


def borough_wide(area: str) -> bool:
    name = re.sub(r"^capital\s*-\s*", "", area, flags=re.I).lower()
    return any(re.search(w, name) for w in BOROUGH_WORDS)


# ------------------------------------------------------------------ geometry


def load_wards() -> Tuple[Dict[str, str], Dict[str, List[List[Tuple[float, float]]]]]:
    """Ward id by ONS code (from content/wards.yaml) and each ward's rings (from the latest ONS snapshot)."""
    ids: Dict[str, str] = {}
    cur_id = None
    for line in WARDS_YAML.read_text().splitlines():
        m = re.match(r'\s+- id: "(.+)"', line)
        if m:
            cur_id = m.group(1)
        m = re.match(r'\s+ons_code: "(E05\d{6})"', line)
        if m and cur_id:
            ids[m.group(1)] = cur_id
    snaps = sorted(RAW.glob("ward_boundaries_*.geojson"))
    if not snaps:
        raise SystemExit("no ward boundary snapshot in data/raw/; run python3 etl/ward_map.py first")
    gj = json.loads(snaps[-1].read_text())
    rings: Dict[str, List[List[Tuple[float, float]]]] = {}
    for f in gj["features"]:
        g = f["geometry"]
        polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
        rings[ids[f["properties"]["WD24CD"]]] = [[(x, y) for x, y in ring] for poly in polys for ring in poly]
    return ids, rings


def inside(pt: Tuple[float, float], ring: List[Tuple[float, float]]) -> bool:
    x, y = pt
    hit = False
    for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            hit = not hit
    return hit


def metres_to_edge(pt: Tuple[float, float], rings: List[List[Tuple[float, float]]]) -> float:
    """Shortest distance from the point to the ward's boundary, in metres (flat-earth, fine at borough scale)."""
    k = math.cos(math.radians(pt[1]))
    px, py = pt[0] * k * 111320, pt[1] * 110540
    best = float("inf")
    for ring in rings:
        for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
            ax, ay, bx, by = x1 * k * 111320, y1 * 110540, x2 * k * 111320, y2 * 110540
            dx, dy = bx - ax, by - ay
            t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy or 1)))
            best = min(best, math.hypot(px - ax - t * dx, py - ay - t * dy))
    return best


def ward_at(pt: Tuple[float, float], rings: Dict[str, List[List[Tuple[float, float]]]]) -> Optional[str]:
    for wid, rs in rings.items():
        # Outer ring decides; the borough's wards have no holes.
        if any(inside(pt, r) for r in rs):
            return wid
    return None


# ------------------------------------------------------------------ geocoding


def geocode(q: str, bbox: Tuple[float, float, float, float], cache: dict) -> Optional[dict]:
    """Nominatim, bounded to the borough's box, one request a second, cached (its usage policy)."""
    if q in cache:
        return cache[q]
    params = {"q": f"{q}, London", "format": "jsonv2", "limit": "1", "countrycodes": "gb", "bounded": "1",
              "viewbox": f"{bbox[0]},{bbox[3]},{bbox[2]},{bbox[1]}"}
    req = urllib.request.Request(f"{NOMINATIM}?{urllib.parse.urlencode(params)}", headers={"User-Agent": UA})
    time.sleep(1.1)
    with urllib.request.urlopen(req, timeout=30) as r:
        res = json.loads(r.read())
    hit = {"lat": float(res[0]["lat"]), "lon": float(res[0]["lon"]), "name": res[0]["display_name"]} if res else None
    cache[q] = hit
    CACHE.write_text(json.dumps(cache, indent=1, ensure_ascii=False))
    return hit


# ------------------------------------------------------------------ table and build


def scheme_totals() -> Dict[str, dict]:
    out: Dict[str, dict] = defaultdict(lambda: {"total": 0.0, "rows": 0, "first": "9999-99", "last": "0000-00", "files": set()})
    for f in sorted(MONTHS.glob("*.json")):
        d = json.loads(f.read_text())
        for r in d["rows"]:
            area = d["areas"][r[4]]
            if r[3] != "capital" or not area.lower().startswith("capital"):
                continue
            a = out[area]
            a["total"] += r[2]
            a["rows"] += 1
            a["first"] = min(a["first"], d["month"])
            a["last"] = max(a["last"], d["month"])
            a["files"].add(d["files"][r[7]])
    return out


def read_table() -> Dict[str, dict]:
    if not TABLE.exists():
        return {}
    with TABLE.open(newline="") as fh:
        return {r["service_area"]: r for r in csv.DictReader(fh)}


def write_table(rows: Dict[str, dict]) -> None:
    with TABLE.open("w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=FIELDS, lineterminator="\n")
        w.writeheader()
        for r in sorted(rows.values(), key=lambda r: -float(r["total"] or 0)):
            w.writerow({k: r.get(k, "") for k in FIELDS})


def draft() -> None:
    totals = scheme_totals()
    rows = read_table()
    _, rings = load_wards()
    pts = [p for rs in rings.values() for r in rs for p in r]
    bbox = (min(p[0] for p in pts), min(p[1] for p in pts), max(p[0] for p in pts), max(p[1] for p in pts))
    cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}
    added = 0
    for area, t in sorted(totals.items(), key=lambda kv: -kv[1]["total"]):
        if area in rows:
            rows[area]["total"] = f"{t['total']:.2f}"
            continue
        row = {"service_area": area, "total": f"{t['total']:.2f}", "reviewed": "no", "wards": "", "ward_id": "", "lat": "", "lon": "", "osm_name": "", "note": ""}
        if borough_wide(area):
            row.update(kind="borough", query="", note="drafted: a programme across the borough")
        else:
            q = place_of(area)
            hit = geocode(q, bbox, cache) if q else None
            row["query"] = q
            if not hit:
                row.update(kind="unknown", note="drafted: no match in OpenStreetMap")
            else:
                pt = (hit["lon"], hit["lat"])
                wid = ward_at(pt, rings)
                row.update(lat=f"{hit['lat']:.5f}", lon=f"{hit['lon']:.5f}", osm_name=hit["name"][:160])
                if not wid:
                    row.update(kind="unknown", note="drafted: OpenStreetMap match is outside the borough")
                else:
                    near = metres_to_edge(pt, rings[wid])
                    row.update(kind="place", ward_id=wid, note="drafted" + (f": {near:.0f} m from the ward boundary" if near < 75 else ""))
        rows[area] = row
        added += 1
    write_table(rows)
    print(f"capital wards: {added} schemes added, {len(rows)} in the table, {sum(r['reviewed'] == 'no' for r in rows.values())} not yet checked")


def build() -> dict:
    totals = scheme_totals()
    table = read_table()
    missing = sorted(set(totals) - set(table))
    if missing:
        raise SystemExit(f"capital wards: {len(missing)} schemes are not in data/manual/capital_scheme_wards.csv; run --draft: {missing[:5]}")
    for area, r in table.items():
        if r["kind"] not in KINDS:
            raise SystemExit(f"capital wards: {area}: unknown kind {r['kind']}")
        if r["kind"] == "place" and not r["ward_id"]:
            raise SystemExit(f"capital wards: {area}: a place needs a ward_id")
        if r["kind"] == "several" and len(r["wards"].split(";")) < 2:
            raise SystemExit(f"capital wards: {area}: 'several' needs two or more wards")
        if r["reviewed"] not in {"no", "checked", "yes"}:
            raise SystemExit(f"capital wards: {area}: reviewed must be no, checked or yes")
    wards: Dict[str, dict] = defaultdict(lambda: {"total": 0.0, "rows": 0, "schemes": [], "shared": []})
    kinds: Dict[str, float] = defaultdict(float)
    for area, t in sorted(totals.items(), key=lambda kv: -kv[1]["total"]):
        r = table[area]
        label = " ".join(re.sub(r"^capital\s*-\s*", "", area, flags=re.I).replace("´", "'").replace("’", "'").split()).rstrip(".")
        s = {"area": area, "label": label, "total": round(t["total"], 2), "rows": t["rows"], "first": t["first"], "last": t["last"], "files": sorted(t["files"])}
        kinds[r["kind"]] += t["total"]
        if r["kind"] == "place":
            w = wards[r["ward_id"]]
            w["total"] += t["total"]
            w["rows"] += t["rows"]
            w["schemes"].append(s)
        elif r["kind"] == "several":
            for wid in r["wards"].split(";"):
                wards[wid]["shared"].append({**s, "wards": r["wards"].split(";")})
    used = {area for area in totals}
    checked = [table[a]["reviewed"] for a in used]
    return {
        "note": "Generated by etl/capital_wards.py from data/build/payments/months and data/manual/capital_scheme_wards.csv.",
        "quality": "sourced" if all(c == "yes" for c in checked) else "approx",
        "mapping": {"schemes": len(used), "unreviewed": checked.count("no"), "checked": checked.count("checked")},
        "by_kind": {k: round(v, 2) for k, v in sorted(kinds.items())},
        "total": round(sum(t["total"] for t in totals.values()), 2),
        "first": min(t["first"] for t in totals.values()),
        "last": max(t["last"] for t in totals.values()),
        "wards": {wid: {**w, "total": round(w["total"], 2)} for wid, w in sorted(wards.items())},
    }


def dump(obj: dict) -> str:
    return json.dumps(obj, ensure_ascii=False, indent=1) + "\n"


def main(argv: List[str]) -> None:
    if "--draft" in argv:
        draft()
        return
    out = dump(build())
    if "--check" in argv:
        if not OUT.exists() or OUT.read_text() != out:
            raise SystemExit("capital wards: data/build/payments/wards.json is out of date; run python3 etl/capital_wards.py")
        print("capital wards: data/build/payments/wards.json matches a fresh build.")
        return
    OUT.write_text(out)
    d = json.loads(out)
    print(f"capital wards: £{d['total'] / 1e6:.1f}m in {d['mapping']['schemes']} schemes; by kind {d['by_kind']}; quality {d['quality']}")


if __name__ == "__main__":
    main(sys.argv[1:])
