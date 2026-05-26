-- Add notes to feed_timeline output for MLP card rendering
DROP FUNCTION IF EXISTS public.get_feed_timeline(INTEGER, DOUBLE PRECISION, UUID, UUID);

CREATE OR REPLACE FUNCTION public.get_feed_timeline(
  p_limit INTEGER DEFAULT 20,
  p_cursor_score DOUBLE PRECISION DEFAULT NULL,
  p_cursor_item_id UUID DEFAULT NULL,
  p_viewer_id UUID DEFAULT NULL
)
RETURNS TABLE (
  item_type TEXT, item_id UUID, published_at TIMESTAMPTZ, score DOUBLE PRECISION,
  slug TEXT, format TEXT, match_type TEXT, verification_status TEXT, venue_name TEXT,
  team_a_score INTEGER[], team_b_score INTEGER[], winning_team TEXT,
  participants JSONB, kudos_count INTEGER, viewer_kudoed BOOLEAN, comment_count INTEGER,
  source_provider TEXT, source_url TEXT, tournament_name TEXT,
  tournament_event TEXT, round_name TEXT, notes TEXT,
  title TEXT, excerpt TEXT, cover_image_url TEXT, category TEXT, duration_seconds INTEGER
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH window_start AS (SELECT NOW() - INTERVAL '30 days' AS ts),
  match_rows AS (
    SELECT 'match'::TEXT AS item_type, m.id AS item_id, m.played_at AS published_at,
      m.slug, m.format, m.match_type, m.verification_status,
      COALESCE(v.name_vi, v.name, m.venue_name_override) AS venue_name,
      m.team_a_score, m.team_b_score, m.winning_team,
      (SELECT jsonb_agg(jsonb_build_object(
        'player_id', mp.player_id, 'team', mp.team, 'position', mp.position,
        'username', pr.username, 'display_name', pr.display_name,
        'avatar_url', pr.avatar_url, 'is_ghost', pr.is_ghost,
        'dupr_doubles', pr.dupr_doubles, 'country_code', pr.country_code
      ) ORDER BY mp.team, mp.position)
       FROM public.match_participants mp
       JOIN public.profiles pr ON pr.id = mp.player_id
       WHERE mp.match_id = m.id) AS participants,
      COALESCE(mk.cnt,0)::INTEGER AS kudos_count,
      (vmk.user_id IS NOT NULL) AS viewer_kudoed,
      COALESCE(cc.cnt,0)::INTEGER AS comment_count,
      m.source_provider, m.source_url, m.tournament_name, m.tournament_event, m.round_name,
      m.notes,
      NULL::TEXT AS title, NULL::TEXT AS excerpt, NULL::TEXT AS cover_image_url,
      NULL::TEXT AS category, NULL::INTEGER AS duration_seconds,
      'match:' || COALESCE(m.source_provider,'community') || ':' || COALESCE(m.tournament_name,'_none') AS _cluster_key
    FROM public.matches m
    LEFT JOIN public.venues v ON v.id = m.venue_id
    LEFT JOIN LATERAL (SELECT COUNT(*) AS cnt FROM public.kudos k
      WHERE k.target_type='match' AND k.target_id=m.id) mk ON TRUE
    LEFT JOIN public.kudos vmk ON vmk.target_type='match' AND vmk.target_id=m.id AND vmk.user_id=p_viewer_id
    LEFT JOIN LATERAL (SELECT COUNT(*) AS cnt FROM public.social_comments sc
      WHERE sc.target_type='match' AND sc.target_id=m.id AND sc.is_deleted=FALSE) cc ON TRUE
    WHERE m.is_public=TRUE
      AND m.verification_status IN ('verified','pending','disputed')
      AND m.played_at >= (SELECT ts FROM window_start)
  ),
  blog_rows AS (
    SELECT 'blog'::TEXT, b.id, b.published_at, b.slug,
      NULL::TEXT,NULL::TEXT,NULL::TEXT,NULL::TEXT,
      NULL::INTEGER[],NULL::INTEGER[],NULL::TEXT,NULL::JSONB,
      NULL::INTEGER,NULL::BOOLEAN,NULL::INTEGER,
      NULL::TEXT,NULL::TEXT,NULL::TEXT,NULL::TEXT,NULL::TEXT,NULL::TEXT,
      b.title, COALESCE(b.excerpt, b.meta_description), b.cover_image_url, b.category, NULL::INTEGER,
      'blog:' || b.id::TEXT
    FROM public.vi_blog_posts b
    WHERE b.status='published' AND b.published_at IS NOT NULL AND b.published_at >= (SELECT ts FROM window_start)
  ),
  video_rows AS (
    SELECT 'video'::TEXT, vid.id, vid.published_at, NULL::TEXT,
      NULL::TEXT,NULL::TEXT,NULL::TEXT,NULL::TEXT,
      NULL::INTEGER[],NULL::INTEGER[],NULL::TEXT,NULL::JSONB,
      NULL::INTEGER,NULL::BOOLEAN,NULL::INTEGER,
      NULL::TEXT,NULL::TEXT,NULL::TEXT,NULL::TEXT,NULL::TEXT,NULL::TEXT,
      vid.title, vid.description, vid.thumbnail_url, vid.type::TEXT, vid.duration_seconds,
      'video:' || vid.id::TEXT
    FROM public.videos vid
    WHERE vid.status='published' AND vid.published_at IS NOT NULL AND vid.published_at >= (SELECT ts FROM window_start)
  ),
  scored_rows AS (
    SELECT *, (
      EXP(-EXTRACT(EPOCH FROM (NOW()-published_at))/3600.0/48.0)
      * (1.0 + LN(1.0 + COALESCE(kudos_count,0)*1.0 + COALESCE(comment_count,0)*5.0))
      + CASE item_type
          WHEN 'match' THEN CASE source_provider
            WHEN 'ppa_tour' THEN 2.0 WHEN 'mlp' THEN 2.0 WHEN 'app_tour' THEN 2.0
            WHEN 'community' THEN 0.5 ELSE 0.0 END
          WHEN 'blog' THEN 1.0 WHEN 'video' THEN 1.0 ELSE 0.0 END
    )::DOUBLE PRECISION AS _score
    FROM (SELECT * FROM match_rows UNION ALL SELECT * FROM blog_rows UNION ALL SELECT * FROM video_rows) u
  ),
  ranked_rows AS (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY _cluster_key ORDER BY _score DESC, item_id DESC) AS _cluster_rank
    FROM scored_rows
  ),
  final_rows AS (
    SELECT *, (_score - CASE _cluster_rank WHEN 1 THEN 0.0 WHEN 2 THEN 0.3 WHEN 3 THEN 0.6 ELSE 1.5 END)::DOUBLE PRECISION AS _final_score
    FROM ranked_rows
  )
  SELECT item_type, item_id, published_at, _final_score, slug, format, match_type,
    verification_status, venue_name, team_a_score, team_b_score, winning_team,
    participants, kudos_count, viewer_kudoed, comment_count,
    source_provider, source_url, tournament_name, tournament_event, round_name, notes,
    title, excerpt, cover_image_url, category, duration_seconds
  FROM final_rows
  WHERE (p_cursor_score IS NULL OR _final_score < p_cursor_score
    OR (_final_score = p_cursor_score AND p_cursor_item_id IS NOT NULL AND item_id < p_cursor_item_id))
  ORDER BY _final_score DESC, item_id DESC
  LIMIT GREATEST(LEAST(p_limit,100),1);
$$;

GRANT EXECUTE ON FUNCTION public.get_feed_timeline(INTEGER, DOUBLE PRECISION, UUID, UUID) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
