# Vòng 2 — Báo cáo coder

**1. Đã làm gì**
- **Fix 1 (copy xác minh):** sửa đúng 6 chỗ theo prompt — `ShopStore.tsx` (sr-text dòng 90 + 2 nhánh verified/unverified dòng 106-107), `ProductCard.tsx:77` (sr-text), `ProductDetail.tsx` (sr-text dòng 260 + hint dòng 270), `ProductPreview.tsx:236` (thêm "(đối chiếu giấy tờ hoặc gặp trực tiếp)").
- **Fix 2:** thêm `cancelText: "Huỷ"` vào call `confirm({...})` trong `AdminShopApplicationReview.tsx` (xác nhận `cancelText` là option hợp lệ của `useConfirm` — `src/hooks/useConfirm.tsx:26`).
- Không đụng migration/RPC/pgTAP/SellerHome/section "Kích hoạt shop" — diff vòng 1 giữ nguyên.

**2. File đã thay đổi** (delta vòng 2):
- `src/components/shop/ProductCard.tsx` (+1/-1)
- `src/components/shop/ProductPreview.tsx` (+1/-1)
- `src/pages/shop/ProductDetail.tsx` (+2/-2)
- `src/pages/shop/ShopStore.tsx` (+3/-3)
- `src/pages/admin/shop/AdminShopApplicationReview.tsx` (+1 dòng `cancelText` — file đã có diff vòng 1)
- Còn lại (`useShopApplicationQueue.ts`, `applicationState.ts`, `SellerHome.tsx`, `SellerShopSettings.tsx` + 5 file untracked) = nguyên diff vòng 1.

**3. Đã tự kiểm tra**
- `npx tsc --noEmit` → exit 0
- `npm run test` → exit 0 (180 files, 2664 passed, 10 skipped — không test snapshot nào vỡ)
- `grep -rn "giấy tờ" src/pages/shop src/components/shop` → còn 5 dòng, tất cả hợp lệ:
  - `SellerApplication.tsx:364,429` + `SellLanding.tsx:91` — seller-side nói về việc NỘP giấy tờ (giữ nguyên theo prompt)
  - `ShopStore.tsx:106` + `ProductPreview.tsx:236` — wording mới "đối chiếu giấy tờ **hoặc** gặp trực tiếp", không claim ĐÃ xem
  - Không còn dòng nào claim đã-xem-giấy-tờ dựa trên boolean `verified`.

**4. Còn thiếu / không chắc** — không có. Không migration mới, không file ngoài phạm vi.
