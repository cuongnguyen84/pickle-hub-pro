# Kết quả cổng kiểm tra — nền tảng closed pilot

> Nhánh `feat/shop-closed-pilot`, cây làm việc sạch.
> Cơ sở dữ liệu dựng lại từ số không trước khi đo bất cứ thứ gì.
>
> **Đây là kết quả cục bộ.** Không có gì được deploy, và không con số nào ở đây
> nói về remote.
>
> Cập nhật **sau CP16** (Chính sách bảo mật nêu tên dữ liệu Shop + chẩn đoán B12).

---

## 1. Bảng kết quả

| Cổng | Lệnh | Sau CP13 | Sau CP15 | **Sau CP16** |
|---|---|---|---|---|
| Reset cơ sở dữ liệu | `npx supabase db reset --local` | exit 0 | exit 0 | **exit 0** |
| Ledger parity | `count(*) FROM supabase_migrations.schema_migrations` | 351 / 351 | 352 / 352 | **352 / 352** |
| pgTAP | `npx supabase test db --local supabase/tests` | 1 312 · 34 file | 1 331 · 35 file | **1 335 PASS · 36 file · exit 0** |
| Unit | `npx vitest run` | 2 051 · 158 file | 2 061 · 159 file | **2 088 PASS · 10 skipped · 161 file · exit 0** |
| HTTP integration quy chế | `npx vitest run scripts/shop-seller-rules-integration.test.mjs` | 11 PASS | 11 PASS | **11 PASS · 0 skip** |
| Chẩn đoán xoá tài khoản | `npx vitest run scripts/shop-account-deletion-b12.test.mjs` | — | — | **6 PASS** — gọi thật hàm edge |
| Storage + vòng đời ảnh | file integration trên stack thật | trong lượt unit | trong lượt unit | **trong lượt unit, không skip** |
| noindex ở edge | 2 file `shop-pilot-seo*` | 116 PASS | 116 PASS | **116 PASS** (không đổi) |
| Typecheck | `npx tsc -b` | exit 0 | exit 0 | **exit 0** |
| Lint | `npx eslint .` | exit 0 · 29 cảnh báo | exit 0 | **exit 0 · 0 lỗi · 29 cảnh báo có sẵn** |
| Build | `npm run build` | exit 0 | exit 0 | **exit 0** |
| Bundle | `BUNDLE_STRICT=1 node scripts/check-bundle-size.mjs` | exit 0 | exit 0 | **exit 0** |
| Dọn dữ liệu | đếm độc lập trên cùng cơ sở dữ liệu | 19/19 = 0 | 8/8 Shop = 0 | **10/10 bộ đếm = 0**, gồm `shop_media_cleanup_jobs` và object Storage |

Ba cổng **không chạy lại** ở CP15 và CP16: `build:proto`, Q01–Q04 và nghiệm thu
P2b. Ở CP16 có đổi mã client (`Privacy.tsx` + hai file i18n), nhưng **không đổi
shell, layout, route hay component dùng chung** — 37 màn hình prototype và 20
route Shop không đi qua trang Chính sách bảo mật. Nói ra thay vì chép số cũ vào
cột mới: một con số chép lại trông hệt một con số vừa đo.

### Bundle — delta CP12 → CP16

```
                  trước CP12    sau CP12    sau CP13    sau CP15    sau CP16   tổng
INITIAL gz         226,6 KB     226,6 KB    226,6 KB    226,6 KB    226,6 KB    0,0 KB  / 280 KB
CODE gz           1551,4 KB    1552,8 KB   1553,9 KB   1554,3 KB   1555,3 KB   +3,9 KB  / 1800 KB
CONTENT (blog)     383,9 KB     383,9 KB    383,9 KB    383,9 KB    383,9 KB    0,0 KB
Tổng gz JS        1935,3 KB    1936,8 KB   1937,8 KB   1938,2 KB   1939,2 KB   +3,9 KB  / backstop 1970 KB
```

**CP15 không đổi một dòng mã client** — +0,4 KB ở cột đó là nhiễu build đã biết
(±0,6 KB giữa hai lần build cùng một cây); quy chế sống trong cơ sở dữ liệu,
không nằm trong bundle.

**CP16 là +1,0 KB thật**: một mục mới trong Chính sách bảo mật, nhân hai ngôn
ngữ. Nó nằm trong `locale-vi` / `locale-en`, **không** nằm trong `INITIAL` —
`INITIAL` không đổi một byte qua cả bốn checkpoint.

**Backstop KHÔNG nâng.** Còn **30,8 KB**, dưới 5% — cổng nói thẳng rằng PR kế
tiếp phải trả lại phần này.

Chia theo checkpoint: **+1,5 KB** màn hình chấp thuận của người bán (CP12),
**+1,0 KB** panel biên lai của người kiểm duyệt (CP13), **+1,0 KB** mục Shop
trong Chính sách bảo mật ×2 ngôn ngữ (CP16). **Không thêm dependency nào** qua
cả bốn đợt.

### Nghiệm thu P2b — 20 route × 6 chiều rộng + 6 hành trình

```
✓ 320 / 375 / 390 / 414 / 768 / 1440 px — 20 route mỗi mức
✓ /vi twins render
✓ J1 người ngoài pilot bị chặn ở cửa
✓ J1 yêu-cầu-sửa tới được người nộp, ghi chú nội bộ thì không
✓ J1 duyệt là idempotent — một shop, không phải hai
✓ J2 yêu-cầu-sửa tới được người bán kèm mục tiêu
✓ J2 duyệt KHÔNG tự publish
✓ J2 chính commit publish mới làm nó công khai
✓ J2 đình chỉ gỡ nó khỏi mọi bề mặt công khai
✓ J2 mở lại trả về cho người bán, vẫn chưa bán (Q5)
✓ J3 chỉ kênh đã duyệt là công khai
✓ J3 sửa một kênh đang sống kéo nó về chờ duyệt
✓ J3 lịch sử đầy đủ và ghi chú nội bộ không có trong đó
✓ J4 slug cũ chuyển tiếp, canonical đi theo
✓ J4 đã-đình-chỉ và chưa-từng-tồn-tại cho cùng một câu trả lời
✓ J5 tìm kiếm khớp cả có dấu lẫn không dấu
✓ J5 back khôi phục truy vấn và kết quả
✓ J6 ranh giới tenancy và AAL giữ vững
```

---

## 2. Hai lần đỏ vì môi trường, không phải vì hồi quy

**Worktree mới không có `node_modules`.** Lượt chạy đầu: `tsc` mất
`fast-xml-parser`, build mất `hls.js/dist/hls.light.mjs`, một test file không
load được. Không cái nào là hồi quy — cây cần `npm ci` trước khi cổng có nghĩa.
Ghi lại vì **một cây chưa cài phụ thuộc tạo ra ba lỗi trông y hệt ba lỗi thật.**

**Cổng prototype đỏ vì đúng lý do, ở lần chạy sai.** `npm run dev:proto` thấy
cổng 8080 bị chiếm (phiên khác), tự nhảy sang 8081, trong khi
`proto-shop-qa.mjs` vẫn gõ cửa 8080 và gặp một ứng dụng **không có** prototype.
Nó exit 1 với "Không thấy màn hình nào" — hành vi **đúng**: đỏ khi không tìm
thấy prototype, thay vì xanh trên số không. Chạy lại với `--strictPort` và
`PROTO_BASE_URL` tường minh → 37 màn hình, 0 phát hiện.

> Bài học: **cố định cổng, và khẳng định mình đang nói chuyện với đúng máy chủ.**

---

## 3. 🔴 Phát hiện: teardown nói dối lần thứ năm — lần này ở tầng Storage

`shop-p2b-acceptance-qa.mjs` báo cáo:

```
teardown: {"shops":0,"products":0,…,"objects":0,"errors":0}
```

Mọi con số bằng 0, kể cả `objects`. Đếm độc lập trên **chính cơ sở dữ liệu vừa
QA** nói khác:

```
shops products variants media applications … storage_objects
    0        0        0     0            0 …               6
```

**Sáu object nằm lại trong bucket RIÊNG TƯ `shop-product-media-draft`.**

### Đó là ai

Không phải teardown của bộ nghiệm thu — nó dọn sạch phần của nó. Cô lập bằng
cách chạy từng file và đếm giữa các lần:

```
trước:                                          draft = 6
sau shop-media-integration.test.mjs             draft = 8   ← +2
sau shop-media-ordering-integration.test.mjs    draft = 8
sau shop-p2b-media-lifecycle.test.mjs           draft = 8
```

`scripts/shop-media-integration.test.mjs` rò rỉ **đúng 2 object mỗi lần chạy**.
Sáu object là ba lần chạy trước đó.

### Nguyên nhân gốc

Đường dẫn do máy chủ chọn là `<shop>/<product>/<media>/original` — **ba** tầng
dưới shop. `afterAll` chỉ đi xuống **hai** tầng rồi gọi `remove()` lên thứ nó
tìm thấy ở đó. Nhưng ở tầng đó chúng là **tiền tố**, không phải object, nên
`remove()` là no-op — và nó **không báo lỗi**, vì xoá một key không tồn tại là
thành công hợp lệ trong Storage.

Đó là lý do bộ đếm nói 0: bộ đếm hỏi `storage.objects` cho những đường dẫn nó
tin là đã xoá, và nó chưa bao giờ biết những đường dẫn ba tầng kia tồn tại.

### Vá

`afterAll` giờ đi xuống **tận đáy** thay vì tới một độ sâu cố định, phân biệt
object với tiền tố bằng `entry.id` (Supabase trả `id: null` cho tiền tố).

### Chứng minh — đỏ trước, xanh sau

| | trước vá | sau vá |
|---|---|---|
| chạy lần 1 | +2 | **+0** |
| chạy lần 2 | +2 | **+0** |
| 17 test trong file | PASS | PASS |

Sau khi dọn 8 object mồ côi còn lại: **cả 17 bộ đếm = 0, gồm cả `storage_objects`.**

### Vì sao nó quan trọng hơn vẻ ngoài

Trên máy cục bộ, tám object rác là tiếng ồn. Nhưng:

1. **Bucket đó là RIÊNG TƯ.** Rò rỉ ở đây là rò rỉ đúng loại dữ liệu mà D1 dựng
   ra để bảo vệ.
2. **File test nhắm vào bất kỳ môi trường nào nó được trỏ tới.** Chạy nó ngoài
   máy cục bộ sẽ để lại object riêng tư trong một bucket thật. (Quyết định
   staging của Product Owner làm hậu quả nhẹ đi — nhưng "nhẹ đi" không phải
   "không còn".)
3. **Nó là lần thứ năm một teardown ở repo này báo cáo sạch trong khi không
   sạch.** Bốn lần trước ở tầng cơ sở dữ liệu; lần này ở tầng Storage, chỗ mà
   bản sao lưu cơ sở dữ liệu không với tới.

> **Quy tắc rút ra, và nó đã đúng năm lần:** một teardown không bao giờ được tin.
> Đếm trên chính cơ sở dữ liệu vừa dùng, bằng một truy vấn không liên quan gì
> tới đoạn mã đã ra lệnh xoá. Đó là thứ duy nhất từng bắt được lớp lỗi này.

---

## 4. Bẫy đã tránh trong lượt chạy này

| Bẫy | Đã làm gì |
|---|---|
| **Edge runtime cục bộ cache isolate** | `docker restart supabase_edge_runtime_ajvlcamxemgbxduhiqrl` sau `db reset` |
| **Test chạy song song trên MỘT cơ sở dữ liệu** | Xem §5 — một assertion về trạng thái toàn cục là một assertion về test của người khác |
| **pgTAP đếm sản phẩm publishable toàn cục** | pgTAP chạy trên cơ sở dữ liệu sạch, trước mọi fixture; chạy lại sau khi fixture đã hạ |
| **`npm run dev` thường = xanh giả cho proto** | dùng `VITE_PROTO_SHOP=1` + probe `/proto/shop` → 200 trước khi chạy QA |
| **`BUNDLE_STRICT` không phải cổng thật** | chạy `scripts/check-bundle-size.mjs` trực tiếp, cả hai chế độ |
| **`build:proto` ghi đè `dist/`** | cổng bundle chạy trên bản build production, **trước** `build:proto` |

---

## 5. Ba defect CP12 bắt được, và cái thứ ba là về chính bộ test

### 5.1 Thiếu grant `service_role` trên `legal_documents`

Lượt chạy đầu của bộ HTTP integration trả `42501` kèm gợi ý nêu đúng câu `GRANT`
còn thiếu. `service_role` đi vòng qua RLS nhưng **không** đi vòng qua tầng grant.

Repo này đã chạy **hai đợt quét** cho đúng lớp lỗi đó. Cả pgTAP lẫn typechecker
đều không thấy nó — chỉ thứ nói chuyện với PostgREST theo cách một client nói
mới thấy được.

### 5.2 Trigger append-only làm không xoá được hồ sơ

`legal_acceptances.application_id` là `ON DELETE SET NULL`, nên xoá một hồ sơ
khiến Postgres UPDATE dòng chữ ký để gỡ con trỏ — và trigger từ chối. **Mọi**
`DELETE FROM shop_applications` sẽ hỏng: teardown QA, dọn dẹp của admin, và
đường xoá tài khoản.

Chỉ lượt chạy trình duyệt gặp được, và lý do đáng ghi: **pgTAP khẳng định bên
trong một transaction nó rollback**, nên nó không bao giờ xoá một hồ sơ nào và
không bao giờ chạm vào cạnh này. Lượt chạy trình duyệt hạ một fixture thật.

Nó **báo cáo** được là nhờ teardown đã được dạy thôi nói dối hai commit trước
đó — phiên bản cũ sẽ nuốt lỗi và in một hàng số 0.

### 5.3 Một assertion về trạng thái toàn cục, trên một cơ sở dữ liệu dùng chung

`shop-p2b-media-lifecycle.test.mjs` khẳng định hàng đợi dọn ảnh **rỗng toàn cục**
sau hai lần drain. Nhưng `shop_media_cleanup_claim` là toàn cục — đúng như vậy,
nó **là** worker — và các bộ integration dùng chung một cơ sở dữ liệu cục bộ,
chạy song song, và tự xếp job của mình vào đó.

Nó xanh cho tới ngày một bộ test mới tham gia và đổi nhịp. Nó không hồi quy gì
cả: **nó đang khẳng định một sự thật về test của người khác.**

Giờ nó chỉ lọc những job có đường dẫn bắt đầu bằng shop id của chính nó. Hai
lượt `npx vitest run` liên tiếp đều xanh, và `storage.objects` giữ 0 qua cả hai.

> Quy tắc rút ra: **trên một tài nguyên dùng chung, chỉ khẳng định thứ mình sở
> hữu.** "Hàng đợi rỗng" và "hàng đợi không còn gì của tôi" nghe giống nhau và
> chỉ một câu là kiểm được.

---

## 6. CP15 — đỏ trước, xanh sau, tại đúng call site production

Hai đường mà một bản quy chế sai có thể đi vào một môi trường thật, và cả hai
đều đã bị làm cho ĐỎ trước khi được tuyên là xanh.

### 6.1 Môi trường đang giữ một `seller-rules/v1` KHÁC

Đây là thất bại im lặng mà `ON CONFLICT DO NOTHING` một mình sẽ tạo ra: chèn
không làm gì, migration báo thành công, và staging phục vụ một văn bản khác
production.

Phá đúng call site — chính file migration sẽ chạy trên staging và production —
bằng cách cho cơ sở dữ liệu giữ sẵn một v1 với nội dung khác, rồi chạy file đó:

```
BEGIN
DELETE 1
INSERT 0 1
INSERT 0 0        ← ON CONFLICT nuốt lệnh chèn, đúng như dự đoán
psql:redproof.sql:768: ERROR:  seller-rules v1 hash mismatch:
  stored   68b71374fdb42a05b30d1210e71b1e2da094dd2abe24edc51dcc2f155c7d8755,
  approved fb62bd471d7b6b27c53d9eeded57dd636aa2f1f1f03db9a4a20abd49d7c70c98
CONTEXT:  PL/pgSQL function inline_code_block line 19 at RAISE
```

`INSERT 0 0` là bằng chứng bản thân nó: không có khối `DO`, migration đã kết
thúc ngay tại đó và báo xanh. Sau `ROLLBACK`, dòng thật vẫn nguyên hash
`fb62bd47…`.

### 6.2 Văn bản đã duyệt bị sửa sau khi migration được viết

Thêm **một dấu cách** vào cuối một dòng tiêu đề trong `seller-rules-v1.md`:

```
× publishes the approved file byte for byte
× carries the sha256 of that file, recomputed here rather than trusted
Tests  2 failed | 8 passed (10)
```

Hoàn nguyên file → 10/10 xanh, hash trở lại `fb62bd47…c70c98`.

Hai assertion đỏ cùng lúc là có chủ ý: một cái bắt nội dung lệch, một cái bắt
hằng số hash mô tả một văn bản không còn tồn tại. Nếu chỉ giữ assertion hash,
một lần sinh lại migration từ file đã sửa sẽ **tự làm mình xanh trở lại** — và
đó chính là thứ cần đỏ.

### 6.3 Dọn dữ liệu — đếm độc lập trên chính cơ sở dữ liệu vừa chạy test

Đếm sau khi mọi cổng đã chạy, trên cùng cơ sở dữ liệu, bằng một truy vấn không
dùng lại mã của teardown:

```
legal_documents (khác v1) = 0    legal_acceptances = 0
shop_applications        = 0    shop_application_events = 0
shops                    = 0    shop_pilot_members = 0
products                 = 0    tài khoản *.thepicklehub.test = 0
```

Dòng đầu tiên là dòng đáng đọc: bộ đếm **loại trừ** `seller-rules/v1`, vì nó
không phải rác của test mà là dữ liệu do migration sở hữu. Một bộ đếm "0 tổng"
ở đây sẽ đỏ mãi mãi kể từ CP15, và ai đó sẽ sửa nó bằng cách nới lỏng chứ không
bằng cách hiểu.

---

## 7. CP16 — đỏ trước, xanh sau, lần này ở trang Chính sách bảo mật

Phá **trang**, không phải test:

| Phá gì | Kết quả |
|---|---|
| Xoá `<section>` Shop khỏi `Privacy.tsx` và trả ngày về `28/12/2024` | **4 đỏ** — cả VI lẫn EN, ngày, và thứ tự mục |
| Nhét "địa chỉ lấy hàng" vào bullet **công khai** trong `vi.ts` | **1 đỏ** — đúng assertion tồn tại cho việc đó |
| Hoàn nguyên | **21/21 xanh** |

Vì sao khoá ở hai tầng: một mục chỉ tồn tại trong từ điển là một mục **không ai
được xem**. Bốn lỗi gần nhất của repo này đều nằm ở chỗ nối, không nằm trong hàm.

### Chẩn đoán B12 — đo, không suy luận

`scripts/shop-account-deletion-b12.test.mjs` đi qua đúng đường
`useDeleteAccount → functions.invoke → delete-account → auth.admin.deleteUser`.
Quan hệ nhân quả nằm trong chính bộ test: **cùng một tài khoản**, cùng một lời
gọi — có shop thì thất bại, xoá shop đi rồi gọi lại thì thành công.

Ba điều chỉ đo mới thấy, đọc khoá ngoại thì không:

1. `delete-account` trả **200 success** trong khi **cả 13 bước dọn dữ liệu của
   nó thất bại** (10 thiếu grant, 2 bảng không tồn tại, 1 cột đổi tên). Tài
   khoản vẫn bị xoá — nhờ CASCADE. → **B14**.
2. GoTrue nuốt vi phạm khoá ngoại thành `"Database error deleting user"`. Không
   ai — kể cả người vận hành — biết cái chặn là một shop.
3. Hồ sơ của chủ shop **còn nguyên** sau lần xoá thất bại, nhưng **do may**:
   những lệnh xoá đáng lẽ chạy trước đều lỗi quyền. Cấp quyền mà không sửa luồng
   sẽ biến vòng lặp vô hại đó thành một lần xoá thật, chạy **trước**
   `deleteUser`, không transaction.

### B13 — chặn Packet C

`supabase/tests/shop_media_reconcile_profile_gap.test.sql` chạy chính
`shop_media_reconcile()` trên một logo **đã publish, đã verified**, upload 2 giờ
trước:

```
{"unstuck": 0, "orphans_queued": 1}
hàng đợi dọn chứa ĐÚNG đường dẫn logo đang sống
```

Vòng quét orphan chỉ hỏi `product_media`; `shop_profile_media` ra đời hai
migration sau, cùng bucket. Chưa từng nổ **chỉ vì cron chưa deploy ở đâu**.
