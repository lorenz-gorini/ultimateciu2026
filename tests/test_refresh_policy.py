"""Synthetic timestamps only; no network or source workbook mutation."""

import unittest
from datetime import datetime

from scripts.refresh_policy import should_refresh


class RefreshPolicyTests(unittest.TestCase):
    def test_schedule_in_season_and_at_rome_midnight(self) -> None:
        for stamp, expected in [
            ("2026-10-24T22:30:00+00:00", True),  # Rome DST match day
            ("2026-11-23T22:59:59+00:00", True),
            ("2026-11-23T23:00:00+00:00", False),  # Nov 24 in Rome
            ("2026-12-01T00:00:00+00:00", False),
        ]:
            with self.subTest(stamp=stamp):
                self.assertEqual(should_refresh("schedule", datetime.fromisoformat(stamp)), expected)

    def test_manual_and_push_bypass_cutoff(self) -> None:
        for event in ("push", "workflow_dispatch"):
            self.assertTrue(should_refresh(event, datetime.fromisoformat("2027-01-01T00:00:00+00:00")))

    def test_invalid_event_and_naive_time_fail(self) -> None:
        with self.assertRaises(ValueError):
            should_refresh("pull_request", datetime.fromisoformat("2026-11-01T00:00:00+00:00"))
        with self.assertRaises(ValueError):
            should_refresh("schedule", datetime(2026, 11, 1))
