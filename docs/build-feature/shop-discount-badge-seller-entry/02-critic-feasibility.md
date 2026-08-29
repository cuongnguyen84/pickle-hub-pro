# Phản biện kỹ thuật — badge giảm giá + lối vào seller

## 1. Khả thi, rẻ hơn bản phân tích nghĩ — 3 thứ đã có sẵn, 0 consumer
- Token `--shop-price-was` (`shop.css:33`) + class `.tl-shop-price-was` (`shop.css:729`, gạch ngang, tabular-nums) — đã trong contrast test (`contrast.test.ts:112`).
- Cặp `--shop-danger-fill #c62a20` / `--shop-on-danger #fff8f7` đã trong `INK_ON_FILL` (`contrast.test.ts:127`) → nền/chữ badge "-XX%" đủ 4.5:1 cả 2 mode, không token mới.
- Avatar dropdown (`TheLineLayout.tsx:648-698`) trong `.tl-nav-right` — CSS chỉ ẩn `.tl-nav-links` ≤900px (`the-line.css:245`); avatar hiện mọi bề rộng → 1 `<Link>` trong dropdown phủ cả desktop lẫn mobile, không cần đụng drawer.

## 2. Nối RPC — một migration, không đổi chữ ký
5 hàm `CREATE OR REPLACE` giữ tham số (payload JSONB). Lấy đúng bản cuối: `product_update` + `product_public_projection` ở `20260823090000`; `product_create` `20260811210000:575`; `reconcile` `20260811210000:813`; `shop_public_search` `20260813090000:240`.
**Ghi**: không dùng `product_price_vnd()` cho compare_at (RAISE khi NULL, `20260811200000:455`) → wrapper `product_compare_at_vnd(jsonb) RETURNS INTEGER` trả NULL khi null/absent. 4 điểm: `product_create` INSERT; `product_update` INSERT + UPDATE với `CASE WHEN _variant ? 'compare_at_price_vnd' THEN ... ELSE compare_at_price_vnd END` (gửi null = xoá, không gửi = giữ); `reconcile` UPDATE (960, trong câu đã bật privileged_write) + INSERT (976).
CHECK nổ khi seller hạ compare_at trước giá bán → map `check_violation` + tên constraint sang VI trong `errors.ts`; validate client là bonus.
**Đọc**: projection thêm `'compare_at_price_vnd', v.compare_at_price_vnd`; search thêm subquery.

## 3. Card trả gì
Search trả 2 trường: `discount_pct_max` = `max(floor(100 - price*100.0/compare_at))::int` trên variant chưa retired có compare_at; `compare_at_min`. Card: luôn in "-30%"; giá gạch chỉ khi `price_min === price_max && compare_at_min`. Không "tới -30%". PDP: theo `resolved` variant (pattern dòng 542); chưa chọn → chỉ badge % max.

## 4. Cắt / bỏ sót
- **Bulk import cột giá gốc: cắt** (20 sp đã import; làm khi có đợt 2).
- `LIST_COLUMNS` thêm `compare_at_price_vnd` — bắt buộc để form edit nạp được.
- **SSR: tách phase 2** (`shop.ts:74` type tự khai; bump `pr:v72→v73` tại `_middleware.ts:1045` nếu làm).
- Anchor pricing: 1 dòng copy form, không cần quy chế.
- `useMyShop` theo owner: chấp nhận, `// ponytail:`.
- Bỏ sót thật: `SellerProductForm.save.test.tsx` + `variantMatrix.ts:279` serialize cần fixture; `shop-schema-parity.test.ts` chỉ đọc phase-1 → không ảnh hưởng. `ProductProjection.variants` (`shop-schema.ts:320`) và `ProductCard` (`usePublicShop.ts:19`) thêm field optional.
- Native: Codable bỏ key lạ; ghi "deferred có chủ ý".

## 5. Backfill 20 sp
SQL một lần theo slug qua Management API (service role bypass trigger guard, CHECK vẫn bảo vệ). Không đưa vào migration.

## 6. pgTAP tối thiểu — 3 ca vào `shop_phase2a_variants.test.sql` (update set 1500000; set null; throws 23514) + 1 ca `shop_public_search` `discount_pct_max = 22` trong `shop_p2b_public_read.test.sql`.

## 7. Thứ tự + rủi ro prod
(a) lối vào seller trước; (b) migration + pgTAP `db reset`; (c) types + form + VariantEditor; (d) card + PDP; (e) áp migration prod cùng lúc merge (drift CI); (f) backfill; (g) phase 2 SSR/bulk. Không đổi chữ ký → không cần NOTIFY pgrst. Thứ tự deploy web/migration không quan trọng (field thiếu → undefined → không badge).

## 6 câu hỏi
1. Giá gốc. 2. Luôn in `discount_pct_max`, gạch khi đơn giá. 3. SQL theo slug. 4. Chỉ menu avatar. 5. Không hết hạn; xoá giá gốc = hết giảm. 6. "Giá gốc".

Files: `20260823090000_shop_product_specs.sql`, `20260811210000_shop_variants_inventory.sql:575,813`, `20260813090000_shop_p2b_public_read.sql:329-353`, `shop.css:33,50-54,729`, `contrast.test.ts:112,127`, `TheLineLayout.tsx:689-698`, `_middleware.ts:1045`.
