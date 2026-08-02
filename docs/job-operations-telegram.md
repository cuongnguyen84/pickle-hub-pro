# Hướng dẫn Job Operations qua Telegram

## Mục đích

Bot `TPH AI Support` là bảng điều khiển vận hành nhanh cho các job nghiệp vụ và Edge Functions. Hệ thống gửi báo cáo mỗi sáng lúc **09:15 ICT**, theo dõi Edge runtime mỗi 5 phút và có watchdog GitHub độc lập mỗi 10 phút để phục hồi trường hợp runtime blob bị mất.

Trang đầy đủ trên web: [Job Health](https://www.thepicklehub.net/admin/jobs).

## Các nút và lệnh

Mở menu Telegram hoặc gửi `/help` để hiện bàn phím:

- `/jobs`: tổng quan job, lý do lỗi và nút **Chẩn đoán / Fix** cho job bất thường.
- `/functions`: trạng thái các Edge Functions quan trọng.
- `/probe`: probe Edge runtime ngay lập tức.
- `/diagnose <job-key>`: xem lịch chạy, lần hoạt động gần nhất và nguyên nhân.
- `/retry <job-key>`: chạy lại job có hỗ trợ retry; kết quả được đối chiếu đúng dispatch vừa tạo.
- `/fix <job-key>`: chẩn đoán trước rồi chọn hành động an toàn.

Ví dụ:

```text
/diagnose news-rewrite
/retry dupr-sync-daily
/fix news-rewrite
```

## Cách dùng khi có lỗi

1. Gửi `/jobs`.
2. Bấm **Chẩn đoán** ở job lỗi để đọc nguyên nhân.
3. Bấm **Fix**:
   - Nếu Edge Function `missing_blob`, bot kích hoạt GitHub recovery workflow. Workflow redeploy đúng function trong allowlist, probe lại và báo kết quả qua Telegram.
   - Nếu Edge Function vẫn có runtime, bot retry job và chờ kết quả của **đúng lần dispatch đó**.
   - Nếu là `http_error` hoặc `timeout`, hệ thống không redeploy mù vì có thể là lỗi code hoặc dịch vụ downstream; bot giữ nguyên bằng chứng để điều tra.
4. Chờ tin `✅`, `⚠️`, hoặc `❌`. Nếu thấy `⏳`, downstream chưa trả lời trong cửa sổ chờ; request vẫn được lưu để theo dõi, không được coi là thành công.
5. Gửi lại `/diagnose <job-key>` hoặc mở `/admin/jobs` để xác nhận trạng thái cuối.

## Ý nghĩa trạng thái

- `healthy`: lần chạy gần nhất thành công và còn trong ngưỡng thời gian.
- `warning`: có tín hiệu bất thường nhưng chưa đủ điều kiện kết luận hỏng.
- `failed`: job trả lỗi, quá hạn nghiêm trọng, hoặc dependency không dùng được.
- `pending`: chưa có đủ dữ liệu/lần chạy đang chờ kết quả.
- Edge `available`: runtime tồn tại; HTTP nghiệp vụ có thể vẫn cần kiểm tra riêng.
- Edge `missing_blob`: metadata deploy còn nhưng runtime blob mất; được phép tự redeploy.
- Edge `http_error` / `timeout`: không tự thay code; cần xem log và nguyên nhân downstream.

## Các lớp bảo vệ

- Chỉ Telegram chat đã cấu hình mới được điều khiển.
- Webhook được xác thực bằng secret token.
- Job key và function slug phải nằm trong registry/allowlist; Telegram không thể truyền lệnh shell tùy ý.
- Retry có cooldown 10 phút để tránh chạy trùng.
- Mỗi retry lưu người yêu cầu, nguồn, exact `dispatch_request_id`, HTTP status, response và kết quả xác minh.
- Auto-repair chỉ xóa/tạo lại **một function đã được duyệt** khi probe xác nhận `NOT_FOUND_FUNCTION_BLOB`.
- Workflow chạy từ source trên nhánh `main`; thay đổi code vẫn phải qua PR/review.

## Báo cáo và cảnh báo tự động

- 09:15 ICT: báo cáo Job Health buổi sáng. Lịch có lần dự phòng 09:35 nhưng ledger chống gửi trùng.
- Mỗi 5 phút: Supabase probe các Edge Functions quan trọng; cảnh báo khi `missing_blob`, khi lỗi thường đạt 2 lần liên tiếp, và khi phục hồi.
- Mỗi 10 phút: GitHub watchdog độc lập kiểm tra `missing_blob` và tự phục hồi ngay cả khi function điều khiển trong Supabase đang hỏng.

## Khi bot không phản hồi

1. Kiểm tra Telegram có báo callback “Đang xử lý…” hay không.
2. Mở `https://www.thepicklehub.net/admin/jobs` để xem control job và Edge state.
3. Kiểm tra GitHub Actions workflow `Edge function repair` nếu lệnh `/fix` đã kích hoạt recovery.
4. Nếu `ops-job-control` bị mất runtime, watchdog GitHub vẫn chạy độc lập tối đa 10 phút một lần.
5. Nếu workflow báo thiếu secret/quyền, kiểm tra `SUPABASE_ACCESS_TOKEN`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`; Edge bot cần `GITHUB_OPS_TOKEN` có quyền Actions write.

## Giới hạn cố ý

Bot không tự sửa lỗi logic ứng dụng, thay đổi dữ liệu, merge PR hoặc deploy code chưa được phê duyệt. Với lỗi HTTP/downstream, `/fix` chỉ retry khi dependency runtime sẵn sàng và trả kết quả thật; nếu vẫn lỗi, cần kỹ sư sửa source rồi merge/deploy.
