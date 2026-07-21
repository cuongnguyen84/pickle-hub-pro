# solution-architect — rls-anon-select-hardening (nguyên văn)

Đã đủ dữ kiện, mọi claim verify tại chỗ. Viết output.

---

## Tóm tắt kiến trúc

Leak thật nằm ở policy `"Teams are publicly viewable" ... USING (true)` trên `team_match_teams` (`supabase/migrations/20260107133349_4d81fec4-b11a-4c56-9afa-20bedccb7bfa.sql:277-281`) cộng với hook `select('*')` (`src/hooks/useTeamMatchTeams.ts:62,83`), khiến anon key đọc được cả `invite_code`, `captain_user_id`, `payment_status`. RLS là row-level nên không giấu được cột — cơ chế bắt buộc là `REVOKE SELECT` + `GRANT SELECT (col)` theo đúng template `20260706120000_profiles_pii_column_lockdown.sql`. Ràng buộc lõi: column privilege áp theo **ROLE** (`anon` vs `authenticated`), không phân biệt được captain vs non-captain trong cùng role `authenticated` — nên bất kỳ cột nào captain vẫn cần đọc phải đi qua RPC `SECURITY DEFINER` gated bằng `is_team_captain`/`is_team_match_creator`.

Phát hiện quan trọng làm hẹp scope so với intake:
- **Chỉ `invite_code` là lỗ nghiêm trọng thật** (người lạ join roster bằng mã). `captain_user_id` là UUID trần — email/phone của captain đã bị khóa bởi profiles-lockdown `20260706120000`, nên UUID này chỉ tiết lộ "profile công khai nào làm captain", thông tin đã lộ sẵn qua roster + `display_name` công khai. `payment_status` là trạng thái nghiệp vụ thô, không PII. Cùng lớp "low severity" như `team_match_roster.user_id` mà recon đã ghi.
- **`isCaptain` KHÔNG phụ thuộc `team_match_teams.captain_user_id`**: nguồn thật là `team_match_roster.is_captain` qua `useUserMembership` (`src/hooks/useTeamMatchTeams.ts:561-588`). Chỗ duy nhất web đọc `team.captain_user_id` để suy isCaptain là `src/components/teamMatch/TeamDetailSheet.tsx:82`.
- **Native không bao giờ đọc `invite_code`**: `TeamMatchRepository.swift:45` list chỉ lấy `payment_status`; `:426-427` và `:407-408` filter `.eq("captain_user_id", uid)` (chính mình). Native đọc `invite_code` = 0 (chỉ `inviteTeamByEmail` qua edge-fn service_role, `:435-440`).
- Join-by-code team_match **đã chết**: `useTeamByInviteCode` (`useTeamMatchTeams.ts:614`) 0 caller; `JoinTeam.tsx:28` và `useTeamRegistration.ts:427` đều query `quick_table_partner_invitations`, không phải team_match. Không consumer nào filter `.eq('invite_code')` trên team_match_teams còn sống.
- `invite_code` sinh bằng column DEFAULT (`...133349...sql:58`, `gen_random_bytes`), không trigger — `REVOKE SELECT` không đụng INSERT/creation.

---

## Option A — Full lockdown 3 cột (trung thành intake)

Effort: **~5 half-days** (có native) · Data: migration RED-ish + 3 RPC · Files: migration mới, `useTeamMatchTeams.ts`, `TeamDetailSheet.tsx`, `MyTournaments.tsx`, `TeamMatchRepository.swift`, pgTAP test

How it works:
- Migration: `REVOKE SELECT ON team_match_teams FROM anon, authenticated`; `GRANT SELECT` chỉ trên cột an toàn (`id, tournament_id, team_name, master_team_id, seed, status, group_id, created_at, updated_at`) — bỏ `invite_code, captain_user_id, payment_status, payment_claimed_at, payment_confirmed_at`.
- Vì filter `.eq('captain_user_id', uid)` **cần** SELECT priv trên cột đó, mọi query "tìm đội của tôi" gãy → thay bằng RPC:
  - `team_match_get_my_team(p_tournament_id)` SECURITY DEFINER → trả đội của caller kèm private cols. Thay `useUserTeam` (`useTeamMatchTeams.ts:592-611`), native `userTeam` (`:423-430`), native `previousCaptainTeam` (`:407-408`).
  - `team_match_get_team_private(p_team_id)` gated `is_team_captain OR is_team_match_creator` → `invite_code` + `payment_status` cho captain/organizer.
  - `team_match_payment_summary(p_tournament_id)` gated organizer → thay query delete-impact `MyTournaments.tsx:227-236`.
- Narrow 2 hook `select('*')` → cột an toàn; refactor `TeamDetailSheet.tsx:82` dùng `membership.isCaptain`.
- Native: rewrite list select bỏ `payment_status`, gọi RPC cho userTeam/previousCaptainTeam/payment; build + test simulator.

Wins: khớp intake 100%; ẩn cả trạng thái thanh toán. Loses: phải sửa **cả hai codebase**, native là điểm rủi ro lớn nhất cho 1 người; nhiều RPC phải bảo trì; danh sách GRANT phải cập nhật mỗi lần thêm cột (đúng footgun profiles đã gặp). Forecloses: không đóng cửa gì, nhưng "thuế" bảo trì cao dài hạn.

---

## Option B — Chỉ giấu `invite_code`, giữ nguyên phần còn lại (the cheap one) ⭐

Effort: **~2.5 half-days** · Data: migration + **1** RPC · Files: migration mới, `src/hooks/useTeamMatchTeams.ts`, `src/components/teamMatch/TeamRosterManager.tsx`, pgTAP test · Native: **0 file**

How it works:
- Migration (mẫu `20260706120000`): `REVOKE SELECT ON team_match_teams FROM anon, authenticated`; loop `GRANT SELECT (col)` trên **mọi cột trừ `invite_code`**. `captain_user_id` + `payment_status` vẫn granted.
- 1 RPC: `team_match_get_invite_code(p_team_id) RETURNS text` SECURITY DEFINER, `WHERE is_team_captain(p_team_id, auth.uid()) OR is_team_match_creator(get_tournament_from_team(p_team_id), auth.uid())`. Đây chính là lời giải cho ràng buộc ROLE: captain lấy mã qua RPC, `authenticated` khác không có grant cột.
- Narrow `useTeamMatchTeams.ts:62` và `:83` `select('*')` → danh sách cột tường minh (không `invite_code`). `select('*')` sẽ 403 sau REVOKE vì `*` cần priv trên MỌI cột.
- `TeamRosterManager.tsx:358-366` (chỗ hiển thị mã, đã gate `isCaptain||isOwner`): lấy `invite_code` từ RPC thay vì prop `team.invite_code`. Bỏ prop `inviteCode` truyền từ `TeamDetailSheet.tsx:133`.
- Vì `captain_user_id`/`payment_status` còn granted: `useUserTeam` filter, native list + `userTeam` + `previousCaptainTeam`, và `MyTournaments.tsx:227` **chạy nguyên không sửa**. `TeamDetailSheet.tsx:82` isCaptain giữ nguyên (vẫn đọc được captain_user_id).

Wins: đóng đúng lỗ nghiêm trọng thật ở tầng server (REVOKE, không phải chỉ narrow hook — narrow hook một mình KHÔNG fix vì anon vẫn craft `select=invite_code` trực tiếp); **0 thay đổi native** → cắt phần lớn rủi ro cho 1 người; 1 RPC, 1 cột trong grant-list phải nhớ. Loses: `captain_user_id`/`payment_status` vẫn đọc được (low severity, đã lý giải ở trên). Forecloses: nếu sau này threat model đổi và cần ẩn 2 cột kia, phải làm thêm Option A — nhưng đó là superset cộng thêm, B không chặn đường.

---

## Option C — Tách `invite_code` sang bảng riêng (mẫu `quick_table_partner_invitations`)

Effort: **~4.5 half-days** · Data: bảng mới + backfill + DROP column + regen types · Files: migration, các INSERT path tạo đội (web + `TeamMatchRepository` native), `TeamRosterManager.tsx`, `types.ts`

How it works: bảng `team_match_team_invites(team_id, invite_code)` RLS gated captain/organizer; backfill từ cột hiện tại; **DROP `team_match_teams.invite_code`**. Khi đó `select('*')` chạy nguyên (không cần column grant). Captain đọc mã qua bảng mới.

Wins: giữ `select('*')` khỏi phải narrow; sạch nhất nếu invite-by-code thành feature thật có tracking per-invite. Loses: DROP column = schema change nặng, phải backfill + regen `types.ts` + sửa mọi path tạo đội (web + native) để ghi 2 bảng, lo atomicity. Forecloses: nặng nhất, chạm creation flow → gần RED. Không đáng khi join-by-code đang chết (YAGNI).

---

## Khuyến nghị

**Option B.** Lý do các phương án kia thua:
- **C thua** vì DROP column + sửa creation flow web/native để đổi lấy việc khỏi narrow 2 dòng `select` — đắt hơn nhiều lần cho một feature (join-by-code) đang là dead code. YAGNI.
- **A thua** vì trả thêm ~2.5 half-days và **toàn bộ rủi ro sửa native** để ẩn `captain_user_id` (UUID trần, PII đã khóa ở tầng profiles) và `payment_status` (trạng thái thô, không PII) — độ nghiêm trọng thấp, không tương xứng chi phí cho 1 người bảo trì 2 codebase. Ràng buộc ROLE khiến A phải RPC-hóa mọi truy vấn "đội của tôi" trên cả hai nền tảng, đúng loại kiến trúc "cần 2 người vận hành" nên tránh.
- **B** đóng đúng lỗ đã verify sống (`invite_code`) ở tầng server, giữ mọi flow web/native hiện có chạy nguyên, và chính RPC captain-only là câu trả lời sạch cho ràng buộc ROLE. Nếu Cuong muốn siết thêm 2 cột kia, A là bản nâng cấp incremental — B không chặn.

Ghi chú tuân thủ:
- **Bundle:** +0 KB JS (chỉ thêm 1 lời gọi RPC qua supabase client sẵn có). Không đụng `docs/perf-budgets.md`.
- **SSR/route/hreflang:** không route công khai mới, không text người dùng mới (mã mời đã song ngữ ở `i18n/*:inviteCode`). SSR story = N/A.
- **Risk tier:** migration RLS/grant, không chạm auth/payments/`config.toml` → chạy `scripts/agents/risk-tier.mjs` để xác nhận (dự kiến YELLOW, không RED). Migration áp qua Management API PAT theo standing authorization; nhớ ghi row `schema_migrations` đúng cách vì đang có ledger drift #427.

---

## Increments

1. **Migration + RPC + rewire captain-read, ship atomic 1 PR** — file migration chứa: REVOKE/GRANT-loop-trừ-invite_code + `team_match_get_invite_code`; `TeamRosterManager.tsx` đọc mã qua RPC; narrow `useTeamMatchTeams.ts:62,83`. Verify: `curl` PostgREST với anon key `?select=invite_code` trên `team_match_teams` → `permission denied`; `?select=id,team_name` → 200.
2. **Smoke UI** — captain mở TeamDetailSheet vẫn thấy mã (RPC); organizer `MyTournaments` delete-impact vẫn đếm đúng `paidTeams` (payment_status còn granted); native list + userTeam load bình thường (không đổi code). Verify bằng session captain thật + 1 build native trên simulator.
3. **pgTAP** — thêm test theo mẫu `supabase/tests/rls_auth_matrix.test.sql`: assert `has_column_privilege('anon','team_match_teams','invite_code','SELECT') = false` cho cả anon và authenticated; các cột an toàn = true.
4. **Stop-and-look** — chốt với Cuong: có cần leo lên Option A cho `captain_user_id`/`payment_status` không. Mặc định: không, trừ khi threat model đổi.

Sibling sweep (kết luận, không hành động): `team_match_roster` (`...133349...sql:311-315`, `USING(true)`) chỉ lộ `user_id` UUID low-sev và `useUserMembership` cần filter `.eq('user_id')` → để nguyên. `team_match_games` (`:386-390`) `referee_live_state`/`dupr_*` semi-internal, không phải credential → defer. `quick_table_registrations`/`quick_table_teams` đã scoped `is_public OR creator` (`20251225041737...sql:42-52`), invite_code sống ở bảng riêng đã guarded → không hành động.

---

## Điều em không chắc

- **Hành vi `select('*')` sau GRANT-trừ-một-cột**: em tin PostgREST phát cột tường minh từ schema cache (gồm invite_code) → `permission denied` cả query, nên **bắt buộc** narrow 2 hook. Chưa test trực tiếp trên project này; dù kết quả thế nào thì narrow vẫn là bước đúng, không rủi ro. Nên xác minh bằng curl ở increment 1 trước khi khai tử.
- **Join-by-code team_match có thật sự chết 100%**: em grep web (dead) + native (`invite_code` = 0 hit ngoài edge-fn email). Chưa loại trừ tuyệt đối một share-link/deep-link nào đó ngoài repo tiêu thụ mã. Nếu tồn tại path "nhập mã để join", nó phải là RPC `SECURITY DEFINER` (không thể là client filter, vì `invite_code` đã bị REVOKE) — cần confirm trước khi khẳng định B không phá luồng join.
- **Quyết định giữ `payment_status` đọc được** dựa trên đánh giá "low harm" của em. Đây là suy xét đánh đổi, không phải sự thật kỹ thuật — nếu Cuong coi trạng thái thanh toán đội là nhạy cảm nghiệp vụ thì phải chuyển sang Option A (và chịu chi phí native).

Files load-bearing: `supabase/migrations/20260107133349_4d81fec4-b11a-4c56-9afa-20bedccb7bfa.sql:58,277-281`, `supabase/migrations/20260706120000_profiles_pii_column_lockdown.sql`, `src/hooks/useTeamMatchTeams.ts:62,83,561-611`, `src/components/teamMatch/TeamDetailSheet.tsx:82,133`, `src/components/teamMatch/TeamRosterManager.tsx:358-366`, `src/pages/MyTournaments.tsx:227-236`, `apple/ThePickleHub/Core/TeamMatch/TeamMatchRepository.swift:44-48,407-408,423-430`.
