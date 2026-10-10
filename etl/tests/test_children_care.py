"""What care for children costs: the Department for Education's figures, checked to add up. Run: python3 -m unittest discover -s etl/tests -t ."""
from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import children_care as C  # noqa: E402
from extract import CheckFailed  # noqa: E402
from fetch import ROOT, load_sources  # noqa: E402

REG = {s["id"]: s for s in load_sources()}
RAW_PRESENT = all((ROOT / "data" / "raw" / REG[s]["file"]).exists() for s in (C.SPEND, C.PLACED))


@unittest.skipUnless(RAW_PRESENT, "needs the Department for Education's files in data/raw/ (python3 etl/fetch.py)")
class ChildrenCareTest(unittest.TestCase):
    def test_every_english_council_and_the_committed_file(self) -> None:
        out = C.build(REG)
        hf = out["councils"]["E09000013"]
        self.assertEqual((hf["children"], hf["placements"]["foster"], hf["placements"]["childrens_homes"]), (197, 140, 21))
        self.assertAlmostEqual(hf["spend_m"]["total"], 24.948139, places=6)
        self.assertTrue(out["councils"]["E09000032"]["withheld"])  # Wandsworth, 2024/25
        self.assertIsNone(out["councils"]["E09000032"]["spend_m"])
        self.assertEqual(out["england"]["home_year_quality"], "modelled")
        self.assertEqual(json.loads(C.OUT.read_text()), json.loads(C.serialise(out)))

    def test_spending_that_does_not_add_up_stops_the_build(self) -> None:
        real = C.read

        def tampered(reg, sid):
            rows = real(reg, sid)
            if sid == C.SPEND:
                for r in rows:
                    if r["old_la_code"] == "205" and r["time_period"] == C.PERIOD and r["description_of_expenditure"] == C.LINES["residential"]:
                        r["total_expenditure"] = str(float(r["total_expenditure"]) + 1000)
            return rows

        with mock.patch.object(C, "read", tampered):
            with self.assertRaises(CheckFailed):
                C.build(REG)


if __name__ == "__main__":
    unittest.main()
