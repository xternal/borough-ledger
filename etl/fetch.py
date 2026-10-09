"""Download every source in etl/sources.json to data/raw/ and verify its SHA-256.

    python3 etl/fetch.py          download missing files, verify all
    python3 etl/fetch.py --check  verify only, never download
"""
from __future__ import annotations

import hashlib
import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
UA = "BoroughLedger-ETL/0.1 (independent research; https://github.com/xternal/borough-ledger)"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def load_sources() -> list:
    return json.loads((ROOT / "etl" / "sources.json").read_text())["sources"]


def main(check_only: bool) -> int:
    RAW.mkdir(parents=True, exist_ok=True)
    bad = 0
    for s in load_sources():
        if "file" not in s:
            continue
        path = RAW / s["file"]
        if s.get("manual") and not path.exists():
            print(f"manual    {s['file']} (download by hand from {s['url']}; not needed to build)")
            continue
        if not path.exists():
            if check_only:
                print(f"missing   {s['file']}")
                bad += 1
                continue
            data = b""
            for attempt in range(3):
                # gov.scot once answered GitHub's runners with empty bodies: an empty file is retried, never kept.
                req = urllib.request.Request(s["asset_url"], headers={"User-Agent": UA})
                with urllib.request.urlopen(req, timeout=120) as r:
                    data = r.read()
                if data:
                    break
                import time
                time.sleep(15 * (attempt + 1))
            if not data:
                print(f"EMPTY     {s['file']}: the server sent nothing, three times")
                bad += 1
                continue
            path.write_bytes(data)
            print(f"fetched   {s['file']}")
        got = sha256(path)
        if got != s["sha256"]:
            print(f"MISMATCH  {s['file']}: expected {s['sha256']}, got {got}. The source changed; review it before updating sources.json.")
            bad += 1
        else:
            print(f"ok        {s['file']}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main("--check" in sys.argv))
