-- ============================================================================
-- Sản phẩm: người bán tự đăng bán. Admin chỉ duyệt việc MỞ SHOP, và gỡ.
-- ----------------------------------------------------------------------------
-- Cùng một quyết định với 20260818160000 (kênh liên hệ), nhưng phía sản phẩm
-- không chặn ở một trigger — nó chặn ở BỐN tầng độc lập, tất cả đều khoá theo
-- `status = 'approved'`:
--
--   1. CHECK `products_publish_requires_approval` — is_published chỉ đúng khi
--      status='approved'
--   2. `product_publish_prepare` raise nếu status <> 'approved'
--   3. `product_media_guard_rendition` ghim `public_path` cho mọi người viết
--      không đặc quyền
--   4. `is_published` chỉ `product_publish_commit` (service_role) ghi được
--
-- Nới bốn tầng đó ra là mở toang một bề mặt mà không ai đọc nổi nữa. Nên
-- migration này KHÔNG nới cái nào. Nó đổi đúng một thứ: **trạng thái mà thao
-- tác của NGƯỜI BÁN chạm tới**. `product_submit` trước đây dừng ở
-- `pending_review` và chờ admin; nay nó đi thẳng tới `approved`, và toàn bộ
-- đường ống phía sau chạy y nguyên, không biết là ai đã bấm.
--
-- Hệ quả kéo theo, và là lý do migration này có RPC thứ hai: `product_status_
-- is_editable()` chỉ nhận `draft` và `needs_changes`, nên trước đây một sản
-- phẩm đã lên kệ chỉ có admin mới mở lại được (`suspend` → `reopen`). Bỏ admin
-- khỏi vòng lặp mà không thêm đường quay lại thì người bán tự khoá chính mình:
-- đăng xong, thấy sai một chữ, và không sửa được nữa. `product_edit_again` là
-- đường đó.
--
-- Cái gì KHÔNG đổi:
--   * `product_submit_preflight` vẫn chạy và vẫn chặn. Nó chưa bao giờ là hàng
--     rào kiểm duyệt — nó là danh sách "thiếu ảnh, thiếu giá, thiếu mô tả", tức
--     là thứ đứng giữa "đã bấm đăng" và "approved mà vô hình". Bỏ nó đi thì
--     người bán đăng được một sản phẩm mà `shop_public_search` lọc ra.
--   * `product_decide` còn nguyên, vẫn admin-only, vẫn là ĐÒN GỠ:
--     `suspend` (từ approved) và `unpublish`. Điều kiện của `suspend` là
--     status='approved' — và vì thao tác người bán nay dừng ở đúng trạng thái
--     đó, đòn gỡ vẫn với tới được. Đây là lý do chọn `approved` chứ không đặt
--     ra một trạng thái mới.
--   * Hàng đợi `/admin/shop/products` để nguyên, ngủ đông. Nó là đường lùi.
--   * Sản phẩm đang ở `pending_review` từ trước vẫn duyệt được như cũ.

-- ─── 1. "Gửi duyệt" trở thành "Đăng bán" ────────────────────────────────────
-- Viết lại TOÀN BỘ thân hàm chứ không vá. 20260818100000 đã ghi chuyện xảy ra
-- khi CREATE OR REPLACE chép nhầm một bản cũ: nó âm thầm gỡ mất lối thoát
-- slug_write và không ai đọc ra.

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
  SET status       = 'approved',
      submitted_at = now(),
      -- `decided_at` được đặt vì có một quyết định thật: người bán quyết định
      -- đăng nó. `decided_by` để TRỐNG — không có người kiểm duyệt nào, và bịa
      -- một uid vào đó là nói dối nhật ký. Cùng luật với `approved_by` của kênh
      -- liên hệ ở 20260818160000.
      decided_at   = now(),
      decided_by   = NULL,
      -- The change request is answered, so the list of fields it named is
      -- cleared. applicant_note is NOT cleared: the seller keeps the reason
      -- they were asked, and the moderator keeps what they said.
      requested_fields = '{}'
  WHERE id = _product_id AND status = _p.status;
  PERFORM set_config('shop.privileged_write', 'off', true);

  INSERT INTO public.product_submission_events
    (product_id, shop_id, event, from_status, to_status, actor_user_id, client_token, metadata)
  VALUES
    (_product_id, _p.shop_id, _event, _p.status, 'approved', auth.uid(),
     NULLIF(btrim(coalesce(_client_token, '')), ''),
     jsonb_build_object('version', _p.version));

  -- `published` vẫn FALSE ở đây, và đó là chủ ý: byte ảnh chưa nằm trong bucket
  -- công khai. Người gọi phải chạy tiếp chân publish (edge `shop-media-lifecycle`,
  -- action `publish`) — đúng thứ tự màn admin vẫn làm, chỉ khác là nay màn
  -- người bán gọi. Trả `needs_publish` để client không phải suy ra.
  RETURN jsonb_build_object(
    'ok', true, 'status', 'approved', 'event', _event, 'replayed', false,
    'needs_publish', true);
END $$;

COMMENT ON FUNCTION public.product_submit(UUID, INTEGER, TEXT) IS
  'Người bán đăng bán: draft|needs_changes → approved (20260818170000). decided_by để trống vì không ai duyệt. Người gọi phải chạy tiếp chân publish để ảnh vào bucket công khai.';

-- ─── 2. Đường quay lại: gỡ xuống để sửa ─────────────────────────────────────

ALTER TABLE public.product_submission_events
  DROP CONSTRAINT IF EXISTS product_submission_event_kind;
ALTER TABLE public.product_submission_events
  ADD CONSTRAINT product_submission_event_kind CHECK (
    event IN ('submitted', 'resubmitted', 'withdrawn', 'unpublished_to_edit')
  );

CREATE OR REPLACE FUNCTION public.product_edit_again(
  _product_id       UUID,
  _expected_version INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _p       public.products%ROWTYPE;
  _revoked INTEGER;
BEGIN
  SELECT * INTO _p FROM public.products WHERE id = _product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found' USING ERRCODE = 'no_data_found';
  END IF;
  PERFORM public.product_assert_writable(_p.shop_id);

  -- Chỉ từ `approved`. `suspended` KHÔNG có mặt ở đây một cách có chủ ý: đó là
  -- quyết định của admin, và lối ra duy nhất của nó vẫn là `reopen`. Người bán
  -- không tự gỡ lệnh treo của mình bằng cách bấm "sửa lại".
  IF _p.status <> 'approved' THEN
    RAISE EXCEPTION 'chỉ sản phẩm đang bán mới gỡ xuống để sửa được'
      USING ERRCODE = '22023';
  END IF;

  IF _expected_version IS NOT NULL AND _p.version <> _expected_version THEN
    RAISE EXCEPTION 'sản phẩm đã được cập nhật ở nơi khác (phiên bản % ≠ %)',
      _p.version, _expected_version USING ERRCODE = 'PT409';
  END IF;

  -- Byte công khai đi trước, trong cùng transaction. Sản phẩm đã khuất mắt
  -- người mua ngay ở dòng UPDATE bên dưới (`is_published`), nhưng để lại một
  -- bản sao trong bucket công khai là để lại một URL vẫn tải được.
  _revoked := public.shop_media_revoke_product_renditions(_product_id, 'unpublish');

  PERFORM set_config('shop.privileged_write', 'on', true);
  UPDATE public.products
  SET status       = 'draft',
      is_published = false,
      decided_at   = NULL,
      decided_by   = NULL
  WHERE id = _product_id;
  PERFORM set_config('shop.privileged_write', 'off', true);

  INSERT INTO public.product_submission_events
    (product_id, shop_id, event, from_status, to_status, actor_user_id, metadata)
  VALUES
    (_product_id, _p.shop_id, 'unpublished_to_edit', _p.status, 'draft', auth.uid(),
     jsonb_build_object('version', _p.version, 'renditions_revoked', _revoked));

  RETURN jsonb_build_object('ok', true, 'status', 'draft', 'renditions_revoked', _revoked);
END $$;

REVOKE ALL   ON FUNCTION public.product_edit_again(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.product_edit_again(UUID, INTEGER) TO authenticated, service_role;

COMMENT ON FUNCTION public.product_edit_again(UUID, INTEGER) IS
  'Người bán gỡ hàng đang bán xuống để sửa: approved → draft, thu byte công khai (20260818170000). KHÔNG nhận suspended — lệnh treo của admin chỉ reopen mới gỡ.';

NOTIFY pgrst, 'reload schema';
