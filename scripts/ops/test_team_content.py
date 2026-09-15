import json
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch, MagicMock

import team_content as content
import team_supervisor as team
from team_store import Store


class ContentTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.tmp.name))
        self.item = content.plan()[0]
        self.row = {'id': self.item['id'], 'slug': self.item['slug'], 'status': 'published',
                    'updated_at': '2026-09-13T00:00:00+00:00', 'content_html': '<p>old</p>',
                    'faq_items': [{'question': 'Ai vô địch?', 'answer': 'chưa rõ'}]}
        self.patch = content.prepare(self.item, self.row)
        payload = self.store.artifact('payload.json', json.dumps(self.patch, ensure_ascii=False))
        self.state = {'status': 'scheduled', 'hash': content.digest_value(self.item),
                      'base_updated_at': self.row['updated_at'], 'payload': payload}
        self.key = 'content:' + self.item['key']
        self.store.put(self.key, self.state)
        self.store.put('content_autopublish', True)
        self.now = datetime.fromisoformat('2026-09-15T09:00:00+07:00')

    def tearDown(self):
        self.store.db.close()
        self.tmp.cleanup()

    def test_all_sections_are_safe_and_substantial(self):
        for item in content.plan():
            result = content.prepare(item, {**self.row, 'id': item['id'], 'slug': item['slug']})
            self.assertTrue(result['content_html'].endswith(self.row['content_html']))
        self.assertNotIn('published_at', self.patch)
        self.assertNotIn('title', self.patch)
        self.assertIn('Shimabukuro', self.patch['faq_items'][0]['answer'])
        with self.assertRaises(ValueError):
            content.prepare(self.item, {**self.row, 'slug': 'wrong'})
        with self.assertRaises(ValueError):
            content.prepare({**self.item, 'section': '<script>alert(1)</script>'}, self.row)

    def test_pause_and_future_do_not_write(self):
        with patch.object(team, 'rest') as read:
            self.store.put('paused', True)
            content.publish_due(self.store, self.now)
            self.store.put('paused', False)
            content.publish_due(self.store, datetime.fromisoformat('2026-09-14T09:00:00+07:00'))
            read.assert_not_called()

    def test_conflict_and_changed_manifest_fail_closed(self):
        with patch.object(team, 'rest', return_value=[{**self.row, 'updated_at': 'new'}]), patch.object(content.urllib.request, 'urlopen') as write:
            content.publish_due(self.store, self.now)
            write.assert_not_called()
        self.assertEqual(self.store.get(self.key)['reason'], 'content_concurrent_edit')
        self.store.put(self.key, {**self.state, 'hash': 'wrong'})
        with patch.object(team, 'rest') as read:
            content.publish_due(self.store, self.now)
            read.assert_not_called()

    def test_publish_exact_cas_and_no_duplicate_after_restart(self):
        response = MagicMock()
        response.__enter__.return_value.read.return_value = json.dumps([{**self.row, **self.patch}]).encode()
        with patch.object(team, 'rest', return_value=[self.row]), patch.object(team, 'secret', return_value='test'), patch.object(content, 'public_page', return_value=self.patch['content_html']), patch.object(content.urllib.request, 'urlopen', return_value=response) as write:
            content.publish_due(self.store, self.now)
            request = write.call_args.args[0]
            self.assertIn('updated_at=eq.', request.full_url)
            self.assertIn(self.item['id'], request.full_url)
            content.publish_due(self.store, self.now)
            self.assertEqual(write.call_count, 1)
        self.assertEqual(self.store.get(self.key)['status'], 'published')
        self.assertEqual(self.store.db.execute('SELECT COUNT(*) FROM outbox').fetchone()[0], 1)

    def test_already_written_reconciles_without_patch(self):
        self.store.put(self.key, {**self.state, 'status': 'publishing'})
        with patch.object(team, 'rest', return_value=[{**self.row, **self.patch}]), patch.object(content, 'public_page', return_value=self.patch['content_html']), patch.object(content.urllib.request, 'urlopen') as write:
            content.publish_due(self.store, self.now)
            write.assert_not_called()
        self.assertEqual(self.store.get(self.key)['status'], 'published')

    def test_verification_failure_not_reported_as_published(self):
        with patch.object(team, 'rest', return_value=[{**self.row, **self.patch}]), patch.object(content, 'public_page', return_value='old page'):
            content.publish_due(self.store, self.now)
        self.assertEqual(self.store.get(self.key)['status'], 'blocked')

    def test_natural_calendar_query_is_not_an_ai_task(self):
        tid = self.store.task('telegram:901', 'engineering', 'lịch content tuần này là gì', 'queued', {'request': 'lịch content tuần này là gì'})
        with patch.object(team, 'analyze') as model:
            team.work_queue(self.store, True)
            model.assert_not_called()
        self.assertEqual(self.store.db.execute('SELECT status FROM tasks WHERE id=?', (tid,)).fetchone()[0], 'resolved')

    def test_one_write_daily_even_if_backlog(self):
        self.store.put('content:last_write', {'date': self.now.date().isoformat(), 'key': 'another-article'})
        with patch.object(team, 'rest') as read:
            content.publish_due(self.store, self.now)
            read.assert_not_called()
