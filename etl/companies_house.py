"""Suppliers in the council's spend files matched to the companies register, from Companies House's free bulk file.

    python3 etl/companies_house.py --scan    read the bulk file in data/raw/companies_house/ (about 2.8 GB unzipped,
                                             streamed) and keep the companies whose name could be a supplier's
    python3 etl/companies_house.py           match, look up each registered office's area, write data/build/companies.json
                                             and draft data/manual/companies_house_matches.csv for the matches a person checks
    python3 etl/companies_house.py --check   check data/build/companies.json against the suppliers and the checked table (CI)

The bulk file ("Free Company Data Product", download.companieshouse.gov.uk) lists every live company with its name,
number, status, type, incorporation date, line of business (SIC) and up to ten former names. It needs no account.

A supplier is linked to a company automatically only when the council's name for it, tidied (case, punctuation, "&",
"Limited" and "Ltd", a branch after the suffix such as "Ltd - South"), is exactly the name of one live company, now or
before a change of name. Live company names are unique on the register, so such a match is certain unless the company
was formed after the council last paid that name, which is refused. A match on the name without its suffix ("Kier
Services" for KIER SERVICES LIMITED) is only a candidate: it goes to data/manual/companies_house_matches.csv and is
shown once a person has checked it (reviewed=checked or yes; reject drops it).

Only suppliers with a page (companies, charities and public bodies; docs/PRIVACY.md) are matched. Nothing about
people is read or kept: the bulk file has no directors, and of the registered office only its local authority area is
kept (from postcodes.io), never the address or postcode.
"""
from __future__ import annotations

import csv
import io
import json
import re
import sys
import time
import urllib.request
import zipfile
from datetime import date
from pathlib import Path
from typing import Dict, List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parent))

from payments import normalise_name  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "companies_house"
SNAPSHOT = "2026-10-01"
ZIP = RAW / f"BasicCompanyDataAsOneFile-{SNAPSHOT}.zip"
ZIP_SHA256 = "29d54c17e5bf39862a08d5ebf1ae83abc079c8591c8c6d1bab0a29879accb4ee"
CANDIDATES = RAW / f"candidates-{SNAPSHOT}.json"
POSTCODES = RAW / "postcode_areas.json"
SUPPLIERS = ROOT / "data" / "build" / "payments" / "suppliers.json"
OUT = ROOT / "data" / "build" / "companies.json"
TABLE = ROOT / "data" / "manual" / "companies_house_matches.csv"
UA = "BoroughLedger-ETL/0.1 (independent research; https://github.com/xternal/borough-ledger)"
PAGE = "https://find-and-update.company-information.service.gov.uk/company/"

SUFFIX = r"(?:ltd|plc|llp|cic|lp|llc|cio)"
TAIL = re.compile(rf"^(.*\b{SUFFIX})\b.*$")
END = re.compile(rf"(?:\s+{SUFFIX})+$")

# Plain words for the register's company types and statuses; anything else is shown as the register writes it.
CATEGORY = {
    "Private Limited Company": "Private limited company",
    "Public Limited Company": "Public limited company",
    "PRI/LTD BY GUAR/NSC (Private, limited by guarantee, no share capital)": "Private company limited by guarantee",
    "PRI/LBG/NSC (Private, Limited by guarantee, no share capital, use of 'Limited' exemption)": "Private company limited by guarantee",
    "Limited Liability Partnership": "Limited liability partnership",
    "Community Interest Company": "Community interest company",
    "Charitable Incorporated Organisation": "Charitable incorporated organisation",
    "Scottish Charitable Incorporated Organisation": "Charitable incorporated organisation (Scotland)",
    "Registered Society": "Registered society",
    "Limited Partnership": "Limited partnership",
    "Private Unlimited Company": "Private unlimited company",
    "Royal Charter Company": "Royal charter company",
    "Overseas Entity": "Overseas entity",
    "Other company type": "Other company type",
}
STATUS = {
    "Active": "Active",
    "Active - Proposal to Strike off": "Active, with a proposal to strike it off the register",
    "Liquidation": "In liquidation",
    "In Administration": "In administration",
    "In Administration/Administrative Receiver": "In administration",
    "In Administration/Receiver Manager": "In administration",
    "Voluntary Arrangement": "In a voluntary arrangement with creditors",
    "Live but Receiver Manager on at least one charge": "Active, with a receiver on at least one charge",
    "RECEIVERSHIP": "In receivership",
}


def full_key(name: str, supplier: bool = False) -> str:
    """The name tidied for comparison; for a supplier, anything after its last company suffix goes (a branch or region)."""
    s = normalise_name(name)
    s = re.sub(r"\bcompany\b", "co", s)
    s = re.sub(r"\buk\b", "uk", s)
    if supplier:
        m = TAIL.match(s)
        if m:
            s = m.group(1)
    return s.replace(" ", "")


def core_key(name: str, supplier: bool = False) -> str:
    """The name without its company suffix: a weaker key, for candidates only."""
    s = normalise_name(name)
    s = re.sub(r"\bcompany\b", "co", s)
    if supplier:
        m = TAIL.match(s)
        if m:
            s = m.group(1)
    return END.sub("", s).replace(" ", "")


def suppliers() -> List[dict]:
    return [s for s in json.loads(SUPPLIERS.read_text())["suppliers"] if s["page"] and s["kind"] in ("company", "charity")]


def uk_date(d: str) -> str:
    """dd/mm/yyyy to ISO; empty stays empty."""
    return f"{d[6:10]}-{d[3:5]}-{d[0:2]}" if re.fullmatch(r"\d\d/\d\d/\d{4}", d or "") else ""


def scan() -> None:
    """Stream the bulk file once and keep every company whose name, now or before, could be a supplier's."""
    import hashlib

    h = hashlib.sha256()
    with open(ZIP, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    if h.hexdigest() != ZIP_SHA256:
        raise SystemExit(f"companies house: {ZIP.name} does not match its SHA-256; a new snapshot must be reviewed, then recorded")
    sup = suppliers()
    fulls = {full_key(s["name"], True) for s in sup}
    cores = {core_key(s["name"], True) for s in sup}
    keep: List[dict] = []
    n = 0
    with zipfile.ZipFile(ZIP) as z, z.open(z.namelist()[0]) as raw:
        rows = csv.reader(io.TextIOWrapper(raw, encoding="utf-8", errors="replace", newline=""))
        head = [c.strip() for c in next(rows)]
        col = {k: i for i, k in enumerate(head)}
        prev = [(col[f"PreviousName_{i}.CONDATE"], col[f"PreviousName_{i}.CompanyName"]) for i in range(1, 11)]
        short = 0
        for r in rows:
            if len(r) < len(head):
                short += 1
                continue
            n += 1
            name = r[col["CompanyName"]]
            former = [(r[ni], uk_date(r[di])) for di, ni in prev if r[ni]]
            names = [name] + [x for x, _ in former]
            if not any(full_key(x) in fulls or core_key(x) in cores for x in names):
                continue
            keep.append({
                "number": r[col["CompanyNumber"]].strip(),
                "name": name,
                "former": [{"name": x, "until": d} for x, d in former],
                "category": r[col["CompanyCategory"]],
                "status": r[col["CompanyStatus"]],
                "incorporated": uk_date(r[col["IncorporationDate"]]),
                "sic": [r[col[f"SICCode.SicText_{i}"]] for i in range(1, 5) if r[col[f"SICCode.SicText_{i}"]]],
                "postcode": r[col["RegAddress.PostCode"]].strip().upper(),
            })
    CANDIDATES.write_text(json.dumps({"snapshot": SNAPSHOT, "rows": n, "short_rows": short, "companies": keep}, ensure_ascii=False))
    print(f"companies house: read {n:,} companies ({short} short rows skipped), kept {len(keep):,} whose names could be a supplier's")


def areas(postcodes: List[str]) -> Dict[str, Optional[str]]:
    """Local authority area of each registered office postcode, from postcodes.io (cached). Postcodes are not kept in the build."""
    cache: Dict[str, Optional[str]] = json.loads(POSTCODES.read_text()) if POSTCODES.exists() else {}
    todo = sorted({p for p in postcodes if p and p not in cache})
    for i in range(0, len(todo), 100):
        body = json.dumps({"postcodes": todo[i : i + 100]}).encode()
        req = urllib.request.Request("https://api.postcodes.io/postcodes", data=body, headers={"Content-Type": "application/json", "User-Agent": UA})
        with urllib.request.urlopen(req, timeout=60) as r:
            for x in json.loads(r.read())["result"]:
                cache[x["query"]] = (x["result"] or {}).get("admin_district")
        time.sleep(0.2)
    POSTCODES.write_text(json.dumps(cache, indent=0, sort_keys=True))
    return cache


def read_table() -> Dict[str, dict]:
    if not TABLE.exists():
        return {}
    with open(TABLE, newline="") as f:
        return {r["supplier_id"]: r for r in csv.DictReader(f)}


def write_table(rows: List[dict]) -> None:
    cols = ["supplier_id", "supplier_name", "paid", "company_number", "company_name", "why", "reviewed", "note"]
    with open(TABLE, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, lineterminator="\n")
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in cols})


def match() -> dict:
    data = json.loads(CANDIDATES.read_text())
    by_full: Dict[str, List[dict]] = {}
    by_former: Dict[str, List[dict]] = {}
    by_core: Dict[str, List[dict]] = {}
    for c in data["companies"]:
        by_full.setdefault(full_key(c["name"]), []).append(c)
        by_core.setdefault(core_key(c["name"]), []).append(c)
        for f in c["former"]:
            by_former.setdefault(full_key(f["name"]), []).append(c)
    table = read_table()
    drafts: List[dict] = []
    matched: Dict[str, dict] = {}
    refused: List[str] = []
    for s in suppliers():
        fk, ck = full_key(s["name"], True), core_key(s["name"], True)
        last_paid = s["last"]
        hit, how, former = None, "", None
        if len(by_full.get(fk, [])) == 1:
            hit, how = by_full[fk][0], "name"
        elif fk not in by_full and len({c["number"] for c in by_former.get(fk, [])}) == 1:
            c = by_former[fk][0]
            f = next(f for f in c["former"] if full_key(f["name"]) == fk)
            # It must still have borne that name when the council started paying it; otherwise another company may have.
            if f["until"] and f["until"][:7] >= s["first"]:
                hit, how, former = c, "former_name", f
            else:
                refused.append(f"{s['name']} -> {c['number']} (renamed {f['until']}, before the first payment {s['first']})")
        if hit and hit["incorporated"] and hit["incorporated"][:7] > last_paid:
            refused.append(f"{s['name']} -> {hit['number']} (formed {hit['incorporated']}, last paid {last_paid})")
            hit = None
        if hit and hit["incorporated"] and hit["incorporated"][:7] > s["first"]:
            # Formed after the council first paid this name: earlier payments may have gone to another company. A person decides.
            after = sum(v for mo, v in s["months"].items() if mo >= hit["incorporated"][:7])
            prior = table.get(s["id"], {})
            same = prior.get("company_number") == hit["number"]
            drafts.append({
                "supplier_id": s["id"], "supplier_name": s["name"], "paid": f"{s['total']:.0f}",
                "company_number": hit["number"], "company_name": hit["name"],
                "why": f"same name, but formed {hit['incorporated']}, after the first payment ({s['first']}); {after / s['total']:.0%} of the money was paid after" if s["total"] else f"same name, but formed {hit['incorporated']}, after the first payment",
                "reviewed": prior.get("reviewed", "no") if same else "no", "note": prior.get("note", "") if same else "",
            })
            hit = (hit if same and prior.get("reviewed") in ("checked", "yes") else None)
            how = "checked" if hit else ""
        if not hit and not any(d["supplier_id"] == s["id"] for d in drafts):
            cands = [c for c in by_core.get(ck, []) if not (c["incorporated"] and c["incorporated"][:7] > last_paid)]
            if len(cands) == 1 and ck:
                c = cands[0]
                prior = table.get(s["id"], {})
                same = prior.get("company_number") == c["number"]
                drafts.append({
                    "supplier_id": s["id"], "supplier_name": s["name"], "paid": f"{s['total']:.0f}",
                    "company_number": c["number"], "company_name": c["name"],
                    "why": "same name without its suffix" + (f", but formed {c['incorporated']}, after the first payment ({s['first']})" if c["incorporated"] and c["incorporated"][:7] > s["first"] else ""),
                    "reviewed": prior.get("reviewed", "no") if same else "no", "note": prior.get("note", "") if same else "",
                })
                if same and prior.get("reviewed") in ("checked", "yes"):
                    hit, how = c, "checked"
        if hit:
            matched[s["id"]] = {"c": hit, "how": how, "former": former}
    drafts.sort(key=lambda r: -float(r["paid"]))
    write_table(drafts)
    area = areas([m["c"]["postcode"] for m in matched.values()])
    sup_first = {s["id"]: s["first"] for s in suppliers()}
    companies = {}
    for sid, m in sorted(matched.items()):
        c = m["c"]
        companies[sid] = {
            "number": c["number"],
            "name": c["name"],
            "status": STATUS.get(c["status"], c["status"]),
            "type": CATEGORY.get(c["category"], c["category"]),
            "incorporated": c["incorporated"],
            "business": [re.sub(r"^\d+\s*-\s*", "", x) for x in c["sic"]],
            "office_area": area.get(c["postcode"]),
            "matched_on": m["how"],
            **({"formed_during_payments": True} if c["incorporated"] and c["incorporated"][:7] > sup_first[sid] else {}),
            **({"former_name": m["former"]["name"]} if m["former"] else {}),
        }
    reviewed = [r for r in drafts if r["reviewed"] in ("checked", "yes", "reject")]
    return {
        "note": "Suppliers in the council's spend files matched to the companies register (etl/companies_house.py). Register facts only: no addresses, no people.",
        "source": {
            "title": "Companies House, Free Company Data Product (basic company data, live companies)",
            "url": "https://download.companieshouse.gov.uk/en_output.html",
            "file": ZIP.name,
            "sha256": ZIP_SHA256,
            "snapshot": SNAPSHOT,
            "terms": "Provided free by Companies House; it states no restrictions on use",
        },
        "areas_from": "postcodes.io (ONS postcode directory), from each registered office's postcode; the postcode is not kept",
        "counts": {
            "suppliers": len(suppliers()),
            "matched": len(companies),
            "by_name": sum(1 for x in companies.values() if x["matched_on"] == "name"),
            "by_former_name": sum(1 for x in companies.values() if x["matched_on"] == "former_name"),
            "by_check": sum(1 for x in companies.values() if x["matched_on"] == "checked"),
            "candidates": len(drafts),
            "candidates_reviewed": len(reviewed),
            "refused": len(refused),
            "formed_during_payments": sum(1 for x in companies.values() if x.get("formed_during_payments")),
        },
        "companies": companies,
    }


FIELDS = {"number", "name", "status", "type", "incorporated", "business", "office_area", "matched_on", "former_name", "formed_during_payments"}


def check(d: dict) -> List[str]:
    sup = {s["id"]: s for s in suppliers()}
    table = read_table()
    problems = []
    for sid, c in d["companies"].items():
        if sid not in sup:
            problems.append(f"{sid}: not a supplier with a page")
        if set(c) - FIELDS:
            problems.append(f"{sid}: unexpected fields {sorted(set(c) - FIELDS)} (no addresses, no people)")
        if not re.fullmatch(r"[A-Z0-9]{8}", c["number"]):
            problems.append(f"{sid}: company number {c['number']!r}")
        if c["incorporated"] and sid in sup and c["incorporated"][:7] > sup[sid]["last"]:
            problems.append(f"{sid}: company formed after the council last paid it")
        if c["matched_on"] == "checked" and table.get(sid, {}).get("reviewed") not in ("checked", "yes"):
            problems.append(f"{sid}: shown as checked, but not checked in {TABLE.name}")
        if c["matched_on"] == "checked" and table.get(sid, {}).get("company_number") != c["number"]:
            problems.append(f"{sid}: checked company differs from {TABLE.name}")
    for sid, r in table.items():
        if r["reviewed"] not in ("no", "checked", "yes", "reject"):
            problems.append(f"{TABLE.name} {sid}: reviewed must be no, checked, yes or reject")
    if "·" in json.dumps(d, ensure_ascii=False):
        problems.append("middle dot")
    return problems


def dump(obj: dict) -> str:
    return json.dumps(obj, ensure_ascii=False, indent=1) + "\n"


def main(argv: List[str]) -> None:
    if "--scan" in argv:
        scan()
        return
    if "--check" in argv:
        d = json.loads(OUT.read_text())
        problems = check(d)
        if problems:
            raise SystemExit("companies house: " + "; ".join(problems[:20]))
        print(f"companies house: {d['counts']['matched']} suppliers matched to the register, well formed.")
        return
    out = match()
    problems = check(out)
    if problems:
        raise SystemExit("companies house: " + "; ".join(problems[:20]))
    OUT.write_text(dump(out))
    c = out["counts"]
    print(f"companies house: {c['matched']} of {c['suppliers']} suppliers matched ({c['by_name']} by name, {c['by_former_name']} by a former name, "
          f"{c['by_check']} checked by hand); {c['candidates']} candidates in {TABLE.relative_to(ROOT)} ({c['candidates_reviewed']} reviewed); "
          f"{c['refused']} refused (formed after the last payment, or renamed before the first); {c['formed_during_payments']} formed during the payments")


if __name__ == "__main__":
    main(sys.argv[1:])
