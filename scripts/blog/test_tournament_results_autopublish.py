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


if __name__ == "__main__":
    unittest.main()
