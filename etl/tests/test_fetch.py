"""Downloading sources: kept files are checked, and a stale one is fetched again. Run: python3 -m unittest discover -s etl/tests -t ."""
from __future__ import annotations

import hashlib
import io
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import fetch as F  # noqa: E402

NEW = b"this year's table"
SOURCE = {"id": "t", "file": "t.csv", "url": "https://example.gov.uk/t", "asset_url": "https://example.gov.uk/t.csv", "sha256": hashlib.sha256(NEW).hexdigest()}


class FetchTest(unittest.TestCase):
    def run_fetch(self, kept: bytes | None, refresh_stale: bool) -> tuple[int, bytes, int]:
        with tempfile.TemporaryDirectory() as d:
            raw = Path(d)
            if kept is not None:
                (raw / "t.csv").write_bytes(kept)
            calls = []

            def urlopen(req, timeout=0):
                calls.append(req.full_url)
                return io.BytesIO(NEW)

            with mock.patch.object(F, "RAW", raw), mock.patch.object(F, "load_sources", return_value=[SOURCE]), mock.patch.object(F.urllib.request, "urlopen", urlopen):
                code = F.main(False, refresh_stale=refresh_stale)
            return code, (raw / "t.csv").read_bytes(), len(calls)

    def test_a_kept_file_that_matches_is_not_fetched_again(self) -> None:
        self.assertEqual(self.run_fetch(NEW, refresh_stale=True), (0, NEW, 0))

    def test_a_stale_kept_file_is_fetched_again_and_checked(self) -> None:
        self.assertEqual(self.run_fetch(b"last year's table", refresh_stale=True), (0, NEW, 1))

    def test_without_the_ci_option_a_changed_file_is_reported_not_replaced(self) -> None:
        code, data, calls = self.run_fetch(b"last year's table", refresh_stale=False)
        self.assertEqual((code, data, calls), (1, b"last year's table", 0))


if __name__ == "__main__":
    unittest.main()
