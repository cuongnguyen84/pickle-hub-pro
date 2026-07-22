-- Task 4 regression: Team Match game seeding, scoring, aggregation and
-- playoff propagation are a single server-owned transaction.

BEGIN;

SELECT plan(50);

SELECT has_function(
  'public', 'ensure_team_match_games_atomic', ARRAY['uuid'],
  'atomic Team Match game seeding RPC exists'
);
SELECT has_function(
  'public', 'score_team_match_games_atomic', ARRAY['uuid', 'jsonb'],
  'atomic Team Match scoring RPC exists'
);
SELECT has_column('public', 'team_match_games', 'score_version',
  'Team Match games expose an optimistic score version');
SELECT ok(has_function_privilege(
  'authenticated', 'public.ensure_team_match_games_atomic(uuid)', 'EXECUTE'
), 'authenticated may ensure Team Match games');
SELECT ok(NOT has_function_privilege(
  'anon', 'public.ensure_team_match_games_atomic(uuid)', 'EXECUTE'
), 'anon may not ensure Team Match games');
SELECT ok(has_function_privilege(
  'authenticated', 'public.score_team_match_games_atomic(uuid,jsonb)', 'EXECUTE'
), 'authenticated may score Team Match games');
SELECT ok(NOT has_function_privilege(
  'anon', 'public.score_team_match_games_atomic(uuid,jsonb)', 'EXECUTE'
), 'anon may not score Team Match games');
SELECT ok(NOT has_function_privilege(
  'authenticated', 'public.seed_team_match_games_locked(uuid)', 'EXECUTE'
), 'internal Team Match seeding helper is not client-callable');

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    'a8000001-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'task4-team-owner@thepicklehub.test', '', now(),
    '{"provider":"test","providers":["test"]}'::jsonb,
    '{"display_name":"Task 4 Team Owner"}'::jsonb, now(), now()
  ),
  (
    'a8000002-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'task4-team-other@thepicklehub.test', '', now(),
    '{"provider":"test","providers":["test"]}'::jsonb,
    '{"display_name":"Task 4 Team Other"}'::jsonb, now(), now()
  );

INSERT INTO public.team_match_tournaments (
  id, created_by, share_id, name, team_roster_size, team_count, format,
  has_dreambreaker, has_third_place_match, total_score_mode, status
) VALUES
  (
    'a8000010-0000-4000-8000-000000000010',
    'a8000001-0000-4000-8000-000000000001', 'task4-team-standard',
    'Atomic Team Match', 4, 4, 'single_elimination', false, true, false, 'ongoing'
  ),
  (
    'a8000020-0000-4000-8000-000000000020',
    'a8000001-0000-4000-8000-000000000001', 'task4-team-total',
    'Atomic Team Total', 4, 2, 'round_robin', false, false, true, 'ongoing'
  );

INSERT INTO public.team_match_teams (
  id, tournament_id, team_name, status, seed
) VALUES
  ('a8000101-0000-4000-8000-000000000101', 'a8000010-0000-4000-8000-000000000010', 'Alpha', 'approved', 1),
  ('a8000102-0000-4000-8000-000000000102', 'a8000010-0000-4000-8000-000000000010', 'Bravo', 'approved', 4),
  ('a8000103-0000-4000-8000-000000000103', 'a8000010-0000-4000-8000-000000000010', 'Charlie', 'approved', 2),
  ('a8000104-0000-4000-8000-000000000104', 'a8000010-0000-4000-8000-000000000010', 'Delta', 'approved', 3),
  ('a8000201-0000-4000-8000-000000000201', 'a8000020-0000-4000-8000-000000000020', 'Echo', 'approved', 1),
  ('a8000202-0000-4000-8000-000000000202', 'a8000020-0000-4000-8000-000000000020', 'Foxtrot', 'approved', 2);

INSERT INTO public.team_match_game_templates (
  id, tournament_id, order_index, game_type, display_name, scoring_type
) VALUES
  ('a8001001-0000-4000-8000-000000001001', 'a8000010-0000-4000-8000-000000000010', 10, 'WD', 'Women Doubles', 'rally21'),
  ('a8001002-0000-4000-8000-000000001002', 'a8000010-0000-4000-8000-000000000010', 20, 'MD', 'Men Doubles', 'rally21'),
  ('a8001003-0000-4000-8000-000000001003', 'a8000010-0000-4000-8000-000000000010', 30, 'MX', 'Mixed Doubles', 'rally21'),
  ('a8002001-0000-4000-8000-000000002001', 'a8000020-0000-4000-8000-000000000020', 1, 'WD', 'Total One', 'rally21'),
  ('a8002002-0000-4000-8000-000000002002', 'a8000020-0000-4000-8000-000000000020', 2, 'MD', 'Total Two', 'rally21');

INSERT INTO public.team_match_matches (
  id, tournament_id, team_a_id, team_b_id, is_playoff, playoff_round,
  next_match_id, next_match_slot, is_third_place, display_order
) VALUES
  ('a8003000-0000-4000-8000-000000003000', 'a8000010-0000-4000-8000-000000000010', NULL, NULL, true, 3, NULL, NULL, false, 3),
  ('a8003001-0000-4000-8000-000000003001', 'a8000010-0000-4000-8000-000000000010',
   'a8000101-0000-4000-8000-000000000101', 'a8000102-0000-4000-8000-000000000102',
   true, 2, 'a8003000-0000-4000-8000-000000003000', 1, false, 1),
  ('a8003002-0000-4000-8000-000000003002', 'a8000010-0000-4000-8000-000000000010',
   'a8000103-0000-4000-8000-000000000103', 'a8000104-0000-4000-8000-000000000104',
   true, 2, 'a8003000-0000-4000-8000-000000003000', 2, false, 2),
  ('a8003003-0000-4000-8000-000000003003', 'a8000010-0000-4000-8000-000000000010',
   NULL, NULL, true, 3, NULL, NULL, true, 4),
  ('a8003004-0000-4000-8000-000000003004', 'a8000010-0000-4000-8000-000000000010',
   'a8000101-0000-4000-8000-000000000101', NULL, false, NULL, NULL, NULL, false, 5),
  ('a8004001-0000-4000-8000-000000004001', 'a8000020-0000-4000-8000-000000000020',
   'a8000201-0000-4000-8000-000000000201', 'a8000202-0000-4000-8000-000000000202',
   false, NULL, NULL, NULL, false, 1);

CREATE TEMP TABLE team_atomic_results (kind text PRIMARY KEY, result jsonb NOT NULL);
GRANT SELECT, INSERT, UPDATE ON team_atomic_results TO authenticated;
GRANT SELECT ON public.team_match_matches, public.team_match_games TO authenticated;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a8000001-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"a8000001-0000-4000-8000-000000000001","role":"authenticated"}', true);

INSERT INTO team_atomic_results VALUES (
  'not-ready', public.ensure_team_match_games_atomic('a8003004-0000-4000-8000-000000003004')::jsonb
);
SELECT is((SELECT result ->> 'success' FROM team_atomic_results WHERE kind = 'not-ready'),
  'true', 'ensure succeeds as an idempotent no-op before both teams exist');
SELECT is((SELECT result ->> 'ready' FROM team_atomic_results WHERE kind = 'not-ready'),
  'false', 'ensure reports that the match is not ready');
SELECT is((SELECT count(*)::integer FROM public.team_match_games
  WHERE match_id = 'a8003004-0000-4000-8000-000000003004'),
  0, 'not-ready ensure creates no games');

INSERT INTO team_atomic_results VALUES (
  'ensure-one', public.ensure_team_match_games_atomic('a8003001-0000-4000-8000-000000003001')::jsonb
);
SELECT is((SELECT result ->> 'success' FROM team_atomic_results WHERE kind = 'ensure-one'),
  'true', 'ready match game seeding succeeds');
SELECT is((SELECT result ->> 'created' FROM team_atomic_results WHERE kind = 'ensure-one'),
  '3', 'game seeding reports every created template slot');
SELECT is((SELECT count(*)::integer FROM public.team_match_games
  WHERE match_id = 'a8003001-0000-4000-8000-000000003001'),
  3, 'ready match receives all template games');
SELECT results_eq(
  $$ SELECT order_index FROM public.team_match_games
     WHERE match_id = 'a8003001-0000-4000-8000-000000003001'
     ORDER BY order_index $$,
  $$ VALUES (0), (1), (2) $$,
  'server normalizes template positions into stable game slots'
);

UPDATE team_atomic_results
SET result = public.ensure_team_match_games_atomic('a8003001-0000-4000-8000-000000003001')::jsonb
WHERE kind = 'ensure-one';
SELECT is((SELECT result ->> 'idempotent' FROM team_atomic_results WHERE kind = 'ensure-one'),
  'true', 'lost-response ensure retry is idempotent');
SELECT is((SELECT count(*)::integer FROM public.team_match_games
  WHERE match_id = 'a8003001-0000-4000-8000-000000003001'),
  3, 'ensure retry never duplicates a slot');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'a8000002-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"a8000002-0000-4000-8000-000000000002","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
INSERT INTO team_atomic_results VALUES (
  'not-authorized-ensure', public.ensure_team_match_games_atomic('a8003002-0000-4000-8000-000000003002')::jsonb
);
SELECT is((SELECT result ->> 'error' FROM team_atomic_results WHERE kind = 'not-authorized-ensure'),
  'NOT_AUTHORIZED', 'unrelated user cannot seed Team Match games');
SELECT is((SELECT count(*)::integer FROM public.team_match_games
  WHERE match_id = 'a8003002-0000-4000-8000-000000003002'),
  0, 'rejected game seeding writes nothing');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'a8000001-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"a8000001-0000-4000-8000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

INSERT INTO team_atomic_results VALUES (
  'score-one',
  public.score_team_match_games_atomic(
    'a8003001-0000-4000-8000-000000003001',
    (SELECT jsonb_agg(jsonb_build_object(
      'game_id', id, 'score_a', 11, 'score_b', CASE order_index WHEN 0 THEN 5 ELSE 7 END,
      'expected_version', 0
    ) ORDER BY order_index)
    FROM public.team_match_games
    WHERE match_id = 'a8003001-0000-4000-8000-000000003001' AND order_index < 2)
  )::jsonb
);
SELECT is((SELECT result ->> 'success' FROM team_atomic_results WHERE kind = 'score-one'),
  'true', 'batch game score and match result commit together');
SELECT is((SELECT winner_team_id::text FROM public.team_match_matches
  WHERE id = 'a8003001-0000-4000-8000-000000003001'),
  'a8000101-0000-4000-8000-000000000101', 'majority winner is persisted');
SELECT is((SELECT status::text FROM public.team_match_matches
  WHERE id = 'a8003001-0000-4000-8000-000000003001'),
  'completed', 'majority completes the source match');
SELECT is((SELECT games_won_a::text || '-' || games_won_b::text FROM public.team_match_matches
  WHERE id = 'a8003001-0000-4000-8000-000000003001'),
  '2-0', 'match game totals are derived inside the transaction');
SELECT is((SELECT total_points_a::text || '-' || total_points_b::text FROM public.team_match_matches
  WHERE id = 'a8003001-0000-4000-8000-000000003001'),
  '22-12', 'match point totals are derived inside the transaction');
SELECT is((SELECT count(*)::integer FROM public.team_match_games
  WHERE match_id = 'a8003001-0000-4000-8000-000000003001' AND score_version = 1),
  2, 'every changed game advances its optimistic version');
SELECT is((SELECT team_a_id::text FROM public.team_match_matches
  WHERE id = 'a8003000-0000-4000-8000-000000003000'),
  'a8000101-0000-4000-8000-000000000101', 'winner advances to its fixed final slot');
SELECT is((SELECT team_a_id::text FROM public.team_match_matches
  WHERE id = 'a8003003-0000-4000-8000-000000003003'),
  'a8000102-0000-4000-8000-000000000102', 'semifinal loser claims a third-place slot');
SELECT is((SELECT count(*)::integer FROM public.team_match_games
  WHERE match_id IN ('a8003000-0000-4000-8000-000000003000', 'a8003003-0000-4000-8000-000000003003')),
  0, 'downstream games wait until both participants exist');

SELECT public.ensure_team_match_games_atomic('a8003002-0000-4000-8000-000000003002');
INSERT INTO team_atomic_results VALUES (
  'score-two',
  public.score_team_match_games_atomic(
    'a8003002-0000-4000-8000-000000003002',
    (SELECT jsonb_agg(jsonb_build_object(
      'game_id', id, 'score_a', 11, 'score_b', 4, 'expected_version', 0
    ) ORDER BY order_index)
    FROM public.team_match_games
    WHERE match_id = 'a8003002-0000-4000-8000-000000003002' AND order_index < 2)
  )::jsonb
);
SELECT is((SELECT result ->> 'success' FROM team_atomic_results WHERE kind = 'score-two'),
  'true', 'sibling semifinal commits through the same RPC');
SELECT is((SELECT team_a_id::text || ',' || team_b_id::text FROM public.team_match_matches
  WHERE id = 'a8003000-0000-4000-8000-000000003000'),
  'a8000101-0000-4000-8000-000000000101,a8000103-0000-4000-8000-000000000103',
  'two semifinal winners occupy distinct final slots');
SELECT is((SELECT team_a_id::text || ',' || team_b_id::text FROM public.team_match_matches
  WHERE id = 'a8003003-0000-4000-8000-000000003003'),
  'a8000102-0000-4000-8000-000000000102,a8000104-0000-4000-8000-000000000104',
  'two semifinal losers occupy distinct third-place slots');
SELECT is((SELECT count(*)::integer FROM public.team_match_games
  WHERE match_id = 'a8003000-0000-4000-8000-000000003000'),
  3, 'ready final receives one complete game set');
SELECT is((SELECT count(*)::integer FROM public.team_match_games
  WHERE match_id = 'a8003003-0000-4000-8000-000000003003'),
  3, 'ready third-place match receives one complete game set');

INSERT INTO team_atomic_results VALUES (
  'correct-one',
  public.score_team_match_games_atomic(
    'a8003001-0000-4000-8000-000000003001',
    (SELECT jsonb_agg(jsonb_build_object(
      'game_id', id, 'score_a', CASE order_index WHEN 0 THEN 3 ELSE 5 END,
      'score_b', 11, 'expected_version', 1
    ) ORDER BY order_index)
    FROM public.team_match_games
    WHERE match_id = 'a8003001-0000-4000-8000-000000003001' AND order_index < 2)
  )::jsonb
);
SELECT is((SELECT result ->> 'success' FROM team_atomic_results WHERE kind = 'correct-one'),
  'true', 'winner correction succeeds before downstream play starts');
SELECT is((SELECT team_a_id::text FROM public.team_match_matches
  WHERE id = 'a8003000-0000-4000-8000-000000003000'),
  'a8000102-0000-4000-8000-000000000102', 'correction replaces the old final winner');
SELECT is((SELECT team_a_id::text FROM public.team_match_matches
  WHERE id = 'a8003003-0000-4000-8000-000000003003'),
  'a8000101-0000-4000-8000-000000000101', 'correction replaces the old third-place loser');
SELECT is((SELECT count(*)::integer FROM public.team_match_games
  WHERE match_id IN ('a8003000-0000-4000-8000-000000003000', 'a8003003-0000-4000-8000-000000003003')),
  6, 'correction never duplicates downstream games');

RESET ROLE;
UPDATE public.team_match_games
SET status = 'in_progress'
WHERE match_id = 'a8003000-0000-4000-8000-000000003000' AND order_index = 0;
SET LOCAL ROLE authenticated;
INSERT INTO team_atomic_results VALUES (
  'locked-correction',
  public.score_team_match_games_atomic(
    'a8003001-0000-4000-8000-000000003001',
    (SELECT jsonb_agg(jsonb_build_object(
      'game_id', id, 'score_a', 11, 'score_b', 2, 'expected_version', 2
    ) ORDER BY order_index)
    FROM public.team_match_games
    WHERE match_id = 'a8003001-0000-4000-8000-000000003001' AND order_index < 2)
  )::jsonb
);
SELECT is((SELECT result ->> 'error' FROM team_atomic_results WHERE kind = 'locked-correction'),
  'DOWNSTREAM_LOCKED', 'correction is rejected after downstream play begins');
SELECT is((SELECT sum(score_a)::integer FROM public.team_match_games
  WHERE match_id = 'a8003001-0000-4000-8000-000000003001' AND order_index < 2),
  8, 'rejected downstream correction changes no source score');
SELECT is((SELECT team_a_id::text FROM public.team_match_matches
  WHERE id = 'a8003000-0000-4000-8000-000000003000'),
  'a8000102-0000-4000-8000-000000000102', 'rejected correction changes no bracket slot');

INSERT INTO team_atomic_results VALUES (
  'stale',
  public.score_team_match_games_atomic(
    'a8003001-0000-4000-8000-000000003001',
    (SELECT jsonb_build_array(jsonb_build_object(
      'game_id', id, 'score_a', 1, 'score_b', 11, 'expected_version', 1
    )) FROM public.team_match_games
    WHERE match_id = 'a8003001-0000-4000-8000-000000003001' AND order_index = 0)
  )::jsonb
);
SELECT is((SELECT result ->> 'error' FROM team_atomic_results WHERE kind = 'stale'),
  'VERSION_CONFLICT', 'stale score writer is rejected');
SELECT is((SELECT score_version::integer FROM public.team_match_games
  WHERE match_id = 'a8003001-0000-4000-8000-000000003001' AND order_index = 0),
  2, 'version conflict changes no game version');

SELECT public.ensure_team_match_games_atomic('a8004001-0000-4000-8000-000000004001');
INSERT INTO team_atomic_results VALUES (
  'total-score',
  public.score_team_match_games_atomic(
    'a8004001-0000-4000-8000-000000004001',
    (SELECT jsonb_agg(jsonb_build_object(
      'game_id', id,
      'score_a', CASE order_index WHEN 0 THEN 10 ELSE 5 END,
      'score_b', CASE order_index WHEN 0 THEN 8 ELSE 9 END,
      'expected_version', 0
    ) ORDER BY order_index)
    FROM public.team_match_games
    WHERE match_id = 'a8004001-0000-4000-8000-000000004001')
  )::jsonb
);
SELECT is((SELECT result ->> 'success' FROM team_atomic_results WHERE kind = 'total-score'),
  'true', 'total-score mode accepts an atomic full-match batch');
SELECT is((SELECT status::text FROM public.team_match_matches
  WHERE id = 'a8004001-0000-4000-8000-000000004001'),
  'completed', 'fully scored total-score match completes');
SELECT is((SELECT winner_team_id::text FROM public.team_match_matches
  WHERE id = 'a8004001-0000-4000-8000-000000004001'),
  'a8000202-0000-4000-8000-000000000202', 'total points decide total-score winner');
SELECT is((SELECT total_points_a::text || '-' || total_points_b::text FROM public.team_match_matches
  WHERE id = 'a8004001-0000-4000-8000-000000004001'),
  '15-17', 'total-score aggregates are committed with the winner');

INSERT INTO team_atomic_results VALUES (
  'foreign-game',
  public.score_team_match_games_atomic(
    'a8004001-0000-4000-8000-000000004001',
    jsonb_build_array(jsonb_build_object(
      'game_id', (SELECT id FROM public.team_match_games
        WHERE match_id = 'a8003002-0000-4000-8000-000000003002' ORDER BY order_index LIMIT 1),
      'score_a', 2, 'score_b', 11, 'expected_version', 1
    ))
  )::jsonb
);
SELECT is((SELECT result ->> 'error' FROM team_atomic_results WHERE kind = 'foreign-game'),
  'GAME_NOT_FOUND', 'a score item cannot cross match boundaries');
SELECT is((SELECT sum(score_version)::integer FROM public.team_match_games
  WHERE match_id = 'a8004001-0000-4000-8000-000000004001'),
  2, 'invalid batch changes no target game');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'a8000002-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"a8000002-0000-4000-8000-000000000002","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
INSERT INTO team_atomic_results VALUES (
  'not-authorized-score',
  public.score_team_match_games_atomic(
    'a8004001-0000-4000-8000-000000004001',
    (SELECT jsonb_build_array(jsonb_build_object(
      'game_id', id, 'score_a', 9, 'score_b', 1, 'expected_version', 1
    )) FROM public.team_match_games
    WHERE match_id = 'a8004001-0000-4000-8000-000000004001' AND order_index = 0)
  )::jsonb
);
SELECT is((SELECT result ->> 'error' FROM team_atomic_results WHERE kind = 'not-authorized-score'),
  'NOT_AUTHORIZED', 'unrelated user cannot score a Team Match game');
RESET ROLE;
SELECT is((SELECT score_a FROM public.team_match_games
  WHERE match_id = 'a8004001-0000-4000-8000-000000004001' AND order_index = 0),
  10, 'rejected unauthorized score changes nothing');

SELECT * FROM finish();
ROLLBACK;
