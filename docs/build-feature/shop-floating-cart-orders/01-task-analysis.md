# Phân tích công việc — Nút Giỏ hàng + Đơn của tôi thành FAB nổi trên Shop

## 0. Cảnh báo về nhánh trước khi đọc tiếp

Working tree hiện tại (`/Users/cm10/pickle-hub-pro`, nhánh `feat/shop-production-phase-1`) **chỉ chứa Shop Phase 1**: `src/pages/shop/` có 5 file (SellLanding, SellerApplication, SellerApplicationStatus, SellerHome, BulkImport) — **không có** ShopHome, Cart, Orders, ProductDetail. Toàn bộ bề mặt người mua ở đây chỉ tồn tại trong prototype `src/proto/shop/` (bật bằng `VITE_PROTO_SHOP=1`, không lên prod). Code người mua đã ship (Phase 3/4, PR #691 merge 28/08) nằm trên `main` và các worktree mới hơn, ví dụ `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-pilot-refund/`. Khảo sát dưới đây dùng worktree đó làm hiện trạng thật; nhánh `feat/shop-production-phase-1` gần như chắc chắn **không phải** chỗ để làm việc này (xem câu hỏi mở Q1).

## 1. Tóm tắt ý tưởng

Trên khu Shop dành cho người mua, hai lối vào "Giỏ hàng" và "Đơn hàng của tôi" hiện nằm rải rác và mờ nhạt; ý tưởng là gom chúng thành cụm nút nổi (FAB) cố định trên nền trang, luôn trong tầm ngón cái, trong đó nút giỏ hàng có hiệu ứng "2 light" (hai điểm sáng / glow) để nổi bật hơn nút đơn hàng. Bản native iOS đã có đúng cụm này (`ShopFloatingActions`), nên về bản chất đây là đưa web về cùng mô hình với native.

## 2. Mục tiêu / bài toán cần giải

Hiện trạng web (worktree shop-pilot-refund):

- **Giỏ hàng**: `ShopCartLink` (`src/components/shop/CartLink.tsx`) là icon 44px nằm **trong dòng nội dung** `.tl-shop-topline` ở đầu mỗi trang mua (ShopHome, Search, Category, Store, PDP, Cart, Checkout, Orders, OrderDetail — 9 trang). Vì nó cuộn theo trang, ngay khi người mua kéo xuống xem sản phẩm thì mất dấu giỏ. Ẩn hoàn toàn khi chưa đăng nhập. Badge = tổng qty từ `useCartCount()` (`src/hooks/shop/useCart.ts`, RPC `shop_cart_view`, một cache entry cho cả badge lẫn trang giỏ; `null` = không hiện số khi loading/lỗi/chưa login).
- **Đơn của tôi** (`/shop/orders`): **không có lối vào nào trên trang mua**. Chỉ có breadcrumb trong `OrderDetail.tsx` và nút "Về đơn của tôi" sau khi đặt. Người mua muốn xem lại đơn phải nhớ URL hoặc đi từ email/order success. Đây là lỗ discoverability thật, không chỉ là chuyện thẩm mỹ.
- Native iOS (`apple/ThePickleHub/Features/Shop/ShopCartBadge.swift`) đã giải quyết: pill nổi góc dưới phải trên ShopHome gồm nút Đơn mua (tròn, mờ) + nút Giỏ (capsule màu accent, có label "Giỏ" + số) trên nền `.regularMaterial`. PDP dùng toolbar button riêng.

Vậy bài toán là: (a) giỏ hàng luôn nhìn thấy khi cuộn, (b) tạo lối vào thường trực cho đơn của tôi, (c) đồng nhất mô hình web/native.

## 3. Phạm vi

**Trong phạm vi**

- Một cụm FAB cố định (fixed) cho khu người mua Shop web, gồm nút Giỏ hàng (chính, có badge số, có hiệu ứng "2 light") và nút Đơn của tôi (phụ).
- Quyết định nút này hiện trên trang nào trong 9 trang mua, và trang nào phải ẩn/thu gọn (Cart, Checkout chắc chắn không cần nút giỏ).
- Thay thế hoặc thu gọn `ShopCartLink` trong `.tl-shop-topline` để không có hai badge giỏ hàng cùng lúc.
- Chỉ CSS/markup + một component mới; **không** đổi hook, RPC, state giỏ.

**Ngoài phạm vi**

- Native iOS (đã có; chỉ ghi nhận để đối chiếu ngôn ngữ hình ảnh, không sửa).
- Seller Center (`/seller/*`) và Admin Shop: có bottom nav riêng, không phải người mua.
- Thêm ô thứ 6 vào BottomNav (quy tắc R6 cấm, ghi rõ trong `ShopShell.tsx` và `CartLink.tsx`).
- Đổi số đếm badge (qty vs lines), đổi hành vi toast "Đã thêm vào giỏ", đổi buybar PDP.
- Nút giỏ cho người chưa đăng nhập (hiện ẩn có chủ ý — xem Q3).

## 4. Các phần việc chính

1. **Chốt vị trí và danh sách trang.** FAB hiện ở ShopHome / Search / Category / Store / PDP; ẩn ở Cart, Checkout; ở Orders/OrderDetail thì chỉ còn nút giỏ. Quyết định cách "mount": mỗi trang tự đặt (như đang làm với `ShopCartLink`) hay gắn theo prefix đường dẫn trong layout. ShopHome dùng `TheLineLayout`, không dùng `ShopScrollShell`, nên không có một shell chung sẵn để móc vào — cần chọn.
2. **Xử lý xung đột với 4 phần tử fixed đã có ở đáy màn hình:** BottomNav (72px + safe-area, biến `--shop-bottomnav`), `.tl-shop-buybar` PDP (z-index 60, chỉ mobile, chỉ hiện khi nút "Thêm vào giỏ" đã cuộn khỏi màn), `.tl-shop-toast` (z-index 45, góc dưới phải trên desktop ≥768px — trùng đúng chỗ FAB), `.tl-shop-stickybar` (z-index 35). ChatFAB (Messenger/Zalo) đã bị ẩn trên `/shop` từ trước nên không đụng. Cần bảng z-index và offset đáy tính từ `--shop-bottomnav` + `--shop-safe-b`, không viết số cứng (bài học R5 #5 đã ghi trong shop.css).
3. **Hiệu ứng "2 light".** Diễn giải và chốt nghĩa với PO (Q2), sau đó thể hiện bằng token The Line (`--tl-green`, `--tl-accent-*`, `--tl-bg-elev`); phải tắt được theo `prefers-reduced-motion` — lưu ý khối reduced-motion trong shop.css **scope theo `.tl-shop`**, còn phần tử fixed nằm ngoài thì phải tự khai (toast đã phải làm thế).
4. **Gỡ/thu gọn `ShopCartLink` trong topline** để tránh hai badge. Bốn file test đang mock `ShopCartLink` (`Cart.states`, `Orders.states`, `Checkout.states`, `Checkout.conflict`) — đổi tên/xoá component sẽ làm chúng đỏ; giữ export hoặc cập nhật mock.
5. **A11y + song ngữ.** Giữ pattern aria có sẵn: `Giỏ hàng, {n} món`, số ẩn `aria-hidden`, tối thiểu 44px, không mất focus ring. Khu người mua hiện là VI-only (copy hard-code), nên "song ngữ" ở đây thực tế = giữ nhất quán VI với `Đơn của tôi` (tên đang dùng trên trang Orders, không phải "Đơn hàng của tôi").
6. **Kiểm chứng.** Contrast test (`src/styles/__tests__/contrast.test.ts` cấm raw hex ngoài block token), visual baseline khu shop sẽ đỏ vì đổi pixel (cập nhật một lần cuối vòng), bundle gate (`check-bundle-size.mjs`, headroom nhỏ), test tay iPhone Safari để xem FAB có đè buybar/toast không.

## 5. Rủi ro / điểm cần cẩn thận

- **Che nội dung trên mobile.** Card sản phẩm đã phải đảm bảo lộ trên fold 320px (acceptance B01); FAB góc dưới phải sẽ đè lên nút/giá của card cuối. ChatFAB trước đây bị audit đúng lỗi này (08/07) và phải thêm hành vi ẩn khi cuộn xuống — có thể tái dùng logic đó, nhưng ẩn khi cuộn lại mâu thuẫn với mục tiêu "luôn thấy giỏ". Cần chọn một.
- **Chồng lớp fixed ở PDP.** Buybar PDP xuất hiện động khi cuộn; FAB + buybar + toast cùng lúc ở đáy phải là ba thứ trong khoảng ~130px. Đây là màn hình dễ hỏng nhất.
- **Hai badge giỏ hàng trên một màn** (topline cũ + FAB mới) làm số đếm "nhảy" khác nhau nếu render lệch tick; đã có nguyên tắc một cache entry, nhưng phải gỡ hẳn cái cũ, không chỉ giấu.
- **Glow ≠ contrast.** Hiệu ứng sáng trên nền dark/light mode (Shop hỗ trợ `data-mode="light"`) dễ tụt AA cho số badge; token đã retune (`aed296ab`), không được hạ.
- **Người chưa đăng nhập.** Nếu FAB hiện cho khách và dẫn tới `/login`, đi ngược quyết định đã ghi trong `CartLink.tsx` ("một badge trên trang họ không dùng được là lời hứa suông"). Nếu ẩn thì khách không thấy có giỏ — chấp nhận hay không là quyết định sản phẩm.
- **Nhánh sai.** Làm trên `feat/shop-production-phase-1` sẽ không có file nào để sửa; merge ngược lên main gần như chắc conflict với shop.css ~1900 dòng.
- **Tests/snapshot**: route-snapshot không đổi (không thêm route), nhưng 4 test mock `ShopCartLink` và visual baseline sẽ đụng.

## 6. Câu hỏi còn mở

1. **Nhánh làm việc thực sự là gì?** `feat/shop-production-phase-1` không có code người mua. Làm trên `main` mới, hay trên `feat/shop-unified` (memory 28/08 ghi đang vá build)?
2. **"2 light" nghĩa là gì?** Hai chấm sáng trang trí trên nút, hai lớp glow (viền + đổ bóng), hay pulse nhấp nháy hai nhịp khi có hàng mới thêm? Có cần chạy liên tục hay chỉ khi badge > 0?
3. **Khách chưa đăng nhập** có thấy FAB không? Nếu có, bấm vào dẫn đi đâu?
4. **Hành vi khi cuộn**: luôn hiện (đúng mục tiêu) hay ẩn khi cuộn xuống như ChatFAB (đúng bài học che nội dung)?
5. **Trên PDP**, FAB có nhường chỗ cho buybar không (ẩn khi buybar hiện), hay xếp chồng lên trên?
6. **Desktop** (≥900px, buybar tắt): giữ FAB hay quay về badge trong topline? Native chỉ đặt cụm nổi ở ShopHome, PDP dùng toolbar — web có theo đúng mô hình đó không?
7. Tên nút đơn: "Đơn của tôi" (đang dùng) hay "Đơn hàng của tôi" (idea)?

## Tệp liên quan

- Hiện trạng web (worktree main-tương-đương): `.claude/worktrees/shop-pilot-refund/src/components/shop/CartLink.tsx`, `src/hooks/shop/useCart.ts`, `src/pages/shop/ShopHome.tsx`, `src/styles/shop.css` (khối `.tl-shop` biến đáy dòng 459, `.tl-shop-stickybar` 591, `.tl-shop-buybar` 1570, `.tl-shop-toast` 1880, `.tl-shop-topline` 1917), `src/components/layout/BottomNav.tsx`, `src/components/layout/ChatFAB.tsx`
- Nhánh hiện tại (Phase 1, không có buyer): `src/components/shop/ShopShell.tsx`, `src/proto/shop/components/Shells.tsx`
- Native tham chiếu: `apple/ThePickleHub/Features/Shop/ShopCartBadge.swift` (`ShopFloatingActions`), `apple/ThePickleHub/Features/Shop/ShopHomeView.swift:58-62`
