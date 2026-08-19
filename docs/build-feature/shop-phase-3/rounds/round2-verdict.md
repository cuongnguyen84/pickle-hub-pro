# VERDICT VÒNG 2

**CHƯA ĐẠT** — tầng dữ liệu đạt trọn; UI có 1 lỗi chặn thật do test trình duyệt bắt được.

| Nhánh | Kết quả |
|---|---|
| Coder A (SQL, sửa 3 lỗi chặn vòng 1) | **ĐẠT** — A30–A34 xanh, 4 phép thử đỏ-trước-xanh chạy thật, pgTAP 1607/47 file, race 225/225 |
| Coder B (UI giỏ + checkout + đơn) | **ĐẠT phần build** — lint 0 error, 195 file/2991 test, build + bundle xanh (INITIAL 227/280, CODE 1591/1800) |
| Tester (Chrome, TC01–TC12) | **9 PASS · 1 FAIL · 1 FAIL bộ phận · 1 BỊ CHẶN** |

## Vì sao chưa đạt

**TC10 — nút đặt đơn kẹt vĩnh viễn "Đang gửi đơn…" khi giá đổi giữa chừng.** Tái hiện 2/2.
Server trả `HTTP 409 / PT409 / price_changed` **ngay lập tức** (chứng minh bằng curl với JWT người mua), nhưng client không bao giờ chạy nhánh `catch` — `create.isPending` mãi `true`. Người mua vào ngõ cụt, phải tự F5.
Đây đúng loại lỗi mà chỉ trình duyệt thật mới thấy: lint xanh, unit test xanh, build xanh, pgTAP xanh, và bảng mã lỗi đã map đủ 11 `reason`. Bài học lặp lại của repo: **test bảo vệ hàm chứ không bảo vệ chỗ nối.**

**TC06 phần PDP** — dependency đã biết từ trước (projection công khai chưa trả `ordering_enabled`), đã nằm sẵn trong phạm vi vòng 3 (A1).

**TC12 BỊ CHẶN** — `resize_window` của công cụ không có tác dụng, mọi case chạy ở 1335px ⇒ **chưa ai kiểm bố cục 320/375/1440px**. Chuyển thành việc kiểm tay của Cuong.

## Chuyển sang vòng 3

Đã bổ sung **Phần D** vào `round3-prompt.md` (đặt trước phần đóng gói, ưu tiên cao nhất):
- **D-BUG1** (chặn): sửa mutation tạo đơn — không retry với PT4xx/42501/22023, mọi lỗi đưa nút về default. Bắt buộc một test jsdom mock đúng lỗi PT409 `price_changed`, **phải ĐỎ trên code hiện tại** trước khi sửa. → A53
- **D-BUG2**: câu chữ sai bản chất khi đặt quá tồn ("vừa hết hàng" khi còn 4 cái). → A54
- **D-BUG3**: cuộn ngang ~39px — site-wide sẵn có (có cả ở `/shop`, `/rankings`), **không** phải Phase 3, chỉ ghi nhận.

Cộng phần A (trả nợ 4 dependency), B (`/shop/orders`), C (`/seller/orders` + chi tiết), đóng gói. Acceptance A35–A54.
