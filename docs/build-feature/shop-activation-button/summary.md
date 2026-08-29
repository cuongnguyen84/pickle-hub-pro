# Tổng kết /build-feature — Nút kích hoạt shop (2026-08-16)

## Ý tưởng & bản phân tích chốt

Kế hoạch gốc: (1) nút kích hoạt shop ~1 buổi → (2) legal review song song → (3) Wave 1 với 3-5 seller quen, soak 2-4 tuần theo phễu 3 số → (4) chỉ bàn P3a khi có tín hiệu thật. Kèm câu hỏi "làm luôn full feature shop thì sao?".

**Trả lời câu hỏi chiến lược: full-build P3a = RED, bác bỏ** (task-analyst + cả 2 critic đồng thuận): build trên 0 tín hiệu seller thật; P3a đụng tiền → đảo quyết định Option B′ (không KYC/bank) và biến legal từ "song song" thành blocker cứng; cart/order = race+reservation với giá bug là tiền người thật cho solo maintainer; và không mở khóa gì — blocker Wave 1 là quyết định PO, không phải thiếu feature. **Trình tự từng bước trong ý tưởng gốc được giữ nguyên.**

## Phản biện quan trọng đã xử lý

- **critic-feasibility bắt lỗi chí mạng:** nhánh checkout hiện tại (`feat/shop-production-phase-1`) đứng sau main 187 commit, chỉ có 1/23 migration shop → nếu code từ đó thì pgTAP xanh trên schema sai. → Đã tạo worktree `.claude/worktrees/shop-activation-button` branch từ `origin/main`.
- Chốt cơ chế **RPC `shop_activate`** thay vì PATCH (triệt tiêu bẫy no-op câm của trigger guard), audit qua `log_audit_event` cast tường minh (gotcha 42725), KHÔNG mở rộng `shop_application_events`.
- **critic-user:** chốt ngay 4/7 câu hỏi mở bằng mặc định an toàn (không gộp suspend; nút dùng được sau khi PO mở Wave 1; báo seller tay qua Zalo; verified mặc định `gap-truc-tiep` nhưng cho phép trống); thêm sửa copy SellerHome vào scope; nâng "phễu 3 số + ngưỡng P3a" thành **gate PO trước khi kích hoạt shop đầu tiên**.

## Thiết kế UI/UX (03-ux-spec.md)

Section "Kích hoạt shop" đặt trên trang review hồ sơ đã approved (`/admin/shop/applications/:id`), giữa "Người nộp" và ghi chú/quyết định. Đủ trạng thái: loading / lỗi+Thử lại / pending (notice cảnh báo công khai + select phương thức xác minh + confirm dialog `useConfirm` + nút primary) / active (notice "Đã kích hoạt" + link trang shop, nút BIẾN MẤT — sửa đúng anti-pattern "disabled trơ" của trang) / state cấm (notice runbook). Tái dùng 100% class `tl-shop-*`, 0 CSS mới, 0 dependency mới. Copy VI trung thực ("hệ thống không tự kiểm tra gì cả"), sửa 2 notice seller trong SellerHome.

## Kết quả code — ĐẠT sau 2/6 vòng

**Vòng 1:** coder build đủ — migration `20260816090000_shop_activate_rpc.sql` (SECURITY DEFINER, một chiều `pending_activation→active`, idempotent, cặp verified, audit không 42725), pgTAP 22 assert, hooks (`useShopState`/`useActivateShop`/`activateErrorMessage`), section UI, copy SellerHome, `SHOP_STATE_LABEL` dùng chung, 3 file vitest xuyên call site thật (red-proof đã phá thử call site → 2 test fail → hoàn nguyên). Gates: lint 0 error, tsc 0 error, vitest 2664 pass, pgTAP 1425 pass (42 file), build + bundle trong budget. Code review (Codex CLI độc lập): 0 blocker. Tester Chrome: 8/9 pass, 0 fail → **CHƯA ĐẠT vì observation**: trang công khai claim "ThePickleHub đã xem giấy tờ kinh doanh" khi method là "Gặp trực tiếp" — copy dối người mua (đúng loại lỗi pilot cấm).

**Vòng 2:** sửa 6 chỗ copy verified trên 4 file công khai (wording đã duyệt: "đối chiếu giấy tờ hoặc gặp trực tiếp người bán") + `cancelText: "Huỷ"`. Code review đạt (Codex 0 finding, vòng 1 nguyên vẹn — khớp số học diff). Tester: **4/4 PASS** kể cả nhánh chưa-verified. → **ĐẠT.**

**File thay đổi (tổng, uncommitted trong worktree `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-activation-button`, 9 file sửa +264/−31, 5 file mới):**
- Sửa: `src/hooks/shop/useShopApplicationQueue.ts`, `src/lib/shop/applicationState.ts`, `src/pages/admin/shop/AdminShopApplicationReview.tsx`, `src/pages/shop/SellerHome.tsx`, `src/pages/shop/SellerShopSettings.tsx`, `src/pages/shop/ShopStore.tsx`, `src/pages/shop/ProductDetail.tsx`, `src/components/shop/ProductCard.tsx`, `src/components/shop/ProductPreview.tsx`
- Mới: `supabase/migrations/20260816090000_shop_activate_rpc.sql`, `supabase/tests/shop_activate.test.sql`, `src/pages/admin/shop/__tests__/AdminShopApplicationReview.activate.test.tsx`, `src/hooks/shop/__tests__/activateErrorMessage.test.ts`, `src/pages/shop/__tests__/SellerHome.copy.test.tsx`

## Test thật vòng cuối (tester + Chrome MCP, dev server + Supabase local)

Vòng 2: 4/4 PASS (kích hoạt thành công, nút "Huỷ" + huỷ không RPC, copy công khai trung thực khi logout thật, shop chưa-verified hiện đúng "Shop chưa được ThePickleHub xác minh"). Vòng 1 nền: 8/9 pass (TC9 skip có bù gián tiếp; TC8 responsive chỉ best-effort 500px — Chrome macOS không co dưới ~500px).

## Nợ MINOR

**Đáng làm trước merge (rẻ):** pgTAP thêm case `restricted`; sửa doc test `/auth` → `/login`.
**Ghi nợ:** pgTAP replay chưa snapshot `verified_at`; bundle Total headroom còn 13.6 KB (baseline main đã 15.5 KB — cạn từ trước feature); responsive 320px máy không kết luận được.

## Việc user cần tự làm

1. **Review diff** trong worktree `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-activation-button` (chưa commit — theo đúng yêu cầu không tự commit/push).
2. **Test tay iPhone ~320px:** trang admin review + dialog + `/shop/store/<slug>`.
3. Khi merge: áp migration `20260816090000` lên prod cẩn thận (ledger đang drift — cấm chèn mù).
4. **Gate PO trước khi bấm nút thật:** ký phễu 3 số + ngưỡng bàn P3a; legal review; Wave 1 + indexing vẫn đang CẤM chờ PO. Merge code ≠ được phép kích hoạt shop thật.
5. Sau mỗi lần kích hoạt: tự báo seller qua Zalo (không có thông báo tự động — đúng quyết định đã ký).

## Audit trail

Toàn bộ raw output từng bước: `docs/build-feature/shop-activation-button/` (00-idea, 01-task-analysis, 02-critic-feasibility, 02-critic-user, 02-final-analysis, 03-ux-spec, rounds/round1-* 6 file, rounds/round2-* 5 file).
