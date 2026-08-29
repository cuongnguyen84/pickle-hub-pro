# Phản biện khả thi — Shop floating cart/orders FAB

## 1. Sai lệch hiện trạng — bản phân tích khảo sát nhầm nhánh
`origin/main` (= worktree `shop-fab`): `src/components/shop/CartLink.tsx:33-53` đã render **cả hai** link `Đơn của tôi` (btn sm) + icon giỏ có badge; `CartLink.test.tsx:26-34` khoá hành vi đó. Bài toán còn lại: **badge cuộn mất khi kéo trang**. §4.4/§5 "hai badge cùng màn" là rủi ro tự tạo: FAB thay `ShopCartLink` trong topline → không có hai badge.

## 2. Khả thi — đơn giản hơn nhiều
Không đụng hook/RPC/state. Toàn bộ việc: đổi wrapper `ShopCartLink` từ inline sang `position: fixed` + một class CSS. Tái dùng component có sẵn, không component mới.

Mount: **giữ per-page, giữ trong `.tl-shop`**, vì:
- `TheLineLayout` chia sẻ /live,/feed,/blog — cấm đặt (`CartLink.tsx:9-12`).
- Biến `--shop-bottomnav`/`--shop-safe-b` khai trên `.tl-shop` (`shop.css:459-462`); fixed ngoài `.tl-shop` không đọc được (lý do `.tl-offline-banner` phải viết cứng 72px `shop.css:2064-2068`). Mount prefix ở App.tsx = tái tạo bug R5 #5.
- Mount prefix kéo `useCartCount` vào chunk INITIAL; bundle gate headroom nhỏ.

## 3. PDP — rủi ro nhất, cách cắt
Đáy PDP mobile: BottomNav (72+safe, z 9999) → buybar (bottom 72+safe, cao ~68, z 60) → toast (z 45) → stickybar (z 35, Cart/Checkout). FAB góc dưới phải sẽ đè nút "Thêm vào giỏ" của buybar.
Cắt: **FAB ẩn khi buybar shown**, một dòng CSS:
```css
body:has(.tl-shop-buybar[data-shown="true"]) .tl-shop-fab { display: none; }
```
(pattern `body:has` đã có `shop.css:2064`). Toast desktop (≥768, right:16px, `shop.css:1904-1906`) trùng chỗ FAB: đẩy toast lên hoặc đặt FAB bên trái trên desktop. z-index FAB = 50 (trên toast 45, dưới buybar 60, dưới sheet 70).
Cart/Checkout/Orders/OrderDetail: **để nguyên `ShopCartLink` inline**; chỉ 5 trang catalogue (Home/Search/Category/Store/PDP) đổi sang fixed → 4 test mock không đổi.

## 4. Bỏ sót
- **Bottom clearance**: `.tl-shop-page` chừa 96px (`shop.css:186`); FAB ~48-56px + 12px gap che góc phải card cuối grid 2 cột → cộng padding-bottom cho 5 trang catalogue (cơ chế như `.tl-shop-has-buybar` `shop.css:1600-1603`).
- **Ẩn-khi-cuộn**: bỏ (scroll ở `.tl-scroll`, không phải window — `TheLineLayout.tsx:426`).
- **Khách chưa login**: không đổi (render null).
- **Bàn phím ảo**: BottomNav ẩn khi keyboard mở (`BottomNav.tsx:104`), FAB lơ lửng 72px — chấp nhận.
- **Visual baseline** `shop-home` chụp anonymous → FAB KHÔNG xuất hiện trong snapshot; không gate tự động nào nhìn thấy FAB → cần test jsdom (mở rộng `CartLink.test.tsx`) + test tay iPhone.
- **Contrast gate**: dùng `var(--tl-green)` + `color-mix(in srgb, var(--tl-green) 40%, transparent)` (pattern `shop.css:1308`) → chắc chắn qua.
- **Reduced-motion**: FAB nằm trong `.tl-shop` thì tự được phủ.

## 5. "2 light"
Hai lớp `box-shadow`: ring `0 0 0 3px color-mix(green 18%)` (như ChatFAB hover `ChatFAB.tsx:183-186`) + bóng khuếch tán `0 0 18px color-mix(green 35%)`; tĩnh, không pulse, chỉ khi `count > 0`.

## 6. Scope gọn — một PR
1. `CartLink.tsx`: prop `floating?: boolean` (hoặc export `ShopCartFab`). Giữ `ShopCartLink` inline cho Cart/Checkout/Orders/OrderDetail.
2. `shop.css`: `.tl-shop-fab` fixed, right 12px, `bottom: calc(var(--shop-bottomnav) + var(--shop-safe-b) + 12px)`, z 50; glow 2 lớp; `body:has(buybar shown)` ẩn; padding-bottom cho 5 trang; desktop FAB trái hoặc đẩy toast.
3. 5 trang catalogue đổi sang floating; bỏ `.tl-shop-topline` rỗng ở ShopHome/Search.
4. Test: mở rộng `CartLink.test.tsx`; contrast + bundle gate; test tay iPhone 3 màn.

Cắt: component mới riêng, bảng z-index, ẩn-khi-cuộn, mount prefix, sửa 4 test mock, đổi tên (giữ "Đơn của tôi").
Câu hỏi mở thực sự còn một: PO chấp nhận FAB biến mất trên PDP mobile khi buybar hiện không.

Tệp: worktree `shop-fab`: `CartLink.tsx`, `shop.css` (183-187, 459-462, 491-521, 1570-1603, 1880-1923, 2064-2073), `ChatFAB.tsx`, `ShopGate.tsx`, `App.tsx:594-604`, `tests/visual.spec.ts:53`.
