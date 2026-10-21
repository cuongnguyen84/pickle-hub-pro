# solution-architect — ppa-rankings-tab (2026-08-06)

## Tóm tắt kiến trúc

Em đã tự fetch `https://www.ppatour.com/rankings/` và phát hiện một điều làm đổi hình dạng cả phương án: trang đó là Next.js App Router, dữ liệu nằm **sẵn trong HTML đầu tiên** dưới dạng JSON trong `self.__next_f.push(...)` — nên `fetch()` thường là đủ, **không cần Browser Rendering** — nhưng nó chỉ có **2 division (Men / Women), 50 dòng mỗi cái, điểm WPR tổng hợp**, hoàn toàn **không có** Singles/Doubles/Mixed. Sitemap ppatour.com chỉ có đúng 1 URL `/rankings/`. Vì vậy phương án được thiết kế quanh cái nguồn thật sự có, cộng thêm một option riêng cho việc lấy ma trận format (phải sang `pickleball.com`, nguồn khác thương hiệu). Về hình dạng: parser dùng chung 1 file trong `src/lib/pro-tour/adapters/`, worker và script build cùng import — đúng pattern `[alias]` mà `pro-tour-scraper/wrangler.toml` đã chạy được.

### Bằng chứng em tự kiểm (2026-08-06)

| Kiểm | Kết quả |
|---|---|
| `curl` ppatour.com/rankings | 200, 270 KB, RSC inline, `divisions:[{key:"men",…50},{key:"women",…50}]` |
| Shape mỗi entry | `rank, isTied, slug, name, points, eventsPlayed, prizeMoney, country, countryCode, headshot, image, profileUrl, hasLocalProfile` |
| Cần Browser Rendering? | **Không.** Plain fetch đủ |
| Per-format trên ppatour? | **Không có.** Chỉ Men/Women điểm tổng (52-week rolling) |
| robots.txt ppatour / pickleball | Cả hai `Allow: /` cho `/rankings` |
| `pickleball.com/rankings?gender=M&type=N` | 200, cũng RSC inline, 100 dòng, shape khác hẳn (`ranking, playerSlug, playerUuid, points, livePoints…`); `type=1..5` trả list khác nhau, **mapping type→format nằm trong JS bundle, chưa giải được** |
| KV cache key thực tế | `functions/_middleware.ts:580` = **`pr:v33`**, không phải v32 — CLAUDE.md và recon đều stale. Bump là **v33→v34** |
| Title budget | `functions/_lib/utils.ts:44` cắt theo **60 UTF-8 byte**; `"Bảng xếp hạng PPA Tour WPR"` + suffix ≈ 48 byte → vừa |
| CSP `img-src` | `public/_headers:71` đã là `https:` wildcard → headshot **không** cần đổi CSP |

---

## Option A — WPR tab, DB-backed, worker riêng (đúng phạm vi nguồn thật)

**Effort: 6.5 nửa ngày**
**Files:**
- add `src/lib/pro-tour/adapters/ppa-rankings.ts` (parser thuần, ~80 dòng)
- add `src/lib/pro-tour/__fixtures__/ppa-rankings-2026-08.html` + `src/lib/pro-tour/__tests__/ppa-rankings.test.ts`
- add `workers/ppa-rankings-scraper/{wrangler.toml,package.json,tsconfig.json,src/index.ts}`
- add `supabase/migrations/2026080xxxxxxx_ppa_rankings.sql`
- add `src/hooks/usePpaRankings.ts`
- edit `src/content/dupr-rankings.ts` (scope `ppa-men`/`ppa-women` hoặc scope `ppa` + 2 format)
- edit `src/pages/Rankings.tsx`
- edit `functions/_lib/render/rankings.ts`, `functions/_middleware.ts` (v33→v34)

**Data:** migration mới — bảng `public.ppa_rankings (division text, rank int, slug text, name text, points numeric, events_played int, country text, country_code text, profile_url text, fetched_at timestamptz, PRIMARY KEY (division, rank))`, RLS `SELECT` cho `anon`+`authenticated`, `GRANT SELECT` (bẫy grant-trước-RLS trong memory sweep 2), ghi bằng `service_role` từ worker. **Không cần RPC** — PostgREST select `?division=eq.men&order=rank` là đủ; RPC chỉ thêm một thứ phải bảo trì.

**How it works:** worker cron `0 3 * * *` (1 lần/ngày — điểm là rolling 52 tuần, cập nhật sau giải, chạy 2h như news-fetcher là lãng phí 12×) → `fetch()` trang → parser regex lấy khối `"divisions":[…]` → `JSON.parse` → `DELETE`+`INSERT` trong 1 lần hoặc upsert theo `(division, rank)` → gọi `ops_record_job_run` để vào `ops_job_registry` dashboard. Worker có thêm `POST /run` với `X-Auth-Secret` để trigger tay, y hệt news-fetcher.

Frontend: thêm **nhóm scope mới `"pro"`** (`DuprScopeGroup` hiện đã là union `global|continent|national`, thêm `"pro"`) với 1 scope key `ppa`, và 2 format `ppa-men`/`ppa-women` vào `DUPR_FORMATS` + `getAvailableFormats("ppa")`. Đổi `fallback: "vietnam"` → `"ppa"` ở `Rankings.tsx:44` và `defaultFormatForScope` → `ppa-men`. Copy trang phải **trung tính hoá**: h1/title/description hiện đang nói "DUPR" ở khắp nơi (`Rankings.tsx:97-131`) — để PPA làm tab mặc định mà h1 vẫn là "tính theo DUPR" là sai lệch nội dung, phải sửa cùng lúc.

SSR: `renderRankings` render **PPA làm khối chính + GIỮ khối Vietnam top-25 làm section phụ**. Đây là điểm quan trọng: khối VN hiện tại là nguồn internal link duy nhất vào `/nguoi-choi/:username` từ một trang priority 0.9 (`functions/sitemap-static.xml.ts:81`). Đổi default sang PPA mà bỏ khối đó = đánh đổi internal link lấy external link ra ppatour.com. Render cả hai không tốn gì và bot thấy superset.

**Wins:** đúng lời hứa "job tự động định kỳ"; dữ liệu tươi không cần Cuong đụng tay; bảng có `points`/`eventsPlayed`/`country` → nội dung SEO dày hơn bảng DUPR tĩnh; parser dùng chung nên fixture test bắt được khi PPA đổi shape.
**Loses:** thêm 1 deploy target + 1 secret + 1 bảng + 1 cron phải giám sát. Vẫn **không** đáp ứng "hết các format" — vì nguồn không có.
**Forecloses:** đặt tên bảng `ppa_rankings` khoá luôn về brand PPA; nếu sau này muốn gộp pickleball.com/DUPR global vào cùng bảng thì phải migrate tên. Giảm thiểu bằng cách đặt `pro_tour_rankings` với cột `source` — em khuyên tên này.

---

## Option B — Snapshot tĩnh commit vào repo (bản rẻ)

**Effort: 4 nửa ngày**
**Files:**
- add `src/lib/pro-tour/adapters/ppa-rankings.ts` (**cùng parser với Option A**)
- add `scripts/parse-ppa-rankings.mjs` (fetch → parser → ghi file TS)
- add `src/content/ppa-rankings.ts` (generated, ~200 dòng cho 100 dòng dữ liệu)
- edit `src/content/dupr-rankings.ts`, `src/pages/Rankings.tsx`, `functions/_lib/render/rankings.ts`, `functions/_middleware.ts`

**Data: không có migration, không RLS, không bảng, không worker, không secret.**

**How it works:** đúng pattern `src/content/dupr-rankings.ts` mà Cuong **đã đang vận hành** (`scripts/parse-dupr.py`, refresh bằng chạy script + commit diff). SSR đọc thẳng const đã import — precedent có sẵn: `functions/_lib/render/blog-meta.ts` generate từ `src/content/blog/metadata.ts` tại module load (SEO-02), Pages Functions import từ `src/` là chuyện bình thường ở repo này.

**Wins:** rẻ nhất, 0 bề mặt ops mới, 0 thứ có thể chết lúc 2h sáng, SSR đơn giản hơn A (không gọi RPC, không có nhánh lỗi/loading). Ship trong tuần. Dữ liệu WPR đổi ~hàng tuần nên "cũ 7 ngày" không phải bug với người dùng VN.
**Loses:** trái chữ trong intake ("phải tạo job mới scrape tự động định kì"). Cuong phải nhớ chạy lệnh — và `DUPR_LAST_UPDATED = "2026-07-20"` cho thấy chính xác điều gì xảy ra khi phải nhớ: nó trôi 2.5 tuần.
**Forecloses:** gần như không gì. Parser giữ nguyên khi lên A; chỉ đổi nguồn đọc trong hook. Đây là lý do B **không phải công toi**.

---

## Option C — Ma trận format đầy đủ qua pickleball.com

**Effort: 10–11 nửa ngày**
**Files:** như A, cộng `src/lib/pro-tour/adapters/pickleball-com-rankings.ts` + fixture thứ hai + 6–10 format tab.
**Data:** bảng như A nhưng thêm `source text` + `format text`, ~600–1000 dòng thay vì 100.

**How it works:** ngoài ppatour.com, worker fetch thêm `pickleball.com/rankings?ranking_type=currentSeed&page=1&gender={M,F}&type={1..5}`. Em đã xác nhận các URL này **trả dữ liệu khác nhau và có sẵn trong HTML đầu** (`type=2`→Christopher Haworth, `type=3&gender=M`→Ben Johns, `type=3&gender=F`→Anna Leigh Waters), nhưng **nhãn format nằm trong JS bundle, không có trong RSC** — phải dò thủ công `type`→Singles/Doubles/Mixed rồi hard-code một bảng mapping không có gì bảo chứng. Ngày PPA đổi thứ tự enum, bảng "Đôi nam" âm thầm hiển thị đơn nữ. Fixture test **không bắt được** loại lỗi này vì shape không đổi, chỉ nội dung đổi.

**Wins:** duy nhất thoả mãn nguyên văn "Men's/Women's × Singles/Doubles/Mixed"; 10× dữ liệu cho SEO landing.
**Loses:** tab tên "PPA Tour" nhưng phục vụ dữ liệu pickleball.com — vấn đề attribution phải giải bằng copy. Mapping dò ngược là nợ kỹ thuật câm. Gấp ~1.7× công so với A.
**Forecloses:** không nhiều về mặt kỹ thuật, nhưng khoá Cuong vào việc canh 2 nguồn scrape thay vì 1.

---

## Khuyến nghị

**Option A, nhưng increment 1 chính là Option B.** Đặt tên bảng `pro_tour_rankings` có cột `source`, không phải `ppa_rankings`.

Lý do các phương án kia thua:

- **C thua** vì tiền đề của nó sai và em đã kiểm chứng: yêu cầu "lấy hết format từ ppatour.com/rankings" là bất khả — trang đó chỉ có Men/Women điểm tổng, sitemap chỉ có 1 URL rankings. C phải kéo `pickleball.com` vào, và cái giá thật không phải 4 nửa ngày thêm mà là một bảng mapping `type=N → format` dò ngược, sai âm thầm, fixture test không phát hiện được. Với 2k user và cam kết reliability > scope trong `docs/slo.md`, đây là đúng loại rủi ro không đáng đổi. **Nếu Cuong vẫn muốn ma trận format, hãy tách thành đề xuất riêng sau khi tab PPA có số liệu traffic** — đừng gộp vào lần ship này.
- **B thua khi đứng một mình** vì `DUPR_LAST_UPDATED = "2026-07-20"` là bằng chứng thực nghiệm ngay trong repo rằng snapshot thủ công sẽ trôi; mà bảng WPR ở tab mặc định trôi 3 tuần thì tệ hơn bảng DUPR ở tab thứ tư trôi 3 tuần. Nhưng B **không thua với tư cách increment 1** — nó ship được cái tab, cái SSR, cái copy song ngữ trong ~4 nửa ngày và trả lời được câu hỏi "có ai bấm vào tab này không" **trước khi** chi 2.5 nửa ngày cho worker + bảng + cron + giám sát.
- **A thắng** vì phần đắt của A (parser + fixture + frontend + SSR) trùng hoàn toàn với B, nên đi B→A không mất gì; và vì `fetch()` thường là đủ nên worker chỉ ~120 dòng chứ không phải một con Browser Rendering như `pro-tour-scraper`.

Hai điều em phản đối trong ý tưởng gốc, nói thẳng:

1. **Không render headshot ở v1.** Payload có `image` trỏ `images.pickleball.com`. CSP cho phép (`img-src … https:`) nên không bị chặn, nhưng 50 ảnh bên thứ ba trên trang mặc định là CLS + LCP mới — mà CLS p75 mobile đã ~0.67 (memory PERF-05). Chỉ dùng `countryCode` → cờ text/emoji.
2. **Đừng bỏ khối Vietnam khỏi SSR.** Xem lý do internal-link ở Option A.

**Native `/apple`: defer, không port.** `RankingsRepository.swift:1-26` đã ghi rõ global/continent scope là deferred; thêm PPA làm scope thứ 9 chưa port là nhất quán với quyết định cũ. **Nhưng phải chốt: native giữ default = `vietnam`.** Web đổi default còn native không đổi là cố ý, không phải bug — ghi vào comment của repository file để 3 tháng sau không ai "sửa" nó.

**Risk tier:** không chạm auth / payments / `supabase/config.toml` → **không phải RED**. Migration + worker mới là AMBER thường lệ. Cảnh báo duy nhất cần Cuong biết: `wrangler secret put SUPABASE_SERVICE_ROLE_KEY` cho worker mới — và **đừng** dựng lại secret-sync loop (sự cố 2026-08-03).

**Bundle:** 0 dependency mới. Parser chạy trong worker/script, không vào client. Client chỉ thêm 1 hook + 1 component bảng → ước tính **+3 KB gz trên chunk lazy của `/rankings`**, không đụng INITIAL. Chunk route hiện dưới trần 150 KB, còn dư nhiều. Không cần lazy-load thêm gì, không cần đụng `docs/perf-budgets.md`.

---

## Increments

1. **Parser + fixture test** — `src/lib/pro-tour/adapters/ppa-rankings.ts` + fixture HTML đã lưu sẵn. Verify: `npm run test` — test golden assert 2 division, 50 dòng mỗi cái, rank 1 = Ben Johns / Anna Leigh Waters, `points` là number. Đây là thứ duy nhất sẽ báo động khi PPA đổi shape.
2. **Tab PPA chạy bằng snapshot tĩnh (= Option B trọn vẹn)** — `scripts/parse-ppa-rankings.mjs` → `src/content/ppa-rankings.ts`; scope group `"pro"`; VI+EN đầy đủ; **chưa đổi default**, PPA nằm cạnh Vietnam. Verify: `/rankings?scope=ppa` và `/vi/rankings?scope=ppa` render đúng bằng tay.
3. **Đổi default + viết lại SSR + bump `pr:v33`→`pr:v34`** — `renderRankings` render PPA chính + VN phụ, title/description mới (nhớ trần 60 byte), ItemList JSON-LD, hreflang giữ nguyên bộ ba đã có (`rankings.ts:103`). Verify: `curl -A "…Googlebot…" "https://www.thepicklehub.net/rankings?nocache=1"` và `/vi/rankings?nocache=1` — 200, có `<h1>` PPA, **đếm được ≥50 tên trong body**, vẫn còn link `/nguoi-choi/` của khối VN, hreflang en/vi/x-default đủ 3.

   → **ĐÂY LÀ ĐIỂM DỪNG-VÀ-NHÌN.** Chạy 1–2 tuần. Đọc GA4 (segment Vietnam) + Ahrefs xem tab PPA có được bấm và `/rankings` có lên impression không. Nếu không ai dùng, dừng ở đây — đã tiết kiệm được increment 4–5.

4. **Migration `pro_tour_rankings` + hook đọc DB** — bảng + RLS + GRANT SELECT; `usePpaRankings` đọc PostgREST; SSR đổi từ const sang query. Verify: probe anon thật (`curl` PostgREST với anon key) trả rows, probe INSERT bằng anon trả `42501`.
5. **Worker `workers/ppa-rankings-scraper/` + cron ngày + `ops_job_registry`** — Verify: `POST /run` với `X-Auth-Secret` trả 200, row `fetched_at` nhích, và job hiện trên dashboard job-health với `expected_interval_seconds = 86400`.
6. *(chỉ nếu số liệu ở bước 3 đủ tốt)* Đánh giá lại Option C như một đề xuất riêng.

---

## Điều em không chắc

- **Mapping `type=N` → format trên pickleball.com em chưa giải được.** Em xác nhận được URL trả dữ liệu khác nhau, nhưng `type=1&gender=M` lại trả Anna Leigh Waters đứng đầu — nghĩa là trang có thể chứa **hai khối** (một hero cố định + một list đã lọc) và regex của em đang bắt nhầm khối. Chưa tách được. Nếu Cuong chọn C, đây là việc dò đầu tiên, và em không dám ước lượng nó dưới 1 nửa ngày.
- **Không có trường last-updated trong payload ppatour.com.** Em grep `season/updated/asOf/week` chỉ ra meta description ("updated through the PPA Tour season"). Nghĩa là ta **không biết dữ liệu PPA cũ bao lâu**, chỉ biết lần scrape gần nhất. Ghi `fetched_at` là hết mức làm được — copy trên UI phải nói "lấy về lúc X", không được nói "cập nhật lúc X".
- **Chưa đo tần suất PPA thực sự đổi bảng.** Em suy ra "hàng tuần" từ dòng "last 52 weeks" trong payload, không phải từ quan sát. Cron 1 lần/ngày là phỏng đoán an toàn, chưa phải kết luận có dữ liệu.
- **Chưa xác minh rủi ro SEO của việc đổi `<title>` trang `/rankings`.** Trang này priority 0.9, changefreq daily, đang được index. Em không mở GSC. Nếu `/rankings` đang có impression đáng kể cho truy vấn "DUPR", trung tính hoá title có thể mất thứ hạng đó — đáng kiểm tra GSC **trước** increment 3, không phải sau.
- **Chưa đọc `scripts/agents/risk-tier.mjs`** nên phân loại AMBER của em là suy luận từ mô tả trong system prompt, không phải từ luật thật trong script.
- **CLAUDE.md đang stale ở 2 chỗ em phát hiện:** cache key nói `pr:v32` nhưng code là `pr:v33`, và `docs/perf-budgets.md` baseline từ 2026-07-17 (~1822 KB) chưa chắc còn đúng sau 47+ blog chunk. Nên chạy `scripts/check-bundle-size.mjs` lấy số thật trước khi cam kết "+3 KB không sao".

**Files load-bearing đã tự mở:**
`src/pages/Rankings.tsx` · `functions/_lib/render/rankings.ts` · `src/content/dupr-rankings.ts` · `src/hooks/dupr/useVietnamRankings.ts` · `src/lib/pro-tour/adapters/rsc-scraper.ts` · `workers/pro-tour-scraper/wrangler.toml` · `workers/news-fetcher/wrangler.toml` · `functions/_middleware.ts:580` · `functions/_lib/utils.ts:44` · `functions/sitemap-static.xml.ts:81-82` · `public/_headers:71` · `docs/perf-budgets.md` · `supabase/migrations/20260802131500_ops_job_health_dashboard.sql`
