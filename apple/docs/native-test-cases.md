# ThePickleHub — Native iOS Manual Test Cases

Branch hiện tại `main`. Build trên **iPhone 17 sim (iOS 26.5)** hoặc thiết bị thật (Xcode → Run). Đăng nhập bằng tài khoản thật để test các luồng cần auth. Tap automation bị chặn → tất cả test dưới đây là **manual**.

Ký hiệu: ✅ = phải đúng · ⚠️ = điểm dễ sai · 🌐 = vẫn mở web (đúng thiết kế hybrid).

---

## 0. Smoke test (mở app)
- ✅ App mở vào tab **Trang chủ**. 5 tab dưới: Trang chủ / Trực tiếp / Social / Bảng tin / Công cụ.
- ✅ Toolbar Home (trên): trái = menu ☰ (Giải đấu / Bảng xếp hạng); phải = 🔍 tìm kiếm, 🔔 chuông (chấm đỏ nếu có thông báo chưa đọc), 👤 hồ sơ.

### 0.1 Upgrade production identity + remote push (release-only)

- Cài bản Capacitor hiện hành, đăng nhập, rồi update đè signed native Release cùng
  bundle `net.thepicklehub.app`; app mở không crash và yêu cầu login lại đúng một lần.
- Sau login native, kill/relaunch vẫn giữ session Keychain.
- Cho phép notification: Supabase có đúng FCM token `platform=ios`; foreground,
  background và tap push đều hoạt động. Payload có `event_slug`, `link_url` hoặc
  livestream mở đúng màn native.
- Logout → login tài khoản khác: thiết bị không nhận push của tài khoản cũ; không
  sinh binding token trùng. Từ chối permission cũng không crash.
- Chỉ đặt `REMOTE_PUSH_ENABLED=YES` và `CAPACITOR_AUTH_RESET_APPROVED=YES` sau khi
  toàn bộ case trên pass trên thiết bị thật bằng signed Release/App Store build.

### 0.2 Sign in with Apple (signed device build)

- Nút **Tiếp tục với Apple** dùng giao diện hệ thống và có độ nổi bật tương đương
  Google; hủy sheet không hiện lỗi.
- Lần đầu chọn **Chia sẻ email** → tạo Supabase session, lưu tên Apple và profile;
  kill/mở lại vẫn đăng nhập.
- Thu hồi quyền app trong Apple ID rồi thử lại với **Ẩn email** → đăng nhập thành
  công bằng địa chỉ relay, không tạo profile thiếu ID.
- Sửa tên trong Hồ sơ, đăng xuất rồi đăng nhập Apple lại → tên đã sửa không bị
  ghi đè.
- Tài khoản Apple đã dùng trên web đăng nhập được ở native và không tạo user mới
  ngoài ý muốn. Nếu báo audience không hợp lệ, kiểm tra Client IDs trong Supabase.

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
- ✅ Thay đổi từ thiết bị/web khác cập nhật qua realtime; nếu stream gián đoạn,
  polling dự phòng vẫn tải lại trong khoảng 15 giây.
- ✅ Nút chia sẻ trên toolbar mở share sheet đúng URL public của giải.
- ⚠️ Tắt mạng rồi lưu điểm: sheet không đóng, số đã nhập không mất, nút đổi thành
  "Thử lại"; bật mạng và thử lại chỉ tạo một lần lưu.
- ✅ Tab "Sân": trận sắp tới nhóm theo sân, badge "TIẾP THEO", tap → chấm.
- ✅ Vòng bảng xong → banner "Sinh vòng Playoff". Nếu 3/6 bảng → picker wildcard (chọn đúng 2 hoặc 4). Bracket tree render → chấm tới banner Vô địch.

### A3. Đăng ký (table có "Yêu cầu đăng ký")
- ✅ Viewer: "Đăng ký tham gia" form (tên/đội nếu đôi/rating/skill/profile link) → banner trạng thái.
- ✅ Người xem thấy danh sách VĐV/đội đã duyệt nhưng không nhận field ghi chú
  nội bộ của BTC.
- ✅ Thi đấu đôi: sau khi tạo đăng ký cá nhân, danh sách VĐV đang tìm đồng đội
  hiện trong app; gửi yêu cầu → bên kia thấy Đồng ý/Từ chối; người gửi có thể
  Hủy; Đồng ý ghép hai người thành một đội. Link mời cũ vẫn dùng được dự phòng.
- ✅ Organizer: "Quản lý đăng ký" → chọn nhiều, Duyệt/Từ chối/Duyệt tất cả,
  chỉnh điểm override và ghi chú BTC.
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
- ✅ Realtime cập nhật trận/đội/roster; polling 15 giây là fallback. Toolbar chia
  sẻ đúng link. Lưu ván lỗi giữ nguyên điểm và cho "Thử lại".

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
- ✅ Realtime cập nhật; polling 15 giây là fallback. Toolbar chia sẻ đúng link.
- ⚠️ Lưu điểm khi mất mạng giữ nguyên toàn bộ các ván BO1/3/5 để thử lại.

### C3. Đăng ký DUPR (DE-2) — cần giải tạo với "Nguồn rating = DUPR" (status `registration_open`)
- ✅ Chưa liên kết DUPR → form bị khóa, hiện nút kết nối; đóng SSO quay lại app
  thì native kiểm tra lại trạng thái trước khi mở form.
- ✅ Viewer (đã login, khác creator): thanh tiến độ N/sức chứa; "Đăng ký đội" → "Tìm tên đồng đội" mở picker → chọn **user có tài khoản** → "Xác nhận đăng ký".
  - ⚠️ Nếu DUPR của bạn/đồng đội thiếu hoặc ngoài khoảng → hiện dòng lỗi tiếng Việt (MISSING_DUPR / ngoài khoảng).
  - ⚠️ Chọn người KHÔNG có tài khoản → báo "chưa có tài khoản", không cho đăng ký.
  - ✅ Thành công → banner "Đội của bạn" + Huỷ. Danh sách đội hiện cặp + avg DUPR.
- ✅ Creator: notice "Bạn là BTC" + "Thêm thủ công VĐV" (2 picker) + Thêm; đủ đội → "Đóng đăng ký & tạo bracket" → seed theo DUPR, build R1/R2/R3, chuyển sang tabs. Icon thùng rác xoá đội.
- ✅ ⚙️ (creator): đổi tên / trọng tài (email) / xoá.

---

## D. BRACKET LAB — Flex (giải linh hoạt)

### D0. Tạo native
- ✅ Tab Công cụ → "Giải linh hoạt" mở sheet native: tên, công khai và danh sách
  người chơi tùy chọn (mỗi dòng một tên).
- ✅ Tạo xong mở chi tiết native; backend tạo sẵn 1 bảng + 1 trận đơn + 1 trận đôi.
- ✅ Nút quản lý mở workspace native: thêm/đổi tên/xóa người, đội, bảng và trận;
  gán thành viên/slot/bảng bằng picker; sinh lịch round-robin.

### D1. Xem (FX-1)
- ✅ Header: tên · số VĐV · số trận + badge "Công khai/Không niêm yết".
- ✅ Mỗi bảng: segmented **Đơn/Đôi** (bảng người) hoặc **Đội/VĐV** (bảng đội) → bảng xếp hạng (T/B/+-) tính trực tiếp từ trận.
- ✅ List trận mỗi bảng + mục "Trận chưa xếp bảng" ở cuối. Mỗi trận: chip ĐƠN/ĐÔI, tên 2 phía, điểm, bên thắng màu lime.

### D2. Chấm điểm (FX-2)
- ✅ Creator/referee: tap trận (đã đủ slot, chưa xong) → "Chấm điểm" 2 ô số → lưu → bên thắng lime, BXH cập nhật.
- ✅ ⚙️ (creator): toggle Công khai + trọng tài (email) + xoá.
- ✅ Realtime cập nhật player/team/group/match; polling 15 giây là fallback.
- ✅ Toolbar chia sẻ đúng link. Lưu lỗi giữ nguyên hai ô điểm và cho thử lại.

### D3. Workspace nâng cao
- ✅ Chuyển trận giữa chế độ VĐV/đội phải xoá slot không tương thích và không để
  dữ liệu cũ lọt vào BXH.
- ✅ Bật/tắt tính trận vào BXH, bật/tắt cộng trận đôi vào BXH đơn.
- ✅ Trận cha/chuỗi trận con cập nhật tổng điểm sau khi lưu điểm con.
- ✅ Giải Flex công khai xuất hiện trong mục khám phá và mở chi tiết native.

---

## D4. GIẢI NHIỀU NỘI DUNG + DASHBOARD SÂN
- ✅ Tạo giải tổng, nhập mô tả/ngày/địa điểm; tạo Quick Table con và tự gắn vào
  giải tổng; viewer mở từng nội dung native.
- ✅ Không cho xóa giải tổng khi còn nội dung; có confirmation trước khi xóa.
- ✅ Dashboard picker hiện Quick Table vòng bảng/playoff, Team Match ongoing và
  Doubles Elimination đang chạy.
- ✅ Quick/Doubles: mỗi sân hiện trận live + trận kế tiếp; Team Match hiện hàng
  đợi live/sắp tới; refresh realtime và polling 10 giây.
- ✅ TV mode giữ màn hình sáng, tối đa 6 card/trang, tự chuyển trang 10 giây và
  có nút dừng/tắt.
- ✅ Admin mở một giải từ “Tất cả” có đủ quyền quản lý/chấm như trên web.
- ✅ Universal link list/create/detail/setup/dashboard và link chấm điểm của cả
  ba format mở đúng màn native.

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
- ✅ Từ khoá có dấu câu/ký tự filter như `A.B, (C): D`, dấu nháy, `\\`, `%`,
  `_`, `*` không làm vỡ request và không bị tự ý xoá ký tự.

---

## G. BẢNG TIN (Feed) — news + video giờ native
Tab **Bảng tin**.
- ✅ Trận → card mở rộng inline (native). Blog → reader native.
- ✅ **Tin tức** → màn native (ảnh + tiêu đề + tóm tắt). Nút "Đọc toàn bộ tại {nguồn}" mở **bài gốc bên ngoài** (không phải trang web app). Badge AI nếu là bản dịch.
- ✅ **Video** → tap mở **player native (AVPlayer)** — KHÔNG còn nhảy web. ⚠️ Nếu video không có nguồn phát → màn "Không phát được" + nút "Mở trên web".

---

## H2. TRỰC TIẾP — thiết kế lại "cinematic" (Phương Án A) ⭐ MỚI
- ✅ Header editorial: eyebrow lime "THEPICKLEHUB" + tiêu đề serif đổi theo tab; toolbar phải có 🔍 + 👤.
- ✅ Segmented Trực tiếp/Phát lại/Video; "Trực tiếp" có chấm đỏ khi có trận live; mặc định mở tab có live.
- **Tab Trực tiếp:**
  - ✅ Hero "sân chính": ảnh 16:9 + badge LIVE (nhấp nháy, tắt khi Reduce Motion) + nút play; dưới có tên (serif) + org + "Xem ngay" (→ player) + nút Chia sẻ.
  - ✅ "Sân khác đang live": dải cuộn ngang các sân (chỉ khi >1 live); chấm đỏ pulse + đếm số sân.
  - ✅ "Sắp phát": hàng có ô đếm ngược (CÒN N' / giờ) + tên + giờ·org + nút **NHẮC TÔI** (đặt local notification ~10' trước; đổi thành "ĐÃ ĐẶT ✓"; xin quyền lần đầu).
  - ✅ "Phát lại nổi bật" ở cuối.
  - ✅ Không có live & sắp phát → empty "Hiện chưa có trận trực tiếp" + vẫn show phát lại.
- **Tab Phát lại:**
  - ✅ Chip lọc theo giải/org (Tất cả + tên org); "Xem tiếp" (dải video xem dở) + "Mới nhất" (list).
- ✅ **Resume**: xem dở 1 replay/video → thoát → thẻ hiện thanh tiến độ + "▸ Còn N phút"; mở lại tiếp đúng giây + nút "Xem từ đầu".
- ✅ Player: AirPlay + nút PiP của hệ thống (AVKit). Auto-poll 20s ở tab Trực tiếp; pull-to-refresh; skeleton khi tải; "Không kết nối được luồng" khi lỗi.
- ⚠️ KHÔNG có: chat trực tiếp, đổi sân trong player, chọn chất lượng, mini-player, số người xem/tỉ số real-time (backend `public_livestreams` chưa có field → không bịa số).

## H. CÁC TAB KHÁC (đã native từ trước — regression nhẹ)
- ✅ **Trực tiếp** (cũ): xem H2 ở trên.
- ✅ **Social**: list sự kiện + chi tiết native.
  - Không cấu hình `TURNSTILE_SITE_KEY`, key rỗng/sai format, hoặc event có
    `allow_guests = false`: 🌐 "Đăng ký" mở Safari fallback, không hiện form OTP native.
  - Build flag OFF, remote `native_event_registration_enabled` thiếu/false/sai
    kiểu hoặc request remote lỗi: 🌐 Safari fallback. Chuyển remote false phải tắt
    native flow ở lần mở lại chi tiết event mà không cần cài app mới.
  - Có site key + event cho khách: form native bắt buộc tên, điện thoại, CAPTCHA;
    event có slot bắt buộc chọn slot, slot đầy bị disable và hiện số chỗ còn lại.
    Nút "Đăng ký trên web" luôn mở được fallback dù native service đang lỗi.
  - Gửi OTP thành công: báo đúng kênh SMS/Zalo; token CAPTCHA cũ không được dùng lại.
    OTP sai/hết hạn/quá số lần thử hiển thị lỗi tiếng Việt từ stable backend code.
  - OTP đúng, event miễn phí: vào "Quản lý đăng ký", thoát/mở lại event vẫn khôi
    phục bằng token Keychain; huỷ và kích hoạt lại hoạt động khi event còn chỗ.
    Đây cũng là device smoke bắt buộc vì unsigned simulator test không có Keychain entitlement.
  - Event có phí: hiện VietQR khi BTC bật payment; nếu chưa bật hoặc API payment
    lỗi, đăng ký vẫn được giữ và UI hướng dẫn thanh toán tại sân/thử tải lại.
  - ⚠️ Các case OTP/payment trên phải chạy bằng thiết bị thật trước khi đưa site
    key vào cấu hình release; simulator/unit test không gửi OTP thật.
- ✅ **Trang chủ**: ticker, partner card, "Tuần này", Tin mới, thống kê, sắp diễn ra, video, newsletter.
- ✅ **Hồ sơ** (👤): rating card + thống kê + form last-5; "Log trận" mở wizard native.
- ✅ Menu ☰ → Giải đấu (list+chi tiết native), Bảng xếp hạng (DUPR VN, Đôi/Đơn).

---

## I. GIỮ WEB (hybrid — KHÔNG phải bug) 🌐
Các chỗ này CỐ Ý mở web in-app:
- Admin (`/admin/*`), Creator studio (`/creator/*`), Quản lý CLB.
- Đăng ký Social khi native activation gate chưa đạt; đăng ký Tournament có phí.
- DUPR SSO connect (OAuth của nhà cung cấp), trang pháp lý và directory sân.
- Mỗi màn Bracket Lab có nút "Mở trên web" (safari) — escape hatch, vẫn giữ.

---

## Ghi chú build
- Cài qua Xcode → Run (bản `xcodebuild` của Claude chỉ cài lên iPhone 17 sim).
- Nếu thấy bug, build có thể CŨ → Run lại trên Xcode.
- Branch: `main`.
