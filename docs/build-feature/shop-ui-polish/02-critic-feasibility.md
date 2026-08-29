# Phản biện khả thi kỹ thuật — shop-ui-polish

## 1. Kiểm chứng hiện trạng: phần lớn ĐÚNG, nhưng 2 khẳng định quan trọng SAI

**Đúng (đã xác minh trong worktree):**
- `Thumb` đúng là placeholder "N ảnh"/ImageOff, dòng 404-415 `src/pages/shop/SellerProducts.tsx`, comment "signed URL nobody is minting yet".
- `SellerProductForm.tsx` đúng 1390 dòng, 3 test hành vi.
- `useProductStatusCounts` có sẵn (`src/hooks/shop/useSellerProducts.ts:135`), RPC read-only `product_status_counts` đang được SellerProducts dùng.
- Contrast test có block riêng cho shop.css (`src/styles/__tests__/contrast.test.ts:42-51`).
- `shop_public_shop` (migration `20260813090000:475-497`) không lộ trường ảnh nào.
- SellLanding: đúng hướng nhưng chi tiết hơi lệch — 3 requirement dùng `tl-shop-card`, 4 section dưới dùng `tl-shop-notice`. Không ảnh hưởng kết luận.

**Sai #1 — rủi ro visual CI là rủi ro ẢO.** `visual.yml` là **advisory** (`continue-on-error: true`, "never blocks merge"); snapshot hiện có KHÔNG chứa trang shop nào. Quy trình thật: nếu muốn lưới an toàn thì THÊM trang shop public vào `tests/visual.spec.ts` cuối vòng rồi chạy workflow_dispatch "Visual baseline (capture)"; trang seller cần đăng nhập — bỏ qua.

**Sai #2 — ràng buộc bundle mềm hơn phrase gốc.** `check-bundle-size.mjs` chỉ quét file `.js` — **CSS không nằm trong gate**. Polish chủ yếu shop.css + markup gần như miễn phí. Điều cấm thật vẫn đúng: không component/lib JS mới.

## 2. Thumbnail thật: phân tích ĐÁNH GIÁ QUÁ CAO độ khó — đưa VÀO vòng

Toàn bộ hạ tầng đã chạy trên production:
- `MediaEditor.tsx:56-82` có sẵn hook `useSignedPreviews` gọi `createSignedUrls` trên bucket `shop-product-media-draft` — cùng bucket, cùng session seller, policy đã exercise thật, đã có mock pattern trong `MediaEditor.test.tsx`.
- Sản phẩm đã publish có `public_path` + helper URL public sẵn (`src/lib/shop/publicCatalog.ts:71`).
- Việc còn thiếu: thêm `draft_path`/`public_path` vào `LIST_COLUMNS` (`useSellerProducts.ts:83-84`), lift `useSignedPreviews` dùng chung, đổi `Thumb` nhận path. **Không migration, không policy mới, không pgTAP.** Ưu tiên `public_path` (không hết hạn), fallback signed URL cho draft.

Đề xuất: hạng mục riêng trong tier 1, commit riêng, 1 test mock `createSignedUrls` theo pattern có sẵn.

## 3. SellerHome thêm số liệu: AN TOÀN, kèm 1 bẫy test cụ thể

RPC read-only đã granted. **Bẫy:** `SellerHome.copy.test.tsx` không bọc `QueryClientProvider` — thêm useQuery vào SellerHome làm test **crash**. Coder phải mock module `useSellerProducts` trong test đó cùng commit. Ghi rõ vào work order.

## 4. Logo shop công khai: đồng ý cắt, nhưng lý do gốc sai một nửa

Upload + duyệt logo/cover ĐÃ CÓ (`SellerShopSettings.tsx:326-342`, `ShopProfileMediaSection`, purpose logo/cover + public_path). Thiếu duy nhất: `shop_public_shop` chưa trả trường ảnh = **1 migration nhỏ + pgTAP**. Vẫn để ngoài vòng polish (đổi loại rủi ro), backlog chính xác: "expose logo/cover đã duyệt qua shop_public_shop + render ở ShopStore" — ~nửa ngày.

## 5. Scope 3 tier trong 1 vòng: KHÔNG nổi — cắt trước

- **Tier 3 (admin): cắt ngay từ work order.** (Q4: cắt.)
- **SellerProductForm: KHÔNG đụng cấu trúc.** Cho phép tối đa: CSS ở shop.css ảnh hưởng gián tiếp. Ghi thành dòng cấm.
- **Tier 2 thu hẹp**: ShopHome đầu trang (giữ B01), ProductCard, đầu trang ShopStore. CatalogResults/PDP chỉ đụng nếu còn vòng.
- Scope cuối: **Tier 1 (trừ form) + thumbnail thật + SellerHome counts + Tier 2 thu hẹp.**

## 6. Neo "hiện đại": đủ NẾU dùng đúng

Token The Line + contrast test là neo màu/contrast/spacing, không phải neo phân cấp thị giác. Neo thực dụng: **"trang shop phải cùng đẳng cấp với các trang The Line đã có baseline (home, feed, rankings)"** — cùng repo, cùng token, PO đã duyệt.
⚠️ Cảnh báo hallmark không tồn tại → **orchestrator xác minh: SAI — hallmark là skill session-level, đã chạy thành công ở vòng ux-designer trước trong chính phiên này.**

## Tổng hợp đề xuất sửa bản phân tích

1. Xoá rủi ro "baseline khu shop sẽ đỏ" → "chưa có visual coverage; tuỳ chọn thêm spec + capture cuối vòng".
2. Bundle gate chỉ đo JS; CSS tự do; cấm component/lib JS mới.
3. Thumbnail thật → hạng mục chắc chắn trong tier 1 (client-only).
4. SellerHome counts: duyệt, kèm sửa mock test cùng commit.
5. Cắt tier 3; cấm đụng cấu trúc SellerProductForm.
6. Logo public: backlog "expose qua shop_public_shop" (~nửa ngày), ngoài vòng.
