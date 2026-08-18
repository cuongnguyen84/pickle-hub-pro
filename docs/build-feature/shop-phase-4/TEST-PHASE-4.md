# Nghiệm thu Shop Phase 4 — 36 case

> main `30f3e36b` (PR #615 · #617 · #618 đã merge) · 18/08/2026
> **Bản tick trên iPhone:** https://claude.ai/code/artifact/d6b5e402-3a8a-4d6a-97ae-b3458f0a65eb
> Bối cảnh đầy đủ: [`HANDOFF.md`](./HANDOFF.md)

Phase 4 gồm ba mảnh: **chuyển khoản có mã QR**, **người bán tự đăng bán** (quản
trị viên chỉ duyệt việc mở shop), và **mở cửa hàng cho công cụ tìm kiếm** (chờ
bật cờ). Mục G, A–E chạy được ngay; mục F chỉ làm sau khi PO quyết bật cờ.

Bản tick trên điện thoại chạm cả dòng để đánh dấu, mọi đường dẫn là link mở
thẳng trang cần test, và trạng thái lưu ngay trên máy — rời đi mở app ngân hàng
rồi quay lại vẫn còn nguyên.

---

## Chuẩn bị — một việc

> **Bước "duyệt kênh liên hệ" đã biến mất, và đó là bản vá chứ không phải cắt
> bớt.** Hoá ra **nút gửi duyệt chưa bao giờ tồn tại**: trigger ghim cứng kênh
> mới ở `draft` và không đường nào ra, trong khi huy hiệu ghi "Chưa gửi duyệt" —
> đặt tên cho một hành động không có. Từ `20260818160000` quản trị viên chỉ
> duyệt việc *mở shop*, kênh của người bán lên thẳng, và kênh đang kẹt đã được
> đẩy lên khi áp migration.

**Điền tài khoản ngân hàng.** `/seller/settings` → "Tài khoản nhận chuyển khoản"
→ chọn ngân hàng, số tài khoản, tên chủ tài khoản (viết hoa không dấu, đúng như
ngân hàng in). Chưa làm thì mục B và C không có QR nào để nhìn.

---

## G · Tự đăng bán, và đường quay lại

Quản trị viên chỉ duyệt việc mở shop. Sản phẩm và kênh liên hệ là của người bán.

| # | Làm | Phải thấy |
|---|---|---|
| G1 | Tạo sản phẩm nháp, điền đủ (ảnh, giá, mô tả, ngành hàng) | Nút cuối trang ghi **"Đăng bán"**, không phải "Gửi duyệt" |
| G2 | Bấm "Đăng bán" → mở `/shop` ở cửa sổ ẩn danh | Sản phẩm có mặt **ngay**. Không phải vào `/admin` làm gì cả |
| **G3** | Vẫn ẩn danh → mở trang sản phẩm vừa đăng | **Ảnh hiện ra.** Case dễ hỏng nhất của cả thay đổi: đăng bán chỉ dời trạng thái, ảnh phải được chép sang kho công khai bằng một bước riêng. Thiếu bước đó thì sản phẩm "đã đăng" mà **vô hình** — và nhìn màn người bán không thấy được |
| G4 | Mở lại sản phẩm đó ở `/seller/products` | Ô bị khoá + "Sản phẩm đang bán nên khoá sửa", có nút **"Gỡ xuống để sửa"** |
| G5 | Bấm "Gỡ xuống để sửa" → tải lại `/shop` ẩn danh | Sản phẩm **biến mất khỏi cửa hàng ngay**; ở màn người bán quay về nháp, sửa được |
| G6 | Sửa một chữ trong tên → "Đăng bán" lại | Lên lại, **ảnh vẫn còn**, tên mới hiện đúng |
| G7 | `/seller/settings` → thêm kênh liên hệ mới, bật công khai | Hiện ở trang sản phẩm **ngay**, huy hiệu "Đang hiển thị công khai" |

---

## A · Ô ngân hàng trong cài đặt shop

Ba ô là **một khối**: điền hai trên ba sinh ra mã QR mà app ngân hàng quét được
rồi mới hỏng — người mua tin là mình đã trả tiền.

| # | Làm | Phải thấy |
|---|---|---|
| A1 | Chỉ chọn ngân hàng, bỏ trống hai ô kia → Lưu | Báo lỗi **ngay tại ô còn thiếu**. Không phải một câu "không lưu được" chung chung |
| A2 | Dán số tài khoản kèm khoảng trắng: `0123 4567 89` | Lưu được; tải lại thì **không còn khoảng trắng** |
| A3 | Gõ chữ cái vào ô số tài khoản | "Số tài khoản chỉ gồm chữ số, 6–20 số" |
| A4 | Điền đủ ba ô → Lưu → tải lại trang | Cả ba còn nguyên |
| A5 | Xoá trắng cả ba ô → Lưu | Lưu được. Không điền là lựa chọn hợp lệ |

---

## B · Người mua đặt đơn chuyển khoản

Chọn **"Chuyển khoản trước"** ở bước thanh toán.

| # | Làm | Phải thấy |
|---|---|---|
| B1 | Đặt xong → vào trang đơn | Khối **"Thanh toán chuyển khoản"** kèm mã QR |
| B2 | Đối chiếu số tiền với tổng đơn | Bằng nhau, **đã gồm phí vận chuyển** |
| B3 | Đọc dòng "Nội dung chuyển khoản" | Đúng bằng **mã đơn** (`PH-2608-AB12`), không thêm chữ nào. Đây là sợi dây duy nhất nối một dòng sao kê với một đơn |
| **B4** | **Mở app ngân hàng, quét mã QR trên màn hình** | App điền sẵn đủ ba thứ, khớp từng ký tự. **Case quan trọng nhất, và là case duy nhất máy không kiểm hộ được** |
| B5 | Bấm "Chép" cạnh số tài khoản → dán ra | Đúng số, liền mạch. Nút đổi "Đã chép" ~1,5s |
| B6 | Bấm "Tôi đã chuyển khoản" | Nút biến mất, hiện "Shop sẽ đối soát rồi xác nhận". **QR và số tài khoản vẫn còn** |
| B7 | Tải lại trang đơn | Vẫn ở trạng thái đã báo |
| B8 | Ở đơn khác, chạm đúp thật nhanh vào nút | Không lỗi, không kẹt ở "Đang gửi…" |

---

## C · Người bán xác nhận tiền

`/seller/orders` → mở đúng đơn ở mục B.

| # | Làm | Phải thấy |
|---|---|---|
| C1 | Mở đơn chuyển khoản ở màn người bán | Khối thanh toán + nút **"Xác nhận đã nhận tiền"** |
| C2 | Đặt đơn mới, **không** bấm gì phía người mua, mở ở màn người bán | Vẫn thấy nút + "Người mua chưa báo đã chuyển…". **Không bị chặn** |
| C3 | Bấm "Xác nhận đã nhận tiền" | Khối đóng lại còn "Shop đã xác nhận nhận được tiền". **QR biến mất** |
| C4 | Quay lại tài khoản người mua, mở lại đơn | Cũng thấy "Shop đã xác nhận nhận được tiền" |
| C5 | Nhìn **trạng thái đơn** ngay sau khi xác nhận tiền | **Không đổi** — vẫn "Chờ shop xác nhận". Tiền và trạng thái là hai việc riêng, cố ý |

---

## D · Khi nào KHÔNG được hiện QR

| # | Làm | Phải thấy |
|---|---|---|
| D1 | Đặt một đơn **COD**, mở trang đơn | Không có khối thanh toán nào. Không phải khối rỗng — không có gì |
| D2 | Đặt đơn chuyển khoản rồi **huỷ** | Khối biến mất ở cả hai phía |
| D3 | Tạm xoá ba ô ngân hàng (A5) rồi đặt đơn chuyển khoản. Xong nhớ điền lại | Không QR, thay bằng câu chỉ đường |

---

## E · Ba bảng vừa bị khoá — kiểm không vỡ

Phase 4 gỡ quyền đọc của khách vãng lai (`anon`) trên `shops`,
`shop_contact_channels`, `shop_profile_media`. Kiểm **ở cửa sổ ẩn danh** — đó
mới là vai bị đổi quyền.

| # | Làm | Phải thấy |
|---|---|---|
| E1 | Ẩn danh → `/shop` | Sản phẩm, ảnh, giá đủ như trước |
| E2 | Ẩn danh → `/shop/store/thepicklehub` | **Logo và ảnh bìa hiện ra** — bảng `shop_profile_media`; mất ảnh nghĩa là gỡ nhầm |
| E3 | Ẩn danh → một trang sản phẩm | Ảnh, giá, tình trạng hàng đủ; **nút Liên hệ shop hiện ra** — bảng `shop_contact_channels`, và cũng là chỗ chứng minh kênh Zalo hết kẹt ở `draft` |
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
| F2 | Đếm chữ trang sản phẩm mà bot nhận được (lệnh dưới) | **Hơn 100 chữ**. Lỗi 05/08 có thẻ meta hoàn hảo và bài rỗng 71 chữ |
| F3 | Mở `/robots.txt` và `/sitemap-shop.xml` | robots hết `Disallow: /shop/product`, nhưng **vẫn còn** `Disallow: /shop/search` và các dòng giỏ/đơn. Sitemap có URL thật |
| F4 | Xong F1–F3 mới xin index | GSC → URL Inspection → Request Indexing cho `/shop` và hai trang sản phẩm. Rồi IndexNow cho Bing |

```sh
curl -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" \
  "https://www.thepicklehub.net/shop/product/kaiwin-diamond?nocache=1" \
  | sed 's/<[^>]*>/ /g' | wc -w
```

---

Case nào đỏ thì ghi lại **mã case** và thứ thấy trên màn — đủ để lần ngược ra
chỗ hỏng.
