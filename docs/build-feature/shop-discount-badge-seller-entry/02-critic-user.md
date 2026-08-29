# Phản biện người dùng — Badge giảm giá + Lối vào Kênh người bán

## 1. Đúng vấn đề?
Badge: đúng nhu cầu nhưng đề bài ("20 sp đang giảm, anh tự nhập số") và phân tích (hạ tầng giá gốc xuyên 3 RPC ghi + 2 đọc + form + VariantEditor + bulk import + SSR) là hai bài toán. Phần người mua thấy chỉ là 1 badge + 1 dòng giá gạch; 80% việc còn lại để seller tự nhập. Đề nghị **tách 2 PR ship độc lập**: PR1 = đọc + hiển thị + backfill SQL 20 món; PR2 = form/bulk import.
Lối vào seller: đúng, menu avatar đúng nhưng chưa đủ trên điện thoại.

## 2. Thiếu gì
- **Drawer mobile** (`TheLineLayout.tsx:898-908` "Tài khoản / Thông báo") phải có mục Seller cùng gate `useMyShop` — seller VN bấm ☰ hơn avatar 32px. Không tuỳ chọn.
- **Link "Quản lý shop →" ở topline /shop** (`ShopHome.tsx:45`) khi có shop — đúng ngữ cảnh (đang xem card của mình). Đưa vào scope.
- `useMyShop` theo owner → `shop_members` (vợ/chồng/nhân viên) không thấy: nếu bảng có người dùng, gate phải bao gồm; nếu chưa, ghi nợ rõ.
- Người **đang chờ duyệt** cũng lạc: dùng `useMyApplication()` hiện "Đơn mở shop: đang chờ duyệt" trong cùng mục — gần 0 chi phí.
- Card 138px trên 320px không đủ chỗ "giá gạch + giá bán + badge" → một pattern duy nhất.

## 3. Rủi ro sản phẩm — mâu thuẫn quyết định đã có
`src/proto/shop/screens/F04Discovery.tsx:79`: "Giá cũ chỉ xuất hiện khi người bán thật sự đổi giá, luôn kèm ngày đổi — lịch sử giá, không phải khuyến mãi bịa." `ProductCard.tsx:10-11`: "no struck-out original price, no badge the data cannot support". Cả hai có chủ ý giữ niềm tin (rào cản số 1). Quy chế seller v1 §4 cấm giá mồi, §5 cấm giá ảo phiên bản — **không có điều nào về giá cũ/giá so sánh**. Làm kiểu Shopee (đỏ + gạch) thì shop đầu tiên dùng anchor pricing là shop của chính Cuong.

## 4. Trả lời 6 câu hỏi
- **Q1 Giá gốc** (không %): seller nghĩ bằng tiền; CHECK DB chỉ hoạt động với giá; form hiện "-21%" tại chỗ.
- **Q2 Card nhiều phiên bản**: chỉ badge khi MỌI phiên bản có bán đều giảm, lấy % THẤP nhất; không "tới -X%". Không đồng nhất → card không badge, PDP vẫn giá gạch theo variant chọn.
- **Q3 Backfill**: hỏi Cuong có bảng giá gốc → SQL một lần theo sku/slug; không ép sửa tay 20 món.
- **Q4 Lối vào**: 3 chỗ gate `useMyShop`: (a) menu avatar desktop, (b) drawer mobile dưới "Tài khoản", (c) link nhỏ topline /shop. Bonus: pending → "Đơn mở shop: đang chờ duyệt".
- **Q5 Hết hạn**: KHÔNG. Nhưng chống "giảm vĩnh viễn": hiện ngày trên PDP ("Giá cũ 2.400.000₫ đến 20/08/2026", dùng `updated_at` variant hoặc cột `compare_at_set_at`); tối thiểu sửa câu miễn trừ `ProductDetail.tsx:514` → "Giá, giá cũ và tình trạng hàng do shop tự khai."
- **Q6 Nhãn: "Giá cũ"** — không "Giá gốc" (ngụ ý giá hãng), không "Giá niêm yết" (pháp lý, như nền tảng bảo chứng). Card: chỉ giá gạch + badge; PDP: giá gạch nhỏ + chữ thường "giá cũ".

**Hình thức badge**: pattern `tl-pcard-flag` sẵn có, text "-21%", **không đỏ**, chữ `--tl-green`. "Nhìn thấy nhưng không hét". Nếu Cuong nhất định đỏ Shopee → nói thẳng trade-off niềm tin, ghi lại.

**Bắt buộc kèm**: bổ sung quy chế seller một câu: "Giá cũ phải là giá shop thật sự từng bán món này; không đặt giá cũ chỉ để tạo con số giảm." Không có thì admin không có căn cứ gỡ badge giả.

## Scope đề xuất
PR1: 2 RPC đọc + types + card badge + PDP giá cũ theo variant + backfill SQL + SSR bump + 3 điểm vào Seller. PR2: form/VariantEditor/bulk import + validate client + map lỗi CHECK + quy chế.

Files: `ProductCard.tsx` (10-11, 59), `ProductDetail.tsx` (332-338, 501-517, 540-546), `TheLineLayout.tsx` (689-698, 898-908), `ShopHome.tsx:45`, `proto/shop/screens/F04Discovery.tsx:79`, `migrations/20260814100000_shop_seller_rules_v1_publish.sql` (§4 195, §5 241, §6 251-258).
