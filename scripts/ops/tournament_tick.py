#!/usr/bin/env python3
"""One tournament-coverage tick, run as a fresh process by the supervisor.

Why a separate process (phuong an A, 2026-10-24): the daemon is long-lived
and Python caches imported modules in sys.modules, so a `git pull` inside
publish_event only changes files on disk while the daemon keeps running the
old pipeline code in RAM (stale-code incidents 01:00 and 13:00 on 24/10).
A fresh worker imports the whole pipeline from disk on every tick, so new
code takes effect on the very next tick with no daemon restart.

Contract: the worker opens its own Store (same SQLite file the daemon
uses — Store has no RAM read cache, every statement hits the DB, so the
daemon sees the worker's committed tasks/outbox in the same tick), calls
queue_due, and prints exactly one JSON line on stdout:
  {"ok": true, "created": [...]}  on success
  {"ok": false, "error": "..."}   on failure (exit code 1)
Anything queue_due or its callees print goes to stderr, keeping stdout
reserved for the contract line.
"""
from __future__ import annotations

import argparse
import contextlib
import json
import os
import sys
from datetime import datetime
from pathlib import Path


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--now", default=None,
                    help="ISO-8601 timestamp with timezone, from the daemon tick")
    ap.add_argument("--team-home", default=None,
                    help="Override PICKLEHUB_TEAM_HOME (tests only)")
    args = ap.parse_args()
    root = Path(args.team_home or os.environ.get(
        "PICKLEHUB_TEAM_HOME",
        str(Path.home() / "Library/Application Support/PickleHub/team-v2")))
    from team_store import Store
    from team_tournament_coverage import queue_due

    store = Store(root)
    now = datetime.fromisoformat(args.now) if args.now else None
    with contextlib.redirect_stdout(sys.stderr):
        created = queue_due(store, now)
    print(json.dumps({"ok": True, "created": created}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # noqa: BLE001 - the contract line must carry it
        print(json.dumps({"ok": False, "error": f"{type(exc).__name__}: {exc}"},
                         ensure_ascii=False))
        sys.exit(1)
