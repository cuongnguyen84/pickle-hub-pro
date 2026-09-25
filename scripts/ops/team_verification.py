"""Close the observation → owner action → verification → notification loop.

Only reads business data. A click requests verification, never proves success.
The collector's next successful measurement is the acceptance evidence.
"""
import hashlib
import json
import time
from datetime import datetime, timezone, timedelta

FAST_INTERVAL = 300
IG_FRESHNESS = 90 * 60
# last_checked_at do Postgres ghi, so với đồng hồ máy này: lệch vài giây là
# bình thường và KHÔNG phải cũ. Chặt tay (`0 <= now - checked`) còn lật vì
# chính phép làm tròn micro giây của iso()/epoch(): đo 200k lượt thì 13% cho
# checked > now khoảng 2,4e-7 giây, đủ để một nguồn vừa sync bị gọi là stale.
CLOCK_SKEW = 60
ICT = timezone(timedelta(hours=7))


def iso(value):
    return datetime.fromtimestamp(value, timezone.utc).isoformat()


def epoch(value):
    try:
        return datetime.fromisoformat(value.replace('Z', '+00:00')).timestamp()
    except (ValueError, TypeError, AttributeError):
        return 0


def instagram_observation(rows, now=None):
    now = time.time() if now is None else now
    if not isinstance(rows, list) or len(rows) >= 1000:
        raise ValueError('instagram_sources_incomplete')
    sources = []
    for row in rows:
        if not isinstance(row.get('username'), str) or row.get('active') is not True:
            raise ValueError('instagram_source_invalid')
        error = str(row.get('last_error') or '').lower()
        kind = ('token_expired' if 'expired' in error or 'error validating access token' in error
                else 'permissions' if 'permission' in error else 'source_error' if error else None)
        checked = epoch(row.get('last_checked_at'))
        sources.append({'username': row['username'], 'checked_at': checked, 'error_kind': kind,
                        'fresh': -CLOCK_SKEW <= now - checked <= IG_FRESHNESS})
    healthy = bool(sources) and all(s['fresh'] and not s['error_kind'] for s in sources)
    return {'available': True, 'healthy': healthy, 'sources': sources,
            'total': len(sources), 'failed': sum(bool(s['error_kind']) for s in sources),
            'expired': sum(s['error_kind'] == 'token_expired' for s in sources),
            'stale': sum(not s['fresh'] for s in sources)}


def next_instagram_run(now):
    value = datetime.fromtimestamp(now, ICT).replace(minute=20, second=0, microsecond=0)
    if value.timestamp() <= now:
        value += timedelta(hours=1)
    return value.timestamp()


def instagram_guidance(task_id, source_count):
    return {
        'summary': 'Thay token Instagram dùng chung đã hết hạn; không cần nối lại từng nguồn.',
        'instructions': (
            '1. Bấm “Lấy token Meta”: chọn ứng dụng Facebook đang dùng cho Instagram, tạo User Access Token mới với quyền đọc tài khoản IG Business/Creator hiện tại.\n'
            '2. Bấm “Lưu token vào Supabase”: tìm IG_ACCESS_TOKEN, thay giá trị mới rồi Save. Giữ IG_USER_ID nếu không đổi tài khoản IG. Không gửi token vào chat.\n'
            f'3. Bấm “Đã sửa → kiểm tra lại T{task_id}”. Agent chờ lượt đồng bộ mới lúc phút :20 mỗi giờ, kiểm tra cả {source_count} nguồn hiện tại rồi báo kết quả.\n'
            'Nếu chưa xác định được ứng dụng Meta cũ, bấm “Cần hỗ trợ lấy token”; không tạo ứng dụng mới để thử.'),
        'action': 'instagram_token',
    }


def policy(task, note, entry, previous, now):
    check, key = task['dedupe'].split(':', 2)[1:]
    data = entry['data']
    resolved = task['status'] == 'resolved'
    result = {'phase': 'resolved' if resolved else 'needs_agent',
              'acceptance': 'Bộ đo thành công và không còn phát hiện điều kiện lỗi tương ứng.',
              'reason': (f'Đã đo lại {check}: không còn điều kiện lỗi của việc này.' if resolved
                         else (task['title'] if previous.get('phase') == 'resolved' else note.get('reason') or task['title'])),
              'next_step': ('Anh không cần thao tác thêm. Agent tiếp tục theo dõi; lỗi tái diễn sẽ mở lại cùng mã việc và báo anh.'
                            if resolved else (note.get('next_step') if previous.get('phase') != 'resolved' else None) or 'Đội cần xử lý nguyên nhân rồi kiểm tra lại bằng bộ đo.'),
              'decision': None if resolved else note.get('decision'),
              'signature': key}
    if check == 'community' and key == 'reports':
        reports = data.get('reports', [])
        result.update(acceptance='Không còn báo cáo ở trạng thái chưa xử lý; chỉ resolved/dismissed được coi là kết thúc.',
                      signature=','.join(sorted(r['id'] for r in reports)))
        if resolved:
            result['reason'] = 'Đã đọc lại content_reports: không còn báo cáo cần xử lý. Quyết định của anh trong admin/reports đã được ghi nhận; T%d đã đóng.' % task['id']
        else:
            result.update(phase='owner_action', reason=f'Còn {len(reports)} báo cáo chưa kết thúc. “Đang xem xét” chưa phải đã xử lý xong.',
                          next_step='Anh quyết định trong admin/reports; agent tự kiểm tra mỗi 5 phút khi máy hoạt động, rồi báo đã đóng hoặc còn thiếu.',
                          decision={'summary':'Quyết định xử lý báo cáo nội dung còn mở.',
                                    'instructions':'Mở báo cáo, ghi quyết định/lý do và lưu trạng thái đã xử lý hoặc bỏ qua nếu phù hợp. Nếu đang xem xét, việc vẫn mở. Sau lưu bấm “Đã sửa → kiểm tra lại” hoặc chờ agent kiểm tra mỗi 5 phút.',
                                    'action':'reports'})
    if check == 'jobs' and key == 'feed-embeds-sync':
        ig = data.get('instagram', {})
        sources = ig.get('sources', [])
        requested = previous.get('requested_at', 0)
        fresh_after_request = bool(sources) and all(s['checked_at'] >= requested for s in sources)
        result['acceptance'] = 'Mỗi nguồn Instagram đang bật có lượt đồng bộ mới, không lỗi và cách hiện tại không quá 90 phút. Không yêu cầu có reel mới.'
        result['signature'] = ','.join(sorted(s['username'] + ':' + (s['error_kind'] or 'ok') + ':' + str(s['fresh']) for s in sources))
        if not ig.get('available'):
            result.update(phase='unverified', reason='Chưa đọc được kết quả đồng bộ Instagram; không thể kết luận token đã sửa.',
                          next_step='Agent tự đọc lại sau 5 phút; giữ việc mở và chưa yêu cầu anh thay token lần nữa.', decision=None)
        elif requested and not fresh_after_request and now - requested < IG_FRESHNESS:
            due = previous.get('expected_run_at', next_instagram_run(requested))
            result.update(phase='waiting_check', reason='Đã nhận anh báo sửa xong. Chưa có kết quả đồng bộ mới cho tất cả nguồn sau thao tác này; chưa đóng việc.',
                          next_step=f'Đồng bộ theo lịch lúc {datetime.fromtimestamp(due, ICT).strftime("%H:%M %d/%m")} (giờ VN). Agent đọc kết quả mỗi 5 phút và báo lại; anh không cần bấm thêm.', decision=None)
        elif ig.get('healthy'):
            result.update(phase='resolved', reason=f'Đã kiểm tra {ig["total"]}/{ig["total"]} nguồn đang bật: lượt đồng bộ còn mới, không còn lỗi. Token và truy cập nguồn đã hoạt động.',
                          next_step='Anh không cần thao tác thêm. Agent tiếp tục theo dõi; nếu lỗi trở lại sẽ mở lại cùng mã và báo anh.', decision=None)
        elif requested and not fresh_after_request or ig.get('stale') or not sources:
            result.update(phase='needs_agent', reason='Chưa có lượt đồng bộ đủ mới cho tất cả nguồn, hoặc không còn nguồn bật. Chưa đủ bằng chứng khắc phục.',
                          next_step='Đội vận hành phải kiểm tra cron và nguồn đang bật; không yêu cầu anh thay token khi chưa có kết quả mới.', decision=None)
        elif ig.get('expired'):
            result.update(phase='owner_action', reason=f'{ig["expired"]}/{ig["total"]} nguồn đang bật báo token hết hạn trong lượt đồng bộ gần nhất. Đây là token chung, không phải 8 tài khoản cần đăng nhập lại.',
                          next_step='Thay IG_ACCESS_TOKEN tại Supabase, sau đó bấm “Đã sửa → kiểm tra lại”. Agent sẽ tự kiểm chứng lượt đồng bộ tiếp theo và phản hồi.',
                          decision=instagram_guidance(task['id'], ig['total']))
        else:
            result.update(phase='needs_agent', reason=f'Lượt đồng bộ còn lỗi ở {ig.get("failed", 0)}/{ig.get("total", 0)} nguồn; chưa đủ bằng chứng lỗi do token hết hạn.',
                          next_step='Đội vận hành kiểm tra quyền hoặc nguồn bị lỗi; không yêu cầu anh cấp lại token một cách mù quáng.', decision=None)
    return result


def render_result(task, note):
    verification = note.get('verification', {})
    labels = {'resolved':'✅ ĐÃ KIỂM CHỨNG VÀ ĐÓNG', 'owner_action':'🟡 CẦN ANH THAO TÁC',
              'waiting_check':'⏳ ĐANG CHỜ KIỂM CHỨNG', 'needs_agent':'🛠 ĐỘI CẦN XỬ LÝ TIẾP',
              'unverified':'⚠️ CHƯA KIỂM TRA ĐƯỢC'}
    lines = [f"{labels.get(verification.get('phase'), 'TIẾN ĐỘ')} · T{task['id']}",
             note.get('reason', ''), 'Tiếp theo: ' + note.get('next_step', '')]
    if note.get('decision'):
        lines.append(note['decision']['instructions'])
    lines += ['Điều kiện đóng: ' + verification.get('acceptance', 'Chưa có kiểm chứng.'),
              f"Xem: /tien_do T{task['id']}"]
    return '\n'.join(lines)[:3600]


def reconcile(store, check, entry, transitions=(), notify=True, silent_task_id=None):
    """Recoverable across crashes: transition state + outbox insert share a transaction."""
    now = entry['measured_at']
    prefix = f'finding:{check}:'
    transitioned = {t['id']: t for t in transitions}
    tasks = store.db.execute('SELECT * FROM tasks WHERE substr(dedupe,1,?)=? AND status!=?',
                             (len(prefix), prefix, 'cancelled')).fetchall()
    if not entry['ok']:
        # A failed read says nothing about the findings; the collector task itself tracks the outage.
        # Flipping every finding to 'unverified' and back spammed "chưa kiểm tra được" after each close.
        return
    for task in tasks:
        key = f'progress:{task["id"]}'
        note = store.get(key, {})
        had_decision = bool(note.get('decision'))
        previous = note.get('verification', {})
        if entry['ok']:
            current = policy(task, note, entry, previous, now)
        else:
            current = {'phase':'unverified', 'acceptance':previous.get('acceptance', 'Chỉ đóng khi bộ đo kiểm chứng thành công.'),
                       'signature':'collector_failed', 'reason':f'Không đọc được dữ liệu kiểm chứng {check}; trạng thái đóng/mở trước đó chưa được xác nhận lại.',
                       'next_step':'Agent tự thử đọc lại ở lượt kiểm tra kế tiếp; không cần anh giao lại việc.', 'decision':None}
        identity = hashlib.sha256(json.dumps([current['phase'], current['signature']], sort_keys=True).encode()).hexdigest()[:16]
        changed = identity != previous.get('identity')
        revision = previous.get('revision', 0) + int(changed)
        state = {**previous, 'phase':current['phase'], 'acceptance':current['acceptance'],
                 'checked_at':iso(now), 'identity':identity, 'revision':revision,
                 'automatic':True, 'cadence':'Mỗi 5 phút khi máy hoạt động' if check in {'community','jobs','site','commerce','sports','translation','recovery','runtime_errors'} else 'Theo lịch bộ đo; có thể bấm kiểm tra lại'}
        if entry['ok'] and current['phase'] not in {'waiting_check','unverified'}:
            state.pop('requested_at', None)
            state.pop('expected_run_at', None)
        note.update(reason=current['reason'], next_step=current['next_step'], decision=current['decision'],
                    verification=state, updated_at=iso(now))
        # Store and outbox in one explicit transaction (Store.put/enqueue each commit).
        with store.db:
            store.db.execute('INSERT INTO meta VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
                             (key, json.dumps(note, ensure_ascii=False)))
            transition = transitioned.get(task['id']) or store.get(f'finding_transition:{task["id"]}')
            first_resolution = current['phase'] == 'resolved' and (transition or (not previous and had_decision))
            should_notify = changed and (bool(previous) or bool(first_resolution) or bool(transition))
            if notify and should_notify and task['id'] != silent_task_id:
                body = render_result(task, note)
                if previous.get('phase') == 'resolved' and current['phase'] not in {'resolved','unverified'}:
                    body = '🔁 LỖI TÁI DIỄN — MỞ LẠI CÙNG MÃ\n' + body
                store.db.execute('INSERT OR IGNORE INTO outbox(dedupe,body,created,updated) VALUES (?,?,?,?)',
                                 (f'verification:{task["id"]}:{revision}:{identity}', body[:3700], now, now))
            if entry['ok']:
                store.db.execute('DELETE FROM meta WHERE key=?', (f'finding_transition:{task["id"]}',))


def prepare_observation(store, check, data):
    """A successful pre-action run cannot satisfy an owner-requested recheck."""
    if not isinstance(data.get('problems'), dict):
        raise ValueError('invalid_collector_result')
    if check == 'jobs':
        row = store.db.execute("SELECT id FROM tasks WHERE dedupe='finding:jobs:feed-embeds-sync'").fetchone()
        state = store.get(f'progress:{row["id"]}', {}).get('verification', {}) if row else {}
        requested = state.get('requested_at', 0)
        ig = data.get('instagram', {})
        if requested and ig.get('healthy') and any(s['checked_at'] < requested for s in ig.get('sources', [])):
            data['problems']['feed-embeds-sync'] = 'Chờ lượt đồng bộ Instagram sau thao tác vừa báo'
    return data


def verify_task(store, value, owner_done=False, action_id=None):
    import team_supervisor as team
    from team_progress import target
    task = target(store, value)
    if not task or not task['dedupe'].startswith('finding:'):
        return 'Việc này chưa có bộ kiểm chứng tự động. Đội phải bổ sung điều kiện nghiệm thu và bằng chứng; không đánh dấu xong qua nút bấm.'
    check = task['dedupe'].split(':', 2)[1]
    if check not in team.CHECK_ROLES:
        return 'Chưa có bộ đo cho việc này; đội cần thiết lập kiểm chứng.'
    if owner_done and task['status'] != 'resolved':
        note = store.get(f'progress:{task["id"]}', {})
        state = note.get('verification', {})
        # Repeated clicks must not keep pushing the evidence cutoff into the future.
        if not state.get('requested_at') and (action_id is None or state.get('owner_action_id') != action_id):
            requested = time.time()
            state.update(requested_at=requested, expected_run_at=next_instagram_run(requested), owner_action_id=action_id)
        note['verification'] = state
        store.put(f'progress:{task["id"]}', note)
    try:
        data = team.scrub(team.collect(check))
        data = prepare_observation(store, check, data)
        entry = {'ok':True, 'measured_at':time.time(), 'data':data}
        changes = store.findings(check, team.CHECK_ROLES[check], data['problems'], entry)
    except Exception as exc:
        entry = {'ok':False, 'measured_at':time.time(), 'error':team.clean_error(exc)}
        changes = []
    store.put('check:' + check, entry)
    reconcile(store, check, entry, changes, silent_task_id=task['id'])
    latest = store.db.execute('SELECT * FROM tasks WHERE id=?', (task['id'],)).fetchone()
    return render_result(latest, store.get(f'progress:{task["id"]}', {}))
