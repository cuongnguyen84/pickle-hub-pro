# Shop Phase 2b — nghiệm thu thủ công của Product Owner

> **Nhánh:** `feat/shop-production-phase-2b` · worktree `.claude/worktrees/shop-p2b`
> **Phạm vi:** chạy **local**. Chưa deploy, chưa merge, chưa push, chưa bật index.
> **Mục đích:** xác nhận sản phẩm đúng ý — không phải chạy lại test tự động.

2.014 unit test, 1.241 pgTAP và toàn bộ browser QA đã chạy và xanh. Tài liệu này
**không** yêu cầu chạy lại chúng. Nó chỉ hỏi những câu mà máy không trả lời được:
câu chữ có đúng không, luồng có hợp lý không, và cái nút kia có bấm được bằng ngón
tay cái không.

---

## 0. Cách ghi kết quả

Mỗi ca ghi đúng một kết quả:

- `PASS` — hành vi và câu chữ chấp nhận được.
- `REVISE` — giữ màn hình, sửa chi tiết đã nêu.
- `FAIL` — luồng sai, bị chặn, hoặc không an toàn.
- `N/A` — cố ý bỏ, kèm lý do.

Mẫu báo lỗi:

```text
TC-07-02 — REVISE
Thấy: đổi màu sang Trắng nhưng ảnh chính vẫn là ảnh đen.
Mong: ảnh đổi ngay khi đổi màu, trước cả khi chọn cỡ cán.
Thiết bị: iPhone 15 / Safari · rộng 390
Ảnh chụp: đính kèm
```

**Luôn kèm URL, chiều rộng màn hình và ảnh chụp khi báo FAIL.**

### Mức độ

| Ký hiệu | Nghĩa |
|---|---|
| 🔴 **CHẶN** | FAIL ở đây là chặn deploy. Không thương lượng. |
| 🟠 **QUAN TRỌNG** | FAIL cần sửa trước pilot, nhưng có thể deploy preview trước. |
| ⚪ **THAM KHẢO** | Ý kiến sản phẩm. Ghi lại, quyết định sau. |

---

## 1. Chuẩn bị

### 1.1 Dựng stack

```bash
cd /Users/cm10/pickle-hub-pro/.claude/worktrees/shop-p2b
npx supabase start
npx supabase db reset          # ~2 phút. Phải in 350/350.
```

Kiểm tra ledger:

```bash
docker exec supabase_db_ajvlcamxemgbxduhiqrl \
  psql -U postgres -d postgres -tAc \
  "select count(*) from supabase_migrations.schema_migrations;"      # → 350
```

### 1.2 Chạy web local trỏ vào Supabase local

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321 \
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0 \
npm run dev
```

→ <http://localhost:8080>

### 1.3 Dựng dữ liệu mẫu

```bash
node scripts/shop-p2b-fixture.mjs up
```

Lệnh này in ra **toàn bộ tài khoản và đường dẫn** cần dùng bên dưới. Giữ cửa sổ
terminal đó mở — mọi ô "URL" trong tài liệu này lấy từ đấy.

Mật khẩu chung của mọi tài khoản mẫu: `QaP2b!2026`

| Vai | Dùng để |
|---|---|
| Người bán (chủ shop) | nhóm 2, 5, 7, 10, 16 |
| Người nộp hồ sơ | nhóm 1 |
| Admin ĐÃ bật 2FA | nhóm 1, 2, 3, 10, 16 |
| Admin CHƯA bật 2FA | nhóm 13 |
| Người ngoài chương trình | nhóm 13 |
| (không đăng nhập) | nhóm 4, 5, 6, 7, 8, 9, 11, 12 |

> **2FA:** tài khoản "Admin ĐÃ bật 2FA" đã có một factor TOTP do máy tạo, và bí
> mật của nó chết cùng tiến trình seed. Để tự đăng nhập, hãy đăng nhập bằng
> "Admin CHƯA bật 2FA", vào `/account`, quét mã QR bằng ứng dụng xác thực trên
> điện thoại, rồi dùng tài khoản đó cho mọi màn `/admin/shop/*`.

### 1.4 Chiều rộng bắt buộc

- **375×812** — điện thoại. Đây là màn hình chính; ~95% người dùng.
- **390×844** — iPhone 14/15.
- **1440×900** — máy tính, dùng cho màn quản trị.
- **320×800** — điện thoại nhỏ nhất còn hỗ trợ. Chỉ cần ở nhóm 14.

### 1.5 Dọn sau khi xong — **bắt buộc**

```bash
node scripts/shop-p2b-fixture.mjs down
```

Phải in `Sạch — 0 hàng, 0 tệp, 0 tài khoản.` Nếu không, **đừng bỏ qua**: dữ liệu
sót lại làm hỏng lần chạy pgTAP kế tiếp (có file đếm số sản phẩm publishable trên
toàn hệ thống).

---

## 2. Nhóm 1 — Duyệt sản phẩm và hồ sơ 🔴 CHẶN

**Vai:** Admin đã bật 2FA · **Rộng:** 1440 rồi lặp lại ở 375

| # | Bước | Mong đợi | KQ | Ảnh |
|---|---|---|---|---|
| TC-01-01 | Mở `/admin/shop/products` | Thấy hàng đợi có "Vợt QA Chờ Duyệt". Không phải màn lỗi, không phải màn trắng. | ☐ | ☐ |
| TC-01-02 | Bấm vào sản phẩm đó | Mở màn xét duyệt, có khối **"Người mua sẽ thấy gì"** hiển thị đúng ảnh, giá, tình trạng | ☐ | ☐ |
| TC-01-03 | Đọc các nút quyết định | Chỉ có những quyết định hợp lệ với trạng thái hiện tại. Không có nút chết. | ☐ | ☐ |
| TC-01-04 | Bấm **Duyệt** | Báo thành công. Trạng thái đổi sang "Đã duyệt". | ☐ | ☐ |
| TC-01-05 | Ngay sau đó mở PDP của sản phẩm ở tab ẩn danh | **Chưa** thấy — duyệt không phải là công bố. Ảnh còn phải được sao chép sang kho công khai. | ☐ | ☐ |
| TC-01-06 | Mở `/admin/shop/applications` | Thấy hồ sơ "Shop Hồ Sơ QA" | ☐ | ☐ |
| TC-01-07 | Mở hồ sơ đó | Thấy đủ thông tin người nộp; câu chữ rõ ràng, không viết tắt khó hiểu | ☐ | ☐ |

**Câu hỏi sản phẩm ⚪:** màn xét duyệt có cho anh đủ thông tin để ra quyết định
trong 30 giây không, hay phải mở thêm tab khác?

---

## 3. Nhóm 2 — Yêu cầu sửa có địa chỉ 🔴 CHẶN

**Vai:** Admin, rồi Người bán · **Rộng:** 375

| # | Bước | Mong đợi | KQ | Ảnh |
|---|---|---|---|---|
| TC-02-01 | Ở màn xét duyệt, chọn **Yêu cầu sửa** | Bắt buộc phải nhập lời nhắn — không cho gửi lời nhắn rỗng | ☐ | ☐ |
| TC-02-02 | Chọn phần cần sửa (ví dụ Ảnh), nhập lời nhắn, gửi | Ghi nhận thành công | ☐ | ☐ |
| TC-02-03 | Đăng nhập bằng Người bán, mở `/seller/products` | Sản phẩm hiện trạng thái "Cần sửa" và nổi lên đầu danh sách | ☐ | ☐ |
| TC-02-04 | Mở sản phẩm đó | Thấy **đúng lời nhắn** của admin, và chỉ đúng phần được yêu cầu sửa | ☐ | ☐ |
| TC-02-05 | Tìm nút đưa tới chỗ cần sửa | Bấm vào thì con trỏ nhảy đúng ô cần sửa, không phải đầu trang | ☐ | ☐ |
| TC-02-06 | Sửa và **Gửi duyệt** lại | Trạng thái về "Chờ duyệt" | ☐ | ☐ |
| TC-02-07 | Kiểm tra người bán **không** thấy ghi chú nội bộ của admin | Không có chuỗi nào giống ghi chú nội bộ trên màn của người bán | ☐ | ☐ |

**🔴 TC-02-07 là ca chặn.** Ghi chú nội bộ lộ ra cho người bán là lỗi riêng tư.

---

## 4. Nhóm 3 — Duyệt kênh liên hệ 🔴 CHẶN

**Vai:** Admin · **Rộng:** 1440

| # | Bước | Mong đợi | KQ | Ảnh |
|---|---|---|---|---|
| TC-03-01 | Mở `/admin/shop/contacts` | Tab mặc định "Chờ duyệt" có kênh "Gọi ngoài giờ" | ☐ | ☐ |
| TC-03-02 | Chuyển sang tab **Nháp** | Thấy kênh "Gọi giờ hành chính" — kênh mới tạo nằm ở đây, không ở "Chờ duyệt" | ☐ | ☐ |
| TC-03-03 | Đọc câu chữ giải thích | Màn nói rõ nó không tự kết luận link là an toàn; máy chủ chuẩn hoá lại lúc duyệt | ☐ | ☐ |
| TC-03-04 | Duyệt một kênh | Thành công. Xem lịch sử: có dòng ghi ai duyệt, lúc nào | ☐ | ☐ |
| TC-03-05 | Mở tab **Từ chối** | Thấy kênh Messenger đã bị từ chối, kèm lý do | ☐ | ☐ |
| TC-03-06 | Mở PDP ở tab ẩn danh | Chỉ thấy kênh **đã duyệt**. Số điện thoại đang chờ duyệt và link đã bị từ chối **không** xuất hiện ở bất kỳ đâu | ☐ | ☐ |

**🔴 TC-03-06 là ca chặn.**

**Câu hỏi sản phẩm ⚪:** người bán thêm một số điện thoại mới thì nó nằm ở "Nháp"
và **không có nút gửi duyệt**. Admin phải chủ động mở tab Nháp mới thấy. Đây có
đúng ý anh không, hay người bán cần một nút "gửi duyệt"?

---

## 5. Nhóm 4 — Khám phá 🟠 QUAN TRỌNG

**Vai:** không đăng nhập · **Rộng:** 375

| # | Bước | Mong đợi | KQ | Ảnh |
|---|---|---|---|---|
| TC-04-01 | Mở `/shop` | Thấy thẻ sản phẩm thật, có ảnh, có giá — không phải khung xám | ☐ | ☐ |
| TC-04-02 | Đọc dòng đếm số sản phẩm | Nói thật rằng sàn đang thử nghiệm và đây là toàn bộ hàng đang bán | ☐ | ☐ |
| TC-04-03 | Nhìn dải ngành hàng | Ngành hàng chưa có sản phẩm hiển thị số 0, không bị giấu đi và cũng không giả vờ có hàng | ☐ | ☐ |
| TC-04-04 | Nhìn nhãn tình trạng trên thẻ | "Mới"/"Đã qua sử dụng" và "Còn hàng"/"Hết hàng"/"Liên hệ shop để hỏi số lượng" — mỗi cái là một câu trả lời khác nhau | ☐ | ☐ |
| TC-04-05 | Tìm nút giỏ hàng / lưu / yêu thích | **Không có.** P2b không có giỏ hàng; một nút không làm gì tệ hơn là không có nút | ☐ | ☐ |
| TC-04-06 | Tắt mạng rồi tải lại | Báo **lỗi tải dữ liệu**, không phải "không có sản phẩm nào" | ☐ | ☐ |

---

## 6. Nhóm 5 — Tìm kiếm và bộ lọc 🟠 QUAN TRỌNG

**Vai:** không đăng nhập · **Rộng:** 375

| # | Bước | Mong đợi | KQ | Ảnh |
|---|---|---|---|---|
| TC-05-01 | `/shop/search`, gõ `vot` | Ra kết quả có dấu ("Vợt") | ☐ | ☐ |
| TC-05-02 | Gõ `vợt` | Cũng ra kết quả | ☐ | ☐ |
| TC-05-03 | Gõ nhanh `v` → `vo` → `vot` | Kết quả cuối cùng khớp với `vot`, không nhảy lộn xộn về kết quả của `vo` | ☐ | ☐ |
| TC-05-04 | Gõ chuỗi không tồn tại | Nói "không tìm thấy", **khác** với màn "sàn chưa có hàng" | ☐ | ☐ |
| TC-05-05 | Bấm **Bộ lọc**, chọn "Đã qua sử dụng" | Ô chọn **hiện rõ đã được chọn ngay lập tức** | ☐ | ☐ |
| TC-05-06 | Chưa bấm Áp dụng, nhìn URL | URL **chưa** đổi — lọc chỉ ăn khi bấm Áp dụng | ☐ | ☐ |
| TC-05-07 | Bấm **Áp dụng** | Kết quả lọc đúng, URL có `condition=used` | ☐ | ☐ |
| TC-05-08 | Mở lại Bộ lọc, đổi lựa chọn, bấm **Huỷ** | Không có gì đổi. Mở lại lần nữa thì thấy lựa chọn cũ, không phải cái vừa huỷ | ☐ | ☐ |
| TC-05-09 | Bấm nút Back của trình duyệt | Về đúng truy vấn trước, kèm kết quả — không phải màn trắng | ☐ | ☐ |
| TC-05-10 | Bấm phím `Esc` khi bảng lọc đang mở | Bảng đóng lại | ☐ | ☐ |

> **TC-05-05 là ca đã từng FAIL** trong P2b.7 và đã sửa. Bấm vào ô lọc mà không
> thấy gì đổi là lỗi cũ tái diễn.

---

## 7. Nhóm 6 — Ngành hàng 🟠 QUAN TRỌNG

**Vai:** không đăng nhập · **Rộng:** 375

| # | Bước | Mong đợi | KQ | Ảnh |
|---|---|---|---|---|
| TC-06-01 | Mở `/shop/category/vot` | Tiêu đề là tên ngành hàng, có sản phẩm thật | ☐ | ☐ |
| TC-06-02 | Nhìn đường dẫn phân cấp (breadcrumb) | Bấm được, đưa về `/shop` | ☐ | ☐ |
| TC-06-03 | Mở `/shop/category/khong-ton-tai` | Nói không tìm thấy ngành hàng, có lối quay lại | ☐ | ☐ |
| TC-06-04 | Mở một ngành hàng đang trống (Giày) | Nói ngành hàng chưa có sản phẩm — không phải màn lỗi | ☐ | ☐ |

---

## 8. Nhóm 7 — PDP, phiên bản và ảnh 🔴 CHẶN

**Vai:** không đăng nhập · **Rộng:** 375 · **URL:** PDP nhiều phiên bản

| # | Bước | Mong đợi | KQ | Ảnh |
|---|---|---|---|---|
| TC-07-01 | Mở PDP | Tên, giá (hoặc khoảng giá), ảnh, tên shop, huy hiệu đã xác minh | ☐ | ☐ |
| TC-07-02 | Đổi **Màu** khi chưa chọn cỡ cán | Ảnh chính đổi **ngay**, không phải chờ chọn đủ | ☐ | ☐ |
| TC-07-03 | Chọn **Cỡ cán** | Giá, SKU và tình trạng còn hàng cập nhật theo tổ hợp | ☐ | ☐ |
| TC-07-04 | Chọn tổ hợp Đen + 4.25 (tồn 0) | Nói **hết hàng** | ☐ | ☐ |
| TC-07-05 | Chọn tổ hợp Trắng + 4.0 (chưa khai tồn) | Nói **liên hệ shop để hỏi số lượng** — khác hẳn "hết hàng" | ☐ | ☐ |
| TC-07-06 | Đổi màu sang tổ hợp không tồn tại | Cỡ cán được nhả ra, và màn nói "không có" chứ không nói "hết hàng" | ☐ | ☐ |
| TC-07-07 | Trong suốt quá trình, nhìn tên shop | **Không đổi.** Đổi phiên bản không được đổi người bán | ☐ | ☐ |
| TC-07-08 | Mở PDP một phiên bản | Không hiện bảng chọn phiên bản rối mắt | ☐ | ☐ |
| TC-07-09 | Mở PDP hàng đã dùng | Ghi rõ "Đã qua sử dụng" | ☐ | ☐ |

---

## 9. Nhóm 8 — Nút liên hệ 🔴 CHẶN

**Vai:** không đăng nhập · **Rộng:** 375

| # | Bước | Mong đợi | KQ | Ảnh |
|---|---|---|---|---|
| TC-08-01 | Ở PDP, tìm nút liên hệ | Hiện đúng kênh **đã duyệt** ("Nhắn Zalo") | ☐ | ☐ |
| TC-08-02 | Bấm giữ / chuột phải để xem địa chỉ đích | Trỏ tới `zalo.me`, **không có** dấu `?` hay `#` phía sau | ☐ | ☐ |
| TC-08-03 | Bấm thật | Mở Zalo (hoặc trang zalo.me). Không mở màn chat nội bộ — nhắn tin nội bộ chưa có | ☐ | ☐ |
| TC-08-04 | Đo nút bằng ngón cái | Ít nhất 44×44 điểm, bấm ở mép vẫn ăn | ☐ | ☐ |
| TC-08-05 | Mở PDP của shop chưa có kênh nào được duyệt | Nói thẳng là chưa có kênh liên hệ. **Không** có nút xám bấm không được | ☐ | ☐ |

---

## 10. Nhóm 9 — Trang shop 🟠 QUAN TRỌNG

**Vai:** không đăng nhập · **Rộng:** 375

| # | Bước | Mong đợi | KQ | Ảnh |
|---|---|---|---|---|
| TC-09-01 | Mở trang shop | Tên shop, giới thiệu, khu vực, huy hiệu xác minh, danh sách sản phẩm | ☐ | ☐ |
| TC-09-02 | Đếm sản phẩm | Chỉ hiện sản phẩm **của shop đó** — không lẫn sản phẩm shop khác | ☐ | ☐ |
| TC-09-03 | Nhìn thông tin giao hàng / đổi trả | Hiện đúng những gì người bán ghi, không tự bịa | ☐ | ☐ |
| TC-09-04 | Mở trang shop bị tạm ngưng | Trả lời **y hệt** một shop chưa từng tồn tại. Không xác nhận là shop có thật | ☐ | ☐ |

---

## 11. Nhóm 10 — Gỡ, mở lại, gửi lại 🔴 CHẶN

**Vai:** Admin, rồi Người bán · **Rộng:** 1440

| # | Bước | Mong đợi | KQ | Ảnh |
|---|---|---|---|---|
| TC-10-01 | Chọn một sản phẩm đang bán, bấm **Gỡ** | Bắt buộc nhập lời nhắn cho người bán | ☐ | ☐ |
| TC-10-02 | Ngay sau đó mở PDP ở tab ẩn danh | Không tìm thấy | ☐ | ☐ |
| TC-10-03 | Tìm sản phẩm đó ở `/shop`, `/shop/search`, trang ngành hàng, trang shop | **Không có ở chỗ nào cả** | ☐ | ☐ |
| TC-10-04 | Ở màn xét duyệt, xem các quyết định còn lại | Chỉ còn **Mở lại**. Không có nút đưa thẳng về "đang bán" | ☐ | ☐ |
| TC-10-05 | Bấm **Mở lại** | Về trạng thái "Cần sửa" — người bán cầm lại | ☐ | ☐ |
| TC-10-06 | Kiểm tra PDP lần nữa | **Vẫn chưa** công khai. Mở lại không tự đưa hàng lên kệ | ☐ | ☐ |
| TC-10-07 | Người bán sửa, gửi duyệt; admin duyệt lại | Chỉ công khai trở lại sau khi ảnh được công bố xong | ☐ | ☐ |

**🔴 TC-10-04 và TC-10-06** là quyết định Q5 đã ký: đường về duy nhất là qua
người bán.

---

## 12. Nhóm 11 — Đổi đường dẫn 🟠 QUAN TRỌNG

**Vai:** không đăng nhập · **Rộng:** 375

| # | Bước | Mong đợi | KQ | Ảnh |
|---|---|---|---|---|
| TC-11-01 | Mở "Đường dẫn sản phẩm CŨ" | Chuyển sang đường dẫn mới, hiện đúng sản phẩm | ☐ | ☐ |
| TC-11-02 | Mở "Đường dẫn shop CŨ" | Chuyển sang trang shop hiện tại | ☐ | ☐ |
| TC-11-03 | Nhìn thanh địa chỉ sau khi chuyển | Là đường dẫn **mới**, không phải cũ, không nhảy đi nhảy lại | ☐ | ☐ |
| TC-11-04 | Mở đường dẫn cũ của **shop bị tạm ngưng** | Không chuyển hướng, không xác nhận shop có thật | ☐ | ☐ |
| TC-11-05 | Ở `/seller/settings`, đổi tên shop (không đổi đường dẫn) | Màn nói rõ đổi tên **không** đổi đường dẫn | ☐ | ☐ |

---

## 13. Nhóm 12 — Chưa cho lập chỉ mục 🔴 CHẶN

**Vai:** dòng lệnh · **Rộng:** —

Đây là nhóm duy nhất chạy bằng terminal, vì thứ cần kiểm là **HTTP header**, mà
trình duyệt không hiện ra.

```bash
npx vitest run functions/_lib/__tests__/shop-pilot-seo-edge.test.ts
```

| # | Bước | Mong đợi | KQ |
|---|---|---|---|
| TC-12-01 | Chạy lệnh trên | 41 test xanh | ☐ |
| TC-12-02 | Mở `/shop` trên trình duyệt, xem mã nguồn trang | Có thẻ `robots` chứa `noindex` | ☐ |
| TC-12-03 | Mở `robots.txt` local | Có `Disallow: /shop/product`, `Disallow: /seller` | ☐ |
| TC-12-04 | Xác nhận với chính mình | Anh **chưa** đồng ý bật lập chỉ mục cho Shop. Nếu anh muốn bật, đó là một quyết định riêng, không nằm trong nghiệm thu này | ☐ |

---

## 14. Nhóm 13 — Rò rỉ dữ liệu 🔴 CHẶN

| # | Vai | Bước | Mong đợi | KQ |
|---|---|---|---|---|
| TC-13-01 | Người ngoài chương trình | Mở `/seller/application` | Bị từ chối, nói rõ đang thử nghiệm kín. **Không** hiện biểu mẫu | ☐ |
| TC-13-02 | Người ngoài chương trình | Mở thẳng `/admin/shop/products` | Không vào được | ☐ |
| TC-13-03 | Admin **chưa** bật 2FA | Mở `/admin/shop/products` | Bị chặn ở cổng 2FA, không thấy hàng đợi | ☐ |
| TC-13-04 | Chủ shop khác | Mở `/seller/products` | Chỉ thấy sản phẩm shop mình | ☐ |
| TC-13-05 | Không đăng nhập | Ở PDP, mở DevTools → Network → xem phản hồi `shop_public_product` | Không có số tồn kho thật, không có đường dẫn ảnh nháp, không có ghi chú nội bộ, không có email người bán | ☐ |
| TC-13-06 | Không đăng nhập | Xem mã nguồn trang PDP | Không có `/original`, không có `token=`, không có `object/sign/` | ☐ |

---

## 15. Nhóm 14 — Điện thoại 🔴 CHẶN

**Rộng:** 375, rồi 320 · **Nếu có điện thoại thật thì dùng điện thoại thật.**

| # | Bước | Mong đợi | KQ | Ảnh |
|---|---|---|---|---|
| TC-14-01 | Lướt `/shop` từ trên xuống dưới | Không có thanh cuộn ngang. Không có gì bị cắt mép phải | ☐ | ☐ |
| TC-14-02 | Lặp lại ở `/shop/search`, ngành hàng, PDP, trang shop | Như trên | ☐ | ☐ |
| TC-14-03 | Bấm mọi nút bằng ngón cái, kể cả ở **mép** nút | Nút nào cũng ăn. Không phải nhắm mới bấm trúng | ☐ | ☐ |
| TC-14-04 | Bấm vào ô tìm kiếm | iOS **không** tự phóng to trang | ☐ | ☐ |
| TC-14-05 | Chụm hai ngón để phóng to | Phóng được. Trang không khoá zoom | ☐ | ☐ |
| TC-14-06 | Nhìn thanh điều hướng dưới cùng | Có trên màn người mua; **không** có trên màn người bán và quản trị | ☐ | ☐ |
| TC-14-07 | Tìm nút chat nổi (FAB) | **Không** đè lên nút liên hệ ở PDP | ☐ | ☐ |
| TC-14-08 | Lặp TC-14-01 ở **320** | Vẫn không tràn ngang | ☐ | ☐ |

---

## 16. Nhóm 15 — Bàn phím và trợ năng 🟠 QUAN TRỌNG

**Rộng:** 1440 · Chỉ dùng bàn phím, không chạm chuột.

| # | Bước | Mong đợi | KQ |
|---|---|---|---|
| TC-15-01 | Mở `/shop`, bấm `Tab` một lần | Con trỏ nhảy tới link "bỏ qua, đến nội dung chính" và **thấy được viền** | ☐ |
| TC-15-02 | Tiếp tục `Tab` qua toàn trang | Lúc nào cũng thấy con trỏ đang ở đâu | ☐ |
| TC-15-03 | Ở PDP, chọn phiên bản chỉ bằng bàn phím | Làm được | ☐ |
| TC-15-04 | Mở bảng lọc bằng bàn phím, bấm `Esc` | Đóng, con trỏ về đúng nút vừa mở nó | ☐ |
| TC-15-05 | Bật "giảm chuyển động" trong cài đặt hệ điều hành, tải lại | Không còn hiệu ứng chuyển động thừa | ☐ |

---

## 17. Nhóm 16 — Thu hồi ảnh ⚪ THAM KHẢO

**Vai:** dòng lệnh · Ảnh là thứ duy nhất trong P2b sống ngoài cơ sở dữ liệu, nên
phần này kiểm bằng test tự động chứ không bằng mắt.

```bash
npx vitest run scripts/shop-p2b-media-lifecycle.test.mjs
```

| # | Bước | Mong đợi | KQ |
|---|---|---|---|
| TC-16-01 | Chạy lệnh trên | 7 test xanh | ☐ |
| TC-16-02 | Đọc tên test | Có ca "republishing before the worker ran does NOT lose the live image" | ☐ |
| TC-16-03 | Hiểu giới hạn | Việc xoá tệp thật là **không đồng bộ**: cơ sở dữ liệu ngừng trỏ tới ảnh ngay, nhưng tệp chỉ mất khi worker chạy. **Worker chưa được deploy** — xem `deployment-readiness.md` | ☐ |

---

## 18. Sau khi xong

1. **Dọn dữ liệu:**
   ```bash
   node scripts/shop-p2b-fixture.mjs down
   ```
   Phải in `Sạch — 0 hàng, 0 tệp, 0 tài khoản.`

2. **Tổng kết** vào một tin nhắn:
   - số ca PASS / REVISE / FAIL / N/A
   - danh sách mọi ca 🔴 CHẶN bị FAIL
   - ý kiến sản phẩm ở các ô "Câu hỏi sản phẩm ⚪"

3. **Chỉ khi không còn ca 🔴 CHẶN nào FAIL**, câu trạng thái được phép ghi là:

   > `P2b Product Owner acceptance PASS locally.`

   Không được ghi *production ready*, *deployed*, *remote verified* hay
   *public launch approved* — xem `deployment-readiness.md` cho những gì còn
   thiếu trước từng mốc đó.
