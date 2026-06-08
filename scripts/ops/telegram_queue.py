#!/usr/bin/env python3
# ============================================================================
# telegram_queue.py — đọc/cập nhật hàng đợi lệnh Telegram (Supabase)
# ============================================================================
# Thay cho telegram_poll.py (getUpdates long-poll). Từ khi chuyển sang webhook
# (workers/telegram-webhook), Telegram ĐẨY mỗi lệnh vào bảng Supabase
# `telegram_commands`. Script này để agent telegram-commander RÚT hàng đợi:
#
#   python3 scripts/ops/telegram_queue.py --peek            # liệt kê lệnh pending (JSON)
#   python3 scripts/ops/telegram_queue.py --claim <id>      # đánh dấu đang xử lý
#   python3 scripts/ops/telegram_queue.py --done  <id> [--result "..."]
#   python3 scripts/ops/telegram_queue.py --error <id> [--result "..."]
#
# Luồng phiên (queue-mode) — TIẾT KIỆM TOKEN:
#   1. Chạy --peek NGAY đầu phiên. count==0 → THOÁT (đừng đọc spec, đừng làm gì).
#   2. count>0 → mới đọc CLAUDE.md + spec, rồi với mỗi lệnh: --claim → xử lý →
#      notify_telegram.py → --done (hoặc --error nếu lỗi).
#
# Creds (env ưu tiên, fallback .claude/secrets.local.md mục "## Supabase"):
#   SUPABASE_URL                (mặc định project URL hardcode)
#   SUPABASE_SERVICE_ROLE_KEY   (legacy JWT eyJ... trong secrets)
#
# Output JSON ra stdout. Exit 0 OK; !=0 nếu thiếu cấu hình / lỗi tham số.
# ============================================================================
import os
import re
import sys
import json
import urllib.request
import urllib.error
from datetime import datetime, timezone

SECRETS = os.environ.get("SECRETS_FILE", ".claude/secrets.local.md")
DEFAULT_SUPABASE_URL = "https://ajvlcamxemgbxduhiqrl.supabase.co"
TABLE = "telegram_commands"


def _secrets_text():
    try:
        return open(SECRETS, encoding="utf-8").read()
    except OSError:
        return ""


def supabase_url():
    env = os.environ.get("SUPABASE_URL")
    if env:
        return env.rstrip("/")
    m = re.search(r"Project URL\s*[:=]?\s*(https?://\S+)", _secrets_text())
    return (m.group(1) if m else DEFAULT_SUPABASE_URL).rstrip("/")


def service_role_key():
    env = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if env:
        return env
    # Lấy JWT legacy (3 đoạn base64url ngăn bởi dấu chấm) trong secrets.
    m = re.search(r"eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+", _secrets_text())
    return m.group(0) if m else None


def _headers(key, extra=None):
    h = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    if extra:
        h.update(extra)
    return h


def _request(method, path, key, body=None, extra_headers=None):
    url = f"{supabase_url()}/rest/v1/{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url, data=data, method=method, headers=_headers(key, extra_headers)
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read().decode()
            return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        return e.code, {"error": f"HTTP {e.code}: {e.read().decode()[:300]}"}
    except Exception as e:  # noqa: BLE001 — mạng/timeout, gói gọn về JSON
        return 0, {"error": str(e)}


def peek(key):
    """Lệnh pending, cũ nhất trước."""
    path = (
        f"{TABLE}?status=eq.pending"
        "&select=id,update_id,text,from_id,from_username,message_date,status"
        "&order=message_date.asc"
    )
    status, body = _request("GET", path, key)
    if status != 200:
        return {"ok": False, "error": (body or {}).get("error", f"HTTP {status}")}
    rows = body or []
    return {"ok": True, "count": len(rows), "commands": rows}


def update_status(key, row_id, new_status, result=None):
    try:
        rid = int(row_id)
    except (TypeError, ValueError):
        return {"ok": False, "error": f"id không hợp lệ: {row_id!r}"}
    fields = {"status": new_status}
    if new_status in ("done", "error"):
        fields["processed_at"] = datetime.now(timezone.utc).isoformat()
    if result is not None:
        fields["result"] = result[:2000]
    path = f"{TABLE}?id=eq.{rid}"
    status, body = _request(
        "PATCH", path, key, body=fields, extra_headers={"Prefer": "return=minimal"}
    )
    if status not in (200, 204):
        return {"ok": False, "error": (body or {}).get("error", f"HTTP {status}")}
    return {"ok": True, "id": rid, "status": new_status}


def main():
    key = service_role_key()
    if not key:
        print(json.dumps({"ok": False, "error": "Thiếu SUPABASE_SERVICE_ROLE_KEY"}))
        sys.exit(3)

    args = sys.argv[1:]

    # Tách --result "..." ra trước.
    result = None
    if "--result" in args:
        i = args.index("--result")
        result = args[i + 1] if i + 1 < len(args) else None
        del args[i : i + 2]

    if not args or args[0] in ("--peek", "peek"):
        print(json.dumps(peek(key), ensure_ascii=False))
        return

    mapping = {"--claim": "processing", "--done": "done", "--error": "error"}
    cmd = args[0]
    if cmd in mapping and len(args) >= 2:
        print(json.dumps(update_status(key, args[1], mapping[cmd], result), ensure_ascii=False))
        return

    print(json.dumps({"ok": False, "error": f"Lệnh không hợp lệ: {' '.join(args) or '(rỗng)'}"}))
    sys.exit(2)


if __name__ == "__main__":
    main()
