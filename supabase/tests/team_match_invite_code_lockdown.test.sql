-- Column-privilege matrix for team_match_teams.invite_code lockdown
-- (migration 20260722000000). invite_code is a join secret and must be
-- unreadable by anon/authenticated; every other column stays readable —
-- including the two that installed native binaries name in queries
-- (payment_status, captain_user_id) and the two the /tournaments badge
-- filters on (tournament_id, status).

BEGIN;

SELECT plan(10);

-- The secret column: no SELECT for either public-facing role.
SELECT ok(
  NOT has_column_privilege('anon', 'public.team_match_teams', 'invite_code', 'SELECT'),
  'anon cannot SELECT team_match_teams.invite_code'
);
SELECT ok(
  NOT has_column_privilege('authenticated', 'public.team_match_teams', 'invite_code', 'SELECT'),
  'authenticated cannot SELECT team_match_teams.invite_code'
);

-- Columns the public UI and the /tournaments badge depend on.
SELECT ok(
  has_column_privilege('anon', 'public.team_match_teams', 'id', 'SELECT'),
  'anon can SELECT id'
);
SELECT ok(
  has_column_privilege('anon', 'public.team_match_teams', 'tournament_id', 'SELECT'),
  'anon can SELECT tournament_id (badge #429 filter)'
);
SELECT ok(
  has_column_privilege('anon', 'public.team_match_teams', 'status', 'SELECT'),
  'anon can SELECT status (badge #429 filter)'
);
SELECT ok(
  has_column_privilege('anon', 'public.team_match_teams', 'team_name', 'SELECT'),
  'anon can SELECT team_name'
);

-- Columns hardcoded in installed native binaries — must stay granted or every
-- installed iOS app breaks with no remediation path.
SELECT ok(
  has_column_privilege('anon', 'public.team_match_teams', 'payment_status', 'SELECT'),
  'anon can SELECT payment_status (native list query names it)'
);
SELECT ok(
  has_column_privilege('authenticated', 'public.team_match_teams', 'payment_status', 'SELECT'),
  'authenticated can SELECT payment_status (organizer delete-impact)'
);
SELECT ok(
  has_column_privilege('authenticated', 'public.team_match_teams', 'captain_user_id', 'SELECT'),
  'authenticated can SELECT captain_user_id (useUserTeam / native WHERE filter)'
);

-- Row-level visibility itself is unchanged: RLS still enabled.
SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'team_match_teams'),
  'RLS enabled on team_match_teams'
);

SELECT * FROM finish();

ROLLBACK;
