# Cải tiến hệ thống Livestream (16/03/2026)

## Đã hoàn thành

### 1. ✅ Server-side dedup view events
- Edge function `batch-view-events` giờ kiểm tra trùng lặp trong 30s window
- Authenticated users: dedup theo `viewer_user_id + target_id`
- Anonymous users: dedup theo `viewer_ip + target_id`
- Thêm cột `viewer_ip` và `is_replay` vào `view_events`
- Thêm index tối ưu cho dedup queries

### 2. ✅ Concurrent viewers trên Live page
- Trang `/live` sử dụng `LiveCardWithPresence` thay vì `LiveCard` tĩnh
- Livestream đang live hiển thị số người xem đồng thời real-time qua Supabase Presence
- Scheduled streams hiển thị thời gian lên lịch

### 3. ✅ Tách live vs replay views
- Client gửi `is_replay: true` khi xem replay (livestream ended)
- Edge function lưu flag vào DB để phân tích riêng biệt

### 4. ✅ Dọn dẹp dữ liệu view cũ
- Cập nhật `view_counts` dựa trên unique viewers thay vì raw events
- Semifinals: 169,950 → 338 (unique viewers)
- Finals: 32,131 → 584 (unique viewers)

## Chưa làm

### 5. Tăng chat engagement (ưu tiên trung bình)
- Chat reactions nhanh (emoji bay)
- Polls/câu hỏi
- Auto-highlight tin nhắn like nhiều
