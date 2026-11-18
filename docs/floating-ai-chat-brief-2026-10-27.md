# Bản giao việc — Nút float AI chat hiểu ngữ cảnh (WEB, v1)

Người giao: Cường (qua Master Agent) · Người thực hiện: Claude · Ngày: 27/10/2026
Phạm vi đã chốt: **chỉ quanh giải đấu** · **chat được HÀNH ĐỘNG thay đổi thông tin** · **làm web trước** (native để sau, dùng chung hợp đồng ngữ cảnh + hợp đồng hành động định nghĩa ở đây).

## 1. Mục tiêu
Biến chat AI tạo giải hiện có (quick-table-chat) thành một lớp trợ lý nổi đi theo người dùng trong toàn bộ khu vực giải đấu của thepicklehub.net: hiểu màn hình/thực thể đang xem, trả lời theo đúng ngữ cảnh đó, và thực thi thay đổi thông tin giải khi người dùng yêu cầu (trong quyền của họ, có xác nhận).

## 2. Phạm vi màn hình (v1 — chỉ quanh giải đấu)
Nút float chỉ xuất hiện ở: danh sách/hub giải, trang chi tiết giải, trang bảng đấu/vòng bảng, trang trận/kết quả của một giải, luồng tạo giải, màn hình nháp/kết quả chia bảng của quick-table-chat, trang đăng ký giải. Xác định theo route pattern; ngoài các route này không hiện nút. (Blog, sân, trang chủ: ngoài phạm vi v1.)

## 3. Nút float + khung chat
- Nút nổi góc dưới phải, né thanh điều hướng dưới và trình phát livestream; không che nút hành động chính của trang.
- Mở ra khung chat dạng panel/sheet. **Một cuộc trò chuyện duy nhất, liền mạch khi chuyển trang** trong khu vực giải; đóng/mở lại, reload trang vẫn giữ thread (lưu thread id ở localStorage).
- Mỗi tin nhắn hiển thị (và lưu log) kèm nhãn ngữ cảnh ngắn của màn hình lúc gửi (vd "Đang xem: Giải X — Bảng B").
- Chip gợi ý theo màn hình: trang chi tiết giải → "Chia bảng cho giải này", "Tóm tắt giải"; trang bảng đấu → "Gán sân cho các bảng", "Kiểm tra lại bảng"; trang kết quả → "Tóm tắt ngày đấu".

## 4. Gói ngữ cảnh (hợp đồng dùng chung)
Mỗi lượt chat gửi kèm gói ngữ cảnh gọn (ID + tóm tắt, không dump toàn trang):
- `screen`: loại màn hình + route hiện tại.
- `tournament`: id/slug của giải đang xem (nếu có) + trạng thái giải (nháp / đang mở đăng ký / đã bốc thăm / đang đấu / đã kết thúc).
- `entity`: thực thể cụ thể đang xem nếu có (bảng, trận, đội).
- `summary`: tóm tắt dữ liệu đang hiển thị mà chat cần (số đội, danh sách đội dạng tham chiếu/id, số bảng, sân đã gán).
- `actor_role`: vai trò của người dùng với giải này (chủ giải/quản trị / người tham gia / khách xem) — server xác định, không tin client tự khai.
Mỗi màn hình trong phạm vi tự khai báo ngữ cảnh của nó qua một cơ chế đăng ký thống nhất (context registry), không để tầng chat tự suy đoán từ DOM.

## 5. Hành động (phần cốt lõi)
Chat thực thi thay đổi qua **hợp đồng hành động có kiểu** ở edge function, dùng đúng đường backend mà UI đang dùng (không ghi thẳng bảng bỏ qua validation). Nhóm hành động v1:
- Sửa thông tin giải: tên, thời gian, địa điểm/sân, mô tả, thiết lập thể thức.
- Đội: thêm / xoá / đổi tên đội trong danh sách của giải.
- Bảng đấu: sinh bảng từ danh sách đội của giải đang xem; sinh lại bảng; gán sân cho bảng (group_courts).
- (Tuỳ chọn nếu kịp trong v1) nhập/sửa kết quả trận trong trang kết quả của giải — nếu làm, ghi rõ nguồn nhập là chat thủ công.

### Luật bắt buộc cho mọi hành động
1. **Cổng quyền ở server:** chỉ chủ giải/quản trị mới được sửa; người không có quyền thì chat giải thích và chỉ hỗ trợ đọc. Không dựa vào việc ẩn nút ở UI.
2. **Xác nhận trước khi ghi:** mỗi hành động trình một thẻ tóm tắt thay đổi ("Đổi tên giải: A → B", "Xoá đội X khỏi danh sách") với nút Xác nhận / Huỷ. Không bao giờ ghi âm thầm.
3. **Ý thức trạng thái giải:** hành động mâu thuẫn với trạng thái hiện tại phải bị chặn hoặc cảnh báo rõ hậu quả — vd xoá đội sau khi đã bốc thăm (đề xuất thay đội hoặc bốc thăm lại), sinh lại bảng khi đã có trận đấu (cảnh báo mất kết quả đã nhập).
4. **Nhật ký + khả năng hoàn tác:** mọi hành động ghi log (ai, hành động, giá trị trước → sau, ngữ cảnh màn hình) vào log chat hiện có hoặc bảng log hành động riêng; các sửa ở trạng thái nháp phải hoàn tác được ít nhất trong phiên.
5. Thất bại từng phần: báo rõ phần nào đã áp dụng, phần nào chưa — không báo "xong" khi mới xong một nửa.

## 6. Tích hợp với chat tạo giải hiện có
- Khả năng hiện tại (dán danh sách / đính kèm file → bản nháp → nút Tạo giải) giữ nguyên và dùng chung thread.
- Từ trang chi tiết giải, lệnh "chia bảng cho giải này" lấy đúng danh sách đội đã đăng ký của giải (không bắt người dùng dán lại).
- Thể thức chưa hỗ trợ: giữ luật nói thẳng + gợi ý thay thế gần nhất (luật 24/10/2026), không ánh xạ lặng lẽ.

## 7. Không thuộc v1
Màn hình ngoài khu vực giải; app iOS native; nhập liệu bằng giọng nói; hành động hàng loạt trên nhiều giải cùng lúc.

## 8. Tiêu chí nghiệm thu (kịch bản kiểm chứng)
1. Ở trang chi tiết giải (tài khoản chủ giải): bảo chat đổi tên giải → thấy thẻ xác nhận → xác nhận → tên đổi thật trên trang, log có ghi trước/sau.
2. Tài khoản không có quyền sửa: yêu cầu tương tự → chat từ chối rõ ràng, không có ghi nào xảy ra (kiểm cả phía server).
3. Xoá một đội trước bốc thăm: trơn tru; sau bốc thăm: chat cảnh báo + đề xuất phương án thay thế/bốc lại, không tự ý làm.
4. Hỏi ở trang giải, chuyển sang trang bảng đấu hỏi tiếp "gán sân cho bảng này" → chat hiểu đúng bảng đang xem nhờ dấu ngữ cảnh.
5. Reload giữa cuộc trò chuyện → thread còn nguyên.
6. Nút float không xuất hiện ở blog/sân/trang chủ; không che trình phát livestream ở trang xem trực tiếp của giải.
