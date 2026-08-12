-- ============================================================================
-- Shop P2b step 3 — the public read model.
--
-- P2b.4/P2b.5 render buyer screens. This file decides what a buyer can be
-- shown at all, and it does it in one place so five surfaces cannot disagree.
--
-- ── The leak this checkpoint found ─────────────────────────────────────────
-- product_public_projection returned `media[].path = rendition_source_path`
-- to BOTH readers. That column is the client-processed WebP in the DRAFT
-- bucket — the object product_publish_prepare copies FROM. The public reader
-- was therefore handed a private storage path for every photo.
--
-- The P2a assertions did not catch it because they searched for `draft_path`
-- and `/original`, and this is a third column with neither name in it. Fixed
-- the same way stock_on_hand already was: seller-only, by construction.
--
-- ── One derivation, two doors ──────────────────────────────────────────────
-- The canonical projection stays the single definition of "what a product
-- looks like". What P2b adds is doors that cannot be asked the wrong
-- question:
--
--   shop_public_product(slug)    no privilege flag, resolves slug history
--   shop_public_shop(slug)       no privilege flag
--   shop_public_search(...)      discovery, category and search are one query
--   shop_public_categories()     taxonomy with counts of REAL publishable rows
--
-- product_public_projection(id, _as_seller) stays as the internal
-- implementation. Nothing public accepts a boolean any more, so the
-- escalation class is gone at the edge rather than defended at the centre.
--
-- ── Publishable, defined once ──────────────────────────────────────────────
-- A product is publicly visible only when ALL of these hold:
--
--   product approved · is_published · shop active · category active ·
--   at least one COMMITTED public rendition · at least one live variant
--
-- The last two are new here. P2a's rule stopped at approved+published+active
-- shop, which would let a product whose bytes the worker has not copied yet
-- appear in a list with a broken image, and would show a product whose only
-- variant was retired.
-- ============================================================================

-- ─── 1. Stop handing a draft path to the public reader ──────────────────────

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
    'shop', jsonb_build_object(
      'slug',   _shop.slug,
      'name',   _shop.name,
      'region', _shop.region,
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
               -- `path` is rendition_source_path: the WebP sitting in the
               -- DRAFT bucket that the worker copies FROM. It is a private
               -- object, and the public reader used to receive it for every
               -- photo. Seller-only now, by construction rather than by a
               -- caller remembering to strip it.
               'path',     CASE WHEN _as_seller
                                THEN to_jsonb(m.rendition_source_path)
                                ELSE 'null'::jsonb END,
               'public_path', m.public_path,
               'width',    m.width,
               'height',   m.height
             ) ORDER BY m.position, m.created_at)
      FROM public.product_media m
      WHERE m.product_id = _p.id
        AND m.verified_at IS NOT NULL
        -- A buyer is only ever shown bytes that exist in the public bucket.
        -- The seller preview still sees everything verified, because that is
        -- what they are previewing.
        AND (_as_seller OR m.public_path IS NOT NULL)
    ), '[]'::jsonb),
    'primary_media_id', (
      SELECT m.id FROM public.product_media m
      WHERE m.product_id = _p.id
        AND m.verified_at IS NOT NULL
        AND (_as_seller OR m.public_path IS NOT NULL)
      ORDER BY m.position, m.created_at LIMIT 1
    ),
    'in_stock',                _p.in_stock,
    'availability_updated_at', _p.availability_updated_at,
    'status',       CASE WHEN _as_seller THEN to_jsonb(_p.status) ELSE 'null'::jsonb END,
    'is_published', _p.is_published,
    'shop_state',   CASE WHEN _as_seller THEN to_jsonb(_shop.state) ELSE 'null'::jsonb END,
    'applicant_note', CASE WHEN _as_seller THEN to_jsonb(_p.applicant_note) ELSE 'null'::jsonb END,
    'version',      CASE WHEN _as_seller THEN to_jsonb(_p.version) ELSE 'null'::jsonb END,
    'is_preview',   _as_seller
  ) INTO _out;

  RETURN _out;
END $$;

REVOKE ALL   ON FUNCTION public.product_public_projection(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.product_public_projection(UUID, BOOLEAN) TO anon, authenticated, service_role;

-- ─── 2. "Publishable", written once ─────────────────────────────────────────
-- Every public surface filters on this predicate. Five copies of an almost
-- identical WHERE clause is how a suspended product survives on one screen.

CREATE OR REPLACE FUNCTION public.shop_product_is_publishable(_product_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.products p
    JOIN public.shops s              ON s.id = p.shop_id
    JOIN public.product_categories c ON c.slug = p.category_slug
    WHERE p.id = _product_id
      AND p.status = 'approved'
      AND p.is_published
      AND s.state = 'active'
      AND c.is_active
      -- The bytes exist in the public bucket. Without this, a product whose
      -- worker job has not run yet appears in a list with a broken image.
      AND EXISTS (SELECT 1 FROM public.product_media m
                  WHERE m.product_id = p.id AND m.public_path IS NOT NULL)
      -- And something is actually for sale.
      AND EXISTS (SELECT 1 FROM public.product_variants v
                  WHERE v.product_id = p.id AND v.retired_at IS NULL)
  )
$$;

REVOKE ALL   ON FUNCTION public.shop_product_is_publishable(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_product_is_publishable(UUID) TO anon, authenticated, service_role;

-- ─── 3. Search document ─────────────────────────────────────────────────────
-- `to_tsvector('simple', ...)` over unaccent_immutable() — the repo's own two
-- conventions, combined. 'simple' because there is no Vietnamese stemmer and
-- an English one would stem Vietnamese words into nonsense; unaccent so that
-- "vot" finds "vợt", which is how people actually type on a phone.
--
-- A generated column rather than a trigger: it cannot drift from the row, and
-- it cannot be forgotten by a new write path.

-- search_doc is a GENERATED column, so unaccent_immutable() now runs on every
-- write to products — including writes by service_role (the media worker) and
-- reads planned for anon. Phase 1 granted it to `authenticated` only, which
-- turned the storage-integration suite red with "permission denied for
-- function unaccent_immutable" the moment the column existed. It is pure text
-- manipulation with no data access.
GRANT EXECUTE ON FUNCTION public.unaccent_immutable(TEXT) TO anon, service_role;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS search_doc tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', public.unaccent_immutable(coalesce(title, ''))), 'A') ||
    setweight(to_tsvector('simple', public.unaccent_immutable(coalesce(description, ''))), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_products_search_doc
  ON public.products USING gin (search_doc)
  WHERE status = 'approved' AND is_published;

-- The list query's own index: the public filter, then the sort key, then the
-- tie-breaker the cursor needs.
CREATE INDEX IF NOT EXISTS idx_products_public_recent
  ON public.products (created_at DESC, id DESC)
  WHERE status = 'approved' AND is_published;

CREATE INDEX IF NOT EXISTS idx_products_public_category_recent
  ON public.products (category_slug, created_at DESC, id DESC)
  WHERE status = 'approved' AND is_published;

CREATE INDEX IF NOT EXISTS idx_products_public_shop_recent
  ON public.products (shop_id, created_at DESC, id DESC)
  WHERE status = 'approved' AND is_published;

-- ─── 4. The card DTO ────────────────────────────────────────────────────────
-- Deliberately NOT the full projection. A card needs eight fields; calling the
-- projection per row would be an N+1 with a JSON builder attached, and it
-- would hand every card a full variant and media array.

CREATE OR REPLACE FUNCTION public.shop_public_search(
  _q             TEXT    DEFAULT NULL,
  _category_slug TEXT    DEFAULT NULL,
  _shop_slug     TEXT    DEFAULT NULL,
  _condition     TEXT    DEFAULT NULL,
  _in_stock_only BOOLEAN DEFAULT false,
  _sort          TEXT    DEFAULT 'recent',
  _cursor_at     TIMESTAMPTZ DEFAULT NULL,
  _cursor_id     UUID    DEFAULT NULL,
  _limit         INTEGER DEFAULT 24
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _n     INTEGER := least(greatest(coalesce(_limit, 24), 1), 48);
  _tsq   tsquery;
  _rows  JSONB;
  _total INTEGER;
  _more  BOOLEAN;
BEGIN
  IF _sort NOT IN ('recent', 'price_asc', 'price_desc') THEN
    RAISE EXCEPTION 'unknown sort %', _sort USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF _condition IS NOT NULL AND _condition NOT IN ('new', 'used') THEN
    RAISE EXCEPTION 'unknown condition %', _condition USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- websearch_to_tsquery never raises on user input; plainto_ would choke on
  -- an unbalanced quote and turn a typo into a 500.
  IF coalesce(btrim(_q), '') <> '' THEN
    _tsq := websearch_to_tsquery('simple', public.unaccent_immutable(btrim(_q)));
  END IF;

  -- Two passes, on purpose.
  --
  -- The first version computed price_min/price_max/availability/cover for
  -- EVERY matching row and then counted them, because `total` was a count over
  -- the same CTE the page came from. On 10k products that was 122,819 buffers
  -- and 57.9 ms for a 24-row first page — the N+1 this design exists to avoid,
  -- moved into the count where it was harder to see.
  --
  -- So: narrow first (ids and the sort key, every filter an EXISTS the indexes
  -- can serve), count that, then pay for the expensive per-row fields on the
  -- ≤25 rows actually being returned.
  WITH visible AS (
    SELECT p.id, p.created_at
    FROM public.products p
    JOIN public.shops s              ON s.id = p.shop_id
    JOIN public.product_categories c ON c.slug = p.category_slug
    WHERE p.status = 'approved'
      AND p.is_published
      AND s.state = 'active'
      AND c.is_active
      AND EXISTS (SELECT 1 FROM public.product_media m
                  WHERE m.product_id = p.id AND m.public_path IS NOT NULL)
      AND EXISTS (SELECT 1 FROM public.product_variants v
                  WHERE v.product_id = p.id AND v.retired_at IS NULL)
      AND (_tsq IS NULL OR p.search_doc @@ _tsq)
      AND (_category_slug IS NULL OR p.category_slug = _category_slug)
      AND (_shop_slug IS NULL OR s.slug = _shop_slug)
      AND (_condition IS NULL OR p.condition::text = _condition)
      -- "In stock" as an EXISTS rather than a label: a buyer filtering for it
      -- means "something here is buyable", and asking that question does not
      -- require computing the label for rows nobody will see.
      AND (NOT _in_stock_only OR EXISTS (
            SELECT 1 FROM public.product_variants v
            WHERE v.product_id = p.id AND v.retired_at IS NULL AND v.stock_on_hand > 0))
  ),
  page AS (
    SELECT v.id, v.created_at
    FROM visible v
    WHERE _cursor_at IS NULL
       OR (v.created_at, v.id) < (_cursor_at, _cursor_id)
    ORDER BY v.created_at DESC, v.id DESC
    LIMIT _n + 1
  ),
  kept AS (
    SELECT * FROM page ORDER BY created_at DESC, id DESC LIMIT _n
  )
  SELECT
    coalesce(jsonb_agg(card ORDER BY (card ->> 'created_at') DESC, (card ->> 'id') DESC), '[]'::jsonb),
    (SELECT count(*)::int FROM visible),
    (SELECT count(*) FROM page) > _n
  INTO _rows, _total, _more
  FROM (
    SELECT jsonb_build_object(
             'id', p.id, 'slug', p.slug, 'title', p.title,
             'condition', p.condition, 'created_at', k.created_at,
             'category', jsonb_build_object('slug', c.slug, 'name', c.name_vi),
             'shop', jsonb_build_object('slug', s.slug, 'name', s.name,
                                        'verified', s.verified_at IS NOT NULL),
             'price_min', (SELECT min(v.price_vnd) FROM public.product_variants v
                           WHERE v.product_id = p.id AND v.retired_at IS NULL),
             'price_max', (SELECT max(v.price_vnd) FROM public.product_variants v
                           WHERE v.product_id = p.id AND v.retired_at IS NULL),
             'availability', (
               SELECT CASE
                        WHEN bool_or(v.stock_on_hand > 0) THEN 'in_stock'
                        WHEN bool_or(v.stock_on_hand IS NULL) THEN 'unknown'
                        ELSE 'out_of_stock'
                      END
               FROM public.product_variants v
               WHERE v.product_id = p.id AND v.retired_at IS NULL),
             'cover', (SELECT jsonb_build_object('public_path', m.public_path,
                                                 'alt_text', m.alt_text,
                                                 'width', m.width, 'height', m.height)
                       FROM public.product_media m
                       WHERE m.product_id = p.id AND m.public_path IS NOT NULL
                       ORDER BY m.position, m.created_at LIMIT 1)
           ) AS card
    FROM kept k
    JOIN public.products p           ON p.id = k.id
    JOIN public.shops s              ON s.id = p.shop_id
    JOIN public.product_categories c ON c.slug = p.category_slug
  ) cards;

  RETURN jsonb_build_object(
    'rows',     _rows,
    'total',    _total,
    'has_more', _more
  );
END $$;

REVOKE ALL   ON FUNCTION public.shop_public_search(TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TIMESTAMPTZ, UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_public_search(TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TIMESTAMPTZ, UUID, INTEGER) TO anon, authenticated, service_role;

-- ─── 5. PDP by slug, with the redirect answer in the same call ──────────────
-- The renderer needs three outcomes from one round trip: here it is, it moved,
-- or there is nothing. A separate "does this slug exist" call would be a
-- second query AND an oracle for private ids.

CREATE OR REPLACE FUNCTION public.shop_public_product(_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id       UUID;
  _redirect TEXT;
BEGIN
  SELECT id INTO _id FROM public.products WHERE slug = _slug;

  IF _id IS NOT NULL AND public.shop_product_is_publishable(_id) THEN
    RETURN jsonb_build_object(
      'found',   true,
      'product', public.product_public_projection(_id, false),
      'contacts', public.shop_public_contacts_for_product(_id));
  END IF;

  -- Not publishable — including "exists but is a draft". Fall through to the
  -- history so a renamed product still resolves, and answer identically for a
  -- draft and for a slug nobody ever used: a different reply would tell a
  -- stranger which private slugs are real.
  SELECT p.slug INTO _redirect
  FROM public.product_slug_history h
  JOIN public.products p ON p.id = h.product_id
  WHERE h.slug = _slug AND public.shop_product_is_publishable(p.id);

  IF _redirect IS NOT NULL THEN
    RETURN jsonb_build_object('found', false, 'redirect_to', _redirect);
  END IF;

  RETURN jsonb_build_object('found', false, 'redirect_to', NULL);
END $$;

REVOKE ALL   ON FUNCTION public.shop_public_product(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_public_product(TEXT) TO anon, authenticated, service_role;

-- ─── 6. Public contact channels ─────────────────────────────────────────────
-- approved AND is_public AND shop active — all three, in SQL, once.

CREATE OR REPLACE FUNCTION public.shop_public_contacts(_shop_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id',    ch.id,
           'type',  ch.type,
           -- The server-derived destination. The client never builds a link
           -- out of value_raw, so a malicious stored value cannot become one.
           'href',  ch.value_normalized,
           'label', ch.display_label
         ) ORDER BY ch.created_at), '[]'::jsonb)
  FROM public.shop_contact_channels ch
  JOIN public.shops s ON s.id = ch.shop_id
  WHERE ch.shop_id = _shop_id
    AND ch.state = 'approved'
    AND ch.is_public
    AND s.state = 'active'
$$;

CREATE OR REPLACE FUNCTION public.shop_public_contacts_for_product(_product_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.shop_public_contacts(p.shop_id)
  FROM public.products p WHERE p.id = _product_id
$$;

REVOKE ALL   ON FUNCTION public.shop_public_contacts(UUID)             FROM PUBLIC;
REVOKE ALL   ON FUNCTION public.shop_public_contacts_for_product(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_public_contacts(UUID)             TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.shop_public_contacts_for_product(UUID) TO anon, authenticated, service_role;

-- ─── 7. Public shop page ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.shop_public_shop(_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _s public.shops%ROWTYPE;
BEGIN
  SELECT * INTO _s FROM public.shops WHERE slug = _slug;
  -- A restricted, suspended or closed shop answers exactly like one that never
  -- existed. Anything else confirms it is real.
  IF NOT FOUND OR _s.state <> 'active' THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'shop', jsonb_build_object(
      'slug', _s.slug,
      'name', _s.name,
      'intro', _s.intro,
      'region', _s.region,
      'verified', _s.verified_at IS NOT NULL,
      'verified_at', _s.verified_at,
      'shipping_note', _s.shipping_note,
      'return_note', _s.return_note,
      'primary_category_slug', _s.primary_category_slug,
      -- owner_user_id, city, application data and every private profile field
      -- are absent by construction. This is an allowlist, not a redaction.
      'product_count', (
        SELECT count(*)::int FROM public.products p
        JOIN public.product_categories c ON c.slug = p.category_slug
        WHERE p.shop_id = _s.id AND p.status = 'approved' AND p.is_published
          AND c.is_active
          AND EXISTS (SELECT 1 FROM public.product_media m
                      WHERE m.product_id = p.id AND m.public_path IS NOT NULL))
    ),
    'contacts', public.shop_public_contacts(_s.id));
END $$;

REVOKE ALL   ON FUNCTION public.shop_public_shop(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_public_shop(TEXT) TO anon, authenticated, service_role;

-- ─── 8. Taxonomy ────────────────────────────────────────────────────────────
-- Counts come from products that are REALLY publishable, so a category cannot
-- advertise twelve items and open onto three.

CREATE OR REPLACE FUNCTION public.shop_public_categories(_only_stocked BOOLEAN DEFAULT false)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.sort_order, t.slug), '[]'::jsonb)
  FROM (
    SELECT c.slug, c.name_vi AS name, c.sort_order,
           (SELECT count(*)::int
            FROM public.products p
            JOIN public.shops s ON s.id = p.shop_id
            WHERE p.category_slug = c.slug
              AND p.status = 'approved' AND p.is_published AND s.state = 'active'
              AND EXISTS (SELECT 1 FROM public.product_media m
                          WHERE m.product_id = p.id AND m.public_path IS NOT NULL)
              AND EXISTS (SELECT 1 FROM public.product_variants v
                          WHERE v.product_id = p.id AND v.retired_at IS NULL)
           ) AS product_count
    FROM public.product_categories c
    WHERE c.is_active
  ) t
  WHERE NOT _only_stocked OR t.product_count > 0
$$;

REVOKE ALL   ON FUNCTION public.shop_public_categories(BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_public_categories(BOOLEAN) TO anon, authenticated, service_role;
