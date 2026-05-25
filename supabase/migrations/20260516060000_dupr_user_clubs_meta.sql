-- ============================================================================
-- DUPR RaaS — Track fetched-at for empty membership responses (Codex P2)
-- ----------------------------------------------------------------------------
-- The original dupr_user_clubs cache stored expires_at per-row, which meant
-- a user with zero club memberships had no rows → no expires_at → cache
-- was never considered fresh → every call refetched from DUPR.
--
-- This meta table records the fetched_at independently, so dupr-clubs can
-- skip the upstream call for the 24h window even when the user belongs to
-- no clubs.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.dupr_user_clubs_meta (
  user_id    uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours'
);

COMMENT ON TABLE public.dupr_user_clubs_meta IS
  'Per-user freshness marker for the dupr_user_clubs cache. Lets empty membership lists count as a fresh cache hit until expires_at.';

ALTER TABLE public.dupr_user_clubs_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dupr_user_clubs_meta_self_read ON public.dupr_user_clubs_meta;
CREATE POLICY dupr_user_clubs_meta_self_read
  ON public.dupr_user_clubs_meta
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT ON public.dupr_user_clubs_meta TO authenticated;

-- Backfill: any user already in dupr_user_clubs is implicitly fresh.
INSERT INTO public.dupr_user_clubs_meta (user_id, fetched_at, expires_at)
SELECT DISTINCT user_id, MIN(fetched_at), MIN(expires_at)
FROM public.dupr_user_clubs
GROUP BY user_id
ON CONFLICT (user_id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
