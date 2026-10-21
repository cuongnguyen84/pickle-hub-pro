"""Apply only the two reviewed SEO article updates, with optimistic locking.

Preview by default. --apply backs up current public content before PATCH.
Requires SUPABASE_SERVICE_ROLE_KEY or SECRETS_FILE; never prints credentials.
"""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
from urllib.parse import quote

BASE = 'https://ajvlcamxemgbxduhiqrl.supabase.co/rest/v1/vi_blog_posts'
ALLOWED = {'lich-giai-pickleball-viet-nam-2026', 'phan-mem-to-chuc-giai-pickleball-2026'}
FIELDS = {'title', 'meta_title', 'meta_description', 'content_html', 'faq_items', 'author_name'}


def request(key, query, patch=None):
    # Credentials go through stdin config, never shell expansion or command args.
    cfg = '\n'.join(['url = ' + json.dumps(BASE + '?' + query), 'header = ' + json.dumps('apikey: ' + key),
                     'header = ' + json.dumps('Authorization: Bearer ' + key), 'header = "Content-Type: application/json"',
                     'header = "Prefer: return=representation"'])
    args = ['curl', '--config', '-', '--silent', '--show-error', '--fail-with-body', '--max-time', '30']
    payload_path = None
    try:
        if patch is not None:
            with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as payload:
                json.dump(patch, payload, ensure_ascii=False)
                payload_path = payload.name
            args += ['--request', 'PATCH', '--data-binary', '@' + payload_path]
        result = subprocess.run(args, input=cfg, capture_output=True, text=True)
        if result.returncode:
            raise RuntimeError('Supabase request failed; remote update not verified')
        return json.loads(result.stdout)
    finally:
        if payload_path:
            Path(payload_path).unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    updates = json.loads(Path('docs/seo/2026-09-14/vi-blog-patches.json').read_text())
    if {u['slug'] for u in updates} != ALLOWED or len(updates) != 2:
        raise ValueError('Unexpected article scope')
    key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
    if not key:
        secrets = Path(os.environ.get('SECRETS_FILE', '.claude/secrets.local.md'))
        match = re.search(r'(?m)^\s*SUPABASE_SERVICE_ROLE_KEY\s*[:=]?\s*([^\s#]+)', secrets.read_text())
        key = match.group(1) if match else ''
    if not key:
        raise RuntimeError('Missing service credential')
    prepared = []
    for update in updates:
        if set(update['patch']) != FIELDS:
            raise ValueError('Unexpected patch fields')
        rows = request(key, 'slug=eq.' + quote(update['slug'], safe='') + '&select=*')
        if len(rows) != 1 or rows[0]['status'] != 'published' or rows[0]['alternate_en_slug'] != update['alternate_en_slug']:
            raise ValueError('Article no longer matches reviewed scope')
        row = rows[0]
        if all(row.get(k) == v for k, v in update['patch'].items()):
            print(update['slug'] + ': already applied')
            continue
        if row['updated_at'] != update['expected_updated_at']:
            raise ValueError(update['slug'] + ': concurrent edit; review current content before applying')
        prepared.append((update, row))
    backup = Path(tempfile.mkdtemp(prefix='tph-seo-reviewed-'))
    for update, row in prepared:
        (backup / (update['slug'] + '.json')).write_text(json.dumps(row, ensure_ascii=False, indent=2))
        if args.apply:
            query = 'id=eq.' + quote(row['id'], safe='') + '&status=eq.published&updated_at=eq.' + quote(row['updated_at'], safe='')
            changed = request(key, query, update['patch'])
            if len(changed) != 1 or not all(changed[0].get(k) == v for k, v in update['patch'].items()):
                raise RuntimeError('Concurrent edit or update verification failed: ' + update['slug'])
        print(update['slug'] + (': applied and verified' if args.apply else ': preview passed, no write'))
    print('Backup: ' + str(backup))


if __name__ == '__main__':
    main()
