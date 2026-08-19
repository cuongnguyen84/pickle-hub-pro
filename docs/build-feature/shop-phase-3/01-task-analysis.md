# 01 — Phân tích công việc (task-analyst)

# Phân tích công việc — Shop Phase 3 (P3a + P3b)

## 1. Tóm tắt ý tưởng

PO yêu cầu chia nhỏ và hoàn thành trọn Phase 3 của Shop trong một phiên chạy đêm: P3a (wishlist, giỏ hàng, thanh toán một-shop, tạo đơn idempotent, trừ tồn kho) và P3b (danh sách/chi tiết đơn hai phía, huỷ đơn, hạn xử lý, trả hàng, khiếu nại, đánh giá). Nền Phase 0–2 đã sống trên production, prototype UI của toàn bộ 12 màn hình P3 đã có sẵn trong `src/proto/shop/screens/`, nên phần lớn việc là **nối dây thật**: dựng data model giao dịch, RPC server-authorized, và viết lại UI prototype thành trang production dùng `src/styles/shop.css`.

Mục tiêu PO nói rõ: "người dùng thao tác được ngay". Đây là tiêu chí nghiệm thu — một người mua thật đặt được đơn cho shop nội bộ ThePickleHub, và shop xử lý được đơn đó, chứ không phải phủ hết mọi nhánh ngoại lệ.

## 2. Bài toán cần giải

Hôm nay Shop chỉ là catalog đọc: người mua xem sản phẩm rồi bấm "Liên hệ shop" (Zalo/Messenger/điện thoại) — mọi giao dịch rời khỏi nền tảng và không để lại dấu vết nào trong hệ thống. Hệ quả: không có đơn hàng, không có tồn kho thật, không đo được gì, và người bán phải tự ghi sổ. P3 biến catalog thành nơi giao dịch được ghi nhận: có đơn, có trạng thái, có tồn kho tự trừ, có lịch sử ai làm gì lúc nào.

Đối tượng phục vụ ngay: **một shop duy nhất** (shop nội bộ ThePickleHub) và người mua trong pilot. Đây vừa là hạn chế vừa là ưu thế — rủi ro vận hành thấp, nhưng cũng nghĩa là mọi thứ xây cho "nhiều seller cạnh tranh" đều là đầu cơ.

## 3. Phạm vi

**Trong phạm vi:** wishlist; giỏ hàng theo user (yêu cầu đăng nhập); trang thanh toán một shop mỗi đơn; RPC tạo đơn nguyên tử + idempotent; trừ/hoàn tồn kho qua sổ `inventory_movements` đã có; máy trạng thái đơn hàng server-side; màn hình đơn của người mua (B11/B12) và người bán (S08/S09); huỷ đơn hai phía; yêu cầu trả hàng; đánh giá gắn với đơn đã giao; noindex cho toàn bộ route riêng tư mới; pgTAP + unit test + một lượt QA trình duyệt.

**Ngoài phạm vi, dứt khoát:**
- Mọi thứ thuộc P4: cổng thanh toán, webhook, đối soát tự động, ví/số dư/payout, hoa hồng nền tảng, chia tiền nhiều bên.
- Bảng `payments` / `payment_events` / `shipments` / `shipment_events` riêng — chưa có bên thứ ba nào để mô hình hoá, dựng bảng trước là dựng chỗ chứa dữ liệu chưa tồn tại. Trạng thái thanh toán và mã vận đơn là **cột trên `orders`** cho tới khi có provider thật.
- Bảng `shop_bank_accounts` — Option B′ đã quyết không thu thập; xem §6.
- Sổ địa chỉ người mua (`buyer_addresses`), dữ liệu tỉnh/huyện/xã từ nguồn ngoài, coupon, phí ship theo cân nặng/khu vực, nhiều shop trong một lần thanh toán, chat nội bộ, đẩy push.
- Mở indexing cho `/shop` — Q4 vẫn hiệu lực, `SHOP_PUBLIC_INDEXING` vẫn tắt.
- Ba khoản nợ mang sang (user rác prod, rendition JPEG cũ, `owner_user_id` lộ qua REST anon) — không thuộc P3, nhưng khoản thứ ba **phải áp cùng khuôn** cho mọi bảng mới (xem §7).

## 4. Bất biến bắt buộc — Postgres giữ, không phải client

Đây là danh sách không được thương lượng, và mỗi dòng phải có assertion pgTAP tương ứng:

1. **Tiền là `integer` VND.** Đơn giá, phí ship, tổng tiền — không float, không numeric. Tổng tiền do server tính lại từ giá tại thời điểm khoá hàng, **không bao giờ nhận tổng từ client**.
2. **Tạo đơn là một giao dịch duy nhất**: khoá `product_variants` bằng `SELECT ... FOR UPDATE`, kiểm lại (sản phẩm `approved` + `is_published` + shop `active` + giá đúng như client thấy + đủ tồn), ghi `orders` + `order_items` (snapshot bất biến tên/SKU/biến thể/đơn giá/tên shop), ghi `inventory_movements` trừ kho, xoá đúng các dòng giỏ của shop đó. Hoặc tất cả, hoặc không gì cả.
3. **Idempotency key**: `client_token` do client sinh, unique index trên `(buyer_user_id, client_token)`. Bấm hai lần / retry mạng → một đơn, và lần hai trả về chính đơn đó. Đây là khuôn đã có ở `product_variant_adjust_stock` và `product_decide` — sao chép, không phát minh lại.
4. **Tồn kho chỉ đổi qua sổ.** Trigger `product_variants_guard_stock` đã chặn UPDATE trực tiếp; RPC đơn hàng phải đi qua cùng cơ chế `set_config('shop.stock_write', ...)` và ghi một dòng ledger có `on_hand_before`/`on_hand_after`. Cần mở rộng CHECK `inventory_movements_reason_ok` thêm `'sale'` và `'order_cancel'`. Huỷ đơn hoàn kho là một dòng ledger mới, **không sửa dòng cũ** — sổ chỉ ghi thêm.
5. **Mọi chuyển trạng thái là guarded UPDATE**: `WHERE id = _id AND status = _expected`. Hai người cùng bấm (người mua xin huỷ + người bán xác nhận cùng lúc) → một thắng, một nhận lỗi có nghĩa. Không đọc-rồi-ghi.
6. **Mọi chuyển trạng thái có một dòng lịch sử append-only** (`order_events`) ghi actor, from, to, lý do, `client_token`, và `notify_key` unique — đúng khuôn `product_moderation_events`. Bảng không có policy INSERT; chỉ RPC ghi được; trigger chặn UPDATE/DELETE; GRANT không cấp UPDATE/DELETE cho ai (bài học P2a: assertion append-only từng xanh giả vì GRANT trả lời trước trigger).
7. **Quyền theo vai**: người mua chỉ thao tác được trên đơn của mình; chỉ `owner`/`manager`/`fulfillment` của đúng shop mới xử lý đơn (`is_shop_manager` cho hành động tiền bạc, `is_shop_member` chỉ đủ để đọc); admin cần `is_admin()` ⇒ AAL2. Kiểm tra trong RPC, không chỉ trong RLS.
8. **Không hard-delete** đơn, dòng đơn, sự kiện đơn, đánh giá. Huỷ là trạng thái.
9. **`audit_logs`** cho: tạo đơn, huỷ đơn, xác nhận đã nhận tiền, giao hàng, hoàn tiền, quyết định khiếu nại. Dùng `log_audit_event` và **nới CHECK `event_category` bằng migration**, không tạo bảng mới.
10. **Không lộ dữ liệu**: người mua không được thấy `stock_on_hand` chính xác (projection hiện tại chỉ trả `availability` — giữ nguyên); người bán không được thấy email/user_id người mua ngoài tên + SĐT giao hàng; không PII trong `link_url`, payload thông báo, hay log.

## 5. Chia task — các lát cắt dọc

Mỗi slice là một vòng coder: có migration (nếu cần) + code + test + chạy được và kiểm chứng được. Thứ tự là thứ tự phụ thuộc.

### P3a

**P3a-1 · Nền dữ liệu ý định mua (wishlist + giỏ)**
- Bảng: `wishlist_items(user_id, product_id, created_at, PK(user_id, product_id))`, `cart_items(user_id, variant_id, qty CHECK 1..99, created_at, updated_at, PK(user_id, variant_id))`. **Không** có bảng cha `wishlists`/`carts` — một user một giỏ, một danh sách lưu; bảng cha chỉ tồn tại để mang vòng đời chưa ai cần.
- RPC: không cần. Đây là dữ liệu không dính tiền → RLS `user_id = auth.uid()` cho SELECT/INSERT/UPDATE/DELETE + GRANT đầy đủ là đủ. Validate "sản phẩm này có bán không" xảy ra ở lúc xem giỏ và lúc đặt, không phải lúc bấm lưu.
- Test: pgTAP — user B không đọc/ghi được giỏ của user A; anon không đọc được gì; qty ngoài khoảng bị chặn; xoá variant thì dòng giỏ biến mất (FK CASCADE).
- Xong khi: `db reset` sạch, pgTAP xanh, `shop-schema.ts` có type mới và test khớp danh sách bảng.
- Phụ thuộc: —

**P3a-2 · RPC đọc giỏ có kiểm chứng (`shop_cart_view`)**
- Một RPC `STABLE SECURITY DEFINER` trả JSON đã nhóm theo shop: từng dòng kèm tên/ảnh/giá **hiện tại**, cờ `unavailable_reason` (`unpublished` | `shop_inactive` | `out_of_stock` | `price_changed`), tổng tạm tính từng nhóm, và trạng thái shop. Tái dùng `product_public_projection` thay vì query lại.
- Đây là chỗ duy nhất tính tiền hiển thị ở giỏ; client không nhân giá với số lượng để ra tổng.
- Test: pgTAP — sản phẩm bị gỡ xuất hiện với cờ đúng chứ không biến mất; shop `restricted` khoá đúng nhóm đó; giá đổi được báo.
- Xong khi: gọi được với 3 kịch bản dữ liệu và trả đúng cờ.
- Phụ thuộc: P3a-1

**P3a-3 · Màn hình Wishlist + nút Lưu (B07)**
- Route `/shop/wishlist` (`lazyRetry`, `RequireAuth`), nút lưu trên PDP và `ProductCard`. Viết lại từ `B07Wishlist.tsx` bằng class `tl-shop-*`; **không import gì từ `src/proto/`** (đã có test chặn).
- Có Hoàn tác sau khi bỏ lưu (khuôn prototype), nhãn "giá đã đổi từ khi lưu" — cần lưu `price_at_save_vnd` trên `wishlist_items` (một cột, rẻ hơn nhiều so với bảng lịch sử giá).
- Xong khi: lưu/bỏ lưu chạy trên 375px và 1440px, song ngữ, nút ≥44px, có unit test cho hook.
- Phụ thuộc: P3a-1

**P3a-4 · Màn hình Giỏ hàng (B08)**
- Route `/shop/cart`, nhóm theo shop, mỗi nhóm một nút "Đặt hàng shop này", **không có nút đặt tất cả**, một dòng giải thích vì sao. Sửa số lượng, xoá có Hoàn tác, dòng lỗi có hành động sửa chứ không tự biến mất.
- Badge số lượng giỏ ở header Shop (không thêm mục thứ 6 vào bottom nav).
- Xong khi: 5 biến thể prototype tái hiện được bằng dữ liệu thật (một shop, nhiều shop, đổi giá, hết hàng, shop tạm ngưng).
- Phụ thuộc: P3a-2

**P3a-5 · Bảng đơn + RPC tạo đơn (`shop_order_create`) — lát cắt quan trọng nhất**
- Bảng: `orders` (mã đơn người đọc được, `buyer_user_id`, `shop_id`, snapshot địa chỉ giao, `payment_method`, `payment_state`, `items_total_vnd`, `shipping_fee_vnd`, `total_vnd`, `status`, các mốc thời gian, `client_token`), `order_items` (snapshot bất biến), `order_events` (append-only).
- RPC nhận `(_shop_id, _address jsonb, _payment_method, _client_token)`, làm đúng bất biến §4.2–4.4, trả về mã đơn.
- Mã đơn sinh server-side, chống trùng; nếu dùng `gen_random_bytes` nhớ qualify `extensions.` trong `SECURITY DEFINER` (bài học referee-pin).
- Test: pgTAP là chỗ chứng minh — hai lần gọi cùng token ra một đơn; hai phiên tranh nhau đơn vị hàng cuối cùng ra một đơn thành công + một lỗi; giá đổi giữa chừng thì từ chối kèm lỗi có cấu trúc; kho trừ đúng và ledger cân; giỏ chỉ xoá dòng của shop đó.
- Xong khi: các assertion trên xanh sau `db reset`, và có ít nhất một phép thử **đỏ-trước-xanh** phá đúng call site (bỏ `FOR UPDATE` → test race phải đỏ).
- Phụ thuộc: P3a-2

**P3a-6 · Màn hình Thanh toán + Đặt hàng thành công (B09, B10)**
- Route `/shop/checkout/:shopId` và `/shop/order/:orderCode`. Form địa chỉ: họ tên, SĐT (`inputmode="tel"`, validate 10 số bắt đầu bằng 0), địa chỉ tự do, tỉnh/thành chọn từ danh sách tĩnh đã có trong repo nếu có, **không thêm dependency dữ liệu hành chính**. Prefill từ đơn gần nhất của chính người mua — không dựng sổ địa chỉ.
- Nút đặt hàng khoá + đổi chữ ngay lần bấm đầu, không tự mở lại; tổng liệt kê từng dòng, nút lặp lại đúng số tiền; câu "không có phí nào khác".
- Trang thành công mở đầu bằng **việc người mua phải làm tiếp**, không confetti.
- Xong khi: đặt được một đơn thật trên stack local từ trình duyệt, đơn hiện trong DB đúng snapshot, kho giảm đúng, bấm F5 giữa chừng không tạo đơn thứ hai.
- Phụ thuộc: P3a-5

### P3b

**P3b-1 · Máy trạng thái đơn + RPC chuyển trạng thái (`shop_order_transition`)**
- Một nguồn sự thật duy nhất cho bảng chuyển trạng thái, khai báo trong SQL và soi gương ở `src/lib/shop/orderState.ts` (khuôn `productState.ts` + `applicationState.ts` đã có, kèm unit test hợp lệ/không hợp lệ).
- RPC nhận `(_order_id, _action, _reason, _client_token)`; tự quyết actor được phép làm gì (buyer/seller/admin), guarded UPDATE, ghi `order_events`, hoàn kho khi huỷ, ghi audit, ghi `notify_key`.
- Test: pgTAP cho từng cặp hợp lệ/không hợp lệ, hai lần huỷ đồng thời, người bán shop khác không đụng được đơn, `support` member không xác nhận được đơn.
- Xong khi: mọi hành động ở P3b-2/3 đều đã có RPC đứng sau.
- Phụ thuộc: P3a-5

**P3b-2 · Đơn của người mua (B11 + B12 + huỷ đơn)**
- Route `/shop/orders`, `/shop/order/:orderCode` (tái dùng trang đã dựng ở P3a-6, mở rộng). Tab theo việc người mua cần làm; dòng đầu tiên trả lời "ai làm tiếp, hạn bao giờ"; lịch sử trạng thái ở cuối; nút bị khoá phải nói vì sao/khi nào mở.
- Xong khi: 6 trạng thái render đúng bằng dữ liệu thật, huỷ đơn hoạt động và kho hoàn đúng.
- Phụ thuộc: P3b-1

**P3b-3 · Đơn của người bán (S08 + S09)**
- Route `/seller/orders`, `/seller/orders/:id` trong `SellerShell` đã có. Sắp theo **hạn phải trả lời**, quá hạn lên đầu. Hành động theo trạng thái: xác nhận / từ chối kèm lý do / ghi nhận đã đóng gói / ghi nhận đã gửi + mã vận đơn / ghi nhận đã giao.
- Mọi nút là "yêu cầu" hoặc "ghi nhận", không nút nào ngụ ý một cú bấm hoàn tất chuyển tiền.
- Xong khi: một vòng đầy đủ mua → bán xác nhận → gửi → giao → hoàn tất chạy được end-to-end trên local.
- Phụ thuộc: P3b-1

**P3b-4 · Đánh giá đã xác minh (B15)**
- Bảng `reviews(order_item_id UNIQUE, product_id, shop_id, buyer_user_id, rating 1..5, body, state, created_at)`. Chỉ mở khi dòng đơn thuộc đơn `delivered`/`completed` — kiểm ở RPC, không ở client. Một đánh giá cho một dòng đơn.
- Hiển thị công khai trên PDP: điểm trung bình + danh sách, đọc qua RPC public đã có khuôn (`shop_public_product`), **cột `buyer_user_id` không bao giờ ra ngoài** (đúng lỗi `owner_user_id` đang nợ).
- Có công tắc ẩn đánh giá cho admin (`state`), vì đây là nội dung người dùng viết trên một trang công khai.
- Xong khi: pgTAP chứng minh không đặt hàng thì không đánh giá được, không đánh giá được hai lần, anon không đọc được người viết là user nào.
- Phụ thuộc: P3b-3

**P3b-5 · Yêu cầu trả hàng (B13)**
- Ponytail: **không có bảng `returns` riêng.** Trả hàng là một nhánh của máy trạng thái đơn (`return_requested → return_approved | return_rejected → returned → refunded`) cộng hai cột lý do/ghi chú trên `orders` và các dòng `order_events`. Người bán trả lời trong S09.
- Bằng chứng ảnh: **cắt ở v1** — mô tả bằng chữ. Upload ảnh kéo theo bucket, RLS, quét EXIF, worker dọn rác; đó là một slice riêng, không phải một ô input.
- Xong khi: người mua gửi được yêu cầu, người bán duyệt/từ chối được, trạng thái + lịch sử đúng.
- Phụ thuộc: P3b-3

**P3b-6 · Khiếu nại + xử lý của admin (B14 + A05)** — *lát cắt đắt nhất, xem §9*
- Ponytail: khiếu nại = trạng thái `disputed` trên đơn + luồng sự kiện `order_events` đã có (mỗi bên ghi một dòng, có `actor_kind`), admin chọn kết quả trong `/admin/shop/orders/:id`. **Không bảng `disputes`/`dispute_events` riêng**, không case timeline độc lập — timeline đã nằm sẵn ở `order_events`.
- Giữ nguyên yêu cầu quan trọng nhất của A05: trước khi admin chốt, hiện **bảng hệ quả tính từ đơn thật** (hoàn bao nhiêu, có trả hàng không, kho ra sao, ghi nhật ký gì).
- Xong khi: admin chuyển được đơn sang kết quả cuối và mọi hệ quả được ghi.
- Phụ thuộc: P3b-5

**P3b-7 · Đóng gói: noindex, thông báo, kiểm thử, ngân sách**
- **Bắt buộc, không cắt**: thêm `/shop/cart`, `/shop/checkout`, `/shop/order`, `/shop/orders`, `/shop/wishlist` vào `NOINDEX_PATTERNS` trong `functions/_middleware.ts`. Hiện tại **các đường dẫn này không khớp pattern nào** — chúng chỉ không bị index vì chưa tồn tại. Đây là trang cá nhân có tên, SĐT, địa chỉ; phải noindex vô điều kiện, không phụ thuộc `SHOP_PUBLIC_INDEXING`. Cập nhật cả hai file robots + `route-snapshot.json` + `MIRRORED` cho `/vi`.
- Thông báo: tái dùng `social_notifications` (cột `type` là TEXT tự do, không có CHECK) — RPC ghi thẳng một dòng cho người bán khi có đơn mới và cho người mua khi trạng thái đổi. Không dựng inbox mới, không push, không email.
- Chạy `db reset` → toàn bộ pgTAP → ghi số assertion; `npm run lint`, `npm run test`, `npm run build`, `node scripts/check-bundle-size.mjs`; mở rộng `scripts/shop-p2b-acceptance-qa.mjs` cho route mới ở 375/1440.
- Phụ thuộc: tất cả

## 6. Ranh giới thanh toán (Option B′) — cái gì KHÔNG được làm

Không tích hợp cổng thanh toán, không nhận webhook, không có tài khoản ngân hàng nền tảng, không thu KYC, không giữ tiền hộ, không tính hoa hồng, không tạo bảng `shop_bank_accounts`.

**Không bao giờ** để đơn tự chuyển sang "đã thanh toán" vì: hiển thị mã VietQR, người mua bấm "tôi đã chuyển", quét QR, hay bất kỳ callback client nào. Người mua chỉ **khai báo** đã chuyển; chỉ người bán hoặc admin mới **xác nhận đã nhận tiền**, qua RPC có audit. Chính xác khuôn `mark-payment-claimed` đã dùng cho giải đấu — sao chép ý tưởng, không sao chép edge function.

Một mâu thuẫn cần nói thẳng: `generateVietQRUrl` cần mã ngân hàng + số tài khoản, mà nền tảng đã quyết không thu thập dữ liệu ngân hàng. Vì thế **mặc định P3 chỉ mở COD** (xem câu hỏi Q3 ở §10), với cột `payment_method` có CHECK `('cod','bank_transfer')` để bật nhánh chuyển khoản sau này chỉ tốn một migration nhỏ chứ không phải sửa bảng đơn.

Hệ quả kỹ thuật của COD-only rất đáng giá: đơn được coi là cam kết ngay khi tạo → trừ kho ngay khi tạo → **không cần mô hình giữ chỗ có hạn, không cần job tự huỷ sau 48 giờ, không cần pg_cron mới**. Bật chuyển khoản là bật kèm cả cụm đó.

## 7. Rủi ro / điểm cần cẩn thận

**Rò dữ liệu theo cột, không theo hàng.** Bài học đã trả giá: RLS lọc hàng chứ không lọc cột, và `owner_user_id` đang lộ qua REST anon là món nợ chưa trả. Mọi bảng mới (`orders`, `order_items`, `reviews`) phải áp khuôn `20260815090000_shop_public_read_column_scope.sql` — REVOKE toàn bộ rồi GRANT theo cột, hoặc chỉ cho đọc qua RPC allowlist cột. Đừng để `reviews` public trả `buyer_user_id`.

**GRANT trả lời trước RLS.** Sweep grants đã bắt lỗi này hai lần trong repo. Mỗi bảng mới cần một khối GRANT rõ ràng và một assertion `has_table_privilege` — không giả định.

**Xanh giả.** Bài học lặp lại nhiều lần: test bảo vệ hàm chứ không bảo vệ chỗ nối. Với P3, chỗ nối nguy hiểm nhất là "trang checkout có thật sự gọi RPC tạo đơn, hay client tự tính tổng rồi insert?" — phải có ít nhất một phép thử phá đúng call site production. Và `supabase start` không phải bằng chứng; chỉ `db reset` mới là.

**Race tồn kho** là rủi ro kỹ thuật số một, nhưng với một shop và lưu lượng pilot thì xác suất thấp — vẫn phải đúng, vì sai kiểu này im lặng và chỉ lộ ra khi seller giao thiếu hàng.

**Trải nghiệm**: hai cái dễ hỏng nhất là (a) người mua bấm đặt hai lần vì mạng chậm, (b) giá/tồn đổi giữa lúc điền form. Prototype đã nghĩ sẵn cả hai; giữ đúng hành vi (nút khoá không tự mở lại; đưa người dùng về đúng dòng bị đổi và bắt xác nhận lại).

**Dữ liệu cá nhân**: đơn hàng là bề mặt PII đầu tiên của Shop (tên, SĐT, địa chỉ nhà). Không đưa vào URL, log, analytics, payload thông báo. Trang có PII phải noindex — và hiện tại chưa có pattern nào phủ (§P3b-7).

**Hiệu năng / bundle**: con số "còn ~9 KB headroom" trong ý tưởng gốc là **cũ và sai chỗ**. Xem §8.

**SEO**: không mở indexing, không sitemap, không IndexNow cho P3. Đánh giá công khai trên PDP làm trang dày thêm nhưng cũng mở bề mặt nội dung người dùng — có công tắc ẩn của admin là đủ ở pilot.

**Vận hành**: chưa có nút tắt khẩn cấp riêng cho việc đặt hàng — nhưng cũng không cần dựng: chuyển shop sang `restricted` là đã chặn đơn mới. Ghi rõ điều này trong runbook thay vì thêm một flag.

## 8. Ngân sách bundle — đính chính

Số liệu thật trong `scripts/check-bundle-size.mjs` và `docs/perf-budgets.md`:

| Chỉ số | Ngưỡng | Hiện tại | Có chặn CI? |
|---|---|---|---|
| CODE gz | 1800 KB | ~1574 | **Có** |
| INITIAL gz | 280 KB | ~227 | **Có** |
| Một route chunk bất kỳ | 150 KB | 136 max | **Có** |
| Total gz JS | — | 1979 | **Không** (DEBT-01, 17/08) |

Nghĩa là headroom thật của gate đang chặn là **~226 KB CODE**, không phải 9 KB — con số 9 KB đến từ tài liệu tính theo backstop Total 1970 vốn đã bị bỏ chặn. P3 hoàn toàn khả thi về bundle, nhưng ba luật vẫn phải giữ: **mọi route mới đi qua `lazyRetry`** (không route nào chạm entry chunk), **không thêm dependency mới** (không thư viện form, không thư viện ngày tháng, không gói dữ liệu tỉnh/huyện/xã — đó là cách một feature ăn 100 KB trong một dòng `npm i`), và **tái dùng `src/styles/shop.css` + component đã có** (`ShopShell`, `ProductCard`, `useConfirm`, `journeys.ts`). Giữ ba chunk tách biệt như P2b đã làm: người mua không tải màn hình người bán, người bán không tải màn hình admin. Một trang checkout phình quá 150 KB là dấu hiệu đã kéo nhầm gì đó vào.

## 9. Cắt được gì mà vẫn đạt mục tiêu PO

Mục tiêu "người dùng thao tác được ngay" đạt được **hết P3b-3**: mua được, đặt được, shop xử lý được, hai bên huỷ được. Nếu đêm không đủ, thứ tự hy sinh từ dưới lên:

1. **P3b-6 (khiếu nại/A05) — cắt trước tiên.** Với đúng một shop mà chủ shop cũng chính là admin, "khiếu nại" hiện tại là một cuộc gọi Zalo. Thay bằng: admin có quyền chuyển trạng thái bất kỳ kèm lý do + audit. Đủ để giải quyết mọi tình huống thật, tốn 0 bảng mới.
2. **Ảnh bằng chứng trong trả hàng** — cắt (đã cắt trong P3b-5).
3. **P3b-4 (đánh giá)** — cắt được, nhưng rẻ và tăng niềm tin; nên giữ nếu còn thời gian sau P3b-3.
4. **Wishlist (P3a-3)** — về mặt doanh thu là tính năng phụ, nhưng rẻ nhất trong cả gói và không dính tiền. Giữ.

Không được cắt trong bất kỳ trường hợp nào: tính nguyên tử của việc tạo đơn, idempotency, guarded transition, audit, noindex cho trang có PII, và bilingual/a11y cơ bản của các màn hình đã ship.

## 10. Câu hỏi mở cần PO quyết — kèm giá trị mặc định để đi tiếp đêm nay

PO không có mặt. Với mỗi câu, đề xuất một mặc định an toàn nhất; **tất cả đều là giả định, phải liệt kê lại trong báo cáo sáng mai để PO lật ngược bằng một dòng cấu hình chứ không phải một migration.**

| # | Câu hỏi | Mặc định đề xuất (giả định) | Vì sao an toàn |
|---|---|---|---|
| Q1 | Phí ship tính thế nào? | Một cột `shipping_fee_vnd` phẳng trên `shops`, mặc định 0, hiển thị rõ ở checkout và snapshot vào đơn | Tổng tiền trung thực, không phí ẩn; đổi bảng giá sau chỉ là sửa một số |
| Q2 | Ai trả phí ship khi trả hàng? | Không tự động tính gì cả: người bán và người mua thoả thuận, hệ thống chỉ ghi kết quả cuối do người bán/admin nhập | Nền tảng không giữ tiền nên không thể cưỡng chế; tự động hoá ở đây là hứa hão |
| Q3 | COD hay chuyển khoản? | **Chỉ COD ở P3.** Cột `payment_method` đã có chỗ cho `bank_transfer` | Chuyển khoản kéo theo dữ liệu ngân hàng + hạn giữ chỗ + job tự huỷ; xem §6 |
| Q4 | Người mua được huỷ đến bước nào? | Tự huỷ tự do khi đơn chưa được shop xác nhận. Sau khi xác nhận thì là *đề nghị huỷ*, shop duyệt | Khớp đúng chữ trong prototype S09 ("Đề nghị huỷ đơn"), không cần cron |
| Q5 | SLA người bán xác nhận? | Hiển thị hạn 48 giờ và đẩy đơn quá hạn lên đầu hàng đợi, **không tự huỷ** | Hiển thị hạn là UI; tự huỷ là một job nữa và một cách mất đơn thật |
| Q6 | Đánh giá chỉ cho đơn đã giao? | Có — chỉ mở cho dòng đơn thuộc đơn `delivered`/`completed`, một lần, không sửa | Đúng nguyên tắc "mua thật" của B15; nới lỏng sau dễ, siết lại thì mất niềm tin |
| Q7 | Đánh giá hiện công khai ngay hay chờ duyệt? | Hiện ngay, admin có nút ẩn | Pilot noindex, một shop; hàng đợi kiểm duyệt cho 0 đánh giá là hàng đợi rỗng |
| Q8 | Người mua có cần thuộc allowlist pilot không? | Không — chỉ cần đăng nhập. `shop_pilot_has_access()` gates hành động **người bán** (quy tắc Q1 đã ký) | Catalog vốn đã public; bắt người mua xin phép thì không ai mua được |
| Q9 | Địa chỉ giao: form tự do hay tỉnh/huyện/xã chuẩn? | Tên + SĐT + địa chỉ tự do + tỉnh/thành chọn từ danh sách tĩnh có sẵn | Bộ dữ liệu hành chính là một dependency và một nguồn bảo trì; pilot chưa cần |
| Q10 | Áp migration P3 thẳng production đêm nay? | Áp — Shop đã sống trên prod và PO đã cho phép áp qua Management API. Mọi migration idempotent, có script rollback trong PR | Nhưng phải ghi rõ trong báo cáo là đã áp, kèm ledger đối chiếu (drift migration đang là bệnh kinh niên) |

## 11. Việc cần cho hai agent phản biện và agent UI/UX

Điểm đáng đâm nhất cho phản biện: (a) quyết định **COD-only** có thực sự phục vụ shop nội bộ không, hay chặn mất đúng cách bán hàng thật; (b) gộp khiếu nại vào `order_events` thay vì bảng riêng có làm A05 mất khả năng "xem trước hệ quả" không; (c) trừ kho ngay khi tạo đơn có tạo ra lỗ hổng người dùng đặt rồi bỏ để đánh sập tồn kho của shop không (mặc định: có, và giới hạn rẻ nhất là số đơn đang mở trên mỗi người mua, không phải hệ thống giữ chỗ).

Cho agent UI/UX: nguồn thiết kế đã duyệt nằm ở `src/proto/shop/screens/B07–B15, S08, S09, A05` cùng các biến thể đã liệt kê trong `docs/proposals/shop-marketplace-screen-tasks.md`; phần cần quyết mới là những chỗ mặc định ở §10 làm thay đổi màn hình — bỏ VietQR khỏi B09, bỏ upload ảnh khỏi B13, gộp B14 vào chi tiết đơn, và dòng phí ship phẳng ở B08/B09.

---

**Đường dẫn cần đọc khi bắt tay:**
- `supabase/migrations/20260811210000_shop_variants_inventory.sql` — khuôn ledger + idempotency + guard tồn kho, sao chép nguyên cho đơn hàng
- `supabase/migrations/20260812091000_shop_p2b_moderation_backend.sql` — khuôn bảng sự kiện append-only + `notify_key` + guarded transition
- `supabase/migrations/20260813090000_shop_p2b_public_read.sql` — `product_public_projection`, nơi `availability` được che còn `stock_on_hand` thì không ra ngoài
- `functions/_middleware.ts` (dòng 55–145) — `NOINDEX_PATTERNS` đang **thiếu** mọi route P3
- `scripts/check-bundle-size.mjs` + `docs/perf-budgets.md` — ngân sách thật, đính chính con số 9 KB
- `src/lib/payment/vietqr.ts` — cần bankCode + accountNumber, dữ liệu mà Option B′ đã quyết không thu thập
