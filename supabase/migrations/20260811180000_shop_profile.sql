-- ============================================================================
-- Shop marketplace — P2a step 3: seller shop profile
-- ----------------------------------------------------------------------------
-- The seller-facing shop record: what it is called, where it operates, how a
-- buyer will eventually be able to reach it, and what it says about shipping
-- and returns. Seller-side only — the public shop page and the buyer-facing
-- CTA are P2b (D3).
--
-- Three things this migration is careful about:
--
--   1. Concurrency. shops.version is bumped by a trigger on every write, and
--      shop_profile_update refuses a stale expected version. Two tabs editing
--      the same shop produce a conflict the UI can show, not a silent
--      last-write-wins that eats one person's paragraph.
--
--   2. The slug is a URL, so it never moves on its own. Renaming the shop does
--      NOT re-slug it; changing the slug is a separate, explicit call with its
--      own confirmation, because a slug that has been public is a link
--      somebody already sent to somebody else.
--
--   3. Contact channels are rows, not a text blob (D2). A seller declares a
--      channel, opts it public, and an admin approves it. Editing an approved
--      value drops it back to pending — an approval badge must describe the
--      value that was actually approved.
--
-- NOT here, and deliberately: logo and cover. The P2a.2 media contract is
-- product-scoped, and the honest options were to extend it now with no caller
-- or to build a second, weaker upload path. Neither is worth doing before the
-- upload UI exists, so profile media moves to step 6 alongside it. See
-- docs/proposals/shop-catalog-phase-2a/proposal.md §5.
-- ============================================================================

-- ─── 1. Profile columns ─────────────────────────────────────────────────────

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS primary_category_slug TEXT
    REFERENCES public.product_categories(slug) ON DELETE SET NULL,
  -- Public operating area, e.g. "TP. Hồ Chí Minh". Not an address: the pilot
  -- collects no address, and a home address is not a thing to publish.
  ADD COLUMN IF NOT EXISTS region        TEXT,
  ADD COLUMN IF NOT EXISTS shipping_note TEXT,
  ADD COLUMN IF NOT EXISTS return_note   TEXT,
  -- Optimistic concurrency. Bumped by trigger, never by a client.
  ADD COLUMN IF NOT EXISTS version       INTEGER NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shops_region_len') THEN
    ALTER TABLE public.shops ADD CONSTRAINT shops_region_len
      CHECK (region IS NULL OR char_length(btrim(region)) BETWEEN 2 AND 80);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shops_notes_len') THEN
    ALTER TABLE public.shops ADD CONSTRAINT shops_notes_len
      CHECK (
        (shipping_note IS NULL OR char_length(shipping_note) <= 600)
        AND (return_note IS NULL OR char_length(return_note) <= 600)
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shops_intro_len') THEN
    ALTER TABLE public.shops ADD CONSTRAINT shops_intro_len
      CHECK (intro IS NULL OR char_length(intro) <= 1000);
  END IF;
END $$;

-- version is the client's concurrency token, so nothing but this trigger may
-- move it — including an admin, whose writes must also invalidate open tabs.
CREATE OR REPLACE FUNCTION public.shops_bump_version()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.version := COALESCE(OLD.version, 0) + 1;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS shops_bump_version_trg ON public.shops;
CREATE TRIGGER shops_bump_version_trg
  BEFORE UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.shops_bump_version();

-- The Phase 1 guard predates is_shop_manager and predates these columns.
-- Re-stated here so the pinned list is in one place and the new columns are
-- explicitly editable rather than accidentally so.
CREATE OR REPLACE FUNCTION public.shops_guard_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin() THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  -- Identity, lifecycle and verification are never the seller's to write.
  NEW.state           := OLD.state;
  NEW.owner_user_id   := OLD.owner_user_id;
  NEW.verified_method := OLD.verified_method;
  NEW.verified_at     := OLD.verified_at;
  NEW.created_at      := OLD.created_at;

  -- The slug is a URL. It moves only through shop_slug_update, which asks for
  -- it explicitly; a display-name edit must never quietly change a link
  -- somebody has already shared.
  -- coalesce is load-bearing: current_setting(..., true) returns NULL when the
  -- setting was never set, and NULL <> 'on' is NULL, not true — so without it
  -- this branch never runs and the slug is not pinned at all. Caught by the
  -- test that tried to steal a slug through a plain UPDATE.
  IF coalesce(current_setting('shop.slug_write', true), 'off') <> 'on' THEN
    NEW.slug := OLD.slug;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- P2a.1 narrowed this policy to owner|manager but kept the Phase 1 name, so
-- every reader of pg_policies was told "owner" when the rule said "manager".
-- A policy name is documentation; rename it.
DROP POLICY IF EXISTS "shops_update_owner" ON public.shops;
DROP POLICY IF EXISTS "shops_update_manager" ON public.shops;
CREATE POLICY "shops_update_manager" ON public.shops
  FOR UPDATE TO authenticated
  USING (public.is_shop_manager(id))
  WITH CHECK (public.is_shop_manager(id));

-- ─── 2. Reserved slugs ──────────────────────────────────────────────────────
-- A shop slug will sit under a public path. These are the words that already
-- mean something else on this site, plus the ones that would let a shop
-- impersonate the platform.

CREATE OR REPLACE FUNCTION public.shop_slug_is_reserved(_slug TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(btrim(_slug)) = ANY (ARRAY[
    'account','admin','advertise','api','assets','blog','clubs','creator',
    'dupr','en','feed','forum','giai-dau','live','livestream','login','match',
    'news','notifications','onboarding','privacy','proto','quick-tables',
    'rankings','san','search','seller','shop','social','static','su-kien',
    'terms','thong-bao','tim-ban-choi','tin-nhan','tools','tournaments',
    'videos','vi','thepicklehub','pickle-hub','support','help','settings'
  ])
$$;

GRANT EXECUTE ON FUNCTION public.shop_slug_is_reserved(TEXT) TO authenticated, anon, service_role;

-- ─── 3. Contact channels (D2) ───────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shop_contact_type') THEN
    CREATE TYPE public.shop_contact_type AS ENUM ('zalo', 'messenger', 'phone');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shop_contact_state') THEN
    CREATE TYPE public.shop_contact_state AS ENUM (
      'draft', 'pending_review', 'approved', 'rejected', 'disabled'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.shop_contact_channels (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id          UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  type             public.shop_contact_type NOT NULL,
  -- What the seller typed, kept so the form can show it back to them.
  value_raw        TEXT NOT NULL,
  -- What the system will actually use. Derived server-side; the only value a
  -- public surface is ever allowed to read.
  value_normalized TEXT NOT NULL,
  display_label    TEXT,
  -- Declaring a channel is not publishing it. Both flags must be true, and
  -- the shop must be active, before anything is public.
  is_public        BOOLEAN NOT NULL DEFAULT false,
  state            public.shop_contact_state NOT NULL DEFAULT 'draft',
  review_note      TEXT,
  approved_at      TIMESTAMPTZ,
  approved_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  version          INTEGER NOT NULL DEFAULT 1,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shop_contact_value_len CHECK (
    char_length(btrim(value_raw)) BETWEEN 3 AND 200
    AND char_length(btrim(value_normalized)) BETWEEN 3 AND 200
  ),
  CONSTRAINT shop_contact_label_len CHECK (
    display_label IS NULL OR char_length(display_label) <= 60
  ),
  -- An approval must name who approved it and when, or it is not an approval.
  CONSTRAINT shop_contact_approval_pair CHECK (
    (state = 'approved' AND approved_at IS NOT NULL)
    OR (state <> 'approved' AND approved_at IS NULL AND approved_by IS NULL)
  )
);

-- The same channel twice is a data-entry slip, not a feature.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_shop_contact_value
  ON public.shop_contact_channels (shop_id, type, value_normalized);

CREATE INDEX IF NOT EXISTS idx_shop_contact_public
  ON public.shop_contact_channels (shop_id)
  WHERE is_public AND state = 'approved';

COMMENT ON TABLE public.shop_contact_channels IS
  'D2: seller-declared public contact channels. Public only when is_public AND state=approved AND the shop is active. Never seeded from the account email or phone.';

ALTER TABLE public.shop_contact_channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shop_contact_select_public" ON public.shop_contact_channels;
CREATE POLICY "shop_contact_select_public" ON public.shop_contact_channels
  FOR SELECT
  USING (
    is_public AND state = 'approved'
    AND EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.state = 'active')
  );

DROP POLICY IF EXISTS "shop_contact_select_member" ON public.shop_contact_channels;
CREATE POLICY "shop_contact_select_member" ON public.shop_contact_channels
  FOR SELECT TO authenticated
  USING (public.is_shop_member(shop_id) OR public.is_admin());

DROP POLICY IF EXISTS "shop_contact_write_manager" ON public.shop_contact_channels;
CREATE POLICY "shop_contact_write_manager" ON public.shop_contact_channels
  FOR ALL TO authenticated
  USING (public.is_shop_manager(shop_id))
  WITH CHECK (public.is_shop_manager(shop_id));

DROP POLICY IF EXISTS "shop_contact_admin_write" ON public.shop_contact_channels;
CREATE POLICY "shop_contact_admin_write" ON public.shop_contact_channels
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT                         ON public.shop_contact_channels TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_contact_channels TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_contact_channels TO service_role;

-- Moderation columns are not the seller's, and a changed value cannot keep an
-- approval that was granted to a different value.
CREATE OR REPLACE FUNCTION public.shop_contact_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('shop.privileged_write', true) = 'on' OR public.is_admin() THEN
    IF TG_OP = 'UPDATE' THEN NEW.version := OLD.version + 1; NEW.updated_at := now(); END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Everything a seller creates starts UNAPPROVED, whatever the request body
    -- said. is_public is deliberately NOT pinned: opting a channel public is
    -- the seller's choice to make (D2), and nothing is public without an
    -- approval anyway — the public policy needs is_public AND state=approved
    -- AND an active shop. Forcing it false here bought no safety and cost the
    -- seller a second round-trip.
    NEW.state       := 'draft';
    NEW.review_note := NULL;
    NEW.approved_at := NULL;
    NEW.approved_by := NULL;
    NEW.version     := 1;
    RETURN NEW;
  END IF;

  NEW.review_note := OLD.review_note;
  NEW.approved_by := OLD.approved_by;
  NEW.shop_id     := OLD.shop_id;

  -- Editing the value of an approved channel sends it back for review. An
  -- approved badge has to describe the value that was actually approved.
  IF NEW.value_normalized IS DISTINCT FROM OLD.value_normalized
     OR NEW.type IS DISTINCT FROM OLD.type THEN
    NEW.state       := 'pending_review';
    NEW.approved_at := NULL;
    NEW.approved_by := NULL;
  ELSE
    NEW.state       := OLD.state;
    NEW.approved_at := OLD.approved_at;
  END IF;

  NEW.version    := OLD.version + 1;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS shop_contact_guard_trg ON public.shop_contact_channels;
CREATE TRIGGER shop_contact_guard_trg
  BEFORE INSERT OR UPDATE ON public.shop_contact_channels
  FOR EACH ROW EXECUTE FUNCTION public.shop_contact_guard();

-- ─── 4. Contact normalization ───────────────────────────────────────────────
-- Per type, because "sanitise the input" is not a rule until you say what the
-- input is allowed to be. Anything that is not recognised is rejected — there
-- is no fallback branch that stores whatever it was given.

CREATE OR REPLACE FUNCTION public.shop_contact_normalize(_type TEXT, _value TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  _v      TEXT := btrim(coalesce(_value, ''));
  _digits TEXT;
  _handle TEXT;
BEGIN
  IF _v = '' THEN
    RAISE EXCEPTION 'chưa nhập thông tin liên hệ' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- No scheme games. javascript:, data:, and friends never reach a link.
  IF _v ~* '^\s*(javascript|data|vbscript|file|about|blob)\s*:' THEN
    RAISE EXCEPTION 'liên kết không hợp lệ' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF _type = 'phone' THEN
    _digits := regexp_replace(_v, '[^0-9+]', '', 'g');
    IF _digits ~ '^0[35789][0-9]{8}$' THEN
      RETURN '+84' || substring(_digits from 2);
    ELSIF _digits ~ '^\+84[35789][0-9]{8}$' THEN
      RETURN _digits;
    ELSIF _digits ~ '^84[35789][0-9]{8}$' THEN
      RETURN '+' || _digits;
    END IF;
    RAISE EXCEPTION 'số điện thoại không hợp lệ — nhập dạng 09xxxxxxxx'
      USING ERRCODE = 'invalid_parameter_value';

  ELSIF _type = 'zalo' THEN
    -- Zalo is reachable by phone number or by a zalo.me link.
    IF _v ~* '^(https?://)?(www\.)?zalo\.me/' THEN
      _handle := regexp_replace(_v, '^.*zalo\.me/', '', 'i');
      _handle := split_part(split_part(_handle, '?', 1), '#', 1);
      _handle := btrim(_handle, '/');
      IF _handle ~ '^[A-Za-z0-9._-]{3,60}$' THEN
        RETURN 'https://zalo.me/' || _handle;
      END IF;
      RAISE EXCEPTION 'liên kết Zalo không hợp lệ' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    RETURN 'https://zalo.me/' ||
           regexp_replace(public.shop_contact_normalize('phone', _v), '^\+', '');

  ELSIF _type = 'messenger' THEN
    IF _v ~* '^(https?://)?(www\.)?(m\.me|messenger\.com|facebook\.com)/' THEN
      _handle := regexp_replace(_v, '^.*(m\.me|messenger\.com|facebook\.com)/', '', 'i');
      _handle := split_part(split_part(_handle, '?', 1), '#', 1);
      _handle := btrim(_handle, '/');
    ELSE
      _handle := _v;
    END IF;
    IF _handle ~ '^[A-Za-z0-9.]{5,60}$' THEN
      RETURN 'https://m.me/' || _handle;
    END IF;
    RAISE EXCEPTION 'tên Messenger không hợp lệ — dùng m.me/tênshop'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  RAISE EXCEPTION 'kênh liên hệ không hỗ trợ: %', _type USING ERRCODE = 'invalid_parameter_value';
END $$;

GRANT EXECUTE ON FUNCTION public.shop_contact_normalize(TEXT, TEXT) TO authenticated, service_role;

-- ─── 5. RPCs ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.shop_profile_update(
  _shop_id          UUID,
  _expected_version INTEGER,
  _patch            JSONB
)
RETURNS public.shops
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.shops%ROWTYPE;
BEGIN
  SELECT * INTO _row FROM public.shops WHERE id = _shop_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'shop not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT public.is_shop_manager(_shop_id) THEN
    RAISE EXCEPTION 'not a manager of this shop' USING ERRCODE = 'insufficient_privilege';
  END IF;
  -- The conflict is detected here, not by comparing in the client. A stale tab
  -- is told, rather than quietly winning.
  IF _row.version <> _expected_version THEN
    RAISE EXCEPTION 'hồ sơ đã được cập nhật ở nơi khác (phiên bản % ≠ %)', _row.version, _expected_version
      USING ERRCODE = 'PT409';
  END IF;

  UPDATE public.shops
  SET name                  = coalesce(_patch ->> 'name', name),
      intro                 = CASE WHEN _patch ? 'intro' THEN NULLIF(btrim(_patch ->> 'intro'), '') ELSE intro END,
      city                  = CASE WHEN _patch ? 'city' THEN NULLIF(btrim(_patch ->> 'city'), '') ELSE city END,
      region                = CASE WHEN _patch ? 'region' THEN NULLIF(btrim(_patch ->> 'region'), '') ELSE region END,
      primary_category_slug = CASE WHEN _patch ? 'primary_category_slug'
                                   THEN NULLIF(_patch ->> 'primary_category_slug', '') ELSE primary_category_slug END,
      shipping_note         = CASE WHEN _patch ? 'shipping_note' THEN NULLIF(btrim(_patch ->> 'shipping_note'), '') ELSE shipping_note END,
      return_note           = CASE WHEN _patch ? 'return_note' THEN NULLIF(btrim(_patch ->> 'return_note'), '') ELSE return_note END
  WHERE id = _shop_id AND version = _expected_version
  RETURNING * INTO _row;

  RETURN _row;
END $$;

-- Separate call, on purpose. See the header: a slug that has been public is a
-- link somebody already sent to somebody else.
CREATE OR REPLACE FUNCTION public.shop_slug_update(_shop_id UUID, _slug TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _clean TEXT;
BEGIN
  IF NOT public.is_shop_manager(_shop_id) THEN
    RAISE EXCEPTION 'not a manager of this shop' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Normalised through the same helper the generator uses, so a seller cannot
  -- slip past uniqueness with different case, accents or spacing.
  _clean := public.shop_slug_from_name(coalesce(_slug, ''));
  IF _clean IS NULL OR _clean = '' OR _clean = 'shop' THEN
    RAISE EXCEPTION 'đường dẫn không hợp lệ' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF char_length(_clean) < 3 THEN
    RAISE EXCEPTION 'đường dẫn phải có ít nhất 3 ký tự' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF public.shop_slug_is_reserved(_clean) THEN
    RAISE EXCEPTION 'đường dẫn "%" đã được hệ thống dùng — chọn tên khác', _clean
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF EXISTS (SELECT 1 FROM public.shops WHERE slug = _clean AND id <> _shop_id) THEN
    RAISE EXCEPTION 'đường dẫn "%" đã có shop khác dùng', _clean
      USING ERRCODE = 'unique_violation';
  END IF;

  PERFORM set_config('shop.slug_write', 'on', true);
  UPDATE public.shops SET slug = _clean WHERE id = _shop_id;
  PERFORM set_config('shop.slug_write', 'off', true);

  PERFORM public.log_audit_event(
    'shop_slug_changed'::text, 'admin'::text, 'shop'::text, _shop_id::text,
    'info'::text, jsonb_build_object('slug', _clean), 'user'::text
  );

  RETURN _clean;
END $$;

CREATE OR REPLACE FUNCTION public.shop_contact_upsert(
  _shop_id   UUID,
  _type      TEXT,
  _value     TEXT,
  _label     TEXT DEFAULT NULL,
  _is_public BOOLEAN DEFAULT false,
  _id        UUID DEFAULT NULL
)
RETURNS public.shop_contact_channels
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _norm TEXT;
  _row  public.shop_contact_channels%ROWTYPE;
BEGIN
  IF NOT public.is_shop_manager(_shop_id) THEN
    RAISE EXCEPTION 'not a manager of this shop' USING ERRCODE = 'insufficient_privilege';
  END IF;

  _norm := public.shop_contact_normalize(_type, _value);

  IF _id IS NOT NULL THEN
    UPDATE public.shop_contact_channels
    SET value_raw        = btrim(_value),
        value_normalized = _norm,
        type             = _type::public.shop_contact_type,
        display_label    = NULLIF(btrim(coalesce(_label, '')), ''),
        is_public        = _is_public
    WHERE id = _id AND shop_id = _shop_id
    RETURNING * INTO _row;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'contact channel not found' USING ERRCODE = 'no_data_found';
    END IF;
    RETURN _row;
  END IF;

  -- Re-adding a channel that already exists updates it rather than failing on
  -- the unique index with an error the seller cannot act on.
  INSERT INTO public.shop_contact_channels
    (shop_id, type, value_raw, value_normalized, display_label, is_public)
  VALUES
    (_shop_id, _type::public.shop_contact_type, btrim(_value), _norm,
     NULLIF(btrim(coalesce(_label, '')), ''), _is_public)
  ON CONFLICT (shop_id, type, value_normalized)
  DO UPDATE SET value_raw     = EXCLUDED.value_raw,
                display_label = EXCLUDED.display_label,
                is_public     = EXCLUDED.is_public
  RETURNING * INTO _row;

  RETURN _row;
END $$;

CREATE OR REPLACE FUNCTION public.shop_contact_delete(_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _shop UUID;
BEGIN
  SELECT shop_id INTO _shop FROM public.shop_contact_channels WHERE id = _id;
  IF _shop IS NULL THEN
    RETURN true;   -- already gone
  END IF;
  IF NOT (public.is_shop_manager(_shop) OR public.is_admin()) THEN
    RAISE EXCEPTION 'not a manager of this shop' USING ERRCODE = 'insufficient_privilege';
  END IF;
  DELETE FROM public.shop_contact_channels WHERE id = _id;
  RETURN true;
END $$;

-- The moderation primitive P2b's screen will drive. Built here so the screen
-- cannot invent a different rule later.
CREATE OR REPLACE FUNCTION public.shop_contact_decide(
  _id       UUID,
  _decision TEXT,
  _note     TEXT DEFAULT NULL
)
RETURNS public.shop_contact_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row  public.shop_contact_channels%ROWTYPE;
  _next public.shop_contact_state;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin required' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF _decision NOT IN ('approve', 'reject', 'disable') THEN
    RAISE EXCEPTION 'unknown decision %', _decision USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF _decision <> 'approve' AND coalesce(btrim(_note), '') = '' THEN
    RAISE EXCEPTION 'reject and disable require a note for the seller'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT * INTO _row FROM public.shop_contact_channels WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'contact channel not found' USING ERRCODE = 'no_data_found';
  END IF;

  _next := CASE _decision
             WHEN 'approve' THEN 'approved'
             WHEN 'reject'  THEN 'rejected'
             ELSE 'disabled'
           END::public.shop_contact_state;

  PERFORM set_config('shop.privileged_write', 'on', true);
  UPDATE public.shop_contact_channels
  SET state       = _next,
      review_note = _note,
      approved_at = CASE WHEN _decision = 'approve' THEN now() ELSE NULL END,
      approved_by = CASE WHEN _decision = 'approve' THEN auth.uid() ELSE NULL END
  WHERE id = _id;
  PERFORM set_config('shop.privileged_write', 'off', true);

  PERFORM public.log_audit_event(
    ('shop_contact_' || _decision)::text, 'admin'::text, 'shop'::text, _row.shop_id::text,
    'info'::text, jsonb_build_object('channel_type', _row.type), 'user'::text
  );

  RETURN _next;
END $$;

REVOKE ALL ON FUNCTION public.shop_profile_update(UUID, INTEGER, JSONB)          FROM PUBLIC;
REVOKE ALL ON FUNCTION public.shop_slug_update(UUID, TEXT)                       FROM PUBLIC;
REVOKE ALL ON FUNCTION public.shop_contact_upsert(UUID, TEXT, TEXT, TEXT, BOOLEAN, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.shop_contact_delete(UUID)                          FROM PUBLIC;
REVOKE ALL ON FUNCTION public.shop_contact_decide(UUID, TEXT, TEXT)              FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.shop_profile_update(UUID, INTEGER, JSONB)          TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.shop_slug_update(UUID, TEXT)                       TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.shop_contact_upsert(UUID, TEXT, TEXT, TEXT, BOOLEAN, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.shop_contact_delete(UUID)                          TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.shop_contact_decide(UUID, TEXT, TEXT)              TO authenticated, service_role;
