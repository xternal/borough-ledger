"""Ward boundaries for the map on /wards and each ward page, from the ONS Open Geography Portal.

    python3 etl/ward_map.py            fetch the borough's wards, snapshot to data/raw/, write data/build/ward_map.json
    python3 etl/ward_map.py --offline  rebuild data/build/ward_map.json from the latest snapshot in data/raw/
    python3 etl/ward_map.py --check    with a snapshot, check data/build/ward_map.json matches a fresh build

The map is drawn as SVG paths, projected here so the site ships no map library and makes no map requests.
Wards next to each other are found from the boundaries they share. H&F's 21 wards have been the same since
May 2022; the December 2024 file is the newest the portal serves for queries.
"""
from __future__ import annotations

import hashlib
import json
import math
import sys
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path
from typing import Dict, List, Sequence, Tuple

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "build" / "ward_map.json"
UA = "BoroughLedger-ETL/0.1 (independent research; https://github.com/xternal/borough-ledger)"

COUNCIL_CODE = "E09000013"
SERVICE = "https://services1.arcgis.com/ESMARspQHYMw9BZ9/ArcGIS/rest/services/Wards_December_2024_Boundaries_UK_BGC/FeatureServer/0/query"
QUERY = {"where": f"LAD24CD='{COUNCIL_CODE}'", "outFields": "WD24CD,WD24NM,LONG,LAT", "outSR": "4326", "f": "geojson"}
SOURCE = {
    "title": "Office for National Statistics, Wards (December 2024) Boundaries UK BGC",
    "page": "https://geoportal.statistics.gov.uk/",
    "licence": "Open Government Licence v3.0",
    "attribution": "Source: Office for National Statistics licensed under the Open Government Licence v.3.0. Contains OS data © Crown copyright and database right 2024.",
}

# The map's width in SVG units; the height follows the borough's shape.
WIDTH = 400.0
PAD = 6.0

Point = Tuple[float, float]


def fetch() -> Path:
    url = f"{SERVICE}?{urllib.parse.urlencode(QUERY)}"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
    RAW.mkdir(parents=True, exist_ok=True)
    path = RAW / f"ward_boundaries_{date.today().isoformat()}.geojson"
    path.write_bytes(data)
    return path


def latest() -> Path | None:
    files = sorted(RAW.glob("ward_boundaries_*.geojson"))
    return files[-1] if files else None


def rings(geometry: dict) -> List[List[Point]]:
    """Every ring of a Polygon or MultiPolygon, as (lon, lat) points."""
    if geometry["type"] == "Polygon":
        polys = [geometry["coordinates"]]
    elif geometry["type"] == "MultiPolygon":
        polys = geometry["coordinates"]
    else:
        raise ValueError(f"unexpected geometry {geometry['type']}")
    return [[(float(x), float(y)) for x, y in ring] for poly in polys for ring in poly]


def projector(all_points: Sequence[Point]):
    """Equirectangular projection at the borough's middle latitude, fitted to WIDTH. North is up."""
    lons = [p[0] for p in all_points]
    lats = [p[1] for p in all_points]
    k = math.cos(math.radians((min(lats) + max(lats)) / 2))
    w = (max(lons) - min(lons)) * k
    h = max(lats) - min(lats)
    scale = (WIDTH - 2 * PAD) / w
    height = round(h * scale + 2 * PAD, 1)

    def project(p: Point) -> Point:
        return (round((p[0] - min(lons)) * k * scale + PAD, 1), round((max(lats) - p[1]) * scale + PAD, 1))

    return project, height


def svg_path(rs: List[List[Point]], project) -> str:
    out = []
    for ring in rs:
        pts = [project(p) for p in ring]
        # Drop points that land on the same spot once rounded, and the closing point (Z closes the ring).
        clean: List[Point] = []
        for p in pts:
            if not clean or p != clean[-1]:
                clean.append(p)
        if len(clean) > 1 and clean[0] == clean[-1]:
            clean.pop()
        out.append("M" + "L".join(f"{x:g},{y:g}" for x, y in clean) + "Z")
    return "".join(out)


def edges(rs: List[List[Point]]) -> set:
    """Each boundary segment, direction-free, so two wards that share a boundary share segments."""
    out = set()
    for ring in rs:
        for a, b in zip(ring, ring[1:]):
            out.add((a, b) if a <= b else (b, a))
    return out


def neighbours(by_code: Dict[str, List[List[Point]]]) -> Dict[str, List[str]]:
    """Wards that share at least one boundary segment. Touching at a single corner does not count."""
    e = {code: edges(rs) for code, rs in by_code.items()}
    return {code: sorted(other for other in e if other != code and e[code] & e[other]) for code in e}


def build(raw_path: Path) -> dict:
    data = raw_path.read_bytes()
    gj = json.loads(data)
    feats = gj["features"]
    if not feats:
        raise SystemExit("no wards in the snapshot")
    by_code = {f["properties"]["WD24CD"]: rings(f["geometry"]) for f in feats}
    project, height = projector([p for rs in by_code.values() for ring in rs for p in ring])
    near = neighbours(by_code)
    wards = []
    for f in sorted(feats, key=lambda f: f["properties"]["WD24CD"]):
        pr = f["properties"]
        code = pr["WD24CD"]
        wards.append(
            {
                "ons_code": code,
                "ons_name": pr["WD24NM"],
                "path": svg_path(by_code[code], project),
                "label": list(project((float(pr["LONG"]), float(pr["LAT"])))),
                "neighbours": near[code],
            }
        )
    return {
        "note": "Generated by etl/ward_map.py. Do not edit by hand; re-run it.",
        "source": {
            **SOURCE,
            "url": f"{SERVICE}?{urllib.parse.urlencode(QUERY)}",
            "retrieved_on": raw_path.stem.split("_")[-1],
            "sha256": hashlib.sha256(data).hexdigest(),
        },
        "council_code": COUNCIL_CODE,
        "view_box": [WIDTH, height],
        "wards": wards,
    }


def dump(obj: dict) -> str:
    return json.dumps(obj, ensure_ascii=False, indent=1) + "\n"


def main(argv: List[str]) -> None:
    if "--check" in argv:
        raw = latest()
        if raw is None:
            print("ward map: no snapshot in data/raw/, nothing to check against (the committed build is used as is).")
            return
        if dump(build(raw)) != OUT.read_text():
            raise SystemExit("ward map: data/build/ward_map.json does not match a fresh build; run python3 etl/ward_map.py --offline")
        print("ward map: data/build/ward_map.json matches a fresh build.")
        return
    raw = latest() if "--offline" in argv else fetch()
    if raw is None:
        raise SystemExit("no snapshot in data/raw/; run without --offline first")
    out = build(raw)
    OUT.write_text(dump(out))
    lonely = [w["ons_name"] for w in out["wards"] if not w["neighbours"]]
    print(f"ward map: {len(out['wards'])} wards, view box {out['view_box']}, from {raw.name}" + (f"; no neighbours found for {lonely}" if lonely else ""))


if __name__ == "__main__":
    main(sys.argv[1:])
