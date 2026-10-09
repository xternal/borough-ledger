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

    @unittest.skipUnless(RAW_PRESENT, "needs the government returns in data/raw/ (python3 etl/fetch.py)")
    def test_outside_london_the_bill_splits_into_police_fire_and_parish_exactly(self) -> None:
        reg = {s["id"]: s for s in load_sources()}
        by = {b["slug"]: b for b in B.boroughs()}
        man = B.build_one(reg, by["manchester"])["bill"]
        self.assertAlmostEqual(sum(g["band_d"] for g in man["gla_split"]), man["band_d_gla"], places=2)
        self.assertNotIn("parish", man)
        brm = B.build_one(reg, by["birmingham"])["bill"]
        # What a home outside Birmingham's two parishes pays; the parishes' own precept is shown apart.
        self.assertAlmostEqual(brm["band_d_total"], brm["band_d_council"] + sum(g["band_d"] for g in brm["gla_split"]), places=2)
        self.assertEqual(brm["parish"]["count"], 2)

    def test_a_council_listing_vacancy_is_an_empty_seat_and_hyphenated_names_pair(self) -> None:
        winner = {"person": {"name": "Grace Worrall"}, "sopn_first_names": "Grace", "sopn_last_name": "WORRALL"}
        self.assertGreaterEqual(BP.same_person(winner, "Grace Tudor-Worrall"), 0.85)
        self.assertEqual(BP.same_person(winner, "Dave Rawson"), 0.0)

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

    def test_parties_are_recognised_however_they_are_written(self) -> None:
        for name, pid in [("Labour and Cooperative Party", "labour"), ("Labour And Co Op Party", "labour"), ("Local Conservatives", "conservative"),
                          ("Conservative and Unionist Party", "conservative"), ("Liberal Democrat", "liberal-democrats"), ("Green Party", "green"),
                          ("Reform UK", "reform-uk"), ("Chislehurst Matters", "chislehurst-matters")]:
            self.assertEqual(BP.party_id(name), pid, name)

    def test_honours_and_degrees_after_a_name_do_not_hide_the_surname(self) -> None:
        self.assertTrue(BP.ends_with_surname("Tariq Dar MBE", "DAR"))
        self.assertTrue(BP.ends_with_surname("Amer Agha MB BS, MSc, PHCM", "AGHA"))
        self.assertFalse(BP.ends_with_surname("Iftekhar Ahmed", "AGHA"))

    def test_a_two_word_surname_matches(self) -> None:
        self.assertTrue(BP.ends_with_surname("Natacha Tannous Ritchie", "TANNOUS RITCHIE"))
        self.assertFalse(BP.ends_with_surname("Natacha Ritchie", "TANNOUS"))


if __name__ == "__main__":
    unittest.main()
