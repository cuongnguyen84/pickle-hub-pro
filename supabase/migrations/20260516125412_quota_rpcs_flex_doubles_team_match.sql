-- =============================================================================
-- W3.2 — Per-user create quotas for Flex / Doubles Elimination / Team Match
-- =============================================================================
-- Mirrors the existing create_quick_table_with_quota pattern so all four
-- tournament tools share the same per-user create cap stored on
-- profiles.tournament_create_quota (default 3, admin override = bump column).
--
-- Each RPC:
--   1. SECURITY DEFINER + SET search_path TO 'public'
--   2. checks auth.uid() → AUTH_REQUIRED
--   3. counts existing rows for the caller in the target table
--   4. reads profiles.tournament_create_quota (fallback 3)
--   5. if count >= quota → returns json {success:false, error:'LIMIT_REACHED',
--      count, quota}; otherwise inserts row(s) and returns the created
--      record + new count + quota
--
-- All RPCs are idempotent: DROP FUNCTION IF EXISTS then CREATE OR REPLACE.
-- Migration is safe to re-run.
--
-- Admin override pattern: matches Quick Tables. To grant a power user
-- unlimited creates, bump profiles.tournament_create_quota for that user
-- via the set_user_quota(_user_id, _new_quota) admin RPC.
--
-- Owner column names per table (kept exactly as the existing schemas):
--   flex_tournaments              → creator_user_id
--   doubles_elimination_tournaments → creator_user_id
--   team_match_tournaments        → created_by   ← note the difference
-- =============================================================================


-- ─── 1) Flex tournaments ─────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.create_flex_tournament_with_quota(text, boolean);

CREATE OR REPLACE FUNCTION public.create_flex_tournament_with_quota(
  _name text,
  _is_public boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
  _tournament_count integer;
  _user_quota integer;
  _new_tournament public.flex_tournaments;
BEGIN
  _user_id := auth.uid();

  IF _user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;

  SELECT COUNT(*) INTO _tournament_count
  FROM public.flex_tournaments
  WHERE creator_user_id = _user_id;

  SELECT COALESCE(tournament_create_quota, 3) INTO _user_quota
  FROM public.profiles
  WHERE id = _user_id;

  IF _user_quota IS NULL THEN
    _user_quota := 3;
  END IF;

  IF _tournament_count >= _user_quota THEN
    RETURN json_build_object(
      'success', false,
      'error', 'LIMIT_REACHED',
      'count', _tournament_count,
      'quota', _user_quota
    );
  END IF;

  INSERT INTO public.flex_tournaments (
    name,
    creator_user_id,
    is_public
  ) VALUES (
    _name,
    _user_id,
    _is_public
  )
  RETURNING * INTO _new_tournament;

  RETURN json_build_object(
    'success', true,
    'tournament', row_to_json(_new_tournament),
    'count', _tournament_count + 1,
    'quota', _user_quota
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_flex_tournament_with_quota(text, boolean) TO authenticated;


-- ─── 2) Doubles elimination tournaments ──────────────────────────────────────

DROP FUNCTION IF EXISTS public.create_doubles_elimination_with_quota(
  text, text, integer, boolean, text, text, text, integer, text
);

CREATE OR REPLACE FUNCTION public.create_doubles_elimination_with_quota(
  _name text,
  _share_id text,
  _team_count integer,
  _has_third_place_match boolean DEFAULT false,
  _early_rounds_format text DEFAULT 'bo1',
  _semifinals_format text DEFAULT 'bo3',
  _finals_format text DEFAULT 'bo3',
  _court_count integer DEFAULT 1,
  _start_time text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
  _tournament_count integer;
  _user_quota integer;
  _new_tournament public.doubles_elimination_tournaments;
BEGIN
  _user_id := auth.uid();

  IF _user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;

  SELECT COUNT(*) INTO _tournament_count
  FROM public.doubles_elimination_tournaments
  WHERE creator_user_id = _user_id;

  SELECT COALESCE(tournament_create_quota, 3) INTO _user_quota
  FROM public.profiles
  WHERE id = _user_id;

  IF _user_quota IS NULL THEN
    _user_quota := 3;
  END IF;

  IF _tournament_count >= _user_quota THEN
    RETURN json_build_object(
      'success', false,
      'error', 'LIMIT_REACHED',
      'count', _tournament_count,
      'quota', _user_quota
    );
  END IF;

  INSERT INTO public.doubles_elimination_tournaments (
    name,
    share_id,
    creator_user_id,
    team_count,
    has_third_place_match,
    early_rounds_format,
    semifinals_format,
    finals_format,
    court_count,
    start_time
  ) VALUES (
    _name,
    _share_id,
    _user_id,
    _team_count,
    _has_third_place_match,
    _early_rounds_format,
    _semifinals_format,
    _finals_format,
    _court_count,
    _start_time
  )
  RETURNING * INTO _new_tournament;

  RETURN json_build_object(
    'success', true,
    'tournament', row_to_json(_new_tournament),
    'count', _tournament_count + 1,
    'quota', _user_quota
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_doubles_elimination_with_quota(
  text, text, integer, boolean, text, text, text, integer, text
) TO authenticated;


-- ─── 3) Team match tournaments (MLP) ─────────────────────────────────────────
-- NOTE: this table uses `created_by` (not creator_user_id) for the owner FK,
-- and exposes typed columns (team_match_status enum, team_game_type enum, etc).
-- Passing format/status as text and casting inside keeps the RPC signature
-- usable from the JS client without leaking enum names.

DROP FUNCTION IF EXISTS public.create_team_match_with_quota(
  text, text, integer, integer, text, integer, boolean, boolean, boolean, boolean, text
);

CREATE OR REPLACE FUNCTION public.create_team_match_with_quota(
  _name text,
  _share_id text,
  _team_roster_size integer,
  _team_count integer,
  _format text DEFAULT 'round_robin',
  _playoff_team_count integer DEFAULT NULL,
  _require_registration boolean DEFAULT false,
  _has_dreambreaker boolean DEFAULT false,
  _require_min_games_per_player boolean DEFAULT false,
  _has_third_place_match boolean DEFAULT false,
  _bracket_pairing_type text DEFAULT 'random'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
  _tournament_count integer;
  _user_quota integer;
  _new_tournament public.team_match_tournaments;
BEGIN
  _user_id := auth.uid();

  IF _user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;

  SELECT COUNT(*) INTO _tournament_count
  FROM public.team_match_tournaments
  WHERE created_by = _user_id;

  SELECT COALESCE(tournament_create_quota, 3) INTO _user_quota
  FROM public.profiles
  WHERE id = _user_id;

  IF _user_quota IS NULL THEN
    _user_quota := 3;
  END IF;

  IF _tournament_count >= _user_quota THEN
    RETURN json_build_object(
      'success', false,
      'error', 'LIMIT_REACHED',
      'count', _tournament_count,
      'quota', _user_quota
    );
  END IF;

  INSERT INTO public.team_match_tournaments (
    name,
    share_id,
    created_by,
    team_roster_size,
    team_count,
    format,
    playoff_team_count,
    require_registration,
    has_dreambreaker,
    dreambreaker_game_type,
    dreambreaker_scoring_type,
    require_min_games_per_player,
    has_third_place_match,
    bracket_pairing_type,
    status
  ) VALUES (
    _name,
    _share_id,
    _user_id,
    _team_roster_size,
    _team_count,
    _format,
    _playoff_team_count,
    _require_registration,
    _has_dreambreaker,
    NULL,                              -- fixed: Singles (handled in frontend)
    NULL,                              -- fixed: Rally Scoring (handled in frontend)
    _require_min_games_per_player,
    _has_third_place_match,
    _bracket_pairing_type,
    'registration'::team_match_status  -- match useTeamMatch default
  )
  RETURNING * INTO _new_tournament;

  RETURN json_build_object(
    'success', true,
    'tournament', row_to_json(_new_tournament),
    'count', _tournament_count + 1,
    'quota', _user_quota
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_team_match_with_quota(
  text, text, integer, integer, text, integer, boolean, boolean, boolean, boolean, text
) TO authenticated;


-- Refresh PostgREST schema cache so the new RPCs are immediately callable.
NOTIFY pgrst, 'reload schema';
