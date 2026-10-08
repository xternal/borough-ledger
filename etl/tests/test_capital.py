"""The building programme and council homes tables: rounding allowed, real mistakes refused. Run: python3 -m unittest discover -s etl/tests -t ."""
from __future__ import annotations

import csv
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import capital as C  # noqa: E402


class CapitalTest(unittest.TestCase):
    def setUp(self) -> None:
        self.real = C.MANUAL
        self.tmp = Path(tempfile.mkdtemp())
        for name in ("capital_2026-30.csv", "council_homes_2026-27.csv"):
            shutil.copy(self.real / name, self.tmp / name)
        C.MANUAL = self.tmp

    def tearDown(self) -> None:
        C.MANUAL = self.real
        shutil.rmtree(self.tmp)

    def edit(self, name: str, match, change) -> None:
        path = self.tmp / name
        rows = list(csv.DictReader(path.open()))
        for r in rows:
            if match(r):
                change(r)
        with path.open("w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=list(rows[0].keys()), lineterminator="\n")
            w.writeheader()
            w.writerows(rows)

    def test_the_committed_tables_pass_and_match_the_build(self) -> None:
        out = C.build()
        self.assertEqual(out["programme"]["summary"]["gf"]["total"], 135.0)
        self.assertEqual(C.dump(out), C.OUT.read_text())

    def test_rounding_is_allowed_but_a_wrong_figure_is_not(self) -> None:
        self.assertTrue(C.near(0.8, 0.6, 4))  # four years of 0.15 printed as 0.2, total printed as 0.6
        self.assertFalse(C.near(1.0, 0.6, 4))
        self.edit("capital_2026-30.csv", lambda r: r["label"] == "Lift Schemes", lambda r: r.update(y2026_27="5.0"))
        with self.assertRaises(C.CheckFailed):
            C.build()

    def test_a_misprint_must_be_declared(self) -> None:
        self.edit("capital_2026-30.csv", lambda r: r["note"].startswith("misprint:"), lambda r: r.update(note=""))
        with self.assertRaises(C.CheckFailed):
            C.build()

    def test_the_council_homes_account_must_balance(self) -> None:
        self.edit("council_homes_2026-27.csv", lambda r: r["key"] == "repairs", lambda r: r.update(y2026_27="30.0"))
        with self.assertRaises(C.CheckFailed):
            C.build()

    def test_approx_until_every_line_is_signed_off(self) -> None:
        self.assertEqual(C.build()["programme"]["quality"], "approx")
        self.edit("capital_2026-30.csv", lambda r: True, lambda r: r.update(reviewed="yes"))
        self.assertEqual(C.build()["programme"]["quality"], "sourced")


if __name__ == "__main__":
    unittest.main()
