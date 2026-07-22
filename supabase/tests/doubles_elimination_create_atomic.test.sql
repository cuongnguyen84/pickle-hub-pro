-- Task 4 regression: Doubles Elimination creation is one transaction for
-- both a full manual roster and an empty DUPR registration launch.

BEGIN;

SELECT plan(17);

SELECT has_function(
  'public',
  'create_doubles_elimination_atomic',
  ARRAY[
    'text', 'text', 'integer', 'boolean', 'text', 'text', 'text', 'integer',
    'text', 'text', 'numeric', 'numeric', 'boolean', 'jsonb', 'text'
  ],
  'atomic DE create RPC exists'
);
SELECT ok(has_function_privilege(
  'authenticated',
  'public.create_doubles_elimination_atomic(text,text,integer,boolean,text,text,text,integer,text,text,numeric,numeric,boolean,jsonb,text)',
  'EXECUTE'
), 'authenticated may create DE atomically');
SELECT ok(NOT has_function_privilege(
  'anon',
  'public.create_doubles_elimination_atomic(text,text,integer,boolean,text,text,text,integer,text,text,numeric,numeric,boolean,jsonb,text)',
  'EXECUTE'
), 'anon may not create DE atomically');

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  'a5000001-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'task4-create-owner@thepicklehub.test', '', now(),
  '{"provider":"test","providers":["test"]}'::jsonb,
  '{"display_name":"Task 4 Create Owner"}'::jsonb, now(), now()
);

CREATE TEMP TABLE de_atomic_create_results (
  kind text PRIMARY KEY,
  result jsonb NOT NULL
);
GRANT SELECT, INSERT ON de_atomic_create_results TO authenticated;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a5000001-0000-4000-8000-000000000001', true);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"a5000001-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

SELECT is(
  public.create_doubles_elimination_atomic(
    'Invalid count', 'task4invalid', 39, false, 'bo1', 'bo3', 'bo3', 2,
    '08:00', 'self', NULL, NULL, false, '[]'::jsonb, 'manual'
  ) ->> 'error',
  'INVALID_TEAM_COUNT',
  'invalid team count is rejected before creation'
);
SELECT is(
  (SELECT count(*)::integer FROM public.doubles_elimination_tournaments
    WHERE share_id = 'task4invalid'),
  0,
  'invalid create leaves no tournament row'
);

INSERT INTO de_atomic_create_results (kind, result)
SELECT 'manual', public.create_doubles_elimination_atomic(
  'Atomic Manual DE',
  'task4manual',
  40,
  true,
  'bo1',
  'bo3',
  'bo5',
  4,
  '08:00',
  'either',
  2.5,
  5.5,
  false,
  (
    SELECT jsonb_agg(jsonb_build_object(
      'team_name', 'Manual Team ' || lpad(i::text, 2, '0'),
      'player1_name', 'Player ' || i || 'A',
      'player2_name', 'Player ' || i || 'B',
      'seed', 41 - i,
      'dupr_avg_rating', NULL,
      'dupr_seed_source', 'none'
    ) ORDER BY i)
    FROM generate_series(1, 40) AS roster(i)
  ),
  'manual'
)::jsonb;

INSERT INTO de_atomic_create_results (kind, result)
VALUES (
  'registration',
  public.create_doubles_elimination_atomic(
    'Atomic Registration DE',
    'task4registration',
    40,
    false,
    'bo1',
    'bo3',
    'bo3',
    2,
    '09:00',
    'dupr',
    3.0,
    5.0,
    true,
    '[]'::jsonb,
    'dupr'
  )::jsonb
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '{}', true);

SELECT is((SELECT result ->> 'success' FROM de_atomic_create_results WHERE kind = 'manual'),
  'true', 'manual DE create succeeds');
SELECT is((SELECT status FROM public.doubles_elimination_tournaments
  WHERE share_id = 'task4manual'), 'ongoing',
  'manual tournament becomes ongoing with its bracket');
SELECT is((SELECT count(*)::integer FROM public.doubles_elimination_teams t
  JOIN public.doubles_elimination_tournaments d ON d.id = t.tournament_id
  WHERE d.share_id = 'task4manual'), 40,
  'manual roster commits all 40 teams');
SELECT is((SELECT count(*)::integer FROM public.doubles_elimination_matches m
  JOIN public.doubles_elimination_tournaments d ON d.id = m.tournament_id
  WHERE d.share_id = 'task4manual'), 44,
  'manual create commits the complete preliminary graph');
SELECT is((SELECT count(DISTINCT m.generation_key)::integer
  FROM public.doubles_elimination_matches m
  JOIN public.doubles_elimination_tournaments d ON d.id = m.tournament_id
  WHERE d.share_id = 'task4manual'), 44,
  'manual graph has unique server generation keys');
SELECT is((SELECT t.team_name
  FROM public.doubles_elimination_teams t
  JOIN public.doubles_elimination_tournaments d ON d.id = t.tournament_id
  WHERE d.share_id = 'task4manual' AND t.seed = 1), 'Manual Team 40',
  'manual seeding strategy preserves organizer order');

SELECT is((SELECT result ->> 'success' FROM de_atomic_create_results WHERE kind = 'registration'),
  'true', 'registration-open DE create succeeds');
SELECT is((SELECT status FROM public.doubles_elimination_tournaments
  WHERE share_id = 'task4registration'), 'registration_open',
  'registration tournament opens atomically');
SELECT is((SELECT count(*)::integer FROM public.doubles_elimination_teams t
  JOIN public.doubles_elimination_tournaments d ON d.id = t.tournament_id
  WHERE d.share_id = 'task4registration'), 0,
  'registration launch starts with no manual teams');
SELECT is((SELECT count(*)::integer FROM public.doubles_elimination_matches m
  JOIN public.doubles_elimination_tournaments d ON d.id = m.tournament_id
  WHERE d.share_id = 'task4registration'), 0,
  'registration launch starts with no bracket');

SELECT is(
  public.create_doubles_elimination_atomic(
    'No auth', 'task4noauth', 40, false, 'bo1', 'bo3', 'bo3', 1,
    NULL, 'dupr', NULL, NULL, true, '[]'::jsonb, 'dupr'
  ) ->> 'error',
  'AUTH_REQUIRED',
  'unauthenticated create is rejected'
);
SELECT is((SELECT count(*)::integer FROM public.doubles_elimination_tournaments
  WHERE share_id = 'task4noauth'), 0,
  'unauthenticated create leaves no tournament row');

SELECT * FROM finish();
ROLLBACK;
