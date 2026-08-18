# PROMPT KỸ THUẬT — Shop Phase 3, VÒNG 1 (chỉ tầng dữ liệu)

## 0. Bối cảnh và giới hạn

Worktree: `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-phase-3` (nhánh `worktree-shop-phase-3`). Mọi đường dẫn dưới đây là tương đối với thư mục đó.

Nguồn sự thật của yêu cầu: `docs/build-feature/shop-phase-3/02-final-analysis.md` (§A phạm vi, §B 5 sai sót đã sửa, §D 10 quyết định, §E bất biến + máy trạng thái, §F cấm làm) và `docs/build-feature/shop-phase-3/03-ux-spec.md` (đọc §2.3, §4.4, §4.5, §4.8 để biết câu chữ và mã lỗi client cần phân biệt). Đọc cả hai trước khi gõ dòng code đầu tiên.

Vòng này làm **S1 + S2 + máy trạng thái TypeScript**. **Không** làm UI, không route, không component, không sửa `src/App.tsx`, không đụng `functions/_middleware.ts`, không chạy `supabase gen types`, **không áp migration lên production**. Toàn bộ những thứ đó là vòng sau.

Đọc trước để bám convention: `supabase/migrations/20260811210000_shop_variants_inventory.sql` (khuôn ledger + guard tồn kho + idempotency), `20260812091000_shop_p2b_moderation_backend.sql` (khuôn bảng event append-only + REVOKE/GRANT theo cột + guarded transition), `20260813090000_shop_p2b_public_read.sql` (`product_public_projection` bản mới nhất), `supabase/tests/shop_p2b_moderation.test.sql` (khuôn pgTAP), `scripts/qa/db-race.mjs` (khuôn đua thật), `src/lib/shop/productState.ts` (khuôn máy trạng thái phía TS).

## 1. File phải tạo / sửa

Tạo:
1. `supabase/migrations/20260818090000_shop_cart_items.sql`
2. `supabase/migrations/20260818100000_shop_orders.sql`
3. `supabase/tests/shop_cart_items.test.sql`
4. `supabase/tests/shop_orders.test.sql`
5. `src/lib/shop/orderState.ts`
6. `src/lib/shop/__tests__/orderState.test.ts`

Sửa:
7. `scripts/qa/db-race.mjs` — thêm kịch bản đua đơn hàng vào file đang có (CI chỉ chạy đúng một lệnh `node scripts/qa/db-race.mjs`, tạo file mới là kịch bản không bao giờ chạy trong CI). Giữ nguyên các kịch bản cũ; nhớ cập nhật dòng tổng kết cuối file đang hardcode `ROUNDS * 8` assertion.
8. `src/integrations/supabase/shop-schema.ts` — thêm `OrderStatus`, `OrderAction`, `PaymentMethod`, các row type cần cho vòng 2, và hai hằng `SHOP_P3_TABLES` / `SHOP_P3_RPCS`.
9. `src/lib/__tests__/shop-schema-parity.test.ts` — thêm một `describe` cho hai migration mới theo đúng khuôn các khối P2a/P2b đã có (bảng có `ENABLE ROW LEVEL SECURITY`, có `GRANT`, hàm state-changing là `SECURITY DEFINER` + `SET search_path = public`, và **không** tạo `shop_bank_accounts`).

Không tạo file khác. Nếu buộc phải, ghi lý do trong báo cáo.

Timestamp migration phải lớn hơn `20260817090000` (file mới nhất hiện có). Hai file riêng, không gộp — S1 và S2 là hai lát cắt và ledger áp prod đi từng file.

## 2. S1 — `shop_cart_items`

Bảng tối thiểu: `id uuid PK DEFAULT gen_random_uuid()`, `user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE`, `variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE`, `qty integer NOT NULL CHECK (qty BETWEEN 1 AND 10)`, `created_at`, `updated_at`, UNIQUE `(user_id, variant_id)`.

**Không** thêm cột `shop_id` — shop suy ra từ `product_variants.shop_id`. Một bản sao khoá ngoại là một chỗ để lệch.

RLS + GRANT, cả hai vế đều bắt buộc:
- `ENABLE ROW LEVEL SECURITY`; policy SELECT/INSERT/UPDATE/DELETE cho `authenticated` trên `user_id = auth.uid()`. Policy UPDATE phải có **cả** `USING` **lẫn** `WITH CHECK`; policy INSERT phải có `WITH CHECK`. Thiếu `WITH CHECK` là client đổi `user_id` sang người khác.
- `REVOKE ALL ON public.shop_cart_items FROM anon, authenticated;` rồi GRANT theo cột: `SELECT` các cột cần, `INSERT (variant_id, qty)`, `UPDATE (qty)` — **tuyệt đối không** `GRANT UPDATE` trần — và `DELETE`. `anon` không có quyền nào.

## 3. S2 — cột cấu hình và ledger

Thêm idempotently vào `public.shops`: `ordering_enabled boolean NOT NULL DEFAULT false` (D1 — công tắc bán hàng, cũng là nút tắt khẩn cấp; PO tự bật bằng một dòng SQL sau nghiệm thu) và `shipping_fee_vnd integer NOT NULL DEFAULT 0` + CHECK `>= 0` (D3).

Nới CHECK `inventory_movements_reason_ok` để thêm **đúng một** giá trị `'sale'`, giữ nguyên `opening/restock/correction/damage/lost/return/manual`. `'return'` **đã có sẵn** — huỷ đơn hoàn kho dùng lại nó, đừng thêm `'order_cancel'`.

Nới CHECK của `audit_logs`: `event_category` thêm `'shop'`, `resource_type` thêm `'shop_order'`, giữ nguyên toàn bộ giá trị cũ. Không tạo bảng audit mới.

## 4. S2 — ba bảng đơn

`public.shop_orders`, tối thiểu:
- `id uuid PK`, `code text NOT NULL UNIQUE`
- `shop_id uuid NOT NULL REFERENCES public.shops(id)`
- `buyer_user_id uuid REFERENCES auth.users(id) **ON DELETE SET NULL**` — không CASCADE (người bán mất lịch sử), không RESTRICT (vỡ `delete-account` đang chạy production)
- `client_token text NOT NULL`, UNIQUE `(buyer_user_id, client_token)`
- `status` — 5 giá trị `pending|confirmed|shipped|delivered|cancelled`, mặc định `pending`. **Không** `completed`, **không** `awaiting_payment`
- `payment_method` — chỉ `cod|bank_transfer`, hai cái hành xử y hệt nhau về trạng thái (D2)
- snapshot người nhận: `recipient_name`, `recipient_phone`, `shipping_address` (một ô free-text, D4), `delivery_note`
- `items_total_vnd integer NOT NULL CHECK (>= 0)`, `shipping_fee_vnd integer NOT NULL CHECK (>= 0)`, `total_vnd integer GENERATED ALWAYS AS (items_total_vnd + shipping_fee_vnd) STORED`
- `confirm_due_at timestamptz` — hạn trả lời 48h, **chỉ dùng ở phía người bán** (D6)
- `tracking_code text` (S09 có ô mã vận đơn không bắt buộc)
- `cancelled_by uuid`, `cancel_reason text`
- `created_at`, `updated_at`

Ràng buộc bắt buộc: `total_vnd` là generated column, RPC **không bao giờ** nhận tổng từ client. Validation ở biên tin cậy nằm trong CHECK chứ không chỉ trong client: `recipient_phone ~ '^0\d{9}$'`, `char_length(recipient_name) >= 2`, `char_length(shipping_address) BETWEEN 12 AND 300`, `delivery_note` ≤ 200. Không hard-delete đơn.

⚠️ **Bẫy đã biết:** `confirm_due_at` **không thể** là `GENERATED ALWAYS AS (created_at + interval '48 hours') STORED` — toán tử `timestamptz + interval` là STABLE chứ không IMMUTABLE, Postgres sẽ từ chối bằng `42P17`. Dùng cột thường với `DEFAULT now() + interval '48 hours'`. Nếu bạn tin là làm được thì cứ thử, nhưng `npx supabase db reset` phải xanh.

**Không** thêm `confirmed_at` / `shipped_at` / `delivered_at` / `cancelled_at` — dòng thời gian đọc từ `shop_order_events`.

`public.shop_order_items`: `id`, `order_id NOT NULL REFERENCES shop_orders(id)`, `shop_id`, `product_id`, `variant_id`, `qty integer NOT NULL CHECK (BETWEEN 1 AND 10)`, snapshot **bất biến** `product_title` / `variant_label` / `sku` / `unit_price_vnd`, và `line_total_vnd` là generated stored từ `qty * unit_price_vnd`. Snapshot tồn tại để đơn đọc được sau khi sản phẩm đổi tên hoặc bị gỡ — không cho client sửa, không hard-delete.

`public.shop_order_events`: `id`, `order_id`, `shop_id`, `actor_user_id`, `from_status`, `to_status`, `action`, `metadata jsonb`, `created_at`. **Không** `notify_key`, **không** `client_token` (idempotency đã ở `shop_orders` + guarded UPDATE).

Append-only theo **cả hai** lớp, vì GRANT trả lời trước trigger và một assertion append-only từng xanh giả vì quên vế GRANT:
1. trigger chặn `UPDATE` và `DELETE`;
2. GRANT không cấp `UPDATE`/`DELETE` cho `anon` hay `authenticated`.
Không có policy INSERT cho client — chỉ RPC `SECURITY DEFINER` được ghi.

Quyền trên cả ba bảng: `REVOKE ALL ... FROM anon, authenticated` rồi GRANT theo **cột**. `anon` không có `SELECT` table-level trên bảng nào. `shop_orders.buyer_user_id` **không bao giờ** ra ngoài qua REST — nó chỉ sống trong policy và trong RPC; người bán nhận diện người mua qua snapshot tên/SĐT. RLS: người mua đọc đơn của mình; `owner`/`manager`/`fulfillment`/`support` đọc đơn của đúng shop mình là member; admin qua `is_admin()`. Client **không** có INSERT/UPDATE/DELETE trên ba bảng này — mọi mutation qua RPC.

## 5. Quy ước mã lỗi — đã chốt, không tự nghĩ khác

Client vòng 2 phải hiển thị câu khác nhau cho từng lý do (xem `03-ux-spec.md` bảng "Copy lỗi" §4.4), nên hợp đồng lỗi là một phần của API, không phải chi tiết triển khai.

Mọi từ chối phải raise với: **SQLSTATE** trong bảng dưới, **MESSAGE tiếng Việt** (client `src/lib/shop/errors.ts` hiển thị nguyên văn message tiếng Việt), và **DETAIL là một chuỗi JSON** có khoá `reason` lấy từ từ vựng cố định, cộng các số liên quan.

| Tình huống | SQLSTATE | `reason` trong DETAIL | DETAIL phải có thêm |
|---|---|---|---|
| Giá biến thể đã đổi | `PT409` | `price_changed` | `variant_id`, `expected`, `current` |
| Phí ship đã đổi | `PT409` | `shipping_fee_changed` | `expected`, `current` |
| Không đủ tồn | `PT409` | `insufficient_stock` | `variant_id`, `requested`, `available` |
| Biến thể đã `retired_at` | `PT409` | `variant_unavailable` | `variant_id` |
| Sản phẩm không còn approved/published | `PT409` | `product_unavailable` | `variant_id` |
| Guarded transition thua (trạng thái đã đổi) | `PT409` | `stale_status` | `expected`, `current` |
| `ordering_enabled = false` | `PT403` | `ordering_disabled` | `shop_id` |
| Shop không `active` | `PT403` | `shop_inactive` | `shop_id` |
| Quá 5 đơn `pending` | `PT429` | `too_many_pending` | `limit`, `current` |
| Không đủ quyền | `42501` (`insufficient_privilege`) | `forbidden` | — |
| Payload sai (rỗng / trùng variant / qty ngoài 1..10 / nhiều shop) | `22023` (`invalid_parameter_value`) | `invalid_payload` | trường sai |

Lý do dùng `PT409`/`PT403`/`PT429` chứ không PT410–PT416: PostgREST ánh xạ lớp `PT<mã>` thẳng sang HTTP status, và 410/412/413/414/415 là những status mà CDN và fetch layer diễn giải theo nghĩa khác. Ba mã trên đúng nghĩa HTTP và `reason` mới là thứ client switch trên đó.

Ghi bảng này thành comment ngay cạnh RPC. pgTAP phải assert **cả** SQLSTATE **và** `reason` — assert "có ném lỗi" là assertion rỗng. Viết một hàm phụ trong file test dùng `GET STACKED DIAGNOSTICS` để lấy về `(sqlstate, message, detail)` rồi so.

Chuỗi cho shop tạm ngưng phải là **"Shop đang tạm ngưng bán"**. Chuỗi `"Shop bị tạm ngưng"` là marker chống lọt prototype trong `scripts/check-bundle-size.mjs` và làm đỏ build khi lọt vào artifact.

## 6. `shop_cart_view`

`public.shop_cart_view()` — `SECURITY DEFINER`, `SET search_path = public`, không nhận `user_id`, luôn dùng `auth.uid()`. `REVOKE ALL ... FROM PUBLIC` rồi `GRANT EXECUTE TO authenticated, service_role` (không cấp cho `anon`).

Trả JSONB: mảng nhóm theo shop; mỗi nhóm có `shop` (`slug`, `name`, `state`, `ordering_enabled`, `shipping_fee_vnd`) và `lines[]`; mỗi dòng có `cart_item_id`, `variant_id`, `qty`, dữ liệu hiển thị lấy từ `product_public_projection(product_id, false)`, và `unavailable_reason` — một trong `null | 'product_unavailable' | 'variant_retired' | 'out_of_stock' | 'shop_inactive' | 'ordering_disabled'`.

⚠️ `product_public_projection` **RAISE `no_data_found`** khi sản phẩm không còn công khai. Bắt exception đó **theo từng dòng** và đánh dấu `unavailable_reason='product_unavailable'`; để nó nổ lên là một sản phẩm bị gỡ làm trắng cả giỏ hàng.

**Không** có cờ `price_changed` và **không** lưu giá tham chiếu trong giỏ (§B.S5) — giỏ không có gì để so, việc bắt đổi giá xảy ra đúng một chỗ là lúc tạo đơn.

Ghi đúng dòng này ngay tại vòng lặp: `-- ponytail: N+1 projection, gộp thành một query khi giỏ > 50 dòng`.

## 7. `shop_order_create`

Chữ ký cố định, **không tham số nào có DEFAULT** (default là cách nhanh nhất để sinh ambiguity 42725 khi sau này thêm overload):

```
public.shop_order_create(
  _client_token               text,
  _payment_method             text,     -- 'cod' | 'bank_transfer'
  _recipient_name             text,
  _recipient_phone            text,
  _shipping_address           text,
  _delivery_note              text,
  _expected_shipping_fee_vnd  integer,
  _items                      jsonb     -- [{"variant_id":uuid,"qty":int,"expected_unit_price_vnd":int}]
) RETURNS jsonb
```

**Không** nhận `shop_id` — suy ra từ `product_variants.shop_id` và từ chối nếu các item thuộc nhiều shop. Một shop = một đơn.

Trình tự trong một transaction, hoặc tất cả hoặc không gì:

1. Yêu cầu caller đã đăng nhập; `_client_token` không rỗng.
2. **Trước mọi mutation**, tìm đơn theo `(auth.uid(), _client_token)`. Có rồi thì trả về **chính đơn đó** và dừng: không đơn mới, không trừ kho lần hai, không event, không ledger, không xoá thêm giỏ. Idempotency phải an toàn cả khi hai request cùng token đến đồng thời — unique constraint là trọng tài cuối, xử lý cả nhánh `unique_violation` chứ đừng chỉ SELECT-rồi-INSERT.
3. Đếm đơn `pending` của người mua; ≥ 5 thì từ chối `PT429`/`too_many_pending` (D8).
4. Chuẩn hoá `_items`: không rỗng, không trùng `variant_id`, `qty` 1..10.
5. `SELECT ... FOR UPDATE` từng variant, khoá **theo thứ tự `variant_id` tăng dần** để hai đơn chồng nhau không deadlock.
6. **Sau khi đã khoá** mới kiểm lại: variant tồn tại và `retired_at IS NULL`; product `status='approved'` và `is_published`; shop `state='active'`; shop `ordering_enabled = true`; mọi item cùng một shop; `price_vnd` khớp `expected_unit_price_vnd` từng dòng; `shops.shipping_fee_vnd` khớp `_expected_shipping_fee_vnd`; đủ tồn khi `stock_on_hand IS NOT NULL`. `stock_on_hand IS NULL` nghĩa là **shop không đếm tồn** — vẫn đặt được, và tuyệt đối không biến nó thành 0.
7. `items_total_vnd` tính trong SQL từ giá vừa khoá × qty.
8. INSERT `shop_orders` (sinh `code`, xem dưới) + INSERT `shop_order_items` với snapshot.
9. Trừ kho **tự làm**: `PERFORM set_config('shop.stock_write','on',true)` → UPDATE `product_variants.stock_on_hand` → INSERT `inventory_movements` với `reason='sale'`, delta âm, `on_hand_before`, `on_hand_after`, đúng `shop_id`/`product_id`/`variant_id`, `actor_user_id`. **Tuyệt đối không gọi `product_variant_adjust_stock`** — hàm đó `PERFORM product_assert_writable()` vốn đòi `is_shop_manager()`, và người mua không phải member nên sẽ nổ `insufficient_privilege` (§B.S2).
10. Ghi `shop_order_events` (action `create`, `from_status` NULL, `to_status` `pending`).
11. Xoá khỏi `shop_cart_items` **mọi dòng của caller thuộc đúng shop vừa đặt** — không đụng dòng của shop khác.
12. `log_audit_event(...)` — cast **từng** tham số `::text` / `::jsonb`. Hàm này có hai overload; gọi không cast là `42725 function is not unique`, lỗi đã từng làm hỏng cả luồng duyệt sản phẩm.
13. Ghi `social_notifications` cho chủ shop, **best-effort**: FK trỏ `public.profiles(id)` chứ không phải `auth.users`, nên bọc `EXCEPTION WHEN others THEN NULL` hoặc `WHERE EXISTS (SELECT 1 FROM public.profiles ...)`. Một người dùng thiếu row `profiles` không được phép giết đơn hàng.
14. Trả JSONB đơn vừa tạo, **không có** `buyer_user_id`.

`code`: dạng `PH-YYMM-XXXX` (UX hiển thị ví dụ `PH-2608-0039`), phần đuôi **ngẫu nhiên chứ không tuần tự** — mã tuần tự để lộ sản lượng của shop cho bất kỳ ai nhìn thấy một mã. Sinh bằng `extensions.gen_random_bytes(...)` — **phải qualify `extensions.`** vì hàm `SECURITY DEFINER` đã pin `SET search_path = public`. Vòng thử lại có giới hạn khi đụng unique.

## 8. `shop_order_transition`

Vòng này phải có luôn RPC chuyển trạng thái — tiêu chí nghiệm thu "huỷ đơn hoàn kho đúng và ledger cân" không kiểm được nếu thiếu nó.

```
public.shop_order_transition(
  _order_id        uuid,
  _action          text,   -- 'confirm' | 'ship' | 'deliver' | 'cancel'
  _expected_status text,
  _reason          text,
  _tracking_code   text
) RETURNS jsonb
```

Máy trạng thái, đúng bằng này và không hơn:

```
pending   --confirm(seller|admin)--> confirmed
confirmed --ship(seller|admin)-----> shipped
shipped   --deliver(buyer|seller|admin)--> delivered
pending   --cancel(buyer|seller|admin)---> cancelled
confirmed --cancel(seller|admin)---------> cancelled
shipped   --cancel(admin)----------------> cancelled
```

`deliver` cho **cả người mua** bấm (D7 — "Tôi đã nhận hàng"; không có cron nào tự đóng đơn, thiếu vế này đơn treo vĩnh viễn). `delivered` là trạng thái kết thúc thành công, không có `completed`.

Quyền kiểm **trong RPC**, không dựa vào RLS (hàm `SECURITY DEFINER` bỏ qua RLS nên policy không bao giờ được hỏi tới): người mua chỉ đụng đơn của chính mình; hành động phía bán chỉ dành cho `owner`/`manager`/`fulfillment` của **đúng** shop; `support` chỉ đọc, không transition được gì; admin qua `is_admin()` (đã bao hàm AAL2). Chủ shop tự mua của mình thì không chặn (D9).

Mọi UPDATE là guarded: `WHERE id = _order_id AND status = _expected_status`, rồi kiểm `GET DIAGNOSTICS ... ROW_COUNT` — khác 1 thì raise `PT409`/`stale_status`. Hai người bấm cùng lúc: đúng một người thắng.

Huỷ đơn: không hard-delete; `cancel_reason` **bắt buộc không rỗng khi actor không phải người mua**; ghi `cancelled_by`; khoá lại variant rồi hoàn kho bằng **dòng ledger mới** `reason='return'`, delta dương, before/after đúng — **không sửa dòng `sale` cũ**; guarded transition là thứ chống hoàn kho hai lần. Ghi event, ghi audit, notification best-effort cho người mua.

## 9. `src/lib/shop/orderState.ts`

Soi gương SQL theo khuôn `src/lib/shop/productState.ts` — hàm thuần, không React, không Supabase. Export: kiểu `OrderStatus` (5 giá trị), `OrderAction`, `OrderActor` (`buyer|seller|admin`, cộng vai `support`/`fulfillment` nếu bạn thấy cần để suy nút), bảng transition hợp lệ, hàm hỏi "actor này làm được action này ở trạng thái này không" và hàm trả trạng thái kế tiếp. Không có `completed`, không có `awaiting_payment`.

`src/lib/shop/__tests__/orderState.test.ts` (đúng thư mục `__tests__` — đó là convention của thư mục này) phủ tối thiểu: toàn bộ cặp hợp lệ; người mua không confirm/ship; người mua chỉ huỷ khi `pending`; người mua deliver được từ `shipped`; người bán không huỷ đơn `shipped`; admin huỷ được ở cả ba trạng thái; không có đường ra khỏi `delivered`/`cancelled`; giá trị lạ đến từ runtime bị từ chối an toàn.

Nếu thấy tiện thì thêm một test đọc file migration và đối chiếu danh sách cặp transition trong SQL với bảng TS — nhưng chỉ khi làm được bằng một biểu thức đơn giản, đừng viết parser SQL.

## 10. Kịch bản đua thật + phép thử đỏ-trước-xanh

Thêm vào `scripts/qa/db-race.mjs` một kịch bản: hai người mua khác nhau, cùng tranh **đơn vị hàng cuối cùng** của một variant, dùng đúng cơ chế barrier advisory lock đã có trong file (một session điều phối giữ lock, hai racer xếp hàng, thả cùng lúc, payload đi cùng một simple-query message). **Không** dùng `Promise.all` trần — nó suy biến thành tuần tự và cho xanh giả; comment trong file đã ghi lại đúng lần mắc bẫy đó.

Khẳng định của kịch bản: đúng một racer tạo được đơn; racer kia thất bại với `PT409`/`insufficient_stock`; đúng một đơn tồn tại; `stock_on_hand` về 0 và không âm; đúng một dòng ledger `sale`; tổng delta `sale` = −1. Harness exit khác 0 nếu bất kỳ điều nào sai, kể cả trường hợp **cả hai cùng thành công**.

**Phép thử đỏ-trước-xanh, bắt buộc, không được bỏ:** sau khi kịch bản xanh, tạm bỏ `FOR UPDATE` ở đúng chỗ khoá variant trong `shop_order_create`, `npx supabase db reset`, chạy lại harness, **dán nguyên văn output ĐỎ vào báo cáo**, rồi khôi phục `FOR UPDATE`, reset lại, chạy lại, dán output XANH. Nếu bỏ `FOR UPDATE` mà vẫn xanh thì kịch bản đang bảo vệ nhầm chỗ — sửa kịch bản cho tới khi nó phá được đúng call site thật, đừng tuyên bố đạt. Không commit bản cố ý hỏng.

## 11. pgTAP

`BEGIN; SELECT plan(N); ... SELECT * FROM finish(); ROLLBACK;`. Đổi danh tính bằng `SET LOCAL request.jwt.claims TO '{"sub":"<uuid>","role":"authenticated","aal":"aal1"}'`, admin dùng `aal2`. Fixture insert thẳng vào `auth.users` theo khuôn `supabase/tests/shop_p2b_moderation.test.sql`.

Hai bẫy fixture của repo này:
- Trigger `handle_new_user` sinh `profiles.profile_slug` từ **12 ký tự hex đầu** của user id — mọi UUID fixture phải khác nhau ở 12 ký tự đầu, nếu không unique index sẽ nổ.
- Trigger đó cũng **tự tạo row `profiles`**, nên bài test "người mua không có `profiles` mà đơn vẫn tạo được" phải `DELETE FROM public.profiles` cho user đó một cách tường minh.

## 12. Cấm làm (ponytail)

Không UI, route, component. Không bảng `payments` / `shipments` / `returns` / `disputes` / `wishlist` / `shop_bank_accounts`. Không `notify_key`, không `client_token` trên bảng event. Không trạng thái `completed` / `awaiting_payment` / trạng thái thanh toán riêng. Không QR, không thông tin ngân hàng, không đối soát. `total_vnd` và `line_total_vnd` là generated column chứ không phải RPC tính. Không nhận tổng tiền từ client. Không cờ `price_changed`, không lưu giá tham chiếu ở giỏ. Không edge function (mọi thứ qua RPC/PostgREST — tránh sạch bẫy JWT ES256/HS256 của project này). Không thêm dependency npm. Không hard-delete. Không gọi `product_variant_adjust_stock`. Không `GRANT UPDATE` trần. Không để `buyer_user_id` ra REST. Không dựa riêng vào RLS cho mutation. Không áp migration lên production, không push, không merge.

## 13. Lệnh tự kiểm chứng

```sh
cd /Users/cm10/pickle-hub-pro/.claude/worktrees/shop-phase-3
npx supabase db reset                          # KHÔNG dùng `supabase start` — nó không áp hết migration
npx supabase test db --local supabase/tests
node scripts/qa/db-race.mjs
npx vitest run src/lib/shop/__tests__/orderState.test.ts
npm run test
npm run lint
git status --short && git diff --stat
```

Nếu CLI trên máy khác cú pháp, dùng lệnh tương đương và **ghi rõ lệnh thật đã chạy**.

## 14. ACCEPTANCE CRITERIA

Mỗi dòng chỉ được đánh `ĐẠT` khi có đúng một lệnh hoặc một assertion chứng minh. Không suy luận.

| # | Tiêu chí | Bằng chứng bắt buộc |
|---|---|---|
| A1 | Migration áp sạch từ đầu | `npx supabase db reset` exit 0 |
| A2 | Toàn bộ pgTAP xanh | `npx supabase test db --local supabase/tests` exit 0, kèm số assertion |
| A3 | Vitest xanh, không regression | `npm run test` exit 0 |
| A4 | Lint xanh | `npm run lint` exit 0 |
| A5 | Idempotency: 2 lần cùng token → 1 đơn | pgTAP: hai lời gọi trả cùng `id`; `COUNT(shop_orders)=1`; ledger `sale` không tăng lần hai; tồn chỉ giảm một lần |
| A6 | Đua 2 phiên tranh đơn vị cuối | `node scripts/qa/db-race.mjs`: 1 thành công, 1 lỗi `PT409`/`insufficient_stock`, tồn = 0, một đơn, một ledger `sale` |
| A7 | Kịch bản đua thật sự bảo vệ `FOR UPDATE` | Output **ĐỎ** khi bỏ lock + output **XANH** sau khi khôi phục, cả hai nguyên văn |
| A8 | Giá đổi giữa chừng → từ chối | pgTAP: `PT409` + `reason='price_changed'` + DETAIL có `expected`/`current`; không đơn, không item, không ledger, tồn nguyên |
| A9 | Phí ship đổi → từ chối | pgTAP: `PT409` + `reason='shipping_fee_changed'` + DETAIL có `expected`/`current`; không mutation |
| A10 | `ordering_enabled=false` → từ chối | pgTAP: `PT403` + `reason='ordering_disabled'`; không mutation |
| A11 | Shop không `active` → từ chối | pgTAP: `PT403` + `reason='shop_inactive'`; không mutation |
| A12 | Variant `retired_at` → từ chối | pgTAP: `PT409` + `reason='variant_unavailable'` |
| A13 | Sản phẩm không approved/published → từ chối | pgTAP: `PT409` + `reason='product_unavailable'` |
| A14 | Quá 5 đơn `pending` → từ chối | pgTAP: `PT429` + `reason='too_many_pending'`; số đơn pending vẫn là 5 |
| A15 | `stock_on_hand IS NULL` vẫn đặt được | pgTAP: đơn tạo thành công, không sinh UPDATE tồn sai, không ledger cho variant đó |
| A16 | Không đủ tồn → từ chối, tồn không âm | pgTAP: `PT409` + `reason='insufficient_stock'` |
| A17 | Tổng tiền do DB giữ | pgTAP: `total_vnd` là generated stored (`information_schema.columns.is_generated='ALWAYS'`) và bằng items + ship |
| A18 | `anon` không đọc được 3 bảng đơn | 3 assertion `has_table_privilege('anon','public.shop_orders','SELECT') = false` (và 2 bảng còn lại) |
| A19 | `buyer_user_id` không lộ qua REST | `has_column_privilege('authenticated','public.shop_orders','buyer_user_id','SELECT') = false` |
| A20 | Event không UPDATE/DELETE được **kể cả khi có GRANT** | 2 assertion `has_table_privilege(...)=false`; **cộng** một assertion tạm `GRANT UPDATE, DELETE` trong transaction rồi chứng minh trigger vẫn ném lỗi (rollback trả lại nguyên trạng) |
| A21 | Huỷ đơn hoàn kho đúng, ledger cân | pgTAP: sau cancel, `SUM(delta)` của đơn đó = 0, `stock_on_hand` về mức ban đầu, dòng `sale` không bị sửa, có đúng một dòng `return` |
| A22 | Huỷ hai lần không hoàn kho hai lần | pgTAP: lần cancel thứ hai nhận `PT409`/`stale_status`, không thêm dòng `return` |
| A23 | Giỏ chỉ xoá dòng của shop được đặt | pgTAP: giỏ có item của 2 shop; sau create, item shop đã đặt biến mất, item shop kia còn nguyên |
| A24 | Notification không giết đơn | pgTAP: người mua không có row `profiles` → đơn vẫn tạo thành công |
| A25 | Audit call site không nổ overload | pgTAP: gọi RPC thật (create / cancel / transition của admin) rồi assert có row `audit_logs` tương ứng |
| A26 | Xoá auth user không xoá đơn | pgTAP: `DELETE FROM auth.users` người mua → đơn còn, `buyer_user_id IS NULL` |
| A27 | Quyền theo vai kiểm trong RPC | pgTAP: người mua khác → 42501; `support` → 42501; `fulfillment` đúng shop → thành công; member shop khác → 42501 |
| A28 | Guarded transition | pgTAP: transition với `_expected_status` cũ → `PT409`/`stale_status` |
| A29 | Không có UI nào bị đụng | `git diff --stat` không chứa file nào trong `src/pages/`, `src/components/`, `src/App.tsx`, `functions/` |

Lệnh nào không chạy được vì môi trường thì ghi `BỊ CHẶN` kèm nguyên văn lỗi. Không tự suy là đạt.

## 15. Báo cáo phải nộp

**A. File đã đổi** — từng file, một câu mô tả.
**B. Hợp đồng API** — chữ ký từng RPC + bảng mã lỗi cuối cùng (SQLSTATE → `reason` → message → schema DETAIL), để vòng 2 nối client không phải đoán.
**C. Output thật** — với mỗi lệnh: dòng lệnh, **toàn bộ output nguyên văn**, exit code. Không tóm tắt, không viết "pass" thay cho output, không chế. Bắt buộc có: `db reset`, pgTAP, race XANH, race ĐỎ (khi bỏ `FOR UPDATE`), race XANH sau khôi phục, vitest `orderState`, `npm run test`, `npm run lint`, `git diff --stat`.
**D. Acceptance** — chép lại A1–A29, đánh `ĐẠT` / `KHÔNG ĐẠT` / `BỊ CHẶN` kèm tên assertion hoặc output chứng minh.
**E. Đỏ-trước-xanh** — chính xác dòng nào đã tạm bỏ, vì sao lần ĐỎ chứng minh kịch bản bảo vệ đúng bất biến, xác nhận bản cuối đã khôi phục lock.
**F. Còn treo** — mọi lỗi, test chưa chạy, quyết định bạn phải tự chọn vì đề chưa nói rõ. Nếu không còn: ghi thẳng "Không còn việc treo trong phạm vi Vòng 1."

---

### Ghi chú của prompt-engineer (đã xác minh bằng file thật, khác bản nháp Codex)

- Tên file pgTAP: CI (`.github/workflows/pgtap.yml:44`) đếm bằng glob `supabase/tests/*.test.sql` → đặt sai tên là test **không bao giờ chạy trong CI** mà vẫn xanh cục bộ.
- Vị trí unit test: `src/lib/shop/__tests__/` theo convention (11 file test hiện có đều ở đó).
- `confirm_due_at` là bẫy `42P17` nếu làm generated column.
- `product_public_projection` ném `no_data_found` — không bắt theo dòng thì một sản phẩm bị gỡ làm trắng cả giỏ.
- `shop_order_transition` kéo vào vòng 1 vì tiêu chí "huỷ đơn hoàn kho + ledger cân" không kiểm được nếu thiếu.
- Mã lỗi chốt `PT409`/`PT403`/`PT429` — PostgREST ánh xạ lớp `PT<mã>` thẳng sang HTTP status.
- `scripts/qa/db-race.mjs` sửa tại chỗ: CI chỉ chạy đúng lệnh đó (`pgtap.yml:62`).
