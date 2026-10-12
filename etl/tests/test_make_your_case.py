"""Make your case: who decides, and the council's ways to take part, checked. Run: python3 -m unittest discover -s etl/tests -t ."""
from __future__ import annotations

import json
import sys
import unittest
from datetime import date
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import make_your_case as M  # noqa: E402
from extract import CheckFailed  # noqa: E402


class MakeYourCaseTest(unittest.TestCase):
    def setUp(self) -> None:
        self.real = M.read_csv

    def with_rows(self, name: str, change):
        rows = change([dict(r) for r in self.real(name)])
        return mock.patch.object(M, "read_csv", side_effect=lambda n: rows if n == name else self.real(n))

    def test_builds_and_matches_the_committed_file(self) -> None:
        out = M.build()
        self.assertEqual(set(out["topics"]), set(M.TOPICS))
        self.assertEqual(json.loads(M.OUT.read_text()), json.loads(M.serialise(out)))
        self.assertEqual([q["meeting"] for q in out["take_part"]["questions"]], ["2026-10-21", "2027-01-27", "2027-02-24"])

    def test_every_topic_says_what_the_law_the_government_and_the_council_decide(self) -> None:
        with self.with_rows("make_your_case.csv", lambda rows: [r for r in rows if not (r["topic"] == "budget" and r["who"] == "law")]):
            with self.assertRaises(CheckFailed):
                M.build()

    def test_a_row_must_cite_a_source_we_hold(self) -> None:
        with self.with_rows("make_your_case.csv", lambda rows: [{**r, "source_ids": "not_a_source"} if r["order"] == "1" else r for r in rows]):
            with self.assertRaises(CheckFailed):
                M.build()

    def test_a_question_deadline_must_be_seven_clear_working_days_before_the_meeting(self) -> None:
        # Monday 18 January 2027 leaves only six working days before Wednesday 27 January.
        late = lambda rows: [{**r, "deadline": "2027-01-18T12:00"} if r["id"] == "question_2027-01-27" else r for r in rows]  # noqa: E731
        with self.with_rows("take_part_2026-27.csv", late):
            with self.assertRaises(CheckFailed):
                M.build()
        self.assertEqual(M.clear_working_days(date(2027, 1, 15), date(2027, 1, 27)), 7)

    def test_priorities_compare_every_london_borough_on_the_site(self) -> None:
        out = M.build()["compare"]
        self.assertEqual(set(out), set(M.SERVICE))
        for topic, c in out.items():
            self.assertEqual(len(c["councils"]), 28, topic)
            self.assertTrue(all(r["council_code"].startswith("E09") for r in c["councils"]))
        hf = next(r for r in out["housing"]["councils"] if r["council_code"] == "E09000013")
        self.assertEqual((hf["m"], hf["share"]), (43.498, 0.1704))

    def test_rows_are_approx_until_the_owner_reviews_them(self) -> None:
        out = M.build()
        for rows in out["topics"].values():
            for r in rows:
                self.assertIn(r["quality"], ("approx", "sourced"))
        with self.with_rows("make_your_case.csv", lambda rows: [{**r, "reviewed": "yes"} for r in rows]):
            self.assertTrue(all(r["quality"] == "sourced" for rows in M.build()["topics"].values() for r in rows))


if __name__ == "__main__":
    unittest.main()
