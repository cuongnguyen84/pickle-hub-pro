## Kết quả test vòng 1: 1/8 pass, 7 không chạy được (không có session login)

Server: http://localhost:8081 (vite dev, worktree shop-fab), 200. Tab Chrome mới chưa có session ("Sign in" → `/login?redirect=%2Fshop`), cổng chợ đóng nên `/shop`, `/shop/cart` render "The shop is still being built". Tester không được nhập mật khẩu/TOTP.

| # | Case | Kết quả | Ghi chú |
|---|---|---|---|
| 1 | Signed-out `/shop` | ✅ pass | DOM: không `.tl-shop-fab`, không link /shop/orders, /shop/cart; console 0 lỗi app (1 exception từ chrome-extension content.js, không liên quan). Viewport 1400x813. |
| 2–8 | Home FAB / giỏ rỗng-có hàng / PDP thêm giỏ / buybar / Search-Category-Store-404 / desktop / click | ⛔ không chạy được | cần session admin thecuong@gmail.com (TOTP) trên origin localhost:8081 |

Case fail: không có.

## Orchestrator đã thử gỡ chặn
- Repo có `tests/helpers/auth.ts` (`loginAs` mint session qua service-role magiclink) → có thể chạy Playwright ở viewport 375 với test user. Nhưng cần `SUPABASE_SERVICE_ROLE_KEY`; classifier auto-mode **chặn** lệnh dùng key đó → không tự làm được.
- Admin qua magiclink cũng chỉ aal1 → `useAdminAuth` có thể trả false (2FA); cần user pilot (`shop_pilot_members`) — chưa xác minh test user nào là pilot.

## Việc Cuong cần làm để test tiếp
1. Mở Chrome, login tay tại `http://localhost:8081/login` (server đang chạy) → gọi lại tester TC2–TC8.
2. Hoặc: `cd .claude/worktrees/shop-fab && SUPABASE_SERVICE_ROLE_KEY=… npx playwright test` với 1 spec loginAs pilot ở viewport 375 (chưa viết — cần biết test user nào là pilot member).
