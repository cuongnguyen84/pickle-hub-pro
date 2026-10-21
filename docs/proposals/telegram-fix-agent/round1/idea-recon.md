# idea-recon — telegram-fix-agent (2026-08-05)

## 1. Luồng /fix hiện tại — supabase/functions/ops-job-control/index.ts
- /fix handler: dòng 209-233. Gọi runEdgeProbe trước.
  - Edge function missing_blob (212-214) → requestEdgeRepair (150-159) → dispatch edge-function-repair.yml trên main.
  - Unavailable nhưng không phải missing_blob (215) → chỉ báo, dừng (không redeploy).
  - Còn lại (222-233) → RPC ops_request_job_retry.
- RPC ops_request_job_retry — migrations/20260802143000:48-53: CHỈ executor='pg_net' có cron_job_name là retry được; mọi thứ khác → {ok:false, code:'retry_not_supported'}. Đây là chuỗi Cuong thấy với news-fetcher.
- executor='cloudflare_worker' (news-fetcher, pro-tour-scraper): KHÔNG có nhánh xử lý nào.
- Lưu ý recon: bản deploy prod (05/08 fix #542) có nhánh github_actions → workflow_dispatch; nhưng file trên nhánh local cũ không có — recon đọc nhánh local stale.

## 2. Kênh Telegram ↔ máy local — có nền, chưa có daemon
- telegram_commands: webhook ghi (ops-job-control:308-316); ops-job-control tự drain qua cron 1' (20260802143000:108-111), allowlist regex dòng 165/320.
- scripts/ops/telegram_queue.py: queue reader (peek/claim/done/error) thiết kế cho phiên Claude Code poll ĐẦU PHIÊN (comment dòng 14-17) — không phải daemon.
- ~/Library/LaunchAgents/: có `com.picklehub.edge-redeploy-hourly.plist` (redeploy edge functions HÀNG GIỜ qua ~/Library/Application Support/PickleHub/redeploy-edge-functions.sh) và com.user.news-aggregator.plist (không liên quan). KHÔNG plist/cron nào chạy telegram_queue.py hay claude.
- Legacy: scripts/ops/telegram_poll.py (getUpdates long-poll), notify_telegram.py.

## 3. Headless Claude
- Repo không có script `claude -p`/headless nào. scripts/agents/ chỉ có risk-tier.mjs, soak-watch.mjs.
- Máy có sẵn binary: claude 2.1.222 và codex-cli 0.146.0 tại ~/.local/bin/.

## 4. Ba lỗi sống (05/08)
a. **ppa-tour 404**: seed migrations/20260519000000:191-197 — feed_url='https://ppatour.com/feed/', feed_type='rss'. Row DB tĩnh → ứng viên sửa data/ops thật.
b. **dupr tái phát**: origin/main CÓ fix bỏ event=schedule (04/08). Nhánh local `agent/admin-job-health-digest` (stale, đã merge qua #541 squash) vẫn mang bản CŨ có `&event=schedule`. `ops_refresh_cron_health_snapshot` không hề gọi GitHub — độ tươi của monitor dupr đến DUY NHẤT từ fetch trong errors-telegram-alert. Run 04/08 13:29Z dispatch success. ⚠️ Nghi phạm chính (orchestrator): LaunchAgent redeploy-hourly trên máy có thể deploy đè từ checkout local đang đứng ở nhánh stale → hoàn nguyên fix mỗi giờ.
c. **auto-cancel**: cron cài qua pg_net (20260715130000:353,365,367, hourly). "Scheduler ran but no monitored request was dispatched" nằm ở nhánh evaluator sau dòng 166 cron-health.ts (chưa đọc hết trong budget).

## 5. Prior art / ràng buộc
- docs/job-operations-telegram.md: bot cấm tự sửa code (giới hạn có chủ đích) — đề xuất nới sang tầng ops phải cập nhật runbook.
- Classifier trên máy từng chặn: gh pr merge (lúc chưa có lệnh tường minh), gh secret set, rm -rf. Agent local spawn từ Claude Code cũng chịu chế độ permission tương đương tuỳ cách chạy (`--dangerously-skip-permissions` vs default).
- Cooldown/heal-loop lessons: mọi vòng tự động phải có cooldown (12.4k phút Actions 07/2026).

## Unknowns recon nêu cho Cuong
1. Nhánh local stale mang code cũ — cần dọn/đồng bộ để hết nguồn deploy đè.
2. cloudflare_worker + github_actions nên có first-class retry trong RPC, hay agent là đường fix duy nhất?
3. Cần daemon/LaunchAgent poll thật, hay chỉ chạy khi có phiên Claude Code mở?
