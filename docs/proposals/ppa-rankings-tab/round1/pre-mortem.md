# pre-mortem — ppa-rankings-tab (2026-08-06)

Ba câu chuyện dưới đây được viết như thể feature đã ship 2026-08-06 và đã hỏng. Mọi mắt xích trỏ tới file thật trong repo tại HEAD `712bf549`.

---

## Sự cố 1 — "Bảng xếp hạng Việt Nam biến mất khỏi Google trong 5 tuần, không ai bấm nút nào"

**Xác suất:** cao · **Thời gian tới lúc phát hiện:** 4–8 tuần (và chỉ khi có người chủ động mở GSC)

**Timeline**

- **T+0** (ngày ship): PR "feat(rankings): PPA Tour scope + default" merge vào main. Diff chạm `src/pages/Rankings.tsx`, `src/content/dupr-rankings.ts`, `functions/_lib/render/rankings.ts`. `node scripts/agents/risk-tier.mjs` chấm 🟡 AMBER (rule `scripts/agents/risk-tier.mjs:75-79` — `functions/_lib/render/` = AMBER, "stale KV HTML survives a revert"). Không cần Cuong duyệt RED. Cache key được bump `pr:v33` → `pr:v34` đúng quy trình.
- **T+2 giờ**: `curl -A "Googlebot" https://www.thepicklehub.net/rankings?nocache=1` trả 200, title "PPA Tour Rankings | ThePickleHub", `<ol>` 25 dòng, JSON-LD ItemList hợp lệ. Verify PASS. Ship xong.
- **T+3 ngày**: Googlebot recrawl `/rankings` (sitemap khai `changefreq: daily, priority 0.9` — `functions/sitemap-static.xml.ts:81-82`). Nội dung mới thay nội dung cũ trong index.
- **T+5 ngày**: Googlebot đi theo link nội bộ trong body SSR — `functions/_lib/render/rankings.ts:118` giờ trỏ `.../rankings?scope=vietnam`. Nhận về **đúng HTML PPA vừa cache**. Crawl lại lần nữa, vẫn thế.
- **T+2 tuần**: query "bảng xếp hạng dupr việt nam", "dupr việt nam", "xếp hạng pickleball việt nam" tụt khỏi trang 1. Không có lỗi 404, không có lỗi crawl, GSC Coverage vẫn xanh "Đã được gửi và lập chỉ mục".
- **T+5 tuần**: Cuong tình cờ mở GSC vì mốc `SEO-CLUSTER-READ` (2026-08-23, `docs/milestones.md:17`) — mốc đó nói về cụm *bracket generator*, không phải rankings. Thấy tổng click giảm thì mới đi tìm.

**Cơ chế**

`functions/_middleware.ts:609` → `routeAndRender(url.pathname, env, siteUrl)` — **query string không bao giờ được truyền vào tầng render**. `functions/_middleware.ts:712` nhận `pathname: string`, `:713` `const rawPath = pathname`. Không một handler SSR nào trong repo này nhìn thấy `?scope=`.

`functions/_middleware.ts:580` → `const cacheKey = pr:v33:${url.pathname}` — query string cũng không nằm trong khoá cache. Hai sự thật này cộng lại: **`/rankings?scope=vietnam` và `/rankings` là cùng một trang đối với mọi bot, ở cả tầng cache lẫn tầng render.**

`functions/_lib/html.ts:197` → `<link rel="canonical" href="${url}"/>` với `url = ${siteUrl}${rawPath}` (`rankings.ts:108`) → canonical của `/rankings?scope=vietnam` là `/rankings`. Google gộp đúng theo canonical mình khai.

Hệ quả hợp thành: sau khi PPA thành mặc định SSR, **không tồn tại một URL nào mà Googlebot có thể fetch để nhận nội dung xếp hạng Việt Nam.** Không phải "khó index" — là *không có địa chỉ*. Nội dung DUPR Việt Nam (nội dung duy nhất trên site này không ai khác có: `dupr_leaderboard_vietnam` đọc từ chính profile user) rơi khỏi index không phải vì bị chặn mà vì bị mất chỗ đứng.

Ba thứ vô hại: (1) đổi tab mặc định — quyết định sản phẩm hợp lý; (2) cache key bỏ query string — tối ưu đúng, có từ lâu, giảm cardinality KV; (3) một handler SSR cho một pathname — kiến trúc sạch. Gặp nhau thì thành cắt cụt SEO.

**Vì sao mọi gate vẫn xanh**

- `tests/seo.spec.ts:135-141` kiểm `/rankings`: status 200, `<title>` khớp `/(ranking|xếp hạng)/i`. "PPA Tour Rankings" khớp hoàn hảo. Gate này **không biết** trang nói về nước nào. Bonus: comment ở `:137-139` vẫn ghi "Rankings page is currently EN-only; no /vi/rankings twin shipped yet" và đặt `expectsHreflang: false` — trong khi `rankings.ts:103` đã phát hreflang đủ bộ từ lâu. Gate đang stale so với code nó gác.
- `scripts/seo/canonical_monitor.py:48` có `/rankings` trong danh sách — nó kiểm canonical *nhất quán*, mà canonical vẫn nhất quán. Đúng theo định nghĩa của nó, và mù theo cái đang hỏng.
- `tests/journeys.spec.ts:251` (J8) deep-link `?scope=asia`, bấm sang scope Vietnam, kiểm có link `/nguoi-choi/`. Toàn bộ chạy trên nhánh SPA — nơi `?scope=vietnam` **vẫn hoạt động hoàn hảo**. Gate xanh và nó *đúng*: con người không mất gì.
- `tests/visual.spec.ts:38,48` (`rankings`, `rankings-vi`) **đỏ** — và bị approve baseline mới, hoàn toàn chính đáng, vì đổi tab mặc định thì ảnh phải đổi. Gate duy nhất kêu đã được tắt tiếng bằng một hành động đúng.
- Soak 30 phút đo `client_errors`. Không có lỗi nào. Đây không phải lỗi.
- `ops_edge_function_registry` có `pages-prerender` nhưng `probe_url` là `https://www.thepicklehub.net/` (`supabase/migrations/20260804120000_ops_monitoring_coverage_expansion.sql:68-70`) — probe trang chủ, không phải `/rankings`.

**Ai báo, sau bao lâu**

Không ai. Người dùng VN không mất gì (SPA vẫn có tab Việt Nam, chỉ là không mặc định) nên không có ai chửi trên Facebook. Tracker organic hằng tuần chỉ tồn tại cho `/san` (`docs/milestones.md:20`, `scripts/seo/gsc_report.py --page-contains /san/`), không có tracker cho `/rankings`. Phát hiện thực tế: Cuong tự mở GSC sau 4-8 tuần, hoặc lúc đọc mốc SEO khác.

**Vì sao khó sửa**

`git revert` khôi phục code trong ~10 phút. Không khôi phục được thứ hạng: Google cần crawl lại + đánh giá lại, và một trang bị mất trust trên một cụm query phải leo lại từ đầu — theo chính bài học repo, "recovery is crawl-rate-bound, not deploy-bound" (`scripts/agents/risk-tier.mjs:82`). Với site này chu kỳ đó tính bằng tuần. Và revert nghĩa là bỏ luôn feature Cuong muốn — sửa đúng là tách URL (`/rankings/ppa` riêng, có entry sitemap + handler SSR riêng), tức là làm lại phần lớn phần SSR.

**Dấu hiệu sớm lẽ ra phải có**

Một dòng trong `tests/seo.spec.ts` khẳng định body SSR của `/rankings?scope=vietnam` **khác** body của `/rankings`. Nó sẽ đỏ ngay ngày ship, trước khi Google kịp nhìn. Không tồn tại vì chưa ai từng tưởng tượng hai URL khác nhau có thể trả cùng một byte.

---

## Sự cố 2 — "Bot thấy bảng PPA đầy đủ 100 dòng. Người Việt thấy 'Không tải được dữ liệu.' Suốt 9 ngày."

**Xác suất:** cao · **Thời gian tới lúc phát hiện:** 3–10 ngày

**Timeline**

- **T+0**: migration `2026080xxxxxx_ppa_rankings.sql` áp lên prod qua Management API trước khi merge (đúng `docs/ops-runbook.md:13`). Migration có `GRANT SELECT ON public.ppa_rankings TO anon` (luật `.claude/memory/lessons-learned.md:19-39` đã thuộc lòng, 3 lần tái phát nên ai cũng nhớ) — nhưng **quên `GRANT EXECUTE ON FUNCTION public.ppa_leaderboard(TEXT, INT) TO anon, authenticated`**. Cái template trong lessons-learned nói về **bảng**, không nói về **hàm**; và hàm là `SECURITY DEFINER` nên cảm giác "đã an toàn rồi".
- **T+0 + 20'**: Pages deploy xong. `curl -A "Googlebot" .../rankings` → 200, bảng 100 dòng, JSON-LD ItemList đủ. ✅
- **T+0 + 25'**: Cuong mở `/vi/rankings` trên Chrome đang đăng nhập admin. Thấy bảng đầy đủ. ✅
- **T+1 đến T+9**: mọi khách vãng lai — tức ~95% traffic, tất cả đều anonymous — mở `/vi/rankings` và thấy `⚠ Không tải được dữ liệu · Vui lòng tải lại trang.` ngay trên **tab mặc định** của trang. Họ tải lại. Vẫn thế. Họ đóng tab.
- **T+9**: một người nhắn Facebook page: "trang xếp hạng lỗi rồi anh ơi".

**Cơ chế**

`functions/_lib/supabase.ts:10-15` → SSR dựng client bằng **`SUPABASE_SERVICE_ROLE_KEY`**. `service_role` bỏ qua toàn bộ GRANT/RLS. Nhánh bot **không thể** phát hiện thiếu grant — về mặt cấu tạo.

`src/hooks/dupr/usePpaRankings.ts` (mới, sao chép `useVietnamRankings.ts`) → `supabase.rpc(...)` bằng **anon key** (`src/integrations/supabase/client.ts`). Thiếu `EXECUTE` → PostgREST trả `42501 permission denied for function` → `if (error) throw error` → React Query `isError`.

`src/pages/Rankings.tsx:389-398` → nhánh `isError` render `tl-empty-card` với chữ "Không tải được dữ liệu / Vui lòng tải lại trang". Không có `console.error`, không có `window.onerror`, không có unhandled rejection — React Query nuốt gọn. `src/lib/errorReporter.ts` không bao giờ được gọi.

Đối chứng: `supabase/migrations/20260528010000_dupr_leaderboard_vietnam_rpc.sql:88` có đúng dòng `GRANT EXECUTE ON FUNCTION public.dupr_leaderboard_vietnam(TEXT, INT) TO anon, authenticated;`. Hàm mới phải sao chép dòng đó. Không có gate nào ép.

Ba thứ vô hại: (1) SSR dùng service_role — đúng và cần thiết cho bot; (2) React Query bắt lỗi và render error state — đúng theo convention DS-04; (3) một dòng GRANT bị quên — lỗi kinh điển nhất của repo này. Gặp nhau thì thành: **trang hỏng hoàn toàn cho người dùng, và hoàn hảo cho mọi công cụ đo.**

**Vì sao mọi gate vẫn xanh**

- `tests/seo.spec.ts:135` chạy nhánh Googlebot → service_role → 100 dòng. Xanh.
- `tests/smoke.spec.ts:31` mở `/rankings`, kiểm `<title>` không chứa `undefined` và không có console error thuộc lớp chunk-load (`tests/smoke.spec.ts:44-55` DENY list). Error state của React Query **không in ra console** → không có gì để bắt. Xanh.
- `tests/a11y.spec.ts:199` mở `/rankings` rồi chạy axe. Một `tl-empty-card` là HTML hợp lệ, accessible hoàn hảo. Xanh.
- `tests/journeys.spec.ts:251` (J8) bắt đầu bằng `?scope=asia` — dữ liệu tĩnh từ `src/content/dupr-rankings.ts`, không đụng RPC nào — rồi bấm sang `vietnam` (RPC cũ, có grant). **Không bao giờ chạm scope PPA.** Xanh.
- `tests/human-path.spec.ts` — gate được dựng 27/07 chính vì bài học "gate của repo này chỉ đo nhánh BOT" (`.claude/memory/lessons-learned.md:478`) — có đúng **3 test**: story card trang chủ, bài VI không tồn tại, link nội bộ `/vi`. Không có `/rankings`. Cái gate sinh ra để chống đúng lớp lỗi này lại không phủ trang đang đổi.
- `supabase/tests/rls_auth_matrix.test.sql` kiểm bảng nào bật RLS, policy nào mồ côi. **Không kiểm `has_function_privilege`** cho bất kỳ RPC nào.
- Panel duyệt: đọc migration, thấy khối GRANT cho bảng đầy đủ đúng template, tick.
- Soak 30': `client_errors` 0 dòng mới. Chính xác — không có exception nào tồn tại.

**Ai báo, sau bao lâu**

Người dùng, qua Facebook, sau ~1 tuần. Không phải monitoring. Lý do trễ: người Việt vào trang xếp hạng không quá thường xuyên, và ai gặp lỗi thì bỏ đi chứ không nhắn tin. Nếu chỉ quên `anon` mà không quên `authenticated`, Cuong (luôn đăng nhập) sẽ **không bao giờ tự thấy** — đây là lý do khoảng mù dài: người duy nhất kiểm tra thủ công là người duy nhất không gặp lỗi.

**Vì sao khó sửa**

Sửa dễ nhất trong ba sự cố — một câu `GRANT EXECUTE`, áp qua Management API, sống ngay, không cần deploy. Cái không lấy lại được là 9 ngày × traffic của tab mặc định, và cái giá thật là: sau lần này, "trang xếp hạng bị lỗi" thành ấn tượng dai dẳng của một nhóm user. Đó là loại thiệt hại `git revert` không đụng tới.

**Dấu hiệu sớm lẽ ra phải có**

`curl` một lần bằng **anon key** thay vì Googlebot UA. Repo có sẵn thói quen curl-verify sau deploy nhưng luôn với `-A "Googlebot"` — tức luôn đi vào nhánh service_role. Một dòng `curl -s "$SUPABASE_URL/rest/v1/rpc/ppa_leaderboard" -H "apikey: $ANON"` trong checklist post-deploy đủ để giết cả lớp lỗi này.

---

## Sự cố 3 — "Bảng PPA hiển thị Ben Johns ở hạng 1 và hạng 7 cùng lúc; Pro Tour ngừng cập nhật 11 ngày và bị đổ oan cho Cloudflare"

**Xác suất:** trung bình–cao · **Thời gian tới lúc phát hiện:** 11–20 ngày (phần dữ liệu sai: có thể không bao giờ)

**Timeline**

- **T+0**: `workers/ppa-rankings-scraper/` deploy. `wrangler.toml` được sao chép từ `workers/pro-tour-scraper/wrangler.toml` — bao gồm `crons = ["0 */6 * * *"]` (`:46`), `CLOUDFLARE_ACCOUNT_ID = "7888e97076d4eadd9a8fa409d11dc281"` (`:60`), và cùng secret `CLOUDFLARE_API_TOKEN`. Copy-paste là pattern đúng của repo này; hai worker giờ bắn cùng phút, cùng tài khoản, cùng quota Browser Rendering.
- **T+0 + 6h**: tick đầu tiên. Scraper PPA gọi Browser Rendering 6 lần liên tiếp. `pro-tour-scraper` cùng lúc gọi lần thứ 7 cho một watchlist row → Cloudflare trả `success: false` hoặc 429.
- **T+0 + 6h + 1'**: `workers/pro-tour-scraper/src/index.ts:588-590` ném `[render-http] 429 ...` → `:321` catch → `recordFailure` → `ok: false`. `:199-207`: **`next_scrape_at` cố ý KHÔNG được đẩy tới** (bản vá Codex P2 trên PR #29, hoàn toàn đúng đắn) → row lại "due" ở tick sau → lại đụng đầu → lại fail. Vòng lặp đói vĩnh viễn, cứ 6 giờ một lần.
- **T+1 ngày**: `ops-job-digest` buổi sáng gửi Telegram. Trong đó có dòng `pro-tour-scraper: failed`. Cuong đọc lướt. `pro-tour-scraper` từng "failed" vì event kết thúc, vì MLP 0 matchups, vì blob-loss — **dòng này là tiếng ồn nền đã quen**.
- **T+3 ngày**: một trong các lần render PPA cũng bị 429. Scraper PPA parse được 4/6 format. Upsert 4 format mới, 2 format giữ nguyên dữ liệu tuần trước.
- **T+3 ngày + 1'**: worker ghi `ops_record_job_run` với `status: "success"` — logic đếm giống hệt `workers/news-fetcher/src/index.ts:140`: "fail" tính theo *nguồn ném exception*, còn trang render HTML rỗng/thiếu là `fetched: 0` và vẫn `ok: true` (`workers/news-fetcher/src/index.ts:203-215`). Digest xanh.
- **T+11 ngày**: Cuong mở `/admin/pro-tour`, thấy log fail chất đống 11 ngày. Nghi blob-loss, redeploy `pro-tour-trigger-scrape --use-api`. Không ăn thua. Mất nửa ngày mới nghĩ tới quota — thủ phạm nằm ở một worker **khác**, mới, đang báo "success".
- **Phần dữ liệu sai**: không có mốc thời gian. Nó chỉ ở đó.

**Cơ chế**

`workers/pro-tour-scraper/src/index.ts:516` → Browser Rendering REST API. Quota và concurrency tính **theo account**, không theo worker. `CLOUDFLARE_ACCOUNT_ID` hard-code trong `[vars]` của cả hai `wrangler.toml` → một tài nguyên chung, hai consumer, không consumer nào biết consumer kia tồn tại.

`workers/pro-tour-scraper/src/index.ts:585-590` → `if (!res.ok) throw` — không phân biệt 429 (retry-able, tự gây) với 500 (nguồn hỏng). `:199-207` → không đẩy `next_scrape_at` khi fail. Hai cái đúng riêng lẻ, cộng lại thành **starvation loop**.

Phần dữ liệu bẩn: upsert theo khoá tự nhiên **không có tombstone** — không `DELETE FROM ppa_rankings WHERE format = $1 AND scraped_batch <> $2`. Với `(format, player_slug)`: VĐV tụt hạng nhưng lô này parse thiếu → giữ hạng cũ → hai người cùng hạng 7. Với `(format, rank)`: hạng 1-40 là tuần này, 41-100 là tuần trước → một VĐV xuất hiện ở **cả hai** vị trí. Không exception, số dòng không đổi, `inserted > 0`, monitor xanh.

**Vì sao mọi gate vẫn xanh**

- Worker không nằm trong Pages deploy. CI không chạy nó. `wrangler deploy` là hành động tay, ngoài mọi gate — chính vì thế `scripts/agents/risk-tier.mjs:52-56` chấm `workers/*/src/` là **RED**. RED được Cuong duyệt tường minh, đúng quy trình. Duyệt tier không phải duyệt cơ chế: không ai hỏi "worker mới này tiêu quota của ai".
- Test offline dùng fixture: **fixture không bao giờ 429.** Adapter parse fixture ra 100 dòng, test xanh, mãi mãi.
- Soak 30 phút chạy ngay sau deploy. Cron 6 giờ một lần: **cú va chạm đầu tiên xảy ra sau khi soak kết thúc từ lâu.**
- `ops_job_registry` (`supabase/migrations/20260802131500_ops_job_health_dashboard.sql:69,71`): job mới **quên đăng ký** thì mất tích khỏi dashboard; **nhớ đăng ký** thì báo "success" đều đặn trong khi phục vụ dữ liệu trộn hai tuần.
- Trang `/rankings` hiển thị dữ liệu sai một cách hoàn toàn tự tin. Không có badge "cập nhật lúc" cho scope PPA (scope Vietnam có badge `◐` khi rating cũ >30 ngày, `src/pages/Rankings.tsx:426-429` — pattern có sẵn nhưng gắn với `dupr_synced_at` từng dòng, không phải `scraped_at` của cả lô).

**Ai báo, sau bao lâu**

Phần Pro Tour: Cuong tự thấy sau ~11 ngày khi mở `/admin/pro-tour`, mất thêm nửa ngày điều tra sai hướng. Phần dữ liệu PPA sai: **có thể không ai báo bao giờ.** Người dùng VN không thuộc lòng bảng xếp hạng PPA — đó chính là lý do họ vào xem. Không có ai trong tập người dùng đủ điều kiện phát hiện lỗi.

**Vì sao khó sửa**

Revert code worker không đủ — `wrangler delete` hoặc sửa cron rồi deploy tay (main không phải nguồn sự thật của worker, đúng `risk-tier.mjs:55`). Dữ liệu trong `ppa_rankings` **không phục hồi được**: rankings là snapshot thời điểm, ppatour.com không cho tra lịch sử. Cách duy nhất là truncate và scrape lại — mất sạch lịch sử, và nếu SEO landing đã index số liệu sai thì Google đã học phiên bản sai đó rồi.

**Dấu hiệu sớm lẽ ra phải có**

- `metrics.rows_parsed` per format ghi vào `ops_record_job_run`, **fail cả run nếu bất kỳ format nào < 90% lần chạy trước**. Repo đã có khuôn mẫu: `workers/pro-tour-scraper/src/index.ts:305-320` "empty-result safeguard" — chỉ bắt `=== 0`, không bắt "ít hơn hẳn lần trước".
- `scraped_at` hiển thị trên UI. Một dòng "Cập nhật: 3 tháng 8" dưới bảng biến "dữ liệu cũ 11 ngày" từ vô hình thành hiển nhiên với **mọi** người xem.

---

## Xếp hạng

| # | Sự cố | Xác suất | Khó phát hiện | Ưu tiên |
|---|---|---|---|---|
| **1** | **#1 — SEO amputation của scope Việt Nam** | Cao (gần như tất yếu nếu đổi default SSR mà không tách URL) | **Rất cao** — 4-8 tuần, mọi gate xanh, không ai báo | **P0** |
| **2** | **#3 — Quota Browser Rendering dùng chung + upsert không tombstone** | TB-cao | **Rất cao cho phần dữ liệu** (có thể vĩnh viễn) | **P1** |
| **3** | **#2 — GRANT EXECUTE thiếu, bot xanh / người đỏ** | Cao (lỗi tái phát nhiều nhất của repo) | TB — 3-10 ngày, tự nó hét lên khi có người báo | **P1** |

---

## Rẻ nhất để chặn từ bây giờ

1. **Đừng để scope PPA sống trong query string.** Cho nó pathname riêng — `/rankings/ppa` + `/vi/rankings/ppa` — dispatch riêng ở `functions/_middleware.ts` (cạnh `:898`), entry riêng trong `functions/sitemap-static.xml.ts`, giữ `/rankings` mặc định Việt Nam ở nhánh SSR. Client vẫn có thể redirect `/rankings` → tab PPA cho người dùng. Giết Sự cố 1 tận gốc và biến "SEO landing" từ nguyện vọng thành có thật. *Nếu vẫn đổi default trên cùng pathname:* thêm assert vào `tests/seo.spec.ts` rằng body SSR của `?scope=vietnam` khác body `/rankings`.
2. **Một dòng curl anon vào checklist post-deploy** (`docs/ops-runbook.md` §5): `curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/<rpc_mới>" -H "apikey: $ANON" ...`. Mọi verify hiện tại đi `-A "Googlebot"` → service_role → mù toàn bộ lớp lỗi grant. *Dài hạn:* assert `has_function_privilege('anon', ..., 'EXECUTE')` trong `supabase/tests/rls_auth_matrix.test.sql`.
3. **Cron lệch pha + guard "ít hơn lần trước".** `crons = ["30 1,7,13,19 * * *"]` cho worker mới (lệch 90' khỏi `0 */6` của pro-tour-scraper). Ghi `rows_parsed` từng format vào `p_metrics`, trả `status: "warning"` khi format nào giảm >10% so lần trước.

Bonus: in `scraped_at` của lô dữ liệu ngay dưới bảng PPA trên UI.

---

## Khoảng hở pipeline mà bài này lộ ra

1. **Mọi gate SEO chạy qua service_role, không gate nào chạy qua anon** (`functions/_lib/supabase.ts:10-15` + `tests/seo.spec.ts` Googlebot UA). Gate SEO mù với toàn bộ lớp lỗi phân quyền — lớp lỗi tái phát nhiều nhất của repo.
2. **`tests/human-path.spec.ts` chỉ có 3 test, không mở rộng theo feature.** Đề xuất: feature nào đổi hành vi mặc định của route đã có trong `tests/smoke.spec.ts:26-37` bắt buộc kèm 1 test human-path cho route đó.
3. **Soak 30 phút không chạm tới cron chu kỳ > 30 phút.** Hoặc proposal nói rõ "soak không phủ job này, đây là lịch tick đầu và ai đọc nó", hoặc có bước "trigger tay cả hai worker cùng lúc rồi đọc `ops_job_runs`".
4. **`risk-tier.mjs` tụt so với bài học sinh ra nó**: lesson 27/07 ghi `functions/_lib/render/*.ts` = RED, code hôm nay (`scripts/agents/risk-tier.mjs:75-79`) chấm AMBER. Sự cố 1 đi qua đúng khe đó.
5. **Không có gì canh organic traffic của `/rankings`.** Feature biến `/rankings` thành landing SEO trọng điểm priority 0.9 → phải tự tạo mốc tracker tuần theo khuôn `SEO-SAN-W33` (ngưỡng giảm >20% WoW = báo).
