// ============================================================================
// Cổng chợ — một công tắc, và nó là công tắc DUY NHẤT.
// ----------------------------------------------------------------------------
// Đóng ở TẦNG ĐƯỜNG ĐI, không phải ở cái nút. Giấu một nút không đóng được cửa:
// chợ còn lối vào từ nav trên, chân trang, liên kết đã chia sẻ và kết quả tìm
// kiếm. Cổng đặt ở route nên mọi lối vào đều tới cùng một trang.
//
// 🔴 CẶP CỜ PHẢI ĐI CÙNG NHAU. `SHOP_PUBLIC_INDEXING` (biến môi trường của
// Cloudflare Pages, hiện TẮT trên production) quyết định BOT thấy gì. Cờ dưới
// đây quyết định NGƯỜI thấy gì. Bật cờ bot trong khi cờ này còn `false` nghĩa
// là Googlebot đọc được trang sản phẩm thật còn người dùng thấy "đang hoàn
// thiện" — đó là cloaking, và Google phạt đúng chuyện đó. Mở thì mở cả hai.
// ============================================================================

/**
 * `false` = người dùng thường thấy trang "đang hoàn thiện" khi vào mọi lối
 * duyệt chợ. Quản trị viên vẫn đi xuyên qua được, vì người phải sửa chỗ hỏng
 * cần nhìn đúng cái người mua sẽ nhìn.
 *
 * Kênh người bán (`/seller/*`) KHÔNG bị cổng này chặn: đóng cửa hàng mà khoá
 * luôn phòng kho thì không sửa được hàng để mở lại.
 *
 * Trang tra cứu đơn (`/shop/orders`, `/shop/order/:code`) cũng không bị chặn —
 * đã có một đơn thật chạy qua chợ, và đóng cửa không có nghĩa là bỏ rơi người
 * đã mua.
 */
export const SHOP_PUBLIC_OPEN = true;
