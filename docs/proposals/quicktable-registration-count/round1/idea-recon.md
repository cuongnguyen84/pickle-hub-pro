# Recon — quicktable-registration-count

## Kết luận cốt lõi
Card ở `/tournaments` HÔM NAY đã render một số qua `currentFormat.renderMeta` (`src/pages/Tournaments.tsx:80-81,94,120`) dạng `${player_count} players · Round robin`. NHƯNG `player_count` (quick_tables) và `team_count` (team_match_tournaments...) là **cột QUOTA/capacity set lúc tạo giải**, KHÔNG phải số đăng ký thật. Xác nhận bằng CHECK constraint:
- `supabase/migrations/20251223034604_..._88ebf84f.sql:25` — `player_count INTEGER NOT NULL CHECK (player_count >= 2)`
- `supabase/migrations/20260107133349_..._4d81fec4.sql:19` — `team_count INTEGER NOT NULL CHECK (team_count >= 2)`

→ Card hiện đang hiện "sức chứa", không phải "đã đăng ký". Social-proof cần số KHÁC từ bảng KHÁC.

`OpenRegistrationSection.tsx` (`src/components/quicktable/OpenRegistrationSection.tsx:79-135`) CONFIRMED dead code — caller duy nhất là barrel re-export `src/components/quicktable/index.ts:4`, không grep hit chỗ khác. Hard-code progress bar 25% (`:59`) và trùng `useOpenRegistrationTables` vốn đã dùng trực tiếp ở `Tournaments.tsx:165`.

## Touch surface (khả năng)
- `src/pages/Tournaments.tsx:80-121, 569-593` — vòng render card + `renderMeta` mỗi format; nơi count thật cần hiện
- `src/hooks/useTournamentData.ts:97-266, 141-153` — 6 query hook (`useOpenRegistrationTables`, `useActive/CompletedPublicQuickTables`, `useOpenTeamMatchTournaments`, doubles-elim/flex) select `player_count`/`team_count` trực tiếp off parent table — KHÔNG cái nào join count thật
- `src/hooks/useInteractionData.ts:80-96` — `useApprovedRegistrations(tableId)` tồn tại nhưng per-table-detail, không batch cho list
- `src/hooks/useRegistration.ts:296-327` — `getApprovedCount`/`getPendingCount`, cùng shape per-table
- `src/hooks/useUpcomingSocialEvents.ts:40-65` — **pattern gần nhất đã tồn tại**: N+1 `count: exact, head: true` fan-out mỗi row sau list query, feed field `registered_count` dùng cho badge `12/16 đã đăng ký`

## Data
- `quick_tables.player_count` (int, QUOTA) vs `quick_table_registrations` (row thật, `status` enum `pending|approved|rejected`, `table_id`, `user_id`) — `supabase/migrations/20251225041737_..._3966174b.sql:18-33`
- `team_match_tournaments.team_count` (int, QUOTA) vs `team_match_teams` (row thật, `status pending|approved|rejected`, `tournament_id`) — `supabase/migrations/20260107133349_..._4d81fec4.sql:13-65`
- Doubles-elim & Flex: CHƯA trace tới bảng đăng ký riêng (out of time — cùng nghi ngờ quota-column với `team_count`/`format`, UNCONFIRMED)
- RLS `quick_table_registrations`: policy `"Registrations viewable for public tables"` (`20251225041737...:42-51`) KHÔNG có `TO` role clause và KHÔNG filter status → SELECT cho **any** status (kể cả pending/rejected) miễn parent table `is_public = true`. KHÔNG có table-level `GRANT`/`REVOKE` cho `quick_table_registrations` trong migration → anon access phụ thuộc default privileges Supabase, **UNVERIFIED** (cần live `curl` anon key xác nhận — pattern có sẵn ở `20260428000002_fix_creator_tables_grants.sql`)
- KHÔNG có RPC nào trả aggregate count đăng ký per table/tournament cho list

## Test coverage HÔM NAY
- 0 test file reference `Tournaments.tsx`, `useTournamentData.ts`, `useOpenRegistrationTables`, `quick_table_registrations`
- Lỗ toàn phần: không test nào bắt được count sai / anon-blocked trên trang này

## Unknowns cho Cuong / panel
1. Doubles-elim & Flex: cột count tương đương có cùng mismatch quota-vs-actual không? (chưa trace)
2. QuickTable: badge đếm `approved` only hay `approved + pending`? (`auto_approve_registrations` per-table configurable)
3. Xác nhận anon SELECT trên `quick_table_registrations`/`team_match_teams` thật sự chạy hôm nay (chưa tìm thấy GRANT explicit) — 1 curl anon-key REST settle được trước khi code.

## Ghi chú orchestrator
- Đã thử probe anon curl local nhưng repo KHÔNG có `.env`, client.ts đọc key từ `import.meta.env` → key không sẵn in-session. risk-auditor cần lấy key (Cuong `~/Downloads/secrets.local.md`?) hoặc để verify trong /ship.
