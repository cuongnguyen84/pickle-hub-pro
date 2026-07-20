-- ============================================================================
-- UX-07 increment 7 — serialize the doubles-elimination capacity check.
-- ============================================================================
-- `register_team_for_doubles_elimination` (20260529120000) does
--
--     SELECT count(*) ... ;  IF count >= capacity THEN reject;  ... INSERT
--
-- with no advisory lock, no FOR UPDATE, and no unique constraint standing in
-- for one. That is the exact check-then-insert shape DB-00 reproduced and
-- DB-01 fixed for social events — the tournament branch was never covered.
-- Two registrations landing in the same window both read the last free slot
-- and both insert, so a full bracket accepts an extra team and the organizer
-- has to un-invite someone who was already told "đăng ký thành công".
--
-- Today's load does not trigger it (prod: one tournament has ever used the
-- open-registration path, 2 teams, 20 minutes apart) — which is precisely why
-- it must be fixed BEFORE any guest-registration path removes the account-
-- creation step that currently spaces registrations out. Concurrency, not
-- volume, is what sets this off: one Zalo link dropped into a group chat is
-- enough.
--
-- Fix mirrors DB-01 exactly (`20260716090000_db01_atomic_event_capacity.sql`):
-- a transaction-scoped advisory lock keyed on the tournament, taken before
-- the capacity read. Serializes registrations for ONE tournament only;
-- different tournaments never contend. Released at commit.
--
-- Only the locking line changes — the rest of the body is reproduced verbatim
-- so this migration is reviewable as a diff against 20260529120000.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.register_team_for_doubles_elimination(
  p_tournament_id UUID,
  p_partner_user_id UUID,
  p_team_name TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _caller UUID := auth.uid();
  _t RECORD;
  _current_count INT;
  _r1 NUMERIC; _r2 NUMERIC;
  _approx1 BOOLEAN; _approx2 BOOLEAN;
  _p1_name TEXT; _p2_name TEXT;
  _avg NUMERIC;
  _seed_src TEXT;
  _team_display TEXT;
  _new_team_id UUID;
BEGIN
  IF _caller IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
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

  -- ── UX-07: serialize everything below, per tournament ────────────────────
  -- Must be taken BEFORE the capacity read: that read plus the INSERT far
  -- below are the critical section. Concurrent registrations for the SAME
  -- tournament queue here; other tournaments are unaffected.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('de_capacity:' || p_tournament_id::text, 0)
  );

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
