-- ============================================================================
-- Club managers — multi-organizer per CLB
-- ============================================================================
-- Hiện tại 1 CLB có 1 created_by duy nhất (column trên public.clubs). Owner
-- thực tế thường muốn share quyền quản lý với 2-3 người (đồng host, BTC
-- riêng từng giải). Migration này thêm bảng public.club_managers gắn N
-- profile vào 1 club, RLS + RPC để CRUD, và mở rộng tất cả RLS gate cũ
-- ("created_by = auth.uid()") để cũng accept manager rows.
--
-- Phân quyền (theo quyết định product 2026-05-21):
--   * CREATOR (clubs.created_by)  — toàn quyền + xoá/archive CLB.
--   * MANAGER (club_managers)     — toàn quyền TRỪ xoá/archive CLB + add/
--                                    remove manager khác.
--   * ADMIN  (user_roles.admin)   — toàn quyền ở mọi nơi (override).
--
-- Backward compatible: existing creator-only flows tiếp tục hoạt động vì
-- helper is_club_organizer() trả TRUE cho creator.
--
-- IDEMPOTENT — replay-safe.
-- ============================================================================

-- ─── 1. club_managers table ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.club_managers (
  club_id     UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  profile_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_by    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (club_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_club_managers_profile_id
  ON public.club_managers (profile_id);

COMMENT ON TABLE public.club_managers IS
  'Multi-organizer per CLB. Sibling of clubs.created_by (creator stays the singular owner). RLS: anyone SELECT (display names), creator/admin INSERT/DELETE. See migration 20260521130000.';

ALTER TABLE public.club_managers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "club_managers_select_all" ON public.club_managers;
CREATE POLICY "club_managers_select_all" ON public.club_managers
  FOR SELECT
  USING (true);

-- INSERT/DELETE policies are intentionally restrictive (creator + admin
-- only). Per product decision, managers CANNOT add/remove other managers
-- so the chain of trust stays anchored at the creator. RPCs below wrap
-- the mutations with friendlier error messages + auth checks; direct
-- mutations are still allowed for service-role + admin tooling.

DROP POLICY IF EXISTS "club_managers_insert_creator_or_admin" ON public.club_managers;
CREATE POLICY "club_managers_insert_creator_or_admin" ON public.club_managers
  FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = club_managers.club_id
        AND c.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "club_managers_delete_creator_or_admin" ON public.club_managers;
CREATE POLICY "club_managers_delete_creator_or_admin" ON public.club_managers
  FOR DELETE
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = club_managers.club_id
        AND c.created_by = auth.uid()
    )
  );

GRANT SELECT                ON public.club_managers TO anon;
GRANT SELECT, INSERT, DELETE ON public.club_managers TO authenticated;

-- ─── 2. is_club_organizer helper ───────────────────────────────────────────
-- Single source of truth: TRUE iff the user is the club creator, an active
-- manager, OR a site admin. SECURITY DEFINER so RLS on club_managers can't
-- accidentally hide a row the caller can't normally see.
-- Used by every "creator-or-admin" RLS gate this migration extends.

CREATE OR REPLACE FUNCTION public.is_club_organizer(
  p_club_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    p_user_id IS NOT NULL
    AND (
      public.has_role(p_user_id, 'admin'::public.app_role)
      OR EXISTS (
        SELECT 1 FROM public.clubs c
        WHERE c.id = p_club_id AND c.created_by = p_user_id
      )
      OR EXISTS (
        SELECT 1 FROM public.club_managers m
        WHERE m.club_id = p_club_id AND m.profile_id = p_user_id
      )
    );
$$;

REVOKE ALL ON FUNCTION public.is_club_organizer(UUID, UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_club_organizer(UUID, UUID) TO anon;
GRANT  EXECUTE ON FUNCTION public.is_club_organizer(UUID, UUID) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.is_club_organizer(UUID, UUID) TO service_role;

COMMENT ON FUNCTION public.is_club_organizer(UUID, UUID) IS
  'TRUE iff user is the club creator, an active manager, or a site admin. Use everywhere "creator + admin" used to be checked. See migration 20260521130000.';

-- Convenience wrapper resolving via an event_id (organizer surfaces often
-- only have the event id at hand). Joins social_events → clubs once.

CREATE OR REPLACE FUNCTION public.is_event_organizer(
  p_event_id UUID,
  p_user_id  UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    p_user_id IS NOT NULL
    AND (
      public.has_role(p_user_id, 'admin'::public.app_role)
      OR EXISTS (
        SELECT 1 FROM public.social_events e
        WHERE e.id = p_event_id AND e.created_by = p_user_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.social_events e
        JOIN public.club_managers m
          ON m.club_id = e.club_id
        WHERE e.id = p_event_id AND m.profile_id = p_user_id
      )
    );
$$;

REVOKE ALL ON FUNCTION public.is_event_organizer(UUID, UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_event_organizer(UUID, UUID) TO anon;
GRANT  EXECUTE ON FUNCTION public.is_event_organizer(UUID, UUID) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.is_event_organizer(UUID, UUID) TO service_role;

COMMENT ON FUNCTION public.is_event_organizer(UUID, UUID) IS
  'TRUE iff user can manage the parent club of this event. Wraps is_club_organizer + a join. See migration 20260521130000.';

-- ─── 3. RLS refresh — clubs UPDATE accepts managers ───────────────────────
-- Per product: managers can edit club info (name/description/logo/location)
-- but CANNOT archive. The archive flag is a single column (archived_at);
-- we enforce the carve-out via a BEFORE UPDATE trigger below since RLS
-- doesn't support column-level policies.

DROP POLICY IF EXISTS "clubs_update_owner_or_admin" ON public.clubs;
CREATE POLICY "clubs_update_organizer" ON public.clubs
  FOR UPDATE
  USING (public.is_club_organizer(id, auth.uid()))
  WITH CHECK (public.is_club_organizer(id, auth.uid()));

-- Trigger: only creator + admin may set/clear archived_at. Manager UPDATE
-- to other columns passes through unchanged. We compare IS DISTINCT FROM
-- so the trigger only fires when archived_at actually changed.

CREATE OR REPLACE FUNCTION public.enforce_clubs_archive_owner_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'archive_requires_auth' USING ERRCODE = '42501';
    END IF;
    IF NOT public.has_role(auth.uid(), 'admin'::public.app_role)
       AND auth.uid() <> OLD.created_by THEN
      RAISE EXCEPTION 'only_creator_can_archive_club' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clubs_enforce_archive_owner_only ON public.clubs;
CREATE TRIGGER trg_clubs_enforce_archive_owner_only
  BEFORE UPDATE ON public.clubs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_clubs_archive_owner_only();

-- ─── 4. RLS refresh — social_events INSERT/UPDATE/DELETE accept managers ──

DROP POLICY IF EXISTS "social_events_insert_owner" ON public.social_events;
DROP POLICY IF EXISTS "social_events_insert_owner_or_admin" ON public.social_events;
CREATE POLICY "social_events_insert_organizer" ON public.social_events
  FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND (
      club_id IS NULL
      OR public.is_club_organizer(club_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "social_events_update_owner_or_admin" ON public.social_events;
CREATE POLICY "social_events_update_organizer" ON public.social_events
  FOR UPDATE
  USING (
    auth.uid() = created_by
    OR (club_id IS NOT NULL AND public.is_club_organizer(club_id, auth.uid()))
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    auth.uid() = created_by
    OR (club_id IS NOT NULL AND public.is_club_organizer(club_id, auth.uid()))
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "social_events_delete_owner_or_admin" ON public.social_events;
CREATE POLICY "social_events_delete_organizer" ON public.social_events
  FOR DELETE
  USING (
    auth.uid() = created_by
    OR (club_id IS NOT NULL AND public.is_club_organizer(club_id, auth.uid()))
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- ─── 5. RLS refresh — event_registrations UPDATE/DELETE accept managers ───

DROP POLICY IF EXISTS "event_registrations_update_organizer" ON public.event_registrations;
CREATE POLICY "event_registrations_update_organizer" ON public.event_registrations
  FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_event_organizer(event_id, auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_event_organizer(event_id, auth.uid())
  );

DROP POLICY IF EXISTS "event_registrations_delete_organizer" ON public.event_registrations;
CREATE POLICY "event_registrations_delete_organizer" ON public.event_registrations
  FOR DELETE
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_event_organizer(event_id, auth.uid())
  );

-- Also extend the SELECT policy so managers see drafts + club-only events
-- they help organise (the public branch already covers anyone via the
-- published+public condition). is_event_organizer covers creator + admin
-- + manager so this collapses both the previous OR branches.

DROP POLICY IF EXISTS "event_registrations_select" ON public.event_registrations;
CREATE POLICY "event_registrations_select" ON public.event_registrations
  FOR SELECT
  USING (
    auth.uid() = profile_id
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_event_organizer(event_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.social_events e
      WHERE e.id = event_registrations.event_id
        AND e.status = 'published'
        AND e.visibility = 'public'
    )
  );

-- ─── 6. RLS refresh — event_payment_config accepts managers ───────────────

DROP POLICY IF EXISTS "event_payment_config_select_public" ON public.event_payment_config;
CREATE POLICY "event_payment_config_select_public" ON public.event_payment_config
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.social_events e
      WHERE e.id = event_payment_config.event_id
        AND e.status = 'published'
        AND e.visibility = 'public'
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_event_organizer(event_id, auth.uid())
  );

DROP POLICY IF EXISTS "event_payment_config_insert_owner" ON public.event_payment_config;
CREATE POLICY "event_payment_config_insert_organizer" ON public.event_payment_config
  FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_event_organizer(event_id, auth.uid())
  );

DROP POLICY IF EXISTS "event_payment_config_update_owner" ON public.event_payment_config;
CREATE POLICY "event_payment_config_update_organizer" ON public.event_payment_config
  FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_event_organizer(event_id, auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_event_organizer(event_id, auth.uid())
  );

DROP POLICY IF EXISTS "event_payment_config_delete_owner" ON public.event_payment_config;
CREATE POLICY "event_payment_config_delete_organizer" ON public.event_payment_config
  FOR DELETE
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_event_organizer(event_id, auth.uid())
  );

-- ─── 7. RPCs — managers list + add + remove + search ──────────────────────

-- 7a. list_club_managers — returns rows so the UI can render the badges.
-- Only callable by people who can see the manager surface (creator +
-- manager + admin); everyone else gets an empty set so non-organizers
-- can't enumerate the club's staff via this RPC.

CREATE OR REPLACE FUNCTION public.list_club_managers(p_club_id UUID)
RETURNS TABLE (
  profile_id    UUID,
  display_name  TEXT,
  email         TEXT,
  phone         TEXT,
  avatar_url    TEXT,
  added_at      TIMESTAMPTZ,
  added_by      UUID
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    m.profile_id,
    p.display_name,
    p.email,
    p.phone,
    p.avatar_url,
    m.added_at,
    m.added_by
  FROM public.club_managers m
  JOIN public.profiles p ON p.id = m.profile_id
  WHERE m.club_id = p_club_id
    AND public.is_club_organizer(p_club_id, auth.uid())
  ORDER BY m.added_at ASC;
$$;

REVOKE ALL ON FUNCTION public.list_club_managers(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_club_managers(UUID) FROM anon;
GRANT  EXECUTE ON FUNCTION public.list_club_managers(UUID) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.list_club_managers(UUID) TO service_role;

-- 7b. add_club_manager — wraps the INSERT with auth + sanity checks. Throws
-- structured errors the UI can translate.
--   * not_authorized       : caller is not creator + not admin.
--   * not_found            : club doesn't exist.
--   * profile_not_found    : target profile doesn't exist or is a ghost.
--   * already_creator      : target is already the creator (no-op).
--   * already_manager      : target is already in the managers list.

CREATE OR REPLACE FUNCTION public.add_club_manager(
  p_club_id    UUID,
  p_profile_id UUID
)
RETURNS public.club_managers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_creator UUID;
  v_row     public.club_managers;
  v_is_ghost BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501';
  END IF;

  SELECT created_by INTO v_creator FROM public.clubs WHERE id = p_club_id;
  IF v_creator IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role)
     AND auth.uid() <> v_creator THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  SELECT is_ghost INTO v_is_ghost FROM public.profiles WHERE id = p_profile_id;
  IF v_is_ghost IS NULL THEN
    RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_is_ghost IS TRUE THEN
    -- Ghost profiles have no auth.users row → can't log in to manage.
    RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF p_profile_id = v_creator THEN
    RAISE EXCEPTION 'already_creator' USING ERRCODE = '23505';
  END IF;

  -- Race-safe insert. The PK on (club_id, profile_id) catches concurrent
  -- adds. Translate the constraint error into a friendlier code.
  BEGIN
    INSERT INTO public.club_managers (club_id, profile_id, added_by)
    VALUES (p_club_id, p_profile_id, auth.uid())
    RETURNING * INTO v_row;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'already_manager' USING ERRCODE = '23505';
  END;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.add_club_manager(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_club_manager(UUID, UUID) FROM anon;
GRANT  EXECUTE ON FUNCTION public.add_club_manager(UUID, UUID) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.add_club_manager(UUID, UUID) TO service_role;

-- 7c. remove_club_manager — mirrors add. Returns the deleted row count.

CREATE OR REPLACE FUNCTION public.remove_club_manager(
  p_club_id    UUID,
  p_profile_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_creator UUID;
  v_count   INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501';
  END IF;

  SELECT created_by INTO v_creator FROM public.clubs WHERE id = p_club_id;
  IF v_creator IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role)
     AND auth.uid() <> v_creator THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.club_managers
  WHERE club_id = p_club_id AND profile_id = p_profile_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_club_manager(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_club_manager(UUID, UUID) FROM anon;
GRANT  EXECUTE ON FUNCTION public.remove_club_manager(UUID, UUID) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.remove_club_manager(UUID, UUID) TO service_role;

-- 7d. search_profile_for_manager — narrow lookup so the owner can find a
-- profile to invite. Matches on email exact (case-insensitive) OR phone
-- exact (E.164). Returns at most 1 row to avoid acting as a directory.
-- Caller must be authenticated; we don't bother enforcing club ownership
-- here because the result is just an email/phone-keyed profile lookup
-- the caller already has the email/phone for. Ghost profiles are excluded
-- (they can't log in to manage anyway).

CREATE OR REPLACE FUNCTION public.search_profile_for_manager(p_query TEXT)
RETURNS TABLE (
  profile_id    UUID,
  display_name  TEXT,
  email         TEXT,
  phone         TEXT,
  avatar_url    TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_query TEXT := trim(coalesce(p_query, ''));
BEGIN
  IF auth.uid() IS NULL OR length(v_query) < 4 THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT p.id, p.display_name, p.email, p.phone, p.avatar_url
    FROM public.profiles p
    WHERE p.is_ghost IS NOT TRUE
      AND (
        lower(p.email) = lower(v_query)
        OR p.phone = v_query
      )
    LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.search_profile_for_manager(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_profile_for_manager(TEXT) FROM anon;
GRANT  EXECUTE ON FUNCTION public.search_profile_for_manager(TEXT) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.search_profile_for_manager(TEXT) TO service_role;

-- ─── 8. cancel_social_event — refresh to use is_event_organizer ───────────
-- Mirror the RLS extension on social_events so managers can also cancel
-- the club's events. Signature + idempotent behaviour matches the
-- original (kept verbatim from cancel_social_event before this migration).

CREATE OR REPLACE FUNCTION public.cancel_social_event(
  p_event_id UUID,
  p_reason   TEXT DEFAULT 'Event cancelled by organizer'::text
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_creator UUID;
  v_status  TEXT;
BEGIN
  SELECT created_by, status INTO v_creator, v_status
  FROM public.social_events
  WHERE id = p_event_id;

  IF v_creator IS NULL THEN
    RAISE EXCEPTION 'event_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Permission: event organizer (creator + club manager + admin).
  IF NOT public.is_event_organizer(p_event_id, auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_status = 'cancelled' THEN
    -- Idempotent — already cancelled, just ensure registrations are too.
    UPDATE public.event_registrations
    SET status           = 'cancelled',
        cancelled_at     = COALESCE(cancelled_at, now()),
        cancelled_reason = COALESCE(cancelled_reason, p_reason)
    WHERE event_id = p_event_id
      AND cancelled_at IS NULL;
    RETURN;
  END IF;

  UPDATE public.social_events
  SET status = 'cancelled'
  WHERE id = p_event_id;

  UPDATE public.event_registrations
  SET status           = 'cancelled',
      cancelled_at     = now(),
      cancelled_reason = p_reason
  WHERE event_id = p_event_id
    AND cancelled_at IS NULL;
END;
$$;
