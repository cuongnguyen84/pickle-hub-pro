# Content SEO — tuần 14–20/09/2026

## Quyết định và phạm vi

Chủ site đã cho phép tự xuất bản nội dung ngày 15/09, không cần duyệt từng bài. Đợt này là **6 cập nhật tiếng Việt trên URL đang có**, không phải 6 bài mới. Không đổi ngày đăng ban đầu để giả làm tin mới. Không tự mở quyền sửa code, tài khoản, thanh toán hoặc gửi thông báo hàng loạt.

## Audit nội dung, không phải audit SEO toàn site

Nguồn: bảng `vi_blog_posts` hiện hành, metadata trong repo, robots.txt công khai, Search Console 16/08–12/09/2026. GSC dùng toàn quốc gia, `dataState=all`, top 100 hàng; không gọi đây là số đo riêng Việt Nam hoặc tổng toàn bộ nhu cầu tìm kiếm. Các bản JSON bằng chứng nằm trong thư mục báo cáo runtime bảo vệ quyền truy cập.

| Phát hiện | Bằng chứng | Tác động / xử lý |
| --- | --- | --- |
| Kết quả Kuala Lumpur chưa theo kịp chung kết | Bài VI sửa gần nhất 13/09 14:34 ICT còn ghi chưa xác minh vô địch; bản tin PPA chính thức ngày 13/09 đã có đủ 5 chung kết | Cao: cập nhật kết quả đúng URL, sửa FAQ nhà vô địch, giữ diễn biến cũ có nhãn lưu trữ |
| Ý định tìm kiếm World Cup thay đổi sau giải | Trang lịch VI: 5.897 clicks / 31.665 impressions / vị trí TB 4,5; query có “hôm nay” vẫn xuất hiện | Cao: nói rõ giải đã kết thúc, đưa người đọc từ lịch sang kết quả; không xoá URL đang có lưu lượng |
| Cụm chia bảng đã có tín hiệu | Bài chia bảng VI: 45 clicks / 561 impressions / vị trí 4,8; /tools EN 42/940/11,6 và /vi/tools 15/183/6,8 | Vừa: thêm ví dụ 8 đội/2 sân và link công cụ, không tạo thêm bài cùng intent |
| Bài dự toán có nhu cầu nhỏ nhưng sát sản phẩm | 9 clicks / 148 impressions / vị trí 5,4 | Vừa: bổ sung phép tính khi thiếu người; số liệu giả định được gắn nhãn rõ |
| Nhiều bài đã phủ nhóm chủ đề | Kho VI có hướng dẫn mới chơi, vòng tròn, ngân sách, sân; hai slug bracket mang trạng thái merged | Rủi ro trùng nội dung, chưa đủ bằng chứng kết luận cannibalization: ưu tiên mở rộng bài hiện hữu |
| Lịch vận hành thiếu nội dung cụ thể | T57 hỏi lịch nhưng bị tạo tác vụ engineering; lịch cũ chỉ tạo nháp chung chung | Cao: lịch dữ liệu dùng chung cho scheduler, digest và /lich_content; không gọi AI chỉ để đọc lịch |

Robots.txt cho phép truy cập công khai, chặn các vùng tài khoản/admin. Publisher kiểm tra HTTP 200, canonical, noindex và nội dung trước/sau cập nhật. Không suy ra schema thiếu từ kết quả fetch. Chưa đo lại CWV, chưa xác nhận Google đã index bản sửa, chưa hoàn thành audit hreflang toàn site.

## Ba trụ cột

1. Theo dõi giải: lịch → kết quả → trang giải/trực tiếp. Có nhu cầu GSC rõ, cần nguồn giải chính thức và ghi đúng thời điểm.
2. Tổ chức giải/CLB: chia bảng → lịch sân → ngân sách → công cụ. Gắn nội dung với việc sử dụng sản phẩm, có ví dụ tính được.
3. Bắt đầu chơi tại Việt Nam: buổi làm quen → chọn sân → hướng dẫn liên quan. Dựa vào nhu cầu sử dụng sản phẩm; chưa đo được volume riêng cho từng đề tài, không bịa độ khó hay lượng tìm kiếm.

## Lịch đã soạn nội dung

| Ngày 08:00 ICT | Nội dung bổ sung | Keyword / intent | Đích tiếp theo |
| --- | --- | --- | --- |
| 15/09, chạy bù ngay khi bật | 5 chung kết Kuala Lumpur, tỷ số từng game | kết quả Kuala Lumpur Cup 2026 / tra cứu | Bài kết quả đang có |
| 16/09 | World Cup đã kết thúc: tra lịch cũ và kết quả đúng cách | lịch thi đấu pickleball world cup / tra cứu | Bài kết quả World Cup, /live |
| 17/09 | 8 đội/2 sân: 28 trận vòng tròn hoặc 15–16 trận chia bảng | chia bảng pickleball 8 đội 2 sân / thực hành | /vi/tools, bài vòng tròn |
| 18/09 | Checklist hỏi sân TP.HCM và mẫu tin nhắn đặt sân | sân pickleball tphcm / tìm nơi chơi | /san, hướng dẫn chia bảng |
| 19/09 | Mục tiêu buổi đầu và phiếu tự kiểm cho người mới | cách chơi pickleball cho người mới / tìm hiểu | Bài chấm điểm, /san |
| 20/09 | Kịch bản ngân sách 24/32/40 người, số giả định minh bạch | dự toán ngân sách giải pickleball / thực hành | Chia bảng, /vi/tools |

Các bài đều hướng searchable; không cam kết tăng thứ hạng chỉ nhờ đăng đều. Giữ đường dẫn, ảnh, tác giả, alternate EN và nội dung cũ; đợt này chưa đồng bộ phần bổ sung sang bài tiếng Anh.

## Vòng vận hành (marketing-loops)

- **Cadence:** bộ điều phối kiểm tra mỗi phút; đến ngày sau 08:00 mới cập nhật. Không liên tục sửa cùng bài vì chưa có traffic mới.
- **Acts when:** có nội dung đã kiểm tra, hash trùng, đúng ID/slug và trạng thái published, phiên bản DB chưa bị ai sửa.
- **Purpose:** giữ thông tin hữu ích, tăng khả năng đi từ bài đọc tới công cụ/sân; bảo vệ URL có traffic.
- **Skills:** seo-audit xác định ưu tiên; content-strategy chọn trụ cột/intent; marketing-loops quy định chống trùng và dừng.
- **Body:** đọc manifest → kiểm tra phiên bản → đối chiếu trang → CAS cập nhật → kiểm tra trang công khai → Telegram link.
- **Self-check:** chỉ HTML cho phép, tối thiểu nội dung có ích, không placeholder, có nguồn cho sự kiện; phép tính kiểm lại. Không chạy mã do model sinh.
- **State:** SQLite `content:<key>` với hash bản kiểm tra, payload, backup và trạng thái; marker trong bài ngăn nhân đôi khi khởi động lại.
- **Stop:** tối đa một bài/ngày; khác phiên bản, lỗi nguồn/trang, mất kết nối hoặc chưa rõ kết quả ghi thì dừng mục đó và báo. Không bắt anh duyệt lại; đội phải chẩn đoán. Kill switch `/xuly team content pause`; resume chỉ bật lại lịch, không tự chạy lại mục lỗi.
- **Output:** nội dung public + bản sao lưu riêng + chứng cứ kiểm tra + tin Telegram. `/lich_content` đọc cùng lịch, không gọi model.

Lịch đã chuẩn bị hiện phủ tới 20/09. Không giả báo đã có lịch tuần kế tiếp. Muốn thêm URL mới phải tuân thủ đủ checklist EN/VI của repo (post, metadata, DB, barrel và kiểm tra public); publisher này cố ý không tự tạo trang thiếu một nửa.

Bộ điều phối là LaunchAgent trên máy chủ sở hữu, không phải cloud 24/7. Khi máy ngủ/tắt, công việc đến hạn phải chờ máy chạy lại; mỗi ngày chạy bù tối đa một mục, không dồn toàn bộ bài cũ lên trong một phút.

## Xác nhận triển khai 15/09

- 48 Python tests và 5 Telegram progress tests đạt.
- Opus kiểm tra bản thảo; đã sửa cách diễn đạt search intent, đơn vị lượt sân, thêm ví dụ thời lượng và làm rõ mẫu số người đăng ký. Root đối chiếu nguồn chung kết chính thức.
- Runtime cài snapshot chứa publisher + manifest; ops-job-control ACTIVE phiên bản 227 khi kiểm tra. Menu Telegram đã thêm /lich_content.
- Mục Kuala Lumpur đã ở trạng thái published, public verification đạt; Telegram xác nhận gửi link với receipt 4203. Năm mục còn lại scheduled, có bản sao lưu và payload được hash-bound.
- T51/T53/T54 đã đóng kèm bằng chứng cập nhật VI. Không đánh dấu T52 (yêu cầu vị trí trang chủ) hay bản tiếng Anh đã hoàn thành ngoài phạm vi thực sự làm.

## Đo hiệu quả

Đọc lại GSC sau 7 và 28 ngày, cùng cửa sổ/country và query-page: impressions, clicks, CTR, vị trí. Tách tin giải có tính mùa vụ khỏi bài evergreen. Theo dõi đường tới /tools và /san nếu tracking hiện hành cho phép; không gọi thay đổi traffic ngắn hạn là tác động nhân quả. Không tự xoá/hợp nhất bài dựa trên một tuần ít clicks.

Nguồn kết quả: https://www.ppatour-asia.com/partners-in-gold-irvine-and-tardio-clean-up-in-kl/
