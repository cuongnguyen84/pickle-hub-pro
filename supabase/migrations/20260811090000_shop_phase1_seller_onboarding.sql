-- ============================================================================
-- Shop marketplace — Phase 1: closed-pilot access + seller onboarding
-- ----------------------------------------------------------------------------
-- Scope is deliberately narrow (see
-- docs/proposals/shop-marketplace/production-implementation-map.md):
--   * closed-pilot allowlist
--   * seller application: draft → submit → admin decision → shop
--   * shops + shop_members (ownership model from plan §6)
--   * append-only application event log
--
-- NOT in this migration, on purpose:
--   * shop_bank_accounts / shop_application_documents — the approved proposal
--     (§2) decided the pilot collects neither CCCD nor bank details. Creating
--     the table is how it starts getting collected.
--   * products / carts / orders / payments — Phase 2 and 3.
--
-- Ownership: `seller` is NOT added to public.app_role. Marketplace access is
-- explicit rows in shop_members (plan §6 "Ownership model").
--
-- Deny by default. Every table gets policies AND a GRANT block — a policy on a
-- table with no grant is a 42501 that reads like a bug, and a grant with no
-- policy is the repo's most-repeated defect.
--
-- IDEMPOTENT — replay-safe.
-- NOT APPLIED TO PRODUCTION. Local / preview validation only.
-- ============================================================================

-- ─── 1. Enums ───────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shop_application_status') THEN
    CREATE TYPE public.shop_application_status AS ENUM (
      'draft', 'submitted', 'under_review', 'needs_changes',
      'approved', 'rejected', 'withdrawn'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shop_state') THEN
    CREATE TYPE public.shop_state AS ENUM (
      'pending_activation', 'active', 'restricted', 'suspended', 'closed'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shop_member_role') THEN
    CREATE TYPE public.shop_member_role AS ENUM (
      'owner', 'manager', 'fulfillment', 'support'
    );
  END IF;
END $$;

-- ─── 2. Closed-pilot allowlist ──────────────────────────────────────────────
-- A client feature flag is not access control. Everything below keys off this
-- table, so a user who is not on it does not merely see a hidden UI — the rows
-- do not exist for them.

CREATE TABLE IF NOT EXISTS public.shop_pilot_members (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  note       TEXT
);

COMMENT ON TABLE public.shop_pilot_members IS
  'Closed-pilot allowlist for the Shop marketplace. Admin-managed; no self-serve join. See migration 20260811090000.';

ALTER TABLE public.shop_pilot_members ENABLE ROW LEVEL SECURITY;

-- STABLE so the planner can inline it inside policies.
CREATE OR REPLACE FUNCTION public.shop_pilot_has_access()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM public.shop_pilot_members WHERE user_id = auth.uid())
  )
$$;

DROP POLICY IF EXISTS "shop_pilot_members_select_self" ON public.shop_pilot_members;
CREATE POLICY "shop_pilot_members_select_self" ON public.shop_pilot_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- Writes are admin-only. No INSERT policy for the applicant: joining the pilot
-- is not a thing a user may do to themselves.
DROP POLICY IF EXISTS "shop_pilot_members_admin_write" ON public.shop_pilot_members;
CREATE POLICY "shop_pilot_members_admin_write" ON public.shop_pilot_members
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT                         ON public.shop_pilot_members TO authenticated;
GRANT INSERT, UPDATE, DELETE         ON public.shop_pilot_members TO authenticated;

REVOKE ALL ON FUNCTION public.shop_pilot_has_access() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.shop_pilot_has_access() TO authenticated;
GRANT  EXECUTE ON FUNCTION public.shop_pilot_has_access() TO service_role;

-- ─── 3. Shops ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.shops (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  state           public.shop_state NOT NULL DEFAULT 'pending_activation',
  owner_user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  city            TEXT,
  intro           TEXT,
  -- How we know who this seller is, and when. NOT a quality guarantee — the
  -- buyer-facing copy says so explicitly.
  verified_method TEXT,
  verified_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shops_name_len CHECK (char_length(name) BETWEEN 3 AND 120),
  CONSTRAINT shops_verified_method_check CHECK (
    verified_method IS NULL OR verified_method IN ('giay-phep-kinh-doanh', 'gap-truc-tiep')
  ),
  -- A verification claim without a date is unprovable; refuse the half-state.
  CONSTRAINT shops_verified_pair CHECK (
    (verified_method IS NULL AND verified_at IS NULL)
    OR (verified_method IS NOT NULL AND verified_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_shops_owner ON public.shops (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_shops_active ON public.shops (state) WHERE state = 'active';

COMMENT ON TABLE public.shops IS
  'Marketplace shop. Only state=''active'' rows are publicly readable. See migration 20260811090000.';

ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.shop_members (
  shop_id    UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       public.shop_member_role NOT NULL DEFAULT 'owner',
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (shop_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_shop_members_user ON public.shop_members (user_id);

ALTER TABLE public.shop_members ENABLE ROW LEVEL SECURITY;

-- Membership predicate used by every seller-scoped policy from Phase 2 on.
-- SECURITY DEFINER so a policy on shop_members can call it without recursing
-- through its own RLS.
CREATE OR REPLACE FUNCTION public.is_shop_member(_shop_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shop_members
    WHERE shop_id = _shop_id AND user_id = auth.uid()
  )
$$;

REVOKE ALL ON FUNCTION public.is_shop_member(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_shop_member(UUID) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.is_shop_member(UUID) TO service_role;

-- Public reads see ACTIVE shops only. pending_activation / suspended / closed
-- are invisible to anon and to every non-member.
DROP POLICY IF EXISTS "shops_select_public_active" ON public.shops;
CREATE POLICY "shops_select_public_active" ON public.shops
  FOR SELECT
  USING (state = 'active');

DROP POLICY IF EXISTS "shops_select_member" ON public.shops;
CREATE POLICY "shops_select_member" ON public.shops
  FOR SELECT TO authenticated
  USING (public.is_shop_member(id) OR public.is_admin());

-- No INSERT policy at all: shops are created by shop_application_decide().
DROP POLICY IF EXISTS "shops_update_admin" ON public.shops;
CREATE POLICY "shops_update_admin" ON public.shops
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Owners may edit their own presentation fields. state / owner_user_id /
-- verified_* are protected by a trigger below, not by hope.
DROP POLICY IF EXISTS "shops_update_owner" ON public.shops;
CREATE POLICY "shops_update_owner" ON public.shops
  FOR UPDATE TO authenticated
  USING (public.is_shop_member(id))
  WITH CHECK (public.is_shop_member(id));

CREATE OR REPLACE FUNCTION public.shops_guard_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- An admin (already AAL2-gated by is_admin) may change anything.
  IF public.is_admin() THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  -- Everyone else: privileged columns are immutable regardless of what the
  -- client sent. This is what stops a member PATCHing state='active'.
  NEW.state           := OLD.state;
  NEW.owner_user_id   := OLD.owner_user_id;
  NEW.slug            := OLD.slug;
  NEW.verified_method := OLD.verified_method;
  NEW.verified_at     := OLD.verified_at;
  NEW.created_at      := OLD.created_at;
  NEW.updated_at      := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS shops_guard_privileged_columns_trg ON public.shops;
CREATE TRIGGER shops_guard_privileged_columns_trg
  BEFORE UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.shops_guard_privileged_columns();

DROP POLICY IF EXISTS "shop_members_select_own_shop" ON public.shop_members;
CREATE POLICY "shop_members_select_own_shop" ON public.shop_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_shop_member(shop_id) OR public.is_admin());

-- No INSERT/UPDATE/DELETE policy for members in Phase 1: staff management
-- arrives in Phase 2 behind an RPC. Admin writes go through the decide RPC,
-- which is SECURITY DEFINER and bypasses RLS by design.
DROP POLICY IF EXISTS "shop_members_admin_write" ON public.shop_members;
CREATE POLICY "shop_members_admin_write" ON public.shop_members
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT                 ON public.shops        TO anon;
GRANT SELECT, UPDATE         ON public.shops        TO authenticated;
GRANT SELECT                 ON public.shop_members TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.shop_members TO authenticated;

-- ─── 4. Applications ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.shop_applications (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status             public.shop_application_status NOT NULL DEFAULT 'draft',
  seller_type        TEXT,
  full_name          TEXT,
  phone              TEXT,
  shop_name          TEXT,
  shop_intro         TEXT,
  pickup_address     TEXT,
  city               TEXT,
  -- Written by the moderator, shown to the applicant verbatim.
  applicant_note     TEXT,
  -- Written by the moderator, NEVER exposed to the applicant. The read policy
  -- below cannot hide a column, so the applicant-facing read goes through a
  -- view (see §5) and this column is only selectable by admins.
  internal_note      TEXT,
  -- Which step/field the moderator asked to be fixed, so the applicant gets a
  -- deep link instead of "sửa lại hồ sơ".
  requested_fields   TEXT[] NOT NULL DEFAULT '{}',
  submitted_at       TIMESTAMPTZ,
  decided_at         TIMESTAMPTZ,
  decided_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  shop_id            UUID REFERENCES public.shops(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shop_applications_seller_type_check CHECK (
    seller_type IS NULL OR seller_type IN ('ca-nhan', 'ho-kinh-doanh', 'cong-ty')
  ),
  CONSTRAINT shop_applications_phone_check CHECK (
    phone IS NULL OR phone ~ '^0[0-9]{9}$'
  )
);

-- One live application per user. Terminal rows (approved/rejected/withdrawn)
-- are excluded so a rejected applicant can apply again.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_shop_applications_open_per_user
  ON public.shop_applications (applicant_user_id)
  WHERE status IN ('draft', 'submitted', 'under_review', 'needs_changes');

CREATE INDEX IF NOT EXISTS idx_shop_applications_queue
  ON public.shop_applications (status, submitted_at DESC NULLS LAST);

COMMENT ON COLUMN public.shop_applications.internal_note IS
  'Moderator-only. Never selected by the applicant-facing view. See migration 20260811090000.';

ALTER TABLE public.shop_applications ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.shop_application_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID NOT NULL REFERENCES public.shop_applications(id) ON DELETE CASCADE,
  actor_user_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_kind      TEXT NOT NULL,
  event           TEXT NOT NULL,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shop_application_events_actor_kind_check CHECK (actor_kind IN ('applicant', 'admin', 'system')),
  CONSTRAINT shop_application_events_event_check CHECK (
    event IN ('created', 'submitted', 'withdrawn', 'requested_changes', 'approved', 'rejected', 'resubmitted')
  )
);

CREATE INDEX IF NOT EXISTS idx_shop_application_events_app
  ON public.shop_application_events (application_id, created_at);

ALTER TABLE public.shop_application_events ENABLE ROW LEVEL SECURITY;

-- Applicant reads own row. Admin reads all. Anon reads nothing.
DROP POLICY IF EXISTS "shop_applications_select_own" ON public.shop_applications;
CREATE POLICY "shop_applications_select_own" ON public.shop_applications
  FOR SELECT TO authenticated
  USING (applicant_user_id = auth.uid() OR public.is_admin());

-- The applicant creates their own draft and edits it only while it is still
-- editable. status is pinned to 'draft' on INSERT and guarded on UPDATE by the
-- trigger below — the WITH CHECK alone cannot stop a status change because the
-- row would still satisfy the ownership predicate.
DROP POLICY IF EXISTS "shop_applications_insert_own_draft" ON public.shop_applications;
CREATE POLICY "shop_applications_insert_own_draft" ON public.shop_applications
  FOR INSERT TO authenticated
  WITH CHECK (
    applicant_user_id = auth.uid()
    AND status = 'draft'
    AND public.shop_pilot_has_access()
  );

DROP POLICY IF EXISTS "shop_applications_update_own_editable" ON public.shop_applications;
CREATE POLICY "shop_applications_update_own_editable" ON public.shop_applications
  FOR UPDATE TO authenticated
  USING (applicant_user_id = auth.uid() AND status IN ('draft', 'needs_changes'))
  WITH CHECK (applicant_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.shop_applications_guard_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- The decide/submit RPCs run as SECURITY DEFINER and set this flag, which is
  -- the only sanctioned way to move status or write moderator fields.
  IF current_setting('shop.privileged_write', true) = 'on' THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  NEW.status            := OLD.status;
  NEW.applicant_user_id := OLD.applicant_user_id;
  NEW.internal_note     := OLD.internal_note;
  NEW.applicant_note    := OLD.applicant_note;
  NEW.requested_fields  := OLD.requested_fields;
  NEW.submitted_at      := OLD.submitted_at;
  NEW.decided_at        := OLD.decided_at;
  NEW.decided_by        := OLD.decided_by;
  NEW.shop_id           := OLD.shop_id;
  NEW.created_at        := OLD.created_at;
  NEW.updated_at        := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS shop_applications_guard_trg ON public.shop_applications;
CREATE TRIGGER shop_applications_guard_trg
  BEFORE UPDATE ON public.shop_applications
  FOR EACH ROW EXECUTE FUNCTION public.shop_applications_guard_privileged_columns();

DROP POLICY IF EXISTS "shop_application_events_select_own" ON public.shop_application_events;
CREATE POLICY "shop_application_events_select_own" ON public.shop_application_events
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.shop_applications a
      WHERE a.id = application_id AND a.applicant_user_id = auth.uid()
    )
  );

-- No INSERT policy for anyone. Events are written by SECURITY DEFINER RPCs
-- only — an append-only log an actor can append to is not a log.

GRANT SELECT, INSERT, UPDATE ON public.shop_applications       TO authenticated;
GRANT SELECT                 ON public.shop_application_events TO authenticated;

-- ─── 5. Applicant-facing view (hides internal_note) ─────────────────────────
-- RLS cannot hide a column. The applicant reads through this view; the base
-- table's SELECT policy still allows the row, so the view is the boundary that
-- keeps moderator notes internal.

CREATE OR REPLACE VIEW public.my_shop_application
WITH (security_invoker = true) AS
  SELECT
    id, applicant_user_id, status, seller_type, full_name, phone,
    shop_name, shop_intro, pickup_address, city,
    applicant_note, requested_fields,
    submitted_at, decided_at, shop_id, created_at, updated_at
  FROM public.shop_applications
  WHERE applicant_user_id = auth.uid();

GRANT SELECT ON public.my_shop_application TO authenticated;

-- ─── 6. State-transition RPCs ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.shop_application_submit()
RETURNS public.shop_application_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row   public.shop_applications%ROWTYPE;
  _was   public.shop_application_status;
BEGIN
  IF NOT public.shop_pilot_has_access() THEN
    RAISE EXCEPTION 'shop_pilot_access_required' USING ERRCODE = '42501';
  END IF;

  -- FOR UPDATE: two taps on "Gửi hồ sơ" must not produce two submissions.
  SELECT * INTO _row
  FROM public.shop_applications
  WHERE applicant_user_id = auth.uid()
    AND status IN ('draft', 'needs_changes')
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Idempotent: already submitted is a no-op, not an error, so a retry after
    -- a dropped response does not look like a failure to the user.
    SELECT status INTO _was
    FROM public.shop_applications
    WHERE applicant_user_id = auth.uid()
      AND status IN ('submitted', 'under_review')
    LIMIT 1;
    IF FOUND THEN RETURN _was; END IF;
    RAISE EXCEPTION 'no_editable_application' USING ERRCODE = 'P0002';
  END IF;

  -- Server-side validation. The client form validates too, for the message —
  -- but the client is not the authority on whether a row may move.
  IF coalesce(_row.seller_type, '') = '' THEN
    RAISE EXCEPTION 'missing_seller_type' USING ERRCODE = '23514';
  END IF;
  IF char_length(coalesce(_row.full_name, '')) < 2 THEN
    RAISE EXCEPTION 'missing_full_name' USING ERRCODE = '23514';
  END IF;
  IF coalesce(_row.phone, '') !~ '^0[0-9]{9}$' THEN
    RAISE EXCEPTION 'invalid_phone' USING ERRCODE = '23514';
  END IF;
  IF char_length(coalesce(_row.shop_name, '')) < 3 THEN
    RAISE EXCEPTION 'missing_shop_name' USING ERRCODE = '23514';
  END IF;
  IF char_length(coalesce(_row.city, '')) < 2 THEN
    RAISE EXCEPTION 'missing_city' USING ERRCODE = '23514';
  END IF;

  _was := _row.status;

  PERFORM set_config('shop.privileged_write', 'on', true);
  UPDATE public.shop_applications
  SET status = 'submitted',
      submitted_at = now(),
      requested_fields = '{}'
  WHERE id = _row.id;
  PERFORM set_config('shop.privileged_write', 'off', true);

  INSERT INTO public.shop_application_events (application_id, actor_user_id, actor_kind, event)
  VALUES (_row.id, auth.uid(), 'applicant',
          CASE WHEN _was = 'needs_changes' THEN 'resubmitted' ELSE 'submitted' END);

  RETURN 'submitted';
END $$;

CREATE OR REPLACE FUNCTION public.shop_application_withdraw()
RETURNS public.shop_application_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id UUID;
BEGIN
  SELECT id INTO _id
  FROM public.shop_applications
  WHERE applicant_user_id = auth.uid()
    AND status IN ('draft', 'submitted', 'under_review', 'needs_changes')
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_open_application' USING ERRCODE = 'P0002';
  END IF;

  PERFORM set_config('shop.privileged_write', 'on', true);
  UPDATE public.shop_applications SET status = 'withdrawn' WHERE id = _id;
  PERFORM set_config('shop.privileged_write', 'off', true);

  INSERT INTO public.shop_application_events (application_id, actor_user_id, actor_kind, event)
  VALUES (_id, auth.uid(), 'applicant', 'withdrawn');

  RETURN 'withdrawn';
END $$;

-- Slug generation. Deterministic base + numeric suffix on collision; the
-- unique index is the real guarantee, this just avoids the common case.
CREATE OR REPLACE FUNCTION public.shop_slug_from_name(_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  _base TEXT;
BEGIN
  _base := lower(unaccent_immutable(_name));
  _base := regexp_replace(_base, '[^a-z0-9]+', '-', 'g');
  _base := trim(both '-' from _base);
  IF _base = '' THEN _base := 'shop'; END IF;
  RETURN left(_base, 60);
END $$;

-- Vietnamese → ASCII for slugs.
--
-- The first version used one translate() call with a hand-typed 134-char
-- `from` string and a 140-char `to` string. translate() maps BY POSITION, so a
-- single surplus character shifted everything after it: "Đồ Pickleball Sài Gòn"
-- became "uo-pickleball-sai-gin". Every shop and product URL in a 95%-Vietnamese
-- product would have been wrong, permanently — and the pgTAP suite stayed green
-- because its fixture name is ASCII ("Shop Cua A").
--
-- Rewritten as one regexp_replace per target letter. There is no positional
-- coupling left to get wrong: a typo inside a character class can only fail to
-- match its own letter, never corrupt a different one.
CREATE OR REPLACE FUNCTION public.unaccent_immutable(_s TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT regexp_replace(
           regexp_replace(
             regexp_replace(
               regexp_replace(
                 regexp_replace(
                   regexp_replace(
                     regexp_replace(_s, '[àáảãạăằắẳẵặâầấẩẫậÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬ]', 'a', 'g'),
                     '[èéẻẽẹêềếểễệÈÉẺẼẸÊỀẾỂỄỆ]', 'e', 'g'),
                   '[ìíỉĩịÌÍỈĨỊ]', 'i', 'g'),
                 '[òóỏõọôồốổỗộơờớởỡợÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢ]', 'o', 'g'),
               '[ùúủũụưừứửữựÙÚỦŨỤƯỪỨỬỮỰ]', 'u', 'g'),
             '[ỳýỷỹỵỲÝỶỸỴ]', 'y', 'g'),
           '[đĐ]', 'd', 'g')
$$;

CREATE OR REPLACE FUNCTION public.shop_slug_from_name(_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  _base TEXT;
BEGIN
  -- lower() AFTER stripping diacritics: the uppercase forms are handled inside
  -- unaccent_immutable, so this is only for plain ASCII.
  _base := lower(public.unaccent_immutable(_name));
  _base := regexp_replace(_base, '[^a-z0-9]+', '-', 'g');
  _base := trim(both '-' from _base);
  IF _base = '' THEN _base := 'shop'; END IF;
  RETURN left(_base, 60);
END $$;

CREATE OR REPLACE FUNCTION public.shop_application_decide(
  _application_id    UUID,
  _decision          TEXT,
  _applicant_note    TEXT DEFAULT NULL,
  _internal_note     TEXT DEFAULT NULL,
  _requested_fields  TEXT[] DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row      public.shop_applications%ROWTYPE;
  _shop_id  UUID;
  _slug     TEXT;
  _suffix   INT := 0;
BEGIN
  -- is_admin() already requires AAL2 (migration 20260730090000).
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;

  IF _decision NOT IN ('request-changes', 'approve', 'reject') THEN
    RAISE EXCEPTION 'invalid_decision' USING ERRCODE = '22023';
  END IF;

  -- Locking here is what makes two moderators deciding at once safe: the
  -- second call sees the already-decided row and returns its shop, instead of
  -- creating a second shop.
  SELECT * INTO _row FROM public.shop_applications
  WHERE id = _application_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'application_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF _row.status IN ('approved', 'rejected', 'withdrawn') THEN
    -- Idempotent replay of the same decision.
    RETURN _row.shop_id;
  END IF;

  IF _row.status NOT IN ('submitted', 'under_review', 'needs_changes') THEN
    RAISE EXCEPTION 'application_not_decidable' USING ERRCODE = '22023';
  END IF;

  IF _decision IN ('request-changes', 'reject')
     AND char_length(coalesce(_applicant_note, '')) < 10 THEN
    RAISE EXCEPTION 'applicant_note_required' USING ERRCODE = '23514';
  END IF;

  IF _decision = 'request-changes' AND coalesce(array_length(_requested_fields, 1), 0) = 0 THEN
    RAISE EXCEPTION 'requested_fields_required' USING ERRCODE = '23514';
  END IF;

  PERFORM set_config('shop.privileged_write', 'on', true);

  IF _decision = 'approve' THEN
    _slug := public.shop_slug_from_name(_row.shop_name);
    WHILE EXISTS (SELECT 1 FROM public.shops WHERE slug = _slug) LOOP
      _suffix := _suffix + 1;
      _slug := left(public.shop_slug_from_name(_row.shop_name), 55) || '-' || _suffix::text;
    END LOOP;

    INSERT INTO public.shops (slug, name, state, owner_user_id, city, intro)
    VALUES (_slug, _row.shop_name, 'pending_activation', _row.applicant_user_id, _row.city, _row.shop_intro)
    RETURNING id INTO _shop_id;

    INSERT INTO public.shop_members (shop_id, user_id, role)
    VALUES (_shop_id, _row.applicant_user_id, 'owner')
    ON CONFLICT DO NOTHING;

    UPDATE public.shop_applications
    SET status = 'approved', decided_at = now(), decided_by = auth.uid(),
        shop_id = _shop_id, applicant_note = _applicant_note,
        internal_note = _internal_note, requested_fields = '{}'
    WHERE id = _row.id;
  ELSIF _decision = 'reject' THEN
    UPDATE public.shop_applications
    SET status = 'rejected', decided_at = now(), decided_by = auth.uid(),
        applicant_note = _applicant_note, internal_note = _internal_note,
        requested_fields = '{}'
    WHERE id = _row.id;
  ELSE
    UPDATE public.shop_applications
    SET status = 'needs_changes', applicant_note = _applicant_note,
        internal_note = _internal_note, requested_fields = _requested_fields
    WHERE id = _row.id;
  END IF;

  PERFORM set_config('shop.privileged_write', 'off', true);

  INSERT INTO public.shop_application_events (application_id, actor_user_id, actor_kind, event, note)
  VALUES (
    _row.id, auth.uid(), 'admin',
    CASE _decision
      WHEN 'approve' THEN 'approved'
      WHEN 'reject' THEN 'rejected'
      ELSE 'requested_changes'
    END,
    -- Only the applicant-visible note is echoed into the event log; the
    -- internal note stays on the application row, admin-readable only.
    _applicant_note
  );

  -- Explicit casts are load-bearing: public.log_audit_event has TWO overloads
  -- (…text,jsonb,text) and (…text,jsonb,jsonb,jsonb) from migrations
  -- 20260301120755 and 20260302020338. Passing untyped literals makes the call
  -- ambiguous — 42725 "function is not unique" — which broke EVERY approve,
  -- reject and request-changes at runtime. Static checks cannot see this; only
  -- running the pgTAP suite against a real database did.
  PERFORM public.log_audit_event(
    ('shop_application_' || replace(_decision, '-', '_'))::text,
    'admin'::text,
    'shop_application'::text,
    _row.id::text,
    (CASE WHEN _decision = 'reject' THEN 'warning' ELSE 'info' END)::text,
    jsonb_build_object('shop_id', _shop_id, 'requested_fields', _requested_fields),
    'user'::text
  );

  RETURN _shop_id;
END $$;

REVOKE ALL ON FUNCTION public.shop_application_submit()   FROM PUBLIC;
REVOKE ALL ON FUNCTION public.shop_application_withdraw() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.shop_application_decide(UUID, TEXT, TEXT, TEXT, TEXT[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.shop_slug_from_name(TEXT)   FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unaccent_immutable(TEXT)    FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.shop_application_submit()   TO authenticated;
GRANT EXECUTE ON FUNCTION public.shop_application_withdraw() TO authenticated;
GRANT EXECUTE ON FUNCTION public.shop_application_decide(UUID, TEXT, TEXT, TEXT, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shop_slug_from_name(TEXT)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.unaccent_immutable(TEXT)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.shop_application_submit()   TO service_role;
GRANT EXECUTE ON FUNCTION public.shop_application_withdraw() TO service_role;
GRANT EXECUTE ON FUNCTION public.shop_application_decide(UUID, TEXT, TEXT, TEXT, TEXT[]) TO service_role;

-- ─── 7. Audit categories ────────────────────────────────────────────────────
-- Widen the existing CHECK rather than inventing a second audit table.

ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_resource_type_check;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_resource_type_check
  CHECK (resource_type IS NULL OR resource_type IN (
    'livestream', 'video', 'tournament', 'organization', 'user', 'api_key',
    'forum_post', 'quick_table', 'doubles_elimination', 'flex_tournament', 'team_match',
    'match', 'game', 'player',
    'shop_application', 'shop', 'shop_product'
  ));
