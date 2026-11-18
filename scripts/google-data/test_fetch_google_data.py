import json
import os
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

    def test_gsc_snapshot_includes_sorted_daily_series(self):
        seen_dims = []

        def fake_api(creds, method, url, body=None):
            dims = body["dimensions"]
            seen_dims.append(dims)
            if dims == ["date"]:
                # Deliberately out of order: the builder must sort ascending.
                return {"rows": [
                    {"keys": ["2026-10-24"], "clicks": 9, "impressions": 90, "ctr": 0.1, "position": 6.25},
                    {"keys": ["2026-10-23"], "clicks": 5, "impressions": 50, "ctr": 0.123456, "position": 4.0}]}
            if dims == []:
                return {"rows": [{"clicks": 14, "impressions": 140, "ctr": 0.1, "position": 5.5}]}
            return {"rows": []}
        original = g._api_json
        g._api_json = fake_api
        try:
            snap = g.build_gsc_snapshot(_FakeCreds(), date(2026, 10, 26))
        finally:
            g._api_json = original
        self.assertIn(["date"], seen_dims)
        self.assertEqual(
            snap["daily"],
            [{"date": "2026-10-23", "clicks": 5, "impressions": 50, "ctr": 0.1235, "position": 4.0},
             {"date": "2026-10-24", "clicks": 9, "impressions": 90, "ctr": 0.1, "position": 6.25}])
        # Backward compatibility: every pre-existing key is still present.
        for key in ("totals", "previous_totals", "top_queries", "top_pages", "losing_pages"):
            self.assertIn(key, snap)


    def test_ga4_snapshot_includes_daily_by_source_filtered_and_sorted(self):
        seen_dims = []

        def row(d, s, m, sessions, users):
            return {"dimensionValues": [{"value": d}, {"value": s}, {"value": m}],
                    "metricValues": [{"value": str(sessions)}, {"value": str(users)}]}

        def fake_api(creds, method, url, body=None):
            dims = [d["name"] for d in body["dimensions"]]
            seen_dims.append(dims)
            if dims == ["date", "sessionSource", "sessionMedium"]:
                # Out of order on purpose; "bing" is not a tracked source.
                return {"rows": [
                    row("20261025", "google", "organic", 40, 31),
                    row("20261024", "facebook.com", "referral", 12, 9),
                    row("20261024", "bing", "organic", 3, 3),
                    row("20261024", "(direct)", "(none)", 55, 40),
                    row("20261024", "google", "organic", 38, 30),
                    row("20261024", "google", "cpc", 2, 2),
                    row("20261025", "t.co", "referral", 4, 4)]}
            return {"rows": []}
        original = g._api_json
        g._api_json = fake_api
        try:
            snap = g.build_ga4_snapshot(_FakeCreds(), date(2026, 10, 26))
        finally:
            g._api_json = original
        self.assertIn(["date", "sessionSource", "sessionMedium"], seen_dims)
        self.assertEqual(
            snap["daily_by_source"],
            [{"date": "20261024", "source": "(direct)", "medium": "(none)", "sessions": 55, "users": 40},
             {"date": "20261024", "source": "facebook.com", "medium": "referral", "sessions": 12, "users": 9},
             {"date": "20261024", "source": "google", "medium": "cpc", "sessions": 2, "users": 2},
             {"date": "20261024", "source": "google", "medium": "organic", "sessions": 38, "users": 30},
             {"date": "20261025", "source": "google", "medium": "organic", "sessions": 40, "users": 31},
             {"date": "20261025", "source": "t.co", "medium": "referral", "sessions": 4, "users": 4}])
        # Backward compatibility: every pre-existing key is still present.
        for key in ("totals", "daily", "top_pages", "top_channels"):
            self.assertIn(key, snap)


def _run(*args, **kw):
    return subprocess.run(list(args), check=True, capture_output=True, text=True, **kw).stdout.strip()


class CommitSnapshotsTests(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="google-data-git-"))
        self.origin = self.tmp / "origin.git"
        self.repo = self.tmp / "repo"
        _run("git", "init", "--bare", "-b", "main", str(self.origin))
        _run("git", "clone", "--quiet", str(self.origin), str(self.repo))
        for k, v in [("user.email", "t@example.com"), ("user.name", "T")]:
            _run("git", "-C", str(self.repo), "config", k, v)
        (self.repo / "README.md").write_text("hi\n")
        _run("git", "-C", str(self.repo), "add", "-A")
        _run("git", "-C", str(self.repo), "commit", "-m", "init")
        _run("git", "-C", str(self.repo), "push", "--quiet", "origin", "main")
        (self.repo / "data/google").mkdir(parents=True)
        self.f1 = self.repo / "data/google/gsc-2026-10-26.json"; self.f1.write_text('{"a": 1}\n')
        self.f2 = self.repo / "data/google/ga4-2026-10-26.json"; self.f2.write_text('{"b": 2}\n')

    def _other_clone_pushes_to_main(self, name: str):
        other = self.tmp / f"other-{name}"
        _run("git", "clone", "--quiet", str(self.origin), str(other))
        (other / f"{name}.txt").write_text("x\n")
        _run("git", "-C", str(other), "add", "-A")
        _run("git", "-C", str(other), "-c", "user.email=o@e", "-c", "user.name=O", "commit", "-m", name)
        _run("git", "-C", str(other), "push", "--quiet", "origin", "main")

    def _origin(self, *args):
        return _run("git", "--git-dir", str(self.origin), *args)

    def test_feature_branch_checkout_pushes_onto_origin_main_without_touching_checkout(self):
        # The 2026-11-02 failure: checkout on a dirty feature branch that is
        # not a fast-forward of main, and main has moved since the last pull.
        repo = self.repo
        _run("git", "-C", str(repo), "checkout", "-q", "-b", "feat/x")
        (repo / "feature.txt").write_text("wip\n")
        _run("git", "-C", str(repo), "add", "feature.txt")
        _run("git", "-C", str(repo), "commit", "-m", "feature work")
        (repo / "unrelated.txt").write_text("dirty editor file\n")
        (repo / "README.md").write_text("edited, unstaged\n")
        _run("git", "-C", str(repo), "add", "README.md")  # staged change must survive too
        self._other_clone_pushes_to_main("moved")
        head_before = _run("git", "-C", str(repo), "rev-parse", "HEAD")
        status_before = _run("git", "-C", str(repo), "status", "--porcelain")

        self.assertEqual(g.commit_snapshots(repo, [self.f1, self.f2], date(2026, 10, 26)), "committed")

        files = self._origin("ls-tree", "-r", "--name-only", "main").splitlines()
        self.assertIn("data/google/gsc-2026-10-26.json", files)
        self.assertIn("data/google/ga4-2026-10-26.json", files)
        self.assertIn("moved.txt", files)            # built on the new main tip
        self.assertNotIn("feature.txt", files)       # feature work never leaks
        self.assertNotIn("unrelated.txt", files)
        self.assertEqual(self._origin("show", "main:README.md"), "hi")  # staged edit not pushed
        self.assertEqual(self._origin("log", "-1", "--format=%s", "main"),
                         "data(google): GSC/GA4 snapshot 2026-10-26")
        self.assertEqual(_run("git", "-C", str(repo), "rev-parse", "HEAD"), head_before)
        self.assertEqual(_run("git", "-C", str(repo), "branch", "--show-current"), "feat/x")
        self.assertEqual(_run("git", "-C", str(repo), "status", "--porcelain"), status_before)

        # Identical rerun: unchanged, nothing new on main.
        tip = self._origin("rev-parse", "main")
        self.assertEqual(g.commit_snapshots(repo, [self.f1, self.f2], date(2026, 10, 26)), "unchanged")
        self.assertEqual(self._origin("rev-parse", "main"), tip)

        # Untracked copies are dropped so a later merge of main cannot abort.
        g.drop_untracked_copies(repo, [self.f1, self.f2])
        self.assertFalse(self.f1.exists())
        self.assertTrue((repo / "unrelated.txt").exists())

    def test_race_on_main_is_retried_on_the_new_tip_never_forced(self):
        # pre-push hook simulates someone pushing to main between our fetch
        # and our push, once: first push is rejected non-fast-forward.
        hook = self.repo / ".git/hooks/pre-push"
        marker = self.tmp / "raced"
        other = self.tmp / "other-race"
        _run("git", "clone", "--quiet", str(self.origin), str(other))
        hook.write_text(
            "#!/bin/sh\n"
            f"[ -e '{marker}' ] && exit 0\n"
            f"touch '{marker}'\n"
            f"cd '{other}' && echo r > race.txt && git add race.txt && "
            "git -c user.email=o@e -c user.name=O commit -qm race && git push -q origin main\n")
        hook.chmod(0o755)

        self.assertEqual(g.commit_snapshots(self.repo, [self.f1, self.f2], date(2026, 10, 26)), "committed")
        log = self._origin("log", "--format=%s", "main").splitlines()
        self.assertEqual(log[:2], ["data(google): GSC/GA4 snapshot 2026-10-26", "race"])

    def test_push_failure_is_loud(self):
        _run("git", "-C", str(self.repo), "remote", "set-url", "origin", str(self.tmp / "gone.git"))
        with self.assertRaises(g.GitPushError):
            g.commit_snapshots(self.repo, [self.f1, self.f2], date(2026, 10, 26))


class CaBundleTests(unittest.TestCase):
    """First Mac --selftest failed with CERTIFICATE_VERIFY_FAILED: macOS
    python.org builds have no CA bundle and launchd gives a clean env."""

    def _with_env(self, value, fn):
        saved = os.environ.get("SSL_CERT_FILE")
        if value is None:
            os.environ.pop("SSL_CERT_FILE", None)
        else:
            os.environ["SSL_CERT_FILE"] = value
        try:
            return fn()
        finally:
            if saved is None:
                os.environ.pop("SSL_CERT_FILE", None)
            else:
                os.environ["SSL_CERT_FILE"] = saved

    def _fake_certifi(self, path):
        import types
        fake = types.ModuleType("certifi")
        fake.where = lambda: str(path)
        saved = sys.modules.get("certifi")
        sys.modules["certifi"] = fake
        self.addCleanup(lambda: sys.modules.__setitem__("certifi", saved) if saved else sys.modules.pop("certifi", None))

    def _run_and_capture(self, env_value):
        seen = {}
        def fn():
            g._ensure_ca_bundle()
            seen["v"] = os.environ.get("SSL_CERT_FILE")
        self._with_env(env_value, fn)
        return seen["v"]

    def test_missing_env_is_filled_from_certifi(self):
        bundle = Path(tempfile.mkdtemp()) / "cacert.pem"; bundle.write_text("x")
        self._fake_certifi(bundle)
        self.assertEqual(self._run_and_capture(None), str(bundle))

    def test_bogus_env_path_is_replaced(self):
        bundle = Path(tempfile.mkdtemp()) / "cacert.pem"; bundle.write_text("x")
        self._fake_certifi(bundle)
        self.assertEqual(self._run_and_capture("/does/not/exist.pem"), str(bundle))

    def test_valid_env_is_left_untouched(self):
        bundle = Path(tempfile.mkdtemp()) / "cacert.pem"; bundle.write_text("x")
        other = Path(tempfile.mkdtemp()) / "other.pem"; other.write_text("y")
        self._fake_certifi(bundle)
        self.assertEqual(self._run_and_capture(str(other)), str(other))


if __name__ == "__main__":
    unittest.main()
