# Báo cáo ngắn ngày 14/09

Anh không cần đọc các bản phân tích kỹ thuật. Báo cáo sáng trước ghi “chờ duyệt” chưa đúng: có việc mới chỉ ra bản nháp hoặc báo lỗi.

CONTENT
- Bài Kuala Lumpur: đã cập nhật một phần ngày 13/09. Các yêu cầu T51–T54 chưa triển khai tiếp; anh đã giao rồi, không cần duyệt lại hay tạo thêm việc.
- Việc nội dung cần ưu tiên: kiểm chứng kết quả cuối giải rồi cập nhật đúng bài đang có, tránh tạo bài trùng. Đây là phần đội còn phải làm, chưa báo hoàn thành.
- 15, 17, 19/09: hệ thống đưa việc tạo nháp vào hàng đợi từ 08:00. Chủ đề chưa chốt; đây KHÔNG phải lịch đăng đã cam kết.
- Luồng mong muốn: lấy nguồn → kiểm chứng → gửi nháp cho anh → duyệt → đăng và gửi link. Hiện bot mới hỗ trợ đến bước nháp; duyệt/xuất bản tự động chưa có.

CẦN ANH
- Chưa có bài nào trong báo cáo này được xác nhận đủ điều kiện để anh duyệt đăng.
- Ngoài content: cần anh hỗ trợ kết nối lại Instagram (T26); xác nhận quyền sử dụng nội dung bị báo cáo bản quyền (T21). Chưa tự xoá hay bỏ qua báo cáo đó.

LỆNH TELEGRAM
- /tien_do — xem các việc còn mở.
- /tien_do T51 — xem riêng việc cập nhật bài.
- /xuly team report T51 — xem báo cáo chi tiết ngay trong Telegram, chỉ khi anh cần.
- /lamngay T51 — chỉ ưu tiên khi việc đang xếp hàng; hiện T51 cần đội kiểm chứng nên lệnh này không chạy lại nó.
- /xuly editorial Soạn nháp bài [chủ đề], gửi để tôi xem, chưa đăng — giao việc nội dung mới.

Chưa có lệnh /duyet để đăng bài. Em không hướng dẫn anh dùng một lệnh chưa hoạt động.

---

Ghi chú triển khai: mẫu digest đã bỏ danh sách mã run của từng vai trò; hỗ trợ tra báo cáo bằng T/XL và giữ tương thích mã run cũ. Trạng thái awaiting_review được diễn đạt là đội cần kiểm chứng, không đồng nghĩa chờ chủ ứng dụng duyệt. Không thêm quyền xuất bản, không tự chạy lại T51–T54. Python 40 tests và Telegram progress 4 tests đạt; cập nhật runtime và triển khai ops-job-control. Các lịch nháp được tính từ cấu hình thứ Ba/Năm/Bảy, không tự suy ra chủ đề hoặc giờ hoàn thành.
