-- ============================================================================
-- Social Events MVP — PR67: prepayment required + auto-cancel timeout
-- ============================================================================
-- New flow for paid events: the organizer can require players to complete
-- a bank transfer within N hours of registering. If the player doesn't
-- claim payment by the deadline, an hourly cron edge function flips the
-- registration to 'cancelled' so the slot frees up.
--
-- 1. social_events: 2 new columns
-- 2. event_registrations.payment_status: new 'pending_payment' value
-- 3. Partial index for the cron query
-- 4. RPC create_social_event_with_payment: accept the 2 new fields
-- 5. RPC get_registration_by_token: surface requires_prepayment +
--    prepayment_deadline_hours to the player-side magic-link page
--
-- IDEMPOTENT.
-- ============================================================================

-- ─── 1. social_events columns ──────────────────────────────────────────────

ALTER TABLE public.social_events
  ADD COLUMN IF NOT EXISTS requires_prepayment BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.social_events
  ADD COLUMN IF NOT EXISTS prepayment_deadline_hours INTEGER NOT NULL DEFAULT 12;

ALTER TABLE public.social_events
  DROP CONSTRAINT IF EXISTS check_prepayment_deadline_hours_range;
ALTER TABLE public.social_events
  ADD CONSTRAINT check_prepayment_deadline_hours_range
  CHECK (prepayment_deadline_hours >= 1 AND prepayment_deadline_hours <= 168);

COMMENT ON COLUMN public.social_events.requires_prepayment IS
  'When true + price_vnd > 0, players who do not claim payment within prepayment_deadline_hours of registering are auto-cancelled by the auto-cancel-unpaid-registrations edge function.';
COMMENT ON COLUMN public.social_events.prepayment_deadline_hours IS
  'Hours from registered_at after which an unpaid registration is auto-cancelled. Range 1..168 (one week max). Default 12.';

-- ─── 2. payment_status check constraint refresh ────────────────────────────
-- Current constraint allows ('unpaid', 'paid', 'refunded'). Add the new
-- 'pending_payment' value. Drop + recreate; existing rows are unaffected
-- because none of them use the new value.

ALTER TABLE public.event_registrations
  DROP CONSTRAINT IF EXISTS event_registrations_payment_status_check;
ALTER TABLE public.event_registrations
  ADD CONSTRAINT event_registrations_payment_status_check
  CHECK (payment_status IN ('unpaid', 'pending_payment', 'paid', 'refunded'));

-- ─── 3. Partial index for the auto-cancel cron query ──────────────────────
-- The cron runs hourly and scans for rows where the deadline has passed.
-- Partial index on (registered_at) filtered to status='registered' +
-- payment_status='pending_payment' keeps the scan cheap as the table grows.

CREATE INDEX IF NOT EXISTS idx_event_registrations_prepayment_pending
  ON public.event_registrations (registered_at)
  WHERE payment_status = 'pending_payment' AND status = 'registered';

-- ─── 4. Refresh create_social_event_with_payment RPC ──────────────────────
-- Add the two new fields to the INSERT. Defaults handle older clients
-- that don't pass the keys yet (requires_prepayment = false,
-- prepayment_deadline_hours = 12).

CREATE OR REPLACE FUNCTION public.create_social_event_with_payment(
  p_event   JSONB,
  p_payment JSONB
)
RETURNS TABLE (event_id UUID, event_slug TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event_id   UUID;
  v_event_slug TEXT;
  v_price      INTEGER := COALESCE((p_event->>'price_vnd')::INTEGER, 0);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.social_events (
    club_id, slug, title_vi, title_en, description_vi, description_en,
    start_at, end_at, location_text, location_lat, location_lng,
    court_count, max_players, level_min, level_max,
    price_vnd, allow_guests, cancellation_hours, zalo_group_url,
    status, visibility, created_by,
    requires_prepayment, prepayment_deadline_hours
  ) VALUES (
    NULLIF(p_event->>'club_id', '')::UUID,
    p_event->>'slug',
    p_event->>'title_vi',
    NULLIF(p_event->>'title_en', ''),
    NULLIF(p_event->>'description_vi', ''),
    NULLIF(p_event->>'description_en', ''),
    (p_event->>'start_at')::TIMESTAMPTZ,
    (p_event->>'end_at')::TIMESTAMPTZ,
    NULLIF(p_event->>'location_text', ''),
    NULLIF(p_event->>'location_lat', '')::NUMERIC,
    NULLIF(p_event->>'location_lng', '')::NUMERIC,
    COALESCE((p_event->>'court_count')::INTEGER, 1),
    COALESCE((p_event->>'max_players')::INTEGER, 16),
    NULLIF(p_event->>'level_min', '')::NUMERIC,
    NULLIF(p_event->>'level_max', '')::NUMERIC,
    v_price,
    COALESCE((p_event->>'allow_guests')::BOOLEAN, true),
    COALESCE((p_event->>'cancellation_hours')::INTEGER, 12),
    NULLIF(p_event->>'zalo_group_url', ''),
    COALESCE(p_event->>'status', 'draft'),
    COALESCE(p_event->>'visibility', 'public'),
    auth.uid(),
    COALESCE((p_event->>'requires_prepayment')::BOOLEAN, false),
    COALESCE((p_event->>'prepayment_deadline_hours')::INTEGER, 12)
  )
  RETURNING id, slug INTO v_event_id, v_event_slug;

  IF p_payment IS NOT NULL AND v_price > 0 THEN
    INSERT INTO public.event_payment_config (
      event_id, bank_code, bank_account_number, bank_account_name, enabled
    ) VALUES (
      v_event_id,
      p_payment->>'bank_code',
      p_payment->>'bank_account_number',
      p_payment->>'bank_account_name',
      true
    );
  END IF;

  RETURN QUERY SELECT v_event_id, v_event_slug;
END;
$$;

REVOKE ALL ON FUNCTION public.create_social_event_with_payment(JSONB, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_social_event_with_payment(JSONB, JSONB) FROM anon;
GRANT  EXECUTE ON FUNCTION public.create_social_event_with_payment(JSONB, JSONB) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.create_social_event_with_payment(JSONB, JSONB) TO service_role;

-- ─── 5. Refresh get_registration_by_token RPC ─────────────────────────────
-- Append two columns to the return row so PlayerRegistration can render
-- the countdown banner without a second fetch.

CREATE OR REPLACE FUNCTION public.get_registration_by_token(p_magic_token UUID)
RETURNS TABLE (
  registration_id                 UUID,
  event_id                        UUID,
  event_slug                      TEXT,
  event_title_vi                  TEXT,
  event_title_en                  TEXT,
  event_status                    TEXT,
  event_start_at                  TIMESTAMPTZ,
  event_end_at                    TIMESTAMPTZ,
  event_location_text             TEXT,
  event_price_vnd                 INTEGER,
  event_cancellation_hours        INTEGER,
  event_max_players               INTEGER,
  event_requires_prepayment       BOOLEAN,
  event_prepayment_deadline_hours INTEGER,
  active_registrations            INTEGER,
  display_name                    TEXT,
  phone                           TEXT,
  status                          TEXT,
  cancelled_at                    TIMESTAMPTZ,
  cancelled_reason                TEXT,
  payment_status                  TEXT,
  payment_order_id                UUID,
  payment_reference_code          TEXT,
  player_claimed_paid             BOOLEAN,
  registered_at                   TIMESTAMPTZ
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
    se.requires_prepayment                                AS event_requires_prepayment,
    se.prepayment_deadline_hours                          AS event_prepayment_deadline_hours,
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
    po.id                                                 AS payment_order_id,
    po.reference_code                                     AS payment_reference_code,
    COALESCE(po.player_claimed_paid, false)               AS player_claimed_paid,
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
