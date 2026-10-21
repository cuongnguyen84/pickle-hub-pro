# CODE REVIEW VÒNG 3 — BƯỚC A (prompt-engineer + Codex CLI 0.147.0, read-only)

## VERDICT (code review): **CHƯA ĐẠT**

Test case trình duyệt **đã có** (11 TC vòng 3), `tester` đang chạy — không soạn thêm.

Codex đọc trực tiếp file trong worktree. prompt-engineer xác minh lại từng claim bằng bytes: **giữ 2 CHẶN, hạ 3 claim của Codex xuống GHI NHẬN, thêm 2 phát hiện Codex bỏ sót**. Lỗi nặng nhất vòng này do prompt-engineer tìm ra trước và Codex xác nhận độc lập — **cùng một lỗ §E.10 tái xuất lần thứ ba dưới tên cột thứ ba**.

---

## 1. Phát hiện

### CHẶN

**C1 — `cancelled_by` là UUID `auth.users` và ĐANG được GRANT cho `authenticated`. Rò danh tính, đúng thứ §E.10 cấm.**
`20260818100000_shop_orders.sql:214` khai `cancelled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL`; `:1092` gán `cancelled_by = _uid` cho **mọi** actor huỷ (kể cả người mua); `:403` đưa cột vào GRANT SELECT cho `authenticated`. Vòng 3 nhân bản nó ra object mới: `20260818120000:203` đưa cột vào view `my_shop_orders`.

Trớ trêu: comment ngay trên GRANT (`:396-398`) viết *"buyer_user_id and client_token are absent from every one of them: the first is somebody's identity… A seller recognises the buyer from the snapshot on the order"* — rồi 5 dòng sau liệt kê chính danh tính đó.

**Hại thật, không lý thuyết:** `20260504100000_profiles_authenticated_view_all.sql` cho **mọi** user đăng nhập SELECT toàn bộ `profiles`, mà `profiles.id` = auth uid ⇒ shop lấy `cancelled_by` → tra `profiles` → ra hồ sơ công khai đầy đủ của khách (tên thật, avatar, DUPR), vượt xa "tên + SĐT đã snapshot". Chiều ngược lại: người mua đọc được uid của nhân viên shop/admin đã huỷ đơn.

**Sửa (diff nhỏ):** bỏ `cancelled_by` khỏi GRANT `20260818100000:403` (migration **chưa lên prod** nên sửa tại chỗ hợp lệ) + bỏ khỏi cột view `20260818120000:203` + bỏ khỏi `ShopOrderRow` (`shop-schema.ts:605`, `Omit` `:645` thành thừa) + pgTAP `has_column_privilege('authenticated','public.shop_orders','cancelled_by','SELECT') = false`. **UI không cần đổi dòng nào**: `Orders.tsx:89` và `SellerOrderDetail.tsx:198` đã đọc `metadata->>'actor_kind'`; `ORDER_SELECT`/`LIST_SELECT` không xin cột này.

**C2 — View `my_shop_orders` bỏ qua RLS **và** bỏ qua GRANT-theo-cột, nhưng không có test nào canh danh sách cột của nó.**
`20260818120000:198-206` tạo view không `security_invoker` ⇒ chạy dưới quyền owner ⇒ **cả hai** hàng rào của bảng nền (policy `shop_orders_select_party` + GRANT theo cột) đều không áp dụng; thứ duy nhất quyết định cái gì ra ngoài là danh sách `SELECT` của view. Đây là nơi §E.10 giờ được giữ **lần thứ hai, độc lập** — và không có gì canh.
Grep toàn `supabase/tests/`: **không dòng nào** nhắc `my_shop_orders`. Test TS duy nhất (`shop-schema-parity.test.ts:454-463`) chỉ khẳng định view tồn tại, không có chữ `security_invoker`, và có GRANT — thêm `buyer_user_id` vào view vẫn **xanh toàn bộ**.
**Sửa:** pgTAP trong `shop_orders.test.sql` theo khuôn `shop_phase1_rls.test.sql:120-125`: (a) `information_schema.columns` không chứa `buyer_user_id`/`client_token`/`cancelled_by`; (b) `NOT has_table_privilege('anon','public.my_shop_orders','SELECT')`; (c) set `request.jwt.claims` sang buyer A rồi assert view **không** trả đơn của buyer B trong khi bảng nền thì có.

### NÊN SỬA

**N1 — Câu select của `/shop/orders` chưa từng chạy thật, và nó quyết định cả màn hình.**
`useMyOrders` (`useOrders.ts:119`) đọc **view** kèm 3 embed PostgREST. Probe A2 (`order-read-jwt-probe.mjs:45,124`) chỉ trích `ORDER_SELECT` và query **`shop_orders`** — chứng minh trang *chi tiết*, không chứng minh gì về view. Báo cáo coder viết "Đã verify PostgREST embed được từ view → HTTP 200" nhưng **không artifact, không script, không output**. Nếu PostgREST không suy được quan hệ FK từ view thì `/shop/orders` là PGRST200 cho 100% người dùng.
Codex tra tài liệu: embed từ view **có** được hỗ trợ khi cột khoá nằm trong SELECT top-level (view giữ cả `id` lẫn `shop_id`, `:199`) ⇒ nhiều khả năng chạy. *Nhiều khả năng*, không phải *đã chứng minh*.
**Sửa:** thêm nhánh vào probe — trích `LIST_SELECT` cùng kiểu regex, query `my_shop_orders` bằng JWT buyer, **và thêm assertion đắt hơn**: người bán (là member shop, đồng thời có đơn mua của chính họ) đọc view chỉ ra đơn **mình mua**, không ra đơn khách. Đó chính là lý do view ra đời mà chưa ai đo. (TC của tester trả lời câu 200/PGRST200; **không** trả lời câu buyer-scoping.)

**N2 — `retry: false` là fix đúng nhưng vá theo call site; gốc còn nguyên và Shop còn ~25 mutation dính.**
Giả thuyết root cause **đúng** — đọc bytes `node_modules/@tanstack/query-core/build/modern/retryer.js`: `canContinue = () => focusManager.isFocused() && …`, và `isFocused()` chỉ đọc `document.visibilityState !== "hidden"`; `sleep(delay).then(() => canContinue() ? void 0 : pause())` ⇒ tab ẩn ⇒ pause vô hạn ⇒ `mutateAsync` không settle. Khớp triệu chứng TC10. Cộng thêm: tab ẩn còn bị Chrome throttle `setTimeout` xuống ~1 phút.
Nhưng gốc là `src/App.tsx:288` `mutations: { retry: 1 }` vô điều kiện. Grep: **25 `useMutation` khác trong `src/hooks/shop/`** (application, profile, media, product, moderation, variants, submit, rules) **không** override ⇒ y hệt cái bẫy. Người bán upload ảnh rồi chuyển tab là kịch bản thường ngày.
**Sửa (1 dòng, đúng chỗ mọi caller đi qua):** đổi `mutations: { retry: 1 }` thành cùng predicate `queries` đã dùng ở `:280-284` — không retry 4xx. Coder đề nghị task riêng; review **không đồng ý để mở**: sửa 6 call site rồi bỏ 25 cái là bản chất "vá triệu chứng ở từng caller".

### GHI NHẬN

**G1 — Lý do ghi trong test về `security_invoker` là SAI, dù quyết định thì đúng.** *(Codex bỏ sót)*
`shop-schema-parity.test.ts:456-461` giải thích *"security_invoker would hand the reader's policy back and the view would return the seller's customers again"* — không đúng: `security_invoker=on` **vẫn** áp `WHERE buyer_user_id = auth.uid()` của view, RLS chỉ chồng thêm. Lý do thật để nó phải TẮT: với invoker=on, Postgres kiểm quyền cột theo người gọi, mà `authenticated` **không** có SELECT trên `buyer_user_id` ⇒ view 42501 cho mọi người. Ghi sai lý do là cách người kế tiếp "sửa" nó thành 42501.

**G2 — `security_barrier`: đáng thêm, hạ mức so với Codex.** `authenticated` không có CREATE trên schema `public`, và PostgREST chỉ sinh qual dạng `cột op hằng` trên đúng cột view phơi ra ⇒ không có phương tiện tấn công cụ thể. Vẫn nên thêm vì miễn phí.

**G3 — `sortSellerOrders` ĐÚNG, khẳng định của coder đứng vững.** Không tìm được phản ví dụ: mọi `pending` quá hạn có `due < now`, mọi `pending` còn hạn có `due > now` ⇒ sắp toàn bộ pending theo `due` tăng dần **chính xác bằng** nhóm (1) rồi (2). Codex kết luận độc lập y hệt. Edge duy nhất: `ms()` trả `+Infinity` khi parse lỗi ⇒ `Infinity - Infinity = NaN` (`sellerOrders.ts:43-44`); hai cột đều `NOT NULL` nên không phát sinh.

**G4 — `product_public_projection` KHÔNG mất nhánh nào.** Diff cơ học thân hàm cũ với bản mới: đúng **2 khoá thêm** và **3 khối comment bị xoá**. `stock_on_hand` vẫn `CASE WHEN _as_seller … ELSE 'null'::jsonb`, `path` vẫn che, `AND (_as_seller OR m.public_path IS NOT NULL)` vẫn còn, nhánh `_as_seller`/`no_data_found` nguyên vẹn. Chỉ tiếc: 3 comment bị xoá chính là cảnh báo cho người `CREATE OR REPLACE` lần sau — nên chép lại.

**G5 — A47/A48 coder khai "đạt một phần" là ĐÚNG.** `Chưa thanh toán` chỉ ở `SocialEventRoster.tsx:536` + `i18n/vi.ts:4968,5796` — ngoài Shop, có từ trước. `.select("*")` còn ở 4 hook trên `shops`/`shop_applications`/`product_media`, **không** trên 3 bảng đơn. Grep trong đề bài rộng hơn quy tắc thật — không phải lỗi của coder.

**G6 — Double-submit: hạ mức so với Codex.** `Checkout.tsx:563` khoá bằng `disabled={busy||blocked}` + `aria-busy`; nếu lọt hai request thì `client_token` làm create idempotent, transition thì guarded UPDATE trả `stale_status`. DB chặn cả hai.

**G7 — `shop_last_shipping_address()` sạch.** `SECURITY DEFINER` + `SET search_path`, không tham số, lọc thẳng `auth.uid()`, EXECUTE chỉ `authenticated`/`service_role`, 4 assertion pgTAP trong đó ca "chủ shop đọc được đơn khách nhưng không được prefill" là ca đắt. Prefill dùng `f.name || prefill.…` nên không ghi đè chữ đã gõ.

**G8 — a11y nhỏ ở `Orders.tsx:216-232`:** `role="tablist"` + `aria-controls="orders-list"` nhưng `#orders-list` là `<section>` không có `role="tabpanel"`. Lệch khuôn ARIA, không sai chức năng.

---

## 2. Bất đồng giữa Codex và prompt-engineer

Codex **xác nhận độc lập** C1 và C2. Nhưng chấm nặng tay ở 3 chỗ đã hạ: `security_barrier`, double-submit, và `DROP VIEW/CREATE VIEW` "không idempotent an toàn" (không object nào phụ thuộc; GRANT cấp lại 15 dòng sau trong cùng transaction). Ngược lại Codex **bỏ sót G1** — comment giải thích sai lý do nằm ngay trong file test được coi là hàng rào.

---

## 3. Rủi ro khi áp 4 migration Phase 3 lên production

**Thứ tự bắt buộc, không đảo:** `20260818090000` (cart) → `20260818100000` (orders; thêm `shops.ordering_enabled` + `shipping_fee_vnd`) → `20260818110000` (append-only) → `20260818120000` (projection + address + view). `120000` đọc hai cột do `100000` tạo ⇒ chạy trước là lỗi ngay.

**Phải kiểm TRƯỚC khi áp:**
- `20260818100000` **DROP rồi ADD CHECK** trên hai bảng production đang chạy. Chạy trước `SELECT DISTINCT event_category FROM audit_logs` và `SELECT DISTINCT reason FROM inventory_movements`, đối chiếu danh sách trong file. Một giá trị prod thiếu = ADD CONSTRAINT nổ giữa chừng, lúc đó CHECK cũ đã bị DROP.
- `20260818120000` `CREATE OR REPLACE product_public_projection` **ghi đè một đường đọc công khai đang sống** (mọi trang sản phẩm `/shop`). Trước khi áp, dump `pg_get_functiondef` trên prod và so với `20260813090000` — nếu prod đã drift, migration này im lặng nuốt bản drift.
- Cả 4 file kết bằng `NOTIFY pgrst, 'reload schema'` ⇒ **không áp trong giờ livestream** (PGRST002 02/08).
- Ledger `DRIFT_STRICT=1` cần đủ cả 4 file.

**Không rollback được / rollback đắt:**
- `20260818110000` `CREATE OR REPLACE` **4 hàm trigger đang phục vụ Phase 1/2a**. Thân sai làm hỏng ngay luồng kho + duyệt sản phẩm đang chạy, và không có bản cũ nào lưu trong migration — phải `pg_get_functiondef` **trước** khi áp và cất lại 4 định nghĩa cũ.
- CHECK constraint bị DROP: định nghĩa cũ mất luôn nếu không dump trước.
- Ba bảng mới rollback rẻ (DROP) — **nhưng sau khi có đơn thật thì không**.

**Ưu tiên:** áp F1 (bỏ `cancelled_by` khỏi GRANT) **trước** khi `20260818100000` chạm prod — sau đó cột đã ra REST rồi thì phải thêm một migration REVOKE nữa, và mọi client đã đọc được cột trong khoảng thời gian đó.

---

## 4. Việc Cuong nên tự kiểm bằng mắt

Cảm nhận thứ tự đơn ở `/seller/orders` trên máy thật (dòng quá hạn có "nhảy vào mắt" không, hay chỉ đúng về logic), và độ dài câu việc-cần-làm ở `/shop/orders` trên iPhone 375px — máy đo được không tràn ngang, không đo được nó có dễ đọc không.

Prompt sửa lỗi: xem `round4-prompt.md`.
