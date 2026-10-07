"""Import councillors and wards into content/ from the council's ModernGov web service.

    python3 etl/councillors.py            fetch, snapshot to data/raw/, write content/councillors/*.yaml and content/wards.yaml
    python3 etl/councillors.py --offline  rebuild content/ from the latest snapshots in data/raw/

Only what councillors publish in their public role is kept: name, party, ward, key posts and the link to their
council profile. No photos (council copyright, and they would make the site look official), no addresses,
phone numbers or emails (CLAUDE.md invariant 6).

Ward codes (ONS GSS) come from Democracy Club's open data on the May 2026 election.
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date
from pathlib import Path
from typing import Any, Dict, List

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
CONTENT = ROOT / "content"
UA = "BoroughLedger-ETL/0.1 (independent research; https://github.com/xternal/borough-ledger)"

MODERNGOV = "https://democracy.lbhf.gov.uk/mgWebService.asmx/GetCouncillorsByWard"
PROFILE = "https://democracy.lbhf.gov.uk/mgUserInfo.aspx?UID={id}"
DC_BALLOTS = "https://candidates.democracyclub.org.uk/api/next/ballots/?election_id=local.hammersmith-and-fulham.2026-05-07&page_size=50"
PARTY_ID = {"Labour": "labour", "Conservative": "conservative", "Liberal Democrats": "liberal-democrats", "Green Party": "green", "Independent": "independent"}


def slug(s: str) -> str:
    s = s.lower().replace("&", "and").replace("'", "").replace("’", "")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def ward_key(name: str) -> str:
    """'College Park and Old Oak' and 'College Park & Old Oak' are the same ward."""
    return slug(name)


def fetch(url: str, path: Path) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
    path.write_bytes(data)
    return data


def latest(pattern: str) -> Path:
    files = sorted(RAW.glob(pattern))
    if not files:
        raise SystemExit(f"no snapshot matching data/raw/{pattern}; run without --offline first")
    return files[-1]


# ------------------------------------------------------------------ minimal YAML writer (strings JSON-quoted, which is valid YAML)

def yaml_dump(obj: Any, indent: int = 0) -> str:
    pad = " " * indent
    if isinstance(obj, dict):
        lines = []
        for k, v in obj.items():
            if isinstance(v, (dict, list)) and v:
                lines.append(f"{pad}{k}:")
                lines.append(yaml_dump(v, indent + 2))
            else:
                lines.append(f"{pad}{k}: {scalar(v)}")
        return "\n".join(lines)
    if isinstance(obj, list):
        lines = []
        for v in obj:
            if isinstance(v, dict) and v:
                inner = yaml_dump(v, indent + 2).split("\n")
                lines.append(f"{pad}- {inner[0].lstrip()}")
                lines.extend(inner[1:])
            else:
                lines.append(f"{pad}- {scalar(v)}")
        return "\n".join(lines)
    return pad + scalar(obj)


def scalar(v: Any) -> str:
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return json.dumps(v)
    if isinstance(v, (list, dict)):
        return "[]" if isinstance(v, list) else "{}"
    return json.dumps(str(v), ensure_ascii=False)


# ------------------------------------------------------------------ import

def main(offline: bool) -> int:
    RAW.mkdir(parents=True, exist_ok=True)
    today = date.today().isoformat()
    if offline:
        mg_path, dc_path = latest("moderngov_councillors_*.xml"), latest("democracyclub_ballots_*.json")
        mg, dc = mg_path.read_bytes(), dc_path.read_bytes()
        retrieved = mg_path.stem.rsplit("_", 1)[-1]
    else:
        mg_path, dc_path = RAW / f"moderngov_councillors_{today}.xml", RAW / f"democracyclub_ballots_{today}.json"
        mg, dc = fetch(MODERNGOV, mg_path), fetch(DC_BALLOTS, dc_path)
        retrieved = today

    gss = {ward_key(b["post"]["label"]): b["post"]["id"].replace("gss:", "") for b in json.loads(dc)["results"]}
    seats = {ward_key(b["post"]["label"]): b["winner_count"] for b in json.loads(dc)["results"]}

    root = ET.fromstring(mg)
    councillors: List[Dict[str, Any]] = []
    wards: List[Dict[str, Any]] = []
    for w in root.iter("ward"):
        ward_name = (w.findtext("wardtitle") or "").strip()
        key = ward_key(ward_name)
        if key not in gss:
            raise SystemExit(f"ward {ward_name!r} has no ONS code in the Democracy Club data")
        ids = []
        for c in w.iter("councillor"):
            name = re.sub(r"^Councillor\s+", "", (c.findtext("fullusername") or "").strip())
            party_title = (c.findtext("politicalpartytitle") or "").strip()
            cid = slug(name)
            ids.append(cid)
            post = (c.findtext("keyposts") or "").strip()
            councillors.append({
                "id": cid,
                "name": name,
                "party": PARTY_ID.get(party_title, slug(party_title)),
                "party_name": party_title,
                "ward_id": key,
                "roles": [{"title": post}] if post else [],
                "democracy_url": PROFILE.format(id=(c.findtext("councillorid") or "").strip()),
                "source": {"title": "Hammersmith & Fulham Council, councillors by ward (ModernGov web service)", "url": MODERNGOV, "retrieved_on": retrieved},
            })
        if seats[key] != len(ids):
            raise SystemExit(f"{ward_name}: {len(ids)} councillors listed, {seats[key]} seats elected in May 2026")
        wards.append({"id": key, "ons_code": gss[key], "name": ward_name, "councillor_ids": ids})

    if len({c["id"] for c in councillors}) != len(councillors):
        raise SystemExit("two councillors share a slug; add a disambiguator")

    out = CONTENT / "councillors"
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("*.yaml"):
        old.unlink()
    for c in councillors:
        (out / f"{c['id']}.yaml").write_text(yaml_dump(c) + "\n")
    meta = {
        "note": "Generated by etl/councillors.py. Do not edit by hand; re-run the import.",
        "sources": [
            {"title": "Hammersmith & Fulham Council, councillors by ward (ModernGov web service)", "url": MODERNGOV, "retrieved_on": retrieved,
             "sha256": hashlib.sha256(mg).hexdigest()},
            {"title": "Democracy Club, Hammersmith and Fulham local election 7 May 2026 (ward codes)", "url": DC_BALLOTS, "retrieved_on": retrieved,
             "licence": "CC BY-SA 4.0", "sha256": hashlib.sha256(dc).hexdigest()},
        ],
        "wards": wards,
    }
    (CONTENT / "wards.yaml").write_text(yaml_dump(meta) + "\n")
    parties: Dict[str, int] = {}
    for c in councillors:
        parties[c["party_name"]] = parties.get(c["party_name"], 0) + 1
    print(f"{len(councillors)} councillors in {len(wards)} wards: {parties}")
    return 0


if __name__ == "__main__":
    sys.exit(main("--offline" in sys.argv))
