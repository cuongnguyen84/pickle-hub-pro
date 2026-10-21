-- ============================================================================
-- Cho người bán tự đặt phí giao hàng
-- ----------------------------------------------------------------------------
-- Trước file này, `shops.shipping_fee_vnd` là con số người mua thật sự bị thu ở
-- giỏ hàng, nhưng người bán KHÔNG sửa được nó ở đâu cả: màn hình cài đặt chỉ
-- cho sửa `shipping_note` — một ô chữ tự do — và `shop_profile_update` cũng
-- không nhận khoá đó trong patch.
--
-- Hậu quả quan sát được trên production 19/08: shop ghi "Giao hàng miễn phí
-- toàn quốc" trong khi `shipping_fee_vnd = 30000`. Trang sản phẩm hứa một
-- đằng, giỏ hàng thu một nẻo. Đó không phải người bán nói dối — đó là người
-- bán chỉ với tới được cái chữ, không với tới được cái số.
--
-- PO quyết 19/08: phí ship để người bán tự chọn. File này mở đúng chỗ đó.
--
-- Trần 1.000.000₫: CHECK trên bảng mới chỉ chặn số âm, nên một lần gõ thừa số 0
-- (300000 → 3000000) sẽ âm thầm định giá shop ra khỏi thị trường mà không ai
-- báo. Chặn ở đây, kèm câu tiếng Việt đọc được, rẻ hơn nhiều so với đi tìm
-- nguyên nhân vì sao tự dưng không ai đặt hàng nữa.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.shop_profile_update(
  _shop_id uuid,
  _expected_version integer,
  _patch jsonb
)
RETURNS shops
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _row public.shops%ROWTYPE;
  _fee INTEGER;
BEGIN
  SELECT * INTO _row FROM public.shops WHERE id = _shop_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'shop not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT public.is_shop_manager(_shop_id) THEN
    RAISE EXCEPTION 'not a manager of this shop' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF _row.version <> _expected_version THEN
    RAISE EXCEPTION 'hồ sơ đã được cập nhật ở nơi khác (phiên bản % ≠ %)', _row.version, _expected_version
      USING ERRCODE = 'PT409';
  END IF;

  -- Kiểm phí TRƯỚC khi UPDATE: hỏng thì không được nhích version, nếu không
  -- lần lưu sau của người bán sẽ nhận PT409 cho một thay đổi chưa hề xảy ra.
  IF _patch ? 'shipping_fee_vnd' THEN
    BEGIN
      _fee := (_patch ->> 'shipping_fee_vnd')::INTEGER;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'phí giao hàng phải là số nguyên' USING ERRCODE = 'check_violation';
    END;
    IF _fee < 0 THEN
      RAISE EXCEPTION 'phí giao hàng không được âm' USING ERRCODE = 'check_violation';
    END IF;
    IF _fee > 1000000 THEN
      RAISE EXCEPTION 'phí giao hàng tối đa 1.000.000₫ (nhận %₫ — kiểm lại xem có thừa số 0 không)', _fee
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  UPDATE public.shops
  SET name                  = coalesce(_patch ->> 'name', name),
      intro                 = CASE WHEN _patch ? 'intro' THEN NULLIF(btrim(_patch ->> 'intro'), '') ELSE intro END,
      city                  = CASE WHEN _patch ? 'city' THEN NULLIF(btrim(_patch ->> 'city'), '') ELSE city END,
      region                = CASE WHEN _patch ? 'region' THEN NULLIF(btrim(_patch ->> 'region'), '') ELSE region END,
      primary_category_slug = CASE WHEN _patch ? 'primary_category_slug'
                                   THEN NULLIF(_patch ->> 'primary_category_slug', '') ELSE primary_category_slug END,
      shipping_note         = CASE WHEN _patch ? 'shipping_note' THEN NULLIF(btrim(_patch ->> 'shipping_note'), '') ELSE shipping_note END,
      -- Người bán tự chọn. Không NULLIF ở đây: 0 là một lựa chọn có nghĩa
      -- ("miễn phí"), không phải ô để trống.
      shipping_fee_vnd      = CASE WHEN _patch ? 'shipping_fee_vnd' THEN _fee ELSE shipping_fee_vnd END,
      return_note           = CASE WHEN _patch ? 'return_note' THEN NULLIF(btrim(_patch ->> 'return_note'), '') ELSE return_note END,
      -- Whitespace is stripped from the account number rather than rejected:
      -- every banking app in the country prints it in groups, and a buyer who
      -- pastes "0123 4567 8901" should not be told their own account is
      -- invalid. The CHECK still refuses anything that is not digits.
      bank_code             = CASE WHEN _patch ? 'bank_code'
                                   THEN NULLIF(btrim(_patch ->> 'bank_code'), '') ELSE bank_code END,
      bank_account_number   = CASE WHEN _patch ? 'bank_account_number'
                                   THEN NULLIF(regexp_replace(coalesce(_patch ->> 'bank_account_number', ''), '\s', '', 'g'), '')
                                   ELSE bank_account_number END,
      bank_account_name     = CASE WHEN _patch ? 'bank_account_name'
                                   THEN NULLIF(btrim(_patch ->> 'bank_account_name'), '') ELSE bank_account_name END
  WHERE id = _shop_id AND version = _expected_version
  RETURNING * INTO _row;

  RETURN _row;
END $function$;

COMMENT ON FUNCTION public.shop_profile_update(uuid, integer, jsonb) IS
  'Cập nhật hồ sơ shop có kiểm phiên bản. Từ 20260819130000 nhận thêm shipping_fee_vnd (0..1.000.000) để người bán tự đặt phí giao hàng.';
