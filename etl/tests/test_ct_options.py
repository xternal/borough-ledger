"""October's council tax options: every figure must follow from this year's bill. Run: python3 -m unittest discover -s etl/tests -t ."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import build as B  # noqa: E402
from extract import CheckFailed  # noqa: E402
from fetch import load_sources  # noqa: E402

REG = {s["id"]: s for s in load_sources()}
COUNCIL, GLA, GAP = 1009.00, 510.51, 159.3


class CouncilTaxOptionsTest(unittest.TestCase):
    def test_the_options_follow_from_this_years_bill(self) -> None:
        out = B.manual_ct_options(REG, COUNCIL, GLA, GAP)
        o = out["ct_options"]["options"]
        self.assertEqual([x["pct"] for x in o], [100, 125, 150])
        self.assertEqual([x["total_band_d"] for x in o], [2554.04, 2806.29, 3058.54])
        self.assertEqual([x["total_per_week"] for x in o], [19.89, 24.75, 29.60])
        self.assertEqual(o[-1]["shortfall_m"], 0)
        self.assertEqual(out["ct_options"]["quality"], "approx")  # until a person marks the rows "yes"
        self.assertEqual(out["timetable"]["items"][-1]["id"], "council_budget")

    def test_a_wrong_figure_stops_the_build(self) -> None:
        real = B.read_csv

        def tamper(field: str, value: str):
            def read(name: str):
                rows = real(name)
                if name == "council_tax_options_2027-28.csv":
                    rows = [dict(r, **({field: value} if r["option_pct"] == "125" else {})) for r in rows]
                return rows
            return read

        for field, value in [("hf_band_d", "2270.00"), ("gla_band_d", "530.00"), ("total_per_week", "24.70"), ("shortfall_m", "25.0"), ("total_increase", "1286.00")]:
            with self.subTest(field=field), mock.patch.object(B, "read_csv", tamper(field, value)):
                with self.assertRaises(CheckFailed):
                    B.manual_ct_options(REG, COUNCIL, GLA, GAP)

    def test_against_another_years_bill_it_fails(self) -> None:
        with self.assertRaises(CheckFailed):
            B.manual_ct_options(REG, 1000.00, GLA, GAP)


if __name__ == "__main__":
    unittest.main()
