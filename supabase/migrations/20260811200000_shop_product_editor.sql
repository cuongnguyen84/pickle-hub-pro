-- ============================================================================
-- Shop marketplace — P2a step 4: the seller product editor
-- ----------------------------------------------------------------------------
-- P2a.1 built the catalog tables, the moderation state machine and the RLS.
-- It built no way for a seller to put a product INTO them: every write would
-- have been a raw PostgREST INSERT plus a second INSERT for the variant, with
-- nothing holding the two together.
--
-- This migration adds the four things that editor needs and the schema did not
-- have. Each one exists because the obvious alternative produces a specific,
-- reproducible way to lose a seller's work:
--
--   1. products.version — optimistic concurrency, same shape as shops.version.
--      Without it, two tabs on the same product silently overwrite each other
--      and the seller finds out when a price they never typed goes live.
--
--   2. products.client_token — create idempotency. Without it, a double tap on
--      a slow connection makes two products, and the seller now owns a
--      duplicate they must find and archive. The token is the client's, minted
--      once per create attempt and replayed on retry; the second call returns
--      the FIRST product rather than making another.
--
--   3. product_create / product_update — one transaction that writes the
--      product and its default variant together. D-decision: price and stock
--      live on the variant, ALWAYS, even for a product with no options. So a
--      product without its default variant is a broken row that cannot be
--      submitted, cannot be priced and cannot be ordered in Phase 3 — and two
--      separate client calls produce exactly that whenever the second one
--      fails. These RPCs make that state unreachable.
--
--   4. product_slug_update — the slug moves only when somebody asks. Renaming
--      a product does not re-slug it, for the same reason renaming a shop does
--      not: a slug that has been public is a link somebody already sent.
--
-- Scope, stated so the gaps read as decisions rather than omissions:
--   * ONE default variant. Multiple variants, the SKU matrix and inventory are
--     step 5, and product_update deliberately refuses to touch a product that
--     already has more than one variant rather than quietly editing the first.
--   * No media. Uploading is step 6. product_submit_for_review already demands
--     at least one photo, so nothing here can be submitted yet — and the RPC
--     is left exactly as strict rather than relaxed to make step 4 look
--     finished. The UI says which requirement is outstanding.
--   * No moderation. The admin screens are P2b. Nothing here calls
--     product_decide.
--
-- Everything is idempotent: a replay is safe.
-- ============================================================================

-- ─── 1. Concurrency + idempotency columns ───────────────────────────────────

ALTER TABLE public.products
  -- Bumped by trigger, never sent by a client. Travels with the write so
  -- Postgres decides the conflict, not whoever clicked last.
  ADD COLUMN IF NOT EXISTS version      INTEGER NOT NULL DEFAULT 1,
  -- The client's own idempotency key for create. NULL on every row created
  -- before this column existed, and NULL is not unique — see the index.
  ADD COLUMN IF NOT EXISTS client_token TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_client_token_len') THEN
    ALTER TABLE public.products ADD CONSTRAINT products_client_token_len
      CHECK (client_token IS NULL OR char_length(client_token) BETWEEN 8 AND 64);
  END IF;
END $$;

-- Per shop, not global: two shops minting the same UUID is not a thing worth
-- an error, and scoping keeps one shop's retries out of another's way.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_products_client_token
  ON public.products (shop_id, client_token)
  WHERE client_token IS NOT NULL;

-- The list opens on what needs the seller: a change request first, then the
-- draft they abandoned, then the queue they are waiting on.
--
-- A stored generated column rather than a CASE in the client, because the
-- sort has to happen in Postgres to survive pagination. Ordering a page of 20
-- after it arrives sorts twenty rows out of two hundred, and the seller's
-- rejected product sits on page 4 wondering why nobody told them.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS action_rank SMALLINT
    GENERATED ALWAYS AS (
      CASE status
        WHEN 'needs_changes'  THEN 0   -- the shop has to do something
        WHEN 'rejected'       THEN 1   -- …and should read why
        WHEN 'draft'          THEN 2   -- unfinished
        WHEN 'pending_review' THEN 3   -- waiting on us, not on them
        WHEN 'approved'       THEN 4
        ELSE 5                         -- archived
      END
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_products_seller_list
  ON public.products (shop_id, action_rank, updated_at DESC);

CREATE OR REPLACE FUNCTION public.products_bump_version()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.version := COALESCE(OLD.version, 0) + 1;
  RETURN NEW;
END $$;

-- Fires before products_guard_privileged_columns_trg (triggers run in name
-- order, and 'b' < 'g'), which does not touch version, so the bump survives.
-- An admin write bumps it too: an admin edit must invalidate an open seller
-- tab exactly like anyone else's.
DROP TRIGGER IF EXISTS products_bump_version_trg ON public.products;
CREATE TRIGGER products_bump_version_trg
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.products_bump_version();

-- version and client_token are not the seller's to write either. Re-stated
-- through the existing guard rather than a second trigger, so the pinned list
-- stays in one place.
CREATE OR REPLACE FUNCTION public.products_guard_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- The transition RPCs set this for the duration of their own transaction;
  -- nothing else can, because nothing else is SECURITY DEFINER.
  IF current_setting('shop.privileged_write', true) = 'on' OR public.is_admin() THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  NEW.shop_id          := OLD.shop_id;
  NEW.slug             := OLD.slug;
  NEW.status           := OLD.status;
  NEW.is_published     := OLD.is_published;
  NEW.submitted_at     := OLD.submitted_at;
  NEW.decided_at       := OLD.decided_at;
  NEW.decided_by       := OLD.decided_by;
  NEW.applicant_note   := OLD.applicant_note;
  NEW.internal_note    := OLD.internal_note;
  NEW.requested_fields := OLD.requested_fields;
  NEW.created_at       := OLD.created_at;
  -- Rewriting the token would let a replay create a second product after all.
  NEW.client_token     := OLD.client_token;
  NEW.updated_at       := now();

  -- in_stock is deliberately NOT pinned. A seller flipping "hết hàng" at 11pm
  -- must not be pushed into the review queue to do it.
  IF NEW.in_stock IS DISTINCT FROM OLD.in_stock THEN
    NEW.availability_updated_at := now();
  END IF;

  RETURN NEW;
END $$;

-- ─── 2. Who may write, and when ─────────────────────────────────────────────
-- Three separate questions the editor RPCs all have to ask, so they are asked
-- in one place and answered identically: is this person a manager of this
-- shop, is this shop allowed to trade, and is this product still editable.

CREATE OR REPLACE FUNCTION public.product_assert_writable(_shop_id UUID)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _state public.shop_state;
BEGIN
  -- The pilot gate is not implied by membership: a shop_members row can
  -- outlive the pilot list, and Phase 1 decided the list is the gate.
  IF NOT public.shop_pilot_has_access() THEN
    RAISE EXCEPTION 'tài khoản chưa được mở quyền bán hàng' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT public.is_shop_manager(_shop_id) THEN
    RAISE EXCEPTION 'chỉ chủ shop hoặc quản lý mới sửa được sản phẩm' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT state INTO _state FROM public.shops WHERE id = _shop_id;
  IF _state IS NULL THEN
    RAISE EXCEPTION 'shop not found' USING ERRCODE = 'no_data_found';
  END IF;
  -- Named states, named reasons. "Không có quyền" on a suspended shop sends
  -- the seller to check their password.
  IF _state <> 'active' THEN
    RAISE EXCEPTION 'shop đang ở trạng thái % nên chưa đăng hoặc sửa sản phẩm được', _state
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
END $$;

/**
 * Which statuses accept a content edit.
 *
 * draft and needs_changes obviously. pending_review deliberately does NOT:
 * a moderator is looking at the row, and letting the seller move it underneath
 * them means the decision lands on something nobody reviewed. The seller
 * withdraws first — product_withdraw_submission exists and says so.
 *
 * approved / rejected / archived are not content-editable here either. An
 * approved product changing its description without re-review is how an
 * approval stops meaning anything; step 7 owns the re-submit flow.
 */
CREATE OR REPLACE FUNCTION public.product_status_is_editable(_status public.product_status)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT _status IN ('draft', 'needs_changes')
$$;

-- ─── 3. Slug ────────────────────────────────────────────────────────────────

-- Reuses the shop reserved list rather than inventing a second one. It is a
-- superset — every word it blocks is a word no product needs — and two lists
-- drift the moment one is edited alone.
CREATE OR REPLACE FUNCTION public.product_slug_update(_product_id UUID, _slug TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row   public.products%ROWTYPE;
  _clean TEXT;
BEGIN
  SELECT * INTO _row FROM public.products WHERE id = _product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found' USING ERRCODE = 'no_data_found';
  END IF;
  PERFORM public.product_assert_writable(_row.shop_id);

  -- Normalised through the same helper the generator uses, so case, accents
  -- and spacing cannot slip a duplicate past the unique index.
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
  IF EXISTS (SELECT 1 FROM public.products WHERE slug = _clean AND id <> _product_id) THEN
    RAISE EXCEPTION 'đường dẫn "%" đã có sản phẩm khác dùng', _clean
      USING ERRCODE = 'unique_violation';
  END IF;

  PERFORM set_config('shop.privileged_write', 'on', true);
  UPDATE public.products SET slug = _clean WHERE id = _product_id;
  PERFORM set_config('shop.privileged_write', 'off', true);

  RETURN _clean;
END $$;

-- ─── 4. Create ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.product_create(
  _shop_id      UUID,
  _client_token TEXT,
  _payload      JSONB DEFAULT '{}'::jsonb
)
RETURNS public.products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row   public.products%ROWTYPE;
  _title TEXT;
  _price BIGINT;
BEGIN
  PERFORM public.product_assert_writable(_shop_id);

  IF coalesce(btrim(_client_token), '') = '' THEN
    RAISE EXCEPTION 'thiếu mã chống trùng của lần tạo này' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- The replay answer, checked before anything is written. A retry after a
  -- timeout the client never saw the result of returns the SAME product.
  SELECT * INTO _row FROM public.products
  WHERE shop_id = _shop_id AND client_token = btrim(_client_token);
  IF FOUND THEN
    RETURN _row;
  END IF;

  _title := btrim(coalesce(_payload ->> 'title', ''));
  IF char_length(_title) < 3 OR char_length(_title) > 140 THEN
    RAISE EXCEPTION 'tên sản phẩm cần từ 3 đến 140 ký tự' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Price is read as a number, not trusted as one: '12.5' and '1e6' both
  -- arrive as JSON text from a form, and VND has no minor unit.
  _price := public.product_price_vnd(_payload -> 'price_vnd');

  INSERT INTO public.products (shop_id, slug, title, description, category_slug, condition, client_token)
  VALUES (
    _shop_id,
    public.product_slug_from_title(_title),
    _title,
    NULLIF(btrim(coalesce(_payload ->> 'description', '')), ''),
    NULLIF(_payload ->> 'category_slug', ''),
    coalesce(NULLIF(_payload ->> 'condition', ''), 'new')::public.product_condition,
    btrim(_client_token)
  )
  RETURNING * INTO _row;

  -- The default variant, in the same transaction as the product. This is the
  -- whole reason product_create exists rather than two client calls.
  INSERT INTO public.product_variants (product_id, shop_id, price_vnd, stock, position)
  VALUES (
    _row.id,
    _shop_id,
    _price,
    public.product_stock(_payload -> 'stock'),
    0
  );

  RETURN _row;
END $$;

-- ─── 5. Update ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.product_update(
  _product_id       UUID,
  _expected_version INTEGER,
  _patch            JSONB DEFAULT '{}'::jsonb,
  _variant          JSONB DEFAULT NULL
)
RETURNS public.products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row      public.products%ROWTYPE;
  _count    INTEGER;
  _default  UUID;
  _title    TEXT;
BEGIN
  SELECT * INTO _row FROM public.products WHERE id = _product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found' USING ERRCODE = 'no_data_found';
  END IF;
  PERFORM public.product_assert_writable(_row.shop_id);

  IF NOT public.product_status_is_editable(_row.status) THEN
    RAISE EXCEPTION 'sản phẩm đang ở trạng thái % nên chưa sửa được', _row.status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Detected here under the row lock, not by comparing in the client. The
  -- stale tab is told; it does not quietly win.
  IF _row.version <> _expected_version THEN
    RAISE EXCEPTION 'sản phẩm đã được cập nhật ở nơi khác (phiên bản % ≠ %)', _row.version, _expected_version
      USING ERRCODE = 'serialization_failure';
  END IF;

  IF _patch ? 'title' THEN
    _title := btrim(coalesce(_patch ->> 'title', ''));
    IF char_length(_title) < 3 OR char_length(_title) > 140 THEN
      RAISE EXCEPTION 'tên sản phẩm cần từ 3 đến 140 ký tự' USING ERRCODE = 'invalid_parameter_value';
    END IF;
  END IF;

  -- Renaming does not re-slug. product_slug_update is the only way the URL
  -- moves, and it asks for the new one explicitly.
  UPDATE public.products
  SET title         = coalesce(_title, title),
      description   = CASE WHEN _patch ? 'description'
                           THEN NULLIF(btrim(_patch ->> 'description'), '') ELSE description END,
      category_slug = CASE WHEN _patch ? 'category_slug'
                           THEN NULLIF(_patch ->> 'category_slug', '') ELSE category_slug END,
      condition     = CASE WHEN _patch ? 'condition'
                           THEN (_patch ->> 'condition')::public.product_condition ELSE condition END
  WHERE id = _product_id AND version = _expected_version
  RETURNING * INTO _row;

  IF NOT FOUND THEN
    -- Lost the race between the SELECT ... FOR UPDATE and here. Cannot happen
    -- with the lock held, and is still checked, because "cannot happen" is how
    -- a silent overwrite gets shipped.
    RAISE EXCEPTION 'sản phẩm đã được cập nhật ở nơi khác' USING ERRCODE = 'serialization_failure';
  END IF;

  IF _variant IS NULL THEN
    RETURN _row;
  END IF;

  SELECT count(*)::int INTO _count FROM public.product_variants WHERE product_id = _product_id;

  -- Step 5 owns multiple variants. Editing "the first one" on a product that
  -- has six is how a seller changes a price they cannot see.
  IF _count > 1 THEN
    RAISE EXCEPTION 'sản phẩm này có nhiều phiên bản — màn hình phiên bản sẽ mở ở bản cập nhật tới'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF _count = 0 THEN
    -- A product whose default variant went missing (a row created before this
    -- migration, or by hand). Heal it rather than refusing to save.
    INSERT INTO public.product_variants (product_id, shop_id, price_vnd, stock, position)
    VALUES (_product_id, _row.shop_id,
            public.product_price_vnd(_variant -> 'price_vnd'),
            public.product_stock(_variant -> 'stock'), 0);
    RETURN _row;
  END IF;

  SELECT id INTO _default FROM public.product_variants
  WHERE product_id = _product_id ORDER BY position, created_at LIMIT 1;

  UPDATE public.product_variants
  SET price_vnd = CASE WHEN _variant ? 'price_vnd'
                       THEN public.product_price_vnd(_variant -> 'price_vnd') ELSE price_vnd END,
      stock     = CASE WHEN _variant ? 'stock'
                       THEN public.product_stock(_variant -> 'stock') ELSE stock END,
      sku       = CASE WHEN _variant ? 'sku'
                       THEN NULLIF(btrim(_variant ->> 'sku'), '') ELSE sku END,
      updated_at = now()
  WHERE id = _default;

  RETURN _row;
END $$;

-- ─── 6. Number parsing, shared and strict ───────────────────────────────────
-- Declared after their callers only because plpgsql resolves names at runtime;
-- they are here so the two RPCs cannot disagree about what a price is.

CREATE OR REPLACE FUNCTION public.product_price_vnd(_value JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  _text TEXT;
BEGIN
  IF _value IS NULL OR jsonb_typeof(_value) = 'null' THEN
    RAISE EXCEPTION 'chưa nhập giá' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  _text := CASE WHEN jsonb_typeof(_value) = 'string' THEN btrim(_value #>> '{}') ELSE _value::text END;

  -- VND is an integer currency: it has no minor unit, and a price that arrives
  -- as 12.5 is a form bug, not half a đồng. Digits only, so '1e6', '12.5',
  -- '-100' and '1 000' are all refused here rather than silently rounded.
  IF _text !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'giá phải là số nguyên tiền đồng, không dấu chấm hay dấu phẩy'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF _text::numeric > 2000000000 THEN
    RAISE EXCEPTION 'giá vượt mức cho phép' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  RETURN _text::integer;
END $$;

CREATE OR REPLACE FUNCTION public.product_stock(_value JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  _text TEXT;
BEGIN
  -- NULL is a real answer: "I do not count stock". It is not the same as 0,
  -- which means sold out, and collapsing the two loses the seller's choice.
  IF _value IS NULL OR jsonb_typeof(_value) = 'null' THEN
    RETURN NULL;
  END IF;
  _text := CASE WHEN jsonb_typeof(_value) = 'string' THEN btrim(_value #>> '{}') ELSE _value::text END;
  IF _text = '' THEN
    RETURN NULL;
  END IF;
  IF _text !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'tồn kho phải là số nguyên không âm, để trống nếu không đếm'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF _text::numeric > 1000000 THEN
    RAISE EXCEPTION 'tồn kho vượt mức cho phép' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  RETURN _text::integer;
END $$;

-- ─── 7. Archive / restore ───────────────────────────────────────────────────

-- product_archive already exists (P2a.1). Coming back is what was missing: an
-- archived product with no way out is a delete wearing a softer word, and the
-- seller was told it was reversible.
CREATE OR REPLACE FUNCTION public.product_unarchive(_product_id UUID)
RETURNS public.product_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.products%ROWTYPE;
BEGIN
  SELECT * INTO _row FROM public.products WHERE id = _product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found' USING ERRCODE = 'no_data_found';
  END IF;
  PERFORM public.product_assert_writable(_row.shop_id);
  IF _row.status <> 'archived' THEN
    RAISE EXCEPTION 'sản phẩm không ở trạng thái ngừng bán' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Back to draft, never back to approved. The listing left the shelf; putting
  -- it back is a new decision, and an old approval is not evidence about the
  -- product as it stands now.
  PERFORM set_config('shop.privileged_write', 'on', true);
  UPDATE public.products
  SET status = 'draft', is_published = false, submitted_at = NULL,
      decided_at = NULL, decided_by = NULL
  WHERE id = _product_id AND status = 'archived';
  PERFORM set_config('shop.privileged_write', 'off', true);

  RETURN 'draft';
END $$;

-- ─── 8. Status counts ───────────────────────────────────────────────────────
-- The list's filter chips show a number each. Counting client-side counts only
-- the page that was fetched, and hard-coding them is a lie that survives every
-- refactor. One round trip, one GROUP BY, RLS still applies.

CREATE OR REPLACE FUNCTION public.product_status_counts(_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _out JSONB;
BEGIN
  SELECT coalesce(jsonb_object_agg(status, n), '{}'::jsonb) INTO _out
  FROM (
    SELECT status::text AS status, count(*)::int AS n
    FROM public.products
    WHERE shop_id = _shop_id
    GROUP BY status
  ) s;
  RETURN _out;
END $$;

-- ─── 9. Grants ──────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.product_assert_writable(UUID)                      FROM PUBLIC;
REVOKE ALL ON FUNCTION public.product_status_is_editable(public.product_status)  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.product_slug_update(UUID, TEXT)                    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.product_create(UUID, TEXT, JSONB)                  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.product_update(UUID, INTEGER, JSONB, JSONB)        FROM PUBLIC;
REVOKE ALL ON FUNCTION public.product_price_vnd(JSONB)                           FROM PUBLIC;
REVOKE ALL ON FUNCTION public.product_stock(JSONB)                               FROM PUBLIC;
REVOKE ALL ON FUNCTION public.product_unarchive(UUID)                            FROM PUBLIC;
REVOKE ALL ON FUNCTION public.product_status_counts(UUID)                        FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.product_assert_writable(UUID)                     TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.product_status_is_editable(public.product_status) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.product_slug_update(UUID, TEXT)                   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.product_create(UUID, TEXT, JSONB)                 TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.product_update(UUID, INTEGER, JSONB, JSONB)       TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.product_price_vnd(JSONB)                          TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.product_stock(JSONB)                              TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.product_unarchive(UUID)                           TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.product_status_counts(UUID)                       TO authenticated, service_role;
