-- Defense in depth: RLS already denies these reads, but browser roles should
-- not hold redundant SELECT grants on credential-bearing relations.
-- Authenticated DUPR metadata SELECT grants are deliberately preserved.
-- registration_secrets RPC consumers run SECURITY DEFINER; Edge consumers use
-- service_role. No INSERT/UPDATE/DELETE grants or policies are changed.
REVOKE SELECT ON public.dupr_user_tokens FROM anon;
REVOKE SELECT ON public.dupr_partner_tokens FROM anon, authenticated;
REVOKE SELECT ON public.registration_secrets FROM anon, authenticated;
