# `/api/indexnow` trả về Cloudflare 502 thay vì chạy

**Ngày phát hiện:** 2026-08-25, khi ping Bing sau đợt refresh nội dung CTR-03.
**Trạng thái:** đã vá 2026-08-28 (autofix site-audit).
**Ảnh hưởng:** không chặn — IndexNow chỉ là ping tiện lợi cho Bing/Yandex; Google
đi qua GSC URL Inspection nên không bị ảnh hưởng.

## Triệu chứng

```
POST https://www.thepicklehub.net/api/indexnow?key=<INDEXNOW_SECRET>
     {"urls":["https://www.thepicklehub.net/blog/hcmc-open-2026-preview"]}

HTTP/2 502
content-type: text/html; charset=UTF-8
retry-after: 60
server: cloudflare
<trang lỗi "Bad gateway" của Cloudflare, Host = Error>
```

Body là trang lỗi của chính Cloudflare, **không phải JSON**. Nghĩa là Function
không hề trả về response — nó throw, timeout, hoặc không khởi động được.
Endpoint có sẵn một nhánh 502 của riêng nó
(`result.status === 200 || 202 ? 200 : 502`) nhưng nhánh đó trả JSON, nên đây là
một failure khác.

## Đã loại trừ

- **Auth.** Secret sai/thiếu trả `{"error":"Unauthorized"}` status 401. Ta không
  nhận cái nào trong hai, nên `timingSafeEqual` đã pass và luồng chạy được ít
  nhất tới bước rate-limit.
- **Deploy SEO 2026-08-25 (`pr:v63`).** `functions/api/indexnow.ts` import
  `EN_BLOG_SLUGS` từ `_lib/static-blog-slugs`, sinh ra từ
  `src/content/blog/metadata.ts` — file mà deploy đó có sửa. Nếu module này lỗi
  evaluate thì Function sẽ 502 đúng như vậy. Loại trừ bằng cách quét toàn bộ
  sitemap segment: cả 12 đều 200, và `sitemap-static.xml` import cùng
  `EN_BLOG_SLUGS`. Import dùng chung load bình thường.
- **Sự cố toàn site.** `/`, `/vi`, `/blog`, `/sitemap.xml` và cả 12 sitemap
  segment đều 200 tại cùng thời điểm.

## Nguyên nhân

Hai outbound call nằm trên request path, cả hai đều không có try/catch:

1. **`submitToIndexNow()`** — `fetch()` tới `https://api.indexnow.org/indexnow`
   không try/catch, không timeout, và được `await` thẳng trên request path. Một
   connection bị refuse, TLS lỗi, hay upstream treo sẽ propagate ra khỏi handler
   — và từ góc nhìn của edge, đó là 502. Mọi outbound call khác trong file
   (`getViBlogSlugs`) đều bọc try/catch và degrade về `[]`; riêng cái này thì
   không.

2. **`isRateLimited()`** — đọc/ghi KV `indexnow:rl:<ip>` cũng không try/catch.
   Đây là nhánh cụ thể và tái hiện được: **Workers KV giới hạn ~1 write/giây
   trên cùng một key**, mà mọi request từ cùng một IP đều ghi đúng key đó. Hai
   lần gọi liên tiếp từ một IP → `put()` throw → không ai bắt → edge trả 502.
   Nhánh này cũng giải thích header `retry-after: 60` khó hiểu ở trên: giá trị
   đó xuất hiện đúng một lần trong source, ở nhánh rate-limit.

## Cách sửa

- `submitToIndexNow()` bọc try/catch + `AbortSignal.timeout(10_000)`, và theo
  hợp đồng mới thì **không bao giờ throw**: lỗi mạng trả về
  `{ status: 0, body: "", error }`.
- Handler luôn trả JSON, kể cả khi 502. Caller phân biệt được hai chế độ lỗi:
  `indexnow_status > 0` = IndexNow có trả lời và từ chối; `indexnow_status: 0`
  kèm `indexnow_error` = ping không tới nơi.
- `isRateLimited()` fail **open** khi KV lỗi. Rate limit chỉ là lớp phòng thủ
  bổ sung phía sau secret, nên hỏng-thì-cho-qua tốt hơn hỏng-thì-chết-request.
- `public/openapi.json`: `IndexNowResult` thêm `indexnow_error` (optional), và
  response `502` được ghi vào spec cho cả GET lẫn POST.

Test: `functions/__tests__/indexnow-upstream-guard.test.ts` — 3/5 test fail trên
code cũ, pass trên code mới.

## Bài học

Trên Cloudflare Pages Functions, mọi `await` ra ngoài (fetch, KV, D1) nằm trên
request path đều là một nhánh 502 tiềm ẩn nếu không bọc try/catch. Khi edge tự
sinh response, ta mất luôn body chẩn đoán — đó là lý do sự cố này tốn một vòng
điều tra chỉ để biết "nó throw ở đâu đó".
