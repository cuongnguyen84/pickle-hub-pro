-- ============================================================================
-- Shop marketplace — P2a step 7: canonical projection, preflight, submit
-- ----------------------------------------------------------------------------
-- The last piece of P2a, and the one that decides whether the six before it
-- were built on a shared truth or on six approximations of one.
--
-- ── One projection, two readers ─────────────────────────────────────────────
-- product_public_projection() is the ONLY definition of "what a product looks
-- like to somebody looking at it". The seller preview reads it today; the
-- public PDP reads it in P2b. Not a preview that renders the form state and
-- hopes it matches — that is a preview of something no buyer will ever see,
-- and the day it drifts nobody finds out until a buyer does.
--
-- The only difference between the two readers is AUTHORISATION, expressed as
-- the `_as_seller` flag: a member of the shop may project a draft of their own
-- product; everyone else gets exactly what the public rules already allow
-- (approved AND published AND an active shop). Same SQL, same derivation, same
-- field list. P2b adds no second function; it passes false.
--
-- The allowlist is written out, field by field, rather than `SELECT *` with
-- things removed. A removal list forgets the column somebody adds next month;
-- an allowlist cannot leak a column nobody wrote down. internal_note,
-- client_token, variants_token, draft paths, cleanup jobs and the inventory
-- ledger are absent by construction.
--
-- Media: the projection returns the RENDITION path, never the original, and
-- never a signed URL. Minting and expiring URLs is the caller's job, and a
-- URL that lived in a database row would outlive the permission that made it.
--
-- ── Preflight as data, not as an exception ──────────────────────────────────
-- product_submit_preflight() returns a LIST of structured problems: code,
-- section, field, and the variant or media it is about. The old
-- product_submit_for_review raised on the first thing it found, so a seller
-- with three problems learned about them one submit at a time.
--
-- The list is also what the checklist renders before the seller presses
-- anything, and what the deep-link targets are built from — one rule, three
-- consumers, no chance of the checklist and the submit disagreeing.
--
-- ── Submit is a transaction, an audit row and a token ───────────────────────
-- product_submit() runs the preflight inside the same transaction that moves
-- the status, under a row lock, against an expected version. A retry with the
-- same client token returns the first answer rather than writing a second
-- audit event. Everything is idempotent: a replay is safe.
-- ============================================================================

-- ─── 1. Submission audit ────────────────────────────────────────────────────
-- Append-only, and separate from log_audit_event: that table is the admin
-- console's, and a seller must be able to read their own submission history
-- without being handed the platform's audit log.

CREATE TABLE IF NOT EXISTS public.product_submission_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  shop_id      UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  event        TEXT NOT NULL,
  from_status  public.product_status,
  to_status    public.product_status,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  client_token TEXT,
  -- Deliberately small: a shop id, a version, a count. Never a signed URL,
  -- never a storage path, never the product's content.
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT product_submission_event_kind CHECK (
    event IN ('submitted', 'resubmitted', 'withdrawn')
  )
);

-- Idempotency lives in the index, not in the RPC remembering to look.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_product_submission_token
  ON public.product_submission_events (product_id, client_token)
  WHERE client_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_product_submission_product
  ON public.product_submission_events (product_id, created_at DESC);

ALTER TABLE public.product_submission_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_submission_events_select_member" ON public.product_submission_events;
CREATE POLICY "product_submission_events_select_member" ON public.product_submission_events
  FOR SELECT TO authenticated
  USING (public.is_shop_member(shop_id) OR public.is_admin());

-- No write policy for anyone: rows appear only through the submit RPC.
GRANT SELECT ON public.product_submission_events TO authenticated;
GRANT SELECT, INSERT ON public.product_submission_events TO service_role;

CREATE OR REPLACE FUNCTION public.product_submission_events_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'lịch sử gửi duyệt chỉ ghi thêm, không sửa' USING ERRCODE = 'insufficient_privilege';
  END IF;
  -- Same shape as the inventory ledger: a DELETE is allowed only when the
  -- product it is a history OF has already gone, which inside a cascade it has.
  -- A blanket refusal would make the product undeletable.
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = OLD.product_id)
     OR NOT EXISTS (SELECT 1 FROM public.shops WHERE id = OLD.shop_id) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'lịch sử gửi duyệt chỉ ghi thêm, không xoá' USING ERRCODE = 'insufficient_privilege';
END $$;

DROP TRIGGER IF EXISTS product_submission_events_append_only_trg ON public.product_submission_events;
CREATE TRIGGER product_submission_events_append_only_trg
  BEFORE UPDATE OR DELETE ON public.product_submission_events
  FOR EACH ROW EXECUTE FUNCTION public.product_submission_events_append_only();

-- ─── 2. Deep-link sections ──────────────────────────────────────────────────
-- Stable identifiers a moderator's "please fix this" can point at, and the
-- seller editor can open. Named, never a DOM index: an index is a position in
-- a list that changes the moment somebody reorders it.

CREATE OR REPLACE FUNCTION public.product_edit_sections()
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY[
    'basics',      -- name, condition
    'category',
    'description',
    'variants',    -- the option structure and the matrix as a whole
    'price',
    'stock',
    'sku',
    'media',       -- the photo set
    'variant_media',
    'shipping'     -- shop-level shipping and return notes
  ]
$$;

GRANT EXECUTE ON FUNCTION public.product_edit_sections() TO authenticated, anon, service_role;

-- ─── 3. The canonical projection ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.product_public_projection(
  _product_id UUID,
  _as_seller  BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _p    public.products%ROWTYPE;
  _shop public.shops%ROWTYPE;
  _out  JSONB;
BEGIN
  SELECT * INTO _p FROM public.products WHERE id = _product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found' USING ERRCODE = 'no_data_found';
  END IF;
  SELECT * INTO _shop FROM public.shops WHERE id = _p.shop_id;

  -- The ONE authorisation difference between a seller preview and a public
  -- read. Everything below is identical for both.
  IF _as_seller THEN
    IF NOT (public.is_shop_member(_p.shop_id) OR public.is_admin()) THEN
      RAISE EXCEPTION 'not a member of this shop' USING ERRCODE = 'insufficient_privilege';
    END IF;
  ELSIF NOT (_p.status = 'approved' AND _p.is_published AND _shop.state = 'active') THEN
    RAISE EXCEPTION 'product not found' USING ERRCODE = 'no_data_found';
  END IF;

  SELECT jsonb_build_object(
    'id',            _p.id,
    'slug',          _p.slug,
    'title',         _p.title,
    'description',   _p.description,
    'condition',     _p.condition,
    'category', (
      SELECT jsonb_build_object('slug', c.slug, 'name', c.name_vi)
      FROM public.product_categories c WHERE c.slug = _p.category_slug
    ),
    -- The shop as a buyer may see it. owner_user_id, city, contact rows and
    -- the application are not here, and cannot be: this is an allowlist.
    'shop', jsonb_build_object(
      'slug',   _shop.slug,
      'name',   _shop.name,
      'region', _shop.region,
      -- A fact about a check somebody did, phrased as such. Never a quality
      -- claim, and never the method's raw enum.
      'verified', _shop.verified_at IS NOT NULL,
      'shipping_note', _shop.shipping_note,
      'return_note',   _shop.return_note
    ),
    'option_groups', _p.option_groups,
    'variants', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id',            v.id,
               'option_values', v.option_values,
               'option_key',    v.option_key,
               'sku',           v.sku,
               'price_vnd',     v.price_vnd,
               -- The label, derived here so the buyer surface and the preview
               -- cannot disagree about what "còn hàng" means. on_hand is the
               -- only number there is until Phase 3 reserves any of it.
               'availability',  CASE
                                  WHEN v.stock_on_hand IS NULL THEN 'unknown'
                                  WHEN v.stock_on_hand <= 0    THEN 'out_of_stock'
                                  ELSE 'in_stock'
                                END,
               'stock_on_hand', CASE WHEN _as_seller THEN to_jsonb(v.stock_on_hand) ELSE 'null'::jsonb END,
               'media_id',      v.media_id
             ) ORDER BY v.position, v.created_at)
      FROM public.product_variants v
      WHERE v.product_id = _p.id AND v.retired_at IS NULL
    ), '[]'::jsonb),
    'media', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id',       m.id,
               'alt_text', m.alt_text,
               'position', m.position,
               -- The RENDITION, never the original, and never a signed URL.
               -- Minting one is the caller's job and it must not outlive the
               -- permission that produced it.
               'path',     m.rendition_source_path,
               'public_path', m.public_path,
               'width',    m.width,
               'height',   m.height
             ) ORDER BY m.position, m.created_at)
      FROM public.product_media m
      WHERE m.product_id = _p.id AND m.verified_at IS NOT NULL
    ), '[]'::jsonb),
    'primary_media_id', (
      SELECT m.id FROM public.product_media m
      WHERE m.product_id = _p.id AND m.verified_at IS NOT NULL
      ORDER BY m.position, m.created_at LIMIT 1
    ),
    'in_stock',                _p.in_stock,
    'availability_updated_at', _p.availability_updated_at,
    -- Moderation state is a seller-only field: a buyer has no business knowing
    -- a product was once rejected.
    'status',       CASE WHEN _as_seller THEN to_jsonb(_p.status) ELSE 'null'::jsonb END,
    'is_published', _p.is_published,
    'shop_state',   CASE WHEN _as_seller THEN to_jsonb(_shop.state) ELSE 'null'::jsonb END,
    'applicant_note', CASE WHEN _as_seller THEN to_jsonb(_p.applicant_note) ELSE 'null'::jsonb END,
    'version',      CASE WHEN _as_seller THEN to_jsonb(_p.version) ELSE 'null'::jsonb END,
    'is_preview',   _as_seller
  ) INTO _out;

  RETURN _out;
END $$;

-- ─── 4. Preflight ───────────────────────────────────────────────────────────
-- Problems as DATA. Every entry carries a code the client maps to copy, the
-- section to open, and the row it is about — which is what makes "đi tới chỗ
-- cần sửa" possible at all.

CREATE OR REPLACE FUNCTION public.product_submit_preflight(_product_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _p        public.products%ROWTYPE;
  _shop     public.shops%ROWTYPE;
  _problems JSONB := '[]'::jsonb;
  _v        RECORD;
  _n        INTEGER;
BEGIN
  SELECT * INTO _p FROM public.products WHERE id = _product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT (public.is_shop_member(_p.shop_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'not a member of this shop' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO _shop FROM public.shops WHERE id = _p.shop_id;

  IF _shop.state <> 'active' THEN
    _problems := _problems || jsonb_build_object(
      'code', 'shop_not_active', 'section', 'basics', 'field', null,
      'detail', jsonb_build_object('state', _shop.state));
  END IF;

  IF _p.status NOT IN ('draft', 'needs_changes') THEN
    _problems := _problems || jsonb_build_object(
      'code', 'wrong_status', 'section', 'basics', 'field', null,
      'detail', jsonb_build_object('status', _p.status));
  END IF;

  IF char_length(btrim(coalesce(_p.title, ''))) < 3 THEN
    _problems := _problems || jsonb_build_object(
      'code', 'title_missing', 'section', 'basics', 'field', 'title');
  END IF;

  IF _p.category_slug IS NULL THEN
    _problems := _problems || jsonb_build_object(
      'code', 'category_missing', 'section', 'category', 'field', 'category_slug');
  END IF;

  IF coalesce(btrim(_p.description), '') = '' THEN
    -- Present, not long. A listing with no description at all gives a
    -- moderator nothing to judge and a buyer nothing to read — but any
    -- MINIMUM LENGTH would be a number nobody asked for, and the seller who
    -- writes "Vợt Nox AT10, mới" would be blocked by it for no reason.
    _problems := _problems || jsonb_build_object(
      'code', 'description_missing', 'section', 'description', 'field', 'description');
  END IF;

  IF NOT public.product_option_groups_valid(_p.option_groups) THEN
    _problems := _problems || jsonb_build_object(
      'code', 'option_graph_invalid', 'section', 'variants', 'field', null);
  END IF;

  SELECT count(*) INTO _n FROM public.product_variants
  WHERE product_id = _product_id AND retired_at IS NULL;
  IF _n < 1 THEN
    _problems := _problems || jsonb_build_object(
      'code', 'no_variant', 'section', 'variants', 'field', null);
  END IF;

  -- A single product must have exactly one default variant; a multi product
  -- must have none. Either way the shape is checked, not assumed.
  IF jsonb_array_length(_p.option_groups) = 0 THEN
    SELECT count(*) INTO _n FROM public.product_variants
    WHERE product_id = _product_id AND retired_at IS NULL AND option_key IS NULL;
    IF _n <> 1 THEN
      _problems := _problems || jsonb_build_object(
        'code', 'default_variant_broken', 'section', 'variants', 'field', null,
        'detail', jsonb_build_object('count', _n));
    END IF;
  ELSE
    SELECT count(*) INTO _n FROM public.product_variants
    WHERE product_id = _product_id AND retired_at IS NULL AND option_key IS NULL;
    IF _n > 0 THEN
      _problems := _problems || jsonb_build_object(
        'code', 'orphan_default_variant', 'section', 'variants', 'field', null);
    END IF;
  END IF;

  FOR _v IN
    SELECT * FROM public.product_variants
    WHERE product_id = _product_id AND retired_at IS NULL ORDER BY position
  LOOP
    IF _v.price_vnd IS NULL OR _v.price_vnd <= 0 THEN
      _problems := _problems || jsonb_build_object(
        'code', 'price_missing', 'section', 'price', 'field', 'price_vnd',
        'variant_id', _v.id);
    END IF;
    IF _v.stock_on_hand IS NOT NULL AND _v.stock_on_hand < 0 THEN
      _problems := _problems || jsonb_build_object(
        'code', 'stock_negative', 'section', 'stock', 'field', 'stock_on_hand',
        'variant_id', _v.id);
    END IF;
    -- The unique index already makes a duplicate impossible to store; this is
    -- here for a row that predates it or was written by an admin.
    IF _v.sku IS NOT NULL AND btrim(_v.sku) <> '' AND EXISTS (
      SELECT 1 FROM public.product_variants o
      WHERE o.shop_id = _v.shop_id AND o.id <> _v.id
        AND o.retired_at IS NULL AND o.archived = false
        AND upper(btrim(o.sku)) = upper(btrim(_v.sku))
    ) THEN
      _problems := _problems || jsonb_build_object(
        'code', 'sku_duplicate', 'section', 'sku', 'field', 'sku', 'variant_id', _v.id);
    END IF;
    IF _v.media_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.product_media m
      WHERE m.id = _v.media_id AND m.product_id = _product_id AND m.verified_at IS NOT NULL
    ) THEN
      _problems := _problems || jsonb_build_object(
        'code', 'variant_media_invalid', 'section', 'variant_media', 'field', null,
        'variant_id', _v.id);
    END IF;
  END LOOP;

  SELECT count(*) INTO _n FROM public.product_media
  WHERE product_id = _product_id AND verified_at IS NOT NULL;
  IF _n < 1 THEN
    _problems := _problems || jsonb_build_object(
      'code', 'no_media', 'section', 'media', 'field', null);
  END IF;

  -- An upload that never finished is not a photo. Sending one to a moderator
  -- shows them an empty frame and wastes the round trip.
  SELECT count(*) INTO _n FROM public.product_media
  WHERE product_id = _product_id AND verified_at IS NULL;
  IF _n > 0 THEN
    _problems := _problems || jsonb_build_object(
      'code', 'media_unverified', 'section', 'media', 'field', null,
      'detail', jsonb_build_object('count', _n));
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.product_media
    WHERE product_id = _product_id AND shop_id <> _p.shop_id
  ) THEN
    _problems := _problems || jsonb_build_object(
      'code', 'media_wrong_shop', 'section', 'media', 'field', null);
  END IF;

  RETURN _problems;
END $$;

-- ─── 5. Submit / resubmit ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.product_submit(
  _product_id       UUID,
  _expected_version INTEGER,
  _client_token     TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _p        public.products%ROWTYPE;
  _problems JSONB;
  _event    TEXT;
  _existing public.product_submission_events%ROWTYPE;
BEGIN
  SELECT * INTO _p FROM public.products WHERE id = _product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found' USING ERRCODE = 'no_data_found';
  END IF;
  PERFORM public.product_assert_writable(_p.shop_id);

  -- Replay first, before the version is compared: a retry after a timeout the
  -- browser never saw the answer to is not a conflict, and asking the seller to
  -- resolve one would be a lie about what happened.
  IF _client_token IS NOT NULL AND btrim(_client_token) <> '' THEN
    SELECT * INTO _existing FROM public.product_submission_events
    WHERE product_id = _product_id AND client_token = btrim(_client_token);
    IF FOUND THEN
      RETURN jsonb_build_object(
        'ok', true, 'status', _p.status, 'event', _existing.event, 'replayed', true);
    END IF;
  END IF;

  IF _p.version <> _expected_version THEN
    RAISE EXCEPTION 'sản phẩm đã được cập nhật ở nơi khác (phiên bản % ≠ %)',
      _p.version, _expected_version USING ERRCODE = 'PT409';
  END IF;

  -- Validation is a RESULT, not an exception: the client needs the whole list
  -- to render a checklist, and a raise would give it one problem at a time.
  _problems := public.product_submit_preflight(_product_id);
  IF jsonb_array_length(_problems) > 0 THEN
    RETURN jsonb_build_object('ok', false, 'problems', _problems, 'status', _p.status);
  END IF;

  _event := CASE WHEN _p.status = 'needs_changes' THEN 'resubmitted' ELSE 'submitted' END;

  PERFORM set_config('shop.privileged_write', 'on', true);
  UPDATE public.products
  SET status       = 'pending_review',
      submitted_at = now(),
      -- The change request is answered, so the list of fields it named is
      -- cleared. applicant_note is NOT cleared: the seller keeps the reason
      -- they were asked, and the moderator keeps what they said.
      requested_fields = '{}'
  WHERE id = _product_id AND status = _p.status;
  PERFORM set_config('shop.privileged_write', 'off', true);

  INSERT INTO public.product_submission_events
    (product_id, shop_id, event, from_status, to_status, actor_user_id, client_token, metadata)
  VALUES
    (_product_id, _p.shop_id, _event, _p.status, 'pending_review', auth.uid(),
     NULLIF(btrim(coalesce(_client_token, '')), ''),
     jsonb_build_object('version', _p.version));

  RETURN jsonb_build_object('ok', true, 'status', 'pending_review', 'event', _event, 'replayed', false);
END $$;

-- The strict, single-answer version stays and now shares the preflight, so a
-- caller that predates step 7 cannot enforce a different set of rules.
CREATE OR REPLACE FUNCTION public.product_submit_for_review(_product_id UUID)
RETURNS public.product_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _p        public.products%ROWTYPE;
  _problems JSONB;
BEGIN
  SELECT * INTO _p FROM public.products WHERE id = _product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT public.is_shop_manager(_p.shop_id) THEN
    RAISE EXCEPTION 'not a manager of this shop' USING ERRCODE = 'insufficient_privilege';
  END IF;

  _problems := public.product_submit_preflight(_product_id);
  IF jsonb_array_length(_problems) > 0 THEN
    RAISE EXCEPTION 'chưa gửi duyệt được: %', (_problems -> 0 ->> 'code')
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  PERFORM set_config('shop.privileged_write', 'on', true);
  UPDATE public.products
  SET status = 'pending_review', submitted_at = now(), requested_fields = '{}'
  WHERE id = _product_id AND status = _p.status;
  PERFORM set_config('shop.privileged_write', 'off', true);

  INSERT INTO public.product_submission_events
    (product_id, shop_id, event, from_status, to_status, actor_user_id)
  VALUES (_product_id, _p.shop_id,
          CASE WHEN _p.status = 'needs_changes' THEN 'resubmitted' ELSE 'submitted' END,
          _p.status, 'pending_review', auth.uid());

  RETURN 'pending_review';
END $$;

-- Withdrawing is how a seller gets back the ability to edit while their
-- product sits in the queue. It is recorded like everything else.
CREATE OR REPLACE FUNCTION public.product_withdraw_submission(_product_id UUID)
RETURNS public.product_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _p public.products%ROWTYPE;
BEGIN
  SELECT * INTO _p FROM public.products WHERE id = _product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found' USING ERRCODE = 'no_data_found';
  END IF;
  PERFORM public.product_assert_writable(_p.shop_id);
  IF _p.status <> 'pending_review' THEN
    RAISE EXCEPTION 'sản phẩm đang ở trạng thái % — chỉ rút lại được khi đang chờ duyệt', _p.status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  PERFORM set_config('shop.privileged_write', 'on', true);
  UPDATE public.products
  SET status = 'draft', submitted_at = NULL
  WHERE id = _product_id AND status = 'pending_review';
  PERFORM set_config('shop.privileged_write', 'off', true);

  INSERT INTO public.product_submission_events
    (product_id, shop_id, event, from_status, to_status, actor_user_id)
  VALUES (_product_id, _p.shop_id, 'withdrawn', 'pending_review', 'draft', auth.uid());

  RETURN 'draft';
END $$;

-- ─── 6. Grants ──────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.product_public_projection(UUID, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.product_submit_preflight(UUID)           FROM PUBLIC;
REVOKE ALL ON FUNCTION public.product_submit(UUID, INTEGER, TEXT)      FROM PUBLIC;

-- anon may project a product too: that is the public PDP path P2b will use,
-- and the function refuses anything not approved+published in an active shop.
GRANT EXECUTE ON FUNCTION public.product_public_projection(UUID, BOOLEAN) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.product_submit_preflight(UUID)           TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.product_submit(UUID, INTEGER, TEXT)      TO authenticated, service_role;
