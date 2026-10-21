-- ============================================================================
-- P2b.1b — Q5 (suspended recovery) and Q6 (contact moderation events).
--
-- ── Q5: there is no way back to sale without a second look ────────────────
-- P2b.1 shipped `suspend` as a one-way door because the recovery path was
-- undecided. Signed 2026-08-12: `suspended → approved` stays FORBIDDEN. The
-- only road back is
--
--     suspended → needs_changes → pending_review → approved
--
-- so a product an admin pulled cannot return to the storefront without a
-- seller fixing something and an admin approving it again. "Restore and sell
-- immediately" is not a button anybody gets.
--
-- The new transition is `reopen`, and it is deliberately NOT called restore:
-- it restores the seller's ability to EDIT, not the product's ability to sell.
-- It carries the same requirements as request_changes — a seller-visible
-- reason and at least one structured target — because a seller told "you may
-- edit again" with no indication of what to change is being asked to guess
-- what got them suspended.
--
-- ── Q6: contact decisions get their own history ───────────────────────────
-- product_moderation_events is keyed by product. A contact channel belongs to
-- a SHOP, and P2b.1 recorded that giving it a nullable product_id would be
-- inventing a schema rather than choosing one. Signed: its own table.
--
-- Same shape, same guarantees, different subject: append-only, admin-read via
-- RLS, seller reads an allowlisted projection through a function, anonymous
-- reads nothing, idempotent on a client token, and the normalised value is
-- never copied into anything a dispatcher would send.
-- ============================================================================

-- ─── 1. Q5 — reopen ─────────────────────────────────────────────────────────

ALTER TABLE public.product_moderation_events
  DROP CONSTRAINT IF EXISTS product_moderation_decision_kind;
ALTER TABLE public.product_moderation_events
  ADD CONSTRAINT product_moderation_decision_kind CHECK (
    decision IN ('approve', 'reject', 'request_changes', 'suspend', 'unpublish', 'reopen')
  );

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
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin required' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF _decision NOT IN ('approve', 'reject', 'request_changes', 'suspend', 'unpublish', 'reopen') THEN
    RAISE EXCEPTION 'unknown decision %', _decision USING ERRCODE = 'invalid_parameter_value';
  END IF;

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

  IF _expected_version IS NOT NULL AND _row.version <> _expected_version THEN
    RAISE EXCEPTION 'sản phẩm đã đổi từ lúc mở duyệt (bản %, đang xem bản %)',
      _row.version, _expected_version USING ERRCODE = 'PT409';
  END IF;

  IF _decision <> 'approve' AND coalesce(btrim(_applicant_note), '') = '' THEN
    RAISE EXCEPTION 'quyết định này cần một lời nhắn cho người bán'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

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
  ELSIF _decision = 'reopen' THEN
    -- Q5. The ONLY exit from 'suspended', and it goes to needs_changes —
    -- never to approved. A pulled product does not go back on sale because an
    -- admin changed their mind in the same click.
    IF _row.status <> 'suspended' THEN
      RAISE EXCEPTION 'chỉ mở lại được sản phẩm đang bị gỡ (đang là %)', _row.status
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
  END IF;

  IF _decision = 'approve' THEN
    _problems := public.product_approve_preflight(_product_id);
    IF jsonb_array_length(_problems) > 0 THEN
      RETURN jsonb_build_object('ok', false, 'status', _row.status, 'problems', _problems);
    END IF;
  END IF;

  -- reopen carries the same burden as request_changes: a seller told "you may
  -- edit again" with no indication of what to change is being asked to guess
  -- what got them suspended.
  IF _decision IN ('request_changes', 'reopen') THEN
    PERFORM public.product_moderation_targets_check(_product_id, _requested_targets);
  END IF;

  _next := CASE _decision
             WHEN 'approve'         THEN 'approved'
             WHEN 'reject'          THEN 'rejected'
             WHEN 'request_changes' THEN 'needs_changes'
             WHEN 'reopen'          THEN 'needs_changes'
             WHEN 'suspend'         THEN 'suspended'
             ELSE _row.status
           END::public.product_status;

  _pub := _row.is_published;

  PERFORM set_config('shop.privileged_write', 'on', true);
  UPDATE public.products
  SET status            = _next,
      is_published      = CASE WHEN _decision = 'approve' THEN is_published ELSE false END,
      decided_at        = now(),
      decided_by        = auth.uid(),
      applicant_note    = _applicant_note,
      internal_note     = _internal_note,
      requested_targets = CASE WHEN _decision IN ('request_changes', 'reopen')
                               THEN _requested_targets ELSE '[]'::jsonb END,
      requested_fields  = CASE
                            WHEN _decision IN ('request_changes', 'reopen')
                            THEN ARRAY(SELECT DISTINCT jsonb_array_elements(_requested_targets) ->> 'section')
                            ELSE '{}'
                          END
  WHERE id = _product_id;
  PERFORM set_config('shop.privileged_write', 'off', true);

  -- reopen revokes too. The product was suspended, so its renditions are
  -- already gone; asking again is idempotent and covers the case where the
  -- worker had not drained the queue yet. What reopen must NEVER do is
  -- re-publish: the bytes come back only after a fresh approve.
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
    CASE WHEN _decision IN ('request_changes', 'reopen') THEN _requested_targets ELSE '[]'::jsonb END,
    _internal_note,
    'product:' || _product_id::text || ':' || _decision || ':' ||
      coalesce(_client_token, gen_random_uuid()::text)
  );

  PERFORM public.log_audit_event(
    ('shop_product_' || _decision)::text,
    'admin'::text,
    'shop_product'::text,
    _product_id::text,
    (CASE WHEN _decision IN ('reject', 'suspend') THEN 'warning' ELSE 'info' END)::text,
    jsonb_build_object('shop_id', _row.shop_id, 'from', _row.status, 'to', _next),
    'user'::text
  );

  RETURN jsonb_build_object('ok', true, 'status', _next, 'replayed', false);
END $$;

REVOKE ALL   ON FUNCTION public.product_decide(UUID, TEXT, INTEGER, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.product_decide(UUID, TEXT, INTEGER, TEXT, TEXT, JSONB, TEXT) TO authenticated, service_role;

-- allowed_decisions has to learn the new exit, or the screen will keep
-- offering nothing for a suspended product.
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
    'version', _p.version,
    'status',  _p.status,
    'is_published', _p.is_published,
    'submitted_at', _p.submitted_at,
    'moderation_state', jsonb_build_object(
      'decided',           _p.status IN ('approved', 'rejected', 'suspended'),
      'media_published',   EXISTS (SELECT 1 FROM public.product_media
                                   WHERE product_id = _p.id AND public_path IS NOT NULL),
      'publicly_visible',  _p.status = 'approved' AND _p.is_published AND _shop.state = 'active'
    ),
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
    'allowed_decisions', (
      CASE _p.status
        WHEN 'pending_review' THEN '["approve","reject","request_changes"]'::jsonb
        WHEN 'approved'       THEN (CASE WHEN _p.is_published
                                    THEN '["suspend","unpublish"]'::jsonb
                                    ELSE '["suspend"]'::jsonb END)
        -- Q5: one exit, and it leads to the seller's editor, not to the shelf.
        WHEN 'suspended'      THEN '["reopen"]'::jsonb
        ELSE '[]'::jsonb
      END)
  );
END $$;

REVOKE ALL   ON FUNCTION public.product_moderation_detail(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.product_moderation_detail(UUID) TO authenticated, service_role;

-- ─── 2. Q6 — contact moderation events ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.shop_contact_moderation_events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id            UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  contact_channel_id UUID NOT NULL REFERENCES public.shop_contact_channels(id) ON DELETE CASCADE,
  action             TEXT NOT NULL,
  from_state         public.shop_contact_state NOT NULL,
  to_state           public.shop_contact_state NOT NULL,
  -- The channel TYPE travels; the value does not. A history row is read in a
  -- list, exported and eventually handed to a dispatcher, and none of those
  -- need the seller's phone number to say "the phone channel was approved".
  channel_type       public.shop_contact_type NOT NULL,
  actor_user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  client_token       TEXT,
  applicant_note     TEXT,          -- seller-visible reason
  internal_note      TEXT,          -- admin only
  notify_key         TEXT UNIQUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT shop_contact_moderation_action_kind CHECK (
    action IN ('approve', 'reject', 'disable', 'resubmitted')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_shop_contact_moderation_token
  ON public.shop_contact_moderation_events (contact_channel_id, client_token)
  WHERE client_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shop_contact_moderation_channel
  ON public.shop_contact_moderation_events (contact_channel_id, created_at DESC);

ALTER TABLE public.shop_contact_moderation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shop_contact_moderation_events_admin_read" ON public.shop_contact_moderation_events;
CREATE POLICY "shop_contact_moderation_events_admin_read" ON public.shop_contact_moderation_events
  FOR SELECT TO authenticated
  USING (public.is_admin());

REVOKE ALL    ON public.shop_contact_moderation_events FROM anon, authenticated;
GRANT  SELECT ON public.shop_contact_moderation_events TO authenticated;
GRANT  SELECT, INSERT ON public.shop_contact_moderation_events TO service_role;

-- Append-only, but not so append-only that the subject can never be deleted.
--
-- This is the P2a inventory-ledger lesson, arriving on schedule: a blanket
-- refusal on DELETE makes the ON DELETE CASCADE above impossible, so deleting
-- a contact channel that was ever moderated fails — and that takes account
-- deletion and the QA teardown with it. `shop_contact_delete` is a seller-
-- facing RPC, so the P2a profile suite found it immediately.
--
-- Postgres removes the parent row before the children, so inside this trigger
-- a missing parent IS the cascade. History still cannot be edited or
-- selectively pruned; it goes only when its whole subject goes.
CREATE OR REPLACE FUNCTION public.shop_contact_moderation_events_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'nhật ký kiểm duyệt kênh liên hệ chỉ được ghi thêm, không sửa'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = OLD.shop_id)
     OR NOT EXISTS (SELECT 1 FROM public.shop_contact_channels WHERE id = OLD.contact_channel_id) THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'nhật ký kiểm duyệt kênh liên hệ chỉ được ghi thêm, không xoá'
    USING ERRCODE = 'insufficient_privilege';
END $$;

-- The same latent trap in the product history from P2b.1. Nothing has hit it
-- yet only because sellers have no DELETE policy on products, so the cascade
-- has never been exercised — which is precisely how it would have reached
-- production and then blocked the first admin deletion.
CREATE OR REPLACE FUNCTION public.product_moderation_events_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'nhật ký kiểm duyệt chỉ được ghi thêm, không sửa'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = OLD.shop_id)
     OR NOT EXISTS (SELECT 1 FROM public.products WHERE id = OLD.product_id) THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'nhật ký kiểm duyệt chỉ được ghi thêm, không xoá'
    USING ERRCODE = 'insufficient_privilege';
END $$;

DROP TRIGGER IF EXISTS shop_contact_moderation_events_append_only_trg ON public.shop_contact_moderation_events;
CREATE TRIGGER shop_contact_moderation_events_append_only_trg
  BEFORE UPDATE OR DELETE ON public.shop_contact_moderation_events
  FOR EACH ROW EXECUTE FUNCTION public.shop_contact_moderation_events_append_only();

-- The seller's half, through a function, for the same reason as the product
-- history: an admin is also `authenticated`, so column privileges cannot tell
-- the two audiences apart.
CREATE OR REPLACE FUNCTION public.shop_contact_moderation_history(_channel_id UUID)
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
  SELECT shop_id INTO _shop_id FROM public.shop_contact_channels WHERE id = _channel_id;
  IF _shop_id IS NULL THEN
    RAISE EXCEPTION 'contact channel not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT (_admin OR public.is_shop_member(_shop_id)) THEN
    RAISE EXCEPTION 'not a member of this shop' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN coalesce((
    SELECT jsonb_agg(CASE WHEN _admin THEN jsonb_build_object(
             'id', e.id, 'action', e.action, 'channel_type', e.channel_type,
             'from_state', e.from_state, 'to_state', e.to_state,
             'actor_user_id', e.actor_user_id, 'created_at', e.created_at,
             'applicant_note', e.applicant_note, 'internal_note', e.internal_note)
           ELSE jsonb_build_object(
             'id', e.id, 'action', e.action, 'channel_type', e.channel_type,
             'to_state', e.to_state, 'created_at', e.created_at,
             'applicant_note', e.applicant_note)
           END ORDER BY e.created_at)
    FROM public.shop_contact_moderation_events e
    WHERE e.contact_channel_id = _channel_id
  ), '[]'::jsonb);
END $$;

REVOKE ALL   ON FUNCTION public.shop_contact_moderation_history(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_contact_moderation_history(UUID) TO authenticated, service_role;

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
  _row   public.shop_contact_channels%ROWTYPE;
  _next  public.shop_contact_state;
  _prior public.shop_contact_moderation_events%ROWTYPE;
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

  -- Token replay first, same as products: a retry of a decision that already
  -- happened returns the first answer instead of racing the state guard.
  IF _client_token IS NOT NULL THEN
    SELECT * INTO _prior FROM public.shop_contact_moderation_events
    WHERE contact_channel_id = _id AND client_token = _client_token;
    IF FOUND THEN
      RETURN jsonb_build_object('ok', true, 'state', _prior.to_state, 'replayed', true,
                                'event_id', _prior.id);
    END IF;
  END IF;

  SELECT * INTO _row FROM public.shop_contact_channels WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'contact channel not found' USING ERRCODE = 'no_data_found';
  END IF;

  IF _expected_version IS NOT NULL AND _row.version <> _expected_version THEN
    RAISE EXCEPTION 'kênh liên hệ đã đổi từ lúc mở duyệt (bản %, đang xem bản %)',
      _row.version, _expected_version USING ERRCODE = 'PT409';
  END IF;

  _next := CASE _decision
             WHEN 'approve' THEN 'approved'
             WHEN 'reject'  THEN 'rejected'
             ELSE 'disabled'
           END::public.shop_contact_state;

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

  INSERT INTO public.shop_contact_moderation_events (
    shop_id, contact_channel_id, action, from_state, to_state, channel_type,
    actor_user_id, client_token, applicant_note, internal_note, notify_key
  ) VALUES (
    _row.shop_id, _id, _decision, _row.state, _next, _row.type,
    auth.uid(), _client_token, _note, _internal_note,
    'contact:' || _id::text || ':' || _decision || ':' ||
      coalesce(_client_token, gen_random_uuid()::text)
  );

  PERFORM public.log_audit_event(
    ('shop_contact_' || _decision)::text, 'admin'::text, 'shop'::text, _row.shop_id::text,
    'info'::text,
    jsonb_build_object('channel_type', _row.type, 'channel_id', _row.id), 'user'::text
  );

  RETURN jsonb_build_object('ok', true, 'state', _next, 'replayed', false);
END $$;

REVOKE ALL   ON FUNCTION public.shop_contact_decide(UUID, TEXT, INTEGER, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_contact_decide(UUID, TEXT, INTEGER, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- A seller editing an approved channel sends it back to review (the P2a
-- guard already does that). Record it, so the history reads as a conversation
-- rather than a list of admin verdicts with unexplained gaps.
CREATE OR REPLACE FUNCTION public.shop_contact_record_resubmit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.state = 'approved' AND NEW.state = 'pending_review' THEN
    INSERT INTO public.shop_contact_moderation_events (
      shop_id, contact_channel_id, action, from_state, to_state, channel_type,
      actor_user_id, applicant_note
    ) VALUES (
      NEW.shop_id, NEW.id, 'resubmitted', OLD.state, NEW.state, NEW.type,
      auth.uid(), NULL
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS shop_contact_record_resubmit_trg ON public.shop_contact_channels;
-- Deliberately NOT `UPDATE OF state`. That clause fires on the columns NAMED
-- in the UPDATE statement, not on the ones whose value ends up different —
-- and `state` here is set by P2a's BEFORE guard when the seller changes the
-- value, so the statement never mentions it. `UPDATE OF state` silently never
-- fired; the OLD/NEW comparison in the function does the filtering instead.
CREATE TRIGGER shop_contact_record_resubmit_trg
  AFTER UPDATE ON public.shop_contact_channels
  FOR EACH ROW EXECUTE FUNCTION public.shop_contact_record_resubmit();
