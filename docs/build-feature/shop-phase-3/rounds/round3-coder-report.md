# BÁO CÁO VÒNG 3 — CODER

## (a) File tạo / sửa

**Tạo mới:**

| File | Vai trò |
|---|---|
| `supabase/migrations/20260818120000_shop_phase3_projection_and_address.sql` | A1 + A4 + view `my_shop_orders` |
| `src/lib/shop/sellerOrders.ts` | `sortSellerOrders`, `sellerDue`, `SELLER_TODO`, `SELLER_TABS` (hàm thuần) |
| `src/lib/shop/__tests__/sellerOrders.test.ts` | 9 test cho hàm sắp xếp + hạn |
| `src/pages/shop/Orders.tsx` | S5 · `/shop/orders` |
| `src/pages/shop/SellerOrders.tsx` | S08 · `/seller/orders` |
| `src/pages/shop/SellerOrderDetail.tsx` | S09 · `/seller/orders/:code` |
| `src/pages/shop/__tests__/Checkout.conflict.test.tsx` | D-BUG1, đỏ-trước-xanh |
| `src/pages/shop/__tests__/Orders.states.test.tsx` | 12 test cho S5 |
| `src/pages/shop/__tests__/SellerOrders.states.test.tsx` | 8 test cho S08 |
| `src/pages/shop/__tests__/SellerOrderDetail.test.tsx` | 16 test jsdom cho S09 |
| `scripts/qa/order-read-jwt-probe.mjs` | A2 · probe JWT người mua thật |

**Sửa:** `useOrders.ts` · `useCart.ts` · `Cart.tsx` · `Checkout.tsx` · `OrderDetail.tsx` · `ProductDetail.tsx` · `OrderStatusLine.tsx` · `ShopShell.tsx` · `orderState.ts` · `orderFormat.ts` + 2 test · `shop-schema.ts` · `shop-schema-parity.test.ts` · `App.tsx` · `route-snapshot.json` + `.test.ts` · `shop.css` · `p2b-routes.mjs` · `functions/_middleware.ts` · `functions/robots.txt.ts` · `public/robots.txt` · `shop-pilot-seo.test.ts` · `shop_p2b_public_read.test.sql` · `shop_orders.test.sql`

## (b) Cách làm

### Phần D

**D-BUG1 — root cause thật, không phải catch block.** `App.tsx:284` đặt `mutations: { retry: 1 }` **toàn cục**. React Query v5: retryer khi sắp retry sẽ `sleep()` rồi hỏi `focusManager.isFocused()` — tab **không visible** ⇒ retryer **pause** thay vì reject, và `mutateAsync` **không bao giờ settle**. Đúng triệu chứng "đứng yên >20 giây, không console error, server đã trả 409".

Fix: `retry: false` trên `useOrderCreate` + `useOrderTransition`; vá luôn 4 mutation anh em trong `useCart.ts` (add/setQty/remove/restore) — cùng hình dạng lỗi. **Không** đụng default toàn cục (site-wide, ngoài phạm vi) — xem (h.2).

**D-BUG2.** Hàm thuần `cartLineProblem()` trong `orderFormat.ts` thay bảng `LINE_PROBLEM` cục bộ. `stock_on_hand > 0 && qty > stock_on_hand` ⇒ `Chỉ còn {n} cái. Giảm số lượng để đặt tiếp.`; `=== 0` hoặc `null` ⇒ "vừa hết hàng". 6 unit test.

### Phần A

- **A1** — migration `20260818120000`, `CREATE OR REPLACE product_public_projection` (thân copy nguyên văn từ `20260813090000` + đúng 2 khoá). Gỡ quy ước `undefined ⇒ đang bán` + comment ponytail trong `ProductDetail.tsx`; trường thành **bắt buộc**. pgTAP `shop_p2b_public_read` **65 → 72**.
- **A2** — kết luận: **không cần** `shop_order_by_code` (bằng chứng ở (f)).
- **A3** — giữ `shippingLabel`, **xoá** `shippingFeeLabel`; chuyển `ORDER_H1_BUYER` + `ORDER_NOTE_BUYER` sang `orderState.ts`. Lint **32 → 30** warning.
- **A4** — **LÀM**. RPC `shop_last_shipping_address()` + pgTAP **4 ca**. `Checkout.tsx` prefill chỉ ô trống.

**Phát sinh ngoài prompt (PO cần biết):** `/shop/orders` đọc **view mới `my_shop_orders`**, không đọc thẳng `shop_orders`. Lý do: RLS `shop_orders_select_party` cho **mọi bên** đọc (buyer OR shop member), `buyer_user_id` không được GRANT nên client **không lọc lại được** — chủ shop mở "Đơn của tôi" sẽ thấy tên/SĐT/địa chỉ **khách hàng của mình**. View đặt trong cùng migration, `WHERE buyer_user_id = auth.uid()`, **không** `security_invoker`, GRANT SELECT cho `authenticated`/`service_role`. Đã verify PostgREST embed được từ view → HTTP 200. Có test parity mới (`SHOP_P3_VIEWS`).

### Phần B — `/shop/orders`
`RequireAuth` + noindex + `.tl-shop-page--narrow`. Hook `useMyOrders()` một request lấy cả tập (cap 200, có comment ponytail nêu trần); tab/đếm/tìm/phân trang client-side để 4 con số luôn khớp. 4 tab `role="tab"`, thẻ `.tl-shop-card` **không pill**, `[Tôi đã nhận hàng]` là **link** về `/shop/order/:code`. Hai empty khác nhau, loading 4 skeleton, lỗi + `[Thử lại]`, `[Xem thêm]` +10.
`OrderDetail.tsx` "Về trang chợ" → **`Xem đơn của tôi` → `/shop/orders`**. Các `to="/shop"` còn lại đều là breadcrumb/CTA đúng chỗ.

### Phần C — `/seller/orders` + chi tiết
`SELLER_NAV.orders.ready` → `true`. Khuôn `SellerProducts.tsx`: `<table>` `[data-desktop-only]`, `<ul>` `[data-mobile-only]`, **không** `style={{display}}` (có test khẳng định `style.display === ""`).
Sắp xếp tách ra `sellerOrders.ts`. **Rút gọn có chủ ý:** quy tắc 1+2 gộp thành một phép so sánh — mọi `pending` lên trước, sắp `confirm_due_at` tăng dần; vì quá hạn nghĩa là `due < now` nên nhóm quá hạn tự nằm trên. Kết quả **giống hệt** spec.
Hạn chỉ ở `pending`; quá hạn → class mới `.tl-shop-overdue` + `<AlertTriangle>` + chữ. Có test regex chặn `tự huỷ|tự động huỷ|quản trị viên`.
S09: transition truyền `_expected_status` đang hiển thị; mã vận đơn không bắt buộc; form lý do dùng `<textarea>` + focus tự động + nút disabled kèm câu giải thích; `[Gọi người mua]` chỉ khi `telHref` khác null; `[Sao chép địa chỉ giao]` qua `addressForClipboard()`, nhãn 2 giây + `role="status"`; `stale_status` → notice warn + refetch.

### Đóng gói
`NOINDEX_PATTERNS` + `Disallow` 2 file robots · 3 route `lazyRetry` · 1 entry `MIRRORED` cho `/shop/orders` (seller routes vốn không mirror) · snapshot +4 entry, số cứng **69 → 70** · `p2b-routes.mjs` 3 entry mới · class CSS mới **duy nhất** `.tl-shop-overdue` dùng token, không hex thô.

## (c) Lệnh + output

```
$ npx supabase db reset
Applying migration 20260818120000_shop_phase3_projection_and_address.sql...
{"target":"local","version":"","message":"Reset local database."}

$ npx supabase test db --local supabase/tests
All tests successful.
Files=47, Tests=1618,  2 wallclock secs
Result: PASS

$ PATH=… node scripts/qa/db-race.mjs                    → EXIT=0   All 225 race assertions passed.
$ npm run lint                                          → EXIT=0   ✖ 30 problems (0 errors, 30 warnings)
$ npm run test                                          → EXIT=0   200 passed (200) · 3053 passed | 10 skipped
$ npm run build                                         → EXIT=0   ✓ built in 5.23s
$ node scripts/check-bundle-size.mjs                    → EXIT=0
  INITIAL gz 227.6 / 280 · CODE gz 1602.9 / 1800 · CONTENT gz 405.6 / 600
$ npx vitest run src/routes/__tests__/route-snapshot.test.ts   → EXIT=0  (4 passed)
$ npx vitest run scripts/qa/route-inventory.test.mjs           → EXIT=0  (30 passed)
```

Grep chuỗi cấm sau build: `Shop bị tạm ngưng` · `Đã hoàn tiền` · `email xác nhận` · `đối soát sao kê` → **rỗng**.
`Chưa thanh toán` → còn ở `locale-vi-*.js` và `SocialEventRoster-*.js` — **không thuộc Shop** (`src/pages/SocialEventRoster.tsx:536`, `src/i18n/vi.ts:4968,5796`), có từ trước. Quét riêng các chunk Shop (`Orders-*`, `SellerOrder*`, `Cart-*`, `Checkout-*`, `OrderDetail-*`): **không khớp file nào**.
`grep -rn "src/proto" src/pages/shop src/components/shop src/hooks/shop src/lib/shop` → rỗng.

## (d) A35–A54

| # | Kết quả | Bằng chứng |
|---|---|---|
| A35 | ĐẠT | projection trả 2 khoá mới; `shop_p2b_public_read` plan 65 → 72; tổng pgTAP 1607 → 1618 |
| A36 | ĐẠT | (f) — HTTP 200, đủ `shop`/`items`/`events`, người ngoài `data: null` |
| A37 | ĐẠT | `shop_last_shipping_address()` + **4** ca pgTAP (yêu cầu 3); prefill chỉ ô trống |
| A38 | ĐẠT | chỉ còn `shippingLabel`; 2 hằng ở `orderState.ts:163,181`; lint 30/0 |
| A39 | ĐẠT | `Orders.states.test.tsx` 12 test; link tạm đã nối |
| A40 | ĐẠT | `SellerOrders.states.test.tsx` 8 test (3 empty, 2 notice, `style.display === ""` cả 2 khối, quá hạn đứng đầu ở cả bảng và thẻ) |
| A41 | ĐẠT | (e.2) |
| A42 | ĐẠT | `expectedStatus` đúng (2 ca), lý do bắt buộc, `[Đã gửi hàng]` chạy với mã rỗng, `stale_status` → notice + nút về default |
| A43 | ĐẠT | `href="tel:0912345678"`; `+84…` ⇒ không link; clipboard đúng 4 dòng (bỏ dòng ghi chú khi không có); nhãn 2 giây (fake timers) + `role="status"`; nhánh clipboard bị chặn |
| A44 | ĐẠT | `ShopShell.tsx:82` `ready: true` |
| A45 | ĐẠT | cả hai exit 0; `mirrored.length` 70 |
| A46 | ĐẠT | gọi `shouldNoindex()` **thật** cho 4 path (kể cả khi `SHOP_PUBLIC_INDEXING=1`) + `isPilotNoindexShopPath("/shop/orders") === false`; robots 2 file |
| A47 | **ĐẠT MỘT PHẦN** | 4/5 chuỗi rỗng. `Chưa thanh toán` còn 2 file **ngoài Shop**, có từ trước. Chunk Shop sạch cả 5 |
| A48 | **ĐẠT MỘT PHẦN** | `shop_order_json`/`actor_user_id` chỉ trong comment. `.select("*")` còn ở `useShopProfile`/`useSellerApplication`/`useShopApplicationQueue`/`useProductMedia` — trên `shops`/`shop_applications`/`product_media`, **không phải 3 bảng đơn**. Quy tắc thật không bị vi phạm |
| A49 | ĐẠT | lint 0 error; **200 file / 3053 pass / 10 skip** (vòng 2: 195/2991) |
| A50 | ĐẠT | INITIAL 227.6 · CODE 1602.9 · CONTENT 405.6 |
| A51 | ĐẠT | 225/225, không regression |
| A52 | ĐẠT | (i) |
| A53 | ĐẠT | (e.1) |
| A54 | ĐẠT | `cartLineProblem()` + 6 unit test |

## (e) Đỏ trước — xanh sau

### E.1 · D-BUG1 (A53)
Bỏ `retry: false` khỏi `useOrderCreate`, chạy **cùng file test cuối cùng**:
```
     × says which price changed, in a live region 3089ms
     × gives the button back instead of leaving it at Đang gửi đơn… 3025ms
     × does not send the order a second time — a conflict is an answer, not a blip 3024ms
TestingLibraryElementError: Unable to find role="alert"
 Test Files  1 failed (1) · Tests  3 failed (3)
```
DOM lúc đỏ — **đúng triệu chứng production**:
```html
<button aria-busy="true" class="tl-shop-btn tl-shop-btn--primary tl-shop-btn--block" disabled="" type="button">
  <svg class="lucide lucide-loader-circle animate-spin" …/>
  Đang gửi đơn…
</button>
```
Khôi phục `retry: false` → `Test Files 1 passed (1) · Tests 3 passed (3)`.

### E.2 · Hàm sắp xếp (A41)
Tạm phá thành sắp thuần `created_at DESC`:
```
AssertionError: expected [ 'D', 'C', 'B', 'A' ] to deeply equal [ 'A', 'B', 'C', 'D' ]
AssertionError: expected 'SHIPPED-TODAY' to be 'PENDING-LAST-WEEK'
 Test Files  1 failed (1) · Tests  2 failed | 7 passed (9)
```
Đỏ vì **thứ tự thật sai**, không vì đổi tên. Khôi phục → 9 passed (9).

## (f) A2 — verify JWT người mua thật

Chuỗi select **trích thẳng từ `src/hooks/shop/useOrders.ts`** bằng regex trên source (không gõ lại) ⇒ đúng câu hook thật sự gửi.

```
── buyer JWT ──
HTTP 200 · error: null
data: { "code": "PH-2608-BE5A", "status": "pending", "payment_method": "cod",
        "recipient_name": "Nguyễn Kiểm Thử", "recipient_phone": "0912345678",
        "total_vnd": 1480000, "shop": {…}, "items": [1 dòng], "events": [1 dòng] }

── outsider JWT ──
HTTP 200 · error: null · data: null

PASS — the hook's select works with a real buyer JWT   EXIT=0
```

**Kết luận: KHÔNG cần `shop_order_by_code`.** Người mua nhận 200 đủ dữ liệu, không 42501, không thiếu cột; người ngoài nhận `data: null` **không kèm lỗi** — đúng "giống hệt đơn không tồn tại". Thêm một RPC + pgTAP + đường cache thứ hai để đạt cùng kết quả là code không mua thêm gì.

Điều chỉnh so với dự đoán: event `create` **không** mang `metadata.actor_kind` (chỉ event transition mới có — `20260818100000:1148`). Assertion đã sửa cho đúng thực tế, thay bằng kiểm `actor_user_id` **không** lọt về client.

## (g) Quyết định A4
**LÀM.** pgTAP có assertion `chủ shop Đơn A đọc được cả ba đơn trên nhưng vẫn không được điền sẵn địa chỉ của khách` — sẽ đỏ nếu hàm lọc theo "đơn tôi là một bên" thay vì `buyer_user_id`.

## (h) Còn treo / cần PO quyết

1. **Chưa test trình duyệt** — 11 TC Chrome MCP là việc của `tester`.
2. **`mutations: { retry: 1 }` toàn cục trong `App.tsx:284` vẫn còn.** Cùng cơ chế pause-khi-tab-ẩn áp cho **mọi** mutation trong app (like, admin, tournament…). Chỉ vá 6 mutation Shop vì đổi default là site-wide. **Đề nghị mở task riêng.**
3. **D-BUG3** — cuộn ngang ~39px, site-wide sẵn có, **không đụng** theo chỉ thị.
4. **Ảnh 56px trên thẻ `/shop/orders` là monogram shop, không phải ảnh sản phẩm.** `shop_order_items` snapshot title/giá chứ không snapshot ảnh; lấy cover thật cần thêm vòng query qua `product_media` (chưa có GRANT/đường public cho danh sách). `ShopMonogram` = 0 query. Muốn ảnh thật thì cần quyết định về read model, không phải một dòng CSS.
5. **Cap 200 đơn/màn** cho cả hai danh sách; đếm tab "thật" trong phạm vi 200. Có comment `ponytail:` nêu trần và đường nâng cấp.
6. **View `my_shop_orders` là phát sinh ngoài prompt** — xem (b). Phương án thay thế duy nhất là chấp nhận chủ shop thấy đơn của khách trong "Đơn của tôi".
7. **`Checkout` prefill gọi `shop_last_shipping_address()`** — trên production RPC **chưa tồn tại** cho tới khi PO áp migration. Query lỗi âm thầm, `prefill` = `undefined`, form trống như cũ, **không** hiện lỗi cho người dùng. Không chặn deploy nhưng cần biết.
8. **A47/A48 đạt một phần** — chuỗi và `.select("*")` còn ở code **ngoài Shop**, có từ trước. Grep trong prompt rộng hơn quy tắc thật. Không tự ý đi dọn.
9. `.env.local` giữ nguyên, chưa commit; `.gitignore:19` có `.env.*` nên **đã bị ignore sẵn**.
10. Sau `db reset` + `fixture down`, DB local đang **rỗng** — tester cần `fixture up` lại.

## (i) Xác nhận

- **Không commit, không push.** 21 file tracked đã sửa + 33 file untracked.
- **Không áp migration lên production.** Migration mới: **`20260818120000_shop_phase3_projection_and_address.sql`**. Kết thúc bằng `NOTIFY pgrst, 'reload schema'` — **không áp trong giờ livestream**. Ledger `DRIFT_STRICT=1` cần cả 4 file: `20260818090000`, `20260818100000`, `20260818110000`, `20260818120000`.
- **Không chạy `supabase gen types`.**
- `npx supabase db reset` chỉ trên stack **local**.
