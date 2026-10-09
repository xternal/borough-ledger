"""Belfast: rates, not council tax, checked against every source that gives a figure. Run: python3 -m unittest discover -s etl/tests -t ."""
from __future__ import annotations

import csv
import json
import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import extract  # noqa: E402
import northern_ireland as NI  # noqa: E402
from extract import CheckFailed  # noqa: E402
from fetch import ROOT, load_sources  # noqa: E402

REG = {s["id"]: s for s in load_sources()}
BELFAST = next(b for b in NI.councils() if b["slug"] == "belfast")


def rows(name: str):
    with open(ROOT / "data" / "manual" / name, newline="") as f:
        return list(csv.DictReader(f))


class BelfastTest(unittest.TestCase):
    def test_statement_balances_and_matches_the_committed_file(self) -> None:
        out = NI.build_one(REG, BELFAST)
        spend, fund = sum(s["m"] for s in out["services"]), sum(f["m"] for f in out["funding"])
        self.assertAlmostEqual(spend, 227.760695, places=6)
        self.assertAlmostEqual(fund, spend, places=6)
        self.assertEqual(out["amount_raised"]["reserves_m"], 0)
        committed = json.loads((NI.OUT / "belfast" / "statement.json").read_text())
        self.assertEqual(committed, json.loads(NI.serialise(out)))

    def test_the_bill_on_the_average_home(self) -> None:
        r = NI.build_one(REG, BELFAST)["rates"]
        self.assertEqual((r["district"], r["regional"]), (0.004492, 0.005559))
        self.assertAlmostEqual(123000 * (r["district"] + r["regional"]), 1236.273, places=3)

    def test_growth_fund_is_the_difference_and_rounds_to_the_minutes(self) -> None:
        g = next(s for s in NI.build_one(REG, BELFAST)["services"] if s["id"] == "growth_fund")
        self.assertAlmostEqual(g["m"], 4.172896, places=6)
        self.assertEqual(g["quality"], "approx")

    def test_a_wrong_figure_in_any_table_stops_the_build(self) -> None:
        real = extract.read_csv

        def tampered(name: str, field: str, year: str, value: str):
            def read(n: str):
                out = real(n)
                if n == name:
                    out = [dict(r, **({"value" if "value" in r else field: value} if r["year"] == year and r.get("field", field) == field else {})) for r in out]
                return out
            return read

        for name, field, year, value in [
            ("ni_rate_statistics.csv", "district_rates_income", "2026-27", "220388000"),  # penny product × rate
            ("ni_rate_statistics.csv", "domestic_district_rate_p", "2025-26", "0.4300"),  # two circulars disagree
            ("ni_poundages.csv", "domestic_district", "2024-25", "0.004057"),  # district + regional ≠ total, and ≠ the circular
            ("belfast_budget.csv", "amount", "2026-27", "1"),  # committees ≠ the amount to be raised
        ]:
            with self.subTest(name=name, field=field), mock.patch.object(NI, "read_csv", tampered(name, field, year, value)):
                with self.assertRaises(CheckFailed):
                    NI.build_one(REG, BELFAST)

    def test_every_hand_read_row_says_where_it_came_from(self) -> None:
        for name in ("ni_poundages.csv", "ni_rate_statistics.csv", "belfast_budget.csv"):
            for r in rows(name):
                self.assertIn(r["source_id"], REG, name)
                self.assertIn(r["reviewed"], NI.REVIEWED, name)
                self.assertTrue(r.get("page") or r.get("where"), name)
