# CP10 — Bộ nghiệm thu closed pilot

> Hai phần, và **không được lẫn**:
>
> **§1–§2** — cổng kiểm tra cục bộ, **đã chạy** trên nền tảng closed-pilot, kèm
> số thật.
> **§3–§5** — bộ smoke chạy trên môi trường **đã deploy**. **Chưa chạy**, vì
> chưa có gì được deploy.

---

## 1. Cổng kiểm tra cục bộ — ĐÃ CHẠY

Nhánh `feat/shop-closed-pilot`, cây làm việc sạch.
Cơ sở dữ liệu dựng lại từ số không trước khi đo bất cứ thứ gì.

> ⚠️ **Bảng dưới đây là lượt chạy TRƯỚC CP12.** Con số sau khi thêm cưỡng chế
> chấp thuận quy chế — ledger 351, pgTAP **1 302**, unit **2 048**, bundle
> **1 936,8 KB** (+1,5 KB, backstop không nâng) — nằm ở
> [`gate-results.md` §1](./gate-results.md), kèm bảng delta. Giữ bảng cũ ở đây
> để so sánh được, không phải vì nó là con số hiện hành.

| Cổng | Lệnh | Kết quả |
|---|---|---|
| Reset cơ sở dữ liệu | `npx supabase db reset --local` | **exit 0** — 350 migration replay |
| Ledger parity | `SELECT count(*) FROM supabase_migrations.schema_migrations` | **350 / 350 file** |
| Schema Shop hiện diện | `information_schema` | 11 bảng `shop*` + 7 bảng `product*`, **2** bucket Shop |
| pgTAP | `npx supabase test db --local supabase/tests` | **1 241 PASS**, 33 file, 0 `not ok`, exit 0 |
| Unit | `npx vitest run` | **2 014 PASS**, 10 skipped, 156 file, exit 0 |
| Storage + vòng đời ảnh | `npx vitest run scripts/shop-media-integration.test.mjs scripts/shop-media-ordering-integration.test.mjs scripts/shop-p2b-media-lifecycle.test.mjs` | **40 PASS**, 3 file, exit 0 — chạy thật trên stack cục bộ, **không** skip |
| noindex ở edge | `npx vitest run functions/_lib/__tests__/shop-pilot-seo.test.ts …-edge.test.ts` | **116 PASS**, exit 0 |
| Typecheck | `npx tsc -b` | **exit 0** |
| Lint | `npx eslint .` | **exit 0** — 0 lỗi, 29 cảnh báo (có sẵn) |
| Build production | `npm run build` | **exit 0** |
| Ngân sách bundle | `BUNDLE_STRICT=1 node scripts/check-bundle-size.mjs` | **exit 0** |
| Build prototype | `npm run build:proto` | **exit 0** |
| Q01–Q04 prototype | `PROTO_BASE_URL=… node scripts/proto-shop-qa.mjs all` | **37 màn hình, 0 phát hiện**, exit 0 |
| Nghiệm thu P2b | `SHOP_QA_BASE_URL=… node scripts/shop-p2b-acceptance-qa.mjs` | **PASS** — 20 route × 6 chiều rộng, 6 hành trình, exit 0 |
| Dọn dữ liệu | đếm độc lập trên cùng cơ sở dữ liệu | **17/17 bộ đếm = 0** (sau khi vá — §1.3) |
| pgTAP **chạy lại sau QA** | `npx supabase test db --local supabase/tests` | **1 241 PASS** lần thứ hai, trên chính cơ sở dữ liệu QA vừa dùng |

### Số bundle

```
INITIAL (first-paint) gz   226.6 KB  / 280 KB   — 6 request đường tới hạn
CODE gz                   1551.4 KB  / 1800 KB
CONTENT (blog) gz          383.9 KB  / 51 chunk, trần 20 KB mỗi chunk
Tổng gz JS                1935.3 KB  / backstop 1970 KB
```

Backstop **không** được nâng. Còn 34,7 KB — dưới 5%, và cổng nói thẳng rằng PR
kế tiếp phải trả lại phần này. Con số dao động ±0,6 KB giữa các lần build; 1935,3
so với 1935,5 của P2b là nhiễu, không phải hồi quy.

### 1.1 Hai điều đã học được khi chạy các cổng này

**Worktree mới không có `node_modules`.** Lượt chạy đầu tiên: `tsc` không tìm
thấy `fast-xml-parser`, build không tìm thấy `hls.js/dist/hls.light.mjs`, và
một test file không load được. Không cái nào là hồi quy — worktree cần
`npm ci` trước khi bất kỳ cổng nào có nghĩa. Ghi ở đây vì **một cây chưa cài
phụ thuộc tạo ra ba lỗi trông y hệt ba lỗi thật.**

**Cổng prototype đỏ vì đúng lý do, ở lần chạy sai.** `npm run dev:proto` thấy
cổng 8080 đã bị chiếm (một phiên khác), nên nó tự nhảy sang 8081 — trong khi
`proto-shop-qa.mjs` vẫn gõ cửa 8080 và gặp một ứng dụng **không có** prototype.
Nó báo `exit 1` với "Không thấy màn hình nào". Đó là hành vi **đúng**: cổng này
đỏ khi không tìm thấy prototype, thay vì xanh trên số không. Chạy lại với cổng
cố định `--strictPort` và `PROTO_BASE_URL` tường minh.

> Bài học chung, đã lặp: **luôn cố định cổng và luôn khẳng định đang nói chuyện
> với đúng máy chủ.** Một QA gõ nhầm cửa là một QA đo nhầm thứ.

### 1.2 Cổng trình duyệt

Chi tiết từng hành trình, và hai lần đỏ vì môi trường chứ không phải hồi quy:
[`gate-results.md`](./gate-results.md).

### 1.3 🔴 Teardown nói dối lần thứ năm — lần này ở tầng Storage

Bộ nghiệm thu P2b in `"objects": 0`. Đếm độc lập trên **chính cơ sở dữ liệu vừa
QA** tìm thấy **6 object nằm lại trong bucket RIÊNG TƯ `shop-product-media-draft`**.

Thủ phạm không phải teardown của bộ nghiệm thu — mà là
`scripts/shop-media-integration.test.mjs`, rò rỉ **đúng 2 object mỗi lần chạy**.
`afterAll` của nó đi xuống hai tầng thư mục, nhưng đường dẫn do máy chủ chọn là
`<shop>/<product>/<media>/original` — **ba** tầng. `remove()` được gọi lên các
**tiền tố**, và xoá một key không tồn tại là thành công hợp lệ trong Storage,
nên nó không báo lỗi.

Đã vá: `afterAll` giờ đi xuống tận đáy, phân biệt object với tiền tố bằng
`entry.id`. Đỏ-trước-xanh-sau: +2/lần → **+0/lần**, hai lần liên tiếp; và
`storage_objects` giữ nguyên **0 → 0** qua một lượt `npx vitest run` đầy đủ.

Vì sao nó quan trọng hơn vẻ ngoài, và toàn bộ dấu vết: [`gate-results.md` §3](./gate-results.md).

---

## 2. Bằng chứng cục bộ, đã chạy lại trên nền tảng closed-pilot

Mười bước vòng đời ảnh của [`media-worker-deployment.md` §7](./media-worker-deployment.md),
chứng minh bởi 40 assertion trên ba file, gọi edge runtime cục bộ thật với byte
thật:

| # | Bước | Trạng thái |
|---|---|---|
| 1 | publish một rendition | ✅ |
| 2 | unpublish | ✅ |
| 3 | projection mất **ngay** | ✅ |
| 4 | job dọn xuất hiện | ✅ |
| 5 | worker drain | ✅ |
| 6 | object bị xoá (GET ẩn danh → 404) | ✅ |
| 7 | replay | ✅ |
| 8 | republish **trước** khi worker chạy | ✅ |
| 9 | worker không xoá object đang sống | ✅ |
| 10 | hàng đợi về sạch | ✅ |

Bước 8–9 là cặp có giá trị nhất: từng bước riêng lẻ đều đúng ngay cả khi vòng
lặp sai, và red-proof của nó là một dòng — bỏ `DELETE` trong
`product_publish_commit` và test thứ năm 404.

> ⚠️ **Bẫy edge runtime cục bộ:** container `supabase_edge_runtime_*` cache
> isolate. Sửa bất cứ gì trong `supabase/functions/**` thì request kế tiếp **vẫn
> chạy code cũ** — đã từng tạo ra một "xanh" giả và một "đỏ" giả trong cùng một
> giờ. Sau mỗi lần sửa, và sau mỗi `db reset`:
> ```sh
> docker restart supabase_edge_runtime_ajvlcamxemgbxduhiqrl
> ```
> Lượt chạy trong tài liệu này đã restart sau `db reset`.

---

## 3. Bộ smoke cho môi trường đã deploy — CHƯA CHẠY

```sh
node scripts/shop-closed-pilot-smoke.mjs --list
node scripts/shop-closed-pilot-smoke.mjs \
  --target https://feat-shop-closed-pilot.pickle-hub-pro.pages.dev \
  --supabase-url https://<STAGING_PROJECT_REF>.supabase.co \
  --anon-key "<anon key STAGING>"
```

> Mục tiêu là **staging**, không phải production — quyết định Product Owner #1.

### Nó từ chối chạy khi nào

Đã kiểm bằng cách chạy thật:

| Đầu vào | Hành vi |
|---|---|
| không có `--target` | in cách dùng, exit 2 |
| `--target https://evil.example.com` | `REFUSED — không nằm trong allowlist`, exit 2 |
| `--target https://www.thepicklehub.net` | `REFUSED — đó là production`, exit 2 |
| thêm `--allow-production` | cho chạy — hai thao tác gõ có chủ đích |
| `--cleanup` mà không `--yes` | `REFUSED — --cleanup xoá dữ liệu`, exit 2 |

Ngoài ra: không key/token/signed URL nào được in; bằng chứng ghi ra JSON;
**`SKIP` không phải `PASS`** — thiếu kết nối cơ sở dữ liệu làm script exit 1,
không phải exit 0 với một dấu tick.

### 3.1 Cái script chứng minh, và cái nó từ chối giả vờ

**6 kiểm tự động** — thất bại là exit code:

| # | Kiểm | Chứng minh bằng |
|---|---|---|
| 1 | noindex trên **mọi** route Shop, và **không rộng hơn thế** | header `X-Robots-Tag` trên 17 route + **một control không thuộc Shop** + 10 dòng `Disallow` + sitemap không nhắc Shop |
| 2 | discovery ẩn danh dựng ra trang thật | đếm **số từ trong thân bài**, không phải HTTP 200 |
| 3 | người ngoài allowlist bị chặn | `shop_pilot_has_access()` với vai anon → `false` hoặc bị từ chối |
| 16 | route người mua đáp ứng | như #2 |
| 19/22 | tín hiệu giám sát tới được | `shop_media_cleanup_health` **phải** từ chối anon; `public_products` **phải** đọc được |
| 21 | không rò rỉ đường dẫn riêng tư | quét 5 response ẩn danh tìm bucket draft, `token=`, `internal_note`, `service_role`, `pickup_address` |

**18 kiểm thủ công** — cần phiên người bán, phiên quản trị với mã TOTP sống, và
byte ảnh thật. Script **in chúng ra như checklist và từ chối báo PASS tổng thể**
khi còn cái nào chưa ghi nhận.

Đây là chỗ dễ nói dối nhất trong toàn bộ gói, nên nói thẳng: **một bộ smoke báo
xanh cho việc không ai làm thì tệ hơn không có bộ smoke nào, vì nó được tin.**

### 3.2 Hai kiểm cố ý viết ngược trực giác

**Kiểm 1 có một control.** Không có nó, "mọi thứ đều noindex" và "mẫu quá rộng
nên cả site đều noindex" trông giống hệt nhau. Control là `/tournaments`, và nó
**phải không** mang header.

**Kiểm 19 coi HTTP 401/403 là PASS.** `shop_media_cleanup_health` là view chỉ
dành cho quản trị. Nếu nó đọc được bằng anon key, đó là **FAIL** — con số hàng
đợi thật lấy bằng truy vấn vận hành ở [`operations.md` §1](./operations.md).

---

## 4. 24 kiểm — bảng đầy đủ

| # | Kiểm | Chế độ | Ghi chú |
|---|---|---|---|
| 1 | robots / noindex | auto | + control + robots.txt + sitemap |
| 2 | discovery ẩn danh | auto | đếm từ, không đếm status |
| 3 | người bán ngoài allowlist bị chặn | auto | |
| 4 | người bán trong allowlist vào được | manual | |
| 5 | hồ sơ: nháp → gửi | manual | |
| 6 | admin AAL2 — aal1 bị từ chối | manual | **phải thử cả hai chiều** |
| 7 | yêu cầu sửa, có `requested_fields` | manual | |
| 8 | deep link tới đúng trường | manual | |
| 9 | duyệt shop tạo shop + owner trong một transaction | manual | |
| 10 | tạo sản phẩm | manual | |
| 11 | biến thể / SKU / tồn kho | manual | |
| 12 | upload ảnh — byte thật | manual | |
| 13 | gửi duyệt | manual | |
| 14 | kiểm duyệt: duyệt / từ chối / đình chỉ | manual | |
| 15 | publish đặt rendition vào bucket public | manual | |
| 16 | discovery / tìm kiếm / ngành hàng / PDP | auto | |
| 17 | kiểm duyệt kênh liên hệ + CTA | manual | **kiểm URL đi ra không mang PII** |
| 18 | đình chỉ → mở lại → gửi lại | manual | Q5 |
| 19 | hàng đợi dọn ảnh khoẻ, cron nổ | auto (một phần) | số thật cần truy vấn vận hành |
| 20 | slug cũ 301 sang slug mới | manual | Q2 |
| 21 | không rò rỉ dữ liệu riêng tư | auto | |
| 22 | tín hiệu giám sát tới được | auto | |
| 23 | kill switch chạy khô | manual | đóng → xác nhận → mở lại |
| 24 | dọn tài khoản và dữ liệu test | manual | **đếm lại, không tin lệnh xoá** |

---

## 5. Kiểm 24 — dọn dẹp, và vì sao nó phải đếm

Trên **staging** (quyết định Product Owner #1) dữ liệu smoke tạo ra là dữ liệu
thật của staging — dọn được, và xoá cả project là cách dứt điểm. Trên **production
pilot** ở bước 9-12 thì không: ở đó mọi thứ smoke tạo ra là dữ liệu production.
Câu đếm dưới đây đúng cho cả hai, và bắt buộc ở lần thứ hai.

```sql
SELECT 1;
SELECT
  (SELECT count(*) FROM public.shops             WHERE owner_user_id     = ANY($ids)) AS shops,
  (SELECT count(*) FROM public.shop_applications WHERE applicant_user_id = ANY($ids)) AS applications,
  (SELECT count(*) FROM public.shop_pilot_members WHERE user_id          = ANY($ids)) AS pilot_rows,
  (SELECT count(*) FROM public.products p JOIN public.shops s ON s.id = p.shop_id
     WHERE s.owner_user_id = ANY($ids))                                               AS products,
  (SELECT count(*) FROM storage.objects WHERE bucket_id LIKE 'shop%')                 AS shop_objects;
```

> ⚠️ **Teardown đã nói dối bốn lần, và lần thứ tư nó nói dối ở phần BÁO CÁO.**
> Một `?? 0` biến lỗi đếm thành "sạch", và lệnh xoá dùng sai tên cột — kết quả
> là nó in toàn số 0 cho **ba shop nó chưa xoá**. Chỉ một truy vấn chạy trên
> **chính cơ sở dữ liệu vừa QA** mới bắt được điều đó.
>
> ⇒ **Đếm lại bằng câu trên. Không đọc output của script teardown.**

`shop_objects` là con số nguy hiểm nhất: nó đếm byte thật trong Storage, và
**Storage không nằm trong bản sao lưu cơ sở dữ liệu**.

---

## 6. Điều bộ smoke này KHÔNG chứng minh

Nói ra để không ai đọc nhầm một lượt chạy xanh:

- **Không chứng minh có ai dùng.** Một lượt smoke sạch nghĩa là không có gì hỏng
  theo cách ta biết cách hỏi, không phải là sản phẩm dùng được.
- **Không chứng minh cron nổ.** Kiểm 19 nhìn cái worker để lại, không nhìn
  worker chạy. Bằng chứng cron thật là `cron.job_run_details` +
  `net._http_response`.
- **Không thay được nghiệm thu tay của Product Owner.** 18/24 kiểm cần một
  người, một phiên thật và một cái điện thoại.
- **Không thấy lỗi phía máy chủ không tới được trình duyệt.** Một edge function
  trả 500 mà không ai nhìn thì vô hình với mọi thứ ở đây.
- **`soak-watch.mjs` cần baseline lấy TRƯỚC deploy.** Không có baseline thì
  không phát hiện được cái gì là chữ ký lỗi *mới*.
