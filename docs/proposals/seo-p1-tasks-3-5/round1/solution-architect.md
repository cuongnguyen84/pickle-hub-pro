# round1 / solution-architect — SEO P1 Task 4 + 5

**Agent:** `solution-architect` (Claude) · **Chạy:** 2026-07-27 · **Output NGUYÊN VĂN.**

---

## Tóm tắt kiến trúc

Cả hai "blocker" mà recon nêu (link ngoài không bấm được, anchor `#kitchen` không tồn tại) **chỉ đúng cho nửa EN**. Đường VI đọc `content_html` thô từ Supabase, qua `sanitizeBlogHtml` (`functions/_lib/utils.ts:224-282`) chỉ chặn tag/handler/scheme nguy hiểm — `<a href="https://…">` và `<h2 id="…">` đi qua nguyên vẹn, và **prod đã có 2 bài dùng mỗi loại**. Vì vậy phần lớn Task 4 và toàn bộ Task 5 có thể ship **không sửa một dòng code nào**; câu hỏi code duy nhất còn lại là "có làm nửa EN không, và khi nào".

---

# TASK 4 — HCMC Open (6-9/8) + World Cup Đà Nẵng (30/8-6/9)

## Dữ kiện đã tự verify

| Khẳng định | File:line | Kết quả |
|---|---|---|
| EN prose escape, không auto-link | `src/pages/BlogPost.tsx:293` `<p>{section.content}</p>` | ĐÚNG |
| SSR EN cũng text trần | `functions/_lib/render/blog-body.ts:34` `<p>${escapeHtml(s.content)}</p>` | ĐÚNG |
| `internalLinks` vô dụng với URL tuyệt đối | `blog-body.ts:51` `href="${siteUrl}${escapeHtml(l.path)}"` + `BlogPost.tsx:313` `<Link to={link.path}>` | ĐÚNG — SSR ra `https://www.thepicklehub.nethttps://ticketbox.vn/…` |
| **Recon sai 1 chỗ:** "internalLinks trong metadata là đường rẻ nhất" | `src/content/blog/types.ts:38-53` | **SAI.** `BlogPostMetadata` KHÔNG có field `internalLinks`. Nó nằm trong `BlogSection` (`types.ts:6`), tức trong `posts/<slug>.ts`, không phải `metadata.ts`. |
| VI cho phép `<a href>` ngoài | `utils.ts:258-276` allowlist scheme + `ViBlogPost.tsx:122` DOMPurify default | ĐÚNG, **đã dùng trong prod**: `pickleball-la-gi`, `top-san-pickleball-ha-noi-2026` |
| Ticketbox URL còn sống | `curl -sI` → **200** | ĐÚNG |
| SSR EN **không** render khối CTA | `blog.ts:125` `bodyContent = bc + body + relatedBlogLinks` | ĐÚNG — `ctaPath` chỉ tồn tại ở client |
| `ctaPath` chỉ có 1 consumer | `BlogPost.tsx:393` | ĐÚNG |
| Homepage bot chỉ list **VI** posts | `home.ts:122,127` limit 6 theo `published_at` | ĐÚNG — `hcmc-open-2026` đang xếp **#7**, trượt khỏi list |
| `/live` không có surface blog | `src/pages/Live.tsx` (220 dòng), SSR = `renderLivestreamList` | ĐÚNG |

Ghi chú lệch doc: `CLAUDE.md` viết `pr:v30`, thực tế `_middleware.ts:462` là **`pr:v32`**.

## Option A4 — VI-first, zero code *(the cheap one)*

**Effort: 1 half-day · Files:** `posts/hcmc-open-2026-preview.ts`, `metadata.ts` (chỉ `updatedDate`) · **Data:** 4 UPDATE `vi_blog_posts.content_html`. Không migration, không RLS, không RPC.

1. `vi_blog_posts` slug `hcmc-open-2026`: chèn khối vé
   `<p><a href="https://ticketbox.vn/ppa-asia-500-mb-hcmc-open-2026-26355" rel="nofollow sponsored noopener" target="_blank">Mua vé xem HCMC Open 2026 trên Ticketbox →</a></p>`
2. Internal link vào 3 bài VI mạnh: `ppa-tour-asia-2026-lich-thi-dau-tien-thuong`, `lich-giai-pickleball-viet-nam-2026`, `cam-nang-xem-pickleball-world-cup-2026-da-nang`. Bot thấy ngay vì SSR đọc thẳng `content_html` (`blog.ts:222`).
3. EN: thêm `internalLinks` (path nội bộ) trong section của `vietnam-pickleball-tournament-calendar-2026.ts` + `pickleball-world-cup-2026-da-nang-how-to-watch.ts`. Vé EN chỉ là prose **không bấm được**.
4. IndexNow + `?nocache=1` cho từng URL đổi.

**Wins:** ship trong một tối, đúng nơi 95% khán giả ở, không đụng bundle/CI. · **Loses:** độc giả EN không có nút vé. · **Forecloses:** không gì.

## Option B4 — tái dụng `ctaPath` cho URL ngoài

**Effort: A4 + 0.5 half-day · Files:** `BlogPost.tsx` (~10 dòng), 1 test.

`ctaPath.startsWith("http")` → render `<a href … target="_blank" rel="noopener nofollow sponsored">` thay `<Link>`; kèm đổi copy hardcode `BlogPost.tsx:387-391`. Types không đổi, SSR không đổi, bundle +~0.2 KB gz.

**Wins:** diff nhỏ nhất có nút bấm EN. · **Loses:** mỗi bài chỉ 1 link ngoài, nằm **sau tag row, cuối bài**; bot không thấy. · **Forecloses:** biến `ctaPath` thành union nội/ngoại — sau này phải gỡ ra, làm 2 lần.

## Option C4 — thêm `externalLinks?: { text; url }[]` vào `BlogSection`

**Effort: A4 + 1 half-day (tổng 2) · Files:** `types.ts` (+1 dòng), `BlogPost.tsx` (~8 dòng cạnh block `internalLinks` :308-318), `blog-body.ts` (~5 dòng cạnh :48-54), 1 test. Bundle +~0.3 KB gz.

**Wins:** link đúng chỗ trong bài, **bot thấy được**, dùng lại cho World Cup + mọi bài giải sau. Nhu cầu **không speculative**: `hcmc-open-2026-preview.ts:56` đã có "Amateur registration: open now via pickleballbrackets.com" dạng text trần — đã hỏng sẵn một lần. · **Loses:** chạm SSR → `?nocache=1` cho URL dùng nó (không cần bump `pr:v32`). · **Forecloses:** gần như không — field optional.

## Khuyến nghị Task 4

**Làm A4 ngay tuần này. Làm C4 trước 20/8, không phải trước 6/8.**

B4 thua: nút vé bị đẩy xuống cuối bài trong hộp có copy sai nghĩa, và biến `ctaPath` thành union — 10 dòng hôm nay đổi lấy một lần gỡ về sau.

"C4 ngay bây giờ" thua: HCMC còn 10 ngày, truy vấn là `"ppa ho chi minh 2026"` — tiếng Việt; A4 phủ đúng nửa quan trọng. **World Cup Đà Nẵng mới là bài xứng đáng để xây field**: đang pos 2 cho `"pickleball world cup 2026 schedule"` — truy vấn **tiếng Anh**, trang EN thật sự có người đọc, còn 5 tuần.

**`/live`: không làm.** Thêm vào = 2 chuỗi song ngữ mới + một chỗ chắc chắn quên gỡ sau 9/8, đổi lấy internal link mà bot không thấy. Đường rẻ hơn: để bài VI HCMC lọt lại top-6 homepage bot (`home.ts:122`) — hiện #7. Đây là **quyết định biên tập của Cuong**, em không tự đổi ngày.

---

# TASK 5 — Glossary

## Blocker anchor: KHÔNG tồn tại ở nửa VI

```
curl -A Googlebot https://www.thepicklehub.net/vi/blog/hop-dong-ppa-tour-2026
→ <h2 id="ppa-tra-bao-nhieu">PPA trả bao nhiêu tiền cho VĐV?
  <h2 id="tai-cau-truc-2026">…  <h3 id="quang-duong">Quang Dương — …
```

2/53 bài VI published đã có heading `id=` và nó sống qua cả sanitizer SSR lẫn prod. Anchor VI = **0 dòng code**.

EN thì đúng là thiếu: `BlogPost.tsx:262`, `blog-body.ts:33` đều emit `<h2>` trần. Fix nhỏ nhất: `slugify(s.heading)` — util **đã có sẵn** `src/lib/social/slug.ts:25`, strip NFD + `đ→d`. `blog-body.ts` đã import từ `src/` rồi.

Hệ quả nếu thêm id cho EN: HTML SSR của **mọi** bài EN đổi → bump `pr:v32 → v33`.

## Phát hiện làm rẻ bản EN đi đáng kể

`post.content.vi.sections` **không được render ở đâu cả** — `BlogPost.tsx:110` chỉ đọc `content.en`, `blog-body.ts:76` cũng vậy; consumer duy nhất là `seo-byte-budget.test.ts:65-67`. Nghĩa là bản EN **không** buộc phải dịch lại toàn bộ tiếng Việt vào file `.ts` — chỉ cần 4 chuỗi meta VI khớp `metadata.ts`.

## Cannibalization "kitchen" — có thật, đo được

`vi_blog_posts.luat-pickleball-co-ban` (12.990 ký tự) đã có H2 **"4. Vùng 'Kitchen' — Luật quan trọng nhất trong pickleball"** với "3 quy tắc vàng", "Tại sao có kitchen?", "Lỗi kitchen phổ biến".

**Phân vai đề xuất:**

| | Glossary | Rules guide |
|---|---|---|
| Intent | định nghĩa, "X là gì" | luật, "được/không được làm gì" |
| Độ dài mỗi thuật ngữ | 60–100 chữ + 1 ví dụ | nguyên section |
| Kitchen | 1 đoạn: vùng 2,13 m, cấm volley — **rồi dừng** | giữ nguyên 3 quy tắc + lỗi phổ biến |
| Link | → `/vi/blog/luat-pickleball-co-ban#kitchen` | → glossary **một lần duy nhất**, phần mở đầu |

Việc kèm theo: thêm `id="kitchen"` vào H2 #4 của `luat-pickleball-co-ban` — một UPDATE, zero code.

**9 thuật ngữ trong brief là quá mỏng cho "A–Z".** Đề xuất **24 mục**, chia 4 nhóm: *Sân & luật* (kitchen/NVZ, double bounce, side-out, fault, let, rally scoring, drop serve) · *Cú đánh* (dink, third shot drop, drive, lob, volley, reset, speed-up, counter, erne, ATP) · *Chiến thuật* (stacking, poach, shake-and-bake, transition zone) · *Thi đấu* (DUPR, round robin, double elimination).

## Option A5 — Glossary VI-first, 24 mục, zero code

**Effort: 2.5 half-days · Files: KHÔNG có · Data:** 1 INSERT `vi_blog_posts` (`alternate_en_slug = NULL`) + 1 UPDATE `luat-pickleball-co-ban`.

Không có `alternate_en_slug` → hreflang tự self-reference vi + x-default, **đường này đã có chủ đích** (`blog.ts:171-177`). Vào `/sitemap-blog.xml` tự động.

**Wins:** rẻ nhất, nhắm đúng truy vấn có số đo. · **Loses:** vi phạm luật "VI+EN từ ngày đầu", trái quyết định Cuong đã chốt. · **Forecloses:** không gì.

## Option B5 — EN + VI song song (đúng quyết định của Cuong)

**Effort: 4.5 half-days · Files:** `posts/pickleball-glossary.ts` (mới), `metadata.ts`, `posts/all.ts` (chạy `node scripts/gen-blog-barrel.mjs`), `BlogPost.tsx:262` (+id), `blog-body.ts:33` (+id), `_middleware.ts:462` (`v32`→`v33`), `pickleball-rules-complete-guide.ts` · **Data:** 1 INSERT VI + 1 UPDATE rules VI.

**Wins:** hreflang đủ cặp, anchor dùng được cả 2 ngôn ngữ, sửa luôn cho toàn bộ blog EN. · **Loses:** gấp đôi effort, bump cache key = re-render toàn site cho bot trong tuần có HCMC.

## Option C5 — nhét glossary vào rules guide

**Effort: 1 half-day.** **Wins:** cannibalization = 0. · **Loses:** mất khớp title cho head term; bài rules VI đã 13 KB, nhồi thêm thành ~20 KB làm loãng intent luật.

## Khuyến nghị Task 5

**B5, nhưng tách làm 2 lần ship: VI trước (A5), EN + fix anchor sau, cách nhau ~1 tuần.**

Lý do tách đôi: fix anchor EN đổi HTML SSR của **toàn bộ** blog và bump cache key — không nên nằm cùng tuần với HCMC Open, khi cần `curl -A Googlebot` cho bài sự kiện phải sạch và quy được về một nguyên nhân.

---

## Thứ tự thực thi (có tính deadline 6/8)

| # | Việc | Xong trước | Rủi ro |
|---|---|---|---|
| 1 | **A4** — vé VI + 3 internal link VI + internalLinks EN | **29/07** | zero code |
| 2 | **A5** — glossary VI 24 mục + `id="kitchen"` cho rules VI | 05/08 | zero code |
| 3 | *(mốc dừng nhìn lại — HCMC 6-9/8)* | | |
| 4 | **B5 phần EN** — anchor id + post EN + `pr:v33` | 18/08 | SSR-wide, đi riêng 1 PR |
| 5 | **C4** — `externalLinks` + áp lên bài World Cup EN | 25/08 | trước 30/8 |

**Không có bước nào là RED** (không đụng auth / payments / `supabase/config.toml`). `scripts/agents/risk-tier.mjs` **không tồn tại** — phân loại thủ công.

## Điều em không chắc

- **`?nocache=1` với UPDATE Supabase:** chưa test UPDATE `content_html` một mình có làm KV stale không.
- **DOMPurify giữ `id` ở client:** chỉ verify được đường SSR bằng curl. **Chưa mở browser xác nhận** anchor `#kitchen` thật sự cuộn tới nơi.
- **`"ppa ho chi minh 2026" pos 7,4` là URL EN hay VI:** không tra được. Nếu là EN thì thứ tự A4→C4 của em **sai** và C4 phải kéo lên trước 6/8.
- **Ticketbox URL:** 200 hôm nay, không biết có bị thay khi mở bán đợt 2. Link ngoài trong `content_html` không ai canh.
- **24 mục là con số phán đoán,** không có dữ liệu.
- **Re-date `published_at` bài VI HCMC** để lọt top-6: cố ý không đề xuất, đó là quyết định biên tập.
