#!/usr/bin/env python3
# ============================================================================
# ops_sweep.py — QUÉT SỨC KHOẺ SITE chủ động (ops-medic v1 + growth digest v1)
# ============================================================================
# Chạy qua launchd (com.picklehub.opssweep) mỗi giờ. Hai việc:
#   1. SWEEP  : quét các bề mặt chưa ai canh chủ động. Alert Telegram CHỈ khi
#               có vấn đề MỚI hoặc vấn đề cũ ĐÃ KHỎI (alertOnce — bài học
#               wc-open-scraper spam 06/09). Không lặp lại alert mỗi giờ.
#   2. DIGEST : lượt chạy trong khung 21h gửi thêm bản tổng kết ngày:
#               việc CẦN XỬ LÝ + hoạt động cả đội agent hôm nay.
#
# Bề mặt quét (những lỗ ❌/⚠️ trong docs/ops/site-admin-duties.md mục 1+4):
#   - Site probe: /, /vi, /san (Googlebot UA, mong 200)
#   - Shop (CHỈ BÁO CÁO, không tự huỷ — đụng tiền là việc của Cuong):
#       đơn mới 24h · đơn quá confirm_due_at · claim thanh toán >12h chưa confirm
#   - Hàng đợi dịch: news_items.ai_translation_status error/pending tồn
#   - Job fail: RPC ops_job_health_snapshot (gom vào digest; alert tức thời đã
#     có errors-telegram-alert lo, không alert trùng)
#   - Watchdog của watchdog: edge-redeploy.log phải có "finished:" trong 2h;
#     log chief/xuly/content/fix-agent phải mới trong 26h. (Bài học 07/09:
#     edge-redeploy chết CÂM 12 ngày không ai hay.)
#
# Chạy tay:
#   python3 scripts/ops/ops_sweep.py --once            # quét 1 lượt
#   python3 scripts/ops/ops_sweep.py --digest          # ép gửi digest ngay
# ============================================================================
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

REPO = Path(os.environ.get("PICKLEHUB_REPO", Path(__file__).resolve().parents[2]))
SECRETS = Path(os.environ.get("SECRETS_FILE", REPO / ".claude/secrets.local.md"))
SUPABASE_URL = "https://ajvlcamxemgbxduhiqrl.supabase.co"
SITE = "https://www.thepicklehub.net"
PAUSE_FILE = REPO / ".claude/AGENTS_PAUSED"
LOCK_DIR = "/tmp/picklehub-opssweep.lock"
LOG_DIR = Path.home() / "Library/Logs/PickleHub"
STATE = Path.home() / "Library/Caches/PickleHub/ops-sweep-state.json"
ICT = timezone(timedelta(hours=7))
DIGEST_HOUR = 21

PROBE_PATHS = ["/", "/vi", "/san"]
DAEMON_LOGS = {  # log phải được ghi trong N giờ gần nhất
    "edge-redeploy.log": 2,   # chạy mỗi giờ, "finished:" phải mới
    "chief-launchd.log": 26,  # 1 lần/ngày 07:30
    "xuly.log": 78,           # chỉ ghi khi có việc — 3 ngày im là bất thường
    "content.log": 26,        # 1 lần/ngày 08:30
}


def log(msg: str) -> None:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    line = f"{datetime.now(ICT).strftime('%Y-%m-%d %H:%M:%S')} {msg}"
    print(line, flush=True)
    try:
        with open(LOG_DIR / "opssweep.log", "a", encoding="utf-8") as fh:
            fh.write(line + "\n")
    except Exception:
        pass


def secret(key: str) -> str | None:
    v = os.environ.get(key)
    if v:
        return v
    if not SECRETS.exists():
        return None
    m = re.search(rf"{re.escape(key)}\s*[:=]?\s*([^\s#]+)",
                  SECRETS.read_text(encoding="utf-8", errors="ignore"))
    return m.group(1) if m else None


def tele(text: str, tag: str) -> None:
    """Ghi file trước, gửi sau (bài học XL-83); fallback API trực tiếp."""
    outbox = REPO / ".claude/chief"
    try:
        outbox.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(ICT).strftime("%Y%m%d-%H%M%S")
        (outbox / f"opssweep-{tag}-{stamp}.md").write_text(text, encoding="utf-8")
    except Exception as e:
        log(f"không ghi được bản lưu: {e}")
    try:
        p = subprocess.run(
            [sys.executable, str(REPO / "scripts/ops/notify_telegram.py"), "-"],
            input=text, capture_output=True, text=True, cwd=str(REPO), timeout=180)
        if p.returncode == 0:
            return
        log(f"notify_telegram mã {p.returncode}")
    except Exception as e:
        log(f"notify_telegram lỗi: {e}")
    tok, chat = secret("TELEGRAM_BOT_TOKEN"), secret("TELEGRAM_CHAT_ID")
    if not tok or not chat:
        return
    for i in range(0, len(text), 3800):
        try:
            req = urllib.request.Request(
                f"https://api.telegram.org/bot{tok}/sendMessage",
                data=json.dumps({"chat_id": chat, "text": text[i:i + 3800]}).encode(),
                headers={"Content-Type": "application/json"})
            urllib.request.urlopen(req, timeout=60).read()
        except Exception as e:
            log(f"dự phòng gửi lỗi: {e}")
            return


def rest(path: str):
    key = secret("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        raise RuntimeError("thiếu SUPABASE_SERVICE_ROLE_KEY")
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{path}",
        headers={"apikey": key, "Authorization": f"Bearer {key}",
                 "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        body = r.read().decode()
        return json.loads(body) if body.strip() else []


def rpc(name: str):
    key = secret("SUPABASE_SERVICE_ROLE_KEY")
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/rpc/{name}", method="POST", data=b"{}",
        headers={"apikey": key, "Authorization": f"Bearer {key}",
                 "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


# ------------------------------------------------------------------ Các check
# Mỗi check trả (problems: dict{key: mô_tả}, info: list[str] cho digest)

def check_site() -> tuple[dict, list]:
    problems, info = {}, []
    for p in PROBE_PATHS:
        try:
            req = urllib.request.Request(
                SITE + p, headers={"User-Agent":
                    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"})
            code = urllib.request.urlopen(req, timeout=15).status
        except Exception as e:
            code = getattr(e, "code", 0) or 0
        if code != 200:
            problems[f"site:{p}"] = f"{SITE}{p} trả {code}"
    info.append(f"Site probe {len(PROBE_PATHS)} trang: "
                f"{'OK hết' if not problems else 'CÓ LỖI'}")
    return problems, info


def iso(dt: datetime) -> str:
    """PostgREST filter: dấu '+' trong ISO offset bị URL hiểu thành space → 400.
    Dùng hậu tố Z."""
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def check_shop() -> tuple[dict, list]:
    problems, info = {}, []
    now = datetime.now(timezone.utc)
    day_ago = iso(now - timedelta(hours=24))
    new = rest(f"shop_orders?select=code,status,total_vnd&created_at=gte.{day_ago}")
    info.append(f"Shop: {len(new)} đơn mới 24h" +
                (f" ({', '.join(o['code'] for o in new[:5])})" if new else ""))
    # Đơn quá hạn xác nhận — CHỈ BÁO, không tự huỷ (đụng tiền = việc của Cuong)
    overdue = rest("shop_orders?select=code,status,confirm_due_at"
                   "&status=in.(pending_confirmation,awaiting_payment,pending)"
                   f"&confirm_due_at=lt.{iso(now)}")
    for o in overdue:
        problems[f"shop:overdue:{o['code']}"] = (
            f"Đơn {o['code']} quá hạn xác nhận ({o['status']}) — cần Cuong xử lý")
    # Claim thanh toán >12h chưa confirm
    claim_cut = iso(now - timedelta(hours=12))
    claimed = rest("shop_orders?select=code,payment_claimed_at"
                   f"&payment_claimed_at=lt.{claim_cut}&payment_confirmed_at=is.null"
                   "&status=not.in.(cancelled,refunded,delivered)")
    for o in claimed:
        problems[f"shop:claim:{o['code']}"] = (
            f"Đơn {o['code']} khách báo đã chuyển khoản >12h chưa được xác nhận")
    return problems, info


def check_translation() -> tuple[dict, list]:
    problems, info = {}, []
    # CHỈ tin EN: RPC claim_pending_news_translations chỉ nhận language='en';
    # dòng vi mặc định 'pending' vĩnh viễn theo thiết kế (false-positive 07/09).
    err = rest("news_items?select=id&language=eq.en&ai_translation_status=eq.error&limit=100")
    cut = iso(datetime.now(timezone.utc) - timedelta(hours=12))
    stale = rest("news_items?select=id&language=eq.en&ai_translation_status=eq.pending"
                 f"&created_at=lt.{cut}&limit=200")
    if len(err) > 0:
        problems["translate:error"] = f"{len(err)} tin dịch LỖI (ai_translation_status=error)"
    if len(stale) > 20:
        problems["translate:stale"] = f"{len(stale)} tin chờ dịch quá 12h — pipeline dịch có thể kẹt"
    info.append(f"Dịch tin: {len(err)} lỗi · {len(stale)} pending>12h")
    return problems, info


def check_jobs() -> tuple[dict, list]:
    """Job fail gom vào DIGEST — alert tức thời đã có errors-telegram-alert."""
    problems, info = {}, []
    try:
        snap = rpc("ops_job_health_snapshot")
        jobs = snap if isinstance(snap, list) else snap.get("jobs", [])
        bad = [j for j in jobs
               if str(j.get("run_status") or "").lower() in ("failed", "error")
               or str(j.get("monitor_state") or "").lower() in ("alert", "failing")]
        if bad:
            names = ", ".join(str(j.get("job_key") or j.get("display_name") or "?")
                              for j in bad[:8])
            info.append(f"⚠️ Job đỏ: {names}")
        else:
            info.append(f"Jobs: {len(jobs)} job, không có fail ở lượt gần nhất")
    except Exception as e:
        info.append(f"Jobs: không đọc được snapshot ({e})")
    return problems, info


def check_scrape_freshness() -> tuple[dict, list]:
    """Ngày có giải live (pro_tour_events) mà scraper im >10' = cron chết câm
    (đã xảy ra 10/09: Cloudflare ngừng bắn cron */1, redeploy worker mới hồi).
    Ngoài ngày giải: ngưỡng 26h (nhịp daily)."""
    problems, info = {}, []
    now = datetime.now(timezone.utc)
    today = (now + timedelta(hours=8)).strftime("%Y-%m-%d")
    live = rest(f"pro_tour_events?select=slug&start_date=lte.{today}&end_date=gte.{today}&limit=1")
    rows = rest("pro_tour_watchlist?select=last_scraped_at&status=eq.active"
                "&order=last_scraped_at.desc.nullslast&limit=1")
    newest = rows[0]["last_scraped_at"] if rows and rows[0]["last_scraped_at"] else None
    limit_min = 10 if live else 26 * 60
    if newest:
        age_min = (now - datetime.fromisoformat(newest.replace("Z", "+00:00"))).total_seconds() / 60
        if age_min > limit_min:
            problems["protour:stale"] = (
                f"Scraper pro-tour im {age_min:.0f} phút (ngưỡng {limit_min}') — "
                "cron có thể chết câm; thuốc: `wrangler deploy` lại worker")
        info.append(f"Pro-tour scrape mới nhất: {age_min:.0f}' trước"
                    + (" (đang có giải live)" if live else ""))
    elif live:
        problems["protour:stale"] = "Watchlist chưa từng được quét trong khi có giải live"
    return problems, info


def check_daemons() -> tuple[dict, list]:
    problems, info = {}, []
    now = datetime.now().timestamp()
    for name, max_h in DAEMON_LOGS.items():
        f = LOG_DIR / name
        if not f.exists():
            problems[f"daemon:{name}"] = f"{name} không tồn tại — daemon chưa từng chạy?"
            continue
        age_h = (now - f.stat().st_mtime) / 3600
        if age_h > max_h:
            problems[f"daemon:{name}"] = (
                f"{name} im {age_h:.0f}h (ngưỡng {max_h}h) — daemon có thể chết câm")
    # edge-redeploy: mtime mới chưa đủ — phải là run THÀNH CÔNG gần đây
    try:
        txt = (LOG_DIR / "edge-redeploy.log").read_text(errors="ignore")[-20000:]
        lines = [l for l in txt.splitlines() if "finished: total" in l or "ABORT" in l]
        if lines and "failed=0" not in lines[-1] and "ABORT" not in lines[-1]:
            problems["daemon:redeploy-fail"] = f"edge-redeploy có function fail: {lines[-1][-120:]}"
    except Exception:
        pass
    info.append(f"Daemon logs: {len(DAEMON_LOGS)} theo dõi, "
                f"{sum(1 for k in problems if k.startswith('daemon:'))} bất thường")
    return problems, info


# ------------------------------------------------------------------ State
def load_state() -> dict:
    try:
        return json.loads(STATE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_state(st: dict) -> None:
    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps(st, ensure_ascii=False), encoding="utf-8")


def agent_activity_today() -> list[str]:
    """Đếm output cả đội hôm nay từ .claude/chief/ — sổ hoạt động chung."""
    today = datetime.now(ICT).strftime("%Y%m%d")
    out: dict[str, int] = {}
    for f in (REPO / ".claude/chief").glob("*.md"):
        if today in f.name:
            kind = f.name.split("-")[0]
            out[kind] = out.get(kind, 0) + 1
    return [f"{k}: {v} lượt" for k, v in sorted(out.items())] or ["(chưa có output nào hôm nay)"]


def run(force_digest: bool = False) -> None:
    checks = [("site", check_site), ("shop", check_shop),
              ("dịch", check_translation), ("jobs", check_jobs),
              ("daemon", check_daemons), ("protour", check_scrape_freshness)]
    problems: dict[str, str] = {}
    infos: list[str] = []
    for name, fn in checks:
        try:
            p, i = fn()
            problems.update(p)
            infos.extend(i)
        except Exception as e:
            infos.append(f"{name}: check lỗi ({e})")

    st = load_state()
    known = set(st.get("problems", {}))
    current = set(problems)
    appeared = current - known
    resolved = known - current

    if appeared:
        lines = ["🚨 OPS SWEEP — vấn đề MỚI:"]
        lines += [f"• {problems[k]}" for k in sorted(appeared)]
        lines.append("\nXử lý: nhắn /xuly <mô tả> hoặc /diagnose qua bot ops.")
        tele("\n".join(lines), "alert")
    if resolved:
        tele("✅ OPS SWEEP — đã khỏi:\n" +
             "\n".join(f"• {st['problems'][k]}" for k in sorted(resolved)), "resolved")

    st["problems"] = problems
    st.setdefault("day_infos", {})
    today = datetime.now(ICT).strftime("%Y-%m-%d")
    if st.get("day") != today:
        st["day"] = today
        st["day_infos"] = {}
        st["digest_sent"] = False
    st["day_infos"][datetime.now(ICT).strftime("%H:%M")] = len(problems)

    hour = datetime.now(ICT).hour
    if force_digest or (hour == DIGEST_HOUR and not st.get("digest_sent")):
        lines = [f"🌙 TỔNG KẾT NGÀY {today}"]
        if problems:
            lines.append(f"\n⚠️ VIỆC CẦN XỬ LÝ ({len(problems)}):")
            lines += [f"• {v}" for v in list(problems.values())[:12]]
        else:
            lines.append("\n✅ Không có việc tồn cần xử lý.")
        lines.append("\nTình trạng lượt quét mới nhất:")
        lines += [f"• {i}" for i in infos]
        lines.append("\nHoạt động đội agent hôm nay:")
        lines += [f"• {a}" for a in agent_activity_today()]
        tele("\n".join(lines), "digest")
        st["digest_sent"] = True

    save_state(st)
    log(f"sweep xong: {len(problems)} vấn đề ({len(appeared)} mới, {len(resolved)} khỏi)")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--once", action="store_true")
    ap.add_argument("--digest", action="store_true", help="ép gửi digest ngay")
    args = ap.parse_args()

    if PAUSE_FILE.exists():
        log("AGENTS_PAUSED — thoát")
        return 0
    try:
        os.mkdir(LOCK_DIR)
    except FileExistsError:
        log("lượt trước còn chạy — thoát")
        return 0
    try:
        run(force_digest=args.digest)
    finally:
        try:
            os.rmdir(LOCK_DIR)
        except Exception:
            pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
