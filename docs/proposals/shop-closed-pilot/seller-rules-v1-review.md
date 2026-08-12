# Rà soát Quy chế người bán v1 — theo từng mục

> Đi kèm [`seller-rules-v1.md`](./seller-rules-v1.md), trạng thái
> `DRAFT — PENDING PRODUCT OWNER APPROVAL`.
>
> Mục đích: nói rõ **câu nào mô tả code đang chạy**, **câu nào là một quyết định
> sản phẩm**, và **câu nào cần luật sư** — để Product Owner đọc bản dự thảo mà
> biết mình đang duyệt cái gì.
>
> **Agent không tự tick PASS ở bất kỳ dòng nào.**

## Ký hiệu

| | |
|---|---|
| 🟢 **CODE** | Câu này mô tả hành vi hệ thống hiện tại. Có test hoặc có mã nguồn chỉ thẳng vào |
| 🔵 **QUYẾT ĐỊNH** | Quyết định sản phẩm/vận hành. Product Owner chốt; code không có ý kiến |
| 🟠 **PHÁP LÝ** | Cần rà soát pháp lý trước public launch. Trong pilot kín thì chấp nhận được |
| 🔴 **CHẶN** | Chặn việc ban hành. Phải giải quyết trước khi văn bản có hiệu lực |

---

## Bảng theo mục

| Mục | Loại | Ghi chú |
|---|---|---|
| **1. Mục đích và phạm vi** | 🟢 + 🔵 | "Chỉ người trong danh sách" và "không lập chỉ mục" là **CODE**: `shop_pilot_has_access()` gác mọi ghi; `X-Robots-Tag` đặt ở edge, 116 assertion. "Giới hạn số người bán/sản phẩm/thời gian" là **QUYẾT ĐỊNH** — hiện chưa có ràng buộc kỹ thuật nào cưỡng chế các giới hạn đó |
| **2. Điều kiện trở thành người bán** | 🟢 | Cả 5 điều kiện đều cưỡng chế được: allowlist, hồ sơ, duyệt của admin, và **chấp thuận đúng version/hash** (migration `20260814090000`). "Không chuyển nhượng shop" là 🔵 — chưa có cơ chế chuyển chủ, nên không có gì để vi phạm về mặt kỹ thuật |
| **2. "chưa được xác minh danh tính"** | 🟢 🔴 | **Đúng và quan trọng.** Pilot không thu CCCD/ngân hàng. Câu này phải **giữ nguyên, không làm nhẹ đi** — bỏ nó đi là để người mua tự suy ra một sự bảo đảm không tồn tại |
| **3. Hàng hoá được phép** | 🟢 + 🔵 | Taxonomy do nền tảng sở hữu là **CODE** (Q3, không có API cho seller tạo category). Danh sách ngành hàng cụ thể là **QUYẾT ĐỊNH** — phải khớp `product_categories` thực tế khi ban hành |
| **4. Hàng hoá và nội dung bị cấm** | 🟠 | Danh sách nghiệp vụ, hợp lý cho pilot. **Không đi sâu vào danh mục pháp lý chuyên ngành** (dược, thực phẩm, thiết bị y tế…) vì phạm vi pilot là pickleball. Nguyên tắc "tuân thủ pháp luật + quyền gỡ" là điều khoản bao trùm — 🟠 trước public launch |
| **4. "giá mồi / khan hiếm giả / đánh giá giả"** | 🔵 | Cấm được viết ra, nhưng **không có cơ chế tự động phát hiện**. Cưỡng chế bằng kiểm duyệt thủ công và báo cáo |
| **5. Nghĩa vụ thông tin sản phẩm** | 🟢 + 🔵 | Trường dữ liệu có thật (title, category, condition, description, variants, SKU, price, stock, media). **Ba trạng thái tồn kho** là 🟢 — `product_set_in_stock` và "chưa cập nhật số lượng" tồn tại trong mô hình. "Phải khai khuyết điểm" là 🔵 — **không có trường riêng cho khuyết điểm**, nó nằm trong mô tả tự do |
| **6. Giá, phí, tồn kho** | 🟢 + 🔵 | Giá là `integer` VND — 🟢. "Không thu phí trong pilot" là 🔵, và câu "không phải cam kết vĩnh viễn" là điều khoản bảo vệ ThePickleHub, nên giữ |
| **7. Hình ảnh** | 🟢 | Toàn bộ mô tả kỹ thuật đúng và có bằng chứng: re-encode + loại EXIF/GPS/XMP (`shop-p2b-exif-pipeline-qa.mjs`, byte thật), kho nháp riêng tư, ảnh công khai chỉ sau publication commit |
| **7. "thu hồi bất đồng bộ ~10 phút"** | 🟢 🔴 | **Câu trung thực nhất trong văn bản, và là câu dễ bị đề nghị xoá nhất.** Nó mô tả đúng thiết kế: cơ sở dữ liệu ẩn ngay, tệp bị xoá theo hàng đợi. **Đề nghị giữ.** Xoá nó đi là hứa một sự tức thì mà hệ thống không có |
| **7. Quyền dùng ảnh** | 🟠 | Cấp quyền hẹp: hiển thị trong phạm vi dịch vụ, không lấy quyền sở hữu, không dùng cho quảng cáo. **Cần luật sư xem câu chữ** trước public launch |
| **8. Kênh liên hệ** | 🟢 | Mọi câu đều là CODE: `shop_contact_channels` với trạng thái duyệt, `shop_contact_value_is_safe`, sửa kênh đang sống → về `pending_review` (trigger), cảnh báo rời trang, **không** tự lấy email/phone tài khoản |
| **9. Thanh toán** | 🟢 🔴 | **Mục quan trọng nhất về mặt rủi ro.** Mọi câu "KHÔNG" đều đúng — không có mã thanh toán nào trong phạm vi Shop pilot. **Đề nghị không làm mềm bất kỳ câu nào** ở đây |
| **10. Giao hàng** | 🔵 | Không có tích hợp vận chuyển. Đây là nghĩa vụ của seller, cưỡng chế bằng kiểm duyệt |
| **11. Đổi trả và khiếu nại** | 🔵 🔴 | **Không có trường "chính sách đổi trả" trên `shops` hay `products`.** Quy chế yêu cầu seller công bố chính sách, nhưng chỗ duy nhất để viết là phần mô tả. Xem §Khoảng cách #1 |
| **12. Kiểm duyệt** | 🟢 | Sáu trạng thái khớp enum `product_status`. "Duyệt chưa phải là đang bán" và "mở lại để sửa cần đủ bốn bước" đều là CODE, có test (Q5) |
| **13. Báo cáo vi phạm** | 🔵 🔴 | **Chưa có nút báo cáo trên bề mặt Shop.** Xem §Khoảng cách #2 |
| **14. Dữ liệu cá nhân** | 🟢 + 🟠 | Danh sách thu/không thu đúng với schema. "Không lưu IP/fingerprint" là 🟢 — schema **cố ý không có cột**. "Ghi chú nội bộ không hiển thị cho seller" và "giá trị kênh không vào lịch sử" đều có assertion pgTAP. 🟠: đối chiếu với `src/pages/Privacy.tsx` trước khi ban hành |
| **15. Bảo mật và phân quyền** | 🟢 | Vai trò khớp `shop_member_role`; "support không đọc ảnh gốc" là migration `20260811170000`; "kiểm duyệt cần xác thực hai lớp" là `is_admin()` ⇒ AAL2 |
| **16. Giới hạn pilot** | 🟢 🔴 | **"Chưa có thông báo tự động" phải giữ nguyên** — nó là hệ quả trực tiếp của quyết định thông báo đã ký, và là điều người bán cần biết nhất trong cả văn bản. Câu "những giới hạn này không dùng để miễn trừ mọi trách nhiệm" là chủ ý: một điều khoản miễn trừ toàn phần là dark pattern |
| **17. Tạm ngừng và chấm dứt** | 🟢 + 🔵 | Nút có thật (`product_decide('suspend')`, `shops.state`). **Quy trình** thì là 🔵 — "nêu lý do và cho cơ hội sửa" là một cam kết vận hành, không phải một ràng buộc kỹ thuật |
| **18. Thay đổi quy chế** | 🟢 | Toàn bộ mục này là CODE: version bất biến (trigger), hash mới cho nội dung mới (cột GENERATED), không ghi lùi ngày (`effective_at` chặn), giữ acceptance cũ, cùng version không ký lại |
| **19. Liên hệ hỗ trợ** | 🔴 | Ba kênh **có thật trong repo** (`Privacy.tsx`/`Terms.tsx` và `ChatFAB.tsx`). Nhưng **cần quyết định**: dùng chung hay lập kênh riêng cho pilot? Xem §Câu hỏi #4 |
| **20. Hiệu lực và phê duyệt** | 🟢 | Năm điều kiện hiệu lực khớp đúng những gì migration cưỡng chế |

---

## Ba khoảng cách giữa văn bản và hệ thống

Văn bản **không** hứa gì hệ thống không làm. Nhưng nó **yêu cầu người bán** làm
ba việc mà hệ thống chưa có chỗ để làm cho tử tế. Đây là các khoảng cách thật,
không phải lỗi.

### #1 — Không có trường "chính sách đổi trả" (mục 11)

Quy chế yêu cầu seller **công bố chính sách đổi trả**. Chỗ duy nhất để viết là
phần mô tả sản phẩm hoặc phần giới thiệu shop.

Hệ quả: mỗi seller viết một kiểu, người mua phải đọc mô tả để tìm, và người kiểm
duyệt không có gì để kiểm.

| Lựa chọn | Chi phí |
|---|---|
| **A. Giữ nguyên** — chính sách nằm trong mô tả | 0. Chấp nhận sự không đồng nhất trong pilot |
| **B. Thêm trường `return_policy` trên `shops`** | Một migration + một ô nhập + hiển thị trên trang shop |

Khuyến nghị: **A cho pilot**, và ghi vào phần giới hạn. Với 3–5 seller, sự không
đồng nhất là quản lý được; một migration nữa thì kéo dài vòng phê duyệt.

### #2 — Không có nút báo cáo trên bề mặt Shop (mục 13)

Quy chế nói người mua và người bán "có thể báo cáo". Trên thực tế **không có nút
nào** trên trang sản phẩm hay trang shop. `content_reports` tồn tại cho diễn đàn
nhưng không nối vào sản phẩm.

Đường duy nhất đang có: các kênh liên hệ chung ở mục 19.

| Lựa chọn | Chi phí |
|---|---|
| **A. Viết rõ trong quy chế rằng báo cáo gửi qua kênh hỗ trợ ở mục 19** | 0, và trung thực |
| **B. Xây nút báo cáo** | Một migration + UI + hàng đợi cho admin |

Khuyến nghị: **A cho pilot.** Nếu chọn A, đề nghị **sửa mục 13** để nói rõ báo
cáo gửi qua kênh nào — hiện văn bản nói "có thể báo cáo" mà không nói bằng cách
nào, và đó là một khoảng trống người đọc sẽ vấp phải.

### #3 — Giới hạn số seller/sản phẩm không được cưỡng chế (mục 1)

Quy chế nói ThePickleHub "có thể giới hạn số người bán, số sản phẩm". Không có
ràng buộc kỹ thuật nào làm việc đó; nó được cưỡng chế bằng cách không thêm ai
vào danh sách và bằng kiểm duyệt.

Khuyến nghị: **giữ nguyên**. Câu này mô tả một quyền, không phải một cơ chế, và
quyền đó có thật.

---

## Bảy câu hỏi cần Product Owner quyết

| # | Câu hỏi | Vì sao không đoán được | Chặn hiệu lực? |
|---|---|---|---|
| 1 | **Toàn văn có được duyệt không**, và cần sửa chỗ nào | Đây là văn bản ràng buộc người thật | 🔴 **CÓ** |
| 2 | **`effective_at`** — ngày giờ hiệu lực | Không có mặc định đúng. Không được sớm hơn `approved_at` | 🔴 **CÓ** |
| 3 | **`approved_by`** — tên hiển thị trong bản ghi | Dự kiến `Cuong Nguyen — Product Owner`; cần xác nhận đúng chuỗi | 🔴 **CÓ** |
| 4 | **Kênh hỗ trợ (mục 19)** — dùng chung ba kênh hiện có, hay lập kênh riêng cho pilot | Quyết định vận hành | 🔴 **CÓ** — mục 19 không được mơ hồ ở bản hiệu lực |
| 5 | **Mục 13** — có sửa để nói rõ báo cáo gửi qua kênh nào không (§Khoảng cách #2) | Quyết định nội dung | 🟠 nên sửa |
| 6 | **Danh sách ngành hàng ở mục 3** — có khớp `product_categories` thực tế không | Danh sách trong văn bản phải khớp danh sách trong hệ thống | 🟠 kiểm trước khi ban hành |
| 7 | **Đối chiếu mục 14 với `src/pages/Privacy.tsx`** — hai văn bản có mâu thuẫn nhau chỗ nào không | Hai văn bản cùng nói về dữ liệu cá nhân | 🟠 nên kiểm |

---

## Năm câu đề nghị KHÔNG làm mềm

Nếu vòng chỉnh sửa đề nghị bỏ hoặc làm nhẹ một trong năm câu dưới đây, đề nghị
cân nhắc kỹ. Mỗi câu đang ngăn một hiểu nhầm cụ thể.

| Câu | Nó ngăn điều gì |
|---|---|
| Mục 2 — *"người bán trong chương trình này CHƯA được xác minh danh tính"* | Người mua tự suy ra một sự bảo đảm không tồn tại |
| Mục 7 — *"tệp ảnh công khai được thu hồi bất đồng bộ… người đang giữ đường dẫn có thể vẫn tải được"* | Hứa một sự tức thì hệ thống không có |
| Mục 9 — *"ThePickleHub không hoàn tiền, vì ThePickleHub chưa bao giờ nhận tiền"* | Kỳ vọng về một cơ chế bảo vệ giao dịch không tồn tại |
| Mục 16 — *"hệ thống không gửi email hay thông báo đẩy"* | Người bán ngồi chờ một thông báo sẽ không bao giờ đến |
| Mục 16 — *"những giới hạn trên không được dùng để miễn trừ trách nhiệm"* | Một điều khoản miễn trừ toàn phần — đúng định nghĩa dark pattern |

---

## Ba điều văn bản cố ý KHÔNG nói

Ghi ra để không ai coi là thiếu sót:

- **Không có thời hạn xử lý (SLA)** cho kiểm duyệt, cho báo cáo, hay cho hỗ trợ.
  Chỉ có **một** quản trị viên; một con số đặt ra bây giờ là một lời hứa suông.
- **Không có quy trình giải quyết tranh chấp.** ThePickleHub tiếp nhận báo cáo và
  có thể gỡ hàng — nó không phân xử ai đúng ai sai trong một giao dịch dân sự.
- **Không nhận đây là văn bản đã qua luật sư.** Trạng thái ghi rõ
  `Legal review: Required before public launch`.

---

## Checklist Product Owner

Agent **không** tick ô nào ở đây.

```
Đọc toàn văn seller-rules-v1.md

  [ ] PASS — duyệt nguyên văn
  [ ] REVISE — cần sửa, ghi rõ mục và câu:
      ____________________________________________________________
      ____________________________________________________________
  [ ] REJECT — lý do: _________________________________________

Bảy câu hỏi ở §Bảy câu hỏi:
  1. Toàn văn                     [ ] đã trả lời
  2. effective_at = ______________________
  3. approved_by  = ______________________
  4. Kênh hỗ trợ:  [ ] dùng chung 3 kênh hiện có  [ ] lập kênh riêng: __________
  5. Sửa mục 13 (cách báo cáo):   [ ] có  [ ] không
  6. Ngành hàng mục 3 khớp product_categories:  [ ] đã kiểm
  7. Mục 14 đối chiếu Privacy.tsx:              [ ] đã kiểm

Ba khoảng cách:
  #1 chính sách đổi trả:  [ ] A giữ nguyên   [ ] B thêm trường
  #2 nút báo cáo:         [ ] A qua kênh hỗ trợ  [ ] B xây nút
  #3 giới hạn số lượng:   [ ] giữ nguyên

Ký: ______________________   Ngày: ______________
```

**Chỉ khi ô PASS được đánh dấu** mới được: điền `approved_by` / `approved_at`,
chốt `effective_at`, tính mã băm trên **nội dung cuối**, và chuẩn bị bản ghi ban
hành. Tính hash trên bản DRAFT rồi coi đó là bản hiệu lực là đúng thứ quy trình
này tồn tại để ngăn.
