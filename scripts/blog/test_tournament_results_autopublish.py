import copy
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import tournament_results_autopublish as autopublish


def feed(status="scheduled"):
    return {"tournamentId": "event-1", "matches": [{
        "id": "m1", "division": "Men's Singles", "roundNumber": 1,
        "roundLabel": "Round 32", "status": status,
        "teams": [{"players": ["A"], "winner": status == "final", "games": [11]},
                  {"players": ["B"], "winner": status != "final", "games": [7]}]
    }]}


class TournamentAutopublishTests(unittest.TestCase):
    def test_feed_event_and_final_winner_are_required(self):
        autopublish.validate_feed(feed(), "event-1")
        with self.assertRaisesRegex(ValueError, "event_id"):
            autopublish.validate_feed(feed(), "other")
        bad = copy.deepcopy(feed("final")); bad["matches"][0]["teams"][1]["winner"] = True
        with self.assertRaisesRegex(ValueError, "ambiguous"):
            autopublish.validate_feed(bad, "event-1")

    def test_package_never_calls_scheduled_match_a_result(self):
        event = {"name": "Test Open", "dates_en": "October 1–3, 2026", "dates_vi": "1–3/10/2026",
                 "venue": "Test venue", "source": "/official", "slug": "test-open-results",
                 "vi_slug": "ket-qua-test-open", "tags": ["test", "results", "2026"]}
        pkg = autopublish.package(event, feed(), datetime(2026, 10, 1, tzinfo=timezone.utc))
        body = " ".join(s["content"] + " " + " ".join(s.get("listItems", [])) for s in pkg["en"]["sections"])
        self.assertIn("status scheduled", body)
        self.assertNotIn("beat B", body)
        self.assertIn("ThePickleHub", pkg["en"]["sections"][0]["content"])

    def test_titles_do_not_repeat_the_year_and_lead_with_search_name(self):
        event = {"title": "Test Open 2026", "start_date": "2026-10-01", "dates_en": "October 1–3, 2026",
                 "dates_vi": "1–3/10/2026", "source": "/official", "slug": "test-open-2026-results",
                 "vi_slug": "ket-qua-test-open-2026"}
        now = datetime(2026, 10, 1, tzinfo=timezone.utc)
        pkg = autopublish.package(event, feed(), now)
        self.assertEqual(pkg["en"]["metaTitle"], "Test Open Results 2026 | Daily Scores")
        self.assertEqual(pkg["vi"]["title"], "Kết quả Test Open 2026: cập nhật hằng ngày")
        pkg = autopublish.package({**event, "search_name": "PPA Test", "related": [
            {"en": "Schedule", "vi": "Lịch", "path": "/blog/s", "vi_path": "/vi/blog/l"}]}, feed(), now)
        self.assertEqual(pkg["en"]["metaTitle"], "PPA Test Results 2026: Test Open Scores")
        self.assertEqual(pkg["vi"]["sections"][0]["internalLinks"][1]["path"], "/vi/blog/l")
        self.assertNotIn("2026 2026", str(pkg))
        self.assertIn("07:00 Vietnam time", pkg["en"]["sections"][0]["content"])  # 00:00 UTC

    def test_pro_prefixed_division_is_translated(self):
        match = feed()["matches"][0] | {"division": "Pro Men's Singles"}
        self.assertTrue(autopublish._match_line(match, vi=True).startswith("Đơn nam,"))
        match["division"] = "PRO MIXED DOUBLES - MAIN DRAW"
        self.assertTrue(autopublish._match_line(match, vi=True).startswith("Đôi nam nữ,"))
        self.assertTrue(autopublish._match_line(match).startswith("Mixed Doubles,"))


if __name__ == "__main__":
    unittest.main()
