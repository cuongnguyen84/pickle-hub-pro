# Trả lời của PO (Cuong) — 17/08, sau bản phân tích 01

Hỏi bởi orchestrator, trả lời trực tiếp trong phiên. **Đây là dữ kiện cứng, ưu tiên cao hơn suy đoán trong 01.**

## Q1 — Triệu chứng khi bấm nút trên iPhone
> "đây là đưa lên trang shop của **ảnh logo và ảnh banner** — không phải ảnh sản phẩm. **Ảnh sản phẩm đã tốt rồi**."

PO không mô tả triệu chứng màn hình mà làm rõ **phạm vi**: bug chỉ nằm ở publish **logo + ảnh bìa (profile media)**. Nhánh ảnh sản phẩm hoạt động bình thường.
⇒ Câu hỏi "màn hình hiện gì" VẪN CÒN MỞ (kẹt spinner / dòng đỏ / không phản ứng). Không được suy đoán thay.

## Q2 — Ảnh sản phẩm up từ iPhone có publish được bằng nút không?
> **"Lên được bằng nút bấm."**

⇒ **Dữ kiện quyết định.** Ảnh sản phẩm do iPhone up (tức rendition JPEG do iOS Safari encode, theo ladder ở `imagePipeline.ts:164-187`) **đã đi qua trót lọt** chặng download → sniff → `inspectJpeg` → upload public của `shop-media-lifecycle`.
⇒ **H1 (iOS JPEG mang APP1 bị `jpeg.ts:51-53` chặn) COI NHƯ CHẾT**, trừ khi chứng minh được nhánh profile dùng đường copy/giám định KHÁC nhánh sản phẩm. Việc đầu tiên của vòng code: đọc `index.ts` xác nhận hai nhánh dùng chung hàm copy — nếu chung thì H1 loại vĩnh viễn, dồn lực vào phần **CHỈ có ở nhánh profile**.
⇒ Trọng tâm dời sang: RPC `shop_profile_media_publish_prepare/_commit` (mới, migration `20260817090000`) — quyền `authenticated`, schema cache, chữ ký hàm — và call site client riêng của profile (`useProductMedia.ts:104-128` + `MediaEditor.tsx:487-510`), tức H2/H3/H0.

## Q3 — Quyền thao tác trên prod để tái hiện
> Chọn: **"Tạo shop/seller test riêng"** + **"Được up lại logo/bìa shop PO"**

⇒ Agent ĐƯỢC PHÉP: tạo user + shop test trên prod (createUser + `shop_members`) và chạy end-to-end thật; được up lại logo/bìa của shop ThePickleHub kể cả khi việc đó hạ ảnh công khai hiện tại xuống + xếp hàng xoá.
⇒ Vẫn phải: dọn dữ liệu test sau khi xong, và báo trước nếu logo shop PO sẽ mất tạm.

## Còn mở (chưa hỏi được / PO chưa trả lời)
- Triệu chứng chính xác trên màn hình iPhone.
- Safari thường / PWA đã cài / in-app browser.
- Nếu root cause dính hàng rào riêng tư (APP1/GPS): phương án nới nào được ký. — Nhiều khả năng KHÔNG cần nữa vì H1 đã chết.
