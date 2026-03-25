

# Thay OG Image cho Share Links

## Vấn đề
Ảnh thumbnail `og-image.png` hiện tại có hình quả bóng pickleball trên nền đen, trông không đẹp khi share trên Zalo/Facebook.

## Giải pháp
Tạo ảnh OG mới (1200x630px) đơn giản, chỉ hiển thị text **"ThePickleHub"** trên nền gradient xanh lá sạch sẽ, không có hình quả bóng.

### Cách thực hiện
1. Dùng AI image generation (Nano banana) để tạo ảnh OG 1200x630 với:
   - Nền gradient xanh lá (brand color)
   - Text "ThePickleHub" lớn, đậm, trắng, canh giữa
   - Tagline nhỏ phía dưới: "Pickleball Tournaments & Livestream"
   - Không có hình quả bóng hay logo phức tạp
2. Lưu vào `public/og-image.png` thay thế file cũ
3. Không cần sửa edge functions vì chúng đã reference đúng URL `https://thepicklehub.net/og-image.png`

### Kết quả
- Tất cả share links (quick-table, flex-tournament, doubles-elimination, live, video) sẽ tự động dùng ảnh mới
- Không cần deploy lại edge functions hay worker

