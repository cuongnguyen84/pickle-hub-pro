# Tổng kết — FAB Giỏ hàng + Đơn của tôi (Shop web)

**Ý tưởng:** Nút Giỏ hàng + Đơn của tôi thành nút float trên nền shop, nút giỏ có "2 light".
**Chốt:** Nhánh `feat/shop-production-phase-1` không có code người mua → làm ở worktree `.claude/worktrees/shop-fab` (nhánh `feat/shop-floating-cart` từ origin/main). Trên main, `ShopCartLink` đã có cả 2 link nhưng cuộn mất theo trang → thêm prop `floating`: mobile <900px là cụm fixed góc dưới phải (Đơn trên, Giỏ 48px dưới), desktop giữ inline. "2 light" = 2 lớp box-shadow xanh (ring 18% + glow 35%) chỉ khi giỏ có hàng, tĩnh, không pulse.

**Phản biện:** critic-user muốn bỏ FAB làm topline sticky (giống native toolbar, Shopee/Tiki đặt giỏ trên) — giữ FAB theo yêu cầu gốc, sticky là fallback. Cả hai đồng thuận: per-page mount trong `.tl-shop` (đọc được biến bottomnav/safe-area, reduced-motion), ẩn FAB khi buybar PDP hiện, không FAB desktop, không ẩn-khi-cuộn, khách chưa login vẫn ẩn, giữ tên "Đơn của tôi".

**UX:** z-index 44 (dưới toast 45, buybar 60), bottom = bottomnav + safe + 12px, padding đáy 96+112px cho 5 trang catalogue, `:active` scale 0.96, token The Line không hex mới.

**Code:** ĐẠT 12/12 acceptance sau 1 vòng. 8 file: `src/components/shop/CartLink.tsx`, `__tests__/CartLink.test.tsx` (+7 test), `src/pages/shop/{ShopHome,ShopSearch,ShopCategory,ShopStore,ProductDetail}.tsx`, `src/styles/shop.css`. vitest 227 pass, lint 0 error, tsc OK, bundle 225.4/280 KB. Bỏ nhịp sáng khi count tăng (cần state/effect). Chưa commit.

**Test thật:** TC1 (signed-out) pass; TC2–TC8 không chạy được — cần login admin TOTP/pilot; service-role mint session bị classifier chặn.

**Cuong kiểm tra tay:** xem `rounds/round1-verdict.md` mục "Chưa được xác minh" (server http://localhost:8081 đang chạy từ worktree).

## Cập nhật 29/08 (sau khi Cuong xem preview)
- Feedback: bỏ chữ "Đơn của tôi" (icon-only, aria giữ), nút giỏ màu xanh nút "Tìm" sáng hơn một bậc, cả hai nút 56px. Sửa `081702d1`.
- **MERGED main**: #699 `feat/shop-unified` (squash `cd47f7bd`) rồi #698 FAB (squash `fe3fd688`).
- Nhánh `feat/shop-production-phase-1` KHÔNG merge: base cũ + 125 file WIP hỗn hợp — xem memory `shop-unified-merged-and-fab-2026-08-29`.
