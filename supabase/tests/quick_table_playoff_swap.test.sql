-- swap_quick_table_playoff_players: owner swaps two players between unscored
-- first-round playoff matches; everything else is rejected.

BEGIN;

SELECT plan(9);

SELECT ok(has_function_privilege('authenticated',
  'public.swap_quick_table_playoff_players(uuid,uuid,integer,uuid,integer)', 'EXECUTE'),
  'authenticated may call playoff swap');
SELECT ok(NOT has_function_privilege('anon',
  'public.swap_quick_table_playoff_players(uuid,uuid,integer,uuid,integer)', 'EXECUTE'),
  'anon may not call playoff swap');

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('a8000001-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'qt-swap-owner@thepicklehub.test', '', now(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('a8000002-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'qt-swap-other@thepicklehub.test', '', now(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{}'::jsonb, now(), now());

INSERT INTO public.quick_tables (id, creator_user_id, name, player_count, format, status, group_count, share_id)
VALUES ('a8000010-0000-4000-8000-000000000010', 'a8000001-0000-4000-8000-000000000001',
        'QT Swap', 8, 'round_robin', 'playoff', 2, 'qtswaptest');

INSERT INTO public.quick_table_players (id, table_id, name) VALUES
  ('a8000101-0000-4000-8000-000000000101', 'a8000010-0000-4000-8000-000000000010', 'P1'),
  ('a8000102-0000-4000-8000-000000000102', 'a8000010-0000-4000-8000-000000000010', 'P2'),
  ('a8000103-0000-4000-8000-000000000103', 'a8000010-0000-4000-8000-000000000010', 'P3'),
  ('a8000104-0000-4000-8000-000000000104', 'a8000010-0000-4000-8000-000000000010', 'P4'),
  ('a8000105-0000-4000-8000-000000000105', 'a8000010-0000-4000-8000-000000000010', 'P5'),
  ('a8000106-0000-4000-8000-000000000106', 'a8000010-0000-4000-8000-000000000010', 'P6');

-- R1: M1 pending, M2 pending, M3 already scored; R2: M4 pending
INSERT INTO public.quick_table_matches
  (id, table_id, is_playoff, playoff_round, playoff_match_number, player1_id, player2_id, status, score1, score2, winner_id)
VALUES
  ('a8000201-0000-4000-8000-000000000201', 'a8000010-0000-4000-8000-000000000010', true, 1, 1,
   'a8000101-0000-4000-8000-000000000101', 'a8000102-0000-4000-8000-000000000102', 'pending', NULL, NULL, NULL),
  ('a8000202-0000-4000-8000-000000000202', 'a8000010-0000-4000-8000-000000000010', true, 1, 2,
   'a8000103-0000-4000-8000-000000000103', 'a8000104-0000-4000-8000-000000000104', 'pending', NULL, NULL, NULL),
  ('a8000203-0000-4000-8000-000000000203', 'a8000010-0000-4000-8000-000000000010', true, 1, 3,
   'a8000105-0000-4000-8000-000000000105', 'a8000106-0000-4000-8000-000000000106', 'completed', 11, 5,
   'a8000105-0000-4000-8000-000000000105'),
  ('a8000204-0000-4000-8000-000000000204', 'a8000010-0000-4000-8000-000000000010', true, 2, 4,
   'a8000105-0000-4000-8000-000000000105', NULL, 'pending', NULL, NULL, NULL);

CREATE TEMP TABLE qt_swap_results (kind text PRIMARY KEY, result jsonb NOT NULL);
GRANT SELECT, INSERT ON qt_swap_results TO authenticated;
GRANT SELECT ON public.quick_table_matches TO authenticated;

-- Non-owner is rejected.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a8000002-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"a8000002-0000-4000-8000-000000000002","role":"authenticated"}', true);
INSERT INTO qt_swap_results VALUES ('other', public.swap_quick_table_playoff_players(
  'a8000010-0000-4000-8000-000000000010',
  'a8000201-0000-4000-8000-000000000201', 2,
  'a8000202-0000-4000-8000-000000000202', 2)::jsonb);
RESET ROLE;
SELECT is((SELECT result->>'error' FROM qt_swap_results WHERE kind = 'other'),
  'NOT_AUTHORIZED', 'non-owner cannot swap');

-- Owner: scored match, next round, same match rejected; pending R1 pair swapped.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a8000001-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"a8000001-0000-4000-8000-000000000001","role":"authenticated"}', true);
INSERT INTO qt_swap_results VALUES
  ('scored', public.swap_quick_table_playoff_players(
    'a8000010-0000-4000-8000-000000000010',
    'a8000201-0000-4000-8000-000000000201', 2,
    'a8000203-0000-4000-8000-000000000203', 2)::jsonb),
  ('round2', public.swap_quick_table_playoff_players(
    'a8000010-0000-4000-8000-000000000010',
    'a8000201-0000-4000-8000-000000000201', 2,
    'a8000204-0000-4000-8000-000000000204', 1)::jsonb),
  ('same', public.swap_quick_table_playoff_players(
    'a8000010-0000-4000-8000-000000000010',
    'a8000201-0000-4000-8000-000000000201', 1,
    'a8000201-0000-4000-8000-000000000201', 2)::jsonb),
  ('ok', public.swap_quick_table_playoff_players(
    'a8000010-0000-4000-8000-000000000010',
    'a8000201-0000-4000-8000-000000000201', 2,
    'a8000202-0000-4000-8000-000000000202', 1)::jsonb);
RESET ROLE;

SELECT is((SELECT result->>'error' FROM qt_swap_results WHERE kind = 'scored'),
  'MATCH_ALREADY_SCORED', 'scored match rejected');
SELECT is((SELECT result->>'error' FROM qt_swap_results WHERE kind = 'round2'),
  'NOT_FIRST_ROUND', 'later round rejected');
SELECT is((SELECT result->>'error' FROM qt_swap_results WHERE kind = 'same'),
  'SAME_MATCH', 'same match rejected');
SELECT is((SELECT (result->>'success')::boolean FROM qt_swap_results WHERE kind = 'ok'),
  true, 'owner swap succeeds');
SELECT is((SELECT player2_id FROM public.quick_table_matches WHERE id = 'a8000201-0000-4000-8000-000000000201'),
  'a8000103-0000-4000-8000-000000000103'::uuid, 'M1 slot 2 now holds P3');
SELECT is((SELECT player1_id FROM public.quick_table_matches WHERE id = 'a8000202-0000-4000-8000-000000000202'),
  'a8000102-0000-4000-8000-000000000102'::uuid, 'M2 slot 1 now holds P2');

SELECT * FROM finish();
ROLLBACK;
