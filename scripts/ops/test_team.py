"""Failure-path tests for the controller; no network, no model, no live writes."""
import json
import os
import sqlite3
import sys
import tempfile
import time
import unittest
import subprocess
import urllib.error
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent))
from team_store import Store
import team_supervisor as team
from team_workspace import permitted
import team_codex
import team_progress
import team_install as installer


class StoreTests(unittest.TestCase):
    def test_digest_does_not_call_analysis_an_owner_approval(self):
        self.store.task('telegram:1', 'engineering', 'Cập nhật bài', 'awaiting_review', {})
        self.store.task('telegram:2', 'chief', 'team inbox', 'queued', {'request': 'team inbox'})
        self.store.put('analysis:chief', {'run': 123, 'date': '2026-09-14'})
        report = team.digest(self.store)
        self.assertIn('CÒN 1 VIỆC', report)
        self.assertIn('cần đội kiểm chứng', report)
        self.assertIn('cho phép tự đăng', report)
        self.assertNotIn('#123', report)
        self.assertNotIn('awaiting_review', report)
        self.assertLessEqual(len(report), 3700)

    def test_report_accepts_task_and_telegram_codes_with_path_only_evidence(self):
        artifact = self.store.artifact('report.md', 'Nội dung kiểm chứng')
        tid = self.store.task('telegram:900', 'engineering', 'Bài viết', 'awaiting_review', artifact)
        for code in (f'T{tid}', 'XL900'):
            cid = self.store.task(f'control:{code}', 'chief', 'report', 'queued', {})
            task = self.store.db.execute('SELECT * FROM tasks WHERE id=?', (cid,)).fetchone()
            with patch.object(team, 'ROOT', Path(self.tmp.name)):
                team.handle_control(self.store, task, f'team report {code}')
            body = self.store.db.execute('SELECT body FROM outbox WHERE dedupe=?', (f'control:{cid}',)).fetchone()[0]
            self.assertEqual(body, f'BÁO CÁO · T{tid}\nNội dung kiểm chứng')

    def test_report_rejects_path_outside_runtime(self):
        tid = self.store.task('telegram:900', 'engineering', 'Bài viết', 'awaiting_review', {'path': __file__})
        task = self.store.db.execute('SELECT * FROM tasks WHERE id=?', (tid,)).fetchone()
        with patch.object(team, 'ROOT', Path(self.tmp.name)):
            team.handle_control(self.store, task, f'team report T{tid}')
        body = self.store.db.execute('SELECT body FROM outbox').fetchone()[0]
        self.assertIn('Chưa có báo cáo', body)

    def test_opus_and_no_cli_dollar_cap(self):
        argv = team.ai_command("test")
        self.assertEqual(argv[argv.index("--model") + 1], "opus")
        self.assertNotIn("--max-budget-usd", argv)

    def test_disabled_internal_cap_preserves_history_without_blocking(self):
        self.store.begin("chief", "analysis", .75, 1, 1)
        self.assertIsNone(self.store.begin("chief", "analysis", .75, 1, 1))
        self.assertIsNotNone(self.store.begin("chief", "analysis", .75, 1, 1, enforce_limits=False))
        self.assertEqual(self.store.db.execute("SELECT COUNT(*) FROM runs").fetchone()[0], 2)
    def test_claude_first_only_falls_back_on_quota(self):
        self.store.put("provider_policy", "claude_first")
        self.store.put("provider", "codex")
        self.assertEqual(team.select_provider(self.store), "claude")
        self.assertFalse(team.provider_failure(self.store, {"result": "network error"}))
        self.assertEqual(self.store.get("provider"), "claude")
        team.provider_failure(self.store, {"result": "You're out of usage credits."})
        self.assertEqual(self.store.get("provider"), "codex")
        self.store.put("provider_blocked_until", time.time() - 1)
        self.assertEqual(team.select_provider(self.store), "claude")

    def test_claude_auth_failure_does_not_use_codex(self):
        self.store.put("provider_policy", "claude_first")
        team.provider_failure(self.store, {"result": "Not logged in"})
        self.assertEqual(team.select_provider(self.store), "claude")
        self.assertFalse(team.provider_available(self.store))
        self.assertFalse(team.claude_quota_exhausted({"result": "Rate limit exceeded"}))

    def test_analysis_quota_keeps_original_request_for_fallback(self):
        self.store.put("provider_policy", "claude_first")
        tid = self.store.task("telegram:900", "chief", "request", "queued", {"request": "original", "telegram_id": 900})
        response = {"is_error": True, "result": "You're out of usage credits.", "total_cost_usd": 0, "usage": {"input_tokens": 0, "output_tokens": 0}}
        with patch.object(team, "ROOT", Path(self.tmp.name)), patch.object(team, "flush"), patch.object(team, "command", return_value=(0, json.dumps(response), "")):
            result = team.analyze(self.store, "chief", "original", tid)
        self.assertTrue(result["deferred"])
        self.assertEqual(self.store.get("provider"), "codex")
        task = self.store.db.execute("SELECT * FROM tasks WHERE id=?", (tid,)).fetchone()
        self.assertEqual(task["status"], "queued")
        self.assertEqual(json.loads(task["evidence"])["request"], "original")

    def test_progress_snapshot_excludes_inbox_and_reports_block(self):
        self.store.task("telegram:140", "chief", "inbox", "queued", {"request": "team inbox"})
        tid = self.store.task("telegram:136", "chief", "update", "queued", {"telegram_id": 136})
        self.store.put("paused", True)
        snap = team_progress.snapshot(self.store)
        self.assertEqual(len(snap["tasks"]), 1)
        self.assertEqual(snap["tasks"][0]["id"], tid)
        self.assertIn("bảo trì", snap["tasks"][0]["reason"])
        self.assertEqual(team_progress.target(self.store, "XL136")["id"], tid)

    def test_progress_preserves_decision_and_does_not_invent_heartbeat(self):
        tid = self.store.task('telegram:2', 'community', 'Rights', 'open', {})
        self.store.put(f'progress:{tid}', {'decision': {'summary': 'Need evidence', 'instructions': 'Provide source'}})
        snap = team_progress.snapshot(self.store)
        self.assertTrue(snap['heartbeat_at'].startswith('1970-01-01'))
        self.assertEqual(snap['tasks'][0]['owner'], 'community')
        self.assertEqual(snap['tasks'][0]['decision']['summary'], 'Need evidence')

    def test_every_outbox_response_has_navigation_and_no_approval_inferred(self):
        keyboard = team_progress.reply_keyboard('T62 failed. T62 needs checking; approve all')
        rows = keyboard['inline_keyboard']
        self.assertEqual(rows[0][0]['callback_data'], 'progress|T62')
        self.assertEqual(len(rows), 2)
        self.assertNotIn('approve', json.dumps(keyboard))
        self.assertTrue(team_progress.reply_keyboard('No task code')['inline_keyboard'])

    def test_workspace_failure_keeps_original_request_and_remote_id(self):
        from team_workspace import draft
        evidence = {'request': 'engineering Fix original issue', 'telegram_id': 149}
        tid = self.store.task('telegram:149', 'engineering', 'Original', 'queued', evidence)
        with patch.object(team, 'ROOT', Path(self.tmp.name)), patch.object(team, 'flush'), patch.object(team, 'provider_available', return_value=True), patch.object(team, 'command', return_value=(1, '', '')):
            result = draft(self.store, 'engineering', evidence['request'], tid)
        self.assertIn('error', result)
        row = self.store.db.execute('SELECT evidence FROM tasks WHERE id=?', (tid,)).fetchone()
        saved = json.loads(row[0])
        self.assertEqual(saved['request'], evidence['request'])
        self.assertEqual(saved['telegram_id'], 149)

    def test_priority_control_does_not_duplicate_or_bypass_budget(self):
        tid = self.store.task("telegram:136", "chief", "update", "queued", {})
        control = self.store.task("telegram:150", "chief", "priority", "queued", {"request": f"team priority T{tid}"})
        team.work_queue(self.store, False)
        self.assertTrue(self.store.get(f"priority:{tid}"))
        self.assertEqual(self.store.db.execute("SELECT COUNT(*) FROM tasks").fetchone()[0], 2)
        self.assertEqual(self.store.db.execute("SELECT status FROM tasks WHERE id=?", (control,)).fetchone()[0], "resolved")

    def test_codex_parser_requires_completed_turn(self):
        message = json.dumps({"type": "item.completed", "item": {"type": "agent_message", "text": "draft"}})
        self.assertTrue(team_codex.parse(0, message)["is_error"])
        response = team_codex.parse(0, message + '\n' + json.dumps({"type": "turn.completed", "usage": {"output_tokens": 3}}))
        self.assertFalse(response["is_error"])
        self.assertIsNone(response["total_cost_usd"])
        self.assertEqual(response["usage"]["output_tokens"], 3)

    def test_codex_scope_and_no_session_resume(self):
        args = team_codex.argv("hello")
        self.assertIn("--ignore-user-config", args)
        self.assertIn("read-only", args)
        self.assertIn("--ephemeral", args)
        self.assertNotIn("resume", args)
        self.assertNotIn("--dangerously-bypass-approvals-and-sandbox", args)

    def test_provider_control_bypasses_claude_circuit(self):
        self.store.put("provider_blocked_until", time.time() + 3600)
        tid = self.store.task("telegram:200", "chief", "switch", "queued", {"request": "team provider codex"})
        with patch.object(team, "analyze") as model:
            team.work_queue(self.store, False)
        model.assert_not_called()
        self.assertEqual(self.store.get("provider"), "codex")
        self.assertTrue(team.provider_available(self.store))
        self.assertEqual(self.store.db.execute("SELECT status FROM tasks WHERE id=?", (tid,)).fetchone()[0], "resolved")

    def test_blocked_provider_notifies_each_task_once(self):
        self.store.put("provider_blocked_until", time.time() + 3600)
        for i in (1, 2):
            self.store.task(f"telegram:{i}", "chief", "job", "queued", {"request": "do job"})
        team.work_queue(self.store, True)
        team.work_queue(self.store, True)
        self.assertEqual(self.store.db.execute("SELECT COUNT(*) FROM outbox").fetchone()[0], 2)

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.tmp.name))

    def tearDown(self):
        self.store.db.close()
        self.tmp.cleanup()

    def test_wriai_drafts_become_one_editorial_task_each(self):
        rows = [{"id": "11111111-aaaa", "title": "Sân TP.HCM", "slug": "San-TPHCM!", "content_markdown": "x" * 20000}]
        with patch.object(team, "rest", return_value=rows) as rest:
            team.queue_wriai(self.store)
            self.store.put("wriai_poll", 0)
            team.queue_wriai(self.store)
            team.queue_wriai(self.store)  # throttled: no third read
        self.assertEqual(rest.call_count, 2)
        self.assertNotIn("POST", str(rest.call_args_list))
        tasks = self.store.db.execute("SELECT * FROM tasks WHERE dedupe LIKE 'schedule:wriai:%'").fetchall()
        self.assertEqual(len(tasks), 1)
        request = json.loads(tasks[0]["evidence"])["request"]
        self.assertTrue(request.startswith("editorial "))
        self.assertIn("docs/agent-drafts/wriai-san-tphcm.md", request)
        self.assertLess(len(request), 20000)
        self.assertTrue(permitted("docs/agent-drafts/wriai-san-tphcm.md", "editorial"))

    def test_dedup_and_reopen(self):
        self.store.findings("site", "platform", {"down": "Site down"}, {})
        row = self.store.db.execute("SELECT * FROM tasks").fetchone()
        self.store.findings("site", "platform", {}, {})
        self.store.findings("site", "platform", {"down": "Down again"}, {})
        rows = self.store.db.execute("SELECT * FROM tasks").fetchall()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["id"], row["id"])
        self.assertEqual(rows[0]["status"], "open")

    def test_reconcile_does_not_close_other_check(self):
        self.store.findings("site", "platform", {"down": "down"}, {})
        self.store.findings("sports", "sports", {}, {})
        self.assertEqual(self.store.db.execute("SELECT status FROM tasks").fetchone()[0], "open")

    def test_failure_keeps_existing_findings(self):
        self.store.findings("site", "platform", {"down": "down"}, {})
        with patch.object(team, "FAST", {"site"}), patch.object(team, "collect", side_effect=RuntimeError("secret")):
            team.sweep(self.store)
        row = self.store.db.execute("SELECT status FROM tasks WHERE dedupe='finding:site:down'").fetchone()
        self.assertEqual(row[0], "open")
        self.assertFalse(self.store.get("check:site")["ok"])
        self.assertNotIn("secret", self.store.get("check:site")["error"])

    def test_budget_reserves_failed_and_interrupted_calls(self):
        run = self.store.begin("x", "ai", .75, 1.0)
        self.store.finish(run, "failed", {})
        self.assertIsNone(self.store.begin("y", "ai", .75, 1.0))

    def test_two_connections_cannot_overreserve(self):
        other = Store(Path(self.tmp.name))
        try:
            self.assertIsNotNone(self.store.begin("a", "ai", .75, 1.0))
            self.assertIsNone(other.begin("b", "ai", .75, 1.0))
        finally:
            other.db.close()

    def test_caps_call_count(self):
        self.assertIsNotNone(self.store.begin("a", "ai", .01, 10, 1))
        self.assertIsNone(self.store.begin("a", "ai", .01, 10, 1))

    def test_recovery_does_not_replay_writes(self):
        run = self.store.begin("a", "ai")
        self.store.task("t", "a", "write", "running")
        self.store.enqueue("m", "hello")
        with self.store.db:
            self.store.db.execute("UPDATE outbox SET status='sending'")
        self.store.recover()
        self.assertEqual(self.store.db.execute("SELECT status FROM runs WHERE id=?", (run,)).fetchone()[0], "interrupted")
        self.assertEqual(self.store.db.execute("SELECT status FROM tasks").fetchone()[0], "needs_review")
        self.assertEqual(self.store.db.execute("SELECT status FROM outbox").fetchone()[0], "uncertain")

    def test_outbox_timeout_not_retried(self):
        self.store.enqueue("k", "message")
        with patch.object(team, "secret", return_value="test"), patch.object(team.urllib.request, "urlopen", side_effect=TimeoutError) as send:
            team.flush(self.store)
            team.flush(self.store)
        self.assertEqual(send.call_count, 1)
        self.assertEqual(self.store.db.execute("SELECT status FROM outbox").fetchone()[0], "uncertain")

    def test_outbox_dedup(self):
        self.store.enqueue("same", "first")
        self.store.enqueue("same", "again")
        self.assertEqual(self.store.db.execute("SELECT COUNT(*) FROM outbox").fetchone()[0], 1)

    def test_telegram_sender_not_just_chat(self):
        config = {"TELEGRAM_CHAT_ID": "123", "TELEGRAM_ADMIN_ID": None}
        with patch.object(team, "secret", side_effect=lambda key: config.get(key)):
            self.assertTrue(team.authorized({"chat_id": 123, "from_id": 123}))
            self.assertFalse(team.authorized({"chat_id": 123, "from_id": 456}))
            config["TELEGRAM_CHAT_ID"] = "-123"
            self.assertFalse(team.authorized({"chat_id": -123, "from_id": 123}))

    def test_bridge_ack_crash_recovers_without_duplicate_task(self):
        row = {"id": 12, "text": "/xuly hi", "chat_id": 1, "from_id": 1}
        def failing(path, method="GET", data=None):
            if method == "GET":
                return [row]
            raise TimeoutError()
        with patch.object(team, "rest", side_effect=failing), patch.object(team, "authorized", return_value=True):
            with self.assertRaises(TimeoutError):
                team.telegram(self.store)
        with patch.object(team, "rest", side_effect=lambda p, m="GET", d=None: [row] if m == "GET" else []), patch.object(team, "authorized", return_value=True):
            team.telegram(self.store)
        self.assertEqual(self.store.db.execute("SELECT COUNT(*) FROM tasks").fetchone()[0], 1)

    def test_pause_control_works_without_ai(self):
        self.store.task("telegram:1", "chief", "pause", "queued", {"request": "team pause"})
        with patch.object(team, "analyze") as analyze:
            team.work_queue(self.store, False)
        self.assertTrue(self.store.get("paused"))
        analyze.assert_not_called()

    def test_business_write_guard(self):
        with self.assertRaisesRegex(ValueError, "write_outside"):
            team.rest("shop_orders?id=eq.1", "PATCH", {"status": "paid"})
        with self.assertRaisesRegex(ValueError, "write_outside"):
            team.rest("rpc/any_function", "POST", {})

    def test_queue_filter_has_no_raw_percent(self):
        with patch.object(team, "rest", return_value=[]) as rest:
            team.telegram(self.store)
        self.assertNotIn("%", rest.call_args.args[0])
        self.assertIn("text.ilike./xuly*", rest.call_args.args[0])

    def test_exhausted_provider_stops_model_calls(self):
        self.assertTrue(team.provider_failure(self.store, {"result": "You're out of usage credits."}))
        self.assertFalse(team.provider_available(self.store))
        with patch.object(team, "command") as call:
            self.assertIsNone(team.analyze(self.store, "platform"))
        call.assert_not_called()

    def test_tools_disabled_not_only_permission_hint(self):
        args = team.ai_command("data")
        self.assertEqual(args[args.index("--tools") + 1], "")
        self.assertIn("--strict-mcp-config", args)
        self.assertIn("--safe-mode", args)
        self.assertNotIn("bypassPermissions", args)

    def test_model_payload_keeps_later_sources(self):
        payload = team.model_bundle({"jobs": {"ok": True, "measured_at": 1, "data": {"jobs": [{"message": "x" * 10000}] * 20}}, "commerce": {"ok": False, "error": "unavailable"}})
        self.assertEqual(payload["commerce"]["error"], "unavailable")
        self.assertTrue(payload["jobs"]["truncated"])
        json.loads(json.dumps(payload))

    def test_bridge_competing_consumer_does_not_execute_twice(self):
        row = {"id": 15, "text": "/xuly fix it", "chat_id": 1, "from_id": 1}
        with patch.object(team, "rest", side_effect=lambda p, m="GET", d=None: [row] if m == "GET" else []), patch.object(team, "authorized", return_value=True):
            team.telegram(self.store)
        self.assertEqual(self.store.db.execute("SELECT status FROM tasks").fetchone()[0], "needs_review")

    def test_sensitive_data_scrubbed(self):
        result = team.scrub({"data": "eyJ" + "a" * 80, "email": "person@example.com"})
        self.assertNotIn("aaaa", result["data"])
        self.assertEqual(result["email"], "[REDACTED_EMAIL]")

    def test_policy_blocks_traversal_and_sensitive_surfaces(self):
        for path in ["/tmp/src/a.ts", "src/../a.ts", "src/hooks/useAuth.tsx", "src/payment/x.ts", "src/integrations/x.ts", "supabase/migrations/x.sql", ".github/workflows/a.yml"]:
            self.assertFalse(permitted(path, "engineering"), path)
        self.assertTrue(permitted("src/components/Button.tsx", "engineering"))
        self.assertTrue(permitted("docs/agent-drafts/post.md", "editorial"))
        self.assertFalse(permitted("src/content/blog/posts/post.ts", "editorial"))

    def test_artifact_is_private_and_hash_bound(self):
        artifact = self.store.artifact("run-1.md", "hello")
        self.assertEqual(Path(artifact["path"]).stat().st_mode & 0o777, 0o600)
        self.assertEqual(len(artifact["sha256"]), 64)


class InstallerTests(unittest.TestCase):
    def test_running_legacy_is_not_stopped(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "launch").mkdir()
            calls = []
            def ctl(*args):
                calls.append(args)
                return subprocess.CompletedProcess(args, 0, "state = running", "")
            with patch.object(installer, "ROOT", root / "state"), patch.object(installer, "LAUNCH", root / "launch"), patch.object(installer, "ctl", side_effect=ctl):
                with self.assertRaisesRegex(RuntimeError, "is running"):
                    installer.install()
            self.assertFalse(any(c[0] == "bootout" for c in calls))

    def test_failed_bootstrap_restores_retired_jobs(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            repo, launch = root / "repo", root / "launch"
            ops = repo / "scripts/ops"
            (ops / "launchagents").mkdir(parents=True)
            launch.mkdir()
            files = ["team_actions.py", "team_measure.py", "chief_brief.py", "content_agent.py", "ops_sweep.py", "xuly_daemon.py", "fix_agent_daemon.py", "team_supervisor.py", "team_store.py", "team_workspace.py", "team_codex.py", "team_progress.py", "team_verification.py", "team_seo.py", "team_content.py", "team_wriai.py", "team_content_plan.json", "team_roles.json", "team_watchdog.py", "team_ga4.py"]
            for name in files:
                (ops / name).write_text("fixture")
            for label in installer.OLD:
                (launch / f"{label}.plist").write_text("fixture plist")
            calls = []
            def ctl(*args):
                calls.append(args)
                code = 1 if args[0] == "bootstrap" and str(args[-1]).endswith("com.picklehub.team-v2.plist") else 0
                return subprocess.CompletedProcess(args, code, "state = not running", "")
            with patch.object(installer, "ROOT", root / "state"), patch.object(installer, "REPO", repo), patch.object(installer, "LAUNCH", launch), patch.object(installer, "ctl", side_effect=ctl):
                with self.assertRaisesRegex(RuntimeError, "could not load"):
                    installer.install()
            for label in installer.OLD:
                self.assertTrue(any(c[0] == "bootstrap" and str(c[-1]).endswith(f"{label}.plist") for c in calls))
                self.assertTrue((launch / f"{label}.plist").exists())
            self.assertFalse((launch / "com.picklehub.team-v2.plist").exists())

    def test_recovery_services_are_not_in_retirement_set(self):
        self.assertNotIn("com.picklehub.edge-redeploy-hourly", installer.OLD)
        self.assertNotIn("com.picklehub.fix-agent", installer.OLD)


if __name__ == "__main__":
    unittest.main()
