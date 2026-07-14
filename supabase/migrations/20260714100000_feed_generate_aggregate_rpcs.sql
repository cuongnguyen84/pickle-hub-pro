-- HOT-02: keep feed milestone calculations inside Postgres so PostgREST's
-- default 1,000-row response cap cannot truncate the source data.

CREATE OR REPLACE FUNCTION public.feed_event_milestone_candidates(
  p_min_count INTEGER DEFAULT 5
)
RETURNS TABLE (
  profile_id UUID,
  display_name TEXT,
  profile_slug TEXT,
  registration_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    er.profile_id,
    p.display_name,
    p.profile_slug,
    COUNT(*) AS registration_count
  FROM public.event_registrations AS er
  JOIN public.profiles AS p ON p.id = er.profile_id
  WHERE er.profile_id IS NOT NULL
    AND er.status <> 'cancelled'
    AND p.is_public_profile = true
    AND p.display_name IS NOT NULL
  GROUP BY er.profile_id, p.display_name, p.profile_slug
  HAVING COUNT(*) >= GREATEST(p_min_count, 1)
  ORDER BY registration_count DESC, er.profile_id;
$$;

REVOKE ALL ON FUNCTION public.feed_event_milestone_candidates(INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.feed_event_milestone_candidates(INTEGER)
  TO service_role;

COMMENT ON FUNCTION public.feed_event_milestone_candidates(INTEGER) IS
  'HOT-02. Service-role-only aggregate for feed event milestones; avoids PostgREST row truncation.';


CREATE OR REPLACE FUNCTION public.feed_dupr_band_crossings(
  p_window_start TIMESTAMPTZ,
  p_min_band NUMERIC DEFAULT 3.0
)
RETURNS TABLE (
  profile_id UUID,
  display_name TEXT,
  profile_slug TEXT,
  reached_band NUMERIC
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH sequenced AS (
    SELECT
      h.profile_id,
      h.dupr_doubles,
      h.recorded_at,
      LAG(h.dupr_doubles) OVER (
        PARTITION BY h.profile_id
        ORDER BY h.recorded_at
      ) AS previous_rating
    FROM public.dupr_rating_history AS h
    WHERE h.recorded_at >= p_window_start
      AND h.dupr_doubles IS NOT NULL
  ),
  latest_crossing AS (
    SELECT DISTINCT ON (s.profile_id)
      s.profile_id,
      FLOOR(s.dupr_doubles * 2) / 2 AS reached_band
    FROM sequenced AS s
    WHERE s.previous_rating IS NOT NULL
      AND FLOOR(s.dupr_doubles * 2) / 2
        > FLOOR(s.previous_rating * 2) / 2
      AND FLOOR(s.dupr_doubles * 2) / 2 >= p_min_band
    ORDER BY s.profile_id, s.recorded_at DESC
  )
  SELECT
    c.profile_id,
    p.display_name,
    p.profile_slug,
    c.reached_band
  FROM latest_crossing AS c
  JOIN public.profiles AS p ON p.id = c.profile_id
  WHERE p.is_public_profile = true
    AND p.display_name IS NOT NULL
  ORDER BY c.profile_id;
$$;

REVOKE ALL ON FUNCTION public.feed_dupr_band_crossings(TIMESTAMPTZ, NUMERIC)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.feed_dupr_band_crossings(TIMESTAMPTZ, NUMERIC)
  TO service_role;

COMMENT ON FUNCTION public.feed_dupr_band_crossings(TIMESTAMPTZ, NUMERIC) IS
  'HOT-02. Service-role-only DUPR band crossing calculation over the full requested window.';


CREATE OR REPLACE FUNCTION public.feed_dupr_weekly_climbers(
  p_window_start TIMESTAMPTZ,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  profile_id UUID,
  display_name TEXT,
  profile_slug TEXT,
  rating_delta NUMERIC,
  current_rating NUMERIC
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH first_last AS (
    SELECT
      h.profile_id,
      (ARRAY_AGG(h.dupr_doubles ORDER BY h.recorded_at ASC))[1] AS first_rating,
      (ARRAY_AGG(h.dupr_doubles ORDER BY h.recorded_at DESC))[1] AS last_rating
    FROM public.dupr_rating_history AS h
    WHERE h.recorded_at >= p_window_start
      AND h.dupr_doubles IS NOT NULL
    GROUP BY h.profile_id
  )
  SELECT
    f.profile_id,
    p.display_name,
    p.profile_slug,
    f.last_rating - f.first_rating AS rating_delta,
    f.last_rating AS current_rating
  FROM first_last AS f
  JOIN public.profiles AS p ON p.id = f.profile_id
  WHERE f.last_rating - f.first_rating > 0.005
    AND p.is_public_profile = true
    AND p.display_name IS NOT NULL
  ORDER BY rating_delta DESC, f.profile_id
  LIMIT GREATEST(LEAST(p_limit, 100), 1);
$$;

REVOKE ALL ON FUNCTION public.feed_dupr_weekly_climbers(TIMESTAMPTZ, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.feed_dupr_weekly_climbers(TIMESTAMPTZ, INTEGER)
  TO service_role;

COMMENT ON FUNCTION public.feed_dupr_weekly_climbers(TIMESTAMPTZ, INTEGER) IS
  'HOT-02. Service-role-only weekly DUPR first/last aggregate over the full requested window.';
