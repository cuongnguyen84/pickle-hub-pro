*↩️ TRẢ LỜI LỆNH #77* — "bài kết quả sao không thấy trên homepage / stories"

*Có thấy — nhưng chỉ ở bản tiếng Việt.* Đã kiểm bằng Googlebot UA + `?nocache=1`:

• `thepicklehub.net/vi` → bài kết quả nằm *ĐẦU TIÊN* trong khối stories (6 link /vi/blog trong HTML) ✅
• `thepicklehub.net/` (bản EN) → *KHÔNG có* ❌

*Vì sao lệch:* `src/pages/Index.tsx` dòng 175-201 có hai nhánh khác nguồn dữ liệu.
Nhánh VI đọc thẳng Supabase `vi_blog_posts` (nên bài VI-only vẫn hiện). Nhánh EN đọc `blogMetadata` trong repo — và bài kết quả *không có entry ở đó*.

*Điểm đáng nói:* trang EN vẫn TỒN TẠI và có nội dung thật —
`/blog/pickleball-world-cup-2026-da-nang-results` trả 200 với *12.174 từ*.
Tức là trang sống, Google đọc được, nhưng *không trang danh sách EN nào trỏ tới nó*. Bài mồ côi: có URL, có nội dung, không có đường vào từ trong site.

*Nên anh không thấy vì đang xem ở chế độ EN.* Chuyển sang VI là thấy ngay ở vị trí đầu.

*Đề xuất sửa (vùng 🟡 VÀNG — cần anh duyệt):*
Cho nhánh EN đọc cùng nguồn như nhánh VI thay vì chỉ đọc manifest trong repo. Sửa một chỗ trong `Index.tsx` + `Blog.tsx`. Không đụng DB, không đụng route.
Chưa làm vì đây là thay đổi mặt tiền trang chủ — mình dựng PR khi anh gật.

_Nhắc: lệnh #77 và #76 đã đánh dấu xử lý xong._
