"""Decide whether a Pages event should import data; no third-party dependencies."""

import argparse
from datetime import date, datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

# Inclusive Rome calendar date. Extend here if the organizer postpones fixtures.
SEASON_END = date(2026, 11, 23)


def should_refresh(event: str, now: datetime) -> bool:
    """Push/manual runs bypass the season cutoff; reject naive timestamps/events."""
    if event not in {"schedule", "push", "workflow_dispatch"}:
        raise ValueError(f"Unsupported Pages event: {event}")
    if now.tzinfo is None or now.utcoffset() is None:
        raise ValueError("Refresh policy requires an aware timestamp")
    return event != "schedule" or now.astimezone(ZoneInfo("Europe/Rome")).date() <= SEASON_END


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--event", required=True)
    parser.add_argument("--github-output", type=Path, required=True)
    args = parser.parse_args()
    enabled = should_refresh(args.event, datetime.now(timezone.utc))
    with args.github_output.open("a", encoding="utf-8") as output:
        output.write(f"refresh={str(enabled).lower()}\n")
    print(f"{args.event}: refresh={enabled}; season ends {SEASON_END} inclusive (Europe/Rome)")


if __name__ == "__main__":
    main()
