

# Tournament Builder v2 — Revised Plan

## Tổng quan thay đổi so với plan trước

| Điểm feedback | Quyết định |
|---|---|
| Schema parent: bảng riêng `parent_tournaments` | OK — tách bảng riêng |
| ON DELETE CASCADE → RESTRICT | OK — dùng RESTRICT, xóa parent chỉ khi không còn sub-event |
| Pseudocode cho resolveGroupConflicts | Bổ sung bên dưới |
| PlayoffPreviewDialog interaction model | Click-swap (không drag-drop — đơn giản hơn, mobile-friendly) |
| Unit test cho seeding/conflict | Tối thiểu 5 edge case |
| Best 3rd tiebreaker | Chỉ tính point_diff từ trận với top 2 trong bảng |

---

## Phần 1: Multi-Event — Bảng `parent_tournaments`

### Database Migration

```sql
CREATE TABLE parent_tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  banner_url TEXT,
  event_date DATE,
  location TEXT,
  share_id TEXT NOT NULL DEFAULT encode(extensions.gen_random_bytes(6), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(share_id)
);

ALTER TABLE parent_tournaments ENABLE ROW LEVEL SECURITY;

-- RLS: creator can CRUD, public can read
CREATE POLICY "Anyone can view" ON parent_tournaments FOR SELECT USING (true);
CREATE POLICY "Creator can insert" ON parent_tournaments FOR INSERT
  WITH CHECK (creator_user_id = auth.uid());
CREATE POLICY "Creator can update" ON parent_tournaments FOR UPDATE
  USING (creator_user_id = auth.uid());
CREATE POLICY "Creator can delete" ON parent_tournaments FOR DELETE
  USING (creator_user_id = auth.uid());
CREATE POLICY "Admin full access" ON parent_tournaments FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

-- Link quick_tables to parent (nullable FK, RESTRICT)
ALTER TABLE quick_tables
  ADD COLUMN parent_tournament_id UUID
  REFERENCES parent_tournaments(id) ON DELETE RESTRICT;
```

### UI Flow
- **QuickTables.tsx**: Nút "Tạo giải mới" → modal 2 option (đơn lẻ / giải tổng)
- **Option A**: vào wizard hiện tại, `parent_tournament_id = NULL`
- **Option B**: form tạo parent → trang quản lý parent → nút "+ Thêm nội dung" mở wizard với `parent_tournament_id` tự gán
- **List giải**: parent hiện badge "X nội dung", expandable; standalone hiện như cũ

### Files mới/sửa
- `src/components/quicktable/CreateParentTournamentDialog.tsx` — mới
- `src/components/quicktable/ParentTournamentView.tsx` — mới
- `src/pages/QuickTables.tsx` — thêm type selection modal, list parents
- `src/pages/QuickTableView.tsx` — detect parent, render ParentTournamentView
- `src/hooks/useParentTournament.ts` — mới (CRUD parent + list sub-events)

---

## Phần 2: Court Name

### Database
```sql
ALTER TABLE quick_table_matches ADD COLUMN court_name TEXT;
```

### UI
- `QuickTableMatchRow.tsx` — inline text input cho BTC, hiển thị cho viewer
- `QuickTablePlayoffView.tsx` — hiển thị court_name

---

## Phần 3: Fix Playoff 6 bảng

### Best 3rd — Tính point_diff chỉ với top 2

Function mới trong `src/lib/quick-table-utils.ts`:

```typescript
function computeBest3rdPointDiff(
  thirdPlacePlayer: QuickTablePlayer,
  allMatches: QuickTableMatch[],
  top2PlayerIds: Set<string>
): number {
  // Filter matches of this player where opponent is in top2PlayerIds
  // Sum (score_self - score_opponent) for those matches only
}
```

### Global Seeding Pseudocode

```text
INPUT: groups[], players[], matches[]

1. For each group, rank players by (matches_won DESC, point_diff DESC)
2. Collect 6 group winners → sort by (wins DESC, point_diff DESC) → seeds 1-6
3. Collect 6 runners-up → sort by (wins DESC, point_diff DESC) → seeds 7-12
4. Collect 6 third-place players
   - For each, compute adjusted_point_diff = sum of point_diff
     ONLY from matches against the top-2 players of their group
   - Sort by (wins DESC, adjusted_point_diff DESC, points_for DESC)
   - Take top 4 → seeds 13-16
5. Return 16 SeededPlayer[] with { playerId, seed, sourceGroupId }
```

### resolveGroupConflicts Pseudocode

```text
INPUT: pairings[8] = [(seed1,seed16), (seed2,seed15), ..., (seed8,seed9)]
       Each entry has { player, seed, sourceGroupId }

FUNCTION resolveGroupConflicts(pairings):
  conflicts = []
  
  FOR i = 0 TO 7:
    IF pairings[i].player1.sourceGroupId == pairings[i].player2.sourceGroupId:
      conflicts.push(i)
  
  IF conflicts.length == 0: RETURN { resolved: pairings, hasConflicts: false }
  
  FOR each conflictIndex in conflicts:
    // Keep higher seed in place, try to swap lower seed
    lowerSeedSide = pairings[conflictIndex].player2
    
    // Find nearest non-conflicting pair to swap with
    bestSwapTarget = null
    bestSwapDistance = Infinity
    
    FOR j = 0 TO 7 (j != conflictIndex):
      candidate = pairings[j].player2  // try swapping lower seeds
      
      // Check: swapping won't create NEW conflicts in either pair
      wouldConflictHere = (candidate.sourceGroupId == pairings[conflictIndex].player1.sourceGroupId)
      wouldConflictThere = (lowerSeedSide.sourceGroupId == pairings[j].player1.sourceGroupId)
      
      IF !wouldConflictHere AND !wouldConflictThere:
        distance = |conflictIndex - j|
        IF distance < bestSwapDistance:
          bestSwapTarget = j
          bestSwapDistance = distance
    
    IF bestSwapTarget != null:
      SWAP pairings[conflictIndex].player2 <-> pairings[bestSwapTarget].player2
    ELSE:
      // Cannot auto-resolve → flag for manual intervention
      RETURN { resolved: pairings, hasConflicts: true, unresolvedPairs: [conflictIndex] }
  
  // Verify no new conflicts were introduced
  RETURN resolveGroupConflicts(pairings)  // recursive re-check (max 2 iterations)
```

### PlayoffPreviewDialog — Click-Swap Interaction

```text
Flow:
1. Dialog hiển thị 8 cặp đấu dạng list, mỗi cặp 2 dòng (seed + tên + bảng nguồn)
2. Cặp xung đột highlight viền đỏ
3. User click vào 1 player → player đó được "chọn" (highlight xanh)
4. User click vào player khác ở cặp khác → 2 player swap vị trí
5. Sau mỗi swap, re-check conflicts, update highlight
6. Nút "Xác nhận bracket" chỉ active khi 0 conflicts
7. Nút "Tự động giải quyết" gọi resolveGroupConflicts()
```

### Unit Tests — `src/lib/__tests__/quick-table-playoff.test.ts`

Tối thiểu 5 edge case:

1. **No conflicts**: 6 groups, top 2 + 4 best-3rd, tất cả từ bảng khác nhau → verify pairing đúng 1v16..8v9
2. **Single conflict**: seed 1 và seed 16 cùng bảng → verify auto-swap thành công
3. **Multiple conflicts**: 2 cặp cùng bảng → verify cả 2 được resolve
4. **Unresolvable conflict**: edge case cực đoan → verify trả `hasConflicts: true` + unresolvedPairs
5. **Best 3rd tiebreaker**: 6 đội hạng 3, wins bằng nhau → verify sort theo adjusted_point_diff (chỉ trận với top 2)
6. **Seeding order**: verify winners get 1-6, runners-up 7-12, wildcards 13-16

### Files cần sửa/tạo
- `src/lib/quick-table-utils.ts` — thêm `generateGlobalSeeding`, `generateSeededPairings`, `resolveGroupConflicts`, `computeBest3rdStats`
- `src/lib/__tests__/quick-table-playoff.test.ts` — mới, 6 test cases
- `src/hooks/useQuickTable.ts` — sửa `getQualifiedPlayers` (case 6), sửa `generatePlayoffBracket` (case 6)
- `src/components/quicktable/PlayoffPreviewDialog.tsx` — mới (click-swap UI)
- `src/pages/QuickTableView.tsx` — integrate PlayoffPreviewDialog trước khi tạo bracket

---

## Thứ tự triển khai

1. **Migration**: tạo `parent_tournaments` + `parent_tournament_id` FK + `court_name`
2. **Phần 2**: Court name (nhỏ nhất)
3. **Phần 3**: Playoff algorithm + unit tests (viết test trước, implement sau)
4. **Phần 1**: Multi-event UI

