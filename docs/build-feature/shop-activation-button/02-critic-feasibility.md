# Phản biện kỹ thuật — Phân tích "Nút kích hoạt shop"

## 1. Điểm đồng ý (đã kiểm chứng trong code)

Bản phân tích mô tả hiện trạng DB/RLS **chính xác**, đối chiếu `/Users/cm10/pickle-hub-pro/supabase/migrations/20260811090000_shop_phase1_seller_onboarding.sql`:

- Enum `shop_state` 5 giá trị, default `pending_activation` (dòng 39-43, 109). RLS `shops_select_public_active` đúng là `USING (state = 'active')` (dòng 172-175) — kích hoạt = công tắc công khai, đúng như phân tích nói.
- Trigger `shops_guard_privileged_columns` (dòng 197-225) đúng là **ghi đè im lặng** mọi cột privileged cho non-admin và `RETURN NEW` — UPDATE "thành công" nhưng không đổi gì. Cảnh báo "xanh giả / không tin HTTP 200" là có căn cứ.
- CHECK cặp `verified_method`/`verified_at` đủ đôi hoặc rỗng cả đôi (dòng 120-127) — đúng.
- `ShopApplicationRow.shop_id` có sẵn (`/Users/cm10/pickle-hub-pro/src/integrations/supabase/shop-schema.ts:45`) — đặt nút trên trang review là khả thi, không cần join gì mới.
- Admin nav chỉ có "Hồ sơ đăng ký" ready, `products`/`disputes` đang `ready: false` (`src/components/shop/ShopShell.tsx:156-158`) — đúng là chưa có trang danh sách shop.
- Gate coverage 83% statements có thật (`vite.config.ts:405-407`), gate bundle là `scripts/check-bundle-size.mjs` với 3 budget CODE/CONTENT/INITIAL — đúng.
- Mục 3 (scope) và mục 5 (full-build) lập luận chặt, tôi không có phản đối về kết luận.

## 2. Phản đối / thiếu sót (kèm bằng chứng)

**(a) THIẾU NẶNG NHẤT: drift migration giữa nhánh hiện tại và prod.** Nhánh đang checkout (`feat/shop-production-phase-1`) chỉ có **một** migration shop (phase 1). Trigger `shops_revoke_media_on_state_change` mà phân tích viện dẫn ở mục 6 **không tồn tại trên nhánh này** — nó chỉ có trong worktree `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-p2a/supabase/migrations/20260811140000_shop_phase2a_media_lifecycle.sql:748-771`. Hệ quả thực tế: nếu agent code nút + pgTAP từ nhánh/checkout hiện tại, `supabase db reset` local sẽ dựng một schema **không khớp prod** (thiếu toàn bộ P2a/P2b) và test xanh trên schema sai. Bản phân tích phải ghi rõ: **branch từ main (nơi #578/#580 đã merge), xác nhận ledger migration trước khi viết pgTAP** — repo này đã có tiền sử drift kinh niên ("cấm chèn ledger mù").

**(b) Câu hỏi mở #3 (audit trail) coi 2 option ngang giá — thực tế chênh nhau một migration.** CHECK constraint `shop_application_events_event_check` chỉ cho phép 7 event, **không có `activated`** (migration phase 1, dòng 305-307). Ghi vào timeline hồ sơ = sửa CHECK + cập nhật union type `ShopApplicationEventRow.event` trong `shop-schema.ts:61-68` + parity test `src/lib/__tests__/shop-schema-parity.test.ts` + pgTAP. Option `log_audit_event` không cần đổi schema — nhưng dính gotcha 2 overload → 42725, phải cast tường minh (chính migration phase 1 dòng 680 đã tự ghi chú "Explicit casts are load-bearing"). Nên đưa chênh lệch chi phí này vào phân tích thay vì đẩy hết cho PO.

**(c) Requirement "ghi xong phải đọc lại" (mục 4) là hệ quả của việc chọn sai đường ghi, không phải requirement gốc.** Nếu làm **RPC `shop_activate`** (SECURITY DEFINER, kiểm `is_admin()`, kiểm `state='pending_activation'`, RAISE lỗi rõ ràng khi sai, ghi audit trong cùng transaction) thì bẫy no-op câm của trigger guard biến mất — RPC lỗi là lỗi thật, không có 200 giả. Phân tích để mở "RPC hay PATCH cho agent sau quyết", nhưng hiện trạng code đã nghiêng hẳn về RPC: (i) đúng mẫu `shop_application_decide` có sẵn, (ii) tự giải quyết audit + idempotency + no-op câm trong một chỗ, (iii) pgTAP test được trực tiếp. Đề xuất: **chốt luôn RPC**, đừng để mở.

**(d) Nút cần biết state shop hiện tại — hook chưa fetch.** `useShopApplicationQueue.ts` không select gì từ bảng `shops` (grep `shop_id` trong hook: 0 kết quả — chỉ có ở schema type). Muốn hiển thị "đã kích hoạt rồi" (idempotent UI) phải đọc thêm row `shops` (admin đọc được qua `shops_select_member` + `is_admin()`, dòng 178-180). Việc nhỏ nhưng nằm trong đường "~1 buổi", nên ghi vào scope.

**(e) Ước lượng "~1 buổi" chỉ đứng vững nếu giữ scope một chiều.** RPC + migration + pgTAP + UI + red-proof call-site + coverage ≈ nửa ngày đến 1 ngày — chấp nhận được. Nhưng câu hỏi mở #1 (gộp suspend/B12) mà lọt vào là vỡ ước lượng ngay: suspend kích trigger thu hồi media thật (P2a) và là feature có side effect riêng. Phân tích đã cảnh báo đúng, tôi chỉ nhấn: **trả lời mặc định cho #1 nên là "không gộp"**, đừng treo như câu hỏi 50/50.

## 3. Điều chỉnh scope đề xuất

Giữ nguyên scope mục 3, thêm 3 dòng:

1. Branch từ `main`, xác nhận ledger migration khớp prod trước khi viết pgTAP (mục 2a ở trên).
2. Chốt cơ chế: RPC `shop_activate` một chiều `pending_activation → active`, idempotent, audit qua `log_audit_event` với cast tường minh. Không mở rộng `shop_application_events` (tiết kiệm 1 migration CHECK + parity test) — trừ khi PO đòi timeline hiển thị.
3. Vị trí UI: chọn phương án (a) — nút trên trang review đã approved. Trang danh sách shop để khi B12/suspend thành việc thật.

## 4. "Làm luôn full feature shop thì sao" — góc kỹ thuật/chi phí

Đồng ý với mục 5 của bản phân tích; bổ sung 3 điểm kỹ thuật cứng:

- **P3a tự chặn bằng chính legal đang review.** Payment đảo quyết định Option B′ (không KYC/bank) — nhận/luân chuyển tiền kéo nghĩa vụ trung gian thanh toán + khấu trừ thuế TMĐT hộ seller. Phương án từng bước cho legal chạy song song; full-build biến legal thành blocker cứng.
- **Cart/order = bài toán race + reservation**, đúng loại bug repo này từng tốn nhiều vòng pgTAP nhất (DB-00/DB-01 race CONFIRMED trong lịch sử dự án), và giá bug là **tiền người thật** thay vì một trang catalog sai. Với vận hành solo, mỗi bề mặt mới còn cộng vĩnh viễn vào chi phí nuôi: RLS + grants sweep + audit + cron + giám sát.
- **Full-build không mở khóa gì**: blocker Wave 1 là quyết định PO, không phải thiếu feature. Phễu 3 số của Wave 1 chính là input thiết kế cho P3a — build trước khi có nó là build mù.

**Verdict: full-build = RED.** Làm nút (≤1 ngày, có RPC + audit + pgTAP), mở Wave 1 theo quy trình PO, lấy tín hiệu rồi mới bàn P3a — đúng như trình tự ý tưởng gốc.

**File bằng chứng chính:** `/Users/cm10/pickle-hub-pro/supabase/migrations/20260811090000_shop_phase1_seller_onboarding.sql`, `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-p2a/supabase/migrations/20260811140000_shop_phase2a_media_lifecycle.sql`, `/Users/cm10/pickle-hub-pro/src/integrations/supabase/shop-schema.ts`, `/Users/cm10/pickle-hub-pro/src/components/shop/ShopShell.tsx`, `/Users/cm10/pickle-hub-pro/src/pages/admin/shop/AdminShopApplicationReview.tsx`, `/Users/cm10/pickle-hub-pro/vite.config.ts` (dòng 405-407).
