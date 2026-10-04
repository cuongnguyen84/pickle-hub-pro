import json
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

import team_tournament_coverage as coverage
from team_store import Store


class CoverageTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.tmp.name))
        self.event = {'key': 'hk', 'title': 'Hong Kong', 'start_date': '2026-10-19',
                      'end_date': '2026-10-25', 'event_timezone': 'Asia/Hong_Kong',
                      'sources': ['https://example.org/event']}
        self.config = {'enabled': True, 'events': [self.event]}
        self.pause = patch.object(coverage, 'PAUSE', Path(self.tmp.name) / 'paused')
        self.pause.start()

    def tearDown(self):
        self.pause.stop()
        self.store.db.close()
        self.tmp.cleanup()

    def queue(self, at='2026-10-19T08:00:00+07:00', fetcher=lambda url: 'Official text'):
        return coverage.queue_due(self.store, datetime.fromisoformat(at), self.config, fetcher)

    def test_latest_only_idempotent_never_resets_task(self):
        tid = self.queue()[0]
        row = self.store.db.execute('SELECT * FROM tasks WHERE id=?', (tid,)).fetchone()
        self.assertTrue(row['dedupe'].endswith('daily-2026-10-19'))
        with self.store.db:
            self.store.db.execute("UPDATE tasks SET status='running' WHERE id=?", (tid,))
        self.assertEqual(self.queue(), [])
        self.assertEqual(self.store.db.execute('SELECT status FROM tasks').fetchone()[0], 'running')
        self.assertEqual(self.store.db.execute('SELECT COUNT(*) FROM outbox').fetchone()[0], 0)

    def test_pause_future_disabled(self):
        self.assertEqual(self.queue('2026-10-04T12:00:00+07:00'), [])
        self.store.put('paused', True)
        self.assertEqual(self.queue(), [])
        self.store.put('paused', False)
        coverage.PAUSE.touch()
        self.assertEqual(self.queue(), [])
        coverage.PAUSE.unlink()
        self.config['enabled'] = False
        self.assertEqual(self.queue(), [])

    def test_us_final_is_after_local_final_day(self):
        self.event['event_timezone'] = 'America/Chicago'
        final = dict(coverage.slots(self.event, self.config))['final']
        self.assertEqual(final.isoformat(), '2026-10-27T07:30:00+07:00')
        self.assertEqual(dict(coverage.slots(self.event, self.config))['prep-14'].isoformat(),
                         '2026-10-06T07:30:00+07:00')

    def test_failed_sources_still_enqueue_gap_not_scores(self):
        def failed(url):
            raise TimeoutError()
        tid = self.queue(fetcher=failed)[0]
        evidence = json.loads(self.store.db.execute('SELECT evidence FROM tasks WHERE id=?', (tid,)).fetchone()[0])
        self.assertEqual(evidence['sources'][0]['missing'], 'TimeoutError')
        self.assertTrue(evidence['request'].startswith('editorial '))
        self.assertLessEqual(len(evidence['request']), 7500)
        self.assertIn('CHƯA XÁC MINH', evidence['request'])

    def test_initial_existing_preserved_and_followup_runs(self):
        tid = self.store.task('manual-hk', 'editorial', 'existing', 'running')
        self.event.update(existing_task_id=tid, initial_prep_at='2026-10-04T00:00:00+07:00')
        self.assertEqual(self.queue('2026-10-04T12:00:00+07:00'), [])
        self.assertEqual(len(self.queue('2026-10-05T08:00:00+07:00')), 1)
        self.assertEqual(self.store.db.execute('SELECT status FROM tasks WHERE id=?', (tid,)).fetchone()[0], 'running')

    def test_stale_queued_checks_cancelled_but_review_preserved(self):
        first = self.queue('2026-10-05T08:00:00+07:00')[0]
        second = self.queue('2026-10-12T08:00:00+07:00')[0]
        self.assertEqual(self.store.db.execute('SELECT status FROM tasks WHERE id=?', (first,)).fetchone()[0], 'cancelled')
        with self.store.db:
            self.store.db.execute("UPDATE tasks SET status='awaiting_review' WHERE id=?", (second,))
        self.queue()
        self.assertEqual(self.store.db.execute('SELECT status FROM tasks WHERE id=?', (second,)).fetchone()[0], 'awaiting_review')

    def test_task_and_fetch_caps_and_html(self):
        self.config['events'] = [{**self.event, 'key': str(i), 'sources': ['https://example.org'] * 8} for i in range(6)]
        calls = []
        self.assertEqual(len(self.queue(fetcher=lambda url: calls.append(url) or 'a' * 9000)), 2)
        self.assertEqual(len(calls), 6)
        parser = coverage.SourceText()
        parser.feed('<p>Schedule</p><script>evil()</script><style>hidden</style><p>10 AM</p>')
        self.assertEqual(' '.join(parser.parts), 'Schedule 10 AM')

    def test_future_auto_publish_waits_until_local_event_start(self):
        self.event.update(auto_publish=True, event_id='event-1', result_source='https://example.org/scores')
        calls = []
        import sys
        sys.path.insert(0, str(Path(coverage.__file__).parents[1] / 'blog'))
        import tournament_results_autopublish
        with patch.object(tournament_results_autopublish, 'publish_event', side_effect=lambda *a, **k: calls.append(1)):
            self.queue('2026-10-04T12:00:00+07:00', fetcher=lambda url: 'Official text')
        self.assertEqual(calls, [])

    def test_score_snapshot_keeps_raw_facts_and_bounds_sample(self):
        match = {'id': 'a', 'division': 'Singles', 'roundLabel': 'Final', 'dateLabel': 'Date TBA',
                 'status': 'scheduled', 'teams': [{'players': ['A'], 'winner': False, 'games': [None]}]}
        done = {**match, 'id': 'b', 'status': 'final', 'teams': [{'players': ['B'], 'winner': True, 'games': [11]}]}
        raw = coverage.score_snapshot({'tournamentId': 'event', 'matches': [match] * 20 + [done] * 10})
        result = json.loads(raw)
        self.assertLessEqual(len(raw), 1700)
        self.assertEqual(result['counts_by_status'], {'scheduled': 20, 'final': 10})
        self.assertEqual(result['counts_by_division'], {'Singles': 30})
        self.assertEqual(result['sample'][0]['status'], 'final')
        self.assertEqual(result['sample'][0]['teams'][0]['games'], [11])
        self.assertLessEqual(len(result['sample']), 6)
        self.assertIn('not full draw', result['notice'])

    def test_html_prefers_main_and_omits_navigation(self):
        parser = coverage.SourceText()
        parser.feed('<nav>' + 'menu ' * 500 + '</nav><div>Sidebar</div><main><h1>Daily schedule</h1><p>Finals Sunday</p></main>')
        self.assertEqual(parser.excerpt(), 'Daily schedule Finals Sunday')
        parser = coverage.SourceText()
        parser.feed('<main>' + 'Intro ' * 500 + 'Daily schedule finals Sunday' + ' detail' * 500 + '</main>')
        self.assertIn('Daily schedule', parser.excerpt())
        self.assertIn('omitted', parser.excerpt())
        self.assertLessEqual(len(parser.excerpt()), 1700)

    def test_pause_location_uses_repository_environment(self):
        import os
        import subprocess
        import sys
        env = {**os.environ, 'PICKLEHUB_REPO': self.tmp.name,
               'PYTHONPATH': str(Path(coverage.__file__).parent)}
        value = subprocess.check_output([sys.executable, '-c',
                    'import team_tournament_coverage as c; print(c.PAUSE)'], env=env, text=True).strip()
        self.assertEqual(value, str(Path(self.tmp.name) / '.claude/AGENTS_PAUSED'))


if __name__ == '__main__':
    unittest.main()
