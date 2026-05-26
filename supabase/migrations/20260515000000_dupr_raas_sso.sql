-- ============================================================================
-- DUPR RaaS — SSO foundation (PR1)
-- ----------------------------------------------------------------------------
-- Sprint 5+ DUPR partnership integration. Replaces the manual-rating pivot
-- with the official DUPR Partner API (RaaS). This migration adds the
-- minimum schema needed for SSO:
--
--   1. dupr_partner_tokens   — single-row cache of the 1-hour Bearer token
--                               minted from CLIENT_KEY:CLIENT_SECRET. Shared
--                               across all edge functions that call DUPR
--                               partner endpoints (token, user/{id}, match
--                               CRUD, webhook register).
--
--   2. dupr_user_tokens      — per-user SSO tokens returned by the iframe
--                               postMessage handshake. Read-only DUPR APIs
--                               that act on behalf of a specific user
--                               (entitlements, club memberships, profile)
--                               require these. Stored plaintext for UAT —
--                               TODO: encrypt before prod.
--
--   3. profiles.dupr_connected_via — enum tracking how the row got linked.
--                               'manual' = pre-PR1 (rating typed by hand,
--                               not authoritative). 'sso' = official.
--                               'pending_reconnect' = had manual data
--                               before PR1, banner shows until user SSOs.
--
-- Rating columns on profiles (dupr_id, dupr_singles, dupr_doubles, etc.)
-- already exist from Sprint 3 Phase 2 and are reused — no rename needed.
-- ============================================================================

-- ─── dupr_partner_tokens ───────────────────────────────────────────────────
-- Single-row cache (id is fixed) keyed on (client_id, environment) so we
-- can hold UAT + prod tokens side-by-side once we promote.
CREATE TABLE IF NOT EXISTS public.dupr_partner_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment  text NOT NULL CHECK (environment IN ('uat', 'prod')),
  client_id    text NOT NULL,
  access_token text NOT NULL,
  expires_at   timestamptz NOT NULL,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (environment, client_id)
);

COMMENT ON TABLE  public.dupr_partner_tokens IS
  'Bearer-token cache for DUPR Partner API. One row per (env, client_id). Refreshed by dupr-partner-token edge fn when expires_at < now + 5min.';

ALTER TABLE public.dupr_partner_tokens ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated access. Only service_role (which bypasses RLS) reads/writes.
-- No GRANTs intentionally — this is service-only.

-- ─── dupr_user_tokens ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dupr_user_tokens (
  user_id           uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  dupr_user_id      text NOT NULL,
  dupr_id           text NOT NULL,
  access_token      text NOT NULL,
  refresh_token     text NOT NULL,
  connected_at      timestamptz NOT NULL DEFAULT now(),
  last_refreshed_at timestamptz NOT NULL DEFAULT now(),
  revoked_at        timestamptz
);

COMMENT ON TABLE  public.dupr_user_tokens IS
  'Per-user DUPR SSO tokens (access + refresh). Tokens are plaintext in UAT — TODO: AES-GCM before prod. revoked_at != null means user disconnected; row kept for audit.';
COMMENT ON COLUMN public.dupr_user_tokens.dupr_user_id IS
  'Numeric/string user id returned by DUPR SSO postMessage (event.id). Distinct from dupr_id (the alphanumeric profile slug).';
COMMENT ON COLUMN public.dupr_user_tokens.dupr_id IS
  'Alphanumeric DUPR profile id (event.duprId from SSO). Matches profiles.dupr_id.';

CREATE INDEX IF NOT EXISTS dupr_user_tokens_dupr_id_idx
  ON public.dupr_user_tokens (dupr_id)
  WHERE revoked_at IS NULL;

ALTER TABLE public.dupr_user_tokens ENABLE ROW LEVEL SECURITY;

-- User can read their own token row (UI shows connected state). No write
-- access from the client — edge functions handle INSERT/UPDATE via
-- service_role.
DROP POLICY IF EXISTS dupr_user_tokens_self_read ON public.dupr_user_tokens;
CREATE POLICY dupr_user_tokens_self_read
  ON public.dupr_user_tokens
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ─── profiles.dupr_connected_via ───────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.dupr_connection_method AS ENUM ('manual', 'sso', 'pending_reconnect');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dupr_connected_via public.dupr_connection_method;

-- Backfill: any existing row with DUPR data (singles, doubles, or id) and
-- no method set gets stamped 'pending_reconnect' so the UI shows the
-- reconnect banner. Rows with no DUPR data stay NULL.
UPDATE public.profiles
SET dupr_connected_via = 'pending_reconnect'
WHERE dupr_connected_via IS NULL
  AND (dupr_id IS NOT NULL OR dupr_doubles IS NOT NULL OR dupr_singles IS NOT NULL);

-- ─── Extend dupr_rating_history.source values ──────────────────────────────
-- Existing column is plain text with no CHECK constraint, so no migration
-- needed — new SSO inserts will stamp source = 'dupr_sso_initial' and
-- webhook inserts (PR3) will stamp 'dupr_webhook'.

-- ─── GRANTs ────────────────────────────────────────────────────────────────
-- dupr_user_tokens: authenticated needs SELECT for the RLS policy above to
-- be reachable (GRANT runs before RLS). No INSERT/UPDATE/DELETE — edge
-- functions use service_role for writes.
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.dupr_user_tokens TO authenticated;
GRANT USAGE ON TYPE public.dupr_connection_method TO anon, authenticated;

-- dupr_partner_tokens: NO grants to anon/authenticated — service-only.

-- Reload PostgREST schema cache so REST clients see changes immediately.
NOTIFY pgrst, 'reload schema';
