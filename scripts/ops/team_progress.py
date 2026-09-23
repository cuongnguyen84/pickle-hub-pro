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
        from team_actions import state
        action = state(store, row['id'])
        if action:
            note = {**note, 'reason': action.get('reason'), 'next_step': action.get('next_step')}
        reason = note.get("reason", ev.get("detail", ""))
        status = row["status"]
        if status not in {'resolved', 'cancelled'} and action.get('phase') in {'queued', 'running', 'awaiting_ci', 'deploying'}:
            status = 'queued' if action['phase'] == 'queued' else 'running'
        if status == "queued":
            if store.get("paused", False):
                reason = "Bộ điều phối đang tạm dừng để bảo trì."
            elif not team.provider_available(store):
                reason = "Provider đang bị chặn/hết hạn mức; chưa bắt đầu."
            elif store.get("internal_budget_enabled", True) and (calls >= team.CALLS or used + team.LIMIT > team.DAILY_LIMIT):
                reason = "Đang chạm trần 12 lượt/24 giờ của bộ điều phối; chưa bắt đầu."
        remote = re.fullmatch(r"telegram:([1-9]\d*)", row["dedupe"])
        tasks.append({"id": row["id"], "telegram_id": ev.get("telegram_id") or (int(remote[1]) if remote else None),
                      "title": store.get(f"owner_title:{row['id']}", row["title"]), "status": status,
                      "owner": row["role"], "has_report": bool(ev.get("path") or action.get('report')),
                      "action": {key: action[key] for key in ('phase', 'pr', 'head', 'followup_at') if key in action},
                      "decision": note.get("decision"), "note_updated_at": note.get("updated_at"),
                      "can_verify": row["dedupe"].startswith("finding:") and row["dedupe"].split(":", 2)[1] in team.CHECK_ROLES,
                      "verification": {key: value for key, value in note.get("verification", {}).items()
                                       if key in {"phase", "acceptance", "checked_at", "automatic", "cadence"}}, "reason": str(reason)[:1400],
                      "next_step": note.get("next_step", ""), "updated_at": iso(row["updated"]),
                      "attempts": row["attempts"], "priority": bool(store.get(f"priority:{row['id']}", False)),
                      "related_task_id": note.get("related_task_id")})
    tasks.sort(key=lambda task: (not task["priority"], task["telegram_id"] is None, task["id"]))
    from team_content import render_calendar
    return team.scrub({"schema": "team-v2.snapshot.v1", "updated_at": iso(now), "content_calendar": render_calendar(store),
                       "heartbeat_at": iso(store.get("heartbeat", 0)),
                       "controller": {"paused": store.get("paused", False) or (team.REPO / ".claude/AGENTS_PAUSED").exists(),
                                      "provider": store.get("provider", "claude"),
                                      "execution_mode": "owner_requested"}, "tasks": tasks})


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


def reply_keyboard(body, store=None):
    """Use actual ledger capabilities; no approval inferred from model prose."""
    ids = list(dict.fromkeys(re.findall(r"\bT([1-9]\d*)\b", body)))[:5]
    rows = []
    for tid in ids:
        task = target(store, f'T{tid}') if store else None
        row = [{"text": f"Xem T{tid}", "callback_data": f"progress|T{tid}"}]
        if not store or (task and (json.loads(task['evidence']).get('path') or store.get(f'action:{tid}', {}).get('report'))):
            row.append({"text": f"Báo cáo T{tid}", "callback_data": f"report|T{tid}"})
        rows.append(row)
        if task and task['status'] not in {'resolved', 'cancelled'}:
            from team_actions import state
            action_state = state(store, int(tid))
            if action_state.get('phase') == 'awaiting_deploy':
                rows.append([{'text': f'Duyệt triển khai T{tid}',
                              'callback_data': f'deploy|T{tid}|{action_state["head"][:12]}'}])
                rows.append([{'text': 'Xem thay đổi đã kiểm tra', 'url': action_state['pr']}])
            elif action_state.get('phase') not in {'queued', 'running', 'awaiting_ci', 'deploying'}:
                rows.append([{'text': f'Xử lý ngay T{tid}', 'callback_data': f'execute|T{tid}'}])
        if task and task['dedupe'].startswith('finding:'):
            note = store.get(f'progress:{tid}', {})
            action = (note.get('decision') or {}).get('action')
            if action == 'reports':
                rows.append([{'text':'Mở báo cáo để quyết định', 'url':'https://www.thepicklehub.net/admin/reports'}])
            if action == 'instagram_token':
                rows += [[{'text':'1. Lấy token Meta', 'url':'https://developers.facebook.com/tools/explorer/'}],
                         [{'text':'2. Lưu token vào Supabase', 'url':'https://supabase.com/dashboard/project/ajvlcamxemgbxduhiqrl/functions/secrets'}],
                         [{'text':'Cần hỗ trợ lấy token', 'callback_data':f'tokenhelp|T{tid}'}]]
            if task['status'] != 'resolved' and note.get('decision'):
                rows.append([{'text':f'Đã sửa → kiểm tra lại T{tid}', 'callback_data':f'ownerdone|T{tid}'}])
            rows.append([{'text':f'Kiểm tra mới T{tid}', 'callback_data':f'verify|T{tid}'}])
    rows.append([{"text": "Tiến độ toàn đội", "callback_data": "progress|page:1"},
                 {"text": "Lịch nội dung", "callback_data": "calendar"}])
    return {"inline_keyboard": rows}
