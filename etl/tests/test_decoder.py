"""The council tax decoder: every English billing authority, parts adding up. Run: python3 -m unittest discover -s etl/tests -t ."""
from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import decoder as D  # noqa: E402
from extract import CheckFailed  # noqa: E402
from fetch import ROOT, load_sources  # noqa: E402

REG = {s["id"]: s for s in load_sources()}
RAW_PRESENT = (ROOT / "data" / "raw" / REG[D.NOW]["file"]).exists() and (ROOT / "data" / "raw" / REG[D.PREV]["file"]).exists()


@unittest.skipUnless(RAW_PRESENT, "needs the government's Table 10 for both years in data/raw/ (python3 etl/fetch.py)")
class DecoderTest(unittest.TestCase):
    def test_every_billing_authority_adds_up_and_matches_the_committed_file(self) -> None:
        out = D.build(REG)
        self.assertEqual(len(out["councils"]), 296)
        for c in out["councils"]:
            self.assertAlmostEqual(sum(c["parts"].values()), c["total"], delta=0.011, msg=c["name"])
            self.assertAlmostEqual(sum(c["prev_parts"].values()), c["prev_total"], delta=0.011, msg=c["name"])
        self.assertEqual(json.loads(D.OUT.read_text()), json.loads(D.serialise(out)))
        hf = next(c for c in out["councils"] if c["ons"] == "E09000013")
        self.assertEqual((hf["total"], hf["parts"]["council"], hf["parts"]["county"]), (1519.51, 1009.0, 510.51))

    def test_it_agrees_with_every_council_page_on_the_site(self) -> None:
        # The council pages take their bill from other government tables (Tables 8 and 9); outside a parish they must agree.
        out = {c["ons"]: c for c in D.build(REG)["councils"]}
        statements = [json.loads(p.read_text()) for p in sorted((ROOT / "data" / "build" / "boroughs").glob("*/statement.json"))]
        statements.append(json.loads((ROOT / "data" / "build" / "hf_2026-27.json").read_text()))
        checked = 0
        for st in statements:
            code = st["meta"]["council_code"]
            if code not in out:
                continue  # Scotland, Wales and Northern Ireland
            c = out[code]
            self.assertAlmostEqual(c["total"] - c["parts"]["parish"], st["bill"]["band_d_total"], delta=0.02, msg=st["meta"]["council"])
            checked += 1
        self.assertGreaterEqual(checked, 35)

    def test_parts_that_do_not_add_up_stop_the_build(self) -> None:
        real = D.read_ods

        def tampered(path: str):
            book = real(path)
            rows = book["Data_Billing"]
            hi = next(i for i, r in enumerate(rows) if r and str(r[0]).strip() == "E-code")
            col = next(j for j, h in enumerate(rows[hi]) if str(h or "").strip().startswith("16.") and "(police)" in str(h))
            for r in rows[hi + 1:]:
                if len(r) > col and r[1] == "E07000179":
                    r[col] = float(r[col]) + 1.0  # Thames Valley's share in South Oxfordshire, £1 more than the total allows
            return book

        with mock.patch.object(D, "read_ods", tampered):
            with self.assertRaises(CheckFailed):
                D.build(REG)

    def test_page_addresses_and_names(self) -> None:
        out = {c["name"]: c for c in D.build(REG)["councils"]}
        self.assertEqual((out["City of London"]["slug"], out["City of London"]["council_name"], out["City of London"]["place"]), ("city-of-london", "the City of London Corporation", "the City of London"))
        self.assertEqual(out["South Oxfordshire"]["preceptors"]["police"], "Thames Valley Police and Crime Commissioner")
        self.assertEqual(out["Wigan"]["preceptors"]["combined"], "Greater Manchester Combined Authority (the mayor)")
        self.assertEqual(D.preceptor("fire", "Essex PCC-Fire"), "Essex Police, Fire and Crime Commissioner (fire)")


if __name__ == "__main__":
    unittest.main()
