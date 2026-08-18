# Nghiệm thu Shop Phase 4 — 29 case

> main `fc6d7044` (PR #615 đã merge) · 18/08/2026
> Bản tick được trên điện thoại: https://claude.ai/code/artifact/d6b5e402-3a8a-4d6a-97ae-b3458f0a65eb
> Bối cảnh đầy đủ: [`HANDOFF.md`](./HANDOFF.md)

Phase 4 gồm hai nửa: **chuyển khoản có mã QR** (chạy được ngay) và **mở cửa hàng
cho công cụ tìm kiếm** (chờ bật cờ). Mục A–E kiểm nửa đầu và kiểm rằng nửa sau
không làm vỡ gì; mục F chỉ làm sau khi PO quyết bật cờ.

---

## Chuẩn bị — hai việc phải làm trước, đúng thứ tự

Chưa xong hai việc này thì phần lớn case ở mục B và C không có gì để nhìn.

🔴 **Kênh Zalo duy nhất của shop đang ở `draft`** — chưa bao giờ gửi duyệt. Nghĩa
là **mọi nút "Liên hệ shop" đang hiện ra rỗng** trên production. Đó chính là
điều kiện an toàn mà Phase 3 dựa vào để cắt bỏ trả hàng và khiếu nại: đúng trong
code, rỗng trong dữ liệu.

1. **Duyệt kênh liên hệ.** `/seller/settings` → mục Liên hệ → gửi duyệt kênh
   Zalo → `/admin/shop/contacts` duyệt. Xong thì nút "Liên hệ shop" ở trang sản
   phẩm phải hiện ra.
2. **Điền tài khoản ngân hàng.** `/seller/settings` → "Tài khoản nhận chuyển
   khoản" → chọn ngân hàng, số tài khoản, tên chủ tài khoản (viết hoa không dấu,
   đúng như ngân hàng in).

---

## A · Ô ngân hàng trong cài đặt shop

Ba ô là **một khối**: điền hai trên ba sinh ra mã QR mà app ngân hàng quét được
rồi mới hỏng — người mua tin là mình đã trả tiền.

| # | Làm | Phải thấy |
|---|---|---|
| A1 | Chỉ chọn ngân hàng, bỏ trống hai ô kia → Lưu | Báo lỗi **ngay tại ô còn thiếu**: "Điền đủ cả ba ô thì người mua mới quét được QR". Không phải một câu "không lưu được" chung chung |
| A2 | Dán số tài khoản kèm khoảng trắng: `0123 4567 89` | Lưu được; tải lại thì hiện **không còn khoảng trắng**. Ngân hàng nào cũng in số theo nhóm — không được bắt người bán sửa tay |
| A3 | Gõ chữ cái vào ô số tài khoản | "Số tài khoản chỉ gồm chữ số, 6–20 số" |
| A4 | Điền đủ ba ô → Lưu → tải lại trang | Cả ba còn nguyên, đúng giá trị vừa nhập |
| A5 | Xoá trắng cả ba ô → Lưu | Lưu được, không báo lỗi. Không điền là lựa chọn hợp lệ |

---

## B · Người mua đặt đơn chuyển khoản

Đặt bằng tài khoản người mua (không phải chủ shop, nếu tách được). Chọn
**"Chuyển khoản trước"** ở bước thanh toán.

| # | Làm | Phải thấy |
|---|---|---|
| B1 | Đặt xong → vào trang đơn | Có khối **"Thanh toán chuyển khoản"** kèm mã QR |
| B2 | Đối chiếu số tiền trên khối với tổng đơn | Bằng nhau, và **đã gồm phí vận chuyển** |
| B3 | Đọc dòng "Nội dung chuyển khoản" | Đúng bằng **mã đơn** (`PH-2608-AB12`), không thêm chữ nào phía trước. Đây là sợi dây duy nhất nối một dòng sao kê với một đơn |
| **B4** | **Mở app ngân hàng, quét mã QR trên màn hình** | App điền sẵn đủ ba thứ, khớp từng ký tự. **Case quan trọng nhất, và là case duy nhất máy không kiểm hộ được** |
| B5 | Bấm "Chép" cạnh số tài khoản → dán ra | Đúng số, liền mạch. Nút đổi thành "Đã chép" ~1,5s rồi trở lại |
| B6 | Bấm "Tôi đã chuyển khoản" | Nút biến mất, hiện "Shop sẽ đối soát rồi xác nhận". **QR và số tài khoản vẫn còn** — người bấm nhầm vẫn cần số |
| B7 | Tải lại trang đơn | Vẫn ở trạng thái đã báo |
| B8 | Ở đơn khác, chạm đúp thật nhanh vào nút | Không lỗi, không kẹt ở "Đang gửi…" |

---

## C · Người bán xác nhận tiền

`/seller/orders` → mở đúng đơn ở mục B.

| # | Làm | Phải thấy |
|---|---|---|
| C1 | Mở đơn chuyển khoản ở màn người bán | Có khối thanh toán kèm nút **"Xác nhận đã nhận tiền"** |
| C2 | Đặt đơn chuyển khoản mới, **không** bấm gì phía người mua, rồi mở ở màn người bán | Vẫn thấy nút, kèm "Người mua chưa báo đã chuyển. Nếu tiền đã về thì cứ xác nhận." **Không bị chặn** — người bán nhìn sao kê của chính họ |
| C3 | Bấm "Xác nhận đã nhận tiền" | Khối đóng lại còn "Shop đã xác nhận nhận được tiền". **QR biến mất** |
| C4 | Quay lại tài khoản người mua, mở lại đơn đó | Cũng thấy "Shop đã xác nhận nhận được tiền" |
| C5 | Nhìn **trạng thái đơn** ngay sau khi xác nhận tiền | **Không đổi** — vẫn "Chờ shop xác nhận". Tiền và trạng thái là hai việc riêng, cố ý: đơn chậm tiền vẫn đi tiếp được, và người bán muốn gửi trước không bị lá cờ nào chặn |

---

## D · Khi nào KHÔNG được hiện QR

| # | Làm | Phải thấy |
|---|---|---|
| D1 | Đặt một đơn **COD**, mở trang đơn | Không có khối thanh toán nào. Không phải khối rỗng — không có gì |
| D2 | Đặt đơn chuyển khoản rồi **huỷ** | Khối biến mất ở cả hai phía |
| D3 | Tạm xoá ba ô ngân hàng (A5) rồi đặt đơn chuyển khoản. Xong nhớ điền lại | Không QR, thay bằng câu chỉ đường: người mua thấy "Liên hệ shop…", người bán thấy trỏ về Cài đặt shop |

---

## E · Ba bảng vừa bị khoá — kiểm không vỡ

Phase 4 gỡ quyền đọc của khách vãng lai (`anon`) trên `shops`,
`shop_contact_channels` và `shop_profile_media`. Mục này kiểm đúng ba bề mặt đó,
**ở trạng thái đã đăng xuất** — dùng cửa sổ ẩn danh.

| # | Làm | Phải thấy |
|---|---|---|
| E1 | Ẩn danh → `/shop` | Sản phẩm, ảnh, giá đủ như trước |
| E2 | Ẩn danh → `/shop/store/thepicklehub` | **Logo và ảnh bìa hiện ra** — bảng `shop_profile_media` bị khoá, mất ảnh nghĩa là gỡ nhầm |
| E3 | Ẩn danh → một trang sản phẩm | Ảnh, giá, tình trạng hàng đủ; **nút Liên hệ shop hiện ra** (với điều kiện đã duyệt kênh ở bước Chuẩn bị) — bảng `shop_contact_channels` |
| E4 | Đăng nhập lại, đặt một đơn COD từ đầu tới cuối | Chạy y như trước Phase 4 |

---

## F · Sau khi bật cờ indexing

Chỉ làm khi PO đã quyết mở cửa. Bật cờ là **toàn bộ thao tác** — không cần deploy
lại, và tắt lại cũng tức thời.

**Cách bật:** Cloudflare Pages → project `pickle-hub-pro` → Settings →
Environment variables → **Production** → `SHOP_PUBLIC_INDEXING` = `1`.
Tắt = đổi thành `0` hoặc xoá biến.

| # | Làm | Phải thấy |
|---|---|---|
| F1 | `SHOP_PRODUCT_SLUG=kaiwin-diamond ./scripts/seo-verify.sh` | **Fail: 0**. Trên preview 18/08 là 88/88 |
| F2 | Đếm chữ trang sản phẩm mà bot nhận được (lệnh dưới) | **Hơn 100 chữ**. Lỗi 05/08 có thẻ meta hoàn hảo và bài rỗng 71 chữ — chỉ kiểm thẻ là không đủ |
| F3 | Mở `/robots.txt` và `/sitemap-shop.xml` | robots hết `Disallow: /shop/product`, nhưng **vẫn còn** `Disallow: /shop/search` và các dòng giỏ/đơn. Sitemap có URL thật, không rỗng |
| F4 | Xong F1–F3 mới xin index | GSC → URL Inspection → Request Indexing cho `/shop` và hai trang sản phẩm. Rồi IndexNow cho Bing |

```sh
curl -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" \
  "https://www.thepicklehub.net/shop/product/kaiwin-diamond?nocache=1" \
  | sed 's/<[^>]*>/ /g' | wc -w
```

---

Case nào đỏ thì ghi lại **mã case** và thứ thấy trên màn — đủ để lần ngược ra
chỗ hỏng.
