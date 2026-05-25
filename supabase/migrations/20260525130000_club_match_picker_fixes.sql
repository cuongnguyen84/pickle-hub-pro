-- ============================================================================
-- Club match picker + manager-search UX fixes
-- ============================================================================
-- Issues surfaced 2026-05-25 (post club-log-match deploy):
--
-- 1) LogMatchDialog player picker only shows active club_members rows, so
--    a CLB with 2 managers + 1 member exposed only the member. Creator
--    and managers can play (and the log_club_match RPC already accepts
--    them via is_club_organizer), but the UI couldn't pick them.
--
-- 2) search_profile_for_manager only did exact email/phone match. Typing
--    `thecuong` to find `thecuong@gmail.com` returned no result, which
--    is a poor UX for the invite flow.
--
-- This migration:
--   A) Adds `list_club_eligible_players` RPC that unions creator +
--      managers + active members, dedupes, returns one row per profile
--      with the player's role tag ('creator' | 'manager' | 'member').
--   B) Replaces `search_profile_for_manager` to accept email prefix
--      matches (lower(email) LIKE lower(p_query) || '%'), still exact
--      on phone, capped to 5 results, still gated to authenticated.
--
-- IDEMPOTENT — replay-safe.
-- ============================================================================

-- ─── 1. list_club_eligible_players ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.list_club_eligible_players(
  p_club_id UUID
)
RETURNS TABLE (
  profile_id    UUID,
  display_name  TEXT,
  avatar_url    TEXT,
  dupr_id       TEXT,
  role          TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH ranked AS (
    -- Creator first.
    SELECT
      p.id           AS profile_id,
      p.display_name,
      p.avatar_url,
      p.dupr_id,
      'creator'::TEXT AS role,
      0 AS sort_priority
    FROM public.clubs c
    JOIN public.profiles p ON p.id = c.created_by
    WHERE c.id = p_club_id
      AND p.is_ghost IS NOT TRUE

    UNION ALL

    -- Managers next.
    SELECT
      p.id,
      p.display_name,
      p.avatar_url,
      p.dupr_id,
      'manager',
      1
    FROM public.club_managers cm
    JOIN public.profiles p ON p.id = cm.profile_id
    WHERE cm.club_id = p_club_id
      AND p.is_ghost IS NOT TRUE

    UNION ALL

    -- Active members last.
    SELECT
      p.id,
      p.display_name,
      p.avatar_url,
      p.dupr_id,
      'member',
      2
    FROM public.club_members m
    JOIN public.profiles p ON p.id = m.profile_id
    WHERE m.club_id = p_club_id
      AND m.status = 'active'
      AND p.is_ghost IS NOT TRUE
  ),
  deduped AS (
    -- If the same profile appears under multiple relations (rare — e.g.
    -- creator was also added as a manager by mistake) keep the highest
    -- precedence role via DISTINCT ON ordered by sort_priority.
    SELECT DISTINCT ON (profile_id)
      profile_id, display_name, avatar_url, dupr_id, role, sort_priority
    FROM ranked
    ORDER BY profile_id, sort_priority
  )
  SELECT profile_id, display_name, avatar_url, dupr_id, role
  FROM deduped
  ORDER BY sort_priority, lower(coalesce(display_name, ''));
$$;

REVOKE ALL ON FUNCTION public.list_club_eligible_players(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.list_club_eligible_players(UUID) TO anon;
GRANT  EXECUTE ON FUNCTION public.list_club_eligible_players(UUID) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.list_club_eligible_players(UUID) TO service_role;

COMMENT ON FUNCTION public.list_club_eligible_players(UUID) IS
  'Returns the union of creator + managers + active members for a CLB, deduped per profile, ordered creator → managers → members. Used by the log-match player picker so any organizer or active member can be tagged. See migration 20260525130000.';

-- ─── 2. search_profile_for_manager — accept email prefix ──────────────────

DROP FUNCTION IF EXISTS public.search_profile_for_manager(TEXT);

CREATE OR REPLACE FUNCTION public.search_profile_for_manager(
  p_query TEXT
)
RETURNS TABLE (
  profile_id    UUID,
  display_name  TEXT,
  email         TEXT,
  phone         TEXT,
  avatar_url    TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_query TEXT := trim(coalesce(p_query, ''));
  v_lower TEXT;
BEGIN
  -- Must be signed in. Min 4 chars to avoid scrape-by-single-letter.
  IF auth.uid() IS NULL OR length(v_query) < 4 THEN
    RETURN;
  END IF;

  v_lower := lower(v_query);

  RETURN QUERY
    SELECT p.id, p.display_name, p.email, p.phone, p.avatar_url
    FROM public.profiles p
    WHERE p.is_ghost IS NOT TRUE
      AND (
        -- Exact email match (case-insensitive).
        lower(p.email) = v_lower
        -- Prefix email match — typing "thecuong" finds "thecuong@gmail.com".
        -- Anchor to start of local-part so we don't return arbitrary domain
        -- collisions; the leading lower() makes the LIKE case-insensitive.
        OR lower(p.email) LIKE v_lower || '%'
        -- Phone stays exact (no prefix to avoid e.g. "+84" leaking the
        -- whole user base).
        OR p.phone = v_query
      )
    ORDER BY
      -- Exact email first, then prefix matches alphabetically.
      CASE WHEN lower(p.email) = v_lower THEN 0 ELSE 1 END,
      lower(coalesce(p.email, ''))
    LIMIT 5;
END;
$$;

REVOKE ALL ON FUNCTION public.search_profile_for_manager(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_profile_for_manager(TEXT) FROM anon;
GRANT  EXECUTE ON FUNCTION public.search_profile_for_manager(TEXT) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.search_profile_for_manager(TEXT) TO service_role;

COMMENT ON FUNCTION public.search_profile_for_manager(TEXT) IS
  'Search profiles by email (exact or prefix) or phone (exact) for invite UI. Authenticated only, min 4 chars, capped at 5 results. See migration 20260525130000.';
