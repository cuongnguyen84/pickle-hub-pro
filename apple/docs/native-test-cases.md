# ThePickleHub — Native iOS Manual Test Cases

Branch `feat/native-ios-phase-1`. Build trên **iPhone 17 sim (iOS 26.5)** hoặc thiết bị thật (Xcode → Run). Đăng nhập bằng tài khoản thật để test các luồng cần auth. Tap automation bị chặn → tất cả test dưới đây là **manual**.

Ký hiệu: ✅ = phải đúng · ⚠️ = điểm dễ sai · 🌐 = vẫn mở web (đúng thiết kế hybrid).

---

## 0. Smoke test (mở app)
- ✅ App mở vào tab **Trang chủ**. 5 tab dưới: Trang chủ / Trực tiếp / Social / Bảng tin / Công cụ.
- ✅ Toolbar Home (trên): trái = menu ☰ (Giải đấu / Bảng xếp hạng); phải = 🔍 tìm kiếm, 🔔 chuông (chấm đỏ nếu có thông báo chưa đọc), 👤 hồ sơ.

---

## A. BRACKET LAB — Bảng đấu nhanh (Quick Table)
Vào tab **Công cụ** → card "Bảng đấu nhanh" hoặc "Giải gần đây".

### A1. Tạo (creator, đã đăng nhập)
- ✅ Card featured "Bảng đấu nhanh" → wizard 3 bước.
- Bước 1: Tên giải, Số người chơi, "Yêu cầu VĐV đăng ký trước" (mở các tuỳ chọn con: Thi đấu đôi, Số ván BO1/3/5, rating source, giới hạn DUPR, cài đặt nâng cao).
- Bước 2: Chọn thể thức — Round Robin (disable khi >48 người), Playoff đông người (disable <32).
- Bước 3 (RR): "Chia bảng" — gợi ý số bảng. ⚠️ `large_playoff` bỏ qua bước 3, tạo ngay.
- ✅ Sau tạo (non-reg RR) → màn setup roster: nhập tên + seed + xoá, "Thêm người chơi", chia bảng Tự động/Thủ công, Số sân + Giờ bắt đầu, hộp "Mẹo chia bảng".
- ✅ Lưu → tạo giải, push vào màn chi tiết, trạng thái `group_stage`.

### A2. Chạy + chấm điểm
- ✅ Tab "Vòng bảng": bảng xếp hạng (sort thắng→hiệu số→điểm), hàng top mỗi bảng màu lime, qualified chevron khi có playoff.
- ✅ Tap trận (creator/referee) → numpad chấm điểm; hoà bị từ chối; điểm cập nhật BXH.
- ✅ Auto-refresh ~15s (đứng yên không chấm thì list tự cập nhật).
- ✅ Tab "Sân": trận sắp tới nhóm theo sân, badge "TIẾP THEO", tap → chấm.
- ✅ Vòng bảng xong → banner "Sinh vòng Playoff". Nếu 3/6 bảng → picker wildcard (chọn đúng 2 hoặc 4). Bracket tree render → chấm tới banner Vô địch.

### A3. Đăng ký (table có "Yêu cầu đăng ký")
- ✅ Viewer: "Đăng ký tham gia" form (tên/đội nếu đôi/rating/skill/profile link) → banner trạng thái.
- ✅ Organizer: "Quản lý đăng ký" → Duyệt/Từ chối/Duyệt tất cả.
- ✅ Referee (thêm qua ⚙️) chấm điểm được (không chỉ creator).

---

## B. BRACKET LAB — Đấu đồng đội (Team Match / MLP)
Tab Công cụ → "Đấu đồng đội".

### B1. Tạo → chạy
- ✅ Wizard 4 bước: tên/roster 4·6·8/số đội/đăng ký/số ván tối thiểu → game-templates (preset theo roster, add/xoá/đổi tên/rally21|sideout11) → dreambreaker (chỉ khi số game chẵn) → thể thức RR / loại trực tiếp (power-of-2 ≥4, tranh hạng 3) / rr_playoff (2/4/8 đội).
- ✅ Tab Đội → "Quản lý đội": thêm đội + roster (Nam/Nữ, ⭐captain), xoá; đội pending Duyệt/Từ chối; "Mời đội qua email".
- ✅ Tab Trận → "Sinh lịch" (RR/loại trực tiếp). rr_playoff: RR xong → "Sinh vòng Playoff".

### B2. Đội hình + chấm điểm
- ✅ Tap trận → "Đội hình" (ràng buộc giới tính: WD 0M2F / MD 2M0F / MX 1M1F / WS 0M1F / MS 1M0F / DB 4 tự do) + "Chấm điểm" (ván con + dreambreaker).
- ✅ Trận hoàn tất → tab Xếp hạng cập nhật + bracket tree playoff + banner Vô địch + "Tranh hạng 3".
- ✅ ⚙️: đổi tên / Bắt đầu giải / trọng tài / xoá. Mode đăng ký: captain "Đăng ký đội".

---

## C. BRACKET LAB — Loại trực tiếp (Doubles Elimination)
Tab Công cụ → "Loại trực tiếp".

### C1. Tạo (Self/Linh hoạt)
- ✅ Wizard 3 bước. Self/Linh hoạt + ≥2 đội → tạo + bracket (R1 winner / R2 loser / R3 merge) → mở chi tiết tab "Sơ loại".
- ✅ Chấm R1→R3 → playoff TỰ ĐỘNG sinh.

### C2. Bracket tree + Sân (DE-3/DE-4)
- ✅ Tab "Playoff": **BracketTreeView** (scroll ngang) + banner Vô địch + card "Tranh hạng 3". Tap ô có 2 đội & chưa xong → chấm.
- ⚠️ Vòng "Sơ loại" CỐ Ý vẫn là list (winner/loser/merge không phải cây SE chuẩn).
- ✅ Tab "Sân" hiện khi có trận chờ: nhóm theo "Sân N"/"Chưa gán sân", badge TIẾP THEO + giờ, tap → chấm.
- ✅ Auto-refresh 15s.

### C3. Đăng ký DUPR (DE-2) — cần giải tạo với "Nguồn rating = DUPR" (status `registration_open`)
- ✅ Viewer (đã login, khác creator): thanh tiến độ N/sức chứa; "Đăng ký đội" → "Tìm tên đồng đội" mở picker → chọn **user có tài khoản** → "Xác nhận đăng ký".
  - ⚠️ Nếu DUPR của bạn/đồng đội thiếu hoặc ngoài khoảng → hiện dòng lỗi tiếng Việt (MISSING_DUPR / ngoài khoảng).
  - ⚠️ Chọn người KHÔNG có tài khoản → báo "chưa có tài khoản", không cho đăng ký.
  - ✅ Thành công → banner "Đội của bạn" + Huỷ. Danh sách đội hiện cặp + avg DUPR.
- ✅ Creator: notice "Bạn là BTC" + "Thêm thủ công VĐV" (2 picker) + Thêm; đủ đội → "Đóng đăng ký & tạo bracket" → seed theo DUPR, build R1/R2/R3, chuyển sang tabs. Icon thùng rác xoá đội.
- ✅ ⚙️ (creator): đổi tên / trọng tài (email) / xoá.

---

## D. BRACKET LAB — Flex (giải linh hoạt)
🌐 **Tạo Flex vẫn ở web** (workspace kéo-thả). Tạo 1 giải trên web (`/tools/flex-tournament`) với vài người chơi + bảng + trận, rồi mở native từ tab Công cụ → "Giải gần đây".

### D1. Xem (FX-1)
- ✅ Header: tên · số VĐV · số trận + badge "Công khai/Không niêm yết".
- ✅ Mỗi bảng: segmented **Đơn/Đôi** (bảng người) hoặc **Đội/VĐV** (bảng đội) → bảng xếp hạng (T/B/+-) tính trực tiếp từ trận.
- ✅ List trận mỗi bảng + mục "Trận chưa xếp bảng" ở cuối. Mỗi trận: chip ĐƠN/ĐÔI, tên 2 phía, điểm, bên thắng màu lime.

### D2. Chấm điểm (FX-2)
- ✅ Creator/referee: tap trận (đã đủ slot, chưa xong) → "Chấm điểm" 2 ô số → lưu → bên thắng lime, BXH cập nhật.
- ✅ ⚙️ (creator): toggle Công khai + trọng tài (email) + xoá.

---

## E. THÔNG BÁO (Notifications — mới) 🔔
Toolbar Home → chuông.
- ✅ Chưa đăng nhập → "Cần đăng nhập".
- ✅ Đã đăng nhập, chưa có gì → "Chưa có thông báo nào."
- ✅ Có thông báo: list hợp nhất (theo dõi / thích / bình luận / nhắc đến / trạng thái trận / livestream). Mỗi dòng: icon theo loại + tiêu đề + nội dung + thời gian; chấm lime nếu chưa đọc.
- ✅ Nút "Đọc tất cả" (hiện khi có chưa đọc) → xoá hết chấm + badge chuông.
- ✅ Tap thông báo **theo dõi** (`/nguoi-choi/...`) → mở **hồ sơ native**. Các loại khác → mở web in-app (Safari sheet). Sau tap → tự đánh dấu đã đọc.
- ⚠️ Badge chuông đỏ trên Home cập nhật khi vào lại tab Home (chưa realtime).

---

## F. TÌM KIẾM (Search — mới) 🔍
Toolbar Home → kính lúp.
- ✅ Thanh search; gõ ≥2 ký tự, debounce 300ms.
- ✅ Kết quả 3 nhóm: **Người chơi** / **Giải đấu** / **Video** (nhóm nào có kết quả mới hiện).
- ✅ Tap người chơi → **hồ sơ native** (PlayerProfileView). ⚠️ Người chơi không có username thì không bấm được.
- ✅ Tap giải đấu → **chi tiết giải native**.
- ✅ Tap video → **player native (AVPlayer)** phát luôn trong app.
- ✅ Không có kết quả → "Không tìm thấy kết quả cho …". < 2 ký tự → gợi ý nhập từ khoá.

---

## G. BẢNG TIN (Feed) — news + video giờ native
Tab **Bảng tin**.
- ✅ Trận → card mở rộng inline (native). Blog → reader native.
- ✅ **Tin tức** → màn native (ảnh + tiêu đề + tóm tắt). Nút "Đọc toàn bộ tại {nguồn}" mở **bài gốc bên ngoài** (không phải trang web app). Badge AI nếu là bản dịch.
- ✅ **Video** → tap mở **player native (AVPlayer)** — KHÔNG còn nhảy web. ⚠️ Nếu video không có nguồn phát → màn "Không phát được" + nút "Mở trên web".

---

## H. CÁC TAB KHÁC (đã native từ trước — regression nhẹ)
- ✅ **Trực tiếp**: segmented Trực tiếp/Phát lại/Video; tap phát qua AVPlayer; replay dùng asset HLS (không đen hình).
- ✅ **Social**: list sự kiện + chi tiết native. 🌐 "Đăng ký" sự kiện vẫn mở web (OTP/thanh toán — đúng thiết kế).
- ✅ **Trang chủ**: ticker, partner card, "Tuần này", Tin mới, thống kê, sắp diễn ra, video, newsletter.
- ✅ **Hồ sơ** (👤): rating card + thống kê + form last-5; "Log trận" mở wizard native.
- ✅ Menu ☰ → Giải đấu (list+chi tiết native), Bảng xếp hạng (DUPR VN, Đôi/Đơn).

---

## I. GIỮ WEB (hybrid — KHÔNG phải bug) 🌐
Các chỗ này CỐ Ý mở web in-app:
- Admin (`/admin/*`), Creator studio (`/creator/*`), Quản lý CLB.
- OTP + thanh toán (đăng ký Social/Tournament có phí).
- DUPR SSO connect, trang pháp lý, directory sân, Flex create, dashboard chéo-giải.
- Mỗi màn Bracket Lab có nút "Mở trên web" (safari) — escape hatch, vẫn giữ.

---

## Ghi chú build
- Cài qua Xcode → Run (bản `xcodebuild` của Claude chỉ cài lên iPhone 17 sim).
- Nếu thấy bug, build có thể CŨ → Run lại trên Xcode.
- Branch: `feat/native-ios-phase-1`.
