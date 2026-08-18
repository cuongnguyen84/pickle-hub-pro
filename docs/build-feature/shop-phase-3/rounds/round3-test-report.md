# BÁO CÁO TEST TRÌNH DUYỆT — VÒNG 3 (tester, Chrome MCP)

**Kết quả: 11/12 PASS, 1 PASS-một-phần, 0 FAIL**

Môi trường: worktree `shop-phase-3`, dev server đã restart để nạp code mới, Supabase local, `shop-p2b-fixture.mjs up` (shop `p2b7-shop-new-msxsgpv3`, `ordering_enabled=true`, `shipping_fee_vnd=30000` — bọc DISABLE/ENABLE trigger đúng cảnh báo, verify UPDATE thật sự ăn). Viewport thực tế 500×725 (nhánh mobile, <768px).

| # | Case | Kết quả | Cái thật sự thấy |
|---|------|---------|------------------|
| TC01 | Vòng đời đặt → xác nhận → gửi → giao | ✅ | Đơn `PH-2608-1E66`. Mỗi bước UI tự đổi trạng thái, không toast ăn mừng. Cuối: `Xong` + `Đơn đã kết thúc. Không còn thao tác nào.`, hết nút. SQL: `delivered`, `tracking_code=QA-TRACK-001`, chuỗi event `create,confirm,ship,deliver` |
| TC02 | Người mua bấm "Tôi đã nhận hàng" | ✅ | Trên thẻ là **link** `href="/shop/order/PH-2608-DB78"`; SQL sau khi bấm vẫn `shipped` ⇒ danh sách KHÔNG gọi RPC. Trang chi tiết: dialog "Xác nhận đã nhận hàng?"; sau đó h1 `Đơn đã xong`, nút biến mất, `Nhắn Zalo` còn. SQL: `delivered`, event cuối `deliver` / `actor_kind=buyer` |
| TC03 | Từ chối kèm lý do | ✅ | Con trỏ tự vào textarea. Ô trống: nút mờ + câu `Nhập lý do để người mua biết vì sao.` cạnh nút; bấm thử → SQL vẫn `pending`. Có dòng `Người mua sẽ đọc đúng câu này.` Sau khi gửi: SQL `cancelled`, `cancel_reason` khớp **từng ký tự**. Buyer thấy dưới h1: `Shop QA Nghiệm Thu đã huỷ đơn này lúc 18/08 05:23. Lý do shop ghi: "Sản phẩm tạm hết tại kho cửa hàng".` |
| TC04 | Đơn quá hạn lên đầu | ✅ (sub-step 375px BỊ CHẶN) | Thứ tự đúng **A → B → C** dù `created_at` ngược lại. A: viền trái đỏ + `AlertTriangle` + `Quá hạn 5 giờ`; B/C: icon đồng hồ + `Còn 2/20 giờ để trả lời`. Tab "Tất cả": `delivered`/`cancelled` hiện `—`, không dòng hạn |
| TC05 | Gọi + sao chép địa chỉ | ⚠️ PASS một phần | `href="tel:0912345678"` ✅. Dán clipboard ra đúng 3 dòng ✅. Có `role="status"` ✅. Dòng `Số điện thoại này chỉ hiện với shop vì có đơn hàng thật.` ✅. **Không quan sát được nhãn `Đã sao chép` 2 giây** — round-trip MCP >2s, không phải bằng chứng sai |
| TC06 | Vai `support` chỉ được xem | ✅ | Danh sách đủ + notice đúng câu. Mở đơn pending/confirmed/shipped: **0 nút** hành động; `Gọi người mua` + `Sao chép địa chỉ giao` vẫn còn. SQL: 0 event mới |
| TC07 | `/shop/orders` tab/đếm/2 empty | ✅ (sub-step 320–375px BỊ CHẶN) | Đếm khớp SQL (5/5/0/0 → 7/4/1/2). Tìm `ZZZ-KHONG-CO` → `Không có đơn nào khớp "…"` + `Xoá tìm kiếm`. Tài khoản chưa có đơn → `Anh/chị chưa có đơn hàng nào` + `Xem sản phẩm đang bán`. Mỗi thẻ là câu việc-cần-làm đúng spec. Trang không cuộn ngang |
| TC08 | Buyer huỷ pending, kho hoàn | ✅ | Dialog `Đơn sẽ bị huỷ và hàng được trả lại kho của shop. Không hoàn tác được.` Sau đó h1 `Đơn đã huỷ`, dòng `Anh/chị đã huỷ đơn này lúc 18/08 05:42.` **không có vế "Lý do"**. SQL: `inventory_movements` có `return / delta=+1 / 1→2`, `stock_on_hand` về đúng 2 |
| TC09 | Không lộ đơn người khác | ✅ | Người ngoài mở đơn A và mở `PH-0000-9999` ra **chuỗi giống hệt nhau**; link `Xem đơn của tôi` (`href="/shop/orders"`, đã hết trỏ tạm `/shop`). Chủ shop đối chứng → đúng một câu + `Về danh sách đơn`. Không lộ tên shop / SĐT / địa chỉ / tổng tiền |
| TC10 | PDP tôn trọng `ordering_enabled=false` | ✅ (vòng 2 FAIL → vòng 3 hết) | PDP ẩn hẳn ô số lượng + nút, hiện `Shop đang tạm ngưng bán. Anh/chị vẫn liên hệ trực tiếp với shop được.`, `Nhắn Zalo` lên primary. Giỏ + checkout chặn, cart còn nguyên. `/seller/orders` có notice và đơn cũ **vẫn xác nhận được**. Bật lại → nút trở lại. **Không nơi nào có "Shop bị tạm ngưng"** |
| TC11 | Hai người bấm cùng lúc (stale_status) | ✅ | `role="alert"`: `Đơn vừa được cập nhật ở nơi khác — có thể người mua vừa huỷ. Trang đã tải lại.`; trang nạp lại thành `Đã huỷ`, hết nút. SQL: chỉ `create, cancel(buyer)` — **không có event `confirm` sau `cancel`** |
| TC12-REGRESSION | Bug vòng 2: nút kẹt "Đang gửi đơn…" | ✅ | Đổi giá `+100.000` rồi bấm `Đặt đơn` **một lần**: khối `role="alert"` `Giá vừa thay đổi trong lúc anh/chị điền. … từ 1.500.000₫ thành 1.600.000₫`; tổng cập nhật 1.530.000₫ → 1.630.000₫; nút về default `Thử lại · 1.630.000₫` (KHÔNG kẹt); SQL không sinh đơn; 0 console error |

## Bị chặn (kỹ thuật, không phải lỗi tính năng)

- **`resize_window` vô hiệu**: gọi resize 320×800 và 390×844 đều trả "Successfully resized" nhưng viewport render vẫn cố định **500×725**. Vì vậy TC04 bước (4) và TC07 bước (5) chỉ kiểm được ở 500px (vẫn <768px nên đúng nhánh thẻ mobile). **Chưa ai kiểm 320/375/1440px** ⇒ việc kiểm tay của Cuong.
- **TC05 nhãn `Đã sao chép` 2 giây**: mỗi lệnh MCP >2s round-trip nên state hết trước khi chụp. Xác minh gián tiếp: clipboard ghi đúng, có `role="status"`, **không** xuất hiện hint danger fallback ⇒ nhánh success đã chạy.

## Quan sát thêm (ngoài phạm vi TC)

1. **A4 prefill địa chỉ có chạy**: mở lại checkout sau khi buyer đã có đơn, 3 ô đều được điền sẵn từ đơn gần nhất.
2. Ở `/seller/orders`, thẻ đơn **quá hạn** (viền danger) hiển thị nội dung **canh giữa** trong khi thẻ khác canh trái — lệch nhịp thị giác, không phải lỗi chức năng.
3. Tab rỗng ở `/shop/orders` hiện `Không có đơn nào ở mục này` — trạng thái thứ ba ngoài 2 empty spec liệt kê; hợp lý nhưng spec §B chỉ mô tả 2.
4. `0 console error` trên mọi trang đã chạy.

## Dọn dẹp
`shop-p2b-fixture.mjs down` → `Sạch — 0 hàng, 0 tệp, 0 tài khoản`; verify SQL `shops=0`, `shop_orders=0`, `shop_cart_items=0`. Tab Chrome đã đóng. Không sửa file nào trong repo.
