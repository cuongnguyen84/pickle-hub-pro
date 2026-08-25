# Action Plan — thepicklehub.net

Sắp theo tác động thực tế, không theo thứ tự hạng mục. Mỗi việc kèm bằng chứng đo được và cách xác minh sau khi sửa.

---

## CRITICAL — làm tuần này

### ~~C1. Sửa CLS~~ — ✅ ĐÃ XONG (#676, merge 2026-08-25, `8c4c18f7`)

**Nguyên nhân thật khác hẳn dự đoán ban đầu ở dưới.** Không phải ảnh thiếu `width`/`height` —
mà `LiveSectionSkeleton` reserve 319px cho section resolve ra 598px, đẩy toàn bộ trang bên dưới
xuống 280px. Cộng thêm `inter-vietnamese.woff2` (`font-display:swap`) không được preload.

**Đo trên production sau deploy:**

| | trước | sau |
|---|---:|---:|
| Lighthouse lab CLS `/vi` | 0,419 | **0,024** |
| Lighthouse lab CLS `/` | 0,015 | 0,031 |
| Chrome trace CLS `/vi` | 0,2238 | 0,0387 |
| skeleton vs resolved | −279px | −23px |
| perf score `/vi` | 0,49 | 0,70 |

**Còn dư:** EN home tăng 0,015 → 0,031 (vẫn trong ngưỡng good ≤0,1) do 23px chênh còn lại của
skeleton. Đóng nốt bằng cách chỉnh placeholder `.tl-live-main-name` (body 106px vs resolved 130px).
**Chờ:** CrUX field p75 cần ~28 ngày mới phản ánh — theo dõi mốc dưới 0,25 rồi dưới 0,1.

<details><summary>Chẩn đoán ban đầu (sai, giữ lại để đối chiếu)</summary>

**Bằng chứng:** CrUX origin p75 mobile CLS = 0,35; 31,4% lượt mobile poor. Ngưỡng poor là 0,25.
**Việc:**
- `aspect-ratio` cho card ở feed và mọi danh sách (feed, news, venue list, blog index).
- `width`/`height` tường minh cho mọi ảnh, bắt đầu từ hero.
- Reserve chiều cao cho khối load muộn (news thumbnail, feed item, livestream card).
**Xác minh:** CrUX p75 mobile CLS sau 28 ngày; kèm `web-vitals` RUM để thấy sớm hơn.
</details>

### ~~C2. News — link về nguồn gốc + byline~~ — ❌ ĐÓNG (quyết định của owner, 2026-08-25)

**Không thực hiện.** Đụng chính sách cố ý 3 lớp và owner chọn giữ nguyên:

1. Trigger DB `reject_public_news_source_url` (migration `20260731110000`) raise `23514`
   nếu `news_items.source_url` được set — *"source URLs belong only in the protected news_origins"*.
2. `news_origins`: `REVOKE ALL FROM anon, authenticated` + RLS đòi `is_admin()`.
3. Hai test trong `src/lib/__tests__/news-editorial-surfaces.test.ts` khoá
   *"does not select or render the private source URL"* và
   *"keeps source attribution as text rather than an outbound CTA"*.

Bản triển khai thử còn có bug thật: SSR dùng `service_role` nên join chạy được, nhưng SPA
dùng anon key → RLS từ chối → hỏng trang tin cho người dùng. Đã revert trước khi commit.

**Ghi lại để không phải điều tra lại:** tiền đề của chính sách là "independently rewritten
ThePickleHub articles". Điều đó đúng với 362 dòng `content_kind='full'` (364–751 từ body),
không đúng với 1.189 dòng `brief` (median 0 từ). Nếu sau này muốn mở lại, đó là điểm bắt đầu.

<details><summary>Nội dung đề xuất ban đầu (giữ để tham chiếu)</summary>

#### C2 (bản gốc)
**Bằng chứng:** 1.551 URL (39% index) là bài bên thứ ba viết lại bằng AI. Attribution chỉ là text `Source: Pickleball...`, **0 thẻ `<a>` ra ngoài**. Toàn site 30 trang parse link chỉ có 2 external domain.
**Việc:** mỗi bài news phải có `<a href>` tới bài gốc + tên tác giả/publisher gốc hiển thị rõ.
**Xác minh:** `curl -A Googlebot <news-url> | grep -o 'href="https[^"]*"' | grep -v thepicklehub` phải ra domain nguồn.
</details>

### C3. Quyết định chính sách cho khối news — 🔄 PR #677 (chờ review)

**Đã chọn: cổng theo ngôn ngữ** — noindex EN news (746 URL), giữ VI news (805 URL).

Phương án "(c) noindex theo substance" ban đầu **bị dữ liệu bác bỏ**: 3 trang news đang có
clicks đều là `content_kind='brief'` với 0 từ body, nên cổng substance sẽ noindex đúng những
trang đang ra tiền và giữ 362 trang không ra gì.

GSC 2026-05-23..08-22: cả khối `/news/` chỉ 48 clicks / 447 impressions từ 12 trang trên 1.551,
và mọi trang quy được đều là `/vi/`. Gỡ EN không mất traffic đo được.

<details><summary>Khung quyết định ban đầu (giữ để tham chiếu)</summary>
**Bằng chứng:** 100% tự động fetch → AI rewrite → Gemini dịch → publish cả EN lẫn VI, không có bước biên tập, không có phân tích riêng, median 179 từ.
**Hai lựa chọn — phải chọn một:**
- **(a)** Thêm lớp giá trị thật: biên tập viên duyệt, thêm góc nhìn/bối cảnh cho người chơi Việt Nam, giữ index.
- **(b)** `noindex` toàn bộ khối syndicated, giữ nó như feed nội bộ để giữ chân người dùng.
**Tại sao gấp:** đây là 39% index đang mang hồ sơ scaled-content-abuse. Giữ nguyên là đánh cược cả domain, không chỉ khối news.
</details>

---

## HIGH — 2–3 tuần

### ~~H1. Render ảnh in-body trong output prerender~~ — 🔄 PR #679 (blog xong, venue bất khả thi)

**Đã làm (blog):** hero EN từ `metadata.ts heroImage` (58/58 bài), cover VI từ
`vi_blog_posts.cover_image_url` (57/66 bài), kèm `width`/`height` đọc từ header WebP thật
(`scripts/gen-blog-image-dims.mjs` → `src/content/blog/image-dims.ts`).

**Không làm được (venue):** `select count(*) from venues where cover_image_url is not null` = **0/896**.
Không có ảnh sân nào trong DB. Đây là việc thu thập nội dung, không phải việc code.

**Không làm (news):** EN news đã noindex ở #677; VI news dùng ảnh của publisher gốc — đưa vào HTML
của mình là chuyện bản quyền, không phải chuyện SEO.

**Bonus:** cùng map kích thước đó sửa một bug CLS thật trên human path — cả hai hero component
hardcode `1200x630` trong khi ảnh thật chạy `1024x1536`..`1731x909`.

<details><summary>Chẩn đoán gốc</summary>
**Bằng chứng:** bot HTML không có JS ứng dụng (`<script src>` duy nhất là ahrefs analytics); UA trình duyệt thì có `/assets/index-*.js`. Kết quả: **132/135 trang crawl có 0 `<img>`**; cả mẫu chỉ 5 thẻ `<img>`.
**Việc:** ít nhất là hero ảnh cho blog + news, và ảnh sân cho `/san/*`, phải nằm trong HTML SSR với `width`/`height`.
**Lợi kép:** vừa mở lại Google Images/Discover, vừa hỗ trợ C1 (ảnh có kích thước tường minh giảm CLS).
**Xác minh:** `curl -A Googlebot <url> | grep -c '<img'` > 0 trên cả 3 loại trang.
</details>

### ~~H2. Đưa hệ thống review sân vào HTML + schema~~ — ⚠️ CODE ĐÃ XONG, THIẾU DỮ LIỆU

**Finding sai ở chỗ quy kết.** `functions/_lib/render/venues.ts` đã render sẵn:
`aggregateRating` (dòng 765-775) + section "Đánh giá từ cộng đồng" (dòng 856-870), 5 review mới nhất,
có fallback an toàn nếu chưa chạy migration. Ship từ #631/#634.

Lý do bot không thấy gì: **`venue_reviews` có đúng 1 dòng / 896 sân**. Cả hai block đều gate sau
`review_count > 0`. Không có gì để sửa trong code — đây là bài toán tăng trưởng: đưa được review
thật vào là schema tự bật.

<details><summary>Chẩn đoán gốc</summary>
**Bằng chứng:** venue page không có `aggregateRating`, không có markup review, không có text đánh giá trong bot HTML. Đây là tài sản first-hand khác biệt nhất của site mà search không nhìn thấy.
**Việc:** SSR phần review; thêm `aggregateRating` + `review` + `image` vào block `SportsActivityLocation` đã có sẵn.
**Xác minh:** Rich Results Test trên 3 URL venue.
</details>

### ~~H3. Bổ sung hreflang cho 6 loại trang~~ — ❌ FINDING SAI, ĐÓNG

**Làm theo là tái tạo đúng bug đã sửa hai lần.** `singleCanonicalHreflang()`
(`functions/_lib/utils.ts:172-197`) cố tình trả `""`, có ghi rõ lịch sử:

- Batch 6 (2026-05-28): emit `vi` + `x-default` trỏ về chính nó → hết cờ SEOnaut.
- Batch 9 (2026-05-28): Ahrefs lại bắt *"Missing reciprocal hreflang (no return-tag)"* +
  *"Page referenced for more than one language"* — hreflang tự trỏ về mình là khai báo một bản
  dịch không tồn tại. Doc của Google nói thẳng: chỉ có một URL cho mọi locale thì **bỏ hreflang**.

Sáu loại trang này single-canonical (một URL phục vụ cả hai ngôn ngữ, SPA toggle client-side).
`/vi/org/*`, `/vi/tournament/*`, `/vi/watch/*` còn 301 về EN (`_middleware.ts` rule 1d).
`profile.ts:136` cũng ghi "hreflang intentionally OMITTED".

Đã sửa dòng sai trong `CLAUDE.md` ở #679.

**Việc thật còn lại (nhỏ, chưa làm):** `/vi/tran-dau/*`, `/vi/nguoi-choi/*`, `/vi/live/<id>` vẫn
trả **200 kèm canonical EN** thay vì 301 như ba loại kia — và `live-video.ts:334` còn link tới
`/vi/live/<id>` từ trang danh sách VI. Nên gộp vào rule 1d cho nhất quán.

<details><summary>Chẩn đoán gốc</summary>
**Bằng chứng:** 0 hreflang trên `/tournament/*`, `/tran-dau/*`, `/nguoi-choi/*`, `/live/*`, `/watch/*`, `/org/*`; sitemap tương ứng 0 `xhtml:link`.
**Việc:** thêm bộ ba en/vi/x-default vào 6 renderer trong `functions/_lib/render/` và 6 handler `functions/sitemap-*.ts`.
**Lưu ý:** sửa luôn dòng sai trong `CLAUDE.md` ("All segments support xhtml:link hreflang").
**Xác minh:** `grep -c hreflang` trên 1 URL mỗi loại; và `grep -c xhtml:link` trên 6 sitemap.
</details>

### H4. LCP — lấy lại biên an toàn
**Bằng chứng:** p75 mobile 2.485ms, ngưỡng 2.500ms, biên 15ms. Nguyên nhân đo được: CSS render-blocking ~1.811ms, hero ~548 kB chưa tối ưu, script chạy trước khi request tài nguyên LCP.
**Việc:** preload hero dạng WebP/AVIF có `srcset`; defer CSS không critical; hoãn realtime subscription tới sau LCP.

### H5. Đổi opening của news để passage trích được về brand
**Bằng chứng:** 0% bài news mẫu nêu "ThePickleHub" trong đoạn mở; tất cả mở bằng `Source: <publisher>`. AI trích passage đó sẽ quy công cho publisher gốc.
**Việc:** template mở bài front-load câu trả lời + nhắc "ThePickleHub" một lần tự nhiên; đẩy dòng nguồn xuống dưới dạng link.

---

## MEDIUM — tháng 2

- **M1.** Nâng venue page lên 400–600 từ nội dung riêng: nhận xét thực tế, mặt sân, chỗ đỗ xe, khung giờ đông, ảnh. Hiện median 238 từ trên 1.948 URL.
- **M2.** E-E-A-T: bio người sáng lập có credential, author page, byline cho blog, editorial policy. `/about` hiện 122 từ và không nêu tên ai. Nối `Person`/`sameAs` schema vào.
- **M3.** `VideoObject` cho `/watch/*` và `BroadcastEvent` (`isLiveBroadcast`) cho `/live/*` — 37 URL đang không đủ điều kiện video rich result.
- **M4.** Viết 3 guide dạng answer-shaped còn thiếu: giải thích luật hợp nhất, chiến thuật đôi, cẩm nang chọn vợt/giày cho người Việt.
- **M5.** Link ra ngoài ở chỗ tự nhiên: trang giải chính thức, liên đoàn, website/fanpage của sân.
- **M6.** Code-split ~115 kB JS không dùng (Supabase client + UI component đang load mọi route).

---

## LOW / dọn dẹp

- Bỏ `sitemap-shop.xml` khỏi sitemap index cho tới khi shop public (hiện 0 URL nhưng vẫn được liệt kê).
- Thêm `lastmod` cho 59 URL trong `sitemap-static.xml` đang thiếu (58 blog EN + `/rss.xml`).
- Bỏ `/rss.xml` khỏi sitemap — nó là feed, không có title/canonical/H1.
- `/about`: title 18 ký tự, description 49 ký tự — nới ra, dù sao cũng là landing page của E-E-A-T.
- robots.txt dùng neo `$` (chỉ Google/Bing hiểu) — giữ nguyên nhưng phủ thêm `X-Robots-Tag` cho route shop.

---

## Giám sát

- Alert khi p75 CLS > 0,25 hoặc LCP > 2.600ms liên tục 3 ngày.
- Theo dõi `sitemap-venues.xml` khi vượt 2.000 dòng (hiện 1.948, tăng ~100/tháng) để lên kế hoạch tách.
- **Cấu hình service account cho Search Console.** Audit này chạy mù về coverage/index status và query thật — đây là khoảng trống lớn nhất về dữ liệu.
- Cân nhắc thêm Moz API free tier (2.500 dòng/tháng) để có DA/PA và danh sách referring domain.
