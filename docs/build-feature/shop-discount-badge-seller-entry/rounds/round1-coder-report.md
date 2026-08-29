## Báo cáo coder — vòng 1

### 1. Đã làm
- **Migration** `supabase/migrations/20260829120000_shop_compare_at_price.sql`: `product_compare_at_vnd(jsonb)` (IMMUTABLE, REVOKE/GRANT như `product_price_vnd`); CREATE OR REPLACE 5 RPC chép nguyên văn bản mới nhất (`product_create`, `product_update` CASE giữ/xoá theo presence key, `product_variants_reconcile` full-row replace, `product_public_projection` + `compare_at_price_vnd`, `shop_public_search` + `discount_pct_max`/`compare_at_min` tie-break). Chữ ký, REVOKE/GRANT giữ nguyên.
- **pgTAP**: `shop_phase2a_variants.test.sql` (+3 case product_update: 1500000; null; ≤ giá → 23514; plan 90→95), `shop_p2b_public_read.test.sql` (+ sp 780000/1000000 → discount_pct_max=22, compare_at_min=1000000; plan 73→75).
- **Helper thuần** `src/lib/shop/discount.ts` (+test): `discountPct`, `maxDiscountPct`, `parseCompareAt`, `compareAtError`, `COMPARE_AT_NOT_ABOVE`.
- **Types/wiring**: `shop-schema.ts`, `usePublicShop.ts`, `useSellerProducts.ts` (LIST_COLUMNS, ProductDraft, payload gửi null khi rỗng), `variantSelection.ts`, `variantMatrix.ts` (compareAtVnd, validate, bulk, serialize), `errors.ts` (23514 + `product_variants_compare_range` → "Giá gốc phải lớn hơn giá bán.").
- **UI**: `SellerProductForm.tsx` (ô p-compare, hint sống, lỗi/focus, trust hint), `VariantEditor.tsx` (cột 4, validate, bulk "Giá gốc", hint %, trust warning), `ProductCard.tsx` (badge + strike + comment), `ProductDetail.tsx` (strike/badge theo resolved, badge max chưa chọn, buybar strike, disclaimer), `TheLineLayout.tsx` (dropdown sau "Giải đấu của tôi", VI/EN), `ShopHome.tsx` ("Quản lý shop →"), `shop.css` (`.tl-pcard-off`, `.tl-pdp-off`, strike rules, crumbs hover).

### 2. Files: 21 sửa (+484/−59) + 4 mới
Sửa: TheLineLayout.tsx, ProductCard.tsx, VariantEditor.tsx, VariantEditor.test.tsx, useSellerProducts.writes.test.ts, usePublicShop.ts, useSellerProducts.ts, shop-schema.ts, errors.test.ts, variantMatrix.test.ts, errors.ts, productState.ts, variantMatrix.ts, variantSelection.ts, ProductDetail.tsx, SellerProductForm.tsx, ShopHome.tsx, SellerProductForm.save.test.tsx, shop.css, shop_p2b_public_read.test.sql, shop_phase2a_variants.test.sql.
Mới: `src/lib/shop/discount.ts`, `src/lib/shop/__tests__/discount.test.ts`, `src/components/shop/__tests__/ProductCard.test.tsx`, migration.

### 3. Gate
tsc exit 0 · lint 0 errors/31 warnings (baseline) · vitest 139 files, 2451 pass (contrast pass) · build + bundle exit 0: INITIAL 225.6 KB (không đổi), CODE 1746.2 → 1748.9 KB (+2.7, headroom 51.1) · `git diff --check` sạch.

### 4. Lệch spec / ghi chú
- pgTAP chưa chạy local (Docker down) — CI.
- Grid `1fr 1fr 1fr` là inline style trong VariantEditor.tsx (không shop.css) → đổi inline + colSpan 3→4.
- Accessible name card với markup spec = `"giảm -30%"` (không "giảm 30%") — test theo markup thật.
- Save test: tầng form payload `compare_at_price_vnd === ""`; "" → null nằm trong `useCreateProduct`, test ở writes.test.
- `useMyShop`/`useMyApplication` đã `enabled: !!user`.
- Sửa thêm bắt buộc: `sameDraft` dùng `?? ""` (draft cũ localStorage thiếu khoá); `Field` gán `id="<id>-hint"`; `stored.draft` spread lên EMPTY_DRAFT.
- Màn sửa sản phẩm: ô giá đơn chỉ `isNew` → giá gốc sp đã có sửa qua VariantEditor; `product_update._variant` vẫn wire.
- Chưa kiểm Chrome: responsive strike, focus-on-error, variant switching PDP.
