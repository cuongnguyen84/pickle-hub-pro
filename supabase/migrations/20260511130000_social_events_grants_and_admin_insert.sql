-- ============================================================================
-- Social Events MVP — PR3 bug fix migration
-- ============================================================================
-- Sprint 1 PR3 follow-up. Resolves two issues exposed during PR3 testing:
--
--   (1) "permission denied for table social_events" (PostgREST error 42501)
--       Root cause: the foundation migration (20260511120000) created the
--       four new tables with RLS enabled but never issued the
--       table-level GRANT statements that the `anon` / `authenticated`
--       roles need before RLS is even consulted. The convention used by
--       every other migration in this repo (e.g. social_optionA_tables,
--       pro_tour_foundation, fix_creator_tables_grants) is an explicit
--       GRANT block per table.
--
--       Without these GRANTs, Postgres rejects at the privilege layer
--       and PostgREST surfaces a 42501 "permission denied for table"
--       response — which looks like an RLS denial but actually pre-empts
--       RLS evaluation entirely. (RLS denial uses code 42501 too but
--       returns "new row violates row-level security policy".)
--
--       otp_codes is deliberately NOT granted to authenticated/anon —
--       only the service role (the phone-otp-send / phone-otp-verify
--       edge functions) reads or writes it.
--
--   (2) INSERT policy admin fallback. The original `social_events_insert_owner`
--       and `clubs_insert_owner` policies only allow `auth.uid() = created_by`.
--       That's correct for the common case but blocks an admin from creating
--       an event/club on behalf of another user — UPDATE / DELETE / SELECT
--       all have an `OR has_role(auth.uid(), 'admin')` fallback, INSERT
--       should too for parity. Also adds an organizer/admin INSERT policy
--       on event_registrations so the roster "Add manually" walk-in path
--       (PR3 SocialEventRoster.tsx) actually works — the existing
--       `event_registrations_insert_self` policy requires
--       `profile_id = auth.uid()`, which the walk-in path can't satisfy.
--
-- All has_role() calls in this migration use the explicit `'admin'::app_role`
-- cast (idiomatic for this codebase even though Postgres implicitly coerces).
--
-- IDEMPOTENT: replay-safe.
-- ============================================================================

-- ─── 1. GRANTs (the actual fix for the 42501 error) ─────────────────────────

GRANT SELECT                         ON public.clubs               TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clubs               TO authenticated;

GRANT SELECT                         ON public.social_events       TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_events       TO authenticated;

GRANT SELECT                         ON public.event_registrations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_registrations TO authenticated;

-- otp_codes intentionally omitted. RLS has zero policies, GRANTs absent —
-- defense in depth: even if a future policy accidentally allows access,
-- the GRANT layer still blocks it.


-- ─── 2. clubs INSERT — admin fallback ───────────────────────────────────────

DROP POLICY IF EXISTS "clubs_insert_owner"          ON public.clubs;
DROP POLICY IF EXISTS "clubs_insert_owner_or_admin" ON public.clubs;
CREATE POLICY "clubs_insert_owner_or_admin" ON public.clubs
  FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );


-- ─── 3. social_events INSERT — admin fallback ───────────────────────────────

DROP POLICY IF EXISTS "social_events_insert_owner"          ON public.social_events;
DROP POLICY IF EXISTS "social_events_insert_owner_or_admin" ON public.social_events;
CREATE POLICY "social_events_insert_owner_or_admin" ON public.social_events
  FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );


-- ─── 4. event_registrations INSERT — organizer + admin walk-in path ────────
--
-- The existing `event_registrations_insert_self` policy (from the foundation
-- migration) allows an authenticated user to register *themselves*
-- (profile_id = auth.uid()). It stays in place — public users who happen
-- to be signed in can register without leaving the SPA.
--
-- This new policy adds the organizer / admin path used by the roster's
-- "Add manually" dialog (walk-in registrations have profile_id = NULL
-- and only display_name + optional phone).

DROP POLICY IF EXISTS "event_registrations_insert_organizer" ON public.event_registrations;
CREATE POLICY "event_registrations_insert_organizer" ON public.event_registrations
  FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.social_events e
      WHERE e.id = event_registrations.event_id
        AND e.created_by = auth.uid()
    )
  );


-- ─── 5. Sanity comment — make the GRANT requirement discoverable ───────────
-- (Future migrations adding new tables in this domain must add GRANTs.)

COMMENT ON TABLE public.clubs               IS
  'Pickleball CLB. RLS-enabled; GRANT to anon (read) + authenticated (CRUD). See 20260511130000.';
COMMENT ON TABLE public.social_events       IS
  'Social events. RLS-enabled; GRANT to anon (read) + authenticated (CRUD). See 20260511130000.';
COMMENT ON TABLE public.event_registrations IS
  'Event roster. RLS-enabled; GRANT to anon (read) + authenticated (CRUD). Organizer INSERT path (walk-ins) requires the second policy. See 20260511130000.';
