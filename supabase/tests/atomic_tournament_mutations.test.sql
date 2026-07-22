-- Task 4 regression: transactional Flex scoring, atomic DE registration close,
-- and correction-safe DE/QuickTable scoring.

BEGIN;

SELECT plan(51);

-- ─── Contract / grants ───────────────────────────────────────────────────

SELECT has_function('public', 'score_flex_match_atomic',
  ARRAY['uuid', 'integer', 'integer', 'bigint'], 'Flex atomic score RPC exists');
SELECT has_function('public', 'close_doubles_elimination_registration',
  ARRAY['uuid', 'text'], 'DE atomic close RPC exists');
SELECT has_function('public', 'score_doubles_elimination_match_atomic',
  ARRAY['uuid', 'integer', 'integer', 'jsonb', 'bigint'], 'DE atomic score RPC exists');
SELECT has_function('public', 'score_quick_table_match_atomic',
  ARRAY['uuid', 'integer', 'integer', 'bigint'], 'QuickTable atomic score RPC exists');

SELECT ok(has_function_privilege('authenticated',
  'public.score_flex_match_atomic(uuid, integer, integer, bigint)', 'EXECUTE'),
  'authenticated may score Flex');
SELECT ok(NOT has_function_privilege('anon',
  'public.score_flex_match_atomic(uuid, integer, integer, bigint)', 'EXECUTE'),
  'anon may not score Flex');
SELECT ok(has_function_privilege('authenticated',
  'public.score_doubles_elimination_match_atomic(uuid, integer, integer, jsonb, bigint)', 'EXECUTE'),
  'authenticated may score DE');
SELECT ok(NOT has_function_privilege('anon',
  'public.score_doubles_elimination_match_atomic(uuid, integer, integer, jsonb, bigint)', 'EXECUTE'),
  'anon may not score DE');
SELECT ok(has_function_privilege('authenticated',
  'public.score_quick_table_match_atomic(uuid, integer, integer, bigint)', 'EXECUTE'),
  'authenticated may score QuickTable');
SELECT ok(NOT has_function_privilege('anon',
  'public.score_quick_table_match_atomic(uuid, integer, integer, bigint)', 'EXECUTE'),
  'anon may not score QuickTable');

SELECT has_column('public', 'flex_matches', 'score_version', 'Flex has score_version');
SELECT has_column('public', 'doubles_elimination_matches', 'score_version', 'DE has score_version');
SELECT has_column('public', 'quick_table_matches', 'score_version', 'QuickTable has score_version');
SELECT has_column('public', 'doubles_elimination_matches', 'generation_key', 'DE has generation_key');

-- ─── Users ───────────────────────────────────────────────────────────────

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    'a4000001-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'task4-owner@thepicklehub.test', '', now(),
    '{"provider":"test","providers":["test"]}'::jsonb,
    '{"display_name":"Task 4 Owner"}'::jsonb, now(), now()
  ),
  (
    'a4000002-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'task4-other@thepicklehub.test', '', now(),
    '{"provider":"test","providers":["test"]}'::jsonb,
    '{"display_name":"Task 4 Other"}'::jsonb, now(), now()
  );

-- ─── Flex: score + standings are one mutation ────────────────────────────

INSERT INTO public.flex_tournaments (id, creator_user_id, name, share_id, is_public)
VALUES (
  'a4100000-0000-4000-8000-000000000001',
  'a4000001-0000-4000-8000-000000000001',
  'Task 4 Flex', 'task4-flex', true
);

INSERT INTO public.flex_groups (id, tournament_id, name, display_order)
VALUES (
  'a4110000-0000-4000-8000-000000000001',
  'a4100000-0000-4000-8000-000000000001', 'A', 0
);

INSERT INTO public.flex_players (id, tournament_id, name, display_order) VALUES
  ('a4120001-0000-4000-8000-000000000001', 'a4100000-0000-4000-8000-000000000001', 'A1', 0),
  ('a4120002-0000-4000-8000-000000000002', 'a4100000-0000-4000-8000-000000000001', 'A2', 1),
  ('a4120003-0000-4000-8000-000000000003', 'a4100000-0000-4000-8000-000000000001', 'B1', 2),
  ('a4120004-0000-4000-8000-000000000004', 'a4100000-0000-4000-8000-000000000001', 'B2', 3);

INSERT INTO public.flex_group_items (group_id, item_type, player_id, display_order) VALUES
  ('a4110000-0000-4000-8000-000000000001', 'player', 'a4120001-0000-4000-8000-000000000001', 0),
  ('a4110000-0000-4000-8000-000000000001', 'player', 'a4120002-0000-4000-8000-000000000002', 1),
  ('a4110000-0000-4000-8000-000000000001', 'player', 'a4120003-0000-4000-8000-000000000003', 2),
  ('a4110000-0000-4000-8000-000000000001', 'player', 'a4120004-0000-4000-8000-000000000004', 3);

INSERT INTO public.flex_matches (
  id, tournament_id, group_id, name, match_type,
  slot_a1_player_id, slot_a2_player_id, slot_b1_player_id, slot_b2_player_id
) VALUES (
  'a4130000-0000-4000-8000-000000000001',
  'a4100000-0000-4000-8000-000000000001',
  'a4110000-0000-4000-8000-000000000001',
  'Doubles 1', 'doubles',
  'a4120001-0000-4000-8000-000000000001',
  'a4120002-0000-4000-8000-000000000002',
  'a4120003-0000-4000-8000-000000000003',
  'a4120004-0000-4000-8000-000000000004'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a4000001-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"a4000001-0000-4000-8000-000000000001","role":"authenticated"}', true);

SELECT is(
  public.score_flex_match_atomic('a4130000-0000-4000-8000-000000000001', 11, 5, 0) ->> 'success',
  'true', 'Flex atomic score succeeds'
);

RESET ROLE;

SELECT is((SELECT score_version FROM public.flex_matches
  WHERE id = 'a4130000-0000-4000-8000-000000000001'), 1::bigint,
  'Flex score version increments');
SELECT is((SELECT wins || ':' || point_diff FROM public.flex_player_stats
  WHERE group_id = 'a4110000-0000-4000-8000-000000000001'
    AND player_id = 'a4120001-0000-4000-8000-000000000001'), '1:6',
  'Flex winner stat is rebuilt from committed score');
SELECT is((SELECT losses || ':' || point_diff FROM public.flex_player_stats
  WHERE group_id = 'a4110000-0000-4000-8000-000000000001'
    AND player_id = 'a4120003-0000-4000-8000-000000000003'), '1:-6',
  'Flex loser stat is rebuilt from committed score');
SELECT is((SELECT count(*)::integer FROM public.flex_pair_stats
  WHERE group_id = 'a4110000-0000-4000-8000-000000000001'), 2,
  'Flex pair standings are rebuilt in the same mutation');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a4000001-0000-4000-8000-000000000001', true);
SELECT is(
  public.score_flex_match_atomic('a4130000-0000-4000-8000-000000000001', 5, 11, 0) ->> 'error',
  'VERSION_CONFLICT', 'stale Flex referee is rejected'
);
RESET ROLE;
SELECT is((SELECT score_a FROM public.flex_matches
  WHERE id = 'a4130000-0000-4000-8000-000000000001'), 11,
  'stale Flex write changes nothing');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a4000002-0000-4000-8000-000000000002', true);
SELECT is(
  public.score_flex_match_atomic('a4130000-0000-4000-8000-000000000001', 5, 11, 1) ->> 'error',
  'NOT_AUTHORIZED', 'non-referee cannot score Flex'
);
RESET ROLE;

-- ─── DE close: seeds + all preliminary rows + status atomically ──────────

INSERT INTO public.doubles_elimination_tournaments (
  id, name, share_id, creator_user_id, team_count, status,
  early_rounds_format, finals_format, court_count, start_time
) VALUES
  (
    'a4200000-0000-4000-8000-000000000001', 'Task 4 DE Close', 'task4-de-close',
    'a4000001-0000-4000-8000-000000000001', 40, 'registration_open',
    'bo1', 'bo3', 4, '08:00'
  ),
  (
    'a4200000-0000-4000-8000-000000000002', 'Task 4 DE Not Full', 'task4-de-not-full',
    'a4000001-0000-4000-8000-000000000001', 40, 'registration_open',
    'bo1', 'bo3', 2, '09:00'
  );

INSERT INTO public.doubles_elimination_teams (
  tournament_id, team_name, player1_name, dupr_avg_rating
)
SELECT
  'a4200000-0000-4000-8000-000000000001',
  'Close Team ' || lpad(i::text, 2, '0'),
  'Player ' || i,
  (3 + i / 100.0)::numeric(3, 2)
FROM generate_series(1, 40) AS s(i);

INSERT INTO public.doubles_elimination_teams (
  tournament_id, team_name, player1_name
)
SELECT
  'a4200000-0000-4000-8000-000000000002',
  'Short Team ' || lpad(i::text, 2, '0'),
  'Player ' || i
FROM generate_series(1, 39) AS s(i);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a4000001-0000-4000-8000-000000000001', true);
SELECT is(
  public.close_doubles_elimination_registration('a4200000-0000-4000-8000-000000000001') ->> 'success',
  'true', 'full DE registration closes atomically'
);
RESET ROLE;

SELECT is((SELECT status FROM public.doubles_elimination_tournaments
  WHERE id = 'a4200000-0000-4000-8000-000000000001'), 'ongoing',
  'DE status flips only with committed bracket');
SELECT is((SELECT count(*)::integer FROM public.doubles_elimination_matches
  WHERE tournament_id = 'a4200000-0000-4000-8000-000000000001'), 44,
  '40 teams generate the complete 44-node preliminary graph');
SELECT is((SELECT count(*)::integer FROM public.doubles_elimination_matches
  WHERE tournament_id = 'a4200000-0000-4000-8000-000000000001' AND round_number = 1), 20,
  'DE close generates 20 R1 nodes');
SELECT is((SELECT count(*)::integer FROM public.doubles_elimination_matches
  WHERE tournament_id = 'a4200000-0000-4000-8000-000000000001' AND round_number = 2), 10,
  'DE close generates 10 R2 nodes');
SELECT is((SELECT count(*)::integer FROM public.doubles_elimination_matches
  WHERE tournament_id = 'a4200000-0000-4000-8000-000000000001' AND round_number = 3), 14,
  'DE close generates 14 R3 nodes');
SELECT is((SELECT count(DISTINCT generation_key)::integer FROM public.doubles_elimination_matches
  WHERE tournament_id = 'a4200000-0000-4000-8000-000000000001'), 44,
  'every server-generated DE node has a unique idempotency key');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a4000001-0000-4000-8000-000000000001', true);
SELECT is(
  public.close_doubles_elimination_registration('a4200000-0000-4000-8000-000000000001') ->> 'idempotent',
  'true', 'retrying DE close reports the committed graph'
);
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.doubles_elimination_matches
  WHERE tournament_id = 'a4200000-0000-4000-8000-000000000001'), 44,
  'retrying DE close creates no duplicate rows');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a4000001-0000-4000-8000-000000000001', true);
SELECT is(
  public.close_doubles_elimination_registration('a4200000-0000-4000-8000-000000000002') ->> 'error',
  'NOT_FULL', 'under-capacity DE close is rejected'
);
RESET ROLE;
SELECT is((SELECT status FROM public.doubles_elimination_tournaments
  WHERE id = 'a4200000-0000-4000-8000-000000000002'), 'registration_open',
  'failed DE close preserves registration status');
SELECT is((SELECT count(*)::integer FROM public.doubles_elimination_matches
  WHERE tournament_id = 'a4200000-0000-4000-8000-000000000002'), 0,
  'failed DE close leaves no partial bracket');

-- ─── DE score correction: replace only an unplayed dependency ───────────

INSERT INTO public.doubles_elimination_tournaments (
  id, name, share_id, creator_user_id, team_count, status,
  early_rounds_format, finals_format
) VALUES (
  'a4300000-0000-4000-8000-000000000001', 'Task 4 DE Score', 'task4-de-score',
  'a4000001-0000-4000-8000-000000000001', 40, 'ongoing', 'bo1', 'bo3'
);

INSERT INTO public.doubles_elimination_teams (id, tournament_id, team_name, player1_name) VALUES
  ('a4310001-0000-4000-8000-000000000001', 'a4300000-0000-4000-8000-000000000001', 'A', 'A'),
  ('a4310002-0000-4000-8000-000000000002', 'a4300000-0000-4000-8000-000000000001', 'B', 'B'),
  ('a4310003-0000-4000-8000-000000000003', 'a4300000-0000-4000-8000-000000000001', 'C', 'C'),
  ('a4310004-0000-4000-8000-000000000004', 'a4300000-0000-4000-8000-000000000001', 'D', 'D');

INSERT INTO public.doubles_elimination_matches (
  id, tournament_id, round_number, round_type, bracket_type, match_number,
  team_a_id, team_b_id, best_of, source_a, source_b, display_order, status
) VALUES
  (
    'a4320001-0000-4000-8000-000000000001', 'a4300000-0000-4000-8000-000000000001',
    1, 'winner_r1', 'winner', 1,
    'a4310001-0000-4000-8000-000000000001', 'a4310002-0000-4000-8000-000000000002', 1,
    '{"type":"team"}', '{"type":"team"}', 0, 'pending'
  ),
  (
    'a4320002-0000-4000-8000-000000000002', 'a4300000-0000-4000-8000-000000000001',
    1, 'winner_r1', 'winner', 2,
    'a4310003-0000-4000-8000-000000000003', 'a4310004-0000-4000-8000-000000000004', 1,
    '{"type":"team"}', '{"type":"team"}', 1, 'pending'
  ),
  (
    'a4320003-0000-4000-8000-000000000003', 'a4300000-0000-4000-8000-000000000001',
    2, 'loser_r2', 'loser', 1, NULL, NULL, 1,
    '{"type":"loser_of","round":1,"match_index":0}',
    '{"type":"loser_of","round":1,"match_index":1}', 2, 'pending'
  );

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a4000001-0000-4000-8000-000000000001', true);
SELECT is(
  public.score_doubles_elimination_match_atomic(
    'a4320001-0000-4000-8000-000000000001', 11, 5, '[]'::jsonb, 0
  ) ->> 'success', 'true', 'initial DE score succeeds'
);
RESET ROLE;
SELECT is((SELECT winner_id FROM public.doubles_elimination_matches
  WHERE id = 'a4320001-0000-4000-8000-000000000001'),
  'a4310001-0000-4000-8000-000000000001'::uuid, 'DE winner is stored');
SELECT is((SELECT team_a_id FROM public.doubles_elimination_matches
  WHERE id = 'a4320003-0000-4000-8000-000000000003'),
  'a4310002-0000-4000-8000-000000000002'::uuid, 'R1 loser advances to R2');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a4000001-0000-4000-8000-000000000001', true);
SELECT is(
  public.score_doubles_elimination_match_atomic(
    'a4320001-0000-4000-8000-000000000001', 5, 11, '[]'::jsonb, 1
  ) ->> 'success', 'true', 'DE winner correction succeeds before downstream starts'
);
RESET ROLE;
SELECT is((SELECT team_a_id FROM public.doubles_elimination_matches
  WHERE id = 'a4320003-0000-4000-8000-000000000003'),
  'a4310001-0000-4000-8000-000000000001'::uuid,
  'DE correction replaces the old loser in unplayed R2');

UPDATE public.doubles_elimination_matches
SET team_b_id = 'a4310004-0000-4000-8000-000000000004',
    score_a = 1, status = 'live'
WHERE id = 'a4320003-0000-4000-8000-000000000003';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a4000001-0000-4000-8000-000000000001', true);
SELECT is(
  public.score_doubles_elimination_match_atomic(
    'a4320001-0000-4000-8000-000000000001', 11, 5, '[]'::jsonb, 2
  ) ->> 'error', 'DOWNSTREAM_LOCKED',
  'DE correction is rejected after downstream starts'
);
RESET ROLE;
SELECT is((SELECT winner_id FROM public.doubles_elimination_matches
  WHERE id = 'a4320001-0000-4000-8000-000000000001'),
  'a4310002-0000-4000-8000-000000000002'::uuid,
  'rejected DE correction preserves the current winner');

-- ─── QuickTable: correction + atomic group standings ─────────────────────

INSERT INTO public.quick_tables (
  id, creator_user_id, name, player_count, format, status, share_id
) VALUES (
  'a4400000-0000-4000-8000-000000000001',
  'a4000001-0000-4000-8000-000000000001',
  'Task 4 Quick', 4, 'round_robin', 'playoff', 'task4-quick'
);

INSERT INTO public.quick_table_groups (id, table_id, name, display_order)
VALUES (
  'a4410000-0000-4000-8000-000000000001',
  'a4400000-0000-4000-8000-000000000001', 'A', 0
);

INSERT INTO public.quick_table_players (id, table_id, group_id, name, display_order) VALUES
  ('a4420001-0000-4000-8000-000000000001', 'a4400000-0000-4000-8000-000000000001', NULL, 'P1', 0),
  ('a4420002-0000-4000-8000-000000000002', 'a4400000-0000-4000-8000-000000000001', NULL, 'P2', 1),
  ('a4420003-0000-4000-8000-000000000003', 'a4400000-0000-4000-8000-000000000001', 'a4410000-0000-4000-8000-000000000001', 'P3', 2),
  ('a4420004-0000-4000-8000-000000000004', 'a4400000-0000-4000-8000-000000000001', 'a4410000-0000-4000-8000-000000000001', 'P4', 3);

INSERT INTO public.quick_table_matches (
  id, table_id, group_id, is_playoff, playoff_round, playoff_match_number,
  player1_id, player2_id, display_order, status
) VALUES
  (
    'a4430001-0000-4000-8000-000000000001', 'a4400000-0000-4000-8000-000000000001',
    NULL, true, 1, 1,
    'a4420001-0000-4000-8000-000000000001', 'a4420002-0000-4000-8000-000000000002', 0, 'pending'
  ),
  (
    'a4430002-0000-4000-8000-000000000002', 'a4400000-0000-4000-8000-000000000001',
    NULL, true, 2, 2,
    NULL, 'a4420003-0000-4000-8000-000000000003', 1, 'pending'
  ),
  (
    'a4430003-0000-4000-8000-000000000003', 'a4400000-0000-4000-8000-000000000001',
    'a4410000-0000-4000-8000-000000000001', false, NULL, NULL,
    'a4420003-0000-4000-8000-000000000003', 'a4420004-0000-4000-8000-000000000004', 2, 'pending'
  );

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a4000001-0000-4000-8000-000000000001', true);
SELECT is(
  public.score_quick_table_match_atomic('a4430001-0000-4000-8000-000000000001', 11, 7, 0) ->> 'success',
  'true', 'initial QuickTable playoff score succeeds'
);
RESET ROLE;
SELECT is((SELECT player1_id FROM public.quick_table_matches
  WHERE id = 'a4430002-0000-4000-8000-000000000002'),
  'a4420001-0000-4000-8000-000000000001'::uuid,
  'QuickTable winner advances to final');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a4000001-0000-4000-8000-000000000001', true);
SELECT is(
  public.score_quick_table_match_atomic('a4430001-0000-4000-8000-000000000001', 7, 11, 1) ->> 'success',
  'true', 'QuickTable correction succeeds before final starts'
);
RESET ROLE;
SELECT is((SELECT player1_id FROM public.quick_table_matches
  WHERE id = 'a4430002-0000-4000-8000-000000000002'),
  'a4420002-0000-4000-8000-000000000002'::uuid,
  'QuickTable correction replaces the final slot');

UPDATE public.quick_table_matches
SET score1 = 1, status = 'pending'
WHERE id = 'a4430002-0000-4000-8000-000000000002';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a4000001-0000-4000-8000-000000000001', true);
SELECT is(
  public.score_quick_table_match_atomic('a4430001-0000-4000-8000-000000000001', 11, 7, 2) ->> 'error',
  'DOWNSTREAM_LOCKED', 'QuickTable correction rejects a started final'
);
RESET ROLE;
SELECT is((SELECT winner_id FROM public.quick_table_matches
  WHERE id = 'a4430001-0000-4000-8000-000000000001'),
  'a4420002-0000-4000-8000-000000000002'::uuid,
  'rejected QuickTable correction preserves the current winner');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a4000001-0000-4000-8000-000000000001', true);
SELECT is(
  public.score_quick_table_match_atomic('a4430003-0000-4000-8000-000000000003', 11, 8, 0) ->> 'success',
  'true', 'QuickTable group score succeeds'
);
RESET ROLE;
SELECT is((SELECT matches_played || ':' || matches_won || ':' || points_for || ':' || points_against
  FROM public.quick_table_players WHERE id = 'a4420003-0000-4000-8000-000000000003'),
  '1:1:11:8', 'QuickTable winner aggregate commits with score');
SELECT is((SELECT matches_played || ':' || matches_won || ':' || points_for || ':' || points_against
  FROM public.quick_table_players WHERE id = 'a4420004-0000-4000-8000-000000000004'),
  '1:0:8:11', 'QuickTable loser aggregate commits with score');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a4000001-0000-4000-8000-000000000001', true);
SELECT is(
  public.score_quick_table_match_atomic('a4430003-0000-4000-8000-000000000003', 8, 11, 0) ->> 'error',
  'VERSION_CONFLICT', 'stale QuickTable group score is rejected'
);
RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
