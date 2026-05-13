-- ============================================================================
-- Social Events MVP — PR57: club archive + organizer-facing stats view
-- ============================================================================
-- 1. clubs.archived_at — nullable timestamp. NULL = active club, non-NULL
--    = soft-archived (hidden from /clubs + the avatar dropdown but the
--    page itself + already-published events stay reachable so people
--    holding deep links don't 404).
-- 2. club_stats view — richer than club_listing, used by /clb/:slug/quan-ly/cai-dat
--    and the future club analytics surface. Includes archived clubs so
--    the owner can still see their numbers on the settings page.
-- 3. club_listing view — refresh to filter archived_at IS NULL (public
--    page must hide archived clubs).
--
-- IDEMPOTENT.
-- ============================================================================

-- ─── 1. archived_at column ─────────────────────────────────────────────────

ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_clubs_archived_at
  ON public.clubs (archived_at)
  WHERE archived_at IS NULL;

COMMENT ON COLUMN public.clubs.archived_at IS
  'When the owner soft-archived the club. NULL = active. Archived clubs hide from public /clubs + dropdown but the /clb/:slug page itself still loads.';

-- ─── 2. club_stats view ────────────────────────────────────────────────────
-- Per-club aggregates the organizer settings page renders. Includes
-- archived clubs so the owner can still see them.

CREATE OR REPLACE VIEW public.club_stats AS
SELECT
  c.id,
  c.slug,
  c.name,
  c.description,
  c.logo_url,
  c.location_text,
  c.created_by,
  c.created_at,
  c.archived_at,
  COALESCE(ev.total_events, 0)         AS total_events,
  COALESCE(ev.upcoming_events, 0)      AS upcoming_events,
  COALESCE(ev.completed_events, 0)     AS completed_events,
  COALESCE(reg.total_registrations, 0) AS total_registrations,
  ev.last_event_at
FROM public.clubs c
LEFT JOIN (
  SELECT
    club_id,
    COUNT(*)                                                           AS total_events,
    COUNT(*) FILTER (
      WHERE status = 'published' AND start_at > now()
    )                                                                  AS upcoming_events,
    COUNT(*) FILTER (WHERE status = 'completed')                       AS completed_events,
    MAX(start_at)                                                      AS last_event_at
  FROM public.social_events
  GROUP BY club_id
) ev ON ev.club_id = c.id
LEFT JOIN (
  SELECT
    se.club_id,
    COUNT(*) AS total_registrations
  FROM public.event_registrations er
  JOIN public.social_events se ON se.id = er.event_id
  WHERE er.status = 'confirmed'
  GROUP BY se.club_id
) reg ON reg.club_id = c.id;

GRANT SELECT ON public.club_stats TO anon;
GRANT SELECT ON public.club_stats TO authenticated;

COMMENT ON VIEW public.club_stats IS
  'Per-club aggregates for the organizer settings page. Includes archived clubs. See migration 20260512170000.';

-- ─── 3. user_club_count + create_club_with_cap_check — exclude archived ───
-- Once a club is archived it no longer counts toward the 3-club cap so
-- the owner can pivot to a new club name without admin help. Both the
-- read RPC (user_club_count, kept for older client builds) and the
-- atomic write RPC (create_club_with_cap_check, added in PR55's Codex
-- fix at 20260512160100) need the archived_at filter to stay consistent
-- with the public /clubs view + the new "CLB của tôi" section.

CREATE OR REPLACE FUNCTION public.user_club_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.clubs
  WHERE created_by = p_user_id
    AND archived_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.user_club_count(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_club_count(UUID) FROM anon;
GRANT  EXECUTE ON FUNCTION public.user_club_count(UUID) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.user_club_count(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.create_club_with_cap_check(
  p_slug          TEXT,
  p_name          TEXT,
  p_description   TEXT,
  p_location_text TEXT,
  p_logo_url      TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_count   INTEGER;
  v_new_id  UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.clubs
  WHERE created_by = v_user_id
    AND archived_at IS NULL
  FOR UPDATE;

  IF v_count >= 3 THEN
    RAISE EXCEPTION 'CLUB_CAP_EXCEEDED' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.clubs (
    slug, name, description, location_text, logo_url, created_by
  )
  VALUES (
    p_slug,
    p_name,
    NULLIF(trim(coalesce(p_description, '')), ''),
    p_location_text,
    p_logo_url,
    v_user_id
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_club_with_cap_check(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_club_with_cap_check(TEXT, TEXT, TEXT, TEXT, TEXT) FROM anon;
GRANT  EXECUTE ON FUNCTION public.create_club_with_cap_check(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.create_club_with_cap_check(TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- ─── 4. club_listing — exclude archived + expose creator profile info ────
-- The /clubs cards link to the creator's profile so viewers can poke at
-- their match history. Joining profiles here keeps the cards single-query.

CREATE OR REPLACE VIEW public.club_listing AS
SELECT
  c.id,
  c.slug,
  c.name,
  c.description,
  c.logo_url,
  c.location_text,
  c.created_by,
  c.created_at,
  p.profile_slug   AS creator_profile_slug,
  p.display_name   AS creator_display_name,
  p.username       AS creator_username,
  COALESCE(ev.upcoming_events, 0) AS upcoming_events
FROM public.clubs c
LEFT JOIN public.profiles p ON p.id = c.created_by
LEFT JOIN (
  SELECT
    club_id,
    COUNT(*) AS upcoming_events
  FROM public.social_events
  WHERE status = 'published'
    AND visibility = 'public'
    AND start_at > now()
  GROUP BY club_id
) ev ON ev.club_id = c.id
WHERE c.archived_at IS NULL;

GRANT SELECT ON public.club_listing TO anon;
GRANT SELECT ON public.club_listing TO authenticated;

COMMENT ON VIEW public.club_listing IS
  'Public clubs listing. Excludes archived clubs (archived_at IS NOT NULL). Joins profiles for creator-link metadata. See migration 20260512170000.';
