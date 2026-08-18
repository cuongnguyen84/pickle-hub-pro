-- ============================================================================
-- Shop Phase 3 — S1: the cart.
-- ----------------------------------------------------------------------------
-- One table, and deliberately only one. A cart line is a user, a variant and a
-- quantity; everything else a cart is normally asked to remember is either
-- derivable or a lie waiting to happen:
--
--   no shop_id      The shop is product_variants.shop_id. A second copy of a
--                   foreign key is a second place to be wrong, and the day it
--                   disagrees the buyer sees a line filed under the wrong shop.
--   no price        A cart that stores a price stores a price that will be
--                   stale. §B.S5: there is no `price_changed` flag, because the
--                   cart has nothing to compare against. Price drift is caught
--                   in exactly ONE place — shop_order_create, against the price
--                   the client says it displayed.
--   no expires_at   Nothing reserves stock, so nothing expires. A TTL here
--                   would be a promise the inventory does not keep.
--
-- ── Both halves of the permission, because either alone is a hole ───────────
-- RLS answers "which rows", GRANT answers "which columns and which verbs", and
-- Postgres asks GRANT first. So:
--   * the UPDATE policy carries USING *and* WITH CHECK. USING alone lets a
--     client move its own row onto somebody else's user_id — it passes the
--     read-side test on the way in and lands in another person's cart.
--   * the UPDATE grant is column-scoped to (qty). A bare GRANT UPDATE would
--     let a client rewrite variant_id, which is a different product at the
--     same row id.
--   * anon holds nothing at all.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.shop_cart_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- DEFAULT auth.uid() so an INSERT does not have to send it — which is what
  -- makes the column-scoped INSERT grant below (variant_id, qty) possible.
  user_id    UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  -- The same ceiling as an order line (D8). A cart that accepts 10 000 and an
  -- order that refuses it teaches the buyer the limit at checkout.
  qty        INTEGER NOT NULL CHECK (qty BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- "Add to cart" twice is one line with a bigger qty, enforced here rather
  -- than hoped for in the client: the upsert has something to conflict on.
  CONSTRAINT uniq_shop_cart_items_user_variant UNIQUE (user_id, variant_id)
);

COMMENT ON TABLE public.shop_cart_items IS
  'Buyer cart. No shop_id (derive from product_variants), no price snapshot (§B.S5), no reservation. Read through shop_cart_view(); cleared per shop by shop_order_create().';

CREATE INDEX IF NOT EXISTS idx_shop_cart_items_variant
  ON public.shop_cart_items (variant_id);

DROP TRIGGER IF EXISTS shop_cart_items_updated_at_trg ON public.shop_cart_items;
CREATE TRIGGER shop_cart_items_updated_at_trg
  BEFORE UPDATE ON public.shop_cart_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.shop_cart_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shop_cart_items_select_own" ON public.shop_cart_items;
CREATE POLICY "shop_cart_items_select_own" ON public.shop_cart_items
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "shop_cart_items_insert_own" ON public.shop_cart_items;
CREATE POLICY "shop_cart_items_insert_own" ON public.shop_cart_items
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- USING decides which rows may be touched; WITH CHECK decides what they may
-- become. Without the second half the row can be handed to another user.
DROP POLICY IF EXISTS "shop_cart_items_update_own" ON public.shop_cart_items;
CREATE POLICY "shop_cart_items_update_own" ON public.shop_cart_items
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "shop_cart_items_delete_own" ON public.shop_cart_items;
CREATE POLICY "shop_cart_items_delete_own" ON public.shop_cart_items
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON public.shop_cart_items FROM anon, authenticated;

GRANT SELECT (id, user_id, variant_id, qty, created_at, updated_at)
  ON public.shop_cart_items TO authenticated;
GRANT INSERT (variant_id, qty) ON public.shop_cart_items TO authenticated;
-- (qty) only. Never a bare GRANT UPDATE: variant_id is the identity of the
-- thing being bought, and a row that can change it is a different product
-- wearing the same id.
GRANT UPDATE (qty)             ON public.shop_cart_items TO authenticated;
GRANT DELETE                   ON public.shop_cart_items TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_cart_items TO service_role;

NOTIFY pgrst, 'reload schema';
