"""Execution routing, replay, approval and failure-path tests. No external writes."""
import json
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

from team_store import Store
import team_actions as actions
import team_supervisor as team
import team_progress as progress


class ActionTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.store = Store(Path(self.tmp.name))
        self.addCleanup(self.store.db.close)
        self.publish = patch.object(progress, 'publish').start()
        self.addCleanup(patch.stopall)
        self.a = self.store.task('finding:growth:milestone:SEO-CLUSTER-READ', 'growth', 'Read GSC', evidence={'measured_at': 1})
        self.b = self.store.task('telegram:29', 'engineering', 'Fix UI', 'awaiting_review', {'request': 'Fix actual UI'})

    def task(self, tid):
        return self.store.db.execute('SELECT * FROM tasks WHERE id=?', (tid,)).fetchone()

    def test_reference_lists_and_invalid_commands(self):
        self.assertEqual(actions.references('t28, T29; XL-171 T28'), ['T28', 'T29', 'XL171'])
        for bad in ('T0', 'T28 deploy', 'T28,', 'T28,,T29', 'hello', ','.join(f'T{i}' for i in range(1, 22))):
            self.assertIsNone(actions.references(bad), bad)

    def test_batch_keeps_task_ids_and_deduplicates_clicks(self):
        codes = [f'T{self.a}', f'T{self.b}']
        actions.request(self.store, codes, 123)
        actions.request(self.store, codes, 124)
        self.assertEqual(self.store.db.execute('SELECT COUNT(*) FROM tasks').fetchone()[0], 2)
        self.assertEqual(actions.state(self.store, self.a)['attempt'], 1)
        self.assertEqual(self.task(self.a)['role'], 'growth')
        self.assertEqual(self.task(self.a)['status'], 'open')
        self.assertEqual(actions.state(self.store, self.b)['control_id'], 123)

    def test_invalid_batch_is_all_or_nothing(self):
        self.assertIn('Không nhận batch', actions.request(self.store, [f'T{self.a}', 'T999'], 1))
        self.assertEqual(actions.state(self.store, self.a), {})

    def test_controller_resolves_id_list_without_calling_model(self):
        tid = self.store.task('telegram:123', 'chief', 'team execute', 'queued', {'request': f'team execute T{self.a},T{self.b}'})
        with patch.object(team, 'analyze') as analyze:
            team.work_queue(self.store, False)
        analyze.assert_not_called()
        self.assertEqual(self.task(tid)['status'], 'resolved')
        self.assertEqual(actions.state(self.store, self.a)['phase'], 'queued')

    def test_original_task_context_is_passed_not_just_id(self):
        data = json.loads(actions.context(self.store, self.task(self.b)))
        self.assertEqual(data['request'], 'Fix actual UI')
        self.assertEqual(data['role'], 'engineering')

    def test_measurement_failure_is_reported_and_original_finding_stays_open(self):
        actions.request(self.store, [f'T{self.a}'], 1)
        with patch.object(team, 'flush'), patch('team_measure.execute', side_effect=RuntimeError('gsc_unavailable')):
            self.assertTrue(actions.run_one(self.store))
        self.assertEqual(actions.state(self.store, self.a)['phase'], 'blocked')
        self.assertEqual(self.task(self.a)['status'], 'open')
        self.assertIn('gsc_unavailable', self.store.db.execute('SELECT body FROM outbox ORDER BY id DESC').fetchone()[0])

    def test_running_snapshot_and_start_receipt_precede_execution(self):
        actions.request(self.store, [f'T{self.a}'], 1)
        events = []
        def publish(store):
            events.append('published')
            task = next(t for t in progress.snapshot(store)['tasks'] if t['id'] == self.a)
            self.assertEqual(task['status'], 'running')
            self.assertLess(time.time() - store.get('heartbeat'), 2)
        def execute(store, task):
            self.assertEqual(events, ['flushed', 'published'])
            receipt = store.db.execute('SELECT body FROM outbox ORDER BY id DESC').fetchone()[0]
            self.assertIn('ĐANG XỬ LÝ', receipt)
            return 'measured'
        self.publish.side_effect = publish
        with patch.object(team, 'flush', side_effect=lambda store: events.append('flushed')), patch('team_measure.execute', side_effect=execute):
            self.assertTrue(actions.run_one(self.store))

    def test_snapshot_outage_does_not_drop_accepted_execution(self):
        actions.request(self.store, [f'T{self.a}'], 1)
        self.publish.side_effect = TimeoutError()
        with patch.object(team, 'flush'), patch('team_measure.execute', return_value='measured') as execute:
            self.assertTrue(actions.run_one(self.store))
        execute.assert_called_once()
        self.assertEqual(self.store.get('snapshot_error')['error'], 'TimeoutError')

    def test_verification_does_not_interrupt_an_active_action(self):
        actions.request(self.store, [f'T{self.a}'], 1)
        tid = self.store.task('telegram:125', 'chief', 'team verify', 'queued', {'request': f'team verify T{self.a}'})
        with patch('team_verification.verify_task') as verify:
            team.work_queue(self.store, False)
        verify.assert_not_called()
        self.assertEqual(self.task(tid)['status'], 'resolved')
        self.assertEqual(actions.state(self.store, self.a)['phase'], 'queued')

    def test_stale_approval_and_duplicate_approval_do_not_merge(self):
        head = 'a' * 40
        actions.save(self.store, self.b, phase='awaiting_deploy', head=head, attempt=1)
        self.assertIn('đã cũ', actions.approve(self.store, f'T{self.b}', 'b' * 12))
        self.assertEqual(actions.state(self.store, self.b)['phase'], 'awaiting_deploy')
        actions.approve(self.store, f'T{self.b}', head[:12])
        self.assertEqual(actions.state(self.store, self.b)['phase'], 'queued')
        self.assertEqual(actions.state(self.store, self.b)['attempt'], 2)
        self.assertIn('đã cũ', actions.approve(self.store, f'T{self.b}', head[:12]))

    def test_changed_pr_is_rejected_before_merge(self):
        actions.save(self.store, self.b, phase='running', pr='url', head='a' * 40)
        with patch.object(actions, 'checked', return_value=json.dumps({'headRefOid': 'b' * 40})) as command:
            with self.assertRaisesRegex(RuntimeError, 'pr_changed'):
                actions.deploy(self.store, self.task(self.b))
        self.assertEqual(command.call_count, 1)

    def test_ci_failure_never_merges(self):
        actions.save(self.store, self.b, phase='running', pr='url', head='a' * 40)
        pr = {'headRefOid': 'a' * 40, 'baseRefName': 'main', 'state': 'OPEN', 'mergeStateStatus': 'CLEAN',
              'statusCheckRollup': [{'conclusion': 'FAILURE'}]}
        with patch.object(actions, 'checked', return_value=json.dumps(pr)) as command:
            with self.assertRaisesRegex(RuntimeError, 'ci_not_successful'):
                actions.deploy(self.store, self.task(self.b))
        self.assertEqual(command.call_count, 1)

    def test_authorized_autodeploy_waits_for_ci_then_deploys(self):
        self.store.put('ordinary_code_autodeploy', True)
        actions.save(self.store, self.b, phase='awaiting_ci', pr='url', head='a' * 40,
                     autodeploy=True, ci_requested_at=time.time())
        with patch.object(actions, 'checked', return_value=json.dumps({'headRefOid': 'a' * 40,
                  'statusCheckRollup': [{'conclusion': '', 'status': 'IN_PROGRESS'}]})), patch.object(actions, 'deploy') as deploy:
            self.assertIsNone(actions.await_ci(self.store, self.task(self.b)))
            deploy.assert_not_called()
        with patch.object(actions, 'checked', return_value=json.dumps({'headRefOid': 'a' * 40,
                  'statusCheckRollup': [{'conclusion': 'SUCCESS'}]})), patch.object(actions, 'deploy', return_value='merged') as deploy:
            self.assertEqual(actions.await_ci(self.store, self.task(self.b)), 'merged')
            deploy.assert_called_once()

    def test_revoked_autodeploy_requires_revision_bound_approval(self):
        actions.save(self.store, self.b, phase='awaiting_ci', pr='url', head='a' * 40, autodeploy=True)
        with patch.object(actions, 'deploy') as deploy:
            self.assertIn('chờ duyệt', actions.await_ci(self.store, self.task(self.b)))
            deploy.assert_not_called()
        self.assertEqual(actions.state(self.store, self.b)['phase'], 'awaiting_deploy')

    def test_production_pending_does_not_mark_complete(self):
        actions.save(self.store, self.b, phase='deploying', merge_commit='a' * 40, merge_requested_at=time.time())
        with patch.object(actions, 'production_deployment', return_value=None):
            self.assertIsNone(actions.verify_deployment(self.store, self.task(self.b)))
        self.assertEqual(self.task(self.b)['status'], 'awaiting_review')

    def test_production_success_sends_completion_only_after_smoke(self):
        actions.save(self.store, self.b, phase='deploying', merge_commit='a' * 40, merge_requested_at=time.time(), pr='url')
        with patch.object(actions, 'production_deployment', return_value={'id': 'deployment'}), patch.object(actions, 'production_smoke', return_value=True):
            self.assertIn('ĐÃ TRIỂN KHAI', actions.verify_deployment(self.store, self.task(self.b)))
        self.assertEqual(self.task(self.b)['status'], 'resolved')

    def test_recovery_blocks_interrupted_action_and_notifies_once(self):
        actions.save(self.store, self.b, phase='running', attempt=1)
        self.store.recover()
        self.store.recover()
        self.assertEqual(actions.state(self.store, self.b)['phase'], 'blocked')
        self.assertEqual(self.store.db.execute('SELECT COUNT(*) FROM outbox').fetchone()[0], 1)

    def test_all_five_digest_tasks_have_action_buttons(self):
        ids = [self.a, self.b] + [self.store.task(f'finding:site:{i}', 'platform', 'check') for i in range(3)]
        keyboard = progress.reply_keyboard(' '.join(f'T{i}' for i in ids), self.store)
        callbacks = [b.get('callback_data') for r in keyboard['inline_keyboard'] for b in r]
        for tid in ids:
            self.assertIn(f'execute|T{tid}', callbacks)

    def test_paused_actions_do_not_run(self):
        actions.request(self.store, [f'T{self.a}'], 1)
        self.store.put('paused', True)
        with patch('team_measure.execute') as execute:
            self.assertFalse(actions.run_one(self.store))
        execute.assert_not_called()

    def test_elapsed_followup_runs_once_and_retains_original_id(self):
        actions.save(self.store, self.a, phase='waiting_followup', followup_at=time.time() - 1, attempt=1)
        def measure(store, task):
            actions.save(store, task['id'], phase='waiting_followup', followup_at=time.time() + 86400)
            return 'measured'
        with patch.object(team, 'flush'), patch('team_measure.execute', side_effect=measure) as execute:
            actions.run_one(self.store)
            actions.run_one(self.store)
        self.assertEqual(execute.call_count, 1)
        self.assertEqual(actions.state(self.store, self.a)['attempt'], 2)


if __name__ == '__main__':
    unittest.main()
