# SEO follow-up 2026-08 (thay mục "SEO follow-up sau PR #515" trong TODO.md)

> Nguồn: `/idea` panel 02/08/2026 — proposal + audit trail đầy đủ:
> `docs/proposals/seo-followup-checklist-v2/`. Baseline: export GSC **01/08/2026**
> (`~/Downloads/https___www.thepicklehub.net_-{Coverage,Performance-on-Search}-2026-08-01/`).
> ⚠️ Baseline là ảnh chụp GIỮA một đợt sửa: `GONE_EXACT` (410 cho 28 path rác) ship 30/07,
> validation GSC "Đã bắt đầu" (Started) đang chạy trên cả 3 nhóm lỗi.
>
> **Sự thật nền (đo từ Trang.csv):** site sống nhờ cụm `/san/*` — **56% click, 83% impression**.
> Không phải bài blog. Mọi quyết định trong file này đặt cụm sân lên trước.
>
> **Quy ước:** mỗi checkbox = một hành động = một bằng chứng dán lại được. Prefix nơi làm:
> `[repo]` `[terminal]` `[GSC UI]` `[prod verify]`. Thuật ngữ GSC ghi VI (EN) — UI của
> Cuong là tiếng Việt, docs/API là tiếng Anh.

## Luật cứng (rút từ panel — vi phạm là tự tạo sự cố)

1. **301 phục vụ SEO phải vào `functions/_middleware.ts`** (map như `BLOG_MERGED`/`VI_BLOG_REDIRECTS`,
   dòng ~365-455), mirror `public/_redirects` cùng commit và **phía trên** dòng `/* /index.html 200`.
   Bot bypass `public/_redirects` — middleware chạy trước (repo tự ghi bài học này 4 lần).
   Done = `curl -I -A "Googlebot" <url>` trả 301, không phải browser.
2. **Grep `GONE_EXACT` trước mọi 301 mới.** Redirect map chạy TRƯỚC `isGoneUrl()` — một dòng 301
   cho path đang 410 sẽ âm thầm huỷ 410 chủ ý. Path đã 410 thì giữ 410.
3. **KHÔNG bump `pr:v32`** cho thay đổi title/meta. Bump = flush toàn bộ ~3176 URL prerender →
   cold-render đua với budget 8s → bot nhận SPA shell. TTL 6h tự cuốn; cần gấp thì warm
   `?nocache=1` (đúng giá trị `1`) theo lô ≤50 path, throttle. Sau đợt warm: canh Telegram
   fingerprint `prerender:` 30 phút.
4. **CẤM vòng noindex thứ hai trên venues.** `isThinVenue()` (`functions/_lib/render/venues.ts:62-72`)
   đã loại 691×2 stub; 462 URL `/san` 0-click vẫn mang 19.611 impression — không còn dư địa "thin".
   Tiêu chí thin chỉ được là **hình dạng dữ liệu** (address/geo/courts/phone), không bao giờ là
   click/impression/index-state. Đổi `isThinVenue()` = sửa định nghĩa dữ liệu + `SELECT count(*)`
   trước/sau trong PR + floor sitemap CI đã có (`tests/seo.spec.ts` SEGMENT_MIN_URLS).
5. **Freeze cohort mốc SEO-CLUSTER-READ tới sau 23/08** (`docs/milestones.md`): không đụng
   6 URL — `/tools`, `/tools/doubles-elimination`, `/blog/free-pickleball-bracket-generator`,
   `/blog/how-to-create-pickleball-bracket`, `/blog/pickleball-round-robin-generator-guide`,
   `/blog/best-pickleball-tournament-software-2025` — và bản `/vi/` của chúng. Đặc biệt: mục 301
   hygiene không được canonical-hoá host non-www→www cho các URL này trước 23/08 (1 URL cohort
   đang được Google ghi nhận trên host non-www; đổi giữa chừng làm verdict mốc sai).
6. **Mọi thay đổi predicate/gate sitemap tương lai (mọi segment):** chỉ noindex, GIỮ URL trong
   sitemap (drop sitemap là tự bịt đường recrawl — muốn drop thì PR riêng sau ≥28 ngày);
   cấm cột do cron ghi làm input predicate (`match-expire` flip `pending→expired` 21:00 UTC =
   cron tự deploy thay đổi SEO không qua CI) trừ khi có test khoá riêng; cohort log slug
   trước/sau vào docs cùng PR.

## Việc theo thứ tự

### 1. [repo] Sửa 3 bug đang sống (TRƯỚC mọi việc SEO khác) — cần PR riêng, Cuong duyệt

- [x] **Internal link prefix theo lang** *(SHIPPED PR #533, `86e39a98`, 03/08 — 8 vị trí kể cả 2 chỗ qa-verifier bắt thêm; verify prod: 6/6 mẫu 0 anchor EN trên trang VI)*: `venues.ts` hardcode
      `/san/` ở L174 (index), L445 (khối "Sân khác tại city"), L693 (city hub) → 844 trang
      `/vi/san/*` nhận **0 internal link**, ~9.000 link từ trang VI bơm authority sang cụm EN.
      Sửa prefix theo `lang`. Verify: `curl -A "Googlebot" https://www.thepicklehub.net/vi/san/bsb-pickleball-club-tp-hcm | grep -c 'href="[^"]*/vi/san/'` > 0.
- [x] **Title/description venue cắt byte** *(SHIPPED PR #533 — CUT_TITLE_EXEMPT đã gỡ; verify prod: Tăng Bạt Hổ 57B cụt → 52B sạch)*: xoá tiền-kiểm `.length <= 60` ở `venues.ts:306-309`
      (luôn gọi `buildTitle`); `seo-helpers.ts:169` đổi `source.length` sang đếm byte
      (`TextEncoder`). Bug #468 tái phát qua caller đi vòng — 5/10 sân mẫu đang ship title
      `"… – Hà Nội |…"`. Cùng PR: gỡ miễn trừ `CUT_TITLE_EXEMPT` trong `tests/seo.spec.ts`.
      Verify: `curl -A "Googlebot" /vi/san/san-pickleball-flc-sam-son | grep -o '<title>[^<]*'` —
      không tận cùng bằng `|…`.
- [x] **Related-matches leak** *(SHIPPED PR #533 — verify prod: 0/7 related link qt-*/-test)*: `match-page.ts:221-224` thêm filter loại `qt-*`/`*-test` —
      đang phát internal link tới đúng URL mà `sitemap-matches.xml.ts:57-59` cố giấu.
- [x] Sau khi cả 3 merge: không bump cache; warm 6 URL mẫu first/middle/last EN+VI bằng
      `?nocache=1` 03/08 — cut=0, hreflang=3, VI 0 anchor EN. Soak 30' sạch (0 sig mới).

### 2. [terminal] Index coverage — chạy classifier, KHÔNG đoán

- [ ] `python3 scripts/seo/index_coverage.py --performance-dir ~/Downloads/https___www.thepicklehub.net_-Performance-on-Search-2026-08-01`
      — tầng 1: đối chiếu sitemap × Trang.csv. Script **không bao giờ** in nhãn coverage khi
      không có nguồn per-URL (nó tự từ chối — exit 5/6 là thiết kế, không phải lỗi).
- [ ] `... --inspect 60` — tầng 2: URL Inspection API (SA key `.claude/secrets.local.gsc-ga4-sa.json`,
      duyệt 03/08; property pin `sc-domain:thepicklehub.net`). ~7s/URL, cache sqlite, chạy lại
      resume. Ưu tiên nhóm **Đã thu thập dữ liệu – hiện chưa được lập chỉ mục (Crawled – currently
      not indexed, 42 URL)** — tín hiệu chất lượng thật; nhóm **Đã phát hiện (Discovered, 138 URL)**
      nhiều khả năng là stub venue đang noindex CHỦ Ý (đúng ý đồ → disposition "không làm gì")
      và bài news mới chưa kịp crawl (ingest 6h/lần — not-indexed cao ở cohort mới là BÌNH THƯỜNG).
- [ ] Ghi disposition từng nhóm vào cuối file này (đúng ý đồ / cần internal link / cần 410).

### 3. [GSC UI → repo] 404 hygiene (chờ validation GSC hiện tại ra kết quả trước)

- [ ] [GSC UI] Export danh sách 61 URL: Lập chỉ mục → Trang → Không tìm thấy (404)
      (Indexing → Pages → Not found (404)) → Xuất → lưu `~/Downloads/gsc-coverage-urls/404.csv`.
      URL Inspection API không liệt kê được nhóm này (chỉ inspect URL đã biết) — đây là bước
      tay duy nhất, làm 1 lần.
- [ ] [terminal] `python3 scripts/seo/index_coverage.py --performance-dir ... --urls-file ~/Downloads/gsc-coverage-urls/404.csv --check-http`
      → bảng URL × HTTP status thật hôm nay (nhiều URL có thể đã 410 đúng từ 30/07 → giữ nguyên).
- [ ] [repo] URL còn giá trị → 301 theo **luật 1 + 2**. URL rác → giữ 404/410, xoá khỏi mọi
      internal link. Không 301 hàng loạt về trang không tương đương (soft-404 tệ hơn 404).
- [ ] [prod verify] curl Googlebot **cả danh sách** (script `--check-http`, ~20 giây) — không
      verify 3 URL mẫu rồi suy ra 61.

### 4. [repo] CTR — chỉ sau khi mục 1 xong và có 28 ngày dữ liệu sạch

- [ ] Phân hoá title VI/EN (`ui-ux-critic` round1 có bảng copy dán được): VI thêm tiền tố
      `Sân `, thêm quận/tỉnh (`picklezone… Nghệ An`, `msc… Quận 2`), normalize tên toàn CAPS.
      Thứ tự cắt khi >60 byte: bỏ ` | ThePickleHub` → bỏ tỉnh → bỏ quận — không bao giờ cắt tên sân.
- [ ] Done-criteria: CTR ≥ 50% kỳ vọng theo **vị trí** (không phải số phẳng 2,5% — `dk pickleball`
      2,42% ở pos 7,8 đã là baseline SERP; `picklezone` 0% ở pos 5,5/147 impr mới là bất thường).
- [ ] Query 0% ở pos ≤6 → nghi local pack ăn click → mục riêng (Google Business Profile),
      title không cứu được.

### 5. [GSC] CWV field-data — giữ nguyên từ checklist gốc

- [ ] Đọc CrUX/GSC sau **≥28 ngày** kể từ deploy PR #515 (73bf7028, 02/08) → từ 30/08.
      Không kết luận từ Lighthouse lab. Mobile LCP / INP / CLS riêng. FCP 2,3s→≤1,8s chỉ làm
      nếu field-data xác nhận.

### 6. [prod verify] Sau mỗi nhóm việc

- [ ] Sample ≥10 URL `/san/*` ngẫu nhiên, CẢ 2 ngôn ngữ, curl Googlebot (không tin first-loc — CI
      sweep giờ đã lấy first+middle+last nhưng vẫn chỉ là 3 mẫu).
- [ ] Tracker organic thủ công: clicks cụm `/san` theo tuần (`python3 scripts/seo/gsc_report.py`)
      — **không SLO nào canh organic**; thiệt hại SEO lớn nhất không làm alert nào kêu.
- [ ] So sánh với baseline 01/08 sau ≥28 ngày dữ liệu hậu thay đổi.

**Done khi:** 3 bug mục 1 đã ship + verify; mọi exclusion coverage có disposition ghi trong file
này; không còn internal link tới 404; nhóm CTR có ≥28 ngày dữ liệu sạch sau links-fix; CWV có
field-data đủ để verdict; cohort bracket không bị đụng trước 23/08.

---

## Disposition log

### 03/08/2026 — lần chạy `--inspect 60` đầu tiên (mẫu: 60 URL sitemap không có impression, thứ tự alphabet → thiên về /blog /clb /live EN; /san và /vi/* chưa được lấy mẫu — lần sau chạy `--inspect 120` hoặc lọc riêng)

Kết quả: **39 INDEXED · 9 DISCOVERED · 7 CRAWLED_NOT_INDEXED · 3 UNKNOWN_TO_GOOGLE**
(raw: `docs/proposals/seo-followup-checklist-v2/inspect-2026-08-03.json`, cache sqlite giữ 7 ngày)

| Nhóm | URL | Disposition |
|---|---|---|
| CRAWLED_NOT_INDEXED (3 blog) | `dupr-vietnam-partnership-ta-pickleball-thepicklehub`, `how-to-watch-ppa-tour-live-2026`, `pickleball-vs-padel-vs-paddle-tennis` | **Cần internal link** — bài thật có nội dung, Google đọc rồi chê; thêm `internalLinks` từ các bài INDEXED cùng cụm (ppa-tour-asia-guide, dupr-*, how-to-play) khi có đợt sửa blog tiếp |
| CRAWLED_NOT_INDEXED (4 /live) | 4 UUID livestream đã kết thúc | **Đúng ý đồ, không làm gì** — trang score mỏng của stream cũ; không đáng đầu tư. KHÔNG noindex thủ công (luật 4/6) |
| DISCOVERED (5 blog) | `mlp-vs-ppa-2026`, `erne-shot-tutorial`, `ppa-tour-asia-2026-recap`, `vietnam-pickleball-federation-2026`, `players-to-watch-2026` | **Chờ + internal link** — bài mới hơn, Google biết nhưng chưa crawl; internal link từ bài INDEXED sẽ đẩy nhanh; re-inspect sau 2 tuần (cache tự hết) |
| DISCOVERED (2 clb + 2 live) | `kim-lien`, `tpp`, 2 UUID | **Không làm gì** — chờ crawl tự nhiên |
| UNKNOWN_TO_GOOGLE (1 blog) | `pickleball-world-cup-2026-da-nang-how-to-watch` | **Kiểm tra** — nằm trong sitemap nhưng Google chưa từng thấy; nghi bài mới/slug đổi. Nếu là bài đang muốn index: GSC Request Indexing tay 1 lần |
| UNKNOWN_TO_GOOGLE (2 /live) | 2 UUID | **Không làm gì** |

Kết luận lần 1: mẫu này KHÔNG có ca nào cần noindex/410 — đúng dự đoán panel (tỉ lệ
not-indexed ~35% của nhóm no-impression, và toàn bộ đều "chờ/internal link", không có
"thin cần loại"). Nhóm 138 Discovered của GSC nhiều khả năng phần lớn là stub venue
noindex chủ ý + bài mới — sẽ thấy rõ khi chạy mẫu /san và /vi/*.
