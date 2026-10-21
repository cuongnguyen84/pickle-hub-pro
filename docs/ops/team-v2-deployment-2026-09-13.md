# Bàn giao đội vận hành v2 — 2026-09-13

## Đã triển khai

- Thay bốn lịch Chief, Content, Ops sweep và Xử lý bằng
  `com.picklehub.team-v2`, thêm `com.picklehub.team-v2-watchdog`.
- Giữ `com.picklehub.fix-agent`, `com.picklehub.edge-redeploy-hourly` và cron
  Cloudflare/Supabase/GitHub hiện có. Không xóa dữ liệu hoặc lịch sử đội cũ.
- Runtime snapshot đang cài:
  `/Users/cm10/Library/Application Support/PickleHub/team-v2/releases/20260913-082726/scripts/ops`.
- Backup đội cũ:
  `/Users/cm10/Library/Application Support/PickleHub/team-v2/backups/20260913-082726`.
  Bản cutover đầu tiên ngày 11/09 cũng được giữ nguyên trong backups.
- Chín vai trò có hợp đồng trách nhiệm; sổ việc SQLite WAL; nhận việc qua Telegram;
  bundle dữ liệu đã lọc; giới hạn model; bản nháp trong worktree riêng; outbox có
  message_id; heartbeat và backup SQLite sau mỗi tick.
- 12 collector: site, jobs, translation, recovery, runtime_errors, security,
  commerce, sports, community, editorial, growth, engineering. GA4 lọc Vietnam.

## Kiểm chứng

- 24 kiểm thử controller/installer đạt: chống trùng, cạnh tranh consumer,
  mất tiến trình, budget, quyền ghi, sender Telegram, lỗi gửi, payload lớn,
  circuit breaker và rollback khi bootstrap lỗi.
- `py_compile` và `git diff --check` đạt trong đợt triển khai.
- Model đã tạo bản Markdown thật trong checkout T23-R6, chỉ một file đúng phạm
  vi; controller tạo patch có SHA256 và kiểm tra `git diff --check` đạt. Task
  kiểm tra này đã được đóng; không thay source sản phẩm hay deploy production.
- Runtime 13/09 được launchd kích hoạt, kết thúc exit 0; heartbeat cập nhật.
- Quét đầy đủ run 456 ngày 13/09: cả 12 collector đọc thành công, không có lỗi
  thu thập. Vẫn có findings nghiệp vụ: feed-embeds-sync warning, một báo cáo
  nội dung và bốn mốc Growth đến hạn. Collector đọc được không có nghĩa mọi
  nghiệp vụ đều healthy hoặc các findings này đã được giải quyết.
- Bridge lỗi 500 đã sửa bằng wildcard `*` thay cho `%` chưa escape trong URL.
  Bridge ở trạng thái resolved; lệnh Telegram XL-136 được chuyển thành T47 và
  giữ queued. Telegram xác nhận đã nhận T47 bằng message_id 3966.
- Cảnh báo hạn mức model được Telegram xác nhận bằng message_id 3965.
- Báo cáo bàn giao cuối đã được Telegram xác nhận: outbox 16,
  message_id **3967**. Bản lưu tại `team-v2/reports/deployment-2026-09-13-telegram.txt`.

## Giới hạn đang có thật

Claude trả `You're out of usage credits` trong lời gọi kiểm tra ngày 13/09:
0 input token, 0 output token và cost 0. Vì vậy các phép đo, sổ việc, cảnh báo
và Telegram đang chạy; phân tích AI/viết bản nháp mới đang chờ tài khoản có hạn
mức. Circuit breaker giữ việc và chỉ thử lại sau 6 giờ, không mua quota hay nới
ngân sách. Không tuyên bố chín vai trò đã hoàn thành phân tích trong tình trạng này.

T47: yêu cầu cập nhật theo ngày bài kết quả Kuala Lumpur Cup, vẫn chờ xử lý;
chưa cập nhật bài và chưa bật tự xuất bản nội dung. Việc không bị mất khi đổi đội.

Runtime chưa tự merge/deploy, gửi hỗ trợ cho khách, xác nhận/hoàn tiền, sửa kết
quả chính thức hoặc phát hành native. Các phần còn lại của lộ trình được ghi trong
[runbook](team-v2-runbook.md), gồm QA sandbox, approval, credential DB hạn quyền,
monitor ngoài máy và những collector nghiệp vụ sâu hơn. Đây là rollout nền tảng,
không phải hoàn tất toàn bộ lộ trình sáu tuần.

## Dùng ngay

- `/xuly team status` hoặc `/xuly team inbox`
- `/xuly team report <run>`
- `/xuly team pause` / `/xuly team resume`
- `/xuly team cancel T47` nếu muốn hủy việc đang chờ
- `/xuly engineering <việc>` / `/xuly editorial <việc>`

Báo cáo định kỳ: 08:00 và 21:00 ICT. Cách rollback nằm trong runbook. Các file
triển khai mới nằm trong working tree; không commit kèm các thay đổi sản phẩm
đang làm dở của chủ repo. Runtime đang chạy từ snapshot ngoài repo.
