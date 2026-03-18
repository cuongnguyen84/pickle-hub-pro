

## Vấn đề
Trên trang /live, phần thông tin creator bên dưới title card hiển thị avatar quá nhỏ (16x16px) và tên bị cắt ngắn ("TAPickleb...") do `line-clamp-1` trên container quá hẹp.

## Giải pháp
Tăng kích thước avatar và cho phép tên creator hiển thị đầy đủ hơn trong LiveCard:

### Thay đổi trong `src/components/content/LiveCard.tsx` (phần Info, dòng 144-195):
1. **Avatar lớn hơn**: Tăng từ `w-4 h-4` (16px) lên `w-5 h-5` (20px), fallback text từ `text-[8px]` lên `text-[10px]`
2. **Tên creator không bị cắt**: Bỏ `line-clamp-1`, thay bằng `truncate` trên container rộng hơn hoặc cho phép wrap text để hiển thị đầy đủ tên organization
3. **Layout rõ ràng hơn**: Đảm bảo avatar + tên + badge check nằm trên cùng một hàng, tên được phép chiếm hết chiều rộng còn lại

Thay đổi nhỏ, chỉ ảnh hưởng CSS/class trong 1 file.

