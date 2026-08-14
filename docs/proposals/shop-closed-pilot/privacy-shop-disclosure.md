# Chính sách bảo mật — bổ sung dữ liệu Shop

> **Trạng thái: ĐÃ DUYỆT VÀ ĐÃ ÁP (13/08) — CHƯA DEPLOY.**
>
> Product Owner duyệt toàn bộ bản sửa. Đã áp vào `src/pages/Privacy.tsx`,
> `src/i18n/vi.ts`, `src/i18n/en.ts` — **chỉ trên nhánh cục bộ
> `feat/shop-closed-pilot`**, chưa push, chưa deploy, nên
> `thepicklehub.net/privacy` vẫn đang phục vụ bản cũ.
>
> File `.patch` đã **xoá** sau khi áp: giữ lại một bản sao thứ hai của cùng nội
> dung là mời hai bản đi lệch nhau, và `git show` đã là bản ghi chính xác hơn.
> Tài liệu này ở lại vì nó ghi **lý do** và **vòng đời dữ liệu**, thứ mà diff
> không nói.
>
> Nội dung đã áp: `git show <commit Privacy> -- src/pages/Privacy.tsx src/i18n`.

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

## 6. Test khoá nội dung này lại

`src/pages/__tests__/privacy-shop-disclosure.test.tsx` — **21 assertion**, hai
tầng có chủ ý:

| Tầng | Khoá cái gì |
|---|---|
| Qua **trang** (render Privacy, VI và EN) | bốn nhóm dữ liệu **thật sự hiển thị**; ngày hiệu lực `14/08/2026`; mục Shop nằm **sau** "Chia sẻ dữ liệu" và **trước** "Quyền của bạn" |
| Qua **từ điển**, từng ngôn ngữ | bullet công khai **không** chứa địa chỉ lấy hàng / họ tên / số điện thoại / ghi chú quản trị; lời hứa không-IP không-fingerprint; nhật ký chỉ ghi *loại* kênh; **không câu nào** nói ThePickleHub giữ tiền, ký quỹ hay xử lý thanh toán; vòng đời chỉ hứa đúng những gì khoá ngoại làm |
| Parity VI/EN | cùng hình dạng khoá, cùng bốn nhóm cùng thứ tự, và **bản dịch không phải bản sao chép** |

Vì sao có tầng "qua trang": một mục chỉ tồn tại trong từ điển là một mục **không
ai được xem**. Đó đúng là chỗ bốn lỗi gần nhất của repo này nằm — test bảo vệ
hàm chứ không bảo vệ chỗ nối.

**Đỏ trước, xanh sau** — phá đúng call site production:

| Phá gì | Kết quả |
|---|---|
| Xoá `<section>` Shop khỏi `Privacy.tsx` + trả ngày về `28/12/2024` | **4 đỏ** (cả hai ngôn ngữ, ngày, thứ tự) |
| Nhét "địa chỉ lấy hàng" vào bullet **công khai** trong `vi.ts` | **1 đỏ** — đúng assertion về rò rỉ |
| Hoàn nguyên cả hai | **21/21 xanh** |

---

## 7. Quyết định còn lại

1. ✅ Nội dung mục Shop — **DUYỆT**, đã áp.
2. ✅ Ngày hiệu lực `14/08/2026` — **DUYỆT**, đã áp.
3. ⬜ `ON DELETE RESTRICT` (mục 3) — **B12, vẫn mở**, checkpoint riêng. Chưa
   implement gì.
