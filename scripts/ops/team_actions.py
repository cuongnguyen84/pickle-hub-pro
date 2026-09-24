"""Owner-requested work on stable task IDs, with durable phases and receipts.

Execution requests never become anonymous engineering prompts. Findings retain
their collector-owned status. A deployment approval is bound to a reviewed PR
head, and completion requires a separate verification step.
"""
import hashlib
import json
import re
import time
from pathlib import Path

ACTIVE = {'queued', 'running', 'awaiting_ci', 'deploying'}


def references(text):
    if not re.fullmatch(r'(?:T|XL)-?[1-9]\d*(?:\s*[,;\s]\s*(?:T|XL)-?[1-9]\d*)*', text.strip(), re.I):
        return None
    codes = list(dict.fromkeys(re.sub('-', '', code.upper()) for code in
                             re.findall(r'(?:T|XL)-?[1-9]\d*', text, re.I)))
    return codes if len(codes) <= 20 else None


def state(store, tid):
    return store.get(f'action:{tid}', {})


def save(store, tid, **values):
    current = {**state(store, tid), **values, 'updated_at': time.time()}
    store.put(f'action:{tid}', current)
    return current


def request(store, codes, control_id):
    from team_progress import target
    lines = []
    # Validate the entire batch before queueing any item.
    tasks = [target(store, code) for code in codes]
    if any(task is None for task in tasks):
        return 'Không nhận batch: có mã việc không tồn tại. Xem /tien_do; chưa tạo hay chạy việc mới.'
    for task in {task['id']: task for task in tasks}.values():
        tid = task['id']
        old = state(store, tid)
        if re.match(r'^team(?:\s|$)', json.loads(task['evidence']).get('request', ''), re.I):
            lines.append(f'T{tid}: đây là lệnh điều phối, không phải việc cần xử lý.')
        elif task['status'] in {'resolved', 'cancelled'}:
            lines.append(f'T{tid}: đã đóng; không chạy lại.')
        elif old.get('phase') in ACTIVE or task['status'] == 'running':
            lines.append(f'T{tid}: đã nằm trong lượt xử lý; không tạo bản sao.')
        elif old.get('phase') == 'awaiting_deploy':
            lines.append(f'T{tid}: đã có PR kiểm chứng; đọc báo cáo rồi bấm Duyệt triển khai.')
        elif old.get('control_id') == control_id:
            lines.append(f'T{tid}: lệnh này đã được ghi nhận; xem kết quả gần nhất.')
        else:
            save(store, tid, phase='queued', control_id=control_id,
                 attempt=old.get('attempt', 0) + 1, reason='Đã nhận yêu cầu xử lý đúng mã việc.',
                 next_step='Đội thực hiện ở lượt điều phối kế tiếp và tự gửi kết quả hoặc chỗ bị chặn.')
            lines.append(f'T{tid}: đã xếp xử lý. Giữ nguyên mã việc; bot báo lại khi xong hoặc bị chặn.')
    return '\n'.join(lines)


def checked(argv, cwd=None, timeout=120, env=None):
    import team_supervisor as team
    rc, out, err = team.command(argv, cwd=cwd or team.REPO, timeout=timeout, env=env)
    if rc:
        raise RuntimeError('command_failed:' + argv[0] + ':' + str(rc))
    return out.strip()


def context(store, task):
    """Include the original task, not just its T-number or an unrelated bundle."""
    import team_supervisor as team
    ev = json.loads(task['evidence'])
    note = store.get(f"progress:{task['id']}", {})
    milestone = ''
    key = task['dedupe'].split('milestone:', 1)[-1]
    if ':milestone:' in task['dedupe']:
        milestone = '\n'.join(line for line in (team.REPO / 'docs/milestones.md').read_text().splitlines()
                              if re.search(r'\b' + re.escape(key) + r'\b', line))
    return json.dumps(team.scrub({'task_id': task['id'], 'title': task['title'],
        'request': ev.get('request', task['title']), 'role': task['role'],
        'next_step': note.get('next_step'), 'milestone_requirements': milestone,
        'evidence': team.model_bundle({'task': ev})}), ensure_ascii=False)


def prepare_pr(store, task, evidence):
    """Apply an immutable patch to current main, validate, then publish reviewable PR."""
    import team_supervisor as team
    from team_workspace import permitted
    patch = evidence.get('patch', {})
    source = Path(patch.get('path', ''))
    if not source.is_file() or store.root.resolve() not in source.resolve().parents:
        raise RuntimeError('missing_reviewable_patch')
    payload = source.read_bytes()
    if hashlib.sha256(payload).hexdigest() != patch.get('sha256'):
        raise RuntimeError('patch_changed_since_report')
    paths = evidence.get('paths', [])
    if not paths or any(not permitted(p, task['role']) for p in paths):
        raise RuntimeError('patch_outside_execution_scope')
    if not any(p.startswith('src/') for p in paths):
        raise RuntimeError('proposal_only_no_publishable_code')
    # Bilingual blog publication has DB/indexing obligations beyond a code merge.
    if any(p.startswith('src/content/blog/') for p in paths):
        raise RuntimeError('blog_requires_bilingual_publication_review')
    tid = task['id']
    attempt = state(store, tid)['attempt']
    branch = f'agent/execute-T{tid}-{attempt}'
    tree = store.root / 'workspaces' / f'execute-T{tid}-{attempt}'
    checked(['git', 'fetch', 'origin', 'main'])
    base = checked(['git', 'rev-parse', 'origin/main'])
    checked(['git', 'worktree', 'add', '-b', branch, str(tree), base])
    checked(['git', 'apply', '--index', str(source)], cwd=tree)
    actual = checked(['git', 'diff', '--cached', '--name-only'], cwd=tree).splitlines()
    if sorted(actual) != sorted(paths) or any((tree / p).is_symlink() for p in actual):
        raise RuntimeError('patch_manifest_mismatch')
    checked(['git', 'diff', '--cached', '--check'], cwd=tree)
    # Dependency installation executes no package lifecycle hooks. Test/build
    # processes receive no provider/cloud credentials or user HOME.
    env = team.clean_env()
    scratch = store.root / 'scratch' / f'qa-T{tid}-{attempt}'
    scratch.mkdir(parents=True, exist_ok=True)
    env.update(HOME=str(scratch), CI='true')
    checked(['npm', 'ci', '--ignore-scripts', '--no-audit', '--no-fund'], cwd=tree, env=env, timeout=300)
    for argv in (['npx', '--no-install', 'tsc', '--noEmit', '-p', 'tsconfig.app.json'],
                 ['npm', 'run', 'test'], ['npm', 'run', 'build']):
        checked(argv, cwd=tree, env=env, timeout=600)
    # The committed bytes must be the bytes validated; build generators cannot
    # silently leave a different unstaged implementation behind.
    checked(['git', 'diff', '--exit-code'], cwd=tree)
    if checked(['git', 'ls-files', '--others', '--exclude-standard'], cwd=tree):
        raise RuntimeError('validation_created_unreviewed_files')
    checked(['git', '-c', 'core.hooksPath=/dev/null', 'commit', '-m', f'fix: address team task T{tid}'], cwd=tree)
    head = checked(['git', 'rev-parse', 'HEAD'], cwd=tree)
    # No force push and no changes to the user's checkout/index.
    checked(['git', 'push', 'origin', f'HEAD:refs/heads/{branch}'], cwd=tree)
    body = store.artifact(f'T{tid}-{attempt}-pr.md',
        f"Addresses T{tid}: {task['title']}\n\nChanges: " + ', '.join(actual) +
        '\n\nValidation: typecheck, test suite and production build passed in an isolated checkout.\n'
        'Deployment follows the owner-configured policy after CI passes on this revision.\n')
    url = checked(['gh', 'pr', 'create', '--base', 'main', '--head', branch,
                   '--title', f'fix: address team task T{tid}', '--body-file', body['path']], cwd=tree)
    if not re.fullmatch(r'https://github.com/cuongnguyen84/pickle-hub-pro/pull/\d+', url):
        raise RuntimeError('unexpected_pull_request_url')
    automatic = store.get('ordinary_code_autodeploy', False)
    save(store, tid, phase='awaiting_ci' if automatic else 'awaiting_deploy', pr=url, head=head, base=base,
         autodeploy=automatic, ci_requested_at=time.time(),
         reason='Code đã qua typecheck, test và build; chưa đưa lên website.',
         next_step='Đội tự triển khai khi CI đạt, sau đó đối chiếu production và báo lại.' if automatic else 'Đọc PR, sau đó bấm Duyệt triển khai dưới báo cáo.')
    return (f'T{tid}: code đã qua typecheck, test và build.\n{url}\nPhiên bản: {head[:12]}\n' +
            ('Đội đang chờ CI để tự triển khai theo quyền anh đã giao; bot sẽ báo khi lên website.' if automatic else 'Bấm Duyệt triển khai bên dưới. Chưa thay đổi production.'))


def approve(store, code, revision):
    from team_progress import target
    task = target(store, code)
    if not task:
        return 'Không thấy mã việc.'
    tid = task['id']
    current = state(store, tid)
    if current.get('phase') != 'awaiting_deploy' or current.get('head', '')[:12] != revision:
        return f'T{tid}: nút duyệt đã cũ hoặc chưa có bản đã kiểm chứng. Mở báo cáo mới nhất.'
    # Queue the exact approval; actual merge runs under the supervisor lock.
    save(store, tid, phase='queued', approval=revision, attempt=current.get('attempt', 0) + 1,
         reason='Đã nhận duyệt đúng phiên bản; chờ kiểm tra PR/CI trước triển khai.')
    return f'T{tid}: đã nhận duyệt phiên bản {revision}. Bot sẽ báo riêng khi merge và khi kiểm chứng triển khai.'


def deploy(store, task):
    tid = task['id']
    current = state(store, tid)
    pr = json.loads(checked(['gh', 'pr', 'view', current['pr'], '--json',
                           'headRefOid,baseRefName,state,mergeStateStatus,statusCheckRollup']))
    if (pr['headRefOid'] != current['head'] or pr['baseRefName'] != 'main' or
            pr['state'] != 'OPEN' or pr['mergeStateStatus'] != 'CLEAN'):
        raise RuntimeError('pr_changed_or_not_mergeable')
    checks = pr.get('statusCheckRollup') or []
    if not checks or any(c.get('conclusion', c.get('state')) not in {'SUCCESS', 'NEUTRAL', 'SKIPPED'} for c in checks):
        raise RuntimeError('ci_not_successful')
    base = json.loads(checked(['gh', 'api', 'repos/cuongnguyen84/pickle-hub-pro/commits/main']))['sha']
    # A content-only post only adds files; CLEAN merge state + green CI is enough when main moved.
    if base != current['base'] and current.get('kind') != 'wriai':
        raise RuntimeError('main_changed_since_validation')
    # Persist before the external write. An interruption is never replayed as a merge.
    save(store, tid, phase='deploying', merge_requested_at=time.time())
    checked(['gh', 'pr', 'merge', current['pr'], '--squash', '--match-head-commit', current['head']])
    merged = json.loads(checked(['gh', 'pr', 'view', current['pr'], '--json', 'state,mergeCommit']))
    if merged['state'] != 'MERGED' or not merged.get('mergeCommit'):
        raise RuntimeError('merge_not_confirmed')
    save(store, tid, phase='deploying', merge_commit=merged['mergeCommit']['oid'],
         reason='Đã merge; đang chờ GitHub ghi nhận deployment production thành công.',
         next_step='Agent tự đối chiếu deployment mỗi lượt. Chưa báo hoàn tất khi mới merge.')
    return f'T{tid}: đã merge {current["pr"]}; đang chờ kiểm chứng deployment. Chưa đánh dấu xong.'


def production_deployment(sha):
    """Check the active Cloudflare deployment, not merely a green GitHub build."""
    import tomllib
    import urllib.request
    import team_supervisor as team
    # Wrangler refreshes its existing OAuth session and discovers the account.
    rows = json.loads(checked(['wrangler', 'pages', 'deployment', 'list', '--project-name',
                              'pickle-hub-pro', '--environment', 'production', '--json']))
    if not rows:
        return None
    match = re.fullmatch(r'https://dash.cloudflare.com/([a-f0-9]{32})/pages/view/pickle-hub-pro/[a-f0-9-]+', rows[0]['Build'])
    if not match:
        raise RuntimeError('cloudflare_account_not_verified')
    token = team.secret('CLOUDFLARE_API_TOKEN')
    if not token:
        config = Path.home() / 'Library/Preferences/.wrangler/config/default.toml'
        auth = tomllib.loads(config.read_text())
        token = auth.get('oauth_token') or auth.get('api_token')
    if not token:
        raise RuntimeError('cloudflare_credentials_unavailable')
    req = urllib.request.Request(f'https://api.cloudflare.com/client/v4/accounts/{match[1]}/pages/projects/pickle-hub-pro',
                                 headers={'Authorization': f'Bearer {token}'})
    with urllib.request.urlopen(req, timeout=30) as response:
        body = json.load(response)
    if not body.get('success'):
        raise RuntimeError('cloudflare_verification_failed')
    deployment = body['result'].get('canonical_deployment') or {}
    metadata = deployment.get('deployment_trigger', {}).get('metadata', {})
    stage = deployment.get('latest_stage', {})
    if (deployment.get('environment') == 'production' and metadata.get('branch') == 'main'
            and metadata.get('commit_hash') == sha and stage.get('name') == 'deploy' and stage.get('status') == 'success'):
        return deployment
    return None


def verify_deployment(store, task):
    """Only success for the exact merged SHA in the production environment counts."""
    import team_supervisor as team
    current = state(store, task['id'])
    sha = current.get('merge_commit')
    if not sha:
        pr = json.loads(checked(['gh', 'pr', 'view', current['pr'], '--json', 'state,headRefOid,mergeCommit']))
        if pr['state'] != 'MERGED' or pr['headRefOid'] != current['head'] or not pr.get('mergeCommit'):
            raise RuntimeError('merge_outcome_requires_reconciliation')
        sha = pr['mergeCommit']['oid']
        save(store, task['id'], merge_commit=sha)
    deployment = production_deployment(sha)
    if deployment:
        if not production_smoke():
            raise RuntimeError('production_smoke_failed')
        if current.get('kind') == 'wriai':
            from team_wriai import after_deploy
            published = after_deploy(store, task)
            save(store, task['id'], phase='complete', reason='Bài đã lên production, bản VI đã ghi.', next_step='Xin index trên GSC.')
            with store.db:
                store.db.execute("UPDATE tasks SET status='resolved',updated=? WHERE id=?", (time.time(), task['id']))
            return published
        save(store, task['id'], phase='complete', reason=f'Deployment production {sha[:12]} thành công; kiểm tra trang chủ đạt.',
             next_step='Anh không cần thao tác thêm.', deployment_id=deployment['id'])
        if not task['dedupe'].startswith('finding:'):
            with store.db:
                store.db.execute("UPDATE tasks SET status='resolved',updated=? WHERE id=?", (time.time(), task['id']))
        else:
            from team_verification import verify_task
            result = verify_task(store, f'T{task["id"]}')
            return f'Đã triển khai bản sửa T{task["id"]}.\n{result}'
        return f'✅ ĐÃ TRIỂN KHAI · T{task["id"]}\n{current["pr"]}\nCommit: {sha[:12]}\nDeployment production thành công; kiểm tra trang chủ đạt.'
    if time.time() - current['merge_requested_at'] > 1800:
        raise RuntimeError('deployment_not_verified_after_30_minutes')
    return None


def production_smoke():
    import urllib.request
    req = urllib.request.Request('https://www.thepicklehub.net/?nocache=1', headers={'User-Agent': 'Googlebot'})
    with urllib.request.urlopen(req, timeout=30) as response:
        html = response.read(2_000_000).decode('utf-8', 'replace')
        return response.status == 200 and '<title' in html and len(re.sub('<[^>]+>', ' ', html).split()) >= 120


def await_ci(store, task):
    current = state(store, task['id'])
    # An approved Wriai post was approved as content; only ordinary code waits for a second click.
    if not current.get('autodeploy') or (current.get('kind') != 'wriai' and not store.get('ordinary_code_autodeploy', False)):
        save(store, task['id'], phase='awaiting_deploy', next_step='Bấm Duyệt triển khai sau khi đọc PR.')
        return f'T{task["id"]}: tự triển khai đã tắt; chờ duyệt PR {current["pr"]}.'
    pr = json.loads(checked(['gh', 'pr', 'view', current['pr'], '--json', 'headRefOid,statusCheckRollup']))
    if pr['headRefOid'] != current['head']:
        raise RuntimeError('pr_changed_or_not_mergeable')
    checks = pr.get('statusCheckRollup') or []
    if any(c.get('conclusion', c.get('state')) in {'FAILURE', 'ERROR', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED'} for c in checks):
        raise RuntimeError('ci_not_successful')
    if checks and all(c.get('conclusion', c.get('state')) in {'SUCCESS', 'NEUTRAL', 'SKIPPED'} for c in checks):
        return deploy(store, task)
    if time.time() - current['ci_requested_at'] > 1800:
        raise RuntimeError('ci_not_verified_after_30_minutes')
    return None


ERRORS = {
    'proposal_only_no_publishable_code': 'Bản cũ chỉ có đề xuất/Markdown; chưa có thay đổi ứng dụng để triển khai. Cần biên tập/kiểm chứng nguồn và tạo bản code thực tế.',
    'blog_requires_bilingual_publication_review': 'Bài blog cần đủ bản EN/VI, bản ghi VI trong DB, metadata và kiểm tra public; chưa có gói xuất bản đầy đủ.',
    'draft_model_failed': 'Claude không hoàn tất lượt sửa. Đã lưu chẩn đoán của provider; chưa có bản hợp lệ để triển khai.',
    'ci_not_successful': 'CI chưa đạt trên đúng phiên bản đã duyệt. Cần sửa hoặc đợi CI rồi bấm xử lý lại.',
    'pr_changed_or_not_mergeable': 'PR đã thay đổi hoặc chưa merge được. Phải kiểm chứng phiên bản mới trước khi duyệt lại.',
    'missing_reviewable_patch': 'Chưa có patch thực tế để kiểm tra/triển khai.',
    'wriai_package_no_longer_valid': 'Gói bài Wriai không còn hợp lệ trên main mới (slug trùng hoặc thiếu dữ kiện). Không đăng.',
    'wriai_public_check_failed': 'Đã merge và ghi bản VI nhưng trang public chưa kiểm được. Cần mở thử 2 URL.',
}


def run_one(store):
    import team_supervisor as team
    if store.get('paused', False) or (team.REPO / '.claude/AGENTS_PAUSED').exists():
        return False
    tasks = store.db.execute("SELECT * FROM tasks WHERE status NOT IN ('resolved','cancelled') ORDER BY id").fetchall()
    for task in tasks:
        tid = task['id']
        current = state(store, tid)
        if current.get('phase') == 'waiting_followup' and current.get('followup_at', float('inf')) <= time.time():
            current = save(store, tid, phase='queued', attempt=current.get('attempt', 0) + 1)
        if current.get('phase') not in {'queued', 'awaiting_ci', 'deploying'}:
            continue
        try:
            if current['phase'] == 'deploying':
                reply = verify_deployment(store, task)
                if reply:
                    store.enqueue(f'action-complete:{tid}:{current["attempt"]}', reply)
                continue
            if current['phase'] == 'awaiting_ci':
                reply = await_ci(store, task)
                if reply:
                    store.enqueue(f'action-ci:{tid}:{current["attempt"]}', reply)
                continue
            save(store, tid, phase='running', reason='Đội đang thực hiện và kiểm chứng yêu cầu.')
            store.enqueue(f'action-start:{tid}:{current["attempt"]}', f'▶️ ĐANG XỬ LÝ · T{tid}\n{store.get(f"owner_title:{tid}", task["title"])[:160]}\nBot sẽ gửi kết quả hoặc lý do bị chặn. Anh không cần bấm lại.')
            team.flush(store)
            try:
                from team_progress import publish
                store.put('heartbeat', time.time())
                publish(store)
            except Exception as exc:
                store.put('snapshot_error', {'error': team.clean_error(exc), 'at': time.time()})
            if current.get('approval') and current.get('kind') == 'wriai' and not current.get('pr'):
                from team_wriai import publish
                reply = publish(store, task)
            elif current.get('approval'):
                reply = deploy(store, task)
            elif ':milestone:' in task['dedupe']:
                from team_measure import execute
                reply = execute(store, task)
            else:
                ev = json.loads(task['evidence'])
                note = store.get(f'progress:{tid}', {})
                if note.get('decision'):
                    decision = note['decision']
                    save(store, tid, phase='blocked', reason=decision['summary'], next_step=decision['instructions'])
                    store.enqueue(f'action-result:{tid}:{current["attempt"]}', f'T{tid}: cần thao tác cụ thể trước khi tiếp tục.\n{decision["instructions"]}')
                    return True
                if not ev.get('patch'):
                    # Resolve stale findings before spending a model call.
                    if task['dedupe'].startswith('finding:'):
                        from team_verification import verify_task
                        reply = verify_task(store, f'T{tid}')
                        latest = store.db.execute('SELECT * FROM tasks WHERE id=?', (tid,)).fetchone()
                        if latest['status'] == 'resolved':
                            save(store, tid, phase='complete', reason='Đã đo lại: không còn điều kiện lỗi.', next_step='Không cần thao tác thêm.')
                            store.enqueue(f'action-result:{tid}:{current["attempt"]}', reply)
                            return True
                    if not team.provider_available(store):
                        raise RuntimeError('provider_unavailable')
                    if store.get('provider', 'claude') == 'codex':
                        raise RuntimeError('codex_report_only_no_code_executor')
                    from team_workspace import draft
                    role = 'editorial' if task['role'] == 'editorial' else 'engineering'
                    result = draft(store, role, context(store, task), tid)
                    if not result:
                        save(store, tid, phase='queued', reason='Chờ hạn mức model; yêu cầu được giữ nguyên.')
                        return True
                    if result.get('error') or result.get('deferred'):
                        raise RuntimeError(result.get('error', 'provider_quota'))
                    ev = result
                reply = prepare_pr(store, task, ev)
            store.enqueue(f'action-result:{tid}:{current["attempt"]}', reply)
        except (Exception, SystemExit) as exc:
            detail = str(exc) if isinstance(exc, RuntimeError) else type(exc).__name__
            reason = ERRORS.get(detail, 'Chưa hoàn tất: ' + detail + '. Đội cần xử lý nguyên nhân trước khi tiếp tục.')
            save(store, tid, phase='blocked', reason=reason, next_step='Xem báo cáo; sau khi khắc phục bấm Xử lý tiếp trên cùng mã việc.', error=detail)
            store.enqueue(f'action-blocked:{tid}:{current["attempt"]}', f'⚠️ CHƯA HOÀN TẤT · T{tid}\n{reason}\nGiữ nguyên mã việc. Không coi bản nháp hoặc merge là đã triển khai.')
        return True
    return False
