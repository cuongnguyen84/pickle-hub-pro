

# Dashboard Giải Đấu Realtime

## Tổng quan
Xây dựng trang Dashboard hiển thị trạng thái sân đấu realtime cho 3 loại giải: Quick Table, Team Match, Doubles Elimination. Public cho tất cả, hỗ trợ TV Mode fullscreen và thông báo âm thanh.

## Phạm vi

| Loại giải | Court | Time | Trận live | Trận tiếp theo |
|-----------|-------|------|-----------|----------------|
| Quick Table | `court_id` (co san) | `start_at` (co san) | status != completed | Theo court + start_at |
| Doubles Elimination | `court_number` (co san) | `start_time` (co san) | status = `live` | Theo court + start_time |
| Team Match | Khong co | Khong co | status = `in_progress` | status = `pending` (theo display_order) |

**Flex**: Bo qua theo yeu cau.

## Luong nguoi dung

1. Tu `/tools` -> nhan card "Dashboard" -> `/tools/dashboard`
2. Trang DashboardPicker: hien danh sach giai dang dien ra (3 loai)
3. Chon giai -> `/tools/dashboard/:type/:id`
4. Dashboard hien thi theo san (Quick Table, Doubles Elimination) hoac danh sach tran (Team Match)
5. Nut TV Mode -> fullscreen, font lon, nen toi, carousel tu dong

## Database Migration

Khong can migration. Team Match khong co court/time, chi hien thi tran dang dau va tran tiep theo don gian. Quick Table va Doubles Elimination da co san `court_id`/`court_number` va `start_at`/`start_time`.

## Files moi

### 1. `src/pages/TournamentDashboard.tsx`
- Route: `/tools/dashboard/:type/:id`
  - `type`: `quick-table` | `team-match` | `doubles-elimination`
  - `id`: share_id (quick-table, doubles-elimination) hoac tournament id (team-match)
- Fetch giai + matches theo type
- Nhom theo court (Quick Table, Doubles Elimination) hoac hien danh sach (Team Match)
- Realtime subscription
- Toggle TV Mode va Sound

### 2. `src/pages/DashboardPicker.tsx`
- Route: `/tools/dashboard`
- Query 3 bang: `quick_tables` (status in group_stage, playoff), `team_match_tournaments` (status = ongoing), `doubles_elimination_tournaments` (status = active/ongoing)
- Hien thi danh sach de chon

### 3. `src/components/dashboard/CourtCard.tsx`
- Hien thi 1 san: ten san, tran dang dau (LIVE badge), tran tiep theo (NEXT badge), gio bat dau
- Animation highlight khi score thay doi

### 4. `src/components/dashboard/TeamMatchDashboard.tsx`
- Danh sach tran dang thi dau (in_progress) va tran tiep theo (pending)
- Khong hien thi san/gio (chua co data)

### 5. `src/components/dashboard/TVModeView.tsx`
- Fullscreen (Fullscreen API), nen toi, font lon
- Carousel tu dong xoay tung san/tran moi 10 giay
- Hien thi ten giai + logo

### 6. `src/hooks/useDashboardData.ts`
- Hook fetch matches theo type + id
- Realtime subscription (reuse pattern tu useTeamMatchRealtime)
- Logic phan loai: live vs next vs completed

### 7. `src/hooks/useDashboardSound.ts`
- Web Audio API tao beep don gian
- Phat khi tran moi chuyen sang live hoac completed
- Toggle on/off, mac dinh off

## Routing (App.tsx)
Them 2 route:
```
/tools/dashboard -> DashboardPicker
/tools/dashboard/:type/:id -> TournamentDashboard
```

## Entry points
- Them ToolCard "Dashboard" vao trang `/tools` voi icon `Monitor`
- Them nut "Dashboard" vao tung trang view (QuickTableView, TeamMatchView, DoublesEliminationView)

## i18n
Them section `dashboard` vao ca `en.ts` va `vi.ts`:

| Key | EN | VI |
|-----|----|----|
| title | Live Dashboard | Bang dieu khien truc tiep |
| selectTournament | Select a tournament | Chon giai dau |
| court | Court | San |
| nowPlaying | Now Playing | Dang thi dau |
| nextMatch | Next | Tiep theo |
| available | Available | Trong |
| tvMode | TV Mode | Che do TV |
| exitTvMode | Exit TV Mode | Thoat che do TV |
| soundOn | Sound On | Bat am thanh |
| soundOff | Sound Off | Tat am thanh |
| noActiveTournaments | No active tournaments | Khong co giai dang dien ra |
| vs | vs | vs |
| match | Match | Tran |
| score | Score | Ty so |
| quickTable | Quick Table | Bang dau |
| teamMatch | Team Match | Doi khang |
| doublesElimination | Doubles Elimination | Dau loai doi |
| autoRotate | Auto rotate | Tu dong xoay |

## Logic xac dinh tran

**Quick Table & Doubles Elimination (co court)**:
- Nhom matches theo court_id / court_number
- Tren moi court: tran co score > 0 va chua completed = LIVE; tran pending dau tien theo start_at/display_order = NEXT
- Court khong co tran nao = AVAILABLE

**Team Match (khong co court)**:
- Tran `in_progress` hoac co score > 0 va chua completed = LIVE
- Tran `pending` dau tien theo display_order = NEXT
- Hien danh sach don gian, khong chia theo san

## Realtime
- Quick Table: subscribe `quick_table_matches` filter by `table_id`
- Doubles Elimination: subscribe `doubles_elimination_matches` filter by `tournament_id`
- Team Match: subscribe `team_match_matches` filter by `tournament_id` (da co trong useTeamMatchRealtime)

## Thu tu trien khai
1. i18n keys (dashboard section)
2. `useDashboardData` hook + `useDashboardSound` hook
3. `DashboardPicker` page + route
4. `CourtCard` + `TeamMatchDashboard` components
5. `TournamentDashboard` page + route
6. `TVModeView` component
7. Entry points (Tools page + 3 tournament view pages)

