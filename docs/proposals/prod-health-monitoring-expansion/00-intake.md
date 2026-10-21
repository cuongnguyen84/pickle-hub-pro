# Intake — prod-health-monitoring-expansion

**Ý tưởng (nguyên văn Cuong):** kiểm tra job gửi tin nhắn trạng thái các job và edge function, gợi ý thêm cần check trạng thái cái gì nữa để production luôn hoạt động hoàn hảo.

**Ngày:** 2026-08-04. **Người dùng:** admin (Cuong) — đây là tooling ops nội bộ, không phải feature end-user.

## Trả lời làm rõ

1. **Kênh báo:** Realtime hết — job nào fail là báo Telegram ngay (không chờ digest sáng).
2. **Phạm vi:** Chỉ giám sát, gửi tin qua Telegram. **Đã có nút fix trên Telegram để sửa luôn** (theo Cuong). Yêu cầu tường minh: *"Em xem lại job telegram đang giám sát những gì trước khi thực hiện"* — phải audit hiện trạng trước, đề xuất sau.

## Ràng buộc đã biết (từ memory/repo, không cần hỏi)

- GitHub Actions budget từng cạn, 8 cron workflow đang TẮT tiết kiệm tiền → giải pháp mới nên tránh lệ thuộc Actions cron.
- Bài học secret-sync loop + heal-loop đốt ~12.4k phút/tháng → mọi vòng lặp giám sát phải có cooldown, không auto-heal bừa.
- Nhánh hiện tại `agent/admin-job-health-digest`, commit fe22c754 vừa thêm admin job health dashboard + morning digest — recon phải map cái này.
- Thành công = mọi job/edge function chết đều được báo Telegram trong vài phút, không sự cố nào "chết câm" nhiều ngày như push_tokens (4 tháng) hay us-east-1 404 (3 ngày).
