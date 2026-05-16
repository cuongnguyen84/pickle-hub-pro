# Wave 2 — W3.1 i18n Toast Strings Audit

**Date:** 2026-05-16
**Branch:** `refactor/i18n-toast-strings`
**Scope:** `toast.(error|success|info|warning|message)(` calls inside `src/hooks/use*.ts` only.
**Gate:** > 80 toast strings → STOP, ship audit-only PR.

## Result: GATE BREACHED — 103 toast call sites across 10 hook files

| Metric | Value |
|---|---|
| Total `toast.*` call sites in hooks | **103** |
| Gate threshold | 80 |
| Files affected | 10 |
| Direct hardcoded VI strings | 95 |
| Computed/lookup-based (`errorMessages[...]`, `messages[action]`, helper vars) | 8 |
| Distinct hardcoded VI literal toasts (deduped across files) | ~64 |
| Embedded `errorMessages` map VI literals (also surfaced via `toast.error`) | 28 (in `useTeamRegistration.ts`, `usePairRequest.ts`) |

### Why we stop here

The accepted plan budgeted ≤ 80 strings. We measured 103 direct call sites + ~28 indirect literals in inline `errorMessages` maps. Refactoring all in one PR risks:

1. **Translation drift** — 95+ VI → EN translations in a single PR is hard for Cuong to review carefully; one bad EN translation reaches prod.
2. **Stacked risk on mutation hooks** — touching 10 hot mutation hooks at once means a regression has wide blast radius (tournament create, registration, refereeing, partner pairing).
3. **`errorMessages` map shape** — pair / team flows use inline VI maps keyed by RPC error codes. Properly i18n-ifying them needs a small per-hook decision (move to translation namespace vs. keep map and look up via `tToast`).

### Recommended next step (not in this PR)

Split into **3 sub-PRs** stacked off this audit branch:

- **W3.1a** — `i18n-standalone` util + `toast` namespace in `vi.ts`/`en.ts` (infrastructure only, no hook edits) — ~0 strings refactored, scaffolding only.
- **W3.1b** — refactor `useRegistration`, `useTeamRegistration`, `usePairRequest`, `useParentTournament` (registration / partner flows, ~57 strings, 4 files).
- **W3.1c** — refactor `useQuickTable`, `useQuickTableMutations`, `useRefereeManagement`, `useTeamMatchRefereeManagement`, `useDoublesEliminationReferees`, `_mutationErrors` (table mutations + referee management, ~46 strings, 6 files).

Each sub-PR ≤ 60 strings, reviewable independently, deployable independently.

---

## Audit: per-file inventory

Suggested namespace convention: `toast.<hook>.<action>.<status>` where `<hook>` mirrors the source file's domain (`registration`, `teamRegistration`, `quickTable`, `quickTableMutations`, `pairRequest`, `parentTournament`, `referee`, `teamMatchReferee`, `doublesEliminationReferee`, `mutationError`). For shared strings (e.g. `'Vui lòng đăng nhập'`) we recommend a `toast.common.*` bucket to dedupe.

### `src/hooks/useQuickTable.ts` (5 calls)

| Line | Original VI | Proposed key | EN translation |
|---|---|---|---|
| 144 | `Vui lòng đăng nhập để tạo bảng đấu` | `toast.quickTable.create.authRequired` | `Please sign in to create a tournament` |
| 152 | `Tên giải không được để trống` | `toast.quickTable.create.nameRequired` | `Tournament name is required` |
| 178 | `Đã đạt giới hạn soft launch: mỗi tài khoản chỉ được tạo tối đa 3 giải.` | `toast.quickTable.create.softLaunchLimit` | `Soft-launch limit reached: each account can create up to 3 tournaments.` |
| 182 | `Vui lòng đăng nhập để tạo bảng đấu` | `toast.quickTable.create.authRequired` | `Please sign in to create a tournament` |
| 190 | `Không thể tạo bảng đấu` | `toast.quickTable.create.error` | `Failed to create tournament` |

### `src/hooks/useRegistration.ts` (17 calls)

| Line | Original VI | Proposed key | EN translation |
|---|---|---|---|
| 109 | `Vui lòng đăng nhập để đăng ký` | `toast.registration.submit.authRequired` | `Please sign in to register` |
| 117 | `Tên hiển thị không được để trống` | `toast.registration.submit.displayNameRequired` | `Display name is required` |
| 139 | `Bạn đã đăng ký tham gia giải này rồi` | `toast.registration.submit.duplicate` | `You have already registered for this tournament` |
| 146 | `Đăng ký thành công! Vui lòng chờ BTC duyệt.` | `toast.registration.submit.success` | `Registered! Awaiting organizer approval.` |
| 150 | `Không thể đăng ký, vui lòng thử lại` | `toast.registration.submit.error` | `Failed to register, please try again` |
| 179 | `Đã cập nhật đăng ký` | `toast.registration.update.success` | `Registration updated` |
| 183 | `Không thể cập nhật, vui lòng thử lại` | `toast.registration.update.error` | `Failed to update, please try again` |
| 201 | `Đã hủy đăng ký` | `toast.registration.cancel.success` | `Registration cancelled` |
| 205 | `Không thể hủy đăng ký` | `toast.registration.cancel.error` | `Failed to cancel registration` |
| 222 | `Đã duyệt đăng ký` | `toast.registration.approve.success` | `Registration approved` |
| 226 | `Không thể duyệt đăng ký` | `toast.registration.approve.error` | `Failed to approve registration` |
| 241 | `Đã từ chối đăng ký` | `toast.registration.reject.success` | `Registration rejected` |
| 245 | `Không thể từ chối đăng ký` | `toast.registration.reject.error` | `Failed to reject registration` |
| 260 | `Đã duyệt ${n} đăng ký` | `toast.registration.bulkApprove.success` (params: `{count}`) | `Approved {count} registrations` |
| 264 | `Không thể duyệt hàng loạt` | `toast.registration.bulkApprove.error` | `Failed to bulk approve` |
| 286 | `Đã cập nhật thông tin` | `toast.registration.btcOverride.success` | `Information updated` |
| 290 | `Không thể cập nhật` | `toast.registration.btcOverride.error` | `Failed to update` |

### `src/hooks/useTeamRegistration.ts` (23 calls — also 11 indirect VI strings in `errorMessages` maps)

| Line | Original VI | Proposed key | EN translation |
|---|---|---|---|
| 134 | `Vui lòng đăng nhập để đăng ký` | `toast.teamRegistration.createTeam.authRequired` | `Please sign in to register` |
| 149 | `Bạn đã đăng ký tham gia giải này rồi` | `toast.teamRegistration.createTeam.duplicate` | `You have already registered for this tournament` |
| 155 | `Tên hiển thị không được để trống` | `toast.teamRegistration.createTeam.displayNameRequired` | `Display name is required` |
| 176 | `Bạn đã đăng ký tham gia giải này rồi` | `toast.teamRegistration.createTeam.duplicate` | `You have already registered for this tournament` |
| 183 | `Đăng ký thành công! Bạn có thể mời partner ngay bây giờ.` | `toast.teamRegistration.createTeam.success` | `Registered! You can invite a partner now.` |
| 187 | `Không thể đăng ký, vui lòng thử lại` | `toast.teamRegistration.createTeam.error` | `Failed to register, please try again` |
| 214 | `Vui lòng đăng nhập` | `toast.common.authRequired` | `Please sign in` |
| 226 | `Bạn đã gửi tối đa 3 lời mời. Vui lòng hủy bớt để tạo mới.` | `toast.teamRegistration.createInvitation.maxReached` | `You have sent the maximum of 3 invitations. Cancel some to create new ones.` |
| 242 | `Đã tạo link mời partner` | `toast.teamRegistration.createInvitation.success` | `Partner invite link created` |
| 246 | `Không thể tạo lời mời` | `toast.teamRegistration.createInvitation.error` | `Failed to create invitation` |
| 262 | `Đã hủy lời mời` | `toast.teamRegistration.cancelInvitation.success` | `Invitation cancelled` |
| 266 | `Không thể hủy lời mời` | `toast.teamRegistration.cancelInvitation.error` | `Failed to cancel invitation` |
| 277 | `Vui lòng đăng nhập` | `toast.common.authRequired` | `Please sign in` |
| 307 | `errorMessages[...] \|\| 'Có lỗi xảy ra'` | `toast.common.unknownError` (fallback for code map) | `Something went wrong` |
| 311 | `Đã tham gia đội thành công!` | `toast.teamRegistration.acceptInvitation.success` | `Joined team successfully` |
| 315 | `Không thể tham gia đội` | `toast.teamRegistration.acceptInvitation.error` | `Failed to join team` |
| 325 | `Vui lòng đăng nhập` | `toast.common.authRequired` | `Please sign in` |
| 345 | `errorMessages[...] \|\| 'Có lỗi xảy ra'` | `toast.common.unknownError` | `Something went wrong` |
| 349 | `Đã xóa partner khỏi đội` | `toast.teamRegistration.removePartner.success` | `Partner removed from team` |
| 353 | `Không thể xóa partner` | `toast.teamRegistration.removePartner.error` | `Failed to remove partner` |
| 382 | `errorMessages[...] \|\| 'Có lỗi xảy ra'` | `toast.common.unknownError` | `Something went wrong` |
| 391 | `messages[action]` (approve/reject/remove) | `toast.teamRegistration.btcManage.approved` / `.rejected` / `.removed` | `Team approved` / `Team rejected` / `Team removed from tournament` |
| 395 | `Không thể thực hiện thao tác` | `toast.teamRegistration.btcManage.error` | `Failed to perform action` |

#### Indirect `errorMessages` map values (lines 298-306, 340-344, 377-381) — also need bilingual keys

- `INVITATION_NOT_FOUND: 'Link mời không tồn tại'` → `Invitation link does not exist`
- `INVITATION_ALREADY_USED: 'Link mời đã được sử dụng'` → `Invitation link already used`
- `INVITATION_EXPIRED: 'Link mời đã hết hạn'` → `Invitation link expired`
- `TEAM_NOT_FOUND: 'Đội không tồn tại'` → `Team does not exist`
- `TEAM_ALREADY_COMPLETE: 'Đội đã đủ 2 người'` → `Team already has 2 players`
- `TABLE_LOCKED: 'Giải đấu đã diễn ra'` → `Tournament has already started`
- `CANNOT_JOIN_OWN_TEAM: 'Bạn không thể tham gia đội của chính mình'` → `You cannot join your own team`
- `PERMISSION_DENIED: 'Bạn không có quyền thực hiện thao tác này'` → `You do not have permission to perform this action`
- `INVALID_ACTION: 'Thao tác không hợp lệ'` → `Invalid action`
- `messages.approve: 'Đã duyệt đội'` → `Team approved`
- `messages.reject: 'Đã từ chối đội'` → `Team rejected`
- `messages.remove: 'Đã loại đội khỏi giải'` → `Team removed from tournament`

### `src/hooks/useQuickTableMutations.ts` (21 calls)

| Line | Original VI | Proposed key | EN translation |
|---|---|---|---|
| 100 | `Bạn không có quyền thêm VĐV cho giải này` | `toast.quickTableMutations.addPlayers.permissionDenied` | `You do not have permission to add players to this tournament` |
| 102 | `Không thể thêm người chơi` | `toast.quickTableMutations.addPlayers.error` | `Failed to add players` |
| 136 | `Bạn không có quyền tạo bảng cho giải này` | `toast.quickTableMutations.createGroups.permissionDenied` | `You do not have permission to create groups for this tournament` |
| 138 | `Không thể tạo bảng` | `toast.quickTableMutations.createGroups.error` | `Failed to create groups` |
| 178 | `Bạn không có quyền tạo trận đấu` | `toast.quickTableMutations.createGroupMatches.permissionDenied` | `You do not have permission to create matches` |
| 180 | `Không thể tạo trận đấu` | `toast.quickTableMutations.createGroupMatches.error` | `Failed to create matches` |
| 222 | `Bạn không có quyền chấm điểm trận này` | `toast.quickTableMutations.updateMatchScore.permissionDenied` | `You do not have permission to score this match` |
| 355 | `Bạn không có quyền cập nhật trạng thái giải` | `toast.quickTableMutations.updateTableStatus.permissionDenied` | `You do not have permission to update tournament status` |
| 378 | `Bạn không có quyền di chuyển VĐV` | `toast.quickTableMutations.movePlayer.permissionDenied` | `You do not have permission to move players` |
| 380 | `Không thể di chuyển VĐV` | `toast.quickTableMutations.movePlayer.error` | `Failed to move player` |
| 413 | `Bạn không có quyền thêm VĐV vào bảng` | `toast.quickTableMutations.addPlayerToGroup.permissionDenied` | `You do not have permission to add players to this group` |
| 415 | `Không thể thêm VĐV` | `toast.quickTableMutations.addPlayerToGroup.error` | `Failed to add player` |
| 443 | `Bạn không có quyền xoá VĐV` | `toast.quickTableMutations.removePlayer.permissionDenied` | `You do not have permission to remove players` |
| 445 | `Không thể xoá VĐV` | `toast.quickTableMutations.removePlayer.error` | `Failed to remove player` |
| 486 | `Bạn không có quyền tạo lại trận` | `toast.quickTableMutations.regenerateMatches.permissionDenied` | `You do not have permission to regenerate matches` |
| 514 | `Bạn không có quyền cập nhật sân/giờ` | `toast.quickTableMutations.updateCourtSettings.permissionDenied` | `You do not have permission to update courts/time` |
| 585 | `Bạn không có quyền cập nhật lịch` | `toast.quickTableMutations.reassignCourts.permissionDenied` | `You do not have permission to update the schedule` |
| 602 | `Đã xoá giải đấu` | `toast.quickTableMutations.deleteTable.success` | `Tournament deleted` |
| 608 | `Bạn không có quyền xoá giải đấu này` | `toast.quickTableMutations.deleteTable.permissionDenied` | `You do not have permission to delete this tournament` |
| 610 | `Không thể xoá giải đấu` | `toast.quickTableMutations.deleteTable.error` | `Failed to delete tournament` |
| 634 | `Bạn không có quyền đổi tên sân` | `toast.quickTableMutations.updateCourtName.permissionDenied` | `You do not have permission to rename courts` |

### `src/hooks/usePairRequest.ts` (13 calls — also 17 indirect VI strings in `errorMessages` maps)

| Line | Original VI | Proposed key | EN translation |
|---|---|---|---|
| 83 | `Vui lòng đăng nhập` | `toast.common.authRequired` | `Please sign in` |
| 113 | `errorMessages[...] \|\| 'Có lỗi xảy ra'` | `toast.common.unknownError` | `Something went wrong` |
| 117 | `Đã gửi yêu cầu ghép đôi. Đang chờ xác nhận.` | `toast.pairRequest.create.success` | `Pair request sent. Waiting for confirmation.` |
| 121 | `Không thể gửi yêu cầu ghép đôi` | `toast.pairRequest.create.error` | `Failed to send pair request` |
| 134 | `Vui lòng đăng nhập` | `toast.common.authRequired` | `Please sign in` |
| 159 | `errorMessages[...] \|\| 'Có lỗi xảy ra'` | `toast.common.unknownError` | `Something went wrong` |
| 164 | `Đã ghép đôi thành công!` | `toast.pairRequest.respond.acceptSuccess` | `Paired successfully` |
| 166 | `Đã từ chối yêu cầu ghép đôi` | `toast.pairRequest.respond.rejectSuccess` | `Pair request rejected` |
| 171 | `Không thể xử lý yêu cầu` | `toast.pairRequest.respond.error` | `Failed to process request` |
| 181 | `Vui lòng đăng nhập` | `toast.common.authRequired` | `Please sign in` |
| 196 | `Không thể hủy yêu cầu` | `toast.pairRequest.cancel.error` | `Failed to cancel request` |
| 200 | `Đã hủy yêu cầu ghép đôi` | `toast.pairRequest.cancel.success` | `Pair request cancelled` |
| 204 | `Không thể hủy yêu cầu` | `toast.pairRequest.cancel.error` | `Failed to cancel request` |

#### Indirect `errorMessages` map values (lines 99-112, 150-158) — also need bilingual keys

`createPairRequest`:
- `AUTH_REQUIRED: 'Vui lòng đăng nhập'` → `Please sign in`
- `TABLE_NOT_FOUND: 'Giải không tồn tại'` → `Tournament does not exist`
- `TABLE_LOCKED: 'Giải đấu đã diễn ra'` → `Tournament has already started`
- `NO_TEAM: 'Bạn chưa đăng ký tham gia giải'` → `You have not registered for this tournament`
- `TEAM_REJECTED: 'Bạn đã bị từ chối tham gia giải'` → `Your registration was rejected`
- `ALREADY_HAS_PARTNER: 'Bạn đã có partner'` → `You already have a partner`
- `TARGET_TEAM_NOT_FOUND: 'Người chơi không tồn tại'` → `Player does not exist`
- `TARGET_TEAM_REJECTED: 'Người chơi đã bị từ chối'` → `Player's registration was rejected`
- `TARGET_HAS_PARTNER: 'Người chơi đã có partner'` → `Player already has a partner`
- `SAME_TEAM: 'Không thể ghép đôi với chính mình'` → `You cannot pair with yourself`
- `REQUEST_ALREADY_SENT: 'Bạn đã gửi yêu cầu ghép đôi này rồi'` → `You have already sent this pair request` |
- `REQUEST_PENDING_FROM_TARGET: 'Người này đang chờ bạn xác nhận ghép đôi'` → `This player is waiting for you to confirm pairing`

`respondToPairRequest`:
- `AUTH_REQUIRED: 'Vui lòng đăng nhập'` → `Please sign in`
- `REQUEST_NOT_FOUND: 'Yêu cầu không tồn tại'` → `Request does not exist`
- `NOT_TARGET_USER: 'Bạn không có quyền xử lý yêu cầu này'` → `You do not have permission to handle this request`
- `REQUEST_NOT_PENDING: 'Yêu cầu đã được xử lý'` → `Request already handled`
- `TABLE_LOCKED: 'Giải đấu đã diễn ra'` → `Tournament has already started`
- `FROM_TEAM_ALREADY_PAIRED: 'Người gửi yêu cầu đã có partner'` → `Sender already has a partner`
- `TO_TEAM_ALREADY_PAIRED: 'Bạn đã có partner'` → `You already have a partner`

### `src/hooks/useParentTournament.ts` (4 direct calls + 4 via `handleMutationError`)

| Line | Original VI | Proposed key | EN translation |
|---|---|---|---|
| 47 | `Vui lòng đăng nhập` | `toast.common.authRequired` | `Please sign in` |
| 54 | `Tên giải không được để trống` | `toast.parentTournament.create.nameRequired` | `Tournament name is required` |
| 73 (`genericMsg`) | `Không thể tạo giải tổng` | `toast.parentTournament.create.error` | `Failed to create parent tournament` |
| 74 (`permissionDeniedMsg`) | `Bạn không có quyền tạo giải tổng` | `toast.parentTournament.create.permissionDenied` | `You do not have permission to create a parent tournament` |
| 186 | `Bạn phải xoá tất cả nội dung con trước khi xoá giải tổng` | `toast.parentTournament.delete.hasChildren` | `You must delete all sub-events before deleting the parent tournament` |
| 195 | `Đã xoá giải tổng` | `toast.parentTournament.delete.success` | `Parent tournament deleted` |
| 199 (`genericMsg`) | `Không thể xoá giải tổng` | `toast.parentTournament.delete.error` | `Failed to delete parent tournament` |
| 200 (`permissionDeniedMsg`) | `Bạn không có quyền xoá giải tổng này` | `toast.parentTournament.delete.permissionDenied` | `You do not have permission to delete this parent tournament` |

### `src/hooks/useRefereeManagement.ts` (6 calls)

| Line | Original VI | Proposed key | EN translation |
|---|---|---|---|
| 114 | `Không tìm thấy người dùng với email này` | `toast.referee.addByEmail.userNotFound` | `No user found with that email` |
| 127 | `Người này đã là trọng tài` | `toast.referee.addByEmail.alreadyReferee` | `This user is already a referee` |
| 141 | `Đã thêm trọng tài: ${name}` | `toast.referee.addByEmail.success` (params: `{name}`) | `Added referee: {name}` |
| 146 | `Không thể thêm trọng tài` | `toast.referee.addByEmail.error` | `Failed to add referee` |
| 163 | `Đã gỡ trọng tài` | `toast.referee.remove.success` | `Referee removed` |
| 168 | `Không thể gỡ trọng tài` | `toast.referee.remove.error` | `Failed to remove referee` |

### `src/hooks/useTeamMatchRefereeManagement.ts` (6 calls — same shape as above)

| Line | Original VI | Proposed key | EN translation |
|---|---|---|---|
| 117 | `Không tìm thấy người dùng với email này` | `toast.referee.addByEmail.userNotFound` (shared) | `No user found with that email` |
| 130 | `Người này đã là trọng tài` | `toast.referee.addByEmail.alreadyReferee` (shared) | `This user is already a referee` |
| 144 | `Đã thêm trọng tài: ${name}` | `toast.referee.addByEmail.success` (shared, params: `{name}`) | `Added referee: {name}` |
| 149 | `Không thể thêm trọng tài` | `toast.referee.addByEmail.error` (shared) | `Failed to add referee` |
| 166 | `Đã gỡ trọng tài` | `toast.referee.remove.success` (shared) | `Referee removed` |
| 171 | `Không thể gỡ trọng tài` | `toast.referee.remove.error` (shared) | `Failed to remove referee` |

### `src/hooks/useDoublesEliminationReferees.ts` (6 calls — same shape as above)

| Line | Original VI | Proposed key | EN translation |
|---|---|---|---|
| 66 | `Không tìm thấy người dùng với email này` | `toast.referee.addByEmail.userNotFound` (shared) | `No user found with that email` |
| 79 | `Người này đã là trọng tài` | `toast.referee.addByEmail.alreadyReferee` (shared) | `This user is already a referee` |
| 93 | `Đã thêm trọng tài: ${name}` | `toast.referee.addByEmail.success` (shared, params: `{name}`) | `Added referee: {name}` |
| 98 | `Không thể thêm trọng tài` | `toast.referee.addByEmail.error` (shared) | `Failed to add referee` |
| 115 | `Đã gỡ trọng tài` | `toast.referee.remove.success` (shared) | `Referee removed` |
| 120 | `Không thể gỡ trọng tài` | `toast.referee.remove.error` (shared) | `Failed to remove referee` |

### `src/hooks/_mutationErrors.ts` (2 calls — but strings come from caller via opts)

These are not literals — they re-display `opts.permissionDeniedMsg` / `opts.genericMsg` passed in. Once every caller switches to `tToast(...)` for those opts, this helper continues to work unchanged.

| Line | Behavior |
|---|---|
| 70 | `toast.error(permissionDeniedMsg)` — uses caller-supplied string |
| 72 | `toast.error(genericMsg)` — uses caller-supplied string |

---

## Source of truth for current language (already discovered)

- **Storage key:** `pickleball-hub-language` (`src/i18n/index.tsx` line 20)
- **Default:** `"en"` (line 55)
- **Set via:** `localStorage.setItem(STORAGE_KEY, lang)` in `setLanguage` (line 95). `setLanguageFromUrl` and geo-detect via `sessionStorage` do NOT persist, so they should NOT be the source of truth for hooks.
- **Standalone util should:** read `localStorage.getItem('pickleball-hub-language')` first, fall back to `'en'`. (Optionally also peek at `sessionStorage.getItem('geo_detected_language')` to match React behavior, but pragmatic to skip — hooks run after the provider has hydrated so `localStorage` is usually populated.)

## Recommended translation namespace shape (for the follow-up PRs)

```ts
// vi.ts / en.ts (mirror shape)
toast: {
  common: {
    authRequired: "Vui lòng đăng nhập" / "Please sign in",
    unknownError: "Có lỗi xảy ra" / "Something went wrong",
  },
  quickTable: {
    create: {
      authRequired: "Vui lòng đăng nhập để tạo bảng đấu",
      nameRequired: "Tên giải không được để trống",
      softLaunchLimit: "Đã đạt giới hạn soft launch...",
      error: "Không thể tạo bảng đấu",
    },
  },
  registration: { submit: {...}, update: {...}, cancel: {...}, approve: {...}, reject: {...}, bulkApprove: {...}, btcOverride: {...} },
  teamRegistration: { createTeam: {...}, createInvitation: {...}, cancelInvitation: {...}, acceptInvitation: {...}, removePartner: {...}, btcManage: {...} },
  quickTableMutations: { addPlayers: {...}, createGroups: {...}, createGroupMatches: {...}, updateMatchScore: {...}, updateTableStatus: {...}, movePlayer: {...}, addPlayerToGroup: {...}, removePlayer: {...}, regenerateMatches: {...}, updateCourtSettings: {...}, reassignCourts: {...}, deleteTable: {...}, updateCourtName: {...} },
  pairRequest: { create: {...}, respond: {...}, cancel: {...}, errorCodes: { /* the inline errorMessages maps move here */ } },
  parentTournament: { create: {...}, delete: {...} },
  referee: { addByEmail: {...}, remove: {...} },  // shared by all 3 referee hooks
}
```

## Standalone util sketch (for the follow-up PR)

```ts
// src/lib/i18n-standalone.ts (no React imports)
import { vi } from "@/i18n/vi";
import { en } from "@/i18n/en";

const STORAGE_KEY = "pickleball-hub-language"; // must match src/i18n/index.tsx

const bundles = { vi, en } as const;

export function getCurrentLanguage(): "vi" | "en" {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "vi" || stored === "en" ? stored : "en";
}

function getNested(obj: unknown, path: string[]): unknown {
  return path.reduce<unknown>((acc, k) =>
    acc && typeof acc === "object" && k in (acc as Record<string, unknown>)
      ? (acc as Record<string, unknown>)[k]
      : undefined, obj);
}

export function tToast(key: string, params?: Record<string, string | number>): string {
  const lang = getCurrentLanguage();
  const path = key.split(".");
  let resolved = getNested(bundles[lang], path);
  if (typeof resolved !== "string") resolved = getNested(bundles[lang === "vi" ? "en" : "vi"], path);
  if (typeof resolved !== "string") return key;
  if (!params) return resolved;
  return Object.entries(params).reduce<string>(
    (s, [k, v]) => s.replaceAll(`{${k}}`, String(v)),
    resolved,
  );
}
```

---

## Sign-off

- Audit author: Claude (Wave 2 W3.1 agent)
- Gate decision: **STOP — defer refactor to stacked sub-PRs (W3.1a / b / c)**
- Mutation behavior: untouched
- Component toast strings: untouched (out of scope — components have `useI18n()`)
