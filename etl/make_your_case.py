"""Make your case: who decides each thing a resident might want changed, and the council's own ways to take part, from
data/manual/make_your_case.csv and take_part_2026-27.csv into data/build/make_your_case.json.

    python3 etl/make_your_case.py           build
    python3 etl/make_your_case.py --check   fail if out of date

Checks: every topic says what the law requires, what the government decides and what the council chooses, each with a
source we hold; every public question deadline falls at least seven clear working days before its meeting, by noon, as
the council's rules say; petition thresholds rise with what they lead to. Rows are "checked" (by Claude) until the owner
marks them "yes"; until then they are approx.
"""
from __future__ import annotations

import json
import re
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List

sys.path.insert(0, str(Path(__file__).resolve().parent))

from build import read_csv, serialise, source_entry  # noqa: E402
from extract import CheckFailed, check  # noqa: E402
from fetch import ROOT, load_sources  # noqa: E402

OUT = ROOT / "data" / "build" / "make_your_case.json"
TOPICS = ("adult_care", "council_tax", "budget", "streets_waste", "libraries_leisure", "housing")
# The budget line each everyday service is compared on (the service groups in data/manual/service_groups.csv).
SERVICE = {"streets_waste": "streets", "libraries_leisure": "parks_culture", "housing": "housing"}
WHO = ("law", "government", "council")


def registry() -> Dict[str, Dict[str, Any]]:
    """Every source a row may cite: the source register and the laws in data/config/rules.json."""
    reg = {s["id"]: source_entry(s) for s in load_sources()}
    rules = json.loads((ROOT / "data" / "config" / "rules.json").read_text())
    for s in rules["meta"]["sources"]:
        reg.setdefault(s["id"], {"id": s["id"], "title": s["title"], "publisher": s["publisher"], "url": s["url"]})
    return reg


def clear_working_days(after: date, before: date) -> int:
    """Weekdays strictly between two dates (bank holidays are not counted out, so this can only be generous to the rule)."""
    d, n = after + timedelta(days=1), 0
    while d < before:
        n += d.weekday() < 5
        d += timedelta(days=1)
    return n


def quality(r: Dict[str, str], what: str) -> str:
    check(r["reviewed"] in ("no", "checked", "yes"), f"{what}: reviewed must be no, checked or yes")
    return "sourced" if r["reviewed"] == "yes" else "approx"


def build() -> Dict[str, Any]:
    reg = registry()
    used: List[str] = []
    topics: Dict[str, List[Dict[str, Any]]] = {t: [] for t in TOPICS}
    for r in read_csv("make_your_case.csv"):
        what = f"make_your_case {r['topic']} {r['order']}"
        check(r["topic"] in TOPICS, f"{what}: unknown topic")
        check(r["who"] in WHO, f"{what}: who must be one of {WHO}")
        ids = r["source_ids"].split()
        check(ids and all(i in reg for i in ids), f"{what}: unknown source in {r['source_ids']!r}")
        used += ids
        topics[r["topic"]].append({"order": int(r["order"]), "who": r["who"], "text": r["text"], "source_ids": ids, "where": r["where"], "quality": quality(r, what)})
    for t, rows in topics.items():
        check([x["order"] for x in rows] == list(range(1, len(rows) + 1)), f"make_your_case {t}: rows must be numbered 1, 2, 3 in order")
        check(set(WHO) <= {x["who"] for x in rows}, f"make_your_case {t}: say what the law, the government and the council each decide")
        for x in rows:
            x.pop("order")

    questions, petitions, deputation = [], [], None
    for r in read_csv("take_part_2026-27.csv"):
        what = f"take_part {r['id']}"
        check(r["source_id"] in reg and r["url"].startswith("https://"), f"{what}: unknown source or link not https")
        used.append(r["source_id"])
        q = quality(r, what)
        if r["kind"] == "question":
            meeting = date.fromisoformat(r["meeting"])
            deadline = datetime.fromisoformat(r["deadline"])
            check(deadline.hour == 12 and deadline.minute == 0, f"{what}: questions close at 12 noon")
            check(clear_working_days(deadline.date(), meeting) >= 7, f"{what}: the deadline is less than seven clear working days before the meeting")
            questions.append({"meeting": r["meeting"], "deadline": r["deadline"], "label": r["label"], "url": r["url"], "quality": q, "source_id": r["source_id"]})
        elif r["kind"] == "petition":
            petitions.append({"threshold": int(r["threshold"]), "leads_to": r["label"], "url": r["url"], "quality": q, "source_id": r["source_id"]})
        elif r["kind"] == "deputation":
            check(deputation is None, f"{what}: one deputation row")
            deputation = {"people": int(r["threshold"]), "what": r["label"], "url": r["url"], "quality": q, "source_id": r["source_id"]}
        else:
            check(False, f"{what}: kind must be question, petition or deputation")
    check(bool(questions) and bool(petitions) and deputation is not None, "take_part: questions, petitions and a deputation row are all needed")
    check([q["meeting"] for q in questions] == sorted(q["meeting"] for q in questions), "take_part: question meetings out of order")
    check([p["threshold"] for p in petitions] == sorted(p["threshold"] for p in petitions), "take_part: petition thresholds must rise")
    check(all(re.fullmatch(r"\d{4}-\d{2}-\d{2}T12:00", q["deadline"]) for q in questions), "take_part: deadlines are YYYY-MM-DDT12:00")
    compare = priorities()
    used.append("ra_2026-27")
    return {
        "note": "Generated by etl/make_your_case.py from data/manual/make_your_case.csv and take_part_2026-27.csv, and the budget returns in data/build. Do not edit by hand; re-run it.",
        "sources": [reg[i] for i in sorted(set(used))],
        "topics": topics,
        "compare": compare,
        "take_part": {"council": "London Borough of Hammersmith & Fulham", "questions": questions, "petitions": petitions, "deputation": deputation},
    }


def priorities() -> Dict[str, Any]:
    """For each everyday service, the share of the money each London borough on the site pays for itself (after fees and
    charges, and after grants tied to a service) that goes on it, from the 2026/27 budget return: Hammersmith & Fulham's
    statement and every London borough's in data/build/boroughs. A share, not a sum per resident, so councils of
    different sizes compare without population figures."""
    councils = []
    hf = json.loads((ROOT / "data" / "build" / "hf_2026-27.json").read_text())
    councils.append(("Hammersmith and Fulham", hf["meta"]["council_code"], hf["services"]))
    for path in sorted((ROOT / "data" / "build" / "boroughs").glob("*/statement.json")):
        st = json.loads(path.read_text())
        if st["meta"]["council_code"].startswith("E09"):
            councils.append((st["meta"]["council_short"], st["meta"]["council_code"], st["services"]))
    check(len({c for _, c, _ in councils}) == len(councils), "priorities: a London borough appears twice")
    out: Dict[str, Any] = {}
    for topic, sid in SERVICE.items():
        rows = []
        for name, code, services in councils:
            total = sum(x["general_fund_m"] for x in services)
            line = next((x for x in services if x["id"] == sid), None)
            check(line is not None and total > 0, f"priorities: {name} has no {sid} line")
            rows.append({"name": name, "council_code": code, "m": round(line["general_fund_m"], 3), "share": round(line["general_fund_m"] / total, 4)})
        label = next(x["label"] for x in hf["services"] if x["id"] == sid)
        out[topic] = {"service": sid, "label": label, "year": "2026-27", "source_id": "ra_2026-27", "quality": "sourced", "councils": sorted(rows, key=lambda r: r["council_code"])}
    return out


def main(check_only: bool) -> int:
    try:
        data = serialise(build())
    except CheckFailed as e:
        print(f"make your case: {e}")
        return 1
    if check_only:
        if not OUT.exists() or OUT.read_bytes() != data:
            print("make your case: data/build/make_your_case.json is out of date. Run python3 etl/make_your_case.py and commit.")
            return 1
        print("make your case: up to date; every check passed.")
        return 0
    OUT.write_bytes(data)
    out = json.loads(data)
    print(f"make your case: {sum(len(v) for v in out['topics'].values())} rows in {len(out['topics'])} topics; {len(out['take_part']['questions'])} question deadlines, {len(out['take_part']['petitions'])} petition thresholds")
    return 0


if __name__ == "__main__":
    sys.exit(main("--check" in sys.argv))
