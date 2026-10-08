"""Building schemes by ward: reading a place from a scheme name, and the build adding up. Run: python3 -m unittest discover -s etl/tests -t ."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import capital_wards as C  # noqa: E402


class PlaceOfTest(unittest.TestCase):
    def test_drops_the_work_and_keeps_the_place(self) -> None:
        self.assertEqual(C.place_of("Capital - Frank Banfield Park"), "Frank Banfield Park")
        self.assertEqual(C.place_of("Capital - Horton House Roof - Major Works"), "Horton House")
        self.assertEqual(C.place_of("Capital - Package 8: Sulivan Ct Phase 2"), "Sulivan Court")
        self.assertEqual(C.place_of("Capital - Brackenbury Primary SCH Window Replace"), "Brackenbury Primary School")
        self.assertEqual(C.place_of("Capital - Schools Maintenance - Queensmill"), "Queensmill")

    def test_writes_out_council_shorthand(self) -> None:
        self.assertEqual(C.place_of("Capital - WKSR - Town Hall Refurbishment"), "Hammersmith Town Hall")
        self.assertEqual(C.place_of("Capital - Civic Campus Commercial Unit Acquisition"), "Hammersmith Town Hall")

    def test_programmes_everywhere_are_not_places(self) -> None:
        for a in ["Capital - Footways", "Capital - LED Programme", "Capital - Major voids and complex repairs", "Capital - New Home Acquisitions"]:
            self.assertTrue(C.borough_wide(a), a)
        for a in ["Capital - Civic Campus Commercial Unit Acquisition", "Capital - Fulham Bilingual Window Replacement", "Capital - S106 Hartopp & Lannoy Point Footways"]:
            self.assertFalse(C.borough_wide(a), a)


class BuildTest(unittest.TestCase):
    def test_every_scheme_is_in_the_table_and_the_kinds_add_up(self) -> None:
        out = C.build()
        self.assertAlmostEqual(sum(out["by_kind"].values()), out["total"], places=1)
        placed = sum(w["total"] for w in out["wards"].values())
        self.assertAlmostEqual(placed, out["by_kind"]["place"], places=1)
        for w in out["wards"].values():
            for s in w["shared"]:
                self.assertGreaterEqual(len(s["wards"]), 2)
        self.assertEqual(out["quality"], "sourced" if out["mapping"]["unreviewed"] + out["mapping"]["checked"] == 0 else "approx")

    def test_inside_a_square(self) -> None:
        sq = [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0), (0.0, 0.0)]
        self.assertTrue(C.inside((0.5, 0.5), sq))
        self.assertFalse(C.inside((1.5, 0.5), sq))


if __name__ == "__main__":
    unittest.main()
