-- ============================================================================
-- Club match log — feat/club-log-match
-- ============================================================================
-- Extends the existing `matches` table with a `club_id` link + a
-- `ready_for_dupr` flag so club organizers can log matches played at the
-- club and queue them for DUPR submission once UAT pipeline goes live.
--
-- Permission model (per product decision 2026-05-25):
--   * INSERT: only club creator / manager (= is_club_organizer == true).
--   * Players: only profiles drawn from `club_members` (active rows).
--   * UPDATE ready_for_dupr: organizers only.
--   * DELETE: NOT enabled here (matches are historical record).
--
-- DUPR submission is intentionally OUT OF SCOPE for this migration —
-- the existing `submitted_to_dupr` / `dupr_match_id` columns from
-- 20260503131017_bet1_social_layer.sql are reused. An edge function
-- `dupr-match-submit` (held on feat/dupr-match-submit branch) will read
-- `ready_for_dupr = true AND submitted_to_dupr = false` rows when the
-- UAT pipeline is wired up.
--
-- IDEMPOTENT — replay-safe.
-- ============================================================================

-- ─── 1. Add columns ────────────────────────────────────────────────────────

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS ready_for_dupr BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_matches_club_id
  ON public.matches (club_id, played_at DESC)
  WHERE club_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_matches_ready_for_dupr
  ON public.matches (ready_for_dupr, submitted_to_dupr)
  WHERE ready_for_dupr = TRUE AND submitted_to_dupr = FALSE;

COMMENT ON COLUMN public.matches.club_id IS
  'Optional CLB link. Populated when match is logged from /clb/:slug via log_club_match RPC. See migration 20260525120000.';

COMMENT ON COLUMN public.matches.ready_for_dupr IS
  'Organizer-flipped flag indicating the match is ready to push to DUPR. Edge function `dupr-match-submit` reads this together with submitted_to_dupr=FALSE to find the work queue. See migration 20260525120000.';

-- ─── 2. RLS — organizer insert path ────────────────────────────────────────
-- The base "matches_owner_insert" policy from 20260503131017 only allows
-- the user themselves (auth.uid() = recorded_by) to insert. That holds
-- here too — the organizer IS the recorded_by, the players are tagged via
-- match_participants. No new INSERT policy needed; existing one covers it.
--
-- For UPDATE of ready_for_dupr we DO need a new policy: "matches_owner_update"
-- already allows the recorded_by to update everything including the flag.
-- We keep it. The RPC mark_match_ready_for_dupr below additionally permits
-- co-organizers (managers) to flip the flag even if they were not the
-- original recorder, via SECURITY DEFINER.

-- ─── 3. RPC log_club_match ─────────────────────────────────────────────────
-- Atomic insert of matches + match_participants rows. Organizer-gated.
-- Player ids must all be active club_members of the same club.

CREATE OR REPLACE FUNCTION public.log_club_match(
  p_club_id          UUID,
  p_format           TEXT,        -- 'singles' | 'doubles' | 'mixed'
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
  v_uid           UUID := auth.uid();
  v_match_id      UUID;
  v_slug          TEXT;
  v_winning_team  TEXT;
  v_score_a_total INTEGER := 0;
  v_score_b_total INTEGER := 0;
  v_player_id     UUID;
  v_team_a_size   INTEGER;
  v_team_b_size   INTEGER;
  v_expected_size INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_club_organizer(p_club_id, v_uid) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  IF p_format NOT IN ('singles', 'doubles', 'mixed') THEN
    RAISE EXCEPTION 'invalid_format' USING ERRCODE = '22023';
  END IF;

  -- Team-size validation.
  v_team_a_size := COALESCE(array_length(p_team_a_players, 1), 0);
  v_team_b_size := COALESCE(array_length(p_team_b_players, 1), 0);
  v_expected_size := CASE WHEN p_format = 'singles' THEN 1 ELSE 2 END;
  IF v_team_a_size <> v_expected_size OR v_team_b_size <> v_expected_size THEN
    RAISE EXCEPTION 'team_size_mismatch' USING ERRCODE = '22023';
  END IF;

  -- Score arrays must be same length, at least 1 game, max 5.
  IF COALESCE(array_length(p_team_a_score, 1), 0) <> COALESCE(array_length(p_team_b_score, 1), 0)
     OR COALESCE(array_length(p_team_a_score, 1), 0) < 1
     OR COALESCE(array_length(p_team_a_score, 1), 0) > 5 THEN
    RAISE EXCEPTION 'score_length_invalid' USING ERRCODE = '22023';
  END IF;

  -- Every player must be an active member of THIS club. The organizer
  -- counts as a "member" via membership status helpers (creator/manager
  -- treated as members for this check).
  FOREACH v_player_id IN ARRAY (p_team_a_players || p_team_b_players)
  LOOP
    IF NOT (
      public.is_club_member(p_club_id, v_player_id)
      OR public.is_club_organizer(p_club_id, v_player_id)
    ) THEN
      RAISE EXCEPTION 'player_not_in_club' USING ERRCODE = '42501', DETAIL = v_player_id::text;
    END IF;
  END LOOP;

  -- Reject duplicate player ids across teams (and within the same team).
  IF (
    SELECT COUNT(*) <> COUNT(DISTINCT pid)
    FROM unnest(p_team_a_players || p_team_b_players) pid
  ) THEN
    RAISE EXCEPTION 'duplicate_player' USING ERRCODE = '23505';
  END IF;

  -- Determine winning team by sum of games won. Ties stay NULL so the UI
  -- can flag them as "ongoing / no winner yet".
  SELECT SUM(CASE WHEN a > b THEN 1 ELSE 0 END), SUM(CASE WHEN b > a THEN 1 ELSE 0 END)
  INTO v_score_a_total, v_score_b_total
  FROM unnest(p_team_a_score, p_team_b_score) AS s(a, b);

  v_winning_team := CASE
    WHEN v_score_a_total > v_score_b_total THEN 'a'
    WHEN v_score_b_total > v_score_a_total THEN 'b'
    ELSE NULL
  END;

  -- Slug: clb-<slug>-<short uuid>. Keeps URLs scoped to the club so the
  -- match page (/tran-dau/:slug) reads naturally.
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
    verification_status
  )
  VALUES (
    v_slug, p_format, 'rec',
    p_club_id, p_played_at,
    p_team_a_score, p_team_b_score, v_winning_team,
    COALESCE(p_scoring_format, '11_rally'),
    NULLIF(p_court_number, ''), p_notes, v_uid, TRUE,
    'verified'  -- organizer-logged matches are auto-verified; players
                -- can still dispute via match_participants.
  )
  RETURNING id INTO v_match_id;

  -- Insert participants. team A then team B, position by array index.
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
REVOKE ALL ON FUNCTION public.log_club_match(
  UUID, TEXT, TIMESTAMPTZ, INTEGER[], INTEGER[], UUID[], UUID[], TEXT, TEXT, TEXT
) FROM anon;
GRANT  EXECUTE ON FUNCTION public.log_club_match(
  UUID, TEXT, TIMESTAMPTZ, INTEGER[], INTEGER[], UUID[], UUID[], TEXT, TEXT, TEXT
) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.log_club_match(
  UUID, TEXT, TIMESTAMPTZ, INTEGER[], INTEGER[], UUID[], UUID[], TEXT, TEXT, TEXT
) TO service_role;

COMMENT ON FUNCTION public.log_club_match(
  UUID, TEXT, TIMESTAMPTZ, INTEGER[], INTEGER[], UUID[], UUID[], TEXT, TEXT, TEXT
) IS
  'Organizer-only atomic insert of matches + match_participants for a CLB. Validates team sizes, score array lengths, every player is an active member of THIS club. Returns new match id. See migration 20260525120000.';

-- ─── 4. RPC list_club_matches ──────────────────────────────────────────────
-- Public-readable list of matches logged against a club. Joined with
-- participant profiles so the UI can render team rosters in one query.

CREATE OR REPLACE FUNCTION public.list_club_matches(
  p_club_id UUID,
  p_limit   INTEGER DEFAULT 50
)
RETURNS TABLE (
  id                  UUID,
  slug                TEXT,
  played_at           TIMESTAMPTZ,
  format              TEXT,
  team_a_score        INTEGER[],
  team_b_score        INTEGER[],
  winning_team        TEXT,
  ready_for_dupr      BOOLEAN,
  submitted_to_dupr   BOOLEAN,
  dupr_match_id       TEXT,
  notes               TEXT,
  team_a_players      JSONB,
  team_b_players      JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
    (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'profile_id', mp.player_id,
        'display_name', p.display_name,
        'avatar_url', p.avatar_url,
        'dupr_id', p.dupr_id,
        'position', mp.position
      ) ORDER BY mp.position), '[]'::jsonb)
      FROM public.match_participants mp
      JOIN public.profiles p ON p.id = mp.player_id
      WHERE mp.match_id = m.id AND mp.team = 'a'
    ) AS team_a_players,
    (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'profile_id', mp.player_id,
        'display_name', p.display_name,
        'avatar_url', p.avatar_url,
        'dupr_id', p.dupr_id,
        'position', mp.position
      ) ORDER BY mp.position), '[]'::jsonb)
      FROM public.match_participants mp
      JOIN public.profiles p ON p.id = mp.player_id
      WHERE mp.match_id = m.id AND mp.team = 'b'
    ) AS team_b_players
  FROM public.matches m
  WHERE m.club_id = p_club_id
  ORDER BY m.played_at DESC
  LIMIT COALESCE(p_limit, 50);
$$;

REVOKE ALL ON FUNCTION public.list_club_matches(UUID, INTEGER) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.list_club_matches(UUID, INTEGER) TO anon;
GRANT  EXECUTE ON FUNCTION public.list_club_matches(UUID, INTEGER) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.list_club_matches(UUID, INTEGER) TO service_role;

-- ─── 5. RPC mark_match_ready_for_dupr ──────────────────────────────────────
-- Toggle the ready_for_dupr flag. Organizer-gated. Refuses to flip if the
-- match has already been submitted (no double-submit possible).

CREATE OR REPLACE FUNCTION public.mark_match_ready_for_dupr(
  p_match_id UUID,
  p_ready    BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_club_id           UUID;
  v_submitted_to_dupr BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501';
  END IF;

  SELECT club_id, submitted_to_dupr
  INTO v_club_id, v_submitted_to_dupr
  FROM public.matches
  WHERE id = p_match_id;

  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'match_not_in_club' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.is_club_organizer(v_club_id, auth.uid()) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  IF v_submitted_to_dupr IS TRUE THEN
    RAISE EXCEPTION 'already_submitted' USING ERRCODE = '23505';
  END IF;

  UPDATE public.matches
  SET ready_for_dupr = p_ready,
      updated_at = NOW()
  WHERE id = p_match_id;

  RETURN p_ready;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_match_ready_for_dupr(UUID, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_match_ready_for_dupr(UUID, BOOLEAN) FROM anon;
GRANT  EXECUTE ON FUNCTION public.mark_match_ready_for_dupr(UUID, BOOLEAN) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.mark_match_ready_for_dupr(UUID, BOOLEAN) TO service_role;

COMMENT ON FUNCTION public.mark_match_ready_for_dupr(UUID, BOOLEAN) IS
  'Toggle ready_for_dupr on a club-logged match. Organizer-gated, refuses if already submitted. See migration 20260525120000.';
