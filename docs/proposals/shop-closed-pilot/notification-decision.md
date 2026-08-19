# CP9 — Quyết định về thông báo

> ## ✅ ĐÃ QUYẾT — Product Owner, 2026-08-12
>
> **Closed pilot chấp nhận chưa có thông báo tự động**, kèm runbook liên lạc
> tay ở §5 và sáu điều kiện ở §1.1.
>
> Đây là **giới hạn đã chấp nhận cho pilot**, **không** phải giải pháp chung cho
> production.
>
> Nền: [`docs/proposals/shop-catalog-phase-2b/notification-contract.md`](../shop-catalog-phase-2b/notification-contract.md)
> — hợp đồng dữ liệu đã viết sẵn từ P2b.1, cố ý chưa nối vào đâu.

---

## 1. Quyết định

**Closed pilot chạy KHÔNG có thông báo tự động.** Người bán biết kết quả kiểm
duyệt khi họ mở `/seller/products` hoặc `/seller/application/status`; ngoài ra
người kiểm duyệt nhắn tay sau mỗi quyết định.

Đây là **giới hạn đã biết và chấp nhận**, không phải nợ kỹ thuật bị bỏ quên.

### 1.1 Sáu điều kiện đi kèm quyết định

Quyết định chỉ có hiệu lực khi cả sáu điều dưới đây đúng. Mất một điều là mất
quyết định, không phải một bất tiện.

| # | Điều kiện | Trạng thái hôm nay |
|---|---|---|
| 1 | Người bán **xem được trạng thái** trong dashboard của mình | ✅ `/seller/application/status`, `/seller/products`, `/seller/settings` — bảng ở §4 |
| 2 | Admin có **hàng đợi rõ ràng** | ✅ `/admin/shop/applications`, `/admin/shop/products`, `/admin/shop/contacts` |
| 3 | Có **runbook liên lạc tay** | ✅ §5 |
| 4 | Có **người chịu trách nhiệm kiểm hàng đợi hằng ngày** | ✅ **Cuong Nguyen**, kiểm hàng đợi **tối thiểu 2 lần/ngày** trong suốt closed pilot (Product Owner, 13/08) |
| 5 | UI **không được nói "đã gửi thông báo"** | ✅ §6, và không có bề mặt nào nói vậy |
| 6 | Giới hạn được ghi vào **pilot contract** | ✅ [`pilot-contract.md` §2 và §8](./pilot-contract.md) |

**Cả sáu điều kiện nay đã đủ.** Điều 4 — thứ duy nhất từng còn trống — là **tên
một con người**, không phải một hệ thống: **Cuong Nguyen, tối thiểu hai lần mỗi
ngày**. Với hạ tầng ở điều 1-3 nhưng không ai mở hàng đợi ra xem, pilot chạy mà
người bán không nhận được câu trả lời nào; nhịp hai lần một ngày là thứ quyết
định này đánh cược sẽ giữ được.

Nhịp đó cũng nằm trong quy chế (§16), nên người bán biết mình đang chờ cái gì —
và biết rằng **trang quản lý của họ là nguồn thông tin đúng**, không phải một tin
nhắn có thể bị lỡ.

---

## 2. Vì sao không dựng bây giờ

Bảng `notifications` của repo là **hộp thư người dùng**, không phải outbox:

```
notifications(user_id, type notification_type, entity_type follow_target_type,
              entity_id, related_id, title, message, is_read, created_at)
```

Hai vấn đề, cả hai đều không phải chuyện thẩm mỹ:

1. `type` và `entity_type` là **enum**. `entity_type` là `follow_target_type` —
   những thứ một người có thể theo dõi. Một sản phẩm đang chờ duyệt không nằm
   trong đó. Đưa kiểm duyệt Shop qua bảng này nghĩa là **nới hai enum toàn nền
   tảng để phục vụ một pilot kín**.
2. **Không có trạng thái gửi, không có bộ đếm lần thử, không có khoá chống trùng.**
   "Retry-safe và deduplicated" không diễn đạt được trong nó — một lần thử lại
   sẽ chèn dòng thứ hai và người bán đọc cùng một lời từ chối hai lần.

`notification-send` là một khung trả HTTP 200 và **không được gọi**.

Bắt vít ngữ nghĩa retry lên bảng hộp thư để phục vụ một tính năng pilot là kết
quả tệ hơn việc nói thẳng rằng chưa có.

---

## 3. Cái đã có thay thế

`product_moderation_events` và `shop_contact_moderation_events` mang **đủ mọi
thứ** một dispatcher cần, và được ghi **bên trong transaction quyết định**, nên
một thông báo không bao giờ mô tả được một quyết định chưa commit.

| Cột | Dùng làm gì |
|---|---|
| `product_id`, `shop_id` | báo cho ai, phân giải qua `shop_members` |
| `decision` | chọn nội dung |
| `from_status` → `to_status` | câu chữ, và liệu có phải đổi trạng thái thật không |
| `applicant_note` | văn bản người bán đọc, đã viết sẵn cho người bán |
| `requested_targets` | deep link — mục nào, biến thể/ảnh nào |
| `notify_key` UNIQUE | khoá chống trùng |

`notify_key` là `product:<id>:<decision>:<client_token>`. Vì dòng sự kiện được
ghi đúng một lần cho mỗi quyết định, **một dispatcher chạy lại không thể tạo ra
thông báo logic thứ hai** — tính chất đó là **cấu trúc**, không phải quy ước mà
một worker deploy lại có thể bất đồng ý.

Nghĩa là: khi nào Product Owner muốn thông báo, dữ liệu đã sẵn và đúng. Việc còn
lại là kênh gửi, không phải mô hình dữ liệu.

---

## 4. Người bán thực sự biết bằng cách nào, trong pilot

| Sự kiện | Người bán thấy ở đâu | Trong bao lâu |
|---|---|---|
| Hồ sơ được duyệt / từ chối / yêu cầu sửa | `/seller/application/status` | khi họ mở |
| Sản phẩm được duyệt / từ chối / yêu cầu sửa | `/seller/products` — huy hiệu trạng thái + ghi chú | khi họ mở |
| Kênh liên hệ được duyệt / bị chặn | `/seller/settings` | khi họ mở |
| Sản phẩm bị đình chỉ | `/seller/products` | khi họ mở |
| **Mọi thứ ở trên, kịp thời** | **tin nhắn tay của người kiểm duyệt** | theo runbook §5 |

Với 3–5 người bán mà Cuong liên lạc trực tiếp, đây là đủ. Với 50 người bán thì
không, và đó chính là ngưỡng ở §7.

---

## 5. Runbook liên lạc tay — bắt buộc nếu quyết định này được duyệt

Không phải gợi ý. Nếu không có thông báo tự động, đây **là** hệ thống thông báo.

### Sau mỗi quyết định kiểm duyệt

1. Ra quyết định trên `/admin/shop/products/:id` (hoặc `/applications/:id`,
   `/contacts`).
2. Sao chép **`applicant_note`** — đúng văn bản người bán sẽ thấy trong ứng dụng.
   Nhắn khác đi là tạo ra hai phiên bản của cùng một quyết định.
3. Nhắn cho người bán qua kênh đã hẹn (Zalo), gồm:
   - quyết định là gì,
   - link thẳng tới `/seller/products/<id>/edit` nếu cần sửa,
   - và **không gì khác** — xem danh sách cấm bên dưới.
4. Ghi vào sổ liên lạc: thời gian, người bán, quyết định, đã nhắn (có/không).

### Không bao giờ đưa vào tin nhắn

- `internal_note`, dưới bất kỳ hình thức nào;
- đường dẫn storage hay signed URL;
- giá trị kênh liên hệ thô;
- giấy tờ hay dữ liệu cá nhân của người bán;
- bất cứ thứ gì của người mua.

Đây là **cùng một danh sách cấm** mà một dispatcher sẽ phải tuân theo. Viết ra
bây giờ để khi tự động hoá đến, quy tắc đã được sống chứ không phải được phát
minh.

### Đo — con số quyết định lúc nào phải tự động hoá

Mỗi tuần ghi lại:

| Chỉ số | Vì sao |
|---|---|
| Số lần phải nhắn tay | Chi phí thật của quyết định này |
| Số lần **quên** nhắn | Chi phí thật với người bán |
| Thời gian trung bình từ quyết định → nhắn | Nếu > 24 giờ, "thông báo tay" trên thực tế là "không có thông báo" |
| Số lần người bán hỏi "hồ sơ tôi sao rồi?" | Mỗi câu hỏi là một thông báo lẽ ra đã tồn tại |

---

## 6. Điều quyết định này **không** cho phép

- ❌ Không được nói với người bán rằng họ "sẽ nhận được thông báo".
- ❌ Không được hiển thị UI gợi ý có thông báo (chuông, huy hiệu "1 mới") khi
  không có gì gửi.
- ❌ Không được ghi log hay báo cáo là "đã gửi thông báo" khi việc gửi là tay.
- ❌ Không được nối tạm vào bảng `notifications` "cho có".

---

## 7. Nếu Product Owner **không** chấp nhận

Thì dừng, và mở một scope riêng. **Không** bắt vít retry vào bảng
`notifications` hiện tại.

Scope tối thiểu đúng đắn, để ước lượng chứ không phải để làm ngay:

1. **Outbox bền** — bảng riêng có trạng thái gửi, số lần thử, backoff, và khoá
   chống trùng. Cặp claim/complete của `shop_media_cleanup_jobs` là tiền lệ đang
   chạy trong chính repo này và **đáng sao chép hơn là phát minh lại**.
2. **Một dispatcher** đọc `product_moderation_events` / `shop_contact_moderation_events`,
   phân giải người nhận từ `shop_members` **tại thời điểm gửi** (không phải từ
   danh sách lưu sẵn).
3. **Một kênh** — Product Owner chọn: hộp thư trong ứng dụng, email (Resend),
   push (FCM), hay tin Zalo. Nếu chọn hộp thư trong ứng dụng thì phải hoặc nới
   `notification_type`/`follow_target_type`, hoặc cho Shop bề mặt hộp thư riêng.
4. **Quy tắc: gửi thất bại KHÔNG BAO GIỜ rollback quyết định kiểm duyệt.**
5. Test: thử lại không tạo thông báo thứ hai · payload không chứa gì trong danh
   sách cấm ở §5 · người nhận phân giải đúng khi thành viên shop thay đổi giữa
   lúc quyết định và lúc gửi.

Ước lượng thô: đây là một phase, không phải một increment. Nó **không** thuộc
gói closed pilot.

---

## 8. Ô ký

```
Quyết định: closed pilot chạy KHÔNG có thông báo tự động, kèm runbook liên lạc
            tay ở §5 và sáu điều kiện ở §1.1.

[x] CHẤP NHẬN — Product Owner, 2026-08-12
[ ] KHÔNG CHẤP NHẬN — mở scope riêng theo §7, và pilot chờ

Điều kiện #4 đã điền: **Cuong Nguyen · tối thiểu 2 lần/ngày** (13/08).
```

**Hệ quả đã áp dụng:** không xây hạ tầng thông báo nào trong gói closed pilot.
`product_moderation_events` và `shop_contact_moderation_events` vẫn ghi đủ dữ
liệu một dispatcher cần, trong cùng transaction quyết định — nên khi Product
Owner muốn tự động hoá, việc còn lại là chọn kênh gửi, không phải làm lại mô
hình dữ liệu.

**Không còn điều kiện nào trống.** Quyết định này đã đủ cho Packet D.
