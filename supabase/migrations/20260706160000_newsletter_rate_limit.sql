-- ============================================================================
-- SECURITY M9 (2026-07-06): rate-limit newsletter-subscribe by IP
-- ----------------------------------------------------------------------------
-- newsletter-subscribe is a public (verify_jwt=false) endpoint with no
-- server-side rate limit — a script could flood newsletter_subscribers with
-- junk rows. Add a small per-IP/per-hour counter table (service-role only) that
-- the edge function increments and checks.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.newsletter_rate_limits (
  ip_hash     TEXT        NOT NULL,
  window_hour TIMESTAMPTZ NOT NULL,
  count       INT         NOT NULL DEFAULT 0,
  PRIMARY KEY (ip_hash, window_hour)
);

-- Service-role only: RLS on, no policies, no grants to anon/authenticated.
ALTER TABLE public.newsletter_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.newsletter_rate_limits FROM anon, authenticated;

COMMENT ON TABLE public.newsletter_rate_limits IS
  'Per-IP-hash hourly counter for newsletter-subscribe abuse throttling (M9). Written by the edge function via service_role. IPs are stored hashed.';

NOTIFY pgrst, 'reload schema';
