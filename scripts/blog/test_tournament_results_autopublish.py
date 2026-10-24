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
        self.assertNotIn("beat B", body)
        self.assertIn("ThePickleHub", pkg["en"]["sections"][0]["content"])
        # A scheduled match ships as a fixture (teamA/teamB), never a result:
        # no winner key anywhere in the boards, and no prose list section.
        boards = [s["resultsBoard"] for s in pkg["en"]["sections"] if s.get("resultsBoard")]
        self.assertTrue(boards)
        match = boards[0]["rounds"][0]["matches"][0]
        self.assertEqual(match, {"teamA": "A", "teamB": "B", "sets": []})
        self.assertFalse(any(s.get("listItems") for s in pkg["en"]["sections"]))

    def test_scheduled_only_package_ships_fixture_boards_and_summary(self):
        event = {"name": "Test Open", "dates_en": "October 1–3, 2026", "dates_vi": "1–3/10/2026",
                 "venue": "Test venue", "source": "/official", "slug": "test-open-results",
                 "vi_slug": "ket-qua-test-open", "tags": ["test", "results", "2026"]}
        pkg = autopublish.package(event, feed(), datetime(2026, 10, 1, tzinfo=timezone.utc))
        summary = pkg["en"]["sections"][0]["resultsSummary"]
        self.assertEqual(len(summary), 1)
        self.assertEqual(summary[0]["note"], "Scheduled · 1 matches")
        self.assertNotIn("champion", summary[0])
        vi_summary = pkg["vi"]["sections"][0]["resultsSummary"]
        self.assertEqual(vi_summary[0]["note"], "Đã lên lịch · 1 trận")
        vi_boards = [s for s in pkg["vi"]["sections"] if s.get("resultsBoard")]
        self.assertEqual(vi_boards[0]["heading"], "Lịch thi đấu Đơn nam")

    def test_fixture_board_orders_rounds_earliest_first(self):
        rows = [self._sched("Quarter Finals", 3), self._sched("Round 32", 1), self._sched("Round 16", 2)]
        board = autopublish._board_fixtures(rows, "Women's Doubles")
        self.assertEqual([r["label"] for r in board["rounds"]], ["Round 32", "Round 16", "Quarter Finals"])
        self.assertTrue(board["rounds"][0]["collapsed"])  # Round 32 collapses
        self.assertNotIn("champion", board)

    def _sched(self, label, round_number):
        return {"id": label, "division": "Women's Doubles", "roundNumber": round_number,
                "roundLabel": label, "status": "scheduled", "dateKey": "2026-11-02",
                "teams": [{"players": ["A"], "winner": False, "games": []},
                          {"players": ["B"], "winner": False, "games": []}]}

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

    def test_generated_seo_strings_stay_within_byte_budgets(self):
        # Regression 2026-10-24: the long search name "PPA World Championships"
        # produced a 63-byte metaTitleEn and turned main CI red
        # (seo-byte-budget hard gate: titles <= 60 bytes, descriptions <= 160).
        event = {"title": "World Championship 2026", "name": "World Championship 2026",
                 "search_name": "PPA World Championships", "start_date": "2026-11-02",
                 "dates_en": "November 2-8, 2026", "dates_vi": "2-8/11/2026",
                 "source": "/official", "slug": "world-championship-2026-results",
                 "vi_slug": "ket-qua-world-championship-2026"}
        pkg = autopublish.package(event, feed(), datetime(2026, 11, 2, tzinfo=timezone.utc))
        self.assertEqual(pkg["en"]["metaTitle"],
                         "PPA World Championships Results 2026: World Championship")
        for value, limit in [(pkg["en"]["metaTitle"], autopublish.SEO_TITLE_MAX_BYTES),
                             (pkg["vi"]["metaTitle"], autopublish.SEO_TITLE_MAX_BYTES),
                             (pkg["en"]["metaDescription"], autopublish.SEO_DESCRIPTION_MAX_BYTES),
                             (pkg["vi"]["metaDescription"], autopublish.SEO_DESCRIPTION_MAX_BYTES)]:
            self.assertLessEqual(len(value.encode("utf-8")), limit)

    def test_pro_prefixed_division_is_translated(self):
        match = feed()["matches"][0] | {"division": "Pro Men's Singles"}
        self.assertTrue(autopublish._match_line(match, vi=True).startswith("Đơn nam,"))
        match["division"] = "PRO MIXED DOUBLES - MAIN DRAW"
        self.assertTrue(autopublish._match_line(match, vi=True).startswith("Đôi nam nữ,"))
        self.assertTrue(autopublish._match_line(match).startswith("Mixed Doubles,"))

    def _final(self, label, round_number, winner="A", loser="B", games_w=(11, 11), games_l=(3, 5)):
        return {"id": label, "division": "Women's Doubles", "roundNumber": round_number,
                "roundLabel": label, "status": "final", "dateKey": "2026-10-23",
                "teams": [{"players": [winner], "winner": True, "games": list(games_w)},
                          {"players": [loser], "winner": False, "games": list(games_l)}]}

    def test_board_groups_rounds_and_collapses_early_rounds(self):
        rows = [self._final("Quarter Finals", 3), self._final("Round 16", 2), self._final("Round 32", 1)]
        board = autopublish._board(rows, "Women's Doubles")
        self.assertEqual([r["label"] for r in board["rounds"]], ["Quarter Finals", "Round 16", "Round 32"])
        self.assertNotIn("collapsed", board["rounds"][0])
        self.assertNotIn("collapsed", board["rounds"][1])  # Round 16 stays open
        self.assertTrue(board["rounds"][2]["collapsed"])  # Round 32 collapses
        match = board["rounds"][0]["matches"][0]
        self.assertEqual(match, {"winner": "A", "loser": "B", "sets": [[11, 3], [11, 5]]})

    def test_board_localizes_rounds_and_derives_champion(self):
        rows = [self._final("Finals", 5, winner="Champ"), self._final("Semi Finals", 4)]
        board = autopublish._board(rows, "Đôi nữ", vi=True)
        self.assertEqual(board["champion"], "Champ")
        self.assertEqual([r["label"] for r in board["rounds"]], ["Chung kết", "Bán kết"])

    def test_anchor_slug_matches_renderer_rule(self):
        self.assertEqual(autopublish._anchor("Women's Doubles"), "rb-womens-doubles")
        self.assertEqual(autopublish._anchor("Đôi nữ"), "rb-doi-nu")
        self.assertEqual(autopublish._anchor("Đôi nam nữ"), "rb-doi-nam-nu")

    def test_draw_sections_ship_board_not_prose_list(self):
        sections = autopublish.draw_sections([self._final("Quarter Finals", 3)])
        self.assertIn("resultsBoard", sections[0])
        self.assertNotIn("listItems", sections[0])

    def test_summaries_carry_anchor_and_status(self):
        rows = [self._final("Semi Finals", 4), self._final("Quarter Finals", 3)]
        en = autopublish.draw_summaries(rows)
        self.assertEqual(en[0]["note"], "Through to the Semi Finals · 2 matches")
        self.assertEqual(en[0]["anchor"], "rb-womens-doubles")
        vi = autopublish.draw_summaries(rows, vi=True)
        self.assertEqual(vi[0]["note"], "Đã tới Bán kết · 2 trận")
        self.assertEqual(vi[0]["anchor"], "rb-doi-nu")

    def test_results_board_guard(self):
        # Incident 2026-10-24: a stale in-memory generator shipped prose
        # for a feed WITH finals. The guard must fire then, and only then.
        event = {"title": "Test Open 2026", "start_date": "2026-10-01", "dates_en": "October 1-3, 2026",
                 "dates_vi": "1-3/10/2026", "source": "/official", "slug": "test-open-2026-results",
                 "vi_slug": "ket-qua-test-open-2026"}
        now = datetime(2026, 10, 1, tzinfo=timezone.utc)
        pkg = autopublish.package(event, feed("final"), now)
        autopublish._assert_results_boards(pkg, feed("final"))
        autopublish._assert_results_boards(pkg, feed("final"), '"resultsBoard": {}')
        with self.assertRaisesRegex(RuntimeError, "results_board_missing_in_output"):
            autopublish._assert_results_boards(pkg, feed("final"), "prose only, no board")
        stale = copy.deepcopy(pkg)
        for lang in ("en", "vi"):
            for section in stale[lang]["sections"]:
                section.pop("resultsBoard", None)
        with self.assertRaisesRegex(RuntimeError, "results_board_missing_in_package"):
            autopublish._assert_results_boards(stale, feed("final"))
        # No completed match yet: the prose fallback is legitimate, no raise.
        early = autopublish.package(event, feed("scheduled"), now)
        autopublish._assert_results_boards(early, feed("scheduled"), "prose only, no board")

    def test_pipeline_fingerprint_is_stable_and_shaped(self):
        fp = autopublish.PIPELINE_FINGERPRINT
        self.assertEqual(len(fp), 12)
        self.assertTrue(all(c in "0123456789abcdef" for c in fp))
        self.assertEqual(fp, autopublish._pipeline_fingerprint())


if __name__ == "__main__":
    unittest.main()
