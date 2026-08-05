# Intake — telegram-fix-agent

**Ý tưởng (nguyên văn Cuong, 05/08):** lỗi 1 job news fetcher, anh bấm fix nhưng chỉ trả lời "⛔ Không retry news-fetcher: retry_not_supported", vậy là chưa được fix. Anh cần mỗi khi bấm fix gọi 1 agent xử lý và trả lời cụ thể cho anh lỗi được fix chưa và nguyên nhân.

**Bối cảnh ảnh chụp (05/08 17:10 VN):** ⚠️ news-fetcher "ppa-tour: feed HTTP 404" · ❌ dupr-rankings-refresh "older than eight days" (tái phát dù 04/08 đã sửa) · ❌ auto-cancel-unpaid-registrations "Scheduler ran but no monitored request was dispatched".

## Trả lời làm rõ

1. **Nơi chạy agent:** Máy Mac của Cuong — "anh không bao giờ tắt máy, hoặc nếu có chỉ khởi động lại. Em cần cho chạy trên máy anh luôn cũng dc."
2. **Quyền:** Chẩn đoán + sửa ops (retry, redeploy từ main, bật workflow, sửa data monitor sai). KHÔNG tự sửa code — lỗi code thì báo nguyên nhân + đề xuất, chờ duyệt.
3. **SLA:** ~5–10 phút; bot báo ngay "đang điều tra…" rồi trả kết quả đầy đủ (đã fix chưa + nguyên nhân).

## Ràng buộc đã biết

- `docs/job-operations-telegram.md`: bot hiện bị giới hạn có chủ đích "không tự sửa lỗi logic ứng dụng" — đề xuất này NỚI giới hạn đó sang tầng ops, cần cập nhật runbook.
- Bảng `telegram_commands` + pattern queue `scripts/ops/telegram_queue.py` đã tồn tại (kênh lệnh 2 chiều Telegram ↔ máy local).
- Nút Fix hiện tại: `ops-job-control` xử lý được (a) edge function missing_blob → workflow repair, (b) job pg_net → retry RPC, (c) job github_actions → workflow_dispatch (thêm 04/08). Chưa xử lý: `cloudflare_worker` (chính là news-fetcher), và mọi lỗi "chạy được nhưng kết quả sai" (như feed 404).
- Máy Mac luôn bật → có thể chạy daemon/launchd poll; mọi PAT/secrets đã có sẵn trên máy (~/Downloads/secrets.local.md, gh auth, wrangler auth, Supabase PAT).
