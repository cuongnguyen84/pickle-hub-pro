# Phân tích công việc — Badge giảm giá + Lối vào Kênh người bán

Khảo sát trên worktree `.claude/worktrees/shop-fab` (= origin/main 6cd211d4).

## 1-2. Ý tưởng / bài toán
Hai việc độc lập: (1) 20 sản phẩm vừa import đang giảm giá nhưng card/PDP không thể hiện; seller tự nhập con số giảm, thấy nổi bật mọi nơi. (2) Người có shop không có nút dẫn tới `/seller`, phải gõ URL.

## 3a. Badge giảm giá — hạ tầng đã có một nửa
- **`product_variants.compare_at_price_vnd INTEGER NULL` đã tồn tại** (migration `20260811120000_shop_phase2a_catalog.sql:191`) kèm CHECK `compare_at_price_vnd > price_vnd` (205-206) → DB đã kiểm tra giá gốc > giá bán.
- Type `ProductVariantRow` (`shop-schema.ts:204`) đã có field. Giá sống ở **variant** ("Price and stock live here, always").

Chưa nối tới cột này:
| Lớp | File | Hiện trạng |
|---|---|---|
| RPC ghi đơn | `product_create`/`product_update` — `20260823090000_shop_product_specs.sql:69-192` | `_variant` chỉ đọc price_vnd/sku/stock |
| RPC ghi ma trận | `product_variants_reconcile` — `20260811210000_shop_variants_inventory.sql:931-987` | không đọc compare_at |
| Trigger guard | `products_guard_privileged_columns` + `shop.privileged_write` | seller không PATCH thẳng variant → bắt buộc qua RPC |
| RPC đọc card | `shop_public_search` — `20260813090000_shop_p2b_public_read.sql:329-353` | chỉ price_min/max |
| RPC đọc PDP | `product_public_projection` — `20260818120000_shop_phase3_projection_and_address.sql:98` | variants chỉ price_vnd |
| Types | `ProductProjection.variants` `shop-schema.ts:320-331`; `ProductCard` trong `src/hooks/shop/usePublicShop.ts` | chưa có |
| Card | `src/components/shop/ProductCard.tsx` | header: "no struck-out original price, no badge the data cannot support" → sửa comment + UI; pattern `tl-pcard-flag` ("Hết hàng") dòng 59 |
| priceLabel | `src/lib/shop/publicCatalog.ts:27` | min/max |
| PDP | `ProductDetail.tsx:332-336, 540-544` (`displayPrice`) | theo variant chọn, không giá gốc |
| Form seller | `SellerProductForm.tsx:726-770` mục "3. Price and stock" | 1 ô giá |
| VariantEditor | `src/components/shop/VariantEditor.tsx` + `VariantRow` `src/lib/shop/variantMatrix.ts:30`, serialize 279-282 | không compare_at |
| Bulk import | `useBulkProductImport.ts` (`parsePrice`, `priceOverride`) | không cột giá gốc — 20 sp hiện KHÔNG có compare_at |
| Seller list | `useSellerProducts.ts:84` `LIST_COLUMNS` | không select |
| SSR | `functions/_lib/render/shop.ts:482-571` Offer | chưa; bump `pr:v<N>` nếu đổi HTML |
| Native | `apple/.../ShopPublicDTOs.swift:80-89,147-155` | Codable bỏ qua key lạ — chỉ ghi nhận |

## 3b. Lối vào Seller Center — 3 đường, đều gián tiếp
- `/shop/sell` → khi approved hiện "Vào kênh người bán" (`SellLanding.tsx:54`); link tới /shop/sell chỉ ở footer TheLineLayout (1052) và empty-state ShopHome (139).
- `/seller/application/status` → "Vào Kênh người bán" (`SellerApplicationStatus.tsx:63`).
- Không có ở: menu avatar (`TheLineLayout.tsx:662-698` — có Creator/Admin/CLB, không Shop), MoreSheet (`navItems.ts:62`), BottomNav (4 ô cố định, cấm ô 6), ShopHome topline, ShopStore.
- Hook có sẵn: `useMyShop()` (`useSellerApplication.ts:82-96`, query shops theo owner_user_id), `useMyApplication()`. Menu avatar đã có pattern role-gated (isCreator/isAdmin) → chỗ tự nhiên nhất.

## 4. Phạm vi
**Trong:** nối `compare_at_price_vnd` xuyên ghi (3 RPC + 2 form + bulk import) → đọc (2 RPC public + types) → hiển thị (card, PDP, seller list) → SSR. Seller nhập **giá gốc** cạnh giá bán; % = dẫn xuất hiển thị, không lưu. Backfill 20 sp (tay qua form hoặc SQL một lần). Lối vào Seller Center: mục menu avatar khi có shop (+ cân nhắc điểm chạm nhỏ trên /shop cho chủ shop). Không thêm ô bottom nav.
**Ngoài:** voucher/flash sale/hết hạn; trang "Đang giảm giá"/filter; đổi công thức tiền đơn (`shop_order_create` vẫn price_vnd); native render; lối vào cho người chưa có shop.

## 5. Phần việc
1. Migration: CREATE OR REPLACE `product_create`, `product_update`, `product_variants_reconcile` đọc compare_at (nullable, qua `product_price_vnd()`); `shop_public_search` + `product_public_projection` trả ra (card: giá trị đại diện `compare_at_min`/`discount_pct_max`; PDP: theo variant). pgTAP 3 ca: lưu được; compare_at <= price bị CHECK từ chối; gửi null xoá được.
2. Types + parity (`shop-schema-parity.test.ts` đang modified trong git status repo gốc — kiểm tra).
3. Form seller: ô giá gốc (đơn) + cột (VariantEditor, bulk-apply); "-XX%" tại chỗ; map lỗi CHECK sang VI trong `src/lib/shop/errors.ts`.
4. Bulk import: cột giá gốc tuỳ chọn.
5. Hiển thị: card badge % (pattern `tl-pcard-flag`) + giá gốc gạch; PDP giá gạch + % theo variant; seller list nhẹ.
6. SSR text; schema.org Offer không có field giá gốc chuẩn; bump pr:v.
7. Menu avatar mục "Kênh người bán" gated `useMyShop`.

## 6. Ràng buộc đã xác nhận
RLS/trigger: mọi ghi qua RPC. Migration prod áp qua Management API OK; gotcha CREATE OR REPLACE không đổi chữ ký; local pgTAP phải `db reset`. pgTAP `shop_phase2a_catalog.test.sql:293` đã có ca INSERT compare_at. Deploy-guard đếm drift → thêm file phải áp prod cùng lúc. Bundle: badge thuần CSS + 1 span. Contrast: badge text 4.5:1, token mới khai `.tl-shop` + light. Route inventory không đụng. Edge registry không ảnh hưởng. `SHOP_PUBLIC_OPEN` false thì public không thấy.

## 7. Rủi ro
- **Giá gốc giả (anchor pricing)** — nhãn "Giá niêm yết của shop" thay "Giá gốc"; quy chế seller.
- CHECK nổ khi hạ giá gốc trước giá bán trong VariantEditor bulk-apply → validate client.
- Card nhiều variant lệch %: "tới -30%" hay chỉ khi đồng nhất?
- PDP giá gạch đi theo `resolved` variant như buybar 540-544.
- Order snapshot không lưu compare_at — chấp nhận.
- SSR quên bump pr:v. Native contract test dùng JSON cứng — thêm key không gãy.
- `useMyShop` theo owner → shop_members không owner không thấy menu.

## 8. Câu hỏi mở
1. Nhập giá gốc (đề xuất) hay %?
2. Card nhiều phiên bản: "tới -X%" hay chỉ khi đồng nhất?
3. Backfill 20 sp: có bảng giá gốc không, hay sửa tay?
4. Lối vào: chỉ menu avatar (desktop + drawer mobile?) hay thêm điểm chạm trên /shop?
5. Hết hạn giảm giá? Đề xuất KHÔNG.
6. Nhãn: "Giá gốc" / "Giá niêm yết" / "Giá cũ".
