-- champion-on-event-card G1: champion denormalized on quick_tables must be
-- written by the score RPC when the deciding final completes, must follow a
-- final-score correction, and must stay NULL when no unique final exists.

BEGIN;

SELECT plan(8);

SELECT has_column('public', 'quick_tables', 'champion_player_id', 'quick_tables has champion_player_id');
SELECT has_column('public', 'quick_tables', 'champion_name', 'quick_tables has champion_name');

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  'c4000001-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'champion-owner@thepicklehub.test', '', now(),
  '{"provider":"test","providers":["test"]}'::jsonb, '{}'::jsonb, now(), now()
);

INSERT INTO public.quick_tables (
  id, creator_user_id, name, player_count, format, status, share_id
) VALUES (
  'c4400000-0000-4000-8000-000000000001',
  'c4000001-0000-4000-8000-000000000001',
  'Champion Quick', 4, 'round_robin', 'playoff', 'champion-quick'
);

INSERT INTO public.quick_table_players (id, table_id, group_id, name, display_order) VALUES
  ('c4420001-0000-4000-8000-000000000001', 'c4400000-0000-4000-8000-000000000001', NULL, 'Cường & Nam', 0),
  ('c4420002-0000-4000-8000-000000000002', 'c4400000-0000-4000-8000-000000000001', NULL, 'Hùng & Tuấn', 1);

-- Single final: round 1, one match, no next round.
INSERT INTO public.quick_table_matches (
  id, table_id, group_id, is_playoff, playoff_round, playoff_match_number,
  player1_id, player2_id, display_order, status
) VALUES (
  'c4430001-0000-4000-8000-000000000001', 'c4400000-0000-4000-8000-000000000001',
  NULL, true, 1, 1,
  'c4420001-0000-4000-8000-000000000001', 'c4420002-0000-4000-8000-000000000002', 0, 'pending'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'c4000001-0000-4000-8000-000000000001', true);
SELECT is(
  public.score_quick_table_match_atomic('c4430001-0000-4000-8000-000000000001', 11, 7, 0) ->> 'success',
  'true', 'scoring the deciding final succeeds'
);
RESET ROLE;

SELECT is((SELECT champion_player_id FROM public.quick_tables WHERE id = 'c4400000-0000-4000-8000-000000000001'),
  'c4420001-0000-4000-8000-000000000001'::uuid,
  'champion_player_id written when the final completes');
SELECT is((SELECT champion_name FROM public.quick_tables WHERE id = 'c4400000-0000-4000-8000-000000000001'),
  'Cường & Nam',
  'champion_name snapshots the player name');

-- Correction: re-score the final, champion must follow.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'c4000001-0000-4000-8000-000000000001', true);
SELECT is(
  public.score_quick_table_match_atomic('c4430001-0000-4000-8000-000000000001', 7, 11, 1) ->> 'success',
  'true', 'final-score correction succeeds'
);
RESET ROLE;

SELECT is((SELECT champion_name FROM public.quick_tables WHERE id = 'c4400000-0000-4000-8000-000000000001'),
  'Hùng & Tuấn',
  'champion follows a final-score correction');

-- No unique final => champion stays NULL: completed table without playoff.
INSERT INTO public.quick_tables (
  id, creator_user_id, name, player_count, format, status, share_id
) VALUES (
  'c4400000-0000-4000-8000-000000000002',
  'c4000001-0000-4000-8000-000000000001',
  'Groups Only', 4, 'round_robin', 'completed', 'champion-groups-only'
);
SELECT is((SELECT champion_player_id FROM public.quick_tables WHERE id = 'c4400000-0000-4000-8000-000000000002'),
  NULL::uuid,
  'completed table without a playoff final keeps champion NULL');

SELECT * FROM finish();
ROLLBACK;
