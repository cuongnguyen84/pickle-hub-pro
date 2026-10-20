#!/usr/bin/env python3
# ============================================================================
# chat_requests_agent.py — theo dõi "Tạo giải bằng chat AI": người dùng muốn gì
# mà app CHƯA đáp ứng được, báo Cuong qua Telegram mỗi tối.
# ============================================================================
# Nguồn: bảng quick_table_chat_log (edge function quick-table-chat ghi mỗi lượt,
# kèm `unmet` khi AI tự nhận ra yêu cầu chưa làm được). Agent đọc 24h gần nhất:
#   1. Gom các lượt AI đã đánh dấu unmet / unsupported / lỗi.
#   2. Đưa CẢ hội thoại cho `claude -p` đọc lại → tìm thêm yêu cầu AI bỏ sót,
#      gom nhóm, xếp ưu tiên theo số người hỏi, gợi ý hướng xử lý.
#   3. Gửi Telegram. Không có lượt chat nào thì im (không spam).
#
# Chạy qua launchd (com.picklehub.chat-requests) 21:30 mỗi ngày.
# Chạy tay:
#   python3 scripts/ops/chat_requests_agent.py              # 24h qua, gửi Telegram
#   python3 scripts/ops/chat_requests_agent.py --hours 72 --dry   # in ra, không gửi
#   python3 scripts/ops/chat_requests_agent.py --no-reason  # bỏ bước claude -p
# ============================================================================
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import urllib.parse
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ops_sweep import ICT, PAUSE_FILE, log, rest, tele  # noqa: E402

CLAUDE_BIN = os.environ.get("CLAUDE_BIN", str(Path.home() / ".local/bin/claude"))
REASON_TIMEOUT_S = 300
MAX_TURNS_TO_REASON = 400  # ~1 ngày rất đông; cắt bớt để prompt không phình

PROMPT = """Bạn là agent sản phẩm của ThePickleHub. Dưới đây là nhật ký 24h của tính năng
"Tạo giải chia bảng bằng chat AI" (vòng bảng → playoff, chia nhánh Series A/B/C, xếp sân).
Mỗi dòng: user (ẩn danh), bước app đang hỏi, câu người dùng, câu trả lời của bot, intent, unmet (AI tự đánh dấu).

App HIỆN làm được: giải đơn/đôi 2–48 đội; 2–16 bảng (3–8 đội/bảng); playoff 1–3 nhánh, cỡ nhánh
cắt theo bảng xếp hạng toàn giải (vd 16 + còn lại), ghép chéo A1–B2 khi nhánh đủ 2 hạng; tự xếp sân
+ giờ; hạt giống; tránh cùng CLB; số set 1/3/5; đọc danh sách từ chữ, ảnh, PDF, Excel; mở đăng ký.

Việc của bạn: tìm MỌI yêu cầu người dùng mà app CHƯA đáp ứng (kể cả khi bot đã trả lời lấp liếm
hoặc unmet để trống) — thể thức lạ, tính năng thiếu, câu hỏi bot trả lời sai/né, chỗ người dùng bối
rối phải hỏi lại. Bỏ qua chào hỏi, câu đã được xử lý đúng.

OUTPUT: DUY NHẤT một JSON object:
{
  "headline_vi": "1 câu tóm tắt",
  "requests": [
    {"title_vi": "yêu cầu, viết như user story ngắn", "users": <số user khác nhau>, "examples": ["trích nguyên văn ≤ 2 câu"],
     "kind": "the_thuc|tinh_nang|tra_loi_sai|kho_hieu|khac", "suggestion_vi": "1 câu hướng xử lý", "priority": "cao|vua|thap"}
  ]
}
Gom các yêu cầu giống nhau thành 1. Tối đa 10, xếp theo priority rồi users."""


def fetch(hours: int) -> list[dict]:
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    q = urllib.parse.urlencode({
        "select": "created_at,user_id,pending,user_text,has_attachment,reply,intent,unmet",
        "created_at": f"gte.{since}",
        "order": "created_at.asc",
        "limit": "1000",
    })
    return rest(f"quick_table_chat_log?{q}")


def anon_ids(rows: list[dict]) -> dict[str, str]:
    ids: dict[str, str] = {}
    for r in rows:
        ids.setdefault(r.get("user_id") or "?", f"U{len(ids) + 1}")
    return ids


def reason(rows: list[dict], ids: dict[str, str]) -> dict | None:
    if not Path(CLAUDE_BIN).exists():
        log(f"không thấy {CLAUDE_BIN} — bỏ bước suy luận")
        return None
    lines = [
        json.dumps({
            "u": ids[r.get("user_id") or "?"], "step": r.get("pending"),
            "user": (r.get("user_text") or "")[:300] + (" [kèm file]" if r.get("has_attachment") else ""),
            "bot": (r.get("reply") or "")[:200], "intent": r.get("intent"), "unmet": r.get("unmet"),
        }, ensure_ascii=False)
        for r in rows[-MAX_TURNS_TO_REASON:]
    ]
    try:
        p = subprocess.run([CLAUDE_BIN, "-p", PROMPT + "\n\nNHẬT KÝ:\n" + "\n".join(lines)],
                           capture_output=True, text=True, timeout=REASON_TIMEOUT_S)
        out = (p.stdout or "").strip()
        return json.loads(out[out.index("{"):out.rindex("}") + 1])
    except Exception as e:
        log(f"claude -p lỗi: {e}")
        return None


def render(rows: list[dict], ids: dict[str, str], ideas: dict | None, hours: int) -> str:
    users = len(ids)
    flagged = [r for r in rows if r.get("unmet") or r.get("intent") in ("unsupported", "error")]
    intents = Counter(r.get("intent") for r in rows)
    L = [f"*💬 Chat tạo giải — yêu cầu chưa đáp ứng ({hours}h)*",
         f"_{datetime.now(ICT).strftime('%d/%m %H:%M')} · {len(rows)} lượt chat · {users} người · "
         f"AI tự đánh dấu {len(flagged)} · lỗi AI {intents.get('error', 0)}_"]
    if ideas and ideas.get("headline_vi"):
        L.append(f"\n> {ideas['headline_vi']}")
    reqs = (ideas or {}).get("requests") or []
    if reqs:
        mark = {"cao": "🔴", "vua": "🟡", "thap": "⚪"}
        for i, q in enumerate(reqs, 1):
            L.append(f"\n{mark.get(q.get('priority'), '•')} *{i}. {q.get('title_vi', '')}* — {q.get('users', '?')} người")
            for ex in (q.get("examples") or [])[:2]:
                L.append(f"   “{str(ex)[:160]}”")
            if q.get("suggestion_vi"):
                L.append(f"   → {q['suggestion_vi']}")
    elif flagged:
        # Không có suy luận → liệt kê thẳng những gì AI đã đánh dấu.
        L.append("\n*AI đánh dấu:*")
        for r in flagged[-15:]:
            what = r.get("unmet") or f"[{r.get('intent')}] {(r.get('user_text') or '')[:120]}"
            L.append(f"• {ids[r.get('user_id') or '?']}: {what[:200]}")
    else:
        L.append("\nKhông thấy yêu cầu nào app chưa đáp ứng.")
    return "\n".join(L)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--hours", type=int, default=24)
    ap.add_argument("--dry", action="store_true", help="in ra, không gửi Telegram")
    ap.add_argument("--no-reason", action="store_true", help="bỏ bước claude -p")
    a = ap.parse_args()
    if PAUSE_FILE.exists():
        log("AGENTS_PAUSED — thoát")
        return 0
    try:
        rows = fetch(a.hours)
    except Exception as e:
        log(f"chat_requests: đọc log lỗi: {e}")
        if not a.dry:
            tele(f"⚠️ chat_requests_agent không đọc được quick_table_chat_log: {e}", "chat-requests-error")
        return 1
    if not rows:
        log(f"chat_requests: 0 lượt chat trong {a.hours}h — không gửi")
        return 0
    ids = anon_ids(rows)
    ideas = None if a.no_reason else reason(rows, ids)
    text = render(rows, ids, ideas, a.hours)
    if a.dry:
        print(text)
    else:
        tele(text, "chat-requests")
        log(f"chat_requests: đã gửi ({len(rows)} lượt)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
