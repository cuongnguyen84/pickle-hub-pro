# 02 — Bản phân tích đã chốt (orchestrator tổng hợp)

Hai agent phản biện **không mâu thuẫn nhau ở điểm nào quan trọng**. Chúng bổ sung nhau:
critic-feasibility bắt 5 sai sót thực tế + 1 bẫy CI + cắt phạm vi bằng số học;
critic-user bắt 6 lời hứa nền tảng không giữ được + 8 lỗ hổng luồng.
Không có điểm nào cần PO quyết ngay trong đêm → đi tiếp theo bản chốt dưới đây.

---

## A. Phạm vi ĐÊM NAY — 6 lát cắt, không hơn

critic-feasibility đo được: 12 màn prototype = 2 422 dòng, hệ số port sang production ≈ 1,9×,
pgTAP P2b = 1 414 dòng cho bề mặt nhỏ hơn. 13 slice là **bất khả thi về số học**, không phải "rủi ro cao".

| # | Lát cắt | Nội dung |
|---|---|---|
| **S1** | Nền giỏ hàng | `shop_cart_items` + RLS/GRANT theo cột + pgTAP |
| **S2** | **Lõi đơn hàng** | `shop_orders` / `shop_order_items` / `shop_order_events` + `shop_order_create` + công tắc `ordering_enabled` + pgTAP race/idempotency |
| **S3** | Giỏ hàng | `shop_cart_view` + trang `/shop/cart` (B08) + nút Thêm vào giỏ trên PDP |
| **S4** | Đặt hàng | `/shop/checkout/:shopSlug` (B09) + `/shop/order/:code` (B10) |
| **S5** | Đơn người mua | `shop_order_transition` + `/shop/orders` (B11) + chi tiết đơn (B12) + huỷ + "Tôi đã nhận hàng" |
| **S6** | Đơn người bán + đóng gói | `/seller/orders` (S08/S09) + **noindex** + types + MIRRORED + snapshot + ledger + gate |

### CẮT HẲN khỏi đêm nay — báo cáo ghi là "CHƯA LÀM", không phải "đã thu hẹp"

- **Wishlist (B07)** — 1 bảng + 1 route + 2 entry MIRRORED + snapshot + nút trên PDP và ProductCard + hook + test, cho 0 doanh thu. Cả hai critic đồng ý.
- **Đánh giá (B15)** — tốn gấp 3–4 lần công và **không có nội dung nào để hiển thị** cho tới khi có người mua nhận hàng thật, sớm nhất vài ngày sau.
- **Trả hàng (B13)** — thay bằng: người mua bấm nút liên hệ shop có sẵn trên chi tiết đơn; admin chuyển trạng thái kèm lý do.
- **Khiếu nại / A05 (B14)** — với đúng một shop mà chủ shop **chính là** admin, khiếu nại là một cuộc gọi Zalo. Thay bằng: admin có quyền thực hiện mọi transition kèm lý do + audit.

**Điều kiện an toàn để cắt 2 mục cuối** (critic-user, bắt buộc): nút liên hệ shop (`usableContacts`, đã có từ P2b)
phải hiện trên **mọi trạng thái đơn**, cả phía mua lẫn phía bán. Không có nó thì cắt dispute = bỏ rơi người dùng.

---

## B. Sửa lại 5 khẳng định sai của bản phân tích

| # | Sai | Đúng |
|---|---|---|
| S1 | "gate CI chặn route chunk 150 KB" | **Không có gate đó.** Chỉ CODE 1800 / INITIAL 280 / CONTENT 600 chặn. 150 KB chỉ là tài liệu (`docs/perf-budgets.md:51`) |
| S2 | "gọi lại `product_variant_adjust_stock`" | **Nổ `insufficient_privilege`** — hàm đó `PERFORM product_assert_writable()` yêu cầu `is_shop_manager()`; người mua không phải member. RPC đơn hàng **tự** `set_config('shop.stock_write','on',true)` + tự UPDATE + tự INSERT ledger |
| S3 | "thêm `'sale'` và `'order_cancel'` vào CHECK" | `'return'` **đã có sẵn** → chỉ thêm `'sale'`; huỷ đơn hoàn kho dùng lại `'return'` |
| S4 | "test FK CASCADE khi xoá variant" | Variant **không bao giờ bị DELETE** (retire bằng `retired_at`). Test đúng: variant retired → `shop_cart_view` trả `unavailable_reason`, `shop_order_create` từ chối |
| S5 | cờ `price_changed` ở giỏ | **Không tính được** (giỏ không lưu giá tham chiếu) → **bỏ**. Bắt đổi giá ở đúng một chỗ: lúc tạo đơn, client gửi giá nó đã hiển thị, server so |

## C. ⚠️ Bẫy sẽ làm hỏng đêm nay — đọc trước khi viết trang giỏ hàng

`scripts/check-bundle-size.mjs:199–204` **fail build** nếu artifact production chứa chuỗi `"Shop bị tạm ngưng"`
(marker chống lọt prototype D4, chạy `BUNDLE_STRICT=1` trong CI).
Trang giỏ hàng cần đúng kịch bản đó → **dùng câu khác**: `"Shop đang tạm ngưng bán"`.
Ba marker còn lại cần tránh: `tl-proto-banner`, `Bản mẫu — dữ liệu giả lập`, `pickle-gear-sai-gon`.

---

## D. Quyết định sản phẩm đã chốt (thay cho Q1–Q10)

| # | Quyết định | Ghi chú |
|---|---|---|
| **D1** | **Công tắc `shops.ordering_enabled boolean NOT NULL DEFAULT false`** | Nút Thêm vào giỏ/Đặt hàng ẩn khi false; `shop_order_create` từ chối khi false. PO bật bằng **một dòng SQL** sau khi nghiệm thu sáng mai. Đây cũng là nút tắt khẩn cấp — không dùng `restricted` (làm shop biến mất khỏi catalog) |
| **D2** | **Thanh toán: `cod` (mặc định) + `bank_transfer`** | `bank_transfer` = "Chuyển khoản trước — shop sẽ gửi thông tin", trang thành công hiện nút Zalo/gọi của shop. **Không cột ngân hàng, không QR, không đối soát tự động, không trạng thái `awaiting_payment`.** Hai phương thức hành xử **y hệt nhau** về trạng thái. Lý do không lưu tài khoản người bán: `shop-schema-parity.test.ts:63` cấm tạo `shop_bank_accounts` — cần chữ ký PO mới |
| **D3** | **Phí ship: `shops.shipping_fee_vnd integer NOT NULL DEFAULT 0`**, snapshot vào đơn | Hiển thị **"Miễn phí"** khi = 0, **tuyệt đối không** render "0đ" hay "—". Kèm dòng "Phí này áp dụng cho mọi tỉnh thành". Seed 30 000đ cho shop nội bộ để không ai gặp trạng thái 0. `_expected_shipping_fee_vnd` là tham số bắt buộc của `shop_order_create` (người bán PATCH đổi phí giữa chừng được) |
| **D4** | **Địa chỉ: KHÔNG có dropdown tỉnh/thành** | Repo không có danh sách tỉnh chuẩn (`VENUE_CITIES` là danh sách **thành phố có sân**, không phải đơn vị hành chính, và không phải bản sau sáp nhập 2025). Ship nhầm danh sách cũ là thứ người dùng nhận ra ngay. → Một ô địa chỉ free-text với nhãn + placeholder ép đủ cấp: *"Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành"* + ví dụ mẫu, cộng ô "Ghi chú cho người giao" không bắt buộc. Người bán gõ lại vào GHN/GHTK nên free-text là đủ — bù lại bằng nút **Sao chép địa chỉ** ở S09 |
| **D5** | **Người mua huỷ tự do khi đơn `pending`**; sau khi shop xác nhận thì liên hệ shop | Không có "đề nghị huỷ" chờ duyệt — thêm một trạng thái chờ mà không có ai gác là thêm chỗ để đơn mắc kẹt |
| **D6** | **Bỏ đếm ngược 48h phía người mua** | Thay bằng "Shop thường trả lời trong 1–2 ngày" + nút Huỷ đơn luôn hiện khi `pending`. Giữ `confirm_due_at` (generated column) + sắp quá hạn lên đầu **chỉ ở phía người bán**, nơi nó là công cụ làm việc thật. **Không** có job tự huỷ ⇒ không được viết câu nào hứa có |
| **D7** | **Người mua cũng bấm được "Tôi đã nhận hàng"** | S09 hứa "hoặc sau 7 ngày" — không có cron thì vế đó không tồn tại và đơn treo vĩnh viễn. Thêm một actor vào một transition đã có: 0 bảng, 0 cron |
| **D8** | **Giới hạn 5 đơn `pending`/người mua** + `qty` CHECK 1..10 | Chặn đánh sập tồn kho: chi phí kẻ tấn công = một tài khoản. 4 dòng SQL + 1 index, thay cho cả hệ thống giữ chỗ có TTL |
| **D9** | **Chủ shop tự mua của mình: KHÔNG chặn** | Sáng mai PO phải tự đặt một đơn thử để nghiệm thu. (Điều kiện `buyer <> owner` chỉ cần khi có đánh giá — mà đánh giá đã cắt) |
| **D10** | **Áp migration thẳng production sau khi pgTAP xanh** | Preview Cloudflare trỏ vào **cùng project Supabase prod** ⇒ không áp thì sáng mai PO thấy trang trắng. Đây là ràng buộc, không phải lựa chọn. Rollback thật = **revert commit frontend**, schema ở lại (DROP bảng có đơn thật = mất đơn). Ledger từng migration **trong cùng phiên** — drift là bệnh kinh niên của repo |

---

## E. Bất biến bắt buộc — Postgres giữ, mỗi dòng có pgTAP

1. **Tiền = `integer` VND.** `total_vnd` là **generated column** `GENERATED ALWAYS AS (items_total_vnd + shipping_fee_vnd) STORED` — DB giữ bất biến thay vì tin RPC. Không bao giờ nhận tổng từ client.
2. **Tạo đơn = một transaction**: `SELECT ... FOR UPDATE` trên variant → kiểm lại (product `approved` + published, shop `active` **và** `ordering_enabled`, giá khớp `_expected_unit_price_vnd`, phí ship khớp `_expected_shipping_fee_vnd`, đủ tồn, variant chưa `retired_at`) → INSERT `shop_orders` + `shop_order_items` (snapshot bất biến) → trừ kho + ledger `reason='sale'` → xoá dòng giỏ của đúng shop đó. Hoặc tất cả, hoặc không gì.
3. **Idempotency**: unique `(buyer_user_id, client_token)`. Gọi lần hai cùng token → trả về **chính đơn đó**, không tạo đơn mới.
4. **Kho chỉ đổi qua sổ**: RPC tự `set_config('shop.stock_write','on',true)`, tự UPDATE, tự INSERT `inventory_movements` có `on_hand_before`/`on_hand_after`. **Không gọi `product_variant_adjust_stock`** (xem B/S2). Huỷ đơn = dòng ledger mới `reason='return'`, không sửa dòng cũ.
5. **Guarded UPDATE** cho mọi transition: `WHERE id = _id AND status = _expected`. Hai người bấm cùng lúc → một thắng, một nhận lỗi có nghĩa.
6. **`shop_order_events` append-only**: không policy INSERT (chỉ RPC ghi), trigger chặn UPDATE/DELETE, **và** GRANT không cấp UPDATE/DELETE cho ai — GRANT trả lời trước trigger, assertion append-only từng xanh giả vì quên vế này. **Không** `notify_key`, **không** `client_token` trên bảng này (thừa — xem F).
7. **Quyền theo vai** kiểm trong RPC, không chỉ RLS: người mua chỉ đụng đơn của mình; `owner`/`manager`/`fulfillment` của đúng shop mới xử lý đơn; `support` chỉ đọc; admin `is_admin()` ⇒ AAL2.
8. **Không hard-delete.** Huỷ là trạng thái.
9. **`audit_logs`** cho tạo đơn / huỷ / mọi transition của admin, qua `log_audit_event`; nới CHECK `event_category` bằng migration, không tạo bảng mới.
10. **Cột, không chỉ hàng**: mỗi bảng mới `REVOKE ALL FROM anon, authenticated` rồi GRANT theo cột; assert `has_table_privilege(anon, ...) = false` cho cả 3 bảng đơn. `buyer_user_id` không bao giờ ra ngoài qua REST.
11. **`shop_orders.buyer_user_id` = `ON DELETE SET NULL`** — không CASCADE (người bán mất lịch sử), không RESTRICT (vỡ `delete-account` đang chạy prod). Đơn đã snapshot tên/SĐT nên vẫn đọc được.
12. **Ghi `social_notifications` không được giết đơn hàng**: FK trỏ `public.profiles(id)` chứ không phải `auth.users` → bọc `EXCEPTION WHEN others THEN NULL` hoặc `WHERE EXISTS (SELECT 1 FROM profiles ...)`.
13. **`ordering_enabled = false` hoặc shop không `active` ⇒ `shop_order_create` từ chối** — đây là bất biến có pgTAP, không phải mô tả vận hành.

### Máy trạng thái (5 trạng thái, không hơn)

```
pending ──confirm(seller|admin)──> confirmed ──ship(seller|admin)──> shipped ──deliver(buyer|seller|admin)──> delivered
   │                                    │                               │
   └──cancel(buyer|seller|admin)────────┴──cancel(seller|admin)─────────┴──cancel(admin)──> cancelled
```

- Mọi `→ cancelled` hoàn kho (`reason='return'`) + ghi `cancelled_by` + `cancel_reason` **bắt buộc** khi actor ≠ buyer.
- Bỏ `completed` (chỉ cần khi có đánh giá — đã cắt). `delivered` là trạng thái kết thúc thành công.
- Nguồn sự thật khai trong SQL, soi gương ở `src/lib/shop/orderState.ts` theo khuôn `productState.ts` đã có, kèm unit test cặp hợp lệ/không hợp lệ.

---

## F. Ponytail — đã bỏ khỏi kế hoạch

`wishlist_items.price_at_save_vnd` · toàn bộ wishlist · `order_events.notify_key` UNIQUE (dedupe cho luồng gửi một lần trong transaction, không có job retry) · `order_events.client_token` (idempotency đã ở `shop_orders` + guarded UPDATE) · cờ `price_changed` ở giỏ · bảng `payments`/`shipments`/`returns`/`disputes` riêng · dropdown tỉnh/thành · trạng thái `awaiting_payment` · RPC bulk-cancel · edge function (mọi thứ đi qua RPC/PostgREST ⇒ tránh sạch bẫy JWT ES256/HS256).

**Lười quá mức — phải sửa:**
- `shop_cart_items`: `user_id UUID NOT NULL DEFAULT auth.uid()`, policy có **cả** `USING` **và** `WITH CHECK`, GRANT `UPDATE (qty)` **theo cột** chứ không `UPDATE` trần. Thiếu `WITH CHECK` = client đổi `user_id` sang người khác.
- `shop_cart_view` gọi `product_public_projection` theo vòng lặp (N+1). Chấp nhận ở pilot nhưng phải ghi trần trong code: `-- ponytail: N+1 projection, gộp thành một query khi giỏ > 50 dòng`.

---

## G. Chữ — bỏ mọi lời hứa nền tảng không giữ được

| Bỏ / sửa | Thay bằng |
|---|---|
| "Đã hoàn tiền" | **"Shop báo đã hoàn tiền"** + dòng nhỏ "ThePickleHub ghi nhận thông tin này, không giữ và không chuyển tiền" *(chỉ xuất hiện nếu admin dùng transition; không có nút hoàn tiền cho người bán ở v1)* |
| "Chưa thanh toán" cho đơn COD | **"Trả khi nhận hàng"** |
| "Quá hạn thì quản trị viên vào xử lý" | Bỏ — chủ shop chính là quản trị viên |
| "không trả lời thì tự chuyển thành khiếu nại" | Bỏ — không có job nào làm việc đó |
| "SĐT chỉ hiện tới khi đơn kết thúc 30 ngày" | Bỏ — không có job xoá |
| "mở đơn từ email xác nhận" (B11) | Bỏ — email đó không tồn tại |
| "Sửa đánh giá", upload ảnh B15, "Đổi phiên bản" B13 | Không áp dụng (đã cắt) |
| "Shop bị tạm ngưng" | **"Shop đang tạm ngưng bán"** (bẫy gate — mục C) |
| **Giữ tuyệt đối** | Cách B11 viết trạng thái thành **câu nói việc người mua cần làm** ("Người bán đang chuẩn bị hàng — chưa cần làm gì"), không thoái hoá về chip trạng thái |

---

## H. Bổ sung bắt buộc (rẻ, giá trị cao)

1. **Nút liên hệ shop trên mọi trạng thái đơn** phía người mua (`usableContacts` đã có) — điều kiện an toàn để cắt dispute/return.
2. **Nút gọi người mua từ S09** (`<a href="tel:">` từ SĐT giao hàng) — đây mới là chống bom hàng COD thật sự, rẻ hơn mọi cơ chế cọc.
3. **Nút "Sao chép địa chỉ giao"** ở S09 — lỗi giao hàng đầu tiên sẽ đến từ gõ tay sai số nhà, không phải từ race tồn kho.
4. **Lý do huỷ/từ chối hiển thị cho người mua** ở dòng đầu chi tiết đơn: *ai* huỷ + *vì sao*.
5. **Toast "Đã thêm vào giỏ" có nút "Xem giỏ"** — người dùng điện thoại vừa bấm cần xác nhận nhìn thấy được, đừng bắt tự tìm badge.
6. **Ẩn phần giải thích "mỗi shop là một đơn riêng"** khi giỏ chỉ có một nhóm.
7. **Khách chưa đăng nhập bấm Thêm vào giỏ** → điều hướng đăng nhập **có `next` trả về đúng PDP** (khuôn `RequireAuth` đã có). *ponytail: không lưu (variant, qty) qua sessionStorage — pilot noindex, lưu lượng ~0; thêm khi phễu cho thấy có rơi thật.*

### Đã cân nhắc và HOÃN: Telegram ping cho người bán khi có đơn mới

critic-user xếp đây là "20 dòng đáng giá nhất". Đã kiểm: repo **không có** edge function gửi Telegram dùng chung
(`errors-telegram-alert` tự đọc bảng lỗi của nó), nên việc này = viết edge function mới + nối secret + deploy = một slice riêng.
→ **Hoãn, ghi thành việc kế tiếp #1.** Đêm nay dùng `social_notifications` (chuông trong app, đã có).
Vì không có kênh đẩy, **không được viết câu nào hứa "shop sẽ trả lời trong 48 giờ"** ở phía người mua (đã xử ở D6).

---

## I. Đóng gói (S6) — không mục nào được cắt

1. **noindex, không điều kiện**: thêm `/shop/cart`, `/shop/checkout`, `/shop/order`, `/shop/orders` vào `NOINDEX_PATTERNS`
   (`functions/_middleware.ts:55–130`) — **không** vào `SHOP_PUBLIC_PATTERNS` (phụ thuộc `SHOP_PUBLIC_INDEXING`).
   Hiện các đường dẫn này **không khớp pattern nào**. Đây là trang có tên, SĐT, địa chỉ nhà. Cập nhật cả robots + `/vi`.
2. `npx supabase gen types ... --schema public > src/integrations/supabase/types.ts` **sau khi** áp prod — cảnh báo: sẽ kéo theo mọi drift đang có, diff to bất ngờ.
3. `MIRRORED` (`src/App.tsx:571`) + regenerate `route-snapshot.json` — biết trước là `route-snapshot.test.ts` và `route-inventory.test.mjs` sẽ đỏ cho tới khi regenerate.
4. Ledger từng migration trong cùng phiên (`DRIFT_STRICT=1` fail cả hai chiều).
5. `db reset` → toàn bộ pgTAP → ghi số assertion. `npm run lint` · `npm run test` · `npm run build` · `node scripts/check-bundle-size.mjs`.
6. Một dòng runbook: dọn đơn kẹt bằng `shop_order_transition(id,'cancel')` từng đơn — **không** viết RPC bulk-cancel.
7. Mọi route mới qua `lazyRetry`; **không thêm dependency nào**.

---

## J. Việc cho ux-designer

Nguồn thiết kế đã duyệt: `src/proto/shop/screens/B08Cart.tsx`, `B09Checkout.tsx`, `B10OrderSuccess.tsx`,
`B11Orders.tsx`, `B12OrderDetail.tsx`, `S08Orders.tsx`, `S09OrderDetail.tsx` (bỏ qua B07/B13/B14/B15/A05 — đã cắt).
Phần cần thiết kế lại vì các quyết định ở §D/§G/§H:
bỏ VietQR khỏi B09 · dòng phí ship "Miễn phí"/số tiền thật · một ô địa chỉ free-text ép đủ cấp + ghi chú giao hàng ·
bỏ đếm ngược phía người mua + nút Huỷ đơn khi `pending` · nút "Tôi đã nhận hàng" · nút liên hệ shop ở mọi trạng thái ·
nút gọi + sao chép địa chỉ ở S09 · toast "Đã thêm vào giỏ / Xem giỏ" · trạng thái khi `ordering_enabled = false` ·
5 trạng thái đơn (không có `completed`) viết thành câu việc-cần-làm.
