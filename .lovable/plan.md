

## Kế hoạch: Thêm toggle "Yêu cầu đăng nhập xem chi tiết giải" vào Admin Panel

### Tổng quan
Thêm setting `require_login_tournament_detail` vào system_settings, hiển thị toggle trong Admin Overview, và sử dụng setting này trong App.tsx để quyết định có wrap RequireAuth cho các trang chi tiết giải hay không.

### Các bước thực hiện

**1. Database migration** — Thêm row mới vào `system_settings`
```sql
INSERT INTO system_settings (key, value) 
VALUES ('require_login_tournament_detail', 'false')
ON CONFLICT (key) DO NOTHING;
```

**2. `src/hooks/useSystemSettings.ts`** — Thêm field mới vào interface và default
- Thêm `require_login_tournament_detail: boolean` vào `SystemSettings`
- Default: `false` (cho phép xem không cần đăng nhập)

**3. `src/i18n/en.ts` + `src/i18n/vi.ts`** — Thêm i18n keys
- `tournamentGate`: "Tournament Detail Access" / "Truy cập chi tiết giải"
- `requireLoginTournament`: "Require login to view tournament details" / "Yêu cầu đăng nhập để xem chi tiết giải"
- `requireLoginTournamentDesc`: mô tả ngắn

**4. `src/pages/admin/AdminOverview.tsx`** — Thêm card settings mới
Thêm một card "Tournament Access" giữa Livestream Settings và Geo Blocking, với một Switch toggle cho `require_login_tournament_detail`. Áp dụng cho 5 route: Tournament Detail, Quick Table, Team Match, Doubles Elimination, Flex Tournament.

**5. `src/App.tsx`** — Conditional RequireAuth dựa trên setting
Tạo component `ConditionalAuth` wrap children trong `RequireAuth` chỉ khi setting `require_login_tournament_detail` là `true`. Thay thế 5 chỗ `<RequireAuth>` bằng `<ConditionalAuth>`.

### Chi tiết kỹ thuật

**ConditionalAuth component** (trong App.tsx hoặc file riêng):
```typescript
function ConditionalAuth({ children }: { children: ReactNode }) {
  const { data: settings, isLoading } = useSystemSettings();
  
  if (isLoading) return <PageLoader />;
  if (settings?.require_login_tournament_detail) {
    return <RequireAuth>{children}</RequireAuth>;
  }
  return <>{children}</>;
}
```

**5 routes bị ảnh hưởng:**
- `/tournament/:slug`
- `/tools/quick-tables/:shareId`
- `/tools/team-match/:id`
- `/tools/doubles-elimination/:shareId`
- `/tools/flex-tournament/:shareId`

### Bảo mật
- Data đọc từ DB đều qua public SELECT policies → anonymous user vẫn đọc được
- Actions write (scoring, registration) vẫn check auth ở tầng hook/mutation
- Setting default `false` = mở public ngay sau deploy

