"""Ward map: projection to SVG and which wards are neighbours. Run: python3 -m unittest discover -s etl/tests -t ."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import ward_map as W  # noqa: E402

# Three squares in a row, A | B | C, and D touching C only at one corner.
A = [[(0.0, 51.0), (0.01, 51.0), (0.01, 51.01), (0.0, 51.01), (0.0, 51.0)]]
B = [[(0.01, 51.0), (0.02, 51.0), (0.02, 51.01), (0.01, 51.01), (0.01, 51.0)]]
C = [[(0.02, 51.0), (0.03, 51.0), (0.03, 51.01), (0.02, 51.01), (0.02, 51.0)]]
D = [[(0.03, 51.01), (0.04, 51.01), (0.04, 51.02), (0.03, 51.02), (0.03, 51.01)]]


class WardMapTest(unittest.TestCase):
    def test_neighbours_share_a_boundary_not_a_corner(self) -> None:
        n = W.neighbours({"A": A, "B": B, "C": C, "D": D})
        self.assertEqual(n, {"A": ["B"], "B": ["A", "C"], "C": ["B"], "D": []})

    def test_projection_fits_the_width_with_north_up(self) -> None:
        project, height = W.projector([p for r in (A + B + C) for p in r])
        west_south = project((0.0, 51.0))
        east_north = project((0.03, 51.01))
        self.assertEqual(west_south[0], W.PAD)
        self.assertAlmostEqual(east_north[0], W.WIDTH - W.PAD, places=1)
        self.assertLess(east_north[1], west_south[1])  # north is up
        self.assertGreater(height, 2 * W.PAD)

    def test_paths_close_and_drop_repeated_points(self) -> None:
        project, _ = W.projector([p for r in A for p in r])
        d = W.svg_path(A, project)
        self.assertTrue(d.startswith("M") and d.endswith("Z"))
        self.assertEqual(d.count("L"), 3)  # four corners, the closing point left to Z


if __name__ == "__main__":
    unittest.main()
