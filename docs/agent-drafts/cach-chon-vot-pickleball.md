# Bản nháp bài trụ: Cách chọn vợt pickleball (VI + EN)

- Task: SEO vợt T164 — yêu cầu anh Cuong ngày 13/10/2026
- Trạng thái: **BẢN NHÁP, CHƯA ĐĂNG.** Chưa tạo `src/content/blog/posts/*.ts`, chưa sửa `metadata.ts`, chưa INSERT `vi_blog_posts`, chưa chạy `gen-blog-barrel`. Chưa sửa bài cũ.
- Người soạn: agent Nội dung, 13/10/2026

## 0. Nguồn và ngày kiểm tra

| Nguồn | Nội dung dùng | Ngày kiểm tra | Ghi chú |
|---|---|---|---|
| Thông số vợt do shop khai báo, đính kèm trong yêu cầu task T164 | Toàn bộ bảng so sánh (mặt, lõi, chu vi cán, dài cán, trọng lượng, dáng, usap) | Lấy 13/10/2026 (theo yêu cầu) | Agent không truy cập được DB/mạng; chưa đối chiếu với trang hãng |
| Google Search Console (VN, 13/07–11/10/2026), số liệu trong yêu cầu | Cụm 19 truy vấn "chọn vợt" ~280 lượt hiển thị, 0 click; "chọn size cán vợt pickleball" 84 lượt hiển thị, vị trí 68 | Theo yêu cầu | Chỉ dùng để lập kế hoạch, KHÔNG đưa vào bài |
| Repo @ d9caea15: `src/content/blog/posts/best-pickleball-paddles-beginners-2026.ts`, `src/content/blog/metadata.ts`, `src/routes/__tests__/route-snapshot.json`, `functions/robots.txt.ts`, `src/lib/shop/shopGate.ts`, `CLAUDE.md` | Phân tích bài cũ, xác minh route có tồn tại, luật GEO | 13/10/2026 | Đọc file trực tiếp |
| USA Pickleball Rulebook 2.E.3 (24 in tổng dài+rộng, dài ≤ 17 in, không giới hạn độ dày) + 2.E.4 (không giới hạn trọng lượng), trích qua playpickleball.com/2025-usa-pickleball-rules-section-2-court-and-equipment; danh sách vợt duyệt https://equipment.usapickleball.org/paddle-list/ | Giới hạn kích thước vợt, cách kiểm tra chứng nhận | 13/10/2026 (Claude kiểm) | Đã xác minh |

Phép đổi đơn vị (agent tự tính, 1 inch = 25,4 mm; 1 oz = 28,35 g):
- 105 mm ÷ 25,4 = 4,13 in ≈ **4 1/8 in** (4,125 in = 104,8 mm) → đúng.
- 108 mm ÷ 25,4 = 4,25 in ≈ **4 1/4 in** (4,25 in = 107,95 mm) → đúng.
- Trọng lượng: 213 g ≈ 7,5 oz; 215 g ≈ 7,6 oz; 218 g ≈ 7,7 oz; 220 g ≈ 7,8 oz; 224 g ≈ 7,9 oz; 225 g ≈ 7,9 oz; 226 g ≈ 8,0 oz; 227 g ≈ 8,0 oz; 230 g ≈ 8,1 oz.
- Chiều dài cán: 125 mm ≈ 4,9 in; 127 mm ≈ 5,0 in; 130 mm ≈ 5,1 in; 133 mm ≈ 5,2 in; 135 mm ≈ 5,3 in; 140 mm ≈ 5,5 in.

## 1. Phương án: viết bài MỚI, sửa bài cũ thành bài vệ tinh

**Đề xuất: viết bài trụ mới** `/vi/blog/cach-chon-vot-pickleball` (EN `/blog/how-to-choose-a-pickleball-paddle`), **không** biến bài `vot-pickleball-tot-nhat-cho-nguoi-moi-2026` thành bài trụ.

Lý do:
1. **Ý định tìm kiếm khác nhau.** Cụm truy vấn ("cách chọn", "hướng dẫn chọn", "chọn size cán", "kinh nghiệm mua", "cho nữ") hỏi *cách quyết định*. Bài cũ là danh sách 7 mẫu kèm giá cho *người mới*. Theo GSC, Google đang không xếp bài cũ cho cụm này.
2. **Slug và tiêu đề bài cũ gắn với năm 2026 và chữ "tốt nhất".** Bài trụ cần lâu dài và có thể cập nhật liên tục. Đổi slug bài cũ sẽ phải làm redirect và đổi hreflang, và có thể mất những gì bài cũ đang có.
3. **Bài cũ có dữ liệu không khớp với shop.** Trong 7 vợt bài cũ giới thiệu, chỉ có Selkirk (hãng) trùng với shop, còn model thì không trùng. Bài cũ còn có giá VND và nhận định trải nghiệm mà agent không kiểm chứng được. Nếu viết lại thành bài trụ thì gần như phải viết lại toàn bộ.
4. **Phân vai để hai bài không giành từ khoá của nhau:**
   - Bài trụ mới giữ từ khoá chính "cách chọn vợt pickleball" cùng các biến thể (size cán, cho nữ, theo trình độ, kích thước chuẩn).
   - Bài cũ chỉ giữ "vợt pickleball cho người mới 2026" (danh sách mẫu).

**Việc cần làm với bài cũ khi bài mới lên (đề xuất, chưa làm, cần anh Cuong duyệt vì bài cũ đang public):**
- VI (`vi_blog_posts`, slug `vot-pickleball-tot-nhat-cho-nguoi-moi-2026`): rút gọn mục "4 thông số vợt thực sự quan trọng" còn 2–3 câu, rồi thêm link: *"Hướng dẫn đầy đủ về trọng lượng, lõi, mặt vợt và size cán: [Cách chọn vợt pickleball](/vi/blog/cach-chon-vot-pickleball)"*. Thêm link tương tự ở đoạn mở đầu.
- EN (`best-pickleball-paddles-beginners-2026.ts`): rút gọn mục "The 4 Paddle Specs That Actually Matter" và thêm `internalLinks` → `/blog/how-to-choose-a-pickleball-paddle`. Cập nhật `updatedDate`.
- Bỏ các cụm "cách chọn" khỏi title/meta của bài cũ nếu có. Hiện tại bài cũ không có, nên giữ nguyên title.
- Bài cũ có vài điểm nên rà lại (ngoài phạm vi task này): dùng tên "USAPA" (tên đang dùng là USA Pickleball); có giá VND 2026 và câu "Joola Perseus — được Ben Johns phổ biến 2024" chưa có nguồn; có tỉ lệ "70/30" và "kéo dài tuổi thọ 30–40%" không ghi nguồn.
- Bài `/vi/news` dịch tự động đang ở vị trí ~82: agent không biết là bài nào (dữ liệu news trong task không có bài về chọn vợt). Đề xuất anh Cuong tra URL trong GSC. Nếu bài đó mỏng, cân nhắc thêm link từ bài đó sang bài trụ.

---

## 2. BẢN VI

**Slug:** `cach-chon-vot-pickleball`
**Tiêu đề (H1):** Cách chọn vợt pickleball: trọng lượng, lõi, mặt vợt, size cán và hình dáng

**Đoạn mở đầu:**

> Chọn vợt pickleball, hãy quyết định ba thông số trước: **trọng lượng**, **độ dày lõi** (13–14 mm hay 16 mm) và **chất liệu mặt** (sợi thuỷ tinh hay carbon/graphite). Sau đó mới chọn **size cán** (chu vi 105 mm ≈ 4 1/8 inch hoặc 108 mm ≈ 4 1/4 inch) và **hình dáng** (Standard, Hybrid hay Elongated). Hướng dẫn này của ThePickleHub giải thích từng thông số, cách chọn theo trình độ và cho người chơi nữ, kèm bảng thông số 21 mẫu vợt đang bán trên chợ với trọng lượng từ 213 g đến 230 g.
>
> *Cập nhật lần cuối: 13/10/2026*

### Chọn vợt theo trình độ

Không có cây vợt nào "tốt nhất" cho mọi người. Có cây vợt hợp với lối chơi và độ chín kỹ thuật của bạn ở thời điểm hiện tại.

**Người mới (vài tháng đầu):** ưu tiên vợt dễ kiểm soát, ít phạt cú đánh lệch tâm.
- Lõi 16 mm: bóng nảy ra êm và ổn định hơn.
- Dáng Standard: mặt rộng, vùng đánh tốt rộng hơn.
- Trọng lượng vừa phải. Trong bảng dưới, phần lớn mẫu nằm quanh 224–227 g. Nếu cổ tay hoặc khuỷu tay hay mỏi, xem các mẫu nhẹ hơn (213–220 g).
- Chưa cần chạy theo vợt mà vận động viên chuyên nghiệp dùng.

**Trình độ trung bình (đã dink, reset ổn định):** lúc này bạn đã biết mình thiên lực hay thiên kiểm soát.
- Thiên kiểm soát và chơi ở bếp: giữ lõi 16 mm.
- Muốn thêm lực ở cú drive, cú đánh từ cuối sân: thử lõi 13–14 mm.
- Có thể thử dáng Hybrid để có thêm tầm với mà không mất nhiều vùng đánh tốt.

**Thi đấu:** chọn theo vai trò trong đôi và kiểm tra **chứng nhận USA Pickleball** nếu giải yêu cầu (xem mục bên dưới). Người hay đánh hai tay bên trái thường để ý chiều dài cán (từ 133 mm trở lên). Người cần tầm với và lực đánh xoáy thường cân nhắc dáng Elongated.

👉 Lọc vợt theo độ dày lõi và chất liệu mặt tại [danh mục Vợt](/vi/shop/category/vot).

### Chọn vợt pickleball cho nữ

Giới tính không quyết định thông số vợt. Quyết định là **cỡ bàn tay**, **sức cổ tay/khuỷu tay** và **lối chơi**. Nhiều người chơi nữ có bàn tay nhỏ hơn mức trung bình, nên hai thông số đáng xem trước:

- **Size cán:** nếu bàn tay nhỏ, bắt đầu với chu vi **105 mm (≈ 4 1/8 inch)**. Trong bảng có 6 mẫu cán 105 mm: Addict Infinity, CRBN TruFoam TF1, Diadem Edge 18K, Proxr Sweet Spot, Six Zero Double Black Diamond, Six Zero Sapphire.
- **Trọng lượng:** nếu muốn vợt nhẹ tay, 4 mẫu nhẹ nhất trong bảng là Paddletek Tempest Wave Pro (213 g), Selkirk Amped Control (215 g), Selkirk Vanguard Control Invikta – Blue (218 g) và Selkirk Vanguard (220 g). Cả 4 đều có cán 108 mm. Nếu tay nhỏ, cầm thử trước khi mua.

Người chơi nữ đánh mạnh, thi đấu thường xuyên thì chọn theo trình độ như mục trên, không cần giới hạn ở vợt nhẹ.

Nếu đang bị đau khuỷu tay, đọc thêm [Đau khuỷu tay khi chơi pickleball](/vi/blog/dau-khuyu-tay-khi-choi-pickleball) trước khi đổi vợt.

### Chọn size cán vợt pickleball

Shop khai báo hai thông số cán khác nhau, dễ nhầm:

- **Chu vi cán (grip):** độ "to" của cán khi nắm. Các vợt trên ThePickleHub hiện có hai mức: **105 mm ≈ 4 1/8 inch** và **108 mm ≈ 4 1/4 inch**.
- **Chiều dài cán (handle):** từ 125 mm đến 140 mm trong bảng. Cán dài (135–140 mm) có chỗ cho trái tay hai tay. Cán ngắn (125–127 mm) giúp phần mặt vợt dài hơn trên cùng tổng chiều dài.

Cách thử nhanh chu vi cán: cầm vợt kiểu bắt tay (continental). Nếu khe giữa đầu ngón tay và gốc bàn tay vừa đủ đặt một ngón trỏ của tay còn lại, size đó vừa. Không đặt được ngón trỏ là cán to quá; còn dư nhiều là cán nhỏ quá.

**Đang phân vân giữa hai size: chọn cán nhỏ hơn (105 mm).** Cán nhỏ có thể làm to lên bằng cách quấn thêm overgrip, nhưng cán to thì không làm nhỏ lại được.

### Lõi 13–14 mm hay 16 mm?

Lõi là lớp tổ ong (thường bằng polymer) nằm giữa hai mặt vợt. Độ dày lõi quyết định cảm giác bóng rời vợt.

| | Lõi 13–14 mm | Lõi 16 mm |
|---|---|---|
| Cảm giác | Nảy hơn, "pop" hơn | Êm, đầm hơn |
| Lợi thế | Lực cho drive, đánh cuối sân | Kiểm soát dink, reset, chặn bóng |
| Đánh lệch tâm | Kém ổn định hơn | Ổn định hơn |
| Trong bảng ThePickleHub | 8 mẫu (13 mm: 2; 14–14,2 mm: 6) | 13 mẫu |

Chưa biết chọn gì thì chọn **16 mm**. Đây cũng là độ dày phổ biến nhất trong danh sách vợt đang bán.

### Mặt sợi thuỷ tinh hay carbon/graphite?

- **Sợi thuỷ tinh (fiberglass):** mặt dẻo hơn, bóng bật ra nhiều hơn, cho cảm giác có lực mà không cần vung mạnh. Trong bảng: Selkirk Vanguard, Selkirk Vanguard Control Invikta – Blue, Selkirk Amped Control (FiberFlex Fiberglass), Six Zero Sapphire.
- **Carbon fiber / graphite:** mặt cứng hơn, phản hồi rõ hơn, thiên về kiểm soát. Mặt carbon nhám giúp tạo xoáy. Phần lớn mẫu trong bảng dùng carbon (shop khai báo các tên "Carbon Fiber", "Carbon 18K", "Carbon Friction Surface"). Hai mẫu khai báo là graphite: Engage Pursuit MX Pro, Paddletek Tempest Wave Pro.

So sánh sâu hơn giữa graphite và carbon: [Vợt pickleball graphite hay carbon?](/vi/blog/vot-pickleball-graphite-hay-carbon)

### Hình dáng: Standard, Hybrid hay Elongated

- **Standard:** mặt rộng, vùng đánh tốt rộng nhất, xoay vợt nhanh khi đấu tay ở bếp. Lựa chọn an toàn cho người mới. 13 mẫu trong bảng.
- **Hybrid:** nằm giữa, dài hơn Standard một chút nhưng vẫn giữ mặt khá rộng. 3 mẫu: Holbrook Aero T, Proxr Sweet Spot, Six Zero Double Black Diamond.
- **Elongated:** mặt dài và hẹp hơn, thêm tầm với và đòn bẩy cho cú đánh và giao bóng, đổi lại vùng đánh tốt hẹp hơn. 5 mẫu: Diadem Edge 18K, Engage Pursuit MX Pro, Paddletek Tempest TKO-C, Selkirk Vanguard Control Invikta – Blue, Vatic Pro Prism V7 Flash Orange.

**Kích thước vợt pickleball chuẩn:** theo luật USA Pickleball, tổng chiều dài cộng chiều rộng (tính cả viền bảo vệ và nắp đuôi cán) không vượt quá 24 inch (≈ 61 cm), chiều dài không vượt quá 17 inch (≈ 43,2 cm). Luật không giới hạn độ dày và trọng lượng. (Luật 2.E.3 và 2.E.4)

### Chứng nhận USA Pickleball khi đánh giải

Giải chơi theo luật USA Pickleball chỉ cho dùng vợt có tên trong **danh sách vợt được phê duyệt** của USA Pickleball. Danh sách này có thể thay đổi theo từng model, nên trước giải hãy:

1. Đọc điều lệ giải xem có yêu cầu vợt được phê duyệt hay không. Nhiều giải phong trào không yêu cầu.
2. Tra đúng tên model trên [danh sách vợt được phê duyệt của USA Pickleball](https://equipment.usapickleball.org/paddle-list/).
3. Tìm dấu chứng nhận in trên vợt.

Theo thông tin shop khai báo, toàn bộ 21 mẫu có thông số trong bảng dưới đều có chứng nhận USA Pickleball. Riêng Komodo Katana chưa có thông tin.

Tìm giải để đăng ký: [Giải đấu pickleball](/vi/tournaments).

### Bảng thông số vợt đang bán trên ThePickleHub

Thông số do shop khai báo, lấy ngày 13/10/2026. Bảng **không ghi giá** vì giá thay đổi; xem giá và tồn kho trên trang từng sản phẩm. Bảng xếp theo độ dày lõi rồi đến trọng lượng, **không phải xếp hạng**.

| Vợt | Mặt | Lõi (mm) | Chu vi cán (mm) | Dài cán (mm) | Trọng lượng (g) | Dáng | USAP |
|---|---|---|---|---|---|---|---|
| [Selkirk Vanguard](/vi/shop/product/selkirk-vanguard) | Fiberglass | 13 | 108 | 125 | 220 | Standard | Có |
| [Six Zero Sapphire](/vi/shop/product/six-zero-sapphire) | Fiberglass | 13 | 105 | 127 | 224 | Standard | Có |
| [Paddletek Tempest Wave Pro](/vi/shop/product/paddletek-tempest-wave-pro) | Graphite | 14,2 | 108 | 133 | 213 | Standard | Có |
| [CRBN TruFoam TF1](/vi/shop/product/crbn-trufoam-tf1) | Carbon Fiber | 14 | 105 | 130 | 224 | Standard | Có |
| [Holbrook Aero T](/vi/shop/product/holbrook-aero-t) | Carbon Fiber | 14 | 108 | 130 | 224 | Hybrid | Có |
| [Holbrook Aero X](/vi/shop/product/holbrook-aero-x) | Carbon Fiber | 14 | 108 | 127 | 224 | Standard | Có |
| [Paddletek Tempest TKO-C](/vi/shop/product/paddletek-tempest-tko-c) | Carbon Fiber | 14 | 108 | 133 | 224 | Elongated | Có |
| [Proxr Sweet Spot](/vi/shop/product/proxr-sweet-spot) | Carbon Fiber | 14 | 105 | 135 | 226 | Hybrid | Có |
| [Selkirk Amped Control](/vi/shop/product/selkirk-amped-control) | FiberFlex Fiberglass | 16 | 108 | 127 | 215 | Standard | Có |
| [Selkirk Vanguard Control Invikta – Blue](/vi/shop/product/selkirk-vanguard-control-invikta-blue) | Fiberglass | 16 | 108 | 133 | 218 | Elongated | Có |
| [Engage Pursuit MX Pro](/vi/shop/product/engage-pursuit-mx-pro) | Graphite | 16 | 108 | 140 | 224 | Elongated | Có |
| [Selkirk Boomstick](/vi/shop/product/selkirk-boomstick) | Carbon Fiber | 16 | 108 | 133 | 224 | Standard | Có |
| [Six Zero Double Black Diamond](/vi/shop/product/six-zero-double-black-diamond) | Carbon Fiber | 16 | 105 | 140 | 224 | Hybrid | Có |
| [Vatic Pro Prism V7 Flash Orange](/vi/shop/product/vatic-pro-prism-v7-flash-orange) | Carbon Fiber | 16 | 108 | 133 | 224 | Elongated | Có |
| [Apes Pulse](/vi/shop/product/apes-pulse) | Carbon Fiber | 16 | 108 | 130 | 225 | Standard | Có |
| [Negin Olympus](/vi/shop/product/negin-olympus) | Carbon Friction Surface | 16 | 108 | 130 | 225 | Standard | Có |
| [Negin Phantom Limited](/vi/shop/product/negin-phantom-limited) | Carbon Friction Surface | 16 | 108 | 130 | 225 | Standard | Có |
| [Addict Infinity](/vi/shop/product/addict-infinity) | Carbon Fiber | 16 | 105 | 130 | 227 | Standard | Có |
| [Apes Harmony](/vi/shop/product/apes-harmony) | Carbon Fiber | 16 | 108 | 130 | 227 | Standard | Có |
| [Holbrook Power Pro](/vi/shop/product/holbrook-power-pro) | Carbon Fiber | 16 | 108 | 130 | 227 | Standard | Có |
| [Diadem Edge 18K](/vi/shop/product/diadem-edge-18k) | Carbon 18K | 16 | 105 | 130 | 230 | Elongated | Có |

[Komodo Katana](/vi/shop/product/komodo-katana) cũng đang bán, nhưng shop chưa khai báo thông số nên không có trong bảng.

Lọc nhanh theo nhu cầu (chỉ dựa trên thông số trong bảng):
- **Lõi 16 mm + dáng Standard** (kiểm soát, vùng đánh rộng): Selkirk Amped Control, Selkirk Boomstick, Apes Pulse, Apes Harmony, Negin Olympus, Negin Phantom Limited, Addict Infinity, Holbrook Power Pro.
- **Cán dài từ 135 mm** (trái tay hai tay): Proxr Sweet Spot (135), Engage Pursuit MX Pro (140), Six Zero Double Black Diamond (140).
- **Nhẹ nhất (≤ 220 g):** Paddletek Tempest Wave Pro, Selkirk Amped Control, Selkirk Vanguard Control Invikta – Blue, Selkirk Vanguard.

👉 Xem toàn bộ và lọc theo độ dày lõi, chất liệu tại [danh mục Vợt pickleball](/vi/shop/category/vot).

### Câu hỏi thường gặp

**Mới tập chơi pickleball nên mua vợt nào?**
Chọn vợt lõi 16 mm, dáng Standard, cán vừa tay (thử bằng ngón trỏ như mục size cán). Trọng lượng vừa phải; nếu cổ tay yếu thì chọn mẫu nhẹ. Chưa cần mua vợt thi đấu. Trong bảng trên, các mẫu lõi 16 mm dáng Standard là điểm bắt đầu để so sánh.

**Nên mua vợt pickleball loại nào: carbon hay sợi thuỷ tinh?**
Muốn bóng bật ra dễ, có lực mà không cần vung mạnh thì chọn sợi thuỷ tinh. Muốn kiểm soát, phản hồi rõ và dễ tạo xoáy thì chọn carbon/graphite. Phần lớn vợt đang bán trên ThePickleHub là mặt carbon.

**Cách chọn size cán vợt pickleball?**
Cầm vợt kiểu bắt tay. Nếu khe giữa đầu ngón tay và gốc bàn tay vừa một ngón trỏ, size đó vừa. Hai size phổ biến là 105 mm (≈ 4 1/8 inch) và 108 mm (≈ 4 1/4 inch). Phân vân thì chọn size nhỏ hơn rồi quấn thêm overgrip.

**Kích thước vợt pickleball chuẩn là bao nhiêu?**
Theo luật USA Pickleball, chiều dài cộng chiều rộng không quá 24 inch và chiều dài không quá 17 inch. Độ dày và trọng lượng không bị giới hạn. Vợt trong bảng trên nặng 213–230 g và có lõi dày 13–16 mm.

**Cách chọn vợt pickleball cho nữ?**
Chọn theo bàn tay và sức tay, không theo giới tính. Tay nhỏ thì bắt đầu với cán 105 mm. Muốn nhẹ tay thì xem các mẫu 213–220 g. Đánh mạnh, thi đấu thường xuyên thì chọn theo trình độ.

**Vợt pickleball được ưa chuộng nhất hiện nay là loại nào?**
ThePickleHub không có số liệu bán hàng để xếp hạng. Trong 21 mẫu có thông số đang bán, cấu hình phổ biến nhất là mặt carbon, lõi 16 mm, cán 108 mm, dáng Standard. Vợt phù hợp với bạn vẫn phụ thuộc trình độ và bàn tay.

**CTA cuối bài:** [Xem vợt pickleball trên chợ ThePickleHub](/vi/shop/category/vot) · Bài liên quan: [Vợt pickleball cho người mới 2026](/vi/blog/vot-pickleball-tot-nhat-cho-nguoi-moi-2026), [Cách chơi pickleball cho người mới](/vi/blog/cach-choi-pickleball-cho-nguoi-moi)

---

## 3. EN VERSION (viết lại, không dịch từng câu)

**Slug:** `how-to-choose-a-pickleball-paddle`
**Title (H1):** How to Choose a Pickleball Paddle: Weight, Core, Face, Grip and Shape

**Opening:**

> To choose a pickleball paddle, settle three specs first: **weight**, **core thickness** (13–14 mm vs 16 mm) and **face material** (fiberglass vs carbon/graphite). Grip circumference (105 mm ≈ 4 1/8" or 108 mm ≈ 4 1/4") and **shape** (standard, hybrid or elongated) come next. This ThePickleHub guide walks through each spec, by skill level and hand size, and compares the specs of 21 paddles listed in its marketplace, weighing 213–230 g (about 7.5–8.1 oz).
>
> *Last updated: October 13, 2026*

### Choosing by skill level

There is no single best paddle, only the right one for how you play right now.

- **New players:** a 16 mm core and standard shape are the forgiving default. The thicker core dampens off-center hits and the wide face gives the largest sweet spot. Most paddles in the table sit at 224–227 g (≈ 7.9–8.0 oz). If your wrist or elbow tires easily, look at the 213–220 g options.
- **Intermediate:** once your dinks and resets are consistent, your style tells you what to buy. Control players stay on 16 mm. Players chasing drive and put-away power try 13–14 mm. A hybrid shape adds a little reach without giving up much sweet spot.
- **Competitive:** buy for your role in doubles, and confirm USA Pickleball approval if the event enforces it. Two-handed backhand players should check handle length (133 mm and up). Players who want reach and leverage on serves and drives tend to try elongated shapes.

Filter by core and face in the [paddle category](/shop/category/vot).

### Paddles for players with smaller hands (and women's paddles)

"Women's paddle" is really a question about hand size, arm strength and playing style, not gender. Two specs matter most:

- **Grip circumference:** smaller hands usually start at **105 mm (≈ 4 1/8")**. Six paddles in the table have it: Addict Infinity, CRBN TruFoam TF1, Diadem Edge 18K, Proxr Sweet Spot, Six Zero Double Black Diamond, Six Zero Sapphire.
- **Weight:** the four lightest are Paddletek Tempest Wave Pro (213 g), Selkirk Amped Control (215 g), Selkirk Vanguard Control Invikta – Blue (218 g) and Selkirk Vanguard (220 g). All four have a 108 mm grip, so check the fit in hand.

Dealing with elbow pain? Read [Pickleball elbow pain: causes and safe steps](/blog/pickleball-elbow-pain-causes-safe-steps) before switching paddles.

### Grip size: circumference vs handle length

Paddle specs list two handle numbers that are easy to mix up:

- **Grip circumference** is how thick the handle feels. Paddles on ThePickleHub come in 105 mm (≈ 4 1/8") and 108 mm (≈ 4 1/4").
- **Handle length** ranges from 125 mm to 140 mm in the table. Long handles (135–140 mm) leave room for a two-handed backhand. Short handles (125–127 mm) give more of the overall length to the face.

Fit check: hold the paddle with a continental (handshake) grip. If the index finger of your other hand just fits in the gap between your fingertips and palm, the size is right. **If you're between sizes, go smaller.** An overgrip can build a handle up, but nothing can make a thick one thinner.

### Core thickness: 13–14 mm vs 16 mm

The polymer honeycomb core sets how the ball comes off the face. Thinner cores (13–14 mm) feel livelier and add pop for drives, but they're less stable on mishits. Thicker 16 mm cores feel softer and more stable, which helps dinks, resets and blocks. In the table, 13 paddles are 16 mm and 8 are 13–14.2 mm. If unsure, start at 16 mm.

### Face material: fiberglass vs carbon/graphite

Fiberglass faces flex more and launch the ball with less effort. That group is Selkirk Vanguard, Selkirk Vanguard Control Invikta – Blue, Selkirk Amped Control and Six Zero Sapphire. Carbon fiber and graphite faces are stiffer, give clearer feedback and lean toward control, and textured carbon helps spin. Most paddles here are carbon; the Engage Pursuit MX Pro and Paddletek Tempest Wave Pro are listed as graphite. For the full trade-off, see [Graphite vs carbon fiber pickleball paddles](/blog/graphite-vs-carbon-pickleball-paddle).

### Shape: standard, hybrid, elongated

- **Standard:** widest face, largest sweet spot, quickest in hand battles. 13 paddles in the table.
- **Hybrid:** a bit longer while keeping most of the width. Holbrook Aero T, Proxr Sweet Spot, Six Zero Double Black Diamond.
- **Elongated:** longer and narrower, with more reach and leverage but a smaller sweet spot. Diadem Edge 18K, Engage Pursuit MX Pro, Paddletek Tempest TKO-C, Selkirk Vanguard Control Invikta – Blue, Vatic Pro Prism V7 Flash Orange.

**Standard paddle dimensions:** under USA Pickleball rules, length plus width (including edge guard and butt cap) may not exceed 24 inches, and length may not exceed 17 inches. There is no limit on thickness or weight. (Rules 2.E.3 and 2.E.4)

### USA Pickleball approval for tournaments

Events played under USA Pickleball rules require a paddle on USA Pickleball's approved list, and that list changes model by model. Before an event, read the event rules (many local events don't enforce it), check your exact model on [USA Pickleball's approved paddle list](https://equipment.usapickleball.org/paddle-list/), and look for the approval mark on the paddle. According to the specs the shops supplied, all 21 paddles in the table below are approved. No information has been provided yet for the Komodo Katana. Find your next event in [Tournaments](/tournaments).

### Spec table: paddles listed in the ThePickleHub marketplace

Shop-supplied specs, retrieved October 13, 2026. No prices, since they change; check each product page. The table is sorted by core then weight. **This is not a ranking.**

| Paddle | Face | Core (mm) | Grip circ. (mm) | Handle (mm) | Weight (g / oz) | Shape | USAP |
|---|---|---|---|---|---|---|---|
| [Selkirk Vanguard](/shop/product/selkirk-vanguard) | Fiberglass | 13 | 108 | 125 | 220 / 7.8 | Standard | Yes |
| [Six Zero Sapphire](/shop/product/six-zero-sapphire) | Fiberglass | 13 | 105 | 127 | 224 / 7.9 | Standard | Yes |
| [Paddletek Tempest Wave Pro](/shop/product/paddletek-tempest-wave-pro) | Graphite | 14.2 | 108 | 133 | 213 / 7.5 | Standard | Yes |
| [CRBN TruFoam TF1](/shop/product/crbn-trufoam-tf1) | Carbon Fiber | 14 | 105 | 130 | 224 / 7.9 | Standard | Yes |
| [Holbrook Aero T](/shop/product/holbrook-aero-t) | Carbon Fiber | 14 | 108 | 130 | 224 / 7.9 | Hybrid | Yes |
| [Holbrook Aero X](/shop/product/holbrook-aero-x) | Carbon Fiber | 14 | 108 | 127 | 224 / 7.9 | Standard | Yes |
| [Paddletek Tempest TKO-C](/shop/product/paddletek-tempest-tko-c) | Carbon Fiber | 14 | 108 | 133 | 224 / 7.9 | Elongated | Yes |
| [Proxr Sweet Spot](/shop/product/proxr-sweet-spot) | Carbon Fiber | 14 | 105 | 135 | 226 / 8.0 | Hybrid | Yes |
| [Selkirk Amped Control](/shop/product/selkirk-amped-control) | FiberFlex Fiberglass | 16 | 108 | 127 | 215 / 7.6 | Standard | Yes |
| [Selkirk Vanguard Control Invikta – Blue](/shop/product/selkirk-vanguard-control-invikta-blue) | Fiberglass | 16 | 108 | 133 | 218 / 7.7 | Elongated | Yes |
| [Engage Pursuit MX Pro](/shop/product/engage-pursuit-mx-pro) | Graphite | 16 | 108 | 140 | 224 / 7.9 | Elongated | Yes |
| [Selkirk Boomstick](/shop/product/selkirk-boomstick) | Carbon Fiber | 16 | 108 | 133 | 224 / 7.9 | Standard | Yes |
| [Six Zero Double Black Diamond](/shop/product/six-zero-double-black-diamond) | Carbon Fiber | 16 | 105 | 140 | 224 / 7.9 | Hybrid | Yes |
| [Vatic Pro Prism V7 Flash Orange](/shop/product/vatic-pro-prism-v7-flash-orange) | Carbon Fiber | 16 | 108 | 133 | 224 / 7.9 | Elongated | Yes |
| [Apes Pulse](/shop/product/apes-pulse) | Carbon Fiber | 16 | 108 | 130 | 225 / 7.9 | Standard | Yes |
| [Negin Olympus](/shop/product/negin-olympus) | Carbon Friction Surface | 16 | 108 | 130 | 225 / 7.9 | Standard | Yes |
| [Negin Phantom Limited](/shop/product/negin-phantom-limited) | Carbon Friction Surface | 16 | 108 | 130 | 225 / 7.9 | Standard | Yes |
| [Addict Infinity](/shop/product/addict-infinity) | Carbon Fiber | 16 | 105 | 130 | 227 / 8.0 | Standard | Yes |
| [Apes Harmony](/shop/product/apes-harmony) | Carbon Fiber | 16 | 108 | 130 | 227 / 8.0 | Standard | Yes |
| [Holbrook Power Pro](/shop/product/holbrook-power-pro) | Carbon Fiber | 16 | 108 | 130 | 227 / 8.0 | Standard | Yes |
| [Diadem Edge 18K](/shop/product/diadem-edge-18k) | Carbon 18K | 16 | 105 | 130 | 230 / 8.1 | Elongated | Yes |

The [Komodo Katana](/shop/product/komodo-katana) is also listed, but its specs haven't been supplied, so it isn't in the table.

Quick filters (from the table only):
- **16 mm + standard:** Selkirk Amped Control, Selkirk Boomstick, Apes Pulse, Apes Harmony, Negin Olympus, Negin Phantom Limited, Addict Infinity, Holbrook Power Pro.
- **Handle 135 mm+:** Proxr Sweet Spot, Engage Pursuit MX Pro, Six Zero Double Black Diamond.
- **220 g or lighter:** Paddletek Tempest Wave Pro, Selkirk Amped Control, Selkirk Vanguard Control Invikta – Blue, Selkirk Vanguard.

### FAQ

**What paddle should a beginner buy?**
Start with a 16 mm core, a standard shape, a grip that passes the index-finger test, and a moderate weight. Go lighter if your wrist is sensitive. Skip pro-level power paddles for now.

**Fiberglass or carbon fiber: which face should I choose?**
Fiberglass gives easier pop with less swing. Carbon or graphite gives more control, clearer feedback and better spin on textured faces. Most paddles on ThePickleHub are carbon-faced.

**How do I choose the right grip size?**
Use a handshake grip. If one index finger fits between your fingertips and palm, the size fits. The common sizes are 105 mm (≈ 4 1/8") and 108 mm (≈ 4 1/4"). If you're between sizes, pick the smaller one and add an overgrip.

**What are the standard pickleball paddle dimensions?**
Under USA Pickleball rules, length plus width can be no more than 24 inches, with length capped at 17 inches. There's no limit on thickness or weight.

**What's the most popular pickleball paddle right now?**
ThePickleHub doesn't publish sales-based rankings. Among the 21 listed paddles with specs, the most common setup is a carbon face, 16 mm core, 108 mm grip and standard shape. The right paddle still depends on your level and hand.

**CTA:** [Browse pickleball paddles](/shop/category/vot) · Related: [Best pickleball paddles for beginners 2026](/blog/best-pickleball-paddles-beginners-2026), [How to play pickleball](/blog/how-to-play-pickleball)

---

## 4. SEO metadata

| Trường | EN | VI |
|---|---|---|
| slug | `how-to-choose-a-pickleball-paddle` | `cach-chon-vot-pickleball` |
| metaTitle | `How to Choose a Pickleball Paddle: Weight, Core, Grip` (53 byte) | `Cách chọn vợt pickleball: trọng lượng, lõi, cán` (59 byte) |
| metaDescription | `How to choose a pickleball paddle: weight, core thickness and face material first, then grip size and shape. Spec table of paddles on ThePickleHub.` (147 byte) | `Cách chọn vợt pickleball: trọng lượng, độ dày lõi, chất liệu mặt, size cán, dáng vợt; kèm bảng thông số trên ThePickleHub.` (154 byte) |
| focusKeyword | — | `cách chọn vợt pickleball` |
| Từ khoá phụ (VI) | — | chọn size cán vợt pickleball; kích thước vợt pickleball chuẩn; cách chọn vợt pickleball cho nữ; mới tập chơi pickleball nên mua vợt nào |
| ctaPath gợi ý | `/shop/category/vot` | `/vi/shop/category/vot` |
| updatedDate | 2026-10-13 | 2026-10-13 |

Số byte do agent đếm tay theo UTF-8 (chữ có dấu tiếng Việt chiếm 2–3 byte). **Cần đo lại bằng script/test SEO trước khi đăng.** metaTitle VI chỉ còn dư 1 byte.

## 5. Kiểm tra link nội bộ

| Đường dẫn | Trạng thái |
|---|---|
| `/vi/shop/category/vot`, `/shop/category/vot` | Route `/(vi/)shop/category/:slug` có trong `route-snapshot.json`; slug `vot` có trong `src/proto/shop/registry.tsx`. **Chưa xác nhận category `vot` có trên production và dùng chung slug cho EN** |
| `/vi/shop/product/<slug>` ×22, `/shop/product/<slug>` ×22 | Route có tồn tại; slug sản phẩm lấy từ yêu cầu. **Chưa xác nhận bản EN dùng cùng slug** |
| `/vi/blog/vot-pickleball-graphite-hay-carbon` | Theo yêu cầu. Không tìm thấy trong repo (bản VI nằm ở Supabase) → **cần xác minh** |
| `/blog/graphite-vs-carbon-pickleball-paddle` | Có trong `metadata.ts` |
| `/vi/blog/vot-pickleball-tot-nhat-cho-nguoi-moi-2026`, `/vi/blog/cach-choi-pickleball-cho-nguoi-moi` | Có trong `thepicklehub.net-audit/all-urls.tsv` |
| `/vi/blog/dau-khuyu-tay-khi-choi-pickleball` | Có trong danh sách `vi_posts` (published) của dữ liệu editorial |
| `/blog/pickleball-elbow-pain-causes-safe-steps`, `/blog/best-pickleball-paddles-beginners-2026`, `/blog/how-to-play-pickleball` | Có trong repo (file post / internalLinks bài cũ) |
| `/tournaments`, `/vi/tournaments` | Có trong `route-snapshot.json` |

## 6. Dữ kiện cần anh Cuong xác minh trước khi đăng

1. ~~Shop có cho Google index không~~ — CÓ: sitemap-shop.xml liệt kê đủ 62 URL, nghĩa là SHOP_PUBLIC_INDEXING=1 (Claude kiểm 13/10). Ghi chú cũ: `functions/robots.txt.ts` chặn `/shop/category` và `/shop/product` (cả VI) trừ khi `SHOP_PUBLIC_INDEXING === "1"`. Shop đã mở cho người mua (`SHOP_PUBLIC_OPEN = true`), nhưng agent không xem được biến môi trường production. Nếu vẫn đang chặn, link tới shop vẫn phục vụ người đọc nhưng không giúp SEO cho trang sản phẩm.
2. **Thông số shop khai báo:** cần đối chiếu với trang hãng, nhất là các điểm sau:
   - Paddletek Tempest Wave Pro lõi 14,2 mm.
   - Six Zero Sapphire và Selkirk Vanguard: mặt "Fiberglass", lõi 13 mm.
   - Engage Pursuit MX Pro và Six Zero Double Black Diamond: cán 140 mm.
   - Tên hãng không thống nhất giữa "Holbrook" và "Holbrook Pickleball".
   - Mỗi mẫu chỉ khai một con số trọng lượng, trong khi hãng thường công bố một khoảng.
3. **Chứng nhận USAP của cả 21 mẫu:** tra từng model trên danh sách vợt được phê duyệt của USA Pickleball. Bổ sung thông số cho Komodo Katana hoặc bỏ mẫu này khỏi bài.
4. ~~Luật kích thước vợt~~ — ĐÃ XÁC MINH 13/10 (2.E.3/2.E.4).
5. **Giải phong trào tại VN có yêu cầu vợt USAP không:** bài đang viết chung chung là "đọc điều lệ giải". Nếu có thông tin cụ thể từ BTC thì bổ sung.
6. ~~Slug VI bài graphite/carbon + category vot bản EN~~ — mọi link nội bộ trong bài trả 200 (Claude kiểm 13/10). Ghi chú cũ: (`vot-pickleball-graphite-hay-carbon`) và slug category `vot` cho bản EN.
7. URL bài news vị trí ~82 = `/vi/news/5-bi-quyet-chon-vot-pickleball-chuan-chuyen-gia-cho-nguoi-moi-bat-dau-rpeks0` (Claude tra GSC 13/10). Ghi chú cũ: cần tra trong GSC để quyết định xử lý.
8. **Duyệt việc sửa bài cũ** (mục 1): rút gọn phần thông số và thêm link sang bài trụ, cả bản VI (Supabase) và EN (file `.ts`).
9. **Ảnh hero:** chưa có. Cần ảnh thật hoặc minh hoạ không gắn với model cụ thể.
10. Mẹo đo cán bằng ngón trỏ và lời khuyên "phân vân thì chọn cán nhỏ, quấn thêm overgrip": đây là kinh nghiệm phổ biến, không có nguồn đo lường. Nếu muốn, có thể bổ sung trích dẫn từ trang hướng dẫn của hãng.
