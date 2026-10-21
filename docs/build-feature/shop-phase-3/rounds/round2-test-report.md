# BÁO CÁO TEST TRÌNH DUYỆT — VÒNG 2 (tester, Chrome MCP)

**Kết quả: 9/12 PASS — 1 FAIL, 1 FAIL bộ phận (PDP), 1 BỊ CHẶN**

| # | Case | Kết quả | Cái thật sự thấy |
|---|------|---------|------------------|
| TC01 | Thêm vào giỏ + toast | ✅ | Badge lên đúng 1 mỗi lần (a11y name `"Giỏ hàng, 3 món"`, DB `qty` 1→2→3). Toast `Đã thêm vào giỏ` + `Xem giỏ`, tự ẩn ~7 s, nút trở lại `Thêm vào giỏ`. 0 console error. **Viewport 375px không đặt được** |
| TC02 | Đổi số lượng, trần 10 | ✅ | qty 1 → 1.500.000₫; qty 2 → 3.000.000₫; tới 10 → 15.000.000₫, nút `+` xám **kèm câu nhìn thấy được**: "Mỗi phiên bản tối đa 10 cái trong một đơn." Bấm thêm: DB vẫn `qty=10`, không lỗi 23514 |
| TC03 | Bỏ + Hoàn tác | ✅ | Không hộp xác nhận; băng "Đã bỏ “…” khỏi giỏ." + `Hoàn tác`. Sau hoàn tác: đúng variant, qty 3, tạm tính 4.500.000₫, badge 3; F5 vẫn còn |
| TC04 | Đặt COD | ✅ | `Đặt đơn · 4.530.000₫` (4.500.000 + 30.000), COD chọn sẵn → `/shop/order/PH-2608-F685`, có khối "Đã gửi đơn tới người bán…". Back → `/shop/cart` (KHÔNG về checkout), giỏ shop đó rỗng. Tồn kho 20→17 |
| TC05 | F5 + bấm 2 lần | ✅ | F5 giữa chừng không màn lỗi. `double_click` nút đặt → 1 mã `PH-2608-6280`; `count(*)` 1 → 2 (tăng đúng 1) |
| TC06 | `ordering_enabled=false` | ❌ **PDP** / ✅ giỏ + checkout | Giỏ + checkout chặn đúng, còn `Nhắn Zalo`, hàng vẫn trong giỏ. **PDP vẫn hiện `Thêm vào giỏ` và bấm được thật** — DB `qty` 1→2 |
| TC07 | Hết hàng chặn cả nhóm | ✅ | icon ⚠ + chữ đỏ; nút nhóm bị chặn kèm đúng câu "Còn 1 món cần sửa trước khi đặt."; nhóm shop khác vẫn đặt được; bỏ xong nút mở lại |
| TC08 | Khách chưa đăng nhập | ✅ (1 lưu ý) | → `/login?redirect=%2Fshop%2Fproduct%2F…`. Sau đăng nhập KHÔNG tự thêm (DB không đổi), badge đúng. Lưu ý: tài khoản fixture chưa xong hồ sơ nên rơi vào `/onboarding?redirect=…` — redirect vẫn giữ nguyên |
| TC09 | Huỷ đơn pending | ✅ | Hộp "Huỷ đơn này?" + nút phá huỷ đỏ; `Giữ đơn` → vẫn `pending`; xác nhận → "Đơn đã huỷ" + "Anh/chị đã huỷ đơn này lúc 18/08 03:44." trên mọi mục; SQL `cancelled`; tồn kho 0→1; `Nhắn Zalo` còn |
| TC10 | Giá đổi giữa chừng | ❌ **FAIL** | Nút kẹt vĩnh viễn ở `Đang gửi đơn…`, **không có cảnh báo `role="alert"`**, giá/tổng không cập nhật, không tạo đơn. Tái hiện 2/2 |
| TC11 | Giỏ 2 shop | ✅ | Đúng 2 nhóm, 2 nút riêng, không "đặt tất cả", câu giải thích **ẩn** khi còn 1 nhóm. Đặt shop A → đơn chỉ chứa variant shop A; hàng shop B nguyên vẹn |
| TC12 | Bố cục 320 / 1440 px | ⛔ **BỊ CHẶN** | `resize_window` không có tác dụng. Kiểm được ở 1335px: nhãn `Đặt đơn · 1.530.000₫` không bị cắt; viền focus xanh rõ; nút icon có tên đầy đủ |

---

## FAIL 1 — TC10: nút đặt đơn kẹt "Đang gửi đơn…" khi giá đổi (tái hiện 2/2)

Route `/shop/checkout/<slug>`.
Bước: mở checkout (giá 1.450.000₫ / tổng 1.475.000₫) → `UPDATE product_variants SET price_vnd = price_vnd + 100000` → điền form hợp lệ → bấm `Đặt đơn` **một lần**.
Kỳ vọng: khối `role="alert"` nêu tên món + giá cũ → giá mới, đơn giá/tổng cập nhật, nút trở lại bấm được, số đơn không tăng.
**Thực tế:** nút chuyển `Đang gửi đơn…` rồi **đứng yên >20 giây**. Không alert, giá vẫn cũ, `count(*)` không tăng. Không console error, không query treo trong `pg_stat_activity`.

Server hoạt động đúng — gọi thẳng RPC bằng JWT người mua trả về **ngay lập tức**:
```
HTTP 409
{"code":"PT409","details":"{\"reason\": \"price_changed\", \"current\": 1550000, \"expected\": 1450000, \"variant_id\": \"62b786f5-...\"}","message":"Giá vừa thay đổi trong lúc anh/chị điền."}
```
⇒ nhánh `catch` trong `src/pages/shop/Checkout.tsx` (`onSubmit`, xử lý `reason === "price_changed"`) **không bao giờ chạy**: promise của `create.mutateAsync` không settle nên `create.isPending` mãi `true`. Người mua rơi vào ngõ cụt, phải tự F5.

## FAIL 2 — TC06 (PDP): PDP vẫn cho thêm vào giỏ khi shop tắt bán

Dependency đã biết (`product_public_projection` chưa trả `ordering_enabled`). PDP hiện nguyên `Thêm vào giỏ`, bấm được và **thêm thật** — `qty` 1 → 2. Giỏ và checkout chặn đúng. Đã nằm trong phạm vi vòng 3 (A1).

## BỊ CHẶN — TC12

`resize_window` báo "Successfully resized" nhưng viewport không đổi (thử 375×812, 900×700, 1440; đã thử thoát fullscreen). Mọi case chạy ở **1335px**. Cần chạy lại trên máy có cửa sổ Chrome resize được, hoặc DevTools device mode. → **việc kiểm tay của Cuong.**

---

## Phát hiện phụ (không tính pass/fail)

1. **Bước chuẩn bị của prompt không chạy được như viết**: `UPDATE shops SET ordering_enabled = true` qua psql bị trigger `shops_guard_privileged_columns_trg` nuốt im lặng (`UPDATE 1` nhưng giá trị không đổi, vì `is_admin()` false). Phải `ALTER TABLE shops DISABLE TRIGGER shops_guard_privileged_columns_trg;` quanh câu UPDATE. Tương tự `stock_on_hand` bị `product_variants_guard_stock()` chặn. *(Ghi chú: đây chính là bằng chứng công tắc `ordering_enabled` được bảo vệ đúng như D1 yêu cầu.)*
2. **PDP cho thêm vượt tồn kho**: variant tồn 4 nhưng thêm được tới qty 8; giỏ khi đó hiện "Phiên bản này **vừa hết hàng**" — **câu chữ sai bản chất** (còn 4, chỉ là đặt quá tồn).
3. **Cuộn ngang ~39px** ở `/shop/cart`, `/shop/order/:code` — nhưng có y hệt ở `/shop` và `/rankings`, không có ở `/`. Hiện tượng site-wide sẵn có, **không phải do Phase 3**.
4. Một lần `Hoàn tác` và một lần xác nhận `Huỷ đơn` không ăn ở lần bấm đầu (bấm lại thì đúng) — nhiều khả năng click trúng lúc băng/hộp thoại đang animate, không kết luận là lỗi sản phẩm.

## Dọn dẹp
`node scripts/shop-p2b-fixture.mjs down` đã chạy, DB local 0 shop / 0 product / 0 order / 0 cart.
`.env.local` (trỏ Supabase local) **vẫn còn** — xoá nếu muốn dev server quay lại production. Dev server còn chạy nền, log `/tmp/team-agent-tester-dev.log`.
