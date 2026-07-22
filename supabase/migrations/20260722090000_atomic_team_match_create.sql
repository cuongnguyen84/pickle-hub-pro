-- Task 4: Team Match tournament configuration and game templates must commit
-- with the quota-controlled parent row. Previously both clients created the
-- parent first, then patched metadata and inserted templates in separate REST
-- requests, leaving unusable tournaments after any intermediate failure.
--
-- Forward-only rollback: old clients may continue using
-- create_team_match_with_quota. Roll new clients back before revoking this
-- additive RPC; rows created here use the existing schema exclusively.

CREATE OR REPLACE FUNCTION public.create_team_match_atomic(
  p_config jsonb,
  p_templates jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_create json;
  v_tournament public.team_match_tournaments;
  v_tournament_id uuid;
  v_existing public.team_match_tournaments;
  v_name text;
  v_share_id text;
  v_roster_size integer;
  v_team_count integer;
  v_format text;
  v_playoff_count integer;
  v_pairing text;
  v_template jsonb;
  v_template_count integer;
  v_require_dupr boolean;
  v_dupr_male numeric;
  v_dupr_female numeric;
  v_total_score boolean;
  v_points_per_game integer;
  v_entry_fee integer;
  v_entry_fee_team integer;
  v_event_date date;
BEGIN
  IF v_caller IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;
  IF jsonb_typeof(coalesce(p_config, 'null'::jsonb)) <> 'object'
     OR jsonb_typeof(coalesce(p_templates, 'null'::jsonb)) <> 'array' THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_CONFIGURATION');
  END IF;

  v_name := left(btrim(coalesce(p_config ->> 'name', '')), 150);
  v_share_id := lower(btrim(coalesce(p_config ->> 'share_id', '')));
  v_roster_size := nullif(p_config ->> 'team_roster_size', '')::integer;
  v_team_count := nullif(p_config ->> 'team_count', '')::integer;
  v_format := coalesce(p_config ->> 'format', 'round_robin');
  v_playoff_count := nullif(p_config ->> 'playoff_team_count', '')::integer;
  v_pairing := coalesce(p_config ->> 'bracket_pairing_type', 'random');
  v_require_dupr := coalesce((p_config ->> 'require_dupr')::boolean, false);
  v_dupr_male := nullif(p_config ->> 'dupr_max_male', '')::numeric;
  v_dupr_female := nullif(p_config ->> 'dupr_max_female', '')::numeric;
  v_total_score := coalesce((p_config ->> 'total_score_mode')::boolean, false);
  v_points_per_game := nullif(p_config ->> 'points_per_game', '')::integer;
  v_entry_fee := coalesce(nullif(p_config ->> 'entry_fee_vnd', '')::integer, 0);
  v_entry_fee_team := coalesce(nullif(p_config ->> 'entry_fee_team_vnd', '')::integer, 0);

  IF v_name = '' THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_NAME');
  END IF;
  IF v_share_id !~ '^[a-z0-9]{6,32}$' THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_SHARE_ID');
  END IF;

  SELECT * INTO v_existing
  FROM public.team_match_tournaments
  WHERE share_id = v_share_id;
  IF FOUND THEN
    IF v_existing.created_by = v_caller THEN
      RETURN json_build_object(
        'success', true, 'tournament', row_to_json(v_existing),
        'idempotent', true
      );
    END IF;
    RETURN json_build_object('success', false, 'error', 'SHARE_ID_TAKEN');
  END IF;

  IF v_roster_size NOT IN (4, 6, 8)
     OR v_team_count IS NULL OR v_team_count < 2 OR v_team_count > 128
     OR v_format NOT IN ('round_robin', 'single_elimination', 'rr_playoff')
     OR v_pairing NOT IN ('random', 'manual') THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_CONFIGURATION');
  END IF;
  IF v_format = 'rr_playoff' THEN
    IF v_playoff_count IS NULL OR v_playoff_count < 2
       OR v_playoff_count > v_team_count
       OR (v_playoff_count & (v_playoff_count - 1)) <> 0 THEN
      RETURN json_build_object('success', false, 'error', 'INVALID_PLAYOFF_COUNT');
    END IF;
  ELSE
    v_playoff_count := NULL;
  END IF;
  IF v_require_dupr AND (
       coalesce(v_dupr_male, 5.0) < 0 OR coalesce(v_dupr_male, 5.0) > 8
       OR coalesce(v_dupr_female, 4.5) < 0 OR coalesce(v_dupr_female, 4.5) > 8
     ) THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_DUPR_RANGE');
  END IF;
  IF v_total_score AND (v_points_per_game IS NULL OR v_points_per_game < 1 OR v_points_per_game > 999) THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_POINTS_PER_GAME');
  END IF;
  IF v_entry_fee < 0 OR v_entry_fee_team < 0 THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_ENTRY_FEE');
  END IF;
  IF p_config ? 'discount_tiers'
     AND jsonb_typeof(p_config -> 'discount_tiers') NOT IN ('array', 'null') THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_DISCOUNT_TIERS');
  END IF;
  IF nullif(p_config ->> 'event_date', '') IS NOT NULL THEN
    v_event_date := (p_config ->> 'event_date')::date;
  END IF;

  v_template_count := jsonb_array_length(p_templates);
  IF v_template_count < 1 OR v_template_count > 50 THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_TEMPLATES');
  END IF;
  FOR v_template IN SELECT value FROM jsonb_array_elements(p_templates)
  LOOP
    IF jsonb_typeof(v_template) <> 'object'
       OR coalesce(v_template ->> 'game_type', '') NOT IN ('WD', 'MD', 'MX', 'WS', 'MS')
       OR coalesce(v_template ->> 'scoring_type', '') NOT IN ('rally21', 'sideout11') THEN
      RETURN json_build_object('success', false, 'error', 'INVALID_TEMPLATES');
    END IF;
  END LOOP;

  -- The legacy quota RPC does the canonical total count. Serialize only
  -- creators using this atomic path so concurrent creates cannot both pass.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('team-match-create-quota:' || v_caller::text, 0)
  );

  v_create := public.create_team_match_with_quota(
    v_name,
    v_share_id,
    v_roster_size,
    v_team_count,
    v_format,
    v_playoff_count,
    coalesce((p_config ->> 'require_registration')::boolean, false),
    coalesce((p_config ->> 'has_dreambreaker')::boolean, false),
    coalesce((p_config ->> 'require_min_games_per_player')::boolean, false),
    CASE WHEN v_format = 'single_elimination'
      THEN coalesce((p_config ->> 'has_third_place_match')::boolean, false)
      ELSE false END,
    v_pairing
  );
  IF coalesce((v_create ->> 'success')::boolean, false) IS NOT TRUE THEN
    RETURN v_create;
  END IF;
  v_tournament_id := (v_create #>> '{tournament,id}')::uuid;

  UPDATE public.team_match_tournaments
  SET require_dupr = v_require_dupr,
      dupr_max_male = CASE WHEN v_require_dupr THEN coalesce(v_dupr_male, 5.0) ELSE NULL END,
      dupr_max_female = CASE WHEN v_require_dupr THEN coalesce(v_dupr_female, 4.5) ELSE NULL END,
      total_score_mode = v_total_score,
      points_per_game = CASE WHEN v_total_score THEN v_points_per_game ELSE NULL END,
      has_repechage = CASE WHEN v_format = 'rr_playoff'
        THEN coalesce((p_config ->> 'has_repechage')::boolean, false)
        ELSE false END,
      rules_summary = nullif(btrim(p_config ->> 'rules_summary'), ''),
      entry_fee_vnd = nullif(v_entry_fee, 0),
      entry_fee_team_vnd = nullif(v_entry_fee_team, 0),
      bank_code = CASE WHEN v_entry_fee > 0 OR v_entry_fee_team > 0
        THEN nullif(btrim(p_config ->> 'bank_code'), '') ELSE NULL END,
      bank_account_number = CASE WHEN v_entry_fee > 0 OR v_entry_fee_team > 0
        THEN nullif(btrim(p_config ->> 'bank_account_number'), '') ELSE NULL END,
      bank_account_name = CASE WHEN v_entry_fee > 0 OR v_entry_fee_team > 0
        THEN nullif(btrim(p_config ->> 'bank_account_name'), '') ELSE NULL END,
      event_date = v_event_date,
      location = nullif(btrim(p_config ->> 'location'), ''),
      discount_tiers = CASE WHEN v_entry_fee > 0 OR v_entry_fee_team > 0
        THEN p_config -> 'discount_tiers' ELSE NULL END
  WHERE id = v_tournament_id;

  INSERT INTO public.team_match_game_templates (
    tournament_id, order_index, game_type, display_name, scoring_type
  )
  SELECT
    v_tournament_id,
    row_number() OVER (ORDER BY ordinality)::integer - 1,
    (template ->> 'game_type')::public.team_game_type,
    nullif(btrim(template ->> 'display_name'), ''),
    (template ->> 'scoring_type')::public.game_scoring_type
  FROM jsonb_array_elements(p_templates) WITH ORDINALITY AS items(template, ordinality);

  SELECT * INTO v_tournament
  FROM public.team_match_tournaments WHERE id = v_tournament_id;
  RETURN json_build_object(
    'success', true,
    'tournament', row_to_json(v_tournament),
    'count', v_create -> 'count',
    'quota', v_create -> 'quota'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', CASE
        WHEN SQLSTATE IN ('22P02', '22007', '22008', '22003') THEN 'INVALID_CONFIGURATION'
        WHEN SQLSTATE = '23505' THEN 'SHARE_ID_TAKEN'
        ELSE 'CREATE_FAILED'
      END
    );
END;
$$;

REVOKE ALL ON FUNCTION public.create_team_match_atomic(jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_team_match_atomic(jsonb, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_team_match_atomic(jsonb, jsonb) TO authenticated;

COMMENT ON FUNCTION public.create_team_match_atomic(jsonb, jsonb) IS
  'Atomically quota-checks and creates a fully configured Team Match tournament with its game templates.';
