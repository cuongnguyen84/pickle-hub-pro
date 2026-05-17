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

-- Helper functions are defined in 20260516050000_dupr_security_hardening.sql
-- as two variants:
--   - dupr_user_can_submit_club_matches(bigint) — caller-pinned, granted to
--     authenticated; uses auth.uid() internally.
--   - dupr_user_can_submit_club_matches_for(uuid, bigint) — service-role
--     only, used by edge functions that need to gate ACROSS users.
-- Defining them here with an arbitrary p_user_id grant would let any
-- signed-in client probe other users' roles — moved out for that reason.

NOTIFY pgrst, 'reload schema';
