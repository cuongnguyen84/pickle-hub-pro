-- ADMIN-MFA sweep (đợt 2, theo review): các chỗ check admin "chay" bằng
-- EXISTS(user_roles ... role='admin') không đi qua is_admin() nên né mất
-- guard aal2 vừa thêm ở 20260730090000. Chuẩn hoá tất cả về is_admin().
-- Liệt kê từ prod: pg_proc.prosrc ILIKE user_roles+admin, pg_policy qual.

-- ── 1. Policies admin thuần ────────────────────────────────────────────────
DROP POLICY IF EXISTS "blog_post_views_admin_select" ON public.blog_post_views;
CREATE POLICY "blog_post_views_admin_select" ON public.blog_post_views
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "blog_post_seed_views_admin_only" ON public.blog_post_seed_views;
CREATE POLICY "blog_post_seed_views_admin_only" ON public.blog_post_seed_views
  FOR ALL TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "secret_sync_log_admin_select" ON public.secret_sync_log;
CREATE POLICY "secret_sync_log_admin_select" ON public.secret_sync_log
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "fb_post_log_admin_select" ON public.fb_post_log;
CREATE POLICY "fb_post_log_admin_select" ON public.fb_post_log
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ── 2. Policies có nhánh admin|creator (club_id IS NULL) ──────────────────
-- Giữ nguyên semantics cho creator; phần admin đi qua is_admin().
DROP POLICY IF EXISTS "match_proposals_select" ON public.match_proposals;
CREATE POLICY "match_proposals_select" ON public.match_proposals
  FOR SELECT TO authenticated
  USING (
    auth.uid() = created_by
    OR auth.uid() = ANY (team_a_player_ids)
    OR auth.uid() = ANY (team_b_player_ids)
    OR (club_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.dupr_user_clubs uc
      WHERE uc.user_id = auth.uid()
        AND uc.club_id = match_proposals.club_id
        AND uc.role = ANY (ARRAY['DIRECTOR'::text, 'ORGANIZER'::text])
        AND uc.expires_at > now()
    ))
    OR (club_id IS NULL AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'creator'::app_role
      )
    ))
  );

DROP POLICY IF EXISTS "match_proposal_verifications_select" ON public.match_proposal_verifications;
CREATE POLICY "match_proposal_verifications_select" ON public.match_proposal_verifications
  FOR SELECT TO authenticated
  USING (
    auth.uid() = player_user_id
    OR EXISTS (
      SELECT 1 FROM public.match_proposals mp
      WHERE mp.id = match_proposal_verifications.proposal_id
        AND (
          auth.uid() = mp.created_by
          OR auth.uid() = ANY (mp.team_a_player_ids)
          OR auth.uid() = ANY (mp.team_b_player_ids)
          OR (mp.club_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.dupr_user_clubs uc
            WHERE uc.user_id = auth.uid()
              AND uc.club_id = mp.club_id
              AND uc.role = ANY (ARRAY['DIRECTOR'::text, 'ORGANIZER'::text])
              AND uc.expires_at > now()
          ))
          OR (mp.club_id IS NULL AND (
            public.is_admin()
            OR EXISTS (
              SELECT 1 FROM public.user_roles ur
              WHERE ur.user_id = auth.uid() AND ur.role = 'creator'::app_role
            )
          ))
        )
    )
  );

-- ── 3. Functions với admin-bypass chay ─────────────────────────────────────
-- user_can_admin_organization: nhánh 1 (global admin) -> is_admin().
-- Nhánh 2 rút còn creator: trường hợp (org member + role admin + aal2)
-- đã được is_admin() phủ, giữ lại chỉ thừa.
CREATE OR REPLACE FUNCTION public.user_can_admin_organization(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE p.id = auth.uid()
      AND p.organization_id = p_org_id
      AND ur.role = 'creator'
  );
$function$;

-- mark_match_submitted_to_dupr: admin bypass -> is_admin(). Body giữ nguyên,
-- chỉ thay khối SELECT EXISTS(user_roles) INTO v_is_admin.
CREATE OR REPLACE FUNCTION public.mark_match_submitted_to_dupr(p_match_id uuid, p_dupr_match_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid              UUID := auth.uid();
  v_club_id          UUID;
  v_already_submitted BOOLEAN;
  v_is_admin         BOOLEAN := FALSE;
  v_dupr_code        TEXT := trim(coalesce(p_dupr_match_id, ''));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501';
  END IF;

  IF length(v_dupr_code) < 1 THEN
    RAISE EXCEPTION 'dupr_match_id_required' USING ERRCODE = '22023';
  END IF;

  -- DUPR matchCode is typically a 10-digit numeric or alphanumeric token.
  -- We don't strictly enforce shape here (operator may paste hashedMatchCode
  -- variants), just cap length so the column doesn't get garbage.
  IF length(v_dupr_code) > 64 THEN
    RAISE EXCEPTION 'dupr_match_id_too_long' USING ERRCODE = '22023';
  END IF;

  SELECT club_id, submitted_to_dupr
  INTO v_club_id, v_already_submitted
  FROM public.matches
  WHERE id = p_match_id;

  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'match_not_in_club' USING ERRCODE = 'P0002';
  END IF;

  IF v_already_submitted IS TRUE THEN
    RAISE EXCEPTION 'already_submitted' USING ERRCODE = '23505';
  END IF;

  -- Global admin bypass — useful when troubleshooting from /admin.
  -- ADMIN-MFA: qua is_admin() để ăn guard aal2.
  v_is_admin := public.is_admin();

  IF NOT (v_is_admin OR public.is_club_organizer(v_club_id, v_uid)) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  UPDATE public.matches
  SET submitted_to_dupr  = TRUE,
      dupr_match_id      = v_dupr_code,
      dupr_submitted_at  = NOW(),
      ready_for_dupr     = FALSE,  -- remove from queue once submitted
      updated_at         = NOW()
  WHERE id = p_match_id;

  RETURN TRUE;
END;
$function$;
