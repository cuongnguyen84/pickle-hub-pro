# 00 — Ý tưởng gốc

**Người yêu cầu:** Cuong (PO), 18/08/2026, phiên chạy qua đêm.

> "chia task và hoàn thành phase 3. Anh sẽ kiểm tra lại vào sáng mai"

## Phase 3 là gì (đã có định nghĩa ký sẵn)

`docs/proposals/shop-marketplace/production-implementation-map.md` §1:

| Phase | PR | Scope |
|---|---|---|
| 3 | **P3a** | Wishlist, cart, one-shop checkout, idempotent order creation, inventory (giữ tồn kho) |
| 3 | **P3b** | Order lists/details, cancellation, deadlines, returns, disputes, reviews |
| 4 | — | Payment provider / public launch — **KHOÁ**, cần approval riêng + legal |

## Quyết định PO đang có hiệu lực (memory `shop-phase-3-po-override`)

- PO **ghi đè** cổng soak Wave 1 ngày 18/08: làm **toàn bộ P3a + P3b ngay**.
  Lý do PO: "làm ngay để người dùng thao tác được ngay; đã có 1 shop, sẽ hoạt động ngay khi release product."
  Agent đã nêu rủi ro → PO tái khẳng định → **không tranh luận lại**.
- Thanh toán vẫn **Option B′**: KHÔNG KYC, KHÔNG tài khoản ngân hàng nền tảng.
  Chuyển khoản tay / VietQR / COD, đối soát **thủ công**. Không có webhook thanh toán.
  Không được đánh dấu đơn "đã thanh toán" chỉ vì hiển thị/quét VietQR.
- P4 vẫn khoá.

## Nền hiện có

- Phase 0–2 đã xong trọn trên production, main `e81f36a7`.
- 26 migration `shop_*` đã áp prod; RLS + state machine + moderation + trang công khai đã sống.
- **Prototype đã có sẵn UI cho toàn bộ màn hình P3** trong `src/proto/shop/screens/`:
  B07Wishlist, B08Cart, B09Checkout, B10OrderSuccess, B11Orders, B12OrderDetail,
  B13Return, B14Dispute, B15Review, S08Orders, S09OrderDetail, A05Disputes.
- Chỉ có 1 shop thật đang hoạt động (shop nội bộ ThePickleHub), pilot allowlist, `/shop` đang noindex.

## Ràng buộc kỹ thuật đã biết

- Bundle Total headroom chỉ còn **~9 KB** — P3 là feature JS lớn, phải lazy-route và/hoặc dọn trước.
- Mọi chuyển trạng thái tài chính/huỷ/trả phải: server-authorized (SECURITY DEFINER RPC), atomic, có audit.
- Số tiền VND = `integer`, không dùng float. Timestamp = `timestamptz` UTC.
- Không thêm mục thứ 6 vào bottom nav mobile 5 slot.
- Migration được phép áp thẳng prod qua Management API (PAT ở `~/Downloads/secrets.local.md`).

## Nợ mang sang (không thuộc P3 nhưng đang mở)

1. Xoá auth user rác prod `0bbe10dc-b091-41f5-a448-473e3c997d99`.
2. Rendition JPEG cũ còn EXIF ⇒ publish fail vĩnh viễn, không backfill; cách chữa: seller up lại ảnh.
3. `owner_user_id` lộ qua REST anon — bắt buộc sửa trước khi bật indexing.

## Chế độ làm việc

Ponytail **full**: leo thang lười — không tồn tại thì bỏ, tái dùng cái đã có trong repo,
native/DB constraint trước code app, diff ngắn nhất **sau khi** đã hiểu đủ.
Không cắt: validation ở biên tin cậy, xử lý lỗi chống mất dữ liệu, bảo mật, a11y cơ bản.
