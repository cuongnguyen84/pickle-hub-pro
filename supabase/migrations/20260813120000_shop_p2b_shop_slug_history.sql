-- ============================================================================
-- Shop P2b step 5 — a shop keeps its old address too.
--
-- Q2 gave products a slug history and a 301. Shops were left out, and the
-- moment /shop/store/:slug is a real page that is the same bug: a seller
-- renaming their shop silently breaks every link anyone has shared.
--
-- Same shape as product_slug_history, and for the same reason the history row
-- is written INSIDE the guarded transaction that changes the slug — not by a
-- trigger, not by the client. A rename that forgets its forwarding address is
-- the whole failure this exists to prevent.
--
-- The one thing that is NOT the same: a shop's old slug must not resolve while
-- the shop is inactive. A suspended shop that still answered on its old URL
-- would confirm it exists, which is exactly what shop_public_shop() refuses to
-- do on the current one.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.shop_slug_history (
  slug        TEXT PRIMARY KEY,
  shop_id     UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  replaced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_slug_history_shop
  ON public.shop_slug_history (shop_id);

ALTER TABLE public.shop_slug_history ENABLE ROW LEVEL SECURITY;

-- Public: this is how an anonymous visitor gets redirected. It holds nothing
-- private — a slug that used to be public.
DROP POLICY IF EXISTS "shop_slug_history_read" ON public.shop_slug_history;
CREATE POLICY "shop_slug_history_read" ON public.shop_slug_history
  FOR SELECT USING (true);

REVOKE ALL    ON public.shop_slug_history FROM anon, authenticated;
GRANT  SELECT ON public.shop_slug_history TO anon, authenticated;
GRANT  SELECT, INSERT, DELETE ON public.shop_slug_history TO service_role;

CREATE OR REPLACE FUNCTION public.shop_slug_update(_shop_id UUID, _slug TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row   public.shops%ROWTYPE;
  _clean TEXT;
BEGIN
  SELECT * INTO _row FROM public.shops WHERE id = _shop_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'shop not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT (public.is_shop_manager(_shop_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'not a manager of this shop' USING ERRCODE = 'insufficient_privilege';
  END IF;

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
  -- Somebody else's retired slug is still redirecting to their shop. Handing
  -- it over would quietly send their traffic here.
  IF EXISTS (SELECT 1 FROM public.shop_slug_history WHERE slug = _clean AND shop_id <> _shop_id) THEN
    RAISE EXCEPTION 'đường dẫn "%" từng thuộc shop khác và vẫn đang chuyển hướng', _clean
      USING ERRCODE = 'unique_violation';
  END IF;

  IF _clean = _row.slug THEN
    RETURN _clean;                       -- nothing changed; do not log a rename
  END IF;

  -- shop.slug_write, NOT shop.privileged_write: the shops guard uses its own
  -- flag for the slug column, and the generic one does not unlock it. Using
  -- the wrong name would leave the UPDATE silently neutralised.
  PERFORM set_config('shop.slug_write', 'on', true);
  UPDATE public.shops SET slug = _clean WHERE id = _shop_id;
  PERFORM set_config('shop.slug_write', 'off', true);

  -- Same transaction as the rename.
  INSERT INTO public.shop_slug_history (slug, shop_id)
  VALUES (_row.slug, _shop_id)
  ON CONFLICT (slug) DO UPDATE SET shop_id = EXCLUDED.shop_id, replaced_at = now();

  -- Reclaiming a slug this shop used before: it is current again, so it must
  -- stop being a redirect to itself.
  DELETE FROM public.shop_slug_history WHERE slug = _clean;

  PERFORM public.log_audit_event(
    'shop_slug_changed'::text, 'admin'::text, 'shop'::text, _shop_id::text,
    'info'::text, jsonb_build_object('slug', _clean, 'previous_slug', _row.slug), 'user'::text
  );

  RETURN _clean;
END $$;

REVOKE ALL   ON FUNCTION public.shop_slug_update(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_slug_update(UUID, TEXT) TO authenticated, service_role;

-- ─── The public shop reader learns about redirects ──────────────────────────

CREATE OR REPLACE FUNCTION public.shop_public_shop(_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _s        public.shops%ROWTYPE;
  _redirect TEXT;
BEGIN
  SELECT * INTO _s FROM public.shops WHERE slug = _slug;

  IF FOUND AND _s.state = 'active' THEN
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
        'product_count', (
          SELECT count(*)::int FROM public.products p
          JOIN public.product_categories c ON c.slug = p.category_slug
          WHERE p.shop_id = _s.id AND p.status = 'approved' AND p.is_published
            AND c.is_active
            AND EXISTS (SELECT 1 FROM public.product_media m
                        WHERE m.product_id = p.id AND m.public_path IS NOT NULL))
      ),
      'contacts', public.shop_public_contacts(_s.id));
  END IF;

  -- Not a live shop — including "exists but is suspended". Fall through to the
  -- history so a renamed shop still resolves, and answer identically for a
  -- suspended shop and one that never existed: a different reply would confirm
  -- which shops are real.
  SELECT s.slug INTO _redirect
  FROM public.shop_slug_history h
  JOIN public.shops s ON s.id = h.shop_id
  WHERE h.slug = _slug AND s.state = 'active';

  RETURN jsonb_build_object('found', false, 'redirect_to', _redirect);
END $$;

REVOKE ALL   ON FUNCTION public.shop_public_shop(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_public_shop(TEXT) TO anon, authenticated, service_role;
