"""Pledge finder (docs/PLEDGE_FINDER.md): is a scheduled run due, and where does a run start.

    python3 scripts/pledge_finder.py due                  run or skip, for the scheduled task (section 0), and how far
                                                          back the run looks (section 1)
    python3 scripts/pledge_finder.py start --scheduled    switch to a new pledges-<date> branch off origin/main and print
                                                          the pull request's title and the first line of its body
    python3 scripts/pledge_finder.py start --by-hand      the same for a person's "run anyway", outside the schedule
    python3 scripts/pledge_finder.py due --today 2026-10-26     as on another day; start takes --today and --dry-run too

The schedule is keyed on the last *scheduled* run only. Each run's pull request says in its first line which kind of run
opened it (the marker `start` prints). A run by hand still counts for where the next run looks back to, but never moves
the schedule: before this rule, the run by hand of 18 October 2026 (pull request #95) pushed the run due on 26 October
out to 2 November. Runs before the markers count as by hand; the schedule started with the first run, on 14 October
2026 (#89), recorded below as SCHEDULE_STARTED.

Reads pull requests through GitHub's REST API with the gh command line tool (works on the Mac and in a Claude session);
the standard library only, Python 3.9 or later.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Dict, Iterable, List, Optional, Set

REPO = "xternal/boroughbook.uk"
TITLE_PREFIX = "New pledges, "
DUE_AFTER_DAYS = 10  # every other Sunday (Mondays until 19 October 2026): a scheduled run 7 days ago means skip, 14 days ago means run
LOOK_BACK_DAYS = 21  # how far the first run ever looked back
# The first run (#89, by hand, 14 October 2026) started the fortnightly schedule, so 26 October 2026 was the first
# scheduled run. It stands in for the last scheduled run until a scheduled run's pull request is newer.
SCHEDULE_STARTED = datetime(2026, 10, 14, 6, 52, 37, tzinfo=timezone.utc)
SCHEDULED, BY_HAND = "scheduled", "by-hand"
_MARK = re.compile(r"<!--\s*pledge-finder-run:\s*(scheduled|by-hand)\s*-->")


@dataclass(frozen=True)
class PullRequest:
    number: int
    title: str
    body: str
    created_at: datetime

    @staticmethod
    def from_api(p: Dict) -> "PullRequest":
        created = datetime.fromisoformat(p["created_at"].replace("Z", "+00:00"))
        return PullRequest(p["number"], p["title"], p.get("body") or "", created)

    @property
    def is_pledge_run(self) -> bool:
        return self.title.startswith(TITLE_PREFIX)

    @property
    def kind(self) -> str:
        """Scheduled only when its body says so; anything else, including every run before the markers, is by hand."""
        m = _MARK.search(self.body)
        return m.group(1) if m else BY_HAND


@dataclass(frozen=True)
class Decision:
    due: bool
    reason: str
    look_back_from: date
    look_back_reason: str

    def lines(self) -> List[str]:
        return [f"{'run' if self.due else 'skip'} ({self.reason})", f"look back to {self.look_back_from} ({self.look_back_reason})"]


def _ago(now: datetime, t: datetime) -> int:
    return (now - t).days


def decide(prs: Iterable[PullRequest], now: datetime) -> Decision:
    """A scheduled run is due when no scheduled run opened a "New pledges, ..." pull request (open, merged or closed) in
    the last DUE_AFTER_DAYS days. Runs by hand do not count for that, only for where the next run looks back to."""
    runs = sorted((p for p in prs if p.is_pledge_run), key=lambda p: p.created_at, reverse=True)
    scheduled = [p for p in runs if p.kind == SCHEDULED and p.created_at > SCHEDULE_STARTED]
    if scheduled:
        last, what = scheduled[0].created_at, f"last scheduled run #{scheduled[0].number}"
    else:
        last, what = SCHEDULE_STARTED, "the schedule started with #89"
    age = _ago(now, last)
    skipped = [p for p in runs if p.kind == BY_HAND and p.created_at > last]
    by_hand = f"; runs by hand since, which do not move the schedule: {', '.join(f'#{p.number}' for p in skipped)}" if skipped else ""
    reason = f"{what}, opened {last:%Y-%m-%d}, {age} days ago{by_hand}"
    if runs:
        p = runs[0]
        look_back = (p.created_at.date(), f"#{p.number}, {p.kind}")
    else:
        look_back = ((now - timedelta(days=LOOK_BACK_DAYS)).date(), f"no pledge finder pull request yet, so {LOOK_BACK_DAYS} days")
    return Decision(age >= DUE_AFTER_DAYS, reason, look_back[0], look_back[1])


def title_for(day: date) -> str:
    return f"{TITLE_PREFIX}{day.day} {day:%B %Y}"


def branch_for(day: date, taken: Set[str]) -> str:
    """pledges-<date>, or pledges-<date>-2 and so on when a run that day already has the name."""
    base = f"pledges-{day.isoformat()}"
    name, n = base, 1
    while name in taken:
        n += 1
        name = f"{base}-{n}"
    return name


def marker(kind: str, day: date) -> str:
    """The first line of the pull request body: says which kind of run opened it, for people and for `due`."""
    if kind == SCHEDULED:
        text = f"Run: scheduled (the weekly ledger desk, {day:%A} {day.day} {day:%B %Y})."
    else:
        text = 'Run: by hand ("run anyway"), outside the schedule, so the next scheduled run stays where it was.'
    return f"{text} <!-- pledge-finder-run: {kind} -->"


def london_today() -> date:
    try:
        from zoneinfo import ZoneInfo

        return datetime.now(ZoneInfo("Europe/London")).date()
    except Exception:  # noqa: BLE001 - no zone data: the machine's own date
        return date.today()


def fetch_prs(repo: str = REPO, max_pages: int = 20) -> List[PullRequest]:
    """Pull requests newest first, until the newest pledge run and the newest scheduled one (or the schedule's start) are in."""
    out: List[PullRequest] = []
    for page in range(1, max_pages + 1):
        raw = subprocess.run(
            ["gh", "api", f"repos/{repo}/pulls?state=all&sort=created&direction=desc&per_page=100&page={page}"],
            check=True, capture_output=True, text=True,
        ).stdout
        batch = [PullRequest.from_api(p) for p in json.loads(raw)]
        out += batch
        runs = [p for p in out if p.is_pledge_run]
        past_start = bool(batch) and batch[-1].created_at < SCHEDULE_STARTED
        if len(batch) < 100 or (runs and (past_start or any(p.kind == SCHEDULED for p in runs))):
            break
    return out


def _git(*args: str) -> str:
    return subprocess.run(["git", *args], check=True, capture_output=True, text=True).stdout


def start(kind: str, day: date, dry_run: bool) -> List[str]:
    _git("fetch", "origin", "main")
    remote = {line.split("refs/heads/")[-1] for line in _git("ls-remote", "--heads", "origin", "pledges-*").splitlines() if line}
    local = {b.strip(" *+") for b in _git("branch", "--list", "pledges-*").splitlines()}
    branch = branch_for(day, remote | local)
    if not dry_run:
        _git("switch", "-c", branch, "origin/main")
    return [
        f"branch: {branch}" + (" (not created: --dry-run)" if dry_run else ", off origin/main"),
        f"title: {title_for(day)}",
        "first line of the pull request body:",
        marker(kind, day),
    ]


def main(argv: List[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    d = sub.add_parser("due", help="run or skip, for the scheduled task")
    d.add_argument("--today", type=date.fromisoformat)
    s = sub.add_parser("start", help="the branch, title and first line of a run's pull request")
    g = s.add_mutually_exclusive_group(required=True)
    g.add_argument("--scheduled", action="store_const", const=SCHEDULED, dest="kind")
    g.add_argument("--by-hand", action="store_const", const=BY_HAND, dest="kind")
    s.add_argument("--today", type=date.fromisoformat)
    s.add_argument("--dry-run", action="store_true")
    args = ap.parse_args(argv)
    if args.cmd == "due":
        now = datetime.now(timezone.utc) if args.today is None else datetime(args.today.year, args.today.month, args.today.day, 8, tzinfo=timezone.utc)
        print("\n".join(decide(fetch_prs(), now).lines()))
    else:
        print("\n".join(start(args.kind, args.today or london_today(), args.dry_run)))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
