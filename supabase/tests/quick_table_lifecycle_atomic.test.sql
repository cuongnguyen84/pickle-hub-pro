-- Task 4 regression: QuickTable roster setup and playoff creation are
-- transactional lifecycle operations with server-side validation.

BEGIN;

SELECT plan(50);

SELECT has_function(
  'public', 'setup_quick_table_roster_atomic',
  ARRAY['uuid', 'jsonb', 'jsonb', 'jsonb', 'text'],
  'atomic QuickTable setup RPC exists'
);
SELECT has_function(
  'public', 'create_quick_table_playoff_atomic',
  ARRAY['uuid', 'jsonb', 'jsonb'],
  'atomic QuickTable playoff RPC exists'
);
SELECT ok(has_function_privilege(
  'authenticated',
  'public.setup_quick_table_roster_atomic(uuid,jsonb,jsonb,jsonb,text)',
  'EXECUTE'
), 'authenticated may set up QuickTable atomically');
SELECT ok(NOT has_function_privilege(
  'anon',
  'public.setup_quick_table_roster_atomic(uuid,jsonb,jsonb,jsonb,text)',
  'EXECUTE'
), 'anon may not set up QuickTable atomically');
SELECT ok(has_function_privilege(
  'authenticated',
  'public.create_quick_table_playoff_atomic(uuid,jsonb,jsonb)',
  'EXECUTE'
), 'authenticated may create QuickTable playoff atomically');
SELECT ok(NOT has_function_privilege(
  'anon',
  'public.create_quick_table_playoff_atomic(uuid,jsonb,jsonb)',
  'EXECUTE'
), 'anon may not create QuickTable playoff atomically');

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    'a7000001-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'task4-qt-owner@thepicklehub.test', '', now(),
    '{"provider":"test","providers":["test"]}'::jsonb,
    '{"display_name":"Task 4 QT Owner"}'::jsonb, now(), now()
  ),
  (
    'a7000002-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'task4-qt-other@thepicklehub.test', '', now(),
    '{"provider":"test","providers":["test"]}'::jsonb,
    '{"display_name":"Task 4 QT Other"}'::jsonb, now(), now()
  );

INSERT INTO public.quick_tables (
  id, creator_user_id, name, player_count, format, status, group_count, share_id
) VALUES
  ('a7000010-0000-4000-8000-000000000010', 'a7000001-0000-4000-8000-000000000001',
   'QT Setup', 6, 'round_robin', 'setup', 2, 'task4qtsetup'),
  ('a7000020-0000-4000-8000-000000000020', 'a7000001-0000-4000-8000-000000000001',
   'QT Playoff', 8, 'round_robin', 'setup', 2, 'task4qtplayoff'),
  ('a7000030-0000-4000-8000-000000000030', 'a7000001-0000-4000-8000-000000000001',
   'QT Incomplete', 4, 'round_robin', 'setup', 2, 'task4qtincomplete'),
  ('a7000040-0000-4000-8000-000000000040', 'a7000001-0000-4000-8000-000000000001',
   'QT Unauthorized', 4, 'round_robin', 'setup', 2, 'task4qtunauthorized'),
  ('a7000050-0000-4000-8000-000000000050', 'a7000001-0000-4000-8000-000000000001',
   'QT Bye', 6, 'round_robin', 'setup', 2, 'task4qtbye'),
  ('a7000060-0000-4000-8000-000000000060', 'a7000001-0000-4000-8000-000000000001',
   'QT Large', 4, 'large_playoff', 'setup', NULL, 'task4qtlarge');

CREATE TEMP TABLE qt_atomic_results (kind text PRIMARY KEY, result jsonb NOT NULL);
GRANT SELECT, INSERT, UPDATE ON qt_atomic_results TO authenticated;
-- Production read access is intentionally narrower on some child tables. The
-- test role needs visibility only so pgTAP can assert the transaction outcome;
-- this grant is rolled back with the test.
GRANT SELECT ON public.quick_tables, public.quick_table_players,
  public.quick_table_groups, public.quick_table_matches TO authenticated;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a7000001-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"a7000001-0000-4000-8000-000000000001","role":"authenticated"}', true);

INSERT INTO qt_atomic_results VALUES (
  'invalid-setup',
  public.setup_quick_table_roster_atomic(
    'a7000010-0000-4000-8000-000000000010',
    '[{"name":"One"},{"name":"Two"}]'::jsonb,
    '[0]'::jsonb,
    '[]'::jsonb,
    NULL
  )::jsonb
);
SELECT is((SELECT result ->> 'error' FROM qt_atomic_results WHERE kind = 'invalid-setup'),
  'INVALID_ASSIGNMENTS', 'invalid assignment plan is rejected');
SELECT is((SELECT count(*)::integer FROM public.quick_table_players
  WHERE table_id = 'a7000010-0000-4000-8000-000000000010'),
  0, 'invalid setup writes no players');

INSERT INTO qt_atomic_results VALUES (
  'setup',
  public.setup_quick_table_roster_atomic(
    'a7000010-0000-4000-8000-000000000010',
    '[
      {"name":"One","team":"Red","seed":1},
      {"name":"Two","team":"Blue","seed":2},
      {"name":"Three","team":"Green"},
      {"name":"Four","team":"Red"},
      {"name":"Five","team":"Blue"},
      {"name":"Six","team":"Green"}
    ]'::jsonb,
    '[0,0,0,1,1,1]'::jsonb,
    '[1,2]'::jsonb,
    '08:00'
  )::jsonb
);
SELECT is((SELECT result ->> 'success' FROM qt_atomic_results WHERE kind = 'setup'),
  'true', 'atomic QuickTable setup succeeds');
SELECT is((SELECT count(*)::integer FROM public.quick_table_players
  WHERE table_id = 'a7000010-0000-4000-8000-000000000010'),
  6, 'setup commits the whole roster');
SELECT is((SELECT count(*)::integer FROM public.quick_table_groups
  WHERE table_id = 'a7000010-0000-4000-8000-000000000010'),
  2, 'setup commits all groups');
SELECT is((SELECT count(*)::integer FROM public.quick_table_matches
  WHERE table_id = 'a7000010-0000-4000-8000-000000000010' AND NOT is_playoff),
  6, 'setup creates every round-robin pair');
SELECT is((SELECT status::text FROM public.quick_tables
  WHERE id = 'a7000010-0000-4000-8000-000000000010'),
  'group_stage', 'setup advances lifecycle to group stage');
SELECT is((SELECT player_count FROM public.quick_tables
  WHERE id = 'a7000010-0000-4000-8000-000000000010'),
  6, 'stored player count follows the committed roster');
SELECT is((SELECT courts::text FROM public.quick_tables
  WHERE id = 'a7000010-0000-4000-8000-000000000010'),
  '{1,2}', 'setup saves normalized court settings');
SELECT results_eq(
  $$ SELECT g.display_order, count(*)::bigint
     FROM public.quick_table_players p
     JOIN public.quick_table_groups g ON g.id = p.group_id
     WHERE p.table_id = 'a7000010-0000-4000-8000-000000000010'
     GROUP BY g.display_order ORDER BY g.display_order $$,
  $$ VALUES (0, 3::bigint), (1, 3::bigint) $$,
  'explicit group assignment is committed exactly'
);
SELECT is((
  SELECT count(*)::integer
  FROM (
    SELECT group_id, LEAST(player1_id, player2_id), GREATEST(player1_id, player2_id)
    FROM public.quick_table_matches
    WHERE table_id = 'a7000010-0000-4000-8000-000000000010' AND NOT is_playoff
    GROUP BY group_id, LEAST(player1_id, player2_id), GREATEST(player1_id, player2_id)
  ) pairs
), 6, 'round-robin pairs are unique');
SELECT is((
  SELECT count(*)::integer
  FROM (
    SELECT player_id, start_at
    FROM (
      SELECT player1_id AS player_id, start_at FROM public.quick_table_matches
      WHERE table_id = 'a7000010-0000-4000-8000-000000000010' AND NOT is_playoff
      UNION ALL
      SELECT player2_id, start_at FROM public.quick_table_matches
      WHERE table_id = 'a7000010-0000-4000-8000-000000000010' AND NOT is_playoff
    ) appearances
    GROUP BY player_id, start_at HAVING count(*) > 1
  ) collisions
), 0, 'court schedule never double-books a player');

UPDATE qt_atomic_results
SET result = public.setup_quick_table_roster_atomic(
  'a7000010-0000-4000-8000-000000000010', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, NULL
)::jsonb
WHERE kind = 'setup';
SELECT is((SELECT result ->> 'idempotent' FROM qt_atomic_results WHERE kind = 'setup'),
  'true', 'lost-response setup retry is idempotent');
SELECT is((SELECT count(*)::integer FROM public.quick_table_matches
  WHERE table_id = 'a7000010-0000-4000-8000-000000000010'),
  6, 'setup retry does not duplicate matches');

INSERT INTO qt_atomic_results (kind, result)
SELECT 'large-setup', public.setup_quick_table_roster_atomic(
  'a7000060-0000-4000-8000-000000000060',
  '[{"name":"L1"},{"name":"L2"},{"name":"L3"},{"name":"L4"}]'::jsonb,
  '[0,0,0,0]'::jsonb, '[]'::jsonb, NULL
)::jsonb;
SELECT is((SELECT result ->> 'success' FROM qt_atomic_results WHERE kind = 'large-setup'),
  'true', 'large-playoff roster setup also commits atomically');
SELECT is((SELECT count(*)::integer FROM public.quick_table_players
  WHERE table_id = 'a7000060-0000-4000-8000-000000000060'),
  4, 'large-playoff setup commits its roster');
SELECT is((
  (SELECT count(*) FROM public.quick_table_groups
   WHERE table_id = 'a7000060-0000-4000-8000-000000000060')
  +
  (SELECT count(*) FROM public.quick_table_matches
   WHERE table_id = 'a7000060-0000-4000-8000-000000000060')
)::integer, 0, 'large-playoff setup does not invent round-robin rows');
SELECT is((SELECT status::text FROM public.quick_tables
  WHERE id = 'a7000060-0000-4000-8000-000000000060'),
  'group_stage', 'large-playoff roster advances lifecycle once committed');

INSERT INTO qt_atomic_results (kind, result)
SELECT 'playoff-setup', public.setup_quick_table_roster_atomic(
  'a7000020-0000-4000-8000-000000000020',
  (SELECT jsonb_agg(jsonb_build_object('name', 'Playoff ' || i, 'seed', i) ORDER BY i)
   FROM generate_series(1, 8) AS roster(i)),
  '[0,0,0,0,1,1,1,1]'::jsonb, '[]'::jsonb, NULL
)::jsonb;
SELECT is((SELECT result ->> 'success' FROM qt_atomic_results WHERE kind = 'playoff-setup'),
  'true', 'playoff fixture setup succeeds atomically');

RESET ROLE;
UPDATE public.quick_table_matches
SET score1 = 11, score2 = 5, winner_id = player1_id, status = 'completed'
WHERE table_id = 'a7000020-0000-4000-8000-000000000020' AND NOT is_playoff;
SET LOCAL ROLE authenticated;

INSERT INTO qt_atomic_results (kind, result)
SELECT 'playoff', public.create_quick_table_playoff_atomic(
  'a7000020-0000-4000-8000-000000000020',
  (SELECT jsonb_agg(jsonb_build_object(
      'player_id', id,
      'playoff_seed', display_order + 1,
      'is_wildcard', display_order = 3
    ) ORDER BY display_order)
   FROM public.quick_table_players
   WHERE table_id = 'a7000020-0000-4000-8000-000000000020' AND display_order < 4),
  (WITH p AS (
     SELECT id, display_order FROM public.quick_table_players
     WHERE table_id = 'a7000020-0000-4000-8000-000000000020' AND display_order < 4
   )
   SELECT jsonb_build_array(
     jsonb_build_object('player1_id', (SELECT id FROM p WHERE display_order = 0),
                        'player2_id', (SELECT id FROM p WHERE display_order = 3),
                        'bracket_position', 'upper', 'match_number', 1),
     jsonb_build_object('player1_id', (SELECT id FROM p WHERE display_order = 1),
                        'player2_id', (SELECT id FROM p WHERE display_order = 2),
                        'bracket_position', 'lower', 'match_number', 2)
   ))
)::jsonb;
SELECT is((SELECT result ->> 'success' FROM qt_atomic_results WHERE kind = 'playoff'),
  'true', 'atomic QuickTable playoff creation succeeds');
SELECT is((SELECT count(*)::integer FROM public.quick_table_players
  WHERE table_id = 'a7000020-0000-4000-8000-000000000020' AND is_qualified),
  4, 'playoff marks exactly the supplied qualifiers');
SELECT is((SELECT count(*)::integer FROM public.quick_table_players
  WHERE table_id = 'a7000020-0000-4000-8000-000000000020'
    AND is_wildcard AND playoff_seed = 4),
  1, 'playoff preserves explicit wildcard seed metadata');
SELECT is((SELECT count(*)::integer FROM public.quick_table_matches
  WHERE table_id = 'a7000020-0000-4000-8000-000000000020' AND is_playoff),
  3, 'playoff pre-creates the full tree');
SELECT is((SELECT count(DISTINCT playoff_round)::integer FROM public.quick_table_matches
  WHERE table_id = 'a7000020-0000-4000-8000-000000000020' AND is_playoff),
  2, 'pre-created playoff tree has both rounds');
SELECT is((SELECT status::text FROM public.quick_tables
  WHERE id = 'a7000020-0000-4000-8000-000000000020'),
  'playoff', 'playoff creation advances table lifecycle');
SELECT is((SELECT count(*)::integer FROM public.quick_table_matches
  WHERE table_id = 'a7000020-0000-4000-8000-000000000020'
    AND is_playoff AND playoff_round = 2 AND next_match_id IS NOT NULL),
  2, 'first-round matches link to the pre-created final');
SELECT is((SELECT count(*)::integer FROM public.quick_table_matches
  WHERE table_id = 'a7000020-0000-4000-8000-000000000020'
    AND is_playoff AND playoff_round = 3
    AND player1_id IS NULL AND player2_id IS NULL),
  1, 'final begins empty until winners advance');

INSERT INTO qt_atomic_results (kind, result)
SELECT 'score-one', public.score_quick_table_match_atomic(id, 11, 4, score_version)::jsonb
FROM public.quick_table_matches
WHERE table_id = 'a7000020-0000-4000-8000-000000000020'
  AND is_playoff AND playoff_round = 2 AND playoff_match_number = 1;
SELECT is((SELECT result ->> 'success' FROM qt_atomic_results WHERE kind = 'score-one'),
  'true', 'atomic scoring advances into pre-created playoff tree');
SELECT is((SELECT count(*)::integer FROM public.quick_table_matches
  WHERE table_id = 'a7000020-0000-4000-8000-000000000020'
    AND is_playoff AND playoff_round = 3
    AND player1_id IS NOT NULL AND player2_id IS NULL),
  1, 'first playoff winner fills the correct final slot');

INSERT INTO qt_atomic_results (kind, result)
SELECT 'score-two', public.score_quick_table_match_atomic(id, 7, 11, score_version)::jsonb
FROM public.quick_table_matches
WHERE table_id = 'a7000020-0000-4000-8000-000000000020'
  AND is_playoff AND playoff_round = 2 AND playoff_match_number = 2;
SELECT is((SELECT result ->> 'success' FROM qt_atomic_results WHERE kind = 'score-two'),
  'true', 'second playoff winner also advances atomically');
SELECT is((SELECT count(*)::integer FROM public.quick_table_matches
  WHERE table_id = 'a7000020-0000-4000-8000-000000000020'
    AND is_playoff AND playoff_round = 3
    AND player1_id IS NOT NULL AND player2_id IS NOT NULL),
  1, 'pre-created final receives both winners');

UPDATE qt_atomic_results
SET result = public.create_quick_table_playoff_atomic(
  'a7000020-0000-4000-8000-000000000020', '[]'::jsonb, '[]'::jsonb
)::jsonb
WHERE kind = 'playoff';
SELECT is((SELECT result ->> 'idempotent' FROM qt_atomic_results WHERE kind = 'playoff'),
  'true', 'lost-response playoff retry is idempotent');
SELECT is((SELECT count(*)::integer FROM public.quick_table_matches
  WHERE table_id = 'a7000020-0000-4000-8000-000000000020' AND is_playoff),
  3, 'playoff retry does not duplicate its tree');

INSERT INTO qt_atomic_results (kind, result)
SELECT 'incomplete-setup', public.setup_quick_table_roster_atomic(
  'a7000030-0000-4000-8000-000000000030',
  '[{"name":"I1"},{"name":"I2"},{"name":"I3"},{"name":"I4"}]'::jsonb,
  '[0,0,1,1]'::jsonb, '[]'::jsonb, NULL
)::jsonb;
SELECT is((SELECT result ->> 'success' FROM qt_atomic_results WHERE kind = 'incomplete-setup'),
  'true', 'incomplete playoff fixture setup succeeds');
INSERT INTO qt_atomic_results (kind, result)
SELECT 'incomplete-playoff', public.create_quick_table_playoff_atomic(
  'a7000030-0000-4000-8000-000000000030',
  (SELECT jsonb_agg(jsonb_build_object(
    'player_id', id, 'playoff_seed', display_order + 1, 'is_wildcard', false
  )) FROM public.quick_table_players
  WHERE table_id = 'a7000030-0000-4000-8000-000000000030'),
  '[]'::jsonb
)::jsonb;
SELECT is((SELECT result ->> 'error' FROM qt_atomic_results WHERE kind = 'incomplete-playoff'),
  'GROUP_STAGE_INCOMPLETE', 'playoff cannot start before all group matches finish');
SELECT is((SELECT count(*)::integer FROM public.quick_table_matches
  WHERE table_id = 'a7000030-0000-4000-8000-000000000030' AND is_playoff),
  0, 'incomplete playoff attempt writes no bracket rows');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'a7000002-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"a7000002-0000-4000-8000-000000000002","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
INSERT INTO qt_atomic_results VALUES (
  'unauthorized',
  public.setup_quick_table_roster_atomic(
    'a7000040-0000-4000-8000-000000000040',
    '[{"name":"U1"},{"name":"U2"},{"name":"U3"},{"name":"U4"}]'::jsonb,
    '[0,0,1,1]'::jsonb, '[]'::jsonb, NULL
  )::jsonb
);
SELECT is((SELECT result ->> 'error' FROM qt_atomic_results WHERE kind = 'unauthorized'),
  'NOT_AUTHORIZED', 'non-owner cannot set up a QuickTable');
SELECT is((SELECT count(*)::integer FROM public.quick_table_players
  WHERE table_id = 'a7000040-0000-4000-8000-000000000040'),
  0, 'unauthorized setup writes no roster rows');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'a7000001-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"a7000001-0000-4000-8000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
INSERT INTO qt_atomic_results (kind, result)
SELECT 'bye-setup', public.setup_quick_table_roster_atomic(
  'a7000050-0000-4000-8000-000000000050',
  (SELECT jsonb_agg(jsonb_build_object('name', 'Bye ' || i) ORDER BY i)
   FROM generate_series(1, 6) AS roster(i)),
  '[0,0,0,1,1,1]'::jsonb, '[]'::jsonb, NULL
)::jsonb;
SELECT is((SELECT result ->> 'success' FROM qt_atomic_results WHERE kind = 'bye-setup'),
  'true', 'BYE fixture setup succeeds');

RESET ROLE;
UPDATE public.quick_table_matches
SET score1 = 11, score2 = 5, winner_id = player1_id, status = 'completed'
WHERE table_id = 'a7000050-0000-4000-8000-000000000050' AND NOT is_playoff;
SET LOCAL ROLE authenticated;

INSERT INTO qt_atomic_results (kind, result)
SELECT 'bye-playoff', public.create_quick_table_playoff_atomic(
  'a7000050-0000-4000-8000-000000000050',
  (SELECT jsonb_agg(jsonb_build_object(
      'player_id', id, 'playoff_seed', display_order + 1, 'is_wildcard', display_order >= 4
    ) ORDER BY display_order)
   FROM public.quick_table_players
   WHERE table_id = 'a7000050-0000-4000-8000-000000000050'),
  (WITH p AS (
     SELECT id, display_order FROM public.quick_table_players
     WHERE table_id = 'a7000050-0000-4000-8000-000000000050'
   )
   SELECT jsonb_build_array(
     jsonb_build_object('player1_id', (SELECT id FROM p WHERE display_order = 0),
                        'player2_id', NULL, 'bracket_position', 'upper', 'match_number', 1),
     jsonb_build_object('player1_id', (SELECT id FROM p WHERE display_order = 1),
                        'player2_id', (SELECT id FROM p WHERE display_order = 2),
                        'bracket_position', 'upper', 'match_number', 2),
     jsonb_build_object('player1_id', (SELECT id FROM p WHERE display_order = 3),
                        'player2_id', NULL, 'bracket_position', 'lower', 'match_number', 3),
     jsonb_build_object('player1_id', (SELECT id FROM p WHERE display_order = 4),
                        'player2_id', (SELECT id FROM p WHERE display_order = 5),
                        'bracket_position', 'lower', 'match_number', 4)
   ))
)::jsonb;
SELECT is((SELECT result ->> 'success' FROM qt_atomic_results WHERE kind = 'bye-playoff'),
  'true', 'atomic playoff accepts a validated BYE bracket');
SELECT is((SELECT count(*)::integer FROM public.quick_table_matches
  WHERE table_id = 'a7000050-0000-4000-8000-000000000050' AND is_playoff),
  7, 'BYE playoff still pre-creates every tree node');
SELECT is((SELECT count(*)::integer FROM public.quick_table_matches
  WHERE table_id = 'a7000050-0000-4000-8000-000000000050'
    AND is_playoff AND playoff_round = 1 AND status = 'completed'),
  2, 'first-round BYEs are resolved as completed walkovers');
SELECT is((SELECT count(*)::integer FROM public.quick_table_matches
  WHERE table_id = 'a7000050-0000-4000-8000-000000000050'
    AND is_playoff AND playoff_round = 2 AND status = 'pending'
    AND ((player1_id IS NULL) <> (player2_id IS NULL))),
  2, 'BYE winners are propagated while unresolved sibling slots stay pending');
SELECT is((SELECT status::text FROM public.quick_tables
  WHERE id = 'a7000050-0000-4000-8000-000000000050'),
  'playoff', 'BYE bracket enters playoff status');

SELECT * FROM finish();
ROLLBACK;
