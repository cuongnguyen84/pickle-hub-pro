# risk-auditor — VÒNG 1 (nguyên văn, 02/08/2026)

## Verdict — 2 tier riêng

## Verdict (gói A: docs + tooling): 🟢 GREEN
Sửa `TODO.md` + một script local đọc CSV không chạm bất kỳ surface production nào; xấu nhất là script in ra một bảng phân loại **sai** rồi Cuong hành động theo nó — nên rủi ro thật nằm ở gói B.

## Verdict (gói B: thi hành checklist): 🔴 RED
`noindex` hoặc 301 nhầm trên cụm `/san` xoá **53,4% lượng click organic của toàn site (625/1170)** và `git revert` không lấy lại được — phục hồi phải chờ Googlebot recrawl 1688 URL, tính bằng tuần.

Classifier said: **không chạy được** — `scripts/agents/risk-tier.mjs` không tồn tại (`ls scripts/agents` → No such file or directory; đúng như memory `idea-pipeline-missing-scripts.md`). Em tự gán tier, không có floor máy móc để đối chiếu.

---

## Rủi ro cụ thể

| # | Mức | Cơ chế hỏng | Người dùng thấy gì | Giảm thiểu |
|---|-----|-------------|--------------------|------------|
| 1 | **Cao** | "noindex thin pages" mở rộng tiêu chí sang "0 click". Đo thật từ `Trang.csv` 01/08: 462 URL `/san/<slug>` có 0 click **nhưng 19.611 impression**. `isThinVenue()` (`functions/_lib/render/venues.ts:60-72`) đã loại 691×2 stub rồi; `sitemap-venues.xml` còn đúng **1688 loc ≈ 844 sân × 2 ngôn ngữ**, và 760 trong số đó đã xuất hiện trong GSC với impression → **không còn dư địa "thin" nào cả**. Bất kỳ vòng noindex thứ hai nào cũng ăn vào trang đang có impression | Impression `/san` tụt dần trong 2-4 tuần; Cuong chỉ thấy biểu đồ GSC đi xuống sau khi đã quên mình làm gì | Cấm dùng click/impression làm tiêu chí noindex. Ghi thẳng vào checklist: mục "noindex thin" **ĐÃ SHIP** qua `isThinVenue()`, chỉ được đổi nếu sửa định nghĩa dữ liệu (address/geo/courts/phone), kèm `SELECT count(*)` trước-sau |
| 2 | **Cao** | 301 cho 61 URL 404 đặt vào `public/_redirects` → **Googlebot không bao giờ thấy**. `functions/_middleware.ts:519-540` chỉ gọi `next()` cho non-bot; nhánh bot trả Response thẳng, không qua static-asset stage. Comment ở dòng 117 nói đúng câu này: *"Bots bypass public/_redirects"* | Người vào bằng browser thấy redirect chạy → tưởng xong. GSC vẫn báo 404 tháng này qua tháng khác, link equity bằng 0 | Mọi 301 cho SEO phải mirror vào map trong `_middleware.ts` (tiền lệ `BLOG_MERGED`/`VI_BLOG_REDIRECTS`/`VI_BLOG_DIRECT`, dòng 365-455). Verify bằng `curl -I -A "Googlebot"`, không bằng browser |
| 3 | **Cao** | 3 map redirect đó chạy ở dòng 432-452, **trước** check `isGoneUrl()` (dòng 547). Thêm một path đang nằm trong `GONE_EXACT` (28 path + regex `mlp-mlp-dallas-2026-\d{3}`) vào map redirect sẽ **âm thầm huỷ 410 cố ý ship 30/07** | URL rác test-fixture (`/nguoi-choi/*-test`, `/clb/test-3`) sống lại dưới dạng 301 → Google đưa lại vào crawl queue | Trước khi viết 301 nào: `grep` path đó trong `GONE_EXACT`. Path đã 410 thì **giữ 410**, không đổi |
| 4 | **Cao** | Export Coverage 01/08 chỉ có **số đếm**, không có URL nào (4 file CSV: `Vấn đề nghiêm trọng.csv` = 9 dòng nguyên nhân/số). Không có credential GSC nào trên máy — `.claude/secrets.local.gsc-ga4-sa.json` **không tồn tại**, nên `scripts/seo/gsc_report.py` hiện cũng không chạy được. Script "phân loại URL từ export local" không có nguồn để phân loại | Script chạy xanh, in ra danh sách bịa (join nhầm từ `Trang.csv`), Cuong noindex/301 nhầm nhóm | Script **phải** báo rõ 3 cột độc lập: `URL trong Trang.csv` / `HTTP thật khi curl Googlebot hôm nay` / `có trong sitemap segment nào`. **Cấm** in nhãn "404"/"discovered"/"crawled-not-indexed" khi không có nguồn per-URL. Muốn nhãn thật: export từng issue từ GSC UI, hoặc cấp service account (URL Inspection API, quota 2000/ngày) |
| 5 | **TB** | Cột `Xác thực` trong `Vấn đề nghiêm trọng.csv` = **"Đã bắt đầu"** cho cả 3 nhóm (61 404, 138 discovered, 42 crawled). Đang có validation chạy dở. Đổi response của chính những URL đó giữa chừng → GSC có thể báo Validation failed và reset đồng hồ | Cuong mở GSC thấy "Xác thực không thành công", phải bấm lại, mất thêm 28 ngày | Chờ validation ra kết quả trước khi động vào nhóm 404, hoặc chấp nhận restart có chủ đích và ghi lý do |
| 6 | **TB** | Giả định trong `00-intake.md` mục 3 ("sửa title venue **phải** bump `pr:v32`") **sai hướng và nguy hiểm hơn không làm gì**: `DEFAULT_TTL_SECONDS = 21600` (6h) — cache tự hết hạn. Bump v32→v33 làm **toàn bộ 11 segment sitemap** miss cùng lúc; mỗi miss chạy chuỗi query Supabase Tokyo trong `RENDER_BUDGET_MS = 8000`, quá hạn thì `catch` → `return next()` = **trả SPA shell rỗng cho Googlebot** (dòng 605-706) | Trang bị bắt đúng lúc đó có thể rơi vào "Crawled – currently not indexed"; người dùng thật không thấy gì bất thường | **Không bump** cho thay đổi title venue — để TTL 6h tự cuốn. Cần gấp thì `?nocache=1` từng path theo lô nhỏ (giá trị phải đúng `"1"`). Sau bất kỳ đợt invalidate nào, theo dõi Telegram fingerprint `prerender: prerender-timeout` (cron `errors-telegram-alert` `*/10 * * * *`, `docs/cron-schedules.md:40`) |
| 7 | **TB** | `idea-recon.md` khẳng định slug `/vi/blog/singapore-open-2026` **không tồn tại**. Em curl thật: **HTTP 200**, `X-Prerender-Cache: HIT`, canonical trỏ về chính nó, title `Singapore Open 2026 | Lịch đấu & cách xem`. Đây đúng là trang 52 click. Ngược lại `/vi/blog/singapore-open-2026-recap` → **301**, `/blog/singapore-open-2026` → **404** | Nếu architect "sửa" checklist theo recon và trỏ internal link VI sang `-recap`, mọi link VI mới đi qua một hop 301 thừa (hoặc 404 nếu ai đó bỏ `/vi/`) | Bác bỏ premise này khỏi checklist. Slug VI đúng là `singapore-open-2026`; slug EN đúng là `singapore-open-2026-recap` (`src/content/blog/metadata.ts:13`) |
| 8 | **Thấp** | `tests/seo.spec.ts:286` chỉ fetch **`<loc>` đầu tiên** của mỗi segment. Đổi template title venue mà hỏng theo dữ liệu (sân thiếu city, tên dài bị cắt byte — đã thấy sống: `Baca Pickleballs Nguyễn Chánh – Hà Nội |…`) thì 1687 URL còn lại không ai kiểm | CI xanh, snippet Google xấu/cụt trên hàng trăm trang | Đổi title venue thì thêm sample cố định ≥6 URL (2 ngôn ngữ × sân đủ data / thiếu city / tên dài) vào `SSR_ROUTES`, không dựa vào test first-loc |
| 9 | **Thấp** | Nếu script "verify" quét toàn bộ inventory bằng curl Googlebot: 1688 URL sitemap venue, mỗi miss = một chuỗi query Supabase + một KV `put`. Một đợt warm 1688 path trong một phiên là 1688 KV write | Không có triệu chứng người dùng (nhánh bot tách hẳn nhánh SPA), nhưng nếu chạm trần KV write thì `put` fail → mọi bot request thành cold render | Script chạy tuần tự, có `--limit` mặc định nhỏ (≤50) và delay; không có chế độ "quét hết" mặc định |

---

## SLO bị đe doạ
- **SLO 1 (Web availability)**: không đe doạ. Nhánh bot trong `_middleware.ts` tách hoàn toàn khỏi nhánh `next()` của người dùng; kể cả prerender timeout thì user vẫn nhận SPA bình thường.
- **SLO 6 (Latency VN p75)**: không đe doạ — 0 KB vào bundle, không render mới trên `/feed`.
- Không SLO nào trong 7 SLO bao phủ **organic search**. Đó chính là vấn đề: thiệt hại lớn nhất của gói B (mất 53% click) **không vi phạm SLO nào**, không có error budget nào cháy, không có alert nào kêu. Nếu panel duyệt gói B, phải kèm một chỉ số theo dõi thủ công (`/san` clicks tuần) chứ không được coi "không SLO nào đỏ" là an toàn.

## Ngân sách hiệu năng
- Bundle: **+0 KB** → ~1822 / 1970 KB gz, không đổi. `TODO.md` là docs; script nằm ngoài `src/` nên không vào INITIAL/CODE/CONTENT (`scripts/check-bundle-size.mjs` không thấy nó).
- Vietnam p75 impact: **không có**. Không route mới, không waterfall mới, không component mới.

## SEO
- Routes SSR bị ảnh hưởng (gói A: **none**; gói B):
  - `/san/<slug>` + `/vi/san/<slug>` — 1688 URL trong sitemap, 760 URL có traffic (title change, noindex)
  - `/san/khu-vuc/<city>` + VI — 60 URL, 32 click
  - `/vi/blog/singapore-open-2026` — 52 click (internal link expansion)
  - 61 URL 404 nằm rải rác, chưa xác định được là route nào vì export không có URL
- Cần bump `pr:v32`? **Không** — và đây là điểm em phản đối intake. TTL mặc định 6h (`DEFAULT_TTL_SECONDS = 21600`) tự cuốn cache title mới; bump là flush toàn site và mở cửa cho fallback SPA-shell ở dòng 706. Dùng `?nocache=1` theo lô nếu cần gấp.
- Verify: `curl -A "Googlebot" https://www.thepicklehub.net/vi/san/san-pickleball-flc-sam-son` → expect 200 + title mới + og:image + hreflang en/vi/x-default, và **không** có `<meta name="robots" content="noindex`.

## Kế hoạch rollback
- **Gói A**: `git revert` + push. Khôi phục ~5 phút. Đủ.
- **Gói B — cơ chế**: `git revert` + Cloudflare Pages redeploy khôi phục *code* trong ~5 phút (Functions ship cùng deployment, `docs/ops-runbook.md` §4.2), cache bot tự đúng lại trong ≤6h.
- **Thời gian khôi phục thật**: **2-6 tuần** — vì thứ hỏng không phải code mà là *chỉ mục của Google*. Gỡ `noindex` xong vẫn phải chờ recrawl 1688 URL; click mất trong khoảng đó không lấy lại được.
- **Không revert được**:
  - Trang đã bị Google drop khỏi index sau một đợt `noindex` nhầm — chỉ recrawl mới cứu.
  - Signal 301 đã được Google tiêu hoá (đặc biệt nếu 301 về trang không liên quan → soft-404, tệ hơn 404 gốc).
  - Trạng thái validation trong GSC nếu bị reset.
  - Baseline GSC 01/08: khi đã can thiệp thì không dựng lại được counterfactual.
  → **Đây là lý do gói B là RED**, bất kể diff nhỏ đến đâu.

## Phải verify trước khi merge
- [ ] Script chạy trên đúng bộ CSV Cuong có và **tự báo "không xác định được coverage bucket"** thay vì đoán: `python3 scripts/seo/<new>.py --in ~/Downloads/https___www.thepicklehub.net_-Coverage-2026-08-01/`
- [ ] `grep -n "GONE_EXACT" -A 30 functions/_middleware.ts` — mọi 301 đề xuất không đụng 28 path đang 410
- [ ] Checklist mới ghi rõ: 301 SEO phải vào `_middleware.ts`, `public/_redirects` là cho người dùng
- [ ] Checklist mới ghi rõ: **không bump `pr:v32`** cho thay đổi title; TTL 6h tự xử lý
- [ ] Checklist mới xoá mục "noindex thin pages" hoặc đánh dấu ĐÃ SHIP (`isThinVenue()`), và cấm tiêu chí "0 click"
- [ ] Checklist mới dùng slug đúng: VI = `/vi/blog/singapore-open-2026` (200), EN = `/blog/singapore-open-2026-recap` (200). Verify: `curl -sSo /dev/null -w '%{http_code}' -A "Googlebot" https://www.thepicklehub.net/vi/blog/singapore-open-2026` → `200`
- [ ] Mốc `SEO-CLUSTER-READ` 23/08 (`docs/milestones.md:17`): checklist ghi **freeze có phạm vi** — không đụng `/tools`, `/vi/tools`, cụm blog bracket và các 301 của chúng cho tới sau 23/08. Việc trên `/san` **không** làm nhiễu mốc này (mốc chỉ đo 2 query bracket/round-robin breakdown theo trang)

---

## Phản biện độc lập (GPT-5.6)
Model trả về: `gpt-5.6-sol`. Transcript nguyên văn: `docs/proposals/seo-followup-checklist-v2/external/risk-auditor-gpt56.md`.
Lưu ý quy trình: `scripts/agents/ask-model.mjs` **không tồn tại** trong repo — gọi thẳng `POST /v1/responses` bằng `curl` với `OPENAI_API_KEY` sẵn có. Panel **không** thiếu model, nhưng **thiếu 2 script** (`ask-model.mjs`, `risk-tier.mjs`).

**Đã xác minh trong repo (giữ lại):**
- Bot bypass `public/_redirects` → 301 chỉ trong file đó là no-op với Googlebot. Xác minh: `_middleware.ts:528-540` (chỉ non-bot mới `next()`), comment dòng 117, và 3 map mirror ở dòng 365-455.
- Coverage export không có URL nào → script không thể gán bucket. Xác minh: `Vấn đề nghiêm trọng.csv` chỉ 9 dòng `Nguyên nhân,Nguồn,Xác thực,Trang`.
- `isThinVenue()` đã ship cả noindex lẫn drop-sitemap → làm lại là no-op; mở rộng bằng tiêu chí GSC là thảm hoạ. Xác minh code + số: 625/1170 click, 462 URL 0-click/19.611 impression.
- Bump `pr:v33` → mass cache miss → timeout 8s → SPA shell cho bot. Xác minh: `RENDER_BUDGET_MS = 8000` và `catch { … return next(); }` dòng 605-706.
- `tests/seo.spec.ts` chỉ kiểm `<loc>` đầu mỗi segment → không bảo vệ 1687 URL còn lại. Xác minh dòng 286-330.
- 301 hàng loạt về trang không tương đương → soft-404. Không có bằng chứng trong repo (hành vi Google), nhưng cơ chế đúng và hậu quả cụ thể → giữ.

**Bác bỏ:**
- *"`GONE_EXACT` 410 sẽ thắng redirect mới"* — **sai chiều**. `isGoneUrl()` ở dòng 547, **sau** các map redirect ở dòng 432-452. Rủi ro thật là ngược lại: redirect mới **âm thầm đè** 410 cố ý. Giữ rủi ro nhưng viết đúng cơ chế (bảng, #3).
- *"render-budget blowout im lặng, de-index hàng tuần không ai biết"* — **sai**. Khối `catch` insert `client_errors` với prefix `prerender:`, và `errors-telegram-alert` chạy `*/10 * * * *` qua pg_cron (`docs/cron-schedules.md:40`), spike ≥3 cùng fingerprint là báo. Phát hiện có, ~10-20 phút. Hạ mức #6 xuống TB nhờ điểm này.
- *"Freeze MỌI việc ảnh hưởng index tới 23/08"* — **quá rộng**. `docs/milestones.md:17` chỉ đo 2 query breakdown theo TRANG, baseline `/tools`. Việc trên `/san` không nhiễu mốc. Freeze phải có phạm vi.
- *`curl -I -A "Googlebot" https://thepicklehub.com/old-path`* — **sai domain**. Site là `.net`, canonical host `www.thepicklehub.net`.
- *"Phase A hoàn toàn an toàn"* — đúng về production, nhưng GPT không thấy `idea-recon.md` đang mang premise sai về slug (#7). Docs viết sai vẫn là docs sẽ được thi hành.
