#!/usr/bin/env python3
"""Back up and replace ONLY the explicitly listed legacy team launch agents.

Cloudflare/Supabase cron and com.picklehub.edge-redeploy-hourly are out of scope.
Snapshots include uncommitted legacy source; rollback never resets the worktree.
"""
from __future__ import annotations

import argparse
import json
import os
import plistlib
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
ROOT = Path.home() / "Library/Application Support/PickleHub/team-v2"
LAUNCH = Path.home() / "Library/LaunchAgents"
LABEL = "com.picklehub.team-v2"
WATCHDOG = "com.picklehub.team-v2-watchdog"
OLD = ["com.picklehub." + n for n in ("chief", "content", "opssweep", "xuly")]


def ctl(*args):
    return subprocess.run(["launchctl", *args], capture_output=True, text=True)


def install():
    ROOT.mkdir(parents=True, exist_ok=True, mode=0o700)
    uid = os.getuid()
    if (LAUNCH / f"{LABEL}.plist").exists() or (LAUNCH / f"{WATCHDOG}.plist").exists():
        raise RuntimeError("team-v2 already installed; rollback before reinstall")
    backup = ROOT / "backups" / datetime.now().strftime("%Y%m%d-%H%M%S")
    backup.mkdir(parents=True, mode=0o700)
    states = {}
    for label in OLD:
        p = LAUNCH / f"{label}.plist"
        status = ctl("print", f"gui/{uid}/{label}")
        states[label] = {"loaded": status.returncode == 0, "plist": p.exists()}
        if status.returncode == 0 and "state = running" in status.stdout:
            raise RuntimeError(f"{label} is running; retry once its current task finishes")
        if p.exists():
            shutil.copy2(p, backup / p.name)
    # Preserve old scripts exactly as found, including user's uncommitted edits.
    for name in ("chief_brief.py", "content_agent.py", "ops_sweep.py", "xuly_daemon.py", "fix_agent_daemon.py"):
        shutil.copy2(REPO / "scripts/ops" / name, backup / name)
    (backup / "states.json").write_text(json.dumps(states, indent=2))
    shutil.copytree(REPO / "scripts/ops/launchagents", backup / "source-plists")
    logs = Path.home() / "Library/Logs/PickleHub"
    logs.mkdir(parents=True, exist_ok=True)
    runtime = ROOT / "releases" / backup.name / "scripts/ops"
    runtime.mkdir(parents=True, mode=0o700)
    for name in ("team_supervisor.py", "team_store.py", "team_workspace.py", "team_codex.py", "team_progress.py", "team_content.py", "team_content_plan.json", "team_roles.json", "team_watchdog.py", "team_ga4.py", "ops_sweep.py", "chief_brief.py"):
        shutil.copy2(REPO / "scripts/ops" / name, runtime / name)
    config = {
        "Label": LABEL,
        "ProgramArguments": [sys.executable, str(runtime / "team_supervisor.py"), "tick"],
        "StartInterval": 60, "RunAtLoad": False,
        "WorkingDirectory": str(REPO), "ProcessType": "Background",
        "EnvironmentVariables": {"SECRETS_FILE": str(REPO / ".claude/secrets.local.md"),
            "PICKLEHUB_REPO": str(REPO), "USER": os.environ.get("USER", "cm10"), "LOGNAME": os.environ.get("LOGNAME", "cm10"),
            "PATH": "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin",
            "GOOGLE_SA_JSON": str(REPO / ".claude/secrets.local.gsc-ga4-sa.json"), "GA4_PROPERTY_ID": "522556358"},
        "StandardOutPath": str(logs / "team-v2.log"), "StandardErrorPath": str(logs / "team-v2.log"),
    }
    target = LAUNCH / f"{LABEL}.plist"
    watch_target = LAUNCH / f"{WATCHDOG}.plist"
    stopped = []
    try:
        for label in OLD:
            if states[label]["loaded"]:
                result = ctl("bootout", f"gui/{uid}/{label}")
                if result.returncode:
                    raise RuntimeError(f"could not stop {label}")
                stopped.append(label)
        with target.open("wb") as fh:
            plistlib.dump(config, fh)
        result = ctl("bootstrap", f"gui/{uid}", str(target))
        if result.returncode:
            raise RuntimeError("could not load team-v2")
        watchdog = dict(config, Label=WATCHDOG, StartInterval=300,
                        ProgramArguments=[sys.executable, str(runtime / "team_watchdog.py")],
                        StandardOutPath=str(logs / "team-v2-watchdog.log"),
                        StandardErrorPath=str(logs / "team-v2-watchdog.log"))
        with watch_target.open("wb") as fh:
            plistlib.dump(watchdog, fh)
        if ctl("bootstrap", f"gui/{uid}", str(watch_target)).returncode:
            raise RuntimeError("could not load watchdog")
        # Move retired installed plists out of LaunchAgents so they cannot return
        # at next login. The repo templates remain as rollback references.
        for label in OLD:
            p = LAUNCH / f"{label}.plist"
            if p.exists():
                p.rename(backup / f"retired-{p.name}")
        (ROOT / "installation.json").write_text(json.dumps({"backup": str(backup), "runtime": str(runtime), "legacy": states}, indent=2))
        print(json.dumps({"installed": LABEL, "backup": str(backup), "retired": stopped}, indent=2))
    except Exception:
        ctl("bootout", f"gui/{uid}/{LABEL}")
        ctl("bootout", f"gui/{uid}/{WATCHDOG}")
        if watch_target.exists():
            watch_target.rename(backup / "failed-watchdog.plist")
        if target.exists():
            target.rename(backup / "failed-team-v2.plist")
        for label in stopped:
            p = LAUNCH / f"{label}.plist"
            if not p.exists() and (backup / p.name).exists():
                shutil.copy2(backup / p.name, p)
            ctl("bootstrap", f"gui/{uid}", str(p))
        raise


def rollback():
    state = json.loads((ROOT / "installation.json").read_text())
    backup = Path(state["backup"])
    uid = os.getuid()
    current = ctl("print", f"gui/{uid}/{LABEL}")
    if "state = running" in current.stdout:
        raise RuntimeError("team-v2 is running; pause and wait for current task first")
    ctl("bootout", f"gui/{uid}/{LABEL}")
    ctl("bootout", f"gui/{uid}/{WATCHDOG}")
    watch = LAUNCH / f"{WATCHDOG}.plist"
    if watch.exists():
        watch.rename(backup / "rolled-back-watchdog.plist")
    p = LAUNCH / f"{LABEL}.plist"
    if p.exists():
        p.rename(backup / "rolled-back-team-v2.plist")
    for label, status in state["legacy"].items():
        p = LAUNCH / f"{label}.plist"
        if status["plist"]:
            shutil.copy2(backup / p.name, p)
        if status["loaded"]:
            r = ctl("bootstrap", f"gui/{uid}", str(p))
            if r.returncode:
                raise RuntimeError(f"rollback failed for {label}")
    print("Đã khôi phục lịch đội cũ; sổ việc/báo cáo v2 được giữ nguyên.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["install", "rollback"])
    args = parser.parse_args()
    install() if args.action == "install" else rollback()
