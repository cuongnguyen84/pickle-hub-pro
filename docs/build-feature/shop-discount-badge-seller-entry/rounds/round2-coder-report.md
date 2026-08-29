## Báo cáo coder — vòng 2
- B1: `discountPct()` trả null khi floor < 1 (+2 test); SQL `NULLIF((...)::int, 0)` cho `discount_pct_max` (coder ghi "product_public_projection" — kiểm lại: subquery này nằm ở `shop_public_search`), comment ~550.
- B2: `reconcileRows` seed nhận `compareAtVnd?` (`& Partial<Pick<...>>`), cả 2 nhánh `?? seed?.compareAtVnd ?? ""`; VariantEditor seed thêm `compareAtVnd: current[0]?.compareAtVnd ?? ""`; +1 test.
- B6: `shop.css` `.tl-pdp-price > span` → `.tl-pdp-price > .tl-shop-price-was, .tl-pdp-price > .tl-pdp-off`.
- B4: ProductCard.test dùng getByRole; accname gộp span không khoảng trắng ("giảm-30%") → regex `/giảm ?-30%/`; sửa markup ngoài phạm vi.
Files vòng 2: discount.ts, discount.test.ts, variantMatrix.ts, variantMatrix.test.ts, VariantEditor.tsx, shop.css, migration, ProductCard.test.tsx.
Gate: vitest 249 files 3854 pass · lint 0 err · tsc 0 · build+bundle OK INITIAL 225.7 / CODE 1749.5. pgTAP không chạy (Docker).
