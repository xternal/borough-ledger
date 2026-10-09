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
                          ("Reform UK", "reform-uk"), ("Chislehurst Matters", "chislehurst-matters"),
                          ("Lewisham Green Party Group", "green"), ("Independent Member", "independent"), ("Aspire", "aspire"),
                          ("Scottish Labour Party", "labour"), ("Scottish National Party (SNP)", "snp"), ("Scottish Green Party", "green"),
                          ("Scottish Conservative and Unionist Party", "conservative"), ("Your Party", "your-party")]:
            self.assertEqual(BP.party_id(name), pid, name)

    def test_honours_and_degrees_after_a_name_do_not_hide_the_surname(self) -> None:
        self.assertTrue(BP.ends_with_surname("Tariq Dar MBE", "DAR"))
        self.assertTrue(BP.ends_with_surname("Amer Agha MB BS, MSc, PHCM", "AGHA"))
        self.assertFalse(BP.ends_with_surname("Iftekhar Ahmed", "AGHA"))

    def test_a_two_word_surname_matches(self) -> None:
        self.assertTrue(BP.ends_with_surname("Natacha Tannous Ritchie", "TANNOUS RITCHIE"))
        self.assertFalse(BP.ends_with_surname("Natacha Ritchie", "TANNOUS"))

    def test_a_ward_is_named_without_the_word_ward(self) -> None:
        self.assertEqual(BP.ward_name("Alexandra Ward "), "Alexandra")
        self.assertEqual(BP.ward_name("Wardour"), "Wardour")
        self.assertEqual(BP.ward_name("Ward"), "Ward")

    def test_a_may_winner_leaves_only_where_the_ward_held_a_by_election(self) -> None:
        # Every winner shown as no longer on the council's list is in a ward that held a by-election since May; Croydon's
        # New Addington North, which held none, pairs its winner with the councillor listed under another name.
        for b in BP.boroughs():
            path = BP.OUT / b["slug"] / "people.json"
            # Where the list is the council's own with nothing to pair it with (Scotland, North Yorkshire), it includes
            # everyone elected at a by-election already.
            if b.get("councillors_from") == "later" or BP.unpaired(b) or not path.exists():
                continue
            p = json.loads(path.read_text())
            by = [s for s in p["sources"] if "by-elections" in s["title"]]
            self.assertEqual(len(by), 1, f"{b['slug']}: the by-election register is a source")
            for w in p["wards"]:
                left = [c for c in w["election"]["candidates"] if c.get("left")]
                if left:
                    snap = sorted((BP.RAW / b["slug"]).glob("byelections_*"))
                    if snap:
                        held = {e["ward_gss"] for e in json.loads(snap[-1].read_text())["byelections"] if not e["cancelled"]}
                        self.assertIn(w["ons_code"], held, f"{b['slug']} {w['name']}")
        croydon = json.loads((BP.OUT / "croydon" / "people.json").read_text())
        ward = next(w for w in croydon["wards"] if w["name"] == "New Addington North")
        self.assertFalse(any(c.get("left") for c in ward["election"]["candidates"]))

    @unittest.skipUnless((ROOT / "data" / "raw" / "pobe_2026_revenue.xlsx").exists(), "Scottish returns not downloaded")
    def test_glasgow_balances_and_its_bill_adds_up(self) -> None:
        import scotland as S
        reg = {s["id"]: s for s in load_sources()}
        out = S.build_one(reg, next(b for b in S.councils() if b["slug"] == "glasgow"))
        bill = out["bill"]
        self.assertEqual(bill["band_d_council"], 1706.0)
        self.assertAlmostEqual(bill["band_d_total"], bill["band_d_council"] + bill["band_d_gla"], places=2)
        self.assertAlmostEqual(sum(p["band_d"] for p in bill["gla_split"]), bill["band_d_gla"], places=2)
        self.assertAlmostEqual(sum(f["m"] for f in out["funding"]), sum(s["m"] for s in out["services"]), places=2)
        self.assertTrue(all(f.get("gap") for f in out["funding"] if f["kind"] == "reserves"))
        self.assertFalse(any("ring_fenced_to" in f for f in out["funding"]))

    def test_a_scottish_council_is_built_by_its_own_returns_only(self) -> None:
        self.assertNotIn("glasgow", [b["slug"] for b in B.boroughs()])
        self.assertIn("glasgow", [b["slug"] for b in BP.boroughs()])

    def test_returns_that_differ_are_published_only_by_decision_and_said_on_the_page(self) -> None:
        # Islington, Bexley and Waltham Forest: the owner chose to publish them although their two returns differ on
        # council tax; every other borough must still agree to £5,000.
        differ = sorted(b["slug"] for b in B.boroughs() if b.get("returns_differ"))
        self.assertEqual(differ, ["bexley", "islington", "waltham-forest"])
        for slug in differ:
            st = json.loads((BP.OUT / slug / "statement.json").read_text())
            d = st["returns_differ"]
            self.assertGreater(abs(d["budget_return_m"] - d["council_tax_return_m"]), 0.005)
            ct = next(f for f in st["funding"] if f["id"] == "council_tax")
            self.assertEqual(ct["source_id"], "ra_2026-27")  # the budget uses the budget return's figure, and says so

    @unittest.skipUnless((ROOT / "data" / "raw" / "statswales_ra_spend_cardiff.csv").exists(), "StatsWales downloads not present")
    def test_cardiff_balances_with_its_fire_levy_and_nine_bands(self) -> None:
        import wales as W
        reg = {s["id"]: s for s in load_sources()}
        out = W.build_one(reg, next(b for b in W.councils() if b["slug"] == "cardiff"))
        bill = out["bill"]
        self.assertEqual(sorted(bill["published_bands"]), list("ABCDEFGHI"))
        self.assertAlmostEqual(bill["band_d_total"], bill["band_d_council"] + bill["band_d_gla"], places=2)
        fire = next(s for s in out["services"] if s["id"] == "fire_levy")
        self.assertGreater(fire["m"], 20)
        self.assertAlmostEqual(sum(f["m"] for f in out["funding"]), sum(s["m"] for s in out["services"]), places=2)
        self.assertEqual(bill["parish"]["count"], 6)


if __name__ == "__main__":
    unittest.main()
