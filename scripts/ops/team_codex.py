"""Bounded Codex report adapter; never resumes an interactive user session.

Subscription usage has no known USD price here. The controller still reserves
the existing conservative scheduling allowance and enforces its shared call cap.
"""
import json
from pathlib import Path


def argv(prompt):
    args = [str(Path.home() / ".local/bin/codex"), "exec", "--ignore-user-config",
            "--ignore-rules", "--ephemeral", "--skip-git-repo-check", "--sandbox", "read-only"]
    for feature in ("shell_tool", "unified_exec", "code_mode_host", "apps",
                    "multi_agent", "skill_search", "shell_snapshot"):
        args += ["--disable", feature]
    args += ["--enable", "skip_host_skill_discovery"]
    for setting in ('web_search="disabled"', 'approval_policy="never"', 'mcp_servers={}',
                    'hooks={}', 'history.persistence="none"'):
        args += ["-c", setting]
    return args + ["--json", prompt]


def parse(code, output):
    messages, usage, errors, completed = [], {}, [], False
    for line in output.splitlines():
        event = json.loads(line)
        kind = event.get("type")
        item = event.get("item", {})
        if kind == "item.completed" and item.get("type") == "agent_message":
            messages.append(item.get("text", ""))
        if kind in {"turn.failed", "error"}:
            errors.append(event.get("error", event.get("message", "Codex failed")))
        if kind == "turn.completed":
            completed, usage = True, event.get("usage", {})
    failed = bool(code or errors or not completed or not messages)
    return {"is_error": failed, "result": str(errors) if errors else "\n\n".join(messages),
            "provider": "codex", "usage": usage, "total_cost_usd": None,
            "cost_status": "unknown_subscription_usage", "completed": completed}


def run(prompt, cwd, command, env):
    code, output, _ = command(argv(prompt), cwd=cwd, timeout=300, env=env)
    return code, parse(code, output)
