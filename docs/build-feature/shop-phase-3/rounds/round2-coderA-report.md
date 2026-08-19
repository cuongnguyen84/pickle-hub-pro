# BÁO CÁO VÒNG 2 — CODER A (sửa lỗi SQL)

## A. File đã thay đổi

| File | Trạng thái | Việc vòng 2 |
|---|---|---|
| `supabase/migrations/20260818110000_append_only_actor_null.sql` | **mới** (143 dòng) | Mục 1 — 4 trigger function `CREATE OR REPLACE`, giữ nguyên thân cũ, chèn 1 cửa thoát |
| `supabase/tests/append_only_actor_null.test.sql` | **mới** (189 dòng, plan 16) | Mục 1 — pgTAP (a)/(b)/(c) cho từng bảng trong 4 bảng |
| `supabase/migrations/20260818100000_shop_orders.sql` | sửa (1124 → 1190) | Mục 3, 4, 5, 6 |
| `supabase/tests/shop_orders.test.sql` | sửa (703 → 836, plan 96 → 107) | Mục 2, 3, 4, 6 |
| `scripts/qa/db-race.mjs` | sửa | Mục 5 — Race 6 + `ROUNDS * 15` |
| `src/lib/__tests__/shop-schema-parity.test.ts` | sửa | Mục 7 gạch đầu dòng 1 và 2 |
| `src/lib/shop/__tests__/orderState.test.ts` | sửa | Mục 7 gạch đầu dòng 3 |

`src/integrations/supabase/shop-schema.ts` và `src/lib/shop/orderState.ts` **không đụng** vòng này.

## B. Thay đổi hợp đồng API

1. **`shop_order_events.actor_user_id` không còn trong GRANT SELECT cho `authenticated`.** `shop_order_json` vốn không trả nên UI không ảnh hưởng; timeline dùng `metadata->>'actor_kind'`.
2. **Hợp đồng lỗi rộng thêm 4 `field`** dưới `22023|invalid_payload`: `recipient_name`, `recipient_phone`, `shipping_address`, `delivery_note`. Trước đây rơi ra ngoài hợp đồng dưới dạng `23514`. **CHECK constraint giữ nguyên 100%.**
3. **`items.qty` / `items.expected_unit_price_vnd` sai kiểu / tràn số** giờ trả `22023|invalid_payload` + `field` thay vì `22P02` / `22003` trần.
4. **`shop_order_create` tuần tự hoá theo người mua** (`pg_advisory_xact_lock`). Hai request cùng `auth.uid()` xếp hàng — p99 checkout tăng đúng bằng thời gian một transaction khi một người bấm hai lần.
5. **Huỷ đơn không hoàn kho cho món chưa từng bị trừ** — đổi hành vi tồn kho.
6. `db-race.mjs`: hàm QA nội bộ `qa_p3_try_order` đổi chữ ký `(TEXT)` → `(TEXT, UUID, INT)`. Chỉ tồn tại trên DB local.

## C. Output lệnh

### `npx supabase db reset` — xanh
```
Applying migration 20260818090000_shop_cart_items.sql...
Applying migration 20260818100000_shop_orders.sql...
Applying migration 20260818110000_append_only_actor_null.sql...
{"target":"local","version":"","message":"Reset local database."}
```

### `npx supabase test db --local supabase/tests`
```
supabase/tests/append_only_actor_null.test.sql .................. ok
supabase/tests/shop_cart_items.test.sql ......................... ok
supabase/tests/shop_orders.test.sql ............................. ok
… (47 file, tất cả ok)
All tests successful.
Files=47, Tests=1607,  1 wallclock secs
Result: PASS
```

### `node scripts/qa/db-race.mjs`
```
ok - shop_order_create round 15/15: exactly one winner (got: PT409|insufficient_stock, ok)
ok - pending_limit round 15/15: exactly one winner (got: PT429|too_many_pending, ok)
ok - pending_limit round 15: buyer holds exactly 5 pending orders

All 225 race assertions passed.
```

### `npm run test`
```
 Test Files  192 passed (192)
      Tests  2958 passed | 10 skipped (2968)
```

### `npm run lint`
```
✖ 30 problems (0 errors, 30 warnings)
```
0 error. 30 warning có sẵn từ trước.

## D. Nghiệm thu A1–A34

A1–A29 giữ nguyên và vẫn xanh (`shop_orders.test.sql` plan **107** = 96 cũ + 11 mới).
**A26 vòng 1 bị thu hồi** — nó xanh giả; bản thay thế là A31.

| # | Tiêu chí | Trạng thái | Assertion |
|---|---|---|---|
| **A30** | `delete-account` không bị chặn ở cả 4 bảng append-only | ✅ | `append_only_actor_null.test.sql` — 4 × `lives_ok('DELETE FROM auth.users …')` + 4 × `ok(actor_user_id IS NULL)` + 4 × `throws_ok(… '42501')` chứng minh append-only **chưa** bị nới cho sửa cột nghiệp vụ. plan(16) PASS |
| **A31** | A26 dùng variant **có** đếm tồn, ĐỎ nếu thiếu fix mục 1 | ✅ | `o6` đổi sang `01110001…`; thêm assertion `count(inventory_movements … actor_user_id IS NULL) = 1` |
| **A32** | `actor_user_id` không cấp cho `authenticated` | ✅ | `ok(NOT has_column_privilege('authenticated','public.shop_order_events','actor_user_id','SELECT'))` |
| **A33** | cancel không hoàn kho cho món chưa bị trừ | ✅ | đơn `o7` trên variant stock NULL → bật đếm = 7 → huỷ → `is(stock_on_hand, 7)` **và** 0 dòng `return` |
| **A34** | Race 6 pending-limit ĐỎ-trước-XANH | ✅ | 15 vòng × 2 assertion, `['PT429|too_many_pending','ok']` + `count(pending) = 5` |

## E. Đỏ-trước-xanh — 4 phép thử, đều chạy thật

### E.1 — Gỡ migration `20260818110000` ⇒ ĐỎ
`shop_orders.test.sql`:
```
ERROR:  sổ kho chỉ ghi thêm, không sửa
CONTEXT:  PL/pgSQL function inventory_movements_append_only() line 4 at RAISE
SQL statement "UPDATE ONLY "public"."inventory_movements" SET "actor_user_id" = NULL …"
Parse errors: Bad plan.  You planned 107 tests but ran 101.
Result: FAIL
```
Đúng là `DELETE FROM auth.users` — chỗ nối production của `delete-account/index.ts:156` — nổ, chứ không phải một assertion phụ.

`append_only_actor_null.test.sql`:
```
# Looks like you failed 12 tests of 16
  Failed tests:  2-4, 6-8, 10-12, 14-16
```
**12/16 đỏ = đúng 3 assertion (b)/(c)/(c-row) × 4 bảng. 4 assertion (a) "sửa cột nghiệp vụ vẫn 42501" vẫn xanh** ⇒ fix không nới lỏng append-only.

### E.2 — Bỏ `pg_advisory_xact_lock` ⇒ ĐỎ
```
not ok - pending_limit round 1/15: exactly one winner (got: ok, ok)
… 30 FAILED
```
15/15 vòng cả hai racer đều `ok` ⇒ người mua giữ 6 đơn pending. Race 1–5 vẫn xanh trong cùng lần chạy.

### E.3 — Xoá tạm `set_config` trong `shop_order_create` ⇒ ĐỎ
```
 ❯ src/lib/__tests__/shop-schema-parity.test.ts:549:18
    549|     expect(body).toContain("set_config('shop.stock_write', 'on', true)…
 Tests  1 failed | 129 passed (130)
```
Kiểm chứng chiều ngược lại: **với slice mở-hết-file như cũ, cùng đoạn SQL đã bị xoá `set_config` vẫn XANH** (130 passed) ⇒ khẳng định N5 của review đúng, fix bịt đúng chỗ.

### E.4 — Đổi `confirmed --ship--> shipped` thành `pending --ship--> shipped` ⇒ ĐỎ
```
 ❯ src/lib/shop/__tests__/orderState.test.ts:208:58
 Tests  1 failed | 24 passed (25)
```
Chọn phương án **đối chiếu thật 6 cặp `(from, action, to)`** (một regex mỗi dòng `ORDER_TRANSITIONS` + một assertion đếm số arm), không chỉ đổi tên test.

Cả 4 đã khôi phục và chạy lại xanh.

## F. Mục 8 — 3 câu SQL PO phải chạy trên production TRƯỚC khi áp migration

```sql
SELECT DISTINCT event_category FROM public.audit_logs;
SELECT DISTINCT resource_type  FROM public.audit_logs;
SELECT DISTINCT reason         FROM public.inventory_movements;
```

Đối chiếu với 3 danh sách trong `20260818100000_shop_orders.sql:141-158`:
- `event_category` ⊆ `('auth','stream','tournament','admin','match','player','shop')`
- `resource_type` ⊆ `NULL` hoặc `('livestream','video','tournament','organization','user','api_key','forum_post','quick_table','doubles_elimination','flex_tournament','team_match','match','game','player','shop_application','shop','shop_product','shop_order')`
- `reason` ⊆ `('opening','restock','correction','damage','lost','return','manual','sale')`

Migration `DROP CONSTRAINT` rồi `ADD CONSTRAINT` cả ba. **Nếu prod có giá trị ngoài danh sách, `ADD CONSTRAINT` nổ giữa chừng** — lúc đó 3 CHECK cũ đã bị DROP, bảng chạy không ràng buộc cho tới khi vá xong.

**Runbook:** không áp trong giờ livestream — cả hai file kết thúc bằng `NOTIFY pgrst, 'reload schema'` (cơ chế đã gây PGRST002 ngày 02/08).

## G. Còn thiếu / không chắc

1. **Prompt gợi ý variant `01440004-…` cho A26 — không dùng được** (product `draft`, `is_published=false` ⇒ bị từ chối `PT409|product_unavailable` trước khi tới ledger). Dùng `01110001-…` thay thế. Sai lệch có chủ ý so với chữ trong prompt, mục tiêu giữ nguyên.
2. **Vị trí validate `recipient_*`: đặt SỚM, không ngay trước INSERT.** Lý do: một SĐT sai không đáng phải khoá 5 dòng `product_variants` rồi mới bị từ chối. Hệ quả: payload sai định dạng người nhận nay ưu tiên **cao hơn** `price_changed` / `insufficient_stock`. Nếu PO muốn ngược lại thì chuyển khối này xuống.
3. **Race 6 dùng variant KHÔNG đếm tồn** để trần 5 đơn là thứ duy nhất có quyền từ chối; phải tạo product riêng vì `product_variants_guard_options` ràng buộc option schema. Fixture QA local, cleanup đã xoá.
4. **Không có test trình duyệt vòng này** — diff hoàn toàn là SQL + pgTAP + harness Node + 2 file test TS thuần.
5. **Chưa kiểm A30 trên production.** Bằng chứng thật (xoá tài khoản có dấu vết ledger trên prod) phải chờ sau khi áp migration.
6. **Cột `actor_user_id` bị gỡ khỏi GRANT — chưa rà consumer client.** grep `src/` không thấy truy vấn REST trực tiếp, nhưng coder B viết UI song song; nếu B dùng `.select('*')` trên bảng này sẽ nhận `42501`. Cần đối chiếu ở vòng ghép.
7. **Không commit, không push, không áp prod.** `20260818110000_append_only_actor_null.sql` sửa 4 trigger function **đang chạy trên production** — phải đi cùng hoặc trước `20260818100000` (tên file đã bảo đảm thứ tự).
