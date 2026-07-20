-- UX-06 increment 6 regression: a team that has paid cannot be deleted.
--
-- The guard is a BEFORE DELETE row trigger on team_match_teams raising
-- SQLSTATE PH001 (20260721000000). Two paths matter and BOTH are covered:
--   1. direct DELETE of the team row (PostgREST `.delete()` from the browser)
--   2. DELETE of the parent team_match_tournaments row — team_match_teams
--      .tournament_id is ON DELETE CASCADE, row triggers fire on cascaded
--      deletes, so the guard also blocks "delete the whole tournament".
--      That is the path the product actually pushes organizers toward
--      (3-tournament lifetime quota), so it is the one that must not rot.
--
-- At least one case runs as the real `authenticated` role, not as superuser.
-- A guard exercised only as superuser can be silently dead: if RLS refused
-- the DELETE first (42501) the trigger would never run, and a superuser test
-- — which bypasses RLS — would still be green. The paired unpaid/claimed
-- probes below distinguish "blocked by PH001" from "blocked by 42501".

BEGIN;

SELECT plan(11);

-- ─── The guard exists and is wired to the right event ───────────────────────

SELECT has_function(
  'public',
  'block_delete_paid_team_match_team',
  'UX-06 guard function exists'
);

SELECT is(
  (SELECT COUNT(*)::int
   FROM pg_trigger
   WHERE tgrelid = 'public.team_match_teams'::regclass
     AND tgname = 'trg_block_delete_paid_team'
     AND NOT tgisinternal),
  1,
  'trg_block_delete_paid_team is installed on team_match_teams'
);

SELECT ok(
  (SELECT confdeltype FROM pg_constraint
   WHERE conname = 'team_match_teams_tournament_id_fkey') = 'c',
  'team_match_teams.tournament_id is ON DELETE CASCADE (the tournament-delete path exists)'
);

-- ─── Fixture ────────────────────────────────────────────────────────────────
-- Two tournaments: one holding a paid team, one where every team is unpaid.
-- UUIDs must be valid hex (the literal "ux06" is not).

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  'a6060001-0000-4000-8000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'ux06-organizer@thepicklehub.test', '', NOW(),
  '{"provider":"test","providers":["test"]}'::jsonb,
  '{"display_name":"UX-06 Organizer"}'::jsonb, NOW(), NOW()
);

INSERT INTO public.team_match_tournaments (
  id, created_by, share_id, name, team_roster_size, team_count, format
) VALUES
  ('a6060010-0000-4000-8000-000000000010'::uuid,
   'a6060001-0000-4000-8000-000000000001'::uuid,
   'ux06paid', 'UX-06 Paid Tournament', 4, 4, 'round_robin'),
  ('a6060020-0000-4000-8000-000000000020'::uuid,
   'a6060001-0000-4000-8000-000000000001'::uuid,
   'ux06free', 'UX-06 Unpaid Tournament', 4, 4, 'round_robin');

INSERT INTO public.team_match_teams (id, tournament_id, team_name, payment_status)
VALUES
  ('a6060100-0000-4000-8000-000000000100'::uuid, 'a6060010-0000-4000-8000-000000000010'::uuid, 'Unpaid Team',    'unpaid'),
  ('a6060200-0000-4000-8000-000000000200'::uuid, 'a6060010-0000-4000-8000-000000000010'::uuid, 'Claimed Team',   'claimed'),
  ('a6060300-0000-4000-8000-000000000300'::uuid, 'a6060010-0000-4000-8000-000000000010'::uuid, 'Confirmed Team', 'confirmed'),
  ('a6060400-0000-4000-8000-000000000400'::uuid, 'a6060020-0000-4000-8000-000000000020'::uuid, 'Free Team A',    'unpaid'),
  ('a6060500-0000-4000-8000-000000000500'::uuid, 'a6060020-0000-4000-8000-000000000020'::uuid, 'Free Team B',    'unpaid');

-- ─── Case 1-3: direct DELETE of one team ────────────────────────────────────

SELECT lives_ok(
  $$DELETE FROM public.team_match_teams WHERE id = 'a6060100-0000-4000-8000-000000000100'$$,
  'an unpaid team deletes normally'
);

SELECT throws_ok(
  $$DELETE FROM public.team_match_teams WHERE id = 'a6060200-0000-4000-8000-000000000200'$$,
  'PH001',
  NULL,
  'deleting a claimed team raises PH001'
);

SELECT throws_ok(
  $$DELETE FROM public.team_match_teams WHERE id = 'a6060300-0000-4000-8000-000000000300'$$,
  'PH001',
  NULL,
  'deleting a confirmed team raises PH001'
);

-- ─── Case 4: DELETE the whole tournament (cascade) — the path that matters ──

SELECT throws_ok(
  $$DELETE FROM public.team_match_tournaments WHERE id = 'a6060010-0000-4000-8000-000000000010'$$,
  'PH001',
  NULL,
  'deleting a tournament that holds a paid team is blocked through the cascade'
);

-- ─── Case 5: the guard does not over-block ──────────────────────────────────

SELECT lives_ok(
  $$DELETE FROM public.team_match_tournaments WHERE id = 'a6060020-0000-4000-8000-000000000020'$$,
  'deleting a tournament whose teams are all unpaid still succeeds'
);

SELECT is(
  (SELECT COUNT(*)::int FROM public.team_match_teams
   WHERE tournament_id = 'a6060020-0000-4000-8000-000000000020'::uuid),
  0,
  'the unpaid tournament cascade actually removed its teams'
);

-- ─── Case 6: same guard as the real `authenticated` role, not superuser ─────
-- The organizer owns the tournament, so the "Creator can delete teams" policy
-- permits the DELETE. If it did not, the unpaid probe below would fail with
-- 42501 and the PH001 probe would be meaningless — which is exactly the
-- failure mode this pair is here to catch.

INSERT INTO public.team_match_teams (id, tournament_id, team_name, payment_status)
VALUES
  ('a6060600-0000-4000-8000-000000000600'::uuid, 'a6060010-0000-4000-8000-000000000010'::uuid, 'RLS Unpaid Team',  'unpaid'),
  ('a6060700-0000-4000-8000-000000000700'::uuid, 'a6060010-0000-4000-8000-000000000010'::uuid, 'RLS Claimed Team', 'claimed');

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"a6060001-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

-- Control probe: proves RLS lets this role through, so a PH001 below is the
-- trigger talking and not a permission error wearing its clothes.
SELECT lives_ok(
  $$DELETE FROM public.team_match_teams WHERE id = 'a6060600-0000-4000-8000-000000000600'$$,
  'as role authenticated: the creator can delete an unpaid team (RLS permits DELETE)'
);

SELECT throws_ok(
  $$DELETE FROM public.team_match_teams WHERE id = 'a6060700-0000-4000-8000-000000000700'$$,
  'PH001',
  NULL,
  'as role authenticated: deleting a claimed team raises PH001, not 42501'
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
