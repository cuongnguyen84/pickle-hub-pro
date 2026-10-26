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


import os
import shutil
import subprocess
import tempfile


def _git(cwd, *args):
    return subprocess.run(["git", "-C", str(cwd), *args], capture_output=True, text=True, check=True)


@unittest.skipUnless(shutil.which("node") and shutil.which("git"), "needs node + git")
class PublishWorktreeTests(unittest.TestCase):
    """Incident 2026-10-25/26: one unrelated dirty file in the working
    checkout (Localizable.xcstrings, rewritten by an Xcode build) blocked
    every results publish for a full finals day. publish_event must run in
    its own worktree and be immune to the working checkout's state."""

    EVENT = {"key": "test-open-2026", "name": "Test Open", "dates_en": "October 1–3, 2026",
             "dates_vi": "1–3/10/2026", "venue": "Test venue", "source": "/official",
             "slug": "test-open-results", "vi_slug": "ket-qua-test-open",
             "tags": ["test", "results", "2026"], "start_date": "2026-10-01",
             "result_source": "https://example.test/feed", "event_id": "event-1"}

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="autopublish-wt-"))
        self.origin = self.tmp / "origin.git"
        subprocess.run(["git", "init", "--bare", "-b", "main", str(self.origin)], check=True, capture_output=True)
        self.main = self.tmp / "main"
        subprocess.run(["git", "clone", "--quiet", str(self.origin), str(self.main)], check=True, capture_output=True)
        _git(self.main, "config", "user.email", "test@example.com")
        _git(self.main, "config", "user.name", "Test")
        (self.main / "src/content/blog/posts").mkdir(parents=True)
        (self.main / "src/content/blog/metadata.ts").write_text(
            'import type { BlogPostMetadata } from "./types";\n\nexport const blogMetadata: BlogPostMetadata[] = [\n];\n')
        (self.main / "src/content/blog/posts/all.ts").write_text("// barrel\n")
        (self.main / "scripts").mkdir()
        (self.main / "scripts/gen-blog-barrel.mjs").write_text(
            'import { writeFileSync } from "node:fs";\n'
            'writeFileSync(new URL("../src/content/blog/posts/all.ts", import.meta.url), "// barrel regenerated\\n");\n')
        (self.main / "apple").mkdir()
        (self.main / "apple/Localizable.xcstrings").write_text("{}\n")
        _git(self.main, "add", "-A")
        _git(self.main, "commit", "-m", "skeleton")
        _git(self.main, "push", "--quiet", "origin", "main")
        self.team_home = self.tmp / "team-home"
        self.team_home.mkdir()
        self._saved = (autopublish.REPO, autopublish.fetch, autopublish._upsert_vi, os.environ.get("PICKLEHUB_TEAM_HOME"))
        autopublish.REPO = self.main
        autopublish.fetch = lambda url, eid: (feed("final"), self.fp)
        autopublish._upsert_vi = lambda pkg: None
        os.environ["PICKLEHUB_TEAM_HOME"] = str(self.team_home)
        self.fp = "fingerprint-1"

    def tearDown(self):
        autopublish.REPO, autopublish.fetch, autopublish._upsert_vi, saved_home = self._saved
        if saved_home is None:
            os.environ.pop("PICKLEHUB_TEAM_HOME", None)
        else:
            os.environ["PICKLEHUB_TEAM_HOME"] = saved_home
        shutil.rmtree(self.tmp, ignore_errors=True)

    def _origin_has_post(self):
        out = subprocess.run(["git", "--git-dir", str(self.origin), "ls-tree", "-r", "--name-only", "main"],
                             capture_output=True, text=True, check=True).stdout
        return "src/content/blog/posts/test-open-results.ts" in out

    def test_dirty_unrelated_file_and_behind_checkout_cannot_block_publish(self):
        # The incident setup: Xcode-style dirt on an unrelated tracked file,
        # an untracked scratch file, and origin moved ahead by another clone.
        (self.main / "apple/Localizable.xcstrings").write_text('{"dirty": true}\n')
        (self.main / "scratch.txt").write_text("editor scratch\n")
        other = self.tmp / "other"
        subprocess.run(["git", "clone", "--quiet", str(self.origin), str(other)], check=True, capture_output=True)
        _git(other, "config", "user.email", "test@example.com")
        _git(other, "config", "user.name", "Test")
        (other / "README.md").write_text("merged PR\n")
        _git(other, "add", "-A"); _git(other, "commit", "-m", "some PR")
        _git(other, "push", "--quiet", "origin", "main")
        main_head_before = _git(self.main, "rev-parse", "HEAD").stdout.strip()

        result = autopublish.publish_event(dict(self.EVENT), now=datetime(2026, 10, 3, tzinfo=timezone.utc), push=True)

        self.assertEqual(result["status"], "published")
        self.assertTrue(self._origin_has_post())
        # The working checkout was neither cleaned nor committed over.
        self.assertEqual(_git(self.main, "rev-parse", "HEAD").stdout.strip(), main_head_before)
        self.assertIn("Localizable.xcstrings", _git(self.main, "status", "--porcelain").stdout)
        # Same feed again: remembered fingerprint makes it a no-op.
        again = autopublish.publish_event(dict(self.EVENT), now=datetime(2026, 10, 3, tzinfo=timezone.utc), push=True)
        self.assertEqual(again["status"], "unchanged")

    def test_worktree_leftover_from_crashed_run_is_reset_not_blocking(self):
        first = autopublish.publish_event(dict(self.EVENT), now=datetime(2026, 10, 3, tzinfo=timezone.utc), push=True)
        self.assertEqual(first["status"], "published")
        wt = self.team_home / "publish-worktree"
        (wt / "src/content/blog/posts/test-open-results.ts").write_text("half-written garbage")
        (wt / "junk.txt").write_text("leftover\n")
        self.fp = "fingerprint-2"
        second = autopublish.publish_event(dict(self.EVENT), now=datetime(2026, 10, 4, tzinfo=timezone.utc), push=True)
        self.assertEqual(second["status"], "published")
        self.assertFalse((wt / "junk.txt").exists())

    def test_occupied_worktree_path_fails_loudly_with_named_error(self):
        wt = self.team_home / "publish-worktree"
        wt.mkdir()
        (wt / "someone-elses-file.txt").write_text("do not delete\n")
        with self.assertRaises(autopublish.PublishWorktreeError):
            autopublish._prepare_publish_worktree(push=False)
        self.assertTrue((wt / "someone-elses-file.txt").exists())

    def test_published_result_stamps_the_generating_code(self):
        result = autopublish.publish_event(dict(self.EVENT), now=datetime(2026, 10, 3, tzinfo=timezone.utc), push=True)
        self.assertEqual(result["pipeline"], autopublish.PIPELINE_FINGERPRINT)
        self.assertFalse(result["reexec"])


import json
from unittest import mock


class ReexecPublishTests(unittest.TestCase):
    """Re-exec fix (2026-10-26) for the 2026-10-24 stale-code incident:
    a supervisor tick imports this module BEFORE its checkout pull lands,
    so the first publish after a merge generated with pre-merge code.
    publish_event must hand the publish to a fresh process whenever the
    pipeline files on disk no longer match the loaded fingerprint."""

    EVENT = {"key": "test-open-2026", "result_source": "https://example.test/feed", "event_id": "event-1"}

    def _patch(self, **attrs):
        saved = {k: getattr(autopublish, k) for k in attrs}
        for k, v in attrs.items():
            setattr(autopublish, k, v)
        self.addCleanup(lambda: [setattr(autopublish, k, v) for k, v in saved.items()])

    def test_delegate_decision_matrix(self):
        self._patch(_disk_pipeline_fingerprint=lambda: autopublish.PIPELINE_FINGERPRINT)
        self.assertFalse(autopublish._should_delegate_publish())
        self._patch(_disk_pipeline_fingerprint=lambda: "different-fp12")
        self.assertTrue(autopublish._should_delegate_publish())
        # A re-exec child never delegates again, even if the disk moved on.
        with mock.patch.dict(os.environ, {autopublish._REEXEC_ENV: "1"}):
            self.assertFalse(autopublish._should_delegate_publish())

    def test_publish_event_delegates_instead_of_generating_when_stale(self):
        def forbidden_worktree(push):
            raise AssertionError("stale process must not generate locally")
        self._patch(
            fetch=lambda url, eid: (feed("final"), "feed-fp"),
            should_publish=lambda event, fp: True,
            _should_delegate_publish=lambda: True,
            _delegate_publish=lambda event, now, push: {"status": "published", "pipeline": "newfp"},
            _prepare_publish_worktree=forbidden_worktree,
        )
        result = autopublish.publish_event(dict(self.EVENT), now=datetime(2026, 10, 26, tzinfo=timezone.utc), push=True)
        self.assertEqual(result["status"], "published")
        self.assertEqual(result["pipeline"], "newfp")
        self.assertTrue(result["reexec"])

    def test_reexec_child_roundtrip_and_error_reporting(self):
        self._patch(publish_event=lambda event, now=None, push=True: {"status": "published", "head": "abc123"})
        with tempfile.TemporaryDirectory() as td:
            payload, result = Path(td) / "payload.json", Path(td) / "result.json"
            payload.write_text(json.dumps({"event": dict(self.EVENT), "now": "2026-10-26T00:00:00+00:00",
                                           "push": True, "result_path": str(result)}))
            self.assertEqual(autopublish._reexec_main(str(payload)), 0)
            self.assertEqual(json.loads(result.read_text()), {"status": "published", "head": "abc123"})
        def boom(event, now=None, push=True):
            raise ValueError("feed_down")
        self._patch(publish_event=boom)
        with tempfile.TemporaryDirectory() as td:
            payload, result = Path(td) / "payload.json", Path(td) / "result.json"
            payload.write_text(json.dumps({"event": dict(self.EVENT), "now": "2026-10-26T00:00:00+00:00",
                                           "push": True, "result_path": str(result)}))
            self.assertEqual(autopublish._reexec_main(str(payload)), 1)
            self.assertIn("feed_down", json.loads(result.read_text())["error"])

    def test_delegate_spawns_marked_child_and_returns_its_result(self):
        seen = {}
        def fake_run(argv, **kwargs):
            seen["argv"], seen["env"] = argv, kwargs.get("env") or {}
            payload = json.loads(Path(argv[3]).read_text())
            Path(payload["result_path"]).write_text(json.dumps({"status": "published", "pipeline": "childfp"}))
            return subprocess.CompletedProcess(argv, 0, "", "")
        with mock.patch.object(subprocess, "run", fake_run):
            result = autopublish._delegate_publish(dict(self.EVENT), datetime(2026, 10, 26, tzinfo=timezone.utc), True)
        self.assertEqual(result, {"status": "published", "pipeline": "childfp"})
        self.assertEqual(seen["argv"][1:], [str(Path(autopublish.__file__).resolve()), "--reexec-publish", seen["argv"][3]])
        self.assertEqual(seen["env"][autopublish._REEXEC_ENV], "1")

    def test_delegate_child_failure_is_loud_never_a_stale_fallback(self):
        def failing_run(argv, **kwargs):
            payload = json.loads(Path(argv[3]).read_text())
            Path(payload["result_path"]).write_text(json.dumps({"error": "ValueError:feed_down"}))
            return subprocess.CompletedProcess(argv, 1, "", "")
        with mock.patch.object(subprocess, "run", failing_run):
            with self.assertRaisesRegex(RuntimeError, "reexec_publish_failed"):
                autopublish._delegate_publish(dict(self.EVENT), datetime(2026, 10, 26, tzinfo=timezone.utc), True)
        def crashed_run(argv, **kwargs):
            return subprocess.CompletedProcess(argv, 2, "", "segfault-ish")
        with mock.patch.object(subprocess, "run", crashed_run):
            with self.assertRaisesRegex(RuntimeError, "reexec_publish_failed:exit=2"):
                autopublish._delegate_publish(dict(self.EVENT), datetime(2026, 10, 26, tzinfo=timezone.utc), True)


if __name__ == "__main__":
    unittest.main()
