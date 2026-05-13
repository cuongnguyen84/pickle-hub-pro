-- ============================================================================
-- Social Events MVP — PR58: registration cancellation metadata
-- ============================================================================
-- event_registrations.status already supports 'cancelled' (constraint in
-- 20260511120000). PR58 adds the bookkeeping needed for the player-facing
-- /dang-ky/:magic_token flow:
--   - cancelled_at   — when the cancellation happened (server timestamp)
--   - cancelled_reason — optional free-text reason ("Bận công việc")
--
-- Setting status='cancelled' alongside these columns keeps the existing
-- slot counter (phone-otp-verify counts WHERE status != 'cancelled') and
-- roster filters working unchanged.
--
-- IDEMPOTENT.
-- ============================================================================

ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS cancelled_reason TEXT;

-- Partial index — most queries care about active registrations and we
-- want roster/counter scans to skip cancelled rows cheaply.
CREATE INDEX IF NOT EXISTS idx_event_registrations_active
  ON public.event_registrations (event_id)
  WHERE cancelled_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_event_registrations_cancelled_at
  ON public.event_registrations (cancelled_at)
  WHERE cancelled_at IS NOT NULL;

COMMENT ON COLUMN public.event_registrations.cancelled_at IS
  'Server timestamp when the player or organizer cancelled. NULL = active registration. Always set alongside status=''cancelled''.';

COMMENT ON COLUMN public.event_registrations.cancelled_reason IS
  'Optional free-text reason recorded at cancellation. Organizer-set cascades use a sentinel string (e.g. ''Event cancelled by organizer'').';

-- ─── get_registration_by_token ────────────────────────────────────────────
-- Powers the /dang-ky/:magic_token page. registration_secrets is service-
-- role only (no anon/auth SELECT), so we expose a SECURITY DEFINER RPC
-- that returns the joined event + registration + payment_order view for
-- a single magic_token. Returns at most one row.

CREATE OR REPLACE FUNCTION public.get_registration_by_token(p_magic_token UUID)
RETURNS TABLE (
  registration_id           UUID,
  event_id                  UUID,
  event_slug                TEXT,
  event_title_vi            TEXT,
  event_title_en            TEXT,
  event_status              TEXT,
  event_start_at            TIMESTAMPTZ,
  event_end_at              TIMESTAMPTZ,
  event_location_text       TEXT,
  event_price_vnd           INTEGER,
  event_cancellation_hours  INTEGER,
  event_max_players         INTEGER,
  active_registrations      INTEGER,
  display_name              TEXT,
  phone                     TEXT,
  status                    TEXT,
  cancelled_at              TIMESTAMPTZ,
  cancelled_reason          TEXT,
  payment_status            TEXT,
  payment_reference_code    TEXT,
  registered_at             TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    er.id                                                 AS registration_id,
    se.id                                                 AS event_id,
    se.slug                                               AS event_slug,
    se.title_vi                                           AS event_title_vi,
    se.title_en                                           AS event_title_en,
    se.status::TEXT                                       AS event_status,
    se.start_at                                           AS event_start_at,
    se.end_at                                             AS event_end_at,
    se.location_text                                      AS event_location_text,
    se.price_vnd                                          AS event_price_vnd,
    se.cancellation_hours                                 AS event_cancellation_hours,
    se.max_players                                        AS event_max_players,
    (
      SELECT COUNT(*)::INTEGER
      FROM public.event_registrations er2
      WHERE er2.event_id = se.id
        AND er2.cancelled_at IS NULL
    )                                                     AS active_registrations,
    er.display_name                                       AS display_name,
    er.phone                                              AS phone,
    er.status                                             AS status,
    er.cancelled_at                                       AS cancelled_at,
    er.cancelled_reason                                   AS cancelled_reason,
    er.payment_status                                     AS payment_status,
    po.reference_code                                     AS payment_reference_code,
    er.registered_at                                      AS registered_at
  FROM public.registration_secrets rs
  JOIN public.event_registrations er ON er.id = rs.registration_id
  JOIN public.social_events       se ON se.id = er.event_id
  LEFT JOIN public.payment_orders po ON po.registration_id = er.id
  WHERE rs.magic_token = p_magic_token
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_registration_by_token(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_registration_by_token(UUID) TO anon;
GRANT  EXECUTE ON FUNCTION public.get_registration_by_token(UUID) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.get_registration_by_token(UUID) TO service_role;

COMMENT ON FUNCTION public.get_registration_by_token(UUID) IS
  'Public RPC powering /dang-ky/:magic_token. SECURITY DEFINER so it can SELECT from registration_secrets (service-role-only RLS). Returns one row joining the event + registration + payment_order.';

-- ─── cancel_social_event ──────────────────────────────────────────────────
-- Atomic cancel-everything helper for the organizer Edit page. Flips the
-- event to status='cancelled' and cascades the same flag onto every
-- active registration so the player-side /dang-ky/:magic_token page
-- renders the "event cancelled by organizer" banner immediately.
--
-- Guarded by the caller's identity — must be the event creator OR an
-- admin. SECURITY DEFINER + explicit check inside (we don't rely on RLS
-- because the helper crosses two tables).

CREATE OR REPLACE FUNCTION public.cancel_social_event(
  p_event_id UUID,
  p_reason   TEXT DEFAULT 'Event cancelled by organizer'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_creator UUID;
  v_status  TEXT;
BEGIN
  SELECT created_by, status INTO v_creator, v_status
  FROM public.social_events
  WHERE id = p_event_id;

  IF v_creator IS NULL THEN
    RAISE EXCEPTION 'event_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Permission: creator or admin only.
  IF auth.uid() IS DISTINCT FROM v_creator
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_status = 'cancelled' THEN
    -- Idempotent — already cancelled, just ensure registrations are too.
    UPDATE public.event_registrations
    SET status           = 'cancelled',
        cancelled_at     = COALESCE(cancelled_at, now()),
        cancelled_reason = COALESCE(cancelled_reason, p_reason)
    WHERE event_id = p_event_id
      AND cancelled_at IS NULL;
    RETURN;
  END IF;

  UPDATE public.social_events
  SET status = 'cancelled'
  WHERE id = p_event_id;

  UPDATE public.event_registrations
  SET status           = 'cancelled',
      cancelled_at     = now(),
      cancelled_reason = p_reason
  WHERE event_id = p_event_id
    AND cancelled_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_social_event(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_social_event(UUID, TEXT) FROM anon;
GRANT  EXECUTE ON FUNCTION public.cancel_social_event(UUID, TEXT) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.cancel_social_event(UUID, TEXT) TO service_role;

COMMENT ON FUNCTION public.cancel_social_event(UUID, TEXT) IS
  'Organizer-only atomic cancel: flips the event to cancelled and cascades the flag onto every active registration. Idempotent.';
