# Intake — referee-pin

**Ngày:** 2026-07-22
**Ý tưởng (nguyên văn Cuong):** tạo PIN code hoặc mật khẩu cho giải đấu tại các chức năng trên /tools bao gồm Doubles Eli, Team match, quick-table, Flex. Khi người dùng bất kì nhập PIN code, người đó sẽ trở thành trọng tài của giải, không cần thiết phải thêm trọng tài thủ công như hiện tại (vẫn giữ).

## Trả lời làm rõ (AskUserQuestion 2026-07-22)

1. **Auth:** Người nhập PIN **phải đăng nhập** tài khoản ThePickleHub. PIN + tài khoản → gắn quyền trọng tài vào user_id, audit được ai chấm.
2. **Quyền hạn:** Trọng tài vào bằng PIN có quyền **đúng bằng trọng tài thủ công hiện tại** — không hơn không kém.
3. **Vòng đời PIN:** Organizer bật/tắt + đổi được, **đưa luôn vào màn hình setup giải** (wizard), **tự hết hạn khi kết thúc giải (có nhà vô địch)**. (Cuong ghi thêm qua "Other"-style note trong câu trả lời.)

## Phạm vi

4 format trên /tools: Doubles Elimination, Team Match, Quick Table, Flex. Cơ chế thêm trọng tài thủ công hiện tại **vẫn giữ**, PIN là đường bổ sung.
