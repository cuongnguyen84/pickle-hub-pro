-- Bring finished results back onto /feed.
--
-- OWNER APPROVAL REQUIRED before this is applied to production.
-- Do not run it against the live project as part of opening the PR.
--
-- Replaces get_feed_timeline (same arguments and return row) and adds
-- get_feed_recent_results for the page-1 overlay.
--
--   * Blog type bonus drops from 1.0 to 0.25.
--   * Completed matches stay eligible for 90 days. Blogs and videos stay at 30.
--   * A result older than 14 days keeps only a 0.2 bonus, so a quiet month
--     does not push every post off the RPC page. The overlay still returns
--     those rows by time, and the client / SSR interleave places them.
--   * New result rows, each linking at the page that already shows the match:
--       public Quick Table finals          → /tools/quick-tables/:shareId
--       doubles-elimination finals         → /tools/doubles-elimination/:shareId
--       team-match finals                  → /tools/team-match/:shareId
--     Pro rows (PPA, MLP, APP) stay on public.matches and still link to
--     /tran-dau/:slug. Vietnam pro events are those same rows.
--   * Quick-table finals previously copied into public.matches by
--     surface_quick_table_results (slug qt-…) are left out, so the feed
--     links the quick-table page once.

CREATE OR REPLACE FUNCTION public.feed_named_side(
  p_team text,
  p_anchor uuid,
  p_name_1 text,
  p_name_2 text
) RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(elem ORDER BY ord), '[]'::jsonb)
  FROM (
    SELECT 1 AS ord,
      jsonb_build_object(
        'player_id', COALESCE(p_anchor::text, p_team || ':1'),
        'team', p_team,
        'position', 1,
        'username', NULL,
        'display_name', NULLIF(btrim(p_name_1), ''),
        'avatar_url', NULL,
        'is_ghost', TRUE,
        'dupr_doubles', NULL
      ) AS elem
    WHERE NULLIF(btrim(COALESCE(p_name_1, '')), '') IS NOT NULL
    UNION ALL
    SELECT 2,
      jsonb_build_object(
        'player_id', COALESCE(p_anchor::text, p_team) || ':2',
        'team', p_team,
        'position', 2,
        'username', NULL,
        'display_name', NULLIF(btrim(p_name_2), ''),
        'avatar_url', NULL,
        'is_ghost', TRUE,
        'dupr_doubles', NULL
      )
    WHERE NULLIF(btrim(COALESCE(p_name_2, '')), '') IS NOT NULL
  ) named;
$$;

CREATE OR REPLACE FUNCTION public.feed_type_bonus(
  p_item_type text,
  p_source text,
  p_ranking_at timestamptz
) RETURNS double precision
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE p_item_type
    WHEN 'blog' THEN 0.25
    WHEN 'video' THEN 1.0
    WHEN 'match' THEN CASE
      WHEN p_ranking_at IS NULL OR p_ranking_at < NOW() - INTERVAL '14 days' THEN 0.2
      WHEN p_source IN ('ppa_tour', 'mlp', 'app_tour') THEN 2.0
      WHEN p_source = 'community' THEN 0.5
      ELSE 0.0
    END
    WHEN 'result' THEN CASE
      WHEN p_ranking_at IS NULL OR p_ranking_at < NOW() - INTERVAL '14 days' THEN 0.2
      ELSE 2.0
    END
    ELSE 0.0
  END;
$$;

CREATE OR REPLACE FUNCTION public.feed_item_score(
  p_ranking_at timestamptz,
  p_kudos integer,
  p_comments integer,
  p_item_type text,
  p_source text
) RETURNS double precision
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE((
    EXP(-EXTRACT(EPOCH FROM (NOW() - p_ranking_at)) / 3600.0 / 48.0)
    * (1.0 + LN(1.0 + COALESCE(p_kudos, 0) + COALESCE(p_comments, 0) * 5.0))
    + public.feed_type_bonus(p_item_type, p_source, p_ranking_at)
  )::double precision, 0);
$$;

CREATE OR REPLACE FUNCTION public.feed_result_rows(p_viewer_id uuid DEFAULT NULL)
RETURNS TABLE (
  item_type text,
  item_id uuid,
  published_at timestamptz,
  slug text,
  format text,
  match_type text,
  verification_status text,
  venue_name text,
  team_a_score integer[],
  team_b_score integer[],
  winning_team text,
  participants jsonb,
  kudos_count integer,
  viewer_kudoed boolean,
  comment_count integer,
  source_provider text,
  source_url text,
  tournament_name text,
  tournament_event text,
  round_name text,
  notes text,
  title text,
  excerpt text,
  cover_image_url text,
  category text,
  duration_seconds integer,
  _cluster_key text,
  _ranking_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH result_window AS (
    SELECT NOW() - INTERVAL '90 days' AS ts
  ),
  qt_final_round AS (
    SELECT qm.table_id,
           qm.playoff_division,
           MAX(COALESCE(qm.playoff_round, qm.large_playoff_round)) AS final_round
    FROM public.quick_table_matches qm
    WHERE qm.is_playoff IS TRUE
      AND COALESCE(qm.playoff_round, qm.large_playoff_round) IS NOT NULL
    GROUP BY qm.table_id, qm.playoff_division
  ),
  match_rows AS (
    SELECT 'match'::text AS item_type,
      m.id AS item_id,
      m.played_at AS published_at,
      m.slug,
      m.format,
      m.match_type,
      m.verification_status,
      COALESCE(v.name_vi, v.name, m.venue_name_override) AS venue_name,
      m.team_a_score,
      m.team_b_score,
      m.winning_team,
      (
        SELECT jsonb_agg(jsonb_build_object(
          'player_id', mp.player_id,
          'team', mp.team,
          'position', mp.position,
          'username', pr.username,
          'display_name', pr.display_name,
          'avatar_url', pr.avatar_url,
          'is_ghost', pr.is_ghost,
          'dupr_doubles', pr.dupr_doubles,
          'country_code', pr.country_code
        ) ORDER BY mp.team, mp.position)
        FROM public.match_participants mp
        JOIN public.profiles pr ON pr.id = mp.player_id
        WHERE mp.match_id = m.id
      ) AS participants,
      COALESCE(mk.cnt, 0)::integer AS kudos_count,
      (vmk.user_id IS NOT NULL) AS viewer_kudoed,
      COALESCE(cc.cnt, 0)::integer AS comment_count,
      m.source_provider,
      m.source_url,
      m.tournament_name,
      m.tournament_event,
      m.round_name,
      m.notes,
      NULL::text AS title,
      NULL::text AS excerpt,
      NULL::text AS cover_image_url,
      NULL::text AS category,
      NULL::integer AS duration_seconds,
      'match:' || COALESCE(m.source_provider, 'community') || ':' || COALESCE(m.tournament_name, '_none') AS _cluster_key,
      CASE
        WHEN m.source_provider IN ('ppa_tour', 'mlp', 'app_tour')
          THEN COALESCE(m.verified_at, m.updated_at, m.played_at)
        ELSE m.played_at
      END AS _ranking_at
    FROM public.matches m
    LEFT JOIN public.venues v ON v.id = m.venue_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS cnt FROM public.kudos k
      WHERE k.target_type = 'match' AND k.target_id = m.id
    ) mk ON TRUE
    LEFT JOIN public.kudos vmk
      ON vmk.target_type = 'match' AND vmk.target_id = m.id AND vmk.user_id = p_viewer_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS cnt FROM public.social_comments sc
      WHERE sc.target_type = 'match' AND sc.target_id = m.id AND sc.is_deleted = FALSE
    ) cc ON TRUE
    WHERE m.is_public = TRUE
      AND m.verification_status IN ('verified', 'disputed')
      AND m.winning_team IS NOT NULL
      AND m.played_at <= NOW()
      AND CASE
        WHEN m.source_provider IN ('ppa_tour', 'mlp', 'app_tour')
          THEN COALESCE(m.verified_at, m.updated_at, m.played_at)
        ELSE m.played_at
      END >= (SELECT ts FROM result_window)
      -- surface_quick_table_results copies the final into matches. The
      -- quick-table row below is the one that links to the tool page.
      AND NOT (
        m.slug LIKE 'qt-%'
        AND m.external_match_id IS NOT NULL
        AND lower(COALESCE(m.round_name, '')) = 'final'
      )
  ),
  qt_rows AS (
    SELECT * FROM (
      SELECT DISTINCT ON (qm.table_id, qm.playoff_division)
        'result'::text AS item_type,
        qm.id AS item_id,
        COALESCE(qm.updated_at, qt.updated_at, qt.created_at) AS published_at,
        qt.share_id AS slug,
        CASE WHEN qt.is_doubles THEN 'doubles' ELSE 'singles' END AS format,
        'tournament'::text AS match_type,
        'verified'::text AS verification_status,
        NULL::text AS venue_name,
        ARRAY[qm.score1]::integer[] AS team_a_score,
        ARRAY[qm.score2]::integer[] AS team_b_score,
        CASE WHEN qm.score1 > qm.score2 THEN 'a' ELSE 'b' END AS winning_team,
        public.feed_named_side(
          'a', p1.id,
          COALESCE(NULLIF(btrim(p1.player1_name), ''), NULLIF(btrim(p1.name), '')),
          CASE
            WHEN NULLIF(btrim(p1.player1_name), '') IS NOT NULL THEN NULLIF(btrim(p1.player2_name), '')
            ELSE NULL
          END
        ) || public.feed_named_side(
          'b', p2.id,
          COALESCE(NULLIF(btrim(p2.player1_name), ''), NULLIF(btrim(p2.name), '')),
          CASE
            WHEN NULLIF(btrim(p2.player1_name), '') IS NOT NULL THEN NULLIF(btrim(p2.player2_name), '')
            ELSE NULL
          END
        ) AS participants,
        0::integer AS kudos_count,
        FALSE AS viewer_kudoed,
        0::integer AS comment_count,
        'quick_table'::text AS source_provider,
        '/tools/quick-tables/' || qt.share_id AS source_url,
        qt.name AS tournament_name,
        NULL::text AS tournament_event,
        'Final'::text AS round_name,
        NULL::text AS notes,
        NULL::text AS title,
        NULL::text AS excerpt,
        NULL::text AS cover_image_url,
        qm.playoff_division::text AS category,
        NULL::integer AS duration_seconds,
        'result:quick_table:' || qt.id::text AS _cluster_key,
        COALESCE(qm.updated_at, qt.updated_at, qt.created_at) AS _ranking_at
      FROM public.quick_table_matches qm
      JOIN qt_final_round fr
        ON fr.table_id = qm.table_id
       AND fr.playoff_division = qm.playoff_division
       AND COALESCE(qm.playoff_round, qm.large_playoff_round) = fr.final_round
      JOIN public.quick_tables qt ON qt.id = qm.table_id
      LEFT JOIN public.quick_table_players p1 ON p1.id = qm.player1_id
      LEFT JOIN public.quick_table_players p2 ON p2.id = qm.player2_id
      WHERE qt.is_public IS TRUE
        AND qm.is_playoff IS TRUE
        AND qm.status = 'completed'
        AND qm.score1 IS NOT NULL
        AND qm.score2 IS NOT NULL
        AND qm.score1 <> qm.score2
        AND COALESCE(qm.updated_at, qt.updated_at, qt.created_at) >= (SELECT ts FROM result_window)
        AND COALESCE(NULLIF(btrim(p1.player1_name), ''), NULLIF(btrim(p1.name), '')) IS NOT NULL
        AND COALESCE(NULLIF(btrim(p2.player1_name), ''), NULLIF(btrim(p2.name), '')) IS NOT NULL
        AND lower(COALESCE(NULLIF(btrim(p1.player1_name), ''), btrim(p1.name))) NOT IN ('bye', 'tbd')
        AND lower(COALESCE(NULLIF(btrim(p2.player1_name), ''), btrim(p2.name))) NOT IN ('bye', 'tbd')
      ORDER BY qm.table_id, qm.playoff_division, qm.updated_at DESC
    ) qt_finals
    ORDER BY published_at DESC
    LIMIT 40
  ),
  de_rows AS (
    SELECT * FROM (
      SELECT
        'result'::text,
        m.id,
        COALESCE(m.updated_at, t.updated_at, t.created_at),
        t.share_id,
        'doubles'::text,
        'tournament'::text,
        'verified'::text,
        NULL::text,
        ARRAY[COALESCE(m.games_won_a, 0)]::integer[],
        ARRAY[COALESCE(m.games_won_b, 0)]::integer[],
        CASE WHEN m.winner_id = m.team_a_id THEN 'a' ELSE 'b' END,
        public.feed_named_side(
          'a', ta.id,
          COALESCE(NULLIF(btrim(ta.player1_name), ''), NULLIF(btrim(ta.team_name), '')),
          NULLIF(btrim(ta.player2_name), '')
        ) || public.feed_named_side(
          'b', tb.id,
          COALESCE(NULLIF(btrim(tb.player1_name), ''), NULLIF(btrim(tb.team_name), '')),
          NULLIF(btrim(tb.player2_name), '')
        ),
        0::integer,
        FALSE,
        0::integer,
        'doubles_elim'::text,
        '/tools/doubles-elimination/' || t.share_id,
        t.name,
        NULL::text,
        'Final'::text,
        NULL::text,
        NULL::text,
        NULL::text,
        NULL::text,
        NULL::text,
        NULL::integer,
        'result:doubles_elim:' || t.id::text,
        COALESCE(m.updated_at, t.updated_at, t.created_at)
      FROM public.doubles_elimination_matches m
      JOIN public.doubles_elimination_tournaments t ON t.id = m.tournament_id
      LEFT JOIN public.doubles_elimination_teams ta ON ta.id = m.team_a_id
      LEFT JOIN public.doubles_elimination_teams tb ON tb.id = m.team_b_id
      WHERE m.round_type = 'final'
        AND m.status = 'completed'
        AND COALESCE(m.is_bye, FALSE) = FALSE
        AND m.winner_id IS NOT NULL
        AND m.winner_id IN (m.team_a_id, m.team_b_id)
        AND COALESCE(m.games_won_a, 0) + COALESCE(m.games_won_b, 0) > 0
        AND COALESCE(m.updated_at, t.updated_at, t.created_at) >= (SELECT ts FROM result_window)
        AND COALESCE(NULLIF(btrim(ta.player1_name), ''), NULLIF(btrim(ta.team_name), '')) IS NOT NULL
        AND COALESCE(NULLIF(btrim(tb.player1_name), ''), NULLIF(btrim(tb.team_name), '')) IS NOT NULL
      ORDER BY COALESCE(m.updated_at, t.updated_at, t.created_at) DESC
      LIMIT 40
    ) de_finals
  ),
  tm_rows AS (
    SELECT * FROM (
      SELECT
        'result'::text,
        m.id,
        COALESCE(m.updated_at, t.event_date::timestamptz, t.updated_at, t.created_at),
        t.share_id,
        'team'::text,
        'tournament'::text,
        'verified'::text,
        NULLIF(btrim(t.location), ''),
        CASE
          WHEN COALESCE(m.games_won_a, 0) + COALESCE(m.games_won_b, 0) > 0
            THEN ARRAY[COALESCE(m.games_won_a, 0)]::integer[]
          ELSE ARRAY[COALESCE(m.total_points_a, 0)]::integer[]
        END,
        CASE
          WHEN COALESCE(m.games_won_a, 0) + COALESCE(m.games_won_b, 0) > 0
            THEN ARRAY[COALESCE(m.games_won_b, 0)]::integer[]
          ELSE ARRAY[COALESCE(m.total_points_b, 0)]::integer[]
        END,
        CASE WHEN m.winner_team_id = m.team_a_id THEN 'a' ELSE 'b' END,
        public.feed_named_side('a', ta.id, NULLIF(btrim(ta.team_name), ''), NULL)
          || public.feed_named_side('b', tb.id, NULLIF(btrim(tb.team_name), ''), NULL),
        0::integer,
        FALSE,
        0::integer,
        'team_match'::text,
        '/tools/team-match/' || t.share_id,
        t.name,
        NULL::text,
        'Final'::text,
        NULL::text,
        NULL::text,
        NULL::text,
        NULL::text,
        NULL::text,
        NULL::integer,
        'result:team_match:' || t.id::text,
        COALESCE(m.updated_at, t.event_date::timestamptz, t.updated_at, t.created_at)
      FROM public.team_match_matches m
      JOIN public.team_match_tournaments t ON t.id = m.tournament_id
      LEFT JOIN public.team_match_teams ta ON ta.id = m.team_a_id
      LEFT JOIN public.team_match_teams tb ON tb.id = m.team_b_id
      WHERE m.is_playoff IS TRUE
        AND m.playoff_round = 1
        AND COALESCE(m.is_third_place, FALSE) = FALSE
        AND COALESCE(m.is_repechage, FALSE) = FALSE
        AND m.status = 'completed'
        AND m.winner_team_id IS NOT NULL
        AND m.winner_team_id IN (m.team_a_id, m.team_b_id)
        AND (
          COALESCE(m.games_won_a, 0) + COALESCE(m.games_won_b, 0) > 0
          OR COALESCE(m.total_points_a, 0) + COALESCE(m.total_points_b, 0) > 0
        )
        AND COALESCE(m.updated_at, t.event_date::timestamptz, t.updated_at, t.created_at) >= (SELECT ts FROM result_window)
        AND NULLIF(btrim(ta.team_name), '') IS NOT NULL
        AND NULLIF(btrim(tb.team_name), '') IS NOT NULL
      ORDER BY COALESCE(m.updated_at, t.event_date::timestamptz, t.updated_at, t.created_at) DESC
      LIMIT 40
    ) tm_finals
  )
  SELECT * FROM match_rows
  UNION ALL SELECT * FROM qt_rows
  UNION ALL SELECT * FROM de_rows
  UNION ALL SELECT * FROM tm_rows;
$$;

DROP FUNCTION IF EXISTS public.get_feed_timeline(integer, double precision, uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_feed_timeline(
  p_limit integer DEFAULT 20,
  p_cursor_score double precision DEFAULT NULL,
  p_cursor_item_id uuid DEFAULT NULL,
  p_viewer_id uuid DEFAULT NULL
)
RETURNS TABLE (
  item_type text, item_id uuid, published_at timestamptz, ranked_at timestamptz,
  score double precision,
  slug text, format text, match_type text, verification_status text, venue_name text,
  team_a_score integer[], team_b_score integer[], winning_team text,
  participants jsonb, kudos_count integer, viewer_kudoed boolean, comment_count integer,
  source_provider text, source_url text, tournament_name text,
  tournament_event text, round_name text, notes text,
  title text, excerpt text, cover_image_url text, category text, duration_seconds integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH window_start AS (
    SELECT NOW() - INTERVAL '30 days' AS ts
  ),
  result_rows AS (
    SELECT * FROM public.feed_result_rows(p_viewer_id)
  ),
  blog_rows AS (
    SELECT 'blog'::text, b.id, b.published_at, b.slug,
      NULL::text, NULL::text, NULL::text, NULL::text,
      NULL::integer[], NULL::integer[], NULL::text, NULL::jsonb,
      NULL::integer, NULL::boolean, NULL::integer,
      NULL::text, NULL::text, NULL::text, NULL::text, NULL::text, NULL::text,
      b.title, COALESCE(b.excerpt, b.meta_description), b.cover_image_url, b.category, NULL::integer,
      'blog:' || b.id::text, b.published_at
    FROM public.vi_blog_posts b
    WHERE b.status = 'published'
      AND b.published_at IS NOT NULL
      AND b.published_at >= (SELECT ts FROM window_start)
  ),
  video_rows AS (
    SELECT 'video'::text, vid.id, vid.published_at, NULL::text,
      NULL::text, NULL::text, NULL::text, NULL::text,
      NULL::integer[], NULL::integer[], NULL::text, NULL::jsonb,
      NULL::integer, NULL::boolean, NULL::integer,
      NULL::text, NULL::text, NULL::text, NULL::text, NULL::text, NULL::text,
      vid.title, vid.description, vid.thumbnail_url, vid.type::text, vid.duration_seconds,
      'video:' || vid.id::text, vid.published_at
    FROM public.videos vid
    WHERE vid.status = 'published'
      AND vid.published_at IS NOT NULL
      AND vid.published_at >= (SELECT ts FROM window_start)
  ),
  scored_rows AS (
    SELECT *,
      public.feed_item_score(_ranking_at, kudos_count, comment_count, item_type, source_provider) AS _score
    FROM (
      SELECT * FROM result_rows
      UNION ALL SELECT * FROM blog_rows
      UNION ALL SELECT * FROM video_rows
    ) u
  ),
  ranked_rows AS (
    SELECT *,
      ROW_NUMBER() OVER (PARTITION BY _cluster_key ORDER BY _score DESC, item_id DESC) AS _cluster_rank
    FROM scored_rows
  ),
  final_rows AS (
    SELECT *,
      (
        _score - CASE _cluster_rank
          WHEN 1 THEN 0.0
          WHEN 2 THEN 0.3
          WHEN 3 THEN 0.6
          ELSE 1.5
        END
      )::double precision AS _final_score
    FROM ranked_rows
  )
  SELECT item_type, item_id, published_at, _ranking_at, _final_score, slug, format, match_type,
    verification_status, venue_name, team_a_score, team_b_score, winning_team,
    participants, kudos_count, viewer_kudoed, comment_count,
    source_provider, source_url, tournament_name, tournament_event, round_name, notes,
    title, excerpt, cover_image_url, category, duration_seconds
  FROM final_rows
  WHERE (
    p_cursor_score IS NULL
    OR _final_score < p_cursor_score
    OR (
      _final_score = p_cursor_score
      AND p_cursor_item_id IS NOT NULL
      AND item_id < p_cursor_item_id
    )
  )
  ORDER BY _final_score DESC, item_id DESC
  LIMIT GREATEST(LEAST(p_limit, 100), 1);
$$;

CREATE OR REPLACE FUNCTION public.get_feed_recent_results(p_limit integer DEFAULT 12)
RETURNS TABLE (
  item_type text, item_id uuid, published_at timestamptz, ranked_at timestamptz,
  score double precision,
  slug text, format text, match_type text, verification_status text, venue_name text,
  team_a_score integer[], team_b_score integer[], winning_team text,
  participants jsonb, kudos_count integer, viewer_kudoed boolean, comment_count integer,
  source_provider text, source_url text, tournament_name text,
  tournament_event text, round_name text, notes text,
  title text, excerpt text, cover_image_url text, category text, duration_seconds integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT item_type, item_id, published_at, _ranking_at,
    public.feed_item_score(_ranking_at, kudos_count, comment_count, item_type, source_provider),
    slug, format, match_type, verification_status, venue_name,
    team_a_score, team_b_score, winning_team, participants,
    kudos_count, viewer_kudoed, comment_count,
    source_provider, source_url, tournament_name, tournament_event, round_name, notes,
    title, excerpt, cover_image_url, category, duration_seconds
  FROM public.feed_result_rows(NULL)
  WHERE item_type IN ('match', 'result')
    AND winning_team IN ('a', 'b')
  ORDER BY _ranking_at DESC, item_id DESC
  LIMIT GREATEST(LEAST(COALESCE(p_limit, 12), 24), 1);
$$;

REVOKE ALL ON FUNCTION public.feed_named_side(text, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.feed_type_bonus(text, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.feed_item_score(timestamptz, integer, integer, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.feed_result_rows(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_feed_timeline(integer, double precision, uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_feed_recent_results(integer) TO anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_qt_matches_playoff_completed
  ON public.quick_table_matches (table_id, playoff_division, playoff_round DESC)
  WHERE is_playoff IS TRUE AND status = 'completed';

CREATE INDEX IF NOT EXISTS idx_de_matches_completed_finals
  ON public.doubles_elimination_matches (tournament_id)
  WHERE round_type = 'final' AND status = 'completed';

CREATE INDEX IF NOT EXISTS idx_tm_matches_completed_finals
  ON public.team_match_matches (tournament_id)
  WHERE is_playoff IS TRUE AND playoff_round = 1 AND status = 'completed';

NOTIFY pgrst, 'reload schema';
