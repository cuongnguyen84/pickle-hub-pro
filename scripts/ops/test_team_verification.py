"""Exercise full incident loops without network, model calls or publication."""
import json
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).parent))
import team_supervisor as team
import team_verification as verify
from team_store import Store


class VerificationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.tmp.name))
        self.now = time.time()

    def tearDown(self):
        self.store.db.close()
        self.tmp.cleanup()

    def observe(self, check, data, now=None):
        data = verify.prepare_observation(self.store, check, data)
        entry = {'ok': True, 'measured_at': self.now if now is None else now, 'data': data}
        transitions = self.store.findings(check, 'platform', data['problems'], entry)
        verify.reconcile(self.store, check, entry, transitions)
        return entry

    def community(self, ids):
        return {'problems': {'reports':'Unresolved reports'} if ids else {},
                'reports': [{'id':i, 'status':'pending'} for i in ids]}

    def ig(self, error=None, checked=None, count=8):
        observation = verify.instagram_observation([
            {'username': f'account{i}', 'active': True, 'last_error': error,
             'last_checked_at': verify.iso(self.now if checked is None else checked)} for i in range(count)], self.now)
        return {'instagram':observation, 'problems':{} if observation['healthy'] else {'feed-embeds-sync':'IG issue'}}

    def task(self, dedupe):
        return self.store.db.execute('SELECT * FROM tasks WHERE dedupe=?', (dedupe,)).fetchone()

    def note(self, task):
        return self.store.get(f'progress:{task["id"]}')

    def messages(self):
        return self.store.db.execute('SELECT body FROM outbox').fetchall()

    def test_close_clears_owner_action_and_notifies_once_then_reopens_same_id(self):
        self.observe('community', self.community(['r1']))
        task = self.task('finding:community:reports')
        self.assertEqual(self.note(task)['verification']['phase'], 'owner_action')
        self.observe('community', self.community([]), self.now + 300)
        self.assertEqual(self.task(task['dedupe'])['status'], 'resolved')
        self.assertIsNone(self.note(task)['decision'])
        self.assertIn('không cần thao tác', self.note(task)['next_step'])
        count = len(self.messages())
        self.observe('community', self.community([]), self.now + 600)
        self.assertEqual(len(self.messages()), count)
        self.observe('community', self.community(['r2']), self.now + 900)
        self.assertEqual(self.task(task['dedupe'])['id'], task['id'])
        self.assertEqual(self.task(task['dedupe'])['status'], 'open')
        self.assertIn('TÁI DIỄN', self.messages()[-1][0])

    def test_reviewed_is_not_terminal_even_with_resolved_timestamp(self):
        reviewed = {'id':'r1', 'status':'reviewed', 'resolved_at': verify.iso(self.now)}
        with patch.object(team, 'rest', return_value=[reviewed]) as rest:
            data = team.collect('community')
        self.assertIn('reports', data['problems'])
        query = rest.call_args.args[0]
        self.assertIn('status.not.in.(resolved,dismissed)', query)
        self.assertNotIn('resolved_at=is.null', query)
        self.assertIn('community', team.FAST)

    def test_bad_community_response_fails_closed(self):
        with patch.object(team, 'rest', return_value=None):
            with self.assertRaises(ValueError):
                team.collect('community')

    def test_collection_failure_does_not_close_or_invent_success(self):
        self.observe('community', self.community(['r1']))
        task = self.task('finding:community:reports')
        before = self.note(task)
        sent = self.store.db.execute('SELECT COUNT(*) FROM outbox').fetchone()[0]
        entry = {'ok':False, 'measured_at':self.now + 300, 'error':'TimeoutError'}
        verify.reconcile(self.store, 'community', entry)
        self.assertEqual(self.task(task['dedupe'])['status'], 'open')
        # A failed read keeps the last verified state and sends nothing (T26 spam 25/09).
        self.assertEqual(self.note(task), before)
        self.assertEqual(self.store.db.execute('SELECT COUNT(*) FROM outbox').fetchone()[0], sent)

    def test_expired_token_gets_exact_secret_handoff_not_eight_reauthorizations(self):
        self.observe('jobs', self.ig('Error validating access token: Session has expired'))
        task = self.task('finding:jobs:feed-embeds-sync')
        note = self.note(task)
        self.assertEqual(note['decision']['action'], 'instagram_token')
        self.assertIn('IG_ACCESS_TOKEN', note['decision']['instructions'])
        self.assertIn('8/8', note['reason'])
        self.assertEqual(note['verification']['phase'], 'owner_action')
        count = len(self.messages())
        self.observe('jobs', self.ig('Error validating access token: Session has expired'), self.now + 20)
        self.assertEqual(len(self.messages()), count)

    def test_owner_claim_waits_for_new_run_then_closes_only_after_all_sources_pass(self):
        self.observe('jobs', self.ig('Session has expired', self.now - 120))
        task = self.task('finding:jobs:feed-embeds-sync')
        with patch.object(team, 'collect', return_value=self.ig('Session has expired', self.now - 120)):
            reply = verify.verify_task(self.store, f'T{task["id"]}', owner_done=True)
        requested = self.note(task)['verification']['requested_at']
        self.assertIn('CHỜ KIỂM CHỨNG', reply)
        self.assertIsNone(self.note(task)['decision'])
        with patch.object(team, 'collect', return_value=self.ig('Session has expired', self.now - 120)):
            verify.verify_task(self.store, f'T{task["id"]}', owner_done=True)
        self.assertEqual(self.note(task)['verification']['requested_at'], requested)
        # Even successful old results are not proof of the reported repair.
        self.observe('jobs', self.ig(None, self.now - 60), self.now + 10)
        self.assertEqual(self.task(task['dedupe'])['status'], 'open')
        fresh = self.ig(None, self.now)
        for source in fresh['instagram']['sources']:
            source['checked_at'] = requested + 1
        self.observe('jobs', fresh, requested + 2)
        self.assertEqual(self.task(task['dedupe'])['status'], 'resolved')
        self.assertEqual(self.note(task)['verification']['phase'], 'resolved')
        self.assertNotIn('requested_at', self.note(task)['verification'])
        self.assertIn('8/8', self.messages()[-1][0])

    def test_new_failed_run_returns_precise_owner_action(self):
        self.observe('jobs', self.ig('Session has expired', self.now - 120))
        task = self.task('finding:jobs:feed-embeds-sync')
        with patch.object(team, 'collect', return_value=self.ig('Session has expired', self.now - 120)):
            verify.verify_task(self.store, f'T{task["id"]}', owner_done=True)
        requested = self.note(task)['verification']['requested_at']
        fresh = self.ig('Session has expired')
        for source in fresh['instagram']['sources']:
            source['checked_at'] = requested + 1
        self.observe('jobs', fresh, requested + 2)
        self.assertEqual(self.note(task)['verification']['phase'], 'owner_action')
        self.assertEqual(self.task(task['dedupe'])['status'], 'open')
        self.assertIn('CẦN ANH', self.messages()[-1][0])

    def test_no_new_run_escalates_to_agent_not_repeated_token_demand(self):
        self.observe('jobs', self.ig('Session has expired', self.now - 120))
        task = self.task('finding:jobs:feed-embeds-sync')
        with patch.object(team, 'collect', return_value=self.ig('Session has expired', self.now - 120)):
            verify.verify_task(self.store, f'T{task["id"]}', owner_done=True)
        self.observe('jobs', self.ig('Session has expired', self.now - 120), self.now + 5500)
        self.assertEqual(self.note(task)['verification']['phase'], 'needs_agent')
        self.assertIsNone(self.note(task)['decision'])
        self.assertIn('cron', self.note(task)['next_step'])

    def test_partial_stale_empty_and_incomplete_sources_never_pass(self):
        for data in [self.ig(None, self.now - 6000), self.ig(None, count=0), self.ig('permission denied')]:
            self.assertFalse(data['instagram']['healthy'])
        data = self.ig(None)
        data['instagram']['sources'][0]['error_kind'] = 'permissions'
        # Pure observer, not a forged health flag.
        rows = [{'username':'good','active':True,'last_checked_at':verify.iso(self.now),'last_error':None},
                {'username':'bad','active':True,'last_checked_at':verify.iso(self.now),'last_error':'permission denied'}]
        self.assertFalse(verify.instagram_observation(rows, self.now)['healthy'])
        with self.assertRaises(ValueError):
            verify.instagram_observation(rows * 500, self.now)
        with self.assertRaises(ValueError):
            verify.instagram_observation([{'username':'bad'}], self.now)

    def test_verify_control_is_read_only_model_free_and_no_duplicate_work(self):
        self.observe('community', self.community(['r1']))
        task = self.task('finding:community:reports')
        control_id = self.store.task('telegram:999', 'chief', 'verify', 'queued', {'request':f'team verify T{task["id"]}'})
        control = self.store.db.execute('SELECT * FROM tasks WHERE id=?', (control_id,)).fetchone()
        with patch.object(team, 'collect', return_value=self.community([])), patch.object(team, 'analyze') as ai:
            team.handle_control(self.store, control, f'team verify T{task["id"]}')
        ai.assert_not_called()
        self.assertEqual(self.store.db.execute('SELECT COUNT(*) FROM tasks').fetchone()[0], 2)
        self.assertEqual(self.task(task['dedupe'])['status'], 'resolved')
        self.assertEqual(self.store.db.execute('SELECT status FROM tasks WHERE id=?', (control_id,)).fetchone()[0], 'resolved')
        self.assertIn('ĐÃ KIỂM CHỨNG', self.store.db.execute('SELECT body FROM outbox WHERE dedupe=?', (f'control:{control_id}',)).fetchone()[0])

    def test_crash_after_resolution_is_reconciled_and_delivered_once(self):
        self.observe('site', {'problems': {'down':'Site down'}})
        task = self.task('finding:site:down')
        entry = {'ok':True, 'measured_at':self.now + 300, 'data':{'problems':{}}}
        self.store.findings('site','platform',{},entry)  # crash before notification
        self.assertTrue(self.store.get(f'finding_transition:{task["id"]}'))
        verify.reconcile(self.store, 'site', entry)
        count = len(self.messages())
        verify.reconcile(self.store, 'site', entry)
        self.assertEqual(len(self.messages()), count)
        self.assertIsNone(self.store.get(f'finding_transition:{task["id"]}'))
        self.assertIn('ĐÃ KIỂM CHỨNG', self.messages()[-1][0])

    def test_same_observation_does_not_reset_task_progress_timestamp(self):
        with patch('team_store.time.time', return_value=self.now):
            self.observe('site', {'problems':{'down':'Site down'}})
        with patch('team_store.time.time', return_value=self.now + 300):
            self.observe('site', {'problems':{'down':'Site down'}}, self.now + 300)
        self.assertEqual(self.task('finding:site:down')['updated'], self.now)
        self.assertEqual(self.note(self.task('finding:site:down'))['verification']['checked_at'], verify.iso(self.now + 300))

    def test_non_finding_has_no_fake_acceptance(self):
        tid = self.store.task('telegram:12','engineering','Draft','awaiting_review',{})
        with patch.object(team, 'collect') as collect:
            result = verify.verify_task(self.store, f'T{tid}', owner_done=True)
        collect.assert_not_called()
        self.assertIn('chưa có bộ kiểm chứng', result)
        self.assertEqual(self.task('telegram:12')['status'], 'awaiting_review')


if __name__ == '__main__':
    unittest.main()
