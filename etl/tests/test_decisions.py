"""Council decisions: plain text from the council's HTML, resolutions from Full Council minutes, names removed. Run: python3 -m unittest discover -s etl/tests -t ."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import decisions as D  # noqa: E402


class DecisionsTest(unittest.TestCase):
    def test_lines_broken_mid_sentence_are_joined_and_numbers_kept(self) -> None:
        html = "<p>That Cabinet agreed the</p><p>following recommendations:</p><p>1.</p><p>To note the report.</p><p>2.</p><p>To approve the</p><p>plan.</p>"
        self.assertEqual(D.plain(html), "That Cabinet agreed the following recommendations:\n1. To note the report.\n2. To approve the plan.")

    def test_bullets_become_lines_never_middle_dots(self) -> None:
        self.assertNotIn("·", D.plain("<p>This Council notes: · one thing · another.</p>"))

    def test_resolution_is_only_what_was_decided(self) -> None:
        minutes = "<p>Mr Smith spoke against.</p><p>The motion was CARRIED.</p><p>8.44pm – RESOLVED</p><p>That Full Council adopt the policy.</p>"
        self.assertEqual(D.resolution(minutes), "That Full Council adopt the policy.")
        self.assertEqual(D.resolution("<p>The motion was LOST.</p>"), "")

    def test_a_private_persons_name_is_removed_but_councillors_stay(self) -> None:
        self.assertEqual(D.redact("The petition from Mrs Jane Doe was noted by Councillor Stephen Cowan."), "The petition from [name removed] was noted by Councillor Stephen Cowan.")

    def test_procedural_items_are_left_out(self) -> None:
        for t in ["Apologies for Absence", "Minutes", "Mayor's Announcements", "Public Questions (20 Minutes)"]:
            self.assertTrue(D.PROCEDURAL.match(t), t)
        self.assertFalse(D.PROCEDURAL.match("Markets and Street Trading Licensing Policy"))


if __name__ == "__main__":
    unittest.main()
