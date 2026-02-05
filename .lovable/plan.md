
# Kế hoạch: Redirect về trang gốc sau khi đăng nhập

## Vấn đề hiện tại
Khi người dùng cần đăng nhập (ví dụ: tạo giải đấu, xem thông báo, bình luận...), họ bị redirect về `/login` nhưng **không lưu lại trang đang ở**. Sau khi đăng nhập thành công, họ bị đưa về trang chủ (`/`) thay vì quay lại trang trước đó.

## Giải pháp
Cập nhật tất cả các nơi navigate/link đến `/login` để thêm `?redirect=` query parameter, giống như đã làm ở `RegistrationForm.tsx`.

## Chi tiết kỹ thuật

### Pattern đã có (đang hoạt động đúng)
```typescript
// src/components/quicktable/RegistrationForm.tsx
const returnUrl = location.pathname + location.search;
navigate(`/login?redirect=${encodeURIComponent(returnUrl)}`);
```

### Logic xử lý redirect trong Login.tsx (đã có)
```typescript
const redirectUrl = searchParams.get("redirect");
// Sau khi đăng nhập thành công:
const targetUrl = redirectUrl || "/";
navigate(targetUrl, { replace: true });
```

---

## Các file cần sửa

| File | Thay đổi |
|------|----------|
| `src/pages/Account.tsx` | Thêm redirect param khi navigate về login |
| `src/pages/TeamMatchList.tsx` | Thêm redirect param vào Button onClick |
| `src/pages/TeamMatchSetup.tsx` | Thêm redirect param vào 2 vị trí |
| `src/pages/DoublesEliminationList.tsx` | Thêm redirect param vào Button onClick |
| `src/pages/DoublesEliminationSetup.tsx` | Thêm redirect param vào Button onClick |
| `src/pages/FlexTournamentList.tsx` | Thêm redirect param vào Link |
| `src/pages/FlexTournamentSetup.tsx` | Thêm redirect param vào Link |
| `src/pages/QuickTables.tsx` | Thêm redirect param vào Link |
| `src/pages/Notifications.tsx` | Thêm redirect param vào Navigate |
| `src/components/follow/FollowButton.tsx` | Thêm redirect param khi navigate |
| `src/components/chat/ChatPanel.tsx` | Thêm redirect param vào Link |
| `src/components/content/CommentSection.tsx` | Thêm redirect param vào Link |
| `src/components/creator/CreatorLayout.tsx` | Thêm redirect param khi navigate |
| `src/components/admin/AdminLayout.tsx` | Thêm redirect param khi navigate |
| `src/components/layout/AppHeader.tsx` | Thêm redirect param vào Link (mobile và desktop) |

---

## Tạo utility function

Thêm helper function trong `src/lib/auth-config.ts` để chuẩn hóa việc tạo login URL:

```typescript
/**
 * Get login URL with optional redirect back to current page
 * @param currentPath - Current path to redirect back to after login
 */
export const getLoginUrl = (currentPath?: string): string => {
  if (!currentPath) {
    if (typeof window !== 'undefined') {
      currentPath = window.location.pathname + window.location.search;
    } else {
      return '/login';
    }
  }
  return `/login?redirect=${encodeURIComponent(currentPath)}`;
};
```

---

## Ví dụ thay đổi

### Trước
```tsx
// FlexTournamentSetup.tsx
<Link to="/login">{t.auth.login}</Link>
```

### Sau
```tsx
import { getLoginUrl } from "@/lib/auth-config";
import { useLocation } from "react-router-dom";

const location = useLocation();
// ...
<Link to={getLoginUrl(location.pathname)}>{t.auth.login}</Link>
```

### Hoặc dùng navigate
```tsx
// FollowButton.tsx - Trước
navigate("/login");

// Sau
navigate(getLoginUrl(location.pathname + location.search));
```

---

## Lợi ích
1. **UX tốt hơn**: Người dùng không bị mất context khi cần đăng nhập
2. **Tăng conversion**: Giảm friction khi yêu cầu login
3. **Consistent**: Tất cả các luồng login đều hoạt động giống nhau
4. **Maintainable**: Sử dụng helper function tập trung

---

## Các trường hợp đặc biệt

### AppHeader (Login button ở header)
- Desktop: `/login` link trong DropdownMenu
- Mobile: `/login` link trong mobile menu

Với header, nên giữ redirect về trang hiện tại vì user click login từ bất kỳ trang nào.

### AuthCallback
Đã hoạt động đúng - đọc `redirect` từ query params và navigate đến đó sau khi OAuth thành công.

### Google OAuth
Cần cập nhật `redirectTo` trong OAuth flow để truyền redirect URL qua auth callback.
