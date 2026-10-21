-- ============================================================================
-- Shop Phase 3 — S2: the order core.
-- ----------------------------------------------------------------------------
-- Three tables, two RPCs and one read model. Everything a buyer or a seller
-- does to an order goes through a SECURITY DEFINER function; no client holds
-- INSERT, UPDATE or DELETE on any of the three tables, so RLS here is a read
-- rule and not a write rule.
--
-- ── What Postgres holds, rather than the RPC ───────────────────────────────
--   total_vnd        GENERATED ALWAYS AS (items + shipping) STORED. The RPC
--                    never receives a total and never computes one, so there
--                    is no arithmetic to get wrong and nothing for a client to
--                    forge.
--   line_total_vnd   the same, per line.
--   recipient_*      CHECK constraints. Validation at a trust boundary belongs
--                    in the boundary, not only in the form that happens to be
--                    in front of it today.
--   idempotency      UNIQUE (buyer_user_id, client_token). The SELECT-first
--                    replay is the fast path; the unique index is the referee
--                    when two identical requests arrive at once.
--
-- ── The one thing that is NOT generated ────────────────────────────────────
-- confirm_due_at is a plain column with DEFAULT now() + interval '48 hours'.
-- `timestamptz + interval` is STABLE, not IMMUTABLE, so a generated column
-- built from it is refused with 42P17. It is a seller-side working tool only
-- (D6): nothing counts down for the buyer, and no job acts on it.
--
-- ── Stock ──────────────────────────────────────────────────────────────────
-- This file moves stock itself: set_config('shop.stock_write','on') → UPDATE →
-- INSERT inventory_movements with before/after. It does NOT call
-- product_variant_adjust_stock(), which PERFORMs product_assert_writable() and
-- therefore demands is_shop_manager() — a buyer is not a member of the shop
-- they are buying from, so that path is an insufficient_privilege by design
-- (§B.S2). Cancelling writes a NEW ledger row with reason='return'; the 'sale'
-- row is never edited.
--
-- ── Error contract (part of the API, not an implementation detail) ─────────
-- The checkout screen must say a different sentence for each reason, so every
-- refusal carries an SQLSTATE, a Vietnamese MESSAGE and a DETAIL that is a
-- JSON string with a `reason` from a fixed vocabulary.
--
--   | situation                        | SQLSTATE | reason                | DETAIL also carries          |
--   |----------------------------------|----------|-----------------------|------------------------------|
--   | variant price moved              | PT409    | price_changed         | variant_id, expected, current|
--   | shipping fee moved               | PT409    | shipping_fee_changed  | expected, current            |
--   | not enough on hand               | PT409    | insufficient_stock    | variant_id, requested,       |
--   |                                  |          |                       | available                    |
--   | variant retired / missing        | PT409    | variant_unavailable   | variant_id                   |
--   | product not approved+published   | PT409    | product_unavailable   | variant_id                   |
--   | guarded transition lost the race | PT409    | stale_status          | expected, current            |
--   | shops.ordering_enabled = false   | PT403    | ordering_disabled     | shop_id                      |
--   | shop not active                  | PT403    | shop_inactive         | shop_id                      |
--   | more than 5 pending orders       | PT429    | too_many_pending      | limit, current               |
--   | wrong actor / wrong shop         | 42501    | forbidden             | —                            |
--   | bad payload                      | 22023    | invalid_payload       | field                        |
--
-- PT409 / PT403 / PT429 rather than PT410–PT416: PostgREST maps the PT<code>
-- class straight onto an HTTP status, and 410/412/413/414/415 are statuses a
-- CDN and a fetch layer already read as meaning something else. The `reason`
-- is what the client switches on.
-- ============================================================================

-- ─── 1. Shop configuration (D1, D3) ─────────────────────────────────────────

ALTER TABLE public.shops
  -- The selling switch, and the emergency stop. Default false: a shop sells
  -- only after somebody turns it on deliberately. NOT `restricted`, which
  -- would also delete the shop from the public catalogue.
  ADD COLUMN IF NOT EXISTS ordering_enabled  BOOLEAN NOT NULL DEFAULT false,
  -- One flat fee per shop, snapshotted onto the order. 0 renders as "Miễn phí"
  -- and never as "0đ" (D3) — that is a client rule, stated here so the column
  -- is not mistaken for "unknown".
  ADD COLUMN IF NOT EXISTS shipping_fee_vnd  INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shops_shipping_fee_non_negative') THEN
    ALTER TABLE public.shops ADD CONSTRAINT shops_shipping_fee_non_negative
      CHECK (shipping_fee_vnd >= 0);
  END IF;
END $$;

COMMENT ON COLUMN public.shops.ordering_enabled IS
  'D1 — the selling switch AND the kill switch. Admin-only: pinned in shops_guard_privileged_columns(). PO turns it on with one line of SQL after acceptance.';
COMMENT ON COLUMN public.shops.shipping_fee_vnd IS
  'D3 — flat fee, all provinces, snapshotted onto the order. 0 means free, not unknown.';

-- shops_update_manager lets an owner/manager PATCH the shops row, and this
-- trigger decides which columns that actually reaches. ordering_enabled is a
-- platform switch, so it joins state and verified_* on the pinned list: a
-- manager who PATCHes it gets their value quietly replaced by the stored one.
-- shipping_fee_vnd is deliberately NOT pinned — the seller owns that number
-- (D3), and shop_order_create re-checks it against what the buyer was shown.
--
-- This is a full restatement of the version in 20260811180000, plus one line.
-- CREATE OR REPLACE takes whatever body it is given: the first attempt here
-- restated the PHASE 1 body instead, which silently un-did the slug_write
-- escape hatch and broke shop_slug_update. Caught by
-- shop_p2b_public_read.test.sql, not by reading.
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

  -- The kill switch belongs to the platform, not to the shop.
  NEW.ordering_enabled := OLD.ordering_enabled;

  -- The slug is a URL. It moves only through shop_slug_update, which asks for
  -- it explicitly; a display-name edit must never quietly change a link
  -- somebody has already shared.
  -- coalesce is load-bearing: current_setting(..., true) returns NULL when the
  -- setting was never set, and NULL <> 'on' is NULL, not true — so without it
  -- this branch never runs and the slug is not pinned at all.
  IF coalesce(current_setting('shop.slug_write', true), 'off') <> 'on' THEN
    NEW.slug := OLD.slug;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- ─── 2. Widening what already exists, rather than adding beside it ──────────

-- 'sale' is the only new reason. 'return' is ALREADY in the list, and a
-- cancelled order gives stock back through it — a second name for the same
-- movement ('order_cancel') would split the ledger in two for no gain.
ALTER TABLE public.inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_reason_ok;
ALTER TABLE public.inventory_movements ADD CONSTRAINT inventory_movements_reason_ok CHECK (
  reason IN ('opening', 'restock', 'correction', 'damage', 'lost', 'return', 'manual', 'sale')
);

-- Audit: one table, widened. Not a second audit table for shop orders.
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_event_category_check;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_event_category_check
  CHECK (event_category IN ('auth', 'stream', 'tournament', 'admin', 'match', 'player', 'shop'));

ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_resource_type_check;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_resource_type_check
  CHECK (resource_type IS NULL OR resource_type IN (
    'livestream', 'video', 'tournament', 'organization', 'user', 'api_key',
    'forum_post', 'quick_table', 'doubles_elimination', 'flex_tournament', 'team_match',
    'match', 'game', 'player',
    'shop_application', 'shop', 'shop_product', 'shop_order'
  ));

-- ─── 3. The refusal helper ──────────────────────────────────────────────────
-- Eleven refusal sites, one shape. Internal only: no GRANT, so it is not
-- reachable through PostgREST and cannot be used to manufacture an error.

CREATE OR REPLACE FUNCTION public.shop_order_raise(
  _sqlstate TEXT,
  _message  TEXT,
  _detail   JSONB
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = _sqlstate,
    MESSAGE = _message,
    -- A JSON string, so the client parses one thing instead of scraping prose.
    DETAIL  = _detail::text;
END $$;

REVOKE ALL ON FUNCTION public.shop_order_raise(TEXT, TEXT, JSONB) FROM PUBLIC;

-- ─── 4. The order ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.shop_orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- PH-YYMM-XXXX, the tail RANDOM rather than sequential: a sequential code
  -- tells anybody holding one order how many the shop has sold.
  code              TEXT NOT NULL UNIQUE,
  shop_id           UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  -- SET NULL, on purpose. CASCADE would delete the seller's history when a
  -- buyer closes their account; RESTRICT would break delete-account, which is
  -- running in production today. The order snapshots the name and the phone,
  -- so it stays readable either way.
  buyer_user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  client_token      TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending',
  -- cod | bank_transfer. Both behave IDENTICALLY as far as status is
  -- concerned (D2): there is no awaiting_payment, no reconciliation and no
  -- bank column anywhere in this file.
  payment_method    TEXT NOT NULL,
  recipient_name    TEXT NOT NULL,
  recipient_phone   TEXT NOT NULL,
  -- One free-text field (D4). The repo has no correct province list after the
  -- 2025 mergers, and shipping a stale dropdown is a mistake every user spots.
  shipping_address  TEXT NOT NULL,
  delivery_note     TEXT,
  items_total_vnd   INTEGER NOT NULL,
  shipping_fee_vnd  INTEGER NOT NULL,
  total_vnd         INTEGER GENERATED ALWAYS AS (items_total_vnd + shipping_fee_vnd) STORED,
  -- Plain column, NOT generated: see the header note about 42P17. Seller side
  -- only (D6) — nothing counts down for the buyer and no job reads it.
  confirm_due_at    TIMESTAMPTZ NOT NULL DEFAULT now() + interval '48 hours',
  tracking_code     TEXT,
  cancelled_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cancel_reason     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Five states. No `completed` (that only earns its keep once there are
  -- reviews, which are cut) and no `awaiting_payment` (D2).
  CONSTRAINT shop_orders_status_ok CHECK (
    status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  CONSTRAINT shop_orders_payment_method_ok CHECK (payment_method IN ('cod', 'bank_transfer')),
  CONSTRAINT shop_orders_code_shape CHECK (code ~ '^PH-[0-9]{4}-[0-9A-Z]{4}$'),
  CONSTRAINT shop_orders_recipient_name_len CHECK (char_length(recipient_name) BETWEEN 2 AND 120),
  -- Ten digits starting with a zero. The seller phones this number on the
  -- doorstep; a client-only check is a check that is not there.
  CONSTRAINT shop_orders_recipient_phone_ok CHECK (recipient_phone ~ '^0\d{9}$'),
  CONSTRAINT shop_orders_address_len CHECK (char_length(shipping_address) BETWEEN 12 AND 300),
  CONSTRAINT shop_orders_delivery_note_len CHECK (delivery_note IS NULL OR char_length(delivery_note) <= 200),
  CONSTRAINT shop_orders_cancel_reason_len CHECK (cancel_reason IS NULL OR char_length(cancel_reason) <= 300),
  CONSTRAINT shop_orders_tracking_len CHECK (tracking_code IS NULL OR char_length(tracking_code) BETWEEN 3 AND 64),
  CONSTRAINT shop_orders_items_total_non_negative CHECK (items_total_vnd >= 0),
  CONSTRAINT shop_orders_shipping_fee_non_negative CHECK (shipping_fee_vnd >= 0),
  -- The referee for a double-submit. The SELECT-first replay in the RPC is
  -- the fast path; this is what decides when two of them race.
  CONSTRAINT uniq_shop_orders_buyer_token UNIQUE (buyer_user_id, client_token)
);

COMMENT ON TABLE public.shop_orders IS
  'One shop per order. total_vnd is generated; the RPC never accepts a total. buyer_user_id is never granted to a client — the seller identifies the buyer from the snapshotted name and phone.';

CREATE INDEX IF NOT EXISTS idx_shop_orders_buyer
  ON public.shop_orders (buyer_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shop_orders_shop
  ON public.shop_orders (shop_id, created_at DESC);
-- D8's 5-pending ceiling is counted on every create; give it its own index.
CREATE INDEX IF NOT EXISTS idx_shop_orders_buyer_pending
  ON public.shop_orders (buyer_user_id) WHERE status = 'pending';
-- The seller queue sorts by "closest to its 48 hours" (D6).
CREATE INDEX IF NOT EXISTS idx_shop_orders_shop_pending_due
  ON public.shop_orders (shop_id, confirm_due_at) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.shop_order_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       UUID NOT NULL REFERENCES public.shop_orders(id) ON DELETE CASCADE,
  shop_id        UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  product_id     UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id     UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  qty            INTEGER NOT NULL CHECK (qty BETWEEN 1 AND 10),
  -- The snapshot. It exists so the order is still readable after the product
  -- is renamed, repriced, retired or taken down — which is also why no client
  -- may write these columns.
  product_title  TEXT NOT NULL,
  variant_label  TEXT,
  sku            TEXT,
  unit_price_vnd INTEGER NOT NULL CHECK (unit_price_vnd >= 0),
  line_total_vnd INTEGER GENERATED ALWAYS AS (qty * unit_price_vnd) STORED,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uniq_shop_order_items_variant UNIQUE (order_id, variant_id)
);

CREATE INDEX IF NOT EXISTS idx_shop_order_items_order
  ON public.shop_order_items (order_id);

CREATE TABLE IF NOT EXISTS public.shop_order_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES public.shop_orders(id) ON DELETE CASCADE,
  shop_id       UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  -- A snapshot of who acted, deliberately WITHOUT a foreign key.
  --
  -- `REFERENCES auth.users ON DELETE SET NULL` reads better and does not work
  -- here: deleting an account makes Postgres issue an UPDATE on this table to
  -- null the column, the append-only trigger below refuses that UPDATE, and
  -- account deletion fails for anybody who has ever touched an order. Found by
  -- running it — the pgTAP for "deleting a buyer does not delete the seller's
  -- history" is what surfaced it.
  --
  -- A timeline entry is history; an id in it is what happened, not a live
  -- pointer. Nothing joins on this column, so nothing breaks when the user row
  -- is gone.
  actor_user_id UUID,
  from_status   TEXT,
  to_status     TEXT NOT NULL,
  action        TEXT NOT NULL,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- clock_timestamp(), not now(): two events written in one transaction must
  -- be orderable, and the transaction timestamp makes them identical.
  created_at    TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT shop_order_events_action_ok CHECK (
    action IN ('create', 'confirm', 'ship', 'deliver', 'cancel')),
  CONSTRAINT shop_order_events_to_status_ok CHECK (
    to_status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled'))
  -- No notify_key: there is no retrying dispatcher to deduplicate for.
  -- No client_token: idempotency lives on shop_orders and in the guarded
  -- UPDATE, and a third copy is a third thing to keep in step.
);

CREATE INDEX IF NOT EXISTS idx_shop_order_events_order
  ON public.shop_order_events (order_id, created_at);

COMMENT ON TABLE public.shop_order_events IS
  'Append-only order timeline. Enforced twice: no UPDATE/DELETE grant to any client role, and a trigger that refuses both. GRANT answers before a trigger ever runs, which is how an append-only assertion once passed with the trigger dropped.';

-- Append-only, both layers. The DELETE branch mirrors inventory_movements: a
-- cascade deletes the parent first, so a missing parent inside this trigger IS
-- the cascade, and refusing it would make a shop undeletable forever.
CREATE OR REPLACE FUNCTION public.shop_order_events_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'nhật ký đơn hàng chỉ ghi thêm, không sửa' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shop_orders WHERE id = OLD.order_id) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'nhật ký đơn hàng chỉ ghi thêm, không xoá' USING ERRCODE = 'insufficient_privilege';
END $$;

DROP TRIGGER IF EXISTS shop_order_events_append_only_trg ON public.shop_order_events;
CREATE TRIGGER shop_order_events_append_only_trg
  BEFORE UPDATE OR DELETE ON public.shop_order_events
  FOR EACH ROW EXECUTE FUNCTION public.shop_order_events_append_only();

-- ─── 5. Who may read what ───────────────────────────────────────────────────
-- RLS here is a READ rule only. There is no INSERT/UPDATE/DELETE policy on any
-- of the three tables and no grant for those verbs, so every mutation is an
-- RPC — and the RPCs check the role themselves, because SECURITY DEFINER
-- bypasses RLS and a policy that is never consulted protects nothing.

ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_order_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shop_orders_select_party" ON public.shop_orders;
CREATE POLICY "shop_orders_select_party" ON public.shop_orders
  FOR SELECT TO authenticated
  -- owner / manager / fulfillment / support of THIS shop, the buyer, or an
  -- admin (which already carries AAL2).
  USING (buyer_user_id = auth.uid() OR public.is_shop_member(shop_id) OR public.is_admin());

-- The child policies go through a SECURITY DEFINER helper rather than an
-- inline EXISTS over shop_orders, and this is not style.
--
-- A policy on shop_order_items is evaluated AS THE QUERYING USER. An inline
-- `EXISTS (SELECT 1 FROM shop_orders o WHERE ... o.buyer_user_id = auth.uid())`
-- therefore needs SELECT on shop_orders.buyer_user_id — the one column
-- deliberately withheld from every client — so the buyer's own order lines
-- came back as `permission denied for table shop_orders`. Found by running it.
-- RLS filters rows; it does not filter columns, and a policy that reads a
-- column the reader cannot hold is a policy that cannot run.
CREATE OR REPLACE FUNCTION public.shop_order_is_party(_order_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shop_orders o
    WHERE o.id = _order_id
      AND (o.buyer_user_id = auth.uid() OR public.is_shop_member(o.shop_id) OR public.is_admin())
  )
$$;

REVOKE ALL   ON FUNCTION public.shop_order_is_party(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_order_is_party(UUID) TO authenticated, service_role;

DROP POLICY IF EXISTS "shop_order_items_select_party" ON public.shop_order_items;
CREATE POLICY "shop_order_items_select_party" ON public.shop_order_items
  FOR SELECT TO authenticated
  USING (public.shop_order_is_party(order_id));

DROP POLICY IF EXISTS "shop_order_events_select_party" ON public.shop_order_events;
CREATE POLICY "shop_order_events_select_party" ON public.shop_order_events
  FOR SELECT TO authenticated
  USING (public.shop_order_is_party(order_id));

REVOKE ALL ON public.shop_orders       FROM anon, authenticated;
REVOKE ALL ON public.shop_order_items  FROM anon, authenticated;
REVOKE ALL ON public.shop_order_events FROM anon, authenticated;

-- Column lists, not table grants. buyer_user_id, client_token and cancelled_by
-- are absent from every one of them: the first is somebody's identity, the
-- second is a replay key, and the third is an identity again — cancelled_by is
-- a uid of auth.users, and 20260504100000 lets every logged-in user read all of
-- profiles, so handing it out gives the seller the buyer's real name, avatar
-- and DUPR via profiles.id, and gives the buyer the uid of whichever staff
-- member cancelled. A seller recognises the buyer from the snapshot on the
-- order; the timeline says WHO cancelled with metadata->>'actor_kind'.
GRANT SELECT (
  id, code, shop_id, status, payment_method,
  recipient_name, recipient_phone, shipping_address, delivery_note,
  items_total_vnd, shipping_fee_vnd, total_vnd,
  confirm_due_at, tracking_code, cancel_reason,
  created_at, updated_at
) ON public.shop_orders TO authenticated;

GRANT SELECT (
  id, order_id, shop_id, product_id, variant_id, qty,
  product_title, variant_label, sku, unit_price_vnd, line_total_vnd, created_at
) ON public.shop_order_items TO authenticated;

-- actor_user_id is NOT in this list, and that is the same rule as
-- shop_orders.buyer_user_id rather than a second one. The `create` event's
-- actor IS the buyer, and the read policy admits every party — so granting the
-- column would have handed the seller (and `support`, and every member) the
-- buyer's uid through a different table. Nothing needs it: shop_order_json does
-- not return it, and the timeline renders `metadata->>'actor_kind'`.
GRANT SELECT (
  id, order_id, shop_id, from_status, to_status, action, metadata, created_at
) ON public.shop_order_events TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.shop_orders       TO service_role;
GRANT SELECT, INSERT         ON public.shop_order_items  TO service_role;
GRANT SELECT, INSERT         ON public.shop_order_events TO service_role;

-- ─── 6. The order DTO ───────────────────────────────────────────────────────
-- One shape, built once, used by create, by transition and by every replay.
-- buyer_user_id and client_token are absent BY CONSTRUCTION, not stripped by
-- whichever caller remembered to.

-- Deliberately VOLATILE. It is called at the end of shop_order_create, in the
-- same transaction as the rows it reads; a STABLE function is entitled to the
-- calling query's snapshot, and betting the return value of an order creation
-- on that entitlement is not a bet worth taking.
CREATE OR REPLACE FUNCTION public.shop_order_json(_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _o    public.shop_orders%ROWTYPE;
  _shop public.shops%ROWTYPE;
BEGIN
  SELECT * INTO _o FROM public.shop_orders WHERE id = _order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found' USING ERRCODE = 'no_data_found';
  END IF;
  SELECT * INTO _shop FROM public.shops WHERE id = _o.shop_id;

  RETURN jsonb_build_object(
    'id',               _o.id,
    'code',             _o.code,
    'status',           _o.status,
    'payment_method',   _o.payment_method,
    'recipient_name',   _o.recipient_name,
    'recipient_phone',  _o.recipient_phone,
    'shipping_address', _o.shipping_address,
    'delivery_note',    _o.delivery_note,
    'items_total_vnd',  _o.items_total_vnd,
    'shipping_fee_vnd', _o.shipping_fee_vnd,
    'total_vnd',        _o.total_vnd,
    'confirm_due_at',   _o.confirm_due_at,
    'tracking_code',    _o.tracking_code,
    'cancel_reason',    _o.cancel_reason,
    'created_at',       _o.created_at,
    'updated_at',       _o.updated_at,
    'shop', jsonb_build_object(
      'slug', _shop.slug, 'name', _shop.name, 'state', _shop.state),
    'items', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', i.id, 'product_id', i.product_id, 'variant_id', i.variant_id,
               'qty', i.qty, 'product_title', i.product_title,
               'variant_label', i.variant_label, 'sku', i.sku,
               'unit_price_vnd', i.unit_price_vnd, 'line_total_vnd', i.line_total_vnd)
             ORDER BY i.created_at, i.id)
      FROM public.shop_order_items i WHERE i.order_id = _o.id), '[]'::jsonb),
    'events', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', e.id, 'action', e.action,
               'from_status', e.from_status, 'to_status', e.to_status,
               'metadata', e.metadata, 'created_at', e.created_at)
             ORDER BY e.created_at, e.id)
      FROM public.shop_order_events e WHERE e.order_id = _o.id), '[]'::jsonb)
  );
END $$;

REVOKE ALL   ON FUNCTION public.shop_order_json(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_order_json(UUID) TO service_role;

-- ─── 7. The cart read model ─────────────────────────────────────────────────
-- Takes no user id and never will: it reads auth.uid(). A parameter here would
-- be an oracle for other people's carts the first time a caller forgot to
-- constrain it.

CREATE OR REPLACE FUNCTION public.shop_cart_view()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid    UUID := auth.uid();
  _groups JSONB := '[]'::jsonb;
  _lines  JSONB;
  _shop   RECORD;
  _line   RECORD;
  _proj   JSONB;
  _cover  JSONB;
  _reason TEXT;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'cần đăng nhập để xem giỏ hàng' USING ERRCODE = 'insufficient_privilege';
  END IF;

  FOR _shop IN
    SELECT s.id, s.slug, s.name, s.state, s.ordering_enabled, s.shipping_fee_vnd
    FROM public.shop_cart_items ci
    JOIN public.product_variants v ON v.id = ci.variant_id
    JOIN public.shops s            ON s.id = v.shop_id
    WHERE ci.user_id = _uid
    GROUP BY s.id, s.slug, s.name, s.state, s.ordering_enabled, s.shipping_fee_vnd
    ORDER BY s.name
  LOOP
    _lines := '[]'::jsonb;

    FOR _line IN
      SELECT ci.id AS cart_item_id, ci.variant_id, ci.qty, ci.created_at,
             v.product_id, v.retired_at, v.price_vnd, v.stock_on_hand,
             v.option_values, v.sku, v.media_id
      FROM public.shop_cart_items ci
      JOIN public.product_variants v ON v.id = ci.variant_id
      WHERE ci.user_id = _uid AND v.shop_id = _shop.id
      ORDER BY ci.created_at, ci.id
    LOOP
      -- ponytail: N+1 projection, gộp thành một query khi giỏ > 50 dòng
      BEGIN
        _proj := public.product_public_projection(_line.product_id, false);
      EXCEPTION WHEN no_data_found THEN
        -- The projection RAISES for anything no longer public. Caught PER LINE:
        -- letting it out would make one taken-down product blank the whole cart.
        _proj := NULL;
      END;

      _reason := CASE
        WHEN _line.retired_at IS NOT NULL              THEN 'variant_retired'
        WHEN _shop.state <> 'active'                   THEN 'shop_inactive'
        WHEN _proj IS NULL                             THEN 'product_unavailable'
        WHEN NOT _shop.ordering_enabled                THEN 'ordering_disabled'
        WHEN _line.stock_on_hand IS NOT NULL
             AND _line.stock_on_hand < _line.qty       THEN 'out_of_stock'
        ELSE NULL
      END;

      _cover := NULL;
      IF _proj IS NOT NULL THEN
        SELECT m INTO _cover
        FROM jsonb_array_elements(_proj -> 'media') m
        WHERE _line.media_id IS NOT NULL AND (m ->> 'id')::uuid = _line.media_id
        LIMIT 1;
        IF _cover IS NULL THEN
          _cover := _proj -> 'media' -> 0;
        END IF;
      END IF;

      _lines := _lines || jsonb_build_array(jsonb_build_object(
        'cart_item_id',       _line.cart_item_id,
        'variant_id',         _line.variant_id,
        'qty',                _line.qty,
        'product_id',         _line.product_id,
        'product_slug',       _proj ->> 'slug',
        'product_title',      _proj ->> 'title',
        'option_values',      _line.option_values,
        'sku',                _line.sku,
        -- The CURRENT price, which is what the screen shows. Not a reference
        -- price: nothing is stored to compare it against (§B.S5).
        'unit_price_vnd',     _line.price_vnd,
        'line_total_vnd',     _line.price_vnd * _line.qty,
        'stock_on_hand',      _line.stock_on_hand,
        'cover',              _cover,
        'unavailable_reason', _reason));
    END LOOP;

    _groups := _groups || jsonb_build_array(jsonb_build_object(
      'shop', jsonb_build_object(
        'slug',             _shop.slug,
        'name',             _shop.name,
        'state',            _shop.state,
        'ordering_enabled', _shop.ordering_enabled,
        'shipping_fee_vnd', _shop.shipping_fee_vnd),
      'lines', _lines));
  END LOOP;

  RETURN _groups;
END $$;

REVOKE ALL   ON FUNCTION public.shop_cart_view() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_cart_view() TO authenticated, service_role;

-- ─── 8. Creating an order ───────────────────────────────────────────────────
-- No parameter has a DEFAULT. A default is the fastest way to an ambiguous
-- overload (42725) the day a second signature appears — a failure this repo
-- has already paid for once, in the product moderation path.
--
-- No _shop_id either: the shop is derived from the variants, and items from
-- two shops are refused. One shop, one order.

CREATE OR REPLACE FUNCTION public.shop_order_create(
  _client_token              TEXT,
  _payment_method            TEXT,
  _recipient_name            TEXT,
  _recipient_phone           TEXT,
  _shipping_address          TEXT,
  _delivery_note             TEXT,
  _expected_shipping_fee_vnd INTEGER,
  _items                     JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid      UUID := auth.uid();
  _tok      TEXT := btrim(coalesce(_client_token, ''));
  _existing public.shop_orders%ROWTYPE;
  _shop     public.shops%ROWTYPE;
  _shop_id  UUID;
  _sid      UUID;
  _norm     JSONB;
  _plan     JSONB := '[]'::jsonb;
  _e        JSONB;
  _vid      UUID;
  _qty      INTEGER;
  _expected INTEGER;
  _v        public.product_variants%ROWTYPE;
  _p        public.products%ROWTYPE;
  _total    INTEGER := 0;
  _pending  INTEGER;
  _order    public.shop_orders%ROWTYPE;
  _code     TEXT;
  _try      INTEGER;
  _before   INTEGER;
  _after    INTEGER;
  _label    TEXT;
BEGIN
  IF _uid IS NULL THEN
    PERFORM public.shop_order_raise('42501', 'Cần đăng nhập để đặt hàng.',
      jsonb_build_object('reason', 'forbidden'));
  END IF;
  IF _tok = '' THEN
    PERFORM public.shop_order_raise('22023', 'Thiếu mã chống trùng của lần đặt này.',
      jsonb_build_object('reason', 'invalid_payload', 'field', 'client_token'));
  END IF;

  -- (2) Replay, BEFORE any mutation. The same token is the same order: no new
  -- row, no second stock movement, no second event, no extra cart deletion.
  SELECT * INTO _existing FROM public.shop_orders
  WHERE buyer_user_id = _uid AND client_token = _tok;
  IF FOUND THEN
    RETURN public.shop_order_json(_existing.id);
  END IF;

  -- (3) D8. One account is the whole cost of flattening a shop's inventory,
  -- so there is a ceiling on how much of it can be held at once.
  --
  -- COUNT-then-INSERT is not a ceiling on its own: two requests from the same
  -- buyer with DIFFERENT tokens both count 4 and both insert, and the unique
  -- (buyer_user_id, client_token) has nothing to say about it. Serialise the
  -- whole check-and-insert per buyer instead.
  -- ponytail: khoá theo người mua, đổi sang partial unique index nếu trần thành nhiều bậc
  PERFORM pg_advisory_xact_lock(hashtext('shop_order_create:' || _uid::text));

  SELECT count(*)::int INTO _pending FROM public.shop_orders
  WHERE buyer_user_id = _uid AND status = 'pending';
  IF _pending >= 5 THEN
    PERFORM public.shop_order_raise('PT429',
      'Anh/chị đang có 5 đơn chờ shop xác nhận. Chờ shop xử lý xong một đơn, hoặc huỷ bớt, rồi đặt tiếp.',
      jsonb_build_object('reason', 'too_many_pending', 'limit', 5, 'current', _pending));
  END IF;

  IF coalesce(_payment_method, '') NOT IN ('cod', 'bank_transfer') THEN
    PERFORM public.shop_order_raise('22023', 'Cách thanh toán không hợp lệ.',
      jsonb_build_object('reason', 'invalid_payload', 'field', 'payment_method'));
  END IF;

  -- The delivery details, checked BEFORE anything is locked or written. The
  -- CHECK constraints on the table stay exactly as they are — they are the last
  -- layer, and the one a future caller cannot forget. But a constraint answers
  -- 23514 with prose, and the checkout screen switches on `reason` + `field`;
  -- a refusal the client cannot name is a refusal it renders as a shrug.
  IF char_length(btrim(coalesce(_recipient_name, ''))) NOT BETWEEN 2 AND 120 THEN
    PERFORM public.shop_order_raise('22023', 'Tên người nhận cần từ 2 đến 120 ký tự.',
      jsonb_build_object('reason', 'invalid_payload', 'field', 'recipient_name'));
  END IF;
  IF btrim(coalesce(_recipient_phone, '')) !~ '^0\d{9}$' THEN
    PERFORM public.shop_order_raise('22023',
      'Số điện thoại người nhận phải là 10 số và bắt đầu bằng 0.',
      jsonb_build_object('reason', 'invalid_payload', 'field', 'recipient_phone'));
  END IF;
  IF char_length(btrim(coalesce(_shipping_address, ''))) NOT BETWEEN 12 AND 300 THEN
    PERFORM public.shop_order_raise('22023',
      'Địa chỉ giao hàng cần từ 12 đến 300 ký tự — ghi đủ số nhà, đường, phường, quận, tỉnh.',
      jsonb_build_object('reason', 'invalid_payload', 'field', 'shipping_address'));
  END IF;
  -- NULLIF mirrors the INSERT: an all-whitespace note is stored as NULL, so it
  -- is measured the same way here.
  IF char_length(NULLIF(btrim(coalesce(_delivery_note, '')), '')) > 200 THEN
    PERFORM public.shop_order_raise('22023', 'Ghi chú cho shop tối đa 200 ký tự.',
      jsonb_build_object('reason', 'invalid_payload', 'field', 'delivery_note'));
  END IF;

  -- (4) Normalise the payload, and sort it by variant_id ASCENDING. That sort
  -- is the deadlock protection: two overlapping orders take the same row locks
  -- in the same order, so one waits instead of both dying.
  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
    PERFORM public.shop_order_raise('22023', 'Giỏ hàng trống.',
      jsonb_build_object('reason', 'invalid_payload', 'field', 'items'));
  END IF;

  BEGIN
    SELECT jsonb_agg(e ORDER BY (e ->> 'variant_id')::uuid)
    INTO _norm
    FROM jsonb_array_elements(_items) e;
  EXCEPTION WHEN invalid_text_representation THEN
    PERFORM public.shop_order_raise('22023', 'Danh sách sản phẩm không hợp lệ.',
      jsonb_build_object('reason', 'invalid_payload', 'field', 'items.variant_id'));
  END;

  IF (SELECT count(DISTINCT e ->> 'variant_id') FROM jsonb_array_elements(_items) e)
     <> jsonb_array_length(_items) THEN
    PERFORM public.shop_order_raise('22023', 'Một phiên bản xuất hiện hai lần trong đơn.',
      jsonb_build_object('reason', 'invalid_payload', 'field', 'items.variant_id'));
  END IF;

  FOR _e IN SELECT * FROM jsonb_array_elements(_norm) LOOP
    -- Bare, this cast leaves the contract: {"qty":"abc"} raises 22P02 and
    -- {"qty":99999999999} raises 22003, neither of which carries a `reason`, so
    -- a client that switches on `reason` shows its "unknown error" branch for a
    -- payload IT sent.
    BEGIN
      _qty := (_e ->> 'qty')::int;
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      PERFORM public.shop_order_raise('22023', 'Số lượng mỗi món phải từ 1 đến 10.',
        jsonb_build_object('reason', 'invalid_payload', 'field', 'items.qty'));
    END;
    IF _qty IS NULL OR _qty < 1 OR _qty > 10 THEN
      PERFORM public.shop_order_raise('22023', 'Số lượng mỗi món phải từ 1 đến 10.',
        jsonb_build_object('reason', 'invalid_payload', 'field', 'items.qty'));
    END IF;
    IF (_e ->> 'expected_unit_price_vnd') IS NULL THEN
      PERFORM public.shop_order_raise('22023', 'Thiếu giá đã hiển thị cho một món.',
        jsonb_build_object('reason', 'invalid_payload', 'field', 'items.expected_unit_price_vnd'));
    END IF;
  END LOOP;

  -- (5) Lock every variant first, in that ascending order, and only then look
  -- at what they say. Reading before locking is how two buyers both see the
  -- last unit.
  FOR _e IN SELECT * FROM jsonb_array_elements(_norm) LOOP
    _vid := (_e ->> 'variant_id')::uuid;
    SELECT v.shop_id INTO _sid FROM public.product_variants v WHERE v.id = _vid FOR UPDATE;
    IF NOT FOUND THEN
      PERFORM public.shop_order_raise('PT409', 'Một phiên bản trong đơn không còn bán.',
        jsonb_build_object('reason', 'variant_unavailable', 'variant_id', _vid));
    END IF;
    IF _shop_id IS NULL THEN
      _shop_id := _sid;
    ELSIF _shop_id <> _sid THEN
      PERFORM public.shop_order_raise('22023',
        'Mỗi shop là một đơn riêng — các món trong đơn này thuộc nhiều shop.',
        jsonb_build_object('reason', 'invalid_payload', 'field', 'items.shop_id'));
    END IF;
  END LOOP;

  SELECT * INTO _shop FROM public.shops WHERE id = _shop_id;
  IF _shop.state <> 'active' THEN
    PERFORM public.shop_order_raise('PT403', 'Shop đang tạm ngưng bán.',
      jsonb_build_object('reason', 'shop_inactive', 'shop_id', _shop_id));
  END IF;
  IF NOT _shop.ordering_enabled THEN
    PERFORM public.shop_order_raise('PT403', 'Shop đang tạm ngưng bán.',
      jsonb_build_object('reason', 'ordering_disabled', 'shop_id', _shop_id));
  END IF;
  IF _shop.shipping_fee_vnd IS DISTINCT FROM _expected_shipping_fee_vnd THEN
    PERFORM public.shop_order_raise('PT409', 'Phí vận chuyển vừa thay đổi.',
      jsonb_build_object('reason', 'shipping_fee_changed',
                         'expected', _expected_shipping_fee_vnd,
                         'current',  _shop.shipping_fee_vnd));
  END IF;

  -- (6) Now re-check everything, on rows that cannot move under us, and (7)
  -- total it up from the prices just locked — never from anything the client
  -- sent.
  FOR _e IN SELECT * FROM jsonb_array_elements(_norm) LOOP
    _vid      := (_e ->> 'variant_id')::uuid;
    _qty      := (_e ->> 'qty')::int;
    -- Same reason as the qty cast above: a price the client sent as "1.5tr" or
    -- as a number too big for an integer is a bad payload, not an unknown one.
    BEGIN
      _expected := (_e ->> 'expected_unit_price_vnd')::int;
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      PERFORM public.shop_order_raise('22023', 'Giá đã hiển thị không hợp lệ.',
        jsonb_build_object('reason', 'invalid_payload',
                           'field', 'items.expected_unit_price_vnd'));
    END;

    SELECT * INTO _v FROM public.product_variants WHERE id = _vid;
    IF _v.retired_at IS NOT NULL THEN
      PERFORM public.shop_order_raise('PT409', 'Một phiên bản trong đơn không còn bán.',
        jsonb_build_object('reason', 'variant_unavailable', 'variant_id', _vid));
    END IF;

    SELECT * INTO _p FROM public.products WHERE id = _v.product_id;
    IF NOT FOUND OR _p.status <> 'approved' OR NOT _p.is_published THEN
      PERFORM public.shop_order_raise('PT409', 'Một sản phẩm trong đơn không còn bán.',
        jsonb_build_object('reason', 'product_unavailable', 'variant_id', _vid));
    END IF;

    IF _v.price_vnd <> _expected THEN
      PERFORM public.shop_order_raise('PT409', 'Giá vừa thay đổi trong lúc anh/chị điền.',
        jsonb_build_object('reason', 'price_changed', 'variant_id', _vid,
                           'expected', _expected, 'current', _v.price_vnd));
    END IF;

    -- NULL means the shop does not count this one. It is a real answer, and it
    -- is not zero: turning it into 0 would make every uncounted variant
    -- permanently sold out.
    IF _v.stock_on_hand IS NOT NULL AND _v.stock_on_hand < _qty THEN
      PERFORM public.shop_order_raise('PT409', 'Món này vừa hết hàng.',
        jsonb_build_object('reason', 'insufficient_stock', 'variant_id', _vid,
                           'requested', _qty, 'available', _v.stock_on_hand));
    END IF;

    SELECT string_agg(t.k || ': ' || t.val, ' · ' ORDER BY t.k)
    INTO _label
    FROM jsonb_each_text(coalesce(_v.option_values, '{}'::jsonb)) AS t(k, val);

    _total := _total + _qty * _v.price_vnd;
    _plan := _plan || jsonb_build_array(jsonb_build_object(
      'variant_id', _vid, 'product_id', _v.product_id, 'qty', _qty,
      'price_vnd', _v.price_vnd, 'sku', _v.sku,
      'title', _p.title, 'label', _label,
      'stock_on_hand', _v.stock_on_hand));
  END LOOP;

  -- (8) The order. The code retries on collision; a duplicate TOKEN, on the
  -- other hand, means a second request beat us here between the SELECT above
  -- and now — that is the replay, arriving concurrently, and it gets the same
  -- answer the fast path would have given it.
  FOR _try IN 1..8 LOOP
    _code := 'PH-' || to_char(now(), 'YYMM') || '-' ||
             upper(encode(extensions.gen_random_bytes(2), 'hex'));
    BEGIN
      INSERT INTO public.shop_orders (
        code, shop_id, buyer_user_id, client_token, payment_method,
        recipient_name, recipient_phone, shipping_address, delivery_note,
        items_total_vnd, shipping_fee_vnd)
      VALUES (
        _code, _shop_id, _uid, _tok, _payment_method,
        btrim(coalesce(_recipient_name, '')), btrim(coalesce(_recipient_phone, '')),
        btrim(coalesce(_shipping_address, '')),
        NULLIF(btrim(coalesce(_delivery_note, '')), ''),
        _total, _shop.shipping_fee_vnd)
      RETURNING * INTO _order;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      SELECT * INTO _existing FROM public.shop_orders
      WHERE buyer_user_id = _uid AND client_token = _tok;
      IF FOUND THEN
        RETURN public.shop_order_json(_existing.id);
      END IF;
      _order := NULL;                       -- code collision: draw another one
    END;
  END LOOP;

  IF _order.id IS NULL THEN
    RAISE EXCEPTION 'không sinh được mã đơn sau 8 lần thử' USING ERRCODE = 'unique_violation';
  END IF;

  -- (9) Items, then stock, then the ledger. The snapshot is written here and
  -- never again — that is what keeps the order readable after the catalogue
  -- moves on.
  FOR _e IN SELECT * FROM jsonb_array_elements(_plan) LOOP
    _vid := (_e ->> 'variant_id')::uuid;
    _qty := (_e ->> 'qty')::int;

    INSERT INTO public.shop_order_items (
      order_id, shop_id, product_id, variant_id, qty,
      product_title, variant_label, sku, unit_price_vnd)
    VALUES (
      _order.id, _shop_id, (_e ->> 'product_id')::uuid, _vid, _qty,
      _e ->> 'title', _e ->> 'label', _e ->> 'sku', (_e ->> 'price_vnd')::int);

    CONTINUE WHEN (_e ->> 'stock_on_hand') IS NULL;   -- shop does not count it

    _before := (_e ->> 'stock_on_hand')::int;
    _after  := _before - _qty;

    PERFORM set_config('shop.stock_write', 'on', true);
    UPDATE public.product_variants
    SET stock_on_hand = _after, updated_at = now()
    WHERE id = _vid;
    PERFORM set_config('shop.stock_write', 'off', true);

    INSERT INTO public.inventory_movements (
      shop_id, variant_id, product_id, delta, on_hand_before, on_hand_after,
      reason, note, actor_user_id, client_token)
    VALUES (
      _shop_id, _vid, (_e ->> 'product_id')::uuid, -_qty, _before, _after,
      'sale', 'Đơn ' || _order.code, _uid,
      -- Doubles as the structural guard: (variant_id, client_token) is unique,
      -- so one order cannot take stock for the same variant twice.
      'order:' || _order.id::text || ':sale');
  END LOOP;

  -- (10) The timeline starts here.
  INSERT INTO public.shop_order_events (
    order_id, shop_id, actor_user_id, from_status, to_status, action, metadata)
  VALUES (
    _order.id, _shop_id, _uid, NULL, 'pending', 'create',
    jsonb_build_object('payment_method', _order.payment_method,
                       'total_vnd', _order.total_vnd));

  -- (11) Clear only what was just bought. Another shop's lines are another
  -- order the buyer has not placed yet.
  DELETE FROM public.shop_cart_items ci
  USING public.product_variants v
  WHERE ci.variant_id = v.id AND ci.user_id = _uid AND v.shop_id = _shop_id;

  -- (12) Every argument cast. log_audit_event has two overloads and an
  -- uncast call is 42725 `function is not unique` — the error that once broke
  -- the whole product approval path.
  BEGIN
    PERFORM public.log_audit_event(
      'shop_order_create'::text, 'shop'::text, 'shop_order'::text, _order.id::text,
      'info'::text,
      jsonb_build_object('shop_id', _shop_id, 'code', _order.code,
                         'total_vnd', _order.total_vnd, 'items', jsonb_array_length(_plan)),
      'user'::text);
  EXCEPTION WHEN foreign_key_violation THEN
    -- audit_logs.actor_id references profiles(id). A buyer with no profiles
    -- row must not lose their order over the audit trail. Narrow on purpose:
    -- a 42725 overload mistake still explodes, loudly, which is the point.
    NULL;
  END;

  -- (13) Best effort, and nothing more. social_notifications.user_id
  -- references profiles(id), not auth.users — one missing profile row is not
  -- allowed to kill an order.
  BEGIN
    INSERT INTO public.social_notifications (user_id, type, title, body, link_url, payload)
    SELECT s.owner_user_id, 'shop_order_new',
           'Đơn hàng mới ' || _order.code,
           _order.recipient_name || ' vừa đặt ' || jsonb_array_length(_plan) || ' món.',
           '/seller/orders/' || _order.code,
           jsonb_build_object('order_id', _order.id, 'shop_slug', _shop.slug)
    FROM public.shops s
    WHERE s.id = _shop_id
      AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = s.owner_user_id);
  EXCEPTION WHEN others THEN
    NULL;
  END;

  RETURN public.shop_order_json(_order.id);
END $$;

REVOKE ALL   ON FUNCTION public.shop_order_create(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_order_create(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, JSONB) TO authenticated, service_role;

-- ─── 9. Moving an order ─────────────────────────────────────────────────────
-- The whole machine, and nothing beyond it:
--
--   pending   --confirm(seller|admin)------------> confirmed
--   confirmed --ship(seller|admin)---------------> shipped
--   shipped   --deliver(buyer|seller|admin)------> delivered
--   pending   --cancel(buyer|seller|admin)-------> cancelled
--   confirmed --cancel(seller|admin)-------------> cancelled
--   shipped   --cancel(admin)--------------------> cancelled
--
-- `deliver` includes the BUYER (D7). There is no cron closing orders, so
-- without that arm a delivered order sits in `shipped` for ever.
-- `delivered` is the successful end state; there is no `completed`.
--
-- Every permission is checked HERE. SECURITY DEFINER bypasses RLS, so the
-- read policies above are never consulted on this path.

CREATE OR REPLACE FUNCTION public.shop_order_transition(
  _order_id        UUID,
  _action          TEXT,
  _expected_status TEXT,
  _reason          TEXT,
  _tracking_code   TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid    UUID := auth.uid();
  _o      public.shop_orders%ROWTYPE;
  _role   public.shop_member_role;
  _admin  BOOLEAN := public.is_admin();
  _buyer  BOOLEAN;
  _seller BOOLEAN;
  _next   TEXT;
  _clean  TEXT := NULLIF(btrim(coalesce(_reason, '')), '');
  _n      INTEGER;
  _it     RECORD;
  _before INTEGER;
BEGIN
  IF _uid IS NULL THEN
    PERFORM public.shop_order_raise('42501', 'Cần đăng nhập.',
      jsonb_build_object('reason', 'forbidden'));
  END IF;
  IF coalesce(_action, '') NOT IN ('confirm', 'ship', 'deliver', 'cancel') THEN
    PERFORM public.shop_order_raise('22023', 'Hành động không hợp lệ.',
      jsonb_build_object('reason', 'invalid_payload', 'field', 'action'));
  END IF;

  SELECT * INTO _o FROM public.shop_orders WHERE id = _order_id FOR UPDATE;
  -- A missing order answers exactly like somebody else's order. A different
  -- reply would tell a stranger which ids are real.
  IF NOT FOUND THEN
    PERFORM public.shop_order_raise('42501', 'Không có quyền với đơn này.',
      jsonb_build_object('reason', 'forbidden'));
  END IF;

  _buyer := _o.buyer_user_id IS NOT NULL AND _o.buyer_user_id = _uid;
  SELECT role INTO _role FROM public.shop_members
  WHERE shop_id = _o.shop_id AND user_id = _uid;
  -- `support` reads orders and moves none of them. coalesce, because _role is
  -- NULL for a non-member and `false OR NULL OR false` is NULL — an IF NOT
  -- that never fires, which would let a stranger through.
  _seller := coalesce(_role IN ('owner', 'manager', 'fulfillment'), false);

  IF NOT (_buyer OR _seller OR _admin) THEN
    PERFORM public.shop_order_raise('42501', 'Không có quyền với đơn này.',
      jsonb_build_object('reason', 'forbidden'));
  END IF;

  -- The transition table, and the guard, in one place. An expected status that
  -- is not a valid source for this action is the same answer as an expected
  -- status that is simply out of date: the screen was showing something else.
  _next := CASE
    WHEN _action = 'confirm' AND _expected_status = 'pending'   THEN 'confirmed'
    WHEN _action = 'ship'    AND _expected_status = 'confirmed' THEN 'shipped'
    WHEN _action = 'deliver' AND _expected_status = 'shipped'   THEN 'delivered'
    WHEN _action = 'cancel'  AND _expected_status IN ('pending', 'confirmed', 'shipped')
                                                                THEN 'cancelled'
    ELSE NULL
  END;

  IF _next IS NULL OR _o.status IS DISTINCT FROM _expected_status THEN
    PERFORM public.shop_order_raise('PT409', 'Đơn đã thay đổi ở nơi khác — mở lại để xem trạng thái mới.',
      jsonb_build_object('reason', 'stale_status',
                         'expected', _expected_status, 'current', _o.status));
  END IF;

  -- Who may do THIS action from THIS status. The buyer cancels only while the
  -- shop has not confirmed (D5); only an admin cancels something already on
  -- its way.
  IF NOT (
    (_action = 'confirm' AND (_seller OR _admin))
    OR (_action = 'ship' AND (_seller OR _admin))
    OR (_action = 'deliver' AND (_buyer OR _seller OR _admin))
    OR (_action = 'cancel' AND _expected_status = 'pending'   AND (_buyer OR _seller OR _admin))
    OR (_action = 'cancel' AND _expected_status = 'confirmed' AND (_seller OR _admin))
    OR (_action = 'cancel' AND _expected_status = 'shipped'   AND _admin)
  ) THEN
    PERFORM public.shop_order_raise('42501', 'Không có quyền thực hiện thao tác này.',
      jsonb_build_object('reason', 'forbidden'));
  END IF;

  -- Somebody else's order was cancelled and the buyer has to be told why, by
  -- whom. A buyer cancelling their own does not owe anybody a sentence.
  IF _action = 'cancel' AND NOT _buyer AND _clean IS NULL THEN
    PERFORM public.shop_order_raise('22023', 'Huỷ đơn cần một lý do cho người mua.',
      jsonb_build_object('reason', 'invalid_payload', 'field', 'reason'));
  END IF;

  -- Guarded. Two people pressing at the same moment: exactly one row changes,
  -- and the loser is told so rather than silently overwriting the winner.
  UPDATE public.shop_orders
  SET status        = _next,
      updated_at    = now(),
      tracking_code = CASE WHEN _action = 'ship'
                           THEN coalesce(NULLIF(btrim(coalesce(_tracking_code, '')), ''), tracking_code)
                           ELSE tracking_code END,
      cancelled_by  = CASE WHEN _action = 'cancel' THEN _uid  ELSE cancelled_by END,
      cancel_reason = CASE WHEN _action = 'cancel' THEN _clean ELSE cancel_reason END
  WHERE id = _order_id AND status = _expected_status;

  GET DIAGNOSTICS _n = ROW_COUNT;
  IF _n <> 1 THEN
    PERFORM public.shop_order_raise('PT409', 'Đơn đã thay đổi ở nơi khác — mở lại để xem trạng thái mới.',
      jsonb_build_object('reason', 'stale_status',
                         'expected', _expected_status, 'current', _o.status));
  END IF;

  -- Cancelling gives the stock back as a NEW ledger row. The 'sale' row is
  -- never edited — a ledger you can edit is a ledger somebody will edit. The
  -- guarded UPDATE above is what makes a double refund impossible: the second
  -- attempt never reaches this point.
  IF _action = 'cancel' THEN
    FOR _it IN
      SELECT i.variant_id, i.product_id, i.qty
      FROM public.shop_order_items i
      WHERE i.order_id = _order_id
      ORDER BY i.variant_id
    LOOP
      -- Give back only what was actually taken. A variant that was NOT counted
      -- when the order was placed produced no 'sale' row and no deduction; if
      -- the seller has since switched counting on, adding qty here invents
      -- stock that was never removed and the ledger stops reconciling.
      CONTINUE WHEN NOT EXISTS (
        SELECT 1 FROM public.inventory_movements
        WHERE variant_id = _it.variant_id
          AND client_token = 'order:' || _order_id::text || ':sale');

      SELECT stock_on_hand INTO _before FROM public.product_variants
      WHERE id = _it.variant_id FOR UPDATE;
      CONTINUE WHEN _before IS NULL;        -- shop does not count this one

      PERFORM set_config('shop.stock_write', 'on', true);
      UPDATE public.product_variants
      SET stock_on_hand = _before + _it.qty, updated_at = now()
      WHERE id = _it.variant_id;
      PERFORM set_config('shop.stock_write', 'off', true);

      INSERT INTO public.inventory_movements (
        shop_id, variant_id, product_id, delta, on_hand_before, on_hand_after,
        reason, note, actor_user_id, client_token)
      VALUES (
        _o.shop_id, _it.variant_id, _it.product_id, _it.qty, _before, _before + _it.qty,
        'return', 'Huỷ đơn ' || _o.code, _uid,
        'order:' || _order_id::text || ':return');
    END LOOP;
  END IF;

  INSERT INTO public.shop_order_events (
    order_id, shop_id, actor_user_id, from_status, to_status, action, metadata)
  VALUES (
    _order_id, _o.shop_id, _uid, _expected_status, _next, _action,
    jsonb_build_object(
      'actor_kind', CASE WHEN _admin AND NOT _seller AND NOT _buyer THEN 'admin'
                         WHEN _seller THEN 'seller' ELSE 'buyer' END,
      'reason', _clean,
      'tracking_code', CASE WHEN _action = 'ship'
                            THEN NULLIF(btrim(coalesce(_tracking_code, '')), '') END));

  BEGIN
    PERFORM public.log_audit_event(
      ('shop_order_' || _action)::text, 'shop'::text, 'shop_order'::text, _order_id::text,
      (CASE WHEN _action = 'cancel' THEN 'warning' ELSE 'info' END)::text,
      jsonb_build_object('shop_id', _o.shop_id, 'code', _o.code,
                         'from', _expected_status, 'to', _next),
      'user'::text);
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO public.social_notifications (user_id, type, title, body, link_url, payload)
    SELECT _o.buyer_user_id, 'shop_order_' || _action,
           'Đơn ' || _o.code || ' đã cập nhật',
           CASE _action
             WHEN 'confirm' THEN 'Shop đã xác nhận đơn và đang chuẩn bị hàng.'
             WHEN 'ship'    THEN 'Shop đã gửi hàng.'
             WHEN 'deliver' THEN 'Đơn đã hoàn tất.'
             ELSE 'Đơn đã bị huỷ.' || coalesce(' Lý do: ' || _clean, '')
           END,
           '/shop/order/' || _o.code,
           jsonb_build_object('order_id', _order_id, 'to', _next)
    WHERE _o.buyer_user_id IS NOT NULL
      AND _o.buyer_user_id <> _uid
      AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _o.buyer_user_id);
  EXCEPTION WHEN others THEN
    NULL;
  END;

  RETURN public.shop_order_json(_order_id);
END $$;

REVOKE ALL   ON FUNCTION public.shop_order_transition(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_order_transition(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
