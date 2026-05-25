-- ============================================================================
-- DUPR RaaS — Security hardening (Codex P1 fixes)
-- ----------------------------------------------------------------------------
-- 1. dupr_user_tokens: revoke SELECT on access_token/refresh_token from
--    authenticated. Originally the self-read RLS policy exposed plaintext
--    third-party credentials to any browser-side code. Frontend only needs
--    connection-state columns; tokens stay service-role-only.
-- 2. dupr_user_has_entitlement: pin to auth.uid() so it can't be used to
--    probe other users' entitlements. SECURITY DEFINER + user-supplied
--    p_user_id was a cross-user data leak.
-- 3. dupr_user_can_submit_club_matches: same pinning (defense in depth —
--    it's already covered by RLS on dupr_user_clubs but the helper should
--    not bypass auth.uid()).
-- ============================================================================

-- ─── 1. dupr_user_tokens column-level grants ───────────────────────────────
REVOKE SELECT ON public.dupr_user_tokens FROM authenticated;

-- Authenticated may read connection metadata only — NEVER tokens.
GRANT SELECT
  (user_id, dupr_user_id, dupr_id, connected_at, last_refreshed_at,
   revoked_at, webhook_subscribed_at)
  ON public.dupr_user_tokens
  TO authenticated;

-- Self-read policy unchanged (auth.uid() = user_id) — the column-level
-- grant is the additional barrier that prevents SELECT * from leaking
-- access_token + refresh_token.

-- ─── 2. dupr_user_has_entitlement: pin to auth.uid() ───────────────────────
DROP FUNCTION IF EXISTS public.dupr_user_has_entitlement(uuid, text, text);

CREATE OR REPLACE FUNCTION public.dupr_user_has_entitlement(
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
       WHERE user_id = auth.uid()
         AND expires_at > now()),
    false
  );
$$;

COMMENT ON FUNCTION public.dupr_user_has_entitlement(text, text) IS
  'True if the calling user has the entitlement on the resource AND the cache is still fresh. auth.uid() is pinned — no user can probe others.';

GRANT EXECUTE ON FUNCTION public.dupr_user_has_entitlement(text, text) TO authenticated;

-- Service-role still needs to check entitlements for ARBITRARY users (e.g.
-- dupr-match-submit checks every player). Provide a privileged variant
-- with the user_id parameter — service-role only via REVOKE EXECUTE.
CREATE OR REPLACE FUNCTION public.dupr_user_has_entitlement_for(
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

COMMENT ON FUNCTION public.dupr_user_has_entitlement_for(uuid, text, text) IS
  'Service-role only entitlement check. Used by edge functions that need to gate ACROSS users (e.g. match-submit checking every player).';

REVOKE ALL ON FUNCTION public.dupr_user_has_entitlement_for(uuid, text, text) FROM public, anon, authenticated;
-- service_role retains EXECUTE via default-privileges.

-- ─── 3. dupr_user_can_submit_club_matches: pin to auth.uid() variant ───────
DROP FUNCTION IF EXISTS public.dupr_user_can_submit_club_matches(uuid, bigint);

CREATE OR REPLACE FUNCTION public.dupr_user_can_submit_club_matches(
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
    WHERE user_id = auth.uid()
      AND club_id = p_club_id
      AND role IN ('DIRECTOR', 'ORGANIZER')
      AND expires_at > now()
  );
$$;

COMMENT ON FUNCTION public.dupr_user_can_submit_club_matches(bigint) IS
  'True if the calling user is DIRECTOR/ORGANIZER of the club AND cache is fresh.';

GRANT EXECUTE ON FUNCTION public.dupr_user_can_submit_club_matches(bigint) TO authenticated;

-- Privileged service-role variant for match-submit (which checks the
-- submitter, not the caller).
CREATE OR REPLACE FUNCTION public.dupr_user_can_submit_club_matches_for(
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

COMMENT ON FUNCTION public.dupr_user_can_submit_club_matches_for(uuid, bigint) IS
  'Service-role only club-role check. Used by edge functions submitting matches on behalf of a user.';

REVOKE ALL ON FUNCTION public.dupr_user_can_submit_club_matches_for(uuid, bigint) FROM public, anon, authenticated;

NOTIFY pgrst, 'reload schema';
