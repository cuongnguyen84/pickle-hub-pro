# PPA Tour rankings trên /rankings

> Slug: `ppa-rankings-tab` · Ngày: `2026-08-06` · Trạng thái: `approved`
>
> **✅ Cuong quyết 2026-08-06:** O1 = giữ `/rankings` mặc định Việt Nam (hiểu rõ lý do title/SEO). **O2 = (c) ROUTE RIÊNG `/rankings/ppa-tour` + `/vi/rankings/ppa-tour`** — bản editorial nhập tay (top-25/board + credit + nofollow + disclaimer), KHÔNG scraper cho tới khi có thư cho phép. O3 = ĐÃ gửi email `legal@ppatour.com`; có thư đồng ý → lưu `external/` → mở lại pipeline tự động (Option A). Trên `/rankings` thêm pill "PPA Tour" trong scope row điều hướng sang route mới (giữ cảm giác tab, không đổi default) + sửa link SSR.
> Sinh bởi `/idea`. Panel 4 agent: `solution-architect` · `ui-ux-critic` (+GPT-5.6-terra) ·
> `risk-auditor` (+GPT-5.6-sol) · `pre-mortem`.
> Model thiếu key trong lần chạy này: `none`
>
> **Raw audit trail** (đọc để kiểm tra bản tổng hợp này có trung thực không):
> `round1/*.md` — output độc lập vòng 1 · `round2/*.json` — đối chất
> `external/*.md` — prompt gửi đi + reply GPT-5.6 · `debate.json` — ledger
>
> ⚠️ **Hai ghi chú quy trình:** (1) `scripts/agents/debate-ledger.mjs` không tồn tại — luật vòng 2 được orchestrator cưỡng chế thủ công, chi tiết trong `debate.json.ledger_note`; mọi CONCEDE đều có bằng chứng nguồn sơ cấp, không có CONCEDE nào bị loại. (2) Phiên `risk-auditor` bị hệ thống gắn cảnh báo bảo mật: risk-brief gửi sang OpenAI API chứa nhiều dữ liệu business nội bộ (doanh thu, số user, SLO, sự cố cũ) hơn mức cần. Anh đọc `external/risk-gpt56-prompt.md` để thấy chính xác cái đã gửi ra ngoài.

---

## 0. 🔶 Cần anh quyết

| # | Vấn đề | Phía A | Phía B | Nếu chọn sai thì sao |
|---|--------|--------|--------|----------------------|
| **O1** | **Ý anh muốn "tab PPA luôn active (mặc định)" — panel 4/4 sau đối chất nói KHÔNG làm bây giờ.** Architect đã nhượng bộ vì ToS; ui-ux giữ blocker; risk giữ RED cho riêng hành động này. | Panel: giữ `/rankings` mặc định Việt Nam. Mở lại khi có (1) văn bản cho phép từ PPA và (2) baseline GSC cho thấy cụm "DUPR Việt Nam" không có impression đáng kể. | Anh override: vẫn đổi default → chấp nhận mất exact-match title cụm "bảng xếp hạng DUPR Việt Nam" (trần 60 byte không chứa nổi 2 thực thể), recovery tính bằng tuần không revert được. | Đổi mà cụm DUPR VN đang có traffic → mất thứ hạng âm thầm 4-8 tuần, không gate nào báo. |
| **O2** | **Hình dạng v1 của dữ liệu PPA** (bảng đầy đủ bị ToS chặn ở mọi hình dạng — đây là chọn giữa các bản *editorial*). | **(a) architect — rẻ nhất, ~1-2 nửa ngày:** nhúng bảng trích top-10 nam/nữ + mục "người gốc Việt trên bảng WPR" vào bài blog `world-pickleball-rankings-wpr-explained` đã ship 05/08 (đang nhắm đúng cụm từ khoá này, đã có SSR/sitemap/hreflang) + 1 link từ `/rankings`. Đo GA4/GSC 2 tuần rồi mới quyết dựng tab. | **(b) risk — AMBER, ~4 nửa ngày:** tab "PPA Tour" KHÔNG mặc định trong `/rankings`, top-25/board nhập tay theo lô; **(c) ui-ux:** route riêng `/rankings/ppa-tour` bản editorial, SSR riêng — SEO landing độc lập nhưng thêm 5 bề mặt phải nuôi và cạnh tranh SERP với chính bài blog WPR. | Chọn (b)/(c) trước khi đo nhu cầu → xây UI cho câu hỏi chưa có câu trả lời; tab (b) vô hình với bot nên không tự sinh số liệu GSC; (c) tự cạnh tranh từ khoá với bài blog. Chọn (a) → nếu nhu cầu lớn thật thì chậm mất ~2 tuần. |
| **O3** | **Gửi email `legal@ppatour.com` xin văn bản cho phép mirror rankings?** (chỉ anh làm được) | Gửi — ToS ghi rõ "commercial use requires a license"; có thư đồng ý → RED tắt, toàn bộ pipeline tự động (worker + bảng + cron, Option A) mở lại nguyên vẹn. | Không gửi — chấp nhận dừng vĩnh viễn ở mức trích dẫn editorial. | Không gửi thì mọi bàn luận về scraper về sau đều vô nghĩa. |

**Việc phải làm TRƯỚC mọi lựa chọn (1 lệnh):** `python3 scripts/seo/gsc_report.py --page-contains /rankings` — lấy baseline 28 ngày. Risk-auditor: "muốn bị bác bằng số, không bằng suy đoán" — nếu `/rankings` gần như 0 impression cho cụm DUPR VN thì phản đối O1 tự sụp.

---

## 1. Ý tưởng gốc

> xem trang https://www.thepicklehub.net/vi/rankings? . Lấy thêm dữ liệu từ trang https://www.ppatour.com/rankings/ - nên tạo thêm 1 tab, tab đó sẽ luôn active. Hỏi lại anh để hiểu rõ ý tưởng

**Làm rõ ở bước 0:**

| Hỏi | Trả lời |
|---|---|
| Tab "luôn active" | = tab mặc định khi mở /rankings và /vi/rankings (thay Việt Nam) |
| Nguồn data | Job scrape MỚI tự động định kỳ (pro-tour-scraper không tái dụng được — nó lấy kết quả trận) |
| Phạm vi | "Lấy hết tất cả" các format, càng sâu càng tốt, phục vụ cả SEO landing |

**⚠️ Hai tiền đề của intake sai so với thực tế, cả 3 agent fetch nguồn độc lập cùng xác nhận:**
1. **ppatour.com/rankings KHÔNG có Men's/Women's × Singles/Doubles/Mixed.** Chỉ có 2 board (Nam 1.324 người / Nữ 751 người), điểm WPR tổng hợp (đôi 50% + đôi nam nữ 35% + đơn 15%, rolling 52 tuần), 3 cột `#`/tên/điểm, có bộ lọc khu vực (Asia). Ma trận format chỉ có ở pickleball.com — nguồn khác, mapping format nằm trong JS bundle chưa giải mã được.
2. **ToS của PPA cấm scrape/mirror thương mại** (chi tiết mục 6). "Lấy hết tất cả" là bất khả về pháp lý cho tới khi có giấy phép.

---

## 2. Verdict — đọc cái này trước

| | |
|---|---|
| **Rủi ro** | 🔴 **RED** cho ý tưởng như đề bài (scrape tự động + đổi default) · 🟡 AMBER cho đường editorial (O2a/O2b) |
| **Khuyến nghị** | **O2a** — nhúng bảng trích top-10 vào bài blog WPR có sẵn + 1 link từ /rankings; song song gửi email xin phép (O3); đo 2 tuần rồi quyết bước sau |
| **Công sức** | O2a: ~1-2 nửa ngày · O2b: ~4 · Full pipeline nếu có phép: ~6.5 |
| **Rủi ro lớn nhất** | Scrape không phép = vi phạm nguyên văn ToS PPA; takedown/IP block không có nút revert, người hứng là anh một mình |
| **Auto-merge** | **Chặn — cần anh duyệt** (RED + 3 câu hỏi mục 0) |

🔴 RED nghĩa là: **không revert được bằng `git revert`.** Ở đây: thư takedown, dữ liệu đã bị Google index, thứ hạng cụm "DUPR Việt Nam" mất hàng tuần mới đòi lại được.

---

## 3. Đã có sẵn gì (recon)

**Prior art:** chưa có gì về PPA rankings — `/rankings` thuần DUPR (snapshot tĩnh `src/content/dupr-rankings.ts` + RPC `dupr_leaderboard_vietnam` cho scope Việt Nam mặc định). **NHƯNG** (phát hiện ở vòng 2): bài blog `world-pickleball-rankings-wpr-explained` vừa ship 05/08 (`712bf549`) — EN+VI, nhắm đúng cụm "ppa tour rankings"/"world pickleball ranking", đã có đủ SSR/sitemap/hreflang. Đây là SEO landing có sẵn cho chủ đề này; dữ liệu top-10 trong bài hiện chỉ nằm ở ALT ảnh hero — bot không đọc được.

**Sẽ đụng vào (tuỳ option):** `src/pages/Rankings.tsx` · `src/content/blog/posts/world-pickleball-rankings-wpr-explained.ts` + `metadata.ts` + barrel · `functions/_lib/render/rankings.ts` (chỉ nếu O2c) · Supabase `vi_blog_posts` (bản VI).

**Ràng buộc đã ghi trong repo:** KV cache key **`pr:v33`** pathname-only (CLAUDE.md ghi v32 — **doc drift**, bump tiếp theo là v34); query string không bao giờ tới tầng render (`_middleware.ts:712`) → nội dung sau `?scope=` vô hình với bot theo cấu tạo; `/rankings` + `/vi/rankings` đã trong sitemap-static priority 0.9; worker deploy ngoài repo; native `/apple` chỉ có scope vietnam (deferred có chủ đích).

---

## 4. Phương án (solution-architect)

### Option A — Pipeline tự động đầy đủ *(BỊ CHẶN bởi ToS — chỉ mở lại khi có giấy phép)*

Effort 6.5 nửa ngày · worker `ppa-rankings-scraper` mới (fetch thường là đủ — data nằm inline trong HTML Next.js, KHÔNG cần Browser Rendering) + bảng `pro_tour_rankings` (tên có cột `source`, đừng khoá vào brand) + cron 1 lần/ngày + `ops_job_registry`. Nếu có phép, thứ tự bắt buộc: migration → worker → quan sát 1 cron thành công → mới đụng UI. Điều kiện kèm: guard 0-dòng fail-loud, swap nguyên tử giữ last-good, `fetched_at` hiển thị trên UI ("lấy về lúc" — payload nguồn không có trường last-updated), GRANT theo template + verify bằng anon key thật.

### Option B — Editorial trong bài blog WPR có sẵn *(= O2a, khuyến nghị)*

Effort 1-2 nửa ngày · Files: bài WPR post + `metadata.ts` + `gen-blog-barrel.mjs` + UPDATE `vi_blog_posts` + 1 link text từ `Rankings.tsx` · Data: none.

Nhúng bảng HTML trích top-10 nam + top-10 nữ + mục "Người gốc Việt trên bảng WPR" (nam: Jonathan Truong #21, Hong Kit Wong #20, HT Hien Truong #38, Luc Pham #42; nữ: Chao Yi Wang #12, Alix Truong #14) + credit "Nguồn: PPA Tour công bố tại ppatour.com/rankings" + link `rel="nofollow"` + disclaimer không phải kênh chính thức. Số format locale VI (`12.212,5`). Cập nhật = sửa bài có ngày tháng — bảng cũ trong bài blog là bình thường, bảng cũ trong /rankings trông như sản phẩm hỏng (bài học `DUPR_LAST_UPDATED` trôi 17 ngày).

Được: đo được nhu cầu thật (GSC impression của bài + GA4 click link) trước khi xây bất kỳ UI nào; 0 bề mặt ops mới; trích dẫn ngắn có credit là mức phơi nhiễm pháp lý thấp nhất. Mất: không có "tab" như anh hình dung — chậm ~2 tuần nếu nhu cầu lớn thật. Đóng cửa: không gì — mọi option sau đều mở.

### Option C — Tab không mặc định (O2b) hoặc route riêng (O2c), dữ liệu nhập tay

O2b: scope "PPA Tour" cạnh Việt Nam trong /rankings, top-25/board, 2 pill Nam/Nữ (ẩn format tabs — `getAvailableFormats()` đã hỗ trợ). Vô hình với bot (query param) → không có giá trị SEO, chỉ đo được bằng GA4. O2c: route `/rankings/ppa-tour` + `/vi/` — 1 dòng dispatch + 2 entry sitemap + `renderPpaRankings`; SEO landing độc lập nhưng cạnh tranh SERP với bài blog WPR và thêm 5 bề mặt nuôi (SSR/sitemap/hreflang/App.tsx/parity native).

### Khuyến nghị

**B (O2a), song song gửi email O3.** A bị ToS chặn — không phải hoãn mà là chặn, mở lại bằng giấy phép. C xây UI/route cho nhu cầu chưa đo; riêng C-route còn tự cạnh tranh từ khoá với bài blog 1 ngày tuổi. B trả lời câu hỏi duy nhất đang cần trả lời (*người Việt có tìm bảng PPA không?*) với chi phí thấp nhất và không đóng cửa nào. **ui-ux-critic vẫn HOLD cho O2c — bất đồng sống, anh quyết ở mục 0.**

### Increments (theo B)

1. Bảng trích + mục gốc Việt vào bài WPR (EN+VI cùng lúc, đủ 4 bước checklist blog + barrel) — verify: `curl -A Googlebot "…/blog/world-pickleball-rankings-wpr-explained?nocache=1"` đếm được ≥20 tên VĐV trong body, và bản VI tương tự.
2. Link text từ `/rankings` (cả hai ngôn ngữ): "→ Xem bảng xếp hạng pro thế giới (PPA Tour WPR)" — verify: e2e smoke + link có trong body SSR /rankings.
3. Sửa 2 nit copy có sẵn tiện tay: `labelVi "Mở rộng"` → `"Hạng mở"` (dupr-rankings.ts:4330), header cột bảng VN → "Người chơi".
4. **ĐIỂM DỪNG-VÀ-NHÌN 2 tuần:** GSC impression bài WPR + GA4 (segment Vietnam) click link từ /rankings → quyết O2b/O2c/không gì cả.

---

## 5. UI/UX (ui-ux-critic + GPT-5.6)

### Đánh giá tổng thể

"Thêm bảng PPA" tốt; "làm tab mặc định" tự phá hoại: bảng VN 12 người sống nhờ CTA "Kết nối DUPR để có tên trong bảng này" nằm trong nhánh `isVietnamScope` — default PPA giấu nó khỏi khách lần đầu. *(Vòng 2 có đính chính hai chiều: ui-ux tự thu hẹp "phễu duy nhất" → "phễu ngữ cảnh duy nhất trên đường deep-link"; architect chứng minh — orchestrator đã verify — CTA này là cửa /dupr thứ 4 và ẩn với khách chưa đăng nhập (`HeaderDuprBadge.tsx:35`, `/dupr` RequireAuth). Kết luận giữ default không đổi, nhưng đừng dùng lập luận phễu nguyên bản để đầu tư đường "12→200 người".)*

Task courtside 60 giây của user VN là xem hạng mình/bạn; PPA là task tra cứu/giải trí — hai ý định, không phải hai tab của một câu hỏi. Bảng PPA không có exit nội bộ (bảng VN link `/nguoi-choi/`).

### Vấn đề chính (đầy đủ 18 mục trong `round1/ui-ux-critic.md`)

| # | Mức | Vấn đề | Sửa |
|---|-----|--------|-----|
| 1 | Blocker | Default PPA gỡ phễu DUPR ngữ cảnh | Giữ fallback `vietnam` |
| 2 | Blocker | Tab qua query param không bao giờ là SEO landing (cache key + render pathname-only) | Landing = bài blog (O2a) hoặc route riêng (O2c) |
| 3 | Blocker | SERP đã index title "DUPR Việt Nam" — click vào thấy Ben Johns | Không đổi nghĩa /rankings |
| 5 | Blocker | Thiết kế 6 format cho dữ liệu không tồn tại | 2 board Nam/Nữ + bộ lọc khu vực (Asia có sẵn ở nguồn) |
| 9-13 | Nên sửa | Số locale VI `12.212,5` · skeleton thay spinner (CLS p75 ~0.67) · top 50 + "Tải thêm" · error → nút Thử lại (Capacitor không có reload) · SWR offline | Nếu làm O2b/O2c |
| 15-16 | Nit | `"Mở rộng"` → `"Hạng mở"`; cột VN → "Người chơi" | Tiện tay sửa ngay (increment 3) |

A11y nếu dựng bảng/tab mới: `aria-pressed` cho pill (lỗi 4.1.2 đang tồn tại), `:focus-visible` cho `.tl-rank-scope` (2.4.7 FAIL đang tồn tại), min-height 44px, `<caption>` sr-only, skip link, `aria-live` khi tải thêm. Copy VI/EN đầy đủ trong `round1/ui-ux-critic.md`.

### Panel đa model

- **Đồng thuận Claude + GPT-5.6 (2 vendor độc lập):** không ship như đề bài; PPA không làm default; nội dung sau query param không làm landing được; 2 board 3 cột top-50; số locale VI.
- **Bất đồng đã xử:** semantics bộ chọn (GPT muốn radio/fieldset — chọn Claude: `aria-pressed` đủ AA, ít nợ pattern hơn); bookmark vỡ (GPT nói vỡ — Claude chứng minh `useUrlBackedState` mirror param vào URL, cái vỡ thật là 3 đường paramless).
- **GPT-5.6 bắt được mà Claude sót:** yêu cầu kiểm ToS trước khi ship scraper (thành finding trung tâm của cả proposal), và PostgREST `db.max_rows` cắt 1000 dòng.

---

## 6. Rủi ro (risk-auditor + GPT-5.6 + pre-mortem)

### Verdict: 🔴 RED (phạm vi đã thu hẹp ở vòng 2)

Classifier đường dẫn nói: RED cho `workers/` + `migrations/` (đã chạy lại `risk-tier.mjs` xác nhận); bộ file O2a (blog + Rankings.tsx) = **AMBER**. Auditor giữ RED cho 2 hành động: (1) scrape/mirror tự động không giấy phép, (2) đổi default + đổi title `/rankings`.

| # | Mức | Cơ chế hỏng | User thấy gì | Giảm thiểu |
|---|-----|-------------|--------------|------------|
| 1 | Cao | **ToS PPA nguyên văn cấm** "scrape, mirror, or rebroadcast our content commercially without written permission"; "commercial use requires a license" (fetch 2×, 2 agent độc lập, Last updated 22/05/2026). robots.txt `Allow: /` là vắng mặt lệnh chặn crawl, không phải giấy phép — file đó có 4 dòng Disallow chủ đích nên không phải file bỏ hoang. | Không thấy gì cho tới ngày bị chặn IP/takedown. | Chặn scrape đến khi có văn bản. Editorial top-10 + credit + nofollow là mức phơi nhiễm thấp nhất; mức "bao nhiêu là an toàn" là quyết định của anh, không phải của AI. |
| 2 | Cao | Đổi title `/rankings`: trần 60 UTF-8 byte không chứa nổi 2 thực thể (đo: 65 byte) — mất exact-match cụm "bảng xếp hạng DUPR Việt Nam"; recovery crawl-rate-bound. | Không ai thấy trong 4-8 tuần; mọi gate xanh (seo.spec chỉ regex title, human-path không có /rankings). | Baseline GSC trước (1 lệnh, `--page-contains` có sẵn); nếu đổi thì thêm assert body chứa ≥20 `/nguoi-choi/` vào seo.spec + fail-loud khi khối VN rỗng (3 ràng buộc của pre-mortem, <20 dòng code). |
| 3 | Cao | (nếu có pipeline) GRANT thiếu — bug tái phát 3 lần; SSR dùng service_role nên nhánh bot mù với lỗi grant về mặt cấu tạo; Cuong đăng nhập admin cũng không thấy. | Tab lỗi cho 100% khách vãng lai, mọi công cụ đo báo khoẻ. | Verify bằng anon key thật (lệnh trong `round1/risk-auditor.md`), thêm `has_function_privilege` vào rls_auth_matrix. |
| 4 | Cao | (nếu có pipeline) Scrape gãy câm — endpoint Next.js nội bộ không hợp đồng; upsert không tombstone trộn 2 tuần dữ liệu (Ben Johns hạng 1 và 7 cùng lúc), user VN không đủ điều kiện phát hiện. | Bảng sai hiển thị như thật, có thể vĩnh viễn. | Guard 0-dòng + ngưỡng "ít hơn lần trước 10%" + swap nguyên tử last-good + `fetched_at` trên UI + cron lệch pha với pro-tour-scraper (nếu dùng Browser Rendering — quota theo account). |
| 5 | TB | PostgREST `db.max_rows` 1000 cắt "càng sâu càng tốt" (2.075 dòng) — có thể ra 1000 nam, 0 nữ. | — | Phân trang `Range`/RPC jsonb. Chưa verify — trong checklist. |
| 6 | TB | Job mới không tự vào `ops_job_registry` → SLO 5 xanh trong khi job chết. | — | INSERT registry + `ops_record_job_run` = điều kiện merge. |

**Cảnh báo tồn kho từ vòng 2 (ngoài phạm vi proposal này):** `workers/pro-tour-scraper` hiện có đang ăn dữ liệu giải PPA/MLP — ToS liệt "brackets data" là tài sản, robots.txt Disallow `/brackets/` → nhiều khả năng là phơi nhiễm pháp lý **cùng loại đang tồn tại**. Đáng một lần rà soát riêng.

### SLO bị đe doạ
SLO 5 (điểm mù đăng ký job), SLO 6 (CLS p75 mobile đã ~0.67/0.1 — cấm thêm nguồn shift mới trên trang mặc định), SLO 1 gián tiếp (42501 đổ client_errors vượt ngưỡng P1 ≥25/60'). Không chạm SLO 2/3/4/7.

### Perf
- O2a: +~1-2 KB gz vào chunk CONTENT của đúng bài blog. Không đụng INITIAL.
- Số thật 05/08: INITIAL 225.2/280 · CODE 1512.0/1800 · **Total 1888.4/1970 — còn 81.6 KB**. Phương án static-file 2.075 dòng (+43.9 KB gz = 54% headroom) bị bác. `docs/perf-budgets.md` baseline 1822 KB đã cũ 66 KB — nên sửa.
- Không render headshot ở mọi phương án v1 (CLS); chỉ cờ text/emoji từ countryCode.

### SEO
- O2a: route SSR bị đụng = bài blog (renderBlog đã có). **Không bump KV** cho bài blog (dùng `?nocache=1` từng URL). Nếu sau này đụng `renderRankings` → bump **`pr:v33`→`pr:v34`** (CLAUDE.md đang ghi v32 — sửa doc cùng lúc).
- Verify: `curl -A "Googlebot"` cả EN + VI với `?nocache=1`, đếm tên VĐV trong body (không chỉ tags — bài học 05/08), hreflang đủ 3.

### Rollback
- O2a: `git revert` + `?nocache=1` 2 URL → ~10 phút, sạch.
- Pipeline (nếu mở lại): migration cần khối DROP viết sẵn TRƯỚC khi apply; worker gỡ tay từ máy anh; **không revert được:** takedown, dữ liệu đã index, thứ hạng cụm DUPR VN — đây là 3 lý do RED.

### Phản biện độc lập (GPT-5.6)
- Đã xác minh trong repo: KV pathname-only + cơ chế ghi đè cache entry; SSR rankings là nguồn link `/nguoi-choi/` duy nhất; monitoring opt-in; GRANT-trước-RLS; db.max_rows (finding GPT, Claude sót).
- Bác bỏ: "đổi default → empty state vì format không tồn tại" (sai cơ chế — `getAvailableFormats` xử được; vấn đề thật là intake sai so với nguồn); "GitHub Actions minutes" (không liên quan — Cloudflare cron).

---

## 7. Tranh luận trong panel

> `debate-ledger.mjs` không tồn tại trong repo — orchestrator cưỡng chế luật thủ công (ghi trong `debate.json.ledger_note`). Bảng dưới là ledger tay từ `round2/*.json`.

| ID | Chủ đề | Kết quả vòng 2 | Trạng thái |
|----|--------|----------------|------------|
| D1 | Đổi default sang PPA? | architect **CONCEDE** (tự fetch ToS — bằng chứng nguồn sơ cấp, hợp lệ) · ui-ux **HOLD** (bằng chứng mới: superset là bot-only, `_middleware.ts:518-528`) · risk **REFINE** (bỏ finding internal-link, giữ RED riêng cho đổi default+title, gate = baseline GSC) | **RESOLVED: không đổi bây giờ** — nhưng vì đây là yêu cầu gốc của anh → **O1** |
| D2 | Tab / route riêng / blog? | architect **REFINE** (bỏ superset; đề xuất mới: bài blog WPR có sẵn làm landing) · ui-ux **HOLD** (route riêng; chưa kịp phản hồi đề xuất blog) · pre-mortem **REFINE** (bỏ mệnh đề "không còn URL cho bot"; 3 ràng buộc nếu đi cùng pathname) | **OPEN_FOR_CUONG → O2** |
| D3 | Pháp lý scrape: AMBER hay RED? | architect **CONCEDE** (tự fetch ToS, xác nhận nguyên văn — không tin lời agent kia, đúng luật) · risk **HOLD** (robots ≠ giấy phép; thu hẹp đường mở khoá = 1 email) | **RESOLVED: RED đứng, mở khoá = O3** |

### Bất đồng bị giết ở vòng 2 (ảo — thiếu thông tin)
- D3 và một nửa D1: chết vì **một lần fetch ToS**. Vòng 1 architect chỉ kiểm robots.txt. Bài học: kiểm giấy phép nguồn là việc của recon, không phải của vòng 2.
- Mệnh đề "SEO amputation" của pre-mortem: chết vì mở lại `rankings.ts:105-121` thấy superset khả thi — pre-mortem tự CONCEDE phần này với file:line, giữ phần title (được risk xác nhận độc lập bằng phép đo 65>60 byte).

### Bất đồng sống sót (thật — cùng dữ kiện, khác đánh giá)
- **O2**: blog-landing (architect) vs route riêng (ui-ux). Cả hai đúng dữ kiện; khác nhau ở định giá "5 bề mặt phải nuôi" vs "landing chuyên biệt". Cái chứng minh phía nào đúng: số GSC/GA4 sau 2 tuần của increment O2a.
- **N1** (mới, chưa đối chất hết vòng): lập luận phễu của ui-ux — architect chứng minh CTA là cửa thứ 4 và ẩn với khách vãng lai; orchestrator đã verify 3 dữ kiện (TheLineLayout:691, HeaderDuprBadge:35, App.tsx:635). Không đổi kết luận D1.

### Nhượng bộ bị LOẠI
Không có. Cả 2 CONCEDE (architect D1, D3) đều kèm bằng chứng nguồn sơ cấp tự fetch.

### Ghi chú đồng thuận
Sự đồng thuận có nghĩa duy nhất trong panel này: **GPT-5.6 (vendor khác) + Claude độc lập cùng kết luận** ở 3 điểm — không ship như đề bài, query-param không làm landing, cần kiểm ToS. Risk-auditor + pre-mortem gật nhau nhiều chỗ nhưng đó là 2 Claude cùng nhiệm vụ — và thực tế vòng 2 risk đã **bác** một phần câu chuyện của pre-mortem, đúng như kỳ vọng.

---

## 8. Kế hoạch verify (cho O2a nếu anh duyệt)

**Tự động:**
- [ ] `npx eslint <changed>` · `npx tsc -b --noEmit` · `npm run test` (blog-barrel test sẽ bắt nếu quên barrel)
- [ ] `node scripts/gen-blog-barrel.mjs` chạy lại sau khi sửa bài
- [ ] `npm run build` + `check-bundle-size.mjs` (Total < 1970)
- [ ] `npm run e2e:smoke`
- [ ] Post-deploy: `curl -A "Googlebot"` bài WPR EN + VI với `?nocache=1` — đếm ≥20 tên VĐV trong body; `/rankings` có link mới trong body SSR

**Cuong phải tự làm:**
- [ ] **O1/O2/O3 ở mục 0** — quyết trước khi /ship
- [ ] `python3 scripts/seo/gsc_report.py --page-contains /rankings` — baseline trước mọi thay đổi
- [ ] (O3) Gửi email `legal@ppatour.com` xin phép mirror; có thư → lưu `external/`
- [ ] UPDATE bản VI trong `vi_blog_posts` (nếu agent không có đường ghi)
- [ ] GSC Request Indexing 2 URL bài WPR sau deploy

---

## 9. Sau khi ship

- SHA: · PR: · Ngày:
- Khác kế hoạch:
- Học được (→ memory): CLAUDE.md drift `pr:v32`→thực tế `v33`; `tests/seo.spec.ts` comment stale về hreflang /rankings; đề xuất hệ thống từ pre-mortem: gate SEO nào cũng chạy service_role — cần 1 curl anon trong checklist post-deploy; rà soát pháp lý `pro-tour-scraper` hiện có.
