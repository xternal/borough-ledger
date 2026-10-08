"""Boroughs beyond Hammersmith & Fulham: the same checks, and only councillors named. Run: python3 -m unittest discover -s etl/tests -t ."""
from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import borough_people as BP  # noqa: E402
import boroughs as B  # noqa: E402
from fetch import ROOT, load_sources  # noqa: E402

KC = "kensington-and-chelsea"
RAW_PRESENT = (ROOT / "data" / "raw" / "Table_10_2026-27.ods").exists()


class BoroughsTest(unittest.TestCase):
    @unittest.skipUnless(RAW_PRESENT, "needs the government returns in data/raw/ (python3 etl/fetch.py)")
    def test_statement_balances_and_counts_payments_in_lieu(self) -> None:
        reg = {s["id"]: s for s in load_sources()}
        out = B.build_one(reg, next(b for b in B.boroughs() if b["slug"] == KC))
        self.assertEqual(out["bill"]["band_d_gla"], 510.51)
        self.assertAlmostEqual(sum(f["m"] for f in out["funding"]), sum(s["m"] for s in out["services"]), delta=0.02)
        housing = next(s for s in out["services"] if s["id"] == "housing")
        self.assertIn("housing benefit", housing["method_note"])

    def people(self) -> tuple:
        d = ROOT / "data" / "build" / "boroughs" / KC
        return json.loads((d / "people.json").read_text()), json.loads((d / "wards_map.json").read_text())

    def test_committed_people_are_well_formed(self) -> None:
        self.assertEqual(BP.check(*self.people()), [])

    def test_a_named_losing_candidate_or_a_wrong_winner_is_refused(self) -> None:
        p, shapes = self.people()
        loser = next(c for c in p["wards"][0]["election"]["candidates"] if not c["elected"])
        loser["name"] = "A Candidate"
        p["wards"][1]["election"]["candidates"][0]["votes"] = 0
        problems = " ".join(BP.check(p, shapes))
        self.assertIn("no names beyond councillors", problems)
        self.assertIn("fewer votes was elected", problems)

    def test_a_two_word_surname_matches(self) -> None:
        self.assertTrue(BP.ends_with_surname("Natacha Tannous Ritchie", "TANNOUS RITCHIE"))
        self.assertFalse(BP.ends_with_surname("Natacha Ritchie", "TANNOUS"))


if __name__ == "__main__":
    unittest.main()
