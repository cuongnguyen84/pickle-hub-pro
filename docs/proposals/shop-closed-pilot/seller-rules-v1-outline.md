# Quy chế người bán v1 — KHUNG

> # ⚠️ DRAFT — NOT LEGAL APPROVAL
>
> Tài liệu này là **khung để Product Owner hoặc người phụ trách pháp lý điền**.
> Nó **không** là văn bản pháp lý, **không** đã được duyệt, và **không** được
> hiển thị cho người bán ở dạng hiện tại.
>
> Agent cố ý **không** viết nội dung điều khoản. Một văn bản ràng buộc do máy
> soạn rồi để người bán thật ký là rủi ro pháp lý, không phải tiết kiệm công.
>
> Mỗi mục dưới đây có: **câu hỏi phải trả lời** · **vì sao nó tồn tại** ·
> **hệ quả kỹ thuật nếu trả lời cách này hay cách kia**.

---

## 0. Siêu dữ liệu văn bản — điền trước tiên

| Trường | Giá trị |
|---|---|
| `document_id` | `seller-rules` |
| `version` | `v1` |
| `effective_at` | ⬜ |
| Ngôn ngữ | ⬜ (khuyến nghị: tiếng Việt là bản gốc ràng buộc, EN là bản dịch tham khảo) |
| Người duyệt | ⬜ |
| Ngày duyệt | ⬜ |

---

## 1. Ai được bán

| # | Câu hỏi | Ghi chú kỹ thuật |
|---|---|---|
| 1.1 | Cá nhân, hộ kinh doanh, công ty — cả ba? | `shop_applications.seller_type` đã có CHECK cho đúng ba giá trị `ca-nhan`, `ho-kinh-doanh`, `cong-ty`. Bỏ một loại = sửa CHECK |
| 1.2 | Yêu cầu tuổi tối thiểu? | Không có trường tuổi; thêm = migration |
| 1.3 | Chỉ người ở Việt Nam? | `shop_applications.city` là text tự do, không có validation quốc gia |
| 1.4 | Một người được mở mấy shop? | Hiện: một hồ sơ **không kết thúc** mỗi người (partial unique index). Không có giới hạn số shop sau khi duyệt |

## 2. Hàng hoá

| # | Câu hỏi |
|---|---|
| 2.1 | Danh mục hàng **được phép** — chỉ đồ pickleball, hay rộng hơn? |
| 2.2 | Danh mục hàng **cấm** — hàng giả, hàng nhái thương hiệu, đồ điện tử không rõ nguồn, thực phẩm chức năng, vé, dịch vụ? |
| 2.3 | Hàng **đã qua sử dụng** có được bán không? |
| 2.4 | Nếu có: bắt buộc mô tả tình trạng ở mức nào? |

> Kỹ thuật: enum `product_condition` đã tồn tại. Taxonomy do nền tảng sở hữu
> (Q3) — người bán chọn, không tự tạo. Cấm một ngành hàng = vô hiệu hoá một
> category, và **vô hiệu hoá category không tự lưu trữ sản phẩm của ai** (Q3);
> phải gỡ sản phẩm bằng `product_decide('suspend')` riêng.

## 3. Thông tin sản phẩm

| # | Câu hỏi |
|---|---|
| 3.1 | Người bán chịu trách nhiệm đến đâu về tính chính xác? |
| 3.2 | Mô tả sai thì hậu quả là gì — sửa, gỡ, hay đình chỉ? |
| 3.3 | Có bắt buộc nêu xuất xứ / bảo hành không? |

## 4. Ảnh và quyền sử dụng

| # | Câu hỏi | Ghi chú kỹ thuật |
|---|---|---|
| 4.1 | Người bán cam kết ảnh là của mình hoặc có quyền dùng? | |
| 4.2 | ThePickleHub được dùng ảnh đó ở đâu — chỉ trên PDP, hay cả marketing? | Ảnh đã duyệt nằm ở bucket **public**, CDN cache 3600s |
| 4.3 | Người bán rời chương trình thì ảnh xử lý thế nào? | Kỹ thuật đã sẵn: `shop_media_revoke_product_renditions` + hàng đợi xoá |
| 4.4 | Ảnh chứa mặt người / logo bên thứ ba? | EXIF/GPS/XMP đã bị worker bóc; **khuôn mặt thì không** |

## 5. Giá

| # | Câu hỏi |
|---|---|
| 5.1 | Giá niêm yết đã gồm thuế chưa? |
| 5.2 | Giá hiển thị có ràng buộc người bán khi giao dịch ngoài nền tảng không? |
| 5.3 | Cấm giá mồi / giá giả để leo hạng? |

> Kỹ thuật: giá là `integer` VND, không dùng float. Không có lịch sử giá.

## 6. Tồn kho

| # | Câu hỏi |
|---|---|
| 6.1 | Người bán phải cập nhật tồn kho trong bao lâu sau khi bán hết? |
| 6.2 | Hết hàng mà vẫn để hiển thị thì sao? |

> Kỹ thuật: `inventory_movements` là sổ append-only. Không có tự động ẩn khi
> tồn = 0 — người bán tự đặt `product_set_in_stock`.

## 7. Liên hệ ngoài nền tảng

Đây là mục **quan trọng nhất của pilot**, vì toàn bộ giao dịch xảy ra ở đây.

| # | Câu hỏi | Ghi chú kỹ thuật |
|---|---|---|
| 7.1 | Kênh nào được phép — Zalo, Messenger, số điện thoại doanh nghiệp? | Cả ba đã có trong `shop_contact_type` |
| 7.2 | Kênh nào bị cấm? | Quy tắc hiện nằm trong hàm `shop_contact_value_is_safe`, **không** nằm trong văn bản người kiểm duyệt đọc được — xem §12 |
| 7.3 | Người bán có được đưa link ra sàn khác không? | |
| 7.4 | ThePickleHub chịu trách nhiệm gì với giao dịch xảy ra ngoài nền tảng? | Câu trả lời "không chịu trách nhiệm" phải nói bằng tiếng Việt rõ ràng ở PDP, không chỉ trong quy chế |

> Kỹ thuật đã bảo đảm: email tài khoản và số điện thoại tài khoản **không bao giờ**
> lộ mặc định; chỉ kênh người bán khai và admin duyệt mới hiển thị; URL đi ra
> **không mang PII người mua**.

## 8. Giao hàng · 9. Đổi trả · 10. Khiếu nại

| # | Câu hỏi |
|---|---|
| 8.1 | Người bán tự lo giao hàng hoàn toàn? |
| 8.2 | Có cam kết thời gian nào không? |
| 9.1 | Chính sách đổi trả do người bán tự đặt hay nền tảng đặt sàn tối thiểu? |
| 9.2 | Người bán có phải công bố chính sách đó trên trang shop không? |
| 10.1 | Người mua khiếu nại thì gửi đi đâu? |
| 10.2 | ThePickleHub xử lý trong bao lâu, bằng cách nào? |

> ⚠️ Pilot **không có** kênh hỗ trợ người mua và **không có** trường chính sách
> đổi trả trên `shops`. Nếu quy chế hứa một trong hai, phải có migration + UI
> trước khi mời người bán thật. Ghi rõ ở đây để lời hứa không đi trước sản phẩm.

## 11. Nội dung vi phạm

| # | Câu hỏi |
|---|---|
| 11.1 | Định nghĩa vi phạm (hàng cấm, hàng giả, nội dung khiêu dâm, phân biệt đối xử, spam)? |
| 11.2 | Ai báo cáo được — người mua, người bán khác, chỉ admin? |

> Kỹ thuật: **không có nút báo cáo cho người mua trên Shop.** Bảng
> `content_reports` tồn tại cho diễn đàn nhưng không nối vào sản phẩm.

## 12. Đình chỉ và gỡ sản phẩm

| # | Câu hỏi | Ghi chú kỹ thuật |
|---|---|---|
| 12.1 | Có báo trước không, hay gỡ ngay rồi thông báo? | Nút gỡ đã có: `product_decide('suspend')`. **Quy trình thì chưa** |
| 12.2 | Người bán khiếu nại quyết định gỡ bằng cách nào? | Q5 đã cho phép khôi phục + gửi lại; kênh khiếu nại thì chưa có |
| 12.3 | Bao nhiêu lần vi phạm thì đình chỉ cả shop? | `shops.state = 'suspended'` có sẵn |
| 12.4 | **Chính sách kênh liên hệ: cái gì duyệt, cái gì không** | 🔴 Hiện chỉ nằm trong code. Người kiểm duyệt cần một trang đọc được, không cần đọc SQL |

## 13. Dữ liệu cá nhân

| # | Câu hỏi |
|---|---|
| 13.1 | Thu thập gì: họ tên, số điện thoại, địa chỉ lấy hàng, thành phố. Đúng chưa? |
| 13.2 | Ai xem được? |
| 13.3 | Giữ bao lâu sau khi người bán rời chương trình? |
| 13.4 | Người bán yêu cầu xoá thì làm thế nào? |

> Kỹ thuật: `shop_applications` giữ `full_name`, `phone`, `pickup_address`,
> `city`. `internal_note` **không bao giờ** lộ cho người nộp (đọc qua view
> `my_shop_application`). Không có luồng xoá theo yêu cầu cho dữ liệu Shop.

## 14. Phí

| # | Câu hỏi |
|---|---|
| 14.1 | Pilot miễn phí hoàn toàn? |
| 14.2 | Nói rõ phí sẽ thay đổi trong tương lai như thế nào? |

## 15. Thanh toán ngoài nền tảng

| # | Câu hỏi |
|---|---|
| 15.1 | Ai chịu rủi ro khi người mua chuyển tiền rồi không nhận hàng? |
| 15.2 | ThePickleHub có làm trung gian không? (pilot: **không**) |
| 15.3 | Người bán có phải nói rõ điều đó với người mua không? |

## 16. Giới hạn trách nhiệm

⬜ Câu chữ do người phụ trách pháp lý viết. Không đề xuất mẫu.

## 17. Cách cập nhật quy chế

| # | Câu hỏi |
|---|---|
| 17.1 | Báo trước bao nhiêu ngày? |
| 17.2 | Đổi phiên bản có cần chấp thuận lại không? (xem §3 dưới) |
| 17.3 | Không chấp thuận bản mới thì shop bị gì? |

---

# Phần II — Thiết kế versioning và bằng chứng chấp thuận

> **ĐỀ XUẤT. Không có migration nào được áp trong đợt chuẩn bị này.**

## 3. Vì sao cần thiết kế này

Trạng thái hôm nay (kiểm tại chỗ, không suy đoán):

- `shop_applications` **không có** cột nào cho việc chấp thuận.
- `shop_application_submit()` xác thực 5 trường và **không** kiểm chấp thuận.
- Ô đồng ý ở `SellerApplication.tsx:426` là checkbox `disabled`, kèm dòng giải
  thích trung thực rằng văn bản chưa tồn tại.

⇒ **Ô đồng ý bị khoá nhưng việc gửi hồ sơ thì không.** Một người bán được duyệt
hôm nay sẽ không để lại bằng chứng chấp thuận nào.

## 4. Hình dạng đề xuất

Một bảng riêng, không phải cột trên `shop_applications`. Lý do: chấp thuận gắn
với **người**, không gắn với một hồ sơ; người bán sẽ phải chấp thuận lại khi
quy chế lên v2, kể cả khi họ không nộp hồ sơ mới.

```sql
-- ĐỀ XUẤT — chưa viết thành migration, chưa áp ở đâu.

CREATE TABLE public.legal_documents (
  document_id   TEXT NOT NULL,           -- 'seller-rules'
  version       TEXT NOT NULL,           -- 'v1'
  content_hash  TEXT NOT NULL,           -- sha256 của văn bản chuẩn hoá
  effective_at  TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (document_id, version)
);

CREATE TABLE public.legal_acceptances (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id   TEXT NOT NULL,
  version       TEXT NOT NULL,
  content_hash  TEXT NOT NULL,           -- SAO CHÉP tại thời điểm ký
  accepted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (document_id, version) REFERENCES public.legal_documents(document_id, version),
  UNIQUE (user_id, document_id, version)
);
```

Bốn quyết định thiết kế, mỗi cái có lý do:

1. **`content_hash` được sao chép vào dòng chấp thuận**, không chỉ tham chiếu.
   Nếu ai đó sửa văn bản tại chỗ mà không lên version, hash lệch sẽ tố cáo điều
   đó. Một tham chiếu thuần thì không.
2. **Không chấp thuận trước `effective_at`.** Cưỡng chế bằng CHECK trong RPC ghi,
   không bằng client:
   ```sql
   IF _doc.effective_at > now() THEN
     RAISE EXCEPTION 'document_not_yet_effective' USING ERRCODE = '22023';
   END IF;
   ```
3. **`UNIQUE (user_id, document_id, version)`** làm việc ký idempotent — bấm hai
   lần không tạo hai bằng chứng.
4. **Append-only.** Không `UPDATE`, không hard delete. Rút lại chấp thuận là một
   dòng mới ở bảng khác nếu cần, không phải xoá lịch sử.

## 5. IP / thiết bị — mặc định KHÔNG lưu

Không có cột `ip` hay `user_agent` trong đề xuất trên. Lưu chúng là thu thập dữ
liệu cá nhân mới, và **chỉ được làm nếu chính sách quyền riêng tư hiện tại cho
phép** — đó là câu hỏi cho người phụ trách pháp lý, không phải mặc định kỹ thuật.

Nếu Product Owner quyết định cần: thêm `ip inet` + `user_agent text`, và bổ sung
mục tương ứng vào §13 của quy chế **trước khi** thu thập, không phải sau.

## 6. Đổi version thì sao

Quyết định của Product Owner (§17.2), và mỗi lựa chọn có hình dạng kỹ thuật khác nhau:

| Nếu chọn | Kỹ thuật |
|---|---|
| Bản mới **cần** chấp thuận lại | RPC ghi kiểm `EXISTS (… WHERE version = <current>)`; thiếu ⇒ chặn hành động ghi tới khi ký |
| Bản mới **không** cần | Chỉ thêm dòng `legal_documents`; không đụng người bán cũ |
| Chỉ những thay đổi "trọng yếu" cần ký lại | Thêm `requires_reacceptance boolean` vào `legal_documents` — và ai đó phải quyết định "trọng yếu" nghĩa là gì, cho từng bản |

## 7. Chuỗi khi văn bản đã sẵn sàng

Theo thứ tự, không đảo:

1. Product Owner duyệt nội dung → văn bản có `effective_at`.
2. Migration tạo hai bảng + RPC `legal_accept(document_id, version)`.
3. Migration seed dòng `legal_documents` cho `seller-rules/v1` kèm hash thật.
4. `shop_application_submit()` thêm một kiểm tra: chưa ký ⇒
   `RAISE EXCEPTION 'seller_rules_not_accepted'`.
5. Bỏ `disabled` khỏi checkbox, nối vào `legal_accept`.
6. pgTAP: ký trước `effective_at` bị từ chối · ký hai lần chỉ một dòng · gửi hồ
   sơ khi chưa ký bị từ chối · hash lệch bị phát hiện.
7. **Chỉ khi đó** mới mời người bán thật.

Bước 4 là bước duy nhất thay đổi hành vi hiện có, và nó phải đi cùng bước 5 —
bật cưỡng chế trước khi ô đồng ý bấm được sẽ khoá tất cả mọi người ra ngoài.
