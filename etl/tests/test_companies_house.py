"""Companies House matching: name keys, and what the build may hold. Run: python3 -m unittest discover -s etl/tests -t ."""
from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import companies_house as C  # noqa: E402


class CompaniesHouseTest(unittest.TestCase):
    def test_tidied_names_meet(self) -> None:
        self.assertEqual(C.full_key("F.M Conway Ltd", True), C.full_key("F M CONWAY LIMITED"))
        self.assertEqual(C.full_key("Mulalley & Company Limited", True), C.full_key("MULALLEY & CO. LIMITED"))
        self.assertEqual(C.full_key("Mitie Property Services (Uk) Ltd - South", True), C.full_key("MITIE PROPERTY SERVICES (UK) LIMITED"))

    def test_a_different_suffix_is_not_the_same_name(self) -> None:
        self.assertNotEqual(C.full_key("Firestone Properties Ltd", True), C.full_key("FIRESTONE PROPERTIES LLP"))
        self.assertEqual(C.core_key("Firestone Properties Ltd", True), C.core_key("FIRESTONE PROPERTIES LLP"))

    def test_register_dates_read_as_iso(self) -> None:
        self.assertEqual(C.uk_date("11/09/2012"), "2012-09-11")
        self.assertEqual(C.uk_date(""), "")

    def test_check_refuses_an_address_and_an_unchecked_hand_match(self) -> None:
        d = json.loads(C.OUT.read_text())
        sid = next(iter(d["companies"]))
        d["companies"][sid]["postcode"] = "W6 9JU"
        problems = " ".join(C.check(d))
        self.assertIn("no addresses, no people", problems)
        d = json.loads(C.OUT.read_text())
        d["companies"]["no-such-supplier"] = dict(d["companies"][sid], matched_on="checked")
        problems = " ".join(C.check(d))
        self.assertIn("not a supplier with a page", problems)
        self.assertIn("not checked", problems)

    def test_the_committed_build_is_well_formed(self) -> None:
        self.assertEqual(C.check(json.loads(C.OUT.read_text())), [])


if __name__ == "__main__":
    unittest.main()
