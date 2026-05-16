-- ============================================================================
-- Flex tournament referees — W3.4 unified referee model
-- ============================================================================
-- Mirrors public.quick_table_referees (and public.doubles_elimination_referees
-- / public.team_match_referees) so Flex tournaments get the same referee
-- workflow as the other 3 tournament tools.
--
-- Schema parity:
--   - id           uuid PK default gen_random_uuid()
--   - tournament_id uuid FK -> public.flex_tournaments(id) ON DELETE CASCADE
--   - user_id      uuid (matches doubles_elimination_referees, no FK to
--                  auth.users — keeps parity with quick_table_referees and
--                  avoids cross-schema cascade quirks; integrity is enforced
--                  by RLS + the UNIQUE constraint)
--   - created_at   timestamptz default now()
--   - UNIQUE(tournament_id, user_id)
--
-- RLS mirrors doubles_elimination_referees (the closest analogue — both
-- tournament-scoped, both use creator_user_id on the parent table):
--   - SELECT: anyone (the referee chip is shown publicly on the tournament
--             page, matching doubles_elimination behaviour)
--   - INSERT/UPDATE/DELETE: tournament creator OR admin
--
-- GRANT explicit SELECT/INSERT/UPDATE/DELETE to authenticated per project
-- convention (forgetting this surfaces as 42501 even when RLS would allow).
--
-- Idempotent: CREATE TABLE IF NOT EXISTS + guarded policy creation so this
-- file can be re-applied safely.
-- ============================================================================

-- ─── Table ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.flex_tournament_referees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id uuid NOT NULL REFERENCES public.flex_tournaments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tournament_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_flex_tournament_referees_tournament_id
  ON public.flex_tournament_referees(tournament_id);

CREATE INDEX IF NOT EXISTS idx_flex_tournament_referees_user_id
  ON public.flex_tournament_referees(user_id);

-- ─── RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.flex_tournament_referees ENABLE ROW LEVEL SECURITY;

-- Helper: is the caller the creator of the given flex tournament?
CREATE OR REPLACE FUNCTION public.is_flex_tournament_creator(_tournament_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.flex_tournaments
    WHERE id = _tournament_id
      AND creator_user_id = _user_id
  )
$$;

-- Helper: is the caller a referee on the given flex tournament?
CREATE OR REPLACE FUNCTION public.is_flex_tournament_referee(_tournament_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.flex_tournament_referees
    WHERE tournament_id = _tournament_id
      AND user_id = _user_id
  )
$$;

-- Helper: can the caller edit scores (creator or referee)?
CREATE OR REPLACE FUNCTION public.can_edit_flex_tournament_scores(_tournament_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_flex_tournament_creator(_tournament_id, _user_id)
      OR public.is_flex_tournament_referee(_tournament_id, _user_id)
$$;

-- Policies — drop-then-create pattern (CREATE POLICY does not support
-- IF NOT EXISTS in current Postgres) keeps the migration idempotent.

DROP POLICY IF EXISTS "Anyone can view flex tournament referees"
  ON public.flex_tournament_referees;
CREATE POLICY "Anyone can view flex tournament referees"
  ON public.flex_tournament_referees
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Creator can add flex tournament referees"
  ON public.flex_tournament_referees;
CREATE POLICY "Creator can add flex tournament referees"
  ON public.flex_tournament_referees
  FOR INSERT
  WITH CHECK (
    public.is_flex_tournament_creator(tournament_id, auth.uid())
  );

DROP POLICY IF EXISTS "Creator can remove flex tournament referees"
  ON public.flex_tournament_referees;
CREATE POLICY "Creator can remove flex tournament referees"
  ON public.flex_tournament_referees
  FOR DELETE
  USING (
    public.is_flex_tournament_creator(tournament_id, auth.uid())
  );

-- Admin overrides (mirrors team_match_referees / doubles_elimination admin
-- policies added in 20260131105545_*)
DROP POLICY IF EXISTS "Admins can delete any flex tournament referee"
  ON public.flex_tournament_referees;
CREATE POLICY "Admins can delete any flex tournament referee"
  ON public.flex_tournament_referees
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ─── GRANT (project convention) ───────────────────────────────────────────
-- anon stays SELECT-only via RLS; only authenticated gets mutation grants.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.flex_tournament_referees TO authenticated;
GRANT SELECT ON public.flex_tournament_referees TO anon;

-- ─── PostgREST schema reload ──────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
