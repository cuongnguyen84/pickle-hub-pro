# Bản phân tích ĐÃ CHỐT — Nút kích hoạt shop (Wave 1 enabler)

Tổng hợp từ: `01-task-analysis.md` + `02-critic-feasibility.md` + `02-critic-user.md` (2 critic đồng thuận, không có mâu thuẫn phải đưa user quyết).

## Quyết định chiến lược (trả lời câu hỏi trong ý tưởng gốc)

**Full-build P3a ngay = RED, bác bỏ.** Cả phân tích lẫn 2 critic đồng thuận:
- Build trên 0 tín hiệu seller thật — cart có thể là giải pháp sai (seller VN chốt đơn qua Zalo/inbox là chuẩn de facto).
- P3a (tiền) đảo quyết định Option B′ (KHÔNG KYC/bank) và biến legal review từ "chạy song song" thành blocker cứng — tự chặn chính nó.
- Cart/order = race + reservation, giá bug là tiền người thật; solo maintainer gánh vĩnh viễn RLS/grants/audit/cron cho bề mặt mới.
- Không mở khóa gì: blocker Wave 1 là quyết định PO, không phải thiếu feature.

**Trình tự ý tưởng gốc được giữ nguyên:** nút kích hoạt (~1 buổi) → legal song song → Wave 1 (3-5 seller, chờ PO) → soak 2-4 tuần → mới bàn P3a.

## Scope CODE của buổi này (đã chốt, không treo)

1. **RPC `shop_activate`** (migration mới):
   - SECURITY DEFINER, kiểm `is_admin()`, chỉ một chiều `pending_activation → active`.
   - Idempotent: shop đã `active` → trả về trạng thái hiện tại không lỗi (hoặc thông báo rõ "đã kích hoạt"); state khác (`restricted/suspended/closed`) → RAISE lỗi rõ ràng.
   - Nhận tham số tùy chọn `p_verified_method` (`gap-truc-tiep` | `giay-phep-kinh-doanh` | NULL); nếu có thì set cặp `verified_method` + `verified_at = now()` (khớp CHECK đủ-đôi).
   - Ghi audit qua `log_audit_event` **với cast tường minh** (gotcha 2 overload → 42725; "Explicit casts are load-bearing"). KHÔNG mở rộng CHECK của `shop_application_events` (tiết kiệm 1 migration + parity test).
   - Lý do chọn RPC thay vì PATCH: triệt tiêu bẫy no-op câm của trigger `shops_guard_privileged_columns` — RPC lỗi là lỗi thật, không có 200 giả; pgTAP test được trực tiếp; đúng mẫu `shop_application_decide` có sẵn.
2. **UI: nút "Kích hoạt shop" trên trang review hồ sơ đã approved** (`/admin/shop/applications/:id`, `AdminShopApplicationReview.tsx` — đã có `shop_id`). KHÔNG xây trang danh sách shop (admin UX cho vấn đề chưa tồn tại).
   - Fetch thêm state shop hiện tại (hook queue hiện KHÔNG select từ `shops` — cần đọc thêm row để biết `pending_activation` hay đã `active`; admin đọc được qua policy `shops_select_member` + `is_admin()`).
   - Confirm dialog dùng `useConfirm()` có sẵn, nói rõ hệ quả: "bấm xong shop hiện công khai trên /shop (anon đọc được)". Kèm **link xem trước trang shop** (`/shop/store/:slug`) để admin không quyết định mù.
   - Select nhỏ chọn phương thức xác minh (mặc định `gap-truc-tiep` cho Wave 1 seller quen; cho phép để trống).
   - Sau khi RPC thành công: cập nhật UI hiển thị trạng thái "Đã kích hoạt" (idempotent — vào lại trang thấy đúng trạng thái, nút không hiện lại).
3. **Copy seller trong `SellerHome.tsx`** (chi phí ~0, giá trị trực tiếp cho 3-5 seller đầu):
   - Notice `pending_activation` (dòng ~77-84): bỏ câu "Chức năng đăng sản phẩm sẽ bật ở giai đoạn tiếp theo" — đã sai sự thật vì publish wiring xong.
   - Notice `active` (dòng ~87-92): thêm bước tiếp theo — đăng sản phẩm đầu tiên + link trang công khai của shop.
4. **Test:**
   - pgTAP cho RPC (admin activate OK, non-admin bị chặn, idempotent, state sai → lỗi, cặp verified được set đúng).
   - Test client xuyên qua call site thật (bài học pilot: "test bảo vệ HÀM chứ không bảo vệ CHỖ NỐI" — red-proof phải phá đúng call site production).

## Ràng buộc thi công BẮT BUỘC

- **Branch từ `main`** (nơi #578/#580 đã merge), KHÔNG từ `feat/shop-production-phase-1` — nhánh đó chỉ có migration phase 1, thiếu P2a/P2b → `supabase db reset` sẽ dựng schema không khớp prod và pgTAP xanh trên schema sai. Xác nhận ledger migration trước khi viết pgTAP. (Tiền sử drift kinh niên — cấm chèn ledger mù.)
- Gate CI: bundle headroom ~20 KB (`scripts/check-bundle-size.mjs`), coverage ≥83% (file mới có test tự cộng vào mẫu số), pgTAP cho migration mới, lint/typecheck.
- pgTAP local: phải `supabase db reset` (không tin `supabase start`); fixture down TRƯỚC pgTAP.
- Khu admin đã sau `RequireAuth requiredRole="admin"` + AdminMFAGate (aal2) — không cần gate mới.

## NGOÀI scope (đã chốt, không bàn lại trong vòng code)

- Suspend / re-activate / màn quản lý state (runbook B12) — chưa có ca thật, rời `active` kích trigger thu hồi media (P2a), vỡ ước lượng 1 buổi. Để sau.
- Thông báo tự động cho seller — giữ quyết định đã ký: báo tay qua Zalo.
- Trang danh sách shop trong admin.
- Siết column-grant `shops` cho anon — việc hậu-pilot riêng.
- Dashboard phễu 3 số — nếu cần là hạng mục riêng.
- Trang /shop thưa (3-5 shop, noindex) là chủ đích — giá trị Wave 1 đo ở phía seller, không phải buyer.

## Việc của PO / Cuong (không phải code)

1. **Gate mở Wave 1** (nâng từ "câu hỏi mở" thành điều kiện tiên quyết): PO ký **phễu 3 số + ngưỡng bàn P3a** TRƯỚC khi shop đầu tiên được kích hoạt — mở soak mà chưa có số đo là đốt 2-4 tuần.
2. Legal review chạy song song; nút code xong bất kỳ lúc nào, lần **bấm** đầu tiên chờ PO mở Wave 1 (vốn đang CẤM sẵn).
3. Sau kích hoạt: Cuong tự báo seller qua Zalo.
