#!/usr/bin/env python3
# ============================================================================
# telegram_poll.py — đọc lệnh từ Telegram cho ops agent (chiều VÀO)
# ============================================================================
# Cặp đôi với notify_telegram.py (chiều RA). Script này lấy tin nhắn mới mà
# Cuong gửi cho bot, lọc đúng chat được phép, và in ra JSON để agent xử lý.
#
# Bảo mật: CHỈ nhận message từ chat khớp TELEGRAM_CHAT_ID (allowlist). Tin từ
# chat khác (hoặc tin không phải text — sticker/ảnh…) bị bỏ qua. Các update
# "không phải lệnh" này được TỰ ĐỘNG ack để không kẹt hàng đợi (nếu không,
# mỗi lần poll sẽ trả về count==0 tức thì → vòng listen-burst quay vô ích).
#
# Đọc credential từ .claude/secrets.local.md (mục "## Telegram") hoặc env:
#     TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
#
# Cách dùng:
#   python3 scripts/ops/telegram_poll.py            # (peek) getUpdates timeout=0, KHÔNG ack lệnh
#   python3 scripts/ops/telegram_poll.py --peek     # giống trên
#   python3 scripts/ops/telegram_poll.py --wait [N] # LONG-POLL ~N giây (mặc định 25), bắt tin gần real-time
#   python3 scripts/ops/telegram_poll.py --ack 1234 # đánh dấu đã xử lý tới update_id
#
# Output (peek/wait) — JSON ra stdout:
#   {"ok": true, "count": N, "max_update_id": M, "skipped_non_command": bool,
#    "commands": [
#       {"update_id":.., "date":.., "text":"...", "from_id":.., "from_username":".."}
#    ]}
#
# State: .claude/telegram_state.json  ->  {"offset": <next_update_id>}
# Quy ước:
#   - peek/wait KHÔNG dời offset cho các LỆNH (idempotent — đọc lại được tới --ack).
#   - peek/wait TỰ dời offset qua các update KHÔNG-phải-lệnh (foreign chat / non-text)
#     vì chúng không cần xử lý → tránh kẹt hàng đợi.
#   - Sau khi xử lý xong 1 batch lệnh, agent gọi --ack <max_update_id> để chốt.
#
# 409 Conflict: Telegram chỉ cho 1 getUpdates chạy đồng thời cho mỗi bot. Vòng
# listen-burst phải tuần tự (1 --wait tại một thời điểm) và cron phải thưa hơn
# tổng thời lượng nghe để 2 lần chạy không chồng lấn.
#
# Exit: 0 OK; !=0 nếu thiếu cấu hình / lỗi mạng.
# ============================================================================
import os
import re
import sys
import json
import urllib.request
import urllib.error
import urllib.parse

SECRETS = os.environ.get("SECRETS_FILE", ".claude/secrets.local.md")
STATE_FILE = os.environ.get("TELEGRAM_STATE_FILE", ".claude/telegram_state.json")

# Long-poll mặc định cho --wait (giây). Giữ < ~30s để cả lệnh bash gói gọn dưới
# trần 45s của sandbox (urlopen timeout = long_poll + 12).
DEFAULT_LONG_POLL = int(os.environ.get("TELEGRAM_LONG_POLL", "25"))


def from_secrets(key):
    if not os.path.exists(SECRETS):
        return None
    txt = open(SECRETS, encoding="utf-8").read()
    m = re.search(rf"{re.escape(key)}\s*[:=]?\s*([^\s#]+)", txt)
    return m.group(1) if m else None


def cfg(env_key, secret_key):
    return os.environ.get(env_key) or from_secrets(secret_key)


def load_state():
    try:
        with open(STATE_FILE, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"offset": 0}


def save_state(state):
    os.makedirs(os.path.dirname(STATE_FILE) or ".", exist_ok=True)
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f)


def get_updates(token, offset, long_poll=0):
    params = {
        "timeout": long_poll,
        "allowed_updates": json.dumps(["message"]),
    }
    if offset:
        params["offset"] = offset
    qs = "&".join(f"{k}={urllib.parse.quote(str(v))}" for k, v in params.items())
    url = f"https://api.telegram.org/bot{token}/getUpdates?{qs}"
    req = urllib.request.Request(url)
    try:
        # urlopen phải chờ lâu hơn long-poll của Telegram một chút.
        with urllib.request.urlopen(req, timeout=max(30, long_poll + 12)) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return {"ok": False, "error": f"HTTP {e.code}: {e.read().decode()[:200]}"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def extract_commands(resp, offset, chat_allow):
    """Trả (commands, max_update_id). commands = chỉ tin TEXT từ chat allowlist."""
    commands = []
    max_update_id = offset - 1 if offset else 0
    for upd in resp.get("result", []):
        uid = upd.get("update_id", 0)
        if uid > max_update_id:
            max_update_id = uid
        msg = upd.get("message") or {}
        chat = msg.get("chat") or {}
        # allowlist: chỉ nhận đúng chat của Cuong
        if str(chat.get("id")) != str(chat_allow):
            continue
        text = (msg.get("text") or "").strip()
        if not text:
            continue
        frm = msg.get("from") or {}
        commands.append({
            "update_id": uid,
            "date": msg.get("date"),
            "text": text,
            "from_id": frm.get("id"),
            "from_username": frm.get("username"),
        })
    return commands, max_update_id


def poll(token, chat_allow, long_poll):
    """Một lần đọc (peek nếu long_poll==0, wait nếu >0). Tự skip update không-lệnh."""
    state = load_state()
    offset = state.get("offset", 0)
    resp = get_updates(token, offset, long_poll=long_poll)
    if not resp.get("ok"):
        return {"ok": False, "error": resp.get("error", "getUpdates failed")}

    commands, max_update_id = extract_commands(resp, offset, chat_allow)

    skipped = False
    # Có update trả về nhưng KHÔNG có lệnh nào (toàn foreign chat / non-text):
    # dời offset qua chúng để không kẹt hàng đợi. KHÔNG đụng tới offset khi có lệnh
    # (giữ idempotent cho lệnh tới khi agent --ack).
    if not commands and max_update_id >= offset:
        save_state({"offset": max_update_id + 1})
        get_updates(token, max_update_id + 1)  # xoá phía server
        skipped = True

    return {
        "ok": True,
        "count": len(commands),
        "max_update_id": max_update_id,
        "skipped_non_command": skipped,
        "commands": commands,
    }


def main():
    token = cfg("TELEGRAM_BOT_TOKEN", "TELEGRAM_BOT_TOKEN")
    chat_allow = cfg("TELEGRAM_CHAT_ID", "TELEGRAM_CHAT_ID")
    if not token or not chat_allow:
        print(json.dumps({"ok": False, "error": "Thiếu TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID"}))
        return 2

    args = sys.argv[1:]

    # --- chế độ ack: chốt offset đã xử lý ---
    if args and args[0] == "--ack":
        if len(args) < 2 or not args[1].lstrip("-").isdigit():
            print(json.dumps({"ok": False, "error": "Cần: --ack <update_id>"}))
            return 2
        next_off = int(args[1]) + 1
        save_state({"offset": next_off})
        # gọi getUpdates với offset mới để Telegram xoá update cũ phía server
        get_updates(token, next_off)
        print(json.dumps({"ok": True, "acked_through": int(args[1]), "offset": next_off}))
        return 0

    # --- chế độ wait: long-poll (bắt tin gần real-time) ---
    if args and args[0] == "--wait":
        long_poll = DEFAULT_LONG_POLL
        if len(args) > 1 and args[1].lstrip("-").isdigit():
            long_poll = max(1, int(args[1]))
        out = poll(token, chat_allow, long_poll)
        print(json.dumps(out, ensure_ascii=False))
        return 0 if out.get("ok") else 1

    # --- chế độ peek (mặc định): getUpdates timeout=0 ---
    out = poll(token, chat_allow, 0)
    print(json.dumps(out, ensure_ascii=False))
    return 0 if out.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
