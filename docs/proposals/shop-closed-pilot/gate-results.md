# Kết quả cổng kiểm tra — nền tảng closed pilot

> Nhánh `feat/shop-closed-pilot`, nền `f172a441`, cây làm việc sạch.
> Cơ sở dữ liệu dựng lại từ số không trước khi đo bất cứ thứ gì.
>
> **Đây là kết quả cục bộ.** Không có gì được deploy, và không con số nào ở đây
> nói về remote.

---

## 1. Bảng kết quả

| Cổng | Lệnh | Kết quả |
|---|---|---|
| Reset cơ sở dữ liệu | `npx supabase db reset --local` | exit 0 |
| Ledger parity | `count(*) FROM supabase_migrations.schema_migrations` | **350 / 350 file** |
| Schema Shop | `information_schema` | 11 bảng `shop*` + 7 `product*`, **2** bucket |
| pgTAP | `npx supabase test db --local supabase/tests` | **1 241 PASS** · 33 file · 0 `not ok` · exit 0 |
| Unit | `npx vitest run` | **2 014 PASS** · 10 skipped · 156 file · exit 0 |
| Storage + vòng đời ảnh | 3 file integration trên stack thật | **40 PASS** · exit 0 · **không skip** |
| noindex ở edge | 2 file `shop-pilot-seo*` | **116 PASS** · exit 0 |
| Typecheck | `npx tsc -b` | exit 0 |
| Lint | `npx eslint .` | exit 0 — 0 lỗi, 29 cảnh báo có sẵn |
| Build | `npm run build` | exit 0 |
| Bundle | `BUNDLE_STRICT=1 node scripts/check-bundle-size.mjs` | exit 0 |
| Build prototype | `npm run build:proto` | exit 0 |
| Q01–Q04 | `PROTO_BASE_URL=… node scripts/proto-shop-qa.mjs all` | **37 màn hình, 0 phát hiện** · exit 0 |
| Nghiệm thu P2b | `SHOP_QA_BASE_URL=… node scripts/shop-p2b-acceptance-qa.mjs` | **PASS** · exit 0 |
| Dọn dữ liệu | đếm độc lập trên cùng cơ sở dữ liệu | **17/17 bộ đếm = 0** (sau khi vá — §3) |

### Bundle

```
INITIAL (first-paint) gz   226,6 KB  / 280 KB   — 6 request đường tới hạn
CODE gz                   1551,4 KB  / 1800 KB
CONTENT (blog) gz          383,9 KB  / 51 chunk, trần 20 KB mỗi chunk
Tổng gz JS                1935,3 KB  / backstop 1970 KB   ← KHÔNG nâng
```

Còn 34,7 KB, dưới 5%, và cổng nói thẳng rằng PR kế tiếp phải trả lại. So với
1935,5 KB của P2b: chênh 0,2 KB là nhiễu build, không phải hồi quy.

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
2. **Preview dùng chung cơ sở dữ liệu với production** ([`preview-deployment.md` §2](./preview-deployment.md)).
   File test này nhắm vào bất kỳ môi trường nào nó được trỏ tới — chạy nó trên
   preview sẽ để lại object riêng tư trong bucket thật.
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
| **pgTAP đếm sản phẩm publishable toàn cục** | pgTAP chạy trên cơ sở dữ liệu sạch, trước mọi fixture; chạy lại sau khi fixture đã hạ |
| **`npm run dev` thường = xanh giả cho proto** | dùng `VITE_PROTO_SHOP=1` + probe `/proto/shop` → 200 trước khi chạy QA |
| **`BUNDLE_STRICT` không phải cổng thật** | chạy `scripts/check-bundle-size.mjs` trực tiếp, cả hai chế độ |
| **`build:proto` ghi đè `dist/`** | cổng bundle chạy trên bản build production, **trước** `build:proto` |
