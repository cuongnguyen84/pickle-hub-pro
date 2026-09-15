"""Durable local control plane. SQLite is authoritative on this single host.

No business tables are mutated. All timestamps are UTC epoch seconds. A run
interrupted by a crash is failed, never automatically replayed as a write.
"""
from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import time
from pathlib import Path


class Store:
    def __init__(self, root: Path):
        self.root = root
        root.mkdir(parents=True, exist_ok=True, mode=0o700)
        os.chmod(root, 0o700)
        self.db = sqlite3.connect(root / "team.sqlite3", timeout=30)
        self.db.row_factory = sqlite3.Row
        self.db.executescript("""
          PRAGMA journal_mode=WAL;
          PRAGMA busy_timeout=30000;
          CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS tasks(
            id INTEGER PRIMARY KEY, dedupe TEXT UNIQUE NOT NULL,
            role TEXT NOT NULL, title TEXT NOT NULL, status TEXT NOT NULL,
            evidence TEXT NOT NULL DEFAULT '{}', created REAL NOT NULL,
            updated REAL NOT NULL, attempts INTEGER NOT NULL DEFAULT 0);
          CREATE TABLE IF NOT EXISTS runs(
            id INTEGER PRIMARY KEY, role TEXT NOT NULL, kind TEXT NOT NULL,
            status TEXT NOT NULL, started REAL NOT NULL, ended REAL,
            reserved REAL NOT NULL DEFAULT 0, cost REAL NOT NULL DEFAULT 0,
            evidence TEXT NOT NULL DEFAULT '{}');
          CREATE TABLE IF NOT EXISTS outbox(
            id INTEGER PRIMARY KEY, dedupe TEXT UNIQUE NOT NULL, body TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending', created REAL NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 0, receipt TEXT, updated REAL NOT NULL);
        """)
        self.db.commit()
        os.chmod(root / "team.sqlite3", 0o600)

    def get(self, key, default=None):
        row = self.db.execute("SELECT value FROM meta WHERE key=?", (key,)).fetchone()
        return json.loads(row[0]) if row else default

    def put(self, key, value):
        with self.db:
            self.db.execute("INSERT INTO meta VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                            (key, json.dumps(value, ensure_ascii=False)))

    def task(self, key, role, title, status="open", evidence=None):
        now = time.time()
        with self.db:
            self.db.execute("""INSERT INTO tasks(dedupe,role,title,status,evidence,created,updated)
              VALUES (?,?,?,?,?,?,?) ON CONFLICT(dedupe) DO UPDATE SET
              role=excluded.role,title=excluded.title,status=excluded.status,
              evidence=excluded.evidence,updated=excluded.updated""",
                            (key, role, title, status, json.dumps(evidence or {}, ensure_ascii=False), now, now))
        return self.db.execute("SELECT id FROM tasks WHERE dedupe=?", (key,)).fetchone()[0]

    def findings(self, check, role, problems, evidence):
        """Only call on a successful measurement, never on collection failure."""
        prefix = f"finding:{check}:"
        with self.db:
            self.db.execute("UPDATE tasks SET status='resolved',updated=? WHERE substr(dedupe,1,?)=? AND status='open'",
                            (time.time(), len(prefix), prefix))
        for key, title in problems.items():
            self.task(prefix + key, role, title, evidence=evidence)

    def begin(self, role, kind, reserve=0.0, daily_limit=10.0, max_calls=12, enforce_limits=True):
        """Reserve budget atomically BEFORE starting the model (rolling 24 h)."""
        try:
            self.db.execute("BEGIN IMMEDIATE")
            if reserve and enforce_limits:
                used, calls = self.db.execute("SELECT COALESCE(SUM(MAX(cost,reserved)),0),COUNT(*) FROM runs WHERE started>? AND reserved>0",
                                              (time.time() - 86400,)).fetchone()
                if used + reserve > daily_limit or calls >= max_calls:
                    self.db.rollback()
                    return None
            cur = self.db.execute("INSERT INTO runs(role,kind,status,started,reserved) VALUES (?,?,'running',?,?)",
                                  (role, kind, time.time(), reserve))
            self.db.commit()
            return cur.lastrowid
        except Exception:
            self.db.rollback()
            raise

    def finish(self, run, status, evidence, cost=0.0):
        with self.db:
            self.db.execute("UPDATE runs SET status=?,ended=?,cost=?,evidence=? WHERE id=? AND status='running'",
                            (status, time.time(), cost, json.dumps(evidence, ensure_ascii=False), run))

    def recover(self):
        # Called only after exclusive process lock: no other managed run is alive.
        with self.db:
            self.db.execute("UPDATE runs SET status='interrupted',ended=? WHERE status='running'", (time.time(),))
            self.db.execute("UPDATE tasks SET status='needs_review',updated=? WHERE status='running'", (time.time(),))
            self.db.execute("UPDATE outbox SET status='uncertain',updated=? WHERE status='sending'", (time.time(),))

    def enqueue(self, key, body):
        # Bound one message to Telegram's limit; no multi-part replay ambiguity.
        body = body[:3700]
        with self.db:
            self.db.execute("INSERT OR IGNORE INTO outbox(dedupe,body,created,updated) VALUES (?,?,?,?)",
                            (key, body, time.time(), time.time()))

    def artifact(self, name, body):
        path = self.root / "reports" / name
        path.parent.mkdir(exist_ok=True, mode=0o700)
        tmp = path.with_suffix(path.suffix + ".tmp")
        tmp.write_text(body, encoding="utf-8")
        os.chmod(tmp, 0o600)
        tmp.replace(path)
        return {"path": str(path), "sha256": hashlib.sha256(body.encode()).hexdigest()}

    def summary(self):
        return {
            "tasks": [dict(r) for r in self.db.execute("SELECT id,role,title,status,updated FROM tasks WHERE status NOT IN ('resolved','cancelled') ORDER BY updated DESC LIMIT 30")],
            "runs": [dict(r) for r in self.db.execute("SELECT id,role,kind,status,started,cost FROM runs ORDER BY id DESC LIMIT 20")],
            "delivery": [dict(r) for r in self.db.execute("SELECT id,status,receipt FROM outbox ORDER BY id DESC LIMIT 10")],
            "heartbeat": self.get("heartbeat"), "paused": self.get("paused", False),
        }
