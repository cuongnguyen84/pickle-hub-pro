# SEO Audit toàn site — thepicklehub.net

**Ngày:** 2026-08-25 · **Điểm sức khỏe SEO: 64/100**
**Loại hình:** nền tảng thể thao song ngữ EN/VI + directory địa phương + news aggregator
**Quy mô index:** 4.015 URL trong 12 sitemap

## Phạm vi & giới hạn (đọc trước)

| | |
|---|---|
| Đã crawl | 135/4.015 URL, lấy mẫu phân tầng theo segment, User-Agent Googlebot |
| Sitemap | Tải và phân tích đủ 12/12 |
| CWV | CrUX field data (origin-level) + PageSpeed Insights lab — API key có sẵn |
| **Không có** | **Search Console + GA4** (chưa có OAuth/service account) → không đo được coverage/index status và query thật |
| **Không có** | **Moz/Bing backlink API** → không có DA/PA, không có danh sách referring domain |

Ba con số dưới đây trong `CLAUDE.md` đã lệch so với production: venue **1.948** (không phải 896), news **1.551** (không phải 709), blog **66** (không phải 68).

---

## Điểm theo hạng mục

| Hạng mục | Điểm | Trọng số | Đóng góp |
|---|---:|---:|---:|
| Technical SEO | 80 | 22% | 17,6 |
| Content Quality | 38 | 23% | 8,7 |
| On-Page SEO | 84 | 20% | 16,8 |
| Schema | 78 | 10% | 7,8 |
| Performance (CWV) | 48 | 10% | 4,8 |
| AI Search (GEO) | 66 | 10% | 6,6 |
| Images | 35 | 5% | 1,8 |
| **Tổng** | | | **64/100** |

---

## 5 vấn đề lớn nhất

### 1. CLS = 0,35 trên mobile (CRITICAL)
CrUX origin-level, p75 mobile: **CLS 0,35** — vượt cả ngưỡng "poor" 0,25. **31,4% lượt truy cập mobile bị xếp poor.** Khán giả ~95% là người Việt dùng mobile, nên đây là chỉ số đúng để nhìn.

Tin tốt: cả CLS và LCP đều đang **cải thiện** theo quý (CLS 0,68 → 0,35; LCP 2.684ms → 2.485ms). Vấn đề nằm ở giá trị tuyệt đối, không phải xu hướng.

LCP 2.485ms — đậu ngưỡng 2.500ms với biên **15ms**. FCP 1.079ms và TTFB 638ms đều tốt.

### 2. 87% index là thin content (CRITICAL)
Word count thân bài mà Googlebot thực sự nhận được:

| Segment | Số URL | Median | Dưới 300 từ |
|---|---:|---:|---|
| venues | 1.948 | 238 | **20/20 mẫu** |
| news | 1.551 | 179 | 10/16 mẫu |
| players | 13 | 66 | 6/6 |
| clubs/events | 20 | 68 | 8/8 |
| organizations | 3 | 48 | 3/3 |
| **blog** | 66 | **1.250** | **0/16** ✅ |

venues + news = **3.499/4.015 URL (87%)**. Blog thì ngược lại — chất lượng thật, median 1.250 từ, thấp nhất 756.

### 3. News = republishing tự động, không link nguồn (CRITICAL)
1.551 URL (39% index) là bài của bên thứ ba được AI viết lại và Gemini dịch. Kiểm chứng trên page live: attribution chỉ là **text trần "Source: Pickleball..."**, **không có một thẻ `<a>` nào trỏ về bài gốc**. Không byline, không editorial review.

Đối chiếu: 30 trang được parse link đầy đủ → toàn site chỉ có **2 external domain** được link (ppatour.com ×1, google.com ×2 là link bản đồ).

Đây là hồ sơ rủi ro trực diện với chính sách scaled content abuse / site reputation abuse của Google.

### 4. HTML mà bot nhận được gần như không có ảnh (HIGH)
Prerender path trả cho bot một document **tĩnh hoàn toàn, không có JS ứng dụng** — `<script src>` duy nhất là `analytics.ahrefs.com`. Cùng URL đó với UA trình duyệt thì trả về bundle Vite (`/assets/index-*.js`).

Hệ quả: **132/135 trang crawl có 0 thẻ `<img>`**. Cả mẫu 135 trang chỉ có **5 thẻ `<img>`**, nằm trên 3 bài blog.

og:image thì có đủ (134/135) nên share mạng xã hội vẫn ổn — nhưng Google Images và điều kiện ảnh cho Discover chỉ còn dựa vào mỗi og:image.

### 5. 6 loại trang không có hreflang (HIGH)
`curl -A Googlebot | grep -c hreflang` = **0** trên: `/tournament/*`, `/tran-dau/*`, `/nguoi-choi/*`, `/live/*`, `/watch/*`, `/org/*`. Sitemap tương ứng cũng 0 thẻ `xhtml:link`.

Giảm nhẹ: `/vi/nguoi-choi/*` và `/vi/live/*` trả 200 nhưng **canonical trỏ về bản không có `/vi/`** → trùng lặp đã được gom bằng canonical. `/vi/tournament/*`, `/vi/watch/*`, `/vi/org/*` trả 301.

---

## Những thứ đang làm tốt

**Technical** — 135/135 URL trả 200, **0 redirect hop**. Canonical có mặt 134/135 và 100% self-referential. SSR body content xác nhận có thật trên mọi loại trang, không có SPA shell rỗng. Không URL nào trong sitemap bị robots chặn. Redirect/CSP parity đã khóa bằng test. HSTS preload + nosniff + X-Frame-Options + Permissions-Policy đủ.

**On-page** — đúng 1 H1 trên 134/135 trang. **0 meta description trùng**, chỉ 2 title trùng và đều là sự kiện lặp thật. Meta venue là dữ liệu thật chứ không phải boilerplate (số sân, khoảng giá, giờ mở, SĐT đặt sân đều khác nhau từng sân) và **khớp locale 20/20** — không có tình trạng trang `/vi/` hiện mô tả tiếng Anh.

**Internal linking** — hub `/san/khu-vuc/ha-noi` link thẳng tới đủ **184/184** venue trong HTML bot, không có lỗ hổng phân trang.

**Schema** — **0 block JSON-LD lỗi** trên toàn mẫu. Venue detail có `SportsActivityLocation` hợp lệ kèm `address`, `geo`, `amenityFeature`, `hasMap`, và khi có dữ liệu thì thêm `telephone`, `openingHoursSpecification`, `priceRange`. City hub emit `ItemList` (hub Hà Nội: `numberOfItems: 184`). Home có Organization + WebSite + SearchAction. Blog/news có `inLanguage` song ngữ đúng.

**GEO** — `/llms.txt` tồn tại, 2.934 bytes, cấu trúc tốt. Tên thương hiệu "ThePickleHub" nhất quán, không có biến thể viết cách. Chính sách AI crawler trong robots.txt chặn crawler training và mở cho crawler citation.

---

## Đính chính so với báo cáo của agent

Ba claim của subagent **sai** khi đối chiếu dữ liệu thật; đã ghi correction vào đầu từng file:

1. `technical.md` viết "100% hreflang triads" — **sai**, 6 loại trang có 0 hreflang (đã verify bằng curl).
2. `schema.md` viết "venue pages: no SportsActivityLocation schema — CRITICAL" — **sai**, venue có schema hợp lệ khá đầy đủ. Thiếu thật sự chỉ là `image` và `aggregateRating`.
3. `performance.md` đọc LCP 2.684ms → 2.485ms là "declining/worsening" — **ngược**, đó là cải thiện 200ms.

---

## Chi tiết theo file

| File | Nội dung |
|---|---|
| `findings/technical.md` | crawlability, robots, canonical, redirect, security headers |
| `findings/content.md` | thin content, E-E-A-T, rủi ro republishing |
| `findings/schema.md` | JSON-LD từng loại trang + snippet vá sẵn |
| `findings/performance.md` | CrUX field + Lighthouse lab từng URL |
| `findings/geo.md` | AI crawler policy, passage citability, llms.txt |
| `findings/sitemap.md` | 12 segment, hreflang coverage, row-cap risk |
| `findings/sxo.md` | SERP backwards analysis cho query tiếng Việt |
| `findings/backlinks.md` | domain age, linkable assets (dữ liệu hạn chế) |

**Dữ liệu thô:** `all-urls.tsv` (4.015 URL), `crawl-sample.json` (135 trang), `links.json` (30 trang parse link), `robots.txt`, `sm-*.xml`, `llms.txt`.
