# Kịch bản nghiệm thu Shop Phase 3 trên iPhone

> Dành cho Cuong. Chạy trên **preview URL** của PR, bằng **Safari trên iPhone thật**.
> Đây là thứ máy không kiểm được: `resize_window` của công cụ test hỏng suốt 2 vòng, nên **chưa ai thấy giao diện ở đúng bề ngang iPhone (375px)**.
> Tích `[x]` vào từng dòng. Chỗ nào sai, chụp màn hình + ghi mã đơn.

---

## PHẦN 0 — Chuẩn bị (bắt buộc, làm trước khi mở iPhone)

Preview Cloudflare trỏ vào **cùng project Supabase production**. Không áp migration thì mở preview ra là trang trắng / lỗi.

### 0.1 Pre-flight — chạy trên prod TRƯỚC khi áp migration

```sql
SELECT DISTINCT event_category FROM public.audit_logs;
SELECT DISTINCT resource_type  FROM public.audit_logs;
SELECT DISTINCT reason         FROM public.inventory_movements;
```

Đối chiếu với danh sách trong `supabase/migrations/20260818100000_shop_orders.sql:141-158`:
- `event_category` ⊆ `auth, stream, tournament, admin, match, player, shop`
- `resource_type` ⊆ `NULL` hoặc `livestream, video, tournament, organization, user, api_key, forum_post, quick_table, doubles_elimination, flex_tournament, team_match, match, game, player, shop_application, shop, shop_product, shop_order`
- `reason` ⊆ `opening, restock, correction, damage, lost, return, manual, sale`

⚠️ Migration **DROP rồi ADD lại** 3 CHECK này. Nếu prod có giá trị nằm ngoài danh sách, `ADD CONSTRAINT` nổ giữa chừng — và lúc đó CHECK cũ **đã bị DROP rồi**. Repo đang drift kinh niên (10 migration áp qua Management API không vào git) nên **không được bỏ qua bước này**.

### 0.2 Cất bản cũ (không có bản backup nào trong migration để dán lại)

```sql
SELECT pg_get_functiondef('public.product_public_projection(uuid,boolean)'::regprocedure);
SELECT pg_get_functiondef('public.inventory_movements_append_only()'::regprocedure);
SELECT pg_get_functiondef('public.product_moderation_events_append_only()'::regprocedure);
SELECT pg_get_functiondef('public.product_submission_events_append_only()'::regprocedure);
SELECT pg_get_functiondef('public.shop_contact_moderation_events_append_only()'::regprocedure);
```
Lưu 5 kết quả này ra file. `20260818110000` `CREATE OR REPLACE` **4 hàm trigger đang phục vụ Phase 1/2a** — thân sai làm hỏng ngay luồng kho + duyệt sản phẩm của người bán.

### 0.3 Áp migration — đúng thứ tự, không đảo

```
20260818090000_shop_cart_items.sql
20260818100000_shop_orders.sql
20260818110000_append_only_actor_null.sql
20260818120000_shop_phase3_projection_and_address.sql
```
File cuối đọc hai cột (`ordering_enabled`, `shipping_fee_vnd`) do file thứ hai tạo ⇒ chạy trước là lỗi ngay.
Cả 4 kết bằng `NOTIFY pgrst, 'reload schema'` ⇒ **không áp trong giờ livestream** (sự cố PGRST002 ngày 02/08).

### 0.4 Sau khi áp

```sh
npx supabase gen types typescript --project-id ajvlcamxemgbxduhiqrl --schema public > src/integrations/supabase/types.ts
```
Rồi ledger cả 4 migration (`DRIFT_STRICT=1` fail cả hai chiều).

### 0.5 Bật bán cho shop nội bộ

Mặc định `ordering_enabled = false` ⇒ **không bật thì không ai đặt được đơn, test dừng ngay bước đầu.**

```sql
ALTER TABLE public.shops DISABLE TRIGGER shops_guard_privileged_columns_trg;
UPDATE public.shops SET ordering_enabled = true, shipping_fee_vnd = 30000
 WHERE slug = '<slug-shop-ThePickleHub>';
ALTER TABLE public.shops ENABLE TRIGGER shops_guard_privileged_columns_trg;

-- verify: phải trả về true / 30000
SELECT slug, ordering_enabled, shipping_fee_vnd FROM public.shops WHERE slug = '<slug-shop-ThePickleHub>';
```

⚠️ Không bọc `DISABLE/ENABLE TRIGGER` thì câu UPDATE bị **nuốt im lặng** (`UPDATE 1` nhưng giá trị không đổi) — đó là công tắc chạy đúng thiết kế, không phải lỗi.

**Tắt khẩn cấp, một dòng:**
```sql
ALTER TABLE public.shops DISABLE TRIGGER shops_guard_privileged_columns_trg;
UPDATE public.shops SET ordering_enabled = false WHERE slug = '<slug-shop>';
ALTER TABLE public.shops ENABLE TRIGGER shops_guard_privileged_columns_trg;
```
Dùng cái này **thay vì** chuyển shop sang `restricted` — `restricted` làm shop biến mất khỏi catalog công khai.

### 0.6 Sản phẩm để test

Cần ít nhất 1 sản phẩm **approved + published** có tồn kho đếm được. Kiểm:
```sql
SELECT p.title, v.id, v.stock_on_hand, v.price_vnd
  FROM public.product_variants v JOIN public.products p ON p.id = v.product_id
 WHERE p.shop_id = (SELECT id FROM public.shops WHERE slug = '<slug-shop>')
   AND p.status = 'approved' AND p.is_published AND v.retired_at IS NULL;
```
Nếu `stock_on_hand` là `NULL` ⇒ shop không đếm tồn, vẫn đặt được nhưng **TC-07 và TC-12 sẽ không chạy được**.

### 0.7 Tài khoản

Chỉ cần **một tài khoản duy nhất** — `thecuong@gmail.com` vừa là chủ shop vừa là người mua. Chủ shop tự mua **không bị chặn**, đó là quyết định có chủ đích để nghiệm thu được (D9). Và đây cũng là ca đắt nhất của bản build: `/shop/orders` phải chỉ hiện **đơn anh mua**, còn `/seller/orders` mới hiện đơn khách.

---

## PHẦN A — Người mua (Safari iPhone, dọc)

### TC-01 · Thêm vào giỏ từ trang sản phẩm
- [ ] Mở `/shop`, vào một sản phẩm
- [ ] Thấy ô số lượng + nút **Thêm vào giỏ** (nút chính, màu đậm)
- [ ] Bấm Thêm vào giỏ → hiện thông báo **"Đã thêm vào giỏ"** kèm nút **"Xem giỏ"**
- [ ] Thông báo tự biến mất sau ~6 giây
- [ ] Badge giỏ trên đầu trang tăng đúng số
- [ ] Bấm "Xem giỏ" → sang `/shop/cart`

👁️ **Nhìn kỹ ở 375px:** nút Thêm vào giỏ có bị ô số lượng đẩy tràn không? Thông báo có che mất nút không?

### TC-02 · Sửa số lượng trong giỏ
- [ ] Bấm `+` → thành tiền dòng = đơn giá × số lượng, tạm tính cập nhật
- [ ] Bấm `+` tới 10 → nút `+` mờ đi **và có câu giải thích nhìn thấy được** ("Mỗi phiên bản tối đa 10 cái trong một đơn")
- [ ] Bấm `−` về 1 → không xuống được 0

👁️ Nút `+`/`−` có đủ to để bấm bằng ngón cái không (≥44px)?

### TC-03 · Bỏ món + Hoàn tác
- [ ] Bấm **Bỏ** → dòng biến mất **ngay**, KHÔNG có hộp xác nhận
- [ ] Hiện băng "Đã bỏ ... khỏi giỏ." + nút **Hoàn tác**
- [ ] Bấm Hoàn tác trong 10 giây → dòng trở lại đúng số lượng cũ
- [ ] Tải lại trang → dòng vẫn còn

### TC-04 · Đặt hàng COD
- [ ] Trong giỏ bấm **Đặt hàng shop này** → sang `/shop/checkout/<slug>`
- [ ] Điền: họ tên, SĐT `0` + 9 số, địa chỉ
- [ ] 👁️ Ô địa chỉ có **gợi ý đủ cấp** không ("Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành")
- [ ] 👁️ Bàn phím SĐT có ra **bàn phím số** không (`inputmode="tel"`)
- [ ] "Trả khi nhận hàng (COD)" **được chọn sẵn**
- [ ] Bảng tổng: tiền hàng + phí ship = tổng. Phí 30.000₫ hiện đúng số (nếu bằng 0 phải hiện chữ **"Miễn phí"**, KHÔNG được hiện "0₫" hay "—")
- [ ] Bấm nút đặt **một lần** → nút khoá lại + đổi chữ **"Đang gửi đơn…"**
- [ ] Sang `/shop/order/PH-...` có khối **"Đã gửi đơn tới người bán"**
- [ ] Bấm nút Back của Safari → **KHÔNG** quay lại trang checkout
- [ ] Mở lại `/shop/cart` → giỏ của shop đó **rỗng**

📝 Ghi lại mã đơn: `PH-________`

👁️ **Quan trọng ở 375px:** nhãn nút kiểu `Đặt đơn · 1.530.000₫` có bị **cắt chữ** không? Xuống 2 dòng thì chấp nhận, cắt cụt thì không.

### TC-05 · Chuyển khoản trước
- [ ] Đặt một đơn nữa, lần này chọn **"Chuyển khoản trước — shop sẽ gửi thông tin"**
- [ ] Trang thành công có nút liên hệ shop (Zalo/gọi)
- [ ] ⚠️ **KHÔNG được** có mã QR, KHÔNG có số tài khoản, KHÔNG có chữ "đối soát"

### TC-06 · Danh sách đơn của tôi
- [ ] Mở `/shop/orders`
- [ ] Có 4 tab: Tất cả · Đang tới · Đã xong · Đã huỷ, **mỗi tab có số đếm**
- [ ] Mỗi đơn hiện **câu việc-cần-làm**, không phải chip trạng thái trơ
  (ví dụ: "Shop chưa xác nhận — chưa cần làm gì. Huỷ được nếu đổi ý.")
- [ ] 🔴 **Chỉ thấy đơn ANH MUA**, KHÔNG thấy đơn của khách hàng mua ở shop anh
- [ ] Gõ chữ vô nghĩa vào ô tìm → hiện "Không có đơn nào khớp ..." + nút Xoá tìm kiếm

👁️ Hàng tab có cuộn ngang được không, và **trang** có bị cuộn ngang theo không (không được)?
👁️ Câu việc-cần-làm ở 375px: dài quá gây rối, hay vừa đọc?

### TC-07 · Huỷ đơn khi shop chưa xác nhận
- [ ] Mở một đơn `pending` → có nút **Huỷ đơn**
- [ ] Bấm → hộp xác nhận "Đơn sẽ bị huỷ và hàng được trả lại kho của shop. Không hoàn tác được."
- [ ] Bấm giữ đơn → không có gì đổi
- [ ] Bấm huỷ thật → tiêu đề đổi thành **"Đơn đã huỷ"**, dòng "Anh/chị đã huỷ đơn này lúc ..." nằm **trên cùng**
- [ ] Nút liên hệ shop **vẫn còn**
- [ ] Kiểm SQL: tồn kho variant đã **hoàn lại đúng số lượng**

### TC-08 · Liên hệ shop ở mọi trạng thái
- [ ] Mở lần lượt đơn `pending`, `confirmed`, `shipped`, `delivered`, `cancelled`
- [ ] **Mọi** trạng thái đều có nút liên hệ shop (Zalo/gọi) — đây là điều kiện an toàn để cắt phần khiếu nại

---

## PHẦN B — Người bán (vẫn trên iPhone)

### TC-09 · Danh sách đơn của shop
- [ ] Mở `/seller/orders` (menu người bán, mục **Đơn hàng** phải hết chữ "Sắp có")
- [ ] Tab **Cần xử lý** mở sẵn
- [ ] Đơn hiện dạng **thẻ** (không phải bảng) trên iPhone
- [ ] Đơn `pending` có dòng hạn: "Còn N giờ để trả lời"
- [ ] 👁️ Nếu có đơn quá hạn: viền đỏ + icon cảnh báo + chữ "Quá hạn N giờ", và **đứng đầu danh sách**
- [ ] 🔴 Ở đây thấy được đơn của **khách**, khác hẳn `/shop/orders`

👁️ **Điểm đã biết là lệch, cần anh quyết:** thẻ đơn quá hạn đang **canh giữa** trong khi thẻ khác canh trái. Nhìn có chướng không?

### TC-10 · Vòng đời đầy đủ
- [ ] Mở một đơn `pending` → bấm **Xác nhận đơn** (nút đổi chữ "Đang xác nhận…", không tự mở lại)
- [ ] Trạng thái sang `confirmed`, hiện ô **Mã vận đơn** + nút **Đã gửi hàng**
- [ ] Bấm **Đã gửi hàng** khi **để trống** mã vận đơn → vẫn chạy được
- [ ] Trạng thái sang `shipped` → có nút **Ghi nhận đã giao**
- [ ] Bấm → "Đơn đã kết thúc. Không còn thao tác nào.", hết nút

### TC-11 · Từ chối đơn kèm lý do
- [ ] Đơn `pending` → bấm **Từ chối đơn**
- [ ] Con trỏ **tự nhảy vào** ô lý do
- [ ] Để trống → nút gửi mờ + **có câu giải thích cạnh nút** ("Nhập lý do để người mua biết vì sao.")
- [ ] Nhập lý do → gửi
- [ ] Chuyển sang tài khoản người mua → mở đơn đó → thấy **nguyên văn** lý do anh vừa gõ, ngay dưới tiêu đề

### TC-12 · Gọi khách + sao chép địa chỉ (làm trên iPhone mới có ý nghĩa)
- [ ] Trong chi tiết đơn, khối **Địa chỉ giao** có nút **Gọi người mua**
- [ ] Bấm → iPhone mở màn hình gọi với đúng số
- [ ] Bấm **Sao chép địa chỉ giao** → nhãn đổi thành "Đã sao chép" khoảng 2 giây rồi trở lại
- [ ] Dán vào Notes → ra đúng 4 dòng: tên / SĐT / địa chỉ / ghi chú
- [ ] Có dòng "Số điện thoại này chỉ hiện với shop vì có đơn hàng thật."

### TC-13 · Người mua bấm "Tôi đã nhận hàng"
- [ ] Đưa một đơn về trạng thái `shipped`
- [ ] Bằng tài khoản người mua, mở `/shop/orders` → thẻ có nút **Tôi đã nhận hàng**
- [ ] Bấm nút đó ở **danh sách** → chỉ **chuyển sang trang chi tiết**, chưa đổi trạng thái
- [ ] Ở trang chi tiết bấm lần nữa → có hộp xác nhận → đồng ý
- [ ] Tiêu đề đổi thành "Đơn đã xong"

---

## PHẦN C — Các ca cần cố tình phá

### TC-14 · Giá đổi giữa chừng *(đây là bug đã sửa, cần xác nhận không tái phát)*
- [ ] Mở checkout trên iPhone, điền đủ form, **chưa bấm đặt**
- [ ] Trên máy tính chạy: `UPDATE product_variants SET price_vnd = price_vnd + 100000 WHERE id = '<variant>';`
  *(cần bọc `DISABLE/ENABLE TRIGGER product_variants_guard_stock`? — không, chỉ tồn kho mới bị guard, giá thì sửa thẳng được)*
- [ ] Trên iPhone bấm **Đặt đơn**
- [ ] ✅ Phải hiện khối cảnh báo nêu **tên món + giá cũ → giá mới**, tổng cập nhật, nút trở lại bấm được với tổng mới
- [ ] ❌ **KHÔNG được** kẹt mãi ở "Đang gửi đơn…" *(đây chính là bug vòng 2)*
- [ ] Chưa có đơn nào được tạo

### TC-15 · Bấm đặt hai lần / F5 giữa chừng
- [ ] Đếm đơn trước: `SELECT count(*) FROM shop_orders;`
- [ ] Mở checkout, điền form, **kéo xuống refresh trang** (Safari), điền lại
- [ ] Bấm nút đặt **hai lần thật nhanh**
- [ ] Đếm lại → **chỉ tăng đúng 1**

### TC-16 · Shop tạm ngưng bán
- [ ] Chạy lệnh tắt ở §0.5
- [ ] Mở lại trang sản phẩm → **ẩn hẳn** ô số lượng + nút Thêm vào giỏ, hiện **"Shop đang tạm ngưng bán."**, nút liên hệ shop lên làm nút chính
- [ ] `/shop/cart` → không đặt được, **sản phẩm vẫn nằm trong giỏ**
- [ ] `/shop/checkout/<slug>` gõ thẳng URL → cũng chặn
- [ ] `/seller/orders` → có notice "…không nhận đơn mới. Đơn đang có vẫn xử lý bình thường." và **đơn cũ vẫn xử lý được**
- [ ] Bật lại → nút trở về bình thường
- [ ] ⚠️ Không nơi nào được hiện chữ "Shop **bị** tạm ngưng" (chuỗi cấm)

### TC-17 · Hết hàng
- [ ] Đặt tồn kho variant về 0 (phải bọc `DISABLE/ENABLE TRIGGER product_variants_guard_stock` hoặc dùng màn điều chỉnh kho của người bán)
- [ ] Mở `/shop/cart` → dòng đó có cảnh báo (icon + chữ, không chỉ đổi màu), nút đặt của nhóm bị chặn kèm câu "Còn 1 món cần sửa trước khi đặt."
- [ ] Đặt tồn = 4 nhưng để số lượng 8 trong giỏ → phải hiện **"Chỉ còn 4 cái. Giảm số lượng để đặt tiếp."**, KHÔNG phải "vừa hết hàng"

### TC-18 · Không lộ đơn người khác
- [ ] Gõ thẳng `/shop/order/PH-0000-9999` (mã không tồn tại) → "Không tìm thấy đơn này."
- [ ] Nếu có tài khoản thứ hai: mở đơn của người kia → **đúng câu giống hệt**, không lộ tên shop / SĐT / địa chỉ / tổng tiền

---

## PHẦN D — Nhìn tổng thể (chỉ mắt người làm được)

- [ ] Cả 6 trang mới, **không trang nào cuộn ngang** ở iPhone dọc:
      `/shop/cart` · `/shop/checkout/<slug>` · `/shop/order/<mã>` · `/shop/orders` · `/seller/orders` · `/seller/orders/<mã>`
      *(lưu ý: đã biết có cuộn ngang ~39px **site-wide** ở `/shop` và `/rankings` từ trước — nếu thấy y hệt ở trang mới thì đó là lỗi cũ, không phải Phase 3)*
- [ ] Xoay ngang iPhone → không vỡ layout
- [ ] Chữ tiếng Việt đọc tự nhiên, xưng "anh/chị", không có chỗ nào lộ chuỗi kỹ thuật kiểu `PT409` hay `23514`
- [ ] Không chỗ nào hứa điều nền tảng không làm: không "email xác nhận", không "quản trị viên sẽ xử lý", không đếm ngược phía người mua
- [ ] Bấm bằng ngón cái thoải mái, không phải phóng to

---

## Đã biết trước — đừng báo là bug mới

| Điều | Vì sao |
|---|---|
| Thẻ đơn quá hạn ở `/seller/orders` canh giữa, thẻ khác canh trái | Lệch nhịp thị giác, chờ anh quyết |
| Ảnh 56px trên thẻ `/shop/orders` là **logo shop**, không phải ảnh sản phẩm | Dòng đơn snapshot tên/giá chứ không snapshot ảnh; muốn ảnh thật cần quyết định về read model, không phải một dòng CSS |
| Cuộn ngang ~39px cũng có ở `/shop`, `/rankings` | Site-wide sẵn có, không phải Phase 3 |
| Không có wishlist / đánh giá / trả hàng / nút khiếu nại | **Cắt có chủ ý**, xem `summary.md` §6 |
| Không có thông báo đẩy khi có đơn mới | Hoãn có lý do — repo chưa có edge function gửi Telegram dùng chung. Vì thế UI **không hứa** "shop trả lời trong 48 giờ" với người mua |
| Danh sách đơn tối đa 200 | Trần có chủ ý, có ghi trong code |

---

## Sau khi test xong

Nếu **chưa** muốn mở cho người thật đặt hàng, nhớ tắt:
```sql
ALTER TABLE public.shops DISABLE TRIGGER shops_guard_privileged_columns_trg;
UPDATE public.shops SET ordering_enabled = false WHERE slug = '<slug-shop>';
ALTER TABLE public.shops ENABLE TRIGGER shops_guard_privileged_columns_trg;
```

Dọn đơn test:
```sql
-- xem trước
SELECT code, status, total_vnd, created_at FROM public.shop_orders ORDER BY created_at DESC LIMIT 20;
```
⚠️ **Đừng `DELETE`** — huỷ qua RPC để kho được hoàn đúng:
```sql
SELECT public.shop_order_transition('<order-id>'::uuid, 'cancel', '<status-hiện-tại>', 'Đơn thử nghiệm', NULL);
```
