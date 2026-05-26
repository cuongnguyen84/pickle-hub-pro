-- ============================================================================
-- DUPR RaaS — User entitlements cache (PR2)
-- ----------------------------------------------------------------------------
-- Caches the result of GET /subscription/active per user. Per DUPR docs
-- (https://dupr.gitbook.io/dupr-raas/integration-requirements/user-gating)
-- partners may cache entitlements for up to 24 hours.
--
-- A user must have the `BASIC_L1` entitlement on the `tournaments` resource
-- to perform any actions on the platform. `PREMIUM_L1` is required for
-- DUPR+ restricted tournaments. `VERIFIED_L1` indicates ID-verified.
--
-- `entitlements` is stored as JSONB matching the DUPR response shape:
--   { "tournaments": ["BASIC_L1", "VERIFIED_L1"], "merchandise": [] }
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.dupr_user_entitlements (
  user_id      uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  display_name text,
  status       text,
  entitlements jsonb NOT NULL DEFAULT '{}'::jsonb,
  fetched_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL DEFAULT now() + interval '24 hours'
);

COMMENT ON TABLE public.dupr_user_entitlements IS
  '24h cache of GET /subscription/active per user. Refreshed by dupr-entitlements edge fn when expires_at < now.';
COMMENT ON COLUMN public.dupr_user_entitlements.entitlements IS
  'JSONB matching DUPR shape: {"tournaments":["BASIC_L1",...],"merchandise":[...]}. BASIC_L1 on tournaments is mandatory for platform actions.';

ALTER TABLE public.dupr_user_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dupr_entitlements_self_read ON public.dupr_user_entitlements;
CREATE POLICY dupr_entitlements_self_read
  ON public.dupr_user_entitlements
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.dupr_user_entitlements TO authenticated;

-- ─── Helper: does a user have a given tournament entitlement? ──────────────
-- Used by RLS policies on tournaments/registrations + by client-side gating.
-- Returns false if the cache row is expired (caller should refresh first).
CREATE OR REPLACE FUNCTION public.dupr_user_has_entitlement(
  p_user_id uuid,
  p_entitlement text,
  p_resource text DEFAULT 'tournaments'
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT entitlements -> p_resource @> to_jsonb(array[p_entitlement])
       FROM public.dupr_user_entitlements
       WHERE user_id = p_user_id
         AND expires_at > now()),
    false
  );
$$;

COMMENT ON FUNCTION public.dupr_user_has_entitlement IS
  'True if the user has the entitlement on the resource AND the cache is still fresh. Use BASIC_L1 for baseline gating.';

GRANT EXECUTE ON FUNCTION public.dupr_user_has_entitlement TO authenticated;

NOTIFY pgrst, 'reload schema';
