-- Task 4 regression: Team Match create, schedule/bracket generation, round
-- start and reset are transaction-owned lifecycle mutations.

BEGIN;

SELECT plan(72);

SELECT has_function('public', 'create_team_match_atomic', ARRAY['jsonb', 'jsonb'],
  'atomic Team Match create RPC exists');
SELECT has_function('public', 'generate_team_match_round_robin_atomic',
  ARRAY['uuid', 'jsonb', 'boolean'], 'atomic Team Match round-robin RPC exists');
SELECT has_function('public', 'generate_team_match_brackets_atomic',
  ARRAY['uuid', 'jsonb'], 'atomic Team Match bracket RPC exists');
SELECT has_function('public', 'reset_team_match_lifecycle_atomic',
  ARRAY['uuid', 'text'], 'atomic Team Match reset RPC exists');
SELECT has_function('public', 'start_team_match_round_atomic',
  ARRAY['uuid', 'integer'], 'atomic Team Match round-start RPC exists');
SELECT ok(has_function_privilege('authenticated',
  'public.create_team_match_atomic(jsonb,jsonb)', 'EXECUTE'),
  'authenticated may create Team Match atomically');
SELECT ok(NOT has_function_privilege('anon',
  'public.create_team_match_atomic(jsonb,jsonb)', 'EXECUTE'),
  'anon may not create Team Match atomically');
SELECT ok(has_function_privilege('authenticated',
  'public.generate_team_match_round_robin_atomic(uuid,jsonb,boolean)', 'EXECUTE'),
  'authenticated may generate Team Match schedule');
SELECT ok(NOT has_function_privilege('anon',
  'public.generate_team_match_round_robin_atomic(uuid,jsonb,boolean)', 'EXECUTE'),
  'anon may not generate Team Match schedule');
SELECT ok(has_function_privilege('authenticated',
  'public.generate_team_match_brackets_atomic(uuid,jsonb)', 'EXECUTE'),
  'authenticated may generate Team Match bracket');
SELECT ok(NOT has_function_privilege('anon',
  'public.generate_team_match_brackets_atomic(uuid,jsonb)', 'EXECUTE'),
  'anon may not generate Team Match bracket');
SELECT ok(has_function_privilege('authenticated',
  'public.reset_team_match_lifecycle_atomic(uuid,text)', 'EXECUTE'),
  'authenticated may reset Team Match lifecycle');
SELECT ok(NOT has_function_privilege('anon',
  'public.reset_team_match_lifecycle_atomic(uuid,text)', 'EXECUTE'),
  'anon may not reset Team Match lifecycle');
SELECT ok(has_function_privilege('authenticated',
  'public.start_team_match_round_atomic(uuid,integer)', 'EXECUTE'),
  'authenticated may start a Team Match round');
SELECT ok(NOT has_function_privilege('authenticated',
  'public.seed_team_match_games_locked(uuid,boolean)', 'EXECUTE'),
  'randomized game seeding helper stays private');

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('a9000001-0000-4000-8000-000000000001',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'task4-life-owner@thepicklehub.test', '', now(),
   '{"provider":"test","providers":["test"]}'::jsonb,
   '{"display_name":"Task 4 Lifecycle Owner"}'::jsonb, now(), now()),
  ('a9000002-0000-4000-8000-000000000002',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'task4-life-other@thepicklehub.test', '', now(),
   '{"provider":"test","providers":["test"]}'::jsonb,
   '{"display_name":"Task 4 Lifecycle Other"}'::jsonb, now(), now());

CREATE TEMP TABLE tm_lifecycle_results (kind text PRIMARY KEY, result jsonb NOT NULL);
GRANT SELECT, INSERT, UPDATE ON tm_lifecycle_results TO authenticated;
GRANT SELECT ON public.team_match_tournaments, public.team_match_game_templates,
  public.team_match_teams, public.team_match_groups, public.team_match_matches,
  public.team_match_games TO authenticated;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a9000001-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"a9000001-0000-4000-8000-000000000001","role":"authenticated"}', true);

INSERT INTO tm_lifecycle_results VALUES (
  'invalid-create',
  public.create_team_match_atomic(
    '{"name":"Invalid Atomic","share_id":"task4invalid","team_roster_size":4,"team_count":4,"format":"round_robin"}'::jsonb,
    '[{"game_type":"BAD","scoring_type":"rally21"}]'::jsonb
  )::jsonb
);
SELECT is((SELECT result ->> 'error' FROM tm_lifecycle_results WHERE kind = 'invalid-create'),
  'INVALID_TEMPLATES', 'invalid templates are rejected before create');
SELECT is((SELECT count(*)::integer FROM public.team_match_tournaments
  WHERE share_id = 'task4invalid'), 0, 'invalid create writes no parent row');

INSERT INTO tm_lifecycle_results VALUES (
  'create',
  public.create_team_match_atomic(
    '{
      "name":"Atomic Team Lifecycle", "share_id":"task4create",
      "team_roster_size":4, "team_count":8, "format":"rr_playoff",
      "playoff_team_count":4, "require_registration":true,
      "has_dreambreaker":true, "require_min_games_per_player":true,
      "has_repechage":true, "bracket_pairing_type":"manual",
      "require_dupr":true, "dupr_max_male":4.8, "dupr_max_female":4.3,
      "total_score_mode":true, "points_per_game":7,
      "rules_summary":"Atomic rules", "entry_fee_team_vnd":800000,
      "bank_code":"VCB", "bank_account_number":"123456",
      "bank_account_name":"PICKLE HUB", "event_date":"2026-08-01",
      "location":"Ho Chi Minh City", "discount_tiers":[{"min":4,"percent":10}]
    }'::jsonb,
    '[
      {"game_type":"WD","scoring_type":"rally21","display_name":"Women"},
      {"game_type":"MD","scoring_type":"sideout11","display_name":"Men"}
    ]'::jsonb
  )::jsonb
);
SELECT is((SELECT result ->> 'success' FROM tm_lifecycle_results WHERE kind = 'create'),
  'true', 'fully configured Team Match create succeeds');
SELECT is((SELECT count(*)::integer FROM public.team_match_tournaments
  WHERE share_id = 'task4create'), 1, 'atomic create commits one parent');
SELECT is((SELECT format || ':' || playoff_team_count::text || ':' || has_repechage::text
  FROM public.team_match_tournaments WHERE share_id = 'task4create'),
  'rr_playoff:4:true', 'format, playoff size and repechage commit together');
SELECT is((SELECT require_dupr::text || ':' || dupr_max_male::text || ':' || dupr_max_female::text
  FROM public.team_match_tournaments WHERE share_id = 'task4create'),
  'true:4.8:4.3', 'DUPR configuration commits with parent');
SELECT is((SELECT total_score_mode::text || ':' || points_per_game::text
  FROM public.team_match_tournaments WHERE share_id = 'task4create'),
  'true:7', 'total-score configuration commits with parent');
SELECT is((SELECT entry_fee_team_vnd::text || ':' || bank_code || ':' || location
  FROM public.team_match_tournaments WHERE share_id = 'task4create'),
  '800000:VCB:Ho Chi Minh City', 'fee, bank and event metadata commit together');
SELECT is((SELECT count(*)::integer FROM public.team_match_game_templates t
  JOIN public.team_match_tournaments x ON x.id = t.tournament_id
  WHERE x.share_id = 'task4create'), 2, 'all game templates commit with parent');
SELECT results_eq(
  $$ SELECT order_index, game_type::text, scoring_type::text
     FROM public.team_match_game_templates t
     JOIN public.team_match_tournaments x ON x.id = t.tournament_id
     WHERE x.share_id = 'task4create' ORDER BY order_index $$,
  $$ VALUES (0, 'WD', 'rally21'), (1, 'MD', 'sideout11') $$,
  'server normalizes template order'
);
UPDATE tm_lifecycle_results SET result = public.create_team_match_atomic(
  '{"name":"Atomic Team Lifecycle","share_id":"task4create","team_roster_size":4,"team_count":8,"format":"rr_playoff","playoff_team_count":4}'::jsonb,
  '[{"game_type":"MS","scoring_type":"rally21"}]'::jsonb
)::jsonb WHERE kind = 'create';
SELECT is((SELECT result ->> 'idempotent' FROM tm_lifecycle_results WHERE kind = 'create'),
  'true', 'lost-response create retry is idempotent by share id');
SELECT is((SELECT count(*)::integer FROM public.team_match_game_templates t
  JOIN public.team_match_tournaments x ON x.id = t.tournament_id
  WHERE x.share_id = 'task4create'), 2, 'create retry never duplicates templates');

RESET ROLE;

-- Four independent lifecycle fixtures plus one invalid/unauthorized target.
INSERT INTO public.team_match_tournaments (
  id, created_by, share_id, name, team_roster_size, team_count, format,
  playoff_team_count, has_dreambreaker, has_third_place_match,
  has_repechage, status
) VALUES
  ('a9001000-0000-4000-8000-000000001000', 'a9000001-0000-4000-8000-000000000001',
   'task4rr', 'RR Lifecycle', 4, 4, 'round_robin', NULL, false, false, false, 'registration'),
  ('a9002000-0000-4000-8000-000000002000', 'a9000001-0000-4000-8000-000000000001',
   'task4groups', 'Group Lifecycle', 4, 8, 'rr_playoff', 4, false, false, false, 'registration'),
  ('a9003000-0000-4000-8000-000000003000', 'a9000001-0000-4000-8000-000000000001',
   'task4single', 'Single Lifecycle', 4, 4, 'single_elimination', NULL, false, true, false, 'registration'),
  ('a9004000-0000-4000-8000-000000004000', 'a9000001-0000-4000-8000-000000000001',
   'task4playoff', 'Playoff Lifecycle', 4, 8, 'rr_playoff', 4, false, false, true, 'ongoing'),
  ('a9005000-0000-4000-8000-000000005000', 'a9000001-0000-4000-8000-000000000001',
   'task4pending', 'Pending Group Lifecycle', 4, 4, 'rr_playoff', 4, false, false, false, 'ongoing'),
  ('a9006000-0000-4000-8000-000000006000', 'a9000001-0000-4000-8000-000000000001',
   'task4unauth', 'Unauthorized Lifecycle', 4, 2, 'round_robin', NULL, false, false, false, 'registration');

INSERT INTO public.team_match_game_templates (
  tournament_id, order_index, game_type, display_name, scoring_type
)
SELECT t.id, x.i, CASE x.i WHEN 0 THEN 'WD'::public.team_game_type
                           WHEN 1 THEN 'MD'::public.team_game_type
                           ELSE 'MX'::public.team_game_type END,
       'Game ' || (x.i + 1), 'rally21'
FROM public.team_match_tournaments t
CROSS JOIN generate_series(0, 2) AS x(i)
WHERE t.id IN (
  'a9001000-0000-4000-8000-000000001000', 'a9002000-0000-4000-8000-000000002000',
  'a9003000-0000-4000-8000-000000003000', 'a9004000-0000-4000-8000-000000004000',
  'a9005000-0000-4000-8000-000000005000', 'a9006000-0000-4000-8000-000000006000'
);

INSERT INTO public.team_match_teams (id, tournament_id, team_name, status, seed)
SELECT (
  substr(replace(t.id::text, '-', ''), 1, 20) || lpad(i::text, 12, '0')
)::uuid, t.id, 'Team ' || i, 'approved', i
FROM public.team_match_tournaments t
CROSS JOIN LATERAL generate_series(1, t.team_count) AS teams(i)
WHERE t.id IN (
  'a9001000-0000-4000-8000-000000001000', 'a9002000-0000-4000-8000-000000002000',
  'a9003000-0000-4000-8000-000000003000', 'a9004000-0000-4000-8000-000000004000',
  'a9005000-0000-4000-8000-000000005000', 'a9006000-0000-4000-8000-000000006000'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a9000001-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"a9000001-0000-4000-8000-000000000001","role":"authenticated"}', true);

INSERT INTO tm_lifecycle_results VALUES (
  'rr', public.generate_team_match_round_robin_atomic(
    'a9001000-0000-4000-8000-000000001000', '[]'::jsonb, false
  )::jsonb
);
SELECT is((SELECT result ->> 'success' FROM tm_lifecycle_results WHERE kind = 'rr'),
  'true', 'flat round-robin generation succeeds atomically');
SELECT is((SELECT count(*)::integer FROM public.team_match_matches
  WHERE tournament_id = 'a9001000-0000-4000-8000-000000001000'),
  6, 'four teams receive all six round-robin matches');
SELECT is((SELECT count(*)::integer FROM public.team_match_games g
  JOIN public.team_match_matches m ON m.id = g.match_id
  WHERE m.tournament_id = 'a9001000-0000-4000-8000-000000001000'),
  18, 'round-robin commits every game with its matches');
SELECT is((SELECT count(*)::integer FROM (
  SELECT least(team_a_id, team_b_id), greatest(team_a_id, team_b_id)
  FROM public.team_match_matches
  WHERE tournament_id = 'a9001000-0000-4000-8000-000000001000'
  GROUP BY 1, 2
) pairs), 6, 'every flat round-robin pair is unique');
SELECT is((SELECT count(DISTINCT round_number)::integer FROM public.team_match_matches
  WHERE tournament_id = 'a9001000-0000-4000-8000-000000001000'),
  3, 'circle schedule has the expected rounds');
UPDATE tm_lifecycle_results SET result = public.generate_team_match_round_robin_atomic(
  'a9001000-0000-4000-8000-000000001000', '[]'::jsonb, false
)::jsonb WHERE kind = 'rr';
SELECT is((SELECT result ->> 'idempotent' FROM tm_lifecycle_results WHERE kind = 'rr'),
  'true', 'round-robin retry is idempotent');
SELECT is((SELECT count(*)::integer FROM public.team_match_matches
  WHERE tournament_id = 'a9001000-0000-4000-8000-000000001000'),
  6, 'round-robin retry creates no duplicate matches');

INSERT INTO tm_lifecycle_results VALUES (
  'groups', public.generate_team_match_round_robin_atomic(
    'a9002000-0000-4000-8000-000000002000',
    (SELECT jsonb_build_array(
      jsonb_agg(id ORDER BY seed) FILTER (WHERE seed <= 4),
      jsonb_agg(id ORDER BY seed) FILTER (WHERE seed > 4)
    ) FROM public.team_match_teams
      WHERE tournament_id = 'a9002000-0000-4000-8000-000000002000'),
    true
  )::jsonb
);
SELECT is((SELECT result ->> 'success' FROM tm_lifecycle_results WHERE kind = 'groups'),
  'true', 'group-stage generation succeeds atomically');
SELECT is((SELECT count(*)::integer FROM public.team_match_groups
  WHERE tournament_id = 'a9002000-0000-4000-8000-000000002000'),
  2, 'group-stage commits all groups');
SELECT is((SELECT count(*)::integer FROM public.team_match_teams
  WHERE tournament_id = 'a9002000-0000-4000-8000-000000002000' AND group_id IS NOT NULL),
  8, 'group-stage assigns every approved team');
SELECT is((SELECT count(*)::integer FROM public.team_match_matches
  WHERE tournament_id = 'a9002000-0000-4000-8000-000000002000'),
  12, 'two four-team groups receive twelve matches');
SELECT is((SELECT count(*)::integer FROM public.team_match_games g
  JOIN public.team_match_matches m ON m.id = g.match_id
  WHERE m.tournament_id = 'a9002000-0000-4000-8000-000000002000'),
  36, 'group-stage games commit with the schedule');
SELECT is((SELECT status::text || ':' || group_count::text
  FROM public.team_match_tournaments WHERE id = 'a9002000-0000-4000-8000-000000002000'),
  'ongoing:2', 'group-stage advances tournament state in the same transaction');
SELECT is((SELECT count(*)::integer FROM public.team_match_matches m
  JOIN public.team_match_teams a ON a.id = m.team_a_id
  JOIN public.team_match_teams b ON b.id = m.team_b_id
  WHERE m.tournament_id = 'a9002000-0000-4000-8000-000000002000'
    AND (a.group_id <> m.group_id OR b.group_id <> m.group_id)),
  0, 'group schedule never creates a cross-group match');
UPDATE tm_lifecycle_results SET result = public.generate_team_match_round_robin_atomic(
  'a9002000-0000-4000-8000-000000002000',
  (SELECT jsonb_build_array(
    jsonb_agg(id ORDER BY seed) FILTER (WHERE seed <= 4),
    jsonb_agg(id ORDER BY seed) FILTER (WHERE seed > 4)
  ) FROM public.team_match_teams
    WHERE tournament_id = 'a9002000-0000-4000-8000-000000002000'),
  true
)::jsonb WHERE kind = 'groups';
SELECT is((SELECT result ->> 'idempotent' FROM tm_lifecycle_results WHERE kind = 'groups'),
  'true', 'committed group-stage retry is idempotent');

INSERT INTO tm_lifecycle_results VALUES (
  'single', public.generate_team_match_brackets_atomic(
    'a9003000-0000-4000-8000-000000003000',
    (SELECT jsonb_build_array(jsonb_build_object(
      'is_repechage', false,
      'first_round', jsonb_build_array(
        jsonb_build_object('team_a_id', (min(id::text) FILTER (WHERE seed = 1))::uuid, 'team_b_id', (min(id::text) FILTER (WHERE seed = 4))::uuid),
        jsonb_build_object('team_a_id', (min(id::text) FILTER (WHERE seed = 2))::uuid, 'team_b_id', (min(id::text) FILTER (WHERE seed = 3))::uuid)
      )
    )) FROM public.team_match_teams
      WHERE tournament_id = 'a9003000-0000-4000-8000-000000003000')
  )::jsonb
);
SELECT is((SELECT result ->> 'success' FROM tm_lifecycle_results WHERE kind = 'single'),
  'true', 'single-elimination tree generation succeeds atomically');
SELECT is((SELECT count(*)::integer FROM public.team_match_matches
  WHERE tournament_id = 'a9003000-0000-4000-8000-000000003000'
    AND is_playoff AND NOT is_third_place),
  3, 'four-team single elimination has a complete three-node tree');
SELECT is((SELECT count(*)::integer FROM public.team_match_matches
  WHERE tournament_id = 'a9003000-0000-4000-8000-000000003000' AND is_third_place),
  1, 'single-elimination third-place match commits with the tree');
SELECT is((SELECT count(*)::integer FROM public.team_match_matches
  WHERE tournament_id = 'a9003000-0000-4000-8000-000000003000'
    AND playoff_round = 2 AND next_match_id IS NOT NULL AND next_match_slot IN (1, 2)),
  2, 'both semifinals are linked to distinct final slots');
SELECT is((SELECT count(*)::integer FROM public.team_match_games g
  JOIN public.team_match_matches m ON m.id = g.match_id
  WHERE m.tournament_id = 'a9003000-0000-4000-8000-000000003000'),
  6, 'only ready first-round matches receive games');
UPDATE tm_lifecycle_results SET result = public.generate_team_match_brackets_atomic(
  'a9003000-0000-4000-8000-000000003000',
  (SELECT jsonb_build_array(jsonb_build_object(
    'is_repechage', false,
    'first_round', jsonb_build_array(
      jsonb_build_object('team_a_id', (min(id::text) FILTER (WHERE seed = 1))::uuid, 'team_b_id', (min(id::text) FILTER (WHERE seed = 4))::uuid),
      jsonb_build_object('team_a_id', (min(id::text) FILTER (WHERE seed = 2))::uuid, 'team_b_id', (min(id::text) FILTER (WHERE seed = 3))::uuid)
    )
  )) FROM public.team_match_teams
    WHERE tournament_id = 'a9003000-0000-4000-8000-000000003000')
)::jsonb WHERE kind = 'single';
SELECT is((SELECT result ->> 'idempotent' FROM tm_lifecycle_results WHERE kind = 'single'),
  'true', 'single-elimination retry is idempotent');
SELECT is((SELECT count(*)::integer FROM public.team_match_matches
  WHERE tournament_id = 'a9003000-0000-4000-8000-000000003000'),
  4, 'single-elimination retry duplicates no nodes');

-- Completed group-stage sentinel permits main + repechage in one transaction.
RESET ROLE;
INSERT INTO public.team_match_matches (
  tournament_id, team_a_id, team_b_id, round_number, is_playoff, status
)
SELECT 'a9004000-0000-4000-8000-000000004000',
       (min(id::text) FILTER (WHERE seed = 1))::uuid, (min(id::text) FILTER (WHERE seed = 2))::uuid,
       1, false, 'completed'
FROM public.team_match_teams WHERE tournament_id = 'a9004000-0000-4000-8000-000000004000';
INSERT INTO public.team_match_matches (
  tournament_id, team_a_id, team_b_id, round_number, is_playoff, status
)
SELECT 'a9005000-0000-4000-8000-000000005000',
       (min(id::text) FILTER (WHERE seed = 1))::uuid, (min(id::text) FILTER (WHERE seed = 2))::uuid,
       1, false, 'pending'
FROM public.team_match_teams WHERE tournament_id = 'a9005000-0000-4000-8000-000000005000';
SET LOCAL ROLE authenticated;

INSERT INTO tm_lifecycle_results VALUES (
  'both-branches', public.generate_team_match_brackets_atomic(
    'a9004000-0000-4000-8000-000000004000',
    (SELECT jsonb_build_array(
      jsonb_build_object('is_repechage', false, 'first_round', jsonb_build_array(
        jsonb_build_object('team_a_id', (min(id::text) FILTER (WHERE seed = 1))::uuid, 'team_b_id', (min(id::text) FILTER (WHERE seed = 4))::uuid),
        jsonb_build_object('team_a_id', (min(id::text) FILTER (WHERE seed = 2))::uuid, 'team_b_id', (min(id::text) FILTER (WHERE seed = 3))::uuid)
      )),
      jsonb_build_object('is_repechage', true, 'first_round', jsonb_build_array(
        jsonb_build_object('team_a_id', (min(id::text) FILTER (WHERE seed = 5))::uuid, 'team_b_id', (min(id::text) FILTER (WHERE seed = 8))::uuid),
        jsonb_build_object('team_a_id', (min(id::text) FILTER (WHERE seed = 6))::uuid, 'team_b_id', (min(id::text) FILTER (WHERE seed = 7))::uuid)
      ))
    ) FROM public.team_match_teams
      WHERE tournament_id = 'a9004000-0000-4000-8000-000000004000')
  )::jsonb
);
SELECT is((SELECT result ->> 'success' FROM tm_lifecycle_results WHERE kind = 'both-branches'),
  'true', 'main and repechage brackets commit in one transaction');
SELECT is((SELECT count(*)::integer FROM public.team_match_matches
  WHERE tournament_id = 'a9004000-0000-4000-8000-000000004000'
    AND is_playoff AND NOT is_repechage), 3, 'main playoff tree is complete');
SELECT is((SELECT count(*)::integer FROM public.team_match_matches
  WHERE tournament_id = 'a9004000-0000-4000-8000-000000004000'
    AND is_playoff AND is_repechage), 3, 'repechage tree is complete');
SELECT is((SELECT count(*)::integer FROM public.team_match_games g
  JOIN public.team_match_matches m ON m.id = g.match_id
  WHERE m.tournament_id = 'a9004000-0000-4000-8000-000000004000'),
  12, 'both branches seed all ready games atomically');
SELECT is((SELECT count(*)::integer FROM public.team_match_matches
  WHERE tournament_id = 'a9004000-0000-4000-8000-000000004000'
    AND is_playoff AND playoff_round = 2 AND next_match_id IS NOT NULL),
  4, 'every first-round node in both branches links forward');

-- A later repechage-only request must still be checked against the existing
-- main branch. This is the recovery path when main qualification completed
-- before hạng 3/4 became available.
RESET ROLE;
DELETE FROM public.team_match_matches
WHERE tournament_id = 'a9004000-0000-4000-8000-000000004000'
  AND is_playoff AND is_repechage;
SET LOCAL ROLE authenticated;
INSERT INTO tm_lifecycle_results VALUES (
  'late-overlap', public.generate_team_match_brackets_atomic(
    'a9004000-0000-4000-8000-000000004000',
    (SELECT jsonb_build_array(jsonb_build_object(
      'is_repechage', true, 'first_round', jsonb_build_array(
        jsonb_build_object('team_a_id', (min(id::text) FILTER (WHERE seed = 1))::uuid, 'team_b_id', (min(id::text) FILTER (WHERE seed = 4))::uuid),
        jsonb_build_object('team_a_id', (min(id::text) FILTER (WHERE seed = 2))::uuid, 'team_b_id', (min(id::text) FILTER (WHERE seed = 3))::uuid)
      )
    )) FROM public.team_match_teams
      WHERE tournament_id = 'a9004000-0000-4000-8000-000000004000')
  )::jsonb
);
SELECT is((SELECT result ->> 'error' FROM tm_lifecycle_results WHERE kind = 'late-overlap'),
  'DUPLICATE_BRACKET_TEAM', 'late repechage cannot reuse a main-bracket team');
SELECT is((SELECT count(*)::integer FROM public.team_match_matches
  WHERE tournament_id = 'a9004000-0000-4000-8000-000000004000'
    AND is_playoff AND is_repechage), 0, 'rejected late repechage writes no nodes');
INSERT INTO tm_lifecycle_results VALUES (
  'late-repechage', public.generate_team_match_brackets_atomic(
    'a9004000-0000-4000-8000-000000004000',
    (SELECT jsonb_build_array(jsonb_build_object(
      'is_repechage', true, 'first_round', jsonb_build_array(
        jsonb_build_object('team_a_id', (min(id::text) FILTER (WHERE seed = 5))::uuid, 'team_b_id', (min(id::text) FILTER (WHERE seed = 8))::uuid),
        jsonb_build_object('team_a_id', (min(id::text) FILTER (WHERE seed = 6))::uuid, 'team_b_id', (min(id::text) FILTER (WHERE seed = 7))::uuid)
      )
    )) FROM public.team_match_teams
      WHERE tournament_id = 'a9004000-0000-4000-8000-000000004000')
  )::jsonb
);
SELECT is((SELECT result ->> 'success' FROM tm_lifecycle_results WHERE kind = 'late-repechage'),
  'true', 'non-overlapping repechage may be added after main bracket');
SELECT is((SELECT count(*)::integer FROM public.team_match_matches
  WHERE tournament_id = 'a9004000-0000-4000-8000-000000004000'
    AND is_playoff AND is_repechage), 3, 'late repechage commits a complete tree');

INSERT INTO tm_lifecycle_results VALUES (
  'pending-bracket', public.generate_team_match_brackets_atomic(
    'a9005000-0000-4000-8000-000000005000',
    (SELECT jsonb_build_array(jsonb_build_object(
      'is_repechage', false, 'first_round', jsonb_build_array(
        jsonb_build_object('team_a_id', (min(id::text) FILTER (WHERE seed = 1))::uuid, 'team_b_id', (min(id::text) FILTER (WHERE seed = 4))::uuid),
        jsonb_build_object('team_a_id', (min(id::text) FILTER (WHERE seed = 2))::uuid, 'team_b_id', (min(id::text) FILTER (WHERE seed = 3))::uuid)
      )
    )) FROM public.team_match_teams
      WHERE tournament_id = 'a9005000-0000-4000-8000-000000005000')
  )::jsonb
);
SELECT is((SELECT result ->> 'error' FROM tm_lifecycle_results WHERE kind = 'pending-bracket'),
  'GROUP_STAGE_INCOMPLETE', 'playoff is rejected while group stage is incomplete');
SELECT is((SELECT count(*)::integer FROM public.team_match_matches
  WHERE tournament_id = 'a9005000-0000-4000-8000-000000005000' AND is_playoff),
  0, 'rejected playoff writes no bracket nodes');

INSERT INTO tm_lifecycle_results VALUES (
  'start-round', public.start_team_match_round_atomic(
    'a9001000-0000-4000-8000-000000001000', 1
  )::jsonb
);
SELECT is((SELECT result ->> 'updated' FROM tm_lifecycle_results WHERE kind = 'start-round'),
  '2', 'round start updates the whole round in one statement');
SELECT is((SELECT count(*)::integer FROM public.team_match_matches
  WHERE tournament_id = 'a9001000-0000-4000-8000-000000001000'
    AND round_number = 1 AND status = 'in_progress'),
  2, 'every match in selected round starts');
SELECT is((SELECT count(*)::integer FROM public.team_match_matches
  WHERE tournament_id = 'a9001000-0000-4000-8000-000000001000'
    AND round_number > 1 AND status = 'pending'),
  4, 'other rounds remain untouched');

INSERT INTO tm_lifecycle_results VALUES (
  'reset-groups', public.reset_team_match_lifecycle_atomic(
    'a9002000-0000-4000-8000-000000002000', 'group_stage'
  )::jsonb
);
SELECT is((SELECT result ->> 'success' FROM tm_lifecycle_results WHERE kind = 'reset-groups'),
  'true', 'group-stage reset succeeds atomically');
SELECT is((SELECT count(*)::integer FROM public.team_match_matches
  WHERE tournament_id = 'a9002000-0000-4000-8000-000000002000'),
  0, 'group reset removes all dependent matches');
SELECT is((SELECT count(*)::integer FROM public.team_match_groups
  WHERE tournament_id = 'a9002000-0000-4000-8000-000000002000'),
  0, 'group reset removes all groups');
SELECT is((SELECT count(*)::integer FROM public.team_match_teams
  WHERE tournament_id = 'a9002000-0000-4000-8000-000000002000' AND group_id IS NOT NULL),
  0, 'group reset clears every team assignment');
SELECT is((SELECT status::text || ':' || coalesce(group_count::text, 'null')
  FROM public.team_match_tournaments WHERE id = 'a9002000-0000-4000-8000-000000002000'),
  'registration:null', 'group reset restores tournament lifecycle state');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'a9000002-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"a9000002-0000-4000-8000-000000000002","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
INSERT INTO tm_lifecycle_results VALUES (
  'unauthorized-generate', public.generate_team_match_round_robin_atomic(
    'a9006000-0000-4000-8000-000000006000', '[]'::jsonb, false
  )::jsonb
);
SELECT is((SELECT result ->> 'error' FROM tm_lifecycle_results WHERE kind = 'unauthorized-generate'),
  'NOT_AUTHORIZED', 'non-owner cannot generate a schedule');
SELECT is((SELECT count(*)::integer FROM public.team_match_matches
  WHERE tournament_id = 'a9006000-0000-4000-8000-000000006000'),
  0, 'rejected generation writes no matches');
INSERT INTO tm_lifecycle_results VALUES (
  'unauthorized-reset', public.reset_team_match_lifecycle_atomic(
    'a9001000-0000-4000-8000-000000001000', 'schedule'
  )::jsonb
);
SELECT is((SELECT result ->> 'error' FROM tm_lifecycle_results WHERE kind = 'unauthorized-reset'),
  'NOT_AUTHORIZED', 'non-owner cannot reset a schedule');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.team_match_matches
  WHERE tournament_id = 'a9001000-0000-4000-8000-000000001000'),
  6, 'rejected reset changes nothing');

SELECT * FROM finish();
ROLLBACK;
