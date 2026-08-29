# Vòng 3 — PO bác kết quả vòng 1-2: "vẫn quá xấu", đổi neo thiết kế

**Ngày 17/08/2026.** PO xem preview `feat-shop-ui-polish.pickle-hub-pro.pages.dev` trên iPhone (light mode, shop thật "ThePickleHub", 1 sản phẩm) và bác: *"giao diện vẫn quá xấu. Anh muốn nó phải thật đẹp như hình đính kèm."*

## Neo thiết kế MỚI (thay neo Shopee cũ)

`reference/target-look.jpeg` — mockup app thương mại di động hiện đại (kiểu food-delivery). **ux-designer PHẢI mở ảnh này bằng tool Read** để thấy trực tiếp. Đặc điểm chính:
- **Card-first**: sản phẩm là card trắng bo góc RẤT lớn (~20px), đổ bóng cực nhẹ, ảnh sản phẩm TO ở giữa card trên nền trắng sạch, nhiều khoảng thở.
- Grid 2 cột, gap rộng. Tên sản phẩm đậm vừa, **giá to đậm** bên trái, nút hành động **tròn đen** nhỏ bên phải cùng hàng, icon tim (favorite) mờ.
- **Chip filter**: pill bo tròn hẳn; chip đang chọn nền ĐEN chữ trắng kèm dấu ×; chip thường nền xám rất nhạt chữ xám.
- Heading section ngắn gọn đậm ("Discover food", "We Recommend") — không đoạn giải thích dài.
- Bottom nav dạng **pill nổi** bo tròn, item active là viên trắng nổi trên nền đen (tham khảo tinh thần, KHÔNG bắt buộc đổi bottom nav toàn app).
- Tổng thể: sáng, sạch, tròn trịa, ảnh làm chủ, chữ tối giản.

## Hiện trạng bị chê (2 screenshot `reference/current-shopstore-light-*.jpeg` — cũng nên mở xem)

Trang `/shop/store/thepicklehub` light mode:
1. Đọc như một **văn bản** chứ không phải cửa hàng: các section "Xác minh" / "Liên hệ" / "Sản phẩm của shop" là những đoạn text dài nối nhau, hộp xám vuông vức.
2. Text meta dài dòng chiếm chỗ đắc địa: "Shop chưa cung cấp kênh liên hệ nào đã được duyệt. Khi có, nút liên hệ sẽ hiện ở đây." · "1 sản phẩm — sàn đang ở giai đoạn thử nghiệm, đây là toàn bộ những gì đang bán." — người mua không cần đọc những câu này to như vậy.
3. Ảnh sản phẩm render **full-bleed trần** không nằm trong card, lệch trái, không giá/tên nhìn thấy cùng khung.
4. Monogram + banner vòng 2 quá rụt rè — banner gần như không thấy, monogram nhỏ nhạt.
5. Khoảng cách/bo góc nhỏ kiểu editorial — không khớp cảm giác "app" của reference.

## Định hướng scope vòng 3 (ux-designer chốt chi tiết)

**Ưu tiên bề mặt NGƯỜI MUA** (nơi PO đang nhìn): ProductCard + grid catalog (dùng chung /shop, search, category, store) → ShopStore header + bố cục section → PDP liếc qua → ShopHome. Seller surfaces giữ kết quả vòng 1-2 (đã cải thiện, không phải trọng tâm chê lần này) — chỉ đổi nếu rẻ.

Cho phép vòng này (PO đã ra lệnh "phải thật đẹp" — các ràng buộc thẩm mỹ cũ được nới):
- Shop khu vực được có **sub-theme card-first riêng** trong shop.css (bo góc lớn hơn, shadow nhẹ, nền sáng sạch) — vẫn qua token The Line (được THÊM alias token shop-specific nếu cần, ví dụ `--shop-radius-card: 20px`), vẫn giữ AA + contrast test xanh.
- **Được thu gọn/di chuyển text meta dài dòng** (câu "Shop chưa cung cấp kênh liên hệ…", "1 sản phẩm — sàn đang…") xuống vị trí khiêm tốn hoặc rút ngắn — MIỄN LÀ không tạo claim sai (nguyên tắc copy trung thực giữ nguyên; câu về xác minh giữ nội dung, được phép trình bày gọn thành badge + 1 dòng).
- Light mode là mặt tiền chính của khu shop (reference sáng) — dark vẫn phải dùng được, không vỡ.

## Ràng buộc KHÔNG đổi

- Không thư viện UI/JS mới; bundle headroom 9.9 KB (CSS tự do — gate chỉ đo JS).
- Không đổi luồng nghiệp vụ, không đổi RPC/query (trừ đã có từ vòng 1).
- Không đụng cấu trúc SellerProductForm. Không đụng bottom nav toàn app.
- Coverage ≥83, lint/tsc, contrast test xanh. Touch 44px. Không claim sai về xác minh.
- KHÔNG nút giỏ hàng/mua — chưa có cart (nút tròn trong reference nếu dùng thì phải là hành động có thật, ví dụ "xem chi tiết"; hoặc bỏ).

## Quy trình vòng 3

ux-designer đọc 3 ảnh reference + code hiện tại → spec mới (04-ux-spec-round3.md) → prompt-engineer → coder → Codex review → push → PO xem lại preview (tester browser cho regression console/DOM; thẩm mỹ do PO chấm trên preview).
