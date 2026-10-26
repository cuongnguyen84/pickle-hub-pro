import json
import subprocess
import sys
import tempfile
import unittest
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import fetch_google_data as g


class PeriodTests(unittest.TestCase):
    def test_gsc_periods_are_28_days_with_lag_and_a_clean_previous_block(self):
        (start, end), (pstart, pend) = g.gsc_periods(date(2026, 10, 26))
        self.assertEqual(end, date(2026, 10, 24))          # 2-day GSC lag
        self.assertEqual((end - start).days, 27)           # 28 days inclusive
        self.assertEqual(pend, date(2026, 9, 26))          # day before the current block
        self.assertEqual((pend - pstart).days, 27)

    def test_ga4_period_is_28_days_ending_yesterday(self):
        start, end = g.ga4_period(date(2026, 10, 26))
        self.assertEqual(end, date(2026, 10, 25))
        self.assertEqual((end - start).days, 27)


class LosingPagesTests(unittest.TestCase):
    def test_click_drops_ranked_and_vanished_pages_included(self):
        now = [{"keys": ["/a"], "clicks": 10, "impressions": 100},
               {"keys": ["/b"], "clicks": 50, "impressions": 100},
               {"keys": ["/c"], "clicks": 5, "impressions": 10}]
        before = [{"keys": ["/a"], "clicks": 40, "impressions": 90},
                  {"keys": ["/b"], "clicks": 30, "impressions": 90},
                  {"keys": ["/gone"], "clicks": 12, "impressions": 40}]
        out = g.losing_pages(now, before)
        pages = [r["page"] for r in out]
        self.assertEqual(pages, ["/a", "/gone"])           # -30 then -12; /b grew, /c is new
        self.assertEqual(out[0]["delta"], -30)
        self.assertEqual(out[1]["clicks"], 0)


class BodyBuilderTests(unittest.TestCase):
    def test_gsc_query_body_shape(self):
        body = g.gsc_query_body(date(2026, 9, 27), date(2026, 10, 24), ["query"], 25)
        self.assertEqual(body["startDate"], "2026-09-27")
        self.assertEqual(body["dimensions"], ["query"])
        self.assertEqual(body["dataState"], "final")

    def test_ga4_report_body_shape_and_ordering(self):
        body = g.ga4_report_body(date(2026, 9, 28), date(2026, 10, 25),
                                 ["pagePath"], ["screenPageViews"], order_metric="screenPageViews", limit=25)
        self.assertEqual(body["dimensions"], [{"name": "pagePath"}])
        self.assertEqual(body["orderBys"], [{"metric": {"metricName": "screenPageViews"}, "desc": True}])
        self.assertEqual(body["limit"], 25)


class _FakeCreds:
    token = "fake-token"


class SnapshotShapeTests(unittest.TestCase):
    """build_*_snapshot with the HTTP layer stubbed: no real API calls."""

    def test_ga4_snapshot_aggregates_daily_rows(self):
        def fake_api(creds, method, url, body=None):
            dims = [d["name"] for d in body["dimensions"]]
            if dims == ["date"]:
                return {"rows": [
                    {"dimensionValues": [{"value": "20261024"}],
                     "metricValues": [{"value": "10"}, {"value": "7"}, {"value": "30"}]},
                    {"dimensionValues": [{"value": "20261025"}],
                     "metricValues": [{"value": "5"}, {"value": "4"}, {"value": "12"}]}]}
            return {"rows": []}
        original = g._api_json
        g._api_json = fake_api
        try:
            snap = g.build_ga4_snapshot(_FakeCreds(), date(2026, 10, 26))
        finally:
            g._api_json = original
        self.assertEqual(snap["totals"], {"sessions": 15, "users": 11, "views": 42})
        self.assertEqual([r["date"] for r in snap["daily"]], ["20261024", "20261025"])
        self.assertEqual(snap["period"]["end"], "2026-10-25")

    def test_gsc_snapshot_totals_and_losers_from_stubbed_rows(self):
        calls = []

        def fake_api(creds, method, url, body=None):
            calls.append(body)
            dims = body["dimensions"]
            if dims == []:
                clicks = 100 if body["startDate"] == "2026-09-27" else 160
                return {"rows": [{"clicks": clicks, "impressions": 1000, "ctr": 0.1, "position": 5.5}]}
            if dims == ["query"]:
                return {"rows": [{"keys": ["pickleball"], "clicks": 40, "impressions": 300, "ctr": 0.13, "position": 3.2}]}
            if body["startDate"] == "2026-09-27":
                return {"rows": [{"keys": ["/blog/x"], "clicks": 10, "impressions": 100, "ctr": 0.1, "position": 4.0}]}
            return {"rows": [{"keys": ["/blog/x"], "clicks": 30, "impressions": 120, "ctr": 0.25, "position": 4.0}]}
        original = g._api_json
        g._api_json = fake_api
        try:
            snap = g.build_gsc_snapshot(_FakeCreds(), date(2026, 10, 26))
        finally:
            g._api_json = original
        self.assertEqual(snap["totals"]["clicks"], 100)
        self.assertEqual(snap["previous_totals"]["clicks"], 160)
        self.assertEqual(snap["top_queries"][0]["query"], "pickleball")
        self.assertEqual(snap["losing_pages"][0]["page"], "/blog/x")
        self.assertEqual(snap["losing_pages"][0]["delta"], -20)


class CommitSnapshotsTests(unittest.TestCase):
    def test_pathspec_commit_ignores_unrelated_dirt_and_push_failure_is_loud(self):
        tmp = Path(tempfile.mkdtemp(prefix="google-data-git-"))
        origin = tmp / "origin.git"
        repo = tmp / "repo"
        subprocess.run(["git", "init", "--bare", "-b", "main", str(origin)], check=True, capture_output=True)
        subprocess.run(["git", "clone", "--quiet", str(origin), str(repo)], check=True, capture_output=True)
        for args in [("config", "user.email", "t@example.com"), ("config", "user.name", "T")]:
            subprocess.run(["git", "-C", str(repo), *args], check=True)
        (repo / "README.md").write_text("hi\n")
        subprocess.run(["git", "-C", str(repo), "add", "-A"], check=True)
        subprocess.run(["git", "-C", str(repo), "commit", "-m", "init"], check=True, capture_output=True)
        subprocess.run(["git", "-C", str(repo), "push", "--quiet", "origin", "main"], check=True)

        (repo / "data/google").mkdir(parents=True)
        f1 = repo / "data/google/gsc-2026-10-26.json"; f1.write_text('{"a": 1}\n')
        f2 = repo / "data/google/ga4-2026-10-26.json"; f2.write_text('{"b": 2}\n')
        (repo / "unrelated.txt").write_text("dirty editor file\n")  # must NOT be committed

        self.assertEqual(g.commit_snapshots(repo, [f1, f2], date(2026, 10, 26)), "committed")
        shown = subprocess.run(["git", "--git-dir", str(origin), "show", "--stat", "--format=", "main"],
                               capture_output=True, text=True, check=True).stdout
        self.assertIn("gsc-2026-10-26.json", shown)
        self.assertNotIn("unrelated.txt", shown)
        status = subprocess.run(["git", "-C", str(repo), "status", "--porcelain"],
                                capture_output=True, text=True, check=True).stdout
        self.assertIn("unrelated.txt", status)  # still dirty, untouched

        # Second run with identical content: unchanged, no error.
        self.assertEqual(g.commit_snapshots(repo, [f1, f2], date(2026, 10, 26)), "unchanged")

        # Break the remote: push must raise, not pass silently.
        subprocess.run(["git", "-C", str(repo), "remote", "set-url", "origin", str(tmp / "gone.git")], check=True)
        (repo / "data/google/gsc-2026-10-26.json").write_text('{"a": 2}\n')
        with self.assertRaises(g.GitPushError):
            g.commit_snapshots(repo, [f1, f2], date(2026, 10, 26))


if __name__ == "__main__":
    unittest.main()
