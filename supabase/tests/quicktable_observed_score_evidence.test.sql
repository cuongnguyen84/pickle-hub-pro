BEGIN;
SELECT plan(12);
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  'd4000001-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'evidence-owner@thepicklehub.test', '', now(),
  '{"provider":"test","providers":["test"]}'::jsonb, '{}'::jsonb, now(), now()
);

INSERT INTO public.quick_tables (
  id, creator_user_id, name, player_count, format, status, share_id
) VALUES (
  'd4400000-0000-4000-8000-000000000001',
  'd4000001-0000-4000-8000-000000000001',
  'Champion Quick', 4, 'round_robin', 'playoff', 'evidence-quick'
);

INSERT INTO public.quick_table_players (id, table_id, group_id, name, display_order) VALUES
  ('d4420001-0000-4000-8000-000000000001', 'd4400000-0000-4000-8000-000000000001', NULL, 'Cường & Nam', 0),
  ('d4420002-0000-4000-8000-000000000002', 'd4400000-0000-4000-8000-000000000001', NULL, 'Hùng & Tuấn', 1);

-- Single final: round 1, one match, no next round.
INSERT INTO public.quick_table_matches (
  id, table_id, group_id, is_playoff, playoff_round, playoff_match_number,
  player1_id, player2_id, display_order, status
) VALUES (
  'd4430001-0000-4000-8000-000000000001', 'd4400000-0000-4000-8000-000000000001',
  NULL, true, 1, 1,
  'd4420001-0000-4000-8000-000000000001', 'd4420002-0000-4000-8000-000000000002', 0, 'pending'
);


SELECT is((SELECT count(*) FROM public.quick_table_score_evidence),0::bigint,'no evidence for pending fixtures');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','d4000001-0000-4000-8000-000000000001',true);
SELECT is(public.score_quick_table_match_atomic('d4430001-0000-4000-8000-000000000001',11,7,0)->>'success','true','committed score succeeds');
RESET ROLE;
CREATE TEMP TABLE evidence_expected AS SELECT * FROM public.quick_table_score_evidence;
SELECT is((SELECT count(*) FROM evidence_expected),1::bigint,'one evidence row');
SELECT ok((SELECT observed_at >= transaction_timestamp() FROM evidence_expected),'server observed time');
SET LOCAL ROLE authenticated;
SELECT is(public.score_quick_table_match_atomic('d4430001-0000-4000-8000-000000000001',11,7,1)->>'success','true','exact retry succeeds');
SELECT is(public.score_quick_table_match_atomic('d4430001-0000-4000-8000-000000000001',11,7,0)->>'error','VERSION_CONFLICT','stale retry fails');
RESET ROLE;
SELECT is((SELECT receipt_id FROM public.quick_table_score_evidence),(SELECT receipt_id FROM evidence_expected),'retry preserves receipt');
SELECT ok(NOT has_any_column_privilege('authenticated','public.quick_table_score_evidence','SELECT'),'no browser receipt reads');
SELECT ok(NOT has_table_privilege('authenticated','public.quick_table_score_evidence','INSERT'),'no client forged evidence');
SAVEPOINT evidence_rollback;
DELETE FROM public.quick_table_score_evidence;
UPDATE public.quick_table_matches SET score1=7,score2=11 WHERE id='d4430001-0000-4000-8000-000000000001';
ROLLBACK TO evidence_rollback;
SELECT is((SELECT receipt_id FROM public.quick_table_score_evidence),(SELECT receipt_id FROM evidence_expected),'rollback restores original receipt atomically');
SAVEPOINT evidence_failed_score;
DELETE FROM public.quick_table_score_evidence;
SET LOCAL ROLE authenticated;
SELECT is(public.score_quick_table_match_atomic('d4430001-0000-4000-8000-000000000001',5,5,1)->>'error','INVALID_SCORE','invalid score is rejected');
RESET ROLE;
SELECT is((SELECT count(*) FROM public.quick_table_score_evidence),0::bigint,'failed RPC creates no evidence');
ROLLBACK TO evidence_failed_score;
SELECT * FROM finish();
ROLLBACK;
