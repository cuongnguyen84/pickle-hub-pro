-- ============================================================================
-- Surface tournament finals + semis onto the Feed (PR — Cuong request)
-- ----------------------------------------------------------------------------
-- 1. surface_quick_table_results(p_table_id uuid) — for a completed quick
--    table, finds the playoff finals + semifinals and inserts them into
--    public.matches with ghost profile players (because quick_table_players
--    only stores names, not user_ids). Idempotent on matches.slug.
--
-- 2. Bumps community matches that look like tournament finals/semis into
--    the same priority bucket as pro tour rows in get_trending_feed —
--    otherwise pro-tour rows monopolize the top 100 results and tournament
--    finals never appear above the LIMIT cap.
--
-- 3. Cron `surface-quick-table-results-daily` (06:00 UTC) walks every
--    quick_table that completed in the last 24 hours and runs the surface
--    function so the Feed picks them up automatically — answers Cuong's
--    "đọc các tour của người dùng đã kết thúc gần đây" ask without a UI
--    trigger.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.surface_quick_table_results(p_table_id uuid)
RETURNS TABLE(matches_inserted int, participants_inserted int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tournament       RECORD;
  v_max_round        int;
  v_match            RECORD;
  v_round_name       text;
  v_format           text;
  v_match_id         uuid;
  v_slug             text;
  v_winning_team     text;
  v_inserted_matches int := 0;
  v_inserted_parts   int := 0;
  v_name             text;
  v_team_names       text[];
  v_gid              uuid;
  v_idx              int;
  v_norm             text;
BEGIN
  SELECT * INTO v_tournament FROM public.quick_tables WHERE id = p_table_id;
  IF v_tournament IS NULL OR v_tournament.status <> 'completed' THEN
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  SELECT MAX(playoff_round) INTO v_max_round
  FROM public.quick_table_matches
  WHERE table_id = p_table_id AND is_playoff = true AND status = 'completed';
  IF v_max_round IS NULL OR v_max_round < 1 THEN
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  v_format := CASE WHEN v_tournament.is_doubles THEN 'doubles' ELSE 'singles' END;

  FOR v_match IN
    SELECT qm.id, qm.playoff_round, qm.score1, qm.score2, qm.updated_at,
           p1.name AS p1_name, p2.name AS p2_name
    FROM public.quick_table_matches qm
    LEFT JOIN public.quick_table_players p1 ON p1.id = qm.player1_id
    LEFT JOIN public.quick_table_players p2 ON p2.id = qm.player2_id
    WHERE qm.table_id = p_table_id
      AND qm.is_playoff = true
      AND qm.status = 'completed'
      AND qm.playoff_round IN (v_max_round, v_max_round - 1)
      AND qm.score1 IS NOT NULL AND qm.score2 IS NOT NULL
  LOOP
    v_round_name := CASE
      WHEN v_match.playoff_round = v_max_round THEN 'Final'
      ELSE 'Semifinal'
    END;
    v_winning_team := CASE WHEN v_match.score1 > v_match.score2 THEN 'a' ELSE 'b' END;
    v_slug := 'qt-' || substr(p_table_id::text, 1, 8) || '-' || substr(v_match.id::text, 1, 8);
    v_match_id := gen_random_uuid();

    -- Insert match; skip + continue to participants backfill if slug exists.
    INSERT INTO public.matches (
      id, slug, format, match_type, played_at,
      team_a_score, team_b_score, winning_team,
      verification_status, is_public, recorded_by,
      tournament_name, round_name, external_match_id
    ) VALUES (
      v_match_id, v_slug, v_format, 'tournament', v_match.updated_at,
      ARRAY[v_match.score1], ARRAY[v_match.score2], v_winning_team,
      'verified', true, v_tournament.creator_user_id,
      v_tournament.name, v_round_name, v_match.id::text
    )
    ON CONFLICT (slug) DO NOTHING;

    -- If the slug existed, fetch its id so we can backfill participants
    -- in case the prior run crashed before adding them.
    IF NOT FOUND THEN
      SELECT id INTO v_match_id FROM public.matches WHERE slug = v_slug;
    ELSE
      v_inserted_matches := v_inserted_matches + 1;
    END IF;

    -- Reset team_names and rebuild for team A then team B.
    FOR v_idx IN 1..2 LOOP
      v_team_names := CASE v_idx
        WHEN 1 THEN _split_player_names(v_match.p1_name)
        ELSE      _split_player_names(v_match.p2_name)
      END;
      FOR i IN 1..COALESCE(array_length(v_team_names, 1), 0) LOOP
        v_name := v_team_names[i];
        IF v_name IS NULL OR length(trim(v_name)) = 0 THEN CONTINUE; END IF;
        -- Deterministic UUID per normalized name. We avoid uuid_generate_v5
        -- since it requires the uuid-ossp extension; md5()::uuid gives a
        -- stable 128-bit value per input which is enough for ghost dedup.
        v_norm := 'tphtg:' || lower(trim(v_name));
        v_gid  := md5(v_norm)::uuid;
        -- Ghost profile (id-based dedup; trigger fills profile_slug)
        INSERT INTO public.profiles (id, email, display_name, is_ghost)
        VALUES (v_gid, 'ghost-' || substr(v_gid::text, 1, 8) || '@picklehub.ghost', v_name, true)
        ON CONFLICT (id) DO NOTHING;
        -- Participant (skip if already there)
        INSERT INTO public.match_participants (match_id, player_id, team, position)
        VALUES (v_match_id, v_gid, CASE v_idx WHEN 1 THEN 'a' ELSE 'b' END, i)
        ON CONFLICT DO NOTHING;
        v_inserted_parts := v_inserted_parts + 1;
      END LOOP;
    END LOOP;
  END LOOP;

  RETURN QUERY SELECT v_inserted_matches, v_inserted_parts;
END;
$$;

-- Splits a doubles-team display name like "Alice - Bob" into ["Alice","Bob"].
-- Tries ' - ', ' & ', ' / ', ' và ' in order; falls back to the trimmed
-- full string when no delimiter matches (singles entrant).
CREATE OR REPLACE FUNCTION public._split_player_names(p_name text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  WITH src AS (
    SELECT
      CASE
        WHEN p_name IS NULL THEN NULL
        WHEN position(' - '  IN p_name) > 0 THEN regexp_split_to_array(p_name, ' - ')
        WHEN position(' & '  IN p_name) > 0 THEN regexp_split_to_array(p_name, ' & ')
        WHEN position(' / '  IN p_name) > 0 THEN regexp_split_to_array(p_name, ' / ')
        WHEN position(' và ' IN p_name) > 0 THEN regexp_split_to_array(p_name, ' và ')
        ELSE ARRAY[p_name]
      END AS parts
  )
  SELECT COALESCE(array_agg(trim(x)) FILTER (WHERE length(trim(x)) > 0), ARRAY[]::text[])
  FROM src, unnest(parts) AS x;
$$;

-- ─── Boost community tournament matches into the priority tier ─────────────
-- The original CASE was:
--   CASE WHEN m.source_provider <> 'community' THEN 0 ELSE 1 END
-- Community tournament finals/semis (which we just started inserting)
-- now share Tier 0 so pro-tour rows don't crowd them out below LIMIT 100.
CREATE OR REPLACE FUNCTION public.get_trending_feed(
  p_limit integer DEFAULT 20,
  p_cursor_played_at timestamp with time zone DEFAULT NULL,
  p_cursor_match_id uuid DEFAULT NULL,
  p_viewer_id uuid DEFAULT NULL,
  p_kudos_weight integer DEFAULT 3,
  p_comments_weight integer DEFAULT 5,
  p_recency_decay_hours integer DEFAULT 168,
  p_pro_boost integer DEFAULT 1000
)
RETURNS TABLE(
  match_id uuid, slug text, played_at timestamptz, format text,
  match_type text, verification_status text, venue_name text,
  team_a_score integer[], team_b_score integer[], winning_team text,
  participants jsonb, kudos_count integer, viewer_kudoed boolean,
  comment_count integer, source_provider text, source_url text,
  tournament_name text, tournament_event text, round_name text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $function$
  SELECT
    m.id, m.slug, m.played_at, m.format, m.match_type, m.verification_status,
    COALESCE(v.name_vi, v.name, m.venue_name_override) AS venue_name,
    m.team_a_score, m.team_b_score, m.winning_team,
    (SELECT jsonb_agg(jsonb_build_object(
        'player_id', mp.player_id, 'team', mp.team, 'position', mp.position,
        'username', pr.username, 'display_name', pr.display_name,
        'avatar_url', pr.avatar_url, 'is_ghost', pr.is_ghost,
        'dupr_doubles', pr.dupr_doubles
     ) ORDER BY mp.team, mp.position)
     FROM public.match_participants mp
     JOIN public.profiles pr ON pr.id = mp.player_id
     WHERE mp.match_id = m.id) AS participants,
    COALESCE(mk.cnt, 0)::INT AS kudos_count,
    (vmk.user_id IS NOT NULL) AS viewer_kudoed,
    COALESCE(cc.cnt, 0)::INT AS comment_count,
    m.source_provider, m.source_url,
    m.tournament_name, m.tournament_event, m.round_name
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
    AND m.verification_status IN ('verified', 'pending', 'disputed')
    AND m.played_at >= NOW() - (p_recency_decay_hours::TEXT || ' hours')::INTERVAL
    AND (
      p_cursor_played_at IS NULL
      OR m.played_at < p_cursor_played_at
      OR (m.played_at = p_cursor_played_at
          AND p_cursor_match_id IS NOT NULL
          AND m.id < p_cursor_match_id)
    )
  ORDER BY
    -- Tier 0 priority: pro tour rows AND community tournament finals/semis.
    -- (Match Cuong's request: tournament results should not get drowned
    -- under high-engagement community casual matches.)
    CASE
      WHEN m.source_provider <> 'community' THEN 0
      WHEN m.match_type = 'tournament'
        AND m.tournament_name IS NOT NULL
        AND m.round_name IN ('Final', 'Semifinal') THEN 0
      ELSE 1
    END,
    CASE
      WHEN m.source_provider <> 'community'
        OR (m.match_type = 'tournament' AND m.round_name IN ('Final', 'Semifinal'))
      THEN EXTRACT(EPOCH FROM m.played_at)
      ELSE (
        COALESCE(mk.cnt, 0) * p_kudos_weight
        + COALESCE(cc.cnt, 0) * p_comments_weight
        + EXP(-EXTRACT(EPOCH FROM (NOW() - m.played_at))
              / NULLIF(p_recency_decay_hours * 3600.0, 0))
      )
    END DESC,
    m.id DESC
  LIMIT GREATEST(LEAST(p_limit, 100), 1);
$function$;

-- ─── Cron: daily 06:00 UTC, surface results of tours completed yesterday ───
SELECT cron.unschedule('surface-quick-table-results-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='surface-quick-table-results-daily');

SELECT cron.schedule(
  'surface-quick-table-results-daily',
  '0 6 * * *',
  $$
  DO $do$
  DECLARE r record;
  BEGIN
    FOR r IN
      SELECT id FROM public.quick_tables
      WHERE status = 'completed'
        AND updated_at >= NOW() - INTERVAL '36 hours'
    LOOP
      PERFORM public.surface_quick_table_results(r.id);
    END LOOP;
  END $do$;
  $$
);

NOTIFY pgrst, 'reload schema';
