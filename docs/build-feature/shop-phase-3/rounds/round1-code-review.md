# CODE REVIEW VÒNG 1 (prompt-engineer + Codex CLI 0.147.0, read-only)

## VERDICT: **CHƯA ĐẠT**

Codex đọc trực tiếp file trong worktree. prompt-engineer xác minh lại từng claim bằng file thật: **bác 2 claim, giữ 5, thêm 1 lỗi Codex bỏ sót**. Lỗi nặng nhất không phải bug logic trong RPC — mà là **vòng này tự tạo ra một lỗi production mới cho mọi người mua**, và bài test A26 được viết đúng cách để không nhìn thấy nó.

---

## 1. Phát hiện

### CHẶN

**C1 — `shop_order_create` làm `delete-account` vỡ vĩnh viễn cho mọi người mua; A26 xanh giả.**
`20260818100000_shop_orders.sql:850-858` ghi ledger với `actor_user_id = _uid` (uid **người mua**). Mà `20260811210000_shop_variants_inventory.sql:419` là `actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL`, và `inventory_movements_append_only()` (~469) `RAISE insufficient_privilege` **vô điều kiện** khi `TG_OP='UPDATE'`. Xoá user ⇒ FK sinh UPDATE ⇒ trigger chặn ⇒ `supabase/functions/delete-account/index.ts:156` (`auth.admin.deleteUser`) thất bại.
Coder ĐÃ biết cơ chế này (nên mới bỏ FK ở `shop_order_events`, §F.2) nhưng vẫn để `shop_order_create` ghi uid người mua vào ledger cũ. Trước vòng này chỉ shop-member dính; sau vòng này **mọi người mua mua một variant có đếm tồn đều dính**.
A26 (`shop_orders.test.sql:654-672`) không bắt được vì đơn `o6` dùng variant `01220002…` có `stock_on_hand = NULL` (`:100-102`) ⇒ `CONTINUE WHEN … IS NULL` (migration `:839`) ⇒ **không sinh dòng ledger nào** ⇒ `DELETE FROM auth.users` chạy trơn.
**Sửa:** (a) nới `IF TG_OP='UPDATE'` của 4 trigger append-only cho qua đúng trường hợp chỉ null hoá actor; (b) A26 phải đặt đơn bằng variant **có** đếm tồn.

**C2 — `buyer_user_id` vẫn ra REST, qua cột khác.** *(Codex bỏ sót; prompt-engineer tìm ra)*
`20260818100000:412-414` `GRANT SELECT (…, actor_user_id, …) ON public.shop_order_events TO authenticated`, policy `:387-390` cho mọi party đọc — kể cả `support` và mọi shop member. Event `create` có `actor_user_id` = **uid người mua** (`:862-865`). Bất biến §E.10 bị phá bằng một cột khác; A19 (`shop_orders.test.sql:186-187`) chỉ canh `shop_orders.buyer_user_id` nên xanh.
**Sửa:** bỏ `actor_user_id` khỏi GRANT ở `:413` (miễn phí — `shop_order_json` không trả cột này, UI đọc `metadata->>'actor_kind'`), thêm assertion `has_column_privilege(...) = false`.

### NÊN SỬA

**N1 — Huỷ đơn có thể phồng kho.** `:1050-1074` hoàn kho cho mọi item có `stock_on_hand` hiện tại khác NULL. Nếu lúc tạo đơn variant là NULL (không trừ, không ledger) rồi người bán bật đếm tồn, cancel vẫn `+qty` ⇒ sổ lệch. **Sửa:** chỉ hoàn khi tồn tại dòng `sale` của chính đơn đó.

**N2 — Trần 5 đơn pending thua race.** `:661-667` là `SELECT count(*)` rồi INSERT; unique `(buyer_user_id, client_token)` không giúp vì hai request dùng token khác nhau ⇒ có thể thành 6. **Sửa:** `PERFORM pg_advisory_xact_lock(hashtext('shop_order_create:'||_uid::text));`

**N3 — Payload sai kiểu thoát khỏi hợp đồng lỗi.** `:698` `(_e->>'qty')::int` và `:750` không có handler: `{"qty":"abc"}` → `22P02`, số tràn → `22003`; recipient sai → `23514` từ CHECK. Client vòng 2 switch trên `reason` nên rơi vào nhánh "lỗi lạ". **Sửa:** bọc parse + validate chủ động, raise `22023`/`invalid_payload` + `field`. Giữ nguyên CHECK.

**N4 — DROP/ADD CHECK trên `audit_logs` + `inventory_movements` có rủi ro drift prod.** `:141-158`. Danh sách khớp bản mới nhất trong git nên **cục bộ an toàn**, nhưng repo drift kinh niên (10 migration áp qua Management API không vào git). **Sửa:** trước khi áp prod chạy `SELECT DISTINCT …` đối chiếu. Không phải sửa code — là bước bắt buộc trước D10.

**N5 — 3 test bảo vệ nhầm chỗ nối.**
- `shop-schema-parity.test.ts:495-500`: slice từ đầu `shop_order_create` **đến hết file** ⇒ `set_config(...)` ở `shop_order_transition` cũng làm test xanh dù create đánh mất nó.
- cùng file `:450-454`: regex `GRANT[^;]*ON public\.<table>\s+TO` khớp cả GRANT chỉ cho `service_role`.
- `orderState.test.ts:185-204`: chỉ kiểm từ khoá có mặt trong khối CASE; đổi `pending --ship--> shipped` vẫn xanh.

### GHI NHẬN

**G1 —** `shops`/`products` đọc mà không khoá (`:728`, `:758`) ⇒ tắt `ordering_enabled` đúng lúc checkout thì đơn vẫn qua. Cửa sổ mili giây, hậu quả lành.
**G2 —** Trùng `variant_id` bắt bằng `count(DISTINCT e->>'variant_id')` (text) — hai cách viết hoa/thường của cùng UUID lọt qua rồi chết ở unique với `23505`. Rất hiếm.
**G3 —** `NOTIFY pgrst, 'reload schema'` cuối cả hai file — đúng convention repo, nhưng nhớ PGRST002 02/08: **đừng áp prod trong giờ livestream**.
**G4 — Codex soi và KHÔNG thấy vấn đề, prompt-engineer đọc lại và đồng ý:** thứ tự khoá tăng dần (`:682-685` → `:712-726`) · không gọi `product_variant_adjust_stock` · `set_config(..., true)` đúng scope transaction · nhánh `unique_violation` SELECT lại đơn cũ và trả về (`:811-816`) · `items_total` cộng từ giá vừa khoá (`:783`) · `shop_order_json` không mang `buyer_user_id`/`client_token` · guarded UPDATE + `FOR UPDATE` đơn (`:966`, `:1029-1039`) chặn hoàn kho hai lần · `support` bị loại đúng (`:975-985`) · `no_data_found` bắt **theo từng dòng** (`:532-538`) · đủ 5 `unavailable_reason` · A20 GRANT thật rồi chứng minh trigger vẫn ném · A23 đếm thẳng `shop_cart_items.variant_id` · Race 5 dùng đúng barrier advisory lock và bắt được cả trường hợp hai racer cùng thắng · `ROUNDS*13` khớp.

### Bác 2 điểm Codex chấm nặng tay
- Codex xếp N3 là CHẶN → hạ xuống NÊN SỬA: bảng mã lỗi đã chốt chỉ phủ *rỗng / trùng variant / qty ngoài 1..10 / nhiều shop*; sai kiểu và `recipient_*` không nằm trong hợp đồng, và đề bài **yêu cầu** validation nằm ở CHECK. Là nợ UX vòng 2.
- Codex nói "cần khoá shop/product" như một race thật → không: điều kiện bán được kiểm sau khi khoá variant.

---

## 2. Xác minh 2 khẳng định của coder

**(a) `shops_guard_privileged_columns()` — ĐÚNG.** Bản nộp (`20260818100000:100-134`) so với `20260811180000_shop_profile.sql:84-116`: giữ nguyên nhánh admin, ghim `state`/`owner_user_id`/`verified_method`/`verified_at`/`created_at`, giữ **nguyên vẹn** cửa thoát `shop.slug_write`, giữ `NEW.updated_at := now()`. Khác biệt chức năng đúng **một dòng**: `NEW.ordering_enabled := OLD.ordering_enabled;` (`:120`). `shipping_fee_vnd` cố ý không ghim — đúng D3. Không hồi quy.

**(b) FK + trigger append-only làm vỡ `delete-account` — ĐÚNG, và coder còn nói THIẾU.** Không phải 2 bảng mà **4**:

| Bảng | FK | Trigger chặn UPDATE |
|---|---|---|
| `inventory_movements` | `20260811210000:419` | cùng file, ~469 |
| `product_moderation_events` | `20260812091000:153` | `20260812120000:355-370` |
| `product_submission_events` | `20260811230000:59` | cùng file, `:89-108` |
| `shop_contact_moderation_events` | `20260812120000:290` | cùng file, `:330-350` |

(`shop_application_events` `20260811090000:299` có FK nhưng **không** có trigger ⇒ an toàn.)
Hôm nay chỉ ảnh hưởng admin + pilot seller nên chưa ai kêu; **sau vòng này lan ra mọi người mua** (C1). Bug production thật, cần migration 4-trigger riêng — phải làm **trước hoặc cùng lúc** với S2.

---

## 3. Idempotent khi áp lần hai — **CÓ**

`CREATE TABLE IF NOT EXISTS` (cart `:31`; orders `:184`/`:253`/`:275`) · `ADD COLUMN IF NOT EXISTS` (`:69`, `:73`) · CHECK `shops_shipping_fee_non_negative` bọc `DO $$ IF NOT EXISTS (pg_constraint) $$` (`:75-81`) · 3 constraint thay thế đều `DROP CONSTRAINT IF EXISTS` trước `ADD` (`:141-158`) · mọi `CREATE INDEX IF NOT EXISTS` · mọi policy `DROP POLICY IF EXISTS` · trigger `DROP TRIGGER IF EXISTS` · hàm `CREATE OR REPLACE` · REVOKE/GRANT vốn idempotent. Cảnh báo duy nhất là N4 (drift prod), không phải reapply.

---

## 4. Test trình duyệt

**KHÔNG CÓ TEST CASE TRÌNH DUYỆT Ở VÒNG NÀY** — diff chỉ gồm 2 migration SQL, 2 file pgTAP, 1 module TS thuần, harness Node và test parity; `git diff --stat` không chạm `src/pages/`, `src/components/`, `src/App.tsx` hay `functions/` (A29 đạt), nên không có route nào để `tester` mở bằng Chrome.

---

**Bất đồng đáng ghi:** Codex và prompt-engineer khác nhau ở mức độ N3 (Codex chấm CHẶN) và ở C2 (Codex bỏ sót hoàn toàn). Cả hai đều độc lập kết luận A26 là xanh giả — phát hiện đáng giá nhất của vòng này: báo cáo coder tự chấm 29/29, nhưng đúng cái test canh "xoá tài khoản" lại được viết bằng một variant không sinh ra dữ liệu để mà vướng.

Prompt sửa lỗi: xem `round2-prompt.md`.
