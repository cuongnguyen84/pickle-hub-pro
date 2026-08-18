# 02 — Phản biện khả thi kỹ thuật (critic-feasibility)

Đã mở từng file để đối chiếu. Phần lớn khẳng định kỹ thuật của bản phân tích **đúng**, nhưng có 4 chỗ sai và một cái bẫy CI mà nếu không biết sẽ mất vài giờ giữa đêm.

---

## 1. Kiểm chứng từng khẳng định

### Đúng — đã xác minh bằng bytes

| Khẳng định | Bằng chứng |
|---|---|
| `product_variants_guard_stock` chặn UPDATE trực tiếp qua `current_setting('shop.stock_write')` | `supabase/migrations/20260811210000_shop_variants_inventory.sql:357–382`, cơ chế bật/tắt ở `:553–558` |
| `inventory_movements_reason_ok` cần nới | `:426–428` — hiện là `('opening','restock','correction','damage','lost','return','manual')` |
| `product_public_projection(_product_id, _as_seller)` che `stock_on_hand` + `path` | `20260811230000_shop_preview_submit.sql:142`, GRANT anon ở `:560`; test `shop-schema-parity.test.ts:300–302` khoá điều này |
| `social_notifications.type` là TEXT tự do, không CHECK | `20260503140000_social_optionA_tables.sql:78`. Không có trigger AFTER INSERT nào bắn push — "không push" đúng |
| `NOINDEX_PATTERNS` **thiếu toàn bộ route P3** | `functions/_middleware.ts:55–130`. `SHOP_PUBLIC_PATTERNS` (`:133–139`) dùng `$` và segment cụ thể nên `/shop/cart`, `/shop/orders`, `/shop/checkout` không khớp gì cả. Và đúng cả ở chỗ quan trọng: `SHOP_PUBLIC_PATTERNS` phụ thuộc `SHOP_PUBLIC_INDEXING`, nên trang có PII **bắt buộc** phải vào `NOINDEX_PATTERNS` chứ không phải chỗ kia |
| Đính chính bundle | `scripts/check-bundle-size.mjs:45–50` — CODE 1800 / INITIAL 280 / CONTENT 600; Total chỉ report (`:154`). `.github/workflows/quality.yml:96` bật `BUNDLE_STRICT=1` |

### SAI — bốn chỗ

**S1. Bảng §8, dòng "Một route chunk bất kỳ | 150 KB | ... | Có chặn CI" — SAI.**
`check-bundle-size.mjs` không có gate per-route-chunk nào. Cap per-chunk duy nhất là `BUNDLE_CONTENT_CHUNK_KB=20` và chỉ áp cho regex `blog-post-*.js` (`:52`, `:172–174`). Con số 150 KB chỉ nằm ở `docs/perf-budgets.md:51` — tài liệu, không cưỡng chế. Bằng chứng ngược ngay trong repo: comment ở `quality.yml:97` nói `TeamMatchView 241KB chunk` đang tồn tại; nếu gate 150 KB có thật thì CI đã đỏ từ lâu.
→ **Sửa dòng đó thành "Không chặn — chỉ tài liệu".** Vẫn giữ luật "checkout phình >150 KB là dấu hiệu kéo nhầm gì đó", nhưng đừng trông vào CI bắt hộ.

**S2. "Khuôn idempotency ở `product_variant_adjust_stock` — sao chép, không phát minh lại" (§4.3–4.4) mơ hồ ở đúng chỗ chết người.**
`product_variant_adjust_stock` mở đầu bằng `PERFORM public.product_assert_writable(_row.shop_id)` (`:534`), và hàm đó (`20260811200000_shop_product_editor.sql:177–193`) yêu cầu `shop_pilot_has_access()` **AND** `is_shop_manager()`. **Người mua không phải member của shop** → nếu `shop_order_create` gọi lại hàm này thì mọi đơn đều nổ `insufficient_privilege`. (`product_variant_set_stock` cũng đã `REVOKE ALL FROM PUBLIC`.)
→ **Sửa §4.4:** order RPC **tự** `set_config('shop.stock_write','on',true)` + tự UPDATE + tự INSERT ledger trong cùng transaction; **không gọi** `product_variant_adjust_stock`.

**S3. Chỉ cần thêm **một** giá trị vào CHECK, không phải hai.**
`'return'` đã có sẵn trong CHECK. Huỷ đơn/trả hàng hoàn kho dùng lại `'return'`. Chỉ thêm `'sale'`.

**S4. §5 P3a-1: "xoá variant thì dòng giỏ biến mất (FK CASCADE)" — test này vô nghĩa.**
Variant **không bao giờ bị DELETE**: `product_variants_reconcile` retire bằng `retired_at` (`20260811210000:905–917`). Test CASCADE sẽ xanh mà không bảo vệ gì.
→ **Sửa phép thử:** variant bị **retire** → `shop_cart_view` phải trả `unavailable_reason`, và `shop_order_create` phải từ chối.

**S5 (mâu thuẫn nội bộ). Cờ `price_changed` ở giỏ không tính được.**
`cart_items` không có cột giá tham chiếu nào. Không có mốc so thì không có "đã đổi".
→ **Bỏ cờ `price_changed` khỏi giỏ.** Chỗ duy nhất cần bắt đổi giá là lúc tạo đơn, nơi client gửi giá nó đã hiển thị và server so.

---

## 2. Khối lượng — không kịp trong một đêm, không gần

Số đo thật:

- 12 màn prototype P3 = **2 422 dòng** (`src/proto/shop/screens/`)
- 12 trang production Shop hiện có = **4 634 dòng** → hệ số port ≈ **1,9×**
- pgTAP riêng cho P2b = **1 414 dòng** / 4 file, cho một bề mặt **nhỏ hơn** P3

Ước lượng P3 trọn gói: ~4 500 dòng TSX + hooks, ~1 500 dòng migration, ~1 200 dòng pgTAP, cộng entry `MIRRORED` × 2 locale + snapshot + noindex + QA trình duyệt. **13 slice / 6 vòng coder là bất khả thi.** Không phải "rủi ro cao" — là số học.

**Thứ tự §9 sai ở hai chỗ:**

1. §9 xếp **wishlist** hạng 4 rồi kết luận "Giữ" — một mục hy sinh mà không hy sinh thì không phải mục hy sinh. Tệ hơn: nó nằm ở **P3a-3**, tức đốt một vòng coder cho tính năng không dính doanh thu **trước khi** lát cắt quan trọng nhất (P3a-5) được đụng tới.
2. §9 nói "đạt mục tiêu PO hết P3b-3" nhưng lộ trình lại đi qua 8 slice trước đó.

**Thứ tự đề xuất — 6 slice, cắt thẳng phần còn lại:**

| # | Nội dung | Vì sao ở đây |
|---|---|---|
| 1 | `shop_cart_items` + RLS/GRANT + pgTAP | Nền, rẻ nhất |
| 2 | `shop_orders`/`_order_items`/`_order_events` + `shop_order_create` + CHECK `'sale'` + audit category | **Lát cắt duy nhất không được hỏng.** Làm sớm để có thời gian phá nó |
| 3 | `shop_cart_view` + màn Giỏ (B08) | |
| 4 | Checkout + Success (B09/B10) | Chỗ chứng minh "người dùng thao tác được ngay" |
| 5 | `shop_order_transition` + đơn người mua (B11/B12) + huỷ | |
| 6 | Đơn người bán (S08/S09) + noindex + đóng gói gate | |

**Cắt hẳn khỏi đêm nay:** wishlist (P3a-3), đánh giá (P3b-4), trả hàng (P3b-5), khiếu nại/A05 (P3b-6).
Trong báo cáo sáng mai ghi là **"chưa làm"**, không phải "đã thu hẹp phạm vi".

---

## 3. Cái bẫy sẽ làm hỏng đêm nay (giá trị cao nhất trong bản này)

**`check-bundle-size.mjs:199–204` fail build nếu artifact production chứa chuỗi `"Shop bị tạm ngưng"`.**

```js
{ re: /Shop bị tạm ngưng/, what: "prototype scenario switch" },
```

Marker chống lọt prototype (D4), chạy dưới `BUNDLE_STRICT=1` trong CI. Mà slice giỏ hàng yêu cầu đúng kịch bản "shop tạm ngưng", và kế hoạch bảo "viết lại từ `B08Cart.tsx`". Copy nguyên văn câu chữ → gate đỏ với thông báo *"prototype scenario switch in production artifact"*, và người debug lúc 3h sáng sẽ đi tìm import từ `src/proto/` không hề tồn tại.
→ **Sửa:** dùng câu khác cho production (ví dụ *"Shop đang tạm ngưng bán"*). Ba marker còn lại (`tl-proto-banner`, `Bản mẫu — dữ liệu giả lập`, `pickle-gear-sai-gon`) ít rủi ro hơn.

---

## 4. Bỏ sót về mặt kỹ thuật

**B1. Áp migration prod đêm nay (Q10) — câu hỏi đặt sai.**
Preview branch của Cloudflare trỏ vào **cùng project Supabase prod**. Không áp prod thì sáng mai PO mở preview và thấy trang trắng. Q10 là ràng buộc, không phải lựa chọn.
Điều bản phân tích **không nói**: migration áp xong là **PostgREST expose bảng ngay**, bất kể UI đã deploy chưa.
→ Chỉ áp prod **sau khi** pgTAP xanh trên `db reset`; mỗi bảng mới `REVOKE ALL ... FROM anon, authenticated` rồi GRANT theo cột; assert `has_table_privilege` cho `anon` = false trên cả 3 bảng đơn hàng.

**B2. "Script rollback trong PR" (Q10) là hứa hão.**
Rollback bảng đã có đơn thật = `DROP TABLE` = mất đơn. Rollback thật của P3 là **gỡ route ở tầng client**. Ghi một dòng vào `docs/ops-runbook.md`.

**B3. Drift ledger.** `scripts/check-migration-drift.mjs` chạy `DRIFT_STRICT=1`, fail cả hai chiều. → Ledger từng migration **trong cùng phiên**.

**B4. `social_notifications.user_id` FK trỏ `public.profiles(id)`, không phải `auth.users`.**
Người mua chưa có row `profiles` → INSERT thông báo nổ FK → **roll back cả đơn hàng**.
→ `WHERE EXISTS (SELECT 1 FROM profiles ...)` hoặc bọc `EXCEPTION WHEN others THEN NULL`.

**B5. Xoá tài khoản.** `shop_orders.buyer_user_id` phải `ON DELETE SET NULL` (đơn đã snapshot tên/SĐT), **không** CASCADE, **không** RESTRICT (làm vỡ `delete-account`).

**B6. Phí ship đổi giữa chừng.** `shops` sửa được bằng PATCH thẳng. → Thêm `_expected_shipping_fee_vnd` vào `shop_order_create`, gộp vào cùng `IF` với giá.

**B7. `total_vnd` nên là generated column:** `GENERATED ALWAYS AS (items_total_vnd + shipping_fee_vnd) STORED`.

**B8. Hạn 48h (Q5)** phải là cột generated `confirm_due_at`, không tính ở client.

**B9. Gate sẽ đỏ, đã biết trước:** thêm entry vào `MIRRORED` (`src/App.tsx:571`) làm đỏ `route-snapshot.test.ts` + `route-inventory.test.mjs` cho tới khi regenerate snapshot. Và sau khi áp migration prod, `npx supabase gen types` sẽ kéo theo **mọi drift đang có** trong `types.ts`.

**B10. Worktree thiếu `.env` = app treo "Loading…"** — copy trước khi QA.

---

## 5. Ba câu hỏi §11

**(a) COD-only có chặn mất cách bán hàng thật không?**
Kết luận **giữ**, nhưng **lý do trong §6 sai**. Option B′ cấm nền tảng giữ tài khoản **của nền tảng**; số tài khoản **của người bán** thì người bán tự khai, tự nhận tiền — đó chính là B′. Lý do thật để không làm đêm nay: `shop-schema-parity.test.ts:63` **cấm tạo `shop_bank_accounts`**, nên lưu dữ liệu ngân hàng người bán cần chữ ký PO mới.

Rủi ro thật của COD-only mà §6 không nêu: người bán nhỏ ở VN thường đòi cọc chống bom hàng. COD-only + không cọc → shop nội bộ sẽ **không dùng luồng này** mà vẫn gọi Zalo, và P3 chết im lặng. Đây là câu hỏi số 1 cho PO sáng mai.
Đừng "chuẩn bị sẵn" `awaiting_payment` — thêm giá trị enum sau này tốn 3 dòng.

**(b) Gộp dispute vào `order_events` có mất "xem trước hệ quả" của A05 không?**
**Không.** Preview là một hàm read-only `shop_order_dispute_preview(_order_id, _outcome)` trả JSON. Cái thật sự mất là hàng đợi có SLA, nhưng với một shop mà chủ shop **chính là admin**, hàng đợi là `SELECT ... WHERE status='disputed'`.
→ Gộp là đúng, và cắt luôn P3b-6 đêm nay.

**(c) Trừ kho ngay khi tạo đơn — có mở đường đánh sập tồn kho không?**
**Có, và rẻ đến mức đáng lo.** Chi phí kẻ tấn công = một tài khoản.
1. Trong `shop_order_create`: `count(*) FROM shop_orders WHERE buyer_user_id = auth.uid() AND status IN ('pending','confirmed')` > 3 → từ chối. **4 dòng SQL + 1 index.**
2. Siết `cart_items.qty` CHECK từ `1..99` xuống `1..10`.

Không cần reservation TTL, không rate-limit IP, không cron. Nhưng bỏ sót **van xả**: chuyển shop sang `restricted` chặn đơn mới nhưng **không hoàn kho**. → Một dòng runbook: dọn bằng `shop_order_transition(id,'cancel')` từng đơn. **Đừng** viết RPC bulk-cancel đêm nay.

---

## 6. Ponytail — thừa và lười quá mức

### Thừa — bỏ

| Mục | Lý do |
|---|---|
| `wishlist_items.price_at_save_vnd` + nhãn "giá đã đổi từ khi lưu" | Tính năng đẹp không ai xin |
| **Toàn bộ wishlist (P3a-3)** | 1 bảng + 1 route + 2 entry MIRRORED + snapshot + nút trên PDP và ProductCard + hook + test. "Rẻ" ≠ miễn phí |
| `order_events.notify_key` UNIQUE | Dedupe cho luồng gửi **một lần, trong transaction, không job retry**. Thêm khi có job gửi lại |
| `order_events.client_token` | Idempotency đã ở `shop_orders(buyer_user_id, client_token)` + guarded UPDATE. Tầng thứ ba không mua thêm gì |
| Cờ `price_changed` ở giỏ | Không tính được — xem S5 |

### Lười quá mức — sửa

**L1. §5 P3a-1 "RPC: không cần… RLS + GRANT đầy đủ là đủ".**
GRANT đầy đủ trên `cart_items` nghĩa là client tự set `user_id`, và `UPDATE` cho phép đổi `user_id` sang người khác nếu policy chỉ có `USING` mà thiếu `WITH CHECK`.
→ `user_id UUID NOT NULL DEFAULT auth.uid()`, policy có **cả** `USING` **và** `WITH CHECK`, GRANT `UPDATE (qty)` theo cột. Một assertion `has_table_privilege` cho mỗi cái.

**L2. `shop_cart_view` gọi `product_public_projection` trong vòng lặp** = N lần. Chấp nhận được ở pilot, nhưng phải **ghi trần**:
`-- ponytail: N+1 projection, gộp thành một query khi giỏ > 50 dòng`

**L3. §7 "chuyển shop sang `restricted` là đã chặn đơn mới" được viết như sự thật đã có.** Nó **chưa có**. → Chuyển sang §4 (bất biến bắt buộc, có pgTAP): *shop không `active` → `shop_order_create` từ chối.*

---

## 7. Ba điều nên giữ nguyên, không bàn lại

- **Không edge function nào cho P3.** Tránh sạch bẫy ES256/HS256.
- **Không bảng `payments`/`shipments`/`returns`/`disputes` riêng.**
- **Noindex vô điều kiện cho route có PII.** Phải sống sót kể cả khi đêm nay chỉ làm được 3 slice.
