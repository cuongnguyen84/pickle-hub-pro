-- ============================================================================
-- doubles_elimination — Sprint E.2 open registration support
-- ----------------------------------------------------------------------------
-- 2026-05-29. Adds the 'registration_open' status + three RPCs for
-- self-registration flow used when rating_source='dupr':
--   * register_team_for_doubles_elimination
--   * cancel_doubles_elimination_team_registration
--   * close_doubles_elimination_registration
--
-- Decisions (Cuong, Sprint E.2):
--   - Tournament status enum gains 'registration_open' (between setup
--     and ongoing). Default still 'setup' so the manual flow is unchanged.
--   - Team count minimum bumps DB-level check 32 → 40 to align with the
--     UI floor. No existing rows are <40 (verified before migration).
--   - Player can be in ONLY ONE team per tournament (either as p1 or p2);
--     RPC enforces this with a uniqueness check + partial index for speed.
--   - Caller must be authenticated AND have a linked DUPR rating
--     (profiles.dupr_doubles OR dupr_singles). Partner does too.
--   - DUPR avg must fall in tournament's [min_dupr_rating, max_dupr_rating]
--     when either bound is set.
-- ============================================================================

-- ─── tournaments status enum + team_count floor ────────────────────────────
ALTER TABLE public.doubles_elimination_tournaments
  DROP CONSTRAINT IF EXISTS doubles_elimination_tournaments_status_check;
ALTER TABLE public.doubles_elimination_tournaments
  ADD CONSTRAINT doubles_elimination_tournaments_status_check
  CHECK (status = ANY (ARRAY['setup', 'registration_open', 'ongoing', 'completed']));

ALTER TABLE public.doubles_elimination_tournaments
  DROP CONSTRAINT IF EXISTS doubles_elimination_tournaments_team_count_check;
-- NOT VALID so existing rows (e.g. 2 legacy 32-team tournaments) stay
-- valid while new INSERTs / UPDATEs must respect the 40 floor.
ALTER TABLE public.doubles_elimination_tournaments
  ADD CONSTRAINT doubles_elimination_tournaments_team_count_check
  CHECK (team_count >= 40) NOT VALID;

-- ─── teams — partial unique indexes preventing double-registration ─────────
-- A player_user_id, when set, can appear in at most one team row per tournament.
CREATE UNIQUE INDEX IF NOT EXISTS doubles_elim_teams_p1_unique_per_tournament_idx
  ON public.doubles_elimination_teams(tournament_id, player1_user_id)
  WHERE player1_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS doubles_elim_teams_p2_unique_per_tournament_idx
  ON public.doubles_elimination_teams(tournament_id, player2_user_id)
  WHERE player2_user_id IS NOT NULL;

-- ─── helper: lookup dupr_doubles with singles fallback ─────────────────────
CREATE OR REPLACE FUNCTION public.dupr_doubles_with_fallback(p_profile_id uuid)
RETURNS TABLE(rating numeric, is_approx boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(p.dupr_doubles, p.dupr_singles)::numeric AS rating,
    (p.dupr_doubles IS NULL AND p.dupr_singles IS NOT NULL) AS is_approx
  FROM public.profiles p
  WHERE p.id = p_profile_id;
END;
$$;

-- ─── RPC: register a team ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.register_team_for_doubles_elimination(
  p_tournament_id uuid,
  p_partner_user_id uuid,
  p_team_name text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _caller uuid := auth.uid();
  _t public.doubles_elimination_tournaments;
  _current_count integer;
  _r1 numeric;
  _r2 numeric;
  _approx1 boolean;
  _approx2 boolean;
  _avg numeric;
  _seed_src text;
  _new_team_id uuid;
  _p1_name text;
  _p2_name text;
  _team_display text;
BEGIN
  IF _caller IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;
  IF p_partner_user_id IS NULL OR p_partner_user_id = _caller THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_PARTNER');
  END IF;

  SELECT * INTO _t
  FROM public.doubles_elimination_tournaments
  WHERE id = p_tournament_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'TOURNAMENT_NOT_FOUND');
  END IF;
  IF _t.status <> 'registration_open' THEN
    RETURN json_build_object('success', false, 'error', 'REGISTRATION_CLOSED', 'status', _t.status);
  END IF;
  IF _t.rating_source = 'self' THEN
    -- Belt-and-suspenders: registration RPC is only for DUPR flow.
    RETURN json_build_object('success', false, 'error', 'NOT_DUPR_TOURNAMENT');
  END IF;

  -- Capacity check.
  SELECT count(*) INTO _current_count
  FROM public.doubles_elimination_teams
  WHERE tournament_id = p_tournament_id;
  IF _current_count >= _t.team_count THEN
    RETURN json_build_object('success', false, 'error', 'TOURNAMENT_FULL', 'count', _current_count, 'capacity', _t.team_count);
  END IF;

  -- Already-registered check (either slot).
  IF EXISTS (
    SELECT 1 FROM public.doubles_elimination_teams
    WHERE tournament_id = p_tournament_id
      AND (player1_user_id = _caller OR player2_user_id = _caller
        OR player1_user_id = p_partner_user_id OR player2_user_id = p_partner_user_id)
  ) THEN
    RETURN json_build_object('success', false, 'error', 'ALREADY_REGISTERED');
  END IF;

  -- Fetch DUPR ratings + names.
  SELECT rating, is_approx INTO _r1, _approx1
  FROM public.dupr_doubles_with_fallback(_caller);
  SELECT rating, is_approx INTO _r2, _approx2
  FROM public.dupr_doubles_with_fallback(p_partner_user_id);
  SELECT COALESCE(display_name, username, 'Player') INTO _p1_name FROM public.profiles WHERE id = _caller;
  SELECT COALESCE(display_name, username, 'Partner') INTO _p2_name FROM public.profiles WHERE id = p_partner_user_id;

  IF _r1 IS NULL OR _r2 IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'MISSING_DUPR',
      'caller_has_dupr', _r1 IS NOT NULL,
      'partner_has_dupr', _r2 IS NOT NULL);
  END IF;

  _avg := round(((_r1 + _r2) / 2)::numeric, 2);
  _seed_src := CASE WHEN _approx1 OR _approx2 THEN 'approx' ELSE 'exact' END;

  -- Range gate.
  IF _t.min_dupr_rating IS NOT NULL AND _avg < _t.min_dupr_rating THEN
    RETURN json_build_object('success', false, 'error', 'OUT_OF_RANGE',
      'dupr_avg', _avg, 'min', _t.min_dupr_rating, 'max', _t.max_dupr_rating);
  END IF;
  IF _t.max_dupr_rating IS NOT NULL AND _avg > _t.max_dupr_rating THEN
    RETURN json_build_object('success', false, 'error', 'OUT_OF_RANGE',
      'dupr_avg', _avg, 'min', _t.min_dupr_rating, 'max', _t.max_dupr_rating);
  END IF;

  _team_display := COALESCE(NULLIF(trim(p_team_name), ''), _p1_name || ' / ' || _p2_name);

  INSERT INTO public.doubles_elimination_teams (
    tournament_id, team_name, player1_name, player2_name,
    player1_user_id, player2_user_id,
    dupr_avg_rating, dupr_seed_source
  ) VALUES (
    p_tournament_id, _team_display, _p1_name, _p2_name,
    _caller, p_partner_user_id,
    _avg, _seed_src
  )
  RETURNING id INTO _new_team_id;

  RETURN json_build_object('success', true, 'team_id', _new_team_id,
    'dupr_avg', _avg, 'seed_source', _seed_src,
    'count', _current_count + 1, 'capacity', _t.team_count);
END;
$$;

-- ─── RPC: cancel my registration ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_doubles_elimination_team_registration(
  p_tournament_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _caller uuid := auth.uid();
  _t_status text;
  _deleted integer;
BEGIN
  IF _caller IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;

  SELECT status INTO _t_status
  FROM public.doubles_elimination_tournaments
  WHERE id = p_tournament_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'TOURNAMENT_NOT_FOUND');
  END IF;
  IF _t_status <> 'registration_open' THEN
    RETURN json_build_object('success', false, 'error', 'REGISTRATION_CLOSED', 'status', _t_status);
  END IF;

  DELETE FROM public.doubles_elimination_teams
  WHERE tournament_id = p_tournament_id
    AND (player1_user_id = _caller OR player2_user_id = _caller);
  GET DIAGNOSTICS _deleted = ROW_COUNT;

  RETURN json_build_object('success', true, 'deleted', _deleted);
END;
$$;

-- ─── RPC: organizer closes registration + assigns seeds ────────────────────
-- Frontend still calls generateBracket() after this RPC succeeds; the RPC
-- only flips status + writes seeds so generateBracket reads consistent state.
CREATE OR REPLACE FUNCTION public.close_doubles_elimination_registration(
  p_tournament_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _caller uuid := auth.uid();
  _t public.doubles_elimination_tournaments;
  _count integer;
BEGIN
  IF _caller IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;

  SELECT * INTO _t FROM public.doubles_elimination_tournaments WHERE id = p_tournament_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'TOURNAMENT_NOT_FOUND');
  END IF;
  IF _t.creator_user_id <> _caller THEN
    RETURN json_build_object('success', false, 'error', 'NOT_OWNER');
  END IF;
  IF _t.status <> 'registration_open' THEN
    RETURN json_build_object('success', false, 'error', 'NOT_REGISTRATION_OPEN', 'status', _t.status);
  END IF;

  SELECT count(*) INTO _count
  FROM public.doubles_elimination_teams
  WHERE tournament_id = p_tournament_id;

  IF _count < _t.team_count THEN
    RETURN json_build_object('success', false, 'error', 'NOT_FULL',
      'count', _count, 'capacity', _t.team_count);
  END IF;

  -- Assign seeds by DUPR avg desc. Teams without DUPR seed last by team_name.
  WITH ordered AS (
    SELECT id,
      row_number() OVER (ORDER BY
        CASE WHEN dupr_avg_rating IS NULL THEN 1 ELSE 0 END,
        dupr_avg_rating DESC NULLS LAST,
        team_name
      ) AS rn
    FROM public.doubles_elimination_teams
    WHERE tournament_id = p_tournament_id
  )
  UPDATE public.doubles_elimination_teams t
  SET seed = ordered.rn
  FROM ordered
  WHERE t.id = ordered.id;

  -- Flip status. current_round stays 0; frontend generateBracket() sets it to 1.
  UPDATE public.doubles_elimination_tournaments
  SET status = 'ongoing'
  WHERE id = p_tournament_id;

  RETURN json_build_object('success', true, 'count', _count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_team_for_doubles_elimination(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_doubles_elimination_team_registration(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_doubles_elimination_registration(uuid) TO authenticated;
