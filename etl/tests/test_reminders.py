"""Reminders (scripts/reminders.py): each falls due on its day, once, and the workflow offers every one. Run: python3 -m unittest discover -s etl/tests -t ."""
from __future__ import annotations

import re
import sys
import unittest
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import reminders as R  # noqa: E402


def due_ids(today: date):
    return sorted(r.id for r in R.REMINDERS if r.due(today))


class RemindersTest(unittest.TestCase):
    def test_every_reminder_renders_in_plain_text(self) -> None:
        ids = [r.id for r in R.REMINDERS]
        self.assertEqual(len(ids), len(set(ids)))
        for r in R.REMINDERS:
            title, body = r.render(date(2027, 2, 1))
            for text in (title, body):
                self.assertNotIn("\u00b7", text, r.id)  # CLAUDE.md: no middle dots
                self.assertNotIn("{", text, r.id)
            self.assertLessEqual(len(title), 100, r.id)

    def test_the_spend_file_and_budget_keep_their_titles(self) -> None:
        spend = next(r for r in R.REMINDERS if r.id == "spend-file")
        self.assertEqual(spend.render(spend.due(date(2027, 2, 3)))[0], "Spend file: add the council's new quarter (Feb 2027)")
        budget = next(r for r in R.REMINDERS if r.id == "budget")
        self.assertEqual(budget.render(budget.due(date(2027, 3, 4)))[0], "Budget 2027: move the statement on a year")

    def test_falls_due_on_its_day_and_stays_due_for_a_week(self) -> None:
        self.assertEqual(due_ids(date(2027, 2, 1)), ["care-winter", "spend-file"])
        self.assertEqual(due_ids(date(2027, 2, 7)), ["care-winter", "spend-file"])
        self.assertEqual(due_ids(date(2027, 2, 8)), [])
        self.assertEqual(due_ids(date(2027, 1, 31)), [])

    def test_the_budget_waits_for_full_council(self) -> None:
        # Full Council may set the budget on 1 March (the council's report for 2027/28), so not before the 4th.
        self.assertNotIn("budget", due_ids(date(2027, 3, 1)))
        self.assertIn("budget", due_ids(date(2027, 3, 4)))

    def test_a_reminder_does_not_start_before_its_first_year(self) -> None:
        # This year's budget cycle and pledge audit are already in hand.
        self.assertEqual(due_ids(date(2026, 10, 15)), [])
        self.assertIn("budget-cycle", due_ids(date(2027, 10, 15)))
        self.assertIn("pledge-audit", due_ids(date(2027, 1, 1)))

    def test_one_off_reminders_fall_due_once(self) -> None:
        self.assertIn("node-24", due_ids(date(2027, 4, 1)))
        self.assertNotIn("node-24", due_ids(date(2028, 4, 1)))
        self.assertIn("legal-2030", due_ids(date(2029, 12, 1)))

    def test_a_year_turning_does_not_lose_a_reminder(self) -> None:
        # Early in January the last spend file fell due in the year before; late in December, in the same year.
        spend = next(r for r in R.REMINDERS if r.id == "spend-file")
        self.assertEqual(spend.falls_due(date(2027, 1, 3)), date(2026, 11, 1))
        audit = next(r for r in R.REMINDERS if r.id == "pledge-audit")
        self.assertEqual(audit.falls_due(date(2027, 12, 31)), date(2027, 10, 1))

    def test_elections_wait_a_week_and_name_every_council(self) -> None:
        boroughs = [
            {"slug": "a", "short": "Alpha", "next_election": "2027-05-06"},
            {"slug": "b", "short": "Beta", "next_election": "2027-05-06"},
            {"slug": "c", "short": "Gamma"},
        ]
        self.assertEqual(R.elections_due(date(2027, 5, 12), boroughs), [])
        [(title, body)] = R.elections_due(date(2027, 5, 13), boroughs)
        self.assertEqual(title, "Elections of 6 May 2027: fetch the new councillors and set the next date")
        self.assertIn("- [ ] Alpha", body)
        self.assertIn("- [ ] Beta", body)
        self.assertNotIn("Gamma", body)

    def test_the_councils_on_the_site_that_vote_in_may_2027(self) -> None:
        titles = [t for t, _ in R.due_today(date(2027, 5, 13))]
        self.assertIn("Elections of 6 May 2027: fetch the new councillors and set the next date", titles)

    def test_the_workflow_offers_every_reminder(self) -> None:
        workflow = (ROOT / ".github" / "workflows" / "reminders.yml").read_text()
        options = re.search(r"options:\n((?:\s+- \S+\n)+)", workflow)
        assert options is not None
        offered = re.findall(r"- (\S+)", options.group(1))
        self.assertEqual(offered, ["due-today"] + [r.id for r in R.REMINDERS])


if __name__ == "__main__":
    unittest.main()
