

## Plan: Redesign Parent Tournament Card với expand preview sub-events

### Tổng quan
Tách parent tournament card ra component riêng `ParentTournamentCard.tsx`, hiển thị Trophy icon, count badge, preview tối đa 3 sub-events với status badge, và link "more events". Bỏ badge "Nổi bật"/star.

### Files cần sửa

**1. `src/hooks/useParentTournament.ts`**
- Thêm interface `ParentTournamentWithPreview` extend `ParentTournament` với `subEventCount` và `previewSubEvents[]`
- Thêm function `getUserParentTournamentsWithPreview()`: query parent tournaments, rồi query `quick_tables` cho tất cả parent IDs (1 batch query), map sub-events vào từng parent (max 3 preview, sort: active status trước)

**2. `src/components/quicktable/ParentTournamentCard.tsx`** (NEW)
- Props: `ParentTournamentWithPreview`, `isOwner`, i18n
- Header: Trophy icon (teal) + tên giải + count badge outline (teal)
- Meta row: Calendar + date, MapPin + location
- Divider `border-t border-border/50`
- Sub-event list (max 3): bullet + name (truncate) + status badge (mapped colors)
- "+ N nội dung khác" nếu > 3
- Empty state nếu 0 sub-events, với CTA cho owner
- Click header → navigate parent, click sub-event row → navigate sub-event (stopPropagation)
- Card: `bg-card/80 p-5`

**3. `src/pages/QuickTables.tsx`**
- Import `ParentTournamentCard` và `ParentTournamentWithPreview`
- Replace `getUserParentTournaments` với `getUserParentTournamentsWithPreview`
- Replace inline parent card render (lines 846-885) với `<ParentTournamentCard />`

**4. `src/i18n/vi.ts` + `src/i18n/en.ts`**
- Thêm keys: `moreEvents`, `noEventsYet`, `addFirstEvent`, `eventCount` (update existing), status keys `live`, `upcoming`
- Type definitions update trong vi.ts

**5. `src/pages/Tournaments.tsx`** (nếu có parent card) — bỏ badge "Nổi bật" / star icon, dùng cùng component mới

### Sub-event status badge mapping
- `setup` → outline/grey → "Sắp diễn"/"Upcoming"
- `group_stage` → secondary/blue → "Vòng bảng"/"Group stage"
- `playoff` → secondary/orange → "Playoff"
- `completed` → default/green → "Hoàn thành"/"Completed"

### Data fetching approach
```text
1. Query parent_tournaments WHERE creator_user_id = user.id
2. Collect all parent IDs
3. Single query: quick_tables WHERE parent_tournament_id IN (parentIds)
   SELECT id, name, status, share_id, parent_tournament_id, created_at
4. Group by parent_tournament_id in JS
5. Sort: active statuses first, take top 3 as preview
```

Không N+1, chỉ 2 queries total.

