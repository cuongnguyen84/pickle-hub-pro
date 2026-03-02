

## Plan: Audit Log Phase 1 — Score Tracking + Before/After Diff

### 1. Database Migration

**Add columns to `audit_logs`:**
- `before_data jsonb DEFAULT NULL` — snapshot trước khi thay đổi
- `after_data jsonb DEFAULT NULL` — snapshot sau khi thay đổi

**Expand CHECK constraints:**
- `severity`: thêm `'security'`
- `event_category`: thêm `'match'`, `'player'`
- `resource_type`: thêm `'match'`, `'game'`, `'player'`

**Update `log_audit_event()` function:** thêm 2 params `_before_data` và `_after_data`.

**Create score tracking triggers trên 4 bảng match:**

| Table | Events logged | Severity |
|-------|--------------|----------|
| `quick_table_matches` | `MATCH_SCORE_UPDATED` (score change), `MATCH_COMPLETED` (winner set) | warning |
| `doubles_elimination_matches` | `MATCH_SCORE_UPDATED`, `MATCH_COMPLETED` | warning |
| `team_match_games` | `MATCH_SCORE_UPDATED` (game score change) | warning |
| `flex_matches` | `MATCH_SCORE_UPDATED`, `MATCH_COMPLETED` | warning |

Mỗi trigger lưu `before_data` (old scores) và `after_data` (new scores) để truy vết chỉnh sửa điểm số.

### 2. Update Hook `useAuditLog.ts`

- Cập nhật `AuditLogEntry` interface thêm `before_data` và `after_data`
- Cập nhật `logAuditEvent` helper thêm optional `beforeData` / `afterData` params

### 3. Update UI `AdminAuditLog.tsx`

- Thêm `'match'` và `'player'` vào category filter
- Thêm `'security'` vào severity filter
- Khi expand row có `before_data`/`after_data`: hiển thị diff view (2 cột Before / After side-by-side) thay vì chỉ hiển thị metadata
- Thêm color cho category `match` và `player`
- Thêm color cho severity `security`

### Files

| Action | File |
|--------|------|
| Migration | Add columns, update function, create 4 match triggers |
| Modify | `src/hooks/useAuditLog.ts` — add before/after fields |
| Modify | `src/pages/admin/AdminAuditLog.tsx` — diff view, new filters |

