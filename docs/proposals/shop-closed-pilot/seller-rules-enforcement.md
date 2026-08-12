# CP12 — Cưỡng chế chấp thuận quy chế người bán

> **Blocker B5 ĐÃ ĐÓNG.** Product Owner quyết định 2026-08-12 #5: *seller
> application không được submit nếu server chưa xác minh acceptance của "Quy chế
> người bán v1".*
>
> **B4 vẫn mở** — văn bản chưa tồn tại — và giờ nó là một **cánh cửa đóng** chứ
> không phải một lời nhắc.

---

## 1. Điều gì đúng trước hôm nay

Kiểm tại chỗ, không suy đoán:

- `shop_applications` **không có** cột nào cho `rules_version`, `accepted_at`,
  `content_hash`.
- `shop_application_submit()` xác thực 5 trường và **không** kiểm chấp thuận.
- Ô đồng ý ở `SellerApplication.tsx` là `<input type="checkbox" disabled>` kèm
  một dòng giải thích trung thực rằng văn bản chưa tồn tại.

⇒ **Ô đồng ý bị khoá, việc gửi hồ sơ thì không.** Một người bán được duyệt hôm
qua không để lại bằng chứng chấp thuận điều khoản nào.

Không ai từng viết rằng nó chặn. **Niềm tin rằng nó chặn mới là thứ nguy hiểm.**

---

## 2. Mô hình

### `legal_documents` — một phiên bản, bất biến

| Cột | Ghi chú |
|---|---|
| `document_key` + `version` | khoá chính; `seller-rules` là key đầu tiên |
| `title`, `body` | toàn văn, lưu **một lần** |
| `content_hash` | **GENERATED** `sha256(body)` — không ai ghi được |
| `effective_at` | có thể ở tương lai |
| `retired_at` | đặt một lần, không gỡ lại |

**Bất biến bằng trigger:** `document_key`, `version`, `title`, `body`,
`effective_at`, `created_at` không đổi được sau khi ghi; chỉ `retired_at` đi
được từ `NULL` sang một giá trị, một lần. Xoá một phiên bản đã có người ký bị
từ chối.

Vì sao `content_hash` là GENERATED chứ không phải một cột người ta ghi: nó
**không thể mâu thuẫn** với văn bản nó tuyên bố băm. Sửa nội dung tại chỗ sẽ đổi
hash và làm mọi chữ ký cũ hết khớp — đó chính là chuông báo ta muốn, và là lý do
trigger cấm hẳn việc sửa.

### `legal_acceptances` — một chữ ký

| Cột | Ghi chú |
|---|---|
| `user_id`, `document_key`, `version` | UNIQUE — một chữ ký mỗi phiên bản |
| `content_hash` | **sao chép từ máy chủ** tại thời điểm ký |
| `application_id` | **bằng chứng, không phải khoá** — nullable, `ON DELETE SET NULL` |
| `accepted_at` | `now()` của máy chủ |
| `client_token` | idempotency cho một lần thử lại |

Sao chép hash thay vì chỉ tham chiếu là thứ làm cho một lần sửa tại chỗ **nhìn
thấy được**: tham chiếu sẽ âm thầm đi theo văn bản mới, bản sao thì không.

**Không có IP, không có device fingerprint.** Cả hai là dữ liệu cá nhân mới và
cần một quyết định về quyền riêng tư chưa ai đưa ra. Schema **không có chỗ** để
đặt chúng, nên không ai bắt đầu thu thập vì vô ý.

---

## 3. Ba chỗ một client không thể nói dối

1. **Không có tham số nào cho "ai" hay "khi nào".** `legal_accept()` nhận đúng
   `(document_key, version, content_hash, client_token)`. `user_id` lấy từ
   `auth.uid()`, `accepted_at` từ đồng hồ transaction, `content_hash` từ **bản
   sao của máy chủ**. Hai tham số đầu tồn tại **để bị từ chối**, không phải để
   được lưu.
2. **Không có policy INSERT trên `legal_acceptances`.** RPC `SECURITY DEFINER`
   là người ghi duy nhất. Người bán không tự ký bằng một `INSERT`, và **admin
   không ký hộ người bán được** — không có đường nào cả.
3. **Cổng nằm TRONG `shop_application_submit()`.** Không phải trong một wrapper,
   không phải ở client, không phải một trigger trên bảng khác. Một script POST
   thẳng vào `/rest/v1/rpc/shop_application_submit` gặp đúng cái kiểm đó, vì nó
   **là** cái submit.

---

## 4. Bất biến của submit

`shop_application_submit(_expected_rules_version TEXT DEFAULT NULL)` từ chối khi:

| Trường hợp | Mã |
|---|---|
| Không có phiên bản nào đang hiệu lực | `seller_rules_not_published` (P0002) |
| Client trình bày một phiên bản khác bản đang hiệu lực | `seller_rules_version_changed` (PT409) |
| Người gọi chưa ký bản đang hiệu lực | `seller_rules_not_accepted` (23514) |
| Chữ ký khớp version nhưng **lệch hash** | như trên |

Và `legal_accept()` từ chối khi: chưa có bản hiệu lực · phiên bản đã thu hồi ·
phiên bản chưa tới hạn · hash không khớp · chưa đăng nhập.

### Ký lại hay không

| Tình huống | Kết quả |
|---|---|
| Gửi lại sau khi bị yêu cầu sửa, **cùng** phiên bản | **không** cần ký lại |
| Một phiên bản mới đã hiệu lực | **bắt buộc** ký lại — cổng đóng lại tự động, vì submit luôn so với bản *đang hiệu lực* |
| Ký lại bản cũ để lách | bị từ chối — chỉ bản đang hiệu lực ký được |

Không có cấu hình nào cho việc này: nó là hệ quả của việc so với "bản đang hiệu
lực" thay vì "bất kỳ chữ ký nào".

---

## 5. Biên lai của người kiểm duyệt

`shop_application_rules_receipt(_application_id)` trả lời **"họ có chấp thuận
bản đang hiệu lực không"**, không phải "họ đã ký gì gần nhất".

Hai câu đó khác nhau, và sự khác nhau là trường hợp đáng nhìn: một chữ ký v1 sau
khi v2 có hiệu lực **không phải** là chấp thuận, và một dấu tích xanh trên nó là
một lời nói dối người kiểm duyệt lặp lại. Khi lệch, biên lai trả
`reason: "stale_version"` kèm bản họ **đã** ký — người kiểm duyệt thấy sự lệch
chứ không thấy một khoảng trống.

Chỉ chủ hồ sơ và admin (aal2) đọc được. Người bán khác: `42501`. Công khai:
không có grant.

---

## 6. Màn hình

Bốn trạng thái, nói bằng lời:

| | |
|---|---|
| **Đang tải** | **chưa có checkbox nào tồn tại** — một dấu tích trên ô rỗng là chấp thuận một thứ không có |
| **Đã ghi nhận** | đọc từ máy chủ, nên **refresh cho ra sự thật** chứ không phải một cờ cục bộ nhớ hộ |
| **Chưa ghi nhận được** | ghi hỏng thì **bỏ tích** và mời thử lại. Không bao giờ nói "đã ký" khi lệnh ghi ném lỗi |
| **Chưa ban hành** | phân biệt với "không tải được": một cái là mạng, đáng thử lại; cái kia là văn bản chưa ai viết |

Toàn văn hiển thị **tại chỗ**, không phải một đường link. Link tới một văn bản
người ta phải đi tìm là cách "tôi đã đọc" trở thành không đúng.

**Đua phiên bản:** một biểu mẫu có thể mở qua một lần đổi phiên bản, và cả dấu
tích lẫn trạng thái cục bộ đều sống sót. Nên phiên bản đang cầm được so với
phiên bản đang hiệu lực ở mọi lần render; lệch thì **rút lại chấp thuận** và mời
đọc bản mới. Đó là câu trả lời máy chủ sẽ đưa ra — chỉ là đến **trước** khi
người ta bấm một nút họ được bảo là sẽ chạy.

Nút gửi bị khoá cho tới khi máy chủ xác nhận chữ ký. Khoá, không giấu, và không
tin: RPC từ chối bất kể. Nó ở đó để không ai được mời bấm một thứ sẽ từ chối.

---

## 7. Bằng chứng

| Tầng | Số | Ghi chú |
|---|---|---|
| pgTAP — `shop_seller_rules_acceptance.test.sql` | **58** | mọi cách ký sai, ký lại, bất biến, biên lai, AAL2 |
| pgTAP — `shop_phase1_rls.test.sql` | +3 | "A gửi được hồ sơ" nay có nghĩa gì |
| HTTP integration — `shop-seller-rules-integration.test.mjs` | **11** | JWT thật, qua PostgREST |
| Component — `SellerRulesAcceptance.test.tsx` | **10** | bốn trạng thái, đua phiên bản, khôi phục sau refresh |
| Parity — `shop-schema-parity.test.ts` | +11 | cổng nằm đúng chỗ, không seed văn bản, không thu IP |

### Red-before-green — phá đúng call site production

Xoá đoạn kiểm chấp thuận khỏi `shop_application_submit()` trên cơ sở dữ liệu
đang chạy, không đụng gì khác:

```
✖ 9  không có quy chế ⇒ không ai gửi được
✖ 16 bốn lần ký hỏng không mở được cổng
✖ 27 B chưa ký — chữ ký của A không giúp B
✖ 29 gọi thẳng RPC, không có UI, vẫn gặp cùng cái kiểm
✖ 30 biểu mẫu trình bày phiên bản cũ bị từ chối
✖ 34 phiên bản mới đóng lại cổng với người chỉ ký v1
```

Sáu assertion đỏ, gồm cả cái về gọi thẳng RPC. Test bảo vệ **chỗ nối**, không
chỉ bảo vệ hàm.

### Hai defect bộ test bắt được

**Thiếu grant `service_role` trên `legal_documents`.** Lần chạy đầu của bộ HTTP
integration trả `42501` kèm gợi ý nêu đúng câu `GRANT` còn thiếu. `service_role`
đi vòng qua RLS nhưng **không** đi vòng qua tầng grant; repo này đã có hai đợt
quét cho đúng lớp lỗi đó, và cả pgTAP lẫn typechecker đều không thấy nó — chỉ
thứ nói chuyện với PostgREST theo cách một client nói mới thấy.

**Trigger append-only làm không xoá được hồ sơ.** `application_id` là
`ON DELETE SET NULL`, nên xoá một hồ sơ khiến Postgres UPDATE dòng chữ ký để gỡ
con trỏ — và trigger từ chối. Mọi `DELETE FROM shop_applications` sẽ hỏng. Chỉ
lượt chạy trình duyệt — thứ duy nhất **hạ một fixture thật** — gặp được: pgTAP
khẳng định trong một transaction nó rollback, nên không bao giờ xoá hồ sơ nào.
Trigger giờ cho đúng **một** UPDATE: `application_id` từ có giá trị sang `NULL`,
mọi cột khác y nguyên.

---

## 8. Còn thiếu: B4

Máy chủ đã sẵn sàng; **văn bản thì chưa**.

`legal_current_document('seller-rules')` không trả gì, nên **mọi lần gửi hồ sơ
thất bại với `seller_rules_not_published`** — kể cả của Cuong. Đó là hành vi
đúng và có chủ đích: migration **cố ý không seed** văn bản nào.

> Một placeholder mà người bán thật có thể ký còn tệ hơn một bảng rỗng: bảng
> rỗng chặn việc gửi, placeholder thì không.

Khung để Product Owner/pháp lý điền:
[`seller-rules-v1-outline.md`](./seller-rules-v1-outline.md).

Ban hành khi đã có nội dung — ba dòng SQL, ở
[`approval-packets/packet-d-pilot-activation.md` §4](./approval-packets/packet-d-pilot-activation.md).

Văn bản dùng cho test cục bộ nằm trong `scripts/qa/p2b-seed.mjs`, tiêu đề bắt
đầu bằng `[TEST-ONLY]` để một bản sao xuất hiện ở môi trường thật **tự tố cáo**,
và nó **không bao giờ** đi qua một migration nên nó không di chuyển được.
