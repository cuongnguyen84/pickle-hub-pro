-- Huỷ playoff chọn nhầm → về vòng bảng; chỉ chủ giải, chỉ khi chưa nhập điểm playoff.

BEGIN;

SELECT plan(8);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('c6000001-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'cancel-owner@thepicklehub.test', '', now(), '{"provider":"test","providers":["test"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('c6000002-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'cancel-other@thepicklehub.test', '', now(), '{"provider":"test","providers":["test"]}'::jsonb, '{}'::jsonb, now(), now());

INSERT INTO public.quick_tables (id, creator_user_id, name, player_count, format, status, group_count, share_id)
VALUES ('c6600000-0000-4000-8000-000000000001', 'c6000001-0000-4000-8000-000000000001',
        'Cancel Quick', 8, 'round_robin', 'setup', 2, 'cancel-quick');

CREATE TEMP TABLE r (kind text PRIMARY KEY, result jsonb NOT NULL);
GRANT SELECT, INSERT ON r TO authenticated;
GRANT SELECT ON public.quick_tables, public.quick_table_players, public.quick_table_groups, public.quick_table_matches TO authenticated;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'c6000001-0000-4000-8000-000000000001', true);
INSERT INTO r SELECT 'setup', public.setup_quick_table_roster_atomic(
  'c6600000-0000-4000-8000-000000000001',
  (SELECT jsonb_agg(jsonb_build_object('name', 'P' || i) ORDER BY i) FROM generate_series(0, 7) AS g(i)),
  '[0,0,0,0,1,1,1,1]'::jsonb, '[]'::jsonb, NULL
)::jsonb;
RESET ROLE;
UPDATE public.quick_table_matches
SET score1 = 11, score2 = 5, winner_id = player1_id, status = 'completed'
WHERE table_id = 'c6600000-0000-4000-8000-000000000001' AND NOT is_playoff;

CREATE TEMP TABLE pid AS
SELECT name, id FROM public.quick_table_players WHERE table_id = 'c6600000-0000-4000-8000-000000000001';
GRANT SELECT ON pid TO authenticated;

CREATE TEMP TABLE payload AS SELECT
  (SELECT jsonb_agg(jsonb_build_object('player_id', id, 'playoff_seed', 1, 'is_wildcard', false)) FROM pid WHERE name IN ('P0','P1','P4','P5')) AS q,
  jsonb_build_array(
    jsonb_build_object('player1_id', (SELECT id FROM pid WHERE name='P0'), 'player2_id', (SELECT id FROM pid WHERE name='P5'), 'bracket_position', 'upper', 'match_number', 1),
    jsonb_build_object('player1_id', (SELECT id FROM pid WHERE name='P4'), 'player2_id', (SELECT id FROM pid WHERE name='P1'), 'bracket_position', 'lower', 'match_number', 2)
  ) AS f;
GRANT SELECT ON payload TO authenticated;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'c6000001-0000-4000-8000-000000000001', true);
INSERT INTO r SELECT 'create1', public.create_quick_table_playoff_atomic('c6600000-0000-4000-8000-000000000001', q, f)::jsonb FROM payload;
SELECT set_config('request.jwt.claim.sub', 'c6000002-0000-4000-8000-000000000002', true);
INSERT INTO r SELECT 'other', public.cancel_quick_table_playoff('c6600000-0000-4000-8000-000000000001')::jsonb;
SELECT set_config('request.jwt.claim.sub', 'c6000001-0000-4000-8000-000000000001', true);
INSERT INTO r SELECT 'cancel', public.cancel_quick_table_playoff('c6600000-0000-4000-8000-000000000001')::jsonb;
RESET ROLE;

SELECT is((SELECT result ->> 'error' FROM r WHERE kind = 'other'), 'NOT_AUTHORIZED', 'only the owner can cancel');
SELECT is((SELECT (result ->> 'success')::boolean FROM r WHERE kind = 'cancel'), true, 'owner cancels an unplayed playoff');
SELECT is((SELECT status::text FROM public.quick_tables WHERE id = 'c6600000-0000-4000-8000-000000000001'), 'group_stage', 'back to the group stage');
SELECT is((SELECT count(*)::int FROM public.quick_table_matches WHERE table_id = 'c6600000-0000-4000-8000-000000000001' AND is_playoff), 0, 'playoff matches removed');
SELECT is((SELECT count(*)::int FROM public.quick_table_matches WHERE table_id = 'c6600000-0000-4000-8000-000000000001' AND NOT is_playoff AND status = 'completed'), 12, 'group results kept');
SELECT is((SELECT count(*)::int FROM public.quick_table_players WHERE table_id = 'c6600000-0000-4000-8000-000000000001' AND (is_qualified OR playoff_seed IS NOT NULL)), 0, 'qualifier flags cleared');

-- tạo lại được; nhập điểm 1 trận playoff thì không huỷ được nữa
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'c6000001-0000-4000-8000-000000000001', true);
INSERT INTO r SELECT 'create2', public.create_quick_table_playoff_atomic('c6600000-0000-4000-8000-000000000001', q, f)::jsonb FROM payload;
RESET ROLE;
UPDATE public.quick_table_matches SET score1 = 11, score2 = 3
WHERE table_id = 'c6600000-0000-4000-8000-000000000001' AND is_playoff AND playoff_match_number = 1;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'c6000001-0000-4000-8000-000000000001', true);
INSERT INTO r SELECT 'late', public.cancel_quick_table_playoff('c6600000-0000-4000-8000-000000000001')::jsonb;
RESET ROLE;

SELECT is((SELECT (result ->> 'success')::boolean FROM r WHERE kind = 'create2'), true, 'playoff can be recreated after cancel');
SELECT is((SELECT result ->> 'error' FROM r WHERE kind = 'late'), 'PLAYOFF_STARTED', 'no cancel once a playoff score exists');

SELECT * FROM finish();
ROLLBACK;
