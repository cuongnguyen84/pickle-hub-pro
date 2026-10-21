# PROMPT VÒNG 2 — CODER A (chỉ sửa lỗi SQL, không mở phạm vi)

**Bối cảnh:** Vòng 1 đã review độc lập (Codex + prompt-engineer). Máy trạng thái, khoá tồn kho, idempotency, guarded transition, hợp đồng lỗi chính, tính idempotent của migration: **đạt, không sửa lại**. Dưới đây là đúng những thứ phải sửa. Không thêm bảng, không thêm cột ngoài danh sách, **không UI, không route**, vẫn **không áp prod, không commit, không push**.

**Sở hữu file (một coder khác đang làm UI song song — TUYỆT ĐỐI không đụng file ngoài danh sách này):**
`supabase/migrations/**`, `supabase/tests/**`, `scripts/qa/db-race.mjs`, `src/lib/__tests__/shop-schema-parity.test.ts`, `src/lib/shop/__tests__/orderState.test.ts`.
**Không** sửa `src/integrations/supabase/shop-schema.ts`, `src/lib/shop/orderState.ts`, `src/App.tsx`, `src/pages/**`, `src/components/**`, `src/hooks/**`, `src/styles/**`, `functions/**` — coder B đang giữ.

---

## 1. (CHẶN) Gỡ bom `delete-account` — file mới `supabase/migrations/20260818110000_append_only_actor_null.sql`

Bốn bảng có `actor_user_id … REFERENCES auth.users(id) ON DELETE SET NULL` cộng trigger `BEFORE UPDATE` raise vô điều kiện, nên `auth.admin.deleteUser` (`supabase/functions/delete-account/index.ts:156`) hỏng với bất kỳ ai từng để lại dấu vết:

| Bảng | Trigger |
|---|---|
| `inventory_movements` | `inventory_movements_append_only` |
| `product_moderation_events` | `20260812120000:355-370` |
| `product_submission_events` | `20260811230000:89-108` |
| `shop_contact_moderation_events` | `20260812120000:330-350` |

`CREATE OR REPLACE` cả 4 hàm trigger, **giữ nguyên toàn bộ thân hiện có** (kể cả nhánh DELETE-khi-cha-đã-mất — copy từ file gốc rồi chèn, đừng viết lại từ đầu), chỉ chèn vào đầu nhánh UPDATE đúng một cửa thoát:

```sql
IF NEW.actor_user_id IS NULL AND OLD.actor_user_id IS NOT NULL
   AND to_jsonb(NEW) - 'actor_user_id' = to_jsonb(OLD) - 'actor_user_id' THEN
  RETURN NEW;   -- FK ON DELETE SET NULL, không phải người sửa sổ
END IF;
```

pgTAP mới `supabase/tests/append_only_actor_null.test.sql`: với **từng** bảng trong 4 bảng —
(a) UPDATE đổi một cột nghiệp vụ vẫn `42501`;
(b) UPDATE chỉ null hoá `actor_user_id` **thành công**;
(c) `DELETE FROM auth.users` của user từng ghi vào bảng đó chạy trót lọt và dòng sổ còn nguyên với `actor_user_id IS NULL`.

## 2. (CHẶN) A26 đang xanh giả — sửa `supabase/tests/shop_orders.test.sql:654-672`

Đơn `o6` dùng variant `01220002-…` có `stock_on_hand = NULL` (`:100-102`) nên `shop_order_create` bỏ qua ledger (`CONTINUE WHEN … IS NULL`, migration `:839`) và bài test không bao giờ chạm FK.

Đổi sang một variant **có đếm tồn** (ví dụ `01440004-…`), giữ nguyên vế "người mua không có row `profiles`", rồi assert thêm: sau `DELETE FROM auth.users` — đơn còn, `buyer_user_id IS NULL`, **và** dòng `inventory_movements` `reason='sale'` của đơn đó vẫn còn với `actor_user_id IS NULL`.

Test này phải **ĐỎ nếu bỏ mục 1 ra** — chứng minh bằng cách chạy thử rồi dán output đỏ vào báo cáo.

## 3. (CHẶN) `buyer_user_id` vẫn lộ qua `shop_order_events.actor_user_id`

`20260818100000_shop_orders.sql:412-414` cấp `SELECT (…, actor_user_id, …)` cho `authenticated`; policy `:387-390` cho mọi party — kể cả `support` và mọi member — nên **người bán đọc được uid người mua** từ event `create`.

Bỏ `actor_user_id` khỏi GRANT đó (`shop_order_json` không trả cột này, UI dùng `metadata->>'actor_kind'`). Thêm assertion cạnh A19:
`has_column_privilege('authenticated','public.shop_order_events','actor_user_id','SELECT') = false`.

## 4. (NÊN SỬA) Huỷ đơn không được hoàn kho cho món chưa từng bị trừ

`20260818100000:1050-1074`. Trong vòng lặp cancel, bỏ qua variant không có dòng `sale` của chính đơn này:

```sql
CONTINUE WHEN NOT EXISTS (
  SELECT 1 FROM public.inventory_movements
  WHERE variant_id = _it.variant_id
    AND client_token = 'order:' || _order_id::text || ':sale');
```

pgTAP: đặt đơn với variant `stock_on_hand IS NULL` → người bán set tồn = 7 → cancel → tồn **vẫn 7**, không có dòng `return`.

## 5. (NÊN SỬA) Trần 5 đơn pending thua race

Ngay trước `SELECT count(*)` ở `:661`, thêm một dòng:
`PERFORM pg_advisory_xact_lock(hashtext('shop_order_create:' || _uid::text));`
kèm comment `-- ponytail: khoá theo người mua, đổi sang partial unique index nếu trần thành nhiều bậc`.

Thêm **Race 6** vào `scripts/qa/db-race.mjs` theo đúng khuôn barrier advisory lock đã có: một người mua đang có 4 đơn pending, hai request khác token thả cùng lúc ⇒ đúng một `ok`, một `PT429|too_many_pending`, và `count(pending) = 5`. Cập nhật dòng tổng kết `ROUNDS * 13` cho khớp.

Kèm phép thử đỏ-trước-xanh: bỏ dòng advisory lock ⇒ dán output ĐỎ, khôi phục ⇒ dán output XANH.

## 6. (NÊN SỬA) Payload sai kiểu phải nằm trong hợp đồng lỗi

Bọc cast `qty` (`:698`) và `expected_unit_price_vnd` (`:750`) trong
`BEGIN … EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN`
→ `shop_order_raise('22023', …, jsonb_build_object('reason','invalid_payload','field', …))`.

Validate `recipient_name`/`recipient_phone`/`shipping_address`/`delivery_note` **trước** INSERT với đúng mã `22023`/`invalid_payload` + `field` tương ứng; **giữ nguyên toàn bộ CHECK constraint** (lớp cuối, không thay thế).

pgTAP: `qty:"abc"`, `qty:99999999999`, `expected_unit_price_vnd:null`, phone `"123"`, địa chỉ 5 ký tự, note 250 ký tự — mỗi case assert cả SQLSTATE lẫn `reason` lẫn `field`.

## 7. (NÊN SỬA) Ba test đang bảo vệ nhầm chỗ nối

- `src/lib/__tests__/shop-schema-parity.test.ts:495-500`: cắt slice tới `REVOKE ALL   ON FUNCTION public.shop_order_create`, không phải hết file — hiện `set_config` của `shop_order_transition` đang gánh cho `shop_order_create`. Tự kiểm bằng cách xoá tạm `set_config` trong `shop_order_create` và xác nhận test **ĐỎ**.
- cùng file `:450-454`: assert riêng `GRANT SELECT ( … ) ON public.<table> TO authenticated` và `REVOKE ALL ON public.<table> FROM anon, authenticated`, thay cho regex bắt mọi GRANT.
- `src/lib/shop/__tests__/orderState.test.ts:185-204`: đổi tên test thành đúng thứ nó làm (kiểm từ vựng, không phải đối chiếu từng cặp) **hoặc** đối chiếu thật 6 cặp `(from, action, to)` bằng regex trên từng arm. Không viết SQL parser.

## 8. (Bắt buộc, ghi vào báo cáo — KHÔNG sửa code, KHÔNG tự chạy trên prod)

Ghi ra **nguyên văn 3 câu SQL** mà PO sẽ chạy trên production trước khi áp migration:
```sql
SELECT DISTINCT event_category FROM public.audit_logs;
SELECT DISTINCT resource_type  FROM public.audit_logs;
SELECT DISTINCT reason         FROM public.inventory_movements;
```
`20260818100000:141-158` DROP rồi ADD lại 3 CHECK; repo drift kinh niên (10 migration áp ngoài git) nên nếu prod có giá trị ngoài danh sách thì `ADD CONSTRAINT` nổ giữa migration.
Ghi thêm một dòng runbook: **không áp trong giờ livestream** (`NOTIFY pgrst` — sự cố PGRST002 02/08).

---

## Nghiệm thu vòng 2 (coder A)

Chạy lại **toàn bộ** từ đầu và dán **nguyên văn** output từng lệnh, không tóm tắt:
```sh
npx supabase db reset
npx supabase test db --local supabase/tests
PATH="/opt/homebrew/opt/libpq/bin:$PATH" node scripts/qa/db-race.mjs
npm run test
npm run lint
git status --short && git diff --stat
```

A1–A29 giữ nguyên, **cộng** 5 tiêu chí mới, mỗi cái phải có một assertion chỉ đích danh:

| # | Tiêu chí |
|---|---|
| A30 | `delete-account` không bị chặn ở cả 4 bảng append-only |
| A31 | A26 đặt đơn bằng variant **có** đếm tồn, và **ĐỎ** nếu thiếu fix mục 1 |
| A32 | `actor_user_id` của `shop_order_events` không cấp cho `authenticated` |
| A33 | cancel không hoàn kho cho món chưa từng bị trừ |
| A34 | Race 6 pending-limit **ĐỎ-trước-XANH** |

**Lưu ý:** `npm run test` có thể đỏ ở test do coder B (UI) đang viết dở trong cùng worktree — nếu file đỏ nằm ngoài danh sách sở hữu của bạn, ghi rõ "ngoài phạm vi coder A" kèm tên file, đừng sửa.
