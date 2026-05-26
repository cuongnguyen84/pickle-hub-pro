-- ============================================================================
-- Club match confirmation flow (Phase 2)
-- ============================================================================
-- Adds an opponent-confirmation step for matches logged by regular CLB
-- members (non-organizers). Organizers / managers still auto-confirm.
--
-- Status machine on matches.confirmation_status:
--   'auto_confirmed_admin'      — organizer/manager logged → ready to ship
--   'pending_opponent_confirm'  — member logged → waiting on opposing team
--   'confirmed'                 — opponent clicked confirm → ready to ship
--   'disputed'                  — opponent disputed (future use)
--
-- Existing rows backfill to 'auto_confirmed_admin' so the old admin path
-- is unaffected.
-- ============================================================================

-- ─── 1. Columns ─────────────────────────────────────────────────────────────

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS confirmation_status TEXT NOT NULL DEFAULT 'auto_confirmed_admin';

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS confirmation_required_from UUID[] NOT NULL DEFAULT '{}';

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Constraint: confirmation_status enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_matches_confirmation_status'
  ) THEN
    ALTER TABLE public.matches
      ADD CONSTRAINT chk_matches_confirmation_status
      CHECK (confirmation_status IN (
        'pending_opponent_confirm',
        'confirmed',
        'auto_confirmed_admin',
        'disputed'
      ));
  END IF;
END $$;

-- Lookup index for pending-confirmations queue (GIN on the uuid array).
CREATE INDEX IF NOT EXISTS idx_matches_pending_confirm_from
  ON public.matches USING GIN (confirmation_required_from)
  WHERE confirmation_status = 'pending_opponent_confirm';

COMMENT ON COLUMN public.matches.confirmation_status IS
  'Match confirmation flow state. Set by log_club_match based on caller role; flipped by confirm_club_match.';
COMMENT ON COLUMN public.matches.confirmation_required_from IS
  'profile_ids who can confirm this match (typically the opposing team). Empty for auto_confirmed_admin rows.';

-- ─── 2. Replace log_club_match — role-aware ────────────────────────────────
-- Members can now log matches. When they do, status flips to
-- pending_opponent_confirm and confirmation_required_from is populated
-- with the opposing-team player ids.
--
-- Rules:
--   * Caller must be active club member OR organizer.
--   * If caller is organizer (creator/manager) → auto_confirmed_admin.
--   * If caller is plain member → caller must be in team_a (you log
--     your own match); confirmation flows to team_b.
--   * Auto-set ready_for_dupr for organizer path (matches old behavior
--     was opt-in; new flow streamlines to ready=true so the 1-click
--     submit dialog has work to do).

DROP FUNCTION IF EXISTS public.log_club_match(
  UUID, TEXT, TIMESTAMPTZ, INTEGER[], INTEGER[], UUID[], UUID[], TEXT, TEXT, TEXT
);

CREATE OR REPLACE FUNCTION public.log_club_match(
  p_club_id          UUID,
  p_format           TEXT,
  p_played_at        TIMESTAMPTZ,
  p_team_a_score     INTEGER[],
  p_team_b_score     INTEGER[],
  p_team_a_players   UUID[],
  p_team_b_players   UUID[],
  p_notes            TEXT DEFAULT NULL,
  p_court_number     TEXT DEFAULT NULL,
  p_scoring_format   TEXT DEFAULT '11_rally'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid              UUID := auth.uid();
  v_match_id         UUID;
  v_slug             TEXT;
  v_winning_team     TEXT;
  v_score_a_total    INTEGER := 0;
  v_score_b_total    INTEGER := 0;
  v_player_id        UUID;
  v_team_a_size      INTEGER;
  v_team_b_size      INTEGER;
  v_expected_size    INTEGER;
  v_is_organizer     BOOLEAN;
  v_is_member        BOOLEAN;
  v_conf_status      TEXT;
  v_conf_required    UUID[];
  v_ready_for_dupr   BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501';
  END IF;

  v_is_organizer := public.is_club_organizer(p_club_id, v_uid);
  v_is_member    := public.is_club_member(p_club_id, v_uid);

  IF NOT (v_is_organizer OR v_is_member) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  IF p_format NOT IN ('singles', 'doubles', 'mixed') THEN
    RAISE EXCEPTION 'invalid_format' USING ERRCODE = '22023';
  END IF;

  v_team_a_size := COALESCE(array_length(p_team_a_players, 1), 0);
  v_team_b_size := COALESCE(array_length(p_team_b_players, 1), 0);
  v_expected_size := CASE WHEN p_format = 'singles' THEN 1 ELSE 2 END;
  IF v_team_a_size <> v_expected_size OR v_team_b_size <> v_expected_size THEN
    RAISE EXCEPTION 'team_size_mismatch' USING ERRCODE = '22023';
  END IF;

  IF COALESCE(array_length(p_team_a_score, 1), 0) <> COALESCE(array_length(p_team_b_score, 1), 0)
     OR COALESCE(array_length(p_team_a_score, 1), 0) < 1
     OR COALESCE(array_length(p_team_a_score, 1), 0) > 5 THEN
    RAISE EXCEPTION 'score_length_invalid' USING ERRCODE = '22023';
  END IF;

  -- Every player must be in this club.
  FOREACH v_player_id IN ARRAY (p_team_a_players || p_team_b_players)
  LOOP
    IF NOT (
      public.is_club_member(p_club_id, v_player_id)
      OR public.is_club_organizer(p_club_id, v_player_id)
    ) THEN
      RAISE EXCEPTION 'player_not_in_club' USING ERRCODE = '42501', DETAIL = v_player_id::text;
    END IF;
  END LOOP;

  IF (
    SELECT COUNT(*) <> COUNT(DISTINCT pid)
    FROM unnest(p_team_a_players || p_team_b_players) pid
  ) THEN
    RAISE EXCEPTION 'duplicate_player' USING ERRCODE = '23505';
  END IF;

  -- ─── Determine confirmation flow ─────────────────────────────────────────
  IF v_is_organizer THEN
    v_conf_status := 'auto_confirmed_admin';
    v_conf_required := '{}'::UUID[];
    v_ready_for_dupr := TRUE;  -- streamline 1-click admin submit
  ELSE
    -- Member path: caller must be in team A so the OPPOSING team confirms.
    IF NOT (v_uid = ANY(p_team_a_players)) THEN
      RAISE EXCEPTION 'caller_must_be_in_team_a' USING ERRCODE = '22023',
        DETAIL = 'Members can only log matches they played. Put yourself in team A.';
    END IF;
    v_conf_status := 'pending_opponent_confirm';
    v_conf_required := p_team_b_players;
    v_ready_for_dupr := FALSE;  -- not ready until confirmed
  END IF;

  -- Winner determination.
  SELECT SUM(CASE WHEN a > b THEN 1 ELSE 0 END), SUM(CASE WHEN b > a THEN 1 ELSE 0 END)
  INTO v_score_a_total, v_score_b_total
  FROM unnest(p_team_a_score, p_team_b_score) AS s(a, b);

  v_winning_team := CASE
    WHEN v_score_a_total > v_score_b_total THEN 'a'
    WHEN v_score_b_total > v_score_a_total THEN 'b'
    ELSE NULL
  END;

  v_slug := lower(
    'clb-' ||
    COALESCE((SELECT slug FROM public.clubs WHERE id = p_club_id), 'unknown') ||
    '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)
  );

  INSERT INTO public.matches (
    slug, format, match_type,
    club_id, played_at,
    team_a_score, team_b_score, winning_team, scoring_format,
    court_number, notes, recorded_by, is_public,
    verification_status,
    confirmation_status, confirmation_required_from,
    ready_for_dupr
  )
  VALUES (
    v_slug, p_format, 'rec',
    p_club_id, p_played_at,
    p_team_a_score, p_team_b_score, v_winning_team,
    COALESCE(p_scoring_format, '11_rally'),
    NULLIF(p_court_number, ''), p_notes, v_uid, TRUE,
    CASE WHEN v_is_organizer THEN 'verified' ELSE 'pending' END,
    v_conf_status, v_conf_required,
    v_ready_for_dupr
  )
  RETURNING id INTO v_match_id;

  FOR i IN 1 .. v_team_a_size LOOP
    INSERT INTO public.match_participants (match_id, player_id, team, position)
    VALUES (v_match_id, p_team_a_players[i], 'a', i);
  END LOOP;
  FOR i IN 1 .. v_team_b_size LOOP
    INSERT INTO public.match_participants (match_id, player_id, team, position)
    VALUES (v_match_id, p_team_b_players[i], 'b', i);
  END LOOP;

  RETURN v_match_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_club_match(
  UUID, TEXT, TIMESTAMPTZ, INTEGER[], INTEGER[], UUID[], UUID[], TEXT, TEXT, TEXT
) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.log_club_match(
  UUID, TEXT, TIMESTAMPTZ, INTEGER[], INTEGER[], UUID[], UUID[], TEXT, TEXT, TEXT
) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.log_club_match(
  UUID, TEXT, TIMESTAMPTZ, INTEGER[], INTEGER[], UUID[], UUID[], TEXT, TEXT, TEXT
) TO service_role;

COMMENT ON FUNCTION public.log_club_match(
  UUID, TEXT, TIMESTAMPTZ, INTEGER[], INTEGER[], UUID[], UUID[], TEXT, TEXT, TEXT
) IS
  'Atomic match log for a CLB. Role-aware: organizers auto-confirm + ready, members create pending_opponent_confirm rows that need team-B sign-off. Members must be in team A.';

-- ─── 3. confirm_club_match RPC ──────────────────────────────────────────────
-- Opposing-team player flips the match to "confirmed" + ready_for_dupr.
-- Caller MUST be in matches.confirmation_required_from.
-- Returns the match row so the caller can pass it straight to the
-- edge function that submits to DUPR.

CREATE OR REPLACE FUNCTION public.confirm_club_match(
  p_match_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid           UUID := auth.uid();
  v_status        TEXT;
  v_required_from UUID[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501';
  END IF;

  SELECT confirmation_status, confirmation_required_from
  INTO v_status, v_required_from
  FROM public.matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'match_not_found' USING ERRCODE = '02000';
  END IF;

  IF v_status <> 'pending_opponent_confirm' THEN
    RAISE EXCEPTION 'not_pending' USING ERRCODE = '22023',
      DETAIL = 'Match is in state ' || v_status;
  END IF;

  IF NOT (v_uid = ANY(v_required_from)) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501',
      DETAIL = 'You are not on the opposing team for this match.';
  END IF;

  UPDATE public.matches
  SET confirmation_status = 'confirmed',
      confirmed_by        = v_uid,
      confirmed_at        = NOW(),
      ready_for_dupr      = TRUE,
      verification_status = 'verified'
  WHERE id = p_match_id;

  RETURN p_match_id;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_club_match(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.confirm_club_match(UUID) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.confirm_club_match(UUID) TO service_role;

COMMENT ON FUNCTION public.confirm_club_match(UUID) IS
  'Opposing-team player confirms a member-logged match. Flips status to confirmed + ready_for_dupr=true so the edge function can push to DUPR. SECURITY DEFINER: verifies caller is in confirmation_required_from.';

-- ─── 4. list_my_pending_confirmations RPC ───────────────────────────────────
-- Returns matches where the caller is on the opposing team and the
-- match is still waiting for confirmation. Includes participants so the
-- UI can render the full match card without joining manually.

CREATE OR REPLACE FUNCTION public.list_my_pending_confirmations()
RETURNS TABLE (
  id                 UUID,
  slug               TEXT,
  club_id            UUID,
  club_slug          TEXT,
  club_name          TEXT,
  played_at          TIMESTAMPTZ,
  format             TEXT,
  team_a_score       INTEGER[],
  team_b_score       INTEGER[],
  winning_team       TEXT,
  recorded_by        UUID,
  recorded_by_name   TEXT,
  notes              TEXT,
  team_a_players     JSONB,
  team_b_players     JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.slug,
    m.club_id,
    c.slug AS club_slug,
    c.name AS club_name,
    m.played_at,
    m.format,
    m.team_a_score,
    m.team_b_score,
    m.winning_team,
    m.recorded_by,
    rp.display_name AS recorded_by_name,
    m.notes,
    -- Team A players JSON.
    (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'profile_id', p.id,
            'display_name', p.display_name,
            'avatar_url', p.avatar_url,
            'dupr_id', p.dupr_id,
            'position', mp.position
          ) ORDER BY mp.position
        ),
        '[]'::jsonb
      )
      FROM public.match_participants mp
      JOIN public.profiles p ON p.id = mp.player_id
      WHERE mp.match_id = m.id AND mp.team = 'a'
    ) AS team_a_players,
    -- Team B players JSON.
    (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'profile_id', p.id,
            'display_name', p.display_name,
            'avatar_url', p.avatar_url,
            'dupr_id', p.dupr_id,
            'position', mp.position
          ) ORDER BY mp.position
        ),
        '[]'::jsonb
      )
      FROM public.match_participants mp
      JOIN public.profiles p ON p.id = mp.player_id
      WHERE mp.match_id = m.id AND mp.team = 'b'
    ) AS team_b_players
  FROM public.matches m
  LEFT JOIN public.clubs c ON c.id = m.club_id
  LEFT JOIN public.profiles rp ON rp.id = m.recorded_by
  WHERE m.confirmation_status = 'pending_opponent_confirm'
    AND v_uid = ANY(m.confirmation_required_from)
  ORDER BY m.played_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_my_pending_confirmations() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.list_my_pending_confirmations() TO authenticated;

COMMENT ON FUNCTION public.list_my_pending_confirmations() IS
  'Returns matches awaiting the calling user''s confirmation. Includes club info + full team rosters for one-shot UI rendering.';

-- ─── 5. Update list_club_matches to expose confirmation_status ──────────────
-- The CLB matches list needs to render different badges per row, so we
-- add confirmation_status + confirmed_by + confirmed_at to the return
-- shape. Existing callers ignore unknown columns so this is backward-
-- compatible.

DROP FUNCTION IF EXISTS public.list_club_matches(UUID, INTEGER);

CREATE OR REPLACE FUNCTION public.list_club_matches(
  p_club_id UUID,
  p_limit   INTEGER DEFAULT 50
)
RETURNS TABLE (
  id                          UUID,
  slug                        TEXT,
  played_at                   TIMESTAMPTZ,
  format                      TEXT,
  team_a_score                INTEGER[],
  team_b_score                INTEGER[],
  winning_team                TEXT,
  ready_for_dupr              BOOLEAN,
  submitted_to_dupr           BOOLEAN,
  dupr_match_id               TEXT,
  notes                       TEXT,
  confirmation_status         TEXT,
  confirmation_required_from  UUID[],
  confirmed_at                TIMESTAMPTZ,
  team_a_players              JSONB,
  team_b_players              JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.slug,
    m.played_at,
    m.format,
    m.team_a_score,
    m.team_b_score,
    m.winning_team,
    m.ready_for_dupr,
    m.submitted_to_dupr,
    m.dupr_match_id,
    m.notes,
    m.confirmation_status,
    m.confirmation_required_from,
    m.confirmed_at,
    (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'profile_id', p.id,
            'display_name', p.display_name,
            'avatar_url', p.avatar_url,
            'dupr_id', p.dupr_id,
            'position', mp.position
          ) ORDER BY mp.position
        ),
        '[]'::jsonb
      )
      FROM public.match_participants mp
      JOIN public.profiles p ON p.id = mp.player_id
      WHERE mp.match_id = m.id AND mp.team = 'a'
    ) AS team_a_players,
    (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'profile_id', p.id,
            'display_name', p.display_name,
            'avatar_url', p.avatar_url,
            'dupr_id', p.dupr_id,
            'position', mp.position
          ) ORDER BY mp.position
        ),
        '[]'::jsonb
      )
      FROM public.match_participants mp
      JOIN public.profiles p ON p.id = mp.player_id
      WHERE mp.match_id = m.id AND mp.team = 'b'
    ) AS team_b_players
  FROM public.matches m
  WHERE m.club_id = p_club_id
  ORDER BY m.played_at DESC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.list_club_matches(UUID, INTEGER) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.list_club_matches(UUID, INTEGER) TO anon;
GRANT  EXECUTE ON FUNCTION public.list_club_matches(UUID, INTEGER) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.list_club_matches(UUID, INTEGER) TO service_role;

NOTIFY pgrst, 'reload schema';
