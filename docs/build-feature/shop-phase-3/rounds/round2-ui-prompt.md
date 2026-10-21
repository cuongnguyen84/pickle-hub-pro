# PROMPT KỸ THUẬT — CODER B · Shop Phase 3, lát cắt UI 1 (S3 + S4)

Worktree: `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-phase-3`. Mọi đường dẫn dưới đây tương đối với gốc đó; khi thao tác hãy dùng đường dẫn tuyệt đối.
**Không commit, không push, không áp migration, không chạy `supabase db reset`.**

## 0. Đọc trước khi viết dòng code nào

1. `docs/build-feature/shop-phase-3/03-ux-spec.md` — nguồn thiết kế. Bắt buộc: §2 (user flow), §3 (hợp đồng 8 trạng thái cho MỌI nút và ô nhập), §4.0 (PDP), §4.1 (toast), §4.2 (badge giỏ), §4.3 (giỏ), §4.4 (checkout), §4.5 (chi tiết đơn), §5 (component/hook được phép tạo), §6 (microcopy + chuỗi cấm), §7 (4 khối CSS mới), §8 (responsive + a11y), §10 (checklist).
2. `docs/build-feature/shop-phase-3/02-final-analysis.md` — §C (bẫy gate bundle), §D (quyết định sản phẩm D1–D10), §G (chữ bị bỏ/sửa), §I (đóng gói).
3. `docs/build-feature/shop-phase-3/rounds/round1-coder-report.md` §B — hợp đồng API thật của 3 RPC (đã tóm ở §3 dưới, nhưng đọc bản gốc để không đoán).
4. Khuôn code phải bám: `src/hooks/shop/useSellerProducts.ts`, `src/hooks/shop/usePublicShop.ts`, `src/integrations/supabase/shop-client.ts`, `src/pages/shop/ProductDetail.tsx`, `src/pages/shop/SellerProducts.tsx`, `src/lib/shop/publicCatalog.ts`, `src/lib/shop/contactCta.ts`, `src/lib/shop/orderState.ts`, `src/hooks/useConfirm.tsx`, `src/styles/shop.css`, `src/App.tsx`.

Spec thắng mọi suy diễn. Chỗ nào spec và đề bài này mâu thuẫn thì hỏi lại trong báo cáo, đừng tự chọn.

## 1. Phạm vi

Làm: **S3** (hook giỏ + `/shop/cart` + nút "Thêm vào giỏ" trên PDP + badge giỏ) và **S4** (`/shop/checkout/:shopSlug` + `/shop/order/:code`, trong đó màn "đặt xong" B10 **gộp** vào `/shop/order/:code` bằng `location.state.justPlaced` — không tạo route riêng). Cộng: noindex + robots + MIRRORED + route-snapshot + route inventory + map lỗi RPC.

**Không làm vòng này:** `/shop/orders` (danh sách đơn), `/seller/orders`, `/seller/orders/:code`, wishlist, đánh giá, trả hàng, khiếu nại. **Không được tạo link tới `/shop/orders`** ở bất kỳ đâu (route chưa tồn tại → rơi vào NotFound). Chỗ nào spec bảo đặt nút "Xem đơn của tôi" thì thay bằng link `/shop` hoặc bỏ, và ghi vào báo cáo.

## 2. Sở hữu file — CODER A ĐANG CHẠY SONG SONG

**Được sửa/tạo:** `src/pages/shop/**`, `src/components/shop/**`, `src/hooks/shop/**`, `src/lib/shop/errors.ts`, `src/lib/shop/orderFormat.ts` (mới), `src/lib/shop/contactCta.ts`, `src/integrations/supabase/shop-schema.ts`, `src/App.tsx`, `src/styles/shop.css`, `src/routes/__tests__/route-snapshot.json`, `src/routes/__tests__/route-snapshot.test.ts`, `scripts/qa/p2b-routes.mjs`, `functions/_middleware.ts`, `functions/robots.txt.ts`, `public/robots.txt`, và test đi kèm.

**CẤM đụng (coder A giữ):** `supabase/**` (mọi migration, mọi file `.test.sql`), `scripts/qa/db-race.mjs`, `src/lib/__tests__/shop-schema-parity.test.ts`, `src/lib/shop/orderState.ts`, `src/lib/shop/__tests__/orderState.test.ts`.
`orderState.ts` đã có sẵn máy trạng thái + nhãn — chỉ import. Nếu thiếu nhãn/hàm, **khai tạm trong file màn hình** và ghi vào báo cáo để chuyển cho coder A; tuyệt đối không sửa file đó.

## 3. Hợp đồng API (đã có thật, pgTAP xanh — bám đúng, không đoán)

Gọi RPC qua `shopRpc<T>(fn, args)` (`src/integrations/supabase/shop-client.ts`) — nó ném nguyên lỗi PostgREST `{ code, message, details, hint }`. Bảng qua `shopFrom<T>("shop_cart_items")` — helper này **không có `upsert`**, chỉ `select/insert/update/eq/in/order/limit/single/maybeSingle`.

```
shop_cart_view()  -> jsonb   (không tham số, đọc auth.uid())
[ { shop: { slug, name, state, ordering_enabled, shipping_fee_vnd },
    lines: [ { cart_item_id, variant_id, qty, product_id, product_slug, product_title,
               option_values, sku, unit_price_vnd, line_total_vnd, stock_on_hand,
               cover, unavailable_reason } ] } ]
unavailable_reason ∈ null | 'variant_retired' | 'shop_inactive' | 'product_unavailable'
                   | 'ordering_disabled' | 'out_of_stock'
KHÔNG có price_changed, KHÔNG có giá tham chiếu, nhóm shop KHÔNG có id (chỉ slug).

shop_order_create(_client_token text, _payment_method 'cod'|'bank_transfer',
  _recipient_name text, _recipient_phone text, _shipping_address text,
  _delivery_note text, _expected_shipping_fee_vnd integer,
  _items jsonb [{variant_id, qty, expected_unit_price_vnd}]) -> jsonb
Không tham số nào có DEFAULT → phải gửi đủ 8, kể cả `_delivery_note: null`.
Không gửi shop_id, không gửi tổng tiền.

shop_order_transition(_order_id uuid, _action 'confirm'|'ship'|'deliver'|'cancel',
  _expected_status text, _reason text, _tracking_code text) -> jsonb
Người mua chỉ dùng 'cancel' (khi pending) và 'deliver' (khi shipped).
```

Payload đơn trả về: `{ id, code, status, payment_method, recipient_name, recipient_phone, shipping_address, delivery_note, items_total_vnd, shipping_fee_vnd, total_vnd, confirm_due_at, tracking_code, cancel_reason, created_at, updated_at, shop:{slug,name,state}, items:[…], events:[…] }`. **Không có** `buyer_user_id`, **không có** `client_token`.

Bảng `shop_cart_items`: UNIQUE `(user_id, variant_id)`, CHECK `qty BETWEEN 1 AND 10`, `user_id` DEFAULT `auth.uid()`, GRANT INSERT **chỉ** `(variant_id, qty)`, GRANT UPDATE **chỉ** `(qty)`, GRANT DELETE đầy đủ. Gửi cột khác ⇒ 42501. Thêm cùng variant lần hai = đọc dòng cũ rồi `update({qty})`, không có thì `insert({variant_id, qty})`.

### Hai dependency đã biết — KHÔNG tự viết SQL để chữa

- **Đọc đơn theo `code`:** chưa có RPC. Thử đọc bằng PostgREST trên `shop_orders` (`code=eq.<code>`) + `shop_order_items` + `shop_order_events`, **liệt kê cột tường minh** đúng payload trên (`select("*")` sẽ 42501). Nếu vẫn không đọc được: dùng payload `shop_order_create` trả về để render màn `justPlaced`, còn khi F5 thì hiện trạng thái lỗi tải có nút "Thử lại", và ghi vào báo cáo: *"dependency coder A: cần `shop_order_by_code(text)` GRANT cho authenticated"*.
- **PDP không biết shop có bán không:** `shop_public_product` / `product_public_projection` **không** trả `ordering_enabled` / `shipping_fee_vnd`. Khai type `shop.ordering_enabled?: boolean`, quy ước `=== false` ⇒ tạm ngưng, `undefined` ⇒ đang bán, kèm comment `// ponytail: chờ coder A mở ordering_enabled trong product_public_projection`. Ghi vào báo cáo. Giỏ và checkout không bị ảnh hưởng.

### Bảng mã lỗi — `reason` nằm trong DETAIL, tức `error.details` (chuỗi JSON)

| SQLSTATE | reason | dữ liệu kèm |
|---|---|---|
| PT409 | `price_changed` | `variant_id, expected, current` |
| PT409 | `shipping_fee_changed` | `expected, current` |
| PT409 | `insufficient_stock` | `variant_id, requested, available` |
| PT409 | `variant_unavailable` / `product_unavailable` | `variant_id` |
| PT409 | `stale_status` | `expected, current` |
| PT403 | `ordering_disabled` / `shop_inactive` | `shop_id` |
| PT429 | `too_many_pending` | `limit, current` |
| 42501 | `forbidden` | — |
| 22023 | `invalid_payload` | `field` |

Trong `src/lib/shop/errors.ts`: **giữ nguyên** `shopErrorMessage` và `isConflict` (đang có consumer khác), **thêm** hàm đọc `reason` từ `error.details` (`JSON.parse` trong `try/catch`, details không phải JSON ⇒ `null`) + bảng map `reason → câu tiếng Việt` theo microcopy §4.4 của spec. Reason lạ ⇒ câu mặc định, không lộ chuỗi kỹ thuật.

`price_changed` / `shipping_fee_changed` / `insufficient_stock` **không được chỉ toast**: hiện khối `role="alert"` nói rõ dòng nào + từ bao nhiêu sang bao nhiêu, cập nhật giá/phí/tổng đang hiển thị, và **reset nút đặt hàng về trạng thái chưa bấm để người dùng xác nhận lại**.

## 4. File phải tạo/sửa

**Tạo:**
- `src/pages/shop/Cart.tsx`, `src/pages/shop/Checkout.tsx`, `src/pages/shop/OrderDetail.tsx`
- `src/components/shop/CartLink.tsx` — chứa **cả** `ShopCartLink` (badge) và `CartAddedToast`. Không đặt vào `ShopShell.tsx` (file đó kéo theo `SellerShell`/`AdminShopFrame` vào chunk người mua).
- `src/components/shop/OrderStatusLine.tsx`, `src/components/shop/OrderMoneyRows.tsx`, `src/components/shop/OrderTimeline.tsx`
- `src/hooks/shop/useCart.ts` (`useCartCount`, `useCartView`, `useCartMutations`), `src/hooks/shop/useOrders.ts` (`useOrder(code)`, `useOrderCreate`, `useOrderTransition`)
- `src/lib/shop/orderFormat.ts` — `shippingLabel(fee)` (0 ⇒ `"Miễn phí"`, dương ⇒ `formatVnd`, **không bao giờ** `0₫` hay `—`), `telHref(phone)` (`null` nếu không khớp `^0\d{9}$`)
- Test: `src/lib/shop/__tests__/orderFormat.test.ts`, `src/lib/shop/__tests__/errors.reason.test.ts`, ít nhất 1 test component cho giỏ hoặc checkout (file `.tsx` phải mở đầu bằng `/** @vitest-environment jsdom */` — vitest chạy `environment: "node"` mặc định).

**Sửa:** `src/pages/shop/ProductDetail.tsx` (khối `.tl-pdp-cta` ~dòng 274–309 theo §4.0), `ShopHome.tsx`/`ShopStore.tsx`/`ShopSearch.tsx`/`ShopCategory.tsx` (chèn `.tl-shop-topline` chứa `ShopCartLink`), `src/styles/shop.css` (đúng 4 khối §7), `src/integrations/supabase/shop-schema.ts`, `src/App.tsx`, `src/routes/__tests__/route-snapshot.json` + `.test.ts`, `scripts/qa/p2b-routes.mjs`, `functions/_middleware.ts`, `functions/robots.txt.ts`, `public/robots.txt`, `src/lib/shop/errors.ts`.

Mọi lời gọi Supabase nằm trong hook (luật kiến trúc của repo), không nằm trong JSX. Query key lồng `["shop","cart",…]` / `["shop","order",code]`, có `staleTime`, có `refetch` để nút "Thử lại" dùng.

## 5. Ràng buộc và bẫy

1. **Gate bundle**: `scripts/check-bundle-size.mjs` fail build nếu artifact chứa `tl-proto-banner`, `Bản mẫu — dữ liệu giả lập`, `Shop bị tạm ngưng`, `pickle-gear-sai-gon`. Câu đúng phải dùng là **"Shop đang tạm ngưng bán."**. Ngân sách gz: INITIAL 280 KB, CODE 1800 KB, CONTENT 600 KB. Cấm nới ngân sách hay sửa script để qua gate.
2. **Cấm import bất cứ thứ gì từ `src/proto/`** (có test chặn). Cấm thêm dependency mới. Cấm file CSS mới, cấm hex thô. Icon lấy từ `lucide-react`.
3. **Badge giỏ không được nhét vào `tl-nav` của `TheLineLayout`** (sẽ hiện trên /live, /feed, /blog) và **không thêm mục thứ 6 vào bottom nav**. Đặt trong `div.tl-shop-topline` cùng hàng breadcrumb của từng trang mua; ở `/shop` thì căn phải phía trên `.tl-shop-herocard`. Badge đếm **tổng qty**, >99 hiện `99+`, ẩn hoàn toàn khi chưa đăng nhập, lỗi query ⇒ không render badge.
4. **Idempotency**: `crypto.randomUUID()` (đã polyfill toàn cục ở `src/main.tsx`), sinh **một lần cho mỗi lần đặt hàng của một shop**, lưu `sessionStorage` khoá `shop.checkout.token.<shopSlug>`. **F5 giữa chừng phải dùng lại đúng token đó**. Xoá khoá ngay sau khi tạo đơn thành công (kể cả khi RPC trả về đơn cũ do trùng token).
5. **Nút đặt đơn**: bấm lần đầu ⇒ khoá + `aria-busy="true"` + nhãn "Đang gửi đơn…", **không tự mở lại**; chỉ mở lại khi có lỗi trả về (nhãn "Thử lại · <tổng>"). Thành công ⇒ `navigate('/shop/order/'+code, { replace: true, state: { justPlaced: true } })`; sau đó invalidate giỏ.
6. **Chưa đăng nhập bấm Thêm vào giỏ** ⇒ `navigate(getLoginUrl(pathname + search))` (`src/lib/auth-config.ts`). Không lưu (variant, qty) qua sessionStorage — có chủ đích.
7. **Xoá món khỏi giỏ**: optimistic + "Hoàn tác" 10 giây trong `role="status" aria-live="polite"`, **không** `useConfirm`. Ngược lại **huỷ đơn** và **"Tôi đã nhận hàng"** phải qua `useConfirm()`.
8. **Nút disabled luôn kèm câu giải thích cạnh nút** (không `title`, không disabled câm). Đủ 8 trạng thái §3.1 cho mọi nút bất đồng bộ.
9. **noindex**: thêm 3 pattern vào `NOINDEX_PATTERNS` trong `functions/_middleware.ts` — `/^\/(?:vi\/)?shop\/cart(?:\/|$)/`, `/^\/(?:vi\/)?shop\/checkout(?:\/|$)/`, `/^\/(?:vi\/)?shop\/order(?:\/|$)/`. **KHÔNG** thêm vào `SHOP_PUBLIC_PATTERNS`. Thêm `Disallow` tương ứng (cả bản `/vi`) vào `public/robots.txt` và `functions/robots.txt.ts`. Mỗi trang mới đặt `<DynamicMeta noindex />`.
10. **Route — 3 chỗ phải sửa cùng lúc, nếu không test đỏ:**
    - `src/App.tsx`: 3 trang lazy bằng `lazyRetry(() => import("./pages/shop/Cart"))` …; thêm vào mảng `MIRRORED`, mỗi entry **đúng một dòng** (parser test đọc từng dòng, xuống dòng là fail).
    - `src/routes/__tests__/route-snapshot.json`: thêm cả bản EN và bản `/vi/...` bọc `<ViLanguageWrapper>`; sửa số cứng `expect(mirrored.length).toBe(66)` → `69` kèm comment.
    - `scripts/qa/p2b-routes.mjs`: thêm entry `SHOP_ROUTES` cho từng route mới (`key`, `pattern`, `audience: "buyer"`, `path`, `auth: "auth"`, `aal: "aal1"`, `noindex: true`, `h1`, `marker`, `rpcs`, `states`, `mirrored: true`).
11. **CSS**: thêm đúng 4 khối vào cuối `src/styles/shop.css` — `.tl-shop-btn[aria-busy="true"]:disabled`, `.tl-shop-row`, `.tl-shop-toast` (+ `@media (prefers-reduced-motion: reduce)` riêng cho toast), `.tl-shop-topline`. Mọi class khác spec nhắc tới **đã có sẵn** — cấm định nghĩa lại. Không thêm `:hover` trần (phải bọc `@media (hover: hover)`).
12. **Chữ**: giao diện Shop hiện chỉ tiếng Việt (không import `useI18n`) — giữ khuôn đó, dán bản EN của mỗi chuỗi vào comment ngay trên hằng số copy. Xưng "anh/chị", không emoji, không dấu chấm than. **Cấm** các chuỗi: "Shop bị tạm ngưng", "Đã hoàn tiền", "Chưa thanh toán" (COD phải viết "Trả khi nhận hàng"), "email xác nhận", "đối soát sao kê", mọi nhắc VietQR / khiếu nại / đánh giá / wishlist / "Đã lưu", mọi lời hứa ngày giao, mọi đếm ngược phía người mua.
13. **Tái dùng, không viết lại**: `formatVnd`, `publicMediaUrl`, `mediaBox` (`publicCatalog.ts`); `usableContacts`, `contactHref`, `CONTACT_LABEL` (`contactCta.ts` — nút liên hệ shop phải hiện ở **mọi** trạng thái đơn); `LoadingState`/`ErrorState` (`PageStates.tsx`); `TheLineLayout`; `DynamicMeta`; `RequireAuth`.
14. Phí ship 0 ⇒ **"Miễn phí"** ở mọi nơi.

## 6. Acceptance criteria (mỗi mục có cách kiểm)

1. `npm run lint` → exit 0, **0 error** (30 warning `react-refresh` sẵn có trong `src/proto/**` được phép).
2. `npm run test` → exit 0, toàn bộ suite. Ghi số file/test pass thật.
3. `npx vitest run src/routes/__tests__/route-snapshot.test.ts` → exit 0, snapshot đủ 3 route EN + 3 route `/vi`.
4. `npx vitest run scripts/qa/route-inventory.test.mjs` → exit 0. *(File vitest, đừng chạy bằng `node --test`.)*
5. `npm run build` → exit 0.
6. `node scripts/check-bundle-size.mjs` (sau build) → exit 0.
7. `grep -r "Shop bị tạm ngưng" dist/` và `grep -rE "tl-proto-banner|pickle-gear-sai-gon" dist/` → rỗng.
8. `grep -rn "src/proto" src/pages/shop src/components/shop src/hooks/shop` → rỗng.
9. Test `orderFormat.ts`: `shippingLabel(0) === "Miễn phí"`; `shippingLabel(30000) === formatVnd(30000)`; không bao giờ trả `"0₫"`/`"—"`.
10. Test `telHref`: `"0912345678"` → `"tel:0912345678"`; `"+84912345678"`, `"091234567"`, `""` → `null`.
11. Test map reason: đủ 11 reason ra 11 câu phân biệt; `details` không phải JSON không throw; reason lạ ra câu mặc định; `shopErrorMessage`/`isConflict` cũ vẫn xanh.
12. Trình duyệt: thêm vào giỏ ⇒ badge tăng đúng **tổng qty**, toast "Đã thêm vào giỏ" có nút "Xem giỏ", tự ẩn sau 6 giây.
13. Đặt đơn thành công ⇒ URL `/shop/order/<code>` có khối "Đã gửi đơn tới người bán"; Back không quay lại checkout; nhóm giỏ shop đó rỗng, shop khác nguyên vẹn.
14. F5 giữa checkout rồi bấm đặt, và bấm nhanh 2 lần ⇒ **đúng 1 đơn** (đếm bằng SQL).
15. `ordering_enabled=false` ⇒ PDP, giỏ, checkout đều không có đường đặt hàng, hiện đúng "Shop đang tạm ngưng bán.", nút liên hệ shop vẫn còn.
16. Conflict giá/phí/tồn ⇒ có `role="alert"` nêu số cũ → số mới, tổng cập nhật, nút đặt reset, **chưa có đơn nào được tạo** (đếm bằng SQL).
17. Không cuộn ngang ở 320/375/414/768/1440 trên cả 3 trang.
18. `git status --short` + `git diff --name-only` ⇒ **không** có file nào dưới `supabase/**`, `scripts/qa/db-race.mjs`, `src/lib/shop/orderState.ts`, `src/lib/shop/__tests__/orderState.test.ts`, `src/lib/__tests__/shop-schema-parity.test.ts`.

## 7. Báo cáo cuối (bắt buộc)

(a) danh sách file tạo / file sửa; (b) mô tả ngắn cách làm thật; (c) từng lệnh đã chạy + exit code + output thật; (d) đối chiếu từng acceptance 1–18 đạt/không đạt kèm bằng chứng; (e) danh sách dependency phải nhờ coder A (tối thiểu: RPC đọc đơn theo `code`; `ordering_enabled` trong projection PDP; nhãn/hàm thiếu ở `orderState.ts`); (f) việc còn treo; (g) xác nhận không commit, không push, không áp migration. **Không báo "pass" cho mục chưa thực sự chạy.**

---

# TEST CASE CHO AGENT TESTER (Chrome MCP)

**Chuẩn bị môi trường (chạy một lần, trước mọi case):**

1. Stack Supabase local đang chạy bằng Docker (container `supabase_db_ajvlcamxemgbxduhiqrl`), migration Phase 3 đã áp. Migration **chưa** lên production, nên dev server phải trỏ local: tạo `.env.local`:
   ```
   VITE_SUPABASE_URL=http://127.0.0.1:54321
   VITE_SUPABASE_PUBLISHABLE_KEY=<hằng ANON trong scripts/qa/seller-qa-kit.mjs>
   VITE_SUPABASE_PROJECT_ID=ajvlcamxemgbxduhiqrl
   ```
   Vite ưu tiên `.env.local` hơn `.env`. **Khởi động lại `npm run dev` sau khi tạo file** (thiếu env, app treo ở "Loading…").
2. `node scripts/shop-p2b-fixture.mjs up` — in ra tài khoản (mật khẩu chung `QaP2b!2026`, dùng dòng "Người mua đã đăng nhập") và URL PDP/shop thật. Ghi lại slug shop và slug sản phẩm.
3. Bật bán cho shop fixture (mặc định `ordering_enabled = false`):
   ```
   docker exec supabase_db_ajvlcamxemgbxduhiqrl psql -U postgres -d postgres -c "UPDATE shops SET ordering_enabled = true, shipping_fee_vnd = 30000 WHERE slug='<slug-shop>';"
   ```
4. `npm run dev` → http://localhost:8080. Sau khi xong tất cả: `node scripts/shop-p2b-fixture.mjs down`.

**Lưu ý cho tester:** không dựa vào việc chạy JavaScript trong trang. Kiểm cuộn ngang bằng resize viewport + chụp màn hình + cuộn thử sang phải bằng thao tác. Mọi kiểm chứng dữ liệu dùng `docker exec … psql`.

### TC01 — Thêm vào giỏ ở 375px
Tiền đề: đăng nhập người mua; shop đang bán. URL: PDP fixture.
Bước: (1) viewport 375px; (2) ghi số trên badge giỏ (ẩn = 0); (3) chọn phiên bản còn hàng, số lượng 1; (4) bấm "Thêm vào giỏ"; (5) quan sát toast và badge; (6) bấm "Xem giỏ"; (7) quay lại PDP, thêm lần nữa và chờ >6 giây không thao tác.
Kỳ vọng: badge tăng đúng 1 mỗi lần; toast "Đã thêm vào giỏ" + nút "Xem giỏ"; "Xem giỏ" đi tới `/shop/cart`; toast tự ẩn sau ~6 giây; nút trở lại chữ ban đầu; không cuộn ngang; không lỗi console đỏ.

### TC02 — Đổi số lượng và chạm trần 10
Tiền đề: giỏ có 1 dòng, variant còn ≥10. URL `/shop/cart`.
Bước: (1) ghi đơn giá, số lượng, tạm tính; (2) tăng 1→2; (3) đối chiếu thành tiền dòng và tạm tính; (4) tăng dần tới 10; (5) thử tăng lần nữa.
Kỳ vọng: thành tiền = đơn giá × số lượng; tạm tính và badge cập nhật; không vượt 10; khi chạm trần có **câu giải thích nhìn thấy được** (không phải nút xám câm, không phải lỗi kỹ thuật kiểu `23514`).

### TC03 — Xoá món rồi Hoàn tác trong 10 giây
Tiền đề: giỏ có 1 dòng số lượng 3. URL `/shop/cart`.
Bước: (1) ghi variant, qty 3, tạm tính; (2) bấm "Bỏ"; (3) xác nhận dòng biến mất ngay và **không** có hộp xác nhận; (4) trong 10 giây bấm "Hoàn tác"; (5) tải lại trang.
Kỳ vọng: thông báo "Đã bỏ "<tên>" khỏi giỏ." kèm nút "Hoàn tác"; sau hoàn tác dòng trở lại đúng variant và qty 3; badge + tạm tính về giá trị cũ; sau F5 dòng vẫn còn qty 3.

### TC04 — Đặt hàng COD thành công
Tiền đề: shop bán, phí ship 30.000₫, giỏ chỉ có món hợp lệ của shop đó. URL `/shop/cart`.
Bước: (1) bấm "Đặt hàng shop này"; (2) xác nhận URL `/shop/checkout/<slug-shop>`; (3) điền họ tên, `0912345678`, địa chỉ đủ cấp, ghi chú; (4) xác nhận "Trả khi nhận hàng (COD)" chọn sẵn; (5) đối chiếu bảng tổng: tiền hàng + 30.000₫; (6) bấm nút đặt **một lần**, quan sát nhãn nút; (7) chờ điều hướng; (8) bấm Back; (9) mở lại `/shop/cart`.
Kỳ vọng: nút khoá + chữ "Đang gửi đơn…"; URL cuối `/shop/order/<code>`; có khối "Đã gửi đơn tới người bán"; đúng sản phẩm, phí 30.000₫, tổng khớp; Back **không** quay lại checkout; giỏ shop đó rỗng.

### TC05 — F5 giữa chừng + bấm 2 lần không sinh đơn thứ hai
Tiền đề: giỏ có 1 nhóm hợp lệ. Trước khi test đếm: `SELECT count(*) FROM shop_orders;`
Bước: (1) mở checkout, điền đủ form; (2) **F5**; (3) điền lại nếu form trống; (4) bấm nút đặt hai lần thật nhanh; (5) chờ tới trang đơn; (6) đếm lại.
Kỳ vọng: chỉ một mã đơn; số đơn tăng **đúng 1**; nút khoá ngay lần bấm đầu; không màn lỗi nào.

### TC06 — `ordering_enabled = false` chặn cả 3 bề mặt
Tiền đề: giỏ đã có món của shop; `UPDATE shops SET ordering_enabled=false WHERE slug='<slug-shop>';`
Bước: (1) mở PDP; (2) mở `/shop/cart`; (3) gõ thẳng `/shop/checkout/<slug-shop>`.
Kỳ vọng: cả ba nơi hiện đúng **"Shop đang tạm ngưng bán."**; không nút thêm/đặt nào bấm được; nút liên hệ shop vẫn hiện; sản phẩm **vẫn nằm trong giỏ**; không nơi nào hiện "Shop bị tạm ngưng". *(Nếu PDP vẫn hiện nút — dependency đã biết của coder A, ghi FAIL riêng cho PDP, PASS cho giỏ/checkout.)*

### TC07 — Món hết hàng chặn đặt cả nhóm
Tiền đề: bật lại `ordering_enabled=true`; `UPDATE product_variants SET stock_on_hand=0 WHERE id='<variant_id>';`
Bước: (1) tải lại `/shop/cart`; (2) xem dòng đó; (3) xem nút đặt của nhóm; (4) bấm "Bỏ khỏi giỏ".
Kỳ vọng: dòng có cảnh báo hết hàng (icon + chữ, không chỉ màu) và nút bỏ; nút đặt của nhóm bị chặn **kèm câu "Còn 1 món cần sửa trước khi đặt."**; nhóm shop khác không ảnh hưởng; sau khi bỏ, nút đặt mở lại và badge giảm đúng.

### TC08 — Khách chưa đăng nhập bấm Thêm vào giỏ
Tiền đề: đăng xuất hoàn toàn. URL: PDP fixture.
Bước: (1) ghi pathname; (2) chọn phiên bản, bấm "Thêm vào giỏ"; (3) đọc URL; (4) đăng nhập tài khoản người mua; (5) chờ chuyển hướng.
Kỳ vọng: URL dạng `/login?redirect=/shop/product/<slug>`; sau đăng nhập quay lại **đúng PDP đó**; sản phẩm **không** tự được thêm; badge đúng số món đang có.

### TC09 — Huỷ đơn `pending`
Tiền đề: có đơn `pending` vừa tạo; ghi tồn kho variant bằng SQL. URL `/shop/order/<code>`.
Bước: (1) bấm "Huỷ đơn"; (2) trong hộp xác nhận bấm "Giữ đơn"; (3) kiểm tra đơn chưa đổi; (4) mở lại, bấm "Huỷ đơn" xác nhận; (5) chờ UI cập nhật; (6) SQL: `SELECT status FROM shop_orders WHERE code='<code>';` và tồn kho variant.
Kỳ vọng: hộp xác nhận có tiêu đề "Huỷ đơn này?" và nút phá huỷ; "Giữ đơn" không đổi gì; sau khi huỷ, tiêu đề đổi thành "Đơn đã huỷ" + dòng "Anh/chị đã huỷ đơn này lúc …" nằm **trên** mọi mục khác; SQL cho `cancelled`; tồn kho hoàn lại đúng; không còn nút huỷ; nút liên hệ shop vẫn còn.

### TC10 — Giá đổi giữa chừng
Tiền đề: shop bán, giỏ có 1 variant; đếm số đơn hiện có. URL `/shop/checkout/<slug-shop>`.
Bước: (1) ghi đơn giá và tổng trên màn hình; (2) `UPDATE product_variants SET price_vnd = price_vnd + 100000 WHERE id='<variant_id>';`; (3) điền form hợp lệ; (4) bấm đặt; (5) đọc cảnh báo, đơn giá, tổng, nhãn nút; (6) đếm lại số đơn.
Kỳ vọng: khối `role="alert"` nói rõ tên món và giá cũ → giá mới; đơn giá + tổng cập nhật; nút trở về trạng thái bấm được với tổng mới; **số đơn không tăng**; bấm lại lần nữa mới tạo đơn (đúng 1).

### TC11 — Giỏ 2 shop
Tiền đề: cần shop thứ hai có sản phẩm đăng bán. Fixture có shop đối chứng (`rival`) — nếu không có sản phẩm publishable, bật bán cho nó và thêm sản phẩm bằng SQL, hoặc ghi rõ "không seed được" và báo blocked. URL `/shop/cart`.
Bước: (1) mỗi shop có ≥1 món trong giỏ; (2) đếm số nhóm; (3) xem câu giải thích; (4) đặt đơn cho shop A; (5) quay lại `/shop/cart`.
Kỳ vọng: đúng 2 nhóm, mỗi nhóm một nút đặt riêng, **không** có nút "đặt tất cả"; có câu giải thích mỗi shop là một đơn riêng (câu này phải **ẩn** khi chỉ có 1 nhóm — đối chiếu TC02); đơn shop A chỉ chứa hàng shop A; sau khi đặt, nhóm A biến mất, hàng shop B nguyên vẹn; badge = tổng qty còn lại.

### TC12 — Bố cục ở 320px và 1440px
Tiền đề: cả 3 trang ở trạng thái thành công.
Bước: với mỗi trang (`/shop/cart`, `/shop/checkout/<slug>`, `/shop/order/<code>`) ở 320px rồi 1440px: (1) chụp màn hình; (2) thử cuộn ngang; (3) tab bàn phím qua nút chính, nút icon, nút "Bỏ", nút "Hoàn tác"; (4) mở một trạng thái lỗi (ví dụ TC10) xem cảnh báo có che nút không.
Kỳ vọng: không cuộn ngang ở cả hai width; nhãn "Đặt đơn · 1.530.000₫" không bị cắt chữ (xuống 2 dòng chấp nhận); ở 1440px trang vẫn rộng 760px căn giữa; viền focus nhìn thấy trên mọi nút; nút chỉ có icon có aria-label; toast/cảnh báo không che vĩnh viễn nút chính.
