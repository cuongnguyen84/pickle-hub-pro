## Tom tat kien truc
28 alert la 20 sink code + 8 dismiss-voi-ly-do, khong phai mot lo hong lon. Phan lon nam tren surface noi bo/admin/backend chu khong phai anonymous-public nhu brief gia dinh (recon da dinh chinh, mo file xac nhan: send-blog-blast tra ve cho Supabase webhook, dupr-user-search chi admin/authenticated, pro-tour-ingest backend-to-backend HMAC). Cach sua dung la fix inline tai nguon taint, gom PR theo surface de chan blast-radius deploy, tuyet doi khong dung "shared safe-error helper" trong supabase/functions/_shared/ vi deploy-guard.yml:60-66 se redeploy toan bo ~50 function. Diem mau chot da kiem chung: alert #17 co sink o _shared/auth.ts:56 nhung 3 source that o 3 file DUPR call-site, sua tai call-site lam alert tat ma khong dung _shared/, nen chi 3 function redeploy chu khong phai 37.

## Option A -- Fix inline theo nhom surface + dismiss co tai lieu (recommended)
Effort: 3-4 half-days. Files: xem duoi. Data: none (khong migration/RLS/RPC)

Chia theo 4 nhom deploy doc lap + 1 me dismiss, moi nhom 1 PR nho:

PR1 -- edge/DUPR cluster (redeploy chi dupr-*, KHONG cham _shared/)
- supabase/functions/dupr-webhook-test-fire/index.ts:135, dupr-partner-token/index.ts:52, dupr-webhook-register/index.ts:77 -- redact err.message truoc khi dua vao jsonResponse(...): body tra { error: "internal_error" }, giu console.error(full). Alert #17 tat vi source het taint; _shared/auth.ts de nguyen -> deploy-guard chi redeploy 3 func nay.
- supabase/functions/dupr-user-search/index.ts:156 -- them buoc escape dau backslash TRUOC khi escape percent va underscore. Da kiem caller src/hooks/useDuprUserSearch.ts + AdminDuprDashboard.tsx:1561: client doc `data`, khong hien thi `error` body -> an toan doi.

PR2 -- edge/content pipeline (redeploy 3 func rieng le)
- pro-tour-ingest/index.ts:158, news-translate/index.ts:141+219, send-blog-blast/index.ts:544 -- bo err.message khoi body response, giu log + (send-blog-blast) giu nguyen dong ghi posts_blasts.mailchimp_campaign_id (do la DB, khong phai response, khong phai leak). send-blog-blast tra ve cho Supabase webhook (ignore body) nen doi shape vo hai.

PR3 -- Cloudflare Workers (deploy thu cong per-worker qua wrangler, khong dinh deploy-guard)
- workers/social-poster/src/index.ts:130,265,730; workers/secret-sync/src/index.ts:86,254; workers/pro-tour-scraper/src/index.ts:249,387,643 -- cung pattern redact.
- workers/news-fetcher/src/index.ts:444-451 stripHtml -- nhom 5 alert (multi-char-sanitization #6/7/8 + bad-tag-filter #9 + double-escaping #2). Day la HTML->text cho news; harden regex + 1 test (ponytail: security path de lai 1 check).

PR4 -- frontend + Pages Functions (deploy qua Cloudflare Pages)
- functions/_lib/utils.ts:225-227 (sanitizeBlogHtml on-event stripper, #45/46/47) -- dung o functions/_lib/render/blog.ts:212 render vao HTML cho bot. Input la blog do Cuong/admin viet (trusted-ish) nhung van la defense-in-depth. Harden 3 regex + 1 test.
- functions/_lib/utils.ts:92 + src/lib/url-utils.ts:12 (#22/#23) -- normalizeImageUrl includes("googleusercontent.com"): doi sang check new URL(url).hostname endsWith. Trung lap 2 file, sua ca 2 (khong gom -- surface khac nhau, gom lai ton hon tiet kiem).
- src/lib/pro-tour/adapters/mlp-event-scraper.ts:543 (#4), send-blog-blast/index.ts:59 (#5) -- script-tag strip incomplete, harden.
- XSS-through-dom #14/15/16 (AdminViBlogEditor.tsx, EditLivestreamDialog.tsx): admin-only, input cua chinh admin vao img src / a href cua chinh ho. Fix bang validate URL scheme (http/https-only) truoc khi bind -- vua clear alert vua la a11y/UX hop ly.

Dismiss (ghi reason qua gh api):
- #12/#13 insecure-randomness (Math.random sinh username-candidate) -- khong phai token/security, dismiss "used for non-security username suggestion, not secret material".
- #1 tainted-format-string (console.error voi slug) -- log-only sink, dismiss.
- #24 overly-large-range (safeRedirect.ts:35) -- char-class thua nhung behavior dung (reject whitespace+control); sua 1 dong re hon cai, hoac dismiss.
- #10/#11 incomplete-sanitization ILIKE -- da fix o PR1, khong dismiss.

How it works: moi alert sua tai nguon taint, khong abstraction moi. Gom PR theo ranh gioi deploy de moi merge co blast-radius nho, rollback doc lap.
Wins: blast-radius deploy nho nhat co the (khong full-fleet redeploy); khong doi response shape ma client doc (da grep verify); moi PR review duoc trong 1 buoi toi. Loses: ~20 site sua tay, nham; 4 PR thay vi 1. Forecloses: gan nhu khong -- van co the gom helper sau neu muon.

## Option B -- Cheap: fix cai render ra ngoai, dismiss phan noi bo
Effort: 1.5-2 half-days. Files: functions/_lib/utils.ts, workers/news-fetcher/src/index.ts, src/lib/url-utils.ts, dupr-user-search/index.ts. Data: none

Chi sua nhom that su cham du lieu khong hoan toan tin cay hoac render ra bot: sanitizeBlogHtml (utils.ts), stripHtml (news-fetcher), normalizeImageUrl substring, ILIKE escape. Toan bo 7 stack-trace-exposure -> dismiss voi reason "response body exposes err.message (not stack) on internal/backend/admin surface; full error logged server-side; no anonymous-public path" (da verify tung caller). XSS admin-only + randomness + format-string -> dismiss.

How it works: nhan dien da so alert la low-severity tren surface noi bo, dong bang dismiss co dan chung thay vi code.
Wins: nhanh nhat ve 0; it code cham prod nhat -> it rui ro regress. Loses: 12-14 dismiss la no ky thuat mem -- lan audit sau phai doc lai reason; neu mot func "internal" bi expose public tuong lai thi dismiss thanh sai. Forecloses: khong, un-dismiss lai duoc bat cu luc nao.

## Option C -- Shared safeError() helper + shared sanitizer
Effort: 5-6 half-days. Files: _shared/ moi + refactor moi call-site. Data: none

Dung _shared/safe-error.ts (edge) + copy cho workers/* + functions/_lib.
Loses (day la phuong an thua): (1) dat trong supabase/functions/_shared/ kich hoat deploy-guard redeploy toan bo ~50 function tren 1 merge -- blast-radius lon nhat trong 3 option, dung thu ma reliability-first cam. (2) Edge / Workers / Pages Functions la 3 module system + 3 deploy path rieng -- "shared" helper phai viet 3 ban, DRY chi co tren giay. (3) Refactor 20 call-site de goi helper = diff to hon sua inline. Forecloses: khoa Cuong vao mot layer indirection phai maintain mai cho thu dang le la 20 dong one-off.

## Khuyen nghi
Option A. B re hon nhung de lai 12-14 dismiss -- voi repo co audit dinh ky, moi dismiss la mot dong nguoi sau phai doc-va-tin lai; A bien phan lon thanh code tat han alert, chi dismiss 4 cai that su vo hai. C thua dut khoat: no tra gia full-fleet redeploy (deploy-guard.yml:60-66) cho mot "DRY" khong ton tai that vi 3 surface la 3 module system. A dat 28->0 voi blast-radius deploy nho nhat va khong doi bat ky response shape nao client dang doc (da grep useDuprUserSearch.ts, AdminDuprDashboard.tsx xac nhan). Neu quy thoi gian toi do bi bop, fallback = B -- van ve 0 hop le.

## Increments
1. PR1 (DUPR edge) -- verify: sau merge, supabase functions list cho thay chi dupr-* redeploy; CodeQL rescan #17/#10/#11 -> closed; useDuprUserSearch van tra ket qua (smoke tren AdminDuprDashboard).
2. PR2 (content-pipeline edge) -- verify: news-check -> news-translate cron chay 1 vong OK; send-blog-blast test-fire tra 200; alerts #18/#20/#48 closed.
3. PR3 (workers) -- verify: wrangler deploy tung worker; news-fetcher cron ghi news_items binh thuong; 1 test stripHtml pass; alerts #2/#6/#7/#8/#9/#21/#35/#36 closed. STOP-AND-LOOK o day: xem CodeQL rescan co that su clear cac regex-sanitizer khong (regex sanitizer doi khi van bi flag -- neu con, chuyen sang dismiss-with-reason thay vi doi co voi query).
4. PR4 (frontend + Pages) -- verify: curl -A Googlebot mot blog EN+VI van 200 + content render dung (sanitizeBlogHtml khong nuot noi dung hop le); bundle khong tang (chi regex, no dep); alerts #4/#5/#14/#15/#16/#22/#23/#45/#46/#47 closed.
5. Dismiss batch -- gh api .../code-scanning/alerts/<n> state=dismissed cho #1/#12/#13 (va #24 neu chon dismiss). Verify: gh api .../alerts?state=open --jq length == 0.

## Dieu em khong chac
- Regex-sanitizer co that su tat alert khong. js/incomplete-multi-character-sanitization va bad-tag-filter ban chat phe phan CACH TIEP CAN regex; mot tweak regex co the van bi flag lai. Fix dung "chuan CodeQL" la parser HTML that (them dependency + bundle cost, vi pham perf-budget). Em nghieng ve: harden regex + neu van flag thi dismiss "defense-in-depth, input la admin-authored, khong phai anonymous UGC" -- nhung can Cuong xac nhan input cua sanitizeBlogHtml/stripHtml dung la trusted-ish (VI blog = admin viet; news = scraped, kem tin hon -- day la cho em it chac nhat).
- Chua mo 3 file DUPR call-site (dupr-webhook-test-fire:135, dupr-partner-token:52, dupr-webhook-register:77) de xac nhan err.message di thang vao body vs da co redact mot phan -- em suy tu pattern sink _shared/auth.ts:56 + recon, chua doc tan dong. Can doc truoc khi code PR1.
- ProfileSetup.tsx:247 (#12) -- path trong recon khong match (find khong thay file); can dinh vi lai file that truoc khi dismiss.
- Khong ro CodeQL default query pack tu re-close alert sau merge trong bao lau (weekly cron Mon 03:00, hoac trigger theo push to main) -- co the phai cho toi lan scan ke de thay ve 0.
