-- =============================================================================
-- W3.2 — Per-user TOTAL create quota across all 4 tournament tools
-- =============================================================================
-- TOTAL quota: profiles.tournament_create_quota (default 3) caps the SUM of
-- a user's tournaments across Quick Tables + Flex + Doubles Elimination +
-- Team Match. This closes the bypass Codex flagged (P1, PR #106) where a
-- user could create 3 of each tool to reach 12 effective tournaments.
--
-- Helper:
--   count_user_tournaments(_user_id) — SECURITY DEFINER, returns the SUM of
--   the 4 owner-column counts (see column-name note below). Used by every
--   quota-checking RPC + read-only quota-info RPC so there's one source of
--   truth for "how many tournaments does this user already own".
--
-- Owner column names per table (kept exactly as the existing schemas):
--   quick_tables                    → creator_user_id
--   flex_tournaments                → creator_user_id
--   doubles_elimination_tournaments → creator_user_id
--   team_match_tournaments          → created_by    ← note the difference
--
-- All RPCs are idempotent: DROP FUNCTION IF EXISTS (with the exact existing
-- signature) then CREATE OR REPLACE. Migration is safe to re-run.
--
-- Admin override pattern: bump profiles.tournament_create_quota for a power
-- user via set_user_quota(_user_id, _new_quota) admin RPC. The quota itself
-- still applies as a TOTAL cap (e.g. quota=10 → 10 tournaments TOTAL across
-- all 4 tools, not 10 per tool).
-- =============================================================================


-- ─── Helper: count_user_tournaments ─────────────────────────────────────────
-- Sums across all 4 tournament tables for a given user.

CREATE OR REPLACE FUNCTION public.count_user_tournaments(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    (SELECT COUNT(*) FROM public.quick_tables WHERE creator_user_id = _user_id)
    + (SELECT COUNT(*) FROM public.flex_tournaments WHERE creator_user_id = _user_id)
    + (SELECT COUNT(*) FROM public.doubles_elimination_tournaments WHERE creator_user_id = _user_id)
    + (SELECT COUNT(*) FROM public.team_match_tournaments WHERE created_by = _user_id)
$$;

GRANT EXECUTE ON FUNCTION public.count_user_tournaments(uuid) TO authenticated;


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

  _tournament_count := public.count_user_tournaments(_user_id);

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

  _tournament_count := public.count_user_tournaments(_user_id);

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

  _tournament_count := public.count_user_tournaments(_user_id);

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


-- ─── 4) Quick Tables — switch to TOTAL counting ─────────────────────────────
-- Update the three Quick-Tables-related quota RPCs to use the shared helper
-- so they enforce / report the same TOTAL cap as the other 3 tools. Signature
-- preserved verbatim (DROP then re-CREATE with identical args).

DROP FUNCTION IF EXISTS public.create_quick_table_with_quota(
  text, integer, quick_table_format, integer, boolean, boolean, boolean, text, boolean
);

CREATE OR REPLACE FUNCTION public.create_quick_table_with_quota(
  _name text,
  _player_count integer,
  _format quick_table_format,
  _group_count integer DEFAULT NULL::integer,
  _requires_registration boolean DEFAULT false,
  _requires_skill_level boolean DEFAULT false,
  _auto_approve_registrations boolean DEFAULT false,
  _registration_message text DEFAULT NULL::text,
  _is_doubles boolean DEFAULT true
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
  _table_count integer;
  _user_quota integer;
  _new_table public.quick_tables;
  _share_id text;
BEGIN
  _user_id := auth.uid();

  IF _user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;

  _table_count := public.count_user_tournaments(_user_id);

  SELECT COALESCE(tournament_create_quota, 3) INTO _user_quota
  FROM public.profiles
  WHERE id = _user_id;

  IF _user_quota IS NULL THEN
    _user_quota := 3;
  END IF;

  IF _table_count >= _user_quota THEN
    RETURN json_build_object(
      'success', false,
      'error', 'LIMIT_REACHED',
      'count', _table_count,
      'quota', _user_quota
    );
  END IF;

  _share_id := encode(extensions.gen_random_bytes(6), 'hex');

  INSERT INTO public.quick_tables (
    name,
    player_count,
    format,
    group_count,
    share_id,
    creator_user_id,
    requires_registration,
    requires_skill_level,
    auto_approve_registrations,
    registration_message,
    is_public,
    is_doubles
  ) VALUES (
    _name,
    _player_count,
    _format,
    _group_count,
    _share_id,
    _user_id,
    _requires_registration,
    _requires_skill_level,
    _auto_approve_registrations,
    _registration_message,
    true,
    _is_doubles
  )
  RETURNING * INTO _new_table;

  RETURN json_build_object(
    'success', true,
    'table', row_to_json(_new_table),
    'count', _table_count + 1,
    'quota', _user_quota
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_quick_table_with_quota(
  text, integer, quick_table_format, integer, boolean, boolean, boolean, text, boolean
) TO authenticated;


-- can_create_quick_table_with_quota — TOTAL-aware

CREATE OR REPLACE FUNCTION public.can_create_quick_table_with_quota(_user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _table_count integer;
  _quota integer;
BEGIN
  _table_count := public.count_user_tournaments(_user_id);

  SELECT COALESCE(tournament_create_quota, 3) INTO _quota
  FROM public.profiles
  WHERE id = _user_id;

  IF _quota IS NULL THEN
    _quota := 3;
  END IF;

  RETURN json_build_object(
    'can_create', _table_count < _quota,
    'current_count', _table_count,
    'quota', _quota
  );
END;
$function$;


-- get_user_quota_info — TOTAL-aware (used by Quick Tables list page + the
-- shared useUserCreateQuota hook for the other 3 list pages).

CREATE OR REPLACE FUNCTION public.get_user_quota_info(_user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _table_count integer;
  _quota integer;
BEGIN
  _table_count := public.count_user_tournaments(_user_id);

  SELECT COALESCE(tournament_create_quota, 3) INTO _quota
  FROM public.profiles
  WHERE id = _user_id;

  RETURN json_build_object(
    'current_count', _table_count,
    'quota', COALESCE(_quota, 3)
  );
END;
$function$;


-- Refresh PostgREST schema cache so the new RPCs are immediately callable.
NOTIFY pgrst, 'reload schema';
