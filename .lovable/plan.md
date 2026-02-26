

## Problem

When a tournament match is live in real life, the app may stop updating scores due to:
- Supabase Realtime WebSocket silently disconnecting (network hiccup, mobile sleep/wake, background tab)
- Polling not configured on tournament view pages (QuickTableView, DoublesEliminationView, TeamMatchView rely solely on Realtime + manual `loadData`)
- Users on mobile have no way to manually trigger a refresh without reloading the entire page

Currently, the three tournament view pages handle data differently:
- **QuickTableView**: Realtime subscription on `quick_table_matches` + `quick_table_players`, calls `loadData()` on change. No polling fallback. No visibility-change reconnect.
- **DoublesEliminationView**: Realtime with `skipNextRealtime` pattern + `softReload`. No polling fallback. No visibility-change reconnect.
- **TeamMatchView**: Uses `useTeamMatchRealtime` hook (invalidates react-query). No visibility-change reconnect.

## Solution: 3-layer resilience for all tournament views

### Layer 1: Visibility-change auto-refresh
When the user returns to the app (tab focus, phone unlock, app foreground), automatically refetch data and resubscribe Realtime channels.

**Implementation**: Create a shared `useVisibilityRefresh` hook that:
- Listens for `visibilitychange` event
- On `visible`: calls a provided `onRefresh` callback
- Debounces to avoid double-fires

Apply this hook in all 3 view pages.

### Layer 2: Polling fallback
Add a background polling interval (every 15-20 seconds) as a safety net when Realtime is silently dead.

**Implementation**:
- **QuickTableView**: Add a `setInterval` that calls `loadData()` every 20 seconds (only when document is visible)
- **DoublesEliminationView**: Same pattern with `softReload()`
- **TeamMatchView**: Already uses react-query, just add `refetchInterval: 15000` to the matches query in `useTeamMatchMatches`

### Layer 3: Pull-to-refresh on mobile
Add a manual "pull down to refresh" or a visible refresh button at the top of tournament view pages so users can force-sync.

**Implementation**: Add a small refresh button in the tournament header area (next to share button) that calls `loadData()` / invalidates queries. Use `RefreshCw` icon with a spin animation during refresh.

## Files to change

### New file: `src/hooks/useVisibilityRefresh.ts`
- Custom hook that fires a callback when document becomes visible again
- Includes a minimum interval (e.g., 5 seconds) to avoid rapid re-fires

### `src/pages/QuickTableView.tsx`
- Add `useVisibilityRefresh` calling `loadData`
- Add polling `setInterval` (20s) when document is visible
- Add a refresh button (RefreshCw icon) in the header bar

### `src/pages/DoublesEliminationView.tsx`
- Add `useVisibilityRefresh` calling `softReload`
- Add polling `setInterval` (20s) when document is visible
- Add a refresh button in the header bar

### `src/pages/TeamMatchView.tsx`
- Add `useVisibilityRefresh` that invalidates team-match queries
- Add `refetchInterval: 15000` to match queries in `useTeamMatchMatches`
- Add a refresh button in the header bar

### `src/hooks/useTeamMatchMatches.ts`
- Add `refetchInterval: 15000` to the matches query

### `src/i18n/en.ts` + `src/i18n/vi.ts`
- Add key `common.refresh` or reuse existing patterns

## Technical detail: `useVisibilityRefresh` hook

```text
useVisibilityRefresh(onRefresh, minInterval = 5000)
  ├── listen: document.visibilitychange
  ├── on visible: check if (now - lastRefresh) > minInterval
  │   └── yes → call onRefresh(), update lastRefresh
  └── cleanup: remove listener
```

This approach is non-invasive: it doesn't change existing Realtime logic, just adds safety nets on top.

