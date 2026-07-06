-- ============================================================================
-- SECURITY M6 (2026-07-06): bound the lifetime of registration magic tokens
-- ----------------------------------------------------------------------------
-- registration_secrets.magic_token had no expiry — once leaked (it lives in the
-- guest's localStorage) it was valid forever, letting a holder submit match
-- scores for that registration indefinitely.
--
-- Fix: add expires_at and bound every token to 400 days from creation. Social
-- events / tournaments are far shorter than 400 days, so no legitimate guest is
-- affected — a returning guest re-opening a 400+-day-old registration is not a
-- real flow. Enforcement lives in submit-match-score (the score-forgery path).
--
-- Additive + idempotent.
-- ============================================================================

ALTER TABLE public.registration_secrets
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- New rows: 400 days from insert.
ALTER TABLE public.registration_secrets
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '400 days');

-- Existing rows: bound to created_at + 400 days (recent tokens stay valid,
-- long-expired-event tokens become invalid).
UPDATE public.registration_secrets
SET expires_at = created_at + interval '400 days'
WHERE expires_at IS NULL;

COMMENT ON COLUMN public.registration_secrets.expires_at IS
  'Magic-token expiry (M6, 2026-07-06). 400 days from creation. Enforced in submit-match-score.';

NOTIFY pgrst, 'reload schema';
