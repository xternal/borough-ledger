"""Ward election results from Democracy Club: the borough election of 7 May 2026.

    python3 etl/elections.py            fetch the ballots, check them, write data/build/elections.json
    python3 etl/elections.py --offline  rebuild from the snapshot in data/raw/elections/
    python3 etl/elections.py --check    check data/build/elections.json is well formed (CI has no snapshot)

Democracy Club copies each ward's declaration from the council's result page, keeps that page's address, and
publishes the results under CC BY-SA 4.0; its API is meant for scripts, while the council's pages refuse them. Two
wards were read against the council's own pages on 8 Oct 2026 (Addison; Palace and Hurlingham): every vote,
the turnout and the rejected ballots matched.

Names: only the candidates elected are named, because they are councillors, and each is matched to the council's own
councillor record (CLAUDE.md invariant 6). Every other candidate appears as their party's candidate, with their votes.
Every party is treated the same way (invariant 7): the parties with seats link to their pages, nothing else differs.
"""
from __future__ import annotations

import json
import re
import sys
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path
from typing import Dict, List

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "elections"
OUT = ROOT / "data" / "build" / "elections.json"
CONTENT = ROOT / "data" / "build" / "content.json"
UA = "BoroughLedger-ETL/0.1 (independent research; https://github.com/xternal/borough-ledger)"

API = "https://candidates.democracyclub.org.uk/api/next/ballots/"
# TODO(config): the council's election moves to its config with M8 (second borough).
ELECTION = "local.hammersmith-and-fulham.2026-05-07"
COUNCIL_RESULTS = "https://www.lbhf.gov.uk/"
# Electoral Commission register numbers of the parties with pages on the site (content/parties.yaml).
PARTIES = {"PP53": "labour", "PP52": "conservative"}
SPOT_CHECKS = [
    {"ward_id": "addison", "on": "2026-10-08", "result": "every figure matched"},
    {"ward_id": "palace-and-hurlingham", "on": "2026-10-08", "result": "every figure matched"},
]


def fetch() -> List[dict]:
    """Every ballot of the election, following the API's pages; a snapshot is kept in data/raw/elections/."""
    ballots: List[dict] = []
    url = f"{API}?{urllib.parse.urlencode({'election_id': ELECTION, 'page_size': 50})}"
    while url:
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=60) as r:
            page = json.loads(r.read())
        ballots += page["results"]
        url = page.get("next")
    RAW.mkdir(parents=True, exist_ok=True)
    (RAW / "ballots.json").write_text(json.dumps(ballots, ensure_ascii=False, indent=1))
    return ballots


def surname(name: str) -> str:
    return re.split(r"\s+", name.strip())[-1].lower()


def build(ballots: List[dict], retrieved_on: str) -> dict:
    content = json.loads(CONTENT.read_text())
    wards = {w["ons_code"]: w for w in content["wards"]["wards"]}
    councillors = {c["id"]: c for c in content["councillors"]}
    out: Dict[str, dict] = {}
    for b in sorted(ballots, key=lambda x: x["post"]["label"]):
        if b["cancelled"] or b["by_election_reason"]:
            continue
        gss = b["post"]["id"].removeprefix("gss:")
        if gss not in wards:
            raise SystemExit(f"elections: {b['post']['label']} ({gss}) is not a ward on the site")
        w = wards[gss]
        candidates = []
        for c in b["candidacies"]:
            if c.get("deselected"):
                continue
            row = {"party": c["party_name"], "votes": c["result"]["num_ballots"], "elected": bool(c["elected"])}
            if c["party"]["ec_id"] in PARTIES:
                row["party_id"] = PARTIES[c["party"]["ec_id"]]
            if c["elected"]:
                last = c["sopn_last_name"].lower()
                match = [i for i in w["councillor_ids"] if surname(councillors[i]["name"]) == last]
                if len(match) != 1:
                    raise SystemExit(f"elections: {w['name']}: elected {c['person']['name']} matches {len(match)} of the ward's councillors")
                row["councillor_id"] = match[0]
            candidates.append(row)
        candidates.sort(key=lambda x: (-x["votes"], x["party"]))
        r = b["results"]
        out[w["id"]] = {
            "name": w["name"],
            "seats": b["winner_count"],
            "ballots": r["num_turnout_reported"],
            "turnout_pct": r["turnout_percentage"],
            "rejected": r["num_spoilt_ballots"],
            "result_url": r["source"],
            "dc_url": f"https://candidates.democracyclub.org.uk/elections/{b['ballot_paper_id']}/",
            "candidates": candidates,
        }
    return {
        "note": "Ward results of the borough election, from Democracy Club (CC BY-SA 4.0), which copies each declaration from the council's result page. Built by etl/elections.py. Only elected candidates, who are councillors, are named; the others appear as their party's candidate.",
        "election": {"id": ELECTION, "date": "2026-05-07", "name": "Hammersmith & Fulham Council election"},
        "source": {
            "title": "Democracy Club candidates and results",
            "url": f"{API}?election_id={ELECTION}",
            "licence": "CC BY-SA 4.0",
            "licence_url": "https://creativecommons.org/licenses/by-sa/4.0/",
            "retrieved_on": retrieved_on,
        },
        "quality": "sourced",
        "spot_checks": SPOT_CHECKS,
        "wards": out,
    }


def check(d: dict) -> List[str]:
    content = json.loads(CONTENT.read_text())
    ward_ids = {w["id"] for w in content["wards"]["wards"]}
    councillors = {c["id"]: c for c in content["councillors"]}
    parties = {p["id"] for p in content["parties"]}
    problems = []
    if set(d["wards"]) != ward_ids:
        problems.append(f"wards differ from the site's: {sorted(set(d['wards']) ^ ward_ids)}")
    if sum(w["seats"] for w in d["wards"].values()) != len(councillors):
        problems.append("seats do not add up to the number of councillors")
    for wid, w in d["wards"].items():
        elected = [c for c in w["candidates"] if c["elected"]]
        others = [c for c in w["candidates"] if not c["elected"]]
        if len(elected) != w["seats"]:
            problems.append(f"{wid}: {len(elected)} elected for {w['seats']} seats")
        if elected and others and min(c["votes"] for c in elected) < max(c["votes"] for c in others):
            problems.append(f"{wid}: a candidate with fewer votes was elected")
        if [c["votes"] for c in w["candidates"]] != sorted((c["votes"] for c in w["candidates"]), reverse=True):
            problems.append(f"{wid}: candidates not in vote order")
        for c in w["candidates"]:
            if set(c) - {"party", "party_id", "votes", "elected", "councillor_id"}:
                problems.append(f"{wid}: unexpected field {sorted(set(c) - {'party', 'party_id', 'votes', 'elected', 'councillor_id'})} (no names beyond councillors)")
            if c["elected"] != ("councillor_id" in c):
                problems.append(f"{wid}: only elected candidates link to a councillor, and every one does")
            if "councillor_id" in c and councillors.get(c["councillor_id"], {}).get("ward_id") != wid:
                problems.append(f"{wid}: {c['councillor_id']} is not one of the ward's councillors")
            if "party_id" in c and c["party_id"] not in parties:
                problems.append(f"{wid}: unknown party {c['party_id']}")
            if not isinstance(c["votes"], int) or c["votes"] < 0:
                problems.append(f"{wid}: votes must be a whole number")
        if not w["result_url"].startswith(COUNCIL_RESULTS):
            problems.append(f"{wid}: result link is not the council's")
        if not 0 < w["turnout_pct"] < 100:
            problems.append(f"{wid}: turnout {w['turnout_pct']}%")
    if "·" in json.dumps(d, ensure_ascii=False):
        problems.append("middle dot")
    return problems


def dump(obj: dict) -> str:
    return json.dumps(obj, ensure_ascii=False, indent=1) + "\n"


def main(argv: List[str]) -> None:
    if "--check" in argv:
        d = json.loads(OUT.read_text())
        problems = check(d)
        if problems:
            raise SystemExit("elections: " + "; ".join(problems))
        print(f"elections: {len(d['wards'])} wards, {sum(len(w['candidates']) for w in d['wards'].values())} candidates, well formed.")
        return
    if "--offline" in argv:
        ballots = json.loads((RAW / "ballots.json").read_text())
        retrieved = json.loads(OUT.read_text())["source"]["retrieved_on"] if OUT.exists() else date.today().isoformat()
    else:
        ballots, retrieved = fetch(), date.today().isoformat()
    out = build(ballots, retrieved)
    problems = check(out)
    if problems:
        raise SystemExit("elections: " + "; ".join(problems))
    OUT.write_text(dump(out))
    print(f"elections: {len(out['wards'])} wards written to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main(sys.argv[1:])
