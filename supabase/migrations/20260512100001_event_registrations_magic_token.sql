-- ============================================================================
-- Social Events MVP — PR47 magic_token persistence
-- ============================================================================
-- phone-otp-verify already returns a `magic_token` UUID to the client, but
-- PR1 did NOT persist it server-side. The frontend stores it in localStorage
-- so a returning guest is recognized without re-OTP — but that token is
-- opaque to the server, which means the live page's score-submission flow
-- has no way to verify the guest is actually one of the match players.
--
-- This migration:
--   1. Adds nullable `magic_token UUID` to event_registrations.
--   2. Backfills existing rows with fresh UUIDs (so already-registered guests
--      keep working once phone-otp-verify is updated to also write the new
--      token on subsequent verifies — see PR47 step 3).
--   3. Adds a partial unique index on (magic_token) for lookups from the
--      submit-match-score edge function.
--
-- IDEMPOTENT: replay-safe.
-- ============================================================================

ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS magic_token UUID;

-- Backfill any pre-PR47 rows so they all have a token. New inserts from
-- phone-otp-verify will write a fresh token (see PR47 step 3).
UPDATE public.event_registrations
SET magic_token = gen_random_uuid()
WHERE magic_token IS NULL;

-- Partial unique index — fast lookup by token, and prevents duplicate tokens
-- (collision probability of v4 UUIDs is negligible, but the constraint is
-- cheap defence in depth).
CREATE UNIQUE INDEX IF NOT EXISTS uq_event_registrations_magic_token
  ON public.event_registrations (magic_token)
  WHERE magic_token IS NOT NULL;

COMMENT ON COLUMN public.event_registrations.magic_token IS
  'Server-issued UUID returned to the registrant at OTP-verify time. The /su-kien/:slug/live page sends this back to submit-match-score so guests (no auth.users row) can submit scores for matches they are in. See migrations/20260512100001.';
