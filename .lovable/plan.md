

## Phân tích 3 phiên livestream Texas Open (13-15/03/2026)

### Tổng quan dữ liệu

| Phiên | Thời lượng | View Events | Unique Viewers | Chat Messages |
|---|---|---|---|---|
| Quarterfinals (13/03) | ~3h18' | 1,688 | 180 | 264 |
| **Semifinals (14/03)** | **~4h32'** | **169,950** | **219** | **438** |
| Finals (15/03) | ~10h13' | 32,111 | 383 | 760 |

### Vấn đề nghiêm trọng: View inflation tại Semifinals

Phiên Semifinals có **169,950 view events** nhưng chỉ **219 người dùng đăng nhập** -- trung bình **~660 events/người**. Top user tạo ra **14,717 events** (tương đương gửi 1 event mỗi ~1.1 giây trong suốt phiên).

Nguyên nhân: phiên này chạy với cấu hình cũ (interval 10s, không giới hạn). Phiên Finals (đã áp dụng cấu hình mới 30s + cap 20) cho thấy tỷ lệ hợp lý hơn: 32,111 views / 383 users = ~84 events/user -- vẫn cao nhưng giảm đáng kể.

**Tuy nhiên**, 84 events/user vẫn vượt xa giới hạn 20 events/session. Nguyên nhân: cap chỉ áp dụng per-session (mỗi lần mở tab), nếu user reload hoặc mở nhiều tab thì cap bị reset.

### Đánh giá hệ thống

**Hoạt động tốt:**
- Streaming provider (Mux) ổn định qua cả 3 phiên dài (lên đến 10h)
- Chat hoạt động tốt với 760 tin nhắn trong phiên Final
- Tính năng like chat đã triển khai (max 5 likes/message)
- Tăng trưởng viewers: Quarterfinals (180) → Semifinals (219) → Finals (383)

**Cần cải tiến:**

1. **View counting vẫn bị inflation** -- cap per-session không đủ, cần deduplicate phía server
2. **Anonymous views chiếm tỷ lệ lớn** -- Semifinals có 25,255 anonymous events (không track được)
3. **Replay views vẫn tích lũy** -- phiên Semifinals vẫn nhận events 2 ngày sau khi kết thúc (đến 16/03)
4. **Chat engagement thấp** -- 438 chat / 219 viewers = chỉ ~2 tin/người

---

### Đề xuất cải tiến

#### 1. Chống view inflation phía server (ưu tiên cao)
- Trong edge function `batch-view-events`, thêm logic **deduplicate**: nếu cùng `viewer_user_id` + `target_id` đã có event trong 30 giây gần nhất thì bỏ qua
- Với anonymous viewers: rate-limit dựa trên IP address (tối đa 1 event/30s/IP/target)
- Thêm cột `viewer_ip` vào `view_events` để phát hiện abuse

#### 2. Tách biệt live views vs replay views
- Thêm trường `is_replay` vào `view_events` để phân biệt lượt xem live vs replay
- Hiển thị riêng "Live viewers" và "Replay views" trên giao diện creator analytics
- Ngừng tích lũy view events cho livestream đã ended sau 24h (chỉ tính replay views)

#### 3. Hiển thị "concurrent viewers" thay vì tổng views
- Tạo bảng `livestream_concurrent_snapshots` ghi lại số người xem đồng thời mỗi 30s
- Hiển thị "X người đang xem" real-time trên LiveCard thay vì tổng view count
- Dùng Supabase Presence (đã có `useLivePresence`) để đếm chính xác

#### 4. Tăng chat engagement
- Thêm **chat reactions nhanh** (emoji bay lên như TikTok Live)
- Thêm **polls/câu hỏi** cho creator tương tác với viewers
- **Auto-highlight** tin nhắn được like nhiều nhất

#### 5. Dọn dẹp dữ liệu cũ
- Chạy migration xóa hoặc aggregate view_events cũ (trước khi fix) để giảm tải database
- Cập nhật `view_counts` cho các phiên cũ với con số chính xác hơn (dựa trên unique viewers)

---

### Ưu tiên thực hiện

| # | Cải tiến | Mức độ | Lý do |
|---|---|---|---|
| 1 | Server-side dedup view events | Cao | Dữ liệu hiện tại không đáng tin cậy |
| 2 | Concurrent viewers display | Cao | UX quan trọng cho livestream |
| 3 | Tách live vs replay views | Trung bình | Analytics chính xác hơn |
| 4 | Chat engagement features | Trung bình | Tăng tương tác cộng đồng |
| 5 | Dọn dẹp data cũ | Thấp | Maintenance |

Bạn muốn bắt đầu với cải tiến nào?

