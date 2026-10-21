# PROMPT VÒNG 4 — chỉ sửa lỗi, không mở phạm vi

Worktree: `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-phase-3`.
**Không commit, không push, không áp migration prod, không `supabase gen types`.**

Bối cảnh: vòng 3 đã chạy trọn trên trình duyệt thật (11/12 PASS, 0 FAIL — xem `rounds/round3-test-report.md`). Code review độc lập (`rounds/round3-code-review.md`) bắt 2 lỗi chặn + 1 nên sửa. Đây là **3 việc**, không thêm gì khác. Không đụng `sortSellerOrders` (đã chứng minh tương đương spec), `product_public_projection` (diff sạch), `shop_last_shipping_address` (không lỗ).

---

## F1 (CHẶN) — đóng lỗ `cancelled_by`

`shop_orders.cancelled_by` là `UUID REFERENCES auth.users(id)` (`20260818100000_shop_orders.sql:214`), được gán uid của **mọi** actor huỷ kể cả người mua (`:1092`), và đang nằm trong GRANT SELECT cho `authenticated` (`:403`) lẫn trong cột của view `my_shop_orders` (`20260818120000:203`).

Vì `20260504100000_profiles_authenticated_view_all.sql` cho **mọi** user đăng nhập đọc toàn bộ `profiles`, và `profiles.id` = auth uid, người bán tra được hồ sơ công khai đầy đủ của khách (tên thật, avatar, DUPR) — vượt xa "tên + SĐT đã snapshot" mà chính comment `:396-398` hứa. Chiều ngược lại: người mua đọc được uid của nhân viên shop/admin đã huỷ đơn.

Đây là lần **thứ ba** cùng một bất biến §E.10 rò qua một tên cột khác (`buyer_user_id` → `actor_user_id` → `cancelled_by`).

**Việc:**
1. Bỏ `cancelled_by` khỏi GRANT ở `20260818100000:403` — migration này **chưa lên prod** nên sửa tại chỗ là hợp lệ (đừng thêm migration REVOKE).
2. Bỏ khỏi danh sách cột của view `20260818120000:203`.
3. Bỏ khỏi `ShopOrderRow` (`src/integrations/supabase/shop-schema.ts:605`; `Omit` ở `:645` khi đó thành thừa — dọn luôn).
4. pgTAP `has_column_privilege('authenticated','public.shop_orders','cancelled_by','SELECT') = false`, đặt **ngay cạnh** assertion `buyer_user_id` đã có.

**UI không được đổi dòng nào**: `Orders.tsx:89` và `SellerOrderDetail.tsx:198` đã đọc `metadata->>'actor_kind'`; `ORDER_SELECT`/`LIST_SELECT` không xin cột này. Nếu phát hiện có chỗ đang đọc `cancelled_by`, báo lại chứ đừng tự thiết kế thay thế.

**Đỏ-trước-xanh bắt buộc:** chứng minh assertion mới **ĐỎ** khi cột còn trong GRANT (chạy trước khi sửa migration, dán output đỏ), rồi sửa và dán output xanh.

## F2 (CHẶN) — canh danh sách cột của view

`my_shop_orders` (`20260818120000:198-206`) không `security_invoker` ⇒ chạy dưới quyền owner ⇒ bỏ qua **cả** policy `shop_orders_select_party` **cả** GRANT-theo-cột của bảng nền. Danh sách `SELECT` của view là nơi thứ hai giữ §E.10, và hiện **không test nào canh**: grep toàn `supabase/tests/` không có dòng nào nhắc `my_shop_orders`; test TS duy nhất (`shop-schema-parity.test.ts:454-463`) chỉ khẳng định view tồn tại + không `security_invoker` + có GRANT ⇒ thêm `buyer_user_id` vào view vẫn xanh toàn bộ suite.

**Việc:**
1. pgTAP vào `supabase/tests/shop_orders.test.sql`, theo đúng khuôn `shop_phase1_rls.test.sql:120-125` đã dùng cho `my_shop_application`:
   - (a) `information_schema.columns` của `my_shop_orders` **không** chứa `buyer_user_id`, `client_token`, `cancelled_by`;
   - (b) `NOT has_table_privilege('anon','public.my_shop_orders','SELECT')`;
   - (c) set `request.jwt.claims` sang buyer A → view **không** trả đơn của buyer B, trong khi `shop_orders` đọc bằng service role thì có.
2. Thêm `WITH (security_barrier = true)` cho view (miễn phí, phòng leaky-view).
3. **Sửa comment sai** ở `src/lib/__tests__/shop-schema-parity.test.ts:456-461`. Hiện viết *"security_invoker would hand the reader's policy back and the view would return the seller's customers again"* — **không đúng**: `security_invoker=on` vẫn áp `WHERE buyer_user_id = auth.uid()` của view, RLS chỉ chồng thêm. Lý do thật để TẮT: với invoker=on Postgres kiểm quyền cột theo người gọi, mà `authenticated` **không** có SELECT trên `buyer_user_id` ⇒ view 42501 cho mọi người. Ghi sai lý do là cách người kế tiếp "sửa" nó thành 42501.

## F3 (NÊN SỬA) — verify câu select thật của `/shop/orders`, và vá gốc `retry`

**(a)** `useMyOrders` (`src/hooks/shop/useOrders.ts:119`) đọc **view** kèm 3 embed PostgREST. Probe A2 (`scripts/qa/order-read-jwt-probe.mjs:45,124`) chỉ trích `ORDER_SELECT` và query **`shop_orders`** — chứng minh trang *chi tiết*, không chứng minh gì về view. Báo cáo vòng 3 nói "đã verify embed → HTTP 200" nhưng không có artifact.
Mở rộng probe: trích `LIST_SELECT` bằng **cùng kiểu regex** đang dùng cho `ORDER_SELECT`, chạy trên `my_shop_orders` bằng JWT buyer thật. **Thêm ca đắt nhất**: một tài khoản **vừa bán vừa mua** đọc view → chỉ ra đơn mình mua, **không** ra đơn khách hàng. Đó chính là lý do view ra đời mà chưa ai đo. Dán output thật.

**(b)** `src/App.tsx:288` `mutations: { retry: 1 }` vô điều kiện. Root cause đã xác nhận trong bytes `@tanstack/query-core` (`canContinue()` gọi `focusManager.isFocused()`; tab ẩn ⇒ retryer pause ⇒ `mutateAsync` không settle). Vòng 3 chỉ vá 6 mutation Shop; grep cho thấy **25 `useMutation` khác trong `src/hooks/shop/`** (application, profile, media, product, moderation, variants, submit, rules) không override ⇒ y hệt cái bẫy. Người bán upload ảnh rồi chuyển tab là kịch bản thường ngày.
Đổi `mutations: { retry: 1 }` thành **đúng predicate không-retry-4xx** mà `queries` đã dùng ở `:280-284`. Giữ nguyên các `retry: false` đã có.
⚠️ Đây là default **site-wide** — sau khi đổi phải chạy **toàn bộ** `npm run test` và soi kỹ test nào phụ thuộc hành vi retry của mutation. Nếu có test đỏ ngoài Shop, báo lại kèm tên file thay vì tự sửa test.

---

## Nghiệm thu vòng 4

```bash
cd /Users/cm10/pickle-hub-pro/.claude/worktrees/shop-phase-3
npx supabase db reset
npx supabase test db --local supabase/tests
PATH="/opt/homebrew/opt/libpq/bin:$PATH" node scripts/qa/db-race.mjs
node scripts/qa/order-read-jwt-probe.mjs <buyer-email> <outsider-email>   # cần fixture up trước
npm run lint
npm run test
npm run build
node scripts/check-bundle-size.mjs
```

| # | Tiêu chí |
|---|---|
| **A55** | `has_column_privilege('authenticated','public.shop_orders','cancelled_by','SELECT') = false`; **ĐỎ trước — XANH sau**, dán cả hai output |
| **A56** | 3 assertion view (cột / anon / buyer-scoping) xanh; view có `security_barrier` |
| **A57** | Comment `security_invoker` ở `shop-schema-parity.test.ts` đã sửa đúng lý do (quyền cột, không phải policy) |
| **A58** | Probe chạy `LIST_SELECT` trên `my_shop_orders` bằng JWT buyer: HTTP 200, đủ embed; **và** tài khoản vừa-bán-vừa-mua chỉ thấy đơn mình mua. Dán output |
| **A59** | `App.tsx` mutations không retry 4xx; `npm run test` toàn bộ xanh; nếu có test đỏ ngoài Shop thì báo tên file, không tự sửa |
| **A60** | A1–A54 không regression: pgTAP ≥ 1618 (47 file), race 225/225, lint 0 error, build + bundle xanh |

Báo cáo: file đã đổi · từng lệnh + output nguyên văn · A55–A60 đạt/không · output đỏ-trước-xanh của F1 · output probe của F3(a) · việc còn treo · xác nhận không commit/push/áp prod.
