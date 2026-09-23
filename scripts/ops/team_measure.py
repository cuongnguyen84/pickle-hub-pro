"""Fixed read-only milestone executors; no model can invent analytics results."""
import importlib.util
import json
import os
import time
from datetime import datetime, timedelta
from urllib.parse import quote


def adapter(name):
    import team_supervisor as team
    os.environ.setdefault('GOOGLE_SA_JSON', str(team.REPO / '.claude/secrets.local.gsc-ga4-sa.json'))
    os.environ.setdefault('GA4_PROPERTY_ID', '522556358')
    spec = importlib.util.spec_from_file_location(name, team.REPO / 'scripts/seo' / (name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def cluster():
    import team_supervisor as team
    gsc = adapter('gsc_report')
    import requests
    end = datetime.now(team.ICT).date() - timedelta(days=3)
    start = end - timedelta(days=89)
    token = gsc.token()
    results = []
    for query in ('pickleball bracket generator', 'pickleball round robin generator'):
        response = requests.post(
            f'https://searchconsole.googleapis.com/webmasters/v3/sites/{quote(gsc.SITE, safe="")}/searchAnalytics/query',
            headers={'Authorization': f'Bearer {token}'}, json={
                'startDate': str(start), 'endDate': str(end), 'dimensions': ['page'],
                'dataState': 'final', 'rowLimit': 25000,
                'dimensionFilterGroups': [{'filters': [{'dimension': 'query', 'operator': 'equals', 'expression': query}]}]},
            timeout=30)
        response.raise_for_status()
        raw = response.json().get('rows', [])
        if len(raw) >= 25000:
            raise RuntimeError('gsc_response_truncated')
        rows = [{'page': row['keys'][0], 'clicks': row['clicks'], 'impressions': row['impressions'],
                 'position': row['position']} for row in raw]
        tools = [r for r in rows if r['page'].rstrip('/') == 'https://www.thepicklehub.net/tools']
        won = 1 <= len(rows) <= 2 and bool(tools) and tools[0]['position'] <= 5
        results.append({'query': query, 'rows': rows, 'won': won})
    return {'window': [str(start), str(end)], 'queries': results,
            'verdict': 'THẮNG' if all(r['won'] for r in results) else 'CHƯA ĐỦ',
            'next_read': str(end + timedelta(days=31)),
            'limitation': 'Không có impression không chứng minh trang chưa index. Chưa thay canonical/redirect.'}


def vitals():
    ga4 = adapter('ga4_report')
    data = ga4.run_report(ga4.token(), {
        'dateRanges': [{'startDate': '28daysAgo', 'endDate': 'yesterday'}],
        'dimensions': [{'name': 'customEvent:metric_name'}, {'name': 'customEvent:metric_rating'}],
        'metrics': [{'name': 'eventCount'}],
        'dimensionFilter': {'andGroup': {'expressions': [
            {'filter': {'fieldName': name, 'stringFilter': {'matchType': 'EXACT', 'value': value}}}
            for name, value in [('country', 'Vietnam'), ('deviceCategory', 'mobile'), ('eventName', 'web_vital')]]}},
        'limit': 1000})
    counts = {name: {'good': 0, 'total': 0} for name in ('LCP', 'INP', 'CLS')}
    for row in data.get('rows', []):
        name, rating = [d['value'] for d in row['dimensionValues']]
        if name.upper() in counts:
            n = int(row['metricValues'][0]['value'])
            counts[name.upper()]['total'] += n
            if rating.lower() == 'good':
                counts[name.upper()]['good'] += n
    return {'segment': 'Vietnam/mobile', 'window': '28 ngày đến hôm qua', 'metrics': counts,
            'limitation': 'Tỷ lệ good chỉ mô tả mẫu event hiện có, không thay thế p75 CrUX. Thiếu mẫu thì chưa kết luận.'}


def execute(store, task):
    import team_supervisor as team
    from team_actions import save
    tid = task['id']
    key = task['dedupe'].split('milestone:', 1)[-1]
    if key == 'WPR-REFRESH':
        reason = ('Cập nhật WPR cần đối chiếu thủ công top-25 nam/nữ và VĐV Việt Nam với nguồn PPA; '
                  'quy tắc hiện có cấm pipeline tự động khi chưa có thư cho phép. '
                  'Nút xử lý không thể biến một bản đề xuất thành dữ liệu đã xác minh.')
        save(store, tid, phase='blocked', reason=reason,
             next_step='Đội cần hoàn tất đối chiếu nguồn PPA và chuẩn bị patch bảng xếp hạng; sau kiểm thử mới có nút duyệt triển khai.')
        return f'⚠️ T{tid}: chưa cập nhật bảng xếp hạng.\n{reason}\nNguồn: https://ppatour.com/rankings/\nQuy định: docs/milestones.md, WPR-REFRESH.'
    if key == 'SEO-CLUSTER-READ':
        data = cluster()
        lines = [f"GSC {data['window'][0]} → {data['window'][1]} · {data['verdict']}"]
        for result in data['queries']:
            tools = next((r for r in result['rows'] if r['page'].rstrip('/') == 'https://www.thepicklehub.net/tools'), None)
            lines.append(f"• {result['query']}: {len(result['rows'])} URL; /tools pos {round(tools['position'], 1) if tools else 'chưa có impression'}.")
        next_step = f"Đọc lại {data['next_read']}; không thay code khi chưa đủ bằng chứng."
        # Read-and-schedule is the documented CHƯA ĐỦ outcome. This timer is
        # visible and automatically queues a fresh measurement at the due date.
        due = datetime.fromisoformat(data['next_read']).replace(tzinfo=team.ICT).timestamp()
        phase = 'waiting_followup' if data['verdict'] == 'CHƯA ĐỦ' else 'measured'
    elif key == 'PERF-05B':
        data = vitals()
        lines = ['Đã đọc GA4 Việt Nam/mobile, 28 ngày đến hôm qua.']
        for name, metric in data['metrics'].items():
            total = metric['total']
            lines.append(f"• {name}: n={total}; good {round(100 * metric['good'] / total, 1) if total else 'chưa đủ mẫu'}%.")
        next_step = 'Đội đối chiếu cỡ mẫu và CrUX trước khi kết luận; đọc lại sau 7 ngày.'
        due, phase = time.time() + 7 * 86400, 'waiting_followup'
    elif key.startswith('SEO-SAN-W'):
        env = dict(os.environ, GOOGLE_SA_JSON=str(team.REPO / '.claude/secrets.local.gsc-ga4-sa.json'))
        rc, out, _ = team.command(['python3', 'scripts/seo/gsc_report.py', '--page-contains', '/san/'], env=env)
        if rc:
            raise RuntimeError('gsc_san_measurement_failed')
        data = json.loads(out)
        window = data.get('window', {})
        change = data.get('wow', {}).get('clicks_pct')
        lines = [f"GSC cụm /san/ · {window.get('start', 'chưa rõ')} → {window.get('end', 'chưa rõ')}",
                 f"• Lượt nhấp: {data.get('clicks', 'chưa có dữ liệu')}; lượt hiển thị: {data.get('impressions', 'chưa có dữ liệu')}.",
                 f"• Vị trí trung bình: {data.get('position', 'chưa có dữ liệu')}.",
                 f"• Lượt nhấp so với tuần trước: {str(change) + '%' if change is not None else 'chưa có dữ liệu'}."
                 ]
        next_step = 'Đội cập nhật tracker tuần và đối chiếu nguyên nhân biến động; đọc lại sau 7 ngày.'
        due, phase = time.time() + 7 * 86400, 'waiting_followup'
    else:
        raise RuntimeError('milestone_executor_not_registered')
    artifact = store.artifact(f'T{tid}-measurement-{int(time.time())}.json', json.dumps(data, ensure_ascii=False, indent=2))
    reason = '\n'.join(lines)
    save(store, tid, phase=phase, report=artifact, reason=reason, next_step=next_step,
         followup_at=due, measured_at=time.time())
    return f'📊 ĐÃ ĐO · T{tid}\n{reason}\n{next_step}\nBáo cáo đầy đủ: /xuly team report T{tid}\nChưa có thay đổi production.'
