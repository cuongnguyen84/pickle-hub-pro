# idea-recon — prod-health-monitoring-expansion (2026-08-04)

> Output nguyên văn của agent idea-recon, bổ sung 2 fact orchestrator tự verify (đánh dấu ⊕).

## Prior art

**Ý tưởng này đã được build phần lớn — nhưng phần mới nhất và quan trọng nhất (nút fix trên Telegram) nằm trên `origin/agent/admin-job-health-digest`, không có trong working tree local.** Nhánh local cùng tên đã bị rebase/rewrite (commit `fe22c754` "Add admin job health dashboard and morning digest" khác SHA với `563c0d20` của origin có cùng message) và mất toàn bộ phần build phía trên.

⊕ **Orchestrator verify (git):** merge-base = `4cc22d32`. Origin có 13 commit (563c0d20 → 22bd81a4) gồm trọn hệ Telegram ops. Local có 3 commit rewrite/riêng: `fe22c754` (rewrite của 563c0d20), `a617268f` (rewrite của 22bd81a4 — remove secret-sync), và `c095a460` (quiet-hours social-poster — **KHÔNG có trên origin**). Origin branch **CHƯA merge vào origin/main**. → Hai bên đều có work riêng; không bên nào là superset.

⊕ **Orchestrator verify (deploy):** `supabase functions list` — `ops-job-control` **ACTIVE v13**, `ops-edge-health` **ACTIVE v4**, `errors-telegram-alert` ACTIVE v40, `ops-job-digest` ACTIVE v36. → **Prod đang chạy hệ nút-fix mà source chỉ tồn tại trên origin branch chưa merge.**

### Hệ giám sát hiện có

- `supabase/functions/errors-telegram-alert/index.ts:1-406` (local, hiện tại) — 2 việc trong 1 function: (1) alert spike lỗi client (`client_errors`, ngưỡng 3/10min, dedup 60min), (2) `runCronHealth()` — đánh giá snapshot `ops_cron_monitors` (pg_net jobs + 1 GitHub Actions workflow, DUPR refresh) và gửi Telegram incident/recovery. Cron: `errors-telegram-alert-10min` (`supabase/migrations/20260715130000_ops_cron_health.sql:411`).
- `supabase/functions/ops-job-digest/index.ts:1-91` (local) — digest sáng, RPC `ops_job_health_snapshot()` → `formatJobHealthDigest` → Telegram. Cron `ops-job-digest-morning` lúc `15,35 2 * * *` UTC = 09:15/09:35 ICT (`supabase/migrations/20260802131500_ops_job_health_dashboard.sql:349`). Dedup qua `ops_claim_daily_digest`/`ops_finish_daily_digest`.
- `src/pages/admin/AdminJobs.tsx` (local) — dashboard admin tại `/admin/jobs`.

### Chỉ có trên `origin/agent/admin-job-health-digest` (không có local)

- `supabase/functions/ops-job-control/index.ts` (326 dòng) — **đây là "nút fix"**. Telegram webhook handler (verify qua `X-Telegram-Bot-Api-Secret-Token`, secret = SHA-256 của `CRON_SECRET`). Lệnh `/jobs /functions /probe /diagnose /retry /fix`. `/jobs` trả reply kèm `inline_keyboard` với nút `🔎 Chẩn đoán` và `🛠 Fix` cho từng job unhealthy (`callback_data: fix|<job_key>` / `diagnose|<job_key>`). `/fix`: nếu Edge Function của job bị `missing_blob` → `requestEdgeRepair()` → GitHub `workflow_dispatch` trên `edge-function-repair.yml`; ngược lại gọi RPC `ops_request_job_retry` và poll `ops_cron_dispatches` lấy outcome thật. Lệnh ghi vào bảng `telegram_commands` (webhook ghi, `processTelegram()` drain) — cùng pattern với `scripts/ops/telegram_queue.py`.
- `.github/workflows/edge-function-repair.yml` — `workflow_dispatch` (bot trigger) + `schedule: */10 * * * *` (quét backstop). Allowlist 8 function redeploy được: `dupr-sync errors-telegram-alert mux-sync-assets news-rewrite ops-edge-health ops-job-control ops-job-digest zalo-token-refresh` (+ ops-news-worker). Redeploy qua `supabase functions deploy --use-api`, verify hết `NOT_FOUND_FUNCTION_BLOB`, báo Telegram.
- `supabase/functions/ops-edge-health/index.ts` — probe `ops_edge_function_registry` mỗi 5 phút (OPTIONS request từng function), state `available/missing_blob/http_error/timeout`, ghi `ops_edge_function_state`.
- `docs/job-operations-telegram.md` — runbook bot, ghi rõ: "Bot không tự sửa lỗi logic ứng dụng, thay đổi dữ liệu, merge PR hoặc deploy code chưa được phê duyệt". `/fix` chỉ auto-redeploy khi confirmed `missing_blob`, không bao giờ cho `http_error`/`timeout`.
- Migrations origin-only: `20260802143000_ops_job_retry_control.sql`, `20260802150000_ops_edge_function_health.sql`, `20260802153000_ops_retry_verification.sql`.
- `workers/edge-blob-watchdog/src/index.ts` commit `c2dacbc7` "fix: self-heal Telegram command webhook blob loss" — hardening riêng cho webhook, origin-only.

## Touch surface (nếu mở rộng)

- `supabase/functions/errors-telegram-alert/index.ts` — logic alert client-error + cron-health
- `supabase/functions/ops-job-digest/index.ts`, `supabase/functions/_shared/job-health-digest.ts`
- `supabase/functions/ops-job-control/index.ts`, `ops-edge-health/index.ts` (origin branch)
- `src/pages/admin/AdminJobs.tsx`
- `.github/workflows/edge-function-repair.yml`, `uptime-ping.yml`, `edge-auth-parity.yml`, `migration-drift.yml`, `milestone-due.yml`, `dupr-refresh.yml`
- `workers/edge-blob-watchdog/src/index.ts` — probe blob 1 phút trong worker, dispatch heal qua `uptime-ping.yml`
- `supabase/migrations/20260715130000_ops_cron_health.sql`, `20260802*_ops_job_*.sql`

## Data

- `ops_cron_monitors`, `ops_cron_dispatches`, `ops_cron_state` (nguồn pg_net + github_actions) — `20260715130000_ops_cron_health.sql:14-46`
- `ops_edge_function_registry`, `ops_edge_function_state` — migration origin-only `20260802150000`
- `telegram_commands` (chat_id, update_id, text, status, result) — tồn tại trên prod (`src/integrations/supabase/types.ts:6858`), không có migration file tracked ở cả 2 nhánh
- `error_alert_dedup`, `client_errors`
- RPC: `ops_refresh_cron_health_snapshot`, `ops_claim_cron_alert`, `ops_release_cron_alert_claim`, `ops_job_health_snapshot`, `ops_claim_daily_digest`, `ops_finish_daily_digest`, `ops_request_job_retry` (origin-only), `ops_finish_job_retry` (origin-only)

## Ràng buộc

- `CLAUDE.md` — edge functions `verify_jwt=false`, auth nội bộ qua `requireCronRequest`/`CRON_SECRET` (`_shared/cron-auth.ts`)
- `docs/ops-runbook.md:157` — "pg_cron `running` status is transient, not a failure (bài học cron-health)"
- memory `blob-loss-root-cause-2026-07-26.md` — blob-loss là platform bug per-region, self-heal phải có cooldown; heal-loop từng đốt ~12.4k phút Actions/tháng; cooldown 30' trong worker, KHÔNG lên 60'
- memory `incident-2026-08-03-scraper-hmac-secret-sync-loop.md` — secret-sync worker đã gỡ trọn (`a617268f`/`22bd81a4`); `SCRAPER_AUTH_SECRET` giờ không ai auto-heal
- 8 cron workflow GitHub Actions từng tắt vì budget; scan hiện tại: mọi workflow có schedule đều không thấy `if: false` — budget có vẻ đã nạp lại (memory 29/07)

## Test coverage hiện tại

- `supabase/functions/_shared/__tests__/cron-health.test.ts`, `job-health-digest.test.ts` — unit cho evaluator/formatter (local)
- `supabase/tests/ops_job_health.test.sql` — pgTAP, bản origin được mở rộng bởi các commit retry/edge-health
- **KHÔNG có test nào cho webhook `ops-job-control`** (check chữ ký Telegram, parse callback, nhánh `/fix`) — gap cả trên origin
- Không có coverage cho allowlist logic của `edge-function-repair.yml` hay worker `edge-blob-watchdog`

## Bề mặt production CHƯA được giám sát (theo code, không đoán)

- **Auth email/OTP, payment, Mux webhook, push notification, sitemap, prerender KV**: không có hook alert nào trong `send-auth-email`, `mux-webhook`, `create-payment-order`, `send-push-notification`, `functions/sitemap.xml.ts`, `functions/_middleware.ts` — chỉ được đỡ gián tiếp bởi spike alert `client_errors` nếu client throw.
- News pipeline: `news-rewrite` có trong allowlist `edge-function-repair.yml`, nhưng `news-ingest`, `news-translate`, `news-check` không có — và cũng không nằm trong `ops_cron_monitors`/`ops_edge_function_registry`.
- OTP có vẻ có đường alert riêng: commit `5e288c0c` "Telegram-alert Cuong when OTP delivery fails on all channels" — cần đọc kỹ nếu scope OTP quan trọng.

## Câu hỏi cho Cuong

1. Nhánh local và origin đã phân kỳ (cùng title commit, khác history) — muốn lấy history origin (có hệ nút-fix) về trước khi làm tiếp, hay origin đã bị bỏ có chủ đích?
2. ⊕ Đã verify: `ops-job-control` ĐANG deployed prod (v13) — nghĩa là origin branch KHÔNG phải đồ bỏ, nó là source của prod runtime.
3. Phạm vi "thêm cần check gì": mở rộng pattern `ops_edge_function_registry`/`ops_cron_monitors` sẵn có sang các bề mặt chưa giám sát (news pipeline, OTP, payment, Mux webhook), hay muốn cơ chế mới?
