-- Audit fix 2026-06-10 — gate admin analytics RPCs behind an admin-role check.
--
-- These 5 functions are SECURITY DEFINER (so they read auth.users / view_events
-- bypassing RLS) and were GRANTed to `authenticated` with NO internal role check,
-- letting any logged-in user (~1669 viewers) harvest total user count, the daily
-- signup curve, engagement and top-content metrics.
--
-- Fix: convert each to plpgsql and RAISE on non-admin. Bodies are otherwise
-- byte-for-byte identical to migration 20260422000001 so the admin dashboard is
-- unaffected. `public.has_role(uuid, app_role)` already exists (20251221153808).

-- get_new_users_daily ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_new_users_daily(p_start DATE, p_end DATE)
RETURNS TABLE (day DATE, count INTEGER)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT DATE(created_at) AS day, COUNT(*)::INTEGER AS count
    FROM auth.users
    WHERE DATE(created_at) BETWEEN p_start AND p_end
    GROUP BY DATE(created_at)
    ORDER BY day;
END; $$;

-- get_content_stats ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_content_stats(p_start DATE, p_end DATE)
RETURNS JSON
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN (SELECT json_build_object(
    'tournaments', (SELECT COUNT(*)::INTEGER FROM tournaments WHERE DATE(created_at) BETWEEN p_start AND p_end),
    'livestreams', (SELECT COUNT(*)::INTEGER FROM livestreams WHERE DATE(created_at) BETWEEN p_start AND p_end),
    'videos',      (SELECT COUNT(*)::INTEGER FROM videos WHERE DATE(created_at) BETWEEN p_start AND p_end AND status = 'published'),
    'forum_posts', (SELECT COUNT(*)::INTEGER FROM forum_posts WHERE DATE(created_at) BETWEEN p_start AND p_end)
  ));
END; $$;

-- get_engagement_stats ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_engagement_stats(p_start DATE, p_end DATE)
RETURNS JSON
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN (SELECT json_build_object(
    'total_views',      (SELECT COUNT(*)::INTEGER FROM view_events WHERE DATE(created_at) BETWEEN p_start AND p_end),
    'unique_viewers',   (SELECT COUNT(DISTINCT COALESCE(viewer_user_id::TEXT, viewer_ip))::INTEGER FROM view_events WHERE DATE(created_at) BETWEEN p_start AND p_end),
    'video_views',      (SELECT COUNT(*)::INTEGER FROM view_events WHERE target_type = 'video' AND DATE(created_at) BETWEEN p_start AND p_end),
    'livestream_views', (SELECT COUNT(*)::INTEGER FROM view_events WHERE target_type = 'livestream' AND DATE(created_at) BETWEEN p_start AND p_end)
  ));
END; $$;

-- get_top_content ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_top_content(p_start DATE, p_end DATE)
RETURNS TABLE (target_id UUID, target_type TEXT, view_count INTEGER)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT ve.target_id, ve.target_type::TEXT, COUNT(*)::INTEGER AS view_count
    FROM view_events ve
    WHERE DATE(ve.created_at) BETWEEN p_start AND p_end
      AND ve.target_id IS NOT NULL
    GROUP BY ve.target_id, ve.target_type
    ORDER BY view_count DESC
    LIMIT 10;
END; $$;

-- get_user_stats ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_stats(p_start DATE, p_end DATE)
RETURNS JSON
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN (SELECT json_build_object(
    'new_users',    (SELECT COUNT(*)::INTEGER FROM auth.users WHERE DATE(created_at) BETWEEN p_start AND p_end),
    'total_users',  (SELECT COUNT(*)::INTEGER FROM auth.users),
    'active_users', (SELECT COUNT(DISTINCT viewer_user_id)::INTEGER FROM view_events WHERE viewer_user_id IS NOT NULL AND DATE(created_at) BETWEEN p_start AND p_end)
  ));
END; $$;
