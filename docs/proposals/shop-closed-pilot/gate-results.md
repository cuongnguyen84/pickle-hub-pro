# Kết quả cổng kiểm tra — nền tảng closed pilot

> Nhánh `feat/shop-closed-pilot`, cây làm việc sạch.
> Cơ sở dữ liệu dựng lại từ số không trước khi đo bất cứ thứ gì.
>
> **Đây là kết quả cục bộ.** Không có gì được deploy, và không con số nào ở đây
> nói về remote.
>
> Cập nhật **sau CP12** (cưỡng chế chấp thuận quy chế người bán).

---

## 1. Bảng kết quả

| Cổng | Lệnh | Trước CP12 | Sau CP12 | **Sau CP13** |
|---|---|---|---|---|
| Reset cơ sở dữ liệu | `npx supabase db reset --local` | exit 0 | exit 0 | **exit 0** |
| Ledger parity | `count(*) FROM supabase_migrations.schema_migrations` | 350 / 350 | 351 / 351 | **351 / 351** |
| pgTAP | `npx supabase test db --local supabase/tests` | 1 241 · 33 file | 1 302 · 34 file | **1 312 PASS · 34 file · exit 0** |
| Unit | `npx vitest run` | 2 014 · 156 file | 2 048 · 158 file | **2 051 PASS · 10 skipped · 158 file · exit 0** |
| Storage + vòng đời ảnh | file integration trên stack thật | 40 PASS | trong lượt unit | **trong lượt unit, không skip** |
| noindex ở edge | 2 file `shop-pilot-seo*` | 116 PASS | 116 PASS | **116 PASS** (không đổi) |
| Typecheck | `npx tsc -b` | exit 0 | exit 0 | **exit 0** |
| Lint | `npx eslint .` | exit 0 · 29 cảnh báo | exit 0 | **exit 0 · 0 lỗi · 29 cảnh báo có sẵn** |
| Build | `npm run build` | exit 0 | exit 0 | **exit 0** |
| Bundle | `BUNDLE_STRICT=1 node scripts/check-bundle-size.mjs` | exit 0 | exit 0 | **exit 0** |
| Build prototype | `npm run build:proto` | exit 0 | exit 0 | **exit 0** |
| Q01–Q04 | `PROTO_BASE_URL=… node scripts/proto-shop-qa.mjs all` | 37 màn hình, 0 phát hiện | 37, 0 | **37 màn hình, 0 phát hiện** |
| Nghiệm thu P2b | `SHOP_QA_BASE_URL=… node scripts/shop-p2b-acceptance-qa.mjs` | PASS | PASS | **PASS** — 20 route × 6 chiều rộng, 6 hành trình |
| Dọn dữ liệu | đếm độc lập trên cùng cơ sở dữ liệu | 17/17 = 0 | 19/19 = 0 | **19/19 bộ đếm = 0** |

### Bundle — delta CP12 và CP13

```
                  trước CP12    sau CP12    sau CP13    tổng thay đổi
INITIAL gz         226,6 KB     226,6 KB    226,6 KB      0,0 KB   / 280 KB
CODE gz           1551,4 KB    1552,8 KB   1553,9 KB     +2,5 KB   / 1800 KB
CONTENT (blog)     383,9 KB     383,9 KB    383,9 KB      0,0 KB
Tổng gz JS        1935,3 KB    1936,8 KB   1937,8 KB     +2,5 KB   / backstop 1970 KB
```

**Backstop KHÔNG nâng.** Còn **32,2 KB**, dưới 5% — cổng nói thẳng rằng PR kế
tiếp phải trả lại phần này.

Chi phí chia đôi rõ ràng: **+1,5 KB** cho màn hình chấp thuận của người bán
(CP12), **+1,0 KB** cho panel biên lai của người kiểm duyệt (CP13). **Không
thêm dependency nào.**

`INITIAL` **không đổi một byte** qua cả hai đợt — cả hai màn hình đều nằm trong
chunk route của chúng (`/seller/application`, `/admin/shop/applications/:id`),
không nằm trên đường tới paint đầu tiên.

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
