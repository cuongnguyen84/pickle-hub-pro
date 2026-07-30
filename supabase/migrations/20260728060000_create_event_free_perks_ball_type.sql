-- create_social_event_with_payment silently DROPPED free_perks and ball_type:
-- both web (CreateSocialEvent.tsx:493 sends free_perks) and native pass them,
-- but the INSERT column list never included either — perks only survived if
-- the organizer went back and EDITED the event (the edit path patches the row
-- directly). Found by the native T4 gate test on 2026-07-28: three fresh
-- draft events all landed with free_perks = NULL despite ticked toggles.
--
-- This is the same function body as before with exactly two additions:
-- free_perks (text[]) and ball_type (text) read from p_event.

-- REPLAY FIX (2026-07-30): the pre-existing function (20260521120000) has
-- p_payment DEFAULT NULL; CREATE OR REPLACE cannot remove a parameter default,
-- so a fresh-DB replay died with 42P13 (prod was applied via manual
-- DROP+CREATE, which is why prod never hit this). DROP first, then restore
-- the original REVOKE/GRANT set at the bottom - DROP wipes the ACL.
DROP FUNCTION IF EXISTS public.create_social_event_with_payment(JSONB, JSONB);

CREATE OR REPLACE FUNCTION public.create_social_event_with_payment(p_event jsonb, p_payment jsonb)
 RETURNS TABLE(event_id uuid, event_slug text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_event_id   UUID;
  v_event_slug TEXT;
  v_price      INTEGER := COALESCE((p_event->>'price_vnd')::INTEGER, 0);
  v_slots      JSONB   := COALESCE(p_event->'slots', '[]'::jsonb);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  -- Slots payload validation: must be a JSON array (CHECK constraint on
  -- the column also enforces this, but failing here gives a friendlier
  -- error message before the INSERT lock acquires.)
  IF jsonb_typeof(v_slots) <> 'array' THEN
    RAISE EXCEPTION 'slots_not_array' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.social_events (
    club_id, slug, title_vi, title_en, description_vi, description_en,
    start_at, end_at, location_text, location_lat, location_lng,
    court_count, max_players, level_min, level_max,
    price_vnd, allow_guests, cancellation_hours, zalo_group_url,
    status, visibility, created_by,
    requires_prepayment, prepayment_deadline_hours,
    slots, free_perks, ball_type
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
    COALESCE((p_event->>'prepayment_deadline_hours')::INTEGER, 12),
    v_slots,
    CASE
      WHEN jsonb_typeof(p_event->'free_perks') = 'array'
       AND jsonb_array_length(p_event->'free_perks') > 0
      THEN ARRAY(SELECT jsonb_array_elements_text(p_event->'free_perks'))
      ELSE NULL
    END,
    NULLIF(p_event->>'ball_type', '')
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
$function$;

REVOKE ALL ON FUNCTION public.create_social_event_with_payment(JSONB, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_social_event_with_payment(JSONB, JSONB) FROM anon;
GRANT  EXECUTE ON FUNCTION public.create_social_event_with_payment(JSONB, JSONB) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.create_social_event_with_payment(JSONB, JSONB) TO service_role;
