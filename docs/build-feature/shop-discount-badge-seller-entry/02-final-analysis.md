# Bản phân tích đã chốt — Badge giảm giá + Lối vào Kênh người bán

Nơi làm: worktree `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-fab`, nhánh `feat/shop-discount-badge-seller-entry` (từ origin/main 6cd211d4). Node_modules symlink sẵn.

## Quyết định orchestrator ở 3 điểm mâu thuẫn
| Điểm | critic-user | critic-feasibility | Chốt | Lý do |
|---|---|---|---|---|
| Màu badge | không đỏ, `tl-pcard-flag` chữ xanh | đỏ `--shop-danger-fill`/`--shop-on-danger` (đã pass contrast) | **Đỏ** danger-fill | Cuong yêu cầu "rõ ràng, highlight". Trade-off niềm tin ghi nhận; bù bằng câu miễn trừ PDP + copy form |
| Nhãn | "Giá cũ" | "Giá gốc" | **"Giá gốc"** trên form seller; PDP hiện giá gạch + chữ thường "giá gốc"; câu miễn trừ PDP sửa thành "Giá, giá gốc và tình trạng hàng do shop tự khai." | ngắn, buyer VN hiểu ngay |
| Lối vào seller | 3 chỗ (avatar, drawer, topline /shop) | chỉ avatar (đã phủ mobile) | **Avatar dropdown + link nhỏ ở topline /shop** khi có shop; drawer bỏ (avatar hiện ở mọi bề rộng — đã xác minh CSS). Bonus rẻ: đơn đang chờ duyệt → mục "Đơn mở shop: đang chờ duyệt" → `/seller/application/status` | topline đúng ngữ cảnh, 1 Link |
| Card nhiều phiên bản | chỉ khi mọi variant giảm, % thấp nhất | luôn `discount_pct_max` | **Luôn in `discount_pct_max`** "-30%"; giá gạch chỉ khi `price_min === price_max && compare_at_min` | 20 sp hiện đều single-variant; client không biết "tất cả" mà không thêm field |

## Scope (một PR)
**Hạ tầng đã có**: `product_variants.compare_at_price_vnd` + CHECK `> price_vnd`; token `--shop-price-was`/`.tl-shop-price-was`; cặp danger-fill/on-danger đã contrast-verified.

1. **Migration** `supabase/migrations/20260829<hhmmss>_shop_compare_at_price.sql`, CREATE OR REPLACE giữ chữ ký, chép nguyên bản cuối:
   - wrapper `product_compare_at_vnd(jsonb) RETURNS INTEGER` (NULL khi null/absent, còn lại delegate `product_price_vnd` logic parse).
   - `product_create` (bản `20260811210000:575`) INSERT variant thêm cột.
   - `product_update` (bản `20260823090000`) INSERT + UPDATE với `CASE WHEN _variant ? 'compare_at_price_vnd' THEN product_compare_at_vnd(_variant) ELSE compare_at_price_vnd END`.
   - `product_variants_reconcile` (bản `20260811210000:813`) UPDATE + INSERT đọc `_row -> 'compare_at_price_vnd'`.
   - `product_public_projection` (bản `20260823090000`) variant jsonb thêm `compare_at_price_vnd`.
   - `shop_public_search` (bản `20260813090000:240`) thêm `discount_pct_max` (max floor(100 - price*100.0/compare_at) trên variant chưa retired có compare_at) và `compare_at_min` (compare_at của variant có price = price_min, hoặc min compare_at — chọn một, ghi rõ).
   - pgTAP: 3 ca trong `supabase/tests/shop_phase2a_variants.test.sql` (set 1500000; set null; throws 23514) + 1 ca search `discount_pct_max` trong `shop_p2b_public_read.test.sql`. Chạy local với `supabase db reset` (KHÔNG chỉ `supabase start`).
   - Áp prod qua Management API cùng lúc merge (deploy-guard drift). Không NOTIFY pgrst.
2. **Types**: `ProductProjection.variants[].compare_at_price_vnd?: number | null` (`shop-schema.ts:320`), `ProductCard.discount_pct_max?/compare_at_min?` (`usePublicShop.ts:19`), `VariantRow.compareAtVnd` (`variantMatrix.ts:30`, serialize 279), `LIST_COLUMNS` thêm cột (`useSellerProducts.ts:84`). `errors.ts` map `check_violation` constraint compare_at → "Giá gốc phải lớn hơn giá bán."
3. **Form seller đơn** (`SellerProductForm.tsx` mục 3): ô "Giá gốc (trước giảm, không bắt buộc)" cạnh giá bán; hiện "-XX%" live; validate client compare_at > price; copy 1 dòng "Người mua sẽ thấy giá gốc gạch ngang và % giảm — chỉ nhập giá shop thật sự từng bán." **VariantEditor**: cột "Giá gốc" + bulk-apply; validate từng dòng trước gửi. Cập nhật fixture `SellerProductForm.save.test.tsx`, test variantMatrix.
4. **Card** (`ProductCard.tsx`): badge "-30%" góc ảnh (nền `--shop-danger-fill`, chữ `--shop-on-danger`, cùng vị trí/kích thước pattern `tl-pcard-flag`), giá gạch `.tl-shop-price-was` trước giá bán khi đơn giá. Sửa header comment "no struck-out original price" → giờ data có. Thuần CSS + span.
5. **PDP** (`ProductDetail.tsx` 332-338, 501-517, 540-546): giá gạch + "-XX%" theo `resolved` variant (cả block giá và buybar); chưa chọn → chỉ "-XX%" max. Câu miễn trừ dòng ~514 thêm "giá gốc".
6. **Lối vào seller** (`TheLineLayout.tsx` ~689-698): trong dropdown avatar, gate `useMyShop().data` → "Kênh người bán" → `/seller`; nếu không có shop nhưng `useMyApplication()` pending → "Đơn mở shop: đang chờ duyệt" → `/seller/application/status`. `ShopHome.tsx:45` topline: link nhỏ "Quản lý shop →" tới `/seller` khi có shop (đặt trong topline hiện có cạnh `ShopCartLink floating`; desktop inline, mobile vẫn nằm topline — không thêm vào FAB). `// ponytail: owner-only; shop_members không owner chưa thấy — mở khi có người dùng`.
7. **Backfill 20 sp**: Cuong tự nhập qua form sửa sản phẩm (đúng yêu cầu "anh tự nhập"); nếu Cuong cấp bảng slug→giá gốc thì SQL một lần, không đưa vào migration.

## Không làm (phase 2)
Bulk import cột giá gốc; SSR giá gốc + bump pr:v; native render; hết hạn giảm giá; trang/filter giảm giá; quy chế seller (chỉ copy trong form); drawer mobile.

## Gate
tsc -b, eslint, vitest (shop + styles + lib), pgTAP local `db reset`, `check-bundle-size` (CODE headroom ~53 KB!), contrast test, route inventory không đụng.
