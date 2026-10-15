"""Bounded download, validation and atomic replacement of the published JSON."""

from __future__ import annotations

import argparse
import io
import json
import os
import tempfile
import time
import urllib.error
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from importer.workbook import DIVISIONS, ImportFailure, parse_workbook, require

MAX_BYTES = 10 * 1024 * 1024
MAX_UNCOMPRESSED = 80 * 1024 * 1024


def check_archive(payload: bytes) -> None:
    require(len(payload) <= MAX_BYTES, "Workbook exceeds 10 MiB download limit")
    require(zipfile.is_zipfile(io.BytesIO(payload)), "Response is not XLSX (possibly login/error HTML)")
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        require({"[Content_Types].xml", "xl/workbook.xml"}.issubset(archive.namelist()), "Archive is not an Excel workbook")
        require(sum(item.file_size for item in archive.infolist()) <= MAX_UNCOMPRESSED,
                "Workbook exceeds 80 MiB expanded-size limit")


def download(division_id: str = "mixed-a") -> bytes:
    """Read public export with 20-second socket timeout and at most three tries."""
    for attempt in range(3):
        try:
            export_url = DIVISIONS[division_id]["sourceUrl"].replace("/edit", "/export?format=xlsx")
            request = urllib.request.Request(export_url, headers={"User-Agent": "CIU2026-read-only-viewer/1.0"})
            with urllib.request.urlopen(request, timeout=20) as response:
                require(response.geturl().startswith("https://"), "Export redirected outside HTTPS")
                payload = response.read(MAX_BYTES + 1)
            check_archive(payload)
            return payload
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            if attempt == 2:
                raise ImportFailure(f"Download failed after 3 attempts: {exc}") from exc
            time.sleep(2 ** attempt)
    raise AssertionError("unreachable")


def atomic_json(output: Path, data: dict) -> None:
    """Replace only after full parsing/validation; never truncate the prior file."""
    output.parent.mkdir(parents=True, exist_ok=True)
    encoded = json.dumps(data, ensure_ascii=False, allow_nan=False, indent=2) + "\n"
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=output.parent, delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(encoded)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, output)
    finally:
        if temporary and temporary.exists():
            temporary.unlink()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, help="Local XLSX instead of live download")
    parser.add_argument("--fetched-at", help="Required actual download timestamp for a local workbook")
    parser.add_argument("--division", choices=[*DIVISIONS, "all"], help="Default: both live divisions, or Serie A for --input")
    parser.add_argument("--output", type=Path, help="Custom output for one division only")
    args = parser.parse_args()
    try:
        require(not args.input or bool(args.fetched_at), "--input requires its actual --fetched-at timestamp")
        require(args.input is not None or args.fetched_at is None, "Live download determines its own fetched-at timestamp")
        selection = args.division or ("mixed-a" if args.input else "all")
        selected = list(DIVISIONS) if selection == "all" else [selection]
        require(len(selected) == 1 or not (args.input or args.output), "--input/--output require one --division")
        # Validate every requested division before replacing any existing output.
        prepared = []
        for division_id in selected:
            payload = args.input.read_bytes() if args.input else download(division_id)
            check_archive(payload)
            fetched_at = args.fetched_at or datetime.now(timezone.utc).isoformat()
            data = parse_workbook(payload, fetched_at, "frozen" if args.input else "live", division_id=division_id)
            output = args.output or Path("public") / DIVISIONS[division_id]["dataFile"]
            prepared.append((output, data))
        for output, data in prepared:
            atomic_json(output, data)
            print(f"Validated {DIVISIONS[data['division']]['label']}: {len(data['teams'])} teams, {len(data['matches'])} fixtures, {len(data['carryovers'])} carry-overs; wrote {output}")
    except (ImportFailure, OSError, zipfile.BadZipFile) as exc:
        parser.exit(1, f"IMPORT FAILED — previous output preserved: {exc}\n")


if __name__ == "__main__":
    main()
