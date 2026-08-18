# BÀN GIAO — Shop Phase 4

> Chốt 18/08/2026. Đọc file này trước, mọi thứ khác là chi tiết.
> Nhánh `feat/shop-phase-4` · **PR #615** · worktree `.claude/worktrees/shop-phase-3`
> Preview: https://feat-shop-phase-4.pickle-hub-pro.pages.dev/shop

Phase 4 trong bản đồ gốc là *"Payment provider / public launch — blocked on
explicit approval"*. PO gỡ khoá ngày 18/08 và chọn làm **cả hai, tuần tự**.

---

## 1. Trạng thái

| | |
|---|---|
| PR | **#615**, chưa merge |
| Migration | **3 file, ĐÃ áp production và ĐÃ ledger** |
| Cờ `SHOP_PUBLIC_INDEXING` | **production: TẮT** · preview: bật (để kiểm chứng) |
| Thanh toán | VietQR + đối soát tay, **không cổng thanh toán, không merchant account** |
| Test | vitest 205 file / 3188 test · pgTAP 48 file / 1664 assertion |

**3 migration đã áp prod, thứ tự không đảo:**
`20260818130000_shops_revoke_anon_select` → `20260818140000_shop_public_policies_anon_sweep` → `20260818150000_shop_bank_transfer`

Cộng một lần đổi tên: `20260818090000_shop_cart_items` → `20260818095000_shop_cart_items` (xem §5).

---

## 2. 🔴 Việc BẮT BUỘC còn lại

### 2.1 Merge PR #615

### 2.2 Bật `SHOP_PUBLIC_INDEXING=1` trên **production**

Đây là toàn bộ thao tác mở cửa. **Không cần deploy lại** — middleware đọc cờ ở
thời điểm request.

```sh
CF_TOKEN=<cfut_…> node /path/to/cf-preview-flag.mjs production 1
```
…hoặc đặt tay trong Cloudflare Pages → Settings → Environment variables →
Production → `SHOP_PUBLIC_INDEXING` = `1`.

Tắt lại = đổi giá trị thành `0` (hoặc xoá biến). Nó là nút tắt khẩn cấp, và nó
đúng nghĩa tức thời.

### 2.3 Sau khi bật: verify rồi mới xin index

```sh
curl -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" \
  "https://www.thepicklehub.net/shop/product/kaiwin-diamond?nocache=1"
```
Phải thấy: **200**, `<title>` có tên sản phẩm + giá, JSON-LD `Product` kèm
`offers.price`, hreflang en/vi/x-default, và **đếm chữ body > 100**. Chỉ kiểm
tag là không đủ — lỗi 2026-08-05 có tag hoàn hảo và bài rỗng.

Rồi: GSC URL Inspection → Request Indexing cho `/shop` và 2 PDP · IndexNow cho
Bing.

### 2.4 Điền tài khoản ngân hàng của shop

`/seller/settings` → mục "Tài khoản nhận chuyển khoản". Chưa điền thì người mua
chọn chuyển khoản vẫn đặt được, chỉ là không thấy QR và phải liên hệ shop.

---

## 3. Đã làm gì

### 3.1 Nửa mở công khai (P4a)

**Bốn renderer SSR mới** trong `functions/_lib/render/shop.ts` — trước đó
`functions/_lib/render/` **không có module shop nào**. Bật cờ mà thiếu chúng thì
Googlebot rơi vào `renderDefault`: vỏ "ThePickleHub" chung chung, không sản
phẩm, không giá.

| Đường | Schema |
|---|---|
| `/shop` | ItemList |
| `/shop/category/:slug` | ItemList, tiêu đề lấy **tên** danh mục chứ không phải slug |
| `/shop/store/:slug` | Store + ItemList trong **một** `@graph` |
| `/shop/product/:slug` | **Product + Offer/AggregateOffer** — thẻ SERP thật |

Mỗi cái có cặp `/vi/` tự trỏ canonical và hreflang đối ứng (hình dạng `/clubs`,
không phải hình dạng `/feed` một-canonical).

**`sitemap-shop.xml`** mới, được sitemap index tham chiếu **vô điều kiện** và tự
đọc cờ — trả urlset rỗng khi cổng đóng. Segment 404 sẽ làm cả index đỏ trong
Search Console suốt thời gian cổng còn đóng.

**`/shop/search` chuyển sang noindex VĨNH VIỄN.** Một trang kết quả cho mỗi
query string là nội dung mỏng trùng lặp mặc quần áo của chính catalog. Nhà
canonical của từng sản phẩm là `/shop/product/:slug`, nay đã render cho bot. Nếu
để nguyên trong `SHOP_PUBLIC_PATTERNS`, "mở catalog" sẽ mở luôn bề mặt query
string.

**Bỏ `noindex` hardcode** ở 4 màn catalog. Nhánh loading và không-tìm-thấy giữ
nguyên — đó là trạng thái thật, không phải cổng.

### 3.2 Nửa thanh toán (P4b)

Đảo đúng phần D2 mà đợt mở công khai làm mất hiệu lực. **Vẫn đúng sau commit:**
không cổng thanh toán, không merchant account, không API key, không webhook,
**không trạng thái `awaiting_payment`**, không đối soát tự động.

Cái mới: mã QR quét được (`img.vietqr.io`, chỗ gọi **thứ ba** của pattern đã có
từ phí sự kiện 20260512130000 và phí team match 20260701120001) và hai mốc thời
gian — `payment_claimed_at` (người mua tự báo) và `payment_confirmed_at` (người
bán thấy tiền về).

Máy 5 trạng thái **nguyên vẹn**. Thanh toán là *thuộc tính* của đơn chứ không
phải một chặng của nó: đơn chậm tiền vẫn là `pending`, và người bán sẵn sàng gửi
trước không bị một lá cờ chặn lại.

### 3.3 Hai lỗ bảo mật vá kèm

Cả hai **có thật trên production**, đã probe trước khi vá:

```
GET /rest/v1/shops?select=slug,owner_user_id,city
→ [{"slug":"thepicklehub","owner_user_id":"5235268c-…","city":"Hà Nội"}]

SET ROLE anon; SELECT value_raw FROM shop_contact_channels;  (local, ở đúng
→ 0912345678                                                  grant state cũ)
```

`profiles` cho **mọi** user đăng nhập đọc toàn bộ hàng, nên một uid là đủ tra ra
danh tính thật đứng sau storefront.

Đợt quét `20260815090000` revoke anon khỏi `products`/`product_variants`/
`product_media` và **sót ba bảng**: `shops`, `shop_contact_channels`,
`shop_profile_media`.

Hai bảng sau lộ ra theo một đường vòng đáng ghi lại — xem §6.1.

---

## 4. CHƯA LÀM — cắt có chủ ý

**Cổng thanh toán thật (VNPay/MoMo/PayOS).** Cần đăng ký kinh doanh + hợp đồng
merchant, và với khối lượng hiện tại thì phí cộng công sức khó hoà. VietQR +
đối soát tay đạt đúng kết quả mà người mua quan tâm (quét là chuyển được) với
chi phí bằng không.

**Tự đối soát qua SePay/Casso.** Chạy được với tài khoản cá nhân, không cần đăng
ký kinh doanh — nhưng cần PO tự tạo tài khoản và nối ngân hàng. Là bước tiếp
theo tự nhiên nếu số đơn chuyển khoản đủ nhiều để việc bấm tay thành phiền.

**Wishlist · Đánh giá · Trả hàng · Khiếu nại** — vẫn cắt như Phase 3.

---

## 5. Sự cố dọn kèm: hai migration cùng dấu thời gian

#610 (Shop Phase 3) và #614 (news-repair abandon) merge **cùng ngày** và cùng
chọn `20260818090000`. Guard `check-migration-duplicates` **đỏ trên main** kể từ
lúc #614 vào.

Đổi tên phía Shop thành `20260818095000` vì slot ledger trên production đã thuộc
về `news_origins_abandoned_status` — chèn tên thứ hai vào cùng version là không
thể, và `ON CONFLICT DO NOTHING` **nuốt im lặng**, đó chính là cách chỗ này lộ
ra.

`095000` chứ không phải mốc bất kỳ: file phải chạy trước
`20260818100000_shop_orders`, và đó là ràng buộc thứ tự duy nhất thật sự tồn tại.

**Bài học:** `src/lib/__tests__/shop-schema-parity.test.ts` hardcode tên file đầy
đủ và là thứ duy nhất trong repo vỡ vì lần đổi tên. Nay nó phân giải theo **tên**
migration (`shop_cart_items`), không theo dấu thời gian. Version của một
migration được phép dời; tên mới là thứ định danh nó.

---

## 6. Bài học — đọc trước khi làm lần sau

### 6.1 Policy RLS chạy bằng quyền của role đang hỏi

Revoke `shops` khỏi anon làm đỏ **5 file pgTAP** với
`permission denied for table shops` phát ra từ những câu truy vấn **không hề
nhắc tới `shops`**.

Nguyên nhân: biểu thức `USING` của policy được đánh giá **bằng quyền của role
đang hỏi**. Nên một policy `TO public` dạng

```sql
USING (is_public AND state='approved'
       AND EXISTS (SELECT 1 FROM shops s WHERE s.id=shop_id AND s.state='active'))
```

âm thầm đòi anon phải có SELECT trên `shops`. Đúng hai bảng trong schema có hình
dạng đó, và anon có grant trên cả hai.

Cách tìm chúng, một câu:

```sql
SELECT tablename, policyname, has_table_privilege('anon','public.'||tablename,'SELECT')
FROM pg_policies WHERE schemaname='public' AND qual LIKE '%shops%';
```

Hệ quả thứ hai: Postgres kiểm quyền cho **mọi** quan hệ trong kế hoạch, kể cả
quan hệ do policy kéo vào, và **thứ tự báo lỗi không đảm bảo**. Một truy vấn bị
từ chối trên `shop_contact_channels` có thể báo tên `shops`. Đừng suy ra bảng
nào bị chặn từ tên trong thông báo lỗi.

### 6.2 `REVOKE SELECT ON table` không phải là thứ `information_schema` nói

`information_schema.column_privileges` vẫn liệt kê đủ 15 cột cho anon **sau khi**
đã revoke — vì nó suy ra hàng từ các quyền khác (TRUNCATE/REFERENCES/TRIGGER).
Kiểm bằng `has_column_privilege()` hoặc đọc thẳng `pg_class.relacl`:

```
shops | {…,anon=Dxtm/postgres,…}   ← không có `r` = không có SELECT
```

### 6.3 Test khoá một quyết định không ai còn giữ

`shop-pilot-seo.test.ts` khoá trạng thái *"mọi thứ dưới /shop đều noindex"*. Đó
là quyết định đúng của pilot đóng và là quyết định sai từ lúc PO mở cổng. Viết
lại nó không phải là "sửa test cho xanh" — giữ nguyên mới là bảo vệ một điều
không ai còn muốn.

Hai assertion `'anon has the SELECT grant its public policy needs'` cũng vậy:
chúng khoá đúng cái grant vừa được gỡ vì nó là lỗ hổng.

### 6.4 Regex `[\s\S]*?` bắt nhầm chính khối JSON-LD

Assertion `not.toMatch(/<script[^>]*>[^<]*alert/)` **đỏ trên output đúng**: bộ
tuần tự đã escape mọi `<` thành `<`, nên "không có `<` nào giữa thẻ và
alert" là **đúng** với output đã escape chuẩn. Nó đo nhầm thứ.

Bề mặt breakout thật chỉ có hai, và cả hai đều kiểm được chính xác:
1. Body: phải chứa `&lt;script&gt;`.
2. Khối `ld+json`: giữa thẻ mở và thẻ đóng **không được có `</script`**.

Một regex "không có script chạy được ở đâu cả" viết kiểu nào cũng span từ một
`<script>` không liên quan tới payload đã escape.

### 6.5 `npm run test` xanh không sống sót qua một lần đổi tên file

Suite xanh trước khi đổi tên migration và vẫn xanh sau đó **trên máy dev** —
nhưng CI đỏ, vì lần chạy local diễn ra *trước* thao tác `git mv`. Đổi tên file mà
test đọc bằng đường dẫn thì phải chạy lại toàn bộ suite **sau** khi đổi.

Và: `grep ... | head` giấu mất kết quả. Lần grep tìm tham chiếu tới
`20260818090000` bỏ sót đúng file test làm CI đỏ, vì `docs/` có ≥10 kết quả và
`head` cắt phần `src/`.

---

## 7. Quyết định sản phẩm đã chốt

| # | Quyết định |
|---|---|
| P4-1 | Mở công khai = **ai đăng nhập cũng mua được**. Không đổi cổng pilot vì cổng pilot chỉ gác việc BÁN, chưa bao giờ gác việc MUA |
| P4-2 | `/shop/search` noindex vĩnh viễn, không nằm trong cờ |
| P4-3 | `availability` trong schema **chỉ** phát khi shop thật sự nhận được đơn. `ordering_enabled=false` ⇒ bỏ hẳn trường, giữ giá |
| P4-4 | Bộ ba ngân hàng all-or-nothing. Hai trên ba sinh QR quét được rồi mới hỏng — người mua tin là mình đã trả |
| P4-5 | Nội dung chuyển khoản **chính là mã đơn**, sinh ở server. Không tiền tố |
| P4-6 | Xác nhận tiền **không** cần người mua bấm báo trước. Người bán nhìn sao kê của chính họ |
| P4-7 | Vai `support` không đụng vào tiền — cùng luật với không chuyển được trạng thái |
| P4-8 | `payment_confirmed_by` không rời server (là uid, `profiles` đọc được bởi mọi người đăng nhập) |

---

## 8. Nợ mang sang

| # | Việc | Ghi chú |
|---|---|---|
| 1 | **Drift 13 migration cũ** | Nợ kinh niên từ 04/08, KHÔNG phải của Phase 3/4. `DRIFT_STRICT=1` vẫn đỏ. Cấm chèn ledger mù — có file thật sự chưa áp |
| 2 | **Telegram ping khi có đơn mới** | Vẫn chưa có edge function gửi Telegram dùng chung |
| 3 | **User rác prod** `0bbe10dc-…` | Nợ từ trước |
| 4 | **Rendition JPEG cũ còn EXIF** | Cách chữa là bảo seller up lại ảnh |
| 5 | **`ask-model.mjs` không tồn tại** | Audit UI vẫn một chiều |
| 6 | **Chưa ai chạy tay luồng chuyển khoản trên điện thoại thật** | pgTAP + jsdom đứng sau; QR thật thì phải quét bằng app ngân hàng |
| 7 | **`68px` buybar vẫn là số đo cứng** | Nợ từ Phase 3 |

---

## 9. Đường dẫn

- Bản đồ phase gốc: `docs/proposals/shop-marketplace/production-implementation-map.md`
- Bàn giao Phase 3: `docs/build-feature/shop-phase-3/HANDOFF.md`
- Script bật/tắt cờ Cloudflare: `$CLAUDE_JOB_DIR/tmp/cf-preview-flag.mjs` (tạm; chép vào `scripts/` nếu muốn giữ)
