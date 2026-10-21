# BÁO CÁO CODER — Shop Phase 3, Vòng 1 (tầng dữ liệu)

Worktree: `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-phase-3` · nhánh `worktree-shop-phase-3` · **không commit, không push, không áp prod**.

---

## A. File đã đổi

**Tạo mới (6):**

| File | Mô tả |
|---|---|
| `supabase/migrations/20260818090000_shop_cart_items.sql` (96 dòng) | Bảng `shop_cart_items` (không `shop_id`, không giá tham chiếu), 4 policy RLS với UPDATE có **cả** `USING` lẫn `WITH CHECK`, `REVOKE ALL` rồi GRANT theo cột (`INSERT (variant_id, qty)`, `UPDATE (qty)`, không UPDATE trần), `anon` không quyền. |
| `supabase/migrations/20260818100000_shop_orders.sql` (1124 dòng) | S2 trọn gói: 2 cột cấu hình trên `shops`, nới CHECK `inventory_movements_reason_ok` (+`sale`) và `audit_logs` (+`shop`/`shop_order`), 3 bảng đơn + RLS/GRANT theo cột, trigger append-only, `shop_cart_view()`, `shop_order_create()`, `shop_order_transition()`, 2 hàm phụ nội bộ. |
| `supabase/tests/shop_cart_items.test.sql` (240 dòng) | 27 assertion: grant theo cột, `WITH CHECK`, cách ly giữa 2 người mua, 5 giá trị `unavailable_reason`, không có cờ `price_changed`. |
| `supabase/tests/shop_orders.test.sql` (~700 dòng) | 96 assertion: shape/grant/generated column, luồng đặt hàng, idempotency, 11 kiểu từ chối (SQLSTATE **và** `reason` **và** DETAIL), phân quyền theo vai, huỷ + hoàn kho, append-only kể cả khi đã cấp GRANT. |
| `src/lib/shop/orderState.ts` (156 dòng) | Máy trạng thái TS soi gương SQL: 5 `OrderStatus`, 4 `OrderAction`, `OrderActor` (có `support` tách riêng), bảng `ORDER_TRANSITIONS`, `canTransition`/`nextStatus`/`allowedActions`/`isTerminal`/`cancelNeedsReason` + nhãn song hành với §G. |
| `src/lib/shop/__tests__/orderState.test.ts` (215 dòng) | 25 test: toàn bộ cặp hợp lệ, toàn bộ cặp KHÔNG hợp lệ, quyền từng actor, `delivered`/`cancelled` không lối ra, giá trị lạ từ runtime, và một khối đối chiếu với file migration. |

**Sửa (3):**

| File | Mô tả |
|---|---|
| `scripts/qa/db-race.mjs` | Thêm fixture + **Race 5** (hai người mua tranh đơn vị cuối, dùng barrier advisory lock có sẵn), 5 assertion/vòng; cập nhật cleanup và dòng tổng kết `ROUNDS * 8` → `ROUNDS * 13`. |
| `src/integrations/supabase/shop-schema.ts` | Thêm `OrderStatus`, `OrderAction`, `PaymentMethod`, `CartLineUnavailableReason`, `ShopCartItemRow`, `CartLine`, `CartGroup`, `ShopOrderRow`, `ShopOrderItemRow`, `ShopOrderEventRow`, `ShopOrderDetail`, `SHOP_P3_TABLES`, `SHOP_P3_RPCS`. |
| `src/lib/__tests__/shop-schema-parity.test.ts` | Thêm `describe` cho 2 migration mới (RLS + GRANT + SECURITY DEFINER + `SET search_path`, không tạo `shop_bank_accounts`/`payments`/…, tiền là generated column, không GRANT UPDATE trần, `buyer_user_id`/`client_token` không lộ, append-only 2 lớp, không gọi `product_variant_adjust_stock`, không `completed`/`awaiting_payment`/`notify_key`). |

Không tạo file nào ngoài danh sách §1.

---

## B. Hợp đồng API

### B.1 Chữ ký

```sql
public.shop_cart_view() RETURNS jsonb
-- SECURITY DEFINER, SET search_path = public, KHÔNG nhận user_id (đọc auth.uid())
-- REVOKE ALL FROM PUBLIC; GRANT EXECUTE TO authenticated, service_role
-- Trả: [ { shop: {slug,name,state,ordering_enabled,shipping_fee_vnd},
--          lines: [ {cart_item_id, variant_id, qty, product_id, product_slug,
--                    product_title, option_values, sku, unit_price_vnd,
--                    line_total_vnd, stock_on_hand, cover, unavailable_reason} ] } ]
-- unavailable_reason ∈ null | 'variant_retired' | 'shop_inactive'
--                    | 'product_unavailable' | 'ordering_disabled' | 'out_of_stock'
-- KHÔNG có price_changed, KHÔNG có giá tham chiếu.

public.shop_order_create(
  _client_token              text,
  _payment_method            text,     -- 'cod' | 'bank_transfer'
  _recipient_name            text,
  _recipient_phone           text,
  _shipping_address          text,
  _delivery_note             text,
  _expected_shipping_fee_vnd integer,
  _items                     jsonb     -- [{"variant_id":uuid,"qty":int,"expected_unit_price_vnd":int}]
) RETURNS jsonb
-- KHÔNG tham số nào có DEFAULT. KHÔNG nhận shop_id. KHÔNG nhận tổng tiền.
-- GRANT EXECUTE TO authenticated, service_role

public.shop_order_transition(
  _order_id        uuid,
  _action          text,     -- 'confirm' | 'ship' | 'deliver' | 'cancel'
  _expected_status text,
  _reason          text,
  _tracking_code   text
) RETURNS jsonb
-- GRANT EXECUTE TO authenticated, service_role
```

Hàm nội bộ:
- `public.shop_order_json(uuid) → jsonb` — DTO của đơn, `SECURITY DEFINER`, chỉ `service_role`.
- `public.shop_order_is_party(uuid) → boolean` — dùng trong policy của 2 bảng con; cấp cho `authenticated`.
- `public.shop_order_raise(text,text,jsonb)` — helper raise, không GRANT cho ai.

### B.2 Payload trả về

```jsonc
{
  "id","code","status","payment_method",
  "recipient_name","recipient_phone","shipping_address","delivery_note",
  "items_total_vnd","shipping_fee_vnd","total_vnd",
  "confirm_due_at","tracking_code","cancel_reason","created_at","updated_at",
  "shop":   { "slug","name","state" },
  "items":  [ { "id","product_id","variant_id","qty","product_title",
                "variant_label","sku","unit_price_vnd","line_total_vnd" } ],
  "events": [ { "id","action","from_status","to_status","metadata","created_at" } ]
}
```
**Không có** `buyer_user_id`, **không có** `client_token`.

### B.3 Bảng mã lỗi cuối cùng

| Tình huống | SQLSTATE | `reason` | MESSAGE (VI) | DETAIL |
|---|---|---|---|---|
| Giá biến thể đổi | `PT409` | `price_changed` | Giá vừa thay đổi trong lúc anh/chị điền. | `{reason, variant_id, expected, current}` |
| Phí ship đổi | `PT409` | `shipping_fee_changed` | Phí vận chuyển vừa thay đổi. | `{reason, expected, current}` |
| Không đủ tồn | `PT409` | `insufficient_stock` | Món này vừa hết hàng. | `{reason, variant_id, requested, available}` |
| Variant retired / không tồn tại | `PT409` | `variant_unavailable` | Một phiên bản trong đơn không còn bán. | `{reason, variant_id}` |
| Sản phẩm không approved+published | `PT409` | `product_unavailable` | Một sản phẩm trong đơn không còn bán. | `{reason, variant_id}` |
| Guarded transition thua | `PT409` | `stale_status` | Đơn đã thay đổi ở nơi khác — mở lại để xem trạng thái mới. | `{reason, expected, current}` |
| `ordering_enabled = false` | `PT403` | `ordering_disabled` | **Shop đang tạm ngưng bán.** | `{reason, shop_id}` |
| Shop không `active` | `PT403` | `shop_inactive` | **Shop đang tạm ngưng bán.** | `{reason, shop_id}` |
| Quá 5 đơn `pending` | `PT429` | `too_many_pending` | Anh/chị đang có 5 đơn chờ shop xác nhận… | `{reason, limit, current}` |
| Chưa đăng nhập / sai vai / sai shop | `42501` | `forbidden` | Cần đăng nhập để đặt hàng. / Không có quyền… | `{reason}` |
| Payload sai | `22023` | `invalid_payload` | (tuỳ trường) | `{reason, field}` |

### B.4 Máy trạng thái

```
pending   --confirm(seller|admin)--------> confirmed
confirmed --ship(seller|admin)-----------> shipped
shipped   --deliver(buyer|seller|admin)--> delivered
pending   --cancel(buyer|seller|admin)---> cancelled
confirmed --cancel(seller|admin)---------> cancelled
shipped   --cancel(admin)----------------> cancelled
```
`seller` = `owner|manager|fulfillment`. `support` **không** transition được gì. Không có `completed`, không `awaiting_payment`.

---

## C. Output thật

### C.1 `npx supabase db reset` — EXIT 0
```
EXIT=0
Applying migration 20260818100000_shop_orders.sql...
WARN: no files matched pattern: supabase/seed.sql
Restarting containers...
{"target":"local","version":"","message":"Reset local database."}
```
*(output đầy đủ 72 KB / ~450 dòng `Applying migration …` lưu ở `/tmp/reset-final.txt`.)*

### C.2 `npx supabase test db --local supabase/tests` — EXIT 0
```
EXIT=0
supabase/tests/shop_cart_items.test.sql ......................... ok
supabase/tests/shop_orders.test.sql ............................. ok
All tests successful.
Files=46, Tests=1580,  2 wallclock secs
Result: PASS
```
`shop_cart_items.test.sql` **27** assertion, `shop_orders.test.sql` **96**. Trước vòng này repo có 1457.

### C.3 `node scripts/qa/db-race.mjs` — XANH, EXIT 0
```
EXIT=0
ok - shop_order_create round 1/15: exactly one winner (got: PT409|insufficient_stock, ok)
ok - shop_order_create round 1: exactly one order exists
ok - shop_order_create round 1: stock lands on 0 and never below
ok - shop_order_create round 1: exactly one 'sale' ledger row
ok - shop_order_create round 1: total 'sale' delta is -1
...
All 195 race assertions passed.
```
195 = 15 vòng × 13 assertion (4 kịch bản cũ × 2 + kịch bản mới × 5).

### C.4 Race **ĐỎ** — sau khi bỏ `FOR UPDATE`, EXIT 1
```
EXIT=1
60
not ok - shop_order_create round 1/15: exactly one winner (got: ok, ok)
not ok - shop_order_create round 1: exactly one order exists
ok - shop_order_create round 1: stock lands on 0 and never below
not ok - shop_order_create round 1: exactly one 'sale' ledger row
not ok - shop_order_create round 1: total 'sale' delta is -1
...
60 FAILED
```

### C.5 Race **XANH** sau khôi phục
```
EXIT=0
195 ok / 0 not ok
All 195 race assertions passed.
```
```
714:    SELECT v.shop_id INTO _sid FROM public.product_variants v WHERE v.id = _vid FOR UPDATE;
```

### C.6 `npx vitest run src/lib/shop/__tests__/orderState.test.ts` — EXIT 0
```
 Test Files  1 passed (1)
      Tests  25 passed (25)
```

### C.7 `npm run test` — EXIT 0
```
 Test Files  192 passed (192)
      Tests  2957 passed | 10 skipped (2967)
```

### C.8 `npm run lint` — EXIT 0
```
✖ 30 problems (0 errors, 30 warnings)
EXIT=0
```
30 warning đều là `react-refresh/only-export-components` trong `src/proto/shop/**`, có sẵn từ trước.

### C.9 `git status --short && git diff --stat`
```
 M scripts/qa/db-race.mjs
 M src/integrations/supabase/shop-schema.ts
 M src/lib/__tests__/shop-schema-parity.test.ts
?? docs/build-feature/shop-phase-3/
?? src/lib/shop/__tests__/orderState.test.ts
?? src/lib/shop/orderState.ts
?? supabase/migrations/20260818090000_shop_cart_items.sql
?? supabase/migrations/20260818100000_shop_orders.sql
?? supabase/tests/shop_cart_items.test.sql
?? supabase/tests/shop_orders.test.sql

 scripts/qa/db-race.mjs                       | 150 ++++++++++++++++++++++++-
 src/integrations/supabase/shop-schema.ts     | 162 +++++++++++++++++++++++++++
 src/lib/__tests__/shop-schema-parity.test.ts | 127 +++++++++++++++++++++
 3 files changed, 438 insertions(+), 1 deletion(-)
```

---

## D. Acceptance A1–A29 — **29/29 ĐẠT**

| # | Kết quả | Bằng chứng |
|---|---|---|
| A1 | ĐẠT | `db reset` EXIT=0 |
| A2 | ĐẠT | `Result: PASS`, `Files=46, Tests=1580` |
| A3 | ĐẠT | 192/192 file, 2957 passed |
| A4 | ĐẠT | lint EXIT=0, 0 errors |
| A5 | ĐẠT | 2 lời gọi cùng token trả cùng `id`; COUNT=1; sale=1; tồn chỉ giảm một lần |
| A6 | ĐẠT | Race 5, 5 assertion/vòng × 15 vòng |
| A7 | ĐẠT | Output ĐỎ (§C.4) + XANH (§C.5) |
| A8 | ĐẠT | `PT409\|price_changed`, DETAIL `{"current":1500000,"expected":1400000}`, không mutation |
| A9 | ĐẠT | `PT409\|shipping_fee_changed`, DETAIL `{"current":30000,"expected":25000}` |
| A10 | ĐẠT | `PT403\|ordering_disabled` |
| A11 | ĐẠT | `PT403\|shop_inactive` |
| A12 | ĐẠT | `PT409\|variant_unavailable` |
| A13 | ĐẠT | `PT409\|product_unavailable` |
| A14 | ĐẠT | `PT429\|too_many_pending`, DETAIL `{"limit":5,"current":5}`, vẫn đúng 5 đơn |
| A15 | ĐẠT | `stock_on_hand IS NULL` đặt được, tồn vẫn NULL, 0 dòng ledger |
| A16 | ĐẠT | `PT409\|insufficient_stock`, DETAIL `{"available":3,"requested":9}`, tồn không âm |
| A17 | ĐẠT | `is_generated='ALWAYS'` cho `total_vnd` + `line_total_vnd`; 3 030 000 = 2×1 500 000 + 30 000 |
| A18 | ĐẠT | 3 × `has_table_privilege('anon',…,'SELECT') = false` |
| A19 | ĐẠT | `has_column_privilege(authenticated, buyer_user_id)` = false (+ `client_token` false, `recipient_phone` true) |
| A20 | ĐẠT | 2 assertion GRANT false **cộng** GRANT tạm trong transaction → trigger vẫn ném 42501 |
| A21 | ĐẠT | tồn về mức cũ, đúng 1 dòng `return`, `SUM(delta)`=0, dòng `sale` không bị sửa |
| A22 | ĐẠT | huỷ lần 2 → `PT409\|stale_status`, không thêm dòng `return` |
| A23 | ĐẠT | giỏ 2 shop → shop A COUNT=0, shop D COUNT=1 (đếm theo `variant_id`; bản đầu join `product_variants` cho xanh giả) |
| A24 | ĐẠT | xoá `profiles` của người mua → đơn vẫn tạo được |
| A25 | ĐẠT | `audit_logs` có `shop_order_create` + `shop_order_cancel` |
| A26 | ĐẠT | `DELETE FROM auth.users` → đơn còn, `buyer_user_id IS NULL` |
| A27 | ĐẠT | 42501 cho: người mua tự confirm, `support`, chủ shop khác, người mua khác; `fulfillment` đúng shop thành công |
| A28 | ĐẠT | `PT409\|stale_status`, DETAIL `{"current":"confirmed","expected":"pending"}` |
| A29 | ĐẠT | không có `src/pages/`, `src/components/`, `src/App.tsx`, `functions/` trong diff |

---

## E. Đỏ-trước-xanh

**Dòng đã tạm bỏ** — `supabase/migrations/20260818100000_shop_orders.sql:714`:

```sql
-- bản thật
SELECT v.shop_id INTO _sid FROM public.product_variants v WHERE v.id = _vid FOR UPDATE;
-- bản cố ý hỏng
SELECT v.shop_id INTO _sid FROM public.product_variants v WHERE v.id = _vid;
```

Không có `FOR UPDATE`, hai racer cùng đọc `stock_on_hand = 1`, cả hai qua kiểm tra "đủ tồn", cả hai tạo đơn: `got: ok, ok`. Ba assertion phái sinh cũng đỏ (2 đơn, 2 dòng ledger, tổng `-2`).

**Đáng chú ý:** assertion `stock lands on 0 and never below` **vẫn xanh** trong lần đỏ — cả hai racer ghi cùng `_after = 0`. Nếu kịch bản chỉ kiểm tồn kho thì đã xanh giả hoàn toàn; chính "đúng một người thắng" + đếm ledger mới bắt được lỗi.

**Bản cuối:** `FOR UPDATE` đã khôi phục, `db reset` chạy lại, harness 195/195 EXIT=0, pgTAP 1580 PASS. Không commit bản hỏng.

---

## F. Còn treo

1. **`shops_guard_privileged_columns()` bị sửa** (ngoài §1 nhưng cùng file S2). `shops_update_manager` cho owner/manager PATCH thẳng `shops`; không ghim `ordering_enabled` thì người bán tự bật được công tắc của PO. Thêm 1 dòng ghim. **Bẫy đã mắc và đã sửa:** lần đầu `CREATE OR REPLACE` bằng thân hàm Phase 1 làm mất cửa thoát `shop.slug_write` của `20260811180000` → `shop_slug_update` hỏng, `shop_p2b_public_read.test.sql` đỏ 2 assertion. Bản nộp = bản `20260811180000` **cộng đúng một dòng**. `shipping_fee_vnd` cố ý **không** ghim (D3).
2. **`shop_order_events.actor_user_id` bỏ FK** (chỉ là uuid snapshot). Có FK `ON DELETE SET NULL` thì `DELETE FROM auth.users` sinh UPDATE lên bảng append-only → **xoá tài khoản thất bại vĩnh viễn**. → **Cảnh báo vượt phạm vi:** `inventory_movements.actor_user_id` và `product_moderation_events.actor_user_id` **đang có đúng lỗi này trên production** — `delete-account` sẽ nổ với bất kỳ user nào từng điều chỉnh kho hoặc duyệt sản phẩm. Không sửa vì ngoài phạm vi; đề nghị mở việc riêng.
3. **`shop_order_json` / `shop_order_is_party` không có trong §1 nhưng phải thêm.** Policy inline `EXISTS (… o.buyer_user_id = auth.uid())` được đánh giá **dưới quyền người gọi**, mà `buyer_user_id` là cột bị giữ lại → người mua đọc dòng đơn của chính mình nhận `permission denied for table shop_orders`. Cả hai đã đăng ký trong `SHOP_P3_RPCS`.
4. **Wrapper `EXCEPTION WHEN foreign_key_violation` quanh `log_audit_event`.** `audit_logs.actor_id` trỏ `public.profiles(id)` nên A24 chết ở audit chứ không phải notification. Bắt **hẹp đúng `foreign_key_violation`** để `42725` vẫn nổ to (A25 canh cái đó).
5. **`inventory_movements.client_token` dùng làm khoá idempotency của đơn** (`order:<uuid>:sale` / `:return`), tận dụng unique index sẵn có nên một đơn không thể trừ/hoàn kho hai lần về mặt cấu trúc.
6. **`shop_cart_view` trả nhóm shop không có `shop.id`**, chỉ `slug` (bám `shop_public_shop`). Vòng 2 khoá nhóm theo `slug` — cũng là param route `/shop/checkout/:shopSlug`.

**Việc môi trường (không đụng file tracked):**
- Cài `libpq` qua Homebrew để có `psql`; chạy race bằng `PATH="/opt/homebrew/opt/libpq/bin:$PATH" node scripts/qa/db-race.mjs`. CI đã có `psql`.
- `npm install fast-xml-parser --no-save`: `node_modules` của worktree thiếu package đã khai trong `package.json:100` → `news-editorial-surfaces.test.ts` đỏ. Lỗi có sẵn của môi trường worktree. `package.json`/lock không đổi.

**Chưa làm, có chủ đích (§12):** không UI/route/component, không `supabase gen types`, không `_middleware.ts`, không `MIRRORED`/`route-snapshot`, **không áp prod**, không commit/push.
