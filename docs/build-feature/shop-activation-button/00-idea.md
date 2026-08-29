# Ý tưởng gốc (2026-08-16)

Kế hoạch do Cuong đề xuất cho giai đoạn tiếp theo của Shop (sau khi Closed Pilot đã lên production 16/08 — PR #578 `4ea32d3e` + Wave-0-fixes #580 `c6c043b2`):

1. **Làm nút kích hoạt shop** (nhỏ, ~1 buổi) — hiện đang kích hoạt bằng script tạm, cần UI thật cho admin.
2. **Cuong lo legal review song song** — không chặn việc code nút.
3. **Mở Wave 1 với 3-5 seller quen** → soak 2-4 tuần theo phễu 3 số.
4. **Chỉ bàn P3a (giỏ hàng / đơn hàng)** khi có tín hiệu seller thật cần nó.

**Câu hỏi kèm theo:** "Nếu làm luôn full feature shop thì sao?" — tức so sánh phương án đi từng bước ở trên với phương án build luôn toàn bộ (giỏ hàng, đơn hàng, thanh toán…) ngay bây giờ.

## Bối cảnh đã biết (từ memory)

- Shop Closed Pilot đã hoàn tất trên production 16/08: ledger prod 350/staging 361, lỗ P1 leak đã đóng (42501), publish wiring + test.
- Việc CÒN LẠI được ghi rõ: nút Kích hoạt shop (đang dùng script tạm).
- **Wave 1 + indexing đang CẤM, chờ Product Owner (PO) duyệt** — kế hoạch trên chính là đề xuất trình tự để mở khóa.
- Bài học pilot: "harness làm hộ UI = che dây chưa nối" — tức UI kích hoạt thật là mắt xích còn thiếu.
