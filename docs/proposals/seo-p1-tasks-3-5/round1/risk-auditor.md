# round1 / risk-auditor — SEO P1 Task 4 + 5

**Agent:** `risk-auditor` (Claude + GPT-5.6) · **Chạy:** 2026-07-27 · **Output NGUYÊN VĂN.**
**External:** `external/risk-auditor-gpt56.md` (prompt + reply GPT-5.6, model `gpt-5.6-sol`)

---

## Verdict

| | Verdict | Một câu |
|---|---|---|
| **Task 4** (HCMC internal link + companion vé) | 🔴 **RED** | Bài "mua vé / lịch" cho một giải diễn ra sau 10 ngày là thông tin thương mại có hạn sử dụng, nửa VI nằm trong Supabase mà `git revert` không chạm tới, và bản HTML sai còn được KV giữ thêm tới **6 giờ** sau khi sửa — người thật đọc sai giá/địa điểm rồi thì không rollback được. |
| **Task 5** (glossary EN + VI + anchor id) | 🟡 **AMBER** | Sai lầm tệ nhất là tự ăn thứ hạng "kitchen" của `pickleball-rules-complete-guide` đang có sẵn, cộng một hàng Supabase không versioned — đều sửa được, không có thiệt hại người dùng trong ngày. |

**Classifier:** `scripts/agents/risk-tier.mjs` **KHÔNG TỒN TẠI**. Không có tier sàn để nâng lên; hai verdict trên là **em tự phân tier**, cưỡng chế thủ công.

**Thu hẹp phạm vi RED (REFINE sẵn cho vòng 2):** chỉ **Task 4.2** (companion vé) và **Task 4.3** (bump `updatedDate` + IndexNow trên bài preview đang stale) là RED. **Task 4.1** (thêm `internalLinks` vào các bài EN đã có) là 🟢 GREEN thuần repo, revert được, làm riêng PR được ngay.

---

## Rủi ro cụ thể

| # | Mức | Cơ chế hỏng | Người dùng thấy gì | Giảm thiểu |
|---|---|---|---|---|
| 1 | **Cao** | `hcmc-open-2026-preview.ts:36,86,123` viết ngày 23/7 với thì hiện tại: "Leapmotor Singapore Open (July 23–26) — **under way now**", "as of July 23, **just over two weeks out**". Hôm nay 27/7: Singapore Open đã kết thúc, HCMC còn 10 ngày. Task 4.3 bump `updatedDate` → dán tem "vừa cập nhật" lên nội dung sai. | Bài đang pos 7.4 cho "ppa ho chi minh 2026" nói một giải đã xong là "đang diễn ra". Googlebot thấy `dateModified` mới + nội dung mâu thuẫn thực tế. | **Sửa prose TRƯỚC, bump `updatedDate` SAU.** Không được đảo thứ tự. |
| 2 | **Cao** | Giá vé **không có trong HTML server của Ticketbox**. curl → HTTP 200, 83 KB, JSON nhúng chỉ có `startDate 2026-08-06`, `endDate 2026-08-09T15:00:00Z`, `venue "New Sports Club, City Park, The Global City"`. Giá render client-side. | Người đọc thấy "vé từ X đồng", tới nơi thấy giá khác. Không có đường lùi. | **Không viết giá vé.** Chỉ ghi "vé bán trên Ticketbox" + link. Muốn giá: bắt buộc mở bằng Chrome MCP, ghi ngày kiểm tra vào chính câu văn. |
| 3 | **Cao** | Tên địa điểm lệch: bài khai "**Global City Sports Park**" (`hcmc-open-2026-preview.ts:50,60,140`); Ticketbox khai "**New Sports Club, City Park, The Global City**". | Người đi xem mở Google Maps tìm "Global City Sports Park" — không chắc ra đúng chỗ. Lỗi *người thật đi nhầm*. | Chốt một tên duy nhất theo nguồn BTC. Sửa cả preview lẫn companion cùng lúc. |
| 4 | **Cao** | Link Ticketbox **không click được** trong bài EN (`blog-body.ts:34`, `BlogPost.tsx:293`). `internalLinks` nối chuỗi (`blog-body.ts:52`) → `https://www.thepicklehub.nethttps://ticketbox.vn/...` | Nút "Mua vé" là **text trần**, phải copy-paste. Googlebot không thấy outbound link. | EN **cần** field `externalLinks` + render ở **cả hai** renderer trong **cùng một deploy**. Hoặc bỏ EN, chỉ làm VI. Tiền đề "chèn prose có URL" mà Cuong duyệt là **sai**. |
| 5 | **TB** | VI `content_html` → `DOMPurify.sanitize()` (`ViBlogPost.tsx:122`). Test thật: DOMPurify **giữ** `id` và `rel`, **xoá** `target`. | `target="_blank"` mở **cùng tab** → người dùng rời bài. | Chấp nhận cùng-tab. **CSP không chặn `<a href>`** (`_headers:71`). **Nhưng `frame-src` không có ticketbox.vn** → tuyệt đối không nhúng iframe. |
| 6 | **Cao** | **Task 4 tự phá mục tiêu của chính nó.** `Index.tsx:124-127` lấy top-6 sort `publishedDate`. Top-6 hiện tại kết thúc đúng ở **`hcmc-open-2026-preview` (2026-07-10, hạng 6)**. Publish **1** bài mới → preview rớt khỏi homepage. Publish **2** bài → rớt cả `pickleball-cost-vietnam-2026`. | Brief §4.1 yêu cầu "internal link → preview từ homepage story". Publish companion sẽ **xoá** chính link đó. Kết quả ròng: 0. | Hoặc (a) companion **trỏ** về preview và chấp nhận preview rời homepage, hoặc (b) slot ghim sự kiện — feature mới, ngoài phạm vi. **Phải quyết trước khi publish.** |
| 7 | **Cao** | `functions/api/indexnow.ts:70-113` có mảng `BLOG_SLUGS` **maintain bằng tay**, không test nào phủ. Diff thật: `metadata.ts` 46 slug, `indexnow.ts` 42 slug. **4 bài published chưa bao giờ được ping**: `singapore-open-2026-preview`, `pickleball-world-cup-2026-da-nang-how-to-watch`, `vietnam-pickleball-players-to-watch-2026`, `vietnam-hosts-ppa-tour-asia-2026` — chính là **4 bài mới nhất**. | DoD ghi "IndexNow ping" → GET `/api/indexnow` trả `submitted: 42, status 200` → **báo THÀNH CÔNG trong khi bài mới không nằm trong danh sách**. Bing/Yandex không bao giờ biết bài mới tồn tại. | (a) POST `/api/indexnow?key=<SECRET>` với `{urls:[...]}` tường minh; (b) **thêm 4 slug thiếu + 2 slug mới** vào mảng + 1 test khoá `BLOG_SLUGS ⊇ blogMetadata`. |
| 8 | **TB** | **Race hreflang EN↔VI.** `blog.ts:45` tính hreflang bằng query `vi_blog_posts WHERE alternate_en_slug = <slug>` **tại thời điểm render**, cache KV `pr:v32` với `DEFAULT_TTL_SECONDS = 21600` (`_middleware.ts:191`) = **6 giờ**. Deploy EN trước INSERT VI + Googlebot ghé đúng khe → HTML **không có `hreflang=vi`** đóng băng 6 giờ. | Cặp hreflang một chiều → Google có thể bỏ qua cả cặp. | Thứ tự bắt buộc: **INSERT VI TRƯỚC → deploy EN SAU → `curl ...?nocache=1` cả hai URL.** Giá trị phải đúng `=1` (`_middleware.ts:463`). |
| 9 | **TB** | **Rollback bất đối xứng.** EN trong git, VI trong `vi_blog_posts`, **không migration, không SQL lưu lại**. `git revert` xoá EN mà để VI sống. | Hàng VI còn live, `alternate_en_slug` trỏ bài EN vừa revert → hreflang treo, bấm "English" ra 404 bot. | Trước MỌI ghi vào Supabase: lưu `growth-tasks/sql/2026-07-27-vi-<slug>.sql` gồm **cả INSERT lẫn câu khôi phục**. Đây là điều kiện để hạ RED xuống AMBER cho phần VI. |
| 10 | **TB** | **Anchor id toàn cụm blog.** Thêm `id=slugify(heading)` đổi HTML output của **toàn bộ 46 bài EN** → bump `pr:v32 → v33` → nuke KV mọi route. Quét slugify toàn bộ heading: đúng **1 va chạm id** — `vietnam-dupr-leaderboard-launch.ts` có 2 heading cùng ra `"what"`. Không heading nào ra id rỗng. | Sau bump: mọi URL bot là cold miss. Render budget 8s (`_middleware.ts:487`), quá hạn → bot nhận **SPA shell trần** (200, title chung, không body) trong ~6h. | **Cách lười và đúng: đừng đụng code.** Mục tiêu chính Task 5 là bài **VI** — `content_html` viết thẳng `<h2 id="kitchen">`, DOMPurify giữ `id`. Chỉ khi bắt buộc muốn anchor EN mới đụng renderer. Nếu đụng: dùng `slugify()` ở `src/lib/social/slug.ts:25`, thêm de-dup suffix, **append `docs/prerender-cache-log.md`**. |
| 11 | **TB** | **Cannibalization "kitchen".** `pickleball-rules-complete-guide.ts` đã có heading "The Kitchen (Non-Volley Zone)" (EN ~73, VI ~215) và đang rank. | Google có thể chọn URL yếu hơn → **mất thứ hạng đang có**. Nhìn từ dashboard chỉ là "vị trí tụt". | **Em không đo được vị trí hiện tại** — repo không có GSC API access. Không đoán số. Giảm thiểu bằng cấu trúc: mục `#kitchen` glossary 2-3 câu + link về rules guide; KHÔNG lặp nguyên đoạn. |
| 12 | **Thấp** | Deadline HCMC 6/8 = 10 ngày. Không có bằng chứng nào trong repo về thời gian publish→index thật của site. | Index chậm hơn 10 ngày → companion ra sau khi giải đã diễn ra → 0 click, bài rác vĩnh viễn. | **Không được lấy deadline làm cớ để bỏ fact-check.** Chọn giữa "kịp 6/8" và "đúng dữ kiện" → chọn đúng. |
| 13 | **Thấp** | Comment `_middleware.ts:459-461` vẫn ghi `Current: v29` trong khi code là `pr:v32`. | Người kế tiếp bump nhầm phiên bản. | 1 dòng sửa comment kèm PR. |

---

## SLO bị đe doạ

- **SLO 6 (VN mobile p75 LCP ≤ 2.5s):** rủi ro nhỏ nhưng thật — `blogMetadata` nằm trong **entry chunk first-paint** (verify: `dist/assets/index-AtCX8kPb-*.js` chứa `hcmc-open-2026-preview`). Mỗi entry metadata mới ≈ 1.5 KB raw vào INITIAL. Headroom INITIAL chỉ còn **12.6 KB gz**.
- **SLO 1, 2, 3, 4, 5, 7: không bị đe doạ.** Không đụng edge function, `verify_jwt`, migration, RLS/RPC, cron, push. Nói thẳng: **không có rủi ro auth ở đây**, đừng để ai hedge cho có.
- Không có **SLO nào phủ chất lượng nội dung**. Đó là lý do rủi ro #1–#3 không gate nào bắt và phải chặn bằng người.

## Ngân sách hiệu năng

Số đo thật (`node scripts/check-bundle-size.mjs`, build 2026-07-25):

- **Total: 1848.6 / 1970 KB gz** → headroom **121.4 KB** (không phải ~20 KB; `docs/perf-budgets.md` ghi số 2026-07-17, đã trôi +26 KB).
- **INITIAL: 267.4 / 280 KB** → headroom **12.6 KB**. Chật, và metadata blog nằm trong đó.
- **CODE: 1490.7 / 1800 KB** — thoải mái.
- **CONTENT: 357.9 KB / 47 chunk**, cap **20 KB gz mỗi chunk**. Lớn nhất: `blog-post-pickleball-world-cup-2026-da-nang` = **15.0 KB gz từ 46.6 KB raw** (~0.32).
- **Ngưỡng cho glossary EN:** cap 20 KB gz ≈ **~62 KB source TS**. File dài nhất hiện tại 51.4 KB. Glossary song ngữ 25-30 thuật ngữ **rất dễ vượt 62 KB** → CI đỏ. Gate cứng, chặn trước prod.
- Companion (~24 KB) + glossary (~50 KB) ≈ **+25 KB gz → ~1874 / 1970**. Đạt.
- `posts/all.ts` là **lazy loader map**, không static value — không phồng startup.

## SEO

**Routes SSR bị ảnh hưởng:**
- Task 4.1 (chỉ `internalLinks`): `/blog/<bài sửa>` + `/vi/blog/<twin>` — **không** bump, TTL 6h tự hết hoặc `?nocache=1`.
- Task 4.2 / 5 (bài mới): route mới, không có cache cũ. `BLOG_POST_META` + `EN_BLOG_SLUGS` **generated** — gate bởi `blog-sync.test.ts` + `blog-seo-surfaces.test.ts`.
- Task 5 anchor id (nếu đụng renderer): **TOÀN BỘ 46 bài EN** + mọi route SSR khác.

**Cần bump `pr:v32 → v33`?** Task 4: **KHÔNG**. Task 5 nếu thêm `id=` vào renderer: **CÓ, bắt buộc**. Task 5 nếu chỉ VI: **KHÔNG** — lý do mạnh nhất để làm VI trước.

**Gate tự động thật sự có trong repo:**

| Gate | Bắt được gì | Không bắt được gì |
|---|---|---|
| `blog-sync.test.ts` | metadata ↔ post file ↔ BLOG_POST_META ↔ EN_BLOG_SLUGS | **chân thứ 5 = Supabase `vi_blog_posts`** — file tự khai dòng 15-16: "lives in the DB and can't be checked statically" |
| `blog-seo-surfaces.test.ts` | slug parity 3 surface EN | như trên |
| `seo-byte-budget.test.ts` | title > 60 **byte**, desc > 160 byte | tiếng Việt có dấu 2-3 byte/ký tự → gate này **sẽ đỏ** nếu viết meta VI tự nhiên |
| `blog-barrel.test.ts` | `posts/all.ts` drift | — |
| `redirect-parity.test.ts` | `_redirects` ↔ `_middleware.ts` | không liên quan trừ khi thêm 301 |
| `scripts/seo-verify.sh` | canonical/hreflang/JSON-LD prod | **thủ công, không nằm trong CI** |
| **KHÔNG CÓ GATE** | `indexnow.ts` `BLOG_SLUGS` | **đã trôi 4 bài** |
| **KHÔNG CÓ GATE** | hàng `vi_blog_posts`, `alternate_en_slug` | — |

**Xác suất sót với 2 bài × 2 ngôn ngữ:** phía **EN gần bằng 0** (4 gate CI). Phía **VI gần như hoàn toàn phụ thuộc con người**. Cộng mảng IndexNow không gate = 3 điểm sót độc lập cho mỗi bài.

---

## `.gsc-index-queue.json` — DoD không thi hành được

File **không tồn tại**. Lần thứ 6 work order trích dẫn artifact không có. Cơ chế thay thế thật sự tồn tại: `functions/api/indexnow.ts` — POST `{urls:[...]}`, prefix bắt buộc `https://www.thepicklehub.net/`, auth `?key=<INDEXNOW_SECRET>` (constant-time), rate-limit 10 req/60s. Env: `INDEXNOW_KEY` + `INDEXNOW_SECRET`.
Google **không có** Indexing API cho blog post → Request Indexing GSC UI là việc **của Cuong**. Ghi vào `docs/huong-dan-viec-cua-cuong.md`.

**Đề nghị:** sửa DoD thành "POST IndexNow + ghi việc GSC vào `docs/huong-dan-viec-cua-cuong.md`", bỏ hẳn `.gsc-index-queue.json`.

## Kế hoạch rollback

| Phần | Cơ chế | Thời gian | Detection |
|---|---|---|---|
| Task 4.1 internal links | `git revert` + redeploy + `?nocache=1` | ~5 phút + ~1 phút | `seo-verify.sh` |
| Task 4.2 EN companion | `git revert` → SSR 404 cho bot, sitemap tự co | ~5 phút | `curl -A Googlebot` → 404 |
| Task 4.2 **VI (Supabase)** | **`git revert` KHÔNG chạm.** `UPDATE ... SET status='draft'` | ~2 phút **nếu đã chuẩn bị SQL**; **không xác định** nếu chưa | Không có alert |
| Task 5 EN glossary | như 4.2 | ~5 phút | |
| Task 5 **VI (Supabase)** | như trên | như trên | |
| Task 5 heading-id renderer | `git revert` + **bump `v33 → v34`** | ~5 phút + 6h đuôi nếu quên bump | Không có alert |
| **IndexNow đã ping** | **KHÔNG revert được** | ∞ | — |
| **Người đã đọc sai giá/địa điểm** | **KHÔNG revert được** | ∞ | — |

**Cái làm nó RED:** hai dòng cuối, cộng hàng Supabase không có SQL down, cộng HTML sai sống trong KV thêm 6 giờ.

## Phải verify trước khi merge

**Chặn Task 4 (RED):**
- [ ] `grep -n "under way now\|this week\|as of July 23\|just over two weeks" src/content/blog/posts/hcmc-open-2026-preview.ts` → **0 kết quả**
- [ ] Chốt 1 tên địa điểm duy nhất, nhất quán preview + companion + `metaDescription*`
- [ ] **Không có con số giá vé nào**, hoặc có kèm nguồn + ngày kiểm tra bằng Chrome MCP
- [ ] `curl -sI "https://ticketbox.vn/..." | head -1` → 200 (chạy lại ngay trước merge)
- [ ] Nếu EN companion: `externalLinks` có ở **cả 3** file trong **cùng 1 PR**
- [ ] Quyết định homepage: chấp nhận preview rớt top-6, hay không publish companion?
- [ ] SQL rollback lưu tại `growth-tasks/sql/2026-07-27-vi-<slug>.sql`, có **cả** INSERT lẫn hoàn tác
- [ ] Cuong duyệt tường minh — RED không tự merge

**Chặn Task 5 (AMBER):**
- [ ] `npm test` xanh, đặc biệt `seo-byte-budget`
- [ ] `node scripts/gen-blog-barrel.mjs` đã chạy
- [ ] `node scripts/check-bundle-size.mjs` — chunk glossary < 20 KB gz (source < ~62 KB)
- [ ] Nếu đụng heading id: bump `v32→v33` + append `prerender-cache-log.md` + de-dup id
- [ ] Mục `#kitchen` **link về** rules guide, không lặp nguyên đoạn

**Chung sau deploy:** INSERT VI trước → deploy EN sau → `?nocache=1` cả 2 · POST IndexNow tường minh (**không** GET-all) · thêm 6 slug thiếu + test khoá `BLOG_SLUGS ⊇ blogMetadata`

---

## Phản biện độc lập (GPT-5.6, model `gpt-5.6-sol`)

Gọi bằng `curl` trực tiếp: `scripts/agents/ask-model.mjs` **không tồn tại**.

**Đã xác minh trong repo và GIỮ (6/6 finding chính đều đúng):**
1. `updatedDate` refresh trên prose stale = "site tự bảo chứng thông tin cũ vừa được kiểm tra" — **đúng** (`hcmc-open-2026-preview.ts:36,86,123`).
2. Ba nhánh hỏng của link ngoài — **đúng cả ba** (`blog-body.ts:34,52` + `BlogPost.tsx:293`).
3. Race hreflang + KV đóng băng 6h — **đúng**, em bổ sung con số nó không có: `_middleware.ts:191` `DEFAULT_TTL_SECONDS = 21600`; `pathCacheTtl()` chỉ giảm 300s cho `/social`, `/clubs`, `/san` — `/blog` luôn 6h.
4. Rollback bất đối xứng repo↔Supabase — **đúng**.
5. IndexNow bulk path bỏ sót âm thầm — **đúng**. GPT thận trọng nói "không biết bài preview có trong 42 entry không". Em tra được: **có** (`indexnow.ts:73`). Nhưng 4 bài mới nhất thì **không**.
6. Đúng 1 va chạm id khi slugify — **đúng**, `vietnam-dupr-leaderboard-launch.ts`.

**Chỗ GPT-5.6 nói mà em KHÔNG xác minh được:**
- "VI page trỏ tới bài EN chưa deploy thì người dùng đi tới **route thiếu**" — GPT tự thừa nhận "exact missing-route UI is not specified". Em **không** kiểm chứng UI 404 cho nhánh này.
- Cannibalization: GPT **từ chối** coi đó là "production failure" vì không có số. Em **đồng ý về phân loại** nhưng vẫn giữ ở mức TB, có ghi rõ **em không đo được**.

**BÁC BỎ / sửa lại:**
- **URL ví dụ `https://thepicklehub.examplehttps://ticketbox.vn/...`** — GPT **bịa** host `thepicklehub.example`. Chuỗi thật là `siteUrl + path` với `siteUrl = env.CANONICAL_HOST || "https://www.thepicklehub.net"` (`_middleware.ts:440`). Cơ chế đúng, chuỗi minh hoạ sai.
- **"Bundle-size and UTF-8 SERP-limit violations would fail CI"** — đúng nhưng **chưa đủ**: GPT không biết `blogMetadata` nằm trong entry chunk first-paint, nên bỏ sót INITIAL chỉ còn 12.6 KB headroom.
- **GPT không thấy** rủi ro #6 (bài mới đẩy preview khỏi homepage, tự huỷ mục tiêu Task 4.1). Finding **chỉ đọc code mới ra**.
- **GPT hạ đúng mức cảnh báo cache-nuke** ("không có bằng chứng render vượt 8s, đừng claim outage"). Em **giữ nguyên cách hạ đó**.

**Ghi chú panel:** GPT-5.6 và em độc lập ra 6 finding trùng nhau. Điều đó **không** làm chúng đúng hơn — chúng đúng vì em đã mở đúng file và chạy đúng lệnh. Ba finding mạnh nhất (#6 homepage tự huỷ, #7 IndexNow trôi 4 slug, #2 Ticketbox không có giá trong HTML server) đều **không** đến từ GPT-5.6; chúng đến từ `curl` và `node -e`.
