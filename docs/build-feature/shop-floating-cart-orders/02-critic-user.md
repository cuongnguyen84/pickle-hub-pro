## Phản biện — FAB Giỏ hàng + Đơn của tôi (góc nhìn người mua VN trên điện thoại)

### Trước hết: bản phân tích đang mô tả sai hiện trạng ở hai chỗ quan trọng

Soi trực tiếp worktree `shop-fab` (= `origin/main`), không phải `shop-pilot-refund` mà bản phân tích dùng:

1. **"Đơn của tôi không có lối vào nào trên trang mua" — không còn đúng.** `src/components/shop/CartLink.tsx` dòng 39-42 đã render nút `Đơn của tôi` (ClipboardList) cạnh icon giỏ, và `ShopCartLink` đang được đặt trong topline của cả 9 trang mua. Cái còn lại chỉ là: **cả hai nút cuộn mất theo trang**.
2. **"Native đã có `ShopFloatingActions` pill nổi góc dưới phải" — không tồn tại trên main.** Native đang dùng `ShopCartToolbarButton` gắn `topBarTrailing` trên ShopHome và PDP (`ShopHomeView.swift:91`, `ShopProductDetailView.swift:61`) — nút ở thanh trên, luôn thấy vì nav bar dính, không phải FAB. Lập luận "đưa web về cùng mô hình native" đang kéo web đi *ngược* native.

Bài toán thu hẹp từ ba xuống một: **giỏ (và đơn) phải còn nhìn thấy khi người mua đã cuộn xuống.**

### 1. Có đúng vấn đề không, có cách đơn giản hơn không

Vấn đề thật là có. Nhưng FAB không phải cách rẻ nhất. Cách rẻ nhất, cũng là mô hình native: **làm dòng `.tl-shop-topline` dính (sticky top)** giống `.tl-shop-header` đã có (`shop.css:464`, sticky, z-index 40, nền đục, đã qua audit contrast). Ưu điểm:
- Không che nội dung ở đáy, nơi đã có 4 lớp fixed chen nhau.
- Người dùng quen "giỏ ở góc trên phải" (Shopee, Lazada, Tiki). Góc dưới phải ở VN là vị trí nút chat/Zalo — sẽ tưởng là chat.
- Web và native đồng nhất thật sự.

Đề nghị: **thu hẹp scope thành "topline dính + nhấn mạnh nút giỏ"**. Chỉ làm FAB nếu Cuong nhìn bản sticky rồi vẫn muốn FAB.

### 2. Thiếu gì ảnh hưởng trải nghiệm
- **Giỏ rỗng vs có hàng.** Hiệu ứng phải gắn với `count > 0`.
- **Toast "Đã thêm vào giỏ" và nút giỏ nổi cùng lúc nói một chuyện.** Giữ toast và không animate FAB, hoặc ngược lại. Không cả hai.
- **PDP mobile khi buybar hiện**: buybar 68px + BottomNav 72px + FAB ≈ 200px đáy bị chiếm trên màn 640px.
- **Light mode**: glow xanh trên nền trắng gần vô hình; glow đủ đậm thì phá contrast badge.

### 3. Rủi ro sản phẩm
- Nhầm với nút chat; góc dưới phải bị chiếm nếu sau này bật chat hỗ trợ chợ.
- Phá quy tắc trong `CartLink.tsx` ("nút nằm trong topline và không ở đâu khác"). FAB là fixed ngoài `.tl-shop` nên reduced-motion/contrast/offset phải khai lại — đúng bẫy toast đã dính.
- Nhấp nháy liên tục làm chợ nhìn "rẻ" — người mua Việt phân biệt shop uy tín/spam qua đúng chi tiết này.

### 4. Trả lời dứt khoát 7 câu hỏi mở
- **Q1 Nhánh:** worktree `shop-fab` từ `origin/main`. Phân tích cần dựa vào worktree này.
- **Q2 "2 light":** hai tín hiệu: (a) **badge số** nền accent khi `count > 0` — đã có; (b) **một nhịp sáng ngắn (≤600ms, một lần)** lên nút giỏ khi thêm hàng thành công. Không glow liên tục, không pulse lặp, tắt với `prefers-reduced-motion`. Giỏ rỗng: nút thường. Nếu Cuong muốn "hai chấm sáng trang trí" thì cần anh xác nhận.
- **Q3 Khách chưa đăng nhập:** **ẩn**, giữ quyết định trong `CartLink.tsx`.
- **Q4 Cuộn:** luôn hiện. Nếu FAB: luôn hiện, bù padding đáy.
- **Q5 PDP + buybar:** FAB **ẩn khi buybar hiện** (`.tl-shop-buybar[data-shown="true"]`).
- **Q6 Desktop ≥900px:** **không FAB**, giữ topline.
- **Q7 Tên:** **"Đơn của tôi"**.

### Đề xuất cuối
Scope tối thiểu đáng ship: `.tl-shop-topline` sticky top trên mobile (tái dùng rule `.tl-shop-header`), nút giỏ nhận một nhịp sáng khi `count` tăng, toast giữ nguyên. Không component mới, không đụng z-index đáy, không đổi test mock. Nếu Cuong vẫn muốn FAB, lúc đó mới trả giá cho §5.

Căn cứ: worktree `shop-fab`: `src/components/shop/CartLink.tsx`, `src/styles/shop.css` (459-481, 1570-1594, 1880-1912), `apple/.../ShopCartBadge.swift`, `ShopHomeView.swift:91`.
