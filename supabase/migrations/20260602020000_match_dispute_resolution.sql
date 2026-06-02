-- ============================================================================
-- Match dispute resolution (2026-06-02)
-- ----------------------------------------------------------------------------
-- When an opponent disputes a logged match, match-confirm sets
-- verification_status='disputed' (+ confirmation_status='disputed') and tells
-- the user "admin will review" — but until now there was NO surface or RPC to
-- actually review/resolve it. This adds:
--
--   resolve_match_dispute(match_id, action, [scores]) — admin OR club organizer
--     resolves a disputed match: 'accept' keeps the logged score, 'edit'
--     overrides it; either way the match becomes verified + ready_for_dupr,
--     dispute flags are cleared, and both players are notified. The caller's
--     UI then submits to DUPR via the existing dupr-match-submit edge function
--     (the resolver is admin/organizer, so the role gate passes).
--
--   list_resolvable_disputes() — disputed matches the caller may resolve:
--     ALL for a global admin, club-scoped for a club organizer/manager.
-- ============================================================================

-- ─── 1. resolve_match_dispute ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.resolve_match_dispute(
  p_match_id      UUID,
  p_action        TEXT,                       -- 'accept' | 'edit'
  p_team_a_score  INTEGER[] DEFAULT NULL,     -- required when action='edit'
  p_team_b_score  INTEGER[] DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_club_id   UUID;
  v_status    TEXT;
  v_slug      TEXT;
  v_a         INTEGER[];
  v_b         INTEGER[];
  v_winner    TEXT;
  v_sa        INTEGER := 0;
  v_sb        INTEGER := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501';
  END IF;
  IF p_action NOT IN ('accept', 'edit') THEN
    RAISE EXCEPTION 'invalid_action' USING ERRCODE = '22023';
  END IF;

  SELECT club_id, verification_status, slug, team_a_score, team_b_score
    INTO v_club_id, v_status, v_slug, v_a, v_b
  FROM public.matches
  WHERE id = p_match_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'match_not_found' USING ERRCODE = '02000';
  END IF;

  -- Authorize: global admin, OR organizer/manager of this match's club.
  IF NOT (
    public.has_role(v_uid, 'admin')
    OR (v_club_id IS NOT NULL AND public.is_club_organizer(v_club_id, v_uid))
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501',
      DETAIL = 'Only a platform admin or the club organizer can resolve this.';
  END IF;

  IF v_status <> 'disputed' THEN
    RAISE EXCEPTION 'not_disputed' USING ERRCODE = '22023',
      DETAIL = 'Match is in state ' || v_status;
  END IF;

  IF p_action = 'edit' THEN
    IF p_team_a_score IS NULL OR p_team_b_score IS NULL
       OR COALESCE(array_length(p_team_a_score, 1), 0) <> COALESCE(array_length(p_team_b_score, 1), 0)
       OR COALESCE(array_length(p_team_a_score, 1), 0) < 1
       OR COALESCE(array_length(p_team_a_score, 1), 0) > 5 THEN
      RAISE EXCEPTION 'invalid_scores' USING ERRCODE = '22023';
    END IF;
    v_a := p_team_a_score;
    v_b := p_team_b_score;
    SELECT SUM(CASE WHEN a > b THEN 1 ELSE 0 END), SUM(CASE WHEN b > a THEN 1 ELSE 0 END)
      INTO v_sa, v_sb
    FROM unnest(v_a, v_b) AS s(a, b);
    v_winner := CASE WHEN v_sa > v_sb THEN 'a' WHEN v_sb > v_sa THEN 'b' ELSE NULL END;
  END IF;

  UPDATE public.matches SET
    team_a_score        = CASE WHEN p_action = 'edit' THEN v_a ELSE team_a_score END,
    team_b_score        = CASE WHEN p_action = 'edit' THEN v_b ELSE team_b_score END,
    winning_team        = CASE WHEN p_action = 'edit' THEN v_winner ELSE winning_team END,
    verification_status = 'verified',
    confirmation_status = 'confirmed',
    verified_at         = now(),
    confirmed_by        = v_uid,
    confirmed_at        = now(),
    ready_for_dupr      = TRUE,
    updated_at          = now()
  WHERE id = p_match_id;

  -- Clear the dispute flags so the match reads clean everywhere.
  UPDATE public.match_participants
    SET disputed = FALSE, dispute_reason = NULL
  WHERE match_id = p_match_id;

  -- Notify all real (non-ghost) participants that the dispute was resolved.
  INSERT INTO public.social_notifications (user_id, type, title, body, link_url, payload, is_read)
  SELECT mp.player_id,
         'match_dispute_resolved',
         'Trận tranh chấp đã được xử lý',
         'Quản trị viên/CLB đã xác nhận tỉ số trận của bạn.',
         '/tran-dau/' || v_slug,
         jsonb_build_object('match_id', p_match_id, 'match_slug', v_slug),
         FALSE
  FROM public.match_participants mp
  JOIN public.profiles p ON p.id = mp.player_id
  WHERE mp.match_id = p_match_id
    AND COALESCE(p.is_ghost, FALSE) = FALSE;

  RETURN p_match_id;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_match_dispute(UUID, TEXT, INTEGER[], INTEGER[]) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.resolve_match_dispute(UUID, TEXT, INTEGER[], INTEGER[]) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.resolve_match_dispute(UUID, TEXT, INTEGER[], INTEGER[]) TO service_role;

COMMENT ON FUNCTION public.resolve_match_dispute(UUID, TEXT, INTEGER[], INTEGER[]) IS
  'Resolve a disputed match. action=accept keeps the score, action=edit overrides it. Verifies + ready_for_dupr, clears dispute flags, notifies players. SECURITY DEFINER: caller must be platform admin or club organizer of the match club.';

-- ─── 2. list_resolvable_disputes ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.list_resolvable_disputes()
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
  dispute_reasons    JSONB,
  team_a_players     JSONB,
  team_b_players     JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_is_admin BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501';
  END IF;
  v_is_admin := public.has_role(v_uid, 'admin');

  RETURN QUERY
  SELECT
    m.id, m.slug, m.club_id, c.slug, c.name, m.played_at, m.format,
    m.team_a_score, m.team_b_score, m.winning_team,
    m.recorded_by, rp.display_name,
    (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'player_id', mp.player_id,
        'name', COALESCE(pp.display_name, pp.username),
        'team', mp.team,
        'reason', mp.dispute_reason
      )), '[]'::jsonb)
      FROM public.match_participants mp
      JOIN public.profiles pp ON pp.id = mp.player_id
      WHERE mp.match_id = m.id AND mp.disputed = TRUE
    ) AS dispute_reasons,
    (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'profile_id', p.id, 'display_name', p.display_name,
        'avatar_url', p.avatar_url, 'dupr_id', p.dupr_id, 'position', mp.position
      ) ORDER BY mp.position), '[]'::jsonb)
      FROM public.match_participants mp
      JOIN public.profiles p ON p.id = mp.player_id
      WHERE mp.match_id = m.id AND mp.team = 'a'
    ) AS team_a_players,
    (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'profile_id', p.id, 'display_name', p.display_name,
        'avatar_url', p.avatar_url, 'dupr_id', p.dupr_id, 'position', mp.position
      ) ORDER BY mp.position), '[]'::jsonb)
      FROM public.match_participants mp
      JOIN public.profiles p ON p.id = mp.player_id
      WHERE mp.match_id = m.id AND mp.team = 'b'
    ) AS team_b_players
  FROM public.matches m
  LEFT JOIN public.clubs c ON c.id = m.club_id
  LEFT JOIN public.profiles rp ON rp.id = m.recorded_by
  WHERE m.verification_status = 'disputed'
    AND (
      v_is_admin
      OR (m.club_id IS NOT NULL AND public.is_club_organizer(m.club_id, v_uid))
    )
  ORDER BY m.played_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_resolvable_disputes() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.list_resolvable_disputes() TO authenticated;

COMMENT ON FUNCTION public.list_resolvable_disputes() IS
  'Disputed matches the caller may resolve: ALL for a platform admin, club-scoped for a club organizer/manager. Includes rosters + per-player dispute reasons.';

NOTIFY pgrst, 'reload schema';
