## Plan: Gate tất cả trang chi tiết giải đấu - yêu cầu đăng nhập

### Tổng quan

Chặn hoàn toàn truy cập vào trang chi tiết giải đấu nếu chưa đăng nhập. Người dùng chưa xác thực sẽ được redirect về trang Login với return URL để quay lại sau khi đăng nhập.

### Phạm vi áp dụng

5 trang chi tiết giải đấu:

- `/qt/:shareId` — Quick Table View
- `/doubles-elimination/:id` — Doubles Elimination View  
- `/team-match/:id` — Team Match View
- `/flex/:id` — Flex Tournament View
- `/tournaments/:slug` — Tournament Detail (livestream/video content)

### Thiết kế kỹ thuật

**1. Tạo component `RequireAuth` (wrapper)**

- File: `src/components/auth/RequireAuth.tsx`
- Dùng `useAuth()` để check user
- Nếu đang loading → hiển thị skeleton/spinner
- Nếu chưa đăng nhập → `<Navigate to={/login?redirect=currentPath} replace />`
- Nếu đã đăng nhập → render children

**2. Wrap 5 route trong `App.tsx**`

- Bọc các route tournament detail bằng `<RequireAuth>`
- Không ảnh hưởng trang danh sách (Tournaments, QuickTables, etc.) — vẫn public

**3. Thêm i18n keys**

- Thêm key cho thông báo trên trang login khi redirect từ tournament (optional UX enhancement)

### File thay đổi


| File                                  | Thay đổi                           |
| ------------------------------------- | ---------------------------------- |
| `src/components/auth/RequireAuth.tsx` | **Tạo mới** — auth guard component |
| `src/App.tsx`                         | Wrap 5 route bằng RequireAuth      |


### Lưu ý

- Không cần thay đổi database/RLS — đây là gate ở UI level
- SEO: các trang tournament detail sẽ không crawlable bởi anonymous users. Nếu cần SEO cho các trang này, cần approach khác (server-side rendering hoặc cho phép xem partial content)
- Trang danh sách giải đấu (`/tournaments`, `/tools/quick-tables`, etc.) vẫn public để user khám phá rồi mới cần đăng nhập khi click vào chi tiết
- Cần redirect lại trang trước ngay sau khi đăng kí hoặc đăng nhập xong