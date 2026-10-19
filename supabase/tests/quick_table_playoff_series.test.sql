-- Series A/B (nhánh Vàng/Bạc): một giải có 2 cây playoff song song. Vòng sau,
-- chung kết, vô địch và trạng thái completed phải tính riêng từng nhánh.

BEGIN;

SELECT plan(12);

SELECT has_column('public', 'quick_table_matches', 'playoff_division', 'matches have playoff_division');

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  'c5000001-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'series-owner@thepicklehub.test', '', now(),
  '{"provider":"test","providers":["test"]}'::jsonb, '{}'::jsonb, now(), now()
);

INSERT INTO public.quick_tables (
  id, creator_user_id, name, player_count, format, status, group_count, share_id
) VALUES (
  'c5500000-0000-4000-8000-000000000001', 'c5000001-0000-4000-8000-000000000001',
  'Series Quick', 8, 'round_robin', 'setup', 2, 'series-quick'
);

CREATE TEMP TABLE r (kind text PRIMARY KEY, result jsonb NOT NULL);
GRANT SELECT, INSERT ON r TO authenticated;
GRANT SELECT ON public.quick_tables, public.quick_table_players,
  public.quick_table_groups, public.quick_table_matches TO authenticated;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'c5000001-0000-4000-8000-000000000001', true);
INSERT INTO r SELECT 'setup', public.setup_quick_table_roster_atomic(
  'c5500000-0000-4000-8000-000000000001',
  (SELECT jsonb_agg(jsonb_build_object('name', 'P' || i) ORDER BY i) FROM generate_series(0, 7) AS g(i)),
  '[0,0,0,0,1,1,1,1]'::jsonb, '[]'::jsonb, NULL
)::jsonb;
RESET ROLE;
UPDATE public.quick_table_matches
SET score1 = 11, score2 = 5, winner_id = player1_id, status = 'completed'
WHERE table_id = 'c5500000-0000-4000-8000-000000000001' AND NOT is_playoff;

CREATE TEMP TABLE pid AS
SELECT name, id FROM public.quick_table_players WHERE table_id = 'c5500000-0000-4000-8000-000000000001';
GRANT SELECT ON pid TO authenticated;

-- A: P0,P1 (bảng A hạng 1–2) + P4,P5 (bảng B). B: P2,P3 + P6,P7.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'c5000001-0000-4000-8000-000000000001', true);
INSERT INTO r SELECT 'playoff', public.create_quick_table_playoff_atomic(
  'c5500000-0000-4000-8000-000000000001',
  (SELECT jsonb_agg(jsonb_build_object('player_id', id, 'playoff_seed', 1, 'is_wildcard', false,
     'division', CASE WHEN name IN ('P0','P1','P4','P5') THEN 0 ELSE 1 END)) FROM pid),
  jsonb_build_array(
    jsonb_build_object('player1_id', (SELECT id FROM pid WHERE name='P0'), 'player2_id', (SELECT id FROM pid WHERE name='P5'), 'bracket_position', 'upper', 'match_number', 1),
    jsonb_build_object('player1_id', (SELECT id FROM pid WHERE name='P4'), 'player2_id', (SELECT id FROM pid WHERE name='P1'), 'bracket_position', 'lower', 'match_number', 2),
    jsonb_build_object('player1_id', (SELECT id FROM pid WHERE name='P2'), 'player2_id', (SELECT id FROM pid WHERE name='P7'), 'bracket_position', 'upper', 'match_number', 1, 'division', 1),
    jsonb_build_object('player1_id', (SELECT id FROM pid WHERE name='P6'), 'player2_id', (SELECT id FROM pid WHERE name='P3'), 'bracket_position', 'lower', 'match_number', 2, 'division', 1)
  )
)::jsonb;
-- Một cầu thủ nhánh A đặt vào trận nhánh B → từ chối.
INSERT INTO r SELECT 'cross', public.create_quick_table_playoff_atomic(
  'c5500000-0000-4000-8000-000000000001',
  jsonb_build_array(
    jsonb_build_object('player_id', (SELECT id FROM pid WHERE name='P0'), 'playoff_seed', 1, 'is_wildcard', false),
    jsonb_build_object('player_id', (SELECT id FROM pid WHERE name='P2'), 'playoff_seed', 1, 'is_wildcard', false, 'division', 1)),
  jsonb_build_array(jsonb_build_object('player1_id', (SELECT id FROM pid WHERE name='P0'), 'player2_id', (SELECT id FROM pid WHERE name='P2'), 'match_number', 1, 'division', 1))
)::jsonb;
RESET ROLE;

SELECT is((SELECT result ->> 'success' FROM r WHERE kind = 'playoff'), 'true', 'two-series playoff is created');
SELECT is((SELECT count(*)::int FROM public.quick_table_matches WHERE table_id = 'c5500000-0000-4000-8000-000000000001' AND is_playoff AND playoff_division = 1),
  3, 'series B gets its own semis + final');
SELECT is((SELECT count(*)::int FROM public.quick_table_matches WHERE table_id = 'c5500000-0000-4000-8000-000000000001' AND is_playoff AND bracket_position = 'final'),
  2, 'each series has its own final');
SELECT ok((SELECT result ->> 'success' FROM r WHERE kind = 'cross') <> 'true' OR (SELECT result ->> 'idempotent' FROM r WHERE kind = 'cross') = 'true',
  'a second create call never adds or mixes brackets');

-- Chấm nhánh B trước: thắng bán kết B phải vào chung kết B, không lạc sang A.
CREATE TEMP TABLE m AS
SELECT id, playoff_division AS d, playoff_round AS rd, playoff_match_number AS n
FROM public.quick_table_matches WHERE table_id = 'c5500000-0000-4000-8000-000000000001' AND is_playoff;
GRANT SELECT ON m TO authenticated;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'c5000001-0000-4000-8000-000000000001', true);
SELECT public.score_quick_table_match_atomic(id, 11, 3, 0) FROM m WHERE d = 1 AND rd = (SELECT min(rd) FROM m WHERE d = 1) ORDER BY n;
RESET ROLE;

SELECT is((SELECT ARRAY[p1.name, p2.name] FROM public.quick_table_matches f
  JOIN public.quick_table_players p1 ON p1.id = f.player1_id
  JOIN public.quick_table_players p2 ON p2.id = f.player2_id
  WHERE f.table_id = 'c5500000-0000-4000-8000-000000000001' AND f.bracket_position = 'final' AND f.playoff_division = 1),
  ARRAY['P2', 'P6'], 'series B semi winners advance into the series B final');
SELECT is((SELECT player1_id FROM public.quick_table_matches
  WHERE table_id = 'c5500000-0000-4000-8000-000000000001' AND bracket_position = 'final' AND playoff_division = 0),
  NULL::uuid, 'series A final is untouched by series B results');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'c5000001-0000-4000-8000-000000000001', true);
SELECT public.score_quick_table_match_atomic(id, 11, 9, 0) FROM m WHERE d = 1 AND rd = (SELECT max(rd) FROM m WHERE d = 1);
RESET ROLE;

SELECT is((SELECT status::text FROM public.quick_tables WHERE id = 'c5500000-0000-4000-8000-000000000001'),
  'playoff', 'finishing series B alone does not complete the tournament');
SELECT is((SELECT champion_player_id FROM public.quick_tables WHERE id = 'c5500000-0000-4000-8000-000000000001'),
  NULL::uuid, 'series B winner is not the tournament champion');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'c5000001-0000-4000-8000-000000000001', true);
SELECT public.score_quick_table_match_atomic(id, 11, 3, 0) FROM m WHERE d = 0 AND rd = (SELECT min(rd) FROM m WHERE d = 0) ORDER BY n;
SELECT public.score_quick_table_match_atomic(id, 11, 9, 0) FROM m WHERE d = 0 AND rd = (SELECT max(rd) FROM m WHERE d = 0);
RESET ROLE;

SELECT is((SELECT champion_name FROM public.quick_tables WHERE id = 'c5500000-0000-4000-8000-000000000001'),
  'P0', 'series A final decides the champion');
SELECT is((SELECT status::text FROM public.quick_tables WHERE id = 'c5500000-0000-4000-8000-000000000001'),
  'completed', 'tournament completes once every series final is done');

-- Đổi chỗ giữa 2 nhánh bị chặn (cần giải đang playoff → dựng lại trạng thái).
UPDATE public.quick_tables SET status = 'playoff' WHERE id = 'c5500000-0000-4000-8000-000000000001';
UPDATE public.quick_table_matches SET status = 'pending', score1 = NULL, score2 = NULL, winner_id = NULL
WHERE id IN (SELECT id FROM m WHERE rd = (SELECT min(rd) FROM m) AND n IN (1, 4));
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'c5000001-0000-4000-8000-000000000001', true);
SELECT is(public.swap_quick_table_playoff_players('c5500000-0000-4000-8000-000000000001',
    (SELECT id FROM m WHERE n = 1), 2, (SELECT id FROM m WHERE n = 4), 2) ->> 'error',
  'DIFFERENT_DIVISION', 'players cannot be swapped across series');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
