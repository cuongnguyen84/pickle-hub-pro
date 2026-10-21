# Intake — live-viewer-count-comparison

**Ngày:** 2026-08-06
**Nguồn:** Cuong, nguyên văn qua /idea

## Ý tưởng

> em tìm hiểu cách tính số người xem live hiện tại và so sánh với cách tính sau. Chỉ cần tính đủ đúng và đủ nhanh. 3 bước: 1 - ô nóng, 2 - đếm người, 3 - ai rời đi. Đưa ra đánh giá so sánh 2 cách tính. Cách nào thuận tiện hơn và ít tốn tài nguyên database hơn.

## Diễn giải

- **Nhiệm vụ:** nghiên cứu so sánh, KHÔNG phải build feature ngay. Output = đánh giá 2 cách tính viewer count cho livestream.
- **Cách A (hiện tại):** cần recon xác định chính xác cách repo đang đếm số người xem live.
- **Cách B (đề xuất của Cuong):** mô hình 3 bước
  1. **Ô nóng** — bucket/ô thời gian "nóng" (hot cell) ghi nhận hoạt động xem
  2. **Đếm người** — đếm distinct viewer trong ô nóng
  3. **Ai rời đi** — phát hiện viewer rời (hết heartbeat / ra khỏi ô)
- **Tiêu chí so sánh (Cuong đặt):** chỉ cần "đủ đúng và đủ nhanh"; cái nào **thuận tiện hơn** và **ít tốn tài nguyên database hơn**.

## Không hỏi thêm

Bỏ qua AskUserQuestion: tiêu chí đánh giá đã nêu rõ trong đề bài, phần còn lại (hiện trạng) đọc repo là ra. Không có quyết định thiết kế nào cần Cuong trả lời trước khi phân tích.
