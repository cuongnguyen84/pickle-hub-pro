# Intake — shop-marketplace

**Ngày:** 2026-08-09
**Nguồn ý tưởng:** docs/proposals/shop-marketplace-plan.md (plan 25 mục, do Cuong chuẩn bị 2026-08-09)
**Yêu cầu:** phân tích trước, CHƯA code. Phạm vi đánh giá: tính khả thi, rủi ro, phạm vi MVP (Phase 0 + vertical slice Phase 1: seller application + admin review).

## Trả lời của Cuong

1. **Pilot seller:** Có 1-3 shop quen rồi (đã có seller cụ thể sẵn sàng thử).
   → Hệ quả thiết kế: self-serve seller application flow KHÔNG bắt buộc cho MVP — admin tạo shop tay cho seller đầu là lựa chọn hợp lệ cần panel cân nhắc.

2. **Pháp lý:** Đã có pháp nhân. (Trạng thái đăng ký sàn TMĐT với Bộ Công Thương chưa xác nhận — vẫn là launch gate cho public, nhưng không chặn code chạy song song.)

3. **Thước đo thành công pilot:** Seller thật chịu đăng bán — số shop được duyệt + số sản phẩm thật được đăng. Đo cung trước, cầu sau.

## Ràng buộc kế thừa từ plan gốc (mục 0)

- Không đánh dấu đơn "paid" chỉ vì hiển thị/quét VietQR.
- Không thêm item thứ 6 vào bottom nav mobile (5 slot).
- Không thêm `seller` vào global app_role — dùng shops.owner_user_id + shop_members.
- Không lộ giấy tờ/bank seller qua bucket public hay RLS lỏng.
- Không bịa metrics/testimonials/ratings.
- Không auto-payout trước khi duyệt mô hình pháp lý.
- Mọi chuyển trạng thái tài chính: server-authorized, atomic, auditable.
