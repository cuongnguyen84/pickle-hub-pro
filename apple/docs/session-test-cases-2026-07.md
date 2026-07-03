# Test cases — native port session (2026-07)

Toàn bộ tính năng đã port sang native `/apple` trong session này. Test tay trên app (iPhone 17 Pro sim hoặc máy thật, bundle `net.thepicklehub.app.dev`).

## Chuẩn bị
- **Đăng nhập** (hầu hết tính năng behind login). Tài khoản test: `thecuong@gmail.com` (admin).
- Một số ca cần **2 tài khoản** (DM, duyệt thành viên CLB) — đánh dấu `[cần 2 acc]`.
- Một số ca cần là **người tạo giải/CLB** (organizer) — đánh dấu `[chủ sở hữu]`.
- Giải test có sẵn (memory): QuickTable `iostest3`/`iostest6`, MLP `5rhuvdmn`.

Ký hiệu: ✅ = kết quả mong đợi · ⚠️ = ca biên cần kiểm.

---

## 1. Home — DUPR chip + banner đối tác

**Đường vào:** mở app → tab **Trang chủ**.

1.1 **Chip DUPR** ở thanh trên cùng (giữa cúp/biểu-đồ và tìm-kiếm/chuông/avatar)
- ✅ Có rating: hiện `DUPR 3.xx` (số màu lime, mono), không bị xuống dòng.
- ✅ Tap chip (có rating) → mở màn **Hồ sơ** (rating card).
- ⚠️ Nếu tài khoản có lịch sử điểm: hiện delta `▲.04` (xanh tăng) / `▼.04` (đỏ giảm) sau số. Không có lịch sử → ẩn delta.
- ⚠️ Tài khoản **chưa liên kết DUPR**: chip hiện `DUPR · Kết nối`, tap → mở web `/dupr`.

1.2 **Banner THEPICKLEHUB × DUPR** (ngay dưới ticker)
- ✅ Hiện "OFFICIAL PARTNERSHIP · VERIFIED", "THEPICKLEHUB × DUPR Official Partner", "GLOBAL STANDARD · 2018 → 2026".
- ✅ Nút **+ Log trận** (lime) → mở màn Log trận. Nút **Hướng dẫn →** → mở danh sách blog.
- ✅ Ngay dưới banner có thanh live ("Chưa có trận trực tiếp" hoặc trận đang live).

---

## 2. Log trận + Xác nhận trận (Match)

**Đường vào:** Home → banner **+ Log trận** (hoặc Home masthead).

2.1 **Log trận** (đã có từ trước — kiểm còn hoạt động): chọn Đơn/Đôi → chọn đối thủ → nhập tỉ số → xem lại → gửi.

2.2 **Xác nhận trận** (MỚI) — nút toolbar **dấu ✓ (checkmark.seal)** góc phải màn Log trận.
- ✅ 2 tab: **Chờ xác nhận** / **Lịch sử**.
- ✅ Tab Chờ xác nhận: liệt kê trận người khác log mà mình là người chơi. Mỗi trận hiện đội A/B + tỉ số + trạng thái.
- ✅ Nút **Xác nhận** → trạng thái đổi (CHỜ XÁC NHẬN → ĐÃ XÁC NHẬN…).
- ✅ Nút **Tranh chấp** → nhập lý do (tùy chọn) → gửi.
- ✅ Tab Lịch sử: mọi trận mình tham gia + status pill (CHỜ XÁC NHẬN / ĐÃ XÁC NHẬN / ĐÃ GỬI DUPR / TRANH CHẤP…). Có `DUPR: <code>` nếu đã gửi.
- ⚠️ Trận không có nút Xác nhận/Tranh chấp nếu không phải người chơi hoặc không ở tab Chờ.

---

## 3. Giải linh hoạt (Flex) — tạo native

**Đường vào:** tab **Công cụ** → mục "Chọn thể thức" → hàng **Giải linh hoạt**.

3.1
- ✅ Tap "Giải linh hoạt" → mở **sheet native** (KHÔNG mở Safari).
- ✅ Nhập tên giải → nút "Tạo giải đấu" bật.
- ✅ Nhập người chơi (mỗi tên một dòng, tối đa 200) — đếm số người hiển thị.
- ✅ Toggle Công khai/Riêng tư.
- ✅ Tạo → về màn chi tiết Flex (đã sinh sẵn 1 bảng + 1 trận đơn + 1 trận đôi).
- ⚠️ Tên trống → nút Tạo mờ (disabled).
- ⚠️ Đạt giới hạn số giải → báo lỗi "giới hạn số giải miễn phí".

---

## 4. QuickTable — sân & giờ đấu

**Đường vào:** Công cụ → mở một **Bảng đấu nhanh mình tạo** (hoặc tạo mới rồi vào chi tiết).

4.1 **Hiển thị sân/giờ** (mọi người xem)
- ✅ Ở tab **Vòng bảng**, hàng trận hiện `📍 Sân X · 🕐 08:20` (khi đã xếp lịch).
- ✅ Tab **Sân**: gom trận theo sân, mỗi trận hiện giờ.

4.2 **Chức năng người tạo** `[chủ sở hữu]`
- ✅ Có nút **"Sân & giờ đấu"** (chỉ hiện với người tạo) → mở sheet.
- ✅ Nhập sân `1, 2, 3` + giờ `08:00` → **Xếp lịch**.
- ✅ Sau khi xếp: mọi trận vòng bảng có sân + giờ; thứ tự trận theo giờ chơi; không có người nào bị 2 trận cùng khung giờ.
- ✅ Bỏ trống ô sân rồi Xếp lịch → xoá phân sân/giờ.
- ⚠️ Giải tạo mới có nhập sân lúc setup → tự có lịch ngay (không cần vào sheet).

---

## 5. Cài đặt tài khoản

**Đường vào:** Home → **avatar** (góc phải) → màn Hồ sơ → **Cài đặt tài khoản**.

5.1
- ✅ **Đổi ảnh đại diện**: chạm → PhotosPicker → chọn ảnh → avatar cập nhật (spinner khi upload).
- ✅ **Đổi tên hiển thị**: sửa text → **Lưu** → nút đổi "Đã lưu".
- ✅ **Hồ sơ công khai**: bật/tắt toggle (có spinner).
- ✅ **Xoá tài khoản** (vùng nguy hiểm): tap → alert yêu cầu gõ `XOÁ` → nút "Xoá vĩnh viễn" chỉ bật khi gõ đúng → xoá xong tự đăng xuất.
- ⚠️ Tên trống → nút Lưu mờ.

---

## 6. Hoàn tất hồ sơ (Onboarding)

**Đường vào:** Home → avatar → Hồ sơ → **Hoàn tất hồ sơ / Thiết lập hồ sơ**.

6.1
- ✅ Row nổi bật (nền lime) + phụ đề "Đặt username + trình độ" nếu **chưa có username**; ngược lại là "Thiết lập hồ sơ" thường.
- ✅ Nhập tên hiển thị (tự gợi ý username nếu chưa gõ tay username).
- ✅ Nhập **username**: kiểm tra realtime → "Đang kiểm tra…" → "Khả dụng ✓" hoặc "đã có người dùng".
- ✅ Chọn **trình độ** (Người mới / Trung cấp / Nâng cao / Chuyên nghiệp).
- ✅ **Hoàn tất** → lưu; quay lại Hồ sơ.
- ⚠️ Username sai định dạng (dấu, hoa, <3 ký tự) → báo "3–32 ký tự…", nút Hoàn tất mờ.
- ⚠️ Username đã có người → nút Hoàn tất mờ.

---

## 7. Cộng đồng — Tìm bạn chơi

**Đường vào:** Home → avatar → Hồ sơ → mục **Cộng đồng** → **Tìm bạn chơi**.

7.1
- ✅ Danh sách tin tìm kèo (tên, khu vực, trình, giờ, ghi chú).
- ✅ **Đăng tìm kèo**: mở form → ghi chú (≥5 ký tự), thành phố/quận, **chip trình** (< 2.5 … 4.0+), **Hẹn giờ** (bật → DatePicker) → **Đăng** → tin xuất hiện đầu danh sách.
- ✅ **Lọc theo khu vực**: gõ tên TP vào ô lọc → Enter → danh sách lọc lại.
- ✅ Nút **Nhắn tin nhận kèo** (chỉ tin của người khác) → mở luồng chat với người đăng.
- ✅ Nút toolbar (bong bóng chat) → mở Tin nhắn.
- ⚠️ Ghi chú <5 ký tự → nút Đăng mờ.

---

## 8. Cộng đồng — Tin nhắn (DM) `[cần 2 acc]`

**Đường vào:** Hồ sơ → Cộng đồng → **Tin nhắn** (hoặc từ Tìm bạn chơi).

8.1 **Inbox**
- ✅ Danh sách hội thoại: avatar, tên, tin cuối, **badge số chưa đọc**.
- ✅ Rỗng → "Chưa có cuộc trò chuyện. Vào Tìm bạn chơi để bắt đầu."

8.2 **Thread**
- ✅ Tap hội thoại → bong bóng chat (mình phải/lime, đối phương trái), giờ dưới mỗi tin.
- ✅ Gõ tin → gửi (nút mũi tên) → tin xuất hiện, tự cuộn xuống đáy.
- ✅ Mở thread → **tự đánh dấu đã đọc** (badge inbox về 0).
- ✅ Toolbar (icon người) → mở hồ sơ đối phương.
- ✅ Tin mới từ acc kia xuất hiện trong ~4s (poll); inbox cập nhật trong ~15s.

---

## 9. Cộng đồng — Diễn đàn (Forum)

**Đường vào:** Hồ sơ → Cộng đồng → **Diễn đàn**.

9.1 **Trang chủ forum**
- ✅ Chip lọc chủ đề (Tất cả + các chủ đề). Tap → lọc bài.
- ✅ Danh sách bài: badge ghim/HỎI ĐÁP/chủ đề, tiêu đề, tags, tác giả + thời gian, số bình luận/thích.

9.2 **Đăng bài** (nút bút góc phải / "Đăng bài")
- ✅ Tiêu đề, chọn chủ đề, nội dung, **tags ≤5** (Enter thêm, X xoá), **đánh dấu Hỏi–Đáp**, **ảnh ≤4** (PhotosPicker).
- ✅ Đăng → về danh sách, bài mới lên đầu.
- ⚠️ Thiếu tiêu đề/nội dung → nút Đăng mờ.

9.3 **Chi tiết bài**
- ✅ Nội dung + lưới ảnh + tags; nút **thích** (♥ + số).
- ✅ Bình luận: avatar/tên/giờ, **trích dẫn comment cha** khi trả lời, ảnh.
- ✅ **Thích** từng bình luận; **Trả lời** (hiện "đang trả lời ai" ở composer); composer đính ảnh ≤2.
- ✅ `[Q&A + chủ bài]` nút **Chọn hay nhất** → comment lên đầu + badge "TRẢ LỜI HAY NHẤT".
- ✅ **Xoá** bình luận của mình (icon thùng rác); menu **Xoá bài** (nếu là chủ bài).

---

## 10. CLB — tạo, quản lý, chỉnh sửa

**Đường vào:** tab **Social** → sub-tab **CLB** (ClubsList).

10.1 **Tạo CLB**
- ✅ Nút **"Tạo"** → mở **sheet native** (không web).
- ✅ Tên (3–100), **slug** tự sinh + sửa tay + kiểm tra trùng ("Đang kiểm tra…" → "khả dụng ✓" / "đã dùng"), mô tả, khu vực, **logo** (PhotosPicker + Xoá).
- ✅ Tạo → CLB xuất hiện ở "CLB CỦA TÔI".
- ⚠️ Slug sai định dạng → báo lỗi, nút mờ. Đạt 3 CLB → báo "giới hạn 3 CLB".

10.2 **Quản lý CLB** `[chủ sở hữu]`
- ✅ Mở CLB mình tạo → nút **"Quản trị"** (chỉ creator/manager) → màn Quản lý.
- ✅ `[cần 2 acc]` Acc khác bấm "Tham gia" (từ CLB) → xuất hiện ở **YÊU CẦU THAM GIA** → **Duyệt** / **Từ chối**.
- ✅ Danh sách **THÀNH VIÊN** (hiện DUPR), nút xoá thành viên.

10.3 **Chỉnh sửa CLB**
- ✅ Từ Quản lý → **Chỉnh sửa CLB** → sửa tên/mô tả/khu vực/**logo** → **Lưu thay đổi**.
- ✅ **Lưu trữ CLB** (vùng nguy hiểm): tap → alert yêu cầu gõ đúng tên CLB → mới bật nút "Lưu trữ".

---

## 11. Sân — thêm sân + theo khu vực

**Đường vào:** tab **Social** → sub-tab **Sân** (VenuesList).

11.1 **Thêm sân**
- ✅ Nút **"+"** → **sheet native** (không web).
- ✅ Tên (2–120), địa chỉ (≥3), quận, **tỉnh/TP** (≥2), số sân, **mặt sân** (menu: Acrylic/cứng/nhựa đường/bê tông/gỗ/thảm/khác), **sân trong nhà** toggle, điện thoại, website.
- ✅ **Thêm sân** → thành công (sân chờ duyệt, chưa verified) → danh sách reload.
- ⚠️ Thiếu tên/địa chỉ/TP → nút mờ.

11.2 **Sân theo khu vực**
- ✅ Khối "TÌM SÂN THEO KHU VỰC" → tap 1 tỉnh/TP → **màn native** liệt kê toàn bộ sân TP đó (verified trước), tap → chi tiết sân.

---

## Ghi chú
- Các phần **CHƯA** có (đừng test): event organizer/xếp cặp/live của social event, Tournament Dashboard, luồng đăng ký magic-link/khôi phục/join, đổi mật khẩu/email, mời thành viên CLB bằng tìm kiếm.
- Nếu thấy lỗi: chụp màn + ghi bước tái hiện.
