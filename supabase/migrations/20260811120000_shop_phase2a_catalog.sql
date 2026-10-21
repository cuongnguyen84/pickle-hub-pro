-- ============================================================================
-- Shop marketplace — Phase 2a: catalog schema, moderation state machine, RLS
-- ----------------------------------------------------------------------------
-- Scope is fixed by production-implementation-map.md §11 (Product Owner
-- decisions D1–D4, 2026-08-11):
--
--   * D3 — this migration builds the moderation STATE MACHINE, the guarded
--     server-side transitions, the RLS and the pgTAP that P2b will consume.
--     It does NOT build the admin moderation UI and it does NOT build public
--     discovery. The public read model exists (a projection and a policy),
--     because step 7 requires the seller preview to render through the real
--     public projection rather than an approximation of it.
--
--   * D1 — product media is hybrid. Originals and anything not approved live
--     in a PRIVATE bucket. Only an approved + published product gets a public
--     rendition, and unpublish / reject / suspend must take it away again.
--     A seller can never promote an object by editing a path or a status.
--
--     HONEST LIMIT, stated here rather than implied away: this migration owns
--     the RECORD of the rendition (product_media.public_path), every guard
--     around it, and the transitions that set and clear it. It does not copy
--     or delete storage BYTES — SQL cannot. The copy/delete is a service-role
--     step, run from the approval runbook until P2b automates it. So after
--     `product_set_published(false)` the rendition row is gone and the public
--     projection no longer serves the path, but the object itself survives
--     until the runbook removes it. Anyone reading this before P2b lands must
--     treat "revoked" as "revoked in the database, pending object deletion".
--
-- Fixes carried in deliberately (they block P2a per the panel's §4):
--   * is_shop_member() is role-blind — `support` and `fulfillment` satisfied
--     shops_update_owner, so a support account could have edited prices and
--     removed images through PostgREST. Catalog writes now go through
--     is_shop_manager(), and the Phase 1 shops policy is corrected to match.
--
-- Everything is idempotent: a replay is safe.
-- ============================================================================

-- ─── 1. Enums ───────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_status') THEN
    CREATE TYPE public.product_status AS ENUM (
      'draft', 'pending_review', 'needs_changes', 'approved', 'rejected', 'archived'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_condition') THEN
    CREATE TYPE public.product_condition AS ENUM ('new', 'used');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_media_state') THEN
    CREATE TYPE public.product_media_state AS ENUM ('draft', 'approved');
  END IF;
END $$;

-- ─── 2. Role-aware membership ───────────────────────────────────────────────
-- is_shop_member() answers "is this person attached to the shop at all" and is
-- right for reads. It is wrong for writes: a `support` member satisfies it.
-- Catalog mutation asks a narrower question.

CREATE OR REPLACE FUNCTION public.is_shop_manager(_shop_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shop_members
    WHERE shop_id = _shop_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'manager')
  )
$$;

COMMENT ON FUNCTION public.is_shop_manager(UUID) IS
  'Write-side membership: owner or manager only. Reads use is_shop_member().';

REVOKE ALL ON FUNCTION public.is_shop_manager(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_shop_manager(UUID) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.is_shop_manager(UUID) TO service_role;

-- Phase 1 defect: shop presentation fields were editable by any member.
DROP POLICY IF EXISTS "shops_update_owner" ON public.shops;
CREATE POLICY "shops_update_owner" ON public.shops
  FOR UPDATE TO authenticated
  USING (public.is_shop_manager(id))
  WITH CHECK (public.is_shop_manager(id));

-- ─── 3. Categories ──────────────────────────────────────────────────────────
-- Seeded, not seller-authored: a pilot with 3 shops inventing their own
-- taxonomy produces 3 taxonomies. Slug is the key so the URL is stable.

CREATE TABLE IF NOT EXISTS public.product_categories (
  slug        TEXT PRIMARY KEY,
  name_vi     TEXT NOT NULL,
  name_en     TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT product_categories_slug_shape CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

INSERT INTO public.product_categories (slug, name_vi, name_en, sort_order) VALUES
  ('vot',            'Vợt pickleball',   'Paddles',             10),
  ('giay',           'Giày',             'Shoes',               20),
  ('bong',           'Bóng',             'Balls',               30),
  ('tui-balo',       'Túi & balo',       'Bags',                40),
  ('grip-phu-kien',  'Grip & phụ kiện',  'Grips & accessories', 50),
  ('trang-phuc',     'Trang phục',       'Apparel',             60)
ON CONFLICT (slug) DO NOTHING;

DROP POLICY IF EXISTS "product_categories_select_all" ON public.product_categories;
CREATE POLICY "product_categories_select_all" ON public.product_categories
  FOR SELECT
  USING (is_active);

DROP POLICY IF EXISTS "product_categories_admin_write" ON public.product_categories;
CREATE POLICY "product_categories_admin_write" ON public.product_categories
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT                         ON public.product_categories TO anon;
GRANT SELECT                         ON public.product_categories TO authenticated;
GRANT INSERT, UPDATE, DELETE         ON public.product_categories TO authenticated;

-- ─── 4. Products ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.products (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id           UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  -- GLOBALLY unique, unlike SKU. The route is /shop/product/:slug with no shop
  -- segment, so two shops sharing a slug would make .single() return 406.
  slug              TEXT NOT NULL UNIQUE,
  title             TEXT NOT NULL,
  description       TEXT,
  category_slug     TEXT REFERENCES public.product_categories(slug) ON DELETE SET NULL,
  condition         public.product_condition NOT NULL DEFAULT 'new',
  status            public.product_status NOT NULL DEFAULT 'draft',
  -- Seller's own switch, meaningful only once status='approved'.
  is_published      BOOLEAN NOT NULL DEFAULT false,
  -- Deliberately a boolean, not a nullable count: "unknown stock" as a third
  -- state produced three renderings of two facts.
  in_stock          BOOLEAN NOT NULL DEFAULT true,
  -- Shown as "shop cập nhật lúc …", never as a platform guarantee.
  availability_updated_at TIMESTAMPTZ,
  submitted_at      TIMESTAMPTZ,
  decided_at        TIMESTAMPTZ,
  decided_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  applicant_note    TEXT,   -- seller-visible
  internal_note     TEXT,   -- admin-only, never selected by a seller policy
  requested_fields  TEXT[] NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT products_title_len CHECK (char_length(btrim(title)) BETWEEN 3 AND 140),
  CONSTRAINT products_desc_len  CHECK (description IS NULL OR char_length(description) <= 4000),
  -- Nothing may be published unless it was approved. Enforced in the table, so
  -- a future RPC bug cannot publish a draft.
  CONSTRAINT products_publish_requires_approval CHECK (
    is_published = false OR status = 'approved'
  ),
  -- Lets product_variants carry a composite FK, so Postgres — not a trigger —
  -- guarantees a variant's shop_id matches its product's.
  CONSTRAINT products_id_shop_unique UNIQUE (id, shop_id)
);

CREATE INDEX IF NOT EXISTS idx_products_shop        ON public.products (shop_id);
CREATE INDEX IF NOT EXISTS idx_products_queue       ON public.products (status, submitted_at)
  WHERE status IN ('pending_review', 'needs_changes');
CREATE INDEX IF NOT EXISTS idx_products_public      ON public.products (category_slug)
  WHERE status = 'approved' AND is_published;

COMMENT ON TABLE public.products IS
  'Marketplace product. Public only when status=approved AND is_published AND the shop is active. See migration 20260811120000.';

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- ─── 5. Variants ────────────────────────────────────────────────────────────
-- Price and stock live here, always. A product with no options still gets
-- exactly one variant row, so Phase 3 orders reference a variant_id
-- unconditionally instead of branching on "does this product have options".

CREATE TABLE IF NOT EXISTS public.product_variants (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id            UUID NOT NULL,
  shop_id               UUID NOT NULL,
  name                  TEXT,
  sku                   TEXT,
  price_vnd             INTEGER NOT NULL,
  compare_at_price_vnd  INTEGER,
  stock                 INTEGER,
  position              INTEGER NOT NULL DEFAULT 0,
  -- Mirrors products.status='archived', maintained by trigger. Exists only so
  -- the SKU uniqueness index can exclude archived rows: a partial index cannot
  -- reach into another table.
  archived              BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (product_id, shop_id)
    REFERENCES public.products(id, shop_id) ON DELETE CASCADE,
  -- VND is an integer currency. Never float.
  CONSTRAINT product_variants_price_range CHECK (price_vnd BETWEEN 0 AND 2000000000),
  CONSTRAINT product_variants_compare_range CHECK (
    compare_at_price_vnd IS NULL
    OR (compare_at_price_vnd BETWEEN 0 AND 2000000000 AND compare_at_price_vnd > price_vnd)
  ),
  CONSTRAINT product_variants_stock_range CHECK (stock IS NULL OR stock >= 0),
  CONSTRAINT product_variants_name_len CHECK (name IS NULL OR char_length(name) <= 80),
  CONSTRAINT product_variants_sku_len  CHECK (sku IS NULL OR char_length(sku) <= 64)
);

-- SKU is unique PER SHOP, not globally and not per product.
--   * global loses to reality — shop B cannot store a code shop A already used,
--     and the error is unexplainable to either of them;
--   * per product allows one shop to hold the same code twice, which is exactly
--     the case where scanning a code pulls the wrong item.
-- Case- and whitespace-insensitive, because the seller typing it is a human.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_product_variants_sku_per_shop
  ON public.product_variants (shop_id, upper(btrim(sku)))
  WHERE sku IS NOT NULL AND btrim(sku) <> '' AND archived = false;

CREATE INDEX IF NOT EXISTS idx_product_variants_product
  ON public.product_variants (product_id, position);

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

-- ─── 6. Media (D1: private draft, public rendition only when approved) ──────

CREATE TABLE IF NOT EXISTS public.product_media (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID NOT NULL,
  shop_id      UUID NOT NULL,
  -- Object key inside the PRIVATE bucket. Always present: the original never
  -- leaves the private side, whatever happens to the rendition.
  draft_path   TEXT NOT NULL,
  -- Object key inside the PUBLIC bucket. NULL until approved+published, and
  -- NULL again the moment either stops being true.
  public_path  TEXT,
  state        public.product_media_state NOT NULL DEFAULT 'draft',
  alt_text     TEXT,
  position     INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (product_id, shop_id)
    REFERENCES public.products(id, shop_id) ON DELETE CASCADE,
  CONSTRAINT product_media_alt_len CHECK (alt_text IS NULL OR char_length(alt_text) <= 200),
  -- The invariant D1 is actually about: a row that is not approved cannot be
  -- carrying a public rendition, no matter which code path wrote it.
  CONSTRAINT product_media_public_requires_approved CHECK (
    (state = 'approved' AND public_path IS NOT NULL)
    OR (state = 'draft'  AND public_path IS NULL)
  ),
  CONSTRAINT product_media_draft_path_scope CHECK (draft_path LIKE (shop_id::text || '/%')),
  CONSTRAINT product_media_public_path_scope CHECK (
    public_path IS NULL OR public_path LIKE (shop_id::text || '/%')
  )
);

CREATE INDEX IF NOT EXISTS idx_product_media_product
  ON public.product_media (product_id, position);

ALTER TABLE public.product_media ENABLE ROW LEVEL SECURITY;

-- ─── 7. Public projection ───────────────────────────────────────────────────
-- One definition of "publicly visible", used by the buyer surface in P2b AND
-- by the seller preview in P2a step 7. A preview that renders from the seller
-- projection is a preview of something no buyer will ever see.

CREATE OR REPLACE VIEW public.public_products
WITH (security_invoker = true)
AS
  SELECT
    p.id, p.shop_id, p.slug, p.title, p.description, p.category_slug,
    p.condition, p.in_stock, p.availability_updated_at, p.created_at,
    s.slug AS shop_slug, s.name AS shop_name
  FROM public.products p
  JOIN public.shops s ON s.id = p.shop_id
  WHERE p.status = 'approved' AND p.is_published AND s.state = 'active';

COMMENT ON VIEW public.public_products IS
  'The only definition of publicly visible. security_invoker: RLS on products and shops still applies.';

GRANT SELECT ON public.public_products TO anon, authenticated;

-- ─── 8. RLS ─────────────────────────────────────────────────────────────────

-- products: public sees approved+published in an active shop; members see
-- their own shop's rows; admins see everything.
DROP POLICY IF EXISTS "products_select_public" ON public.products;
CREATE POLICY "products_select_public" ON public.products
  FOR SELECT
  USING (
    status = 'approved'
    AND is_published
    AND EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.state = 'active')
  );

DROP POLICY IF EXISTS "products_select_member" ON public.products;
CREATE POLICY "products_select_member" ON public.products
  FOR SELECT TO authenticated
  USING (public.is_shop_member(shop_id) OR public.is_admin());

DROP POLICY IF EXISTS "products_insert_manager" ON public.products;
CREATE POLICY "products_insert_manager" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (public.is_shop_manager(shop_id));

DROP POLICY IF EXISTS "products_update_manager" ON public.products;
CREATE POLICY "products_update_manager" ON public.products
  FOR UPDATE TO authenticated
  USING (public.is_shop_manager(shop_id))
  WITH CHECK (public.is_shop_manager(shop_id));

DROP POLICY IF EXISTS "products_admin_write" ON public.products;
CREATE POLICY "products_admin_write" ON public.products
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- No DELETE policy for sellers: a sold product that vanishes takes its order
-- history with it. Sellers archive; only an admin deletes.

-- variants + media follow their product's shop.
DROP POLICY IF EXISTS "product_variants_select_public" ON public.product_variants;
CREATE POLICY "product_variants_select_public" ON public.product_variants
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.public_products pp WHERE pp.id = product_id));

DROP POLICY IF EXISTS "product_variants_select_member" ON public.product_variants;
CREATE POLICY "product_variants_select_member" ON public.product_variants
  FOR SELECT TO authenticated
  USING (public.is_shop_member(shop_id) OR public.is_admin());

DROP POLICY IF EXISTS "product_variants_write_manager" ON public.product_variants;
CREATE POLICY "product_variants_write_manager" ON public.product_variants
  FOR ALL TO authenticated
  USING (public.is_shop_manager(shop_id))
  WITH CHECK (public.is_shop_manager(shop_id));

DROP POLICY IF EXISTS "product_media_select_public" ON public.product_media;
CREATE POLICY "product_media_select_public" ON public.product_media
  FOR SELECT
  USING (
    state = 'approved'
    AND EXISTS (SELECT 1 FROM public.public_products pp WHERE pp.id = product_id)
  );

DROP POLICY IF EXISTS "product_media_select_member" ON public.product_media;
CREATE POLICY "product_media_select_member" ON public.product_media
  FOR SELECT TO authenticated
  USING (public.is_shop_member(shop_id) OR public.is_admin());

DROP POLICY IF EXISTS "product_media_write_manager" ON public.product_media;
CREATE POLICY "product_media_write_manager" ON public.product_media
  FOR ALL TO authenticated
  USING (public.is_shop_manager(shop_id))
  WITH CHECK (public.is_shop_manager(shop_id));

-- The grant block. A policy without a grant is a wall with no door; a grant
-- without a policy is a door with no wall. This repo has shipped both.
GRANT SELECT                         ON public.products         TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products         TO authenticated;
GRANT SELECT                         ON public.product_variants TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT SELECT                         ON public.product_media    TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_media    TO authenticated;

-- ─── 9. Column guards ───────────────────────────────────────────────────────
-- RLS decides WHO may update a row. It says nothing about WHICH COLUMNS, so
-- without this a manager could PATCH status='approved' straight past the queue.

CREATE OR REPLACE FUNCTION public.products_guard_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- The transition RPCs below set this for the duration of their own
  -- transaction; nothing else can, because nothing else is SECURITY DEFINER.
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
  NEW.updated_at       := now();

  -- in_stock is deliberately NOT pinned. A seller flipping "hết hàng" at 11pm
  -- must not be pushed into the review queue to do it.
  IF NEW.in_stock IS DISTINCT FROM OLD.in_stock THEN
    NEW.availability_updated_at := now();
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS products_guard_privileged_columns_trg ON public.products;
CREATE TRIGGER products_guard_privileged_columns_trg
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.products_guard_privileged_columns();

CREATE OR REPLACE FUNCTION public.products_set_insert_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('shop.privileged_write', true) = 'on' OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  -- A seller creating a product always creates a draft, whatever they sent.
  NEW.status           := 'draft';
  NEW.is_published     := false;
  NEW.submitted_at     := NULL;
  NEW.decided_at       := NULL;
  NEW.decided_by       := NULL;
  NEW.applicant_note   := NULL;
  NEW.internal_note    := NULL;
  NEW.requested_fields := '{}';
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS products_set_insert_defaults_trg ON public.products;
CREATE TRIGGER products_set_insert_defaults_trg
  BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.products_set_insert_defaults();

-- Media: state and public_path are never client-writable. The CHECK above
-- makes an inconsistent pair impossible; this makes a consistent-but-forged
-- pair impossible too.
CREATE OR REPLACE FUNCTION public.product_media_guard_rendition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('shop.privileged_write', true) = 'on' OR public.is_admin() THEN
    IF TG_OP = 'UPDATE' THEN NEW.updated_at := now(); END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.state       := 'draft';
    NEW.public_path := NULL;
  ELSE
    NEW.state       := OLD.state;
    NEW.public_path := OLD.public_path;
    NEW.draft_path  := OLD.draft_path;
    NEW.shop_id     := OLD.shop_id;
    NEW.product_id  := OLD.product_id;
    NEW.updated_at  := now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS product_media_guard_rendition_trg ON public.product_media;
CREATE TRIGGER product_media_guard_rendition_trg
  BEFORE INSERT OR UPDATE ON public.product_media
  FOR EACH ROW EXECUTE FUNCTION public.product_media_guard_rendition();

-- Keep product_variants.archived in step with products.status.
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

DROP TRIGGER IF EXISTS product_variants_sync_archived_trg ON public.products;
CREATE TRIGGER product_variants_sync_archived_trg
  AFTER UPDATE OF status ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.product_variants_sync_archived();

-- ─── 10. Storage buckets (D1) ───────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  -- Originals and everything not yet approved. 8 MB because a phone camera
  -- photo is 3–5 MB and a 2 MB limit turns "no products" into a measurement
  -- artefact rather than a finding.
  ('shop-product-media-draft', 'shop-product-media-draft', false, 8388608,
   ARRAY['image/jpeg', 'image/png', 'image/webp']),
  -- Approved renditions only. Public so the Supabase CDN image transform can
  -- run — it only works on public buckets, and the buyer surface needs it.
  ('shop-product-media', 'shop-product-media', true, 8388608,
   ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Draft bucket: a manager reads and writes inside their own shop's folder,
-- and nowhere else. Path convention is `<shop_id>/<product_id>/<random>.<ext>`
-- so folder scoping is a shop boundary, not a user boundary — a manager who
-- leaves the shop loses the folder with their membership.
DROP POLICY IF EXISTS "shop_product_media_draft_select" ON storage.objects;
CREATE POLICY "shop_product_media_draft_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'shop-product-media-draft'
    AND (
      public.is_shop_member(((storage.foldername(name))[1])::uuid)
      OR public.is_admin()
    )
  );

DROP POLICY IF EXISTS "shop_product_media_draft_insert" ON storage.objects;
CREATE POLICY "shop_product_media_draft_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'shop-product-media-draft'
    AND public.is_shop_manager(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "shop_product_media_draft_update" ON storage.objects;
CREATE POLICY "shop_product_media_draft_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'shop-product-media-draft'
    AND public.is_shop_manager(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "shop_product_media_draft_delete" ON storage.objects;
CREATE POLICY "shop_product_media_draft_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'shop-product-media-draft'
    AND public.is_shop_manager(((storage.foldername(name))[1])::uuid)
  );

-- Public bucket: readable by everyone, writable by NOBODY holding a user JWT.
-- There is deliberately no INSERT/UPDATE/DELETE policy — only service_role,
-- which bypasses RLS, may put an approved rendition there. This is the line
-- D1 draws: a seller cannot promote their own object.
DROP POLICY IF EXISTS "shop_product_media_public_select" ON storage.objects;
CREATE POLICY "shop_product_media_public_select" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'shop-product-media');

-- ─── 11. Transitions ────────────────────────────────────────────────────────
-- Every status change is a guarded UPDATE with the expected state in the WHERE
-- clause, so two concurrent callers cannot both win. No client ever writes
-- products.status.

CREATE OR REPLACE FUNCTION public.product_submit_for_review(_product_id UUID)
RETURNS public.product_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row      public.products%ROWTYPE;
  _variants INTEGER;
  _media    INTEGER;
BEGIN
  SELECT * INTO _row FROM public.products WHERE id = _product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT public.is_shop_manager(_row.shop_id) THEN
    RAISE EXCEPTION 'not a manager of this shop' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF _row.status NOT IN ('draft', 'needs_changes') THEN
    RAISE EXCEPTION 'product is % — only draft or needs_changes may be submitted', _row.status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Server-side validation. The client form shares these rules but does not
  -- own them: a submission that skipped the form must fail the same way.
  IF _row.category_slug IS NULL THEN
    RAISE EXCEPTION 'category is required' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  SELECT count(*) INTO _variants FROM public.product_variants WHERE product_id = _product_id;
  IF _variants < 1 THEN
    RAISE EXCEPTION 'at least one variant with a price is required' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  SELECT count(*) INTO _media FROM public.product_media WHERE product_id = _product_id;
  IF _media < 1 THEN
    RAISE EXCEPTION 'at least one photo is required' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  PERFORM set_config('shop.privileged_write', 'on', true);
  UPDATE public.products
  SET status = 'pending_review', submitted_at = now(), requested_fields = '{}'
  WHERE id = _product_id AND status = _row.status;
  PERFORM set_config('shop.privileged_write', 'off', true);

  RETURN 'pending_review';
END $$;

CREATE OR REPLACE FUNCTION public.product_withdraw_submission(_product_id UUID)
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
  IF NOT public.is_shop_manager(_row.shop_id) THEN
    RAISE EXCEPTION 'not a manager of this shop' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF _row.status <> 'pending_review' THEN
    RAISE EXCEPTION 'product is % — only pending_review may be withdrawn', _row.status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  PERFORM set_config('shop.privileged_write', 'on', true);
  UPDATE public.products
  SET status = 'draft', submitted_at = NULL
  WHERE id = _product_id AND status = 'pending_review';
  PERFORM set_config('shop.privileged_write', 'off', true);

  RETURN 'draft';
END $$;

-- The moderation decision. P2b builds the screen; the rule lives here, so the
-- screen cannot invent a different one.
CREATE OR REPLACE FUNCTION public.product_decide(
  _product_id       UUID,
  _decision         TEXT,
  _applicant_note   TEXT DEFAULT NULL,
  _internal_note    TEXT DEFAULT NULL,
  _requested_fields TEXT[] DEFAULT '{}'
)
RETURNS public.product_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row  public.products%ROWTYPE;
  _next public.product_status;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin required' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF _decision NOT IN ('approve', 'reject', 'request_changes') THEN
    RAISE EXCEPTION 'unknown decision %', _decision USING ERRCODE = 'invalid_parameter_value';
  END IF;
  -- A rejection or a change request the seller cannot read is a dead end.
  IF _decision <> 'approve' AND coalesce(btrim(_applicant_note), '') = '' THEN
    RAISE EXCEPTION 'reject and request_changes require a note for the seller'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT * INTO _row FROM public.products WHERE id = _product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF _row.status <> 'pending_review' THEN
    RAISE EXCEPTION 'product is % — only pending_review may be decided', _row.status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  _next := CASE _decision
             WHEN 'approve' THEN 'approved'
             WHEN 'reject'  THEN 'rejected'
             ELSE 'needs_changes'
           END::public.product_status;

  PERFORM set_config('shop.privileged_write', 'on', true);

  -- Guarded on the status we read under the lock: two moderators deciding at
  -- once produce one decision, not two.
  UPDATE public.products
  SET status = _next,
      decided_at = now(),
      decided_by = auth.uid(),
      applicant_note = _applicant_note,
      internal_note = _internal_note,
      requested_fields = CASE WHEN _decision = 'request_changes' THEN _requested_fields ELSE '{}' END
  WHERE id = _product_id AND status = 'pending_review';

  -- Rejection revokes any rendition immediately (D1). Approval does NOT create
  -- one: publishing is the seller's separate act.
  IF _decision <> 'approve' THEN
    UPDATE public.product_media
    SET state = 'draft', public_path = NULL
    WHERE product_id = _product_id AND state = 'approved';
  END IF;

  PERFORM set_config('shop.privileged_write', 'off', true);

  PERFORM public.log_audit_event(
    ('shop_product_' || _decision)::text,
    'admin'::text,
    'shop_product'::text,
    _product_id::text,
    (CASE WHEN _decision = 'reject' THEN 'warning' ELSE 'info' END)::text,
    jsonb_build_object('shop_id', _row.shop_id, 'requested_fields', _requested_fields),
    'user'::text
  );

  RETURN _next;
END $$;

-- Publish / unpublish. This is the only place a public rendition is created or
-- taken away, which is why it is also the only place that touches public_path.
CREATE OR REPLACE FUNCTION public.product_set_published(_product_id UUID, _published BOOLEAN)
RETURNS BOOLEAN
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
  IF NOT (public.is_shop_manager(_row.shop_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'not a manager of this shop' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF _published AND _row.status <> 'approved' THEN
    RAISE EXCEPTION 'product is % — only an approved product may be published', _row.status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  PERFORM set_config('shop.privileged_write', 'on', true);

  UPDATE public.products SET is_published = _published WHERE id = _product_id;

  IF _published THEN
    -- Deterministic rendition key derived from the draft object, so the copy
    -- step is idempotent and the URL is stable across republishes.
    UPDATE public.product_media
    SET state = 'approved',
        public_path = shop_id::text || '/' || product_id::text || '/' || id::text || '.webp'
    WHERE product_id = _product_id AND state = 'draft';
  ELSE
    UPDATE public.product_media
    SET state = 'draft', public_path = NULL
    WHERE product_id = _product_id AND state = 'approved';
  END IF;

  PERFORM set_config('shop.privileged_write', 'off', true);

  RETURN _published;
END $$;

-- Availability, kept out of the moderation path on purpose.
CREATE OR REPLACE FUNCTION public.product_set_in_stock(
  _product_id UUID,
  _expected   BOOLEAN,
  _next       BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _shop_id UUID;
  _hit     INTEGER;
BEGIN
  SELECT shop_id INTO _shop_id FROM public.products WHERE id = _product_id;
  IF _shop_id IS NULL THEN
    RAISE EXCEPTION 'product not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT public.is_shop_manager(_shop_id) THEN
    RAISE EXCEPTION 'not a manager of this shop' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- The expected value is in the WHERE clause, not in a prior SELECT the
  -- client compared against. 0 rows means somebody else changed it first.
  UPDATE public.products
  SET in_stock = _next, availability_updated_at = now()
  WHERE id = _product_id AND in_stock = _expected;
  GET DIAGNOSTICS _hit = ROW_COUNT;

  RETURN _hit = 1;
END $$;

CREATE OR REPLACE FUNCTION public.product_archive(_product_id UUID)
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
  IF NOT (public.is_shop_manager(_row.shop_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'not a manager of this shop' USING ERRCODE = 'insufficient_privilege';
  END IF;

  PERFORM set_config('shop.privileged_write', 'on', true);
  UPDATE public.products
  SET status = 'archived', is_published = false
  WHERE id = _product_id AND status <> 'archived';
  UPDATE public.product_media
  SET state = 'draft', public_path = NULL
  WHERE product_id = _product_id AND state = 'approved';
  PERFORM set_config('shop.privileged_write', 'off', true);

  RETURN 'archived';
END $$;

-- Slug generation reuses the Phase 1 helper, which is the one that was fixed
-- after it corrupted every Vietnamese name. Collisions get a short suffix
-- rather than an error the seller cannot act on.
CREATE OR REPLACE FUNCTION public.product_slug_from_title(_title TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _base TEXT;
  _try  TEXT;
  _n    INTEGER := 0;
BEGIN
  _base := public.shop_slug_from_name(_title);
  IF _base = 'shop' THEN _base := 'san-pham'; END IF;
  _try := _base;
  WHILE EXISTS (SELECT 1 FROM public.products WHERE slug = _try) LOOP
    _n := _n + 1;
    _try := _base || '-' || _n::text;
  END LOOP;
  RETURN _try;
END $$;

REVOKE ALL ON FUNCTION public.product_submit_for_review(UUID)      FROM PUBLIC;
REVOKE ALL ON FUNCTION public.product_withdraw_submission(UUID)    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.product_decide(UUID, TEXT, TEXT, TEXT, TEXT[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.product_set_published(UUID, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.product_set_in_stock(UUID, BOOLEAN, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.product_archive(UUID)                FROM PUBLIC;
REVOKE ALL ON FUNCTION public.product_slug_from_title(TEXT)        FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.product_submit_for_review(UUID)      TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.product_withdraw_submission(UUID)    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.product_decide(UUID, TEXT, TEXT, TEXT, TEXT[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.product_set_published(UUID, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.product_set_in_stock(UUID, BOOLEAN, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.product_archive(UUID)                TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.product_slug_from_title(TEXT)        TO authenticated, service_role;
