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
    "Conservative Party": "conservative", "Conservative": "conservative", "Conservative and Unionist Party": "conservative", "Local Conservatives": "conservative",
    "Labour Party": "labour", "Labour": "labour", "Labour and Cooperative Party": "labour", "Labour and Co-operative Party": "labour",
    "Liberal Democrats": "liberal-democrats", "Green Party": "green", "Independent": "independent", "Reform UK": "reform-uk",
}
def party_id(name: str) -> str:
    """The party a councillor or candidate stands for, however the council or ballot writes it: "Labour and Co-operative
    Party", "Labour And Co Op Party" and "Labour Party" are Labour; "Local Conservatives" and "Conservative and Unionist
    Party" are Conservative. Anything else keeps its own name. The same rule for every party."""
    n = name.lower()
    for pattern, pid in ((r"^labour\b", "labour"), (r"\bconservatives?\b", "conservative"), (r"^liberal democrat", "liberal-democrats"),
                         (r"^(the )?green party|^green$", "green"), (r"^(the )?reform uk", "reform-uk"), (r"^independent$", "independent")):
        if re.search(pattern, n):
            return pid
    return PARTY.get(name, slug(name))


PARTY_SHORT = {"conservative": "Conservative", "labour": "Labour", "liberal-democrats": "Liberal Democrats", "green": "Green", "independent": "Independent", "reform-uk": "Reform UK"}


def slug(s: str) -> str:
    s = s.lower().replace("&", "and").replace("'", "").replace("’", "").replace("`", "")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def name_words(name: str) -> List[str]:
    """Lower-case words of a name, accents removed ("Zoë" is "zoe"), honours and degrees kept (they never match a ballot name)."""
    import unicodedata
    plain = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    words = [re.sub(r"[^a-z]", "", w) for w in re.findall(r"[a-z'’-]+", plain) if re.sub(r"[^a-z]", "", w)]
    while words and words[0] in TITLES:
        words = words[1:]
    return words


TITLES = {"dr", "prof", "professor", "sir", "dame", "rev", "revd", "mr", "mrs", "ms", "miss", "cllr", "councillor", "lord", "lady"}


def same_person(ballot: Dict[str, Any], listed: str) -> float:
    """How surely a May winner and a councillor on the council's list are the same person, 0 to 1. Names on ballot
    papers and on council websites differ: middle names, spellings ("Davies", "Davis"), honours after a name."""
    import difflib
    a = name_words(ballot["person"]["name"])
    full = name_words(f"{ballot['sopn_first_names']} {ballot['sopn_last_name']}")
    b = name_words(listed)
    if a == b[: len(a)] or full == b[: len(full)]:
        return 1.0  # the same name, perhaps followed by honours or degrees
    for x in (a, full):
        if len(b) >= 2 and all(w in x for w in b[:2]) and b[0] == x[0]:
            return 0.95  # the council writes fewer names: "Vanisha Solanki" for "Vanisha Surendra Bharti Solanki"
        if len(x) >= 2 and x[0] == b[0] and difflib.SequenceMatcher(None, x[-1], b[min(len(b), len(x)) - 1]).ratio() >= 0.8:
            return 0.9  # the same first name, the surname spelt slightly differently: "Davies" and "Davis"
    last = name_words(ballot["sopn_last_name"])
    if last and any(b[i : i + len(last)] == last for i in range(len(b))) and b[0] == (full[0] if full else ""):
        return 0.85
    return 0.0


def pair_winners(winners: List[Dict[str, Any]], listed: Dict[str, str]) -> Dict[int, str]:
    """May's winners paired one to one with the councillors listed for the ward, surest pairs first; 0.85 at least.
    Short first names ("Chris" for "Christopher", "Tricia" for "Patricia") pair on the surname when only one
    councillor listed for the ward has it and only one of May's winners there had it."""
    def surname_hits(w: Dict[str, Any]) -> List[str]:
        last = name_words(w["sopn_last_name"])
        return [cid for cid, n in listed.items() if last and any(name_words(n)[i : i + len(last)] == last for i in range(len(name_words(n))))]

    def score(w: Dict[str, Any], cid: str) -> float:
        best = same_person(w, listed[cid])
        hits = surname_hits(w)
        same_last = [x for x in winners if name_words(x["sopn_last_name"]) == name_words(w["sopn_last_name"])]
        if hits == [cid] and len(same_last) == 1:
            best = max(best, 0.86)
        return best

    scores = sorted(((score(w, cid), i, cid) for i, w in enumerate(winners) for cid in listed), reverse=True)
    pairs: Dict[int, str] = {}
    for score, i, cid in scores:
        if score >= 0.85 and i not in pairs and cid not in pairs.values():
            pairs[i] = cid
    return pairs


def ends_with_surname(name: str, last: str) -> bool:
    """Whether the surname on the ballot paper ("Tannous Ritchie", "Dar") is in a councillor's name as the council
    writes it, whole words only, whatever honours or degrees follow it ("Tariq Dar MBE", "Amer Agha MB BS, MSc")."""
    letters = lambda s: re.sub(r"[^a-z]", "", s.lower())  # noqa: E731
    words = [letters(w) for w in re.findall(r"[A-Za-z'’-]+", name)]
    target, n = letters(last), len(last.split())
    return any("".join(words[i : i + n]) == target for i in range(len(words) - n + 1))


def get(url: str, tries: int = 6) -> bytes:
    """Fetch politely: Democracy Club limits how fast it is asked, and some council servers are slow, so wait and retry."""
    import time
    import urllib.error
    for attempt in range(tries):
        if url.startswith(DC):
            time.sleep(1.5)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json, application/xml"})
            # Some councils' services take over a minute and a half to answer (Lambeth: 100 seconds on 9 Oct 2026).
            with urllib.request.urlopen(req, timeout=180) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code not in (429, 500, 502, 503, 504) or attempt == tries - 1:
                raise
            time.sleep(float(e.headers.get("Retry-After") or 0) or 10 * (attempt + 1))
        except (OSError, urllib.error.URLError):  # timeouts and dropped connections, on any Python
            if attempt == tries - 1:
                raise
            time.sleep(10 * (attempt + 1))
    raise RuntimeError("unreachable")


def fetch(b: Dict[str, str], today: str) -> Dict[str, Path]:
    d = RAW / b["slug"]
    d.mkdir(parents=True, exist_ok=True)
    paths = {k: d / f"{k}_{today}.{ext}" for k, ext in (("moderngov", "xml"), ("ballots", "json"), ("wards", "json"), ("mayor", "json"))}
    if not b.get("mayor_election_id"):
        paths.pop("mayor")
    paths["moderngov"].write_bytes(get(f"{b['moderngov']}/mgWebService.asmx/GetCouncillorsByWard"))
    ballots: List[dict] = []
    url = f"{DC}?{urllib.parse.urlencode({'election_id': b['election_id'], 'page_size': 50})}"
    while url:
        page = json.loads(get(url))
        ballots += page["results"]
        url = page.get("next")
    paths["ballots"].write_text(json.dumps(ballots, ensure_ascii=False))
    if b.get("mayor_election_id"):
        mayor = json.loads(get(f"{DC}?{urllib.parse.urlencode({'election_id': b['mayor_election_id'], 'page_size': 5})}"))["results"]
        (d / f"mayor_{today}.json").write_text(json.dumps(mayor, ensure_ascii=False))
    query = {"where": f"LAD24CD='{b['ons']}'", "outFields": "WD24CD,WD24NM,LONG,LAT", "outSR": "4326", "f": "geojson"}
    paths["wards"].write_bytes(get(f"{WM.SERVICE}?{urllib.parse.urlencode(query)}"))
    return paths


def latest(b: Dict[str, str]) -> Dict[str, Path]:
    d = RAW / b["slug"]
    out = {}
    for k in ("moderngov", "ballots", "wards") + (("mayor",) if b.get("mayor_election_id") else ()):
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
            if re.search(r"(?i)mayor|no ward|borough[- ]wide|^$", name):
                continue  # the elected mayor is listed under a heading of their own; the mayor comes from their ballot
            raise SystemExit(f"borough people {b['slug']}: ward {name!r} has no Democracy Club ballot")
        ids = []
        for c in w.iter("councillor"):
            raw_name = (c.findtext("fullusername") or "").strip()
            if b.get("mayor_election_id") and raw_name.startswith("Mayor "):
                continue  # the elected mayor, listed under their old ward; the mayor comes from their own ballot
            full = re.sub(r"^(Councillor|Cllr\.?)\s+", "", raw_name)
            if re.fullmatch(r"(?i)vacan(t|cy)( seat)?", full):
                continue  # Lambeth lists an empty seat as a councillor called "Vacancy"
            party_name = (c.findtext("politicalpartytitle") or "").strip()
            if not party_name:
                # The council lists this councillor without a party (Hackney's De Beauvoir): the party comes from their
                # ballot below, and the post listed with the entry, which is not a council post, is left out.
                print(f"borough people {b['slug']}: {full!r} in {name} has no party on the council's list; taken from the ballot")
            post = " ".join((c.findtext("keyposts") or "").split()).strip("()").strip() if party_name else ""
            post = re.sub(rf"\s*\(\s*{re.escape(name)}\s*\)?$", "", post).strip()  # "(Dalston)": the ward, said already
            cid = slug(full)
            ids.append(cid)
            councillors.append({
                "id": cid, "name": full, "party": party_id(party_name), "party_name": party_name, "ward_id": key,
                "roles": [p.strip() for p in re.split(r"\)\s*\(|;\s*", post) if p.strip()] if post else [],
                "democracy_url": f"{b['moderngov']}/mgUserInfo.aspx?UID={(c.findtext('councillorid') or '').strip()}",
            })
        x = by_ward[key]
        if len(ids) > x["winner_count"]:
            raise SystemExit(f"borough people {b['slug']}: {name}: {len(ids)} councillors listed, {x['winner_count']} seats elected")
        ward_cllrs = {i: next(c["name"] for c in councillors if c["id"] == i) for i in ids}
        winners = [cand for cand in x["candidacies"] if cand["elected"]]
        pairs = pair_winners(winners, ward_cllrs)
        candidates = []
        unmatched: List[tuple] = []
        for cand in x["candidacies"]:
            # A candidate their party withdrew support from after nominations is still on the ballot paper and can win.
            row = {"party": cand["party_name"], "votes": cand["result"]["num_ballots"], "elected": bool(cand["elected"])}
            pid = party_id(cand["party_name"])
            if pid in PARTY_SHORT:
                row["party_id"] = pid
            if cand["elected"]:
                i = winners.index(cand)
                if i in pairs:
                    row["councillor_id"] = pairs[i]
                    me = next(c for c in councillors if c["id"] == pairs[i])
                    if not me["party_name"]:
                        me["party_name"], me["party"] = cand["party_name"], party_id(cand["party_name"])
                else:
                    unmatched.append((row, cand["person"]["name"]))
            candidates.append(row)
        # A winner from May who is not on the council's current list is shown as elected but not named. That is allowed
        # only as far as a vacant seat or a councillor who joined since (not one of May's winners) accounts for it;
        # anything else is a name we failed to pair, and stops the build so a person looks.
        joined = [i for i in ids if i not in pairs.values()]
        room = (x["winner_count"] - len(ids)) + len(joined)
        if len(unmatched) > room:
            raise SystemExit(f"borough people {b['slug']}: {name}: elected {', '.join(n for _, n in unmatched)} not on the council's list, and no seat changed hands")
        for r, n in unmatched:
            r["left"] = True
            print(f"borough people {b['slug']}: {name}: {n} (elected in May) is not on the council's list; {', '.join(ward_cllrs[i] for i in joined) or 'a seat is empty'}")
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
    mayor = None
    if "mayor" in paths:
        ballot = [x for x in json.loads(paths["mayor"].read_text()) if not x["cancelled"]]
        if len(ballot) != 1:
            raise SystemExit(f"borough people {b['slug']}: {len(ballot)} mayoral ballots")
        won = [c for c in ballot[0]["candidacies"] if c["elected"]]
        if len(won) != 1:
            raise SystemExit(f"borough people {b['slug']}: the mayoral ballot has {len(won)} winners")
        w = won[0]
        mayor = {
            # An elected mayor is a public office holder, named as the declaration names them (CLAUDE.md invariant 6).
            "name": w["person"]["name"], "party": w["party_name"], "party_id": party_id(w["party_name"]),
            "votes": w["result"]["num_ballots"] if w.get("result") else None,
            "turnout_pct": (ballot[0].get("results") or {}).get("turnout_percentage"),
            "result_url": (ballot[0].get("results") or {}).get("source") or f"https://candidates.democracyclub.org.uk/elections/{ballot[0]['ballot_paper_id']}/",
            "dc_url": f"https://candidates.democracyclub.org.uk/elections/{ballot[0]['ballot_paper_id']}/",
        }
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
        # Parties without a common short name keep the name the council gives them, as written.
        "parties": [{"id": p, "short": PARTY_SHORT.get(p) or next(c["party_name"] for c in councillors if c["party"] == p), "seats": n}
                    for p, n in sorted(seats.items(), key=lambda kv: -kv[1])],
        "control": control,
        **({"mayor": mayor} if mayor else {}),
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


FIELDS = {"party", "party_id", "votes", "elected", "councillor_id", "left"}


def check(p: Dict[str, Any], shapes: Dict[str, Any]) -> List[str]:
    problems = []
    ids = {c["id"]: c for c in p["councillors"]}
    codes = {w["ons_code"] for w in shapes["wards"]}
    if {w["ons_code"] for w in p["wards"]} != codes:
        problems.append("wards differ from the boundaries")
    if sum(w["election"]["seats"] for w in p["wards"]) < len(ids):
        problems.append("more councillors than seats")
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
            if c["elected"] != ("councillor_id" in c or c.get("left", False)) or ("councillor_id" in c and ids.get(c["councillor_id"], {}).get("ward_id") != w["id"]):
                problems.append(f"{w['id']}: only elected candidates link to a councillor of the ward, and every one still serving does")
        left = sum(1 for c in e["candidates"] if c.get("left"))
        joined = [i for i in w["councillor_ids"] if i not in {c.get("councillor_id") for c in e["candidates"]}]
        if left > (e["seats"] - len(w["councillor_ids"])) + len(joined):
            problems.append(f"{w['id']}: more winners marked as no longer listed than seats that changed hands")
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
        today = date.today().isoformat()
        fresh = (RAW / b["slug"] / f"moderngov_{today}.xml").exists() and (RAW / b["slug"] / f"wards_{today}.json").exists()
        # Today's snapshots are reused, so a run that stopped part way does not ask everyone again.
        try:
            paths = latest(b) if "--offline" in argv or fresh else fetch(b, today)
        except (OSError, SystemExit) as e:
            print(f"borough people {b['slug']}: could not fetch ({e}); left as it was")
            continue
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
