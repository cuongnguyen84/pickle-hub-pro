## Verdict: 🔴 RED
Ship phần OG như đề bài mô tả và tên thật của người chơi trong **18 giải flex `is_public = false`** sẽ được publish ra Zalo/Facebook cho bất kỳ ai gửi User-Agent giả dạng crawler — leak này không revert được vì cache của Zalo/FB và ảnh chụp màn hình nằm ngoài tầm với.

Classifier: **không chạy được** — `scripts/agents/risk-tier.mjs` không tồn tại (`scripts/agents/` không có trong repo; khớp memory `idea-pipeline-missing-scripts`). Em tự đặt tier, không có sàn máy móc để dựa vào.

**Carve-out AMBER rõ ràng** (panel ship được ngay): chỉ `quick_tables`, chỉ derive read-only, chỉ card + trang chi tiết + native. Bỏ OG, bỏ flex, bỏ doubles-elim, không migration, không trigger. Phần đó `git revert` là đủ.

---

## Rủi ro cụ thể

| # | Mức | Cơ chế hỏng | Người dùng thấy gì | Giảm thiểu |
|---|-----|-------------|--------------------|------------|
| 1 | **Cao** | `supabase/functions/og-flex-tournament/index.ts:47` SELECT cột `is_public` nhưng **không bao giờ kiểm tra nó**; client tạo bằng `SUPABASE_SERVICE_ROLE_KEY` (dòng 43) → bypass RLS. Gate duy nhất là regex User-Agent (dòng 21). Prod có **18 flex `is_public=false`**. | `curl -A "facebookexternalhit" .../og-flex-tournament?id=<share_id>` trả tên giải riêng tư — thêm champion là trả luôn **tên thật người chơi** của giải riêng tư. | Fix `is_public` gate TRƯỚC, trong PR riêng, rồi mới bàn OG. Non-public → trả 404 bất kể UA. |
| 2 | **Cao** | Lỗ y hệt ở tầng thứ hai mà GPT-5.6 không thấy: `functions/_lib/supabase.ts:10-15` cũng dùng service role, và `functions/_lib/render/tournaments.ts:191` `renderFlexTournament` query `flex_tournaments` **không lọc `is_public`**. Cùng 18 row. | Bot bất kỳ (kể cả Googlebot thật) lấy được tên giải riêng tư + champion qua Pages middleware, và nó bị **cache vào KV `pr:v32:` 6 giờ**. | Cùng patch với #1. Sau khi vá phải `?nocache=1` từng path đã bị nhiễm. |
| 3 | **Cao** | Nếu chọn denormalize: cột champion trên `quick_tables`/`doubles_elimination_tournaments` = **migration prod**, và `git revert` KHÔNG undo được migration (`docs/ops-runbook.md` §4.3: "No automatic down-migrations"). Bằng chứng thực nghiệm cột denormalized bị bỏ rơi đã có sẵn: `doubles_elimination_teams.final_placement` tồn tại, **NULL trên cả 178/178 row**, chưa từng được ghi. | Card hiện sai champion hoặc trống vĩnh viễn với event mới, không có cách rollback ngoài migration thứ hai. | KHÔNG denormalize. Derive read-only. |
| 4 | **Cao** | Nếu ghi champion bằng trigger: `doubles_elimination_matches` đã có `advance_doubles_elimination_after_score` (AFTER UPDATE) — chính là đường lan winner sang vòng sau. Trigger mới stack lên cùng transaction lưu điểm; một EXCEPTION trong nó abort luôn UPDATE điểm. | Trọng tài bấm lưu điểm → báo lỗi hoặc im lặng không lưu → **mất slot bracket**. `docs/slo.md` SLO 4: "a lost bracket slot = incident, not a rate". | Cấm trigger trên bảng match cho một tính năng hiển thị. |
| 5 | **TB** | `src/pages/Tournaments.tsx:200-211` gọi 11 `useQuery` **vô điều kiện lúc mount**, kể cả khi tab mặc định là `featured`. Thêm query derive champion → nó chạy trên first paint của MỌI lượt vào `/tournaments`. Đo thật trên prod (EXPLAIN ANALYZE, role `anon`): planning 35.6 ms + execution 86.3 ms, 880 shared buffer hits, subplan RLS chạy **196 lần** (1 lần/row). | Người dùng VN mobile: thêm 1-2 round-trip Supabase (150–400 ms/RTT) vào đường LCP của trang họ không hề mở tab đó. | Query champion CHỈ cho id đang render; đưa vào cùng RPC/view, không fetch toàn bộ playoff match. |
| 6 | **TB** | `limit: 100` hard-code (`Tournaments.tsx:202`) trong khi đã có **88 completed quick_tables**. Khi vượt 100, event cũ rơi khỏi pool. | Sub-event trên card FEATURED MULTI-EVENT (hook riêng `useFeaturedParentTournaments.ts:44-77`, không có limit) mất dòng vô địch một cách ngẫu nhiên. | Derive theo id thực render, không theo pool "100 mới nhất". |
| 7 | **TB** | Hai định nghĩa "ai vô địch" song song. `supabase/migrations/20260517000000_tournament_results_feed.sql:76` (`surface_quick_table_results`, chạy cron job 5 lúc 06:00 UTC) quyết winner bằng `score1 > score2`. Đề xuất mới dùng `winner_id`. **Hôm nay 210/210 trận playoff completed khớp nhau, 0 lệch, 0 hòa** — nên đây chưa phải sự cố, mà là nợ chắc chắn phát sinh. | Feed hiển thị một tên, card `/tournaments` hiển thị tên khác cho cùng giải. | Một hàm SQL duy nhất, cả cron lẫn UI đọc chung. |
| 8 | **TB** | Meta description SSR bị clamp theo **BYTE**: `functions/_lib/html.ts:98-99` `SEO_TITLE_MAX_BYTES=60`, `SEO_DESCRIPTION_MAX_BYTES=160`, cắt tại `truncateForSeo` (dòng 157-158). Tên VN có dấu = 2-3 byte/ký tự. Nối "Vô địch: Nguyễn Văn Cường & Trần Thị Nam" vào desc là vượt trần. | Đúng lớp bug đã nổ ở #468 (memory `seo-en-blog-body-and-byte-budget`): description bị cắt giữa chừng kèm dấu "…". | Nếu vẫn muốn đưa champion vào SSR: đo byte trước, và trang chi tiết đằng nào cũng `noindex` (xem mục SEO) nên nên bỏ hẳn. |
| 9 | **TB** | og-* là **hàm traffic thấp nhất fleet** — chỉ chạy khi có người share link. Đây đúng là class bị `NOT_FOUND_FUNCTION_BLOB`: blob bị evict sau 30–90' idle, re-fetch fail (memory `blob-loss-root-cause-2026-07-26`, ticket SU-429781 **chưa đóng**). | Người dùng share link giải vừa xong lên Zalo → không có preview nào cả, chứ đừng nói champion. Tính năng "khoe nhà vô địch khi share" nằm trên bề mặt kém tin cậy nhất hệ thống. | Không hứa OG là đường phân phối chính. Nếu vẫn làm: thêm og-* vào canary của watchdog. |
| 10 | **Thấp** | Nếu resolve tên champion qua ghost profile: id ghost = `md5('tphtg:'||lower(trim(name)))::uuid` (migration `20260517000000...sql:114-116`). Hai người trùng tên → gộp thành một identity. Prod đã có **556 ghost profile** trong `public_profiles`. | Card gán chức vô địch cho hồ sơ của người trùng tên. | Đọc `quick_table_players.name` trực tiếp, đừng đi qua `public.matches`. |
| 11 | **Thấp** | `quick_table_players.name` là free text BTC gõ tay (1096 row, 744 tên phân biệt), không giới hạn độ dài. | Tên dài không dấu cách làm vỡ layout card web + khác hẳn native. | `min-width:0` + truncate; SwiftUI `lineLimit(1)`. |

**Sự thật khó chịu về ROI** (không phải rủi ro kỹ thuật nhưng quyết định có nên làm): champion chỉ derive được cho **23/88 (26%)** quick_tables đã completed. 64 giải round-robin completed **không có trận playoff nào** và có 2/3/4/6/8 bảng (phân bố: 2→23, 3→11, 4→34, 6→7, 8→9) — về mặt cấu trúc **không tồn tại nhà vô địch duy nhất**. 4 giải `large_playoff` completed có **0 trận**. `doubles_elimination_tournaments`: **0 giải completed** trên tổng 5 → format này sẽ không hiển thị gì, ngày nào cũng vậy, cho tới khi có giải đầu tiên xong. Nhánh "ẩn dòng vô địch" là đường CHÍNH (74%), không phải edge case.

**Đính chính recon:** recon nói auto-archive 14 ngày là nguyên nhân "completed mà chưa có champion". Sai — `auto-archive-tournaments` **không có job nào trong `cron.job` prod** (đã liệt kê 15 job, không có nó; khớp memory `cron-auth-gate`). 64 giải kia là BTC chạy vòng bảng rồi dừng, không phải hệ thống tự archive.

## SLO bị đe doạ
- **SLO 4 (Scoring — zero lost-update incidents):** chỉ khi chọn trigger trên `doubles_elimination_matches`/`quick_table_matches`. Đường read-only KHÔNG chạm.
- **SLO 6 (Latency VN p75, LCP ≤ 2.5s):** query champion chạy trên first paint `/tournaments` (rủi ro #5). Đo được, không phải suy đoán: +122 ms DB + RTT.
- **SLO 1 (Availability):** không.
- SLO 2/3/5/7: không chạm.

## Ngân sách hiệu năng
- Bundle: ước +2–4 KB gz (1 hook derive + 1 dòng render + key i18n) → ~1826 / **1970 KB**. Headroom thật theo `docs/perf-budgets.md` là **~148 KB** (total hiện ~1822), không phải ~20 KB. Không phải vấn đề.
- INITIAL không đổi: `/tournaments` là lazy route (`src/App.tsx:50` `lazyRetry(() => import("./pages/Tournaments"))`).
- **Vietnam p75:** đây mới là chỗ đau. Không phải KB, mà là round-trip. Nếu derive champion nằm trong hook chạy lúc mount, mọi lượt vào `/tournaments` (kể cả tab Featured) trả thêm ~122 ms DB + 150–400 ms RTT. Yêu cầu: gộp vào 1 query, hoặc chỉ fire khi `fmtStatus === "ended"`.

## SEO
- Routes SSR bị ảnh hưởng: **none** — nếu giữ carve-out. Trang chi tiết 4 format đều đã `noindex`: `functions/_lib/render/tournaments.ts:112` (quick-tables), `:123` (team-match), `:185` (doubles-elim), `:199` (flex). Trang `/tournaments` có index nhưng `renderTournaments` (`:74`) chỉ liệt kê bảng `tournaments` (pro tour), không đụng community card.
- Cần bump `pr:v26`? **Không** — key hiện tại là **`pr:v32`** (`functions/_middleware.ts:462`; CLAUDE.md ghi v30 đã lỗi thời, recon ghi đúng). Bump v32→v33 sẽ **flush toàn bộ mọi route** (blog, /san, news, rankings) để đổi nội dung trên trang đã noindex — MISS hàng loạt, mỗi MISS chạy chuỗi query Supabase Tokyo với budget 8s (`_middleware.ts:487`), timeout → Googlebot nhận SPA shell rỗng. Bump là tự bắn chân, không đổi lại gì.
- Ngoại lệ duy nhất buộc bump: nếu vá lỗ `is_public` ở `renderFlexTournament` thì **phải** dọn HTML đã cache của giải riêng tư — nhưng dùng `?nocache=1` cho từng path (18 path) rẻ hơn nhiều so với bump global.
- Verify: `curl -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" "https://www.thepicklehub.net/tools/flex-tournament/<share_id_private>"` → **phải** 404, không được lộ tên.

## Kế hoạch rollback
- **Carve-out AMBER (quick_tables, read-only, web+native card/detail):** `git revert` + Cloudflare Pages deploy. **~5–10 phút.**
- **Đổi code og-*:** revert + deploy-guard redeploy hàm đó. ~5 phút cho code — **nhưng preview đã bị Zalo/Facebook scrape thì không thu hồi được**. Không phải rollback, là thiệt hại vĩnh viễn.
- **Migration (denormalize):** không có down-migration. Phải viết migration thứ hai. `docs/ops-runbook.md` §4.3.
- **Native /apple:** qua App Store review. Không có nút revert. Bản cũ nằm trên máy user vô thời hạn — và nếu champion là cột denormalized do app-code ghi, bản native cũ kết thúc trận chung kết sẽ **không ghi cột đó**, để card web sai vĩnh viễn. Đây là lý do thứ hai để không denormalize.
- **Không revert được:** (a) OG đã bị bên thứ ba cache, (b) migration, (c) binary native. Ba thứ này là cái làm nó RED.

## Phải verify trước khi merge
- [ ] `curl -A "facebookexternalhit/1.1" "https://ajvlcamxemgbxduhiqrl.supabase.co/functions/v1/og-flex-tournament?id=<share_id_của_1_giải_is_public=false>"` → phải KHÔNG trả tên giải. Hôm nay nó trả. Đây là **điều kiện chặn** cho bất kỳ scope nào chạm OG.
- [ ] `curl -A "Googlebot" "https://www.thepicklehub.net/tools/flex-tournament/<private_share_id>"` → 404.
- [ ] Chrome DevTools Network trên `/tournaments` tab Featured: đếm request Supabase trước/sau. Không được tăng.
- [ ] `SELECT count(*) FROM quick_tables WHERE status='completed'` — nếu >100, `limit(100)` đã bắt đầu nuốt dữ liệu (hiện 88).
- [ ] `npm run build && node scripts/check-bundle-size.mjs` → total ≤ 1970 KB gz.
- [ ] `npm run auth:registry -- --strict` nếu đụng `supabase/config.toml`.
- [ ] `git diff --stat -- supabase/migrations/` → phải **rỗng**. Có file = tier RED, dừng, chuyển cho Cuong.
- [ ] `git diff --name-only -- supabase/functions/_shared/` → phải rỗng (chạm là redeploy cả 75 hàm giữa lúc SU-429781 chưa đóng).
- [ ] Test: 1 giải round_robin 4 bảng không playoff → card KHÔNG hiện dòng vô địch (đây là 74% dữ liệu thật, không phải edge case).

## Phản biện độc lập (GPT-5.6)
Nguyên văn prompt + reply: `docs/proposals/champion-on-event-card/external/risk-auditor-gpt56.md`

**Đã xác minh trong repo — nó đúng:**
- **#1 leak flex riêng tư qua og-*:** đúng 100%, xác minh tại `supabase/functions/og-flex-tournament/index.ts:43,47` + 18 row `is_public=false` trong prod. Đây là finding mạnh nhất của nó và là thứ đẩy verdict lên RED.
- **#5 `limit(100)` pool:** đúng, `src/pages/Tournaments.tsx:202`, và 88/100 đã dùng hết.
- **#6 hai định nghĩa winner:** đúng, và nó **tự trung thực** rằng hôm nay 210/210 khớp nên chưa phải sự cố — em xác nhận con số đó bằng query riêng.
- **#7 cache OG bên thứ ba:** đúng, `Cache-Control: public, max-age=60` (`og-quick-table/index.ts:151`) không ràng buộc Zalo/FB.
- **#9 blob-loss trúng đúng class hàm idle:** đúng, khớp cơ chế đã xác minh trong SU-429781.
- **#10 ghost-profile trùng tên gộp identity:** đúng, `md5('tphtg:'||lower(trim(name)))::uuid`, migration `20260517000000...sql:114-116`.
- Phần "không phải sự cố" của nó đều đúng và em giữ nguyên: không cần bump `pr:v32`, không cần migration, native explicit-column-list nên thêm cột không phá bản cũ, và derive read-only không đe doạ optimistic lock.

**Bác bỏ:**
- **#2 "HTML injection qua tên champion trong OG":** SAI. Cả 4 hàm og-* đều đã escape: `esc()` trong `og-quick-table/index.ts:157-164`, `og-flex-tournament`, `og-doubles-elimination`; `escapeHtml()` trong `og-tournament/index.ts:114-115`. Tầng Pages Functions cũng escape: `functions/_lib/html.ts:195-211`. GPT không đọc được repo nên suy đoán template thô — đây đúng là loại hallucination phải chết ở đây thay vì lọt vào proposal.
- **#4 "sửa `advance_doubles_elimination_after_score` sẽ tạo lost bracket slot":** cơ chế đúng nhưng nó tự đưa vào rồi tự khuyên đừng làm — không ai đề xuất sửa trigger đó. Em giữ lại dưới dạng **guardrail** (rủi ro #4), không phải cảnh báo về đề xuất hiện tại.
- **#3 "flex không có định nghĩa final":** đúng về schema nhưng nó bỏ sót số thật: flex chỉ có **5 giải completed public, 2 giải có trận quyết định**. Rủi ro thật thấp hơn nó nghĩ; lý do loại flex là ROI ≈ 0, không phải nguy hiểm.

**GPT-5.6 thấy mà em không thấy:** lỗ `is_public` ở `og-flex-tournament` — em đã đọc file đó và ghi nhận nó "SELECT is_public" mà chưa nối được sang kết luận "và không bao giờ dùng". GPT nối ngay. Đổi lại, GPT **không** thấy lỗ song sinh ở `functions/_lib/render/tournaments.ts:191` + `functions/_lib/supabase.ts:10-15` (cùng bug, file khác, có thêm KV cache 6h làm nặng hơn) — cái đó là của em.

Panel **không** chạy một-model-down; `OPENAI_API_KEY` có sẵn. Nhưng `scripts/agents/risk-tier.mjs` và `scripts/agents/ask-model.mjs` đều không tồn tại — em gọi API thẳng bằng `curl` và tự đặt tier, ghi rõ ở đây để không ai tưởng có sàn phân loại máy móc chống lưng.
