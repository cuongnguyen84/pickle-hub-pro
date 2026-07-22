-- Task 4 regression: R3 assignment and playoff generation are server-owned,
-- idempotent, and happen inside the score transaction that unlocks them.

BEGIN;

SELECT plan(22);

SELECT has_function(
  'public', 'advance_doubles_elimination_lifecycle', ARRAY['uuid'],
  'DE lifecycle RPC exists'
);
SELECT ok(
  has_function_privilege(
    'authenticated', 'public.advance_doubles_elimination_lifecycle(uuid)', 'EXECUTE'
  ),
  'authenticated may advance DE lifecycle'
);
SELECT ok(
  NOT has_function_privilege(
    'anon', 'public.advance_doubles_elimination_lifecycle(uuid)', 'EXECUTE'
  ),
  'anon may not advance DE lifecycle'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'advance_doubles_elimination_after_score'
      AND tgrelid = 'public.doubles_elimination_matches'::regclass
      AND NOT tgisinternal
  ),
  'completed DE scores have an automatic lifecycle trigger'
);
SELECT is(
  cardinality(public.doubles_elimination_seed_positions(64)),
  64,
  'server seeding covers the largest supported playoff size'
);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    'b4000001-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'de-lifecycle-owner@thepicklehub.test', '', now(),
    '{"provider":"test","providers":["test"]}'::jsonb,
    '{"display_name":"DE Lifecycle Owner"}'::jsonb, now(), now()
  ),
  (
    'b4000002-0000-4000-8000-000000000002',
    '00000000-0000-0000-8000-000000000000', 'authenticated', 'authenticated',
    'de-lifecycle-other@thepicklehub.test', '', now(),
    '{"provider":"test","providers":["test"]}'::jsonb,
    '{"display_name":"DE Lifecycle Other"}'::jsonb, now(), now()
  );

INSERT INTO public.doubles_elimination_tournaments (
  id, name, share_id, creator_user_id, team_count, status,
  early_rounds_format, semifinals_format, finals_format,
  has_third_place_match, court_count
) VALUES (
  'b4100000-0000-4000-8000-000000000001',
  'Task 4 DE Lifecycle', 'task4-de-lifecycle',
  'b4000001-0000-4000-8000-000000000001',
  40, 'ongoing', 'bo1', 'bo3', 'bo3', false, 2
);

INSERT INTO public.doubles_elimination_teams (
  id, tournament_id, team_name, player1_name, seed, status, eliminated_at_round
) VALUES
  ('b4110001-0000-4000-8000-000000000001', 'b4100000-0000-4000-8000-000000000001', 'A', 'A', 1, 'active', NULL),
  ('b4110002-0000-4000-8000-000000000002', 'b4100000-0000-4000-8000-000000000001', 'B', 'B', 2, 'active', NULL),
  ('b4110003-0000-4000-8000-000000000003', 'b4100000-0000-4000-8000-000000000001', 'C', 'C', 3, 'active', NULL),
  ('b4110004-0000-4000-8000-000000000004', 'b4100000-0000-4000-8000-000000000001', 'D', 'D', 4, 'eliminated', 2),
  ('b4110005-0000-4000-8000-000000000005', 'b4100000-0000-4000-8000-000000000001', 'E', 'E', 5, 'active', NULL),
  ('b4110006-0000-4000-8000-000000000006', 'b4100000-0000-4000-8000-000000000001', 'F', 'F', 6, 'active', NULL),
  ('b4110007-0000-4000-8000-000000000007', 'b4100000-0000-4000-8000-000000000001', 'G', 'G', 7, 'active', NULL),
  ('b4110008-0000-4000-8000-000000000008', 'b4100000-0000-4000-8000-000000000001', 'H', 'H', 8, 'active', NULL);

INSERT INTO public.doubles_elimination_matches (
  id, tournament_id, round_number, round_type, bracket_type, match_number,
  team_a_id, team_b_id, score_a, score_b, winner_id, best_of,
  source_a, source_b, display_order, status, generation_key
) VALUES
  (
    'b4120001-0000-4000-8000-000000000001', 'b4100000-0000-4000-8000-000000000001',
    1, 'winner_r1', 'winner', 1,
    'b4110001-0000-4000-8000-000000000001', 'b4110002-0000-4000-8000-000000000002',
    11, 1, 'b4110001-0000-4000-8000-000000000001', 1,
    '{"type":"team"}', '{"type":"team"}', 0, 'completed', 'prelim:r1:1'
  ),
  (
    'b4120002-0000-4000-8000-000000000002', 'b4100000-0000-4000-8000-000000000001',
    1, 'winner_r1', 'winner', 2,
    'b4110003-0000-4000-8000-000000000003', 'b4110004-0000-4000-8000-000000000004',
    11, 2, 'b4110003-0000-4000-8000-000000000003', 1,
    '{"type":"team"}', '{"type":"team"}', 1, 'completed', 'prelim:r1:2'
  ),
  (
    'b4120003-0000-4000-8000-000000000003', 'b4100000-0000-4000-8000-000000000001',
    1, 'winner_r1', 'winner', 3,
    'b4110005-0000-4000-8000-000000000005', 'b4110006-0000-4000-8000-000000000006',
    11, 3, 'b4110005-0000-4000-8000-000000000005', 1,
    '{"type":"team"}', '{"type":"team"}', 2, 'completed', 'prelim:r1:3'
  ),
  (
    'b4120004-0000-4000-8000-000000000004', 'b4100000-0000-4000-8000-000000000001',
    1, 'winner_r1', 'winner', 4,
    'b4110007-0000-4000-8000-000000000007', 'b4110008-0000-4000-8000-000000000008',
    11, 4, 'b4110007-0000-4000-8000-000000000007', 1,
    '{"type":"team"}', '{"type":"team"}', 3, 'completed', 'prelim:r1:4'
  ),
  (
    'b4120005-0000-4000-8000-000000000005', 'b4100000-0000-4000-8000-000000000001',
    2, 'loser_r2', 'loser', 1,
    'b4110002-0000-4000-8000-000000000002', 'b4110004-0000-4000-8000-000000000004',
    11, 5, 'b4110002-0000-4000-8000-000000000002', 1,
    '{"type":"loser_of","round":1,"match_index":0}',
    '{"type":"loser_of","round":1,"match_index":1}',
    4, 'completed', 'prelim:r2:1'
  ),
  (
    'b4120006-0000-4000-8000-000000000006', 'b4100000-0000-4000-8000-000000000001',
    2, 'loser_r2', 'loser', 2,
    'b4110006-0000-4000-8000-000000000006', 'b4110008-0000-4000-8000-000000000008',
    0, 0, NULL, 1,
    '{"type":"loser_of","round":1,"match_index":2}',
    '{"type":"loser_of","round":1,"match_index":3}',
    5, 'pending', 'prelim:r2:2'
  ),
  (
    'b4120007-0000-4000-8000-000000000007', 'b4100000-0000-4000-8000-000000000001',
    3, 'merge_r3', 'merged', 1,
    NULL, NULL, 0, 0, NULL, 1,
    '{"type":"ranked_pool","position":0}',
    '{"type":"ranked_pool","position":1}',
    6, 'pending', 'prelim:r3:1'
  ),
  (
    'b4120008-0000-4000-8000-000000000008', 'b4100000-0000-4000-8000-000000000001',
    3, 'merge_r3', 'merged', 2,
    NULL, NULL, 0, 0, NULL, 1,
    '{"type":"ranked_pool","position":2}',
    '{"type":"ranked_pool","position":3}',
    7, 'pending', 'prelim:r3:2'
  );

UPDATE public.doubles_elimination_matches
SET referee_live_state = '{"v":1,"draft":true}'::jsonb
WHERE id = 'b4120006-0000-4000-8000-000000000006';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'b4000002-0000-4000-8000-000000000002', true);
SELECT is(
  public.advance_doubles_elimination_lifecycle('b4100000-0000-4000-8000-000000000001') ->> 'error',
  'NOT_AUTHORIZED',
  'non-owner cannot force DE lifecycle advancement'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'b4000001-0000-4000-8000-000000000001', true);
SELECT is(
  public.score_doubles_elimination_match_atomic(
    'b4120006-0000-4000-8000-000000000006', 11, 6, '[]'::jsonb, 0
  ) ->> 'success',
  'true',
  'last R2 score commits and triggers lifecycle advancement'
);
RESET ROLE;

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.doubles_elimination_matches
    WHERE tournament_id = 'b4100000-0000-4000-8000-000000000001'
      AND round_number = 3
      AND team_a_id IS NOT NULL
      AND team_b_id IS NOT NULL
  ),
  2,
  'last R2 score assigns every R3 match atomically'
);
SELECT is(
  (
    SELECT count(DISTINCT team_id)::integer
    FROM (
      SELECT team_a_id AS team_id
      FROM public.doubles_elimination_matches
      WHERE tournament_id = 'b4100000-0000-4000-8000-000000000001' AND round_number = 3
      UNION ALL
      SELECT team_b_id
      FROM public.doubles_elimination_matches
      WHERE tournament_id = 'b4100000-0000-4000-8000-000000000001' AND round_number = 3
    ) participants
  ),
  4,
  'R3 assignment contains four unique participants'
);
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.doubles_elimination_matches
    WHERE tournament_id = 'b4100000-0000-4000-8000-000000000001' AND round_number >= 4
  ),
  0,
  'playoff is not generated while R3 is incomplete'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'b4000001-0000-4000-8000-000000000001', true);
SELECT is(
  public.score_doubles_elimination_match_atomic(
    'b4120007-0000-4000-8000-000000000007', 11, 7, '[]'::jsonb, 0
  ) ->> 'success',
  'true',
  'first R3 score commits'
);
RESET ROLE;

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.doubles_elimination_matches
    WHERE tournament_id = 'b4100000-0000-4000-8000-000000000001' AND round_number >= 4
  ),
  0,
  'one completed R3 match does not generate playoff early'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'b4000001-0000-4000-8000-000000000001', true);
SELECT is(
  public.score_doubles_elimination_match_atomic(
    'b4120008-0000-4000-8000-000000000008', 11, 8, '[]'::jsonb, 0
  ) ->> 'success',
  'true',
  'last R3 score commits with playoff generation'
);
RESET ROLE;

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.doubles_elimination_matches
    WHERE tournament_id = 'b4100000-0000-4000-8000-000000000001' AND round_number >= 4
  ),
  3,
  'four-team playoff contains two semifinals and one final'
);
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.doubles_elimination_matches
    WHERE tournament_id = 'b4100000-0000-4000-8000-000000000001'
      AND round_number = 4
      AND round_type = 'semifinal'
  ),
  2,
  'playoff starts with two semifinals'
);
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.doubles_elimination_matches
    WHERE tournament_id = 'b4100000-0000-4000-8000-000000000001'
      AND round_type = 'final'
  ),
  1,
  'playoff contains exactly one final'
);
SELECT is(
  (
    SELECT count(DISTINCT team_id)::integer
    FROM (
      SELECT team_a_id AS team_id
      FROM public.doubles_elimination_matches
      WHERE tournament_id = 'b4100000-0000-4000-8000-000000000001' AND round_number = 4
      UNION ALL
      SELECT team_b_id
      FROM public.doubles_elimination_matches
      WHERE tournament_id = 'b4100000-0000-4000-8000-000000000001' AND round_number = 4
    ) entrants
  ),
  4,
  'every playoff entrant is seated exactly once'
);
SELECT is(
  (
    SELECT count(DISTINCT generation_key)::integer
    FROM public.doubles_elimination_matches
    WHERE tournament_id = 'b4100000-0000-4000-8000-000000000001' AND round_number >= 4
  ),
  3,
  'every generated playoff node has a unique idempotency key'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'b4000001-0000-4000-8000-000000000001', true);
SELECT is(
  public.advance_doubles_elimination_lifecycle('b4100000-0000-4000-8000-000000000001') ->> 'idempotent',
  'true',
  'retrying lifecycle reports the committed playoff'
);
RESET ROLE;

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.doubles_elimination_matches
    WHERE tournament_id = 'b4100000-0000-4000-8000-000000000001' AND round_number >= 4
  ),
  3,
  'retrying lifecycle creates no duplicate playoff rows'
);
SELECT is(
  (
    SELECT status
    FROM public.doubles_elimination_teams
    WHERE id = 'b4110008-0000-4000-8000-000000000008'
  ),
  'eliminated',
  'score transaction still commits the R2 loser status with R3 assignment'
);
SELECT is(
  (
    SELECT referee_live_state
    FROM public.doubles_elimination_matches
    WHERE id = 'b4120006-0000-4000-8000-000000000006'
  ),
  NULL::jsonb,
  'committing a result clears its separate live-score draft'
);

SELECT * FROM finish();

ROLLBACK;
