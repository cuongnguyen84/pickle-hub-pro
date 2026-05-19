-- ============================================================================
-- Social Events MVP — PR59: registration-recovery infrastructure
-- ============================================================================
-- The /dang-ky/:magic_token page (PR58) is the only player handle on
-- a registration, but users lose it (cleared cache, switched device).
-- SMS brandname registration is ~$1000/yr — too steep for MVP. This
-- migration sets up the schema for a tiered recovery flow:
--   1. Zalo ZNS — when the user has followed the OA (zalo_user_id set)
--   2. Email — when the user provided an email at registration time
--   3. Cloudflare Turnstile CAPTCHA — last-resort, returns the token
--
-- Why a separate `contact_email` column instead of `profiles.email`:
--   The existing profiles.email mirrors auth.users.email which is a
--   fake `ghost+uuid@guest.thepicklehub.net` for guest registrations.
--   contact_email is a user-supplied address keyed for recovery only.
--
-- Why a separate `recovery_attempts` table:
--   Per-phone rate limit for the public edge function so an attacker
--   can't brute-force the recovery channel.
--
-- IDEMPOTENT.
-- ============================================================================

-- ─── 1. profiles — contact_email + zalo_user_id ────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS contact_email TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS zalo_user_id TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_contact_email
  ON public.profiles (lower(contact_email))
  WHERE contact_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_zalo_user_id
  ON public.profiles (zalo_user_id)
  WHERE zalo_user_id IS NOT NULL;

-- Loose format check: contact_email must look like an email if set.
-- (Strict RFC validation is overkill for a recovery hint.)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_contact_email_format;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_contact_email_format
  CHECK (contact_email IS NULL OR contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

COMMENT ON COLUMN public.profiles.contact_email IS
  'User-supplied recovery email. Distinct from profiles.email which mirrors auth.users.email (a fake ghost+uuid@guest address for guest registrations). Used by request-recovery-link to send the /dang-ky/:token URL when the player loses their copy.';

COMMENT ON COLUMN public.profiles.zalo_user_id IS
  'Zalo OA follower id. Set when a user follows the ThePickleHub OA and we receive their follow webhook. Lets request-recovery-link send a ZNS message instead of email.';

-- ─── 2. recovery_attempts — rate-limit ledger ──────────────────────────────

CREATE TABLE IF NOT EXISTS public.recovery_attempts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164    TEXT NOT NULL,
  attempted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  method        TEXT NOT NULL,
  succeeded     BOOLEAN NOT NULL DEFAULT false,
  ip_hash       TEXT
);

ALTER TABLE public.recovery_attempts
  DROP CONSTRAINT IF EXISTS recovery_attempts_method_chk;
ALTER TABLE public.recovery_attempts
  ADD CONSTRAINT recovery_attempts_method_chk
  CHECK (method IN ('zalo', 'email', 'captcha', 'rejected'));

ALTER TABLE public.recovery_attempts
  DROP CONSTRAINT IF EXISTS recovery_attempts_phone_format;
ALTER TABLE public.recovery_attempts
  ADD CONSTRAINT recovery_attempts_phone_format
  CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$');

CREATE INDEX IF NOT EXISTS idx_recovery_attempts_phone_recent
  ON public.recovery_attempts (phone_e164, attempted_at DESC);

-- Service-role only: the table holds rate-limit telemetry + phone
-- numbers and should never be readable from the browser.
ALTER TABLE public.recovery_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.recovery_attempts FROM PUBLIC;
REVOKE ALL ON public.recovery_attempts FROM anon, authenticated;

COMMENT ON TABLE public.recovery_attempts IS
  'Per-phone audit + rate-limit ledger for request-recovery-link. Service-role only — no anon/auth GRANT. See migration 20260512190000.';

-- ─── 3. lookup helper: find_registrations_by_phone ─────────────────────────
-- Powers the recovery edge fn. Returns one row per active/cancelled
-- registration matching the given phone, plus the joined event slug +
-- title + cancelled_at flag so the recovery message can be useful.
-- SECURITY DEFINER because the function reads registration_secrets
-- which is service-role-only at the table level.

CREATE OR REPLACE FUNCTION public.find_registrations_by_phone(
  p_phone_e164 TEXT
)
RETURNS TABLE (
  registration_id  UUID,
  magic_token      UUID,
  event_id         UUID,
  event_slug       TEXT,
  event_title_vi   TEXT,
  event_start_at   TIMESTAMPTZ,
  cancelled_at     TIMESTAMPTZ,
  profile_id       UUID,
  contact_email    TEXT,
  zalo_user_id     TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    er.id           AS registration_id,
    rs.magic_token  AS magic_token,
    se.id           AS event_id,
    se.slug         AS event_slug,
    se.title_vi     AS event_title_vi,
    se.start_at     AS event_start_at,
    er.cancelled_at AS cancelled_at,
    p.id            AS profile_id,
    p.contact_email AS contact_email,
    p.zalo_user_id  AS zalo_user_id
  FROM public.event_registrations er
  JOIN public.registration_secrets rs ON rs.registration_id = er.id
  JOIN public.social_events se        ON se.id = er.event_id
  LEFT JOIN public.profiles p         ON p.id = er.profile_id
  WHERE er.phone = p_phone_e164
    AND se.start_at > now() - INTERVAL '7 days'
  ORDER BY er.registered_at DESC;
$$;

-- Invoke-only by the edge function (service_role). Don't expose to
-- anon — leaking magic_token via a public RPC would defeat the whole
-- recovery-channel gating.
REVOKE ALL ON FUNCTION public.find_registrations_by_phone(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.find_registrations_by_phone(TEXT) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.find_registrations_by_phone(TEXT) TO service_role;

COMMENT ON FUNCTION public.find_registrations_by_phone(TEXT) IS
  'Service-role-only lookup powering request-recovery-link. Returns active+recently-cancelled registrations for a phone, joined with profile contact channels.';

-- ─── 4. update_profile_contact — let phone-otp-verify upsert ──────────────
-- After the optional contact-info step in RegistrationModal, the client
-- needs to write contact_email back to the (likely ghost) profile. The
-- client doesn't have a JWT for the ghost profile, so we expose a
-- SECURITY DEFINER RPC that takes a magic_token and the new email,
-- looks up the registration, and patches the linked profile.

CREATE OR REPLACE FUNCTION public.update_profile_contact_from_magic(
  p_magic_token  UUID,
  p_email        TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id UUID;
BEGIN
  SELECT er.profile_id
    INTO v_profile_id
  FROM public.event_registrations er
  JOIN public.registration_secrets rs ON rs.registration_id = er.id
  WHERE rs.magic_token = p_magic_token
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'registration_not_found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.profiles
  SET contact_email = NULLIF(trim(coalesce(p_email, '')), '')
  WHERE id = v_profile_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_profile_contact_from_magic(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_profile_contact_from_magic(UUID, TEXT) FROM anon;
GRANT  EXECUTE ON FUNCTION public.update_profile_contact_from_magic(UUID, TEXT) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.update_profile_contact_from_magic(UUID, TEXT) TO anon;
GRANT  EXECUTE ON FUNCTION public.update_profile_contact_from_magic(UUID, TEXT) TO service_role;

COMMENT ON FUNCTION public.update_profile_contact_from_magic(UUID, TEXT) IS
  'Magic-token-gated contact-email upsert. Used by the optional post-OTP step in RegistrationModal so a guest can opt into email recovery without an auth.users row.';
