-- Recent feed results follow when the match was played.
--
-- OWNER APPROVAL REQUIRED before this is applied to production.
-- Do not run it against the live project as part of opening the PR.
-- Apply this migration to prod after review; the feed keeps the old
-- insert-time order until then.
--
-- get_feed_recent_results (and get_feed_timeline, via feed_result_rows)
-- ranked pro matches on COALESCE(verified_at, updated_at, played_at).
-- A bulk backfill stamps those clocks at insert time, so the last-loaded
-- event — MLP Nations Cup — filled the overlay ahead of matches that
-- were actually played later.
--
-- Match rows now:
--   * qualify on played_at inside the existing window (30 days for the
--     timeline, 90 days for the overlay)
--   * drop played_at > now()
--   * order by played_at DESC, created_at DESC, id DESC
--   * expose played_at as ranked_at, which is the clock the web and iOS
--     feeds already sort on
--
-- Signature, return columns, SECURITY DEFINER, and search_path are
-- unchanged. Grants below match the previous migration.

CREATE OR REPLACE FUNCTION public.feed_result_rows(
  p_viewer_id uuid DEFAULT NULL,
  p_match_window interval DEFAULT INTERVAL '30 days',
  p_match_cap integer DEFAULT NULL
)
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
  match_window AS (
    SELECT NOW() - p_match_window AS ts
  ),
  -- Only rows whose bracket_position was never set. A labelled final
  -- (bracket_position = 'final') does not need this max.
  qt_final_round AS (
    SELECT qm.table_id,
           qm.playoff_division,
           MAX(COALESCE(qm.playoff_round, qm.large_playoff_round)) AS final_round
    FROM public.quick_table_matches qm
    WHERE qm.is_playoff IS TRUE
      AND qm.bracket_position IS NULL
      AND COALESCE(qm.playoff_round, qm.large_playoff_round) IS NOT NULL
      AND qm.updated_at >= (SELECT ts FROM result_window)
    GROUP BY qm.table_id, qm.playoff_division
  ),
  match_candidates AS (
    SELECT m.id
    FROM public.matches m
    WHERE m.is_public = TRUE
      AND m.verification_status IN ('verified', 'disputed')
      AND m.winning_team IS NOT NULL
      -- Played, not inserted. A bulk backfill stamps the verify/update
      -- clocks at insert time, which used to admit an older event that
      -- happened to be loaded last.
      AND m.played_at <= NOW()
      AND m.played_at >= (SELECT ts FROM match_window)
      -- surface_quick_table_results copies the final into matches. The
      -- quick-table row below is the one that links to the tool page.
      AND NOT (
        m.slug LIKE 'qt-%'
        AND m.external_match_id IS NOT NULL
        AND lower(COALESCE(m.round_name, '')) = 'final'
      )
    -- Most recently played first. created_at then id only break ties,
    -- so a backfill cannot fill the cap with the last-inserted event.
    ORDER BY m.played_at DESC, m.created_at DESC, m.id DESC
    LIMIT p_match_cap
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
      -- Same clock as the candidate order. Timeline score and the
      -- client's ranked_at both read this column.
      m.played_at AS _ranking_at
    FROM match_candidates mc
    JOIN public.matches m ON m.id = mc.id
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
  ),
  qt_rows AS (
    SELECT * FROM (
      SELECT DISTINCT ON (qm.table_id, qm.playoff_division)
        'result'::text AS item_type,
        qm.id AS item_id,
        qm.updated_at AS published_at,
        qt.share_id AS slug,
        CASE WHEN qt.is_doubles THEN 'doubles' ELSE 'singles' END AS format,
        'tournament'::text AS match_type,
        'verified'::text AS verification_status,
        NULL::text AS venue_name,
        CASE
          WHEN qm.score1 IS NULL AND qm.score2 IS NULL THEN ARRAY[]::integer[]
          ELSE ARRAY[COALESCE(qm.score1, 0)]::integer[]
        END AS team_a_score,
        CASE
          WHEN qm.score1 IS NULL AND qm.score2 IS NULL THEN ARRAY[]::integer[]
          ELSE ARRAY[COALESCE(qm.score2, 0)]::integer[]
        END AS team_b_score,
        CASE
          WHEN qm.winner_id IS NOT NULL AND qm.winner_id = qm.player1_id THEN 'a'
          WHEN qm.winner_id IS NOT NULL AND qm.winner_id = qm.player2_id THEN 'b'
          WHEN qm.score1 > qm.score2 THEN 'a'
          ELSE 'b'
        END AS winning_team,
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
        -- No completed_at/finished_at column. updated_at is the clock the
        -- scorer bumps when the final is saved.
        qm.updated_at AS _ranking_at
      FROM public.quick_table_matches qm
      LEFT JOIN qt_final_round fr
        ON fr.table_id = qm.table_id
       AND fr.playoff_division = qm.playoff_division
      JOIN public.quick_tables qt ON qt.id = qm.table_id
      LEFT JOIN public.quick_table_players p1 ON p1.id = qm.player1_id
      LEFT JOIN public.quick_table_players p2 ON p2.id = qm.player2_id
      WHERE qt.is_public IS TRUE
        AND qm.is_playoff IS TRUE
        AND qm.status = 'completed'
        AND qm.updated_at >= (SELECT ts FROM result_window)
        AND (
          qm.bracket_position = 'final'
          OR (
            qm.bracket_position IS NULL
            AND COALESCE(qm.playoff_round, qm.large_playoff_round) = fr.final_round
          )
        )
        AND (
          (qm.winner_id IS NOT NULL AND qm.winner_id IN (qm.player1_id, qm.player2_id))
          OR (qm.score1 IS NOT NULL AND qm.score2 IS NOT NULL AND qm.score1 <> qm.score2)
        )
        AND COALESCE(NULLIF(btrim(p1.player1_name), ''), NULLIF(btrim(p1.name), '')) IS NOT NULL
        AND COALESCE(NULLIF(btrim(p2.player1_name), ''), NULLIF(btrim(p2.name), '')) IS NOT NULL
        AND lower(COALESCE(NULLIF(btrim(p1.player1_name), ''), btrim(p1.name))) NOT IN ('bye', 'tbd')
        AND lower(COALESCE(NULLIF(btrim(p2.player1_name), ''), btrim(p2.name))) NOT IN ('bye', 'tbd')
      ORDER BY qm.table_id, qm.playoff_division,
        CASE WHEN qm.bracket_position = 'final' THEN 0 ELSE 1 END,
        qm.updated_at DESC
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

-- get_feed_timeline is not replaced. It calls feed_result_rows, so its
-- score now decays from played_at. Signature and grants stay as they are.

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
  SELECT r.item_type, r.item_id, r.published_at, r._ranking_at,
    public.feed_item_score(r._ranking_at, r.kudos_count, r.comment_count, r.item_type, r.source_provider),
    r.slug, r.format, r.match_type, r.verification_status, r.venue_name,
    r.team_a_score, r.team_b_score, r.winning_team, r.participants,
    r.kudos_count, r.viewer_kudoed, r.comment_count,
    r.source_provider, r.source_url, r.tournament_name, r.tournament_event, r.round_name, r.notes,
    r.title, r.excerpt, r.cover_image_url, r.category, r.duration_seconds
  FROM public.feed_result_rows(NULL, INTERVAL '90 days', 40) r
  LEFT JOIN public.matches m
    ON r.item_type = 'match' AND m.id = r.item_id
  WHERE r.item_type IN ('match', 'result')
    AND r.winning_team IN ('a', 'b')
    -- feed_result_rows already drops matches played in the future.
    -- Repeat it here so a future match cannot surface if that filter moves.
    AND (r.item_type <> 'match' OR m.played_at <= NOW())
  ORDER BY r._ranking_at DESC, m.created_at DESC NULLS LAST, r.item_id DESC
  LIMIT GREATEST(LEAST(COALESCE(p_limit, 12), 24), 1);
$$;


REVOKE ALL ON FUNCTION public.feed_result_rows(uuid, interval, integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_feed_recent_results(integer) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
