-- Task 4 follow-up: create a Doubles Elimination tournament, configure its
-- rating mode, insert a manual roster, and generate the preliminary bracket
-- as one business transaction. Registration-open creation uses the same RPC
-- with an empty roster and also avoids the old post-create status patch.
--
-- Forward-only rollback reasoning: clients can be switched back to the older
-- quota RPC without dropping this additive function. Tournaments already
-- created by this RPC use the same tables and generation keys as registration
-- close, so no data rewrite is required.

CREATE OR REPLACE FUNCTION public.create_doubles_elimination_atomic(
  p_name text,
  p_share_id text,
  p_team_count integer,
  p_has_third_place_match boolean,
  p_early_rounds_format text,
  p_semifinals_format text,
  p_finals_format text,
  p_court_count integer,
  p_start_time text,
  p_rating_source text,
  p_min_dupr_rating numeric,
  p_max_dupr_rating numeric,
  p_open_registration boolean,
  p_teams jsonb,
  p_seeding_strategy text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_create json;
  v_close json;
  v_tournament_id uuid;
  v_tournament public.doubles_elimination_tournaments;
  v_team jsonb;
  v_team_count integer;
  v_seed_source text;
BEGIN
  IF v_caller IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;

  IF btrim(coalesce(p_name, '')) = '' THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_NAME');
  END IF;

  IF p_share_id !~ '^[a-z0-9]{6,32}$' THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_SHARE_ID');
  END IF;

  IF p_team_count < 40 OR p_team_count > 128 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'INVALID_TEAM_COUNT',
      'min', 40,
      'max', 128
    );
  END IF;

  IF p_early_rounds_format NOT IN ('bo1', 'bo3', 'bo5')
     OR p_semifinals_format NOT IN ('bo1', 'bo3', 'bo5')
     OR p_finals_format NOT IN ('bo1', 'bo3', 'bo5') THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_MATCH_FORMAT');
  END IF;

  IF p_court_count < 1
     OR (p_start_time IS NOT NULL
         AND p_start_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_SCHEDULE');
  END IF;

  IF p_rating_source NOT IN ('self', 'dupr', 'either')
     OR p_seeding_strategy NOT IN ('manual', 'random', 'dupr') THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_CONFIGURATION');
  END IF;

  IF p_min_dupr_rating IS NOT NULL
     AND (p_min_dupr_rating < 0 OR p_min_dupr_rating > 8) THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_DUPR_RANGE');
  END IF;
  IF p_max_dupr_rating IS NOT NULL
     AND (p_max_dupr_rating < 0 OR p_max_dupr_rating > 8) THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_DUPR_RANGE');
  END IF;
  IF p_min_dupr_rating IS NOT NULL AND p_max_dupr_rating IS NOT NULL
     AND p_min_dupr_rating > p_max_dupr_rating THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_DUPR_RANGE');
  END IF;

  IF jsonb_typeof(coalesce(p_teams, 'null'::jsonb)) <> 'array' THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_TEAM_PAYLOAD');
  END IF;

  v_team_count := jsonb_array_length(p_teams);
  IF p_open_registration THEN
    IF p_rating_source <> 'dupr' OR v_team_count <> 0 THEN
      RETURN json_build_object('success', false, 'error', 'INVALID_REGISTRATION_MODE');
    END IF;
  ELSIF v_team_count <> p_team_count THEN
    RETURN json_build_object(
      'success', false,
      'error', 'TEAM_COUNT_MISMATCH',
      'count', v_team_count,
      'capacity', p_team_count
    );
  END IF;

  -- Validate the complete roster before the first write. The exception block
  -- below remains a final rollback boundary for casts, FK checks, and the
  -- nested bracket builder.
  FOR v_team IN SELECT value FROM jsonb_array_elements(p_teams)
  LOOP
    v_seed_source := coalesce(v_team ->> 'dupr_seed_source', 'none');
    IF jsonb_typeof(v_team) <> 'object'
       OR btrim(coalesce(v_team ->> 'team_name', '')) = ''
       OR btrim(coalesce(v_team ->> 'player1_name', '')) = ''
       OR v_seed_source NOT IN ('exact', 'approx', 'none')
       OR (
         v_team ? 'dupr_avg_rating'
         AND jsonb_typeof(v_team -> 'dupr_avg_rating') NOT IN ('number', 'null')
       )
       OR (
         nullif(v_team ->> 'player1_user_id', '') IS NOT NULL
         AND (v_team ->> 'player1_user_id') !~*
           '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       )
       OR (
         nullif(v_team ->> 'player2_user_id', '') IS NOT NULL
         AND (v_team ->> 'player2_user_id') !~*
           '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       ) THEN
      RETURN json_build_object('success', false, 'error', 'INVALID_TEAM_PAYLOAD');
    END IF;
  END LOOP;

  -- Serialize new atomic creators for one account before the legacy quota RPC
  -- counts tournaments. This closes the race between two concurrent calls of
  -- this new path without globally locking unrelated organizers.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('de-create-quota:' || v_caller::text, 0)
  );

  v_create := public.create_doubles_elimination_with_quota(
    btrim(p_name),
    p_share_id,
    p_team_count,
    p_has_third_place_match,
    p_early_rounds_format,
    p_semifinals_format,
    p_finals_format,
    p_court_count,
    p_start_time
  );

  IF coalesce((v_create ->> 'success')::boolean, false) IS NOT TRUE THEN
    RETURN v_create;
  END IF;

  v_tournament_id := (v_create #>> '{tournament,id}')::uuid;

  UPDATE public.doubles_elimination_tournaments
  SET rating_source = p_rating_source,
      min_dupr_rating = p_min_dupr_rating,
      max_dupr_rating = p_max_dupr_rating,
      status = 'registration_open'
  WHERE id = v_tournament_id;

  IF p_open_registration THEN
    SELECT * INTO v_tournament
    FROM public.doubles_elimination_tournaments
    WHERE id = v_tournament_id;

    RETURN json_build_object(
      'success', true,
      'tournament', row_to_json(v_tournament),
      'count', v_create -> 'count',
      'quota', v_create -> 'quota',
      'registration_open', true
    );
  END IF;

  INSERT INTO public.doubles_elimination_teams (
    tournament_id,
    team_name,
    player1_name,
    player2_name,
    seed,
    player1_user_id,
    player2_user_id,
    dupr_avg_rating,
    dupr_seed_source,
    status
  )
  SELECT
    v_tournament_id,
    btrim(team ->> 'team_name'),
    btrim(team ->> 'player1_name'),
    nullif(btrim(team ->> 'player2_name'), ''),
    nullif(team ->> 'seed', '')::integer,
    nullif(team ->> 'player1_user_id', '')::uuid,
    nullif(team ->> 'player2_user_id', '')::uuid,
    nullif(team ->> 'dupr_avg_rating', '')::numeric,
    coalesce(team ->> 'dupr_seed_source', 'none'),
    'active'
  FROM jsonb_array_elements(p_teams) AS roster(team);

  v_close := public.close_doubles_elimination_registration(
    v_tournament_id,
    p_seeding_strategy
  );

  IF coalesce((v_close ->> 'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'DE_CREATE_' || coalesce(v_close ->> 'error', 'BRACKET_FAILED');
  END IF;

  SELECT * INTO v_tournament
  FROM public.doubles_elimination_tournaments
  WHERE id = v_tournament_id;

  RETURN json_build_object(
    'success', true,
    'tournament', row_to_json(v_tournament),
    'count', v_create -> 'count',
    'quota', v_create -> 'quota',
    'registration_open', false,
    'match_count', v_close -> 'match_count'
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object('success', false, 'error', 'DUPLICATE_VALUE');
  WHEN foreign_key_violation OR invalid_text_representation OR check_violation THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_TEAM_PAYLOAD');
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'CREATE_FAILED',
      'detail', SQLERRM
    );
END;
$$;

REVOKE ALL ON FUNCTION public.create_doubles_elimination_atomic(
  text, text, integer, boolean, text, text, text, integer, text, text,
  numeric, numeric, boolean, jsonb, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_doubles_elimination_atomic(
  text, text, integer, boolean, text, text, text, integer, text, text,
  numeric, numeric, boolean, jsonb, text
) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_doubles_elimination_atomic(
  text, text, integer, boolean, text, text, text, integer, text, text,
  numeric, numeric, boolean, jsonb, text
) TO authenticated;

COMMENT ON FUNCTION public.create_doubles_elimination_atomic(
  text, text, integer, boolean, text, text, text, integer, text, text,
  numeric, numeric, boolean, jsonb, text
) IS 'Atomically creates a DE tournament and either opens DUPR registration or inserts the full manual roster and generated preliminary graph.';

NOTIFY pgrst, 'reload schema';
