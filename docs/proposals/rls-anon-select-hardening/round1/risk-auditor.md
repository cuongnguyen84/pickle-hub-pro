# risk-auditor — rls-anon-select-hardening (nguyên văn)

Đủ dữ kiện. Tất cả claim load-bearing đã verify trong repo. Đây là báo cáo Rủi ro cho proposal.

---

## Verdict: 🔴 RED
Migration REVOKE `payment_status`/`captain_user_id` chạy trên prod DB (tức thì qua Management API) trong khi binary iOS đã cài **đặt tên các cột đó trong câu truy vấn công khai** → PostgREST trả `42501`, làm hỏng **toàn bộ** màn hình team-match của mọi user native, không có nút rollback (chờ App Store review).

Classifier said: RED · Em giữ nguyên RED (migration prod = không revert bằng `git revert`). Không hạ được; chỉ REFINE phạm vi: **chỉ `invite_code` là revoke được an toàn — `payment_status` và `captain_user_id` thì KHÔNG.**

## Rủi ro cụ thể

| # | Mức | Cơ chế hỏng | Người dùng thấy gì | Giảm thiểu |
|---|-----|-------------|--------------------|------------|
| 1 | **Cao** | `TeamMatchRepository.swift:45` — danh sách team **công khai** (chỉ lọc `tournament_id`, chạy mỗi lần mở tournament) `select("...payment_status...")`. REVOKE `payment_status` → Postgres từ chối **cả câu lệnh** `42501` (không phải bỏ 1 cột). Binary đã cài không update được. | iOS: mở bất kỳ giải team-match nào → danh sách đội trống / kẹt loading / báo lỗi mạng. **Vĩnh viễn** cho tới khi App Store duyệt bản mới. | **KHÔNG revoke `payment_status`.** Giữ nguyên GRANT cột này cho anon/authenticated. |
| 2 | **Cao** | `TeamMatchRepository.swift:426-427` truy vấn đội-của-captain `select("...payment_status")`, và `:383/394` dùng `captain_user_id`. Postgres yêu cầu `SELECT` privilege cho **mọi cột được nêu tên**, kể cả trong `.eq()`/WHERE — row-scoping KHÔNG miễn trừ. | iOS captain: không tải được đội mình đăng ký. | **KHÔNG revoke `captain_user_id`.** Cột này là UUID (email/phone đã khoá ở profiles từ 2026-07-06) → mức nhạy cảm thấp, không đáng đánh đổi. |
| 3 | **TB** | Web hook `useTeamMatchTeams.ts:62,83` dùng `select('*')` → PostgREST expand `*` thành tập cột được phép, **degrade êm** (không lỗi). Nhưng `TeamRosterManager.tsx:358` hiện nút chia sẻ mã mời từ `team.invite_code`; revoke `invite_code` → field thành `undefined`. | Web captain/organizer: mất nút "chia sẻ mã mời" → không mời được đồng đội. Đây là phá **chính luồng mời** mà ta đang đi vá. | Migration **phải** kèm RPC `SECURITY DEFINER get_team_invite_code(team_id)` gate theo captain/organizer + sửa `TeamRosterManager`/`TeamDetailSheet` dùng RPC. Ship client TRƯỚC, revoke SAU. |
| 4 | **TB** | Web organizer `MyTournaments.tsx:229` `select('payment_status').eq('tournament_id',...)` — cột được nêu tên. Nếu revoke `payment_status` khỏi `authenticated` → `42501`, throw (retry:false). | Organizer web: dialog "xoá giải" báo lỗi thay vì hiện số đội đã trả tiền. | Hệ quả trực tiếp của quy tắc #1 — không revoke `payment_status`. |
| 5 | **Thấp** | Badge #429 `registrationCounts.ts:44-46` `select('tournament_id').eq('status','approved')`. An toàn **miễn là** `tournament_id` + `status` vẫn nằm trong grant list. | Badge social-proof biến mất trên `/tournaments` nếu quên grant lại 2 cột này. | Đưa `id, tournament_id, team_name, status, seed, group_id, created_at` vào GRANT re-list bắt buộc. |
| 6 | **Thấp** | Realtime: `useTeamMatchRealtime.ts` sub `team_match_games`; `TeamManager.tsx:261`/`RegistrationManager.tsx:238` sub `quick_table_*`. Realtime WAL không đọc qua column-grant nhưng payload replicate theo REPLICA IDENTITY — không phá bởi REVOKE SELECT. | Không ảnh hưởng trực tiếp. | Chỉ cần audit, không hành động. |

## SLO bị đe doạ
- **SLO 1 (Availability)**: gián tiếp — native team-match view = trắng/lỗi cho toàn bộ user iOS đã cài. Không tính vào smoke Playwright (web) nên **sẽ không bị bắt trước khi lan rộng**.
- **SLO 3 (Registration)**: luồng captain mời đồng đội (web #3, native #2) gãy → đăng ký đội team-match không hoàn tất.
- Rủi ro **KHÔNG làm**: `invite_code` đang leak sống — người lạ biết mã join được đội bất kỳ + lộ `captain_user_id`. Đây là lý do phải làm, nhưng chỉ phần `invite_code`, không phải cả 3 cột.

## Ngân sách hiệu năng
- Bundle: **+0 KB** nếu chỉ thêm migration + RPC (server-side). Sửa client dùng RPC ~ vài dòng, không đụng dependency. Không đe doạ trần 1970 KB.
- Vietnam p75: không ảnh hưởng (không thêm render/waterfall trên `/feed` hay match page).

## SEO
- Routes SSR bị ảnh hưởng: **none**. Không đụng `functions/_middleware.ts`, `_lib/render/`, sitemap, blog-meta.
- Cần bump `pr:v30`? **Không** — không thay đổi output SSR.
- (Không cần curl Googlebot cho change này.)

## Kế hoạch rollback
- Cơ chế: `REVOKE`/`GRANT` **transactional, revert sạch** ở tầng ACL — re-GRANT table-level SELECT khôi phục ngay (kèm khôi phục cả leak). RPC `DROP`/`CREATE` được.
- **KHÔNG revert được** (đây là cái làm nó RED):
  - Binary iOS đã cài — nếu revoke `payment_status`/`captain_user_id` gây `42501`, không có `git revert`; user hỏng cho tới khi App Store duyệt bản mới (ngày, không phải phút).
  - Invite code đã bị scrape trước khi vá — revoke không vô hiệu hoá mã cũ; muốn sạch phải **rotate `invite_code`** cho các đội hiện có + rà thành viên lạ đã join.
  - Session lỗi user đã gặp trong khoảng hỏng.
- Thời gian khôi phục (ACL): vài giây. Thời gian khôi phục (native nếu lỡ revoke sai): nhiều ngày.

## Phải verify trước khi merge
- [ ] Migration **KHÔNG** chứa REVOKE nào khiến `payment_status` / `captain_user_id` mất grant cho `anon`+`authenticated` (grep migration). Grant re-list phải chứa 2 cột này.
- [ ] Grant re-list chứa mọi cột client filter/order/select tên: `id, tournament_id, team_name, status, seed, group_id, created_at` (+ 2 cột trên). Cột duy nhất bị bỏ = `invite_code` (+ có thể `master_team_id`, `updated_at` nếu không consumer nào nêu tên — verify grep trước).
- [ ] RPC `get_team_invite_code(team_id)` SECURITY DEFINER, gate `is_team_captain(...) OR is_team_match_creator(...) OR is_admin()`, GRANT EXECUTE cho authenticated.
- [ ] **Thứ tự deploy expand-then-contract**: (1) áp migration additive chỉ TẠO RPC, chưa revoke; (2) deploy web client dùng RPC (`TeamRosterManager`/`TeamDetailSheet`); (3) xác nhận SPA mới live; (4) mới áp migration contract revoke `invite_code`. **Tuyệt đối không revoke-first.**
- [ ] Ledger drift #427: migration mới phải ghi đúng row `schema_migrations`, verify deploy-guard không chặn — kiểm trước khi áp qua Management API.
- [ ] pgTAP: thêm case cho `team_match_teams` vào `rls_auth_matrix.test.sql` (gap hiện tại: 0 coverage cho cả 5 bảng) — assert anon KHÔNG đọc được `invite_code`, VẪN đọc được `tournament_id`/`status`.
- [ ] Sibling `team_match_games` / `quick_table_registrations` / `quick_table_teams`: nếu đưa vào scope, grep **mọi** projection/filter/order native trước khi revoke bất kỳ cột nào (`team_match_games` có `live_referee_id`, `referee_live_state`, `dupr_match_code` — native TeamMatchScoring có thể nêu tên). Mặc định: **để ngoài scope đợt này**, chỉ vá `invite_code` trên `team_match_teams`.

## Phản biện độc lập (GPT-5.6)
- **Đã xác minh trong repo (survived checking):**
  - GPT xác nhận cơ chế #1/#2: Postgres từ chối **cả câu lệnh** `42501` khi thiếu `SELECT` privilege cho cột được nêu tên, kể cả cột chỉ dùng trong WHERE/`.eq()`/ORDER BY/RETURNING; row-scoping và RLS KHÔNG miễn trừ. Khớp với `TeamMatchRepository.swift:45,426`.
  - GPT xác nhận `payment_status`/`captain_user_id` **không thể revoke** dưới hợp đồng client native bất biến; chỉ `invite_code` revoke được, và chỉ sau khi web đã chuyển sang RPC. Khớp phân tích của em.
  - GPT nhấn: re-GRANT phải phủ mọi cột client filter/order, không chỉ cột trả về; và invite_code đã leak phải **rotate** chứ revoke không vô hiệu mã cũ. Bổ sung đúng, em đưa vào checklist rollback.
  - Thứ tự expand-then-contract của GPT trùng khớp — em coi đây là điều kiện bắt buộc để hạ mức phá vỡ.
- **Bác bỏ / không áp dụng:**
  - GPT cảnh báo (#6) "revoke cột invite_code/state của `quick_table_*` sẽ phá luồng đăng ký no-login qua invite link". **Không áp dụng** với scope đề xuất: mã mời QuickTable sống ở bảng RIÊNG `quick_table_partner_invitations` (đã verify `QuickTableRepository.swift:110-115` + recon), **không** nằm trong 5 bảng audit, và call còn bọc `try?` (nil-safe). Cảnh báo chỉ đúng NẾU audit lỡ đụng bảng đó — nên nó thành 1 lằn ranh "đừng mở rộng scope sang partner_invitations", không phải defect của kế hoạch hiện tại.
  - GPT nói lỗi surface "403 cho authenticated, 401 cho anon" — đúng ở tầng HTTP nhưng với web `select('*')` thì **không** phát sinh lỗi (PostgREST expand `*` thành tập cột được phép, degrade êm). Chỉ câu nêu-tên-cột mới 403/401. Em giữ phân biệt này (rủi ro #3 vs #1).

Panel chạy đủ 2 model (Claude + GPT-5.6, `OPENAI_API_KEY` có mặt, exit 0). Prompt + reply nguyên văn lưu tại:
- `docs/proposals/rls-anon-select-hardening/external/risk-auditor-gpt56-prompt.md`
- `docs/proposals/rls-anon-select-hardening/external/risk-auditor-gpt56-reply.md`

**Kết luận cho architect:** RED do migration prod + binary native bất biến. Đường sống duy nhất là **thu hẹp phạm vi xuống chỉ `invite_code`** trên `team_match_teams`, đi expand-then-contract (RPC + client trước, revoke sau), và **giữ nguyên grant** `payment_status`/`captain_user_id`. Nếu Cuong muốn ẩn cả 2 cột kia, phải chờ tới khi bản iOS mới (bỏ tên cột đó khỏi query) đã phủ đủ user — đó là điều kiện App Store, không phải điều kiện code.
