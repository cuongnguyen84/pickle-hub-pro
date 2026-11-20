-- M6 phase 1: additive authorization primitive only. No existing consumer is
-- switched here; this migration alone does NOT close expiry bypass findings.
-- Event status/cancelled_at deliberately excluded: callers retain independent
-- business checks, including legitimate cancellation/reactivation and JWT paths.
CREATE OR REPLACE FUNCTION public.registration_token_is_valid(
  p_registration_id uuid,
  p_magic_token uuid
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.registration_secrets AS secret
    WHERE secret.registration_id = p_registration_id
      AND secret.magic_token = p_magic_token
      AND secret.expires_at IS NOT NULL
      AND isfinite(secret.expires_at)
      AND secret.expires_at > statement_timestamp()
  );
$$;
REVOKE ALL ON FUNCTION public.registration_token_is_valid(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registration_token_is_valid(uuid, uuid) TO service_role;
COMMENT ON FUNCTION public.registration_token_is_valid(uuid, uuid) IS
  'M6 phase1: service/definer-only registration-scoped finite future bearer validity. Consumers not yet migrated; no token rotation, renewal or revocation implied.';
