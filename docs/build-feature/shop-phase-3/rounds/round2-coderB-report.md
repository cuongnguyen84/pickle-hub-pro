# BÁO CÁO VÒNG 2 — CODER B (UI: giỏ hàng + checkout + chi tiết đơn)

## (a) File tạo / sửa

**Tạo (13):** `src/pages/shop/Cart.tsx` · `Checkout.tsx` · `OrderDetail.tsx` · `src/components/shop/CartLink.tsx` (`ShopCartLink` + `CartAddedToast`) · `OrderStatusLine.tsx` · `OrderMoneyRows.tsx` · `OrderTimeline.tsx` · `src/hooks/shop/useCart.ts` · `useOrders.ts` · `src/lib/shop/orderFormat.ts` · test: `orderFormat.test.ts`, `errors.reason.test.ts`, `src/pages/shop/__tests__/Cart.states.test.tsx`

**Sửa (15):** `ProductDetail.tsx`, `ShopHome.tsx`, `ShopStore.tsx`, `ShopSearch.tsx`, `ShopCategory.tsx`, `src/lib/shop/errors.ts`, `src/integrations/supabase/shop-client.ts`, `src/styles/shop.css`, `src/App.tsx`, `route-snapshot.json`, `route-snapshot.test.ts`, `scripts/qa/p2b-routes.mjs`, `functions/_middleware.ts`, `functions/robots.txt.ts`, `public/robots.txt`

**KHÔNG đụng** (coder A giữ): `supabase/**`, `scripts/qa/db-race.mjs`, `src/lib/shop/orderState.ts` + test, `shop-schema-parity.test.ts`, `shop-schema.ts`.

```
 functions/_middleware.ts                     |   6 +
 functions/robots.txt.ts                      |  12 +-
 public/robots.txt                            |   7 +
 scripts/qa/p2b-routes.mjs                    |  30 ++++
 src/App.tsx                                  |   8 ++
 src/integrations/supabase/shop-client.ts     |   4 +
 src/lib/shop/errors.ts                       | 114 +++++++++++++++
 src/pages/shop/ProductDetail.tsx             | 146 +++++++++++++++++++-
 src/pages/shop/ShopCategory.tsx              |  14 +-
 src/pages/shop/ShopHome.tsx                  |   6 +
 src/pages/shop/ShopSearch.tsx                |   7 +
 src/pages/shop/ShopStore.tsx                 |  14 +-
 src/routes/__tests__/route-snapshot.json     |  24 ++++
 src/routes/__tests__/route-snapshot.test.ts  |   3 +-
 src/styles/shop.css                          |  79 +++++++++++
```

## (b) Cách làm

- **Giỏ**: một cache duy nhất `["shop","cart","view",userId]` cho `shop_cart_view()`; badge, trang giỏ và checkout đọc cùng entry (badge có query riêng = badge cãi nhau với trang nó dẫn tới). `useCartCount()` trả `null` cho cả 3 ca chưa-đăng-nhập / đang tải / lỗi ⇒ không render số.
- **Ghi giỏ** đúng theo GRANT: `insert(variant_id, qty)` / `update(qty)` / `delete()`. Thêm cùng variant lần 2 = đọc rồi `update`, không upsert. Phải **thêm `delete()` vào interface `ShopTable`** (1 dòng type, passthrough) — `qty = 0` bị CHECK chặn nên không có đường khác.
- **Đọc đơn**: không có RPC cho `authenticated` (`shop_order_json` chỉ GRANT service_role) ⇒ đọc thẳng bảng bằng **cột tường minh** + embed alias `shop:shops(...)`, `items:shop_order_items(...)`, `events:shop_order_events(...)`. Shape trùng payload 2 RPC ⇒ transition/create ghi thẳng vào cache, không round trip thứ hai.
- **Idempotency**: `sessionStorage["shop.checkout.token.<shopSlug>"]`, sinh 1 lần, sống qua F5, xoá ngay sau khi tạo đơn (kể cả replay).
- **Conflict**: `errors.ts` thêm `shopErrorDetail`/`shopErrorReason`/`shopReasonMessage` (parse `error.details` trong try/catch). Checkout không toast: `role="alert"` nói tên món + giá cũ → giá mới, `cart.refetch()` để tổng tự cập nhật, nút về `Thử lại · <tổng mới>`.
- **Badge** trong `div.tl-shop-topline` của từng trang mua; `tl-nav` và bottom nav không bị đụng.
- **PDP**: `.tl-pdp-cta` thành qty + "Thêm vào giỏ" primary, nút liên hệ tụt xuống thường; `ordering_enabled === false` ⇒ ẩn hẳn ô số lượng + nút, hiện `.tl-shop-notice` "Shop đang tạm ngưng bán." và nút liên hệ lấy lại primary.

## (c) Lệnh + output

```
$ npx tsc -b --pretty false          (không có output)

$ npm run lint   → EXIT=0
✖ 32 problems (0 errors, 32 warnings)

$ npm run test   → EXIT=0
 Test Files  195 passed (195)
      Tests  2991 passed | 10 skipped (3001)

$ npx vitest run src/routes/__tests__/route-snapshot.test.ts   → EXIT=0   (4 passed)
$ npx vitest run scripts/qa/route-inventory.test.mjs           → EXIT=0   (27 passed)

$ npm run build   → EXIT=0    ✓ built in 5.15s

$ node scripts/check-bundle-size.mjs   → EXIT=0
INITIAL gz: 227.4 KB / 280 · CODE gz: 1590.7 KB / 1800 · CONTENT gz: 405.6 KB / 600
Total gz JS: 1996.3 KB

$ grep -r "Shop bị tạm ngưng" dist/       → rỗng
$ grep -rl "pickle-gear-sai-gon" dist/     → rỗng
$ grep -rl "tl-proto-banner" dist/         → dist/assets/shop-JrDH3Q6D.css
$ git show HEAD:src/styles/shop.css | grep -c "tl-proto-banner"   → 3   (có từ trước)

$ grep -rn "src/proto" src/pages/shop src/components/shop src/hooks/shop → rỗng

$ ls dist/assets | grep -iE "^(Cart|Checkout|OrderDetail)"
Cart-O22Zo4_P.js · CartLink-CeBWe6OG.js · Checkout-DrPF-NuV.js · OrderDetail-C0-yNhOH.js

$ npx vitest run functions/_lib/__tests__/shop-pilot-seo*.test.ts   → 2 file / 116 passed
$ curl .../rest/v1/shop_orders?select=<cột tường minh>+embed&limit=1  → HTTP 200 []
```

## (d) Acceptance 1–18

| # | Kết quả | Bằng chứng |
|---|---|---|
| 1 | ĐẠT | lint 0 error. 32 warning (30 nền `src/proto/**` + 2 mới `react-refresh/only-export-components` ở `OrderStatusLine.tsx`, cùng khuôn `CatalogResults.tsx` đã có) |
| 2 | ĐẠT | 195 file / 2991 pass (gồm cả test SQL parity của coder A — đang xanh) |
| 3 | ĐẠT | snapshot đủ 3 route EN + 3 `/vi` bọc `ViLanguageWrapper`; số cứng 66→69 kèm comment |
| 4 | ĐẠT | 27 test pass |
| 5 | ĐẠT | build EXIT=0 |
| 6 | ĐẠT | INITIAL 227.4/280 · CODE 1590.7/1800 · CONTENT 405.6/600 — không nới ngân sách, không sửa script |
| 7 | **ĐẠT MỘT PHẦN** | 2/3 marker rỗng. `tl-proto-banner` có 1 lần trong `dist/assets/shop-*.css` — **rule CSS đã tồn tại ở HEAD**, gate chỉ quét JS nên vẫn EXIT=0. Không do vòng này; dọn = xoá rule proto khỏi `shop.css`, ngoài phạm vi |
| 8 | ĐẠT | grep rỗng |
| 9 | ĐẠT | `shippingLabel(0)==="Miễn phí"`, `shippingLabel(30000)==="30.000₫"`, loop khẳng định không bao giờ `"0₫"`/`"—"` |
| 10 | ĐẠT | `telHref`: `0912345678`→`tel:…`; `+84…`, 9 số, 11 số, `""`, `null`, `undefined`, có khoảng trắng, chữ → `null` |
| 11 | ĐẠT | 11 reason → 11 câu phân biệt (Set size 11); details không phải JSON không throw; reason lạ ra câu mặc định; `shopErrorMessage`/`isConflict` cũ vẫn xanh |
| 12–17 | **CHƯA KIỂM** | cần trình duyệt + fixture — việc của `tester`. Chỉ chạy được test component (Cart: 1 shop / 2 shop / paused / blocked / undo / 4 trạng thái trang) |
| 18 | ĐẠT | Không sửa file nào dưới `supabase/**`, `db-race.mjs`, `orderState.ts(.test)`, `shop-schema-parity.test.ts` |

## (e) Dependency phải nhờ coder A

1. **RPC đọc đơn theo `code`** — hiện dùng PostgREST cột-tường-minh. Đề nghị `shop_order_by_code(text)` GRANT cho `authenticated`. Đã verify cú pháp select + embed (HTTP 200) bằng service key; **chưa verify bằng JWT buyer thật** — nếu list cột lệch GRANT sẽ ra 42501 và trang đơn hiện "Chưa tải được đơn hàng".
2. **`ordering_enabled` trong `product_public_projection` / `shop_public_product`** — PDP hiện quy ước `=== false ⇒ tạm ngưng`, `undefined ⇒ đang bán`. ⇒ **TC06 phần PDP sẽ FAIL cho tới khi cột này có thật**; giỏ + checkout không ảnh hưởng.
3. **`orderState.ts` thiếu** `ORDER_H1_BUYER` (5 câu h1) và `ORDER_NOTE_BUYER` (4 câu notice) — khai tạm trong `OrderStatusLine.tsx`. `orderState.ts` đang có `shippingFeeLabel` **trùng chức năng với `shippingLabel`** trong `orderFormat.ts` — nên gộp về một chỗ.
4. **Prefill địa chỉ từ đơn gần nhất (spec §4.4)** — **cố tình chưa làm**. RLS `shop_orders_select_party` cho phép cả shop member đọc ⇒ "đơn mới nhất của tôi đọc được" có thể là đơn của **khách hàng** khi tài khoản đang là seller, mà `buyer_user_id` không được GRANT nên client không lọc được. Cần view/RPC buyer-scoped.

## (f) Còn treo / lệch spec

- **`shop-client.ts` được thêm `delete()`** — không nằm trong danh sách "được sửa" (cũng không trong danh sách cấm). Bắt buộc: GRANT DELETE có sẵn, `qty=0` bị CHECK chặn.
- **`.tl-shop-row--total`** — thêm 1 selector modifier bên trong khối §7.2. Vẫn 4 khối, nhưng không đúng 1 selector như spec ghi.
- **`CartAddedToast` có thêm prop `nonce`** — để thêm liên tiếp reset đồng hồ 6 giây mà không xếp chồng toast.
- **"Xem đơn của tôi"** ở màn không-tìm-thấy-đơn đổi thành **"Về trang chợ" → `/shop`** (prompt cấm link `/shop/orders`). Không chỗ nào trong diff trỏ `/shop/orders`.
- **Không làm** (prompt loại): `/shop/orders`, `/seller/orders(/:code)`, `SELLER_NAV.orders.ready`, `addressForClipboard`.
- **Rủi ro layout chưa tự kiểm được**: 3 trang dùng `main.tl-shop > .tl-shop-page--narrow` theo spec §4.3; `.tl-shop` có `height:100%; overflow:hidden`. Nếu clip dọc ở checkout dài thì TC12 sẽ bắt.
- Tồn kho thật không có trong projection công khai ⇒ `max` ô số lượng ở PDP = 10 (trần CHECK), không phải `min(10, tồn)`.

## (g) Xác nhận
Không commit, không push, không áp migration, không `db reset`. Chỉ đọc PostgREST local (GET, `limit=1`) để kiểm cú pháp select — không ghi gì vào DB.
