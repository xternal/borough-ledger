"""What care for adults costs: the government's figures, checked to add up. Run: python3 -m unittest discover -s etl/tests -t ."""
from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import adult_care as A  # noqa: E402
from extract import CheckFailed  # noqa: E402
from fetch import ROOT, load_sources  # noqa: E402

REG = {s["id"]: s for s in load_sources()}
RAW_PRESENT = (ROOT / "data" / "raw" / REG[A.SOURCE_ID]["file"]).exists()


@unittest.skipUnless(RAW_PRESENT, "needs the finance report in data/raw/ (python3 etl/fetch.py)")
class AdultCareTest(unittest.TestCase):
    def test_every_english_council_on_the_site_and_the_committed_file(self) -> None:
        out = A.build(REG)
        self.assertEqual(len(out["councils"]), len(A.councils()))
        hf = out["councils"]["E09000013"]
        self.assertEqual(hf["unit"]["residential_65"], 1123.84)
        self.assertEqual(hf["unit"]["home_care_hour"], 20.03)
        self.assertAlmostEqual(sum(hf["settings_k"].values()) + hf["spend_k"]["short_term"] + hf["spend_k"]["other"], hf["spend_k"]["total"], delta=1.5)
        self.assertEqual(json.loads(A.OUT.read_text()), json.loads(A.serialise(out)))

    def test_a_table_that_does_not_add_up_stops_the_build(self) -> None:
        real = A.read_ods

        def tampered(path: str):
            book = real(path)
            rows = book["Table_44"]
            for r in rows:
                if r and r[0] == "E09000013":
                    i = next(j for j, v in enumerate(r) if isinstance(v, float))
                    r[i] = r[i] + 500.0  # one type of care £500k more than the total allows
            return book

        with mock.patch.object(A, "read_ods", tampered):
            with self.assertRaises(CheckFailed):
                A.build(REG)


if __name__ == "__main__":
    unittest.main()
