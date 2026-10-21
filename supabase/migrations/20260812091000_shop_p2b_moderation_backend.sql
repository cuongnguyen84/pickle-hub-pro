-- ============================================================================
-- Shop P2b step 1 — moderation backend.
--
-- P2a built the state machine, the guarded transitions and the RLS. This file
-- finishes the server side of moderation so P2b.2 has nothing left to decide:
-- a queue, a review payload, the five decisions, contact moderation, and the
-- history that makes any of it auditable.
--
-- ── What P2a's product_decide could not do, and why each mattered ──────────
--
--   no expected version   Two admins could not both decide (the row lock and
--                         the status guard saw to that), but an admin could
--                         decide a product the seller had resubmitted while
--                         the review screen was open — approving content
--                         nobody read.
--   no client token       A lost response then a retry returned "product is
--                         approved — only pending_review may be decided".
--                         Correct, and useless: the caller cannot tell its own
--                         success from somebody else's.
--   requested_fields[]    A list of strings. "Sửa ảnh" cannot say WHICH photo,
--                         so the seller's deep link had nowhere to land.
--   no approve preflight  Approve flipped the status without re-checking
--                         anything. A category disabled after submit, a photo
--                         deleted after submit, a variant that lost its price
--                         — all approved without complaint.
--   note overwritten      products.applicant_note/internal_note hold the LAST
--                         decision. The one before it was gone, so "we already
--                         told them this twice" was unanswerable.
--   no takedown           Nothing removed an approved, live product.
--
-- ── The shape of a decision ────────────────────────────────────────────────
-- Every decision goes through product_decide(): admin + AAL2 (inherited from
-- is_admin()), row lock, expected version, guarded UPDATE, exactly one
-- append-only event, idempotent on the client token. A replay returns the
-- first answer instead of writing a second event or a second cleanup job.
--
-- ── Three ideas that are NOT one boolean ───────────────────────────────────
--   moderation decided   products.status = 'approved'
--   bytes published      product_media.public_path IS NOT NULL, written by
--                        the worker through product_publish_commit
--   publicly visible     status='approved' AND is_published AND shop active
--
-- Approve sets the first and asks for the second. It does NOT set
-- is_published, because the projection would then advertise a rendition path
-- the worker has not written yet — a public URL pointing at nothing.
-- `is_published` becomes true in product_publish_commit, after the bytes
-- exist. The review payload reports all three separately so a moderator can
-- see "approved, waiting on images" instead of guessing.
-- ============================================================================

-- ─── 1. Structured correction targets ───────────────────────────────────────
-- The seller side already resolves problems shaped
-- {code, section, field, variant_id, media_id} — product_submit_preflight()
-- emits them and src/lib/shop/submitProblems.ts focuses them. The moderator's
-- targets use THAT shape, so there is one vocabulary and the deep links a
-- moderator writes land on controls that already exist.
--
-- name / slug are {section:'basics', field:'name'|'slug'}, and return notes
-- are {section:'shipping', field:'return_note'}, because those controls live
-- inside sections the editor can already open. Inventing new sections would
-- mean inventing anchors for them, and a target that scrolls nowhere is worse
-- than no target.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS requested_targets JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_requested_targets_array;
ALTER TABLE public.products
  ADD CONSTRAINT products_requested_targets_array
  CHECK (jsonb_typeof(requested_targets) = 'array');

-- Validation is a function, not a trigger: the moderator must be told which
-- target was wrong while they can still fix it, and a trigger can only say
-- "no".
CREATE OR REPLACE FUNCTION public.product_moderation_targets_check(
  _product_id UUID,
  _targets    JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sections TEXT[] := public.product_edit_sections();
  _t        JSONB;
  _vid      UUID;
  _mid      UUID;
BEGIN
  IF _targets IS NULL OR jsonb_typeof(_targets) <> 'array' OR jsonb_array_length(_targets) = 0 THEN
    RAISE EXCEPTION 'request_changes cần ít nhất một chỗ cần sửa'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  FOR _t IN SELECT * FROM jsonb_array_elements(_targets) LOOP
    IF jsonb_typeof(_t) <> 'object' OR NOT (_t ? 'section') THEN
      RAISE EXCEPTION 'mỗi chỗ cần sửa phải là một đối tượng có "section"'
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF NOT ((_t ->> 'section') = ANY (_sections)) THEN
      RAISE EXCEPTION 'không có phần nào tên "%" trong trình sửa sản phẩm', _t ->> 'section'
        USING ERRCODE = 'invalid_parameter_value';
    END IF;

    -- A variant or photo id from ANOTHER product would give the seller a deep
    -- link into somebody else's catalogue, or a dead one into their own.
    IF (_t ? 'variant_id') AND (_t ->> 'variant_id') IS NOT NULL THEN
      _vid := (_t ->> 'variant_id')::uuid;
      IF NOT EXISTS (SELECT 1 FROM public.product_variants WHERE id = _vid AND product_id = _product_id) THEN
        RAISE EXCEPTION 'phiên bản % không thuộc sản phẩm này', _vid
          USING ERRCODE = 'invalid_parameter_value';
      END IF;
    END IF;
    IF (_t ? 'media_id') AND (_t ->> 'media_id') IS NOT NULL THEN
      _mid := (_t ->> 'media_id')::uuid;
      IF NOT EXISTS (SELECT 1 FROM public.product_media WHERE id = _mid AND product_id = _product_id) THEN
        RAISE EXCEPTION 'ảnh % không thuộc sản phẩm này', _mid
          USING ERRCODE = 'invalid_parameter_value';
      END IF;
    END IF;

    -- Positions rot the moment anything is reordered. P2a's media editor lets
    -- a seller drag photos around, so "ảnh thứ hai" written as an index points
    -- at a different photo by the time they read it.
    IF (_t ? 'index') OR (_t ? 'position') OR (_t ? 'nth') THEN
      RAISE EXCEPTION 'chỗ cần sửa phải gọi tên, không được dùng vị trí'
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
  END LOOP;

  RETURN _targets;
END $$;

-- ─── 2. Moderation history ──────────────────────────────────────────────────
-- products.applicant_note / internal_note hold only the most recent decision.
-- "We have asked them for this photo twice" is a question about the second
-- request, which the row cannot answer. This table can.
--
-- It is admin-readable ONLY. Sellers get their half through
-- product_moderation_history(), which allowlists the columns — the P2a
-- pattern. Column-level GRANTs cannot help here because an admin is also
-- `authenticated`.

CREATE TABLE IF NOT EXISTS public.product_moderation_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  shop_id           UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  decision          TEXT NOT NULL,
  from_status       public.product_status NOT NULL,
  to_status         public.product_status NOT NULL,
  was_published     BOOLEAN NOT NULL DEFAULT false,
  actor_user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  client_token      TEXT,
  -- What the seller reads.
  applicant_note    TEXT,
  requested_targets JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- What the seller must never read.
  internal_note     TEXT,
  -- The notification a dispatcher would send for this decision. Unique, so a
  -- retried dispatch cannot send the same logical message twice. See §7.
  notify_key        TEXT UNIQUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT product_moderation_decision_kind CHECK (
    decision IN ('approve', 'reject', 'request_changes', 'suspend', 'unpublish')
  ),
  CONSTRAINT product_moderation_targets_array CHECK (jsonb_typeof(requested_targets) = 'array')
);

-- Idempotency, structurally. Two calls with one token cannot make two events
-- even if the guard above is ever bypassed.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_product_moderation_token
  ON public.product_moderation_events (product_id, client_token)
  WHERE client_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_product_moderation_product
  ON public.product_moderation_events (product_id, created_at DESC);

ALTER TABLE public.product_moderation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_moderation_events_admin_read" ON public.product_moderation_events;
CREATE POLICY "product_moderation_events_admin_read" ON public.product_moderation_events
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- No INSERT/UPDATE/DELETE policy at all: rows arrive through product_decide().
REVOKE ALL   ON public.product_moderation_events FROM anon, authenticated;
GRANT  SELECT ON public.product_moderation_events TO authenticated;
GRANT  SELECT, INSERT ON public.product_moderation_events TO service_role;

-- Append-only, enforced. P2a's lesson: an append-only assertion passed once
-- with the trigger dropped, because a missing GRANT answered first — so the
-- trigger exists AND the grants above withhold UPDATE/DELETE from everyone.
CREATE OR REPLACE FUNCTION public.product_moderation_events_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'nhật ký kiểm duyệt chỉ được ghi thêm' USING ERRCODE = 'insufficient_privilege';
END $$;

DROP TRIGGER IF EXISTS product_moderation_events_append_only_trg ON public.product_moderation_events;
CREATE TRIGGER product_moderation_events_append_only_trg
  BEFORE UPDATE OR DELETE ON public.product_moderation_events
  FOR EACH ROW EXECUTE FUNCTION public.product_moderation_events_append_only();

-- ─── 3. Slug history (Q2) ───────────────────────────────────────────────────
-- Signed 2026-08-12: a renamed product keeps its old URL working. The history
-- row is written inside the same transaction that changes the slug — not by a
-- trigger and not by the client, because a rename that forgets its forwarding
-- address is the whole failure this exists to prevent.

CREATE TABLE IF NOT EXISTS public.product_slug_history (
  slug        TEXT PRIMARY KEY,
  product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  replaced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_slug_history_product
  ON public.product_slug_history (product_id);

ALTER TABLE public.product_slug_history ENABLE ROW LEVEL SECURITY;

-- Public: this is how a 301 gets resolved for an anonymous visitor. It holds
-- nothing private — a slug that used to be public.
DROP POLICY IF EXISTS "product_slug_history_read" ON public.product_slug_history;
CREATE POLICY "product_slug_history_read" ON public.product_slug_history
  FOR SELECT USING (true);

REVOKE ALL    ON public.product_slug_history FROM anon, authenticated;
GRANT  SELECT ON public.product_slug_history TO anon, authenticated;
GRANT  SELECT, INSERT, DELETE ON public.product_slug_history TO service_role;

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
  -- Somebody else's retired slug is still serving a 301 to their product.
  -- Handing it to this one would silently redirect their traffic here.
  IF EXISTS (SELECT 1 FROM public.product_slug_history WHERE slug = _clean AND product_id <> _product_id) THEN
    RAISE EXCEPTION 'đường dẫn "%" từng thuộc sản phẩm khác và vẫn đang chuyển hướng', _clean
      USING ERRCODE = 'unique_violation';
  END IF;

  IF _clean = _row.slug THEN
    RETURN _clean;                      -- nothing changed; do not log a rename
  END IF;

  PERFORM set_config('shop.privileged_write', 'on', true);
  UPDATE public.products SET slug = _clean WHERE id = _product_id;
  PERFORM set_config('shop.privileged_write', 'off', true);

  -- Same transaction. If the UPDATE lands, so does the forwarding address.
  INSERT INTO public.product_slug_history (slug, product_id)
  VALUES (_row.slug, _product_id)
  ON CONFLICT (slug) DO UPDATE SET product_id = EXCLUDED.product_id, replaced_at = now();

  -- Reclaiming a slug this product had used before: it is current again, so it
  -- must stop being a redirect to itself.
  DELETE FROM public.product_slug_history WHERE slug = _clean;

  RETURN _clean;
END $$;

REVOKE ALL   ON FUNCTION public.product_slug_update(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.product_slug_update(UUID, TEXT) TO authenticated, service_role;

-- ─── 4. Approve preflight ───────────────────────────────────────────────────
-- product_submit_preflight() answers "may this be submitted". Approve asks a
-- different question at a different time: everything submit checked can have
-- changed since, and Q3 adds one submit never checked at all.

CREATE OR REPLACE FUNCTION public.product_approve_preflight(_product_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _p        public.products%ROWTYPE;
  _shop     public.shops%ROWTYPE;
  _problems JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin required' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO _p FROM public.products WHERE id = _product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found' USING ERRCODE = 'no_data_found';
  END IF;
  SELECT * INTO _shop FROM public.shops WHERE id = _p.shop_id;

  -- Everything the seller had to satisfy still has to hold — EXCEPT the one
  -- question that is about submitting rather than about the product.
  -- product_submit_preflight() reports `wrong_status` for anything not in
  -- draft/needs_changes, and a product awaiting approval is, by definition,
  -- already submitted. Passing that through would make every approve fail with
  -- "this cannot be submitted", which is true and useless.
  SELECT coalesce(jsonb_agg(p), '[]'::jsonb) INTO _problems
  FROM jsonb_array_elements(public.product_submit_preflight(_product_id)) p
  WHERE p ->> 'code' <> 'wrong_status';

  -- Q3: the taxonomy belongs to the platform, so it can move underneath a
  -- product that is already in the queue. Approving into a disabled category
  -- would publish a product onto a category page that does not exist.
  IF _p.category_slug IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.product_categories
                    WHERE slug = _p.category_slug AND is_active) THEN
    _problems := _problems || jsonb_build_array(
      jsonb_build_object('code', 'category_inactive', 'section', 'category'));
  END IF;

  IF _shop.state <> 'active' THEN
    _problems := _problems || jsonb_build_array(
      jsonb_build_object('code', 'shop_not_active', 'section', 'basics'));
  END IF;

  RETURN _problems;
END $$;

REVOKE ALL   ON FUNCTION public.product_approve_preflight(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.product_approve_preflight(UUID) TO authenticated, service_role;

-- ─── 5. The decision ────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.product_decide(UUID, TEXT, TEXT, TEXT, TEXT[]);

CREATE OR REPLACE FUNCTION public.product_decide(
  _product_id       UUID,
  _decision         TEXT,
  _expected_version INTEGER DEFAULT NULL,
  _applicant_note   TEXT    DEFAULT NULL,
  _internal_note    TEXT    DEFAULT NULL,
  _requested_targets JSONB  DEFAULT '[]'::jsonb,
  _client_token     TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row      public.products%ROWTYPE;
  _next     public.product_status;
  _prior    public.product_moderation_events%ROWTYPE;
  _problems JSONB;
  _pub      BOOLEAN;
BEGIN
  -- is_admin() carries the AAL2 requirement (migrations 20260730090000 +
  -- 20260730100000). Stated here because the route guard is not authorization
  -- and a reader should not have to go and check.
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin required' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF _decision NOT IN ('approve', 'reject', 'request_changes', 'suspend', 'unpublish') THEN
    RAISE EXCEPTION 'unknown decision %', _decision USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Replay BEFORE the lock: a retry of a decision that already happened must
  -- return the first answer, not queue behind a lock and then be told the
  -- status is wrong.
  IF _client_token IS NOT NULL THEN
    SELECT * INTO _prior FROM public.product_moderation_events
    WHERE product_id = _product_id AND client_token = _client_token;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'ok', true, 'status', _prior.to_status, 'replayed', true,
        'event_id', _prior.id);
    END IF;
  END IF;

  SELECT * INTO _row FROM public.products WHERE id = _product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found' USING ERRCODE = 'no_data_found';
  END IF;

  -- The review screen was opened against a version. If the seller resubmitted
  -- since, the moderator is deciding about content they never read.
  IF _expected_version IS NOT NULL AND _row.version <> _expected_version THEN
    RAISE EXCEPTION 'sản phẩm đã đổi từ lúc mở duyệt (bản %, đang xem bản %)',
      _row.version, _expected_version USING ERRCODE = 'PT409';
  END IF;

  IF _decision <> 'approve' AND coalesce(btrim(_applicant_note), '') = '' THEN
    RAISE EXCEPTION 'quyết định này cần một lời nhắn cho người bán'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Which states each decision may act on. Everything else is refused by name
  -- so the caller learns what it did wrong.
  IF _decision IN ('approve', 'reject', 'request_changes') THEN
    IF _row.status <> 'pending_review' THEN
      RAISE EXCEPTION 'sản phẩm đang ở trạng thái % — chỉ duyệt được sản phẩm đang chờ', _row.status
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
  ELSIF _decision = 'suspend' THEN
    IF _row.status <> 'approved' THEN
      RAISE EXCEPTION 'chỉ gỡ được sản phẩm đã duyệt (đang là %)', _row.status
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
  ELSIF _decision = 'unpublish' THEN
    IF _row.status <> 'approved' OR NOT _row.is_published THEN
      RAISE EXCEPTION 'chỉ ẩn được sản phẩm đang hiển thị công khai'
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
  END IF;

  IF _decision = 'approve' THEN
    _problems := public.product_approve_preflight(_product_id);
    IF jsonb_array_length(_problems) > 0 THEN
      -- Data, not an exception: the moderator needs the whole list to decide
      -- whether to request changes instead, exactly as the seller does.
      RETURN jsonb_build_object('ok', false, 'status', _row.status, 'problems', _problems);
    END IF;
  END IF;

  IF _decision = 'request_changes' THEN
    PERFORM public.product_moderation_targets_check(_product_id, _requested_targets);
  END IF;

  _next := CASE _decision
             WHEN 'approve'         THEN 'approved'
             WHEN 'reject'          THEN 'rejected'
             WHEN 'request_changes' THEN 'needs_changes'
             WHEN 'suspend'         THEN 'suspended'
             ELSE _row.status                       -- unpublish keeps 'approved'
           END::public.product_status;

  _pub := _row.is_published;

  PERFORM set_config('shop.privileged_write', 'on', true);
  UPDATE public.products
  SET status            = _next,
      -- Approve does NOT publish. The bytes are not in the public bucket yet;
      -- product_publish_commit sets this once they are.
      is_published      = CASE WHEN _decision = 'approve' THEN is_published ELSE false END,
      decided_at        = now(),
      decided_by        = auth.uid(),
      applicant_note    = _applicant_note,
      internal_note     = _internal_note,
      requested_targets = CASE WHEN _decision = 'request_changes' THEN _requested_targets ELSE '[]'::jsonb END,
      requested_fields  = CASE
                            WHEN _decision = 'request_changes'
                            THEN ARRAY(SELECT DISTINCT jsonb_array_elements(_requested_targets) ->> 'section')
                            ELSE '{}'
                          END
  WHERE id = _product_id;
  PERFORM set_config('shop.privileged_write', 'off', true);

  -- Anything that is no longer publishable gives its public bytes back. The
  -- projection already refuses to serve it; this makes the object unreachable
  -- rather than merely unlinked (D1).
  IF _decision <> 'approve' THEN
    PERFORM public.shop_media_revoke_product_renditions(_product_id, _decision);
  END IF;

  INSERT INTO public.product_moderation_events (
    product_id, shop_id, decision, from_status, to_status, was_published,
    actor_user_id, client_token, applicant_note, requested_targets, internal_note,
    notify_key
  ) VALUES (
    _product_id, _row.shop_id, _decision, _row.status, _next, _pub,
    auth.uid(), _client_token, _applicant_note,
    CASE WHEN _decision = 'request_changes' THEN _requested_targets ELSE '[]'::jsonb END,
    _internal_note,
    -- One logical notification per decision per product per token. A retried
    -- dispatcher cannot produce a second.
    'product:' || _product_id::text || ':' || _decision || ':' ||
      coalesce(_client_token, gen_random_uuid()::text)
  );

  PERFORM public.log_audit_event(
    ('shop_product_' || _decision)::text,
    'admin'::text,
    'shop_product'::text,
    _product_id::text,
    (CASE WHEN _decision IN ('reject', 'suspend') THEN 'warning' ELSE 'info' END)::text,
    -- Small on purpose: ids and a decision. Never the internal note, never a
    -- storage path, never a signed URL.
    jsonb_build_object('shop_id', _row.shop_id, 'from', _row.status, 'to', _next),
    'user'::text
  );

  RETURN jsonb_build_object('ok', true, 'status', _next, 'replayed', false);
END $$;

REVOKE ALL   ON FUNCTION public.product_decide(UUID, TEXT, INTEGER, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.product_decide(UUID, TEXT, INTEGER, TEXT, TEXT, JSONB, TEXT) TO authenticated, service_role;

-- ─── 6. What each side may read of the history ──────────────────────────────

CREATE OR REPLACE FUNCTION public.product_moderation_history(_product_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _shop_id UUID;
  _admin   BOOLEAN := public.is_admin();
BEGIN
  SELECT shop_id INTO _shop_id FROM public.products WHERE id = _product_id;
  IF _shop_id IS NULL THEN
    RAISE EXCEPTION 'product not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT (_admin OR public.is_shop_member(_shop_id)) THEN
    RAISE EXCEPTION 'not a member of this shop' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- An allowlist per audience, written out. A removal list forgets the column
  -- somebody adds next month; internal_note is absent from the seller branch
  -- by construction, not by being stripped.
  RETURN coalesce((
    SELECT jsonb_agg(CASE WHEN _admin THEN jsonb_build_object(
             'id', e.id, 'decision', e.decision,
             'from_status', e.from_status, 'to_status', e.to_status,
             'actor_user_id', e.actor_user_id, 'created_at', e.created_at,
             'applicant_note', e.applicant_note, 'internal_note', e.internal_note,
             'requested_targets', e.requested_targets)
           ELSE jsonb_build_object(
             'id', e.id, 'decision', e.decision,
             'to_status', e.to_status, 'created_at', e.created_at,
             'applicant_note', e.applicant_note,
             'requested_targets', e.requested_targets)
           END ORDER BY e.created_at)
    FROM public.product_moderation_events e
    WHERE e.product_id = _product_id
  ), '[]'::jsonb);
END $$;

REVOKE ALL   ON FUNCTION public.product_moderation_history(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.product_moderation_history(UUID) TO authenticated, service_role;

-- ─── 7. The queue ───────────────────────────────────────────────────────────
-- Keyset pagination on (submitted_at, id). OFFSET would skip or repeat rows
-- as sellers submit while a moderator pages, and a moderator who never sees a
-- row is worse than one who waits.
--
-- No reviewer claim. With a single-digit pilot and one moderator, a claim
-- workflow adds a lock that has to be released, expired and overridden, to
-- solve contention that cannot happen. Two moderators deciding at once is
-- already handled by the expected-version guard, which fails loudly instead of
-- silently taking the last write. Revisit when there is a second moderator.

CREATE INDEX IF NOT EXISTS idx_products_moderation_queue
  ON public.products (submitted_at, id)
  WHERE status = 'pending_review';

CREATE OR REPLACE FUNCTION public.product_moderation_queue(
  _status        public.product_status DEFAULT 'pending_review',
  _shop_id       UUID    DEFAULT NULL,
  _category_slug TEXT    DEFAULT NULL,
  _cursor_at     TIMESTAMPTZ DEFAULT NULL,
  _cursor_id     UUID    DEFAULT NULL,
  _limit         INTEGER DEFAULT 25
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rows  JSONB;
  _n     INTEGER := least(greatest(coalesce(_limit, 25), 1), 100);
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin required' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT coalesce(jsonb_agg(r ORDER BY r ->> 'submitted_at', r ->> 'id'), '[]'::jsonb)
  INTO _rows
  FROM (
    SELECT jsonb_build_object(
             'id',            p.id,
             'title',         p.title,
             'status',        p.status,
             'version',       p.version,
             'submitted_at',  p.submitted_at,
             -- Computed here so every screen agrees on what "waiting" means.
             'waiting_seconds', GREATEST(0, EXTRACT(EPOCH FROM (now() - p.submitted_at))::bigint),
             'shop',          jsonb_build_object('id', s.id, 'slug', s.slug, 'name', s.name, 'state', s.state),
             'category',      jsonb_build_object(
                                'slug', c.slug, 'name', c.name_vi,
                                'is_active', coalesce(c.is_active, false)),
             -- Readiness as counts, not as paths. A queue row must never carry
             -- a storage path or a signed URL: it is rendered in a list, cached
             -- by the client, and nobody opened anything to earn it.
             'media_total',    (SELECT count(*) FROM public.product_media m WHERE m.product_id = p.id),
             'media_verified', (SELECT count(*) FROM public.product_media m
                                WHERE m.product_id = p.id AND m.verified_at IS NOT NULL),
             'variant_count',  (SELECT count(*) FROM public.product_variants v WHERE v.product_id = p.id),
             'times_returned', (SELECT count(*) FROM public.product_moderation_events e
                                WHERE e.product_id = p.id AND e.decision IN ('request_changes', 'reject'))
           ) AS r
    FROM public.products p
    JOIN public.shops s ON s.id = p.shop_id
    LEFT JOIN public.product_categories c ON c.slug = p.category_slug
    WHERE p.status = _status
      AND (_shop_id IS NULL OR p.shop_id = _shop_id)
      AND (_category_slug IS NULL OR p.category_slug = _category_slug)
      AND (_cursor_at IS NULL OR (p.submitted_at, p.id) > (_cursor_at, _cursor_id))
    ORDER BY p.submitted_at, p.id
    LIMIT _n
  ) q;

  RETURN jsonb_build_object(
    'rows', _rows,
    'has_more', jsonb_array_length(_rows) = _n,
    -- Counts come from the server. A screen that adds up the rows it happens
    -- to be holding reports the page size and calls it the backlog.
    'counts', (
      SELECT coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
      FROM (SELECT status::text AS status, count(*) AS n
            FROM public.products
            WHERE status IN ('pending_review', 'needs_changes', 'rejected', 'suspended')
            GROUP BY status) t
    )
  );
END $$;

REVOKE ALL   ON FUNCTION public.product_moderation_queue(public.product_status, UUID, TEXT, TIMESTAMPTZ, UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.product_moderation_queue(public.product_status, UUID, TEXT, TIMESTAMPTZ, UUID, INTEGER) TO authenticated, service_role;

-- ─── 8. The review payload ──────────────────────────────────────────────────
-- One call, one allowlist. The buyer preview is the canonical projection —
-- the moderator judges what a buyer will see, not a re-render of the form.

CREATE OR REPLACE FUNCTION public.product_moderation_detail(_product_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _p    public.products%ROWTYPE;
  _shop public.shops%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin required' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO _p FROM public.products WHERE id = _product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found' USING ERRCODE = 'no_data_found';
  END IF;
  SELECT * INTO _shop FROM public.shops WHERE id = _p.shop_id;

  RETURN jsonb_build_object(
    'id',      _p.id,
    'version', _p.version,          -- what the next decision must send back
    'status',  _p.status,
    'is_published', _p.is_published,
    'submitted_at', _p.submitted_at,
    -- The three ideas, kept apart.
    'moderation_state', jsonb_build_object(
      'decided',           _p.status IN ('approved', 'rejected', 'suspended'),
      'media_published',   EXISTS (SELECT 1 FROM public.product_media
                                   WHERE product_id = _p.id AND public_path IS NOT NULL),
      'publicly_visible',  _p.status = 'approved' AND _p.is_published AND _shop.state = 'active'
    ),
    -- Admin's view of the seller: enough to judge, nothing to dox. No owner
    -- id, no application, no contact values.
    'shop', jsonb_build_object(
      'id', _shop.id, 'slug', _shop.slug, 'name', _shop.name,
      'state', _shop.state, 'region', _shop.region,
      'verified', _shop.verified_at IS NOT NULL,
      'shipping_note', _shop.shipping_note, 'return_note', _shop.return_note,
      'product_counts', (
        SELECT coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
        FROM (SELECT status::text AS status, count(*) AS n FROM public.products
              WHERE shop_id = _shop.id GROUP BY status) t)
    ),
    'category', (SELECT jsonb_build_object('slug', c.slug, 'name', c.name_vi, 'is_active', c.is_active)
                 FROM public.product_categories c WHERE c.slug = _p.category_slug),
    -- Exactly what a buyer would get, from the one canonical projection.
    'buyer_preview',   public.product_public_projection(_p.id, true),
    'preflight',       public.product_approve_preflight(_p.id),
    'history',         public.product_moderation_history(_p.id),
    'internal_note',   _p.internal_note,
    'applicant_note',  _p.applicant_note,
    'requested_targets', _p.requested_targets,
    'edit_sections',   to_jsonb(public.product_edit_sections()),
    'contacts', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
               'id', ch.id, 'type', ch.type, 'state', ch.state,
               'is_public', ch.is_public, 'version', ch.version,
               'value_normalized', ch.value_normalized,
               'display_label', ch.display_label,
               'review_note', ch.review_note) ORDER BY ch.created_at), '[]'::jsonb)
      FROM public.shop_contact_channels ch WHERE ch.shop_id = _p.shop_id),
    -- What this admin may do next, derived from state. A screen that decides
    -- for itself will eventually offer a button the server refuses.
    'allowed_decisions', (
      CASE _p.status
        WHEN 'pending_review' THEN '["approve","reject","request_changes"]'::jsonb
        WHEN 'approved'       THEN (CASE WHEN _p.is_published
                                    THEN '["suspend","unpublish"]'::jsonb
                                    ELSE '["suspend"]'::jsonb END)
        ELSE '[]'::jsonb
      END)
  );
END $$;

REVOKE ALL   ON FUNCTION public.product_moderation_detail(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.product_moderation_detail(UUID) TO authenticated, service_role;

-- ─── 9. Contact moderation ──────────────────────────────────────────────────
-- Approving a link is approving somewhere a buyer will be sent. The value is
-- re-validated at DECISION time, not only at entry: the seller may have
-- changed it, and a scheme allowlist checked once is a scheme allowlist that
-- was checked on different bytes.

ALTER TABLE public.shop_contact_channels
  ADD COLUMN IF NOT EXISTS internal_note TEXT;

-- Re-runs the seller's own normaliser over the STORED value. Normalisation is
-- idempotent, so a value that was clean on the way in survives a second pass
-- unchanged. Anything that raises, or comes back different, is not something
-- to send a buyer to. This is the only check that looks at the bytes actually
-- sitting in the row rather than at whatever was posted months ago.
CREATE OR REPLACE FUNCTION public.shop_contact_value_is_safe(_type TEXT, _value TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  RETURN public.shop_contact_normalize(_type, _value) IS NOT DISTINCT FROM _value;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END $$;

REVOKE ALL   ON FUNCTION public.shop_contact_value_is_safe(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_contact_value_is_safe(TEXT, TEXT) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.shop_contact_decide(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.shop_contact_decide(
  _id               UUID,
  _decision         TEXT,
  _expected_version INTEGER DEFAULT NULL,
  _note             TEXT    DEFAULT NULL,
  _internal_note    TEXT    DEFAULT NULL,
  _client_token     TEXT    DEFAULT NULL
)
RETURNS JSONB
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
    RAISE EXCEPTION 'từ chối hoặc tắt kênh cần một lý do cho người bán'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT * INTO _row FROM public.shop_contact_channels WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'contact channel not found' USING ERRCODE = 'no_data_found';
  END IF;

  IF _expected_version IS NOT NULL AND _row.version <> _expected_version THEN
    RAISE EXCEPTION 'kênh liên hệ đã đổi từ lúc mở duyệt (bản %, đang xem bản %)',
      _row.version, _expected_version USING ERRCODE = 'PT409';
  END IF;

  -- Computed BEFORE it is compared. A CASE inside an `IF ... THEN` condition
  -- does not parse: plpgsql scans the condition up to the first THEN, and the
  -- first THEN belongs to the CASE.
  _next := CASE _decision
             WHEN 'approve' THEN 'approved'
             WHEN 'reject'  THEN 'rejected'
             ELSE 'disabled'
           END::public.shop_contact_state;

  -- Idempotent by outcome: approving an already-approved channel at the same
  -- version is the answer the caller wanted, not an error.
  IF _row.state = _next THEN
    RETURN jsonb_build_object('ok', true, 'state', _row.state, 'replayed', true);
  END IF;

  IF _decision = 'approve' AND NOT public.shop_contact_value_is_safe(_row.type::text, _row.value_normalized) THEN
    RAISE EXCEPTION 'giá trị kênh liên hệ không an toàn để công khai — yêu cầu người bán nhập lại'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  PERFORM set_config('shop.privileged_write', 'on', true);
  UPDATE public.shop_contact_channels
  SET state         = _next,
      review_note   = _note,
      internal_note = _internal_note,
      approved_at   = CASE WHEN _decision = 'approve' THEN now() ELSE NULL END,
      approved_by   = CASE WHEN _decision = 'approve' THEN auth.uid() ELSE NULL END,
      version       = version + 1
  WHERE id = _id;
  PERFORM set_config('shop.privileged_write', 'off', true);

  PERFORM public.log_audit_event(
    ('shop_contact_' || _decision)::text, 'admin'::text, 'shop'::text, _row.shop_id::text,
    'info'::text,
    -- The channel TYPE, never the number or the URL.
    jsonb_build_object('channel_type', _row.type, 'channel_id', _row.id), 'user'::text
  );

  RETURN jsonb_build_object('ok', true, 'state', _next, 'replayed', false);
END $$;

REVOKE ALL   ON FUNCTION public.shop_contact_decide(UUID, TEXT, INTEGER, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_contact_decide(UUID, TEXT, INTEGER, TEXT, TEXT, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.shop_contact_moderation_queue(
  _state public.shop_contact_state DEFAULT 'pending_review'
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin required' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'id', ch.id, 'type', ch.type, 'state', ch.state,
             'is_public', ch.is_public, 'version', ch.version,
             'value_normalized', ch.value_normalized,
             'display_label', ch.display_label,
             'updated_at', ch.updated_at,
             'shop', jsonb_build_object('id', s.id, 'slug', s.slug, 'name', s.name, 'state', s.state)
           ) ORDER BY ch.updated_at)
    FROM public.shop_contact_channels ch
    JOIN public.shops s ON s.id = ch.shop_id
    WHERE ch.state = _state
  ), '[]'::jsonb);
END $$;

REVOKE ALL   ON FUNCTION public.shop_contact_moderation_queue(public.shop_contact_state) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_contact_moderation_queue(public.shop_contact_state) TO authenticated, service_role;
