-- ============================================================================
-- DUPR RaaS — User club memberships cache (PR5)
-- ----------------------------------------------------------------------------
-- Caches GET https://api.<env>.dupr.gg/user/club/membership per user.
-- Used for two things:
--   1. UI: show the user which DUPR clubs they belong to + role.
--   2. Gating: when a match is submitted with matchSource=CLUB + clubId,
--      verify the submitter holds DIRECTOR or ORGANIZER on that clubId
--      (per https://dupr.gitbook.io/dupr-raas/integration-requirements/
--      club-integration).
--
-- 24h TTL matches the entitlements cache; same staleness contract.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.dupr_user_clubs (
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  club_id     bigint NOT NULL,
  club_name   text,
  role        text NOT NULL CHECK (role IN ('DIRECTOR', 'ORGANIZER', 'PLAYER')),
  fetched_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  PRIMARY KEY (user_id, club_id)
);

COMMENT ON TABLE public.dupr_user_clubs IS
  '24h cache of GET /user/club/membership per user. Replaced wholesale on refresh — rows not in the latest DUPR response are deleted.';

CREATE INDEX IF NOT EXISTS dupr_user_clubs_club_idx
  ON public.dupr_user_clubs (club_id);

ALTER TABLE public.dupr_user_clubs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dupr_user_clubs_self_read ON public.dupr_user_clubs;
CREATE POLICY dupr_user_clubs_self_read
  ON public.dupr_user_clubs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.dupr_user_clubs TO authenticated;

-- ─── Helper: does user hold an admin role on this club? ────────────────────
-- Returns true if the user has DIRECTOR or ORGANIZER for the club AND the
-- cache is still fresh. Used by dupr-match-submit when matchSource=CLUB.
CREATE OR REPLACE FUNCTION public.dupr_user_can_submit_club_matches(
  p_user_id uuid,
  p_club_id bigint
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.dupr_user_clubs
    WHERE user_id = p_user_id
      AND club_id = p_club_id
      AND role IN ('DIRECTOR', 'ORGANIZER')
      AND expires_at > now()
  );
$$;

GRANT EXECUTE ON FUNCTION public.dupr_user_can_submit_club_matches TO authenticated;

NOTIFY pgrst, 'reload schema';
