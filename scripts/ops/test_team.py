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
import team_grok
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
    def test_team_stays_on_grok(self):
        self.store.put("provider_policy", "claude_first")
        self.store.put("provider", "codex")
        self.assertEqual(team.select_provider(self.store), "grok")
        self.assertEqual(self.store.get("provider"), "grok")
        self.assertEqual(self.store.get("provider_policy"), "grok")
        self.assertTrue(team.provider_failure(self.store, {"result": "invalid key"}))
        self.assertEqual(self.store.get("provider"), "grok")
        self.assertFalse(team.provider_available(self.store))

    def test_grok_failure_does_not_call_claude(self):
        self.store.put("provider", "grok")
        team.provider_failure(self.store, {"result": "Not logged in"})
        self.assertEqual(team.select_provider(self.store), "grok")
        self.assertFalse(team.provider_available(self.store))
        self.assertFalse(team.claude_quota_exhausted({"result": "Rate limit exceeded"}))

    def test_grok_failure_keeps_original_request(self):
        tid = self.store.task("telegram:900", "chief", "request", "queued", {"request": "original", "telegram_id": 900})
        response = {"is_error": True, "result": "thiếu XAI_API_KEY", "total_cost_usd": None, "usage": {}}
        with patch.object(team, "ROOT", Path(self.tmp.name)), patch.object(team, "flush"), patch("team_grok.run", return_value=(1, response)), patch.object(team, "command") as call:
            result = team.analyze(self.store, "chief", "original", tid)
        call.assert_not_called()
        self.assertIn("error", result)
        self.assertNotIn("deferred", result)
        self.assertEqual(self.store.get("provider"), "grok")
        task = self.store.db.execute("SELECT * FROM tasks WHERE id=?", (tid,)).fetchone()
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

    def test_grok_parser_rejects_empty_or_http_error(self):
        ok = team_grok.parse(200, json.dumps({"candidates": [{"content": {"parts": [{"text": "báo cáo"}]}}], "usageMetadata": {"candidatesTokenCount": 4}}))
        self.assertFalse(ok["is_error"])
        self.assertEqual(ok["result"], "báo cáo")
        self.assertEqual(ok["provider"], "gemini")
        self.assertEqual(ok["usage"]["completion_tokens"], 4)
        self.assertIsNone(ok["total_cost_usd"])
        denied = team_grok.parse(401, json.dumps({"error": {"message": "invalid key"}}))
        self.assertTrue(denied["is_error"])
        self.assertEqual(denied["result"], "invalid key")
        self.assertNotIn("x-goog-api-key", json.dumps(team_grok.body("hello")))

    def test_grok_switch_and_editorial_stays_report_only(self):
        self.store.put("provider_blocked_until", time.time() + 3600)
        tid = self.store.task("telegram:201", "chief", "switch", "queued", {"request": "team provider grok"})
        with patch.object(team, "analyze") as model:
            team.work_queue(self.store, False)
        model.assert_not_called()
        self.assertEqual(self.store.get("provider"), "grok")
        self.assertEqual(self.store.db.execute("SELECT status FROM tasks WHERE id=?", (tid,)).fetchone()[0], "resolved")
        self.store.task("telegram:202", "editorial", "viết", "queued", {"request": "editorial viết bài"})
        with patch.object(team, "analyze", return_value={"run": 1, "result": "báo cáo"}) as analyze:
            team.work_queue(self.store, True)
        analyze.assert_called()
        self.assertEqual(analyze.call_args.args[0].get("provider"), "grok")

    def test_provider_command_cannot_leave_grok(self):
        self.store.put("provider_blocked_until", time.time() + 3600)
        tid = self.store.task("telegram:200", "chief", "switch", "queued", {"request": "team provider claude"})
        with patch.object(team, "analyze") as model:
            team.work_queue(self.store, False)
        model.assert_not_called()
        self.assertEqual(self.store.get("provider"), "grok")
        self.assertTrue(team.provider_available(self.store))
        self.assertEqual(self.store.db.execute("SELECT status FROM tasks WHERE id=?", (tid,)).fetchone()[0], "resolved")

    def test_blocked_provider_notifies_each_task_once(self):
        self.store.put("provider", "grok")
        self.store.put("grok_blocked_until", time.time() + 3600)
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

    def test_wriai_court_post_carries_our_own_venue_rows(self):
        venues = [{"name": "Sân A", "slug": "san-a", "city": "Hải Phòng", "district": "Lê Chân", "num_courts": 4,
                   "price_min_vnd": 120000, "price_max_vnd": 180000, "price_source": "partner"},
                  {"name": "Sân B", "slug": "san-b", "city": "Vinh", "district": None, "num_courts": None,
                   "price_min_vnd": 80000, "price_max_vnd": 200000, "price_source": "default"}]
        own = team.own_venues("Sân pickleball Hải Phòng 2026", venues)
        self.assertIn("1 sân ở Hải Phòng", own)
        self.assertIn("Sân A | Lê Chân | 4 | 120,000–180,000đ/giờ | /san/san-a", own)
        self.assertNotIn("Sân B", own)
        self.assertEqual(team.own_venues("Sân pickleball Vĩnh Long", venues), "")  # 'Vinh' is another city
        self.assertIn("Sân B | chưa có | chưa có | chưa có | /san/san-b", team.own_venues("Sân pickleball Vinh", venues))  # placeholder price hidden
        self.assertEqual(team.own_venues("Kỹ thuật volley", venues), "")
        hoa = [{"name": "Sân C", "slug": "san-c", "city": "Thanh Hóa", "price_source": None}]
        for spelling in ("Thanh Hóa", "Thanh Hoá", "THANH HOÁ"):  # both tone placements name the same city
            self.assertIn("1 sân ở Thanh Hóa", team.own_venues(f"Sân pickleball {spelling}: danh sách", hoa))

    def test_wriai_drafts_become_one_editorial_task_each(self):
        rows = [{"id": "11111111-aaaa", "title": "Sân TP.HCM", "slug": "San-TPHCM!", "content_markdown": "x" * 20000},
                {"id": "22222222-bbbb", "title": "Sân TP.HCM", "slug": "san-tphcm", "content_markdown": "resent"}]
        with patch.object(team, "rest", return_value=rows) as rest:
            team.queue_wriai(self.store)
            self.store.put("wriai_poll", 0)
            team.queue_wriai(self.store)
            team.queue_wriai(self.store)  # throttled: no third read
        self.assertEqual(rest.call_count, 3)  # inbox, venues for the one new post, inbox again
        self.assertNotIn("POST", str(rest.call_args_list))
        tasks = self.store.db.execute("SELECT * FROM tasks WHERE dedupe LIKE 'schedule:wriai:%'").fetchall()
        self.assertEqual(len(tasks), 1)
        request = json.loads(tasks[0]["evidence"])["request"]
        self.assertTrue(request.startswith("editorial "))
        self.assertIn("docs/agent-drafts/wriai-san-tphcm.md", request)
        self.assertLess(len(request), 20000)
        self.assertTrue(permitted("docs/agent-drafts/wriai-san-tphcm.md", "editorial"))
        self.assertIn("KHÔNG qua kiểm duyệt", request.split("--- BÀI WRIAI")[0])  # policy precedes the Wriai body
        self.assertTrue(self.store.get(f"wriai_override:{tasks[0]['id']}"))

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
            files = ["team_actions.py", "team_measure.py", "chief_brief.py", "content_agent.py", "ops_sweep.py", "xuly_daemon.py", "fix_agent_daemon.py", "team_supervisor.py", "team_store.py", "team_workspace.py", "team_codex.py", "team_grok.py", "team_progress.py", "team_verification.py", "team_seo.py", "team_content.py", "team_wriai.py", "team_tournament_coverage.py", "team_tournament_coverage.json", "team_content_plan.json", "team_roles.json", "team_watchdog.py", "team_ga4.py"]
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


class TelegramPolicyTests(unittest.TestCase):
    """Owner rule 20/10/2026: instant incidents only, digests at 08:00/21:00, [Grok Bot] label."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.tmp.name))

    def tearDown(self):
        self.store.db.close()
        self.tmp.cleanup()

    def sent_texts(self, send):
        return [json.loads(call.args[0].data)["text"] for call in send.call_args_list]

    def fake_response(self):
        class R:
            def __enter__(self_inner):
                return self_inner
            def __exit__(self_inner, *a):
                return False
            def read(self_inner):
                return b'{"ok": true, "result": {"message_id": 7}}'
        return R()

    def test_noisy_kinds_are_held_and_urgent_kinds_are_labelled(self):
        self.store.enqueue("verification:40:1:x", "✅ ĐÃ KIỂM CHỨNG VÀ ĐÓNG · T40\nĐã đo lại jobs")
        self.store.enqueue("alert:1.0", "THAY ĐỔI SỰ CỐ\nhttps://www.thepicklehub.net/ trả 0")
        self.store.enqueue("action-start:5:1", "▶️ ĐANG XỬ LÝ · T5")
        self.store.enqueue("starting:5:run:1", "T5: bắt đầu")
        self.store.enqueue("watchdog:1.0", "Đội agent v2 không hoàn thành lượt chạy")
        self.store.enqueue("control:9", "BÁO CÁO · T9")
        self.store.enqueue("payment:abc", "Shop/thanh toán cần anh xử lý:\nĐơn A1 quá hạn")
        with patch.object(team, "secret", return_value="test"), \
             patch.object(team.urllib.request, "urlopen", side_effect=lambda *a, **k: self.fake_response()) as send:
            team.flush(self.store)
            team.flush(self.store)
        texts = self.sent_texts(send)
        self.assertEqual(len(texts), 4)
        self.assertTrue(all(t.startswith("[Grok Bot]") for t in texts))
        # Button-press replies are instant: the owner is waiting on them.
        self.assertIn("[Grok Bot] ▶️ ĐANG XỬ LÝ · T5", texts[0])
        self.assertIn("[Grok Bot] 🔴 Đội agent v2", texts[1])
        self.assertIn("[Grok Bot] BÁO CÁO · T9", texts[2])
        self.assertIn("[Grok Bot] 🔴 Shop/thanh toán", texts[3])
        held = [r[0] for r in self.store.db.execute("SELECT dedupe FROM outbox WHERE status='held' ORDER BY id")]
        self.assertEqual(held, ["verification:40:1:x", "alert:1.0", "starting:5:run:1"])

    def test_scheduled_digest_folds_held_rows_and_external_feeds(self):
        self.store.enqueue("verification:40:1:x", "✅ ĐÃ KIỂM CHỨNG VÀ ĐÓNG · T40\nĐã đo lại jobs")
        self.store.enqueue("verification:41:1:y", "🔁 LỖI TÁI DIỄN — MỞ LẠI CÙNG MÃ\nJob news-repair cần chẩn đoán")
        self.store.enqueue("alert:2.0", "THAY ĐỔI SỰ CỐ\nhttps://www.thepicklehub.net/vi trả 0")
        team.hold(self.store)

        def fake_command(argv, cwd=None, timeout=120, env=None):
            if argv[:3] == ["gh", "run", "list"]:
                wf = argv[argv.index("--workflow") + 1]
                runs = [{"status": "completed", "conclusion": "success", "createdAt": "2099-01-01T00:00:00Z"}]
                if wf == "quality.yml":
                    runs = [{"status": "completed", "conclusion": "success", "createdAt": "2099-01-01T01:00:00Z"},
                            {"status": "completed", "conclusion": "failure", "createdAt": "2099-01-01T00:00:00Z"}]
                return 0, json.dumps(runs), ""
            if "scripts/due-milestones.mjs" in argv:
                return 3, "⏰ 2026-10-27 WC-RESULTS-ENABLE — bật tự đăng", ""
            return 1, "", ""

        def fake_rest(path, method="GET", data=None):
            if path.startswith("rpc/ops_job_health_snapshot"):
                return {"counts": {"healthy": 9, "warning": 1, "failed": 0},
                        "jobs": [{"display_name": "News rewrite", "health_state": "warning"}]}
            if path.startswith("ops_edge_function_state?select=function_slug,state"):
                return []
            if path.startswith("client_errors"):
                return [{"message": "Load failed"}, {"message": "Load failed"}]
            if path.startswith("fb_post_log"):
                return [{"page_key": "thepicklehub"}]
            if path.startswith("x_posts"):
                return [{"id": "a"}, {"id": "b"}]
            return []

        with patch.object(team, "command", side_effect=fake_command), patch.object(team, "rest", side_effect=fake_rest):
            body, ids = team.scheduled_digest(self.store, 8)
        self.assertTrue(body.startswith("[Grok Bot] Tổng hợp 08:00 "))
        self.assertIn("TIN GOM TỪ LẦN TRƯỚC (3)", body)
        self.assertIn("Kiểm chứng việc: 2 (1 đóng, 1 mở lại/cần xử lý)", body)
        self.assertIn("Quality gate: 1/2 lượt đỏ, lượt cuối xanh", body)
        self.assertIn("Job: 9 ổn · 1 cảnh báo · 0 lỗi (News rewrite)", body)
        self.assertIn("Lỗi web: 2 lượt", body)
        self.assertIn("Đã đăng: Facebook 1 bài · X 2 bài", body)
        self.assertIn("WC-RESULTS-ENABLE", body)
        self.assertEqual(len(ids), 3)
        self.assertLessEqual(len(body), 3700)

    def test_posting_failure_alerts_only_from_second_failure_in_a_row(self):
        import fb_browser_post as fb
        path = Path(self.tmp.name) / "fb.failstreak"
        self.assertEqual(fb.failure_streak(path, True), 1)
        self.assertLess(1, fb.FAIL_STREAK_ALERT)
        self.assertEqual(fb.failure_streak(path, False), 0)
        self.assertEqual(fb.failure_streak(path, True), 1)
        self.assertEqual(fb.failure_streak(path, True), fb.FAIL_STREAK_ALERT)

    def test_successful_post_notice_is_labelled_with_platform_headline_and_link(self):
        import fb_browser_post as fb
        msg = fb.posted_notice("Facebook · TA Pickleball", "\n  Dallas & Brooklyn vào bán kết\nchi tiết...",
                               "https://www.facebook.com/tapickleballvn/posts/1")
        self.assertEqual(msg.splitlines(), ["Đã đăng bài", "Facebook · TA Pickleball",
                                            "Dallas & Brooklyn vào bán kết",
                                            "https://www.facebook.com/tapickleballvn/posts/1"])
        import notify_telegram as nt
        self.assertTrue(nt.labelled(msg, False).startswith("[Grok Bot] Đã đăng bài\n"))
        x = fb.posted_notice("X · @thepicklehub", "a" * 300, None, "⚠️ Đã đăng nhưng — CHƯA reply link: x")
        lines = x.splitlines()
        self.assertEqual(len(lines[2]), 200)
        self.assertTrue(lines[-1].startswith("⚠️"))

    def test_post_gap_parses_postgrest_timestamps_with_any_fraction(self):
        import fb_browser_post as fb
        for raw in ("2026-10-21T00:14:59.00477+00:00", "2026-10-20T12:58:31.45644+00:00",
                    "2026-10-20T10:11:30.376+00:00", "2026-10-20T10:11:30Z",
                    "2026-10-20T10:17:40.647348+00:00"):
            self.assertEqual(fb.parse_ts(raw).utcoffset().total_seconds(), 0, raw)
        self.assertEqual(fb.parse_ts("2026-10-21T00:14:59.00477+00:00").microsecond, 4770)

    def test_evening_digest_has_no_milestones_and_survives_feed_errors(self):
        with patch.object(team, "command", return_value=(1, "", "")), \
             patch.object(team, "rest", side_effect=urllib.error.URLError("down")):
            body, ids = team.scheduled_digest(self.store, 21)
        self.assertTrue(body.startswith("[Grok Bot] Tổng hợp 21:00 "))
        self.assertNotIn("MỐC ĐẾN HẠN", body)
        self.assertIn("Chưa đọc được (URLError)", body)
        self.assertEqual(ids, [])

    def test_site_needs_two_failed_sweeps_then_asks_github(self):
        self.store.task("finding:site:site:/", "platform", "https://www.thepicklehub.net/ trả 0", "open")
        with patch.object(team, "command", return_value=(0, "", "")) as cmd:
            team.site_escalation(self.store)
            self.assertEqual(cmd.call_count, 0)
            team.site_escalation(self.store)
            self.assertEqual(cmd.call_args.args[0], ["gh", "workflow", "run", "uptime-ping.yml", "--ref", "main"])
            team.site_escalation(self.store)  # still down: no second dispatch within 30 min
            self.assertEqual(cmd.call_count, 1)
            with self.store.db:
                self.store.db.execute("UPDATE tasks SET status='resolved'")
            team.site_escalation(self.store)  # back up: one recheck so GitHub can send the recovery
            self.assertEqual(cmd.call_count, 2)
            team.site_escalation(self.store)
            self.assertEqual(cmd.call_count, 2)
        self.assertEqual(self.store.db.execute("SELECT COUNT(*) FROM outbox").fetchone()[0], 0)

    def test_payment_findings_page_once_and_resolve_once(self):
        self.store.task("finding:commerce:shop:claim:A1", "commerce", "Đơn A1 khách báo đã chuyển khoản >12h", "open")
        team.payment_alert(self.store)
        team.payment_alert(self.store)
        with self.store.db:
            self.store.db.execute("UPDATE tasks SET status='resolved'")
        team.payment_alert(self.store)
        team.payment_alert(self.store)
        kinds = [r[0].split(":")[0] for r in self.store.db.execute("SELECT dedupe FROM outbox ORDER BY id")]
        self.assertEqual(kinds, ["payment", "payment-resolved"])
        self.assertTrue(team.labelled("payment-resolved:1", "x").startswith("[Grok Bot] ✅"))


class SocialPromoFilterTests(unittest.TestCase):
    """Owner rule 21/10/2026: no product/gear/brand posts on FB pages or X."""

    def test_blocks_gear_pieces(self):
        import social_promo_filter as promo
        for title in (
            "Bóng Pickleball Selkirk S2 Pro Ra Mắt Bảo Hành",
            "Selkirk S2 Pro Pickleball Ball Launches With Warranty",
            "Đánh giá vợt Gearbox Pressure X",
            "Chris Olson Hướng Dẫn Cách Chọn Vợt Pickleball",
            "Cách nhận biết vợt pickleball hỏng",
            "Best pickleball paddles for women: Top choices for 2026",
            "Giày Pickleball SQAIRZ XRZ2 Đánh Giá Độ Bền Và Độ Ổn Định",
            "Six Zero Ra Mắt Vợt Pickleball Boulder Opal Mới",
            "Cảnh báo bóng Life Time giả mạo",
            "So sánh vợt Joola Perseus và Selkirk Vanguard",
            "Best portable pickleball nets for your driveway",
        ):
            self.assertTrue(promo.is_promotional(title), title)

    def test_keeps_news_tips_and_rules(self):
        import social_promo_filter as promo
        for title in (
            "Elliott Schupp vô địch đôi nam PPA Tour tại Virginia Beach",
            "Kỹ thuật sửa lỗi góc mặt vợt đánh topspin pickleball hiệu quả",
            "Chiến thuật pickleball: Quan sát vợt thay vì bóng",
            "Quy định pháp lý vợt pickleball và danh sách phê duyệt",
            "Selkirk Red Rock Open: Ben Johns wins the men's singles",
            "Doanh thu sân pickleball và những rủi ro tài chính tiềm ẩn",
            "Kỹ thuật lên lưới và chiếm lĩnh khu bếp",
        ):
            self.assertFalse(promo.is_promotional(title), title)

    def test_fb_job_skips_promo_without_opening_chrome(self):
        import fb_browser_post as fb
        page = fb.PAGES[0]
        item = {"caption": "c", "link": "l", "news_item_id": "n1", "slug": "selkirk"}
        writes = []
        with patch.object(fb, "rest", return_value=[]), \
             patch.object(fb, "news_text", return_value=("Đánh giá vợt Gearbox Pressure X", "")), \
             patch.object(fb, "upsert_log", side_effect=lambda p, row: writes.append(row)), \
             patch.object(fb, "log"), \
             patch.object(fb, "run_claude") as claude:
            self.assertEqual(fb.post_one(page, item), 0)
        claude.assert_not_called()
        self.assertEqual([w["status"] for w in writes], ["skipped"])

    def test_x_job_parks_promo_as_draft(self):
        import x_browser_post as xb
        calls = []
        with patch.object(xb, "patch", side_effect=lambda *a: calls.append(a) or [{}]), \
             patch.object(xb, "log"):
            self.assertTrue(xb.park_if_promo({"id": "x1", "body": "Gearbox Pressure X Paddle Review"}))
            self.assertFalse(xb.park_if_promo({"id": "x2", "body": "Ben Johns wins PPA Virginia Beach"}))
        self.assertEqual(calls[0][1]["status"], "draft")
        self.assertEqual(calls[0][2], "approved")


class FbBrowserScheduleTests(unittest.TestCase):
    """21/10/2026: TA Pickleball posted 8 times in 40 min while ThePickleHub starved."""

    def test_page_that_waited_longest_goes_first(self):
        import fb_browser_post as fb
        from datetime import datetime, timezone
        last = {"ta-pickleball": datetime(2026, 10, 21, 1, 30, tzinfo=timezone.utc),
                "thepicklehub": datetime(2026, 10, 20, 12, 58, tzinfo=timezone.utc)}
        self.assertEqual([p["key"] for p in fb.page_order(fb.PAGES, last)][0], "thepicklehub")
        self.assertEqual(fb.page_order(fb.PAGES, {"ta-pickleball": last["ta-pickleball"]})[0]["key"],
                         "thepicklehub")

    def test_gap_and_daily_cap_hold_a_page_back(self):
        import fb_browser_post as fb
        from datetime import datetime, timedelta, timezone
        now = datetime(2026, 10, 21, 1, 40, tzinfo=timezone.utc)
        recent = {"ta-pickleball": now - timedelta(minutes=5), "thepicklehub": now - timedelta(hours=13)}
        with patch.object(fb, "MIN_GAP_MIN", 60), patch.object(fb, "DAILY_CAP", 12), \
             patch.object(fb, "last_posted", side_effect=lambda p: recent[p["key"]]), \
             patch.object(fb, "posted_today", return_value=0):
            self.assertEqual([p["key"] for p in fb.due_pages(fb.PAGES, now)], ["thepicklehub"])
        with patch.object(fb, "MIN_GAP_MIN", 60), patch.object(fb, "DAILY_CAP", 12), \
             patch.object(fb, "last_posted", return_value=None), \
             patch.object(fb, "posted_today", side_effect=lambda p: 12 if p["key"] == "ta-pickleball" else 3):
            self.assertEqual([p["key"] for p in fb.due_pages(fb.PAGES, now)], ["thepicklehub"])


if __name__ == "__main__":
    unittest.main()
