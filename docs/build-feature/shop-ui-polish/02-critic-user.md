# Phản biện góc người dùng — vòng UI polish khu Shop

## Đồng ý
- Khảo sát hiện trạng chính xác (đã đối chiếu code). Chia tier đúng hướng; admin cắt được thì cắt. "Polish phình thành redesign" là rủi ro số một — đồng tình mạnh.

## Thiếu sót / phản biện

**1. Tier theo "màn" nhưng chưa theo tần suất hành trình seller.** SellLanding + Application mỗi seller nhìn 1 lần; SellerProducts + form là nơi sống hàng ngày; và màn tạo/mất niềm tin nhất là **trang shop công khai của chính họ** — seller VN sẽ gửi link shop vào Zalo/Facebook để khoe và kéo khách. Trang đó "trông như trang settings" thì seller không chia sẻ → shop chết từ ngày một. **ShopStore phải thuộc Tier 1 về giá trị.**

**2. Màn "chờ duyệt" bị xem nhẹ.** Giai đoạn nộp → duyệt là lúc niềm tin mong manh nhất. Status cần cảm giác "hồ sơ đang được người thật cầm": timeline trạng thái + đường liên hệ trực tiếp (Zalo/nhắn admin). Polish copy + layout, rẻ, trong scope. (Không hứa SLA.)

**3. Empty state chưa được coi là hạng mục.** Pilot = dữ liệu gần rỗng mọi màn — **empty state chính là giao diện** với người dùng đầu tiên. Liệt kê empty state từng màn Tier 1+2 vào định nghĩa "xong". Chợ trống phải nói được điều gì ("3 shop đầu tiên đang lên hàng — quay lại tuần này").

**4. Nghiệm thu trên iPhone thật** (bối cảnh PO chê là iPhone; seller đến từ Zalo/Messenger in-app browser), không phải desktop.

## Trả lời câu hỏi

- **Neo "hiện đại" = Shopee, duy nhất.** Buyer-side neo trang shop + danh sách sản phẩm Shopee (ảnh lớn, giá đậm, badge rõ); seller-side neo **Shopee Seller Center bản mobile web** (ô số liệu to, danh sách có thumbnail + trạng thái màu). KHÔNG neo TikTok Shop. Lý do: 100% seller Wave 1 có mental model Shopee — "hiện đại" = "giống cái tôi đã biết".
- **Thumbnail thật: TRONG vòng, không tách.** 10 ô chữ "1 ẢNH" trông giống LỖI hơn giống thiết kế → seller kết luận "upload hỏng". ROI cao nhất toàn vòng. Nếu phải chọn giữa thumbnail và polish SellLanding → chọn thumbnail.
- **Shop công khai không logo: chấp nhận không upload vòng này, KHÔNG chấp nhận đầu trang chỉ là h1 text.** Giải pháp rẻ: **monogram avatar sinh từ tên shop** (chữ đầu + màu hash từ tên, thuần CSS/SVG) + banner mảnh token màu. Người mua nhìn trang không ảnh sẽ đánh giá "shop ảo".
- **SellerHome counts: đồng ý.** 3-4 ô số (đang bán / chờ duyệt / nháp). Kèm: **nút "Xem shop của tôi" nổi bật**, không chôn trong văn xuôi.
- Chốt mặc định: neo Shopee; admin cắt nếu chạm trần; counts yes. Chỉ signed-URL draft cần feasibility gật (→ đã gật ở critic kia).

## Rủi ro sản phẩm ghi thêm
- SellerProductForm: giá trị/giờ công thấp nhất Tier 1, rủi ro cao nhất → chỉ spacing/phân cấp tiêu đề, không đụng variant/media editor markup.
- **Đừng đổi copy đã acceptance để "cho đẹp"** — copy trung thực hiện tại là tài sản niềm tin; polish thị giác quanh nó, giữ nguyên lời.

## Thứ tự giá trị (thay tier thuần code)
1. Thumbnail thật SellerProducts
2. ShopStore: monogram + đầu trang có mặt mũi
3. SellerHome: ô số liệu + nút "Xem shop của tôi"
4. SellLanding + Application/Status (kèm đường liên hệ khi chờ)
5. ShopHome/PDP polish nhẹ + empty state toàn khu
6. Admin — chỉ khi còn thời gian
