# BÁO CÁO VÒNG 4 — CODER (chỉ sửa lỗi)

## 1. Đã làm

**F1 — đóng lỗ `cancelled_by`** (4 điểm, đúng danh sách):
- `20260818100000_shop_orders.sql:403` — bỏ `cancelled_by` khỏi GRANT SELECT cột cho `authenticated`; viết lại comment `:396-398` cho khớp (nay nêu cả 3 cột và lý do `profiles` đọc được toàn bộ).
- `20260818120000:203` — bỏ khỏi danh sách cột view `my_shop_orders`.
- `src/integrations/supabase/shop-schema.ts` — xoá field khỏi `ShopOrderRow`; `Omit<…,"cancelled_by">` ở `ShopOrderDetail` thành `Omit<…,"shop_id">`; cập nhật docblock. Đã đối chiếu `shop_order_json` (`:455-471`): RPC **chưa bao giờ** trả `cancelled_by` ⇒ shape `ShopOrderDetail` không đổi một byte.
- pgTAP: `has_column_privilege('authenticated','public.shop_orders','cancelled_by','SELECT') = false` đặt ngay cạnh assertion `buyer_user_id`/`client_token`.
- Grep xác nhận **không UI/hook nào đọc `cancelled_by`** — chỉ còn 2 chỗ trong migration (định nghĩa cột `:214`, phép gán `:1092`, cả hai giữ nguyên theo prompt). Không đổi dòng nào ở `Orders.tsx` / `SellerOrderDetail.tsx`.

**F2 — canh danh sách cột của view**:
- 6 assertion mới cuối `supabase/tests/shop_orders.test.sql` (tái dùng 3 đơn seed sẵn): (a) `information_schema.columns` không có `buyer_user_id`/`client_token`/`cancelled_by`; (b) `NOT has_table_privilege('anon', …)`; (c) buyer A qua view **không** thấy `PH-2699-CCCC` của buyer B nhưng **vẫn** thấy `PH-2699-BBBB` của mình, **cộng một assertion chống-vacuous** là bảng nền đọc bằng quyền service vẫn có `PH-2699-CCCC`; thêm assertion `reloptions @> security_barrier=true`.
- `CREATE VIEW public.my_shop_orders WITH (security_barrier = true)`, viết lại comment trên view cho đúng lý do tắt `security_invoker`.
- `shop-schema-parity.test.ts:456-461` — sửa comment sai (G1): invoker=on ⇒ Postgres kiểm quyền **cột** theo người gọi ⇒ 42501, chứ không phải "trả lại khách của người bán". Assertion không đổi.

**F3(a) — probe**: gộp bộ trích thành `selectFromSource(name)` (cùng regex cho cả `ORDER_SELECT` lẫn `LIST_SELECT`), tách `placeOrder()`; thêm mục 4: chạy `LIST_SELECT` trên `my_shop_orders` bằng JWT buyer, in danh sách cột thật của view qua `select("*")`, rồi **tự tra chủ shop từ DB** cho ca vừa-bán-vừa-mua, kèm đối chứng không-vacuous đọc `shop_orders` bằng chính tài khoản đó.

**F3(b) — vá gốc retry**: `src/App.tsx` tách predicate thành `retryUnless4xx(max)`; `queries: retryUnless4xx(2)` (hành vi y hệt cũ), `mutations: retryUnless4xx(1)` thay `retry: 1`. **Giữ nguyên số lần** retry tối đa của mutation là 1, chỉ thêm chặn 4xx — cố ý không nâng lên 2 để không âm thầm gấp đôi số request ghi trên toàn site.

## 2. File đã thay đổi
```
 M src/App.tsx
 M src/integrations/supabase/shop-schema.ts
 M src/lib/__tests__/shop-schema-parity.test.ts
?? scripts/qa/order-read-jwt-probe.mjs
?? supabase/migrations/20260818100000_shop_orders.sql
?? supabase/migrations/20260818120000_shop_phase3_projection_and_address.sql
?? supabase/tests/shop_orders.test.sql
```

## 3. Output nguyên văn

### A55 — ĐỎ TRƯỚC (assertion đã thêm, migration chưa sửa)
```
# Failed test 12: "ai huỷ đơn cũng không — cancelled_by là uid, không ra ngoài qua REST"
# Looks like you failed 1 test of 112
Failed 1/112 subtests
Result: FAIL
error running container: exit 1
```

### A55 — XANH SAU (sau khi bỏ cột khỏi GRANT + view, `db reset`)
```
.../supabase/tests/shop_orders.test.sql .. ok
All tests successful.
Files=1, Tests=118,  0 wallclock secs
Result: PASS
```

### A56/A60 — toàn bộ pgTAP
```
All tests successful.
Files=47, Tests=1625,  2 wallclock secs
Result: PASS
```
47 file, **1625** assertion (1618 + 7 mới: 1 của F1, 6 của F2).

### A60 — race
```
All 225 race assertions passed.
```

### A58 — probe
```
── LIST_SELECT lifted from src/hooks/shop/useOrders.ts (/shop/orders, VIEW my_shop_orders) ──
id,code,shop_id,status,payment_method,recipient_name,total_vnd,confirm_due_at,cancel_reason,created_at,
shop:shops(slug,name),items:shop_order_items(id,product_title,qty),events:shop_order_events(action,metadata,created_at)

── my_shop_orders + LIST_SELECT — buyer JWT ──
HTTP 200 · error: null · rows: 1 · codes: ["PH-2608-F1B8"]
  (shop{} + items[1] + events[1] action=create)

── my_shop_orders columns as `authenticated` sees them ──
["id","code","shop_id","status","payment_method","recipient_name","recipient_phone","shipping_address",
 "delivery_note","items_total_vnd","shipping_fee_vnd","total_vnd","confirm_due_at","tracking_code",
 "cancel_reason","created_at","updated_at"]

── same account SELLS this shop and just BOUGHT from it ──
── my_shop_orders + LIST_SELECT — seller-and-buyer JWT ──   rows: 1  codes: ["PH-2608-E530"]
── shop_orders  + LIST_SELECT — same account as /seller/orders does ──  rows: 2  codes: ["PH-2608-E530","PH-2608-F1B8"]

PASS — the hook's select works with a real buyer JWT
```
Đọc thẳng: 3 embed từ **view** ra HTTP 200 (không PGRST200); danh sách cột view **không có** `buyer_user_id`/`client_token`/`cancelled_by`; tài khoản vừa-bán-vừa-mua thấy **2 đơn** trên bảng nền nhưng **chỉ 1 đơn của chính mình** qua view — ca không vacuous.

Fixture đã `down`, verify sạch (0|0|0|0).

### A59/A60 — lint / test / build / bundle
```
$ npm run lint    ✖ 30 problems (0 errors, 30 warnings)
$ npm run test     Test Files 200 passed (200) · Tests 3053 passed | 10 skipped (3063)
$ npm run build    ✓ built in 5.47s
$ node scripts/check-bundle-size.mjs   → exit 0
INITIAL gz 227.7 / 280 · CODE gz 1602.8 / 1800 · CONTENT gz 405.6 / 600
```
**Không có test đỏ nào**, trong lẫn ngoài Shop, sau khi đổi default `mutations` site-wide.

## 4. A55–A60

| # | Kết quả |
|---|---|
| A55 | ĐẠT — đỏ (Failed test 12 / 112) rồi xanh (118/118) |
| A56 | ĐẠT — 6 assertion view xanh (cột, anon, security_barrier, 2 ca buyer-scoping, 1 chống-vacuous) |
| A57 | ĐẠT — comment nêu đúng lý do quyền **cột** ⇒ 42501 |
| A58 | ĐẠT — output ở trên |
| A59 | ĐẠT — `retryUnless4xx` dùng chung; 200 file xanh, 0 đỏ |
| A60 | ĐẠT — pgTAP 1625/47 file, race 225/225, lint 0 error, build + bundle exit 0 |

## 5. Còn treo / cần quyết

1. **Số lần retry của mutation**: giữ `failureCount < 1` (max 1 lần thử lại như cũ) thay vì `< 2` như queries. Hiểu tinh thần đề bài là **không retry 4xx**, và không muốn âm thầm tăng gấp đôi số request ghi trên toàn site. Muốn đúng chữ thì đổi `retryUnless4xx(1)` → `retryUnless4xx(2)`.
2. Không phát hiện chỗ nào đọc `cancelled_by` ngoài type ⇒ không cần thiết kế thay thế.
3. Ca "vừa bán vừa mua" trong probe dùng **chủ shop tự mua hàng shop mình** (D9 cho phép). Nếu sau này thêm guard chặn tự mua, nhánh này của probe sẽ nổ ở `shop_order_create` — lúc đó đổi sang chủ shop A mua ở shop B.
4. Không đụng `sortSellerOrders`, `product_public_projection`, `shop_last_shipping_address`, `Orders.tsx`, `SellerOrderDetail.tsx`; không chép lại 3 comment bị xoá ở G4 (ngoài phạm vi 3 việc).

**Xác nhận: không commit, không push, không áp migration prod, không `supabase gen types`.**
