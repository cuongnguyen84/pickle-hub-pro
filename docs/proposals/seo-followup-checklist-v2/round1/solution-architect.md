# solution-architect — seo-followup-checklist-v2 (vòng 1, 02/08/2026)

## Tóm tắt kiến trúc

Gói này chỉ gồm **1 script Python mới** (`scripts/seo/index_coverage.py`) và **1 file docs mới** (`docs/seo-followup-2026-08.md`), TODO.md rút còn con trỏ 3 dòng — không đụng bundle JS, không route mới, không migration, không RED-tier. Phát hiện quyết định của vòng 1: **URL Inspection API CHẠY ĐƯỢC ngay hôm nay** với service account đã có sẵn (đã test live, HTTP 200, trả `coverageState` từng URL) — nên toàn bộ giả định "phải export tay từng issue từ GSC UI" trong intake là **sai**, và script phân loại URL không cần input thủ công nào. Hình dạng script: mặc định chạy **tầng miễn phí** (sitemap × `Trang.csv` × HTTP status, 0 quota), chỉ tiêu quota API cho top-N URL khả nghi khi gọi `--inspect`.

---

## Bằng chứng đã tự kiểm chứng (không lấy lại từ recon)

| # | Kiểm chứng | Kết quả |
|---|---|---|
| 1 | 4 file CSV Coverage export | **Xác nhận recon đúng** — chỉ có số đếm theo nguyên nhân, không có cột URL. `Vấn đề nghiêm trọng.csv` = 9 dòng (16 redirect / 12 robots / 5 alt-canonical / 3 noindex / 1 soft-404 / 61 404 / 138 discovered / 42 crawled / 0 duplicate). Tổng loại trừ = 278, khớp `Sơ đồ.csv` dòng 2026-07-24 (278 chưa index / 2754 đã index). |
| 2 | URL Inspection API với SA `firebase-adminsdk-fbsvc@thepicklehub-dee20` | **CHẠY ĐƯỢC.** POST `searchconsole.googleapis.com/v1/urlInspection/index:inspect` + `siteUrl=sc-domain:thepicklehub.net` → 200, trả `coverageState`, `googleCanonical` vs `userCanonical`, `robotsTxtState`, `lastCrawlTime`, `referringUrls`, `crawledAs`. |
| 3 | Recon nói `/vi/blog/singapore-open-2026` "không tồn tại" | **RECON SAI — đừng sửa checklist theo điểm này.** `curl -A Googlebot` trả **200**. Nó là dòng 3 của `Trang.csv` (52 click / 263 impr / pos 5.63). Slug VI nằm ở bảng Supabase `vi_blog_posts`, **độc lập** với slug EN (`singapore-open-2026-recap`, cũng 200). Ngược lại `/vi/blog/singapore-open-2026-recap` mới là cái trả **301**. Checklist gốc trích URL đúng. |
| 4 | Sample `coverageState` thật theo segment | news 4/4 `Discovered - currently not indexed`; matches 3/3 `URL is unknown to Google`; venues hỗn hợp (`Discovered`, `URL is unknown`, `Submitted and indexed`); players 3/3 + tournaments 1/2 `Submitted and indexed`. |
| 5 | Kích thước sitemap (đếm `<loc>` trên prod) | news **1000**, venues **1688**, matches **246**, static 81, blog 55, players 40, livestreams 26, events 19, tournaments 12, videos 6, organizations 3. Tổng ≈ **3176**. venues/news là cặp EN+VI ⇒ ~844 venue, ~500 news item. |
| 6 | `isThinVenue()` | Đúng như recon: `functions/_lib/render/venues.ts` export, `functions/sitemap-venues.xml.ts:58` import — **một nguồn cho cả noindex lẫn sitemap**, đã có comment `ponytail:` ghi rõ ý đồ. Đã loại 691×2 venue rỗng. |
| 7 | Tốc độ URL Inspection API | **Đây mới là ràng buộc thật, không phải quota.** ~10–20s/call; chạy 8 luồng song song bị throttle timeout ở 2 phút. Quota 2000/ngày là dư; **wall-clock mới là nút thắt** ⇒ script bắt buộc phải cache + resume. |
| 8 | (Phát sinh) `scripts/seo/canonical_monitor.py` chạy local | **ĐANG HỎNG trên máy Cuong** — `CERTIFICATE_VERIFY_FAILED` toàn bộ route, exit=1. Là lỗi cert Python 3.12 framework build (stdlib `urllib` không thấy CA), không phải lỗi prod. Fail loud (exit 1) nên không phải gate mù. Sửa: chạy `/Applications/Python 3.12/Install Certificates.command`. `seo_verify.py` cũng stdlib-urllib ⇒ dính cùng lỗi. |

**Hệ quả thiết kế từ #4+#5:** 1000 URL news (nội dung tổng hợp/dịch máy) + 246 URL match nhồi vào sitemap chính là nơi ngân sách thu thập đang chảy. 138 "Discovered" gần như chắc chắn tập trung ở news. Nhưng **chưa đủ mẫu để kết luận** (xem "Điều em không chắc").

---

## Option A — `index_coverage.py` hai tầng + checklist tách sang `docs/`

**Effort: 3 nửa ngày** · Files:
- thêm `scripts/seo/index_coverage.py` (~220 dòng)
- thêm `docs/seo-followup-2026-08.md` (checklist viết lại)
- sửa `TODO.md` (thay ~25 dòng bằng con trỏ 3 dòng)
- sửa `scripts/seo/SETUP.md` (+1 mục: bật Search Console API cho URL Inspection)
- `.gitignore` += `scripts/seo/.index_coverage.db`

· Data: **không migration, không RLS, không RPC.** sqlite cache local, cùng chỗ với `.seo_drift.db` của `seo_verify.py`.

**How it works:**

Tầng 1 — mặc định, **0 quota, 0 auth**:
1. Đọc `/sitemap.xml` → 11 segment sitemap → tập URL (có gắn nhãn segment).
2. Đọc `Trang.csv` (Performance export) → tập URL **có impression** (= Google chắc chắn đã index).
3. `GET` từng URL bằng Googlebot-UA, đồng thời 16 luồng → HTTP status.
4. Xuất bảng theo segment: `{in_sitemap, has_impressions, status}` + 3 danh sách hành động:
   - `dead_in_sitemap` — trong sitemap nhưng 404/301 → **lỗi sitemap của mình, sửa được ngay, không cần Google**
   - `orphan_ranking` — có impression nhưng KHÔNG trong sitemap → ứng viên thêm vào sitemap
   - `suspect_unindexed` — trong sitemap, 200, 0 impression → ứng viên đưa sang tầng 2

Tầng 2 — `--inspect N` (mặc định N=150), tiêu quota:
5. Lấy N URL đầu của `suspect_unindexed`, ưu tiên theo segment (`--segment news`), gọi URL Inspection API tuần tự (throttle ~1 req/s), ghi `coverageState` vào sqlite kèm `checked_at`.
6. Lần chạy sau bỏ qua URL đã kiểm trong `--max-age` ngày (mặc định 14) ⇒ **resume được**, ngắt giữa chừng không mất gì.
7. Xuất JSON + bảng markdown dán thẳng vào docs: đếm `coverageState` theo segment.

Auth: copy nguyên hàm `token()` 12 dòng từ `gsc_report.py`, cùng biến env `GOOGLE_SA_JSON` / `GSC_SITE`. **Không** tách module auth dùng chung — 3 script copy 12 dòng vẫn rẻ hơn một lớp trừu tượng; tách khi có script thứ 4.

Dùng `requests` (không stdlib): `google-auth` đã bắt buộc cho tầng 2, và `requests` bundle sẵn certifi nên **tránh luôn lỗi cert ở #8**.

Kiểm tra để lại: một hàm `_selftest()` chạy bằng `--selftest`, assert bộ phân loại trên 6 URL giả (không gọi mạng). Không framework, không fixture.

**Wins:** tầng 1 trả lời được ~80% checklist mà không cần Google và chạy trong ~3 phút; tầng 2 cho **sự thật gốc từ Google** theo từng URL, xoá hẳn việc rà tay — đúng tiêu chí thành công trong intake. Tái dùng được cho mốc `SEO-CLUSTER-READ` 23/08 (`coverageState` + `googleCanonical` là đúng thứ mốc đó cần để ra verdict THẮNG/THUA). `googleCanonical != userCanonical` cho thẳng 5 URL alt-canonical; `robotsTxtState` cho 12 URL robots-blocked.
**Loses:** ~220 dòng Python phải nuôi; phụ thuộc SA key nằm ngoài repo (`~/Downloads/...json`, đường dẫn mặc định `.claude/secrets.local.gsc-ga4-sa.json` hiện **không tồn tại** — phải copy vào trước khi chạy). Tầng 2 chậm (150 URL ≈ 3–5 phút thực).
**Forecloses:** gần như không. Không khoá lựa chọn sản phẩm nào; nếu bỏ script sau này thì chỉ mất 1 file.

---

## Option B — chỉ tầng 1 (bản rẻ): triage bằng CSV + sitemap, không đụng API

**Effort: 1,5 nửa ngày** · Files: thêm `scripts/seo/index_coverage.py` (~90 dòng, chỉ tầng 1), thêm `docs/seo-followup-2026-08.md`, sửa `TODO.md` · Data: **none**

**How it works:** đúng bước 1–4 của Option A rồi dừng. Không auth, không quota, không sqlite. Suy luận "trong sitemap + 200 + 0 impression ⇒ nghi chưa index".

**Wins:** rẻ nhất, chạy được ngay hôm nay, không lệ thuộc key Google, không có gì để hỏng lúc 2h sáng. Bắt trọn nhóm `dead_in_sitemap` — nhóm **duy nhất** mà mình tự sửa được không cần Google.
**Loses:** proxy "0 impression = chưa index" **sai nhiều**. 844 venue và 500 news hoàn toàn có thể đã được index mà vẫn 0 impression (đuôi dài, không ai search). Không phân biệt được `Discovered` (138, ưu tiên thấp) với `Crawled` (42, tín hiệu chất lượng) — mà đó chính là điểm sửa số 2 trong intake. Không đọc được `googleCanonical`, `robotsTxtState`.
**Forecloses:** không khoá gì — B là tập con thật sự của A, nâng cấp lên A bất cứ lúc nào.

---

## Option C — không làm tooling: viết lại checklist + siết ngay thin-gate cho news/matches

**Effort: 2 nửa ngày** · Files: `docs/seo-followup-2026-08.md`, `TODO.md`, `functions/_lib/render/news.ts`, `functions/sitemap-news.xml.ts`, `functions/sitemap-matches.xml.ts`, bump `pr:v32` → `pr:v33` trong `functions/_middleware.ts`, ghi `docs/prerender-cache-log.md` · Data: **none** (đọc cột sẵn có)

**How it works:** bỏ qua đo đạc, áp thẳng pattern `isThinVenue()` sang news + matches: một hàm `isThinNews()` export từ `functions/_lib/render/news.ts`, được **cả** renderer (gắn `<meta robots noindex>`) **và** `sitemap-news.xml.ts` import — y hệt cấu trúc venue hiện tại. Tiêu chí ví dụ: news chỉ có tóm tắt dịch máy, không có body đủ dài, hoặc quá X ngày tuổi. Matches: chỉ giữ trong sitemap các trận thuộc giải có trang tournament đã index.

**Wins:** đánh thẳng vào nguyên nhân (1000 + 246 URL mỏng làm loãng cluster) thay vì đo nó; tái dùng đúng pattern đã có, không phát minh gì.
**Loses:** **đang đoán.** Mẫu của em chỉ 4 URL news — chưa đủ để kết luận toàn bộ 500 item là mỏng. Đây là thay đổi SSR + sitemap trên prod: gỡ nhầm 1000 URL khỏi index là việc mất nhiều tuần mới hồi. Bắt buộc bump cache prerender, và verify bằng Googlebot-curl từng loại route.
**Forecloses:** **có, và nặng.** Một khi đã `noindex` hàng loạt news, mất luôn baseline GSC 01/08 làm mốc so sánh — intake ghi rõ "baseline GSC 01/08 giữ nguyên làm mốc". Sau đó không còn cách nào biết thay đổi là nhờ noindex hay nhờ internal link.

---

## Khuyến nghị

**Option A**, nhưng ship theo increment để increment 1 chính là Option B (xem dưới).

- **B thua** vì proxy "0 impression = chưa index" không tách được 42 `Crawled` khỏi 138 `Discovered`. Mà tách được đúng hai nhóm đó **chính là** điểm sửa số 2 trong intake — chỗ có giá trị nhất của cả đề xuất. Chi phí để lên A chỉ hơn B **1,5 nửa ngày**, vì phần khó nhất (auth SA có chạy không) em **đã test xong, chạy được**. Đây không còn là rủi ro kỹ thuật, chỉ còn là code.
- **C thua** vì nó ship thay đổi prod dựa trên mẫu 4 URL, và nó **đốt mất baseline** mà intake yêu cầu giữ. Thứ tự đúng là đo rồi mới siết. Sau khi A tầng 2 chạy trên ~300 URL news, C trở thành **increment 4** — lúc đó không còn là đoán nữa. C không sai về hướng, chỉ sai về thời điểm.

Ràng buộc đã kiểm: **0 KB** vào bundle (`docs/perf-budgets.md` không bị ảnh hưởng — Python + markdown). **Không route công khai mới** ⇒ không cần handler `functions/_lib/render/`, không đụng sitemap, không hreflang. **Không RED-tier** — không chạm auth, payments, `supabase/config.toml` (`scripts/agents/risk-tier.mjs`). Docs viết tiếng Việt (chỉ Cuong đọc, không phải text người dùng ⇒ không phát sinh nghĩa vụ song ngữ).

### Trả lời 4 câu hỏi thiết kế

1. **Input của script:** *không phải* export tay per-issue, *không phải* tự crawl mù. Là **sitemap của chính mình** (nguồn URL, mình kiểm soát, luôn tươi) + `Trang.csv` (biết URL nào đã có impression) + **URL Inspection API** cho phần còn nghi. Lý do bỏ export tay: nó là thao tác thủ công lặp lại mỗi lần muốn đo, đúng thứ intake muốn xoá. Lý do API khả thi: đã test 200 thật.
2. **Chỗ đứng của script:** **file mới** `scripts/seo/index_coverage.py`. Không nhét vào `gsc_report.py` (khác API — Search Analytics vs URL Inspection, khác nhịp chạy — tuần vs theo đợt), không nhét vào `seo_verify.py` (542 dòng, là gate CI stdlib-only, thêm `google-auth` vào sẽ phá tính chất đó). `canonical_monitor.py` không liên quan.
3. **Checklist ở đâu:** nội dung đầy đủ sang **`docs/seo-followup-2026-08.md`** (đúng chỗ với `ops-runbook.md`, `prerender-cache-log.md` ở docs/ root); `TODO.md` giữ **3 dòng** trỏ sang. Lý do: TODO.md là danh sách việc tồn ngắn hạn, không phải nơi chứa runbook 7 hạng mục có done-criteria. Cấu trúc: **P0 dead-in-sitemap → P1 42 Crawled → P2 404 hygiene → P3 xác nhận exclusion chủ ý → P4 CTR + bump cache → P5 internal link (gộp "index coverage" + "giảm phụ thuộc 1 bài") → P6 CWV ≥28 ngày**. Mỗi mục 1 dòng "Xong khi:" đo được bằng lệnh cụ thể.
4. **`isThinVenue()` cho segment khác:** **có, nhưng ở increment 4, sau khi có số.** Pattern đúng là "một hàm export, cả renderer lẫn sitemap cùng import" — copy y nguyên cho `isThinNews()`. Ứng viên xếp theo mức nghi ngờ: **news (1000 URL, mẫu 4/4 chưa index)** > **matches (246 URL, mẫu 3/3 Google còn chưa biết tới)** > venues (đã có gate rồi).

---

## Increments

1. **Tầng 1 + `dead_in_sitemap`** (1 nửa ngày) — script chạy được chế độ miễn phí. *Verify:* `python3 scripts/seo/index_coverage.py --segment blog` chạy < 60s và số URL đếm được khớp `curl -s .../sitemap-blog.xml | grep -c "<loc>"` = 55. Nếu `dead_in_sitemap` ra khác 0 → đã có giá trị thật trước khi viết thêm dòng nào.
2. **Tầng 2 `--inspect` + sqlite cache** (1 nửa ngày) — *Verify:* chạy `--inspect 20 --segment news` hai lần liên tiếp; lần 2 phải xong trong vài giây (toàn bộ hit cache) và không tốn call nào. Cộng `--selftest` xanh.
3. **Viết lại checklist sang `docs/seo-followup-2026-08.md` + rút gọn TODO.md** (1 nửa ngày) — *Verify:* mỗi mục có "Xong khi:" kèm một lệnh chạy được; mục CTR **phải** ghi rõ sửa title venue ⇒ bump `pr:v32`→`pr:v33` (844 venue thì `?nocache=1` từng path là bất khả thi) + ghi vào `docs/prerender-cache-log.md`.
4. **← ĐIỂM DỪNG NHÌN LẠI.** Chạy `--inspect 300 --segment news`. Đọc phân bố `coverageState`. **Chỉ khi** ≥70% news là `Discovered/Crawled - not indexed` mới làm `isThinNews()` (Option C). Nếu thấp hơn → vấn đề không nằm ở news, đừng đụng SSR, quay lại P5 internal link.

---

## Điều em không chắc

- **Mẫu quá nhỏ để quy nạp.** Em mới inspect được 15 URL trước khi API throttle làm timeout 2 phút. news 4/4 chưa index là tín hiệu mạnh nhưng 4 URL đó là **4 URL đầu sitemap = bài mới nhất**, tự nhiên chưa kịp crawl. Lần random 20+20 của em **bị timeout, không có kết quả** — nên con số "138 discovered chủ yếu là news" là **giả thuyết chưa kiểm chứng**. Increment 4 tồn tại chính vì lý do này.
- **Không biết 61 URL 404 là gì.** Sitemap không chứa chúng (mình đâu có list URL chết), `Trang.csv` chỉ có URL còn impression. Cả A lẫn B đều **không** liệt kê được nhóm 404 này — muốn biết vẫn phải export tay 1 lần từ GSC UI, hoặc đợi chúng rụng khỏi báo cáo. Em cố tình không hứa script giải quyết P2; checklist phải ghi thẳng đây là bước thủ công 1 lần.
- **`URL is unknown to Google` cho 3/3 match** — em chưa xác định được nguyên nhân: sitemap-matches có được submit và fetch thành công không, hay `/tran-dau/*` bị chặn/noindex ở `functions/_middleware.ts`. Chưa mở `sitemap-matches.xml.ts` và phần noindex của middleware để đối chiếu. Cần làm trước khi xếp matches vào diện "thin".
- **Đường dẫn SA key.** `.claude/secrets.local.gsc-ga4-sa.json` (mặc định của `gsc_report.py`) **không tồn tại**; em test bằng `~/Downloads/thepicklehub-dee20-68a66e81d1d6.json`. Chưa rõ Cuong muốn copy key vào repo path đã gitignore hay trỏ `GOOGLE_SA_JSON` ra ngoài. Ảnh hưởng tới việc script có chạy được trong scheduled task hay không.
- **Quyền SA cho URL Inspection.** Google yêu cầu owner/full user; comment trong `gsc_report.py` ghi "Full access từ 16/06". Call của em trả 200 nên hiện tại ổn — nhưng nếu quyền bị hạ xuống Restricted thì tầng 2 chết mà tầng 1 vẫn sống (fail mềm, cần thông báo rõ ràng trong script).
- **Không mâu thuẫn với lệnh cấm trong CLAUDE.md.** §Deployment Verification cấm **URL Inspection *Live Test*** vì false-negative *schema*. Tầng 2 đọc `indexStatusResult.coverageState` = trạng thái index đã lưu, **không** gọi live test, **không** đọc schema. Em cho là không vi phạm — nhưng đây là diễn giải của em về ý định điều luật, nếu Cuong đọc chặt hơn thì Option B là phương án lùi.
