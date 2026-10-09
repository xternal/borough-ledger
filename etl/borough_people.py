"""Wards, councillors and May 2026 election results for the boroughs in data/config/boroughs.json.

    python3 etl/borough_people.py            fetch, snapshot to data/raw/boroughs/<slug>/, write data/build/boroughs/<slug>/people.json and wards_map.json
    python3 etl/borough_people.py --offline  rebuild from the latest snapshots
    python3 etl/borough_people.py --check    check the committed files hold together (CI, no network): every ward has its
                                             councillors and a result, winners had the most votes, and only councillors are named

The same rules as Hammersmith & Fulham's (etl/councillors.py, etl/elections.py, etl/ward_map.py):
- Councillors from the council's ModernGov web service: name, party, ward, key posts and the link to their profile. No
  photos, addresses, phone numbers or emails (CLAUDE.md invariant 6).
- Ward codes, seats and results from Democracy Club (CC BY-SA 4.0), which copies the council's declarations. Only the
  candidates elected, who are councillors, are named; everyone else is their party's candidate.
- Ward boundaries from the ONS (Wards, December 2024), drawn as SVG paths.
- Parties are kept as the council lists them; a Labour and Co-operative councillor sits with Labour, as the council's own
  group lists do, and nothing else differs between parties (invariant 7).
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date
from pathlib import Path
from typing import Any, Dict, List

sys.path.insert(0, str(Path(__file__).resolve().parent))

import ward_map as WM  # noqa: E402
from boroughs import boroughs  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "boroughs"
OUT = ROOT / "data" / "build" / "boroughs"
UA = "BoroughLedger-ETL/0.1 (independent research; https://github.com/xternal/borough-ledger)"
DC = "https://candidates.democracyclub.org.uk/api/next/ballots/"
PARTY = {
    "Conservative Party": "conservative", "Conservative": "conservative", "Conservative and Unionist Party": "conservative",
    "Labour Party": "labour", "Labour": "labour", "Labour and Cooperative Party": "labour", "Labour and Co-operative Party": "labour",
    "Liberal Democrats": "liberal-democrats", "Green Party": "green", "Independent": "independent",
}
PARTY_SHORT = {"conservative": "Conservative", "labour": "Labour", "liberal-democrats": "Liberal Democrats", "green": "Green", "independent": "Independent"}


def slug(s: str) -> str:
    s = s.lower().replace("&", "and").replace("'", "").replace("’", "")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def ends_with_surname(name: str, last: str) -> bool:
    """Whether a councillor's name ends with the surname on the ballot paper ("Tannous Ritchie" included)."""
    letters = lambda s: re.sub(r"[^a-z]", "", s.lower())  # noqa: E731
    return letters(name).endswith(letters(last))


def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json, application/xml"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def fetch(b: Dict[str, str], today: str) -> Dict[str, Path]:
    d = RAW / b["slug"]
    d.mkdir(parents=True, exist_ok=True)
    paths = {k: d / f"{k}_{today}.{ext}" for k, ext in (("moderngov", "xml"), ("ballots", "json"), ("wards", "json"))}
    paths["moderngov"].write_bytes(get(f"{b['moderngov']}/mgWebService.asmx/GetCouncillorsByWard"))
    ballots: List[dict] = []
    url = f"{DC}?{urllib.parse.urlencode({'election_id': b['election_id'], 'page_size': 50})}"
    while url:
        page = json.loads(get(url))
        ballots += page["results"]
        url = page.get("next")
    paths["ballots"].write_text(json.dumps(ballots, ensure_ascii=False))
    query = {"where": f"LAD24CD='{b['ons']}'", "outFields": "WD24CD,WD24NM,LONG,LAT", "outSR": "4326", "f": "geojson"}
    paths["wards"].write_bytes(get(f"{WM.SERVICE}?{urllib.parse.urlencode(query)}"))
    return paths


def latest(b: Dict[str, str]) -> Dict[str, Path]:
    d = RAW / b["slug"]
    out = {}
    for k in ("moderngov", "ballots", "wards"):
        files = sorted(d.glob(f"{k}_*"))
        if not files:
            raise SystemExit(f"borough people {b['slug']}: no {k} snapshot; run without --offline first")
        out[k] = files[-1]
    return out


def people(b: Dict[str, str], paths: Dict[str, Path]) -> Dict[str, Any]:
    mg, dc = paths["moderngov"].read_bytes(), paths["ballots"].read_bytes()
    retrieved = paths["moderngov"].stem.rsplit("_", 1)[-1]
    ballots = [x for x in json.loads(dc) if not x["cancelled"] and not x["by_election_reason"]]
    by_ward = {slug(x["post"]["label"]): x for x in ballots}
    councillors: List[Dict[str, Any]] = []
    wards: List[Dict[str, Any]] = []
    for w in ET.fromstring(mg).iter("ward"):
        name = (w.findtext("wardtitle") or "").strip()
        key = slug(name)
        if key not in by_ward:
            raise SystemExit(f"borough people {b['slug']}: ward {name!r} has no Democracy Club ballot")
        ids = []
        for c in w.iter("councillor"):
            full = re.sub(r"^(Councillor|Cllr\.?)\s+", "", (c.findtext("fullusername") or "").strip())
            party_name = (c.findtext("politicalpartytitle") or "").strip()
            post = (c.findtext("keyposts") or "").strip().strip("()").strip()
            cid = slug(full)
            ids.append(cid)
            councillors.append({
                "id": cid, "name": full, "party": PARTY.get(party_name, slug(party_name)), "party_name": party_name, "ward_id": key,
                "roles": [p.strip() for p in re.split(r"\)\s*\(|;\s*", post) if p.strip()] if post else [],
                "democracy_url": f"{b['moderngov']}/mgUserInfo.aspx?UID={(c.findtext('councillorid') or '').strip()}",
            })
        x = by_ward[key]
        if x["winner_count"] != len(ids):
            raise SystemExit(f"borough people {b['slug']}: {name}: {len(ids)} councillors listed, {x['winner_count']} seats elected")
        candidates = []
        for cand in x["candidacies"]:
            if cand.get("deselected"):
                continue
            row = {"party": cand["party_name"], "votes": cand["result"]["num_ballots"], "elected": bool(cand["elected"])}
            pid = PARTY.get(cand["party_name"])
            if pid:
                row["party_id"] = pid
            if cand["elected"]:
                match = [i for i in ids if ends_with_surname(next(c["name"] for c in councillors if c["id"] == i), cand["sopn_last_name"])]
                if len(match) != 1:
                    raise SystemExit(f"borough people {b['slug']}: {name}: elected {cand['person']['name']} matches {len(match)} councillors")
                row["councillor_id"] = match[0]
            candidates.append(row)
        candidates.sort(key=lambda r: (-r["votes"], r["party"]))
        r = x["results"]
        wards.append({
            "id": key, "ons_code": x["post"]["id"].removeprefix("gss:"), "name": name, "councillor_ids": ids,
            "election": {
                "seats": x["winner_count"], "ballots": r["num_turnout_reported"], "turnout_pct": r["turnout_percentage"], "rejected": r["num_spoilt_ballots"],
                "result_url": r["source"], "dc_url": f"https://candidates.democracyclub.org.uk/elections/{x['ballot_paper_id']}/", "candidates": candidates,
            },
        })
    if len({c["id"] for c in councillors}) != len(councillors):
        raise SystemExit(f"borough people {b['slug']}: two councillors share a slug")
    seats: Dict[str, int] = {}
    for c in councillors:
        seats[c["party"]] = seats.get(c["party"], 0) + 1
    control = next((p for p, n in seats.items() if n * 2 > len(councillors)), None)
    return {
        "note": "Generated by etl/borough_people.py. Do not edit by hand; re-run it.",
        "sources": [
            {"title": f"{b['council']}, councillors by ward (ModernGov web service)", "url": f"{b['moderngov']}/mgWebService.asmx/GetCouncillorsByWard",
             "retrieved_on": retrieved, "sha256": hashlib.sha256(mg).hexdigest()},
            {"title": f"Democracy Club, {b['short']} local election 7 May 2026", "url": f"{DC}?election_id={b['election_id']}",
             "retrieved_on": retrieved, "licence": "CC BY-SA 4.0", "sha256": hashlib.sha256(dc).hexdigest()},
        ],
        "election": {"id": b["election_id"], "date": "2026-05-07"},
        "parties": [{"id": p, "short": PARTY_SHORT.get(p, p.replace("-", " ").title()), "seats": n} for p, n in sorted(seats.items(), key=lambda kv: -kv[1])],
        "control": control,
        "wards": sorted(wards, key=lambda w: w["name"]),
        "councillors": councillors,
    }


def ward_shapes(b: Dict[str, str], path: Path) -> Dict[str, Any]:
    data = path.read_bytes()
    feats = json.loads(data)["features"]
    by_code = {f["properties"]["WD24CD"]: WM.rings(f["geometry"]) for f in feats}
    project, height = WM.projector([p for rs in by_code.values() for ring in rs for p in ring])
    near = WM.neighbours(by_code)
    return {
        "note": "Generated by etl/borough_people.py. Do not edit by hand; re-run it.",
        "source": {**WM.SOURCE, "url": WM.SERVICE, "retrieved_on": path.stem.split("_")[-1], "sha256": hashlib.sha256(data).hexdigest()},
        "council_code": b["ons"],
        "view_box": [WM.WIDTH, height],
        "wards": [
            {"ons_code": f["properties"]["WD24CD"], "ons_name": f["properties"]["WD24NM"], "path": WM.svg_path(by_code[f["properties"]["WD24CD"]], project),
             "label": list(project((float(f["properties"]["LONG"]), float(f["properties"]["LAT"])))), "neighbours": near[f["properties"]["WD24CD"]]}
            for f in sorted(feats, key=lambda f: f["properties"]["WD24CD"])
        ],
    }


FIELDS = {"party", "party_id", "votes", "elected", "councillor_id"}


def check(p: Dict[str, Any], shapes: Dict[str, Any]) -> List[str]:
    problems = []
    ids = {c["id"]: c for c in p["councillors"]}
    codes = {w["ons_code"] for w in shapes["wards"]}
    if {w["ons_code"] for w in p["wards"]} != codes:
        problems.append("wards differ from the boundaries")
    if sum(w["election"]["seats"] for w in p["wards"]) != len(ids):
        problems.append("seats do not add up to the councillors")
    for w in p["wards"]:
        e = w["election"]
        won = [c for c in e["candidates"] if c["elected"]]
        if len(won) != e["seats"]:
            problems.append(f"{w['id']}: {len(won)} elected for {e['seats']} seats")
        if won and min(c["votes"] for c in won) < max((c["votes"] for c in e["candidates"] if not c["elected"]), default=0):
            problems.append(f"{w['id']}: a candidate with fewer votes was elected")
        for c in e["candidates"]:
            if set(c) - FIELDS:
                problems.append(f"{w['id']}: unexpected field (no names beyond councillors)")
            if c["elected"] != ("councillor_id" in c) or ("councillor_id" in c and ids.get(c["councillor_id"], {}).get("ward_id") != w["id"]):
                problems.append(f"{w['id']}: only elected candidates link to a councillor of the ward, and every one does")
    if "·" in json.dumps(p, ensure_ascii=False):
        problems.append("middle dot")
    return problems


def dump(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False, indent=1) + "\n"


def finder() -> Dict[str, Any]:
    """Every borough's wards in one small file the site bundles, for the postcode finder (ward code to page)."""
    out = []
    for b in boroughs():
        p = json.loads((OUT / b["slug"] / "people.json").read_text())
        out.append({"slug": b["slug"], "short": b["short"], "ons": b["ons"], "wards": [{"id": w["id"], "name": w["name"], "ons_code": w["ons_code"]} for w in p["wards"]]})
    return {"note": "Generated by etl/borough_people.py from each borough's people.json, for the postcode finder.", "boroughs": out}


def main(argv: List[str]) -> None:
    finder_path = OUT / "finder.json"
    if "--check" in argv and (not finder_path.exists() or finder_path.read_text() != dump(finder())):
        raise SystemExit("borough people: data/build/boroughs/finder.json is out of date; run python3 etl/borough_people.py --offline")
    for b in boroughs():
        out = OUT / b["slug"]
        if "--check" in argv:
            problems = check(json.loads((out / "people.json").read_text()), json.loads((out / "wards_map.json").read_text()))
            if problems:
                raise SystemExit(f"borough people {b['slug']}: " + "; ".join(problems[:10]))
            print(f"borough people {b['slug']}: well formed.")
            continue
        paths = latest(b) if "--offline" in argv else fetch(b, date.today().isoformat())
        p, shapes = people(b, paths), ward_shapes(b, paths["wards"])
        problems = check(p, shapes)
        if problems:
            raise SystemExit(f"borough people {b['slug']}: " + "; ".join(problems[:10]))
        out.mkdir(parents=True, exist_ok=True)
        (out / "people.json").write_text(dump(p))
        (out / "wards_map.json").write_text(dump(shapes))
        print(f"borough people {b['slug']}: {len(p['councillors'])} councillors in {len(p['wards'])} wards; seats {[(x['short'], x['seats']) for x in p['parties']]}; control {p['control']}")
    if "--check" not in argv:
        finder_path.write_text(dump(finder()))


if __name__ == "__main__":
    main(sys.argv[1:])
