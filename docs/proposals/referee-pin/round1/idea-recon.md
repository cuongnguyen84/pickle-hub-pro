# idea-recon — referee-pin (2026-07-22, nguyên văn)

## Prior art

**Ý tưởng này đã có intake, chưa có code.** `docs/proposals/referee-pin/00-intake.md` (4 dòng, ngày 2026-07-22) — chính là bản ghi lại clarifications trong task này (auth phải login, quyền = trọng tài thủ công, PIN sống trong wizard setup, tự hết hạn khi có nhà vô địch). Chưa có round1/proposal.md nào — dừng ở intake.

Cơ chế trọng tài thủ công **đã tồn tại đầy đủ và đồng nhất cho cả 4 format** — đây là 70% nền tảng của ask (chỉ thiếu lối vào bằng PIN).

## Touch surface (likely)

- `src/lib/referee-helpers.ts:1-140` — helper dùng chung cho cả 4 bảng referee (fetch/add-by-email/remove/exists); PIN flow sẽ cần một hàm `addRefereeByPin`-kiểu tương tự ở đây.
- `src/hooks/useDoublesEliminationReferees.ts`, `useFlexTournamentReferees.ts`, `useRefereeManagement.ts` (quick table), `useTeamMatchRefereeManagement.ts` — 1 hook riêng mỗi format, đều gọi chung `referee-helpers.ts`.
- `src/components/quicktable/RefereeManagement.tsx:1-244` — UI "add by email" hiện tại, dùng chung cho Quick Table + Doubles Elim theo comment dòng 6.
- `src/pages/DoublesEliminationSetup.tsx`, `src/pages/FlexTournamentSetup.tsx`, `src/pages/QuickTableSetup.tsx`, `src/pages/TeamMatchSetup.tsx` — 4 màn setup/wizard, nơi Cuong muốn gắn PIN.
- `src/components/teamMatch/TeamMatchSettingsDialog.tsx:134-310` — dialog settings sẵn có với pattern `<Switch>` toggle (dòng 180, 272) — mẫu UI toggle bật/tắt sẵn dùng được.
- `src/pages/Tools.tsx:1-80` — landing /tools, list 4 format, không có logic referee.

## Data

- 4 bảng referee riêng biệt, cùng shape `{id, <fk>, user_id, created_at}`: `doubles_elimination_referees`, `flex_tournament_referees`, `quick_table_referees`, `team_match_referees` (`src/integrations/supabase/types.ts:1120, 2498, 5169, 6376`).
- RLS: chỉ creator được INSERT/DELETE referee row (`supabase/migrations/20251224070047_...sql` — policy "Creator can add referees" dùng `is_quick_table_creator`). Mỗi format có RPC `is_<format>_referee` + `is_<format>_creator` SECURITY DEFINER (types.ts:8242-8300) dùng trong RLS của bảng match/score để cho phép UPDATE.
- Quyền trọng tài = được UPDATE bảng match/score của format đó (ví dụ policy "Matches can be updated by creator or referee" trên `quick_table_matches`) — KHÔNG có quyền nào khác (không sửa participants/settings).
- Status "giải kết thúc" theo enum: `quick_table_status: "completed"`, `team_match_status: "completed"` (types.ts:8800, 8810). Doubles Elim và Flex dùng cột `status: string` tự do (không enum) — **không tìm thấy giá trị "completed" cứng hoặc cột `champion`/`winner` riêng nào**; Doubles Elim có `final_placement` trên bảng teams (`doubles_elimination_teams`), placement=1 suy ra vô địch nhưng không có cột tournament-level đánh dấu trực tiếp.
- Invite-code prior art (bài học từ #430): `team_match_teams.invite_code`, `match_proposal_invitations.invite_code`, `quick_table_partner_invitations.invite_code` — đều là **join secret cho player**, không liên quan referee. Migration `supabase/migrations/20260722000000_team_match_invite_code_lockdown.sql` cho thấy secret column KHÔNG được để lộ qua `select('*')`/blanket GRANT — phải REVOKE + GRANT theo cột cụ thể (bài học cho bất kỳ cột PIN nào thêm vào 4 bảng tournament).
- `phone-otp-send`/`otp_codes` (`supabase/functions/phone-otp-send/index.ts`) có pattern mã ngắn + rate-limit + TTL nhưng dùng cho SMS OTP không đăng nhập, khác trục (không gắn user_id).

## Binding constraints found

- `docs/proposals/referee-pin/00-intake.md:8-10` — đã chốt: login bắt buộc, quyền = đúng bằng thủ công hiện tại (không hơn), PIN nằm trong setup wizard, tự hết hạn khi có nhà vô địch.
- `supabase/migrations/20260722000000_team_match_invite_code_lockdown.sql:9-17` — "An invite code is a join secret... RLS is ROW-level and cannot hide COLUMNS" — cột PIN mới phải theo cùng cảnh giác cột-level ngay từ đầu, không phải vá sau.
- CLAUDE.md không có mục riêng cho referee/PIN.

## Test coverage today

- `src/lib/__tests__/refereeLiveState.test.ts`, `refereeManualMode.test.ts`, `refereeManualSets.test.ts`, `refereeScoring.test.ts` — cover engine chấm điểm, KHÔNG cover cơ chế cấp quyền referee (add/remove) hay RLS.
- Không tìm thấy test cho `referee-helpers.ts` hay 4 hook quản lý referee.
- Gap: chưa có test nào cho luồng "PIN → trở thành referee" vì chưa build.

## Bilingual surface

- `RefereeManagement.tsx` dùng `useI18n()` → `t.referee` namespace trong `src/i18n/en.ts` / `src/i18n/vi.ts` — PIN UI sẽ thêm string vào namespace này.
- Toast strings referee nằm rải rác từng hook (`tStandalone('toast.referee...')`) chứ không tập trung ở `referee-helpers.ts` (comment dòng 20-21 nói rõ đây là chủ đích, do W3.1).

## Unknowns worth asking Cuong

- Doubles Elim / Flex không có cột trạng thái "completed" chuẩn hoá (chỉ string tự do + `final_placement` cấp team) — cần biết dựa vào tín hiệu nào để tự động hết hạn PIN cho 2 format này.
- Native `/apple` (`RefereeScoringView.swift`, `apple/docs/referee-live-scoring-spec.md`) chấm điểm live nhưng không rõ có UI thêm-referee nào phía native hay chỉ dùng danh sách đã cấp từ web — cần biết PIN có bắt buộc parity native ngay hay web-only trước.
