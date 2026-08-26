# VERDICT VÒNG 3

**CHƯA ĐẠT** — chức năng chạy đúng trên trình duyệt thật, nhưng code review bắt được một lỗ bảo mật.

| Nguồn | Kết quả |
|---|---|
| Coder (A35–A54) | Tự chấm ĐẠT gần hết, 2 mục "đạt một phần" — **review xác nhận cả hai là đúng**, grep trong đề bài rộng hơn quy tắc thật |
| Codex review (Bước A) | **CHƯA ĐẠT** — 2 CHẶN (C1, C2), 2 nên sửa, 8 ghi nhận |
| Tester (TC01–TC12) | **11 PASS · 1 PASS-một-phần · 0 FAIL** |

## Cái đã ĐẠT, không mở lại

- **Vòng đời đơn chạy trọn trên trình duyệt thật**: đặt → shop xác nhận → gửi + mã vận đơn → giao, chuỗi event `create,confirm,ship,deliver` đúng trong DB.
- **Bug chặn vòng 2 đã hết** (TC12-REGRESSION): nút không còn kẹt, có `role="alert"` nêu giá cũ → giá mới, tổng cập nhật, không sinh đơn. Root cause là `mutations: { retry: 1 }` toàn cục + React Query pause retry khi tab ẩn — đã xác nhận bằng bytes trong `query-core`.
- Từ chối kèm lý do → người mua đọc **nguyên văn**; `support` không có nút hành động nào; huỷ đơn hoàn kho đúng; `stale_status` xử lý đúng; không lộ đơn người khác (câu "không tìm thấy" **giống hệt nhau** cho đơn không tồn tại và đơn của người khác).
- PDP tôn trọng `ordering_enabled` (case FAIL của vòng 2 đã đóng).
- `sortSellerOrders` rút gọn nhưng **tương đương spec** — review tìm phản ví dụ và không có.
- `product_public_projection` `CREATE OR REPLACE` **không mất nhánh nào** (diff cơ học).
- `shop_last_shipping_address()` sạch; prefill có chạy thật trên trình duyệt.

## Cái CHẶN → vòng 4

| # | Vấn đề | Hệ quả |
|---|---|---|
| **F1** | `shop_orders.cancelled_by` là UUID `auth.users`, được GRANT cho `authenticated` (`20260818100000:403`) và nhân bản vào view (`20260818120000:203`) | `profiles` cho mọi user đăng nhập đọc toàn bộ, `profiles.id` = auth uid ⇒ shop tra ra **hồ sơ công khai đầy đủ của khách**. Đây là lần **thứ ba** cùng bất biến §E.10 rò qua một tên cột khác: `buyer_user_id` → `actor_user_id` → `cancelled_by` |
| **F2** | View `my_shop_orders` không `security_invoker` ⇒ bỏ qua **cả** RLS **cả** GRANT-theo-cột; danh sách SELECT của view là hàng rào duy nhất — và **không test nào canh nó** | Thêm `buyer_user_id` vào view vẫn xanh toàn bộ suite |
| **F3** | (a) Câu select của `/shop/orders` (đọc view + 3 embed) **chưa từng chạy thật** — probe A2 chỉ verify trang chi tiết. (b) `mutations: { retry: 1 }` toàn cục còn nguyên, **25 mutation Shop khác** vẫn dính bẫy pause-khi-tab-ẩn | (a) rủi ro PGRST200 + chưa ai đo buyer-scoping của view; (b) vá 6 call site rồi bỏ 25 cái là vá triệu chứng ở từng caller |

Cộng 3 việc nhỏ: `security_barrier` cho view · sửa comment sai lý do `security_invoker` (`shop-schema-parity.test.ts:456-461`) · chép lại 3 comment cảnh báo bị xoá trong thân projection.

## Việc kiểm tay còn lại của Cuong

1. **Bố cục 320 / 375 / 1440px** — `resize_window` của công cụ vô hiệu suốt hai vòng, mọi test chạy ở 500px và 1335px. Chưa ai thấy giao diện ở đúng chiều rộng iPhone.
2. Thẻ đơn **quá hạn** ở `/seller/orders` canh giữa trong khi thẻ khác canh trái — lệch nhịp thị giác, cần mắt người quyết.
3. Cảm nhận thứ tự đơn quá hạn có "nhảy vào mắt" không, và độ dài câu việc-cần-làm ở `/shop/orders` trên iPhone.
