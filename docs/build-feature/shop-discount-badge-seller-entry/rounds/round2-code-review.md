# Vòng 2 — code review (tự đối chiếu diff thật, không qua Codex: 3 fix nhỏ, kiểm tra trực tiếp đủ độc lập)

Worktree `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-fab`, chưa commit.

## B1 — `-0%`
- `src/lib/shop/discount.ts`: `discountPct()` = `Math.floor(...)`, `pct < 1 → null`; JSDoc đã ghi "giảm chưa tới 1%". ĐÚNG.
- Test: `discountPct(1_999_999, 2_000_000) → null`, `maxDiscountPct([...]) → null`. Có.
- SQL: `NULLIF((SELECT max(floor(...))::int ...), 0)` ở dòng 656 — nằm trong `shop_public_search` (bắt đầu dòng 557), KHÔNG phải `product_public_projection` (440) như coder ghi. Đúng chỗ, vì `discount_pct_max` chỉ là khoá của card search; PDP tính client bằng `maxDiscountPct`. Comment dòng 550-552 đã cập nhật. Ngoặc đóng đủ, cú pháp hợp lệ khi đọc; **chưa chạy được** (Docker chết, không pgTAP).
- Đường render: card `off >= 1` (ProductCard.tsx:71), PDP `discountPct != null` (ProductDetail.tsx:161-166), VariantEditor/SellerProductForm hint đều qua `discountPct`. Không còn đường nào ra `-0%`.
- Nhận xét nhỏ, không chặn: card vẫn gạch giá gốc (`was`) khi `compare_at_min > price_min` dù giảm <1% (badge ẩn, gạch giá còn). PDP thì ẩn cả hai. Lệch nhỏ, trường hợp thực tế hiếm — ghi để biết.

## B2 — mất giá gốc khi bật ma trận
- `reconcileRows` seed `& Partial<Pick<VariantRow,"compareAtVnd">>`, cả nhánh single (dòng 157) và multi (177) đều `kept/first?.compareAtVnd ?? seed?.compareAtVnd ?? ""`. ĐÚNG.
- `VariantEditor.tsx:133-137` seed thêm `compareAtVnd: current[0]?.compareAtVnd ?? ""`. ĐÚNG.
- Test variantMatrix dòng 222-227: seeded → "1250000", unseeded → "". Có.

## B6 — nowrap PDP
- `shop.css:1556`: `.tl-pdp-price > .tl-shop-price-was, .tl-pdp-price > .tl-pdp-off { white-space: nowrap; }`. Span giá không class hết nowrap. ĐÚNG. Không đụng TSX.

## B4 (tuỳ chọn)
- ProductCard.test dùng `getByRole("link", { name: /giảm ?-30%/ })`. Regex `?` vì accname gộp span không có khoảng trắng — chấp nhận, sửa markup ngoài phạm vi.

## Gate (tự chạy lại)
- vitest `src/lib/shop` + ProductCard.test: 19 files / 382 pass.
- eslint các file shop đổi: 0 lỗi. `tsc --noEmit`: exit 0.
- Coder báo full: vitest 3854 pass, bundle INITIAL 225.7 / CODE 1749.5 — không chạy lại toàn bộ.

## Phạm vi diff
File vòng 2 đúng danh sách acceptance #5 (discount.ts, discount.test.ts, variantMatrix.ts, variantMatrix.test.ts, VariantEditor.tsx, shop.css, migration, ProductCard.test.tsx). Không có file lạ ngoài diff vòng 1.

Kết luận review code: ĐẠT.
