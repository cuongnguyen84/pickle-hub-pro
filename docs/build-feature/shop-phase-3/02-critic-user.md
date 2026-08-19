# 02 — Phản biện người dùng (critic-user)

Bản phân tích kỹ thuật vững. Phần dưới chỉ nói về **giá trị cho người dùng và trải nghiệm**. Ba điều quan trọng nhất, nói trước:

1. **COD-only KHÔNG giết tính năng, nhưng lý do biện hộ trong §6 là sai** — và hệ quả là bỏ mất một lựa chọn gần như miễn phí.
2. **Người bán sẽ không biết có đơn mới.** `social_notifications` chỉ sáng khi người bán mở web. Đây là lỗ hổng lớn nhất của cả gói.
3. **Không được để luồng đặt hàng thật mở trên production khi PO đang ngủ** — Q10 cần một công tắc tắt, không chỉ một migration.

---

## 1. Mặc định Q1–Q10

### Q3 — COD-only: **SỬA** (giữ COD làm mặc định, thêm một nhánh chuyển khoản không tốn schema)

COD là đúng cho pilot: người Việt mua của shop lạ luôn muốn COD, và ở đây shop nội bộ = chính nền tảng nên rủi ro bom hàng xử lý bằng một cú điện thoại trước khi ship. Nút "Xác nhận đơn" của người bán đã là chốt chặn đó. **Không cần `cod_max_vnd`, không cần cọc.**

Nhưng lập luận "VietQR bất khả thi vì Option B′ không thu dữ liệu ngân hàng" **lẫn lộn hai thứ**: (a) nền tảng giữ tiền / thu tài khoản người bán để payout — cấm, đúng; (b) shop tự khai số tài khoản của chính họ để người mua chuyển thẳng — nền tảng không chạm vào đồng nào. Prototype B10 (`src/proto/shop/screens/B10OrderSuccess.tsx:95`) hiển thị "CONG TY THEPICKLEHUB" — cái đó mới là thứ Option B′ cấm.

Đề xuất: giữ COD là lựa chọn mặc định chọn sẵn, thêm lựa chọn thứ hai **"Chuyển khoản trước — shop sẽ gửi thông tin"**, trang đặt hàng thành công hiện luôn nút Zalo/gọi của shop bằng `usableContacts` đã có (`src/lib/shop/contactCta.ts`) — không thêm cột ngân hàng, không QR, không đối soát tự động, và cái vợt 5 triệu vẫn bán được cho người không muốn ôm 5 triệu tiền mặt ra cửa.

### Q1 — phí ship phẳng, mặc định 0: **SỬA**

"0đ" hoặc dấu "—" (B09 render `—` khi shipping = 0, dòng 254) đọc là **"chưa tính"**, không phải "miễn phí".

Đề xuất: đặt sẵn phí thật cho đúng một shop đang có (30–35k như prototype) để **không ai gặp trạng thái 0**, và nếu bằng 0 thì render chữ **"Miễn phí"**, tuyệt đối không render "0đ" hay "—". Kèm dòng "Phí này áp dụng cho mọi tỉnh thành" — người bán phải biết mình đang bù phần chênh chứ không được gọi thu thêm sau.

### Q5 — hiện hạn 48h nhưng không tự huỷ: **SỬA (lời hứa nền tảng không giữ được)**

B12 viết "Quá hạn thì quản trị viên vào xử lý" (`B12OrderDetail.tsx:77`). Với một shop mà chủ shop **chính là** quản trị viên, câu này là hứa suông.

Đề xuất: bỏ đồng hồ đếm ngược phía người mua, thay bằng "Shop thường trả lời trong 1–2 ngày" **kèm nút "Huỷ đơn" luôn hiện** khi đơn chưa được xác nhận. Giữ nguyên hạn 48h + sắp xếp quá hạn lên đầu ở phía **người bán**.

### Q9 — địa chỉ tự do + tỉnh tĩnh: **SỬA (thiếu quận/huyện–phường/xã là hỏng việc giao hàng thật)**

Bản phân tích bỏ hẳn `ward`/`district` (B09, B12, S09 đều render 4 cấp). Người mua gõ "số 5 ngõ 12 Trần Duy Hưng" → người bán không điền nổi form vận chuyển.

Đề xuất: một ô free-text nhưng **nhãn và placeholder ép đủ cấp** ("Số nhà, đường, phường/xã, quận/huyện"), cộng ô chọn tỉnh/thành, cộng ô "Ghi chú cho người giao" không bắt buộc. Zero schema thêm. Danh sách tỉnh/thành phải là bản **sau sáp nhập 2025**.

### Q6 + Q7 — đánh giá: **GIỮ, nhưng bản phân tích mâu thuẫn với thiết kế đã duyệt**

Q6 nói "không sửa"; B15 trạng thái `already` lại có nút "Sửa đánh giá" (`B15Review.tsx:67`). Chọn một → không cho sửa, bỏ nút đó, thêm cảnh báo trước khi gửi.

B15 còn có ô upload ảnh đánh giá — bản phân tích cắt ảnh ở B13 nhưng **quên B15**. **Cắt luôn**, nói rõ.

### Q8 — không cần allowlist người mua: **GIỮ**.

### Q10 — áp migration prod đêm nay: **SỬA — thêm công tắc tắt cho phần người mua**

Rủi ro sản phẩm: 5–6h sáng một người thật vào `/shop`, đặt một đơn thật cho một cái vợt thật, không ai trực, luồng chưa được PO nghiệm thu → nền tảng đã tạo ra một **nghĩa vụ giao hàng có thật**.

Đề xuất: ship kèm một công tắc tắt nút "Thêm vào giỏ"/"Đặt hàng", mặc định **TẮT**, PO bật sau khi kiểm tra sáng mai. Đây cũng là "nút tắt khẩn cấp" mà §7 nói không cần — chuyển shop sang `restricted` thì shop biến mất khỏi catalog công khai, tác dụng phụ quá to.

### Q2, Q4 — **GIỮ**. Thêm một câu vào B13: "Ai trả phí gửi trả do anh/chị và shop thoả thuận — ThePickleHub không quyết định việc này."

---

## 2. Thứ tự hy sinh ở §9

**Đồng ý với thứ tự, phản đối phần thiếu.**

Cắt P3b-6 trước là đúng. Giữ wishlist trên đánh giá cũng đúng: đánh giá tốn gấp 3–4 lần công và **không có nội dung nào để hiển thị cho tới khi có người mua xong và nhận hàng**.

Cái §9 thiếu: **điều kiện để việc cắt dispute là an toàn**. Chỉ chấp nhận được nếu người mua luôn có đường liên hệ shop **từ trong đơn hàng**. Hiện B12 chỉ có "Nhắn người bán" ở đúng một trạng thái và trỏ vào `#` (dòng 39). → Đưa `usableContacts` lên **mọi trạng thái đơn**, cả hai phía.

Bổ sung vào "không được cắt": **nút huỷ đơn phía người mua** và **lý do huỷ/từ chối hiển thị cho người mua**.

---

## 3. Lỗ hổng luồng mua → đặt → nhận → đánh giá

**a) Người chưa đăng nhập bấm "Thêm vào giỏ".** Nếu bị đá sang trang đăng nhập và **mất luôn biến thể vừa chọn**, đó là chỗ rơi của cả tính năng. Đề xuất: nhớ `(variant, qty)` trong sessionStorage, đăng nhập xong tự thêm vào giỏ và đưa thẳng tới giỏ.

**b) Chủ shop tự mua của mình.** Sáng mai PO sẽ tự đặt một đơn thử — **đừng chặn**. Nhưng phải loại đơn tự mua khỏi điều kiện đánh giá.

**c) Đơn bị người bán từ chối — người mua biết bằng cách nào?** `WHO_NEXT` trong B12 gộp hết vào `da-huy`, không ai biết ai huỷ và vì sao. → Dòng đầu B12 phải nói **ai huỷ + lý do**, và kho phải hoàn.

**d) Thông báo — lỗ hổng lớn nhất.** `social_notifications` = người bán chỉ biết khi mở web. Người mua đặt 21h, người bán thấy 10h hôm sau, trong khi UI khoe "hạn 48 giờ". Cách vá rẻ nhất **đã có sẵn**: bot Telegram ops (`@Tphaisupport_bot`, chat_id đã lưu) — một cú gọi từ RPC tạo đơn. Đây là 20 dòng đáng giá nhất trong cả Phase 3.

Kèm theo: B11 viết "mở đơn từ email xác nhận" (`B11Orders.tsx:62`) — **email đó không tồn tại**. Sửa câu đó.

Và: tiêu đề thông báo do RPC viết một ngôn ngữ — người dùng EN (5%) sẽ thấy tiếng Việt. Chấp nhận được ở pilot, nhưng ghi vào báo cáo.

**e) Không có bước "Tôi đã nhận hàng" của người mua.** S09 nói đơn sang "Đã giao" khi người mua xác nhận **hoặc sau 7 ngày** — không có cron thì vế thứ hai không tồn tại, và điều kiện mở đánh giá lại là `delivered`. → Cho phép **người mua** cũng thực hiện transition đó ("Tôi đã nhận hàng").

**f) Giỏ nhiều shop khi chỉ có một shop.** Ẩn phần giải thích "mỗi shop là một đơn riêng" khi chỉ có một nhóm.

**g) Mobile — sau khi thêm vào giỏ cần toast có nút "Xem giỏ".** Đừng bắt họ tự tìm badge.

**h) Nếu cắt wishlist** thì link "Sản phẩm anh/chị lưu vẫn nằm trong mục Đã lưu" ở trạng thái giỏ rỗng sẽ treo.

---

## 4. Chữ tiếng Việt — chỗ hứa điều nền tảng không giữ được

- **"Đã hoàn tiền" / `da-hoan-tien`: SỬA.** Nền tảng không giữ đồng nào. Đổi thành **"Shop báo đã hoàn tiền"** (kèm ngày + số tiền do shop nhập) + dòng nhỏ "ThePickleHub ghi nhận thông tin này, không giữ và không chuyển tiền".
- **"Khiếu nại" / "Quản trị viên sẽ xem xét và quyết định": BỎ HẾT** nếu cắt P3b-6, gồm cả câu "không trả lời thì tự chuyển thành khiếu nại" (B13:39) — **không có job nào làm việc đó**.
- **"Chưa thanh toán" cho đơn COD: SỬA** → "Trả khi nhận hàng".
- **"Đổi sang phiên bản khác" ở B13: BỎ.** Máy trạng thái không mô hình hoá việc đổi.
- **"Số điện thoại chỉ hiện tới khi đơn kết thúc 30 ngày" (S09:239): BỎ câu này.** Không có job xoá.
- **Giữ tuyệt đối:** cách B11 viết trạng thái thành **câu nói việc người mua cần làm** ("Người bán đang chuẩn bị hàng — chưa cần làm gì") thay vì chip trạng thái.

---

## 5. Rẻ mà đáng làm, bản phân tích chưa nhắc

1. **Telegram ping cho người bán khi có đơn mới** — 3(d). Không có nó thì "48 giờ" chỉ là chữ.
2. **Nút gọi/nhắn NGƯỜI MUA từ S09** (`tel:` từ SĐT giao hàng). Đây mới là chống bom hàng COD thật sự.
3. **Nút "Sao chép địa chỉ giao" ở S09.** Lỗi giao hàng đầu tiên sẽ đến từ gõ tay sai số nhà.
4. **Nút liên hệ shop trên mọi trạng thái đơn phía người mua** — điều kiện an toàn để cắt dispute.
5. **Chặn đặt hàng nếu shop chưa có kênh liên hệ đã duyệt.**
6. **Giới hạn số đơn chưa xác nhận trên mỗi người mua (5).**

---

## Tóm tắt cho orchestrator

**Sửa mặc định:** Q1 (0đ → "Miễn phí", seed phí thật), Q3 (thêm nhánh chuyển khoản qua kênh liên hệ shop, không thêm cột ngân hàng), Q5 (bỏ đếm ngược phía mua, thêm nút huỷ), Q9 (ép quận/huyện–phường/xã trong free-text, tỉnh sau sáp nhập), Q10 (công tắc tắt nút đặt hàng, mặc định tắt).
**Giữ:** Q2, Q4, Q6, Q7, Q8, và thứ tự hy sinh §9.
**Bỏ khỏi copy/thiết kế:** mọi nhắc tới khiếu nại nếu cắt P3b-6, "Đã hoàn tiền", "30 ngày", nút "Sửa đánh giá", upload ảnh ở B15, ô "Đổi phiên bản" ở B13, câu "email xác nhận" ở B11.
**Bổ sung bắt buộc:** Telegram ping đơn mới, nút liên hệ hai chiều trên đơn, người mua tự bấm "đã nhận hàng", lý do huỷ/từ chối hiển thị cho người mua, giữ lại lựa chọn biến thể khi khách chưa đăng nhập bấm thêm vào giỏ.
