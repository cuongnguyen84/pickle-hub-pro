-- Task 4.1: score a Flex match and rebuild its persisted standings in one
-- transaction. The RPC serializes every score write for a group on the group
-- row, then reads fresh database state; it never trusts a client snapshot.
--
-- Forward-only rollback reasoning:
--   1. Point clients back to the legacy write path only if absolutely needed.
--   2. DROP FUNCTION public.score_flex_match_atomic(uuid, integer, integer, bigint).
--   3. Keep score_version: it is additive and harmless to older clients.

ALTER TABLE public.flex_matches
  ADD COLUMN IF NOT EXISTS score_version bigint NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.flex_matches.score_version IS
  'Optimistic concurrency token incremented by score_flex_match_atomic.';

CREATE OR REPLACE FUNCTION public.score_flex_match_atomic(
  p_match_id uuid,
  p_score_a integer,
  p_score_b integer,
  p_expected_version bigint
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_match public.flex_matches;
  v_tournament_id uuid;
  v_group_id uuid;
  v_include_doubles boolean;
  v_winner_side text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;

  IF p_expected_version IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'VERSION_REQUIRED');
  END IF;

  IF p_score_a IS NULL OR p_score_b IS NULL
     OR p_score_a < 0 OR p_score_b < 0
     OR p_score_a > 99 OR p_score_b > 99 THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_SCORE');
  END IF;

  SELECT tournament_id, group_id
  INTO v_tournament_id, v_group_id
  FROM public.flex_matches
  WHERE id = p_match_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'MATCH_NOT_FOUND');
  END IF;

  IF NOT public.can_edit_flex_tournament_scores(v_tournament_id, auth.uid())
     AND NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'NOT_AUTHORIZED');
  END IF;

  -- All score mutations for one group take this lock before the match lock.
  -- Two referees scoring different matches in the same group therefore cannot
  -- rebuild standings from mutually stale snapshots.
  IF v_group_id IS NOT NULL THEN
    SELECT include_doubles_in_singles
    INTO v_include_doubles
    FROM public.flex_groups
    WHERE id = v_group_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN json_build_object('success', false, 'error', 'GROUP_NOT_FOUND');
    END IF;
  END IF;

  SELECT *
  INTO v_match
  FROM public.flex_matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF v_match.score_version <> p_expected_version THEN
    RETURN json_build_object(
      'success', false,
      'error', 'VERSION_CONFLICT',
      'current_version', v_match.score_version
    );
  END IF;

  v_winner_side := CASE
    WHEN p_score_a > p_score_b THEN 'a'
    WHEN p_score_b > p_score_a THEN 'b'
    ELSE NULL
  END;

  UPDATE public.flex_matches
  SET score_a = p_score_a,
      score_b = p_score_b,
      winner_side = v_winner_side,
      score_version = score_version + 1
  WHERE id = p_match_id;

  IF v_group_id IS NOT NULL THEN
    DELETE FROM public.flex_player_stats WHERE group_id = v_group_id;
    DELETE FROM public.flex_pair_stats WHERE group_id = v_group_id;

    -- A group may contain players directly or teams whose members are the
    -- players represented in the singles standings.
    WITH group_players AS (
      SELECT gi.player_id
      FROM public.flex_group_items gi
      WHERE gi.group_id = v_group_id
        AND gi.item_type = 'player'
        AND gi.player_id IS NOT NULL
      UNION
      SELECT tm.player_id
      FROM public.flex_group_items gi
      JOIN public.flex_team_members tm ON tm.team_id = gi.team_id
      WHERE gi.group_id = v_group_id
        AND gi.item_type = 'team'
        AND gi.team_id IS NOT NULL
    ),
    match_players AS (
      SELECT m.winner_side, abs(m.score_a - m.score_b) AS diff,
             'a'::text AS side, m.slot_a1_player_id AS player_id
      FROM public.flex_matches m
      WHERE m.group_id = v_group_id
        AND m.counts_for_standings
        AND m.winner_side IS NOT NULL
        AND (m.match_type <> 'doubles' OR v_include_doubles)
      UNION ALL
      SELECT m.winner_side, abs(m.score_a - m.score_b),
             'a'::text, m.slot_a2_player_id
      FROM public.flex_matches m
      WHERE m.group_id = v_group_id
        AND m.counts_for_standings
        AND m.winner_side IS NOT NULL
        AND (m.match_type <> 'doubles' OR v_include_doubles)
      UNION ALL
      SELECT m.winner_side, abs(m.score_a - m.score_b),
             'b'::text, m.slot_b1_player_id
      FROM public.flex_matches m
      WHERE m.group_id = v_group_id
        AND m.counts_for_standings
        AND m.winner_side IS NOT NULL
        AND (m.match_type <> 'doubles' OR v_include_doubles)
      UNION ALL
      SELECT m.winner_side, abs(m.score_a - m.score_b),
             'b'::text, m.slot_b2_player_id
      FROM public.flex_matches m
      WHERE m.group_id = v_group_id
        AND m.counts_for_standings
        AND m.winner_side IS NOT NULL
        AND (m.match_type <> 'doubles' OR v_include_doubles)
    )
    INSERT INTO public.flex_player_stats (
      group_id, player_id, wins, losses, point_diff
    )
    SELECT
      v_group_id,
      mp.player_id,
      count(*) FILTER (WHERE mp.side = mp.winner_side)::integer,
      count(*) FILTER (WHERE mp.side <> mp.winner_side)::integer,
      sum(CASE WHEN mp.side = mp.winner_side THEN mp.diff ELSE -mp.diff END)::integer
    FROM match_players mp
    JOIN group_players gp ON gp.player_id = mp.player_id
    WHERE mp.player_id IS NOT NULL
    GROUP BY mp.player_id;

    WITH group_players AS (
      SELECT gi.player_id
      FROM public.flex_group_items gi
      WHERE gi.group_id = v_group_id
        AND gi.item_type = 'player'
        AND gi.player_id IS NOT NULL
      UNION
      SELECT tm.player_id
      FROM public.flex_group_items gi
      JOIN public.flex_team_members tm ON tm.team_id = gi.team_id
      WHERE gi.group_id = v_group_id
        AND gi.item_type = 'team'
        AND gi.team_id IS NOT NULL
    ),
    match_pairs AS (
      SELECT m.winner_side, abs(m.score_a - m.score_b) AS diff,
             'a'::text AS side,
             least(m.slot_a1_player_id, m.slot_a2_player_id) AS player1_id,
             greatest(m.slot_a1_player_id, m.slot_a2_player_id) AS player2_id
      FROM public.flex_matches m
      WHERE m.group_id = v_group_id
        AND m.match_type = 'doubles'
        AND m.counts_for_standings
        AND m.winner_side IS NOT NULL
        AND m.slot_a1_player_id IS NOT NULL
        AND m.slot_a2_player_id IS NOT NULL
      UNION ALL
      SELECT m.winner_side, abs(m.score_a - m.score_b),
             'b'::text,
             least(m.slot_b1_player_id, m.slot_b2_player_id),
             greatest(m.slot_b1_player_id, m.slot_b2_player_id)
      FROM public.flex_matches m
      WHERE m.group_id = v_group_id
        AND m.match_type = 'doubles'
        AND m.counts_for_standings
        AND m.winner_side IS NOT NULL
        AND m.slot_b1_player_id IS NOT NULL
        AND m.slot_b2_player_id IS NOT NULL
    )
    INSERT INTO public.flex_pair_stats (
      group_id, player1_id, player2_id, wins, losses, point_diff
    )
    SELECT
      v_group_id,
      mp.player1_id,
      mp.player2_id,
      count(*) FILTER (WHERE mp.side = mp.winner_side)::integer,
      count(*) FILTER (WHERE mp.side <> mp.winner_side)::integer,
      sum(CASE WHEN mp.side = mp.winner_side THEN mp.diff ELSE -mp.diff END)::integer
    FROM match_pairs mp
    WHERE EXISTS (
      SELECT 1
      FROM group_players gp
      WHERE gp.player_id IN (mp.player1_id, mp.player2_id)
    )
    GROUP BY mp.player1_id, mp.player2_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'version', v_match.score_version + 1,
    'winner_side', v_winner_side,
    'group_id', v_group_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.score_flex_match_atomic(uuid, integer, integer, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.score_flex_match_atomic(uuid, integer, integer, bigint) FROM anon;
GRANT EXECUTE ON FUNCTION public.score_flex_match_atomic(uuid, integer, integer, bigint) TO authenticated;

COMMENT ON FUNCTION public.score_flex_match_atomic(uuid, integer, integer, bigint) IS
  'Atomically scores one Flex match, checks score_version, and rebuilds player/pair standings from locked database state.';

NOTIFY pgrst, 'reload schema';
