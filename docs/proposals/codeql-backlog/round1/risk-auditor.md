# Rủi ro — CodeQL backlog (28 alert → 0)

## Verdict: 🟡 AMBER (kèm carve-out 🔴 RED trên đúng 1 file)
Kết cục xấu nhất hiện thực: một PR "28→0" gộp chung sửa `_shared/auth.ts` để đóng 3 alert DUPR → deploy-guard redeploy tuần tự ~50 function với `set -e`; một function fail giữa vòng lặp để lại **fleet nửa cũ nửa mới, không có rollback nguyên tử** — trong khi 3 leak thật vẫn nằm ở caller, không được sửa.

Classifier said: **AMBER** (edge function non-auth). Em giữ AMBER làm mức tổng, **nhưng nâng riêng `supabase/functions/_shared/auth.ts` lên RED**: bất kỳ diff nào dưới `_shared/**` kích hoạt full-fleet redeploy (`deploy-guard.yml:60-66`), không revert nguyên tử được. Đây là quyền của Cuong, không panel nào hạ.

## Rủi ro cụ thể
| # | Mức | Cơ chế hỏng | Người dùng thấy gì | Giảm thiểu |
|---|-----|-------------|--------------------|------------|
| 1 | Cao | Sửa `_shared/auth.ts` (`jsonResponse` L55-56) để đóng alert #17 → `deploy-guard.yml` redeploy tuần tự ~50 function, `set -e` dừng giữa chừng | Một phần fleet chạy code mới, phần còn lại code cũ; nếu đổi shape JSON, cùng một app trả lỗi khác nhau tuỳ endpoint | **KHÔNG chạm `_shared/auth.ts`.** Taint (`err.message`) sinh ở 3 caller: `dupr-webhook-test-fire:133`, `dupr-partner-token:52`, `dupr-webhook-register:76`. Sửa `{ error: msg }` → generic tại 3 caller → chỉ redeploy 3 function |
| 2 | TB | Fix code Worker (`social-poster`, `secret-sync`, `pro-tour-scraper`, `news-fetcher`) merge vào main → CodeQL scan source → alert đóng, **nhưng Worker chạy bằng `wrangler deploy` thủ công riêng**; không ai deploy → prod vẫn leak | Không thấy gì (false-done); ném exception vào Worker chưa deploy vẫn trả `err.message` | Sau merge, chạy `wrangler deploy` trong từng thư mục worker; xác minh bằng HTTP probe. "28→0 trên main" KHÔNG chứng minh prod đã fix |
| 3 | TB | Sửa `sanitizeBlogHtml` / SSR sanitizer trong `functions/_lib/utils.ts` (alert 45/46/47/22) → đổi output SSR đã cache trong KV `pr:v29` | Bot có thể vẫn nhận HTML cũ đã cache cho tới khi hết TTL | Nếu output SSR thay đổi cho page thật → **bump `pr:v29`** trong `_middleware.ts`, hoặc force `?nocache=1` từng path. Với content blog thường (admin/Gemini) output không đổi → thường không cần |
| 4 | TB | Rewrite regex sanitizer sai (ReDoS / catastrophic backtracking) chạy per-request trong Pages Function SSR trên HTML blog lớn | Bot request → Pages Function timeout → 5xx → SEO regression (im lặng) | Chạy regex mới trên `vi_blog_posts.content_html` dài nhất, đo thời gian < 50ms trước merge |
| 5 | TB | Alert #24 `safeRedirect.ts:35` `/[ -\s]/` **hiện match cả dấu `-`** → hôm nay mọi redirect sau login tới path có hyphen (mọi slug tournament/blog/match) bị bounce về `/`. Fix đổi hành vi auth-redirect | (Đây là bug SỐNG hôm nay) login xong đáng lẽ về `/tournament/abc-def` lại về `/`. Sau fix: về đúng trang | Fix ưu tiên #1 (giá trị dương). Kèm test: hyphen-path PASS, `//evil.com`/`/\evil`/`javascript:` vẫn BLOCK |
| 6 | Thấp | `dupr-user-search` (user-facing, `MatchNew.tsx:519`) ILIKE thiếu escape `\` (alert 10/11); user gõ `\` cuối chuỗi → pattern lỗi | Search DUPR trả 500 thay vì kết quả | Escape `\` `%` `_`; test `abc\`, `\%`, `\\` |
| 7 | Thấp | `url.includes("googleusercontent.com")` (alert 22/23) bypass bởi `googleusercontent.com.attacker.example` | `<img src>` trỏ domain lạ (chỉ load ảnh, không exec script) | Dùng `new URL()`, so hostname chính xác. Severity thấp vì chỉ gate hiển thị ảnh |

## SLO bị đe doạ
- **SLO 2 (Auth)**: gián tiếp — alert #24 fix chạm `isValidInternalPath`, path đăng nhập-lại. Fix ĐÚNG cải thiện SLO 2 (đang hỏng thầm với hyphen path); fix SAI có thể chặn redirect hợp lệ hoặc mở open-redirect. Cần test.
- **SLO 1 (Availability, `/feed`/`/`)**: chỉ nếu #4 (ReDoS) lọt vào SSR path → Pages Function 5xx cho bot. Không chạm render client `/feed`.
- Còn lại: pro-tour-ingest (HMAC backend), news-translate (cron), send-blog-blast (admin) — **không** trên hot path người dùng. Không alert nào exploit được bởi anonymous ngay bây giờ → **không có P0** trong 28. Cách brief gọi "7 public edge function stack trace" là nói quá (recon đã đính chính: 4 edge fn + 3 worker, đều internal/admin/HMAC).

## Ngân sách hiệu năng
- Bundle: các file frontend đụng tới (`safeRedirect`, `url-utils`, `AdminViBlogEditor`, `EditLivestreamDialog`, `CreateGhostProfileModal`, `ProfileSetup`, `blog/index.ts`, `mlp-event-scraper`) đều là sửa logic nhỏ/escape → **~+0 KB**, net-neutral. Còn 1903.8 / 1970 KB, ~66 KB headroom, dư sức.
- Vietnam p75: không thêm render/network waterfall. Không tác động.

## SEO
- Routes SSR bị ảnh hưởng: `functions/_lib/utils.ts` (`sanitizeBlogHtml`, `normalizeImageUrl`) phục vụ `renderBlog`/`renderViBlog`/... qua `_middleware.ts`.
- Cần bump `pr:v29`? **Có, NẾU** output SSR đổi cho page thật (thường không, vì input blog là admin/Gemini). Nếu chạm regex sanitizer → an toàn nhất là bump. Alert `url-utils.ts:12` (frontend) không ảnh hưởng SSR; bản trùng `functions/_lib/utils.ts:92` thì có.
- Verify: `curl -A "Googlebot" https://www.thepicklehub.net/blog/<slug>` → expect 200 + title + og:image + hreflang en/vi/x-default, so sánh HTML trước/sau.

## Kế hoạch rollback
- Cơ chế:
  - Frontend + Pages Functions: `git revert` + Cloudflare Pages redeploy — đủ, ~5 phút.
  - Edge function (3 DUPR caller, sửa đúng chỗ): revert commit → deploy-guard redeploy 3 function. Không nguyên tử nhưng phạm vi hẹp.
  - **Workers**: `wrangler deploy` thủ công — **không có nút rollback**; phải deploy lại từ checkout tốt.
- Thời gian khôi phục: frontend/Pages ~5', 3 edge fn ~5', workers ~10' (thủ công/worker).
- **Không revert được sạch**: (a) `_shared/auth.ts` nếu bị chạm (full-fleet, non-atomic) → đây là lý do RED cho riêng file này; (b) worker deploy (không atomic). Tránh (a) hoàn toàn bằng cách sửa 3 caller.

## Phải verify trước khi merge
- [ ] KHÔNG có diff nào dưới `supabase/functions/_shared/` (grep diff); alert #17 sửa tại 3 caller DUPR.
- [ ] Client không parse nội-dung error-body của các fn sửa: đã xác nhận — `grep invoke.*<fn>` cho thấy không nơi nào rẽ nhánh theo `err.message`; sanitize an toàn cho retry/hiển thị.
- [ ] Test `safeRedirect`: hyphen-path PASS; `//evil.com`, `/\x`, `/%2F`, `javascript:` BLOCK.
- [ ] Test `dupr-user-search` ILIKE: input `\`, `abc\`, `\%` không 500.
- [ ] Đo thời gian regex sanitizer mới trên content_html dài nhất < 50ms (chống ReDoS SSR).
- [ ] Sau merge: `wrangler deploy` từng worker + HTTP probe xác nhận version deployed ≠ source.
- [ ] Nếu SSR output đổi: bump `pr:v29` trong `functions/_middleware.ts`.
- [ ] Chia thành nhiều PR nhỏ theo surface (frontend / edge caller / worker / SSR), KHÔNG gộp "28→0" một PR — closure criterion "CodeQL 0" không chứng minh worker + KV đã fix.

## Thứ tự ưu tiên trong 28 (dựa trên tác động thật, đã verify)
1. **#24 safeRedirect** — bug SỐNG (redirect hỏng cho mọi slug có hyphen). Sửa trước, đứng riêng.
2. **#8/7/6/9/2 news-fetcher sanitizer** — input là HTML tin tức nguồn ngoài (attacker-influenced nhất trong nhóm sanitizer). Cao hơn `sanitizeBlogHtml` (admin/Gemini, defense-in-depth).
3. **#11/10 dupr-user-search ILIKE** — user-facing, 500 thật khi gõ `\`.
4. **Stack-trace #48/20/18/17/36/35/21** — info-disclosure, nhưng đều internal/admin/HMAC/cron → không P0. Sửa tại caller. Dùng generic message + log chi tiết server-side.
5. **#45/46/47/22/23 sanitizer/url SSR + frontend** — hygiene, input tin cậy; cẩn trọng ReDoS + KV bump.
6. **Dismiss-được có lý do ghi rõ**: #13/12 insecure-randomness (`Math.random()` chỉ sinh username-candidate, KHÔNG phải credential/token → dismiss "not a security boundary", nhưng vẫn cần xử lý collision uniqueness ở DB); #16/15/14 xss-through-dom (admin-only, self-XSS trừ khi giá trị đến từ user không tin cậy mà admin click); #1 tainted-format-string (`console.error`, log-only sink). Ghi lý do dismiss vào alert, đừng rewrite hành vi chỉ để im CodeQL.

## Phản biện độc lập (GPT-5.6)
- **Đã xác minh trong repo:**
  - Source/deploy drift worker + KV SSR (rủi ro #2, #3) — khớp `deploy-guard.yml` chỉ deploy `supabase/functions/**`, worker có `wrangler.toml` riêng, không có trong `cron-schedules`/`ops-runbook`.
  - Không chạm `_shared/auth.ts` (rủi ro #1) — verify tại `_shared/auth.ts:55` + 3 caller: taint sinh ở caller, đúng.
  - #24 hyphen bug — test runtime: `/[ -\s]/.test("/tournament/abc-def") === true` (bounce về `/`). Xác nhận là defect sống.
  - ILIKE `\` → 500 (rủi ro #6); googleusercontent substring bypass (rủi ro #7) — hợp lý, severity thấp vì chỉ gate `<img src>`.
- **Điều chỉnh (không bác, nhưng hạ mức GPT xếp):** GPT xếp HTML sanitizer là "highest security priority nếu attacker-controlled". Trong repo `sanitizeBlogHtml` (SSR) nhận input **admin/Gemini** (comment code tự nói là defense-in-depth) → urgency thấp hơn GPT gợi ý. Chỉ `news-fetcher` sanitizer nhận HTML nguồn ngoài mới đáng ưu tiên cao. Đã phản ánh ở thứ tự ưu tiên #2 vs #5.
- **Bác bỏ:** không có claim bịa nào về code không thấy được — GPT giữ đúng dạng điều kiện, không hallucination cần loại.
