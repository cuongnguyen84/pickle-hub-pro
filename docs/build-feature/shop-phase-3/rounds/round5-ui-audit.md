# AUDIT UI TOÀN BỘ MÀN HÌNH SHOP (ui-ux-critic, 18/08)

> PO phản hồi trên iPhone: *"quá xấu. Cũng chưa thấy nút thêm vào giỏ đâu cả"* → *"kiểm tra lại tất cả các màn hình đã phát triển, cần 1 UI xuyên suốt. Đẹp, dễ dàng thao tác. UX hiện đại"*

## Chẩn đoán

12 màn Shop viết cẩn thận ở tầng logic (state rỗng/lỗi tách bạch, undo, idempotency, tabular-nums) nhưng **tầng trình bày không có ai làm chủ**: 5/9 màn người mua không có gutter ngang nào, 4 kiểu loading, 3 kiểu error, tab lọc đơn không có trạng thái được chọn.

Đó chính xác là cảm giác "quá xấu" — không phải thiếu ý tưởng thẩm mỹ, mà là **các màn không dùng chung một hộp khung**.

⚠️ Panel thiếu một model: `scripts/agents/ask-model.mjs` không tồn tại trong repo. Báo cáo này **một chiều**, chưa có đối chứng GPT-5.6.

## Bảng phải sửa

| # | file:dòng | Vấn đề | Sửa | Mức |
|---|---|---|---|---|
| 1 | `ShopHome:35` `ShopSearch:94` `ShopCategory:85` `ShopStore:86` `ProductDetail:215` | 5 màn render thẳng trong `<main className="tl-shop">`, không có `.tl-shop-page` — mà `shop.css:145-149` là **nguồn duy nhất** của `padding: 20px 16px 96px` + `max-width`. Chữ và card dính sát mép, không chừa chỗ BottomNav | Bọc nội dung 5 màn trong `<div className="tl-shop-page">` như Cart/Checkout/Orders/OrderDetail | **Chặn** |
| 2 | `Orders:225-227` `SellerOrders:148-150` | Tab dùng `.tl-shop-cat` + `aria-selected`, nhưng CSS chỉ style `[aria-current="page"]`. **Tab đang chọn không có dấu hiệu nào** — 4 viên xám giống hệt | Đổi sang `aria-current={tab===t.key ? "page" : undefined}` như `CatalogResults:183` | **Chặn** |
| 3 | `ProductDetail:258-264` + `variantSelection.ts:138-146` | Ảnh suy ra **hoàn toàn** từ variant. Sản phẩm nhiều ảnh không có option → **bấm thumbnail 2..5 không làm gì** | Thêm state `pickedMediaId`; `shown = pickedMediaId ?? activeMediaId(...)`, reset khi selection đổi | **Chặn** |
| 4 | `SellerHome:208-211` `SellerProducts:140-142` | Copy nói sai sự thật: "Quản lý đơn hàng chưa thuộc giai đoạn thử nghiệm kín", "trang mua hàng chưa mở" — cả hai đã mở từ Phase 3 | Xoá. Thay bằng số đơn cần xử lý (#16) | **Chặn** |
| 5 | `shop.css:418` (`--shop-bottomnav: 56px`) vs `shop.css:1508` (`72px`) | Hai hằng số bottom-nav khác nhau cùng file; thật ra là 56/68/72 tuỳ nền tảng. Toast tính theo 56 → **trên iOS toast nằm dưới thanh nav** | `--shop-bottomnav: 72px` (ca cao nhất), buybar + toast cùng dùng biến | Cao |
| 6 | `ProductDetail:153` `ShopStore:56` vs `CatalogResults:229` vs `Cart:210`/`Checkout:301`/`Orders:155`/`OrderDetail:169` | **4 kiểu loading**: spinner trần, skeleton đúng hình, khối xám tuỳ tiện 88/68/100/92px kèm "Đang tải…" | Bỏ `LoadingState` khỏi Shop. Skeleton **đúng hình nội dung**. Bỏ câu "Đang tải…", giữ `aria-busy` | Cao |
| 7 | `PageStates:49-71` dùng ở 6 màn seller | `ErrorState` là component **hệ khác** (`.tl-empty` + shadcn Button), copy i18n chung chung | Thay bằng `tl-shop-notice--danger` như `Cart:219-233` | Cao |
| 8 | `CatalogResults:239-252` | Lỗi tải dùng khung `tl-shop-empty` (viền đứt) — trông y hệt trạng thái rỗng | Đổi sang `tl-shop-notice--danger`. **Viền đứt = rỗng, thanh đỏ = lỗi** | Cao |
| 9 | `Checkout:563-574` | Nút "Đặt đơn" cuối ~3,5 màn cuộn ở 375px, không thanh dính. **Cùng lớp lỗi PO vừa gặp ở PDP** | Thêm thanh dính đáy, dùng lại IntersectionObserver ở `ProductDetail:119-127` | Cao |
| 10 | `Cart:387-424` | "Đặt hàng shop này" ở chân từng nhóm. Giỏ 2 shop × 3 dòng ở 375px = nút đầu đã dưới fold | Thu gọn dòng giỏ (#17) + thanh dính cho **shop đầu tiên hợp lệ** | Cao |
| 11 | `ShopHome:117-120` | Truyền `total` trong khi chỉ lấy `limit: 12`. Hiện "48 sản phẩm" nhưng chỉ 12 thẻ và **không có lối đi tiếp** | Bỏ đếm ở home, thêm link "Xem tất cả →" sang `/shop/search` | Cao |
| 12 | `ProductDetail:400-436` vs `ShopStore:152` | "Liên hệ shop": PDP là nút thứ cấp full-width xếp chồng; ShopStore là **primary xanh** | Cả hai: một hàng ngang nút thứ cấp. **Xanh chỉ dành cho mua** | Cao |
| 13 | 5 màn | Breadcrumb dùng chung `tl-shop-sub` với phụ đề trang **và** câu trạng thái đơn. Một class ba nghĩa | Tách `.tl-shop-crumbs` riêng, 12.5px, `margin: 0` | Vừa |
| 14 | `Cart:181+193` `Orders:144+148` `Checkout:283+381` | Crumb cuối và `<h1>` là **cùng một chuỗi**, cách nhau 4px | Bỏ crumb cuối, giữ `<h1>` | Vừa |
| 15 | `Orders:297-311` | Link chính mỗi đơn `color: inherit`, không gạch chân, không icon → **trông như chữ thường** | Thêm chevron phải + `:active { transform: scale(.99) }` | Vừa |
| 16 | `SellerHome:81-93` | Dashboard có 4 ô số về **sản phẩm**, không ô nào về **đơn hàng** — việc hằng ngày từ Phase 3 | Thêm ô đầu "Đơn cần xử lý", nhấn mạnh khi > 0, link `/seller/orders` | Vừa |
| 17 | `Cart:335-377` | Stepper 44px + "Bỏ" 44px + "Xem sản phẩm" 44px, `flex-wrap` → 375px xuống 2 hàng | "Bỏ" thành nút nhỏ icon+chữ ở phải; bỏ "Xem sản phẩm" (tiêu đề đã là link) | Vừa |
| 18 | `Checkout` §4 | **9 đoạn chữ xám nhỏ** trên một màn. Đọc như hợp đồng | Xem mục copy | Vừa |
| 19 | `Checkout:339` `OrderDetail:201` `SellerOrders:190` `SellerProducts:340` | Trạng thái rỗng **thiếu icon 28px** mà 4 chỗ khác đều có | Thêm icon lucide | Nit |
| 20 | 5 màn | Khoảng cách section bằng inline style, 5 giá trị khác nhau. 58 `style={{` trong 6 file | Một class `.tl-shop-section` | Nit |

## Bất nhất — chốt chọn cái nào

1. **Khung trang** → `.tl-shop-page` cho cả 9 màn. *Nguyên nhân số một của "quá xấu".*
2. **Loading** → skeleton đúng hình, xoá `LoadingState` khỏi Shop.
3. **Error** → thanh đỏ `tl-shop-notice--danger`. Viền đứt để dành riêng cho rỗng.
4. **Chip đang chọn** → `aria-current="page"`.
5. **Trạng thái** → giữ cả hai nhưng có luật: **đơn hàng = câu việc-cần-làm**; thuộc tính tĩnh = pill. Đừng đảo.
6. **Nút "Liên hệ shop"** → thứ cấp. Xanh chỉ cho mua.
7. **Badge giỏ** → đã nhất quán, không đụng.
8. **Breadcrumb** → seller có nav riêng, chấp nhận không có; đổi eyebrow mono ở `SellerOrderDetail:252` sang `.tl-shop-back`.
9. **Thẻ đơn** → **chấp nhận khác nhau**: người mua nhớ *món*, người bán nhớ *mã*. Đừng đồng bộ cho đẹp.
10. **Tiền** → đã nhất quán tuyệt đối. Không đụng.

## Top 5 nếu chỉ làm được 5 thứ

1. **Bọc 5 màn vào `.tl-shop-page`** — một dòng JSX mỗi file, sửa đúng thứ PO nhìn thấy đầu tiên.
2. **Tab lọc đơn có trạng thái chọn** — hiện `/shop/orders` và `/seller/orders` là màn **hỏng**, không phải xấu.
3. **Thanh dính đáy cho Checkout + Cart** — cùng lớp lỗi PO vừa báo.
4. **Thống nhất loading + error thành 2 mẫu** — tạo cảm giác "một UI xuyên suốt" nhiều nhất trên mỗi giờ bỏ ra.
5. **Sửa gallery PDP chết** + xoá copy sai ở seller — hai lỗi làm người dùng nghĩ sản phẩm hỏng.

## Chuẩn trạng thái, áp cho cả 12 màn

- **Rỗng** — `tl-shop-empty`, luôn icon 28px + title + 1 câu + tối đa 1 nút.
- **Đang tải** — skeleton **đúng hình**, không bao giờ spinner, không kèm "Đang tải…". `aria-busy` + `aria-label` là đủ.
- **Lỗi** — `tl-shop-notice--danger` + `AlertTriangle` + câu trấn an dữ liệu + nút "Thử lại". Không mượn khung rỗng.
- **Offline** — `OfflineBanner` (`PageStates:90`) `position: fixed; bottom: 0` → **đè lên BottomNav và buybar**. Trong Capacitor là ca thường gặp. Cần `bottom: calc(var(--shop-bottomnav) + …)` khi ở route `/shop`.

## Cắt chữ

- `Cart:429` — bỏ `COPY.noPlaceAll`; `COPY.multiShop` ở dòng 195 đã nói đúng điều đó.
- `Checkout:74-76` — gộp hai đoạn: *"Phí này áp dụng mọi tỉnh thành. ThePickleHub không thu thêm phí nào và chưa nối với đơn vị vận chuyển, nên người bán sẽ đưa mã vận đơn để anh/chị tự tra."*
- `Checkout:68-72` — hint mỗi radio còn một dòng. Câu "ThePickleHub không nhận tiền, không giữ tiền" chỉ **một lần**, đặt cạnh nút.
- `ProductDetail:456-460` — miễn trừ 3 dòng còn một: *"Giá và tình trạng hàng do shop tự khai. ThePickleHub kiểm duyệt nội dung trước khi hiển thị."*
- `ShopHome:70` — 27 chữ, đọc như thông cáo → *"Vợt, giày, bóng và phụ kiện từ các shop đã được ThePickleHub duyệt."*
- `CatalogResults:286` — "Sàn đang ở giai đoạn thử nghiệm" xuất hiện 4 màn. Giữ **một chỗ**: dưới lưới ở `/shop`.

Chất lượng tiếng Việt tốt, đúng giọng người Việt viết, không phải máy dịch.

## Ba mục cần người thứ hai — orchestrator đã chốt

| Mục | Chốt |
|---|---|
| Bỏ crumb cuối trùng `<h1>` | **Bỏ crumb cuối, giữ `<h1>`** — h1 cần cho a11y/SEO, crumb trùng chỉ là nhiễu |
| "Bỏ" trong giỏ thành icon-only | **Không icon-only** — giữ icon + chữ, chỉ thu nhỏ và đẩy sang phải. Đọc được quan trọng hơn gọn |
| `--shop-bottomnav: 72px` cho mọi nền tảng | **Chấp nhận** — thừa 16px trên web rẻ hơn nhiều so với che mất nội dung trên iOS |
