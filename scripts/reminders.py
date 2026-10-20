"""Reminders: the jobs only a person can do, or start, opened as GitHub issues on the day they fall due (GitHub emails
the owner about new issues). Run every morning by .github/workflows/reminders.yml.

    python3 scripts/reminders.py                          open every reminder due today (UTC) that is not open already
    python3 scripts/reminders.py --dry-run                print what would open, open nothing
    python3 scripts/reminders.py --dry-run --today 2027-05-13
    python3 scripts/reminders.py --open budget            open one reminder now, whatever the date

A reminder falls due on a fixed date, or on one day of chosen months every year. It stays due for a week
(GRACE_DAYS), so a morning run that GitHub skips or delays still opens it. Its title carries the month or the year, and
a title that already exists, open or closed, is never opened twice.

Elections come from data/config/boroughs.json: a week after a council's `next_election`, once the results are declared
and the council lists its new councillors, one issue asks for them to be fetched and the next date set.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Dict, List, Optional, Tuple

ROOT = Path(__file__).resolve().parent.parent
BOROUGHS = ROOT / "data" / "config" / "boroughs.json"
GRACE_DAYS = 7
ELECTION_WAIT_DAYS = 7


@dataclass(frozen=True)
class Reminder:
    id: str
    title: str  # may use {month} ("Feb 2027"), {year} ("2027") and {fy} ("2027/28"), all from the day it falls due
    body: str
    months: Tuple[int, ...] = ()  # every year, on `day` of these months
    day: int = 1
    on: Optional[date] = None  # or once, on this date
    start: Optional[date] = None  # not before this date

    def falls_due(self, today: date) -> Optional[date]:
        """The latest day on or before today that this reminder falls due, or None."""
        if self.on is not None:
            days = [self.on]
        else:
            days = [date(y, m, self.day) for y in (today.year - 1, today.year) for m in self.months]
        days = [d for d in days if d <= today and (self.start is None or d >= self.start)]
        return max(days) if days else None

    def due(self, today: date) -> Optional[date]:
        d = self.falls_due(today)
        return d if d is not None and (today - d).days < GRACE_DAYS else None

    def render(self, d: date) -> Tuple[str, str]:
        fields = {"month": d.strftime("%b %Y"), "year": str(d.year), "fy": f"{d.year}/{(d.year + 1) % 100:02d}"}
        return self.title.format(**fields), self.body.format(**fields)


REMINDERS: List[Reminder] = [
    Reminder(
        id="spend-file",
        months=(2, 5, 8, 11),
        title="Spend file: add the council's new quarter ({month})",
        body="""The council should now have published last quarter's payments over £500 (within a month of the quarter's end). Its website refuses scripts, so the file is downloaded by hand.

- [ ] Download the new XLSX from the council's procurement and financial data page into data/raw/payments/ with a browser.
- [ ] python3 etl/payments.py --fetch, then --draft-map; check any new service areas (reviewed=yes).
- [ ] python3 etl/payments.py; python3 etl/capital_wards.py --draft and check any new building schemes; python3 etl/capital_wards.py.
- [ ] Look at short payee names without an organisation word (docs/PRIVACY.md) before publishing.
- [ ] Link new suppliers to the companies register: download the latest BasicCompanyDataAsOneFile zip from download.companieshouse.gov.uk into data/raw/companies_house/, record its date and SHA-256 in etl/companies_house.py, then python3 etl/companies_house.py --scan and python3 etl/companies_house.py; decide any new lines of data/manual/companies_house_matches.csv.""",
    ),
    Reminder(
        id="budget",
        months=(3,),
        day=4,
        title="Budget {year}: move the statement on a year",
        body="""Full Council has set the new budget and council tax, in late February or on 1 March (for 2027/28 the council's report proposed 1 March 2027 and its calendar showed 24 February). Steps (docs/BUILD_PLAN.md, M1):

- [ ] Download the Revenue Budget and Council Tax Levels report and the Cabinet pack into data/raw/ (the council's site refuses scripts).
- [ ] Extract the new year's tables into data/manual/ (gap waterfall, next year, savings, toggles) with page numbers, and check each against the report's own totals.
- [ ] Also replace the tables that belong to one year: the capital programme, council homes, the Mayor of London's share, the council tax options and the budget timetable (data/manual/README.md).
- [ ] Run python3 etl/fetch.py and python3 etl/build.py. The government's council tax tables come in late March: a separate reminder opens on 1 April.
- [ ] A person checks each new table once (data/manual/README.md).
- [ ] Check Balance it against what the council actually decided, and say so on the site.""",
    ),
    Reminder(
        id="council-tax-year",
        months=(4,),
        title="Council tax {fy}: the new year's bills for every council",
        body="""Each government has now published the new year's council tax, which feeds the decoder at /council-tax and every council's page.

- [ ] England: the government's "Council Tax levels set by local authorities" for {fy}, Tables 8 to 10 (late March; 25 March last year).
- [ ] Scotland's council tax by band (end of March), Wales's on StatsWales, and Northern Ireland's rate poundages and the Department for Communities' rate circular (etl/scotland.py, etl/wales.py, etl/northern_ireland.py).
- [ ] The Mayor of London's precept decision for {fy} (late February; MD3472 last year) into a new data/manual/gla_ table.
- [ ] Add each file to etl/sources.json with its SHA-256 (python3 etl/fetch.py), then rebuild: python3 etl/decoder.py and python3 etl/boroughs.py.
- [ ] Check /council-tax with a few postcodes and a few council pages, then the share cards.

Claude can do all of this in a session: ask it to "add the {fy} council tax tables".""",
    ),
    Reminder(
        id="budget-returns",
        months=(8,),
        title="Council budgets {fy}: the government returns",
        body="""The governments have now published what each council budgeted for {fy}, which feeds every council's page.

- [ ] England: the government's "Local authority revenue expenditure and financing" for the {fy} budget, the RA and SG data by local authority (mid-June; 11 June last year).
- [ ] Scotland's local government budget workbook (late July; 24 July last year) and Wales's budgets on StatsWales.
- [ ] Add each file to etl/sources.json with its SHA-256 (python3 etl/fetch.py), then python3 etl/boroughs.py, and check a few council pages.

Claude can do this in a session: ask it to "add the {fy} budget returns".""",
    ),
    Reminder(
        id="care-autumn",
        months=(12,),
        title="Care figures {year}: adult care costs and children in care",
        body="""Two yearly releases behind the care sections of every English council's page should now be out:

- [ ] The adult social care finance report (late October; 23 October last year): python3 etl/adult_care.py.
- [ ] Children looked after in England (late November; 20 November last year): python3 etl/children_care.py.
- [ ] Add each file to etl/sources.json with its SHA-256, rebuild, and check a few council pages.

See docs/DATA_SOURCES.md (adult social care costs; children's care).""",
    ),
    Reminder(
        id="care-winter",
        months=(2,),
        title="Care figures {year}: what people who get care say, and children's services spending",
        body="""Two more yearly releases behind the care sections should now be out:

- [ ] The adult social care outcomes framework (late January; 23 January last year): the survey of people who get care, python3 etl/adult_care.py.
- [ ] Spending on children's services (December last year). The Department for Education stopped its Section 251 outturn series, and the new year's figures move to GOV.UK, so etl/children_care.py needs a new reader.

See docs/DATA_SOURCES.md (what people who get care say; children's care).""",
    ),
    Reminder(
        id="pledge-audit",
        months=(1, 4, 7, 10),
        start=date(2027, 1, 1),
        title="Pledge audit: {month}",
        body="""docs/PROMISE_STANDARD.md asks for a quarterly audit of a 10% sample of pledge cards by someone outside the project.

- [ ] Pick the sample at random from content/promises/ (Claude can do this).
- [ ] The auditor checks each card: the quote against its source page, the status and its reason, the sources and the timeline.
- [ ] Record what they found in docs/editor-checks/, and correct any card by pull request (a new version, never an edit to its history).""",
    ),
    Reminder(
        id="council-year",
        months=(6,),
        start=date(2027, 1, 1),
        title="Make your case: the council's deadlines for {fy}",
        body="""The council holds its annual meeting in May and then publishes the new year's calendar of meetings. The "Make your case" panels need its deadlines (docs/MAKE_YOUR_CASE.md, Each year).

- [ ] Replace the take_part table in data/manual/ with the new year's Full Council meetings and question deadlines, and check the petition and deputation rules have not changed.
- [ ] python3 etl/make_your_case.py, and check the panels on the home page.
- [ ] The owner reviews the table once and marks the rows "yes".""",
    ),
    Reminder(
        id="budget-cycle",
        months=(10,),
        day=15,
        start=date(2027, 1, 1),
        title="Budget cycle {year}: next year's timetable and options",
        body="""In October the council's Cabinet considers its revised four-year plan, which sets out next year's budget timetable and its council tax options (12 October 2026 last year).

- [ ] Download the Cabinet report into data/raw/ and extract the timetable and the council tax options into new data/manual/ tables, with page numbers.
- [ ] When the council opens its budget engagement, link its page in the timetable's `engagement` row (docs/MAKE_YOUR_CASE.md, Each year).
- [ ] A person checks each new table once.""",
    ),
    Reminder(
        id="domain",
        months=(9,),
        start=date(2027, 1, 1),
        title="boroughbook.uk renews on 8 October {year}: check it will",
        body="""The domain is registered with Cloudflare until 8 October each year (the whois record on 13 October 2026 gave 8 October 2027). Cloudflare renews it only if auto-renew is on and the card on file still works.

- [ ] In the Cloudflare dashboard, Domain Registration: check auto-renew is on for boroughbook.uk.
- [ ] Check the card on file has not expired.""",
    ),
    Reminder(
        id="node-24",
        on=date(2027, 4, 1),
        title="Node.js 22 stops getting fixes on 30 April 2027: move to Node 24",
        body="""The site runs on Node 22 (.nvmrc), which reaches the end of its life on 30 April 2027. package.json already allows Node 24.

- [ ] Set .nvmrc to 24, and Node.js 24.x in the Vercel project's settings.
- [ ] Update the local path in .claude/launch.json and the scheduled tasks that name node v22.
- [ ] pnpm install, pnpm test and the preview build; then check the pages built on request (/balance and the share images) on the preview before merging.""",
    ),
    Reminder(
        id="legal-2030",
        on=date(2029, 12, 1),
        title="Legal advice before the May 2030 election period",
        body="""The legal check of 7 October 2026 (docs/PRE_SHIP_REVIEW.md, Legal check done) covered B6, the rules on third-party campaigning and naming councillors, and said to take advice again before the May 2030 election period. That period starts in the spring, so book the advice now.

- [ ] Book the advice and share docs/PRE_SHIP_REVIEW.md (B5, B6), docs/PROMISE_STANDARD.md and the site.
- [ ] Record the outcome in docs/PRE_SHIP_REVIEW.md.""",
    ),
]


def elections_due(today: date, boroughs: List[Dict]) -> List[Tuple[str, str]]:
    """One (title, body) per election day at least ELECTION_WAIT_DAYS old, naming the councils that voted."""
    by_day: Dict[date, List[str]] = {}
    for b in boroughs:
        if b.get("next_election"):
            d = date.fromisoformat(b["next_election"])
            if (today - d).days >= ELECTION_WAIT_DAYS:
                by_day.setdefault(d, []).append(b.get("short") or b["slug"])
    out = []
    for d, names in sorted(by_day.items()):
        day = f"{d.day} {d:%B %Y}"
        listed = "\n".join(f"- [ ] {n}" for n in sorted(names))
        out.append((
            f"Elections of {day}: fetch the new councillors and set the next date",
            f"""These councils held elections on {day}, so their pages still name the old councillors and say the next election is in {d:%B %Y}:

{listed}

For each one:
- python3 etl/borough_people.py, once the council lists its new councillors and Democracy Club has the results.
- In data/config/boroughs.json, set `election_id` to the new election and `next_election` to the one after (the council or the Electoral Commission gives the date).
- Check the council's page and its wards, then python3 etl/borough_people.py --check.""",
        ))
    return out


def due_today(today: date) -> List[Tuple[str, str]]:
    out = []
    for r in REMINDERS:
        d = r.due(today)
        if d is not None:
            out.append(r.render(d))
    boroughs = json.loads(BOROUGHS.read_text())["boroughs"]
    return out + elections_due(today, boroughs)


def already_opened(repo: str, title: str) -> bool:
    found = subprocess.run(
        ["gh", "issue", "list", "--repo", repo, "--state", "all", "--search", f'"{title}" in:title', "--limit", "50",
         "--json", "title", "--jq", ".[].title"],
        check=True, capture_output=True, text=True,
    ).stdout.splitlines()
    return title in found


def main(argv: List[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--today", type=date.fromisoformat, default=date.today())
    ap.add_argument("--open", choices=[r.id for r in REMINDERS])
    args = ap.parse_args(argv)
    if args.open:
        r = next(r for r in REMINDERS if r.id == args.open)
        issues = [r.render(r.falls_due(args.today) or args.today)]
    else:
        issues = due_today(args.today)
    repo = os.environ.get("REPO", "xternal/boroughbook.uk")
    for title, body in issues:
        if args.dry_run:
            print(f"Would open: {title}")
        elif already_opened(repo, title):
            print(f"Already opened: {title}")
        else:
            subprocess.run(["gh", "issue", "create", "--repo", repo, "--title", title, "--body", body], check=True)
    if not issues:
        print(f"Nothing due on {args.today}.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
