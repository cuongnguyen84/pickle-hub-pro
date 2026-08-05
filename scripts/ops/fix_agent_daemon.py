#!/usr/bin/env python3
"""fix_agent_daemon — rút /agentfix từ telegram_commands, chạy Claude điều-tra-only.

Hình dạng đã chốt qua panel /idea telegram-fix-agent (05/08):
  - Agent (`claude -p`) chạy KHÔNG tool, KHÔNG credential, KHÔNG mạng — chỉ suy
    luận trên bundle chẩn đoán do daemon dựng sẵn, trả JSON verdict + opcode.
  - Daemon (file này) là bên duy nhất cầm key (đọc từ SECRETS_FILE), và opcode
    duy nhất nó thực thi là CHÈN một lệnh /retry hoặc /fix vào telegram_commands
    — bot ops-job-control tự thực thi qua các nhánh đã vá và tự báo kết quả.
    Không deploy, không UPDATE monitor, không đường auth mới. (risk-auditor HOLD:
    ranh giới hình credential; pre-mortem: deny-list dập-cảnh-báo.)
  - Chạy 1 lượt mỗi lần launchd kích (StartInterval 60s), lock dir chống chồng.

Chạy tay để thử: python3 scripts/ops/fix_agent_daemon.py --once [--dry-run]
"""

import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

SECRETS_FILE = os.environ.get("SECRETS_FILE", "/Users/cm10/Downloads/secrets.local.md")
SUPABASE_URL = "https://ajvlcamxemgbxduhiqrl.supabase.co"
REPO_DIR = Path(os.environ.get("PICKLEHUB_REPO", "/Users/cm10/pickle-hub-pro"))
RUNBOOK = REPO_DIR / "docs/ops/fix-agent-runbook.md"
LOCK_DIR = "/tmp/picklehub-fix-agent.lock"
LOG_DIR = Path.home() / "Library/Logs/PickleHub"
SCRATCH = Path.home() / "Library/Caches/PickleHub/fix-agent"
CLAUDE_BIN = os.environ.get("CLAUDE_BIN", str(Path.home() / ".local/bin/claude"))

AGENT_TIMEOUT_S = 480
COOLDOWN_MIN = 30
CAP_PER_HOUR = 6
CAP_PER_DAY = 30
ALLOWED_OPCODES = {"retry", "fix", "none"}


def log(msg: str) -> None:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    line = f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} {msg}"
    print(line)
    with open(LOG_DIR / "fix-agent.log", "a", encoding="utf-8") as fh:
        fh.write(line + "\n")


def read_secrets() -> dict:
    text = Path(SECRETS_FILE).read_text(encoding="utf-8")
    jwt = re.search(r"SERVICE_ROLE_KEY[^\n]*\n\s*(eyJ[A-Za-z0-9._-]+)", text)
    tg_token = re.search(r"TELEGRAM_BOT_TOKEN\s+(\S+)", text)
    chat_id = re.search(r"TELEGRAM_CHAT_ID\s+(\S+)", text)
    missing = [name for name, match in
               [("SERVICE_ROLE_KEY", jwt), ("TELEGRAM_BOT_TOKEN", tg_token), ("TELEGRAM_CHAT_ID", chat_id)]
               if not match]
    if missing:
        raise SystemExit(f"Thiếu secrets trong {SECRETS_FILE}: {missing}")
    return {"service_key": jwt.group(1), "tg_token": tg_token.group(1), "chat_id": chat_id.group(1)}


def rest(secrets: dict, method: str, path: str, body=None, prefer="return=representation"):
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{path}",
        data=json.dumps(body).encode() if body is not None else None,
        method=method,
        headers={
            "apikey": secrets["service_key"],
            "Authorization": f"Bearer {secrets['service_key']}",
            "Content-Type": "application/json",
            "Prefer": prefer,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            raw = res.read().decode() or "null"
            return res.status, json.loads(raw)
    except urllib.error.HTTPError as err:
        return err.code, json.loads(err.read().decode() or "null")


def send_telegram(secrets: dict, text: str) -> bool:
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{secrets['tg_token']}/sendMessage",
        data=json.dumps({"chat_id": secrets["chat_id"], "text": text,
                         "disable_web_page_preview": True}).encode(),
        headers={"Content-Type": "application/json"}, method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            return res.status == 200
    except Exception as err:  # noqa: BLE001 — Telegram lỗi không được giết daemon
        log(f"telegram send failed: {err}")
        return False


def fmt_ict(dt: datetime | None = None) -> str:
    dt = dt or datetime.now(timezone.utc)
    return dt.astimezone(timezone(timedelta(hours=7))).strftime("%H:%M %d/%m")


def sweep_orphans(secrets: dict) -> None:
    """Row processing quá 15' = agent chết giữa chừng (máy restart/kill).
    Đóng rõ ràng + báo — im lặng vĩnh viễn tệ hơn mọi ⛔."""
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=15)).isoformat()
    status, rows = rest(secrets, "GET",
                        f"telegram_commands?text=like./agentfix*&status=eq.processing&created_at=lt.{cutoff}&select=id,text")
    for row in rows or []:
        job_key = row["text"].replace("/agentfix", "").strip()
        rest(secrets, "PATCH", f"telegram_commands?id=eq.{row['id']}&status=eq.processing",
             {"status": "error", "result": "agent_interrupted",
              "processed_at": datetime.now(timezone.utc).isoformat()})
        send_telegram(secrets, (
            f"⚠️ XỬ LÝ ĐỨT GIỮA CHỪNG · {job_key}\n"
            f"Agent bị gián đoạn (máy khởi động lại hoặc tiến trình bị kill) sau khi đã bắt đầu.\n"
            f"Chỉ mới điều tra — chưa có thao tác nào lên production. Bấm 🛠 Xử lý lại nếu cần.\n"
            f"Mã: FX-{row['id']}"
        ))
        log(f"orphan swept FX-{row['id']} ({job_key})")


def under_caps(secrets: dict) -> bool:
    day_ago = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    hour_ago = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    _, day_rows = rest(secrets, "GET",
                       f"telegram_commands?text=like./agentfix*&status=in.(done,error)&processed_at=gte.{day_ago}&select=id,processed_at")
    day_rows = day_rows or []
    hour_count = sum(1 for row in day_rows if (row.get("processed_at") or "") >= hour_ago)
    if len(day_rows) >= CAP_PER_DAY or hour_count >= CAP_PER_HOUR:
        log(f"cap reached: {len(day_rows)}/day, {hour_count}/hour — skip")
        return False
    return True


def claim_next(secrets: dict):
    status, rows = rest(secrets, "GET",
                        "telegram_commands?text=like./agentfix*&status=eq.pending&order=created_at.asc&limit=1&select=id,text,created_at")
    if not rows:
        return None
    row = rows[0]
    job_key = row["text"].replace("/agentfix", "").strip()
    # Chỉ nhận job_key có thật trong registry — không bao giờ đưa free text vào prompt.
    _, reg = rest(secrets, "GET", f"ops_job_registry?job_key=eq.{job_key}&enabled=is.true&select=job_key")
    if not reg:
        rest(secrets, "PATCH", f"telegram_commands?id=eq.{row['id']}&status=eq.pending",
             {"status": "error", "result": "unknown_job_key"})
        log(f"FX-{row['id']}: job_key không có trong registry: {job_key!r}")
        return None
    # Cooldown 30' theo job_key.
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=COOLDOWN_MIN)).isoformat()
    _, recent = rest(secrets, "GET",
                     f"telegram_commands?text=eq./agentfix {job_key}&status=eq.done&processed_at=gte.{cutoff}&select=id")
    if recent:
        rest(secrets, "PATCH", f"telegram_commands?id=eq.{row['id']}&status=eq.pending",
             {"status": "skipped", "result": f"cooldown_{COOLDOWN_MIN}m"})
        send_telegram(secrets, f"⏳ {job_key} vừa được agent xử lý dưới {COOLDOWN_MIN} phút trước — xem kết quả FX-{recent[0]['id']} ở trên. Không chạy lại.")
        return None
    # CAS claim.
    status, claimed = rest(secrets, "PATCH",
                           f"telegram_commands?id=eq.{row['id']}&status=eq.pending",
                           {"status": "processing"})
    if not claimed:
        return None
    return {"id": row["id"], "job_key": job_key}


def build_bundle(secrets: dict, job_key: str) -> dict:
    """Bundle chẩn đoán — TOÀN BỘ những gì agent được thấy. Agent không có tool
    nên bundle phải đủ; mọi chuỗi từ DB là DATA của bên thứ ba, runbook đã đóng khung."""
    bundle: dict = {"job_key": job_key, "generated_at": datetime.now(timezone.utc).isoformat()}
    _, snapshot = rest(secrets, "POST", "rpc/ops_job_health_snapshot", body={})
    jobs = (snapshot or {}).get("jobs", []) if isinstance(snapshot, dict) else []
    bundle["job"] = next((job for job in jobs if job.get("job_key") == job_key), None)
    _, runs = rest(secrets, "GET",
                   f"ops_job_runs?job_key=eq.{job_key}&order=started_at.desc&limit=5&select=status,started_at,completed_at,summary,error_code,error_message,trigger_kind")
    bundle["recent_runs"] = runs or []
    _, edge = rest(secrets, "GET",
                   f"ops_edge_function_registry?job_key=eq.{job_key}&select=function_slug,ops_edge_function_state(state,http_status,reason,checked_at)")
    bundle["edge_functions"] = edge or []
    if job_key in ("news-fetcher", "news-rewrite"):
        _, sources = rest(secrets, "GET", "news_sources?select=id,active,feed_type,last_error,last_success_at")
        bundle["news_sources"] = sources or []
    return bundle


def run_agent(job_key: str, bundle: dict) -> dict | None:
    SCRATCH.mkdir(parents=True, exist_ok=True)
    prompt = (
        RUNBOOK.read_text(encoding="utf-8")
        + "\n\n## Bundle chẩn đoán (JSON)\n```json\n"
        + json.dumps(bundle, ensure_ascii=False, indent=1)[:60_000]
        + "\n```\n\nJOB_KEY=" + job_key + "\nTrả về DUY NHẤT một JSON object theo hợp đồng output."
    )
    # Env sạch: không secret nào lọt vào tiến trình agent. --allowedTools "" = 0 tool,
    # agent chỉ suy luận trên bundle — không shell, không mạng, không file.
    env = {"PATH": "/usr/bin:/bin", "HOME": str(Path.home()),
           "TERM": "dumb", "NO_COLOR": "1"}
    try:
        proc = subprocess.run(
            [CLAUDE_BIN, "-p", prompt, "--output-format", "json", "--allowedTools", "", "--max-turns", "1"],
            capture_output=True, text=True, timeout=AGENT_TIMEOUT_S, cwd=str(SCRATCH), env=env,
        )
    except subprocess.TimeoutExpired:
        log(f"agent timeout {AGENT_TIMEOUT_S}s cho {job_key}")
        return None
    if proc.returncode != 0:
        log(f"agent exit {proc.returncode}: {(proc.stderr or '')[:300]}")
        return None
    try:
        outer = json.loads(proc.stdout)
        text = outer.get("result", "") if isinstance(outer, dict) else str(outer)
        match = re.search(r"\{.*\}", text, re.S)
        verdict = json.loads(match.group(0)) if match else None
    except (json.JSONDecodeError, AttributeError):
        verdict = None
    if not isinstance(verdict, dict):
        log(f"agent output không parse được cho {job_key}: {proc.stdout[:300]}")
        return None
    return verdict


def execute_opcode(secrets: dict, job_key: str, opcode: str) -> str:
    """Opcode duy nhất daemon làm: chèn lệnh cho bot. Bot thực thi qua nhánh đã
    vá + tự báo kết quả — daemon không deploy, không UPDATE gì khác."""
    if opcode == "none":
        return "không đề xuất thao tác tự động"
    command = f"/{opcode} {job_key}"
    rest(secrets, "POST", "telegram_commands", body={
        "update_id": -int(time.time() * 1000),
        "chat_id": int(secrets["chat_id"]),
        "from_username": "fix-agent-daemon",
        "message_date": datetime.now(timezone.utc).isoformat(),
        "text": command,
        "status": "pending",
    }, prefer="return=minimal")
    return f"đã xếp lệnh {command} cho bot (kết quả bot sẽ nhắn riêng trong ~1-2 phút)"


def process_one(secrets: dict, dry_run: bool) -> bool:
    task = claim_next(secrets)
    if not task:
        return False
    job_key, row_id = task["job_key"], task["id"]
    log(f"FX-{row_id}: bắt đầu điều tra {job_key}")
    bundle = build_bundle(secrets, job_key)
    verdict = run_agent(job_key, bundle)
    if verdict is None:
        message = (
            f"❌ KHÔNG XỬ LÝ ĐƯỢC · {job_key}\n"
            f"Agent không trả được kết luận hợp lệ (timeout hoặc output hỏng).\n"
            f"Chưa có thay đổi nào. Dùng /diagnose {job_key} xem chi tiết, log: ~/Library/Logs/PickleHub/fix-agent.log\n"
            f"Mã: FX-{row_id}"
        )
        rest(secrets, "PATCH", f"telegram_commands?id=eq.{row_id}",
             {"status": "error", "result": "agent_no_verdict",
              "processed_at": datetime.now(timezone.utc).isoformat()})
        send_telegram(secrets, message)
        return True
    opcode = str(verdict.get("opcode", "none"))
    if opcode not in ALLOWED_OPCODES:
        opcode = "none"
    cause = str(verdict.get("cause_vi", "(agent không nêu nguyên nhân)"))[:400]
    action = str(verdict.get("action_vi", ""))[:300]
    verdict_kind = str(verdict.get("verdict", "unknown"))
    header = {
        "actionable": f"🛠 ĐÃ CHẨN ĐOÁN · {job_key}",
        "needs_cuong": f"🛠 CHƯA SỬA · CẦN ANH XỬ LÝ · {job_key}",
        "needs_code": f"🛠 CHƯA SỬA · CẦN SỬA CODE · {job_key}",
    }.get(verdict_kind, f"🔎 KẾT QUẢ ĐIỀU TRA · {job_key}")
    executed = "(dry-run, không thực thi)" if dry_run else execute_opcode(secrets, job_key, opcode)
    message = "\n".join([
        header,
        f"Nguyên nhân: {cause}",
        f"Đề xuất: {action}" if action else "",
        f"Đã làm: {executed}.",
        f"Mã: FX-{row_id} · {fmt_ict()}",
    ]).replace("\n\n", "\n")
    rest(secrets, "PATCH", f"telegram_commands?id=eq.{row_id}",
         {"status": "done", "result": message[:2000],
          "processed_at": datetime.now(timezone.utc).isoformat()})
    send_telegram(secrets, message)
    log(f"FX-{row_id}: xong ({verdict_kind}/{opcode})")
    return True


def main() -> None:
    dry_run = "--dry-run" in sys.argv
    try:
        os.mkdir(LOCK_DIR)
    except FileExistsError:
        log("skipped: lượt trước còn chạy")
        return
    try:
        secrets = read_secrets()
        sweep_orphans(secrets)
        if under_caps(secrets):
            process_one(secrets, dry_run)
    finally:
        os.rmdir(LOCK_DIR)


if __name__ == "__main__":
    main()
