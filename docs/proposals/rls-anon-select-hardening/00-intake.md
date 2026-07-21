# Intake — rls-anon-select-hardening

Ngày: 2026-07-21. Nguồn: handoff phiên 2026-07-21b (defect phụ #2, phát hiện khi ship #429).

## Ý tưởng nguyên văn

Siết RLS anon SELECT trên `team_match_teams` — defect sống: anon key query `select=*` trả về cả `invite_code`, `captain_user_id`, `payment_status` (đã verify live trên prod trong phiên 2026-07-21b). Badge reg-count (#429) không lộ vì chỉ head/select cột đếm, nhưng bất kỳ client nào dùng pattern `select=*` là lộ `invite_code` → người lạ join team bằng mã mời, kèm PII captain.

## Mục tiêu

- Giới hạn cột SELECT cho anon / authenticated-non-member xuống tập cột an toàn (id, tournament_id, team_name, team_status, …).
- Giữ quyền đọc đầy đủ cho captain / thành viên team / organizer.
- Không phá consumer hiện có: web prod + native `/apple`.
- Rà các bảng chị em: `team_match_players`, `team_match_games`, `quick_table_registrations`, `quick_table_teams` — leak tương tự?

## Không hỏi Cuong câu nào

Đây là fix defect bảo mật đã xác nhận, không phải feature: người dùng = mọi client anon, đau = leak sống, thành công = anon `select=*` không còn trả cột nhạy cảm trong khi mọi flow hiện có vẫn chạy, ràng buộc = web + native không gãy. Không có câu hỏi nào mà câu trả lời đổi thiết kế mà đọc repo không tự trả lời được.

## Bối cảnh kỹ thuật sẵn có

- Badge #429 đọc `team_match_teams` bằng head/count + cột hẹp (`src/lib/registrationCounts.ts`) — không được phá.
- Defect phụ #1 cùng phiên (liên quan, KHÔNG thuộc scope): toggle `auto_approve_registrations` là dead code.
- Migration prod áp qua Management API PAT (standing authorization, xem memory `supabase-migrations-auto-apply`), ledger drift #427 đang tồn tại — migration mới phải ghi row `schema_migrations` đúng cách.
