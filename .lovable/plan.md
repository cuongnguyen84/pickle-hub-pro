# Refactor 7 Files Quá Lớn

## Danh sách files cần xử lý


| File                       | Dòng  | Domain                       |
| -------------------------- | ----- | ---------------------------- |
| `useQuickTable.ts`         | 1,429 | Quick Tournament logic       |
| `useDoublesElimination.ts` | 1,320 | Doubles bracket logic        |
| `QuickTableView.tsx`       | 1,226 | Quick Tournament UI          |
| `TeamMatchView.tsx`        | 1,015 | Team Match UI                |
| `useLiveChat.ts`           | 811   | Chat realtime                |
| `useSupabaseData.ts`       | 788   | Data fetching (nhiều domain) |
| `QuickTableSetup.tsx`      | 588   | Setup UI (gần ngưỡng)        |


## Chiến lược refactor

### 1. `useSupabaseData.ts` (788 LOC) → 4 files

File này chứa hooks cho **nhiều domain khác nhau** — dễ tách nhất, impact lớn nhất:

- `src/hooks/useVideoData.ts` — `useVideos`, `useVideo`, `useReplays`
- `src/hooks/useLivestreamData.ts` — `useLivestreams`, `useLivestream`
- `src/hooks/useTournamentData.ts` — `useTournaments`, `useTournamentBySlug`, `useTournamentContent`, `useOpenRegistrationTables`, `useOpenTeamMatchTournaments`, `useCompletedPublicQuickTables`, `useCompletedTeamMatchTournaments`
- `src/hooks/useInteractionData.ts` — `useLikesCount`, `useUserLiked`, `useComments`, `useViewCount`, `useApprovedRegistrations`, `useUserRegisteredTournaments`, `useUserCompletedTournaments`

`useSupabaseData.ts` giữ lại làm barrel re-export để **không break imports hiện tại** (28 files import từ đây).

### 2. `useQuickTable.ts` (1,429 LOC) → 3 files

- `src/lib/quick-table-utils.ts` — Pure functions: `suggestGroupConfigs`, `generateRoundRobinMatches`, `distributePlayersToGroups` (~250 LOC)
- `src/hooks/useQuickTableMutations.ts` — Tất cả mutation functions (create, update, delete matches/players/groups) (~600 LOC)
- `src/hooks/useQuickTable.ts` — Giữ lại: types, query hooks, main `useQuickTable()` hook (~580 LOC)

### 3. `useDoublesElimination.ts` (1,320 LOC) → 3 files

- `src/lib/doubles-bracket-utils.ts` — Pure bracket generation logic, round type helpers
- `src/hooks/useDoublesEliminationMutations.ts` — Score update, match progression mutations
- `src/hooks/useDoublesElimination.ts` — Giữ lại: types, queries, main hook

### 4. `useLiveChat.ts` (811 LOC) → 3 files

- `src/hooks/useChatMessages.ts` — Message CRUD, pagination (send, delete, retry, loadOlder)
- `src/hooks/useChatModeration.ts` — Mute/unmute, settings update, moderator check
- `src/hooks/useLiveChat.ts` — Giữ lại: types, realtime subscription, compose sub-hooks

### 5. `QuickTableView.tsx` (1,226 LOC) → Extract components

- `src/components/quicktable/QuickTableScoring.tsx` — Scoring dialog/sheet
- `src/components/quicktable/QuickTableStandings.tsx` — Standings table per group
- `src/components/quicktable/QuickTableMatchList.tsx` — Match list with filters
- `QuickTableView.tsx` giữ lại: routing, tabs, compose components (~400 LOC)

### 6. `TeamMatchView.tsx` (1,015 LOC) → Extract components

- Phần lớn UI đã được extract (TeamList, MatchList, StandingsTable...)
- Tách thêm: tab content sections thành sub-components
- Target: ~500 LOC

### 7. `QuickTableSetup.tsx` (588 LOC) — Theo dõi

Gần ngưỡng 600 LOC, chưa cần tách ngay. Đánh dấu để monitor.

## Cải thiện sau refactor


| Metric           | Trước     | Sau                  |
| ---------------- | --------- | -------------------- |
| File lớn nhất    | 1,429 LOC | ~580 LOC             |
| Files > 600 LOC  | 7         | 0-1                  |
| Số files mới     | —         | ~12 files            |
| Breaking changes | —         | 0 (barrel re-export) |


**Lợi ích cụ thể:**

- **Maintainability**: Mỗi file có 1 responsibility rõ ràng, dễ tìm và sửa
- **Code review**: PR nhỏ hơn, dễ review hơn
- **Testing**: Pure functions tách ra `lib/` có thể unit test độc lập
- **Tree-shaking**: Import chỉ phần cần thiết thay vì cả file lớn
- **Hot reload**: Sửa 1 function không trigger reload toàn bộ 1,400 dòng
- **Collaboration**: Giảm merge conflict khi nhiều người cùng làm việc

## Thứ tự thực hiện

1. `useSupabaseData.ts` — nhiều consumer nhất (28 files), dễ tách nhất
2. `useQuickTable.ts` — tách pure functions ra lib
3. `useLiveChat.ts` — tách theo responsibility
4. `useDoublesElimination.ts` — tách bracket logic
5. `QuickTableView.tsx` — extract UI components
6. `TeamMatchView.tsx` — extract tab sections  
------Hãy thực hiện thay đổi và báo cáo lại tôi. Đảm bảo không xảy ra bất cứ vấn đề gì với ứng dụng----