-- ============================================================================
-- Social Events MVP — PR69: extend get_registration_by_token with bank info
-- ============================================================================
-- The magic-link page (/dang-ky/:token) renders a QR + bank-info card for
-- players with `payment_status='pending_payment'` so they can finish
-- transferring without going back through the registration modal. The
-- RPC already returns reference_code + amount; this migration adds the
-- 3 bank-account fields so the client can build a complete VietQR.
--
-- IDEMPOTENT.
-- ============================================================================

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
  event_bank_code                 TEXT,
  event_bank_account_number       TEXT,
  event_bank_account_name         TEXT,
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
    epc.bank_code                                         AS event_bank_code,
    epc.bank_account_number                               AS event_bank_account_number,
    epc.bank_account_name                                 AS event_bank_account_name,
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
  LEFT JOIN public.event_payment_config epc ON epc.event_id = se.id
  LEFT JOIN public.payment_orders po ON po.registration_id = er.id
  WHERE rs.magic_token = p_magic_token
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_registration_by_token(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_registration_by_token(UUID) TO anon;
GRANT  EXECUTE ON FUNCTION public.get_registration_by_token(UUID) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.get_registration_by_token(UUID) TO service_role;
