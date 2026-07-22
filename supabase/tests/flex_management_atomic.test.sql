-- Task 4 regression: Flex creation/count limits and standings configuration
-- are server-owned transactional mutations.

BEGIN;

SELECT plan(30);

SELECT has_function('public', 'create_flex_tournament_atomic',
  ARRAY['text', 'boolean', 'jsonb'], 'atomic Flex create RPC exists');
SELECT has_function('public', 'create_flex_entity_atomic',
  ARRAY['uuid', 'text', 'text', 'integer', 'text', 'uuid', 'uuid'],
  'count-locked Flex entity RPC exists');
SELECT has_function('public', 'update_flex_match_standings_atomic',
  ARRAY['uuid', 'boolean', 'uuid'], 'atomic Flex match config RPC exists');
SELECT has_function('public', 'update_flex_group_standings_atomic',
  ARRAY['uuid', 'boolean'], 'atomic Flex group config RPC exists');
SELECT ok(has_function_privilege('authenticated',
  'public.create_flex_tournament_atomic(text,boolean,jsonb)', 'EXECUTE'),
  'authenticated may create Flex atomically');
SELECT ok(NOT has_function_privilege('anon',
  'public.create_flex_tournament_atomic(text,boolean,jsonb)', 'EXECUTE'),
  'anon may not create Flex atomically');
SELECT ok(NOT has_function_privilege('authenticated',
  'public.rebuild_flex_group_stats_locked(uuid)', 'EXECUTE'),
  'standings rebuild helper is not client-callable');

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    'a6000001-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'task4-flex-owner@thepicklehub.test', '', now(),
    '{"provider":"test","providers":["test"]}'::jsonb,
    '{"display_name":"Task 4 Flex Owner"}'::jsonb, now(), now()
  ),
  (
    'a6000002-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'task4-flex-other@thepicklehub.test', '', now(),
    '{"provider":"test","providers":["test"]}'::jsonb,
    '{"display_name":"Task 4 Flex Other"}'::jsonb, now(), now()
  );

CREATE TEMP TABLE flex_atomic_results (kind text PRIMARY KEY, result jsonb NOT NULL);
GRANT SELECT, INSERT ON flex_atomic_results TO authenticated;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a6000001-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"a6000001-0000-4000-8000-000000000001","role":"authenticated"}', true);

INSERT INTO flex_atomic_results VALUES (
  'invalid',
  public.create_flex_tournament_atomic('Invalid Flex', true, '{"bad":true}'::jsonb)::jsonb
);
SELECT is((SELECT result ->> 'error' FROM flex_atomic_results WHERE kind = 'invalid'),
  'INVALID_PLAYER_PAYLOAD', 'invalid player payload is rejected');
SELECT is((SELECT count(*)::integer FROM public.flex_tournaments WHERE name = 'Invalid Flex'),
  0, 'invalid Flex create writes no tournament');

INSERT INTO flex_atomic_results VALUES (
  'create',
  public.create_flex_tournament_atomic(
    'Atomic Flex', true, '["One","Two","Three"]'::jsonb
  )::jsonb
);

SELECT is((SELECT result ->> 'success' FROM flex_atomic_results WHERE kind = 'create'),
  'true', 'atomic Flex create succeeds');
SELECT is((SELECT count(*)::integer FROM public.flex_players p
  JOIN public.flex_tournaments t ON t.id = p.tournament_id
  WHERE t.name = 'Atomic Flex'), 3, 'atomic Flex create commits its players');
SELECT is((SELECT count(*)::integer FROM public.flex_groups g
  JOIN public.flex_tournaments t ON t.id = g.tournament_id
  WHERE t.name = 'Atomic Flex'), 1, 'atomic Flex create commits the preset group');
SELECT is((SELECT count(*)::integer FROM public.flex_matches m
  JOIN public.flex_tournaments t ON t.id = m.tournament_id
  WHERE t.name = 'Atomic Flex'), 2, 'atomic Flex create commits both preset matches');

SELECT public.create_flex_entity_atomic(
  (SELECT id FROM public.flex_tournaments WHERE name = 'Atomic Flex'),
  'team', 'Team ' || i, -i, NULL, NULL, NULL
)
FROM generate_series(1, 20) AS teams(i);

SELECT is((SELECT count(*)::integer FROM public.flex_teams x
  JOIN public.flex_tournaments t ON t.id = x.tournament_id
  WHERE t.name = 'Atomic Flex'), 20, 'twenty Flex teams are allowed');
SELECT is(public.create_flex_entity_atomic(
  (SELECT id FROM public.flex_tournaments WHERE name = 'Atomic Flex'),
  'team', 'Team 21', -21, NULL, NULL, NULL
) ->> 'error', 'TEAM_LIMIT', 'twenty-first Flex team is rejected under the lock');
SELECT is((SELECT count(*)::integer FROM public.flex_teams x
  JOIN public.flex_tournaments t ON t.id = x.tournament_id
  WHERE t.name = 'Atomic Flex'), 20, 'failed count mutation inserts nothing');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'a6000002-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"a6000002-0000-4000-8000-000000000002","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT is(public.create_flex_entity_atomic(
  (SELECT id FROM public.flex_tournaments WHERE name = 'Atomic Flex'),
  'group', 'Unauthorized', 1, NULL, NULL, NULL
) ->> 'error', 'NOT_AUTHORIZED', 'non-owner cannot add a Flex entity');
RESET ROLE;

-- Standings fixtures use fixed IDs so old/new group effects are explicit.
INSERT INTO public.flex_tournaments (id, creator_user_id, name, share_id, is_public)
VALUES (
  'a6100000-0000-4000-8000-000000000001',
  'a6000001-0000-4000-8000-000000000001',
  'Flex config fixture', 'task4-flex-config', true
);
INSERT INTO public.flex_groups (id, tournament_id, name, display_order) VALUES
  ('a6110001-0000-4000-8000-000000000001', 'a6100000-0000-4000-8000-000000000001', 'A', 0),
  ('a6110002-0000-4000-8000-000000000002', 'a6100000-0000-4000-8000-000000000001', 'B', 1);
INSERT INTO public.flex_players (id, tournament_id, name, display_order) VALUES
  ('a6120001-0000-4000-8000-000000000001', 'a6100000-0000-4000-8000-000000000001', 'A1', 0),
  ('a6120002-0000-4000-8000-000000000002', 'a6100000-0000-4000-8000-000000000001', 'A2', 1),
  ('a6120003-0000-4000-8000-000000000003', 'a6100000-0000-4000-8000-000000000001', 'B1', 2),
  ('a6120004-0000-4000-8000-000000000004', 'a6100000-0000-4000-8000-000000000001', 'B2', 3);
INSERT INTO public.flex_group_items (group_id, item_type, player_id, display_order)
SELECT g.id, 'player', p.id, row_number() OVER (PARTITION BY g.id ORDER BY p.id) - 1
FROM public.flex_groups g
CROSS JOIN public.flex_players p
WHERE g.tournament_id = 'a6100000-0000-4000-8000-000000000001'
  AND p.tournament_id = g.tournament_id;
INSERT INTO public.flex_matches (
  id, tournament_id, group_id, name, match_type,
  slot_a1_player_id, slot_a2_player_id, slot_b1_player_id, slot_b2_player_id
) VALUES (
  'a6130000-0000-4000-8000-000000000001',
  'a6100000-0000-4000-8000-000000000001',
  'a6110001-0000-4000-8000-000000000001', 'Doubles', 'doubles',
  'a6120001-0000-4000-8000-000000000001',
  'a6120002-0000-4000-8000-000000000002',
  'a6120003-0000-4000-8000-000000000003',
  'a6120004-0000-4000-8000-000000000004'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a6000001-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"a6000001-0000-4000-8000-000000000001","role":"authenticated"}', true);

SELECT is(public.score_flex_match_atomic(
  'a6130000-0000-4000-8000-000000000001', 11, 5, 0
) ->> 'success', 'true', 'fixture score builds initial standings');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.flex_player_stats
  WHERE group_id = 'a6110001-0000-4000-8000-000000000001'), 4,
  'initial group has four player standings rows');

SET LOCAL ROLE authenticated;
SELECT is(public.update_flex_match_standings_atomic(
  'a6130000-0000-4000-8000-000000000001', true,
  'a6110002-0000-4000-8000-000000000002'
) ->> 'success', 'true', 'moving a match rebuilds both groups atomically');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.flex_player_stats
  WHERE group_id = 'a6110001-0000-4000-8000-000000000001'), 0,
  'old group standings are cleared in the move');
SELECT is((SELECT count(*)::integer FROM public.flex_player_stats
  WHERE group_id = 'a6110002-0000-4000-8000-000000000002'), 4,
  'new group standings are rebuilt in the move');

SET LOCAL ROLE authenticated;
SELECT is(public.update_flex_match_standings_atomic(
  'a6130000-0000-4000-8000-000000000001', false,
  'a6110002-0000-4000-8000-000000000002'
) ->> 'success', 'true', 'standings inclusion toggle succeeds atomically');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.flex_player_stats
  WHERE group_id = 'a6110002-0000-4000-8000-000000000002'), 0,
  'excluded match disappears from persisted standings');

SET LOCAL ROLE authenticated;
SELECT is(public.update_flex_match_standings_atomic(
  'a6130000-0000-4000-8000-000000000001', true,
  'a6110002-0000-4000-8000-000000000002'
) ->> 'success', 'true', 'match can be included again');
SELECT is(public.update_flex_group_standings_atomic(
  'a6110002-0000-4000-8000-000000000002', false
) ->> 'success', 'true', 'group doubles setting and rebuild are one mutation');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.flex_player_stats
  WHERE group_id = 'a6110002-0000-4000-8000-000000000002'), 0,
  'doubles are removed from singles standings immediately');
SELECT is((SELECT count(*)::integer FROM public.flex_pair_stats
  WHERE group_id = 'a6110002-0000-4000-8000-000000000002'), 2,
  'pair standings remain available when doubles are hidden from singles');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a6000002-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"a6000002-0000-4000-8000-000000000002","role":"authenticated"}', true);
SELECT is(public.update_flex_group_standings_atomic(
  'a6110002-0000-4000-8000-000000000002', true
) ->> 'error', 'NOT_AUTHORIZED', 'non-owner cannot mutate Flex standings config');
RESET ROLE;
SELECT is((SELECT include_doubles_in_singles FROM public.flex_groups
  WHERE id = 'a6110002-0000-4000-8000-000000000002'), false,
  'rejected config mutation changes nothing');

SELECT * FROM finish();
ROLLBACK;
