# Rà soát Quy chế người bán v1 — theo từng mục

> Đi kèm [`seller-rules-v1.md`](./seller-rules-v1.md), trạng thái
> `DRAFT — PENDING PRODUCT OWNER APPROVAL`.
>
> Mục đích: nói rõ **câu nào mô tả code đang chạy**, **câu nào là một quyết định
> sản phẩm**, và **câu nào cần luật sư** — để Product Owner đọc bản dự thảo mà
> biết mình đang duyệt cái gì.
>
> **Agent không tự tick PASS ở bất kỳ dòng nào.**
>
> ---
>
> ## Vòng 1 — Product Owner: **REVISE** (2026-08-13)
>
> Bảy câu hỏi: **bốn đã được trả lời**, ba còn lại là kiểm tra chứ không phải
> quyết định. Những gì đã sửa theo phản hồi:
>
> | # | Phản hồi | Đã sửa ở |
> |---|---|---|
> | 3 | Kênh hỗ trợ: **dùng chung** ba kênh sẵn có, nhưng **email là kênh chính thức**; Zalo/Messenger chỉ hỗ trợ thông thường | §19 viết lại thành bảng hai vai trò · §13 |
> | 4 | §13: nêu rõ email nhận báo cáo, kèm URL + mô tả + bằng chứng; **không** đòi mật khẩu/OTP/thẻ; **không** tuyên bố có nút Báo cáo | §13 viết lại |
> | 5 | §3 phải khớp taxonomy thật | §3 đổi từ danh sách ví dụ sang **bảng sáu ngành hàng đúng bằng database** |
> | 6 | §14 phải phân biệt dữ liệu công khai và nội bộ, không làm yếu Chính sách bảo mật | §14 thêm bảng hai nhóm + mục quan hệ với Chính sách bảo mật |
> | 7 | Chính sách đổi trả: kiểm lại `return_note` trước khi kết luận | 🔴 **Khoảng cách #1 SAI — đã sửa.** `shops.return_note` **có sẵn và đi xuyên suốt.** §11 nay chỉ thẳng vào ô đó |
> | 8 | Giới hạn pilot: phân biệt vận hành thủ công và kỹ thuật | §1 nói rõ giới hạn thực hiện bằng quy trình, **không** phải hạn mức kỹ thuật |
> | 10 | Kiểm duyệt: Cuong Nguyen, **tối thiểu 2 lần/ngày** | §16 ghi nhịp; `notification-decision.md` và `pilot-contract.md` cập nhật |
>
> `approved_by` dự kiến: **`Cuong Nguyen — Product Owner, ThePickleHub`** —
> **metadata dự kiến**, chưa ghi vào bản ghi văn bản.
>
> **Vẫn chưa duyệt.** Chưa tính hash, chưa đặt `effective_at`, chưa ban hành.

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
| **1. Mục đích và phạm vi** | 🟢 + 🔵 | "Chỉ người trong danh sách" và "không lập chỉ mục" là **CODE**: `shop_pilot_has_access()` gác mọi ghi; `X-Robots-Tag` đặt ở edge, 116 assertion. ✅ Giới hạn số lượng nay được nói rõ là **vận hành thủ công, không phải hạn mức kỹ thuật** |
| **2. Điều kiện trở thành người bán** | 🟢 | Cả 5 điều kiện đều cưỡng chế được: allowlist, hồ sơ, duyệt của admin, và **chấp thuận đúng version/hash** (migration `20260814090000`). "Không chuyển nhượng shop" là 🔵 — chưa có cơ chế chuyển chủ, nên không có gì để vi phạm về mặt kỹ thuật |
| **2. "chưa được xác minh danh tính"** | 🟢 🔴 | **Đúng và quan trọng.** Pilot không thu CCCD/ngân hàng. Câu này phải **giữ nguyên, không làm nhẹ đi** — bỏ nó đi là để người mua tự suy ra một sự bảo đảm không tồn tại |
| **3. Hàng hoá được phép** | 🟢 | ✅ **Đã đối chiếu.** Sáu ngành hàng trong văn bản khớp **đúng** sáu dòng seed `product_categories` (migration `20260811120000`). Taxonomy do nền tảng sở hữu là CODE (Q3). Xem §Đối chiếu taxonomy |
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
| **11. Đổi trả và khiếu nại** | 🟢 | ✅ **Đã sửa.** `shops.return_note` (≤600 ký tự) tồn tại và đi xuyên suốt từ ô nhập tới trang shop và PDP. §11 nay chỉ thẳng vào nó. Xem §Khoảng cách #1 |
| **12. Kiểm duyệt** | 🟢 | Sáu trạng thái khớp enum `product_status`. "Duyệt chưa phải là đang bán" và "mở lại để sửa cần đủ bốn bước" đều là CODE, có test (Q5) |
| **13. Báo cáo vi phạm** | 🟢 + 🔵 | ✅ **Đã sửa.** §13 nêu email chính thức, gửi gì, **không** gửi gì (mật khẩu/OTP/thẻ), và nói thẳng rằng **chưa có nút Báo cáo**. Nút vào backlog hậu pilot |
| **14. Dữ liệu cá nhân** | 🟢 + 🟠 | Danh sách thu/không thu đúng với schema; "không lưu IP/fingerprint" là 🟢 (schema **cố ý không có cột**). ✅ Thêm bảng **công khai vs nội bộ** và mục quan hệ với Chính sách bảo mật. 🟠 **còn một quyết định**: Chính sách bảo mật chưa nêu tên dữ liệu Shop — xem §Đối chiếu Privacy |
| **15. Bảo mật và phân quyền** | 🟢 | Vai trò khớp `shop_member_role`; "support không đọc ảnh gốc" là migration `20260811170000`; "kiểm duyệt cần xác thực hai lớp" là `is_admin()` ⇒ AAL2 |
| **16. Giới hạn pilot** | 🟢 🔴 | **"Chưa có thông báo tự động" phải giữ nguyên** — nó là hệ quả trực tiếp của quyết định thông báo đã ký, và là điều người bán cần biết nhất trong cả văn bản. Câu "những giới hạn này không dùng để miễn trừ mọi trách nhiệm" là chủ ý: một điều khoản miễn trừ toàn phần là dark pattern |
| **17. Tạm ngừng và chấm dứt** | 🟢 + 🔵 | Nút có thật (`product_decide('suspend')`, `shops.state`). **Quy trình** thì là 🔵 — "nêu lý do và cho cơ hội sửa" là một cam kết vận hành, không phải một ràng buộc kỹ thuật |
| **18. Thay đổi quy chế** | 🟢 | Toàn bộ mục này là CODE: version bất biến (trigger), hash mới cho nội dung mới (cột GENERATED), không ghi lùi ngày (`effective_at` chặn), giữ acceptance cũ, cùng version không ký lại |
| **19. Liên hệ hỗ trợ** | 🟢 | ✅ **Đã quyết:** dùng chung ba kênh có thật trong repo, **email là kênh chính thức**, Zalo/Messenger chỉ hỗ trợ thông thường. §19 viết lại thành bảng hai vai trò |
| **20. Hiệu lực và phê duyệt** | 🟢 | Năm điều kiện hiệu lực khớp đúng những gì migration cưỡng chế |

---

## Ba khoảng cách giữa văn bản và hệ thống

Văn bản **không** hứa gì hệ thống không làm. Nhưng nó **yêu cầu người bán** làm
ba việc mà hệ thống chưa có chỗ để làm cho tử tế. Đây là các khoảng cách thật,
không phải lỗi.

### ~~#1 — Không có trường "chính sách đổi trả"~~ 🔴 **SAI — đã sửa**

**Trường đã tồn tại và đi xuyên suốt.** Kết luận trước đó là một khẳng định
không kiểm, và Product Owner yêu cầu kiểm lại trước khi kết luận — đúng.

`shops.return_note TEXT` (≤ 600 ký tự), thêm ở migration
`20260811180000_shop_profile.sql`. Đường dữ liệu đầy đủ:

| Chặng | Bằng chứng |
|---|---|
| Ghi | `shop_profile_update` nhận `return_note` trong patch |
| Nhập | `SellerShopSettings.tsx` — nhãn "Chính sách đổi trả", giới hạn 600 ký tự |
| Xem trước | `ProductPreview.tsx` — "Đổi trả: …" |
| Kiểm duyệt | mục tiêu yêu-cầu-sửa `{section:'shipping', field:'return_note'}` |
| Công khai — trang shop | `ShopStore.tsx` — `<dt>Đổi trả</dt>` |
| Công khai — trang sản phẩm | `ProductDetail.tsx` — `tl-pdp-note` |
| Projection | `shop_public_shop`, `product_public_projection`, lịch sử slug |

**Không có wiring gap.** §11 nay chỉ thẳng vào ô đó, kèm giới hạn 600 ký tự và
nơi người mua nhìn thấy nó. **Không tạo đường dữ liệu mới.**

### #2 — Không có nút báo cáo trên bề mặt Shop ✅ **đã xử lý bằng câu chữ**

Vẫn **không có nút nào** trên trang sản phẩm hay trang shop; `content_reports`
tồn tại cho diễn đàn nhưng không nối vào sản phẩm. Đó là sự thật và §13 nay nói
thẳng ra thay vì để người đọc đi tìm.

Product Owner chọn **A**: báo cáo gửi qua `tapickleballvn@gmail.com`, và §13 nói
rõ gửi gì, không gửi gì (mật khẩu/OTP/thẻ), và rằng Zalo/Messenger **không phải**
kênh khiếu nại chính thức.

**Nút Báo cáo vào backlog hậu pilot — không phải blocker của closed pilot.**

### #3 — Giới hạn số seller/sản phẩm không được cưỡng chế (mục 1) ✅ **đã nói rõ**

Không có ràng buộc kỹ thuật nào; giới hạn được thực hiện bằng danh sách mời và
bằng kiểm duyệt. Điều khoản **giữ lại** — quyền đó có thật — nhưng §1 nay phân
biệt tường minh **giới hạn vận hành** với **hạn mức kỹ thuật**, và không con số
nào được mô tả như thể hệ thống tự chặn.

**Không thêm hệ thống quota trong checkpoint này.**

---

## Bảy câu hỏi — trạng thái sau vòng 1

| # | Câu hỏi | Trả lời | Chặn hiệu lực? |
|---|---|---|---|
| 1 | **Toàn văn có được duyệt không** | 🔴 **REVISE** — đã sửa theo phản hồi; **chờ duyệt lần cuối** | 🔴 **CÒN CHẶN** |
| 2 | **`effective_at`** | ⏳ Chưa đặt, có chủ đích. Sau khi APPROVE, đề xuất **00:00:00 giờ Việt Nam của ngày kế tiếp**; timestamp ISO chính xác sẽ được báo lại **trước** khi tạo bản approved | 🔴 **CÒN CHẶN** |
| 3 | **`approved_by`** | ✅ Dự kiến `Cuong Nguyen — Product Owner, ThePickleHub` — **metadata dự kiến**, chưa ghi vào bản ghi | ghi cùng lúc với #1 |
| 4 | **Kênh hỗ trợ (mục 19)** | ✅ **Dùng chung ba kênh sẵn có.** Email = kênh chính thức; Zalo/Messenger = hỗ trợ thông thường. **Không tạo kênh mới** | ✅ đã gỡ |
| 5 | **Mục 13 — cách báo cáo** | ✅ Đã viết rõ: email, kèm URL + mô tả + bằng chứng; không đòi mật khẩu/OTP/thẻ; nói thẳng là chưa có nút Báo cáo | ✅ đã gỡ |
| 6 | **Ngành hàng mục 3** | ✅ Đã đối chiếu với `product_categories`; văn bản thu hẹp cho khớp | ✅ đã gỡ |
| 7 | **Đối chiếu mục 14 với Privacy** | ⚠️ Đã đối chiếu và đã thêm phần quan hệ giữa hai văn bản. **Còn một quyết định cho Product Owner** — xem §Đối chiếu Privacy | 🟠 không chặn pilot |

### Ngày hiệu lực — không tự suy đoán

Quy tắc đã ghi: **không dùng thời điểm trong quá khứ** và **không tự suy đoán
ngày phê duyệt**. Vì vậy `effective_at` **để trống** cho tới khi có APPROVE.

Khi có APPROVE, agent sẽ báo lại một timestamp ISO 8601 chính xác dạng
`YYYY-MM-DDT00:00:00+07:00` — tính từ **ngày APPROVE thực tế**, không phải từ một
ngày đoán trước — và chờ xác nhận trước khi tạo bản ghi.

Ràng buộc `legal_documents_no_backdate` cũng từ chối mọi `effective_at` sớm hơn
`approved_at` ở tầng cơ sở dữ liệu, nên một lần đặt nhầm sẽ bị chặn chứ không
lọt.

---

## Đối chiếu taxonomy — §3 với database

Nguồn: `supabase/migrations/20260811120000_shop_phase2a_catalog.sql`, seed
`product_categories` (6 dòng, `is_active` mặc định true).

| Trong dự thảo (bản đầu) | Trong hệ thống (`slug` — `name_vi`) | Kết luận |
|---|---|---|
| vợt | `vot` — Vợt pickleball | ✅ **giữ** |
| bóng | `bong` — Bóng | ✅ **giữ** |
| giày | `giay` — Giày | ✅ **giữ** |
| túi đựng | `tui-balo` — Túi & balo | ✏️ **sửa** — dùng đúng tên "Túi & balo" (gồm cả balo, dự thảo cũ hẹp hơn) |
| quần áo thi đấu và tập luyện | `trang-phuc` — Trang phục | ✅ **giữ**, dùng đúng tên ngành hàng |
| phụ kiện: cán quấn, băng bảo vệ | `grip-phu-kien` — Grip & phụ kiện | ✅ **giữ** |
| phụ kiện: **lưới, phụ kiện sân** | *(không có ngành hàng nào)* | ❌ **BỎ** — rộng hơn database |

**Kết quả:** dự thảo cũ **rộng hơn** database ở đúng một chỗ (lưới và thiết bị
sân). Đã sửa theo database: §3 nay là **bảng sáu ngành hàng**, nói rõ đây là
*toàn bộ* danh sách chứ không phải ví dụ, và nêu tên những thứ **không** thuộc
phạm vi.

**Không thêm category nào vào migration trong checkpoint này.**

---

## Đối chiếu Privacy — §14 với `src/pages/Privacy.tsx`

Nguồn: `src/pages/Privacy.tsx` (render từ từ điển i18n `privacy.*`,
`src/i18n/vi.ts`).

| §14 quy chế nói | Chính sách bảo mật hiện nói | Khác biệt | Xử lý |
|---|---|---|---|
| Thu **email, tên hiển thị, ảnh đại diện** | ✅ có, liệt kê đúng | không | — |
| Thu **hồ sơ đăng ký người bán**: họ tên, SĐT, tên shop, địa chỉ lấy hàng, tỉnh/thành | ❌ **không nêu tên** — mục thu thập chỉ có email/tên/avatar/dữ liệu giải đấu-video-livestream | Shop thêm loại dữ liệu mới mà Chính sách bảo mật chưa nhắc | §14 mô tả **đúng implementation**; thêm mục nói rõ Chính sách bảo mật vẫn có hiệu lực đầy đủ và **thắng khi mâu thuẫn**. 🟠 **Đề xuất Product Owner:** bổ sung dữ liệu Shop vào Chính sách bảo mật trước khi mời người bán thật |
| Thu **kênh liên hệ công khai** do seller khai | ❌ không nêu | như trên | như trên; §14 nói rõ đây là **seller chủ động công bố**, không phải ThePickleHub chia sẻ dữ liệu cho bên thứ ba |
| Thu **bằng chứng chấp thuận quy chế** | ❌ không nêu | như trên | như trên |
| **Không** lưu IP / dấu vết thiết bị | không nhắc tới | quy chế **chặt hơn** | ✅ giữ — chặt hơn thì không mâu thuẫn |
| **Không** thu CCCD / ngân hàng / payout | không nhắc tới | quy chế **chặt hơn** | ✅ giữ |
| "Không bán hoặc chia sẻ dữ liệu cho bên thứ ba" | ✅ cam kết hiện có | quy chế **không** làm yếu | ✅ §14 nói rõ kênh liên hệ công khai là do seller chọn công bố, không phải một hành vi chia sẻ |
| Quyền xem / sửa / dừng dịch vụ | ✅ cam kết hiện có | quy chế không đụng | ✅ không làm yếu |

### Kết luận

- Quy chế **không tuyên bố** thu thập bất kỳ loại dữ liệu nào không có trong
  implementation.
- Quy chế **không làm yếu** bất kỳ cam kết nào của Chính sách bảo mật.
- **`Privacy.tsx` KHÔNG bị sửa trong checkpoint này** — đúng chỉ thị: chỉ sửa
  nếu thật sự cần, và đây là chỗ cần một quyết định chứ không phải một lần sửa
  câu chữ.

🟠 **Đề xuất chờ Product Owner:** trước khi mời người bán thật, bổ sung vào
Chính sách bảo mật một mục ngắn nêu tên ba loại dữ liệu Shop (hồ sơ đăng ký
người bán, kênh liên hệ công khai, bằng chứng chấp thuận). Không chặn việc dựng
hạ tầng hay chạy smoke bằng tài khoản test.

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

## Checklist Product Owner — vòng 2

Agent **không** tick ô nào ở đây.

```
Vòng 1: REVISE (13/08). Bảy sửa đổi đã thực hiện — xem đầu tài liệu.

Đọc lại seller-rules-v1.md sau khi sửa:

  [ ] APPROVE — duyệt bản này
  [ ] REVISE  — còn cần sửa, ghi rõ mục và câu:
      ____________________________________________________________
  [ ] REJECT  — lý do: ________________________________________

Nếu APPROVE, ba thứ đi kèm:
  approved_by  = Cuong Nguyen — Product Owner, ThePickleHub   [ ] đúng chuỗi
  effective_at = agent sẽ báo ISO 8601 (+07:00) tính từ NGÀY APPROVE THẬT,
                 và chờ xác nhận trước khi tạo bản ghi          [ ] hiểu
  content hash = chỉ tính SAU khi APPROVE, trên nội dung cuối   [ ] hiểu

Một đề xuất không chặn pilot:
  [ ] Bổ sung dữ liệu Shop vào Privacy.tsx trước khi mời người bán thật
      (§Đối chiếu Privacy) — [ ] đồng ý  [ ] để sau  [ ] không cần

Ký: ______________________   Ngày: ______________
```

**Chỉ khi ô APPROVE được đánh dấu** mới được: điền `approved_by`/`approved_at`,
chốt `effective_at`, tính mã băm trên **nội dung cuối**, và chuẩn bị bản ghi ban
hành. Tính hash trên bản DRAFT rồi coi đó là bản hiệu lực là đúng thứ quy trình
này tồn tại để ngăn.
