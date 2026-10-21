# ui-ux-critic — second opinion (external)

- **Model:** `gpt-5.6-sol` (OpenAI Responses API, reasoning effort medium)
- **Ngày:** 2026-08-02
- **Bridge:** `scripts/agents/ask-model.mjs` KHÔNG tồn tại trong repo (gap đã biết). Gọi trực tiếp `POST /v1/responses` bằng curl + $OPENAI_API_KEY.
- **Usage:** input 1337 tok / output 3091 tok (reasoning 1034)

## System prompt

```
You are a senior product designer reviewing a mobile-first bilingual (Vietnamese-primary) sports web app. Be specific and concrete. Name the exact element and the exact fix. No generic design platitudes. Answer in Vietnamese, keep technical terms in English.
```

## Prompt GỬI ĐI (nguyên văn)

````markdown
# Brief: review UX của một checklist SEO + một CLI script

Bạn review giúp tôi thiết kế của một deliverable KHÔNG có giao diện web: (a) một
checklist SEO viết trong file TODO.md của repo, (b) một script CLI phân loại URL
từ file export CSV của Google Search Console. Người dùng của deliverable này là
**một người duy nhất** (Cuong, solo dev, người Việt) **và các coding agent tự động
chạy sau này**. Tài liệu viết bằng tiếng Việt.

Sản phẩm nền: ThePickleHub — nền tảng pickleball song ngữ Việt-Anh, ~95% người dùng
Việt Nam, mobile-first, hosting Cloudflare Pages, prerender SSR cho bot crawler.

## Checklist HIỆN TẠI (nguyên văn, tiếng Việt, trong TODO.md)

> ### SEO follow-up sau PR #515 (ghi nhận 02/08/2026)
> Không xử lý ngay. Dùng export GSC ngày 01/08/2026 làm baseline và thực hiện theo thứ tự sau:
> - [ ] **Index coverage:** phân loại 138 URL `Discovered – currently not indexed` và 42 URL `Crawled – currently not indexed`; loại thin/duplicate URL khỏi sitemap hoặc cải thiện nội dung + internal link cho URL cần index.
> - [ ] **404 hygiene:** rà 61 URL 404 và 1 soft 404. Redirect 301 URL cũ còn giá trị; giữ 404/410 cho URL rác nhưng xóa khỏi sitemap và internal link.
> - [ ] **Robots/canonical/noindex:** xác nhận 12 URL bị robots.txt chặn, 16 URL redirect, 5 alternate canonical và 3 noindex đều là chủ ý.
> - [ ] **CTR quick wins:** tối ưu title/meta cho query vị trí 5–10, ưu tiên `bsb pickleball club`, `dk pickleball`, `picklezone - pickleball vinh heritage nghệ an`, `rally pickleball`, `msc mystery sport complex`. Baseline toàn site: CTR 1,8%, vị trí 9,1; mục tiêu CTR 2,5–3% mà không làm giảm vị trí.
> - [ ] **Giảm phụ thuộc một bài:** mở rộng cluster PPA/MLP, giải Việt Nam, sân/CLB theo địa phương và internal link từ `/vi/blog/singapore-open-2026` sang các trang liên quan.
> - [ ] **CWV field-data:** đọc lại CrUX/GSC sau tối thiểu 28 ngày kể từ deploy PR #515; không kết luận từ Lighthouse lab. Theo dõi riêng mobile LCP, INP, CLS; đồng thời thử giảm mobile FCP từ 2,3s xuống ≤1,8s nếu field-data xác nhận cần.
> - [ ] **Xác minh sau xử lý:** gửi lại sitemap, chạy Googlebot SEO verification, PageSpeed cho homepage + blog + venue + livestream, rồi so sánh clicks, impressions, CTR và vị trí theo tuần.
>
> **Done khi:** không còn soft 404/internal link tới 404; mọi exclusion có quyết định ghi nhận; nhóm query quick-win có ≥28 ngày dữ liệu hậu thay đổi; CWV có đủ field-data để đưa verdict.

## Đề xuất cải thiện đang xét (v2)
1. Viết lại checklist cho đúng kỹ thuật: "loại khỏi sitemap" KHÔNG phải deindex — URL thin cần thẻ `noindex`, xoá khỏi sitemap chỉ là phụ.
2. Tách ưu tiên: xử lý 42 URL `Crawled – not indexed` (tín hiệu chất lượng) TRƯỚC 138 `Discovered – not indexed` (vấn đề crawl budget, tự cải thiện khi internal link tốt lên).
3. Sửa title trang sân phải invalidate cache prerender (bump khoá cache `pr:v32:<path>` hoặc gọi từng path với `?nocache=1`) — nếu không Googlebot vẫn thấy title cũ nhiều ngày.
4. Viết một script CLI phân loại URL từ các file CSV export GSC nằm ở máy local.

## Sự thật kỹ thuật đã kiểm chứng (quan trọng — dùng để phản biện checklist)
- File export Coverage của GSC (4 file CSV) CHỈ có **số đếm tổng theo nguyên nhân**, KHÔNG có cột URL. Danh sách 138 / 42 / 61 URL phải export riêng từng issue trên giao diện GSC web, hoặc gọi URL Inspection API (quota 2000 URL/ngày). Nghĩa là script "phân loại URL từ export local" KHÔNG chạy được trên đúng bộ file mà checklist giả định.
- File export Performance có `Trang.csv` (999 URL kèm clicks/impressions/CTR/vị trí) và `Cụm từ tìm kiếm.csv` (1000 query kèm số liệu) nhưng **GSC không export được mapping query → trang**. Muốn biết query "dk pickleball club" đang rank trang nào phải lọc thủ công trên giao diện GSC.
- Repo đã có sẵn hàm `isThinVenue()` dùng chung giữa bộ render SSR (gắn `<meta robots noindex, follow>`) và bộ sinh sitemap (bỏ URL). Điều kiện thin: KHÔNG có địa chỉ VÀ không toạ độ VÀ không số sân VÀ không số điện thoại. Có 820 trang `/san/` xuất hiện trong `Trang.csv`.
- Trang sân có 2 phiên bản ngôn ngữ: `/san/<slug>` (EN) và `/vi/san/<slug>` (VI), hreflang en/vi/x-default, **x-default trỏ về bản EN**.
- Dữ liệu thật cho 5 query "quick win" (số liệu 3 tháng):
  - `dk pickleball club`: 5 click / 207 hiển thị / CTR 2,42% / vị trí 7,8
  - `bsb pickleball club`: 1 click / 272 hiển thị / CTR 0,37% / vị trí 8,24
  - `rally pickleball`: 1 click / 297 hiển thị / CTR 0,34% / vị trí 7,65
  - `picklezone - pickleball vinh heritage nghệ an`: 0 click / 147 hiển thị / CTR 0% / vị trí 5,5
  - `msc mystery sport complex`: 0 click / 138 hiển thị / CTR 0% / vị trí 5,15
- Trang tương ứng (chú ý CẢ BẢN EN LẪN VI đều rank cho query tiếng Việt):
  - `/vi/san/dk-pickleball-club-tp-hcm`: 6 click / 489 hiển thị / 1,23% / vị trí 7,17
  - `/san/dk-pickleball-club-tp-hcm` (EN): 4 click / 243 hiển thị / 1,65% / vị trí 7,63
  - `/san/bsb-pickleball-club-tp-hcm` (EN): 2 click / 383 hiển thị — trong khi `/vi/san/bsb-pickleball-club-tp-hcm` chỉ 0 click / 50 hiển thị
  - `/vi/san/san-pickleball-picklezone-vinh-heritage-vinh`: 0 click / 205 hiển thị / vị trí 5,96
- Title thật đang chạy trên production (lấy bằng curl với User-Agent Googlebot):
  - VI: `DK Pickleball Club – TP.HCM | ThePickleHub`
  - EN: `BSB Pickleball Club – TP.HCM | ThePickleHub`  ← **title bản EN và bản VI GIỐNG HỆT NHAU** khi tên sân đã chứa từ khoá
  - VI: `Sân Pickleball PickleZone Vinh Heritage | ThePickleHub` (chú ý: query người dùng gõ có chữ "nghệ an" — title không có tỉnh Nghệ An, chỉ có thành phố Vinh)
  - Description VI: `DK Pickleball Club tại TP.HCM, ngoài trời. SĐT đặt sân 0938 189 007. Địa chỉ, bản đồ, chỉ đường & các sân pickleball ở TP.HCM…`
- Quy ước sẵn có của repo: cấm dùng GSC URL Inspection Live Test để verify (hay báo âm tính giả); chỉ verify bằng `curl -A "Googlebot"` hoặc Rich Results Test.
- Repo có sẵn 3 script SEO viết bằng Python stdlib (`gsc_report.py`, `seo_verify.py`, `canonical_monitor.py`), dùng `argparse`, in JSON ra stdout. Không có test nào cho chúng.

## Tôi cần bạn phản biện đúng 4 điểm

1. **UX của checklist như một tài liệu THI HÀNH.** Người đọc là Cuong hoặc một agent tự động. Từng mục có mơ hồ không? Done-criteria đo được không? Thứ tự có đúng dependency không (ví dụ mục "Xác minh sau xử lý" nằm cuối, nhưng cache prerender phải invalidate NGAY sau khi đổi title mới verify được)? Mỗi bước có nói rõ "làm ở đâu" (giao diện GSC / sửa file trong repo / gõ lệnh terminal) không? Hãy chỉ ra mục nào KHÔNG THỂ thực hiện được với dữ liệu đang có.

2. **UX của script CLI.** Thiết kế input/output nên thế nào: tham số gì, output format gì (JSON? TSV? markdown?) để pipe được sang bước tiếp theo; chạy sai input (đưa nhầm thư mục export, thiếu cột) thì fail ra sao; thông báo lỗi nên tiếng Việt hay tiếng Anh (docs tiếng Việt nhưng script trong repo có comment/lệnh tiếng Anh); có nên tự đoán thư mục export trong ~/Downloads không. Cho tôi chữ ký lệnh cụ thể.

3. **Copy tiếng Việt / thuật ngữ.** Các cụm trạng thái GSC (`Crawled – currently not indexed`, `Discovered – currently not indexed`, `soft 404`, `alternate canonical`) — giữ nguyên tiếng Anh hay dịch sang tiếng Việt? Lưu ý giao diện GSC của Cuong đang ở tiếng Việt (GSC dịch là "Đã thu thập dữ liệu – hiện chưa được lập chỉ mục"). Chọn một và giải thích.

4. **Rủi ro ảnh hưởng người dùng thật (không phải bot).**
   - Mục "CTR quick wins" sẽ đổi title các trang sân. Title mới phải cân giữa SEO và người thật đọc trên màn hình SERP điện thoại. Với dữ liệu ở trên, bạn cho rằng đổi title có phải là fix đúng không, hay vấn đề nằm chỗ khác? Nếu đổi thì đổi thành gì — cho tôi chuỗi title cụ thể cho DK / BSB / PickleZone.
   - Mục noindex có nguy cơ noindex nhầm trang đang có người dùng thật vào không? Nên đặt hàng rào an toàn (safety gate) nào trong script/checklist?

Trả lời cụ thể, gọi đúng tên phần tử và đúng cách sửa. Không nói chung chung kiểu "cải thiện trải nghiệm". Viết tiếng Việt được thì tốt, thuật ngữ kỹ thuật giữ tiếng Anh.
````

## Reply NGUYÊN VĂN

> Lưu ý khi đọc: model trả về một **risk register**, KHÔNG trả lời 4 câu hỏi UX được
> hỏi (chữ ký CLI, thuật ngữ VI, chuỗi title cụ thể). Xem phần "Panel đa model"
> trong báo cáo ui-ux-critic để biết chỗ nào đã verify được và chỗ nào bỏ trống.

````markdown
## Blocking failures

### 1. The tooling cannot identify the “61 404 URLs”

**Mechanism:** The Coverage export contains only aggregate counts, not URL rows. The Performance export contains at most 1,000 URLs and does not provide Coverage status. There is no valid join that can identify which URLs comprise the 61 reported 404s—or the 138/42 not-indexed groups.

**Trigger:** The script treats URLs missing from Performance, or URLs producing a current 404 during a local crawl, as the URLs represented by the Coverage counts.

**Observed result:** The operator gets a plausible-looking “61 404s” report that is not the GSC cohort. Redirects are then written for unrelated URLs, while the actual Google-reported 404s remain untouched.

The report is also stale for this purpose: `GONE_EXACT` shipped on July 30, only two days before the August 1 export, and validation is already “Started.” Some of those 61 may now correctly return 410.

**Recovery:** Fixing the classifier is immediate, but obtaining URL-level Coverage evidence requires a different export/source or URL Inspection calls after credentials exist. Once bad redirects are removed, Google’s status correction normally takes days to several weeks of recrawling.

**Required disposition:** The script may classify Performance URLs by path or sitemap segment. It must explicitly refuse to classify URLs into Coverage buckets from this export.

---

### 2. Redirects placed only in `_redirects` do not exist for Google

**Mechanism:** Googlebot is intercepted by `functions/_middleware.ts`, and the bot response never reaches Cloudflare Pages’ static redirect processing.

**Trigger:** Step 2 adds the 301s to `public/_redirects`, following the normal Pages convention, but does not add equivalent routing before rendering in `_middleware.ts`.

**Observed result:**

- A human opening the old URL receives a 301.
- A normal `curl` may also appear correct.
- `curl -A "Googlebot"` and Google continue receiving the old 404/410/rendered response.
- GSC’s 61-URL issue does not clear, and no ranking signals are transferred.

This is particularly likely because the repository already has three separate JS redirect maps precisely to handle this split.

**Recovery:** The serving defect ends as soon as the redirect is deployed in middleware. GSC validation and search-result changes take days to weeks.

---

### 3. “Redirect all 61 404s” is not a valid remediation

**Mechanism:** A 301 only works when there is a genuinely equivalent replacement. Redirecting deleted URLs to the homepage, a directory hub, or a vaguely related venue is treated by Google as an irrelevant redirect/soft 404. It can also reverse the intentional semantics of the 28 `GONE_EXACT` paths and regex family.

**Trigger:** The checklist converts the aggregate 61 count into a target and requires every member to receive a 301, without first distinguishing:

- moved pages with an equivalent destination;
- malformed aliases;
- deliberately deleted pages that should remain 410;
- stale GSC observations;
- URLs that should simply remain 404.

**Observed result:** GSC reports soft 404s or continues excluding the URLs. Old search results may briefly redirect users to an unrelated page rather than telling them the resource is gone. If any stale report entry now identifies a valid/restored URL, an unnecessary 301 removes that page from search.

**Likelihood:** The July 30 deployment makes overlap with intentionally gone URLs plausible, while the aggregate-only export makes it impossible to rule out.

**Recovery:** Correct HTTP behavior can be restored in one deployment. Search recovery after Google has processed a wrong permanent redirect is usually several weeks and can take longer for low-crawl URLs.

---

### 4. A global prerender cache-version bump creates an avoidable crawler outage

**Mechanism:** Changing `pr:v32` to `pr:v33` invalidates every prerendered path simultaneously. The next request for each path performs a chain of Tokyo Supabase queries under an eight-second budget. On timeout, the bot receives the SPA shell instead of the intended rendered document.

**Trigger:** The title/noindex deployment bumps the global key and is followed by sitemap resubmission or a crawler burst across the venue corpus.

The exposure is large: there are at least 822 `/san/*` URLs in the capped Performance export, plus blog, hub, language variants, and other indexed URLs. The site also has roughly 691 thin venues times two languages, although those should be absent from the venue sitemap.

**Observed result:** Googlebot intermittently receives shell HTML with missing or incorrect title, canonical, content, or structured data. Search snippets can regress, and some pages may be classified as crawled but not indexed or soft 404 depending on what the shell contains. Humans remain unaffected because they are supposed to receive the SPA, making this easy for the operator to miss.

The existing Playwright test only requests the first URL in each sitemap; it will not expose failures distributed across hundreds of cold venue renders.

**Recovery:** Serving recovery takes up to the six-hour cache window only if successful responses subsequently replace failures; otherwise it requires warming affected paths, fixing render capacity, or rolling back to `v32`. Search recovery takes the next recrawl cycle—days to weeks for long-tail venue pages.

**Required disposition:** Do not globally bump the namespace for a title-only change. Warm/invalidate paths in controlled batches and verify representative URLs from every sitemap segment as Googlebot before resubmission.

---

## Traffic-loss hazards

### 5. Expanding “thin” to mean zero-click or not-indexed would hit the traffic engine

The repository’s existing definition is mechanical and narrow: no address, coordinates, court count, or phone. Those pages are already `noindex, follow` and already absent from `sitemap-venues.xml`. Re-executing that exact rule is a no-op apart from cache propagation.

It becomes a production failure if the new classifier or checklist changes the population based on GSC performance.

**Mechanism:** Zero clicks are mistaken for no search value, and the resulting URLs receive `noindex` or are removed from sitemaps.

**Trigger:** Using the 588 zero-click rows, the 498 zero-click venue rows, or the 138/42 aggregate not-indexed counts as a thin-content queue.

**Observed result:** Pages with existing impressions disappear from search before title improvements can raise CTR. The zero-click cohort collectively has 23,552 impressions, so this is not an unobserved tail. Venue pages are the site’s acquisition engine: 657 clicks, 56.2% of all clicks, and 83% of impressions.

**Recovery:** Removing `noindex` is immediate in production, but reindexing typically takes days to weeks and may take longer for long-tail venues.

**Required disposition:** Preserve the existing field-based `isThinVenue()` predicate. Do not infer thinness from clicks, index state, or absence from the capped export.

---

### 6. A venue-title rollout has a large blast radius, but failure is not inherent

Rewriting titles is not itself unsafe. The danger is deploying one template globally without a sampled comparison.

**Mechanism:** A template accidentally drops the venue name/location, uses the wrong language, produces duplicate titles, or changes only the human SPA while leaving crawler SSR unchanged.

**Trigger:** Global rollout across `/san/*` without checking both language variants in the Googlebot response.

**Observed result:** Either Google sees no change at all, or snippets become generic/duplicated and CTR falls across the segment responsible for 56.2% of clicks. A small percentage decline here can outweigh all gains available from the 52-click top blog post.

**Recovery:** Template rollback is immediate; snippet refresh and CTR recovery require recrawling, generally days to weeks.

Use a small path cohort, verify with `curl -A "Googlebot"`, and compare venue CTR before widening. Do not use a global cache flush as the deployment mechanism.

---

## Measurement failure on August 23

### 7. The sequence contaminates the pre-committed decision milestone

**Mechanism:** The August 23 evaluation reads the same property and per-URL clicks, impressions, and position. Title changes, redirects, noindex changes, internal links, sitemap resubmission, and cache-rendering failures all affect those metrics. A 28-day window on August 23 substantially overlaps the execution period.

**Trigger:** Any Phase B rollout before the milestone without freezing an explicit cohort and cutoff date.

**Observed result:** The operator attributes gains or losses from this checklist to the earlier SEO change. That can cause the earlier change to be wrongly retained or rolled back. Week-over-week comparison does not separate the interventions, and GSC reporting/indexing lag makes deployment-date slicing insufficient.

**Recovery:** The contaminated observation cannot be reconstructed from aggregate exports after the fact. Per-URL cohorts and deployment dates may allow partial analysis, but the clean pre-committed experiment is permanently lost.

**Required disposition:** Freeze Phase B until after August 23, or amend the milestone before execution with excluded URL cohorts and a fixed pre-change data window.

---

## Safe portions

- Rewriting `TODO.md` is safe.
- A local script that honestly groups available Performance-export rows by path or sitemap segment is safe.
- Reapplying the existing `isThinVenue()` semantics is redundant but safe, provided it does not broaden the population.
- Adding a few relevant internal links from the 52-click blog post is unlikely to cause a production failure.
- Sitemap resubmission is safe only after bot-visible status, canonical, title, and JSON-LD have been verified on a representative sample—not merely the first URL of each sitemap.

The blocking issues are the nonexistent URL-level Coverage data, the bot bypass of `_redirects`, indiscriminate 301 treatment, global KV invalidation, and contamination of the August 23 measurement.````

## Verify các claim repo-specific của GPT-5.6 (do ui-ux-critic chạy)

| Claim | Kết quả | Bằng chứng |
|---|---|---|
| Bot bypass `public/_redirects` | ĐÚNG | `functions/_middleware.ts:118,298-301,339-342,355-356,382-383` — 4 khối comment độc lập ghi nhận |
| `GONE_EXACT` 28 path, ship 30/07 | ĐÚNG | `functions/_middleware.ts:123-145`; `git log` commit 2026-07-30 15:41 +0700 |
| Render budget 8s | ĐÚNG | `functions/_middleware.ts:607` `RENDER_BUDGET_MS = 8000` |
| Cache TTL 6h | ĐÚNG | `functions/_middleware.ts:230` `DEFAULT_TTL_SECONDS = 21600` |
| Playwright chỉ fetch URL ĐẦU TIÊN mỗi sitemap segment | ĐÚNG | `tests/seo.spec.ts:278-286` |
| `isThinVenue()` là field-based, hẹp | ĐÚNG | `functions/_lib/render/venues.ts:62-74` |
