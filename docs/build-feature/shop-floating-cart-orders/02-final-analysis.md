# Bản phân tích đã chốt — FAB Giỏ hàng + Đơn của tôi (Shop web)

Nơi làm: worktree `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-fab` (nhánh `feat/shop-floating-cart` từ `origin/main`). Bản phân tích 01 khảo sát nhầm worktree cũ — hiện trạng đúng theo 2 critic:

## Hiện trạng thật (origin/main)
- `src/components/shop/CartLink.tsx` đã render **cả** nút "Đơn của tôi" + icon giỏ có badge (`useCartCount`), đặt inline trong `.tl-shop-topline` ở 9 trang mua; ẩn khi chưa login (giữ nguyên).
- Native dùng toolbar button trên nav bar (không FAB). Không có `ShopFloatingActions`.
- Vấn đề duy nhất còn lại: **cả hai nút cuộn mất theo trang**.

## Quyết định orchestrator về mâu thuẫn
critic-user đề nghị bỏ FAB, làm topline sticky. critic-feasibility nói FAB rẻ và khả thi. Ý tưởng gốc của Cuong nói rõ "thành nút float" → **giữ FAB**; sticky topline ghi lại làm fallback nếu Cuong xem bản thật rồi đổi ý. Lấy các điểm cắt scope của cả hai bên.

## Scope chốt
1. `CartLink.tsx`: thêm prop `floating?: boolean` — cùng markup, thêm class `.tl-shop-fab`. Không component mới, không đụng hook/RPC. `ShopCartLink` inline giữ nguyên ở Cart/Checkout/Orders/OrderDetail → 4 test mock không đổi.
2. 5 trang catalogue (ShopHome, ShopSearch, ShopCategory, ShopStore, ProductDetail) dùng bản floating; bỏ `.tl-shop-topline` rỗng nếu chỉ còn nó (Home/Search); Category/Store/PDP còn crumbs thì giữ topline.
3. `shop.css` (trong block `.tl-shop` để nhận biến + reduced-motion):
   - `.tl-shop-fab`: `position: fixed; right: 12px; bottom: calc(var(--shop-bottomnav) + var(--shop-safe-b) + 12px); z-index: 50;` nền `--tl-bg-elev`, viền token, nút ≥44px.
   - **"2 light"** = hai lớp `box-shadow` trên nút giỏ **chỉ khi count > 0**: ring `0 0 0 3px color-mix(in srgb, var(--tl-green) 18%, transparent)` + glow `0 0 18px color-mix(in srgb, var(--tl-green) 35%, transparent)`. Tĩnh. Thêm một nhịp sáng ngắn (≤600ms, 1 lần) khi count tăng là tùy chọn — chỉ làm nếu rẻ (CSS animation trên class đổi theo count), tắt với reduced-motion. Không pulse lặp.
   - `body:has(.tl-shop-buybar[data-shown="true"]) .tl-shop-fab { display: none; }` — PDP mobile nhường buybar.
   - Padding-bottom bổ sung cho 5 trang catalogue để card cuối không bị che (cơ chế như `.tl-shop-has-buybar`).
   - Desktop ≥900px: **không FAB** — quay về inline topline (critic-user Q6) → tránh xung đột toast desktop. Tức `.tl-shop-fab` chỉ fixed dưới 900px; trên đó hiển thị như inline trong topline (nghĩa là các trang Home/Search vẫn giữ topline, chỉ ẩn topline trên mobile nếu rỗng). Cách rẻ: giữ topline ở mọi trang, `floating` chỉ đổi CSS theo media query.
4. Copy: "Đơn của tôi" (giữ). Aria giữ `Giỏ hàng, {n} món`.
5. Test: mở rộng `CartLink.test.tsx` (class floating + aria); `npm run test` file liên quan; contrast test; `check-bundle-size.mjs`; lint; tsc. Test tay: iPhone viewport Home có hàng / PDP cuộn tới buybar / PDP thêm giỏ thấy toast; light mode.

## Không làm
Component mới, mount theo prefix/App.tsx, ẩn-khi-cuộn, bảng z-index, đổi tên "Đơn hàng của tôi", FAB cho khách chưa login, sửa native, pulse liên tục.

## Chấp nhận (ghi rõ)
- FAB biến mất trên PDP mobile khi buybar hiện.
- Khi bàn phím ảo mở, FAB lơ lửng cao 72px (như buybar/toast).
- Visual baseline anonymous không thấy FAB → gate = jsdom test + test tay.
