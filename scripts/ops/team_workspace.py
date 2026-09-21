"""Prepare real code/content drafts in a detached checkout, never production.

Claude file tools are confined by --restricted. No shell, network tools, MCP,
hooks or inherited project settings. Only controller runs fixed validation.
No generated test/application code is executed automatically.
"""
from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path


def permitted(path, role):
    p = Path(path)
    if p.is_absolute() or ".." in p.parts or any(part.startswith(".") for part in p.parts):
        return False
    if re.search(r"auth|payment|checkout|sepay|secret|permission|recovery|otp|dupr|legacy|scoring|registration|risk-tier", path, re.I):
        return False
    if role == "editorial":
        return path.startswith("docs/agent-drafts/") and p.suffix == ".md"
    return (path.startswith("src/") and p.suffix in {".ts", ".tsx", ".css"}
            and not path.startswith(("src/integrations/", "src/contracts/"))) or (
            path.startswith("docs/agent-drafts/") and p.suffix == ".md")


def draft(store, role, request, task_id):
    import team_supervisor as team
    if store.get("paused", False) or (team.REPO / ".claude/AGENTS_PAUSED").exists() or not team.provider_available(store):
        return None
    source = store.db.execute("SELECT evidence FROM tasks WHERE id=?", (task_id,)).fetchone()
    source_evidence = json.loads(source[0]) if source else {}
    run = store.begin(role, "isolated-draft", team.LIMIT, team.DAILY_LIMIT, team.CALLS,
                      enforce_limits=store.get("internal_budget_enabled", True))
    if run is None:
        return None
    store.enqueue(f"starting:{task_id}:run:{run}", f"T{task_id}: bắt đầu chuẩn bị bản nháp cô lập bằng Claude; chưa triển khai.")
    team.flush(store)
    worktree = team.ROOT / "workspaces" / f"T{task_id}-R{run}"
    worktree.parent.mkdir(exist_ok=True, mode=0o700)
    with store.db:
        store.db.execute("UPDATE tasks SET role=?,status='running',attempts=attempts+1,updated=? WHERE id=?",
                         (role, time.time(), task_id))
    try:
        rc, sha, _ = team.command(["git", "rev-parse", "HEAD"])
        if rc:
            raise RuntimeError("missing_base_commit")
        rc, _, _ = team.command(["git", "worktree", "add", "--detach", str(worktree), sha.strip()])
        if rc:
            raise RuntimeError("worktree_create_failed")
        deny = ["Read(./.git/**)", "Read(./.env*)", "Read(./.claude/**)", "Read(./.codex/**)",
                "Edit(./.git/**)", "Write(./.git/**)", "Edit(./.env*)", "Write(./.env*)"]
        # Restrict WRITES to a positive scope using tool-specific permission rules.
        # Default mode + permission-prompt-tool=none fails closed outside allows.
        patterns = ["./docs/agent-drafts/**"]
        if role == "engineering":
            patterns += ["./src/**/*.ts", "./src/**/*.tsx", "./src/**/*.css"]
        allowed = [f"{tool}({pattern})" for tool in ("Edit", "Write") for pattern in patterns]
        for pattern in ["./src/integrations/**", "./src/contracts/**", "./src/**/*auth*", "./src/**/*Auth*",
                        "./src/**/*payment*", "./src/**/*Payment*", "./src/**/*otp*", "./src/**/*Otp*",
                        "./src/**/*DUPR*", "./src/**/*Dupr*", "./src/**/*dupr*", "./src/**/*Registration*",
                        "./src/**/*Scoring*", "./src/**/*Recovery*", "./src/**/*Checkout*", "./src/**/*SePay*"]:
            deny += [f"{tool}({pattern})" for tool in ("Edit", "Write")]
        prompt = ("Bạn là " + team.ROLES[role]["name"] + ". " + team.ROLES[role]["mission"] +
                  "\nĐây là checkout cô lập từ commit " + sha.strip() + ", không có thay đổi chưa commit của chủ repo. "
                  "Bạn chỉ có tool đọc/sửa file, không shell hay mạng. Chuẩn bị bản nháp thật trong phạm vi cho phép. "
                  "Engineering: chỉ src .ts/.tsx/.css và docs/agent-drafts/*.md; không auth, tiền, đăng ký, điểm số, DUPR, config hoặc migration. "
                  "Editorial: chỉ viết Markdown trong docs/agent-drafts, kèm nguồn; không sửa bài đang public. "
                  "Nếu yêu cầu ngoài quyền, viết đề xuất trong docs/agent-drafts thay vì giả vờ đã làm. "
                  "Không tự tuyên bố tests pass. Ghi báo cáo tiếng Việt: thay đổi, file, kiểm chứng còn thiếu, giới hạn.\n"
                  + json.dumps(team.scrub({"request": request,
                      "editorial": store.get("check:editorial"),
                      "engineering": store.get("check:engineering")}), ensure_ascii=False)[:30000])
        argv = [str(Path.home() / ".local/bin/claude"), "-p", prompt, "--model", "opus", "--restricted", "--safe-mode",
                "--tools", "Read,Glob,Grep,Edit,Write", "--allowedTools", ",".join(allowed + ["Read", "Glob", "Grep"]),
                "--disallowedTools", ",".join(deny), "--permission-mode", "dontAsk",
                "--permission-prompts", "none", "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}',
                "--disable-slash-commands", "--no-session-persistence", "--max-turns", "16",
                "--output-format", "json"]
        rc, out, _ = team.command(argv, cwd=worktree, timeout=600, env=team.clean_env())
        response = json.loads(out)
        if rc or response.get("is_error") or not response.get("result") or team.claude_quota_exhausted(response):
            team.provider_failure(store, response)
            raise RuntimeError("draft_model_failed")
        _, tracked, _ = team.command(["git", "diff", "--name-only", "-z", "HEAD"], cwd=worktree)
        _, untracked, _ = team.command(["git", "ls-files", "--others", "--exclude-standard", "-z"], cwd=worktree)
        paths = sorted(set(p for p in (tracked + untracked).split("\0") if p))
        rejected = [p for p in paths if not permitted(p, role) or (worktree / p).is_symlink()]
        if len(paths) > 12 or rejected:
            raise RuntimeError("draft_outside_policy_quarantined")
        for path in paths:
            if (worktree / path).exists() and (worktree / path).stat().st_size > 200000:
                raise RuntimeError("draft_too_large_quarantined")
        if not paths:
            raise RuntimeError("no_draft_files")
        # Staging only inside isolated worktree allows a complete patch including
        # newly created files. Never commit, push or merge here.
        rc, _, _ = team.command(["git", "add", "--", *paths], cwd=worktree)
        if rc:
            raise RuntimeError("draft_stage_failed")
        rc, validation, _ = team.command(["git", "diff", "--cached", "--check"], cwd=worktree)
        if rc:
            raise RuntimeError("patch_whitespace_check_failed")
        _, patch, _ = team.command(["git", "diff", "--cached", "--binary"], cwd=worktree)
        artifact = store.artifact(f"run-{run}-{role}.patch", patch)
        report = (str(team.scrub(response["result"])) + "\n\nController verification:\n"
                  f"Base commit: {sha.strip()}\nWorktree: {worktree}\nFiles: {', '.join(paths)}\n"
                  f"Patch: {artifact['path']}\nSHA256: {artifact['sha256']}\n"
                  "Path policy + git diff --check: PASS. Unit/E2E/typecheck: NOT RUN. Production: NOT CHANGED.\n"
                  "Status: awaiting QA/review; not completed implementation.\n")
        evidence = store.artifact(f"run-{run}-{role}.md", report)
        evidence.update({"worktree": str(worktree), "base": sha.strip(), "patch": artifact, "paths": paths})
        store.finish(run, "draft_ready", evidence, float(response.get("total_cost_usd", 0) or 0))
        with store.db:
            store.db.execute("UPDATE tasks SET status='awaiting_review',evidence=?,updated=? WHERE id=?",
                             (json.dumps({**source_evidence, **evidence}), time.time(), task_id))
        return {"run": run, "result": report, **evidence}
    except Exception as exc:
        # Retry as a Codex report only when quota was explicit AND the isolated
        # tree is untouched. Never replay partial edits after an unrelated error.
        if store.get("provider_policy") == "claude_first" and team.claude_quota_exhausted(locals().get("response", {})):
            rc, changed, _ = team.command(["git", "status", "--porcelain"], cwd=worktree)
            if rc == 0 and not changed.strip():
                store.finish(run, "failed", {"reason": "claude_quota", "worktree": str(worktree)})
                with store.db:
                    store.db.execute("UPDATE tasks SET status='queued',updated=? WHERE id=?", (time.time(), task_id))
                return {"run": run, "deferred": True, "reason": "claude_quota_fallback"}
        evidence = {"error": team.clean_error(exc), "worktree": str(worktree),
                    "detail": str(exc) if isinstance(exc, RuntimeError) else type(exc).__name__}
        store.finish(run, "failed", evidence)
        with store.db:
            store.db.execute("UPDATE tasks SET status='needs_review',evidence=?,updated=? WHERE id=?",
                             (json.dumps({**source_evidence, **evidence}), time.time(), task_id))
        return {"run": run, "error": evidence["detail"]}
