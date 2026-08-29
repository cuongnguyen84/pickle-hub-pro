# Bản phân tích ĐÃ CHỐT — Vòng UI polish khu Shop

Tổng hợp từ `01-task-analysis.md` + 2 critic (đồng thuận, không có mâu thuẫn phải đưa PO). Ghi chú orchestrator: cảnh báo "skill hallmark không tồn tại" của critic-feasibility đã kiểm chứng là SAI — hallmark là skill session-level, đã chạy thành công ở vòng ux-designer trước trong cùng phiên.

## Neo thiết kế (chốt, không bàn lại)

**Shopee là neo duy nhất.** Buyer-side: trang shop + danh sách sản phẩm Shopee (ảnh lớn, giá đậm, badge rõ ràng). Seller-side: **Shopee Seller Center bản mobile web** (dashboard ô số liệu to, danh sách sản phẩm có thumbnail + trạng thái màu). KHÔNG neo TikTok Shop. Bổ trợ: các trang The Line đã được PO duyệt (home, feed, rankings) là chuẩn "cùng đẳng cấp" trong nội bộ repo. Hallmark audit dùng để chống AI-slop, không thay neo.

**Nghiệm thu trên iPhone thật** (viewport mobile là chính; desktop là phụ) — đúng bối cảnh PO chê.

## Scope CHỐT (theo thứ tự giá trị, không phải theo màn)

1. **Thumbnail thật ở SellerProducts** — hạng mục chắc chắn, commit riêng. Client-only, KHÔNG migration/policy mới: thêm `public_path`/`draft_path` vào `LIST_COLUMNS` (`useSellerProducts.ts:83-84`), lift hook `useSignedPreviews` (đã có sẵn trong `MediaEditor.tsx:56-82`, bucket draft, mock pattern có sẵn trong `MediaEditor.test.tsx`) ra dùng chung, đổi component `Thumb` render ảnh. Ưu tiên `public_path` (public, không hết hạn), fallback signed URL cho draft. 1 test mock `createSignedUrls`.
2. **ShopStore (trang shop công khai) — kéo lên tier 1**: đầu trang có mặt mũi bằng **monogram avatar sinh từ tên shop** (chữ đầu + màu hash từ tên, thuần CSS/SVG, 0 data mới) + banner mảnh token màu + badge xác minh + số sản phẩm. KHÔNG upload logo vòng này (backlog riêng: expose logo/cover đã-duyệt qua `shop_public_shop` = 1 migration nhỏ, ~nửa ngày — upload/duyệt ĐÃ có sẵn trong SellerShopSettings).
3. **SellerHome thành dashboard thật**: 3-4 ô số liệu từ hook `useProductStatusCounts` có sẵn (đang bán / chờ duyệt / nháp...), nút **"Xem shop của tôi"** nổi bật (phục vụ hành vi khoe link Zalo/Facebook). ⚠️ Bẫy đã biết: `SellerHome.copy.test.tsx` không bọc QueryClientProvider — PHẢI mock module `useSellerProducts` trong test cùng commit, không thì test crash.
4. **SellLanding + SellerApplication/Status**: phá thế "6 khối xám giống nhau" — phân cấp hero/checklist/ghi chú phụ, CTA nổi bật; màn Status thêm cảm giác "hồ sơ được người thật cầm" (timeline trạng thái + đường liên hệ Zalo/admin, KHÔNG hứa SLA).
5. **ShopHome + ProductCard polish nhẹ + EMPTY STATE toàn khu tier 1+2**: empty state là giao diện chính trong pilot — mỗi màn phải có empty state có chủ đích (nói được điều gì, không chỉ xám). ShopHome GIỮ ràng buộc B01: card đầu tiên lộ trên fold ở 320px — cấm hero to.
6. Admin (tier 3): **CẮT khỏi vòng này.**

## CẤM / ngoài scope

- **KHÔNG đụng cấu trúc SellerProductForm** (1390 dòng, 3 test hành vi). Cho phép tối đa: hưởng lợi gián tiếp từ CSS chung trong shop.css.
- KHÔNG đổi copy đã acceptance (copy trung thực là tài sản — polish thị giác quanh nó, giữ nguyên lời). `SellerHome.copy.test.tsx` là guard.
- KHÔNG thư viện UI/icon set/component JS lib mới. KHÔNG đổi token The Line tầng gốc, KHÔNG hạ contrast (test `contrast.test.ts` INK_ON_FILL là gate).
- KHÔNG đổi luồng nghiệp vụ/state machine/query (ngoại lệ đã duyệt: LIST_COLUMNS + counts ở trên).
- KHÔNG bulk-approve (PO đã hoãn), KHÔNG upload logo, KHÔNG indexing.

## Ràng buộc thi công

- Worktree: `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-ui-polish` (branch `feat/shop-ui-polish` từ origin/main `65703e41`).
- **Bundle gate (`check-bundle-size.mjs`) chỉ đo JS** — CSS tự do; phần JS mới (thumbnail hook, counts) phải nhỏ; headroom Total ~13.6 KB.
- Coverage ≥83% (file sửa có test cộng mẫu số); lint/tsc; pgTAP không đụng (không migration).
- Visual CI: advisory, chưa có baseline shop — KHÔNG phải rủi ro; tuỳ chọn cuối vòng: thêm `/shop`, `/shop/sell`, PDP vào `tests/visual.spec.ts` + chạy workflow_dispatch capture baseline.
- Giữ nguyên các fix đã ghi sổ trong shop.css (touch target 44px, min-width:0, light-mode ink flip, chip count, data-mobile-only/desktop-only, scroll ownership) — ưu tiên THÊM class, tránh viết lại block cũ.
- VI-first; seller/admin VI-only giữ nguyên.

## Backlog phát sinh (ngoài vòng, đã ghi)

- Expose logo/cover đã duyệt qua `shop_public_shop` + render ShopStore (1 migration + pgTAP, ~nửa ngày).
- Bulk approve admin. Admin UI polish (tier 3). Admin UI pilot allowlist.
