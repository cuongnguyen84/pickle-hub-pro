# Chính sách bảo mật — bổ sung dữ liệu Shop

> **Trạng thái: ĐỀ XUẤT — CHƯA ÁP DỤNG, CHỜ PRODUCT OWNER DUYỆT RIÊNG.**
>
> `src/pages/Privacy.tsx`, `src/i18n/vi.ts` và `src/i18n/en.ts` **không bị sửa**
> trong checkpoint này. Bản sửa nằm nguyên trong
> [`privacy-shop-disclosure.patch`](./privacy-shop-disclosure.patch) và chỉ vào
> mã nguồn khi có một quyết định riêng.
>
> Áp khi được duyệt:
> `git apply docs/proposals/shop-closed-pilot/privacy-shop-disclosure.patch`
> (đã kiểm bằng `git apply --check` — áp sạch trên `0f036e1e`).

---

## 1. Vì sao đây là blocker, không phải việc dọn dẹp

Quy chế người bán §14 mô tả ba nhóm dữ liệu mà tính năng Shop xử lý. Chính sách
bảo mật hiện tại **không nhắc tên nhóm nào trong ba nhóm đó**: nó liệt kê email,
tên hiển thị, ảnh đại diện và dữ liệu sử dụng — đúng cho nền tảng trước khi có
Shop, và thiếu kể từ khi có.

§14 của quy chế cũng đã tự nhận điều này và tự đặt mình dưới Chính sách bảo mật:
*"Nếu có bất kỳ mâu thuẫn nào giữa hai văn bản, Chính sách bảo mật thắng, và
ThePickleHub có trách nhiệm cập nhật nó."* Mời một người bán thật vào chương
trình trong khi Chính sách bảo mật chưa liệt kê dữ liệu mà chương trình thu là
đặt hai văn bản của chính mình vào thế mâu thuẫn.

Đây là lý do nó chặn **lời mời người bán thật**, chứ không chặn checkpoint kỹ
thuật nào.

---

## 2. Ba nhóm được thêm — và không thêm gì khác

Bản sửa **không phát minh loại dữ liệu nào**. Mỗi dòng dưới đây tương ứng với
một cột hoặc một bảng đang tồn tại.

| Nhóm | Nguồn trong implementation | Ai đọc được |
|---|---|---|
| **Công khai trên trang shop** | `shops` (tên, giới thiệu, tỉnh/thành, ngành hàng, logo, ảnh bìa, chính sách giao hàng/đổi trả), `products` + ảnh, `shop_contact_channels` **đã duyệt** | bất kỳ ai |
| **Hồ sơ và dữ liệu nội bộ** | `shop_applications` (họ tên, số điện thoại, địa chỉ lấy hàng, tỉnh/thành) | người nộp + quản trị viên |
| **Bằng chứng chấp thuận** | `legal_acceptances` (phiên bản, `content_hash`, `accepted_at`) | người ký + quản trị viên |
| **Nhật ký kiểm duyệt** | `shop_application_events`, `shop_contact_moderation_events`, `product_moderation_events`, ghi chú nội bộ | quản trị viên |

Ba điều được nói **thẳng** vì chúng là cam kết chứ không phải mô tả:

- **Không có IP, không có dấu vết thiết bị** trong bằng chứng chấp thuận. Đây
  không phải lời hứa suông: migration `20260814090000` cố ý không tạo cột nào để
  lưu chúng, và một test cấm cột đó xuất hiện.
- **Địa chỉ lấy hàng không công khai**, và email/số điện thoại tài khoản không tự
  động trở thành kênh liên hệ công khai.
- **Nhật ký kiểm duyệt ghi *loại* kênh, không ghi *giá trị* kênh.**

---

## 3. Vòng đời — ở mức implementation thật sự hỗ trợ

Không hứa quá những gì cơ sở dữ liệu làm:

| Dữ liệu | Điều gì xảy ra khi tài khoản bị xoá | Khoá ngoại |
|---|---|---|
| Hồ sơ đăng ký người bán | xoá theo | `shop_applications.applicant_user_id … ON DELETE CASCADE` |
| Bằng chứng chấp thuận | xoá theo | `legal_acceptances.user_id … ON DELETE CASCADE` |
| Nhật ký kiểm duyệt | **giữ lại**, nhưng người thao tác thành `NULL` | `actor_user_id … ON DELETE SET NULL` |
| Shop | **chặn việc xoá tài khoản** | `shops.owner_user_id … ON DELETE RESTRICT` |

Dòng cuối là một phát hiện đi kèm, và nó không nằm trong phạm vi bản sửa này:

> 🔴 **`shops.owner_user_id` là `ON DELETE RESTRICT`.** Một người bán đã có shop
> **không xoá được tài khoản** bằng luồng `delete-account` hiện có — nó sẽ thất
> bại ở tầng khoá ngoại. Bản sửa Privacy nói đúng sự thật đó ("shop phải được xử
> lý trước thì tài khoản mới xoá được"), nhưng **nói thật về một hạn chế không
> làm nó biến mất**. Cần một quyết định riêng trước khi mời người bán thật: hoặc
> có đường xử lý shop khi chủ shop muốn rời đi, hoặc nói rõ trong quy chế rằng
> việc đó phải làm qua email. Chưa sửa gì trong checkpoint này.

---

## 4. Ngày hiệu lực

Bản sửa đổi ngày hiệu lực hiển thị từ **28/12/2024** sang **14/08/2026**.

Nếu Product Owner muốn giữ nguyên ngày cũ, hãy bỏ hunk cuối của patch. Nhưng một
chính sách vừa được thêm nội dung mới mà vẫn tự nhận có hiệu lực từ 2024 là một
sai lệch âm thầm — đúng loại sai lệch mà cả gói checkpoint này tồn tại để chống.

---

## 5. Không làm yếu cam kết nào đang có

Bản sửa **chỉ thêm** một mục. Không câu nào trong các mục hiện có bị đổi, bị bỏ
hay bị làm nhẹ đi. Cam kết "không bán, không chia sẻ dữ liệu cá nhân cho bên thứ
ba" giữ nguyên văn; mục Shop nằm dưới nó chứ không thay nó.

---

## 6. Đã kiểm những gì

| Kiểm | Kết quả |
|---|---|
| `git apply --check` trên cây sạch | áp sạch |
| `npx tsc -b` khi patch đang được áp thử | exit 0 |
| `npx vitest run src/i18n` khi patch đang được áp thử | 15 PASS · 2 file |
| Cây làm việc sau khi thử | đã hoàn nguyên, `Privacy.tsx`/`vi.ts`/`en.ts` không đổi |

Patch được sinh ra bằng cách **áp thật rồi hoàn nguyên**, chứ không viết tay —
nên nó không thể là một diff không áp được.

---

## 7. Quyết định cần từ Product Owner

1. Duyệt hay sửa nội dung mục Shop (VI là bản gốc, EN là bản dịch).
2. Giữ hay bỏ việc đổi ngày hiệu lực sang 14/08/2026.
3. Quyết định riêng cho vấn đề `ON DELETE RESTRICT` ở mục 3 — trước khi mời
   người bán thật.
