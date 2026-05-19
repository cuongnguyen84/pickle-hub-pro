-- ============================================
-- CREATOR ANALYTICS RPC FUNCTIONS
-- ============================================

-- 1. Get organization analytics summary (KPIs)
CREATE OR REPLACE FUNCTION public.get_org_analytics_summary(
  _org_id uuid,
  _days integer DEFAULT 30
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
  _start_date timestamptz := now() - (_days || ' days')::interval;
BEGIN
  -- Verify caller has access to this org
  IF NOT (
    public.is_admin() OR 
    (public.is_creator() AND public.get_user_organization_id(auth.uid()) = _org_id)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT json_build_object(
    'total_views', (
      SELECT COUNT(*) 
      FROM view_events 
      WHERE organization_id = _org_id 
        AND created_at >= _start_date
    ),
    'total_livestreams', (
      SELECT COUNT(*) 
      FROM livestreams 
      WHERE organization_id = _org_id
    ),
    'total_videos', (
      SELECT COUNT(*) 
      FROM videos 
      WHERE organization_id = _org_id 
        AND status = 'published'
    ),
    'followers_count', (
      SELECT COUNT(*) 
      FROM follows 
      WHERE target_type = 'organization' 
        AND target_id = _org_id
    ),
    'live_now', (
      SELECT COUNT(*) 
      FROM livestreams 
      WHERE organization_id = _org_id 
        AND status = 'live'
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- 2. Get views over time (for chart)
CREATE OR REPLACE FUNCTION public.get_org_views_over_time(
  _org_id uuid,
  _days integer DEFAULT 7
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
  _start_date date := (now() - (_days || ' days')::interval)::date;
BEGIN
  -- Verify access
  IF NOT (
    public.is_admin() OR 
    (public.is_creator() AND public.get_user_organization_id(auth.uid()) = _org_id)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT json_agg(
    json_build_object(
      'date', day::date,
      'views', COALESCE(view_count, 0)
    ) ORDER BY day
  )
  FROM (
    SELECT generate_series(_start_date, CURRENT_DATE, '1 day'::interval) AS day
  ) dates
  LEFT JOIN (
    SELECT DATE(created_at) as view_date, COUNT(*) as view_count
    FROM view_events
    WHERE organization_id = _org_id
      AND created_at >= _start_date
    GROUP BY DATE(created_at)
  ) views ON dates.day::date = views.view_date
  INTO result;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- 3. Get top performing content
CREATE OR REPLACE FUNCTION public.get_org_top_content(
  _org_id uuid,
  _days integer DEFAULT 30,
  _limit integer DEFAULT 5
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
  _start_date timestamptz := now() - (_days || ' days')::interval;
BEGIN
  -- Verify access
  IF NOT (
    public.is_admin() OR 
    (public.is_creator() AND public.get_user_organization_id(auth.uid()) = _org_id)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Combine videos and livestreams with view counts
  WITH content_views AS (
    -- Videos
    SELECT 
      v.id,
      v.title,
      v.thumbnail_url,
      'video' as content_type,
      v.created_at,
      COUNT(ve.id) as view_count
    FROM videos v
    LEFT JOIN view_events ve ON ve.target_id = v.id 
      AND ve.target_type = 'video'
      AND ve.created_at >= _start_date
    WHERE v.organization_id = _org_id
      AND v.status = 'published'
    GROUP BY v.id, v.title, v.thumbnail_url, v.created_at
    
    UNION ALL
    
    -- Livestreams
    SELECT 
      l.id,
      l.title,
      l.thumbnail_url,
      'livestream' as content_type,
      l.created_at,
      COUNT(ve.id) as view_count
    FROM livestreams l
    LEFT JOIN view_events ve ON ve.target_id = l.id 
      AND ve.target_type = 'livestream'
      AND ve.created_at >= _start_date
    WHERE l.organization_id = _org_id
    GROUP BY l.id, l.title, l.thumbnail_url, l.created_at
  )
  SELECT json_agg(
    json_build_object(
      'id', id,
      'title', title,
      'thumbnail_url', thumbnail_url,
      'content_type', content_type,
      'view_count', view_count
    )
  )
  FROM (
    SELECT * FROM content_views
    ORDER BY view_count DESC, created_at DESC
    LIMIT _limit
  ) top_content
  INTO result;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- 4. Get views by content type
CREATE OR REPLACE FUNCTION public.get_org_views_by_type(
  _org_id uuid,
  _days integer DEFAULT 30
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
  _start_date timestamptz := now() - (_days || ' days')::interval;
BEGIN
  -- Verify access
  IF NOT (
    public.is_admin() OR 
    (public.is_creator() AND public.get_user_organization_id(auth.uid()) = _org_id)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT json_build_object(
    'video', (
      SELECT COUNT(*) 
      FROM view_events 
      WHERE organization_id = _org_id 
        AND target_type = 'video'
        AND created_at >= _start_date
    ),
    'livestream', (
      SELECT COUNT(*) 
      FROM view_events 
      WHERE organization_id = _org_id 
        AND target_type = 'livestream'
        AND created_at >= _start_date
    )
  ) INTO result;

  RETURN result;
END;
$$;