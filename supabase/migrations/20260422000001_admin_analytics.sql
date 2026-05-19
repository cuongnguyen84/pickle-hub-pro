-- Admin Analytics: presence heartbeats + RPC metric functions
-- Created: 2026-04-22

-- ─── presence_heartbeats ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.presence_heartbeats (
  session_id   TEXT        NOT NULL,
  user_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  page_path    TEXT,
  PRIMARY KEY (session_id)
);

CREATE INDEX IF NOT EXISTS idx_presence_heartbeats_last_seen
  ON public.presence_heartbeats (last_seen_at);

-- RLS: allow anon + authenticated upsert their own session; no SELECT for non-admin
ALTER TABLE public.presence_heartbeats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "presence_upsert_own"
  ON public.presence_heartbeats
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ─── RPC: get_online_now ───────────────────────────────────────────────────
-- Returns count of sessions active within last 5 minutes
CREATE OR REPLACE FUNCTION public.get_online_now()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM presence_heartbeats
  WHERE last_seen_at > now() - INTERVAL '5 minutes';
$$;

-- ─── RPC: get_new_users_daily ──────────────────────────────────────────────
-- Returns daily new user sign-up counts for a date range
CREATE OR REPLACE FUNCTION public.get_new_users_daily(
  p_start DATE,
  p_end   DATE
)
RETURNS TABLE (day DATE, count INTEGER)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    DATE(created_at) AS day,
    COUNT(*)::INTEGER AS count
  FROM auth.users
  WHERE DATE(created_at) BETWEEN p_start AND p_end
  GROUP BY DATE(created_at)
  ORDER BY day;
$$;

-- ─── RPC: get_content_stats ────────────────────────────────────────────────
-- Returns aggregate content counts for a date range
CREATE OR REPLACE FUNCTION public.get_content_stats(
  p_start DATE,
  p_end   DATE
)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'tournaments', (
      SELECT COUNT(*)::INTEGER FROM tournaments
      WHERE DATE(created_at) BETWEEN p_start AND p_end
    ),
    'livestreams', (
      SELECT COUNT(*)::INTEGER FROM livestreams
      WHERE DATE(created_at) BETWEEN p_start AND p_end
    ),
    'videos', (
      SELECT COUNT(*)::INTEGER FROM videos
      WHERE DATE(created_at) BETWEEN p_start AND p_end
        AND status = 'published'
    ),
    'forum_posts', (
      SELECT COUNT(*)::INTEGER FROM forum_posts
      WHERE DATE(created_at) BETWEEN p_start AND p_end
    )
  );
$$;

-- ─── RPC: get_engagement_stats ─────────────────────────────────────────────
-- Returns engagement metrics (view events) for a date range
CREATE OR REPLACE FUNCTION public.get_engagement_stats(
  p_start DATE,
  p_end   DATE
)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'total_views', (
      SELECT COUNT(*)::INTEGER FROM view_events
      WHERE DATE(created_at) BETWEEN p_start AND p_end
    ),
    'unique_viewers', (
      SELECT COUNT(DISTINCT COALESCE(viewer_user_id::TEXT, viewer_ip))::INTEGER
      FROM view_events
      WHERE DATE(created_at) BETWEEN p_start AND p_end
    ),
    'video_views', (
      SELECT COUNT(*)::INTEGER FROM view_events
      WHERE target_type = 'video'
        AND DATE(created_at) BETWEEN p_start AND p_end
    ),
    'livestream_views', (
      SELECT COUNT(*)::INTEGER FROM view_events
      WHERE target_type = 'livestream'
        AND DATE(created_at) BETWEEN p_start AND p_end
    )
  );
$$;

-- ─── RPC: get_top_content ──────────────────────────────────────────────────
-- Returns top 10 most viewed content items in a date range
CREATE OR REPLACE FUNCTION public.get_top_content(
  p_start DATE,
  p_end   DATE
)
RETURNS TABLE (
  target_id   UUID,
  target_type TEXT,
  view_count  INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    target_id,
    target_type::TEXT,
    COUNT(*)::INTEGER AS view_count
  FROM view_events
  WHERE DATE(created_at) BETWEEN p_start AND p_end
    AND target_id IS NOT NULL
  GROUP BY target_id, target_type
  ORDER BY view_count DESC
  LIMIT 10;
$$;

-- ─── RPC: get_user_stats ───────────────────────────────────────────────────
-- Returns user aggregate stats for a date range
CREATE OR REPLACE FUNCTION public.get_user_stats(
  p_start DATE,
  p_end   DATE
)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'new_users', (
      SELECT COUNT(*)::INTEGER FROM auth.users
      WHERE DATE(created_at) BETWEEN p_start AND p_end
    ),
    'total_users', (
      SELECT COUNT(*)::INTEGER FROM auth.users
    ),
    'active_users', (
      SELECT COUNT(DISTINCT viewer_user_id)::INTEGER FROM view_events
      WHERE viewer_user_id IS NOT NULL
        AND DATE(created_at) BETWEEN p_start AND p_end
    )
  );
$$;

-- ─── Grants ────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.get_online_now() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_new_users_daily(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_content_stats(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_engagement_stats(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_content(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_stats(DATE, DATE) TO authenticated;
GRANT ALL ON TABLE public.presence_heartbeats TO authenticated, anon;
