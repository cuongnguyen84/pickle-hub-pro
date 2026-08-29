# Vòng 2 — prompt sửa lỗi cho `coder`

Worktree `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-fab`, nhánh `feat/shop-discount-badge-seller-entry`. Docker chết → không chạy pgTAP, chỉ vitest/lint/tsc/bundle. **Không commit.** Diff vòng 1 giữ nguyên, chỉ thêm 3 sửa sau.

## 1. B1 — `-0%` (bắt buộc)
- `src/lib/shop/discount.ts` `discountPct()`: tính `pct = Math.floor(...)`; trả `null` nếu `pct < 1`. Sửa JSDoc: "null khi không có giá gốc hợp lệ hoặc giảm chưa tới 1%".
- `src/lib/shop/__tests__/discount.test.ts`: thêm case `discountPct(1_999_999, 2_000_000) === null` và `maxDiscountPct` với danh sách chỉ gồm biến thể đó → `null`.
- `supabase/migrations/20260829120000_shop_compare_at_price.sql` (~dòng 655, `product_public_projection`): bọc `NULLIF((SELECT max(floor(...)) ...)::int, 0)` để server cùng luật. Cập nhật comment dòng ~550 ("giảm < 1% → NULL"). Không đổi test pgTAP hiện có (22 vẫn 22); có thể thêm 1 assert NULLIF vào `supabase/tests/shop_p2b_public_read.test.sql` nếu tăng `plan` tương ứng — không chạy được local, nên chỉ thêm khi chắc cú pháp.

## 2. B2 — mất giá gốc khi bật ma trận (bắt buộc)
- `src/lib/shop/variantMatrix.ts` `reconcileRows`: `seed` thành `Pick<VariantRow, "priceVnd" | "compareAtVnd" | "stockOnHand">` (compareAtVnd optional cũng được); dòng 156 và 176: `compareAtVnd: first/kept?.compareAtVnd ?? seed?.compareAtVnd ?? ""`.
- `src/components/shop/VariantEditor.tsx:133`: seed thêm `compareAtVnd: current[0]?.compareAtVnd ?? ""`. Dòng 193 truyền `current[0]` nguyên — giữ.
- `src/lib/shop/__tests__/variantMatrix.test.ts`: 1 test — rows đơn `[{priceVnd:"1000000", compareAtVnd:"1250000", ...}]`, gọi `reconcileRows(groups 2 size, rows, seed có compareAtVnd)` → mọi row mới có `compareAtVnd === "1250000"`; và seed không có compareAtVnd → `""`.

## 3. B6 — nowrap khoảng giá PDP (bắt buộc)
- `src/styles/shop.css:1556`: thay `.tl-pdp-price > span { white-space: nowrap; }` bằng `.tl-pdp-price > .tl-shop-price-was, .tl-pdp-price > .tl-pdp-off { white-space: nowrap; }`. Span giá/khoảng giá (không class) trở về `white-space: normal` mặc định, được xuống dòng ở dấu " – " khi 320px. Không sửa TSX.

## 4. B4 — tuỳ chọn
`src/components/shop/__tests__/ProductCard.test.tsx`: đổi assert `.textContent` sang `getByRole("link", { name: /giảm -30%/ })` / `/giá gốc 2\.400\.000₫/` để kiểm accessible name thật. Bỏ qua nếu tốn thời gian.

## Acceptance criteria vòng 2
1. `discountPct(1_999_999, 2_000_000) === null`; không còn đường nào render `-0%`; SQL `discount_pct_max` NULLIF 0.
2. Bật ma trận từ sản phẩm đơn có giá gốc → mọi row mới mang giá gốc cũ (test variantMatrix xanh).
3. CSS nowrap chỉ còn áp `.tl-shop-price-was` và `.tl-pdp-off` trong `.tl-pdp-price`.
4. `npm run test`, `npm run lint`, `npx tsc --noEmit`, `node scripts/check-bundle-size.mjs` (hoặc gate bundle của repo) xanh.
5. `git diff --stat` so với vòng 1 chỉ đụng: `discount.ts`, `discount.test.ts`, `variantMatrix.ts`, `variantMatrix.test.ts`, `VariantEditor.tsx`, `shop.css`, migration `20260829120000_shop_compare_at_price.sql` (+ tuỳ chọn `shop_p2b_public_read.test.sql`, `ProductCard.test.tsx`). File nào khác xuất hiện → giải thích trong báo cáo.

Báo cáo: liệt kê file đổi + output 4 lệnh gate.
