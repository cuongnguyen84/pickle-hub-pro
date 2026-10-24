"""Tests for the tournament_tick worker (phuong an A, 2026-10-24).

The daemon is long-lived and Python caches modules in sys.modules, so the
coverage tick must run in a fresh worker process per tick. These tests
prove, without ever restarting the test process itself, that:
  1. a worker run loads the pipeline module from disk as it is NOW, and a
     later run loads the NEW on-disk version (fresh-code proof);
  2. a failing worker surfaces as a RuntimeError through the daemon's
     dispatch helper, with the worker's error text;
  3. the real worker + real (decoded) coverage module run end to end with
     a paused store — no network, git, or push side effects.

The repo stores team_tournament_coverage.py as base64 text, so the tests
decode it into a temp dir (never committed) alongside copies of the worker
and team_store. Production on the Mac imports the same module exactly the
way the daemon always has; this PR does not touch that file in any form.
"""
import base64
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

OPS = Path(__file__).resolve().parent
NOW = "2026-10-24T13:00:00+07:00"

STUB = '''
def queue_due(store, now=None, config=None, fetcher=None):
    version = (Path(__file__).resolve().parent / "version.txt").read_text().strip()
    store.put("tick-proof", {"version": version})
    return [123]
'''

RAISING_STUB = '''
def queue_due(store, now=None, config=None, fetcher=None):
    raise RuntimeError("boom-test")
'''


class TournamentTickTests(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.team_home = self.tmp / "team"
        self.env = dict(os.environ)
        self.env["PICKLEHUB_TEAM_HOME"] = str(self.team_home)
        self.env["PICKLEHUB_REPO"] = str(self.tmp)

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def _worker_dir(self, coverage_src):
        d = self.tmp / "worker"
        d.mkdir(exist_ok=True)
        shutil.copy(OPS / "tournament_tick.py", d / "tournament_tick.py")
        shutil.copy(OPS / "team_store.py", d / "team_store.py")
        (d / "team_tournament_coverage.py").write_text(coverage_src)
        return d

    def _run_worker(self, worker_dir):
        return subprocess.run(
            [sys.executable, str(worker_dir / "tournament_tick.py"), "--now", NOW],
            capture_output=True, text=True, timeout=60, env=self.env)

    def _store(self):
        sys.path.insert(0, str(OPS))
        from team_store import Store
        return Store(self.team_home)

    def test_worker_loads_new_on_disk_code_without_parent_restart(self):
        d = self._worker_dir("from pathlib import Path\n" + STUB)
        (d / "version.txt").write_text("v1")
        proc = self._run_worker(d)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertEqual(proc.stdout.count("\n"), 1, "stdout must be exactly the contract line")
        result = json.loads(proc.stdout)
        self.assertTrue(result["ok"])
        self.assertEqual(result["created"], [123])
        self.assertEqual(self._store().get("tick-proof")["version"], "v1")
        # Change the pipeline module on disk; the SAME parent process spawns
        # the next worker, which must report the NEW version.
        (d / "version.txt").write_text("v2")
        proc = self._run_worker(d)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertEqual(self._store().get("tick-proof")["version"], "v2")

    def test_dispatch_helper_surfaces_worker_failure(self):
        d = self._worker_dir(RAISING_STUB)
        sys.path.insert(0, str(OPS))
        import team_supervisor as sup
        old_file, old_repo, old_root = sup.__file__, sup.REPO, sup.ROOT
        try:
            sup.__file__ = str(d / "team_supervisor.py")
            sup.REPO, sup.ROOT = self.tmp, self.team_home
            with self.assertRaises(RuntimeError) as ctx:
                sup.run_tournament_tick(__import__("datetime").datetime.fromisoformat(NOW))
            self.assertIn("boom-test", str(ctx.exception))
        finally:
            sup.__file__, sup.REPO, sup.ROOT = old_file, old_repo, old_root

    def test_real_coverage_smoke_with_paused_store(self):
        d = self._worker_dir(base64.b64decode(
            (OPS / "team_tournament_coverage.py").read_text()).decode())
        (d / "team_tournament_coverage.json").write_text(base64.b64decode(
            (OPS / "team_tournament_coverage.json").read_text()).decode())
        store = self._store()
        store.put("paused", True)
        sys.path.insert(0, str(OPS))
        import team_supervisor as sup
        old_file, old_repo, old_root = sup.__file__, sup.REPO, sup.ROOT
        try:
            sup.__file__ = str(d / "team_supervisor.py")
            sup.REPO, sup.ROOT = self.tmp, self.team_home
            created = sup.run_tournament_tick(
                __import__("datetime").datetime.fromisoformat(NOW))
            self.assertEqual(created, [])
        finally:
            sup.__file__, sup.REPO, sup.ROOT = old_file, old_repo, old_root


if __name__ == "__main__":
    unittest.main()
