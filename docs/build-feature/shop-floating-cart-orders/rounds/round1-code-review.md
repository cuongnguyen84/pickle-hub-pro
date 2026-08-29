# Round 1 — Bước A: Code review + test case

## 1. Diff thật
8 file khớp báo cáo coder. Không commit mới, không đụng Cart/Checkout/Orders/OrderDetail.

## 2. Verdict theo acceptance criteria (Codex + prompt-engineer xác minh)
| # | Criterion | Codex | PE | Ghi chú |
|---|---|---|---|---|
| 1 | floating → `.tl-shop-fab` bọc 2 link; không floating → markup cũ | đạt | đạt | |
| 2 | Chưa login → null | đạt | đạt | guard `!user` trước nhánh floating |
| 3 | `is-lit` chỉ khi floating && count>0; shadow chỉ <900 | đạt | đạt | |
| 4 | `body:has(buybar shown) .tl-shop-fab {display:none}` | đạt | đạt | khớp ProductDetail.tsx:537 |
| 5 | `.tl-shop-iconbtn:active` scale 0.96 | đạt | đạt | shop.css:506 |
| 6 | z-index 44 | đạt | đạt | |
| 7 | padding-bottom calc(96px+112px) | đạt | đạt | |
| 8 | Không màu literal mới | chưa (vì `transparent`) | **đạt — bác Codex**: `transparent` có trong prompt, shop.css đã dùng 28 lần, contrast test không quét keyword | |
| 9 | ≥900 static/row, không override | đạt | đạt | |
| 10 | Đúng 5 trang, 4 trang khác không đổi | đạt | đạt | |
| 11 | gate xanh | — | tin coder (227 pass, bundle 225.4/280) | |
| 12 | Không commit/push | — | đạt | |

**Verdict code review: ĐẠT** (chờ tester).

## 3. Phát hiện thêm (không chặn)
1. Padding đáy 208px áp cả khi chưa login (class cứng). Sửa rẻ: `.tl-shop-page:has(.tl-shop-fab)`. Hiện SHOP_PUBLIC_OPEN=false nên tác động ≈0.
2. Dải 768–899px: BottomNav ẩn (md:hidden) nhưng FAB vẫn +72px → lơ lửng 84px. Toast/buybar cùng hành vi, nhất quán, bỏ qua.
3. ChatFAB đã ẩn trên /shop. 4. Toast đè FAB 2–3s đúng spec.

## 4. Test case cho tester (Chrome MCP)

### Chuẩn bị
- Server: `cd /Users/cm10/pickle-hub-pro/.claude/worktrees/shop-fab && npm run dev` background → http://localhost:8080 (hoặc `npm run preview` → 4173, dist/ đã có).
- Cổng chợ đóng (`SHOP_PUBLIC_OPEN=false`): phải login admin thecuong@gmail.com (TOTP). Tester không tự nhập mật khẩu/OTP → nếu tab Chrome đã có session localhost thì dùng; nếu không, ghi "không chạy được" cho TC2–TC8.
- Viewport: `resize_window` KHÔNG đổi viewport. Mỗi case ghi "DOM" (read_page/find) hay "VISUAL"; nếu không hẹp được <900 → "không kết luận được (viewport)", KHÔNG ghi fail.
- Đọc console mỗi case: không error mới liên quan CartLink.

### TC1 — Signed-out: `/shop` → không `.tl-shop-fab`, không link /shop/orders, /shop/cart. (DOM)
### TC2 — Home: `/shop` → đúng 1 `div.tl-shop-fab` trong `.tl-shop-topline`, 2 `<a>`: `/shop/orders` "Đơn của tôi" rồi `/shop/cart` aria "Giỏ hàng…"; `.tl-shop-page` có `tl-shop-has-fab`. (DOM) VISUAL nếu hẹp: góc dưới phải, dọc, trên BottomNav, cuộn không trôi.
### TC3 — Giỏ rỗng vs có hàng: `/shop/cart` ghi số; về `/shop`: có hàng → link giỏ có `is-lit` + `span.tl-shop-cart-count`; rỗng → không. (DOM) VISUAL: quầng xanh khi có hàng.
### TC4 — PDP thêm giỏ: click sản phẩm đầu → "Thêm vào giỏ" → `.tl-shop-toast` "Đã thêm vào giỏ"; badge N+1, `is-lit`, aria cập nhật. (DOM) VISUAL: toast trên FAB.
### TC5 — PDP buybar: đầu trang `.tl-shop-buybar[data-shown="false"]`; cuộn qua nút Thêm vào giỏ → `data-shown="true"`; cuộn về → false; `.tl-shop-fab` vẫn trong DOM cả hai lúc. (DOM) VISUAL: khi true không thấy FAB.
### TC6 — Search/Category/Store: mỗi trang 1 `.tl-shop-fab` + `tl-shop-has-fab`. 404 `/shop/p/khong-ton-tai-xyz`, `/shop/s/khong-ton-tai-xyz` → 0 `.tl-shop-fab`, không `tl-shop-has-fab`. (DOM)
### TC7 — Desktop ≥900 (VISUAL chụp): Đơn + giỏ inline ngang cạnh phải topline; nút Đơn nền xám; giỏ không quầng xanh; cuộn theo trang. DOM có `is-lit` là bình thường.
### TC8 — Click: Đơn → `/shop/orders`; giỏ → `/shop/cart`; hai trang không có `.tl-shop-fab`. (DOM)

Ghi chú: không sửa code, không commit.

## 5. Việc user kiểm tra tay
iPhone thật: vị trí FAB vs BottomNav + safe-area; quầng xanh đủ thấy; `:active`; PDP buybar/FAB không giật; card cuối không bị che.
