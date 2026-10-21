# NHIỆM VỤ KỸ THUẬT — SHOP PHASE 3, VÒNG 3 (lát cắt cuối: S5 + S6 + trả nợ vòng 2)

Worktree: `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-phase-3`. Mọi đường dẫn dưới đây tuyệt đối.
**Không commit, không push, không áp migration lên production, không chạy `supabase gen types` (migration chưa lên prod — việc của PO).**

## 0. Đọc trước khi viết dòng nào

1. `docs/build-feature/shop-phase-3/03-ux-spec.md` — §3 (hợp đồng 8 trạng thái), §4.5 (chi tiết đơn người mua), **§4.6 (B11)**, **§4.7 (S08)**, **§4.8 (S09)**, §6 (microcopy + chuỗi cấm), §8 (responsive + a11y + noindex), §10 (checklist).
2. `docs/build-feature/shop-phase-3/02-final-analysis.md` — §C (bẫy gate bundle), §D (D1–D10), §G (chữ bị bỏ), §H (bổ sung bắt buộc), §I (đóng gói).
3. `rounds/round1-coder-report.md` §B (hợp đồng RPC), `round2-coderA-report.md` §B + §G, `round2-coderB-report.md` §(e) + §(f) — **đây là danh sách nợ mà vòng này phải trả**.
4. Khuôn code phải bám: `src/pages/shop/SellerProducts.tsx` (bảng desktop / thẻ mobile / 3 empty / loading / lỗi), `src/pages/shop/OrderDetail.tsx`, `src/hooks/shop/useOrders.ts`, `src/hooks/shop/useShopProfile.ts` (`useMyShopMembership` trả `{shop_id, role}`, role ∈ `owner|manager|fulfillment|support`), `src/lib/shop/orderState.ts`, `src/lib/shop/contactCta.ts`, `src/hooks/useConfirm.tsx`, `src/components/shop/ShopShell.tsx`.

Spec thắng mọi suy diễn. Mâu thuẫn giữa spec và đề bài này → ghi vào báo cáo, đừng tự chọn im lặng.

## 1. Hợp đồng đã có thật (pgTAP xanh) — bám đúng, cấm đoán

```
shop_cart_view() -> jsonb                                   -- GRANT authenticated
shop_order_create(_client_token, _payment_method, _recipient_name, _recipient_phone,
  _shipping_address, _delivery_note, _expected_shipping_fee_vnd, _items) -> jsonb
                                                            -- 8 tham số, KHÔNG có DEFAULT
shop_order_transition(_order_id, _action, _expected_status, _reason, _tracking_code) -> jsonb
shop_order_json(uuid) -> jsonb                              -- CHỈ service_role, client CẤM gọi
```

Payload đơn: `{id, code, status, payment_method, recipient_name, recipient_phone, shipping_address, delivery_note, items_total_vnd, shipping_fee_vnd, total_vnd, confirm_due_at, tracking_code, cancel_reason, created_at, updated_at, shop:{slug,name,state}, items:[…], events:[{id,action,from_status,to_status,metadata,created_at}]}`. **Không có** `buyer_user_id`, **không có** `client_token`.

Máy trạng thái (5 trạng thái, không có `completed`):

```
pending   --confirm(seller|admin)--------> confirmed
confirmed --ship(seller|admin)-----------> shipped
shipped   --deliver(buyer|seller|admin)--> delivered
pending   --cancel(buyer|seller|admin)---> cancelled
confirmed --cancel(seller|admin)---------> cancelled
shipped   --cancel(admin)----------------> cancelled
```

`seller` = `owner|manager|fulfillment`. **`support` không transition được gì.** Actor huỷ ≠ buyer ⇒ `_reason` bắt buộc.

Lỗi: `reason` nằm trong `error.details` (chuỗi JSON) — dùng `shopErrorReason`/`shopReasonMessage` đã có ở `src/lib/shop/errors.ts`. PT409 `price_changed|shipping_fee_changed|insufficient_stock|variant_unavailable|product_unavailable|stale_status` · PT403 `ordering_disabled|shop_inactive` · PT429 `too_many_pending` · 42501 `forbidden` · 22023 `invalid_payload`.

GRANT **theo cột** (3 bảng đơn đã `REVOKE ALL FROM anon, authenticated`):

```
shop_orders      : id, code, shop_id, status, payment_method, recipient_name, recipient_phone,
                   shipping_address, delivery_note, items_total_vnd, shipping_fee_vnd, total_vnd,
                   confirm_due_at, tracking_code, cancelled_by, cancel_reason, created_at, updated_at
shop_order_items : id, order_id, shop_id, product_id, variant_id, qty, product_title,
                   variant_label, sku, unit_price_vnd, line_total_vnd, created_at
shop_order_events: id, order_id, shop_id, from_status, to_status, action, metadata, created_at
```

⇒ `.select('*')` trên ba bảng này = **42501**. `buyer_user_id` và `shop_order_events.actor_user_id` **không** được GRANT — timeline lấy actor từ `metadata->>'actor_kind'`.
RLS SELECT: `buyer_user_id = auth.uid() OR is_shop_member(shop_id) OR is_admin()`.
`confirm_due_at` là cột thường `NOT NULL DEFAULT now() + interval '48 hours'` ⇒ **mọi đơn đều có**, chỉ **có nghĩa khi `status='pending'`**; chỉ hiện hạn ở đơn pending.

## 2. Phần A — trả nợ dependency vòng 2

**A1 · `ordering_enabled` + `shipping_fee_vnd` vào projection công khai.**
`product_public_projection(_product_id uuid, _as_seller boolean)` (bản mới nhất ở `supabase/migrations/20260813090000_shop_p2b_public_read.sql:45`) đang trả `'shop'` = `{slug, name, region, verified, shipping_note, return_note}`. Thêm hai khoá `ordering_enabled`, `shipping_fee_vnd`.
Làm bằng **migration mới** `CREATE OR REPLACE FUNCTION`, timestamp **> `20260818110000`** (ví dụ `supabase/migrations/20260818120000_shop_phase3_projection_and_address.sql`). **Cấm sửa migration cũ.** `shop_public_product(_slug)` gọi lại projection nên tự có.
Sau đó bỏ quy ước tạm ở `src/pages/shop/ProductDetail.tsx` (`undefined ⇒ đang bán`) + xoá comment `// ponytail: chờ coder A…`; đổi trường trong `src/integrations/supabase/shop-schema.ts` thành bắt buộc.
pgTAP: thêm vào `supabase/tests/shop_p2b_public_read.test.sql` (cập nhật `plan(n)`) — hai khoá tồn tại, giá trị khớp `shops`, đường public và đường `_as_seller` đều không đổi khoá cũ.

**A2 · Verify đọc đơn bằng JWT người mua thật.**
Client đang đọc bảng bằng cột tường minh + embed trong `src/hooks/shop/useOrders.ts`; vòng 2 mới chỉ verify bằng **service key** ⇒ chưa chứng minh gì về GRANT.
Bắt buộc: viết một script Node dùng `supabase-js` **đăng nhập tài khoản buyer fixture** (`node scripts/shop-p2b-fixture.mjs up`, mật khẩu `QaP2b!2026`), chạy **đúng câu select mà hook đang dùng**, in status + data. Dán output thật vào báo cáo.
- Nếu 200 và đủ dữ liệu ⇒ **giữ nguyên**, ghi kết luận "không cần `shop_order_by_code`" kèm bằng chứng.
- Nếu 42501/thiếu cột ⇒ sửa danh sách cột, hoặc thêm `shop_order_by_code(text)` `SECURITY DEFINER`, `SET search_path = public`, tự kiểm buyer/member/admin, `REVOKE ALL FROM PUBLIC` + `GRANT EXECUTE TO authenticated, service_role`, kèm pgTAP (buyer đọc được đơn mình, người ngoài nhận NULL/lỗi **giống hệt** đơn không tồn tại).
Chọn phương án ít code hơn và nói rõ vì sao. **Cấm** kết luận suông.

**A3 · Gộp trùng lặp.** `shippingFeeLabel` (`src/lib/shop/orderState.ts:155`) và `shippingLabel` (`src/lib/shop/orderFormat.ts:19`) cùng chức năng ⇒ giữ **một**, sửa hết call site. Chuyển `ORDER_H1_BUYER` và `ORDER_NOTE_BUYER` từ `src/components/shop/OrderStatusLine.tsx` sang `src/lib/shop/orderState.ts`. Kết quả phải **xoá 2 warning `react-refresh/only-export-components`** vòng 2 sinh ra (lint hiện 32 warning, sau vòng này ≤ 30).

**A4 · Prefill địa chỉ giao ở checkout, buyer-scoped.**
Không làm được thuần client: RLS cho cả shop member đọc đơn của khách mà `buyer_user_id` không được GRANT ⇒ tài khoản vừa bán vừa mua sẽ bị prefill bằng địa chỉ **khách hàng**. Phương án mặc định: RPC `shop_last_shipping_address()` trong cùng migration mới — `SECURITY DEFINER`, `SET search_path = public`, đọc `auth.uid()`, trả `jsonb {recipient_name, recipient_phone, shipping_address}` của đơn mới nhất **của chính người gọi**, `NULL` khi chưa có đơn; `REVOKE ALL FROM PUBLIC; GRANT EXECUTE TO authenticated, service_role`; pgTAP 3 ca.
`src/pages/shop/Checkout.tsx` chỉ prefill ô **đang trống**, người dùng sửa được, không ghi đè giá trị đã nhập.
Được phép **bỏ A4** nếu chứng minh chi phí không tương xứng — nhưng phải ghi rõ lý do; bỏ im lặng = chưa đạt.

## 3. Phần B — S5: `/shop/orders` (màn B11)

Route mới `RequireAuth` + `<DynamicMeta noindex />` + `TheLineLayout` + `.tl-shop-page--narrow`, file `src/pages/shop/Orders.tsx`, hook trong `src/hooks/shop/useOrders.ts` (mọi lời gọi Supabase nằm trong hook; query key lồng `["shop","orders",…]`).

Bố cục: `<h1>Đơn của tôi</h1>` → ô tìm → hàng tab `.tl-shop-cats` (cuộn ngang được ở 320px) → danh sách thẻ.
4 tab **có số đếm thật**, `role="tab"` + `aria-selected`: `all` "Tất cả" · `active` "Đang tới" (`pending|confirmed|shipped`) · `done` "Đã xong" (`delivered`) · `cancelled` "Đã huỷ".

Mỗi dòng `.tl-shop-card` (flex, gap 12): ảnh 56px · tên shop · tên món đầu + "+{n} món khác" · `{mã đơn} · {dd/MM} · {tổng}` (tabular-nums) · **câu việc-cần-làm** bằng `.tl-shop-hint` — **không dùng pill trạng thái** (pill là `nowrap`, sẽ đẩy trang ngang ở 375px):

| status | câu |
|---|---|
| pending | `Shop chưa xác nhận — chưa cần làm gì. Huỷ được nếu đổi ý.` |
| confirmed | `Người bán đang chuẩn bị hàng — chưa cần làm gì.` |
| shipped | `Đang trên đường tới anh/chị.` + `[Tôi đã nhận hàng]` **là LINK về `/shop/order/:code`**, không gọi RPC từ danh sách |
| delivered | `Đã giao xong.` |
| cancelled | `Đã huỷ{, do {ai}}.` |

Cả thẻ có **đúng một** link chính (tên món → `/shop/order/:code`), cao ≥ 44px.
Trạng thái trang: loading = 4 skeleton 92px + `aria-busy` · **hai empty khác nhau** ("Anh/chị chưa có đơn hàng nào" + "Đặt đơn đầu tiên từ chợ nhé." + `[Xem sản phẩm đang bán]` **vs** `Không có đơn nào khớp “{q}”` + `[Xoá tìm kiếm]`) · lỗi = notice danger + `[Thử lại]` với câu `Chưa tải được danh sách đơn. Đơn của anh/chị vẫn còn nguyên.` — **cấm** nhắc "email xác nhận" · phân trang `[Xem thêm ({n} đơn)]`, +10 mỗi lần.

Nối lại link "Xem đơn của tôi": `src/pages/shop/OrderDetail.tsx` màn "Không tìm thấy đơn này." đang trỏ tạm `/shop` → đổi về `/shop/orders`. Grep toàn `src/pages/shop` + `src/components/shop` xem còn chỗ tạm nào khác.

## 4. Phần C — S6: `/seller/orders` (S08) + `/seller/orders/:code` (S09)

Vỏ: `ShopScrollShell` + `SellerShell active="orders"` + `<DynamicMeta noindex />`. Bật `SELLER_NAV` mục `orders`: `ready: false` → `true` (`ShopShell.tsx:82`) — quên thì tab vẫn hiện "Sắp có". **Không** thêm badge đếm đơn lên nav.

### 4.1 `/seller/orders` — `src/pages/shop/SellerOrders.tsx`

Khuôn bám nguyên `SellerProducts.tsx`: `.tl-shop-page` 1240px · ≥768px `<table className="tl-shop-table">` trong `[data-desktop-only]` · <768px `<ul>` thẻ `[data-mobile-only]` · **cấm** `style={{display}}` inline lên hai khối đó (bug đã bị bắt ở `SellerProducts.tsx:389–393`).

Tab: `todo` "Cần xử lý" (`pending|confirmed`, **mặc định**) · `shipping` "Đang giao" (`shipped`) · `done` "Đã xong" (`delivered|cancelled`) · `all` "Tất cả".

**Sắp xếp — điểm cốt lõi của màn này** (tách thành hàm thuần `sortSellerOrders()`, **không** nằm trong file component):
1. `pending` **quá hạn** (`confirm_due_at < now()`) lên trên cùng, quá hạn lâu nhất trước;
2. rồi `pending` còn hạn theo `confirm_due_at` tăng dần;
3. rồi mọi đơn còn lại theo `created_at` giảm dần.
Sắp theo ngày đặt sẽ chôn mất đơn sắp quá hạn.

Hạn trả lời **chỉ hiện ở `pending`**: còn hạn → `.tl-shop-hint` màu `--shop-warning` + `<Clock size={11}>` + `Còn {n} giờ để trả lời`; quá hạn → viền `--shop-danger` + `<AlertTriangle size={16}>` + `Quá hạn {n} giờ` (icon + chữ + màu, không chỉ màu). **Cấm** câu ngụ ý có job tự huỷ hay "quản trị viên sẽ vào xử lý".

Cột "Việc cần làm": pending `Cần anh/chị xác nhận` · confirmed `Cần đóng gói và gửi hàng` · shipped `Đang giao — chờ người mua xác nhận` · delivered `Xong` · cancelled `Đã huỷ`.
Cột bảng desktop: Mã đơn · Việc cần làm · Hạn trả lời · Khách · Tổng · (hành động).

**Ba empty khác nhau**: tab Cần xử lý rỗng (`Không có đơn nào đang chờ anh/chị` + `Đơn mới sẽ hiện ở đây kèm hạn phải trả lời.`) · tab khác rỗng (`Không có đơn nào ở mục này`) · shop chưa từng có đơn (`Shop chưa có đơn hàng nào` + `Khi có người đặt, đơn sẽ hiện ở đây.`).
`ordering_enabled=false` ⇒ notice warn đầu trang: `Shop đang tạm ngưng bán nên không nhận đơn mới. Đơn đang có vẫn xử lý bình thường.`
Vai `support` ⇒ vẫn thấy danh sách + notice info `Vai trò support chỉ xem được đơn. Chủ shop hoặc quản lý mới xử lý đơn.` và **ẩn hết nút hành động**. `canAct = membership.role !== "support"`.
Refetch khi cửa sổ focus lại; **không polling**.

### 4.2 `/seller/orders/:code` — `src/pages/shop/SellerOrderDetail.tsx`

Dùng `:code` (không `:id`). Thứ tự: `<h1>Đơn PH-…</h1>` → sub `Đặt lúc {dd/MM HH:mm} · {Trả khi nhận hàng|Chuyển khoản trước}` → dòng hạn (nếu pending) → **khối "Việc cần làm" đặt TRƯỚC mọi thứ** → Địa chỉ giao → Sản phẩm + Tạm tính/Phí ship/Tổng → Thanh toán → Diễn biến.

Mọi transition gọi `shop_order_transition` với `_expected_status` = trạng thái đang hiển thị:

| status | nút |
|---|---|
| pending | `[Xác nhận đơn]` primary · `[Từ chối đơn]` danger (**bắt buộc lý do**) |
| confirmed | ô `Mã vận đơn` (**không bắt buộc**, hint `Có mã thì nhập để người mua tự tra. Không có cũng gửi được.`) + `[Đã gửi hàng]` primary · `[Huỷ đơn]` danger (bắt buộc lý do) |
| shipped | `[Ghi nhận đã giao]` + notice `Đơn cũng tự chuyển sang đã giao khi người mua bấm “Tôi đã nhận hàng”.` |
| delivered/cancelled | không nút + `.tl-shop-notice` `Đơn đã kết thúc. Không còn thao tác nào.` |

Nút cần lý do **không dùng `useConfirm`** (nó không có ô nhập): mở `.tl-shop-field` với `<textarea>` bắt buộc, **focus tự vào textarea**, hai nút `[Gửi từ chối]` / `[Quay lại]`; nút gửi disabled khi lý do rỗng **kèm câu cạnh nút** `Nhập lý do để người mua biết vì sao.` và dòng `Người mua sẽ đọc đúng câu này.`

Khối "Địa chỉ giao" (§H bản chốt — bắt buộc):
- `[Gọi người mua]` = `<a href="tel:…" className="tl-shop-btn tl-shop-btn--sm">` + `<Phone size={15}>`, chỉ render khi `telHref(phone)` khác `null`; không khớp `^0\d{9}$` ⇒ in số ra chữ, **không** tạo link.
- `[Sao chép địa chỉ giao]` = `<button>` + `<Copy size={14}>`, chép đúng `{tên}\n{sđt}\n{địa chỉ}\n{ghi chú nếu có}`; success → nhãn `Đã sao chép` + `<Check size={14}>` trong **2 giây** rồi về default, kèm vùng ẩn `role="status" aria-live="polite"`; clipboard bị chặn → `.tl-shop-hint` danger `Trình duyệt không cho sao chép tự động. Anh/chị bôi đen phần địa chỉ ở trên rồi copy tay.`
- Dòng cố định `Số điện thoại này chỉ hiện với shop vì có đơn hàng thật.` (**cấm** câu "SĐT chỉ hiện tới khi đơn kết thúc 30 ngày").

Thanh toán: COD → `Trả khi nhận hàng. Anh/chị thu tiền trực tiếp; ThePickleHub không giữ tiền của đơn này.` · bank_transfer → `Người mua chọn chuyển khoản trước. Anh/chị tự gửi thông tin tài khoản và tự xác nhận đã nhận tiền. ThePickleHub không nhận, không giữ và không đối soát khoản nào.` (**cấm** "đối soát sao kê").
Không tìm thấy / đơn của shop khác ⇒ **một câu duy nhất** `Không tìm thấy đơn này.` + `[Về danh sách đơn]`.
PT409 `stale_status` ⇒ `.tl-shop-notice--warn` `Đơn vừa được cập nhật ở nơi khác — có thể người mua vừa huỷ. Trang đã tải lại.` + refetch + nút về default.

## 4b. Phần D — SỬA LỖI TỪ TEST TRÌNH DUYỆT VÒNG 2 (bắt buộc, ưu tiên cao nhất)

Nguồn: `docs/build-feature/shop-phase-3/rounds/round2-test-report.md`. Đọc trước khi làm phần A/B/C.

**D-BUG1 (CHẶN) · Nút đặt đơn kẹt vĩnh viễn "Đang gửi đơn…" khi giá đổi.**
Tái hiện 2/2: mở `/shop/checkout/<slug>` → `UPDATE product_variants SET price_vnd = price_vnd + 100000` → điền form hợp lệ → bấm `Đặt đơn` một lần → nút đứng yên >20 giây, **không** có `role="alert"`, giá/tổng không cập nhật, không tạo đơn, không console error.
Server đúng và trả **ngay lập tức** — curl bằng JWT người mua:
```
HTTP 409  {"code":"PT409","details":"{\"reason\": \"price_changed\", \"current\": 1550000, \"expected\": 1450000, \"variant_id\": \"…\"}", …}
```
⇒ nhánh `catch` trong `src/pages/shop/Checkout.tsx` (`onSubmit`) không bao giờ chạy: promise của `create.mutateAsync` không settle nên `create.isPending` mãi `true`. Người mua vào ngõ cụt, phải tự F5.
Nghi vấn đầu tiên nên soi: cấu hình `retry` của mutation trong `src/hooks/shop/useOrders.ts` (react-query mặc định retry mutation? hoặc `retry` kế thừa từ QueryClient) khiến lỗi 409 bị nuốt và thử lại; kế đó là `onError` throw lại/nuốt, hoặc `mutateAsync` được gọi mà không `await`/không `try-catch` đúng chỗ. **Tìm nguyên nhân thật, đừng vá bằng timeout.**
Bắt buộc: mutation tạo đơn **không retry** với mọi lỗi PT4xx/42501/22023 (conflict là câu trả lời cuối, không phải sự cố mạng), và mọi lỗi đều đưa nút về default.
**Phép thử chứng minh (không được bỏ):** một test jsdom/vitest cho `Checkout` (hoặc cho hook) mock RPC ném đúng lỗi PT409 `price_changed` ở trên và khẳng định: (a) `role="alert"` xuất hiện có chữ giá cũ → giá mới, (b) nút trở lại trạng thái bấm được, (c) không gọi RPC lần hai. Test này phải **ĐỎ trên code hiện tại** — chạy trước khi sửa, dán output đỏ vào báo cáo, rồi sửa và dán output xanh.

**D-BUG2 (nên sửa) · Câu chữ sai bản chất khi đặt quá tồn.**
Variant còn 4, người mua để qty 8 ⇒ giỏ hiện "Phiên bản này **vừa hết hàng**". Sai: còn hàng, chỉ là không đủ số lượng.
`shop_cart_view` trả `unavailable_reason='out_of_stock'` cho cả hai ca. Sửa **phía client** (rẻ nhất): khi `stock_on_hand` khác `null` và `> 0` mà `qty > stock_on_hand` ⇒ hiện `Chỉ còn {n} cái. Giảm số lượng để đặt tiếp.`; chỉ khi `stock_on_hand === 0` mới dùng câu "vừa hết hàng". Cùng nguyên tắc cho câu chặn nút nhóm.
*(PDP không cap được qty theo tồn vì projection công khai cố tình không trả `stock_on_hand` — giữ nguyên trần 10, đừng mở tồn kho ra ngoài.)*

**D-BUG3 (ghi nhận, KHÔNG sửa)** · Cuộn ngang ~39px ở `/shop/cart` và `/shop/order/:code` — có y hệt ở `/shop` và `/rankings`, không có ở `/`. Site-wide sẵn có, ngoài phạm vi Phase 3. Chỉ ghi lại một dòng trong báo cáo, đừng đi dọn.

## 5. Đóng gói

1. **noindex** (`functions/_middleware.ts`): pattern hiện có `/^\/(?:vi\/)?shop\/order(?:\/|$)/` **không** khớp `/shop/orders` (ký tự sau `order` là `s`) ⇒ thêm `/^\/(?:vi\/)?shop\/orders(?:\/|$)/` vào `NOINDEX_PATTERNS`, **không** vào `SHOP_PUBLIC_PATTERNS`. `/seller/**` đã được `/^\/(?:vi\/)?seller(?:\/|$)/` phủ — **xác minh lại bằng test regex, không bằng mắt**. Thêm `Disallow: /shop/orders`, `/vi/shop/orders` vào `public/robots.txt` và `functions/robots.txt.ts`.
2. **`src/App.tsx`**: ba route mới lazy bằng `lazyRetry`. Thực tế repo: các route `/seller/*` **không** nằm trong `MIRRORED` (`App.tsx:841–847`) ⇒ chỉ thêm **một** entry `MIRRORED` cho `/shop/orders` (đúng **một dòng**), còn `/seller/orders` và `/seller/orders/:code` khai như các route seller hiện có.
3. **Snapshot**: regenerate `src/routes/__tests__/route-snapshot.json` và sửa số cứng `expect(mirrored.length).toBe(69)` (69 → 70 nếu chỉ thêm `/shop/orders`; con số phải khớp thực tế, đừng đoán).
4. **`scripts/qa/p2b-routes.mjs`**: thêm entry `SHOP_ROUTES` cho `/shop/orders` (`audience: "buyer"`, `mirrored: true`), `/seller/orders`, `/seller/orders/:code` (`audience: "seller"`), đủ `key/pattern/path/auth/aal/noindex:true/h1/marker/rpcs/states`; phải khớp `scripts/qa/route-inventory.test.mjs` (**file vitest** — chạy `npx vitest run`).
5. **Ledger**: ghi tên file migration mới vào báo cáo để PO áp prod (`DRIFT_STRICT=1` fail cả hai chiều).

## 6. Ràng buộc và bẫy

1. Gate `scripts/check-bundle-size.mjs` **fail build** nếu artifact JS chứa `Shop bị tạm ngưng`, `tl-proto-banner`, `Bản mẫu — dữ liệu giả lập`, `pickle-gear-sai-gon`. Câu đúng: **`Shop đang tạm ngưng bán.`** Ngân sách gz INITIAL 280 / CODE 1800 / CONTENT 600 KB. **Cấm nới ngân sách, cấm sửa script.** (`tl-proto-banner` đã tồn tại sẵn trong `shop.css` từ HEAD, gate chỉ quét JS — đừng đi dọn.)
2. Cấm import từ `src/proto/`. Cấm thêm dependency npm. Cấm file CSS mới, cấm hex thô; icon từ `lucide-react`; class mới thêm vào `src/styles/shop.css` và nói rõ trong báo cáo.
3. Cấm `.select('*')` trên 3 bảng đơn; cấm client gọi `shop_order_json`; cấm đọc `actor_user_id`.
4. Chuỗi cấm: `Đã hoàn tiền` · `Chưa thanh toán` (COD viết `Trả khi nhận hàng`) · `email xác nhận` · `đối soát sao kê` · mọi nhắc VietQR/khiếu nại/đánh giá/wishlist · mọi lời hứa ngày giao · **mọi đếm ngược phía người mua**.
5. **Hợp đồng 8 trạng thái** cho mọi nút bất đồng bộ: loading = `disabled` + `aria-busy="true"` + nhãn thể đang-làm + `<Loader2 className="animate-spin">` **thay** icon cũ, **không tự mở lại**; error = nút về default, nhãn `Thử lại`, `.tl-shop-notice--danger` `role="alert"` đặt **trên** nút; success = im lặng, ngoại lệ duy nhất là nhãn `Đã sao chép` 2 giây. **Nút disabled luôn kèm câu giải thích cạnh nút**, không dùng `title`.
6. a11y: mỗi trang đúng một `<h1>` (`SellerShell` dùng `<p className="tl-shop-header-title">`, đừng biến thành h1); mỗi `<section>` có `aria-labelledby`; focus ring 2px offset 2px, không `outline:none`; trạng thái không bao giờ chỉ báo bằng màu; chữ nhỏ dùng `--tl-fg-3`; test `.tsx` mở đầu bằng `/** @vitest-environment jsdom */`.
7. Tái dùng: `formatVnd`/`publicMediaUrl`/`mediaBox` · `usableContacts`/`contactHref`/`CONTACT_LABEL` · `LoadingState`/`ErrorState` · `useConfirm()` · `useMyShopMembership()` · `telHref`/`formatWhen`/`optionSummary`.

## 7. Kiểm thử bắt buộc

```bash
cd /Users/cm10/pickle-hub-pro/.claude/worktrees/shop-phase-3
npx supabase db reset
npx supabase test db --local supabase/tests
PATH="/opt/homebrew/opt/libpq/bin:$PATH" node scripts/qa/db-race.mjs
npm run lint
npm run test
npm run build
node scripts/check-bundle-size.mjs
```

Chạy riêng: `npx vitest run src/routes/__tests__/route-snapshot.test.ts` · `npx vitest run scripts/qa/route-inventory.test.mjs` · script verify JWT buyer (A2).

**Phép thử đỏ-trước-xanh bắt buộc — hàm sắp xếp `/seller/orders`:**
1. Unit test cho hàm sắp thuần: pending quá hạn đứng đầu (quá hạn lâu nhất trước), pending còn hạn theo hạn gần nhất, phần còn lại `created_at DESC`.
2. **Tạm phá** logic (ví dụ sắp thuần theo `created_at DESC`), chạy riêng test, **dán output ĐỎ thật**.
3. Khôi phục, chạy lại, dán output xanh.
Test phải đỏ vì **thứ tự thật sai**, không phải vì đổi tên hàm.

## 8. Acceptance criteria (A35 trở đi)

- **A35** — `product_public_projection` trả `ordering_enabled` + `shipping_fee_vnd`; pgTAP mới xanh; ghi số assertion trước/sau.
- **A36** — Script đăng nhập **JWT buyer thật** chạy đúng select của hook: HTTP 200, có shop/items/events, không 42501. Dán lệnh + output. Kết luận có/không cần `shop_order_by_code` kèm lý do.
- **A37** — `shop_last_shipping_address()` có pgTAP 3 ca và checkout chỉ điền ô trống. Nếu bỏ A4: báo cáo có lý do kỹ thuật cụ thể; **không được đánh dấu A37 đạt**.
- **A38** — `rg -n "shippingFeeLabel|shippingLabel|ORDER_H1_BUYER|ORDER_NOTE_BUYER" src/` cho thấy chỉ còn **một** helper phí ship và hai hằng đã nằm ở `orderState.ts`; `npm run lint` ≤ 30 warning, 0 error.
- **A39** — `/shop/orders` có `RequireAuth` + noindex, 4 tab đếm thật, hai empty khác nhau, loading/lỗi/`refetch`, phân trang 10; không còn link tạm nào trỏ `/shop` thay cho `/shop/orders`.
- **A40** — `/seller/orders`: đúng shell, bảng ≥768px / thẻ <768px **không** dùng `style={{display}}`, 4 tab, 3 empty, notice ngưng bán, `support` không có nút hành động nào.
- **A41** — Đỏ-trước-xanh của hàm sắp xếp: lệnh + output đỏ thật + output xanh thật.
- **A42** — `/seller/orders/:code`: mọi transition truyền `_expected_status` đang hiển thị; từ chối/huỷ bắt buộc lý do; `[Đã gửi hàng]` chạy được khi mã vận đơn rỗng; `stale_status` ⇒ notice warn + refetch.
- **A43** — `telHref` hợp lệ ⇒ `href="tel:0…"`, không hợp lệ ⇒ không có link; nút sao chép ghép đúng 4 dòng, nhãn đổi 2 giây, có `role="status"`; có test jsdom cho phần ghép chuỗi clipboard.
- **A44** — `SELLER_NAV` mục `orders` có `ready: true`; UI không còn nhãn "Sắp có" cho mục này.
- **A45** — `route-snapshot.test.ts` và `route-inventory.test.mjs` đều exit 0; số cứng `mirrored.length` khớp thực tế.
- **A46** — Test chứng minh `/shop/orders`, `/vi/shop/orders`, `/seller/orders`, `/seller/orders/PH-x` đều khớp `NOINDEX_PATTERNS` và `/shop/orders` **không** khớp `SHOP_PUBLIC_PATTERNS`; robots hai file có `Disallow` tương ứng.
- **A47** — Sau `npm run build`, `grep -rn "Shop bị tạm ngưng\|Đã hoàn tiền\|Chưa thanh toán\|email xác nhận\|đối soát sao kê" dist/` rỗng; `grep -rn "src/proto" src/pages/shop src/components/shop src/hooks/shop src/lib/shop` rỗng.
- **A48** — `grep -rn "select(\"\\*\")\|select('\\*')\|shop_order_json\|actor_user_id" src/pages/shop src/components/shop src/hooks/shop src/lib/shop` rỗng.
- **A49** — `npm run lint` exit 0 / 0 error; `npm run test` exit 0, ghi số file/test pass thật (vòng 2: 195 file / 2991 test).
- **A50** — `npm run build` exit 0 và `check-bundle-size.mjs` exit 0, dán 3 con số INITIAL/CODE/CONTENT.
- **A51** — `node scripts/qa/db-race.mjs` exit 0, không regression.
- **A53** — D-BUG1 đóng: test jsdom mock lỗi PT409 `price_changed` **ĐỎ trên code hiện tại** rồi XANH sau khi sửa (dán cả hai output); mutation tạo đơn không retry với PT4xx/42501/22023; mọi lỗi đưa nút về default.
- **A54** — D-BUG2 đóng: `qty > stock_on_hand > 0` ⇒ câu `Chỉ còn {n} cái…`; `stock_on_hand === 0` ⇒ câu "vừa hết hàng". Có unit test cho hàm chọn câu.
- **A52** — Báo cáo ghi rõ: tên migration mới (timestamp > `20260818110000`) để PO áp prod; **chưa** chạy `supabase gen types`; không commit/push/áp prod.

## 9. Báo cáo cuối

(a) file tạo/sửa; (b) cách làm thật cho A/B/C/đóng gói; (c) từng lệnh + exit code + output thật; (d) đối chiếu A35–A52 kèm bằng chứng; (e) output ĐỎ và XANH của phép thử sắp xếp; (f) kết quả verify JWT buyer + quyết định về `shop_order_by_code`; (g) quyết định A4 (làm/bỏ + lý do); (h) việc còn treo; (i) xác nhận không commit / không push / không áp prod / không gen types. **Cấm ghi "pass" cho thứ chưa thực sự chạy.**

---

# TEST CASE CHO AGENT TESTER (Chrome MCP) — VÒNG 3

**Chuẩn bị (một lần):**

1. Supabase local chạy Docker, migration Phase 3 đã áp local. Tạo `.env.local`:
   ```
   VITE_SUPABASE_URL=http://127.0.0.1:54321
   VITE_SUPABASE_PUBLISHABLE_KEY=<hằng ANON trong scripts/qa/seller-qa-kit.mjs>
   VITE_SUPABASE_PROJECT_ID=ajvlcamxemgbxduhiqrl
   ```
   **Khởi động lại `npm run dev`** sau khi tạo.
2. `node scripts/shop-p2b-fixture.mjs up` → tài khoản (mật khẩu `QaP2b!2026`): **Người mua đã đăng nhập** (buyer), **Người bán (chủ shop)** (owner), **Nhân viên hỗ trợ** (`support` cùng shop), **Shop khác (đối chứng)**, **Người ngoài chương trình** (buyer B, chưa có đơn) + slug shop và URL PDP.
3. Bật bán: `docker exec supabase_db_ajvlcamxemgbxduhiqrl psql -U postgres -d postgres -c "UPDATE shops SET ordering_enabled=true, shipping_fee_vnd=30000 WHERE slug='<slug-shop>';"`
4. `npm run dev` → http://localhost:8080. Xong: `node scripts/shop-p2b-fixture.mjs down`.
5. **Không chạy JavaScript trong trang**: kiểm cuộn ngang bằng resize + chụp màn hình + thử cuộn; kiểm chứng dữ liệu bằng `docker exec … psql`.

### TC01 — Vòng đời đầy đủ: đặt → xác nhận → gửi → giao
Bước: (1) buyer thêm 1 món vào giỏ từ PDP; (2) `/shop/cart` → "Đặt hàng shop này"; (3) điền tên, `0912345678`, địa chỉ đủ cấp, COD, đặt đơn; ghi mã `PH-…`; (4) `/shop/orders` kiểm đơn ở tab "Đang tới"; (5) đăng nhập **owner**, `/seller/orders` tab "Cần xử lý", mở đơn; (6) `Xác nhận đơn`, quan sát nhãn nút lúc chạy; (7) nhập mã vận đơn `QA-TRACK-001`, `Đã gửi hàng`; (8) `Ghi nhận đã giao`.
Kỳ vọng: mỗi bước nút khoá + `aria-busy` + nhãn "Đang…" rồi trạng thái tự đổi, không toast ăn mừng; sau (8) không còn nút + "Đơn đã kết thúc. Không còn thao tác nào."
SQL: `SELECT code,status,tracking_code FROM shop_orders WHERE code='<mã>';` + chuỗi event `create,confirm,ship,deliver`.

### TC02 — Người mua bấm "Tôi đã nhận hàng"
Bước: (1) `/shop/orders` tab "Đang tới"; (2) bấm `[Tôi đã nhận hàng]` trên thẻ; (3) xác nhận URL sang `/shop/order/<mã>` (danh sách **không** tự gọi RPC); (4) bấm nút trên trang chi tiết; (5) xác nhận.
Kỳ vọng: có `useConfirm`; sau đó h1 = "Đơn đã xong", nút biến mất, nút liên hệ shop vẫn còn.
SQL: status → `delivered`; event cuối `action='deliver'`, `metadata->>'actor_kind'` là buyer.

### TC03 — Người bán từ chối kèm lý do, người mua thấy nguyên văn
Bước: (1) owner mở `/seller/orders/<mã>`; (2) `Từ chối đơn`; (3) kiểm con trỏ tự nhảy vào ô lý do; (4) ô trống ⇒ nút gửi khoá **và có câu giải thích cạnh nút**; (5) nhập `Sản phẩm tạm hết tại kho cửa hàng`; (6) `Gửi từ chối`; (7) đăng nhập buyer, mở `/shop/order/<mã>`.
Kỳ vọng: buyer thấy **dưới h1** dòng warn nêu **tên shop đã huỷ** + lúc nào + lý do **nguyên văn**; không nút hành động; nút liên hệ shop vẫn còn.
SQL: `SELECT status,cancel_reason,cancelled_by FROM shop_orders WHERE code='<mã>';` → khớp từng ký tự.

### TC04 — Đơn quá hạn lên đầu danh sách người bán
Bước: (1) SQL đặt hạn: A quá hạn 5 giờ, B còn 2 giờ, C còn 20 giờ; (2) owner mở `/seller/orders` tab "Cần xử lý"; (3) đọc thứ tự; (4) resize 375px, kiểm lại ở dạng thẻ.
Kỳ vọng: thứ tự **A → B → C**; A có icon cảnh báo + `Quá hạn 5 giờ` + viền danger; B/C hiện `Còn {n} giờ để trả lời`; đơn `delivered`/`cancelled` **không** hiện dòng hạn.
SQL: `UPDATE shop_orders SET confirm_due_at=now()-interval '5 hours' WHERE code='A';` …

### TC05 — Nút gọi người mua + sao chép địa chỉ
Bước: (1) owner mở khối "Địa chỉ giao"; (2) đọc `href` nút `Gọi người mua`; (3) bấm `Sao chép địa chỉ giao`; (4) đọc nhãn ngay sau khi bấm; (5) chờ >2 giây, đọc lại; (6) dán clipboard vào một ô nhập để đọc nội dung.
Kỳ vọng: `href="tel:0912345678"`; nhãn đổi `Đã sao chép` rồi về sau ~2 giây; nội dung dán đúng 4 dòng; có dòng "Số điện thoại này chỉ hiện với shop vì có đơn hàng thật."

### TC06 — Vai `support` chỉ được xem
Bước: (1) đăng nhập support, mở `/seller/orders`; (2) đọc notice; (3)(4)(5) mở đơn `pending`, `confirmed`, `shipped`.
Kỳ vọng: thấy danh sách + notice "Vai trò support chỉ xem được đơn…"; **không** nút nào trong `Xác nhận đơn / Từ chối đơn / Đã gửi hàng / Huỷ đơn / Ghi nhận đã giao`; vẫn thấy nút sao chép/gọi.
SQL: `SELECT count(*) FROM shop_order_events WHERE created_at > now()-interval '10 minutes';` không tăng.

### TC07 — `/shop/orders`: tab, đếm, hai empty, không cuộn ngang
Bước: (1) buyer mở `/shop/orders`, đối chiếu số đếm 4 tab với SQL; (2) bấm 4 tab; (3) gõ `ZZZ-KHONG-CO` vào ô tìm; (4) đăng nhập "Người ngoài chương trình", mở `/shop/orders`; (5) resize 320px rồi 375px.
Kỳ vọng: số đếm khớp SQL; (3) hiện `Không có đơn nào khớp “ZZZ-KHONG-CO”` + `Xoá tìm kiếm`; (4) hiện **câu khác hẳn** + `Xem sản phẩm đang bán`; mỗi thẻ là **câu việc-cần-làm**; hàng tab cuộn ngang được nhưng **trang không cuộn ngang**.

### TC08 — Người mua huỷ đơn `pending`, kho được hoàn
Bước: (1) SQL đọc `stock_on_hand` trước; (2) `/shop/order/<mã>` → `Huỷ đơn`; (3) đọc hộp xác nhận rồi bấm; (4) chờ cập nhật.
Kỳ vọng: `useConfirm` với nội dung "Đơn sẽ bị huỷ và hàng được trả lại kho của shop. Không hoàn tác được."; h1 = "Đơn đã huỷ", dòng "Anh/chị đã huỷ đơn này lúc …" **không** kèm vế "Lý do"; không còn nút huỷ.
SQL: có dòng `reason='return'`, tồn kho về đúng số trước khi đặt.

### TC09 — Không lộ đơn của người khác
Bước: (1) người ngoài mở thẳng `/shop/order/<mã-đơn-A>`; (2) đọc toàn trang; (3) chủ shop đối chứng mở `/seller/orders/<mã-đơn-A>`; (4) đọc toàn trang; (5) mở `/shop/order/PH-0000-9999`.
Kỳ vọng: cả (1)(3)(5) ra **đúng một câu** "Không tìm thấy đơn này." — câu ở (1) và (5) **giống hệt nhau**; không lộ tên shop, SĐT, địa chỉ, tổng tiền; (3) có nút `Về danh sách đơn`.

### TC10 — PDP tôn trọng `ordering_enabled=false` (vòng 2 FAIL, vòng 3 phải PASS)
Bước: (1) SQL tắt bán; (2) tải lại PDP; (3) `/shop/cart`; (4) `/shop/checkout/<slug-shop>`; (5) owner mở `/seller/orders`; (6) bật lại bán, tải lại PDP.
Kỳ vọng: (2) PDP **ẩn hẳn** ô số lượng + nút, hiện `Shop đang tạm ngưng bán.`, nút liên hệ lên primary; (3)(4) chặn đặt, **sản phẩm vẫn trong giỏ**; (5) notice "…không nhận đơn mới. Đơn đang có vẫn xử lý bình thường." và đơn cũ **vẫn xử lý được**; (6) nút trở lại. Không nơi nào có "Shop bị tạm ngưng".

### TC11 — Hai người bấm cùng lúc (stale_status)
Bước: (1) owner để nguyên `/seller/orders/<mã>` đang mở; (2) buyer (hoặc SQL) huỷ đúng đơn đó; (3) quay lại tab owner bấm `Xác nhận đơn`.
Kỳ vọng: notice warn "Đơn vừa được cập nhật ở nơi khác — có thể người mua vừa huỷ. Trang đã tải lại." (`role="alert"`), trang nạp lại trạng thái `cancelled`, nút về default.
SQL: không có event `confirm` sau `cancel`.
