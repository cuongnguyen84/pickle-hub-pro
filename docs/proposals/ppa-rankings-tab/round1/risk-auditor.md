# risk-auditor — ppa-rankings-tab (2026-08-06)

External model: GPT-5.6 (`gpt-5.6-sol`), prompt + reply nguyên văn tại `../external/risk-gpt56-prompt.md` / `../external/risk-gpt56-reply.md`.

> ⚠️ **Ghi chú orchestrator:** phiên chạy agent này bị hệ thống gắn cảnh báo bảo mật — file risk-brief gửi sang OpenAI API chứa nhiều dữ liệu business nội bộ (mô hình doanh thu, số user, SLO, security posture, sự cố cũ). Việc hỏi GPT-5.6 là thiết kế của pipeline /idea, nhưng phạm vi dữ liệu gửi đi rộng hơn cần thiết. Cuong đọc `external/risk-gpt56-prompt.md` để thấy chính xác cái đã gửi.

## Verdict: 🔴 RED

**Kết cục xấu nhất có thật:** ThePickleHub tự động mirror toàn bộ bảng xếp hạng thương mại của PPA Tour lên tab **mặc định** của `/rankings` (priority 0.9, `changefreq: daily`) — vi phạm đúng chữ trong Terms of Use của họ; khi PPA chặn IP/đổi endpoint hoặc gửi takedown, tab mặc định đóng băng ở dữ liệu cũ hoặc rỗng, `git revert` không gỡ được bảng đã tạo, Worker đã deploy ngoài repo, và URL Google đã index.

**Classifier said: RED** (`workers/…`, `supabase/migrations/…`). Giữ RED, bổ sung lý do classifier không đọc được từ path: rào cản pháp lý #1 — loại rủi ro không có nút revert.

**Thu hẹp phạm vi (REFINE):** phần **RED** là (a) job scrape + bảng + migration, (b) đổi tab mặc định. Một tab "PPA Tour" **không mặc định**, dữ liệu nhập tay theo lô như `src/content/dupr-rankings.ts`, là **AMBER** và ship được trong tuần.

## Rủi ro cụ thể

| # | Mức | Cơ chế hỏng | Người dùng thấy gì | Giảm thiểu |
|---|-----|-------------|--------------------|------------|
| 1 | **Cao** | ToS ppatour.com (fetch trực tiếp `https://www.ppatour.com/about/terms/` hôm nay), nguyên văn: *"Don't scrape, mirror, or rebroadcast our content commercially without written permission"* + *"commercial use requires a license"*. ThePickleHub là sản phẩm thương mại (`create-payment-order`, livestream). `robots.txt Allow: /` **không** đè được ToS — robots là kỹ thuật, ToS là giấy phép. | Không thấy gì cho tới ngày PPA chặn/gửi thư: tab mặc định rỗng/cũ, Cuong xử lý pháp lý một mình. | **Chặn merge cho tới khi có văn bản cho phép từ PPA.** Không có → phương án "editorial": trích top 10 + link về nguồn, kèm bài WPR explainer có sẵn (`world-pickleball-rankings-wpr-explained.ts`). Trích dẫn ngắn có credit ≠ mirror 2.075 dòng. |
| 2 | **Cao** | Migration tạo bảng + RPC. `docs/ops-runbook.md` §4.3: no automatic down-migrations. `git revert` không un-run SQL trên prod. | (rollback) bảng mồ côi, RLS/GRANT vẫn sống. | PR migration kèm sẵn khối `DROP FUNCTION` + `DROP TABLE` trong mô tả rollback trước khi apply. |
| 3 | **Cao** | Bảng mới **thiếu GRANT** — bug tái phát 3 lần (lessons-learned). Postgres kiểm GRANT trước RLS; SQL Editor chạy superuser nên test tay luôn xanh. | Tab mặc định lỗi/rỗng cho 100% khách (`42501`). Cuong test dashboard thấy bình thường. | Khối GRANT theo template + verify bằng anon key thật, không SQL Editor. |
| 4 | **Cao** | Đổi default client-side mà `renderRankings` vẫn query `dupr_leaderboard_vietnam` + hardcode title/h1 Vietnam (`rankings.ts:27-32,60-68`). | Bot index trang DUPR VN, user thấy PPA — tín hiệu cloaking; "SEO landing PPA" không tồn tại với Googlebot. | SSR + client đổi trong **cùng một PR**, kèm bump KV. |
| 5 | **Cao** | KV key `pr:v33:${pathname}` (`_middleware.ts:580`) — không chứa query string. Nếu SSR đọc `?scope=`, request bot đầu tiên vào `?scope=ppa` ghi HTML PPA vào entry `/rankings`, mọi bot sau nhận bảng đó. | Bot/cache trả sai bảng cho mọi deep-link. | Hoặc SSR bỏ qua hoàn toàn query string, hoặc đưa scope vào cache key. **Drift:** CLAUDE.md ghi `pr:v32`, code là `pr:v33` → bump lên **v34** + sửa CLAUDE.md. |
| 6 | **Cao** | `rankings.ts:76,92` là **trang SSR duy nhất toàn site** phát 25 link `/nguoi-choi/*` + ItemList JSON-LD (đã grep toàn bộ `functions/_lib/render/` xác nhận). Thay body mặc định bằng PPA xoá 25 link đó. | Không ai thấy trong 4-8 tuần; profile VĐV VN mất crawl path HTML duy nhất từ trang priority 0.9. | Giữ block Vietnam trong SSR (PPA trên, VN dưới, cùng HTML), hoặc dời link trước khi xoá. |
| 7 | **Cao** | Worker deploy ngoài repo. Merge UI + migration trước khi worker chạy thành công, hoặc worker thiếu secret (bài học secret-sync 03/08 — secret giờ sync tay, được phép drift im lặng). | Tab mặc định rỗng. Pages deploy xanh. Không alert. | Thứ tự bắt buộc: migration → deploy worker → **quan sát 1 lần cron thành công có dữ liệu** → mới đổi default (một dòng config đảo được). |
| 8 | **Cao** | Scrape gãy câm. Nguồn là endpoint Next.js nội bộ `ppatour.com/api/rankings/` (xác nhận 200, JSON, 502.737 bytes, Vercel) — không hợp đồng, không version. Đổi shape = parser 0 dòng. Lớp lỗi MLP "0 matchups". | Bảng sai/cũ hiển thị như thật — không badge cập nhật, user tin là live. | (a) guard 0-dòng fail-loud (tiền lệ `pro-tour-scraper/src/index.ts:300-305`); (b) validate schema 2 board + ngưỡng số dòng; (c) **swap nguyên tử giữ last-good** — không TRUNCATE trước khi lô mới pass validate; (d) `updated_at` hiển thị trên UI. |
| 9 | **TB** | Job mới không được giám sát mặc định — `ops_job_registry` là opt-in. Không đăng ký + không gọi `ops_record_job_run` = vô hình với `/admin/jobs` và Telegram. | Job chết nhiều ngày không ai biết. **SLO 5 vẫn xanh vì chỉ đo job đã đăng ký.** | Migration INSERT row registry (`expected_interval_seconds` + `grace_seconds`), worker gọi `ops_record_job_run`. Điều kiện merge, không phải follow-up. |
| 10 | **TB** | "Top sâu" = 2.075 dòng ≈ **217.8 KB raw / 43.9 KB gz** mỗi lượt xem tab mặc định + hàng trăm headshot remote (CSP cho phép, nhưng ảnh không reserve size = CLS). CLS p75 mobile đã ~0.67/0.1. | LCP/INP/CLS tệ đi trên trang mặc định, mạng VN mobile. | Trang đầu ≤100 dòng, phân trang. Headshot: width/height cố định + lazy, hoặc bỏ. Đo `web_vital` segment VN sau deploy. |
| 11 | **TB** | PostgREST `db.max_rows` mặc định 1000 — RPC SETOF fetch một phát cắt ở 1000/2.075 dòng. **Chưa verify được** (không có .env local) — lệnh verify ở dưới. | "Sâu nhất có thể" dừng ở 1000; tuỳ ORDER BY có thể không còn dòng nữ nào. | Nếu đúng: phân trang `Range` header hoặc RPC trả `jsonb` scalar. (Finding của GPT-5.6, Claude bỏ sót.) |
| 12 | **TB** | Đổi default phá deep-link paramless. `useUrlBackedState` resolve một lần lúc mount rồi fallback. `/rankings` trần đổi nghĩa từ "Việt Nam" sang "PPA". | User cũ bookmark bảng VN mở ra thấy Ben Johns. 95% khán giả là người Việt. | Nếu vẫn đổi: đổi link nav `TheLineLayout.tsx:83` thành `/rankings?scope=vietnam`, hoặc **đừng đổi default** — PPA vị trí thứ hai. |
| 13 | **TB** | Đề bài giả định sai nguồn: endpoint thật chỉ có **2 board** `men` (1.324) + `women` (751), WPR tổng hợp. Không có Singles/Doubles/Mixed. | Nếu tái dùng format tabs, nhãn "Đôi nam" trên dữ liệu tổng hợp — số liệu sai nhãn. | `getAvailableFormats()` đã hỗ trợ format-set riêng theo scope. PPA = 2 board, ẩn format tabs. Sửa phạm vi trong intake. |
| 14 | **Thấp** | Phương án static-file: 2.075 dòng ≈ 43.9 KB gz vào CODE chunk. Số đo thật (check-bundle-size 05/08): Total **1888.4/1970 → còn 81.6 KB headroom**; 43.9 KB = 54% headroom cho một feature. | Không hỏng, ăn chỗ. | DB-backed không đụng bundle — chọn nó. (`docs/perf-budgets.md` baseline 1822 KB từ 17/07 đã cũ 66 KB — sửa.) |
| 15 | **Thấp** | 2.075 link outbound tới `ppatour.com/athletes/*` từ trang priority 0.9. | — | `rel="nofollow"` hoặc tên không link. |

## SLO bị đe doạ

- **SLO 5 (Cron 100% monitored-healthy):** job không đăng ký thì SLO xanh trong khi job chết — SLO đo *job đã đăng ký*, không đo *job tồn tại*.
- **SLO 6 (VN mobile p75 LCP ≤2.5s / INP ≤200ms / CLS ≤0.1):** 44 KB gz + hàng trăm ảnh remote trên tab mặc định; CLS đã ~0.67.
- **SLO 1 (gián tiếp):** lỗi `42501` #3 đổ `client_errors` — ngưỡng P1 ≥25 lỗi/60' → Telegram cả ban đêm.
- Không đe doạ: SLO 2/3/4/7.

## Ngân sách hiệu năng

- DB-backed: +~3-5 KB gz → ~1892/1970. Đạt.
- Static-file: +43.9 KB gz → ~1932/1970. Không chấp nhận (54% headroom còn lại).
- Số thật hôm nay: INITIAL 225.2/280 · CODE 1512.0/1800 · Total 1888.4/1970.
- Chỗ đau thật là Vietnam p75, không phải bundle: phân trang ≤100 dòng + reserve ảnh bắt buộc.

## SEO

- Routes ảnh hưởng: `/rankings`, `/vi/rankings` — cả hai priority 0.9, changefreq daily.
- **Bump `pr:v33` → `pr:v34`: CÓ**, đồng thời sửa CLAUDE.md (doc drift 1 version).
- **Rủi ro SEO lớn nhất phi kỹ thuật:** `/rankings` đang nhắm cụm "bảng xếp hạng DUPR Việt Nam". Đổi sang PPA = bỏ cụm đó đổi lấy nhu cầu "PPA Tour rankings" tại VN — chưa ai đo. **Bắt buộc lấy baseline GSC query-level trước khi đổi.**
- Verify: curl Googlebot 2 route `?nocache=1` — 200 + title đúng bảng user thấy + hreflang + **đếm `href="/nguoi-choi/` > 0**.

## Kế hoạch rollback

- Web/SSR: `git revert` + redeploy + bump v34 → ~10'.
- Migration: cần `DROP` viết sẵn → ~5' nếu chuẩn bị, vô hạn nếu chưa.
- Worker: `wrangler delete`/gỡ cron tay từ máy Cuong → ~10', chỉ Cuong làm được.
- **Không revert được:** (1) dữ liệu PPA đã index bởi Google; (2) thư takedown/IP block từ PPA; (3) thứ hạng cụm "DUPR Việt Nam" mất hàng tuần để lấy lại. → Ba lý do RED, độc lập mọi thứ khác.

## Phải verify trước khi merge

- [ ] **Thư cho phép bằng văn bản từ PPA Tour**, lưu vào `external/`. Không có → không merge phần scrape.
- [ ] Baseline GSC query-level `/rankings` + `/vi/rankings` (28 ngày), lưu vào proposal.
- [ ] Sau migration: query `role_table_grants` — có row `anon` SELECT.
- [ ] Gọi RPC bằng anon key thật với `p_limit:5000` — nếu kết quả đúng bằng 1000 → `db.max_rows` cắt, phải phân trang.
- [ ] `ops_job_registry` có row `ppa%`.
- [ ] 1 lần cron thật → `ops_job_runs` status success + count > 0.
- [ ] Guard 0-dòng: worker với fixture rỗng → `failed`, không ghi đè bảng.
- [ ] `check-bundle-size` Total < 1970 KB.
- [ ] `auth:registry --strict` xanh (nếu có edge function mới).
- [ ] curl Googlebot 2 route, đếm `/nguoi-choi/` > 0.

## Phản biện độc lập (GPT-5.6-sol)

`ask-model.mjs` không tồn tại trong repo — gọi thẳng OpenAI Responses API. Panel không bị one-model-down.

**Đã xác minh — giữ:** SSR/client split + KV pathname-only (cơ chế "bot đầu tiên vào `?scope=` ghi đè entry" — xác nhận đọc code đúng); SSR rankings là đường link nội bộ duy nhất vào `/nguoi-choi/*`; worker ngoài repo + monitoring opt-in; GRANT trước RLS; **PostgREST cắt 1000 dòng** (finding GPT tìm, Claude sót — chưa verify, đưa vào checklist).

**Bác bỏ:** (1) "đổi default → filter discipline không tồn tại → empty state" — sai cơ chế, `getAvailableFormats()` + useEffect reset xử lý được; vấn đề thật là phạm vi intake sai so với nguồn (#13). (2) "GitHub Actions minutes" — không liên quan, job chạy Cloudflare cron.

**Tự kiểm tự bác:** nghi CSP chặn headshot → sai, `img-src https:` cho phép; rủi ro còn lại là CLS + hotlink protection.

## Đường ship AMBER (nếu Cuong muốn có gì đó tuần này)

Tab "PPA Tour" **không mặc định**, 2 board, top 25 mỗi board, dữ liệu commit tay theo lô đúng pattern `dupr-rankings.ts`, credit + link về ppatour.com, SSR không đổi. Không migration, không worker, không cron, không secret. Rollback = git revert. **AMBER**, ~200 dòng, trả lời câu hỏi thật: *người Việt có tìm bảng xếp hạng PPA không?* Trả lời xong rồi hãy xây pipeline.
