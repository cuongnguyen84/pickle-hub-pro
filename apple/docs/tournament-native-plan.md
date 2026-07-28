# Bracket Lab native — roadmap và trạng thái nghiệm thu

Cập nhật: 2026-07-23
Phạm vi: app SwiftUI trong `/apple`, đối chiếu với các route production
`/tools/*` và source web tương ứng. Backend Supabase/RPC tiếp tục là nguồn dữ
liệu chung giữa web và native.

## Kết luận hiện tại

Roadmap port Bracket Lab sang native đã hoàn tất ở mức chức năng. Bốn thể thức,
giải nhiều nội dung và dashboard sân đều có luồng native để tạo, quản lý, đăng
ký, chạy giải, chấm điểm và xem kết quả. WebView không còn là điều kiện để hoàn
thành một giải; nút Safari trong màn chi tiết chỉ là viewer tùy chọn cho link
công khai.

Luồng đăng nhập DUPR vẫn mở trang SSO của nhà cung cấp bằng
`SFSafariViewController`. Đây là ranh giới bảo mật của OAuth/SSO bên thứ ba,
không phải màn quản lý giải bị thiếu native. Sau khi quay lại, app tự kiểm tra
lại trạng thái liên kết và điểm DUPR.

## Ma trận web production → native

| Khu vực | Năng lực native | Trạng thái |
|---|---|---|
| Tools hub | 4 format, giải của tôi, giải tôi chấm, admin “Tất cả”, tìm kiếm/lọc, Flex công khai | Hoàn tất |
| Quick Table | Wizard, đăng ký đơn/đôi, ghép đôi bằng request hoặc link mời, danh sách đã duyệt, duyệt hàng loạt, ghi chú BTC, roster, chia bảng tự động/thủ công, lịch sân, vòng bảng, wildcard/playoff, cây nhánh, trọng tài/PIN, chấm điểm | Hoàn tất |
| Doubles Elimination | Wizard, đăng ký DUPR, BTC thêm/xóa đội, chốt đăng ký, R1/R2/R3, playoff, BO1/3/5, cây nhánh, sân, trọng tài/PIN, chấm điểm | Hoàn tất |
| Team Match (MLP) | Wizard/template, đăng ký/tái dùng đội, roster/đội trưởng, lệ phí, DUPR, chia bảng, lineup, game con, DreamBreaker, playoff/tái sinh, metadata/chat, trọng tài/PIN, chấm điểm | Hoàn tất |
| Flex | Wizard, người chơi/đội/thành viên, bảng, slot, trận cha/con, cấu hình BXH, sinh round-robin, scoring, visibility, trọng tài/PIN | Hoàn tất |
| Giải nhiều nội dung | Tạo giải tổng, thông tin công khai, tạo và gắn Quick Table con, chia sẻ, xóa có điều kiện | Hoàn tất |
| Dashboard sân | Chọn giải đang chạy, live/next theo sân, Team Match queue, realtime + polling 10 giây, âm báo, TV mode tự chuyển trang | Hoàn tất |
| Universal links | List/create/detail/setup, parent, dashboard, Quick referee, Team Match score, Doubles score; route `/tools/*` lạ về Tools hub an toàn | Hoàn tất |

## Kiến trúc đã áp dụng

- `TournamentService` dùng chung current user, quyền admin, trạng thái DUPR và
  realtime cho bốn format.
- `TournamentRefreshGate` gộp các lần refresh chồng nhau.
- Mutation nhiều bước quan trọng gọi RPC transaction dùng chung với web; điểm
  số dùng `score_version` để phát hiện hai thiết bị ghi đè nhau.
- Mỗi màn chi tiết có realtime debounce 500 ms và polling dự phòng 15 giây;
  dashboard dùng 10 giây.
- Draft của các wizard được lưu cục bộ, có thể khôi phục khi app bị đưa xuống
  nền hoặc đóng giữa chừng.
- Quyền native khớp web: creator/admin được quản lý; referee được chấm; captain
  Team Match có quyền theo đội của mình.

## Các phase đã đóng

### Phase 0 — Nền dùng chung

Hoàn tất service realtime, refresh gate, quota/RPC, quyền creator/admin/referee/
captain, deep link và routing native.

### Phase 1 — Xem và chấm điểm

Hoàn tất cho Quick Table, Doubles Elimination, Team Match và Flex. Các sheet
giữ nguyên dữ liệu khi lưu lỗi, chặn submit trùng và cho thử lại.

### Phase 2 — Tạo giải

Hoàn tất wizard native cho bốn format, gồm format nâng cao, game template,
manual assignment, DUPR range, court/time và draft recovery.

### Phase 3 — Đăng ký và roster

Hoàn tất đăng ký đơn/đôi, pair request và partner invitation, danh sách người
tham dự đã duyệt, BTC batch actions/notes, DUPR verified gate, Team Match
team/roster/payment và Doubles open registration.

### Phase 4 — Cây nhánh và dashboard

Hoàn tất cây nhánh Quick/Doubles/Team Match, dashboard nhiều giải, TV mode,
live/next court queue và deep link vào màn chấm điểm.

### Phase 5 — Hoàn thiện

Hoàn tất loading/error/empty states, Dynamic Type, vùng chạm tối thiểu 44 pt,
xác nhận thao tác phá hủy, share link, pull-to-refresh, realtime cleanup và
Release build guardrail.

## Việc không thuộc roadmap port native

- Upload binary/App Store Connect, ký archive và phát hành production là bước
  release riêng, chỉ thực hiện khi chủ dự án chủ động chạy hoặc ủy quyền.
- Nội dung SEO/marketing của các trang Tools vẫn thuộc web.
- Trang đăng nhập SSO của DUPR do bên thứ ba cung cấp và phải chạy trong phiên
  web bảo mật; mọi trạng thái/eligibility sau SSO đã được xử lý native.

## Tiêu chí nghiệm thu trước khi phát hành

1. Chạy toàn bộ unit tests trên iOS Simulator.
2. Build Debug và Release; target app/test đã bật
   `SWIFT_TREAT_WARNINGS_AS_ERRORS=YES` (không ép cờ này lên package bên thứ ba).
3. Smoke test bằng tài khoản creator, admin, referee và player trên dữ liệu staging.
4. Xác nhận universal links `/tools/*` trên thiết bị thật.
5. Archive bằng signing production và upload App Store Connect ở bước release.
