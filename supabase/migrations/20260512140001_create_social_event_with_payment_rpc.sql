-- ============================================================================
-- Social Events MVP — PR51: atomic create-event-with-payment RPC
-- ============================================================================
-- The wizard's submit needs to write two rows — social_events and
-- (optionally) event_payment_config — atomically so a network drop or
-- RLS failure on the second INSERT can't leave a paid event without
-- bank config behind. supabase-js doesn't expose a transaction wrapper
-- from the client, so we ship the two-INSERT sequence inside a
-- PL/pgSQL function that the client calls via `.rpc()`.
--
-- SECURITY INVOKER (the default) — RLS still applies, so each INSERT's
-- WITH CHECK clause enforces ownership: the caller can only create an
-- event for a club they own (or as admin), and they can only attach a
-- payment config to an event they just created.
--
-- IDEMPOTENT: replay-safe via CREATE OR REPLACE.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_social_event_with_payment(
  p_event   JSONB,
  p_payment JSONB DEFAULT NULL
)
RETURNS TABLE (event_id UUID, event_slug TEXT)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event_id   UUID;
  v_event_slug TEXT;
  v_price      INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  v_price := COALESCE((p_event->>'price_vnd')::INTEGER, 0);

  -- If the caller said the event has a price > 0, the payment payload is
  -- required. Pre-validate to fail fast before any INSERT.
  IF v_price > 0 AND p_payment IS NULL THEN
    RAISE EXCEPTION 'payment_required_for_paid_event' USING ERRCODE = '22023';
  END IF;
  IF p_payment IS NOT NULL THEN
    IF NULLIF(p_payment->>'bank_code', '') IS NULL
       OR NULLIF(p_payment->>'bank_account_number', '') IS NULL
       OR NULLIF(p_payment->>'bank_account_name', '') IS NULL THEN
      RAISE EXCEPTION 'bank_info_incomplete' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- Insert the event. RLS enforces ownership via the
  -- social_events_insert_owner_or_admin policy — caller MUST own the
  -- club_id or be admin. created_by is forced to auth.uid() here so the
  -- jsonb payload can't impersonate another user.
  INSERT INTO public.social_events (
    club_id, slug, title_vi, title_en, description_vi, description_en,
    start_at, end_at, location_text, location_lat, location_lng,
    court_count, max_players, level_min, level_max,
    price_vnd, allow_guests, cancellation_hours, zalo_group_url,
    status, visibility, created_by
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
    auth.uid()
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

COMMENT ON FUNCTION public.create_social_event_with_payment(JSONB, JSONB) IS
  'Atomic event + optional event_payment_config insert. SECURITY INVOKER — RLS still applies on both target tables. created_by is forced to auth.uid() so the jsonb payload cannot impersonate. See migration 20260512140001.';
