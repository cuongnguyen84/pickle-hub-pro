-- ============================================================================
-- Kênh liên hệ: shop đã được duyệt thì kênh của người bán tự lên.
-- ----------------------------------------------------------------------------
-- Đây vừa là một quyết định sản phẩm, vừa là bản vá cho một tính năng CHƯA BAO
-- GIỜ chạm tới được.
--
-- Lỗi: `shop_contact_guard()` ghim cứng `NEW.state := 'draft'` ở nhánh INSERT,
-- và `shop_contact_upsert` không bao giờ đụng tới `state`. Nhánh UPDATE chỉ đổi
-- state khi GIÁ TRỊ hoặc LOẠI kênh thay đổi (draft → pending_review). Nghĩa là:
--
--   tạo kênh          → draft
--   bật công khai     → vẫn draft
--   sửa nhãn hiển thị → vẫn draft
--
-- …và trong màn cài đặt của người bán không có nút nào gửi duyệt. Huy hiệu ghi
-- "Chưa gửi duyệt" — đặt tên cho một hành động không tồn tại. Kênh Zalo duy
-- nhất trên production nằm ở `draft` từ 17/08, version 2, KHÔNG một sự kiện
-- duyệt nào. Người bán đã sửa nó hôm nay và nó vẫn ở draft.
--
-- Hệ quả không nhỏ: `shop_public_contacts` lọc `state='approved'`, nên MỌI nút
-- "Liên hệ shop" đang hiện ra rỗng. Đó đúng là điều kiện an toàn mà Phase 3
-- dựa vào để cắt bỏ trả hàng và khiếu nại — "nút liên hệ có mặt ở mọi trạng
-- thái đơn" đúng trong code và rỗng trong dữ liệu.
--
-- Quyết định của PO (18/08): **admin chỉ duyệt việc MỞ SHOP.** Trong một shop
-- đã active, người bán tự quyết kênh liên hệ của mình. Ranh giới tin cậy là
-- cái shop, không phải từng dòng dữ liệu bên trong nó.
--
-- Cái gì KHÔNG đổi:
--   * `shop_public_contacts` vẫn đòi `is_public AND state='approved' AND
--     shop.state='active'`. Không nới một dấu phẩy nào ở cửa công khai.
--   * `shop_contact_decide('reject'|'disable')` vẫn còn, vẫn admin-only, vẫn
--     là đòn gỡ. Hàng đợi admin ở /admin/shop/contacts vẫn chạy — nay nó là
--     nơi XEM LẠI và GỠ, không còn là cổng phải đi qua.
--   * Shop chưa active thì kênh vẫn vào `draft`. Không phải để giữ cổng — cửa
--     công khai đã chặn theo `shop.state` rồi — mà để huy hiệu nói thật: chưa
--     mở bán thì chưa hiển thị.
--
-- Một chỗ yếu đi, ghi ra thay vì giả vờ đã bịt: admin `disable` một kênh, người
-- bán XOÁ nó rồi thêm lại cái mới → kênh mới lên thẳng. Trước đây cái mới sẽ
-- vào draft và cần duyệt. Không bịt được nếu không có danh sách chặn theo giá
-- trị, và bịt nửa vời thì tệ hơn. Admin không tin người bán nữa thì đòn đúng
-- tầm là tạm ngưng SHOP — mọi bề mặt công khai đều join `s.state='active'`.

CREATE OR REPLACE FUNCTION public.shop_contact_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _shop_active BOOLEAN;
BEGIN
  IF current_setting('shop.privileged_write', true) = 'on' OR public.is_admin() THEN
    IF TG_OP = 'UPDATE' THEN NEW.version := OLD.version + 1; NEW.updated_at := now(); END IF;
    RETURN NEW;
  END IF;

  SELECT s.state = 'active' INTO _shop_active
  FROM public.shops s WHERE s.id = NEW.shop_id;

  IF TG_OP = 'INSERT' THEN
    -- Shop đã được duyệt ⇒ kênh lên luôn. `approved_by` để NULL một cách có
    -- chủ ý: không người nào duyệt cả, và bịa một uid vào đó là nói dối nhật
    -- ký. CHECK `shop_contact_approval_pair` chỉ đòi `approved_at NOT NULL`.
    IF coalesce(_shop_active, false) THEN
      NEW.state       := 'approved';
      NEW.approved_at := now();
    ELSE
      NEW.state       := 'draft';
      NEW.approved_at := NULL;
    END IF;
    NEW.review_note := NULL;
    NEW.approved_by := NULL;
    NEW.version     := 1;
    RETURN NEW;
  END IF;

  NEW.review_note := OLD.review_note;
  NEW.approved_by := OLD.approved_by;
  NEW.shop_id     := OLD.shop_id;

  -- Một kênh đã bị admin từ chối hoặc tắt KHÔNG tự sống lại vì người bán gõ
  -- lại số. Đây là chỗ duy nhất trigger còn giữ quyền quyết định thay người
  -- bán, và nó giữ vì lý do khác hẳn: không phải "chưa ai xem", mà là "đã có
  -- người xem và nói không".
  IF OLD.state IN ('rejected', 'disabled') THEN
    NEW.state       := OLD.state;
    NEW.approved_at := OLD.approved_at;
  ELSIF NEW.value_normalized IS DISTINCT FROM OLD.value_normalized
        OR NEW.type IS DISTINCT FROM OLD.type THEN
    -- Sửa giá trị trước đây đẩy về `pending_review`. Nay nó lên lại ngay, vì
    -- không còn ai để chờ. Huy hiệu vẫn mô tả đúng giá trị đang hiển thị —
    -- đó là bất biến mà nhánh này tồn tại để giữ.
    IF coalesce(_shop_active, false) THEN
      NEW.state       := 'approved';
      NEW.approved_at := now();
    ELSE
      NEW.state       := 'draft';
      NEW.approved_at := NULL;
    END IF;
  ELSE
    NEW.state       := OLD.state;
    NEW.approved_at := OLD.approved_at;
  END IF;

  NEW.version    := OLD.version + 1;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.shop_contact_guard() IS
  'Shop active ⇒ kênh của người bán tự lên (20260818160000). Kênh đã bị reject/disable không tự sống lại. Cửa công khai vẫn là shop_public_contacts.';

-- ─── Backfill ───────────────────────────────────────────────────────────────
-- Những kênh đang kẹt ở `draft` vì lỗi trên. CHỈ `draft`: `pending_review` là
-- một hàng đợi thật mà admin có thể đang nhìn, `rejected`/`disabled` là quyết
-- định đã có người đưa ra. Cả hai đều không phải việc của câu này.
--
-- `shop.privileged_write` là BẮT BUỘC ở đây, không phải cho gọn. Migration chạy
-- qua Management API không mang JWT, nên `is_admin()` trả false và trigger đi
-- nhánh người-bán: giá trị không đổi ⇒ `NEW.state := OLD.state` ⇒ câu UPDATE
-- báo thành công và KHÔNG đổi gì. Đúng cái bẫy đã ghi trong bàn giao Phase 3
-- (seed `ordering_enabled` bị nuốt im lặng). Bản nháp đầu của migration này
-- dính đúng nó.
SELECT set_config('shop.privileged_write', 'on', true);

UPDATE public.shop_contact_channels c
SET state = 'approved', approved_at = now()
FROM public.shops s
WHERE s.id = c.shop_id
  AND s.state = 'active'
  AND c.state = 'draft';

SELECT set_config('shop.privileged_write', 'off', true);

NOTIFY pgrst, 'reload schema';
