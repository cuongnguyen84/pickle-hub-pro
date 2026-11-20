-- M6 phase2 SQL consumers only. DEPENDS on20261120220000 phase1 predicate.
-- Staged: do not apply before verified reissuance and Edge compatibility gates.
-- Existing signatures/grants/search_path/business checks preserved. JWT issuer
-- register_event_as_member intentionally unchanged; no renewal/rotation implied.

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
    AND public.registration_token_is_valid(rs.registration_id, p_magic_token)
  LIMIT 1;
$$;

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
    AND public.registration_token_is_valid(rs.registration_id, p_magic_token)
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'registration_not_found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.profiles
  SET contact_email = NULLIF(trim(coalesce(p_email, '')), '')
  WHERE id = v_profile_id;
END;
$$;

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
    AND public.registration_token_is_valid(rs.registration_id, rs.magic_token)
    AND se.start_at > now() - INTERVAL '7 days'
  ORDER BY er.registered_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.link_event_dupr_id_by_token(
  p_magic_token UUID,
  p_dupr_id     TEXT
)
RETURNS TABLE (
  registration_id UUID,
  event_id        UUID,
  dupr_id         TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reg_id     UUID;
  v_event_id   UUID;
  v_clean_id   TEXT := NULLIF(trim(p_dupr_id), '');
BEGIN
  IF p_magic_token IS NULL THEN
    RAISE EXCEPTION 'magic_token_required' USING ERRCODE = '22023';
  END IF;

  -- Validate DUPR id shape (sync với CHECK constraint).
  IF v_clean_id IS NOT NULL THEN
    IF length(v_clean_id) NOT BETWEEN 2 AND 32 THEN
      RAISE EXCEPTION 'dupr_id_invalid_length' USING ERRCODE = '22023';
    END IF;
    IF v_clean_id !~ '^[A-Za-z0-9_-]+$' THEN
      RAISE EXCEPTION 'dupr_id_invalid_format' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- magic_token được issue ở phone-otp-verify, lưu vào registration_secrets
  -- (không public-readable). Lookup phải qua SECURITY DEFINER.
  SELECT s.registration_id, r.event_id
  INTO v_reg_id, v_event_id
  FROM public.registration_secrets s
  JOIN public.event_registrations r ON r.id = s.registration_id
  WHERE s.magic_token = p_magic_token
    AND public.registration_token_is_valid(s.registration_id, p_magic_token)
    AND r.status <> 'cancelled';

  IF v_reg_id IS NULL THEN
    RAISE EXCEPTION 'registration_not_found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.event_registrations
  SET dupr_id = v_clean_id
  WHERE id = v_reg_id;

  RETURN QUERY
    SELECT v_reg_id, v_event_id, v_clean_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_event_dupr_by_token(
  p_magic_token UUID
)
RETURNS TABLE (
  registration_id UUID,
  event_id        UUID,
  dupr_id         TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT r.id, r.event_id, r.dupr_id
  FROM public.registration_secrets s
  JOIN public.event_registrations r ON r.id = s.registration_id
  WHERE s.magic_token = p_magic_token
    AND public.registration_token_is_valid(s.registration_id, p_magic_token)
  LIMIT 1;
$$;
