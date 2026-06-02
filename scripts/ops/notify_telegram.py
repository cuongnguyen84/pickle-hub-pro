#!/usr/bin/env python3
# ============================================================================
# notify_telegram.py — gửi báo cáo ops tới Telegram
# ============================================================================
# Đọc credential từ .claude/secrets.local.md (mục "## Telegram"):
#     TELEGRAM_BOT_TOKEN:  123456:ABC...
#     TELEGRAM_CHAT_ID:    123456789
# Hoặc lấy từ env TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID (env ưu tiên).
#
# Cách dùng:
#   python3 scripts/ops/notify_telegram.py "Nội dung báo cáo..."
#   echo "Nội dung dài..." | python3 scripts/ops/notify_telegram.py -
#   python3 scripts/ops/notify_telegram.py --title "🔴 CẢNH BÁO build fail" -
#
# - Tự chia message > 4096 ký tự thành nhiều phần (giới hạn Telegram).
# - parse_mode=Markdown. Nếu Telegram từ chối Markdown (400) sẽ gửi lại plain.
# - Exit 0 nếu gửi xong, !=0 nếu lỗi cấu hình/mạng.
# ============================================================================
import os
import re
import sys
import json
import time
import urllib.request
import urllib.error

SECRETS = os.environ.get("SECRETS_FILE", ".claude/secrets.local.md")
MAX = 3800  # chừa biên dưới giới hạn 4096 của Telegram


def from_secrets(key):
    if not os.path.exists(SECRETS):
        return None
    txt = open(SECRETS, encoding="utf-8").read()
    # Khớp "KEY: value" hoặc "KEY value" (cho phép khoảng trắng/căn cột).
    m = re.search(rf"{re.escape(key)}\s*[:=]?\s*([^\s#]+)", txt)
    return m.group(1) if m else None


def cfg(env_key, secret_key):
    return os.environ.get(env_key) or from_secrets(secret_key)


def chunks(text):
    out, buf = [], ""
    for line in text.split("\n"):
        if len(buf) + len(line) + 1 > MAX:
            if buf:
                out.append(buf)
            # dòng đơn quá dài → cắt cứng
            while len(line) > MAX:
                out.append(line[:MAX])
                line = line[MAX:]
            buf = line
        else:
            buf = f"{buf}\n{line}" if buf else line
    if buf:
        out.append(buf)
    return out or [""]


def send(token, chat_id, text, markdown=True):
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {"chat_id": chat_id, "text": text, "disable_web_page_preview": True}
    if markdown:
        payload["parse_mode"] = "Markdown"
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        url, data=data, headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def main():
    token = cfg("TELEGRAM_BOT_TOKEN", "TELEGRAM_BOT_TOKEN")
    chat_id = cfg("TELEGRAM_CHAT_ID", "TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        sys.stderr.write(
            "Thiếu TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID. "
            "Thêm vào .claude/secrets.local.md mục '## Telegram' hoặc export env.\n"
        )
        sys.exit(3)

    args = [a for a in sys.argv[1:]]
    title = None
    if "--title" in args:
        i = args.index("--title")
        title = args[i + 1]
        del args[i:i + 2]

    body = ""
    if args and args[0] != "-":
        body = " ".join(args)
    else:
        body = sys.stdin.read()

    text = f"*{title}*\n\n{body}" if title else body
    parts = chunks(text)
    total = len(parts)
    for idx, part in enumerate(parts, 1):
        prefix = f"_(phần {idx}/{total})_\n" if total > 1 else ""
        status, resp = send(token, chat_id, prefix + part, markdown=True)
        if status == 400 and "can't parse" in resp.lower():
            status, resp = send(token, chat_id, prefix + part, markdown=False)
        if status != 200:
            sys.stderr.write(f"Telegram lỗi {status}: {resp[:300]}\n")
            sys.exit(4)
        if total > 1:
            time.sleep(0.4)  # tránh rate limit
    print(f"Đã gửi Telegram ({total} phần).")


if __name__ == "__main__":
    main()
