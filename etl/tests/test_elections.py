"""Ward election results: only councillors are named, and the results hold together. Run: python3 -m unittest discover -s etl/tests -t ."""
from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import elections as E  # noqa: E402


def candidacy(first: str, last: str, party: str, ec_id: str, votes: int, elected: bool) -> dict:
    return {
        "elected": elected, "deselected": False, "party_name": party, "party": {"ec_id": ec_id},
        "sopn_first_names": first, "sopn_last_name": last.upper(), "person": {"name": f"{first} {last}"},
        "result": {"elected": elected, "num_ballots": votes},
    }


ADDISON = {
    "post": {"id": "gss:E05013733", "label": "Addison"}, "winner_count": 2, "cancelled": False, "by_election_reason": "",
    "ballot_paper_id": "local.hammersmith-and-fulham.addison.2026-05-07",
    "results": {"num_turnout_reported": 3470, "turnout_percentage": 34.3, "num_spoilt_ballots": 11,
                "source": "https://www.lbhf.gov.uk/councillors-and-democracy/elections/local-council-elections-2026/results/addison-ward-result"},
    "candidacies": [
        candidacy("Olivia", "Example", "Green Party", "PP63", 360, False),
        candidacy("Jacolyn", "Daly", "Labour Party", "PP53", 958, True),
        candidacy("Ross", "Melton", "Labour Party", "PP53", 808, True),
        candidacy("Tara", "Sample", "Conservative and Unionist Party", "PP52", 335, False),
    ],
}


class ElectionsTest(unittest.TestCase):
    def test_only_elected_candidates_are_named_through_their_councillor_record(self) -> None:
        out = E.build([ADDISON], "2026-10-08")
        text = json.dumps(out)
        self.assertNotIn("Example", text)
        self.assertNotIn("Sample", text)
        self.assertNotIn("Olivia", text)
        w = out["wards"]["addison"]
        self.assertEqual([c.get("councillor_id") for c in w["candidates"] if c["elected"]], ["jacolyn-daly", "ross-melton"])

    def test_candidates_in_vote_order_and_parties_with_pages_linked(self) -> None:
        w = E.build([ADDISON], "2026-10-08")["wards"]["addison"]
        self.assertEqual([c["votes"] for c in w["candidates"]], [958, 808, 360, 335])
        self.assertEqual([c.get("party_id") for c in w["candidates"]], ["labour", "labour", None, "conservative"])

    def test_an_elected_name_that_matches_no_councillor_stops_the_build(self) -> None:
        bad = json.loads(json.dumps(ADDISON))
        bad["candidacies"][1]["sopn_last_name"] = "NOBODY"
        with self.assertRaises(SystemExit):
            E.build([bad], "2026-10-08")

    def test_check_refuses_a_name_field_and_a_wrong_winner(self) -> None:
        d = json.loads((E.OUT).read_text())
        d["wards"]["addison"]["candidates"][2]["name"] = "A Person"
        d["wards"]["addison"]["candidates"][0]["votes"] = 1
        problems = " ".join(E.check(d))
        self.assertIn("no names beyond councillors", problems)
        self.assertIn("fewer votes was elected", problems)

    def test_the_committed_results_are_well_formed(self) -> None:
        self.assertEqual(E.check(json.loads(E.OUT.read_text())), [])


if __name__ == "__main__":
    unittest.main()
