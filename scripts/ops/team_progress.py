"""Publish a credential-free progress snapshot for synchronous Telegram reads."""
import json
import re
import time
from datetime import datetime, timezone


def iso(value):
    return datetime.fromtimestamp(value, timezone.utc).isoformat()


def target(store, value):
    match = re.fullmatch(r"(T|XL)-?([1-9]\d*)", value, re.I)
    if not match:
        return None
    if match[1].upper() == "T":
        return store.db.execute("SELECT * FROM tasks WHERE id=?", (int(match[2]),)).fetchone()
    return store.db.execute("SELECT * FROM tasks WHERE dedupe=?", (f"telegram:{int(match[2])}",)).fetchone()


def snapshot(store):
    import team_supervisor as team
    now = time.time()
    tasks = []
    used, calls = store.db.execute("SELECT COALESCE(SUM(MAX(cost,reserved)),0),COUNT(*) FROM runs WHERE started>? AND reserved>0", (now - 86400,)).fetchone()
    for row in store.db.execute("SELECT * FROM tasks ORDER BY id"):
        ev = json.loads(row["evidence"])
        if re.match(r"^team(?:\s|$)", ev.get("request", ""), re.I):
            continue
        note = store.get(f"progress:{row['id']}", {})
        reason = note.get("reason", ev.get("detail", ""))
        status = row["status"]
        if status == "queued":
            if store.get("paused", False):
                reason = "Bộ điều phối đang tạm dừng để bảo trì."
            elif not team.provider_available(store):
                reason = "Provider đang bị chặn/hết hạn mức; chưa bắt đầu."
            elif store.get("internal_budget_enabled", True) and (calls >= team.CALLS or used + team.LIMIT > team.DAILY_LIMIT):
                reason = "Đang chạm trần 12 lượt/24 giờ của bộ điều phối; chưa bắt đầu."
        tasks.append({"id": row["id"], "telegram_id": ev.get("telegram_id"),
                      "title": row["title"], "status": status, "reason": str(reason)[:1400],
                      "next_step": note.get("next_step", ""), "updated_at": iso(row["updated"]),
                      "attempts": row["attempts"], "priority": bool(store.get(f"priority:{row['id']}", False)),
                      "related_task_id": note.get("related_task_id")})
    tasks.sort(key=lambda task: (not task["priority"], task["telegram_id"] is None, task["id"]))
    from team_content import render_calendar
    return team.scrub({"schema": "team-v2.snapshot.v1", "updated_at": iso(now), "content_calendar": render_calendar(store),
                       "heartbeat_at": iso(store.get("heartbeat", now)), "tasks": tasks})


def publish(store):
    import team_supervisor as team
    chat = team.secret("TELEGRAM_CHAT_ID")
    if not chat or not re.fullmatch(r"-?\d+", str(chat)):
        raise RuntimeError("missing_snapshot_chat")
    path = f"telegram_commands?text=eq./team_snapshot&chat_id=eq.{chat}&status=eq.done"
    rows = team.rest(path + "&select=id&order=id.desc&limit=1")
    data = {"result": json.dumps(snapshot(store), ensure_ascii=False), "processed_at": iso(time.time())}
    if rows:
        result = team.rest(path + f"&id=eq.{int(rows[0]['id'])}", "PATCH", data)
    else:
        result = team.rest("telegram_commands", "POST", {
            **data, "update_id": -int(time.time() * 1000), "chat_id": int(chat),
            "from_id": int(team.secret("TELEGRAM_ADMIN_ID") or chat),
            "message_date": iso(time.time()), "text": "/team_snapshot", "status": "done"})
    if not result:
        raise RuntimeError("snapshot_not_written")
    store.put("snapshot_published_at", time.time())
