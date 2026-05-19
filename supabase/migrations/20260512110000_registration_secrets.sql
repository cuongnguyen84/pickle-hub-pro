-- ============================================================================
-- Social Events MVP — PR47 Codex review bug 1 (P1 SECURITY)
-- ============================================================================
-- The previous migration (20260512100001) added `magic_token UUID` directly
-- on `event_registrations`. That table has a public SELECT policy
-- (`event_registrations_select`) which lets anonymous viewers read every
-- column of every row whose event is published+public — INCLUDING
-- magic_token. An attacker can then submit fake scores to
-- submit-match-score using any other registrant's token.
--
-- Fix Option A: move the secret to a dedicated table with RLS that denies
-- all public access. Only the service-role client (used by the
-- phone-otp-verify and submit-match-score edge functions) can read or
-- write it. The frontend keeps recognizing returning guests via its
-- localStorage copy — the token never leaves the registration_secrets
-- table on the server side except through edge-function-mediated checks.
--
-- Migration steps:
--   1. CREATE `registration_secrets` table (PK = registration_id FK CASCADE).
--   2. Backfill from event_registrations.magic_token for rows that already
--      have one (so PR47 testers don't lose their already-issued tokens).
--   3. DROP the unique index on event_registrations.magic_token.
--   4. DROP the magic_token column from event_registrations.
--   5. RLS enabled, zero policies → service_role + db superuser only. No
--      GRANT to anon/authenticated (defense in depth — even a future
--      mistakenly-added policy still has nothing to grant on).
--
-- IDEMPOTENT: replay-safe.
-- ============================================================================

-- ─── 1. Table ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.registration_secrets (
  registration_id  UUID PRIMARY KEY REFERENCES public.event_registrations(id) ON DELETE CASCADE,
  magic_token      UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique index on the token (1:1 with registration, but also enforces no
-- collisions across the table for fast lookups from submit-match-score).
CREATE UNIQUE INDEX IF NOT EXISTS uq_registration_secrets_magic_token
  ON public.registration_secrets (magic_token);

-- ─── 2. Backfill from the now-deprecated column ────────────────────────────
-- Skip rows that have already been migrated (idempotent on replay).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'event_registrations'
      AND column_name = 'magic_token'
  ) THEN
    INSERT INTO public.registration_secrets (registration_id, magic_token)
    SELECT id, magic_token
    FROM public.event_registrations
    WHERE magic_token IS NOT NULL
    ON CONFLICT (registration_id) DO NOTHING;
  END IF;
END $$;

-- ─── 3 + 4. Drop the index + column on the public table ─────────────────────

DROP INDEX IF EXISTS public.uq_event_registrations_magic_token;
ALTER TABLE public.event_registrations DROP COLUMN IF EXISTS magic_token;

-- ─── 5. RLS — zero policies. Service role only. ────────────────────────────

ALTER TABLE public.registration_secrets ENABLE ROW LEVEL SECURITY;

-- Intentionally NO GRANTs to anon/authenticated. The two edge functions
-- that touch this table use the service role key, which bypasses both
-- the GRANT layer and RLS.

COMMENT ON TABLE public.registration_secrets IS
  'Private per-registration magic_token. Lives in its own table (NOT on event_registrations) because event_registrations has a public SELECT policy and exposing the token would let any anonymous viewer forge score submissions. Service role only — accessed exclusively from phone-otp-verify (insert) and submit-match-score (verify). See migration 20260512110000.';

COMMENT ON COLUMN public.registration_secrets.magic_token IS
  'Opaque UUID returned to the registrant at OTP-verify time. Stored in the client localStorage with a 90-day TTL. Used by submit-match-score to verify a guest before accepting a score submission.';
