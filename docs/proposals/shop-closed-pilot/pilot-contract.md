# CP2 — Hợp đồng phạm vi closed pilot

> Đây là bản mô tả **pilot là gì và không là gì**, để ba tháng nữa không ai phải
> đoán xem một hành vi là tính năng hay thiếu sót. Nó không cho phép triển khai
> bất cứ thứ gì; mỗi thao tác remote vẫn nằm sau packet của nó.
>
> Nền tảng: `f172a441` · nhánh `feat/shop-closed-pilot`.

---

## 1. Pilot bao gồm

| Có | Ghi chú |
|---|---|
| Một nhóm nhỏ người bán **do Product Owner chọn**, khoá theo `auth.users.id` | Không theo email. Email đổi được, `user_id` thì không |
| Người bán đăng ký hồ sơ, admin duyệt | 5 quyết định: approve · reject · request changes · withdraw · resubmit |
| Người bán tạo shop, sản phẩm, biến thể/SKU, tồn kho cơ bản, ảnh | |
| Admin duyệt sản phẩm và kênh liên hệ | Bắt buộc AAL2 |
| Người mua duyệt Shop, tìm kiếm, lọc theo ngành hàng, xem PDP, bấm "Liên hệ shop" | |
| Mọi route Shop công khai chạy nhưng `noindex, nofollow, noarchive` | Ở edge, không phải thẻ meta sau hydrate |
| Vòng đời ảnh: publish → unpublish/suspend → worker xoá byte thật | Đây là lời hứa với người mua, không phải chi tiết kỹ thuật |
| Hỗ trợ xử lý **thủ công** theo runbook | |

## 2. Pilot KHÔNG bao gồm

| Không | Vì sao |
|---|---|
| Giỏ hàng, đơn hàng, thanh toán | P3a/P3b — không có schema, không có nút chết |
| Chi trả cho người bán (payout) | P4 |
| Thu thập CCCD / giấy tờ | Quyết định §2 của proposal: **không tạo bảng cho dữ liệu đã quyết định không thu** |
| Tài khoản ngân hàng | Như trên |
| Thông báo tự động (email/push) cho người bán | Xem `notification-decision.md` |
| Lập chỉ mục Google | Q4 — cần cổng riêng của Product Owner |
| `sitemap-shop.xml`, IndexNow | Như trên |
| SSR/JSON-LD cho Shop | Cố ý chưa xây (P2b.6). Chúng tồn tại để được crawl, mà chưa gì được crawl |
| Wishlist / lưu sản phẩm | P3a. Không stub, không nút không có hành vi |
| Danh mục do người bán tự tạo | Q3 — taxonomy thuộc về nền tảng |

## 3. Ranh giới an toàn — bốn thứ luôn đúng trong pilot

Bốn mệnh đề dưới đây là thứ khiến pilot **kín**. Vi phạm bất kỳ mệnh đề nào là
tiêu chí dừng, không phải một bug để xếp hàng.

1. **Không ai ngoài allowlist tạo được gì.** `shop_pilot_has_access()` gác mọi
   RPC ghi. Bảng rỗng ⇒ `/seller/application` từ chối tất cả, kể cả Cuong nếu
   Cuong không có role admin.
2. **Không route Shop nào được lập chỉ mục.** `SHOP_PUBLIC_INDEXING` vắng mặt ⇒
   `X-Robots-Tag: noindex, nofollow, noarchive` ở edge **và** khối `Disallow`
   trong `robots.txt`. Chỉ chuỗi chính xác `"1"` mới mở.
3. **Không ai giữ JWT người dùng ghi được vào bucket công khai.**
   `shop-product-media` không có policy INSERT/UPDATE/DELETE nào; chỉ
   `service_role` (tức edge function) đặt được rendition vào đó.
4. **Không quyết định kiểm duyệt nào chạy được ở phiên aal1.** `is_admin()` đòi
   AAL2 kể từ 30/07; `AdminMFAGate` bọc `AdminLayout`.

## 4. Điều Q1 nói và điều nó **không** nói

Q1 (đã ký): allowlist gác **hành động**, không gác **đọc**. Một `shop_members`
row là thứ cho phép đọc dữ liệu của chính shop đó.

Hệ quả thật, cần nói thẳng để không ai ngạc nhiên: một thành viên `support` bị
gỡ khỏi `shop_pilot_members` **vẫn đọc được** bản nháp của shop mình, nhưng
không sửa, không gửi duyệt, không tạo mới. Đây là thiết kế, có 25 assertion khoá
lại trong `shop_p2b_projection_authz.test.sql`, và nó **không** là đường thoát —
`products_select_member` vốn đã cho cùng quyền đọc.

Nghĩa là: **xoá một người khỏi allowlist là đóng băng họ, không phải xoá họ.**
Kill switch dựa trên điều đó và nói rõ giới hạn ở `operations.md`.

---

## 5. ✅ ĐÃ ĐÓNG — chấp thuận quy chế nay được cưỡng chế ở máy chủ

> **Cập nhật:** migration `20260814090000` (CP12) đóng phát hiện dưới đây.
> `shop_application_submit()` nay từ chối trừ khi máy chủ thấy một chấp thuận
> của phiên bản **đã duyệt và đang hiệu lực**, khớp cả version lẫn content hash.
> Chi tiết: [`seller-rules-enforcement.md`](./seller-rules-enforcement.md).
>
> **Hệ quả hiện tại:** chưa có bản quy chế nào được ban hành, nên **mọi** lần gửi
> hồ sơ thất bại với `seller_rules_not_published` — kể cả của Cuong. Đó là hành
> vi đúng, và nó thay "một khoảng trống" bằng "một cánh cửa đóng".
>
> Bản dự thảo đầy đủ chờ duyệt: [`seller-rules-v1.md`](./seller-rules-v1.md).

### Phát hiện gốc, giữ lại để đọc được vì sao nó nguy hiểm

Kiểm tại chỗ, không suy đoán:

- `shop_applications` **không có** cột nào cho `rules_version`, `accepted_at`
  hay `content_hash`.
- `shop_application_submit()` xác thực 5 trường (`seller_type`, `full_name`,
  `phone`, `shop_name`, `city`) và **không** kiểm tra chấp thuận quy chế.
- Ô đồng ý trong `SellerApplication.tsx:426` là `<input type="checkbox" disabled>`
  với `opacity: 0.5` và một dòng giải thích trung thực rằng văn bản chưa tồn tại.

Nói cách khác: **ô đồng ý bị khoá, nhưng việc gửi hồ sơ thì không.** Một người
bán thật có thể nộp và được duyệt hôm nay mà không có bằng chứng chấp thuận điều
khoản nào cả.

Đây **không** phải lỗi của P2a/P2b — không ai từng viết rằng nó chặn. Nhưng câu
"submit bị khoá cho tới khi có quy chế" là **sai**, và nếu tin vào nó rồi mời
người bán thật vào thì mới là sự cố.

**Hệ quả cho pilot:**

| Trạng thái quy chế | Được phép làm gì |
|---|---|
| Chưa ban hành văn bản | Dựng hạ tầng, chạy smoke bằng tài khoản test và một văn bản test-only. **Không mời người bán thật.** ← **đang ở đây** |
| ~~Có văn bản, bằng chứng lưu ngoài hệ thống~~ | **Không còn tồn tại.** Máy chủ nay đòi bằng chứng trong cơ sở dữ liệu; không có đường vòng |
| Đã ban hành v1 vào `legal_documents` với `approved_at` + `effective_at` | Đường duy nhất cho người bán thật |

---

## 6. Mười đầu vào cần Product Owner — không đoán hộ

Không mục nào dưới đây agent có căn cứ để chọn thay.

| # | Câu hỏi | Vì sao không đoán được | Chặn cái gì |
|---|---|---|---|
| 1 | **UUID của từng người bán pilot** | Danh tính người thật | Packet D |
| 2 | **UUID admin pilot đã có AAL2** | Remote có đúng 1 admin + 1 TOTP factor; xác nhận đó là tài khoản sẽ trực kiểm duyệt | Packet D |
| 3 | ✅ **Preview trỏ vào Supabase nào** | **ĐÃ QUYẾT** — staging riêng. Project đã tạo; còn thiếu **project ref** | Packet S, B, C |
| 4 | 🔴 **"Quy chế người bán v1"** | Bản dự thảo đầy đủ đã có ([`seller-rules-v1.md`](./seller-rules-v1.md)); cần **APPROVE/REVISE/REJECT** + `effective_at` + `approved_by` | Mời người bán thật (§5) |
| 5 | ✅ **Chấp nhận pilot chạy không có thông báo tự động?** | **ĐÃ KÝ** — [`notification-decision.md`](./notification-decision.md). Còn trống: tên người kiểm hàng đợi hằng ngày | Packet D |
| 6 | **Thời gian pilot** — bắt đầu, kết thúc | Không có mặc định đúng | Packet D, tiêu chí dừng |
| 7 | ✅ **Ai trực kiểm duyệt** | **ĐÃ CHỐT** — Cuong Nguyen, kiểm hàng đợi **tối thiểu 2 lần/ngày**. Vẫn chỉ có một admin: nếu người đó đi vắng một tuần thì hàng đợi đứng, và đó là rủi ro đã biết chứ không phải một khoảng trống | Packet D |
| 8 | **Ai trực sự cố** ngoài giờ | Như trên | Packet D |
| 9 | **Giới hạn số shop / số sản phẩm** trong pilot | Là ngưỡng cảnh báo, không phải ràng buộc kỹ thuật | `operations.md` |
| 10 | **Tiêu chí dừng bằng số** | §7 đưa danh sách sự kiện; ngưỡng là quyết định | Packet D |

---

## 7. Tiêu chí dừng — sự kiện, chưa có ngưỡng

Dừng pilot **ngay**, không chờ họp, khi bất kỳ điều nào xảy ra:

1. Rò rỉ dữ liệu hoặc ảnh riêng tư — kể cả một object.
2. Một người bán đọc hoặc ghi được dữ liệu của shop khác.
3. Một thao tác admin đi qua được mà không có AAL2.
4. Worker dọn ảnh không chạy, hoặc chạy mà không xoá được byte.
5. Một sản phẩm công khai **trước** khi được duyệt và publish.
6. Một sản phẩm bị đình chỉ **vẫn** công khai.
7. Bất kỳ route Shop nào xuất hiện trong sitemap, hoặc mất `noindex`.
8. Google lập chỉ mục bất kỳ URL Shop nào (cửa một chiều — revert gỡ route,
   không gỡ URL khỏi Google).
9. Hỏng dữ liệu ở bất kỳ bảng nào.
10. Lỗi tăng vọt không kiểm soát được.

Ngưỡng số cho mục 10 (và cho "chậm duyệt bao lâu là quá lâu") thuộc Packet D.

---

## 8. Điều pilot **cố ý** không hứa

Ghi ở đây để không ai coi là thiếu sót:

- **Không có SLA duyệt.** Prototype nói "chưa cam kết thời gian" và điều đó được
  giữ nguyên. Chọn một con số mà không có người trực là hứa suông.
- **Không có kênh hỗ trợ người mua.** Người mua liên hệ thẳng shop.
- **Không có lưu trữ khi người bán rời chương trình.** Chính sách giữ dữ liệu bao
  lâu là câu hỏi mở, ghi ở `seller-rules-v1-outline.md` §2.
- **Ảnh sản phẩm không nằm trong bản sao lưu cơ sở dữ liệu.** Storage object sao
  lưu riêng (`ops-runbook.md` §6). Mất bucket = mất ảnh, khôi phục DB không cứu.
- **Chuyển hướng slug làm rớt tiền tố `/vi`.** Đã biết, đã ghi, không chặn pilot
  vì mọi thứ đều noindex; **phải** chốt trước khi bật lập chỉ mục
  (`deployment-readiness.md` §"Quyết định đang chờ").
