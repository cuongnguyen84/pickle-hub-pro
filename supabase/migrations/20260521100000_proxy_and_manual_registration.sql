-- ============================================================================
-- Social Events MVP — PR: proxy + manual registration ("Đăng ký hộ" / "BTC thêm")
-- ============================================================================
-- Two new entry points into event_registrations that skip OTP verification:
--
--   1. PROXY  — user A (already OTP-verified for the event) registers a
--               friend B on their behalf. A's existing magic_token is used
--               as a capability check.
--   2. MANUAL — organizer adds a player C they took the registration for
--               outside the platform (Zalo group, phone call, walk-in).
--               Caller's supabase JWT is verified inside the edge function.
--
-- After insert, the new registration gets its own magic_token (in
-- registration_secrets) — same shape as a normal OTP-verified row, so
-- /dang-ky/:magic_token, cancel-registration, reactivate-registration,
-- create-payment-order all continue to work unchanged.
--
-- This migration adds:
--   - 3 columns on event_registrations: registered_by_profile_id,
--     registration_source, internal_notes
--   - 1 partial index on registered_by_profile_id
--   - 2 SECURITY DEFINER count RPCs for rate limiting (proxy / manual)
--   - 1 SECURITY DEFINER boolean RPC verify_event_organizer
--
-- Backward compatible — existing rows default to registration_source='self'.
--
-- IDEMPOTENT: replay-safe.
-- ============================================================================

-- ─── 1. New columns on event_registrations ─────────────────────────────────

ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS registered_by_profile_id UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS registration_source TEXT
    NOT NULL DEFAULT 'self';

ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS internal_notes TEXT;

ALTER TABLE public.event_registrations
  DROP CONSTRAINT IF EXISTS event_registrations_registration_source_check;
ALTER TABLE public.event_registrations
  ADD CONSTRAINT event_registrations_registration_source_check
  CHECK (registration_source IN ('self', 'proxy', 'manual'));

CREATE INDEX IF NOT EXISTS event_registrations_registered_by_idx
  ON public.event_registrations (registered_by_profile_id)
  WHERE registered_by_profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS event_registrations_source_recent_idx
  ON public.event_registrations (registration_source, registered_at DESC)
  WHERE registration_source <> 'self';

COMMENT ON COLUMN public.event_registrations.registered_by_profile_id IS
  'When set, identifies the profile who created this registration on behalf of someone else. NULL for self-registrations. Used by the proxy/manual flow and for rate-limiting downstream registrations off a single account.';

COMMENT ON COLUMN public.event_registrations.registration_source IS
  'How this registration row was created: ''self'' = player registered themselves via OTP (default); ''proxy'' = another already-registered player added them; ''manual'' = organizer added them outside OTP. See migration 20260521100000.';

COMMENT ON COLUMN public.event_registrations.internal_notes IS
  'Organizer-only free-text note (e.g. "VIP, bạn của BTC"). NEVER surfaced on the public roster — only visible to event creators + admins. Distinct from the `notes` column which is currently organizer-set but column-level UI shows it on the dashboard the same way.';

-- ─── 2. RPC: count_proxy_registrations_recent ──────────────────────────────
-- Used by the add-registration-direct edge function for rate limiting.
-- SECURITY DEFINER so the service_role can call it without going through
-- the regular RLS on event_registrations (the service role bypasses RLS
-- anyway, but this is the pattern matching the other count_* RPCs).

CREATE OR REPLACE FUNCTION public.count_proxy_registrations_recent(
  p_proxy_profile_id UUID,
  p_hours INTEGER DEFAULT 24
)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.event_registrations
  WHERE registered_by_profile_id = p_proxy_profile_id
    AND registration_source = 'proxy'
    AND COALESCE(registered_at, now()) > now() - (GREATEST(p_hours, 1) || ' hours')::INTERVAL;
$$;

REVOKE ALL ON FUNCTION public.count_proxy_registrations_recent(UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.count_proxy_registrations_recent(UUID, INTEGER) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.count_proxy_registrations_recent(UUID, INTEGER) TO service_role;

COMMENT ON FUNCTION public.count_proxy_registrations_recent(UUID, INTEGER) IS
  'Service-role-only rate-limit helper for the proxy registration path. Returns the number of proxy registrations created by p_proxy_profile_id in the last p_hours hours.';

-- ─── 3. RPC: count_manual_registrations_recent ─────────────────────────────

CREATE OR REPLACE FUNCTION public.count_manual_registrations_recent(
  p_organizer_profile_id UUID,
  p_hours INTEGER DEFAULT 24
)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.event_registrations
  WHERE registered_by_profile_id = p_organizer_profile_id
    AND registration_source = 'manual'
    AND COALESCE(registered_at, now()) > now() - (GREATEST(p_hours, 1) || ' hours')::INTERVAL;
$$;

REVOKE ALL ON FUNCTION public.count_manual_registrations_recent(UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.count_manual_registrations_recent(UUID, INTEGER) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.count_manual_registrations_recent(UUID, INTEGER) TO service_role;

COMMENT ON FUNCTION public.count_manual_registrations_recent(UUID, INTEGER) IS
  'Service-role-only rate-limit helper for the manual registration path. Returns the number of manual registrations created by p_organizer_profile_id in the last p_hours hours.';

-- ─── 4. RPC: verify_event_organizer ────────────────────────────────────────
-- Authorizes manual mode. Caller passes the user_id (resolved from the
-- supabase JWT via auth.getUser inside the edge function). Returns true
-- when that user is the creator of the club hosting p_event_id and the
-- club is not archived. Future multi-organizer support would extend this
-- with a `club_members` join.

CREATE OR REPLACE FUNCTION public.verify_event_organizer(
  p_user_id  UUID,
  p_event_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.social_events e
    LEFT JOIN public.clubs c ON c.id = e.club_id
    WHERE e.id = p_event_id
      AND (
        -- Event creator is always authorized.
        e.created_by = p_user_id
        OR (
          -- Or the user owns the parent club (not archived).
          c.created_by = p_user_id
          AND c.archived_at IS NULL
        )
        -- Or admin (catches all admin overrides).
        OR public.has_role(p_user_id, 'admin'::public.app_role)
      )
  );
$$;

REVOKE ALL ON FUNCTION public.verify_event_organizer(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_event_organizer(UUID, UUID) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.verify_event_organizer(UUID, UUID) TO service_role;

COMMENT ON FUNCTION public.verify_event_organizer(UUID, UUID) IS
  'Service-role-only authorization check: returns true when p_user_id is the event creator, the club owner (club not archived), or an admin. Used by add-registration-direct (manual mode) to gate the no-OTP insert.';
