-- ============================================================================
-- Shop marketplace — P2a step 5: variants, SKU and inventory
-- ----------------------------------------------------------------------------
-- Step 4 gave every product exactly one default variant carrying its price and
-- stock. This one lets a product have options — Màu sắc: Trắng/Đen, Kích cỡ:
-- 39/40/41 — without any of the four ways that normally goes wrong:
--
--   1. A combination losing its identity when the seller reorders the groups.
--      Identity is a CANONICAL KEY built from normalised group:value pairs
--      sorted by group, so "Trắng/40" is the same variant however the columns
--      are arranged, and reordering is a display change and nothing else.
--      Never an array index — an index is a position, not an identity, and
--      the first time somebody drags a row it starts pointing at another
--      product's stock.
--
--   2. Two variants meaning the same combination, or a variant missing an
--      option the product has. Both are refused by Postgres: a unique index on
--      (product_id, option_key), and a trigger that checks each variant's
--      option object against the product's declared groups — exactly the same
--      key set, and every value drawn from its group's list.
--
--   3. Stock changed by a PATCH. Once there is a ledger, a writable counter is
--      a ledger that lies. product_variants.stock_on_hand is pinned against
--      client writes and moves only through product_variant_adjust_stock(),
--      which locks the row, refuses to go negative, and appends an
--      inventory_movements row in the same transaction.
--
--   4. A retry doubling something. The matrix save and every stock adjustment
--      carry a client token; a replay returns the first result instead of
--      reconciling twice or moving stock twice.
--
-- ── Inventory semantics, stated rather than implied ─────────────────────────
-- `stock` was renamed to `stock_on_hand` in this migration. The old name was
-- true and ambiguous at the same time, and the ambiguity is the expensive kind:
-- Phase 3 introduces reservations, and a column called "stock" is exactly what
-- somebody later redefines as "available" without noticing they changed what
-- every existing row means.
--
-- So, for the pilot:
--     on_hand   = product_variants.stock_on_hand      (NULL = not counted)
--     reserved  = 0, always — nothing reserves stock until Phase 3 carts
--     available = on_hand
-- Phase 3 adds `stock_reserved` as a NEW column and computes availability from
-- the pair. It never redefines stock_on_hand. Anything that wants "available"
-- today must say so and read on_hand; nothing in this migration calls on_hand
-- "còn hàng", because it is not that number once orders exist.
--
-- ── Pilot operational limits ────────────────────────────────────────────────
-- Not in the proposal, so chosen conservatively here and enforced in ONE place
-- (product_option_groups_valid) that the client mirrors rather than repeats:
--     ≤ 3 option groups per product
--     ≤ 100 active combinations per product
--     ≤ 40 characters per group name and per value
--     no duplicate group name, and no duplicate value inside a group, after
--     normalisation — so "Trắng" and " trắng " cannot both exist
-- These are pilot limits, not laws of the domain. Raising them is a migration
-- plus a copy change, and nothing else depends on the numbers.
--
-- Everything is idempotent: a replay is safe.
-- ============================================================================

-- ─── 1. Inventory semantics: the rename ─────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='product_variants' AND column_name='stock'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='product_variants' AND column_name='stock_on_hand'
  ) THEN
    ALTER TABLE public.product_variants RENAME COLUMN stock TO stock_on_hand;
    ALTER TABLE public.product_variants RENAME CONSTRAINT product_variants_stock_range
      TO product_variants_stock_on_hand_range;
  END IF;
END $$;

COMMENT ON COLUMN public.product_variants.stock_on_hand IS
  'Units physically held. NULL = the seller does not count this one. NOT "available": Phase 3 adds stock_reserved and computes available = on_hand - reserved. Never redefine this column.';

-- ─── 2. Option structure on the product ─────────────────────────────────────
-- JSONB rather than two more tables. The invariants that matter — the limits,
-- the uniqueness, the shape — are all enforceable here in one CHECK plus one
-- trigger, and the alternative buys three more tables, three more policy sets
-- and three more grant blocks to express the same rules. Display ORDER lives
-- in this array; combination IDENTITY deliberately does not (see option_key).

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS option_groups JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Idempotency for the matrix save, the same shape as products.client_token
  -- is for create. A reconcile is a large multi-row write, so a retry after a
  -- timeout the browser never saw the answer to must not run it twice.
  ADD COLUMN IF NOT EXISTS variants_token TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_variants_token_len') THEN
    ALTER TABLE public.products ADD CONSTRAINT products_variants_token_len
      CHECK (variants_token IS NULL OR char_length(variants_token) BETWEEN 8 AND 64);
  END IF;
END $$;

-- option_groups and variants_token are the reconcile RPC's to write, never a
-- PostgREST PATCH's — a client that could set option_groups directly could
-- delete a group out from under variants that reference it.
CREATE OR REPLACE FUNCTION public.products_guard_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
  NEW.client_token     := OLD.client_token;
  NEW.option_groups    := OLD.option_groups;
  NEW.variants_token   := OLD.variants_token;
  NEW.updated_at       := now();

  IF NEW.in_stock IS DISTINCT FROM OLD.in_stock THEN
    NEW.availability_updated_at := now();
  END IF;

  RETURN NEW;
END $$;

COMMENT ON COLUMN public.products.option_groups IS
  '[{"name":"Màu sắc","values":["Trắng","Đen"]}] in DISPLAY order. Identity of a combination comes from product_variants.option_key, not from this order.';

-- Normalisation, once. Case- and whitespace-insensitive, and accent-preserving
-- — "Trắng" and "Trang" are different colours and collapsing them would merge
-- two real variants into one.
CREATE OR REPLACE FUNCTION public.shop_option_norm(_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(regexp_replace(btrim(coalesce(_text, '')), '\s+', ' ', 'g'))
$$;

CREATE OR REPLACE FUNCTION public.product_option_groups_valid(_groups JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  _g       JSONB;
  _v       TEXT;
  _names   TEXT[] := '{}';
  _values  TEXT[];
  _combos  INTEGER := 1;
  _count   INTEGER;
BEGIN
  IF _groups IS NULL OR jsonb_typeof(_groups) <> 'array' THEN RETURN false; END IF;
  IF jsonb_array_length(_groups) = 0 THEN RETURN true; END IF;   -- single product
  IF jsonb_array_length(_groups) > 3 THEN RETURN false; END IF;

  FOR _g IN SELECT * FROM jsonb_array_elements(_groups) LOOP
    IF jsonb_typeof(_g) <> 'object' THEN RETURN false; END IF;
    IF jsonb_typeof(_g -> 'name') <> 'string' OR jsonb_typeof(_g -> 'values') <> 'array' THEN
      RETURN false;
    END IF;
    IF btrim(_g ->> 'name') = '' OR char_length(btrim(_g ->> 'name')) > 40 THEN RETURN false; END IF;

    -- A group with no values is not a group; it is a half-finished edit, and
    -- letting it through produces zero combinations and a blank matrix.
    _count := jsonb_array_length(_g -> 'values');
    IF _count = 0 THEN RETURN false; END IF;

    IF public.shop_option_norm(_g ->> 'name') = ANY (_names) THEN RETURN false; END IF;
    _names := _names || public.shop_option_norm(_g ->> 'name');

    _values := '{}';
    FOR _v IN SELECT jsonb_array_elements_text(_g -> 'values') LOOP
      IF btrim(_v) = '' OR char_length(btrim(_v)) > 40 THEN RETURN false; END IF;
      IF public.shop_option_norm(_v) = ANY (_values) THEN RETURN false; END IF;
      _values := _values || public.shop_option_norm(_v);
    END LOOP;

    _combos := _combos * _count;
    IF _combos > 100 THEN RETURN false; END IF;
  END LOOP;

  RETURN true;
END $$;

COMMENT ON FUNCTION public.product_option_groups_valid(JSONB) IS
  'Pilot limits: <=3 groups, <=100 combinations, <=40 chars per name/value, no normalised duplicates. Mirrored in src/lib/shop/variantMatrix.ts — this is the authority.';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_option_groups_valid') THEN
    ALTER TABLE public.products ADD CONSTRAINT products_option_groups_valid
      CHECK (public.product_option_groups_valid(option_groups));
  END IF;
END $$;

-- ─── 3. Combination identity on the variant ─────────────────────────────────

ALTER TABLE public.product_variants
  -- {"Màu sắc":"Trắng","Kích cỡ":"40"} — an OBJECT, so a value is addressed by
  -- its group and never by a position in an array.
  ADD COLUMN IF NOT EXISTS option_values JSONB,
  -- The canonical identity. NULL for the single default variant.
  ADD COLUMN IF NOT EXISTS option_key    TEXT,
  -- Retired by the seller, as opposed to `archived`, which mirrors the
  -- PRODUCT's status and is rewritten wholesale every time that status moves.
  -- One flag for two lifetimes would resurrect every retired variant the
  -- moment a product came back from archived.
  ADD COLUMN IF NOT EXISTS retired_at    TIMESTAMPTZ;

COMMENT ON COLUMN public.product_variants.option_key IS
  'Canonical, order-independent identity: normalised group=value pairs sorted by group, joined with |. NULL = the single default variant.';

CREATE OR REPLACE FUNCTION public.product_option_key(_values JSONB)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  -- Sorted by normalised group name, so the key does not move when the seller
  -- drags a column. Values normalised so case and spacing cannot mint a second
  -- identity for the same combination.
  SELECT CASE
    WHEN _values IS NULL OR jsonb_typeof(_values) <> 'object' OR _values = '{}'::jsonb THEN NULL
    ELSE (
      SELECT string_agg(
               public.shop_option_norm(k) || '=' || public.shop_option_norm(v),
               '|' ORDER BY public.shop_option_norm(k)
             )
      FROM jsonb_each_text(_values) AS t(k, v)
    )
  END
$$;

-- No duplicate combination, and at most one default variant. Both scoped to
-- rows that are actually in play: a retired variant keeps its SKU and its
-- movements, and must not block the seller re-adding the same combination.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_product_variants_combination
  ON public.product_variants (product_id, option_key)
  WHERE option_key IS NOT NULL AND retired_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_product_variants_default
  ON public.product_variants (product_id)
  WHERE option_key IS NULL AND retired_at IS NULL;

-- SKU uniqueness keeps the scope the proposal fixed — per shop, case- and
-- whitespace-insensitive — and now also ignores retired rows, for the same
-- reason the combination index does.
DROP INDEX IF EXISTS public.uniq_product_variants_sku_per_shop;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_product_variants_sku_per_shop
  ON public.product_variants (shop_id, upper(btrim(sku)))
  WHERE sku IS NOT NULL AND btrim(sku) <> '' AND archived = false AND retired_at IS NULL;

-- The invariant a unique index cannot express: a variant's options must match
-- the product's declared groups exactly — same keys, and every value drawn
-- from its group's list. Without this a product can carry a "Kích cỡ: 43"
-- variant after the seller deleted 43, and the matrix shows a row the option
-- editor says does not exist.
CREATE OR REPLACE FUNCTION public.product_variants_guard_options()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _groups     JSONB;
  _group_keys TEXT[];
  _value_keys TEXT[];
  _g          JSONB;
  _k          TEXT;
BEGIN
  -- option_key is derived, never sent. Deriving it here rather than trusting
  -- the caller is what makes the unique index mean anything.
  NEW.option_key := public.product_option_key(NEW.option_values);

  -- An update that does not touch the options is not the place to re-validate
  -- them. Without this, retiring the old default variant during a switch to
  -- multi fails: the row's options are still NULL and the product already has
  -- its new groups, so a write that was REMOVING the row would be refused for
  -- not matching a structure it is on its way out of. Every row the reconcile
  -- keeps does set option_values, so nothing skips the check that needs it.
  IF TG_OP = 'UPDATE' AND NEW.option_values IS NOT DISTINCT FROM OLD.option_values THEN
    RETURN NEW;
  END IF;

  SELECT option_groups INTO _groups FROM public.products WHERE id = NEW.product_id;
  IF _groups IS NULL THEN _groups := '[]'::jsonb; END IF;

  IF jsonb_array_length(_groups) = 0 THEN
    IF NEW.option_values IS NOT NULL AND NEW.option_values <> '{}'::jsonb THEN
      RAISE EXCEPTION 'sản phẩm này chưa bật nhiều phiên bản nên phiên bản không được mang tuỳ chọn'
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
    NEW.option_values := NULL;
    NEW.option_key := NULL;
    RETURN NEW;
  END IF;

  IF NEW.option_values IS NULL OR jsonb_typeof(NEW.option_values) <> 'object' THEN
    RAISE EXCEPTION 'phiên bản thiếu tuỳ chọn — sản phẩm này có % nhóm tuỳ chọn', jsonb_array_length(_groups)
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT array_agg(public.shop_option_norm(g ->> 'name') ORDER BY public.shop_option_norm(g ->> 'name'))
    INTO _group_keys
  FROM jsonb_array_elements(_groups) AS g;

  SELECT array_agg(public.shop_option_norm(k) ORDER BY public.shop_option_norm(k))
    INTO _value_keys
  FROM jsonb_object_keys(NEW.option_values) AS k;

  IF _group_keys IS DISTINCT FROM _value_keys THEN
    RAISE EXCEPTION 'phiên bản không khớp bộ tuỳ chọn của sản phẩm'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  FOR _g IN SELECT * FROM jsonb_array_elements(_groups) LOOP
    _k := _g ->> 'name';
    IF NOT EXISTS (
      SELECT 1
      FROM jsonb_each_text(NEW.option_values) AS t(key, val)
      WHERE public.shop_option_norm(t.key) = public.shop_option_norm(_k)
        AND public.shop_option_norm(t.val) IN (
          SELECT public.shop_option_norm(v) FROM jsonb_array_elements_text(_g -> 'values') AS v
        )
    ) THEN
      RAISE EXCEPTION 'giá trị của nhóm "%" không nằm trong danh sách đã khai', _k
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
  END LOOP;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS product_variants_guard_options_trg ON public.product_variants;
CREATE TRIGGER product_variants_guard_options_trg
  BEFORE INSERT OR UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.product_variants_guard_options();

-- Stock is the ledger's to move. Pinning it here is what makes
-- inventory_movements a complete account rather than a partial one.
CREATE OR REPLACE FUNCTION public.product_variants_guard_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('shop.stock_write', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    -- A brand-new variant may declare its opening count; that is the opening
    -- movement, written by the RPC that created it.
    RETURN NEW;
  END IF;
  IF NEW.stock_on_hand IS DISTINCT FROM OLD.stock_on_hand THEN
    RAISE EXCEPTION 'tồn kho chỉ đổi được qua thao tác điều chỉnh kho, không sửa trực tiếp'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS product_variants_guard_stock_trg ON public.product_variants;
CREATE TRIGGER product_variants_guard_stock_trg
  BEFORE INSERT OR UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.product_variants_guard_stock();

-- The product-status sync from P2a.1 must not touch retired_at: `archived`
-- follows the product, `retired_at` follows the seller's decision about this
-- one variant, and one overwriting the other is how a retired combination
-- comes back to life when a product is unarchived.
CREATE OR REPLACE FUNCTION public.product_variants_sync_archived()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE public.product_variants
    SET archived = (NEW.status = 'archived'), updated_at = now()
    WHERE product_id = NEW.id
      AND archived IS DISTINCT FROM (NEW.status = 'archived');
  END IF;
  RETURN NEW;
END $$;

-- ─── 4. The inventory ledger ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  variant_id    UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  -- Signed. A correction downward is a real event and gets a real row.
  delta         INTEGER NOT NULL,
  -- Both sides recorded, so the ledger reconciles against the counter without
  -- replaying every row, and a divergence is visible instead of inferred.
  on_hand_before INTEGER,
  on_hand_after  INTEGER,
  reason        TEXT NOT NULL,
  note          TEXT,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  client_token  TEXT,
  -- clock_timestamp(), not now(). now() is the TRANSACTION timestamp, so a
  -- reconcile writing an opening row for six variants would stamp all six
  -- identically and the ledger would have no order inside the event that
  -- created it. A ledger whose rows cannot be put in sequence is a list.
  created_at    TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT inventory_movements_reason_ok CHECK (
    reason IN ('opening', 'restock', 'correction', 'damage', 'lost', 'return', 'manual')
  ),
  CONSTRAINT inventory_movements_note_len CHECK (note IS NULL OR char_length(note) <= 300),
  CONSTRAINT inventory_movements_delta_range CHECK (delta BETWEEN -1000000 AND 1000000),
  CONSTRAINT inventory_movements_after_non_negative CHECK (on_hand_after IS NULL OR on_hand_after >= 0)
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_variant
  ON public.inventory_movements (variant_id, created_at DESC);

-- Idempotency: a retried adjustment finds its own row instead of moving stock
-- a second time.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_inventory_movements_token
  ON public.inventory_movements (variant_id, client_token)
  WHERE client_token IS NOT NULL;

COMMENT ON TABLE public.inventory_movements IS
  'Append-only stock ledger. delta is signed; on_hand_after is the counter after this row. Phase 3 adds reservation rows; nothing here is ever updated or deleted.';

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- Members of the shop read their own history. Nobody outside does: how much of
-- something a shop holds, and when it lost some, is not public.
DROP POLICY IF EXISTS "inventory_movements_select_member" ON public.inventory_movements;
CREATE POLICY "inventory_movements_select_member" ON public.inventory_movements
  FOR SELECT TO authenticated
  USING (public.is_shop_member(shop_id) OR public.is_admin());

-- No INSERT policy, deliberately. Rows appear only through the SECURITY
-- DEFINER adjustment RPC, which is what keeps before/after honest.
GRANT SELECT ON public.inventory_movements TO authenticated;
GRANT SELECT, INSERT ON public.inventory_movements TO service_role;

-- Append-only, enforced rather than asserted. A ledger that can be edited is a
-- ledger that will be, on the day somebody wants the numbers to look different.
CREATE OR REPLACE FUNCTION public.inventory_movements_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'sổ kho chỉ ghi thêm, không sửa' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- A DELETE is refused while the thing it is an account OF still exists.
  --
  -- But the FKs above are ON DELETE CASCADE, and a blanket refusal makes those
  -- cascades impossible: deleting a shop that has ever moved stock fails, which
  -- takes account deletion and the QA teardown with it. That is not "history is
  -- protected", it is "a shop can never be removed", and it was found by the QA
  -- cleanup silently leaving six shops behind.
  --
  -- Postgres deletes the parent row before the children in a cascade, so inside
  -- this trigger a missing parent IS the cascade. History still cannot be
  -- edited or selectively pruned; it goes only when its whole subject goes.
  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = OLD.shop_id)
     OR NOT EXISTS (SELECT 1 FROM public.products WHERE id = OLD.product_id)
     OR NOT EXISTS (SELECT 1 FROM public.product_variants WHERE id = OLD.variant_id) THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'sổ kho chỉ ghi thêm, không xoá' USING ERRCODE = 'insufficient_privilege';
END $$;

DROP TRIGGER IF EXISTS inventory_movements_append_only_trg ON public.inventory_movements;
CREATE TRIGGER inventory_movements_append_only_trg
  BEFORE UPDATE OR DELETE ON public.inventory_movements
  FOR EACH ROW EXECUTE FUNCTION public.inventory_movements_append_only();

-- ─── 5. Stock adjustment ────────────────────────────────────────────────────
-- An explicit action, not a text field that autosaves. Moving stock is a claim
-- about the physical world, and it gets a reason, an actor and a row.

CREATE OR REPLACE FUNCTION public.product_variant_adjust_stock(
  _variant_id   UUID,
  _delta        INTEGER,
  _reason       TEXT DEFAULT 'manual',
  _note         TEXT DEFAULT NULL,
  _client_token TEXT DEFAULT NULL
)
RETURNS public.product_variants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row    public.product_variants%ROWTYPE;
  _before INTEGER;
  _after  INTEGER;
BEGIN
  -- Replay first, before the lock and before the write.
  IF _client_token IS NOT NULL AND btrim(_client_token) <> '' THEN
    IF EXISTS (
      SELECT 1 FROM public.inventory_movements
      WHERE variant_id = _variant_id AND client_token = btrim(_client_token)
    ) THEN
      SELECT * INTO _row FROM public.product_variants WHERE id = _variant_id;
      RETURN _row;
    END IF;
  END IF;

  SELECT * INTO _row FROM public.product_variants WHERE id = _variant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'variant not found' USING ERRCODE = 'no_data_found';
  END IF;
  PERFORM public.product_assert_writable(_row.shop_id);

  IF _delta = 0 THEN
    RAISE EXCEPTION 'số điều chỉnh phải khác 0' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF _row.stock_on_hand IS NULL THEN
    RAISE EXCEPTION 'phiên bản này đang không đếm tồn kho — bật đếm trước khi điều chỉnh'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  _before := _row.stock_on_hand;
  _after  := _before + _delta;
  IF _after < 0 THEN
    -- Named, with the numbers, because "không hợp lệ" leaves the seller doing
    -- the subtraction themselves to find out why.
    RAISE EXCEPTION 'tồn kho không thể âm — đang có %, không trừ được %', _before, abs(_delta)
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  PERFORM set_config('shop.stock_write', 'on', true);
  UPDATE public.product_variants
  SET stock_on_hand = _after, updated_at = now()
  WHERE id = _variant_id
  RETURNING * INTO _row;
  PERFORM set_config('shop.stock_write', 'off', true);

  INSERT INTO public.inventory_movements
    (shop_id, variant_id, product_id, delta, on_hand_before, on_hand_after,
     reason, note, actor_user_id, client_token)
  VALUES
    (_row.shop_id, _variant_id, _row.product_id, _delta, _before, _after,
     _reason, NULLIF(btrim(coalesce(_note, '')), ''), auth.uid(),
     NULLIF(btrim(coalesce(_client_token, '')), ''));

  RETURN _row;
END $$;

-- product_create (step 4) inserted the default variant's `stock`. The column
-- is now stock_on_hand, and an opening count is a ledger event like any other,
-- so the create writes the first movement rather than leaving the ledger
-- starting from a number nobody can account for.
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
  _row     public.products%ROWTYPE;
  _title   TEXT;
  _price   INTEGER;
  _stock   INTEGER;
  _variant UUID;
BEGIN
  PERFORM public.product_assert_writable(_shop_id);

  IF coalesce(btrim(_client_token), '') = '' THEN
    RAISE EXCEPTION 'thiếu mã chống trùng của lần tạo này' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT * INTO _row FROM public.products
  WHERE shop_id = _shop_id AND client_token = btrim(_client_token);
  IF FOUND THEN
    RETURN _row;
  END IF;

  _title := btrim(coalesce(_payload ->> 'title', ''));
  IF char_length(_title) < 3 OR char_length(_title) > 140 THEN
    RAISE EXCEPTION 'tên sản phẩm cần từ 3 đến 140 ký tự' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  _price := public.product_price_vnd(_payload -> 'price_vnd');
  _stock := public.product_stock(coalesce(_payload -> 'stock_on_hand', _payload -> 'stock'));

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

  INSERT INTO public.product_variants (product_id, shop_id, price_vnd, stock_on_hand, position)
  VALUES (_row.id, _shop_id, _price, _stock, 0)
  RETURNING id INTO _variant;

  IF _stock IS NOT NULL THEN
    INSERT INTO public.inventory_movements
      (shop_id, variant_id, product_id, delta, on_hand_before, on_hand_after, reason, actor_user_id)
    VALUES (_shop_id, _variant, _row.id, _stock, 0, _stock, 'opening', auth.uid());
  END IF;

  RETURN _row;
END $$;

-- ─── 5b. Setting stock to a target, through the ledger ──────────────────────
-- The editor lets a seller type a number into a stock box, which is a target,
-- not a delta. Turning that into a movement is the same job in three places
-- (product_update, the matrix reconcile, the simple form), so it lives once.
--
-- Three cases, and the middle one is the reason this is not an UPDATE:
--   NULL -> number   the seller starts counting: an `opening` movement
--   number -> NULL   the seller stops counting: no movement, there is no
--                    number any more to have moved
--   number -> number a `correction`, signed, through adjust_stock

CREATE OR REPLACE FUNCTION public.product_variant_set_stock(
  _variant_id UUID,
  _target     INTEGER,
  _note       TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.product_variants%ROWTYPE;
BEGIN
  SELECT * INTO _row FROM public.product_variants WHERE id = _variant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'variant not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF _target IS NOT DISTINCT FROM _row.stock_on_hand THEN
    RETURN;
  END IF;

  IF _row.stock_on_hand IS NULL OR _target IS NULL THEN
    PERFORM set_config('shop.stock_write', 'on', true);
    UPDATE public.product_variants
    SET stock_on_hand = _target, updated_at = now()
    WHERE id = _variant_id;
    PERFORM set_config('shop.stock_write', 'off', true);

    IF _target IS NOT NULL THEN
      INSERT INTO public.inventory_movements
        (shop_id, variant_id, product_id, delta, on_hand_before, on_hand_after,
         reason, note, actor_user_id)
      VALUES (_row.shop_id, _variant_id, _row.product_id, _target, 0, _target,
              'opening', _note, auth.uid());
    END IF;
    RETURN;
  END IF;

  PERFORM public.product_variant_adjust_stock(
    _variant_id, _target - _row.stock_on_hand, 'correction', _note, NULL);
END $$;

-- product_update (step 4) wrote variant stock with a plain UPDATE. That path
-- is now blocked by product_variants_guard_stock_trg — correctly, and it would
-- have been a silent 42501 on the seller's Save. Re-stated here so the simple
-- form's stock box goes through the same ledger as everything else, and so the
-- payload key matches the renamed column instead of quietly meaning it.
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
  _row     public.products%ROWTYPE;
  _count   INTEGER;
  _default UUID;
  _title   TEXT;
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

  IF _row.version <> _expected_version THEN
    RAISE EXCEPTION 'sản phẩm đã được cập nhật ở nơi khác (phiên bản % ≠ %)', _row.version, _expected_version
      USING ERRCODE = 'PT409';
  END IF;

  IF _patch ? 'title' THEN
    _title := btrim(coalesce(_patch ->> 'title', ''));
    IF char_length(_title) < 3 OR char_length(_title) > 140 THEN
      RAISE EXCEPTION 'tên sản phẩm cần từ 3 đến 140 ký tự' USING ERRCODE = 'invalid_parameter_value';
    END IF;
  END IF;

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
    RAISE EXCEPTION 'sản phẩm đã được cập nhật ở nơi khác' USING ERRCODE = 'PT409';
  END IF;

  IF _variant IS NULL THEN
    RETURN _row;
  END IF;

  SELECT count(*)::int INTO _count FROM public.product_variants
  WHERE product_id = _product_id AND retired_at IS NULL;

  -- The matrix owns a product with options. Editing "the first one" on a
  -- product that has six is how a seller changes a price they cannot see.
  IF _count > 1 OR jsonb_array_length(_row.option_groups) > 0 THEN
    RAISE EXCEPTION 'sản phẩm này có nhiều phiên bản — sửa giá và tồn kho ở bảng phiên bản'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF _count = 0 THEN
    INSERT INTO public.product_variants (product_id, shop_id, price_vnd, stock_on_hand, position)
    VALUES (_product_id, _row.shop_id,
            public.product_price_vnd(_variant -> 'price_vnd'),
            public.product_stock(_variant -> 'stock_on_hand'), 0)
    RETURNING id INTO _default;

    IF (_variant -> 'stock_on_hand') IS NOT NULL
       AND public.product_stock(_variant -> 'stock_on_hand') IS NOT NULL THEN
      INSERT INTO public.inventory_movements
        (shop_id, variant_id, product_id, delta, on_hand_before, on_hand_after, reason, actor_user_id)
      VALUES (_row.shop_id, _default, _product_id,
              public.product_stock(_variant -> 'stock_on_hand'), 0,
              public.product_stock(_variant -> 'stock_on_hand'), 'opening', auth.uid());
    END IF;
    RETURN _row;
  END IF;

  SELECT id INTO _default FROM public.product_variants
  WHERE product_id = _product_id AND retired_at IS NULL
  ORDER BY position, created_at LIMIT 1;

  UPDATE public.product_variants
  SET price_vnd = CASE WHEN _variant ? 'price_vnd'
                       THEN public.product_price_vnd(_variant -> 'price_vnd') ELSE price_vnd END,
      sku       = CASE WHEN _variant ? 'sku'
                       THEN NULLIF(btrim(_variant ->> 'sku'), '') ELSE sku END,
      updated_at = now()
  WHERE id = _default;

  IF _variant ? 'stock_on_hand' THEN
    PERFORM public.product_variant_set_stock(
      _default, public.product_stock(_variant -> 'stock_on_hand'), 'Sửa trong màn hình sản phẩm');
  END IF;

  RETURN _row;
END $$;

-- ─── 6. The matrix reconcile ────────────────────────────────────────────────
-- Server-authoritative, and it is the only way the option structure or the
-- variant set changes — including a bulk price, which arrives as the rows the
-- seller ended up with rather than as an instruction the server has to trust.
--
-- The client sends what it wants to exist. The server decides what that means:
-- it validates the whole combination graph, keeps every variant whose identity
-- is unchanged (with its id, its SKU and its stock), inserts what is new, and
-- retires what is gone. It never trusts a "complete replacement" — a row whose
-- option_key is not derivable from the submitted groups is refused, not stored.

CREATE OR REPLACE FUNCTION public.product_variants_reconcile(
  _product_id       UUID,
  _expected_version INTEGER,
  _option_groups    JSONB,
  _rows             JSONB,
  _client_token     TEXT DEFAULT NULL,
  -- Multi -> single needs a decision the server cannot make: which of the
  -- existing variants becomes the one price the product now has.
  _keep_variant_id  UUID DEFAULT NULL
)
RETURNS SETOF public.product_variants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _product     public.products%ROWTYPE;
  _row         JSONB;
  _key         TEXT;
  _seen        TEXT[] := '{}';
  _expected    INTEGER;
  _price       INTEGER;
  _stock       INTEGER;
  _sku         TEXT;
  _existing    public.product_variants%ROWTYPE;
  _new         public.product_variants%ROWTYPE;
  _multi       BOOLEAN;
BEGIN
  SELECT * INTO _product FROM public.products WHERE id = _product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found' USING ERRCODE = 'no_data_found';
  END IF;
  PERFORM public.product_assert_writable(_product.shop_id);

  IF NOT public.product_status_is_editable(_product.status) THEN
    RAISE EXCEPTION 'sản phẩm đang ở trạng thái % nên chưa sửa được', _product.status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Replay: the same token against the same product is the same save.
  IF _client_token IS NOT NULL AND btrim(_client_token) <> ''
     AND _product.variants_token = btrim(_client_token) THEN
    RETURN QUERY SELECT * FROM public.product_variants
      WHERE product_id = _product_id AND retired_at IS NULL
      ORDER BY position, created_at;
    RETURN;
  END IF;

  IF _product.version <> _expected_version THEN
    RAISE EXCEPTION 'sản phẩm đã được cập nhật ở nơi khác (phiên bản % ≠ %)',
      _product.version, _expected_version USING ERRCODE = 'PT409';
  END IF;

  IF NOT public.product_option_groups_valid(_option_groups) THEN
    RAISE EXCEPTION 'bộ tuỳ chọn không hợp lệ — tối đa 3 nhóm, 100 phiên bản, tên và giá trị tối đa 40 ký tự, không trùng nhau'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  _multi := jsonb_array_length(_option_groups) > 0;

  IF jsonb_typeof(_rows) <> 'array' OR jsonb_array_length(_rows) = 0 THEN
    RAISE EXCEPTION 'thiếu danh sách phiên bản' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Multi -> single collapses to one variant, and the seller has to say which
  -- one keeps selling. Picking silently would throw away a SKU somebody prints
  -- on shipping labels.
  IF NOT _multi AND jsonb_array_length(_rows) > 1 THEN
    RAISE EXCEPTION 'tắt nhiều phiên bản thì chỉ giữ lại một phiên bản' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF NOT _multi AND EXISTS (
    SELECT 1 FROM public.product_variants
    WHERE product_id = _product_id AND retired_at IS NULL AND option_key IS NOT NULL
  ) AND _keep_variant_id IS NULL THEN
    RAISE EXCEPTION 'chọn phiên bản được giữ lại trước khi tắt nhiều phiên bản'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- The option structure moves first, so the variant guard validates against
  -- the NEW groups rather than the old ones.
  PERFORM set_config('shop.privileged_write', 'on', true);
  UPDATE public.products
  SET option_groups = _option_groups,
      variants_token = NULLIF(btrim(coalesce(_client_token, '')), '')
  WHERE id = _product_id AND version = _expected_version;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'sản phẩm đã được cập nhật ở nơi khác' USING ERRCODE = 'PT409';
  END IF;
  PERFORM set_config('shop.privileged_write', 'off', true);

  -- Retire first, so a combination being replaced frees its unique key before
  -- the replacement claims it.
  UPDATE public.product_variants
  SET retired_at = now(), updated_at = now()
  WHERE product_id = _product_id
    AND retired_at IS NULL
    AND (
      -- Going single: everything except the survivor.
      (NOT _multi AND id IS DISTINCT FROM coalesce(_keep_variant_id, id) AND option_key IS NOT NULL)
      -- Going multi from single: the old default has no combination and cannot
      -- stay. Retired, never deleted — it keeps its id, its SKU and its
      -- movements, so nothing the seller entered is destroyed by the switch.
      -- The new rows arrive already seeded from its price by the editor.
      OR (_multi AND option_key IS NULL)
    );

  -- Going single, the survivor stops being a combination and becomes THE
  -- variant. Converting it in place is what makes "keep this one" mean what it
  -- says: the id, the SKU, the stock and the ledger all stay with it. Skipping
  -- this step leaves it holding an option_key, the loop below fails to match
  -- it, and the insert that follows collides with the survivor's own SKU —
  -- which is exactly how the pgTAP found this.
  IF NOT _multi AND _keep_variant_id IS NOT NULL THEN
    UPDATE public.product_variants
    SET option_values = NULL, option_key = NULL, updated_at = now()
    WHERE id = _keep_variant_id AND product_id = _product_id AND retired_at IS NULL;
  END IF;

  FOR _row IN SELECT * FROM jsonb_array_elements(_rows) LOOP
    _price := public.product_price_vnd(_row -> 'price_vnd');
    _stock := public.product_stock(_row -> 'stock_on_hand');
    _sku   := NULLIF(btrim(coalesce(_row ->> 'sku', '')), '');
    _key   := CASE WHEN _multi THEN public.product_option_key(_row -> 'option_values') ELSE NULL END;

    IF _multi AND _key IS NULL THEN
      RAISE EXCEPTION 'một dòng phiên bản thiếu tuỳ chọn' USING ERRCODE = 'invalid_parameter_value';
    END IF;

    -- Duplicate inside the SUBMITTED set, caught before the index sees it so
    -- the message can name the combination rather than the constraint.
    IF _multi AND coalesce(_key, '') = ANY (_seen) THEN
      RAISE EXCEPTION 'hai dòng cùng một tổ hợp tuỳ chọn: %', _key USING ERRCODE = 'unique_violation';
    END IF;
    _seen := _seen || coalesce(_key, '');

    -- Identity, not position: an existing variant with this key keeps its id,
    -- its history and its stock. This is what makes reordering the option
    -- groups a display change.
    SELECT * INTO _existing FROM public.product_variants
    WHERE product_id = _product_id
      AND retired_at IS NULL
      AND option_key IS NOT DISTINCT FROM _key
    LIMIT 1;

    IF FOUND THEN
      PERFORM set_config('shop.privileged_write', 'on', true);
      UPDATE public.product_variants
      SET price_vnd     = _price,
          sku           = _sku,
          option_values = CASE WHEN _multi THEN _row -> 'option_values' ELSE NULL END,
          position      = coalesce((_row ->> 'position')::int, position),
          updated_at    = now()
      WHERE id = _existing.id;
      PERFORM set_config('shop.privileged_write', 'off', true);

      -- Stock still moves only through the ledger, even here. A matrix save
      -- that quietly rewrote the counter would be the PATCH this design
      -- removed, wearing a different name.
      PERFORM public.product_variant_set_stock(_existing.id, _stock, 'Sửa trong bảng phiên bản');
      CONTINUE;
    END IF;

    INSERT INTO public.product_variants
      (product_id, shop_id, price_vnd, sku, stock_on_hand, option_values, position)
    VALUES (_product_id, _product.shop_id, _price, _sku, _stock,
            CASE WHEN _multi THEN _row -> 'option_values' ELSE NULL END,
            coalesce((_row ->> 'position')::int, 0))
    RETURNING * INTO _new;

    IF _stock IS NOT NULL THEN
      INSERT INTO public.inventory_movements
        (shop_id, variant_id, product_id, delta, on_hand_before, on_hand_after, reason, actor_user_id)
      VALUES (_product.shop_id, _new.id, _product_id, _stock, 0, _stock, 'opening', auth.uid());
    END IF;
  END LOOP;

  RETURN QUERY SELECT * FROM public.product_variants
    WHERE product_id = _product_id AND retired_at IS NULL
    ORDER BY position, created_at;
END $$;

-- ─── 7. Grants ──────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.shop_option_norm(TEXT)                                  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.product_option_groups_valid(JSONB)                      FROM PUBLIC;
REVOKE ALL ON FUNCTION public.product_option_key(JSONB)                               FROM PUBLIC;
REVOKE ALL ON FUNCTION public.product_variant_adjust_stock(UUID, INTEGER, TEXT, TEXT, TEXT) FROM PUBLIC;
-- Internal: called by the reconcile and by product_update, never by a client.
-- It takes no expected version and does no permission check of its own, so it
-- is deliberately not reachable from PostgREST.
REVOKE ALL ON FUNCTION public.product_variant_set_stock(UUID, INTEGER, TEXT)           FROM PUBLIC;
REVOKE ALL ON FUNCTION public.product_variants_reconcile(UUID, INTEGER, JSONB, JSONB, TEXT, UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.shop_option_norm(TEXT)                                  TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.product_option_groups_valid(JSONB)                      TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.product_option_key(JSONB)                               TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.product_variant_adjust_stock(UUID, INTEGER, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.product_variants_reconcile(UUID, INTEGER, JSONB, JSONB, TEXT, UUID) TO authenticated, service_role;
