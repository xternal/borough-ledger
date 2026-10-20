"""Pledge finder schedule (scripts/pledge_finder.py): only scheduled runs move the schedule; a run by hand never does.
Run: python3 -m unittest discover -s etl/tests -t ."""
from __future__ import annotations

import sys
import unittest
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import pledge_finder as P  # noqa: E402


def pr(number: int, created: str, title: str = "", body: str = "") -> P.PullRequest:
    t = datetime.fromisoformat(created).replace(tzinfo=timezone.utc)
    return P.PullRequest(number, title or f"New pledges, {t.day} {t:%B %Y}", body, t)


def monday(iso: str) -> datetime:
    return datetime.fromisoformat(f"{iso}T07:00:00").replace(tzinfo=timezone.utc)


# The pull requests as they were on 19 October 2026: the first run (#89, by hand, which started the schedule) and a run
# by hand on 18 October (#95). Neither body has a marker. Other pull requests mention "New pledges" without being runs.
OCTOBER = [
    pr(89, "2026-10-14T06:52:37", body="The first run of the pledge finder (docs/PLEDGE_FINDER.md), done by hand on Wednesday"),
    pr(91, "2026-10-14T08:13:03", title='Pledge finder: a run is due when no "New pledges" PR is under 10 days old'),
    pr(95, "2026-10-18T16:08:13", title="New pledges, 18 October 2026, and parks and green schemes being delivered",
       body="The pledge finder and a status sweep ran on 18 October 2026 in a Claude session"),
]


def scheduled(number: int, created: str) -> P.PullRequest:
    day = date.fromisoformat(created[:10])
    return pr(number, created, body=f"{P.marker(P.SCHEDULED, day)}\n\n1. Places checked ...")


def by_hand(number: int, created: str) -> P.PullRequest:
    return pr(number, created, body=f"{P.marker(P.BY_HAND, date.fromisoformat(created[:10]))}\n\n1. Places checked ...")


class ScheduleTest(unittest.TestCase):
    def test_the_run_by_hand_of_18_october_no_longer_moves_26_october(self) -> None:
        # Before the fix, #95 made 26 October a skip (8 days) and pushed the run to 2 November.
        self.assertFalse(P.decide(OCTOBER, monday("2026-10-19")).due)
        d = P.decide(OCTOBER, monday("2026-10-26"))
        self.assertTrue(d.due, d.reason)
        self.assertIn("#95", d.reason)
        # It still sets where the next run looks back to.
        self.assertEqual(d.look_back_from, date(2026, 10, 18))

    def test_every_other_monday_from_a_scheduled_run(self) -> None:
        prs = OCTOBER + [scheduled(120, "2026-10-26T08:30:00")]
        self.assertFalse(P.decide(prs, monday("2026-11-02")).due)
        self.assertTrue(P.decide(prs, monday("2026-11-09")).due)

    def test_a_run_by_hand_between_scheduled_runs_changes_nothing_but_the_look_back(self) -> None:
        prs = OCTOBER + [scheduled(120, "2026-10-26T08:30:00"), by_hand(125, "2026-11-04T19:00:00")]
        self.assertFalse(P.decide(prs, monday("2026-11-02")).due)
        d = P.decide(prs, monday("2026-11-09"))
        self.assertTrue(d.due, d.reason)
        self.assertEqual(d.look_back_from, date(2026, 11, 4))
        self.assertIn("by-hand", d.look_back_reason)

    def test_a_late_or_repeated_scheduled_run_does_not_run_twice(self) -> None:
        # The Mac was off on Monday 26 October; the task ran on Tuesday. The next Monday skips, the one after runs.
        prs = OCTOBER + [scheduled(120, "2026-10-27T09:00:00")]
        self.assertFalse(P.decide(prs, monday("2026-10-27").replace(hour=12)).due)
        self.assertFalse(P.decide(prs, monday("2026-11-02")).due)
        self.assertTrue(P.decide(prs, monday("2026-11-09")).due)

    def test_a_missed_monday_is_caught_up_the_next_monday(self) -> None:
        prs = OCTOBER + [scheduled(120, "2026-10-26T08:30:00")]
        self.assertTrue(P.decide(prs, monday("2026-11-16")).due)

    def test_a_scheduled_run_that_opened_no_pull_request_leaves_the_next_monday_due(self) -> None:
        self.assertTrue(P.decide(OCTOBER, monday("2026-11-02")).due)

    def test_with_no_runs_at_all_it_looks_back_21_days(self) -> None:
        d = P.decide([], monday("2026-10-26"))
        self.assertTrue(d.due)
        self.assertEqual(d.look_back_from, date(2026, 10, 5))

    def test_only_a_marker_makes_a_run_scheduled(self) -> None:
        self.assertEqual(scheduled(1, "2026-10-26T08:00:00").kind, P.SCHEDULED)
        self.assertEqual(by_hand(2, "2026-10-26T08:00:00").kind, P.BY_HAND)
        for p in OCTOBER:
            self.assertEqual(p.kind, P.BY_HAND)
        self.assertFalse(OCTOBER[1].is_pledge_run)

    def test_the_first_lines_say_run_or_skip(self) -> None:
        self.assertTrue(P.decide(OCTOBER, monday("2026-10-26")).lines()[0].startswith("run ("))
        self.assertTrue(P.decide(OCTOBER, monday("2026-10-19")).lines()[0].startswith("skip ("))


class StartTest(unittest.TestCase):
    def test_every_run_gets_a_pledges_branch(self) -> None:
        self.assertEqual(P.branch_for(date(2026, 10, 26), set()), "pledges-2026-10-26")
        # A run by hand on the day of a scheduled run gets its own branch, never a session branch.
        self.assertEqual(P.branch_for(date(2026, 10, 26), {"pledges-2026-10-26"}), "pledges-2026-10-26-2")
        self.assertEqual(P.branch_for(date(2026, 10, 26), {"pledges-2026-10-26", "pledges-2026-10-26-2"}), "pledges-2026-10-26-3")

    def test_title_and_marker(self) -> None:
        self.assertEqual(P.title_for(date(2026, 11, 2)), "New pledges, 2 November 2026")
        line = P.marker(P.SCHEDULED, date(2026, 10, 26))
        self.assertEqual(line, "Run: scheduled (the weekly ledger desk, Monday 26 October 2026). <!-- pledge-finder-run: scheduled -->")
        for kind in (P.SCHEDULED, P.BY_HAND):
            text = P.marker(kind, date(2026, 10, 26))
            self.assertNotIn("\u00b7", text)  # CLAUDE.md: no middle dots
            self.assertEqual(pr(1, "2026-10-26T08:00:00", body=f"{text}\n\nrest").kind, kind)

    def test_the_routine_uses_the_script(self) -> None:
        doc = (ROOT / "docs" / "PLEDGE_FINDER.md").read_text()
        for command in ("scripts/pledge_finder.py due", "scripts/pledge_finder.py start --scheduled", "scripts/pledge_finder.py start --by-hand"):
            self.assertIn(command, doc)
        self.assertNotIn("gh pr list", doc)  # the old check keyed on any "New pledges" pull request


if __name__ == "__main__":
    unittest.main()
