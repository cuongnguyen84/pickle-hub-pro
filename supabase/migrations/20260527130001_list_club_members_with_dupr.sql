-- ============================================================================
-- Extend list_club_members RPC with DUPR fields
-- ============================================================================
-- Trang /clb/:slug/quan-ly cần hiển thị trạng thái DUPR (đã/chưa kết nối +
-- rating) cho từng thành viên. Thay vì client gọi 2 query (members +
-- profiles), em mở rộng RPC list_club_members để JOIN sẵn các cột DUPR
-- cần thiết:
--   - dupr_id              text          (NULL = chưa kết nối)
--   - dupr_singles         numeric(4,2)
--   - dupr_doubles         numeric(4,2)
--   - dupr_connected_via   text          ('sso' | 'manual' | 'pending_reconnect' | NULL)
--
-- Postgres không cho phép CREATE OR REPLACE khi đổi return type — phải
-- DROP trước. Migration là idempotent vì DROP IF EXISTS + CREATE.
--
-- Logic giữ nguyên: organizer thấy cả pending + active + email/phone;
-- non-organizer chỉ thấy active + không có email/phone.
-- ============================================================================

DROP FUNCTION IF EXISTS public.list_club_members(UUID);

CREATE FUNCTION public.list_club_members(p_club_id UUID)
RETURNS TABLE (
  profile_id          UUID,
  display_name        TEXT,
  email               TEXT,
  phone               TEXT,
  avatar_url          TEXT,
  status              TEXT,
  added_at            TIMESTAMPTZ,
  added_by            UUID,
  approved_at         TIMESTAMPTZ,
  dupr_id             TEXT,
  dupr_singles        NUMERIC,
  dupr_doubles        NUMERIC,
  dupr_connected_via  TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    m.profile_id,
    p.display_name,
    CASE WHEN public.is_club_organizer(p_club_id, auth.uid()) THEN p.email ELSE NULL END AS email,
    CASE WHEN public.is_club_organizer(p_club_id, auth.uid()) THEN p.phone ELSE NULL END AS phone,
    p.avatar_url,
    m.status,
    m.added_at,
    m.added_by,
    m.approved_at,
    p.dupr_id,
    p.dupr_singles,
    p.dupr_doubles,
    p.dupr_connected_via
  FROM public.club_members m
  JOIN public.profiles p ON p.id = m.profile_id
  WHERE m.club_id = p_club_id
    AND (
      m.status = 'active'
      OR public.is_club_organizer(p_club_id, auth.uid())
    )
  ORDER BY
    CASE m.status WHEN 'pending' THEN 0 ELSE 1 END,
    m.added_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.list_club_members(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.list_club_members(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_club_members(UUID) TO service_role;

COMMENT ON FUNCTION public.list_club_members(UUID) IS
  'List CLB members + 4 DUPR fields cho ClubMembers UI. Organizer thấy pending + active + email/phone. Non-organizer chỉ active + masked. See migration 20260527130000 (replaces 20260522120000).';
