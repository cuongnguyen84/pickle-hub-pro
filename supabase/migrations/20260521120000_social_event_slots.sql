-- ============================================================================
-- Social Events — registration slots (skill / duration / general buckets)
-- ============================================================================
-- New feature: organizer chia event thành N "slot" tuỳ chọn. Mỗi slot
-- là 1 phân nhóm nhỏ trong event (ví dụ "2 sân Newbie", "3 sân trình
-- độ 2.5", "Sân dành cho người chơi 6 tháng+"). Khi player đăng ký, họ
-- chọn 1 slot phù hợp và slot_id được lưu vào event_registrations.
--
-- Backward compatible:
--   - Nếu organizer không cấu hình slot, slots = [] và mọi flow cũ giữ
--     nguyên (capacity gate chỉ check max_players).
--   - event_registrations.slot_id NULL = đăng ký không gắn slot (event
--     cũ + event mới có 0 slot).
--
-- Slot shape (JSONB array, mỗi phần tử):
-- {
--   "id"               : "slot-1",         -- text unique trong event
--   "label"            : "2 sân Newbie",   -- text hiển thị
--   "kind"             : "skill"|"duration"|"general",
--   "capacity"         : 8,                -- int >=1, total chỗ cho slot
--   "court_count"      : 2,                -- int optional (hiển thị)
--   "skill_level"      : "2.5",            -- optional, free-text
--   "min_play_months"  : 6,                -- optional int (tháng)
--   "notes"            : "..."             -- optional
-- }
--
-- IDEMPOTENT — replay-safe via IF NOT EXISTS + CREATE OR REPLACE.
-- ============================================================================

-- ─── 1. social_events.slots column ─────────────────────────────────────────

ALTER TABLE public.social_events
  ADD COLUMN IF NOT EXISTS slots JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.social_events
  DROP CONSTRAINT IF EXISTS social_events_slots_is_array;
ALTER TABLE public.social_events
  ADD CONSTRAINT social_events_slots_is_array
  CHECK (jsonb_typeof(slots) = 'array');

COMMENT ON COLUMN public.social_events.slots IS
  'Optional registration slots — array of {id, label, kind, capacity, court_count?, skill_level?, min_play_months?, notes?}. Empty array = no slots (default; capacity gate = max_players).';

-- ─── 2. event_registrations.slot_id column ────────────────────────────────

ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS slot_id TEXT;

ALTER TABLE public.event_registrations
  DROP CONSTRAINT IF EXISTS event_registrations_slot_id_format;
ALTER TABLE public.event_registrations
  ADD CONSTRAINT event_registrations_slot_id_format
  CHECK (slot_id IS NULL OR (length(slot_id) BETWEEN 1 AND 64));

COMMENT ON COLUMN public.event_registrations.slot_id IS
  'References social_events.slots[].id (JSONB). NULL = no slot chosen (event has no slots or legacy registration).';

-- Per-slot cap counting index. Used by phone-otp-verify to count
-- registrations per slot before letting another player into it.
CREATE INDEX IF NOT EXISTS idx_event_registrations_event_slot
  ON public.event_registrations (event_id, slot_id)
  WHERE slot_id IS NOT NULL AND status <> 'cancelled';

-- ─── 3. create_social_event_with_payment RPC refresh ──────────────────────
-- Append `slots` to the INSERT. Defaults to '[]'::jsonb when caller
-- omits the key (older clients work unchanged).

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
    slots
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
    v_slots
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

-- ─── 4. get_event_slot_counts RPC ─────────────────────────────────────────
-- Returns per-slot active registration counts for an event. Used by the
-- RegistrationModal to show "Slot X — 6/8 chỗ còn lại" + disable a slot
-- that's already full. Anonymous-friendly: SELECT policy on
-- event_registrations already lets the public read non-cancelled rows
-- for published+public events, so this RPC is just a typed aggregate.

CREATE OR REPLACE FUNCTION public.get_event_slot_counts(p_event_id UUID)
RETURNS TABLE (slot_id TEXT, registered_count INTEGER)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    er.slot_id,
    COUNT(*)::INTEGER AS registered_count
  FROM public.event_registrations er
  WHERE er.event_id = p_event_id
    AND er.status <> 'cancelled'
    AND er.slot_id IS NOT NULL
  GROUP BY er.slot_id;
$$;

REVOKE ALL ON FUNCTION public.get_event_slot_counts(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_event_slot_counts(UUID) TO anon;
GRANT  EXECUTE ON FUNCTION public.get_event_slot_counts(UUID) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.get_event_slot_counts(UUID) TO service_role;

COMMENT ON FUNCTION public.get_event_slot_counts(UUID) IS
  'Per-slot active registration counts for an event. Used by RegistrationModal to gate per-slot capacity. NULL slot_id rows excluded.';
