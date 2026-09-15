"""Scheduled, reviewed content refreshes. No model output is executable.

Only the six exact existing articles in the installed manifest are writable.
Prepared payloads are hash-bound; CAS, private backups and public verification
make publishing recoverable and observable. Original publication dates stay put.
"""
import hashlib
import json
import re
import time
import urllib.request
from datetime import datetime, timedelta
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import quote

SITE = 'https://www.thepicklehub.net'
PLAN = Path(__file__).with_name('team_content_plan.json')


def plan():
    return json.loads(PLAN.read_text())['items']


def digest_value(item):
    return hashlib.sha256(json.dumps(item, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def marker(item):
    return f"<!-- content:{item['key']} -->"


class SectionCheck(HTMLParser):
    def handle_starttag(self, tag, attrs):
        if tag not in {'h2', 'h3', 'p', 'ul', 'ol', 'li', 'strong', 'a'}:
            raise ValueError('content_tag_not_allowed')
        for name, value in attrs:
            if tag != 'a' or name != 'href' or not value or not (
                value.startswith('/') and not value.startswith('//') or
                value.startswith('https://www.ppatour-asia.com/') or value.startswith(SITE + '/')):
                raise ValueError('content_attribute_not_allowed')


def prepare(item, row):
    if (row.get('id'), row.get('slug'), row.get('status')) != (item['id'], item['slug'], 'published'):
        raise ValueError('content_target_mismatch')
    if marker(item) in row['content_html']:
        return None
    SectionCheck().feed(item['section'])
    if len(re.sub('<[^>]+>', '', item['section']).split()) < 100:
        raise ValueError('content_too_thin')
    if re.search(r'\[\[|TODO|CHỜ NGUỒN', item['section']):
        raise ValueError('content_unfinished')
    patch = {'content_html': marker(item) + '\n' + item['section'] + '\n' + row['content_html']}
    if item.get('excerpt'):
        patch.update(excerpt=item['excerpt'], meta_description=item['excerpt'])
    if item.get('champions_faq'):
        patch['faq_items'] = [dict(f) for f in row.get('faq_items') or []]
        for f in patch['faq_items']:
            if f.get('question', '').startswith('Ai vô địch'):
                f['answer'] = item['champions_faq']
    return patch


def public_page(slug):
    url = SITE + '/vi/blog/' + slug
    req = urllib.request.Request(url + '?nocache=1', headers={'User-Agent': 'Googlebot'})
    with urllib.request.urlopen(req, timeout=30) as response:
        if response.status != 200 or response.url.split('?')[0] != url:
            raise RuntimeError('content_public_url_failed')
        html = response.read(2_000_000).decode('utf-8')
    if not re.search(r'<link[^>]+rel=[\"\']canonical[\"\'][^>]+href=[\"\']' + re.escape(url), html):
        raise RuntimeError('content_canonical_failed')
    if re.search(r'<meta[^>]+(?:name=[\"\']robots|content=[\"\'][^\"\']*noindex)', html, re.I) and 'noindex' in html:
        raise RuntimeError('content_noindex')
    if len(re.sub('<[^>]+>', ' ', html).split()) < 300 or '<h1' not in html:
        raise RuntimeError('content_body_failed')
    return html


def stage(store):
    """Called after editorial review, not by the model or scheduled worker."""
    import team_supervisor as team
    for item in plan():
        key = 'content:' + item['key']
        if store.get(key):
            continue
        rows = team.rest(f"vi_blog_posts?id=eq.{item['id']}&select=*")
        if len(rows) != 1:
            raise RuntimeError('content_missing_target')
        patch = prepare(item, rows[0])
        if patch is None:
            raise RuntimeError('content_already_present_without_state')
        public_page(item['slug'])
        backup = store.artifact(item['key'] + '-before.json', json.dumps(rows[0], ensure_ascii=False))
        artifact = store.artifact(item['key'] + '-payload.json', json.dumps(patch, ensure_ascii=False))
        store.put(key, {'status': 'scheduled', 'hash': digest_value(item),
                       'base_updated_at': rows[0]['updated_at'], 'backup': backup, 'payload': artifact})


def calendar(store):
    labels = {'scheduled': 'đã xếp lịch tự cập nhật', 'publishing': 'đang cập nhật/đối chiếu',
              'published': 'đã đăng, đã kiểm tra', 'blocked': 'bị chặn, đội cần xử lý'}
    return [{'date': item['at'][:10], 'title': item['title'], 'url': SITE + '/vi/blog/' + item['slug'],
             'status': labels.get(store.get('content:' + item['key'], {}).get('status'), 'chưa chuẩn bị xong')}
            for item in plan()]


def render_calendar(store):
    import team_supervisor as team
    now = datetime.now(team.ICT)
    monday = (now - timedelta(days=now.weekday())).date()
    items = [i for i in calendar(store) if monday <= datetime.fromisoformat(i['date']).date() < monday + timedelta(days=7)]
    lines = ['LỊCH CONTENT · ' + monday.strftime('%d/%m'),
             'Tự cập nhật bài hiện có lúc 08:00 giờ Việt Nam, không cần anh duyệt.',
             'Đang tạm dừng tự đăng.' if not store.get('content_autopublish', False) or store.get('paused', False) else 'Tự đăng đang bật.']
    lines += [f"{i['date'][8:10]}/{i['date'][5:7]} · {i['title']} — {i['status']}" for i in items]
    if not items:
        lines.append('Tuần này chưa có bài đã xếp lịch; đội cần bổ sung, không tự coi là đã có kế hoạch.')
    lines += ['Đây là cập nhật có nội dung mới trên URL cũ, không phải 6 bài mới.',
              'Sau đăng bot gửi link. Nếu lỗi/thiếu nguồn bot báo chặn, không coi là đã xong.',
              '/lich_content · /xuly team content pause · /xuly team content resume']
    return '\n'.join(lines)


def publish_due(store, now=None):
    import team_supervisor as team
    now = now or datetime.now(team.ICT)
    if not store.get('content_autopublish', False) or store.get('paused', False) or (team.REPO / '.claude/AGENTS_PAUSED').exists():
        return
    for item in plan():
        key = 'content:' + item['key']
        state = store.get(key, {})
        if state.get('status') not in {'scheduled', 'publishing'} or datetime.fromisoformat(item['at']) > now:
            continue
        # One article/day, including interrupted writes. Reconcile the same one.
        today = now.date().isoformat()
        last = store.get('content:last_write', {})
        if last.get('date') == today and last.get('key') != item['key']:
            return
        try:
            if state.get('hash') != digest_value(item):
                raise RuntimeError('content_manifest_changed_since_review')
            rows = team.rest(f"vi_blog_posts?id=eq.{item['id']}&select=*")
            if len(rows) != 1:
                raise RuntimeError('content_target_missing')
            row = rows[0]
            patch = prepare(item, row)
            if patch is not None:
                if row['updated_at'] != state['base_updated_at']:
                    raise RuntimeError('content_concurrent_edit')
                raw = json.dumps(patch, ensure_ascii=False)
                if hashlib.sha256(raw.encode()).hexdigest() != state['payload']['sha256']:
                    raise RuntimeError('content_payload_changed')
                public_page(item['slug'])
                # Durable in-flight state BEFORE write, including daily quota.
                store.put(key, {**state, 'status': 'publishing'})
                store.put('content:last_write', {'date': today, 'key': item['key']})
                token = team.secret('SUPABASE_SERVICE_ROLE_KEY')
                path = f"vi_blog_posts?id=eq.{item['id']}&slug=eq.{item['slug']}&status=eq.published&updated_at=eq.{quote(row['updated_at'], safe='')}"
                request = urllib.request.Request(team.BASE + path, method='PATCH', data=raw.encode(), headers={
                    'apikey': token, 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'Prefer': 'return=representation'})
                with urllib.request.urlopen(request, timeout=30) as response:
                    changed = json.loads(response.read())
                if len(changed) != 1 or changed[0]['content_html'] != patch['content_html']:
                    raise RuntimeError('content_write_not_confirmed')
            html = public_page(item['slug'])
            heading = re.search(r'<h2>(.*?)</h2>', item['section'])[1]
            if heading not in html:
                raise RuntimeError('content_public_update_not_visible')
            store.put(key, {**state, 'status': 'published', 'verified_at': time.time()})
            store.artifact(item['key'] + '-verification.json', json.dumps({'url': SITE + '/vi/blog/' + item['slug'],
                           'verified_at': time.time(), 'heading': heading, 'html_sha256': hashlib.sha256(html.encode()).hexdigest()}))
            store.enqueue('content-published:' + item['key'], f"ĐÃ CẬP NHẬT: {item['title']}\n{SITE}/vi/blog/{item['slug']}\nĐã kiểm tra trang công khai. Không cần anh duyệt; giữ URL và ngày đăng ban đầu.")
        except Exception as exc:
            # Never blindly repeat a timed-out PATCH; a human/agent diagnoses it.
            reason = str(exc) if isinstance(exc, RuntimeError) and str(exc).startswith('content_') else team.clean_error(exc)
            store.put(key, {**state, 'status': 'blocked', 'reason': reason})
            store.enqueue('content-blocked:' + item['key'], f"CONTENT CHƯA XÁC NHẬN XONG: {item['title']}\nLý do: {reason}. Đội cần xử lý, không chờ anh duyệt. Không tự ghi đè/chạy lại khi kết quả chưa rõ.")
        return
