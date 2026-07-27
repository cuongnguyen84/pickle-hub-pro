# round1 / pre-mortem — SEO P1 Task 4 + 5

**Agent:** `pre-mortem` (Claude, đọc repo) · **Chạy:** 2026-07-27 · **Output NGUYÊN VĂN.**

---

Đọc trước khi viết: `.claude/memory/lessons-learned.md`, `docs/ops-runbook.md` §4–5, work order §4, `idea-recon.md`. Ba cơ chế dưới đây **đều được xác minh bằng file thật hoặc curl thật trên prod** — chỗ nào tôi không chứng minh được, tôi bỏ.

Một dữ kiện nền, đo lúc 01:54 ngày 27/07 trên prod, cần cho cả ba chuyện:

```
/vi/blog/hcmc-open-2026-preview                    Googlebot → 404
/vi/blog/singapore-open-2026-preview               Googlebot → 404
/vi/blog/pickleball-world-cup-2026-da-nang-how-to-watch  → 404
/vi/blog/vietnam-pickleball-players-to-watch-2026  → 404
/vi/blog/vietnam-hosts-ppa-tour-asia-2026          → 404
/vi/blog/pickleball-cost-vietnam-2026              → 404
```

Cả 6 bài trong `stories` top-6 của trang chủ. Đây không phải giả thuyết.

---

### Sự cố 1 — Hai thẻ bài nổi bật nhất trang chủ tiếng Việt trỏ vào "Không tìm thấy bài viết" suốt 9 ngày trước HCMC Open

**Xác suất:** cao (cơ chế đã sống sẵn, publish chỉ đổi *nạn nhân*) · **Thời gian tới lúc phát hiện:** không bao giờ, trừ khi có người test tay `/vi` trên điện thoại

**Timeline**
- T+0 (27/07, 23:10): merge PR Task 4 + Task 5. `metadata.ts` có thêm 2 entry `publishedDate: "2026-07-27"` (companion vé HCMC + glossary EN).
- T+3ph: Cloudflare Pages deploy xong. `curl -A Googlebot` cả 4 URL mới → 200, hreflang đủ en/vi/x-default. DoD §6 xanh hết. Cuong đóng máy.
- T+4ph: `src/pages/Index.tsx:125-137` sort lại `blogMetadata` theo `publishedDate` → hai bài mới chiếm slot #1 và #2. `Index.tsx:477` chỉ render `stories.slice(0, 2)`.
- T+4ph: với `language === "vi"` (95% người dùng), `Index.tsx:136` sinh `href = "/vi/blog/" + p.slug` — **slug EN**. Hai thẻ đẹp nhất trang chủ giờ trỏ tới `/vi/blog/pickleball-glossary` và `/vi/blog/hcmc-open-2026-mua-ve`. Bài VI thật nằm ở `/vi/blog/thuat-ngu-pickleball` và `/vi/blog/hcmc-open-2026-ve`.
- Cùng lúc: `hcmc-open-2026-preview` (`metadata.ts:99`, ngày 10/07) tụt từ vị trí #6 xuống #8 → **rơi khỏi `slice(0,6)`**, biến mất hoàn toàn khỏi trang chủ. Đúng 10 ngày trước giải mà Task 4 muốn đẩy.
- T+9 ngày (06/08, khai mạc): traffic "pickleball tphcm" đổ về `/vi`. Người dùng bấm thẻ đầu tiên → màn hình trắng rồi chữ **"Không tìm thấy bài viết. Bài viết này không tồn tại hoặc đã bị xóa."**

**Cơ chế**

`src/pages/Index.tsx:136` → href VI dựng từ slug EN → `src/App.tsx:533` (`/blog/:slug` + `viElement: <ViBlogPost />`) route `/vi/blog/*` sang `src/pages/ViBlogPost.tsx` → `ViBlogPost.tsx:16` gọi `useViBlogPostBySlug` → `src/hooks/useViBlogPosts.ts:90-92` query `?slug=eq.<slug-EN>&status=eq.published` với header `pgrst.object+json`, **không có fallback nào sang `alternate_en_slug`** → 406/empty → `ViBlogPost.tsx:32` nhánh `if (error || !post)` → soft-404.

Nửa còn lại, phía bot: `functions/_lib/render/blog.ts:145-155` `renderViBlogPost` cũng `.eq("slug", slug).single()` → không có row → 404 cứng. Đó là 6 con 404 tôi curl ở trên.

Vì sao cơ chế này tồn tại: `functions/_middleware.ts:274-296` có `VI_BLOG_REDIRECTS` — một allowlist **chép tay 15 dòng** vá đúng lớp lỗi này, và trong đó có dòng tự tố cáo `"ppa-tour-asia-2026-complete-guide": "ppa-tour-asia-2026-complete-guide"` (VI-path của một slug EN → về EN). Ai đó đã thấy triệu chứng, vá từng URL một, không sửa nguồn. Bài mới không có tên trong danh sách và không có gate nào bắt phải thêm.

**Vì sao mọi gate vẫn xanh**

Đây là câu trả lời quan trọng nhất, và nó áp cho cả ba sự cố: **toàn bộ tiêu chí nghiệm thu của work order là `curl -A "Googlebot"`** (§3.2, §4 Acceptance mỗi task, §6 DoD). Bot và người là hai renderer khác nhau.

- Bot vào `/` và `/vi`: `functions/_lib/render/home.ts:122,127` đọc `vi_blog_posts.slug` từ Supabase — **slug VI đúng**. Bản HTML mà mọi lệnh verify nhìn thấy là bản lành.
- Người vào `/vi`: SPA `Index.tsx:136` — slug EN, hỏng. Không lệnh curl nào chạm tới nhánh này.
- `src/lib/__tests__/blog-seo-surfaces.test.ts` khoá parity giữa `BLOG_POST_META`, `EN_BLOG_SLUGS`, `metadata.ts` — nhưng cả ba đều **generated từ cùng một mảng** (`blog-meta.ts:26`, `static-blog-slugs.ts:9`), nên nó chứng minh 1 = 1 = 1. Không có test nào so `metadata.ts` với `vi_blog_posts`.
- `tests/seo.spec.ts:380-410` là test hreflang duy nhất, và nó **hardcode một bài** (`what-is-dupr-pickleball-rating-system`).
- `tests/visual.spec.ts` chụp `/vi` nhưng so pixel — link đích không nằm trong ảnh; và `visual.yml` là `continue-on-error` (ops-runbook §7.2).
- Soak 30 phút đọc `client_errors`. `ViBlogPost.tsx:32` **không ghi gì** — nó là một nhánh render bình thường, không throw, không log. Soak sạch 100%.

**Ai báo, sau bao lâu**

Không ai. Người dùng Việt gặp trang trắng chữ "Không tìm thấy bài viết" thì thoát, không chửi (không có gì để chửi vào — không phải lỗi sập, chỉ là "chắc bài bị xoá"). GA4 thì đã bị nhiễu bot US (CLAUDE.md), một pageview `/vi/blog/*` bounce 100% không nổi lên. Kịch bản thật nhất: **Cuong tự thấy 3-4 tuần sau**, lúc mở `/vi` trên điện thoại để chụp màn hình khoe giải, hoặc GSC báo "Không tìm thấy (404)" cho một URL không hề nằm trong sitemap nào — nghĩa là Google phải tự render JS mới phát hiện, chậm hàng tuần.

**Vì sao khó sửa**

Revert được — nhưng revert cũng không sửa, vì lỗi có sẵn trước khi ship; revert chỉ trả nạn nhân về 6 bài cũ. Sửa thật thì phải chọn: (a) đổi `Index.tsx:136` cho VI trỏ `/blog/${p.slug}` (người Việt đọc bài EN), (b) join sang `vi_blog_posts` ở client (thêm 1 query vào đường LCP của trang chủ — `Index.tsx:110-112` cố tình giữ đồng bộ để không nhảy layout), hay (c) thêm fallback trong `ViBlogPost.tsx` + `blog.ts:145`. Không có lựa chọn nào là một dòng, và tất cả rơi vào đúng lúc đang bận giải.

**Dấu hiệu sớm lẽ ra phải có**

`ViBlogPost.tsx:32` lẽ ra ghi một dòng vào `client_errors` khi rơi vào nhánh not-found. Hạ tầng đã có sẵn: `errors-telegram-alert` chạy 10 phút/lần, bắn khi ≥3 lỗi cùng fingerprint. Với 6 bài trên trang chủ, ngưỡng 3 bị vượt trong **10 phút đầu tiên** sau deploy.

---

### Sự cố 2 — Khung giờ và giá vé HCMC Open sai trên thẻ chia sẻ Facebook/Zalo; sửa web mất 4 phút, thẻ vẫn sai 3 tuần

**Xác suất:** trung bình-cao (BTC giải VN đổi lịch/giá là chuyện thường) · **Thời gian tới lúc phát hiện:** 2-5 ngày, và phát hiện xong vẫn không sửa được

**Timeline**
- T+0 (27/07, 23:40): publish companion "Cách xem & mua vé HCMC Open". Số liệu chép từ Ticketbox lúc 23:20: hạng vé, khung giờ 4 ngày thi đấu.
- T+20ph: Cuong dán link vào 3 group Facebook pickleball (~40k thành viên) và 2 group Zalo. `facebookexternalhit` và `zalo` **đều nằm trong `BOT_UA`** (`functions/_lib/utils.ts:332`) → chúng nhận bản prerender, không phải SPA.
- T+21ph: Facebook cache title + description + og:image của thẻ. Zalo cũng vậy. Thẻ này giờ là bản sao độc lập, ThePickleHub không còn kiểm soát.
- T+2 ngày (29/07): BTC dời khung giờ chung kết từ chiều sang tối và thêm hạng vé. Cuong biết lúc 22:00 qua fanpage giải.
- T+2 ngày, 22:04: Cuong `UPDATE vi_blog_posts SET content_html = ...` qua Management API. **4 phút, không deploy, không PR, không CI.** Mở `/vi/blog/hcmc-open-2026-ve` trên máy → đúng rồi. Đóng máy.
- T+2 ngày 22:04 → T+3 ngày 04:04: bot vẫn nhận bản cũ. `functions/_middleware.ts:462` key `pr:v32:${url.pathname}`, `:510-513` `expirationTtl = pathCacheTtl(...)`, và `:193-198` chỉ trả 5 phút cho `/social`, `/clubs`, `/san` — blog rơi vào `DEFAULT_TTL_SECONDS = 21600` (`:191`). **6 tiếng.**
- Bản EN thì nằm trong repo — cần commit + PR + Pages build. Nó được sửa "ngày mai", tức 30/07.
- T+3 → T+10 ngày: mọi người bấm vào thẻ Facebook đã share thấy khung giờ cũ trong preview. Vào trang thì đúng, nhưng nhiều người **không vào trang** — họ đọc thẻ, comment giờ, rủ nhau đi.
- T+10 ngày (06/08): một nhóm tới sân theo giờ trong thẻ Facebook.

**Cơ chế**

`vi_blog_posts` (edit tức thì, không gate) ↔ `src/content/blog/posts/<slug>.ts` (edit qua deploy) — hai độ trễ khác nhau cho **cùng một sự thật**.

`_middleware.ts:462-463` → `const noCache = url.searchParams.get("nocache") === "1"`. So sánh **chính xác chuỗi `"1"`**: `?nocache=true` hay `?nocache` trần đều lặng lẽ trả bản cache. CLAUDE.md có cảnh báo đúng dòng này — nghĩa là đã có người mắc rồi.

`_middleware.ts:497` chỉ `put` khi `response.status === 200`, nên bản sai được cache; và KV **không có đường invalidate theo path**, chỉ có bump version key hoặc chờ TTL.

Và mắt xích cuối, cái mà cache nào cũng không cứu: Facebook/Zalo giữ bản chụp của riêng nó. `git revert`, `?nocache=1`, bump `pr:v33` — cả ba đều không chạm tới. Chỉ Sharing Debugger bấm tay từng URL mới xoá được, và không ai nhớ mình đã share ở đâu.

Thêm một mắt xích làm chuyện này *chắc chắn xảy ra* chứ không phải có thể: Task 4 ràng buộc "refresh `updatedDate` → IndexNow". `updatedDate` chảy qua `functions/_lib/render/blog-meta.ts:32` → `dateModified` trong BlogPosting (`blog.ts:98`). Nghĩa là mỗi lần sửa số liệu, Cuong **chủ động gọi Google quay lại crawl** — vào đúng cửa sổ 6 tiếng KV đang giữ bản cũ. Bản được re-index có khả năng là bản sai.

**Vì sao mọi gate vẫn xanh**

- Không gate nào của repo nhìn thấy `vi_blog_posts`. Nội dung VI đi qua Management API, ngoài git, ngoài CI, ngoài PR review, ngoài panel /idea.
- `curl -A Googlebot` sau publish trả 200 với **số liệu đúng tại thời điểm đó**. Đúng, cho tới khi thực tế đổi.
- Soak 30 phút: `client_errors` sạch. Không có exception nào — đây là dữ liệu sai, không phải code sai.
- `seo-byte-budget.test.ts` là gate content duy nhất, chỉ đếm byte title/description. Nó không biết "70.000 USD" hay "19:00" là gì.

**Ai báo, sau bao lâu**

Người dùng, trong comment Facebook, 2-5 ngày. Không phải qua kênh support (site không có). Kịch bản xấu hơn: không ai comment, họ chỉ tới sân sai giờ và im lặng.

**Vì sao khó sửa**

Web sửa 4 phút. Thẻ đã share **không sửa được** bằng bất kỳ thao tác nào trong repo này. Đây là loại hỏng mà `git revert` vô nghĩa theo nghĩa đen — thiệt hại nằm ngoài hệ thống.

**Dấu hiệu sớm lẽ ra phải có**

Không có cái nào cả — và đó mới là điểm. Site có `auto-archive-tournaments` để dọn giải hết hạn, nhưng **không có cơ chế nào gắn hạn dùng vào một bài viết**. Không có cột `expires_at` trên `vi_blog_posts`, không có mốc trong `docs/milestones.md` cho ngày 09/08.

---

### Sự cố 3 — `hreflang` và sitemap quảng cáo `/blog/pickleball-glossary` trong 6 ngày trước khi bài EN tồn tại; rollback Pages biến nó thành vĩnh viễn

**Xác suất:** trung bình · **Thời gian tới lúc phát hiện:** 3-8 tuần (chỉ lộ ra khi đọc GSC Coverage)

**Timeline**
- T+0 (27/07, 21:00): Cuong làm phần dễ trước. INSERT `vi_blog_posts` cho glossary VI: `slug='thuat-ngu-pickleball'`, `alternate_en_slug='pickleball-glossary'`. Xong trong 15 phút, không cần build.
- T+15ph: `functions/sitemap-blog.xml.ts:31-36` đọc thẳng Supabase mỗi request. Bài VI mới **đã có mặt trong sitemap ngay lập tức**, kèm `:46,48` hreflang `en` và `x-default` trỏ `https://www.thepicklehub.net/blog/pickleball-glossary`.
- T+15ph: `functions/_lib/render/blog.ts:176` (`renderViBlogPost`) cũng emit hreflang `en` + `x-default` về đúng URL đó.
- URL đó chưa tồn tại. `blog.ts:34-35`: `const meta = BLOG_POST_META[slug]; if (!meta) return render404(...)`.
- T+1 ngày: PR bài EN mở. CI đỏ — `seo-byte-budget.test.ts:39` bắt `metaTitleVi` glossary vượt 60 **byte** (dấu tiếng Việt 2-3 byte/ký tự). Cuong viết lại, push lại.
- T+2 ngày: Cloudflare build đỏ ở `npm ci` do lockfile drift (memory `cloudflare-build-npm-ci-lockfile`, đã dính 2 lần). Sửa tiếp.
- T+3 ngày: giải sắp tới, ưu tiên đảo sang Task 4. PR glossary EN treo.
- T+0 → T+6 ngày: Google crawl sitemap-blog.xml (đọc live, không cache), theo `x-default` → 404. Bài VI bị hạ tín hiệu vì cụm hreflang không đối ứng; bài EN bị ghi nhận "Not found (404)" trên một URL do chính site khai báo.
- T+21 ngày: bài EN cuối cùng cũng lên. Một tuần sau, GSC cho thấy glossary EN nuốt impression của `pickleball-rules-complete-guide` cho "pickleball kitchen rule". Cuong quyết rollback bài EN.
- T+22 ngày: rollback theo `docs/ops-runbook.md:173-179` — Cloudflare Pages → deployment cũ → Rollback. Bài EN biến mất khỏi `metadata.ts` → biến mất khỏi `BLOG_POST_META` (generated) → `/blog/pickleball-glossary` **404 vĩnh viễn**.
- Row Supabase vẫn còn. `alternate_en_slug` vẫn còn. Sitemap vẫn khai báo. Không ai revert một dòng DB.

**Cơ chế**

`sitemap-blog.xml.ts:44-49` → hreflang `en`/`x-default` dựng từ `post.alternate_en_slug` **không kiểm tra slug đó có trong `EN_BLOG_SLUGS` hay không**. `functions/_lib/static-blog-slugs.ts:9` có sẵn danh sách; không ai import nó vào đây.

`blog.ts:42-53` chiều ngược lại thì *có* kiểm tra thật. Hai chiều của cùng một cặp hreflang được viết bởi hai logic khác nhau, một chiều verify một chiều tin lời khai. Đó chính xác là chỗ nối mà checklist không có ô để tick.

Thêm một mắt xích, tôi chỉ tìm ra khi grep: **`content.vi` trong mọi file `src/content/blog/posts/*.ts` không được render bởi bất kỳ ai.** `src/pages/BlogPost.tsx:110` hardcode `const content = post.content.en`; `functions/_lib/render/blog-body.ts:77` cũng `post.content.en`. Consumer duy nhất của `content.vi` là `seo-byte-budget.test.ts:65,67` — và nó chỉ đọc 2 chuỗi meta.

Nghĩa là: viết glossary "song ngữ" trong repo sinh ra một bản tiếng Việt **hoàn chỉnh, được test, và không ai đọc được**. Bản VI thật phải viết lại lần thứ hai dưới dạng `content_html` trong Supabase. Định nghĩa "kitchen" từ đó tồn tại ở 3 nơi: `pickleball-rules-complete-guide.ts:215` (chết), `pickleball-glossary.ts` content.vi (chết), row Supabase (sống).

**Vì sao mọi gate vẫn xanh**

- `blog-seo-surfaces.test.ts` khoá parity ba surface EN — nhưng cả ba derive từ `blogMetadata`, nên nó chứng minh một điều đã đúng theo cấu tạo. **Không có test nào nối repo với `vi_blog_posts`.**
- `tests/seo.spec.ts:380-410` hardcode 1 slug, và kiểm chiều VI→EN chỉ bằng `toMatch(/hreflang=["']en["']/i)`: **nó xác nhận thẻ tồn tại, không fetch href xem có 200 không** (`:405-407`).
- `tests/seo.spec.ts:313-320` duyệt sitemap nhưng chỉ lấy **URL đầu tiên** mỗi segment, và fetch `<loc>` (bản VI, 200), không fetch href trong `xhtml:link`.
- INSERT Supabase không đi qua PR, không có panel, không có CI, không có soak. `ops-runbook.md:181-188` chỉ nói về migration — **không có mục nào cho rollback nội dung**.
- Pages rollback cảnh báo "rolling back the site rolls back the middleware too". Nó không cảnh báo rằng rollback site **không** rollback Supabase.

**Dấu hiệu sớm lẽ ra phải có**

Một test 8 dòng: mọi `alternate_en_slug` khác NULL trong `vi_blog_posts` phải nằm trong `EN_BLOG_SLUGS`.

---

## Xếp hạng

| # | Sự cố | Xác suất | Khó phát hiện | Ưu tiên |
|---|---|---|---|---|
| 1 | Thẻ trang chủ VI → "Không tìm thấy bài viết" | **Cao** — cơ chế đã sống, publish chỉ đổi nạn nhân | **Cực cao** — mọi gate là `curl -A Googlebot`, mà bot path lành | **P0** |
| 2 | Giá/giờ sai đóng băng trong thẻ Facebook/Zalo | TB-cao | Cao — phát hiện được thì đã không sửa được | **P1** |
| 3 | hreflang/sitemap trỏ URL EN chưa tồn tại; rollback nửa vời | TB | Cao — chỉ lộ trong GSC Coverage, ~4 tuần | **P2** |

Xếp #1 trên #2 vì #1 **đang xảy ra ngay bây giờ trên prod** cho cả 6 bài trang chủ, và Task 4/5 chỉ làm nó trúng đúng hai bài quan trọng nhất trong 10 ngày quan trọng nhất năm.

---

## Rẻ nhất để chặn từ bây giờ

1. **Một dòng log ở `src/pages/ViBlogPost.tsx:32`** — khi rơi vào nhánh not-found, ghi `client_errors` với fingerprint `vi_blog_not_found:<slug>`. Hạ tầng alert đã có sẵn (`errors-telegram-alert`, 10 phút, ngưỡng ≥3 cùng fingerprint). Chặn sự cố 1 trong 10 phút thay vì không bao giờ.

2. **Một fallback ở đúng chỗ nối, không vá từng link** — `functions/_lib/render/blog.ts:145`: nếu `vi_blog_posts` không có slug nhưng `BLOG_POST_META[slug]` có → `secureRedirect 301 → /blog/<slug>` thay vì 404. Cùng logic ở `ViBlogPost.tsx:32`. Hai chỗ, ~4 dòng, xoá luôn lý do tồn tại của allowlist chép tay `VI_BLOG_REDIRECTS`.

3. **Một test 8 dòng nối repo với DB** — `vi_blog_posts.alternate_en_slug ⊆ EN_BLOG_SLUGS`.

Ba việc trên không đụng nội dung, không đụng deadline giải. Làm trước khi publish.

---

## Khoảng hở của pipeline mà bài này lộ ra

**1. Tiêu chí nghiệm thu của cả work order là `curl -A "Googlebot"`, mà bot và người chạy hai renderer khác nhau.** `functions/_lib/render/*` và `src/pages/*` là hai bản cài đặt song song của cùng một trang. **Bất kỳ đề xuất nào chạm blog phải kèm một lệnh verify chạy JS.**

**2. `vi_blog_posts` nằm hoàn toàn ngoài pipeline.** Một nửa nội dung tiếng Việt của site — thứ phục vụ 95% người dùng — được sửa bằng tay qua Management API và không gate nào biết nó tồn tại.

**3. Soak 30 phút đọc `client_errors` chỉ bắt được thứ throw.** Cả ba sự cố ở đây không throw dòng nào. Soak sạch trong ba câu chuyện này là **bằng chứng zero**.

**4. Guard được sinh ra từ nguồn duy nhất thì chứng minh 1 = 1.** Khi một refactor biến drift-risk thành generated, phải **dời test theo ranh giới mới**.

**5. Allowlist chép tay là nợ có lãi.** `VI_BLOG_REDIRECTS` (15 dòng), `ALL_BLOGS` (`utils.ts:337-347`, và `relatedBlogLinks:357` luôn `.slice(0,3)` — nên mọi bài EN đều link tới đúng 3 bài cố định, glossary sẽ không bao giờ có link nội bộ trên bot path).

---

## Xác minh độc lập của orchestrator (2026-07-27)

Claim headline được kiểm lại bằng curl riêng:

```
/vi/blog/hcmc-open-2026-preview                          404
/vi/blog/pickleball-cost-vietnam-2026                    404
/vi/blog/vietnam-hosts-ppa-tour-asia-2026                404
/vi/blog/pickleball-world-cup-2026-da-nang-how-to-watch  404
/vi/blog/hcmc-open-2026                    (slug VI thật) 200
/vi/blog/ppa-tour-asia-2026-lich-thi-dau-tien-thuong      200
```

`src/pages/Index.tsx:138` — `href: language === "vi" ? \`/vi/blog/${p.slug}\` : \`/blog/${p.slug}\``

**XÁC NHẬN.** Bug sống trên prod, độc lập hoàn toàn với Task 4/5.
