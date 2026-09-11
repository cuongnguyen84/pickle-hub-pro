#!/usr/bin/env python3
# ============================================================================
# content_agent.py — AGENT NỘI DUNG: plan tuần, viết bài SEO/GEO/AEO, báo cáo
# ============================================================================
# Chạy trên máy Cuong qua launchd (com.picklehub.content), 1 lượt/ngày 08:30.
# Chế độ theo thứ (ICT):
#   Thứ Hai        → PLAN   : lên kế hoạch 3 bài cho tuần
#   Thứ Ba/Năm/Bảy → WRITE  : viết mục kế tiếp trong plan → draft/PR chờ duyệt
#   Chủ nhật       → REPORT : báo cáo tuần (bài đã đăng, GSC, đề xuất)
#   Thứ Tư/Sáu     → nghỉ (thoát 0 token)
#
# Kiến trúc y hệt xuly_daemon.py: daemon mỏng cầm quyền, bộ não nằm trong
# docs/ops/content-agent-runbook.md nạp vào `claude -p`. Publish luôn là vùng
# VÀNG — agent chỉ dựng draft/PR, Cuong duyệt qua /xuly.
#
# Chạy tay:
#   python3 scripts/ops/content_agent.py --mode plan|write|report  # ép chế độ
#   python3 scripts/ops/content_agent.py --dry-run                 # chỉ in chế độ
# ============================================================================
from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

REPO = Path(os.environ.get("PICKLEHUB_REPO", Path(__file__).resolve().parents[2]))
CLAUDE_BIN = os.environ.get("CLAUDE_BIN", str(Path.home() / ".local/bin/claude"))
PERMISSION_MODE = os.environ.get("CONTENT_PERMISSION_MODE", "bypassPermissions")
RUNBOOK = REPO / "docs/ops/content-agent-runbook.md"
PAUSE_FILE = REPO / ".claude/AGENTS_PAUSED"
LOCK_DIR = "/tmp/picklehub-content.lock"
LOG_DIR = Path.home() / "Library/Logs/PickleHub"
ICT = timezone(timedelta(hours=7))
TASK_TIMEOUT_S = 2700  # 45' — bài blog 4-thay-đổi không xong nổi trong 15' (XL-100)

MODE_BY_WEEKDAY = {0: "plan", 1: "write", 3: "write", 5: "write", 6: "report"}


def log(msg: str) -> None:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    line = f"{datetime.now(ICT).strftime('%Y-%m-%d %H:%M:%S')} {msg}"
    print(line, flush=True)
    try:
        with open(LOG_DIR / "content.log", "a", encoding="utf-8") as fh:
            fh.write(line + "\n")
    except Exception:
        pass


def tele(text: str, tag: str) -> None:
    """Ghi file TRƯỚC, gửi Telegram sau (bài học XL-83: gửi treo = mất báo cáo)."""
    outbox = REPO / ".claude/chief"
    try:
        outbox.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(ICT).strftime("%Y%m%d-%H%M%S")
        (outbox / f"content-{tag}-{stamp}.md").write_text(text, encoding="utf-8")
    except Exception as e:
        log(f"không ghi được bản lưu: {e}")
    try:
        p = subprocess.run(
            [sys.executable, str(REPO / "scripts/ops/notify_telegram.py"), "-"],
            input=text, capture_output=True, text=True, cwd=str(REPO), timeout=180)
        if p.returncode == 0:
            return
        log(f"notify_telegram mã {p.returncode}: {(p.stderr or '')[:200]}")
    except Exception as e:
        log(f"notify_telegram lỗi: {e}")

    # Dự phòng: gọi thẳng API Telegram (kế thừa xuly_daemon — im lặng là kiểu hỏng tệ nhất).
    import json as _json
    import urllib.request as _rq
    sec = Path(os.environ.get("SECRETS_FILE", REPO / ".claude/secrets.local.md"))
    def _secret(key: str) -> str | None:
        v = os.environ.get(key)
        if v:
            return v
        if not sec.exists():
            return None
        m = re.search(rf"{re.escape(key)}\s*[:=]?\s*([^\s#]+)",
                      sec.read_text(encoding="utf-8", errors="ignore"))
        return m.group(1) if m else None
    tok, chat = _secret("TELEGRAM_BOT_TOKEN"), _secret("TELEGRAM_CHAT_ID")
    if not tok or not chat:
        log("dự phòng thất bại: thiếu token/chat_id")
        return
    for i in range(0, len(text), 3800):
        try:
            req = _rq.Request(
                f"https://api.telegram.org/bot{tok}/sendMessage",
                data=_json.dumps({"chat_id": chat, "text": text[i:i + 3800]}).encode(),
                headers={"Content-Type": "application/json"})
            _rq.urlopen(req, timeout=60).read()
        except Exception as e:
            log(f"dự phòng gửi lỗi: {e}")
            return
    log("đã gửi bằng đường dự phòng")


VN_DOW = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ nhật"]
MODE_LABEL = {
    "plan": "lên kế hoạch tuần", "write": "viết bài theo plan",
    "report": "báo cáo tuần", None: "nghỉ viết",
}


def plan_items() -> tuple[Path | None, list[dict]]:
    """Đọc plan mới nhất: [{slug, done, date 'dd/mm', detail}]. Parse thuần, 0 token."""
    plans = sorted((REPO / ".claude/chief").glob("content-plan-*.md"))
    if not plans:
        return None, []
    items: list[dict] = []
    cur: dict | None = None
    for line in plans[-1].read_text(encoding="utf-8").splitlines():
        m = re.match(r"^## \[([ x])\] (\S+)", line)
        if m:
            cur = {"slug": m.group(2), "done": m.group(1) == "x", "date": None, "detail": ""}
            items.append(cur)
        elif cur is not None and not cur["detail"] and line.strip().startswith("- "):
            cur["detail"] = line.strip()[2:]
            d = re.search(r"(\d{2}/\d{2})", line)
            cur["date"] = d.group(1) if d else None
    return plans[-1], items


def daily_digest(mode: str | None) -> None:
    """Bản tin lịch nội dung mỗi sáng: hôm nay làm gì, mai có bài gì."""
    now = datetime.now(ICT)
    tomorrow = now + timedelta(days=1)
    plan_file, items = plan_items()

    def for_day(d: datetime) -> str:
        key = d.strftime("%d/%m")
        hits = [it for it in items if it["date"] == key]
        if not hits:
            return "không có bài theo lịch"
        return " · ".join(
            f"{'✅ đã viết' if it['done'] else '✍️ sẽ viết'} {it['slug']} ({it['detail']})"
            for it in hits)

    tomorrow_mode = MODE_LABEL.get(MODE_BY_WEEKDAY.get(tomorrow.weekday()))
    done = sum(1 for it in items if it["done"])
    lines = [
        f"📅 CONTENT · {VN_DOW[now.weekday()]} {now.strftime('%d/%m')}",
        f"Hôm nay ({MODE_LABEL.get(mode)}): {for_day(now)}",
        f"Ngày mai ({VN_DOW[tomorrow.weekday()]} {tomorrow.strftime('%d/%m')}, {tomorrow_mode}): {for_day(tomorrow)}",
    ]
    if items:
        lines.append(f"Tuần này: {done}/{len(items)} bài đã viết · plan: {plan_file.name}")
    else:
        lines.append("⚠️ Chưa có plan tuần — chờ lượt PLAN thứ Hai.")
    drafts = [d for d in items if d["done"]]
    if drafts:
        lines.append("Draft chờ duyệt → nhắn: /xuly đăng bài <slug>")
    tele("\n".join(lines), "digest")


def run_mode(mode: str) -> None:
    runbook = RUNBOOK.read_text(encoding="utf-8") if RUNBOOK.exists() else ""
    today = datetime.now(ICT)
    prompt = (
        f"{runbook}\n\n"
        f"HÔM NAY: {today.strftime('%A %Y-%m-%d')} (ICT), tuần ISO W{today.isocalendar()[1]}.\n"
        f"CHẾ ĐỘ LƯỢT NÀY: {mode.upper()}. Thực hiện đúng mục chế độ đó trong runbook."
    )
    log(f"bắt đầu chế độ {mode}")
    try:
        p = subprocess.run(
            [CLAUDE_BIN, "-p", prompt, "--permission-mode", PERMISSION_MODE],
            cwd=str(REPO), capture_output=True, text=True, timeout=TASK_TIMEOUT_S)
    except subprocess.TimeoutExpired:
        tele(f"❌ CONTENT {mode.upper()} QUÁ GIỜ ({TASK_TIMEOUT_S // 60}')\n"
             "Việc có thể dở dang — kiểm tra `git status` + .claude/chief/ trước khi chạy lại.",
             f"{mode}-timeout")
        log(f"quá giờ chế độ {mode}")
        return
    except FileNotFoundError:
        tele(f"❌ CONTENT: không thấy Claude ở {CLAUDE_BIN}", f"{mode}-noclaude")
        return
    out = (p.stdout or "").strip() or f"(agent {mode} không in gì — mã thoát {p.returncode})"
    tele(out, mode)
    log(f"xong chế độ {mode} (mã {p.returncode})")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=["plan", "write", "report"])
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--digest-only", action="store_true",
                    help="chỉ gửi bản tin lịch, không chạy claude")
    args = ap.parse_args()

    if PAUSE_FILE.exists():
        log("AGENTS_PAUSED — thoát")
        return 0

    mode = args.mode or MODE_BY_WEEKDAY.get(datetime.now(ICT).weekday())
    if args.dry_run:
        print(f"chế độ hôm nay: {mode or 'nghỉ'}")
        return 0

    # Bản tin lịch gửi MỖI NGÀY, kể cả ngày nghỉ viết (Cuong yêu cầu 07/09).
    daily_digest(mode)
    if args.digest_only:
        return 0
    if not mode:
        log("hôm nay nghỉ viết — chỉ gửi bản tin lịch")
        return 0

    try:
        os.mkdir(LOCK_DIR)
    except FileExistsError:
        log("lượt trước còn chạy — thoát")
        return 0
    try:
        run_mode(mode)
    finally:
        try:
            os.rmdir(LOCK_DIR)
        except Exception:
            pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
