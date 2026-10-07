"""Payments over £500: the council's quarterly spend files, normalised, redacted and mapped to services.

    python3 etl/payments.py --fetch      download files the Wayback Machine holds; record hashes, rows and totals of new files
    python3 etl/payments.py --draft-map  draft every line of data/manual/payments_service_map.csv not marked reviewed=yes
    python3 etl/payments.py              build data/build/payments/
    python3 etl/payments.py --check      what CI runs: rebuild and compare when every file is present, otherwise
                                         reconcile the committed build to the rows and totals recorded per file

Privacy (docs/PRIVACY.md, CLAUDE.md invariant 6): rows the council redacted, and rows whose payee looks like a private
individual, never reach data/build/. They are added up per month, service group and reason, and only the totals are kept.
Supplier pages are only for companies, charities and public bodies.

Every amount is the council's own figure from a file whose SHA-256 is recorded in etl/payments_sources.json. Each file's
row count and total are recorded once (`--fetch`), and every build must add back up to them exactly. Older files also
end with the council's own total row, which must match the sum of their rows.
"""
from __future__ import annotations

import csv
import hashlib
import json
import re
import sys
import time
import urllib.request
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

sys.path.insert(0, str(Path(__file__).resolve().parent))

from xlsx import excel_date, read_xlsx  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
MANUAL = ROOT / "data" / "manual"
OUT = ROOT / "data" / "build" / "payments"
REGISTRY = ROOT / "etl" / "payments_sources.json"
SERVICE_MAP = MANUAL / "payments_service_map.csv"
UA = "BoroughLedger-ETL/0.1 (independent research; https://github.com/xternal/borough-ledger)"


class CheckFailed(Exception):
    pass


# ------------------------------------------------------------------ reading the files

# Header text (lower case, spaces collapsed) -> field. Both layouts the council has used since 2015.
HEADERS = {
    "supplier name": "supplier",
    "beneficiary_name": "supplier",
    "beneficiary": "supplier",
    "payment date": "date",
    "payment_date": "date",
    "amount £ (ex vat)": "amount",
    "net_amount": "amount",
    "net amount": "amount",
    "service area/capital project description": "area",
    "service": "area",
    "directorate": "directorate",
    "gl account description": "type",
    "purpose_of_spend": "type",
    "purpose of spend": "type",
    "reference": "reference",
    "transaction_number": "reference",
    "transaction number": "reference",
}
REQUIRED = ("supplier", "date", "amount", "area", "type")


@dataclass
class Row:
    file_id: str
    row: int  # 1-based row number in the sheet, as Excel shows it
    date: str
    supplier: str
    amount: float
    area: str
    directorate: str
    type: str
    reference: str


def _norm_header(c: Any) -> str:
    return re.sub(r"\s+", " ", str(c or "")).strip().lower()


def read_spend_file(path: Path, file_id: str) -> Tuple[List[Row], Optional[float]]:
    """Every payment row in the file, and the council's own total row if the file has one."""
    book = read_xlsx(str(path))
    sheets = [(n, s) for n, s in book.items() if not n.startswith("_") and n.lower() != "notes"]
    for name, sheet in sheets:
        for hi, header in enumerate(sheet[:20]):
            cols = {HEADERS[h]: i for i, h in enumerate(map(_norm_header, header)) if h in HEADERS}
            if all(f in cols for f in REQUIRED):
                break
        else:
            continue
        rows: List[Row] = []
        own_total: Optional[float] = None
        for i, r in enumerate(sheet[hi + 1:], start=hi + 2):
            get = lambda f: r[cols[f]] if f in cols and cols[f] < len(r) else None  # noqa: E731
            amount, supplier, date = get("amount"), get("supplier"), get("date")
            if amount is None and supplier is None and date is None:
                continue
            if supplier is None and date is None and isinstance(amount, float):
                own_total = amount  # the council's total row at the foot of older files
                continue
            if not isinstance(amount, float) or not isinstance(date, float) or supplier is None:
                raise CheckFailed(f"{path.name} row {i}: cannot read {r!r}")
            rows.append(Row(file_id, i, excel_date(date).isoformat(), str(supplier).strip(), round(amount, 2),
                            str(get("area") or "").strip(), str(get("directorate") or "").strip(), str(get("type") or "").strip(),
                            str(get("reference") or "").strip().removesuffix(".0")))
        return rows, own_total
    raise CheckFailed(f"{path.name}: no sheet has the expected headers ({', '.join(REQUIRED)})")


def file_totals(rows: List[Row]) -> Tuple[int, float]:
    return len(rows), round(sum(r.amount for r in rows), 2)


# ------------------------------------------------------------------ privacy

# The council's own redaction markers, matched as whole phrases ("Redactive Publishing Ltd" is a real company).
REDACTED = re.compile(
    r"^(personal data\s*-?\s*name redacted|individual name redacted|redacted\s*-\s*sensitive supplier/service)$|\b(location|address) redacted$",
    re.I,
)
TITLE = re.compile(r"^(mr|mrs|miss|ms|mx|dr|rev|sir|dame|lady|lord)\b\.?\s+\S", re.I)
# Words that make a payee an organisation rather than a person.
ORG_WORDS = re.compile(
    r"\b(ltd|limited|plc|llp|lp|llc|inc|cic|cio|co|company|corporation|group|holdings|partners|partnership|associates|trust|charity|"
    r"foundation|association|asc|society|council|borough|authority|nhs|hospital|health|healthcare|care|carers|home|homes|house|housing|"
    r"services?|solutions|systems|consult\w*|management|network|centre|center|club|church|pcc|school|schools|academy|college|"
    r"university|institute|federation|agency|bank|insurance|energy|water|power|electrical|motors|transport|travel|hotel|"
    r"residential|properties|property|estates?|developments?|construction|builders|building|engineering|technolog\w*|software|"
    r"digital|media|publishing|printing|design|studio|architects|solicitors|chambers|legal|law|lawyers|accountants|audit|"
    r"recruitment|staffing|training|learning|education|nursery|nurseries|childcare|fostering|therapy|clinic|surgery|practice|"
    r"pharmacy|medical|dental|cleaning|security|catering|foods?|supplies|supply|equipment|products|international|uk|london|"
    r"british|national|royal|police|fire|projects?|works|contractors|maintenance|repairs|tenants|residents|tra|community|youth|"
    r"children|family|families|ventures|enterprises?|industries|global|direct|online|events|entertainment|productions|theatre|"
    r"arts|music|sports?|fc|leisure|lodge|kennels|removals|lettings|hire|cars|support|advice|action|recovery|surveyors|"
    r"investments?|finance|vendors?|organisation|mediation|counselling|wellness|orchestra|strings|cabinets|storage|welfare|"
    r"primary|playcentre|sixth form|sons|fund)\b",
    re.I,
)
# Common forenames in London (ONS baby names and census, across communities), used only to spot "Firstname Surname" payees.
FORENAMES = frozenset(
    """aaron abdul abigail adam adrian ahmed aidan alan albert alex alexander alexandra ali alice alison amanda amelia amy
    andrea andrew angela ann anna anne anthony antonio arthur ashley barbara barry ben benjamin beth bethany bill brian bruce
    callum carl carol caroline catherine charles charlie charlotte chloe chris christina christine christopher claire clare colin
    craig dale daniel danielle darren david dawn dean deborah debra denise dennis derek diana diane dominic donna dorothy douglas
    edward eileen elaine eleanor elizabeth ellie emily emma eric ethan eve evelyn fatima fiona frances francesca frank gary
    gemma geoffrey george georgia gillian gordon grace graham hannah harry hazel heather helen henry hilary holly ian imran isabel
    isabella jack jacqueline jade james jamie jane janet jason jay jean jeffrey jennifer jenny jeremy jessica joan joanna joanne
    john jonathan joseph josh joshua joyce judith julia julie justin karen kate katherine kathleen kathryn katie keith kelly kenneth
    kevin kieran kim kirsty laura lauren lee leon leslie liam lily linda lisa louise lucy luke lynn lynne malcolm marcus margaret
    maria marie marion mark martin mary matthew maureen megan melanie michael michelle mohammed mohammad muhammad molly nathan neil
    nicholas nicola nigel noah oliver olivia owen pamela patricia patrick paul paula pauline peter philip rachel raymond rebecca
    richard robert roger ronald rosemary ross ruth ryan sally samantha samuel sandra sara sarah scott sean shane sharon sheila
    shirley simon sophie stacey stephanie stephen steven stuart susan suzanne teresa thomas timothy tina tom tony tracey tracy
    valerie vanessa victoria vincent wayne william yvonne zoe
    aisha amina anil arjun asha ayesha bilal deepak dev divya gita hamza hassan hussein ibrahim imran jayesh kamal karim kavita
    khalid lakshmi layla leila mariam maryam mehmet mohamed mustafa nadia naveen neha nikhil nisha omar pooja priya rahul rajesh
    ravi reza rohan sadia saira salma sanjay shabana sunil tariq usman vijay yasmin yusuf zainab zara abdi abdullah amir hamid
    mahmoud ifrah sagal hodan chidi chinedu emeka ifeoma kofi kwame olu oluwaseun tunde ade adebayo ngozi fatou aminata
    agnieszka andrzej ewa katarzyna magdalena marek piotr tomasz irina olga natalia ivan dmitri ana carlos jose juan luis sofia
    giulia francesco marco patience blessing precious mercy faith joy gift comfort favour peace hope chipo tendai tatenda farai
    rudo nyasha tafadzwa kudzai chiamaka adaeze nkechi femi funmi bisi kemi yemi tolu seun bola dayo tope ama akosua kojo yaw
    abena efua esi""".split()
)
WORD = re.compile(r"[A-Za-z][A-Za-z'’\-]*\.?$")
# Payments that usually go to individuals: direct payments, foster and guardianship allowances, support for children in need.
# For these, a payee is shown only when it is clearly a company, charity or public body.
TO_INDIVIDUALS = re.compile(
    r"direct payment|foster(?!ing agenc)|guardianship|adoption allowance|kinship|section 17|personal budget|staying put|"
    r"leaving care allowance|support allowance|"
    r"subsistence",
    re.I,
)


def trading_name(name: str) -> str:
    """'Mr A Smith T/A Acorn Lodge' -> 'Acorn Lodge': a sole trader's own name never reaches the build."""
    parts = [x.strip(" -,") for x in re.split(r"\bt/a\b", name, flags=re.I)]
    if len(parts) == 1:
        return name.strip()
    return parts[-1] or parts[0]  # "Acme Ltd T/A" with nothing after: the name before it, still checked for a person


def payee_class(name: str, spend_type: str = "") -> str:
    """'redacted' (the council withheld it), 'person' (looks like a private individual) or 'org'."""
    n = trading_name(name)
    if REDACTED.search(name.strip()):
        return "redacted"
    if TO_INDIVIDUALS.search(spend_type) and supplier_kind(n) == "other":
        return "person"
    if ORG_WORDS.search(n):
        return "org"
    if TITLE.match(n):
        return "person"
    if "," in n:  # "Smith, John"
        surname, _, rest = n.partition(",")
        first = rest.strip().split(" ")[0].lower().rstrip(".") if rest.strip() else ""
        if first in FORENAMES or re.fullmatch(r"[a-z]", first):
            return "person"
    tokens = n.split()
    if 2 <= len(tokens) <= 4 and all(WORD.match(t) for t in tokens):
        first, last = tokens[0].lower().rstrip("."), tokens[-1].lower().rstrip(".")
        if first in FORENAMES or re.fullmatch(r"[a-z]", first) or re.fullmatch(r"[a-z]", last):  # "John Smith", "J Smith", "Smith J"
            return "person"
    return "org"


# ------------------------------------------------------------------ suppliers

PUBLIC = re.compile(
    r"\b(council|borough|london borough|royal borough|city of westminster|corporation of london|nhs|hmrc|hm revenue|hm courts|"
    r"metropolitan police|police|fire brigade|greater london authority|transport for london|tfl|ministry|department for|"
    r"home office|cabinet office|ukvi|dvla|land registry|environment agency|ofsted|valuation office|coroner|tribunal|court|"
    r"university|integrated care board|clinical commissioning|primary school|secondary school|high school|hmp|hm prison|"
    r"pensions? fund|local government association|london councils|mbc|cc)\b",
    re.I,
)
COMPANY = re.compile(r"\b(ltd|limited|plc|llp|cic|lp|llc|inc|gmbh|sa|bv)\b\.?", re.I)
CHARITY = re.compile(r"\b(charity|charitable|foundation|trust|association|society|cio|mencap|age uk|age concern|citizens advice|barnardo|nspcc|pcc)\b", re.I)


def normalise_name(name: str) -> str:
    s = name.lower().replace("&", " and ").replace("’", "'")
    s = re.sub(r"\blimited\b", "ltd", s)
    s = re.sub(r"\bpublic limited company\b", "plc", s)
    s = re.sub(r"[^a-z0-9]+", " ", s).strip()
    s = re.sub(r"^the ", "", s)
    return s


def supplier_id(name: str) -> str:
    return normalise_name(name).replace(" ", "-")[:80].strip("-")


def supplier_kind(name: str) -> str:
    """company, public_body or charity from the name alone; 'other' gets no supplier page (docs/PRIVACY.md)."""
    if PUBLIC.search(name):
        return "public_body"
    if COMPANY.search(name):
        return "company"
    if CHARITY.search(name):
        return "charity"
    return "other"


# ------------------------------------------------------------------ service groups

def load_groups() -> List[Dict[str, Any]]:
    groups = []
    for path, in_budget in ((MANUAL / "service_groups.csv", True), (MANUAL / "payment_groups.csv", False)):
        with open(path, newline="") as f:
            for g in csv.DictReader(f):
                if g["id"] == "housing_benefit":
                    continue
                groups.append({"id": g["id"], "label": g["label"], "desc": g["desc"], "in_budget": in_budget, "order": int(g["order"])})
    return sorted(groups, key=lambda g: g["order"])


def map_key(layout: str, area: str, directorate: str) -> Tuple[str, str, str]:
    return (layout, area, directorate if layout == "2015" else "")


def load_service_map() -> Dict[Tuple[str, str, str], Dict[str, str]]:
    if not SERVICE_MAP.exists():
        return {}
    with open(SERVICE_MAP, newline="") as f:
        return {(r["layout"], r["service_area"], r["directorate"]): r for r in csv.DictReader(f)}


# First match wins. Drafts only: every line is read by a person before launch (data/manual/README.md).
DRAFT_RULES: List[Tuple[str, str]] = [
    (r"^capital\b|\bcapital -|capital programme", "capital"),
    (r"budget planning|property services|asset management|asset strategy|human resources|people management|people & talent|"
     r"managed services|pension fund|governance|scrutiny|committee services|change delivery|change management|insight & analytics|"
     r"project management office|information management|chief information officer|chief executive|delivery and value|"
     r"commercial services|contract governance|health and safety team|\bfraud\b|civic services|advertising hoardings|"
     r"it project management|members support|complaints and resolutions|business systems support|senior management budgets|"
     r"departmental admin|strategic relationship management|director of resources|lead officer hub|to be closed or reallocated",
     "running"),
    (r"rent income|chief housing officer|resident and building safety|strategic head of neighbourhoods|home ownership",
     "council_homes"),
    (r"hospital teams|ccg funding|social care directorate|social care commissioning|health partnerships|meal services|"
     r"asc and nhs", "adult_care"),
    (r"\bmash\b|contact and assessment|emergency duty team|partners in practice", "children"),
    (r"wormwood scrubs", "parks_culture"),
    (r"housing standards", "housing"),
    (r"development management", "planning"),
    (r"\(hra\)|\bhra\b|voids|repairs|\bdlo\b|mechanical and engineering|fire & asbestos|fire safety works|estate services|major works|"
     r"homebuy|communal utility|neighbourhood services|leasehold|tenancy|resident involvement|caretak|director of housing services|"
     r"housing management(?! \(gf\))|^operations \| director of housing", "council_homes"),
    (r"public health|sexual health|substance misuse|drug|alcohol|health visit|smoking|healthy", "public_health"),
    (r"\(gf\)|allocation|lettings|homeless|temporary accommodation|housing options|supported housing|private sector housing|"
     r"housing solutions|rough sleep|housing development", "housing"),
    (r"send\b|special educational|school|education|early years|nursery|inclusion|high needs|academ", "schools"),
    (r"disabled children|children|looked after|leaving care|fostering|adoption|family support|child protection|youth|early help|"
     r"family services|safeguarding, review|quality, standards and safeguarding|family", "children"),
    (r"care and assessment|learning disab|mental health|ageing well|living well|provided services \(social care\)|adult social|"
     r"physical support|older people|reablement|home care|direct payments|carers|integrated care|supporting people", "adult_care"),
    (r"community safety|law enforcement|cctv|env(ironmental)? health|regulatory|licensing|trading standards|coroner|mortuar|"
     r"cemeter|emergency planning|safer neighbourhoods|noise|pest", "safety_regulation"),
    (r"highways|transport|parking|street|waste|recycling|cleansing|traffic|\broads?\b|lighting|fleet", "streets"),
    (r"parks|leisure|librar|cultural|culture|sport|\barts\b|archives|open spaces", "parks_culture"),
    (r"planning|building control|economic development|regeneration|business dev|adult learning|skills|employment|climate", "planning"),
    (r"levies|levy", "debt_levies"),
    (r"ict|digital|finance|accountancy|audit|legal|communications|\bhr\b|people operations|procurement|electoral|democratic|"
     r"corporate|civic campus|facilities|revenues|benefits|customer|contact centre|property|asset|insurance|pensions|treasury|"
     r"payroll|contract monitoring|service improvement|business intelligence|policy|strategy|programme|transformation|registrar",
     "running"),
]


def draft_group(area: str, directorate: str) -> Tuple[str, str]:
    text = f"{area} | {directorate}".lower()
    for pattern, group in DRAFT_RULES:
        m = re.search(pattern, text)
        if m:
            return group, m.group(0).strip()
    return "unclassified", ""


# ------------------------------------------------------------------ registry and fetching

def load_registry() -> Dict[str, Any]:
    return json.loads(REGISTRY.read_text())


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def fetch() -> int:
    """Download what the Wayback Machine holds; record hash, rows and total of every file present and not yet recorded."""
    reg = load_registry()
    changed = False
    for s in reg["files"]:
        path = RAW / s["file"]
        if not path.exists() and s["archive_url"]:
            url = s["archive_url"].replace("/https://", "id_/https://", 1)  # the file as captured, without the Wayback banner
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            path.parent.mkdir(parents=True, exist_ok=True)
            with urllib.request.urlopen(req, timeout=180) as r:
                path.write_bytes(r.read())
            print(f"fetched   {s['file']}")
            time.sleep(2)
        if not path.exists():
            print(f"manual    {s['file']}: download by hand from {s['url']} (listed on {reg['page']})")
            continue
        got = sha256(path)
        if s.get("sha256") and got != s["sha256"]:
            print(f"MISMATCH  {s['file']}: expected {s['sha256']}, got {got}. The file changed; review it before updating the registry.")
            return 1
        if not s.get("sha256") or "rows" not in s:
            rows, own = read_spend_file(path, s["id"])
            n, total = file_totals(rows)
            s.update({"sha256": got, "rows": n, "total": total, "own_total": own})
            changed = True
            print(f"recorded  {s['file']}: {n} rows, £{total:,.2f}" + (f", council's own total £{own:,.2f}" if own is not None else ""))
        else:
            print(f"ok        {s['file']}")
    if changed:
        REGISTRY.write_text(json.dumps(reg, indent=1, ensure_ascii=False) + "\n")
    return 0


# ------------------------------------------------------------------ build

def present_files(reg: Dict[str, Any]) -> List[Dict[str, Any]]:
    return [s for s in reg["files"] if s.get("sha256") and (RAW / s["file"]).exists()]


def build(reg: Dict[str, Any]) -> Dict[str, bytes]:
    groups = load_groups()
    group_ids = {g["id"] for g in groups}
    smap = load_service_map()
    sources = [s for s in reg["files"] if s.get("rows") is not None]
    problems: List[str] = []

    rows: List[Row] = []
    layout_of: Dict[str, str] = {}
    for s in sources:
        path = RAW / s["file"]
        if sha256(path) != s["sha256"]:
            raise CheckFailed(f"{s['file']}: SHA-256 does not match the registry")
        file_rows, own = read_spend_file(path, s["id"])
        n, total = file_totals(file_rows)
        if (n, total) != (s["rows"], s["total"]):
            problems.append(f"{s['id']}: read {n} rows, £{total:,.2f}; registry says {s['rows']} rows, £{s['total']:,.2f}")
        if own is not None and abs(own - total) > 0.005:
            problems.append(f"{s['id']}: rows add up to £{total:,.2f} but the council's total row says £{own:,.2f}")
        layout_of[s["id"]] = s["layout"]
        rows.extend(file_rows)

    # Service groups from the reviewed mapping table.
    def group_of(r: Row) -> str:
        line = smap.get(map_key(layout_of[r.file_id], r.area, r.directorate))
        if not line:
            problems.append(f"no service mapping for {map_key(layout_of[r.file_id], r.area, r.directorate)}; run --draft-map")
            return "unclassified"
        if line["group"] not in group_ids:
            problems.append(f"payments_service_map.csv: unknown group {line['group']}")
        return line["group"]

    published: Dict[str, List[Tuple[Row, str, str]]] = defaultdict(list)  # month -> (row, supplier id, group)
    withheld: Dict[Tuple[str, str, str], List[float]] = defaultdict(list)  # (month, group, reason) -> amounts
    names: Dict[str, Counter] = defaultdict(Counter)
    file_of_month: Dict[str, set] = defaultdict(set)
    for r in rows:
        month = r.date[:7]
        file_of_month[month].add(r.file_id)
        g = group_of(r)
        cls = payee_class(r.supplier, r.type)
        if cls != "org":
            withheld[(month, g, cls)].append(r.amount)
            continue
        name = trading_name(r.supplier)
        sid = supplier_id(name)
        names[sid][name] += 1
        published[month].append((r, sid, g))
    if problems:
        raise CheckFailed("\n  ".join(sorted(set(problems))[:40]))

    display = {sid: c.most_common(1)[0][0] for sid, c in names.items()}
    files: Dict[str, bytes] = {}
    source_ids = [s["id"] for s in sources]
    months_index = []
    sup: Dict[str, Dict[str, Any]] = {}
    for month in sorted(set(published) | {k[0] for k in withheld}):
        pub = sorted(published.get(month, []), key=lambda x: (x[0].date, -x[0].amount, x[0].file_id, x[0].row))
        areas = sorted({r.area for r, _, _ in pub})
        types = sorted({r.type for r, _, _ in pub})
        sids = sorted({sid for _, sid, _ in pub})
        a_ix, t_ix, s_ix = ({v: i for i, v in enumerate(x)} for x in (areas, types, sids))
        f_ids = sorted(file_of_month[month])
        f_ix = {v: i for i, v in enumerate(f_ids)}
        wh = [
            {"group": g, "reason": reason, "rows": len(a), "total": round(sum(a), 2)}
            for (m, g, reason), a in sorted(withheld.items()) if m == month
        ]
        files[f"months/{month}.json"] = compact({
            "month": month,
            "files": f_ids,
            "suppliers": sids,
            "areas": areas,
            "types": types,
            "columns": ["date", "supplier", "amount", "group", "area", "type", "reference", "file", "row"],
            "rows": [[r.date, s_ix[sid], r.amount, g, a_ix[r.area], t_ix[r.type], r.reference, f_ix[r.file_id], r.row] for r, sid, g in pub],
            "withheld": wh,
        })
        by_group: Dict[str, float] = defaultdict(float)
        for r, sid, g in pub:
            by_group[g] += r.amount
            e = sup.setdefault(sid, {"total": 0.0, "rows": 0, "months": defaultdict(float), "groups": defaultdict(float), "top": []})
            e["total"] += r.amount
            e["rows"] += 1
            e["months"][month] += r.amount
            e["groups"][g] += r.amount
            e["top"].append([r.date, r.amount, g, r.type])
        for w in wh:
            by_group[w["group"]] += w["total"]
        pub_total = sum(r.amount for r, _, _ in pub)
        wh_total = sum(w["total"] for w in wh)
        months_index.append({
            "month": month,
            "files": f_ids,
            "rows": len(pub) + sum(w["rows"] for w in wh),
            "total": round(pub_total + wh_total, 2),
            "published_rows": len(pub),
            "published_total": round(pub_total, 2),
            "withheld_rows": sum(w["rows"] for w in wh),
            "withheld_total": round(wh_total, 2),
            "by_group": {g: round(v, 2) for g, v in sorted(by_group.items())},
        })

    # Reconcile: every file's rows and total come back exactly, published plus withheld.
    per_file: Dict[str, List[float]] = defaultdict(list)
    for r in rows:
        per_file[r.file_id].append(r.amount)
    for s in sources:
        months = [m for m in months_index if s["id"] in m["files"]]
        if any(len(m["files"]) > 1 for m in months):
            raise CheckFailed(f"{s['id']}: a month draws on more than one file; reconcile per row instead")
        n = sum(m["rows"] for m in months)
        total = round(sum(m["total"] for m in months), 2)
        if n != s["rows"] or abs(total - s["total"]) > 0.005:
            raise CheckFailed(f"{s['id']}: build has {n} rows, £{total:,.2f}; the file has {s['rows']} rows, £{s['total']:,.2f}")

    suppliers = []
    for sid, e in sorted(sup.items(), key=lambda x: -x[1]["total"]):
        name = display[sid]
        kind = supplier_kind(name)
        suppliers.append({
            "id": sid,
            "name": name,
            "kind": kind,
            "page": kind != "other",
            "total": round(e["total"], 2),
            "rows": e["rows"],
            "first": min(e["months"]),
            "last": max(e["months"]),
            "months": {m: round(v, 2) for m, v in sorted(e["months"].items())},
            "groups": {g: round(v, 2) for g, v in sorted(e["groups"].items(), key=lambda x: -x[1])},
            "top": sorted(e["top"], key=lambda x: -abs(x[1]))[:10],
        })
    files["suppliers.json"] = compact({"columns_top": ["date", "amount", "group", "type"], "suppliers": suppliers})

    unreviewed = sum(1 for v in smap.values() if v["reviewed"] != "yes")
    used_keys = {map_key(layout_of[r.file_id], r.area, r.directorate) for r in rows}
    reasons = Counter()
    for (m, g, reason), a in withheld.items():
        reasons[reason] += len(a)
    files["index.json"] = (json.dumps({
        "meta": {
            "generated_by": "etl/payments.py",
            "publisher": reg["publisher"],
            "page": reg["page"],
            "licence": reg["licence"],
            "quality": "sourced",
            "group_quality": "approx" if unreviewed else "sourced",
            "notes": [
                "Amounts exclude VAT.",
                "Credit notes show as negative amounts.",
                "Files from 2023/24 onwards list payments over £500. Older files list every payment, including smaller ones.",
                "Payments the council redacted, and payments to anyone who looks like a private individual, are shown only as totals per month and service.",
            ],
            "mapping": {"lines": len(used_keys), "unreviewed": sum(1 for k in used_keys if smap[k]["reviewed"] != "yes")},
            "withheld_rows_by_reason": dict(sorted(reasons.items())),
        },
        "sources": [
            {k: s.get(k) for k in ("id", "title", "period", "url", "archive_url", "sha256", "rows", "total", "own_total")}
            for s in sources
        ],
        "missing": [{"id": s["id"], "title": s["title"], "url": s["url"]} for s in reg["files"] if s.get("rows") is None],
        "groups": groups,
        "months": months_index,
        "suppliers": {"count": len(suppliers), "with_page": sum(1 for s in suppliers if s["page"])},
    }, indent=1, ensure_ascii=False) + "\n").encode()
    assert source_ids
    return files


def compact(x: Any) -> bytes:
    """One JSON value per line: small, and diffs stay readable when a month is added."""
    return (json.dumps(x, ensure_ascii=False, separators=(",", ":")) + "\n").encode()


def draft_map(reg: Dict[str, Any]) -> int:
    smap = load_service_map()
    stats: Dict[Tuple[str, str, str], List[float]] = defaultdict(list)
    for s in present_files(reg):
        file_rows, _ = read_spend_file(RAW / s["file"], s["id"])
        for r in file_rows:
            stats[map_key(s["layout"], r.area, r.directorate)].append(r.amount)
    added = 0
    for key in stats:
        if key not in smap or smap[key]["reviewed"] != "yes":  # re-draft anything a person has not checked
            group, rule = draft_group(key[1], key[2])
            smap[key] = {"layout": key[0], "service_area": key[1], "directorate": key[2], "group": group, "reviewed": "no",
                         "note": f"draft: matched '{rule}'" if rule else "draft: no rule matched"}
            added += 1
    for key, line in smap.items():
        a = stats.get(key, [])
        line["rows"], line["total"] = str(len(a)), f"{sum(a):.2f}"
    fields = ["layout", "service_area", "directorate", "group", "reviewed", "rows", "total", "note"]
    with open(SERVICE_MAP, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields, lineterminator="\n")
        w.writeheader()
        for key in sorted(smap, key=lambda k: (k[0], -float(smap[k]["total"] or 0), k[1], k[2])):
            w.writerow({k: smap[key].get(k, "") for k in fields})
    print(f"payments_service_map.csv: {added} lines drafted (reviewed=no), {len(smap)} in all")
    return 0


def reconcile_committed(reg: Dict[str, Any]) -> List[str]:
    """Without the raw files (CI): the committed months still add up to every file's recorded rows and total."""
    idx = json.loads((OUT / "index.json").read_text())
    names = {s["id"]: s["name"] for s in json.loads((OUT / "suppliers.json").read_text())["suppliers"]}
    problems = []
    for s in reg["files"]:
        if s.get("rows") is None:
            continue
        months = [m for m in idx["months"] if s["id"] in m["files"]]
        n = sum(m["rows"] for m in months)
        total = round(sum(m["total"] for m in months), 2)
        if n != s["rows"] or abs(total - s["total"]) > 0.005:
            problems.append(f"{s['id']}: committed build has {n} rows, £{total:,.2f}; the file has {s['rows']} rows, £{s['total']:,.2f}")
    for m in idx["months"]:
        data = json.loads((OUT / "months" / f"{m['month']}.json").read_text())
        pub = round(sum(r[2] for r in data["rows"]), 2)
        wh = round(sum(w["total"] for w in data["withheld"]), 2)
        if abs(pub - m["published_total"]) > 0.005 or abs(wh - m["withheld_total"]) > 0.005 or len(data["rows"]) != m["published_rows"]:
            problems.append(f"{m['month']}: month file does not add up to index.json")
        for r in data["rows"]:
            if payee_class(names[data["suppliers"][r[1]]], data["types"][r[5]]) != "org":
                problems.append(f"{m['month']}: a withheld payee reached the build")
    return problems


def main(argv: List[str]) -> int:
    reg = load_registry()
    if "--fetch" in argv:
        return fetch()
    if "--draft-map" in argv:
        return draft_map(reg)
    recorded = [s for s in reg["files"] if s.get("rows") is not None]
    have_all = all((RAW / s["file"]).exists() for s in recorded)
    if "--check" in argv and not have_all:
        problems = reconcile_committed(reg)
        if problems:
            print("CHECK FAILED:\n  " + "\n  ".join(problems))
            return 1
        print(f"payments: raw files not here; the committed build reconciles to all {len(recorded)} recorded files.")
        return 0
    try:
        files = build(reg)
    except CheckFailed as e:
        print(f"CHECK FAILED: {e}")
        return 1
    if "--check" in argv:
        existing = {p.relative_to(OUT).as_posix() for p in OUT.rglob("*.json")} if OUT.exists() else set()
        stale = [k for k, v in files.items() if not (OUT / k).exists() or (OUT / k).read_bytes() != v] + sorted(existing - set(files))
        if stale:
            print(f"data/build/payments is out of date: {', '.join(stale[:10])}. Run python3 etl/payments.py and commit.")
            return 1
        print("data/build/payments is up to date and reconciles to every file.")
        return 0
    if OUT.exists():
        for p in OUT.rglob("*.json"):
            if p.relative_to(OUT).as_posix() not in files:
                p.unlink()
    for k, v in files.items():
        (OUT / k).parent.mkdir(parents=True, exist_ok=True)
        (OUT / k).write_bytes(v)
    idx = json.loads(files["index.json"])
    print(f"wrote data/build/payments: {len(idx['months'])} months, {idx['suppliers']['count']} suppliers "
          f"({idx['suppliers']['with_page']} with a page), withheld rows {idx['meta']['withheld_rows_by_reason']}, "
          f"{sum(len(v) for v in files.values()) / 1e6:.1f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
