# Recon vòng 0 — cụm UX-06 + UX-07

Agent: `idea-recon` · 2026-07-20 · read-only · 63 tool call

> Ghi nguyên văn output. Không biên tập.

## UX-06 — Destructive organizer operations (surface map)

**1. Full inventory (web):**

| Action | Location | Table/RPC | Hard/Soft | Confirm dialog |
|---|---|---|---|---|
| Delete QuickTable | `src/pages/MyTournaments.tsx:237` | RPC `delete_quick_table` (`supabase/migrations/20251230114611_...sql:88-125`) — hard-deletes matches/players/groups/registrations/referees then table row | HARD, cascaded manually in RPC body | Yes, `AlertDialog` in `MyTournaments.tsx:549-572`, no typed-confirm |
| Delete DoublesElim tournament | `MyTournaments.tsx:240` — `supabase.from("doubles_elimination_tournaments").delete()` | client-side hard DELETE, relies on DB `ON DELETE CASCADE` | HARD | Same shared `AlertDialog` as above |
| Delete Flex tournament | `MyTournaments.tsx:243` — `.from("flex_tournaments").delete()` | client-side hard DELETE + cascade | HARD | Same shared dialog |
| Delete TeamMatch tournament | `MyTournaments.tsx:246` — `.from("team_match_tournaments").delete()` | client-side hard DELETE + cascade | HARD | Same shared dialog |
| Delete all matches of a TeamMatch tournament | `src/hooks/useTeamMatchMatches.ts:354-374` `deleteMatchesMutation` — hard DELETE `team_match_matches` by `tournament_id` | HARD | **No caller anywhere in `src/`** — mutation exported (`:865`) but unused/unwired dead code |
| Delete a team (TeamMatch) | `src/hooks/useTeamMatchTeams.ts:421-` `deleteTeamMutation`, hard delete | HARD, cascades to `team_match_teams_members`/matches (`ON DELETE CASCADE`, `20260107133349_...sql:68`) | Yes — `src/components/teamMatch/TeamList.tsx:216-228` `AlertDialog` |
| Remove roster member | `useTeamMatchTeams.ts:329` `removeRosterMemberMutation`, hard delete | HARD | **Mixed**: `TeamRosterManager.tsx:467-526` has `AlertDialog`; `TeamJoinPanel.tsx:138` and `TeamOverviewCard.tsx:265` call `removeRosterMember` directly với **no confirm dialog** |
| Cancel social event | `src/pages/EditSocialEvent.tsx:353-387` → RPC `cancel_social_event` (`supabase/migrations/20260521130000_club_managers.sql:532-580`) | SOFT — `UPDATE social_events SET status='cancelled'` + cascades status to all `event_registrations` | Typed-name confirm modal, `EditSocialEvent.tsx:839-878` (must retype event title) |
| Roster: mark registration cancelled/no-show | `src/pages/SocialEventRoster.tsx:294,299` `patch(id,{status:...})` | SOFT (status update on `event_registrations`) | none seen (organizer-facing table row action) |
| Remove club member | RPC `remove_club_member` (`supabase/migrations/20260522120000_club_members.sql:400-427`) | HARD DELETE from `club_members` (leaf table) | not verified in caller UI |
| Delete blog post (VI admin) | `src/pages/admin/AdminViBlog.tsx:60-61,186` `useDeleteViBlogPost` | HARD (assume `vi_blog_posts` DELETE) | Yes, `AlertDialog` |
| Delete livestream/video (creator) | `src/hooks/useCreatorData.ts:198-219,321-342` `deleteVideo`/`deleteLivestream` | HARD DELETE row (no Mux asset delete call visible in this hook) | Yes, `AlertDialog` in `CreatorLivestreams.tsx:147-170,279-302` |
| Admin news unpublish | `src/pages/admin/AdminNews.tsx:195-199` `.update({status})` | SOFT — **no hard delete of `news_items` exists** | n/a |
| Delete venue/club | **Not found anywhere in `src/`** — not tools | n/a | n/a |
| Delete bracket / regenerate | No dedicated "regenerate bracket" UI found; `deleteMatchesMutation` above is closest but unwired |

Native `/apple` equivalents: `Features/Bracket/TeamMatchManageTeamsView.swift:98-100,221` — `deleteTeam` called directly from a button tap, **no confirmation UI** at that call site (gap vs. web's `AlertDialog`).

**2. Schema reality:** only `dupr_match_submissions.deleted_at` exists as a soft-delete column anywhere in `types.ts` — irrelevant to organizer ops. No tournament/event table has `deleted_at`/`archived`. Soft-delete in practice = TEXT `status` columns (`social_events.status='cancelled'`, `event_registrations.status`). Real hard-delete + cascade paths (mass-deletes another user's data): `doubles_elimination_tournaments`/`flex_tournaments`/`team_match_tournaments` → cascades to their matches/teams/registrations tables (multiple `ON DELETE CASCADE` FKs, e.g. `20260107133349_...sql:44,55,68,81,116`; `20260123142717_...sql:21,30,47,71`; `20260122020801_...sql:22,39,70`); `quick_tables` cascade is done manually inside `delete_quick_table` RPC, same effect. **None of these check for existing paid/active registrations before deleting.**

**3. Existing patterns, reuse:** `useConfirm()` (`src/hooks/useConfirm.tsx`) used in 10 files (quicktable registration/parent view, forum, dupr, club landing, admin) — **not** used by any of the destructive flows above, which all hand-roll `AlertDialog`. `cancel-registration`/`reactivate-registration` edge functions (`supabase/functions/cancel-registration/handler.ts`, `reactivate-registration/handler.ts`) are the one true cancel↔undo pair, but **player-facing** (magic-token auth, wired only in `src/pages/PlayerRegistration.tsx:159,206`), not organizer-facing — nothing analogous exists for organizer actions. `useAutosaveDraft` (#407) is unrelated to delete/undo. No sonner toast-with-undo-action pattern found anywhere in `src/components/ui/`.

**4. Non-undoable side effects:** none of the destructive actions above call `send-push-notification`, `notification-send`, or Resend email — `cancel_social_event` only updates rows, no notify. **No refund RPC/function exists anywhere** (`create-payment-order`/`mark-payment-claimed` have no counterpart "refund" function). So money-adjacent destructive actions (deleting a paid QuickTable/TeamMatch/tournament) have zero automated financial rollback — deleting after payment leaves the payment claim orphaned with no compensating action in code.

## UX-07 — Discovery → registration

**5/6. Two real flows, step counts:**
- **Social event:** `/social` (`SocialEventList.tsx`) → `/social/:slug` (`SocialEventDetail.tsx`) → CTA opens `RegistrationModal` (`src/components/social-events/RegistrationModal.tsx`, in-page dialog, no route change) → phone OTP (guest) or 1-tap (club member skip-OTP) → success. **2 page loads + 1 modal**, no forced login for guests. Guest path = `social_event_guest_register` RPC family (`supabase/migrations/20260716090000_db01_atomic_event_capacity.sql:82`, latest at `20260716150000_db01_unique_violation_scope.sql:8`); member path = `register_event_as_member` (latest `20260717200000_db01c_member_capacity_lock.sql:23`).
- **Tournament (QuickTable/Doubles/Flex/TeamMatch):** discovery is **not** via `/tournaments` — that route (`TournamentDetail.tsx`) is the livestream/pro-tour content page and has **no registration CTA at all** (verified by full-file read: only video/livestream sections). Real discovery is `/tools/quick-tables` etc. list pages → `/tools/quick-tables/:shareId` (`QuickTableView.tsx`) → inline `RegistrationForm`/`DoublesRegistrationForm` dialog on same page → submit. **2 page loads + 1 in-page form**, but gated: `ConditionalAuth` wrapper (`src/components/auth/ConditionalAuth.tsx:17-19`) forces full login via `RequireAuth` when system setting `require_login_tournament_detail` is on, and independently `RegistrationForm.tsx:201` shows a hard `loginToRegister` wall (`navigate("/login?redirect=...")`) if `!user` — **no guest path exists for tournament-tool registrations**, unlike social events.

**7. Instrumentation:** `src/lib/journeys.ts` declares 4 `JourneyKind`: `player_registration`, `organizer_event`, `organizer_tournament`, `livestream_gate`. `player_registration` is wired **only** in `RegistrationModal.tsx` (social event registration) — start/step/complete events at lines 282-591. **Zero journey instrumentation** on any tournament-tool registration path (`RegistrationForm.tsx`, `DoublesRegistrationForm.tsx`, `DoublesEliminationRegistrationSection.tsx` — none call `startJourney`/`trackJourneyStep`). No discovery-page instrumentation (`/tournaments`, `/social`, `/tools/*` list pages) exists at all — the funnel only starts once a player is already on a detail page and opens the modal, so the "did they even find it" step is unmeasured. Adding **one more journey kind** (e.g. reuse `player_registration` with a `tool` prop, mirroring how `organizer_tournament` reused `organizer_event`'s shape) covers the tournament-tool registration completion side, but discovery-to-detail-page drop-off needs separate page-view/CTA-click events since journeys only start at CTA-open.

**8. Reusable infra:** `useUrlBackedState` (`src/hooks/useUrlBackedState.ts`) currently only consumed by `Rankings.tsx:40,46` — genuinely reusable, unused elsewhere. `PageStates` (`src/components/states/PageStates.tsx`) already used in `ClubLanding.tsx`, `SocialEventDetail.tsx`, `CreateSocialEvent.tsx`, `ConditionalAuth.tsx`. Registration RPCs to reuse per constraint: `social_event_guest_register`, `register_event_as_member`, `social_event_reactivate_registration` (all in `20260716090000_db01_atomic_event_capacity.sql` / `20260717200000_db01c_member_capacity_lock.sql`) — signatures not fully dumped here, read those migration files directly before wiring UX-07 changes.

**9. Prior-art constraints from ux-01-05 proposal:** D1 RESOLVED — instrument-before-optimize is the house rule (`organizer_tournament` journey wired in #407, funnel read gated on 2-week data, commit "not claim conversion improvement" until then — same rule blocks UX-07 claiming discovery-to-registration improvement pre-baseline). D3: templates/presets must whitelist fields and **ban bank-account fields** — any UX-07 "quick register"/prefill shortcut touching payment fields inherits this ban. `journey-screens.md:51` — "expand only from traffic/risk evidence" quoted directly in that proposal, applies equally here.

**10. Native `/apple`:** organizer-delete: only `TeamMatchManageTeamsView.swift` has a delete action (team delete, no confirm). No SwiftUI screen found for deleting QuickTable/Doubles/Flex/TeamMatch tournaments (native equivalent of `MyTournaments.tsx` not located — search only surfaced `ClubManageView.swift`, no "MyTournaments"). Discovery→registration: `Features/Social/SocialListView.swift` exists (social discovery), `Features/Bracket/TeamMatchRegisterSheet.swift` exists (tournament registration sheet) — both present, but journey/analytics parity with web not verified.

## Unknowns worth asking Cuong

1. UX-06 scope: given "chưa từng đau thật" — is the ask now literally just "confirm dialogs on the two unguarded remove-member call sites + wire the dead `deleteMatchesMutation`", or does he still want a time-boxed undo (soft-delete + restore window) for the 4 hard-delete tournament-kind rows in `MyTournaments.tsx`?
2. UX-07 "cảm nhận" — which specific screen does Cuong feel players drop off at: the `/tournaments`→no-CTA dead-end (real bug-shaped finding above), the tournament-tool login wall, or something upstream (feed/SEO landing) not covered by this recon?
3. Does the missing guest-registration path for QuickTable/Doubles/Flex/TeamMatch (login wall, no OTP fallback) count as in-scope for UX-07, or is UX-07 strictly about the social-event flow that already has a guest path?

---

## ⚠️ ĐÍNH CHÍNH VÒNG 0 — recon SAI dữ kiện then chốt (Cuong bắt, orchestrator kiểm chứng)

Recon khẳng định: *"discovery is **not** via `/tournaments` — that route (`TournamentDetail.tsx`) has **no registration CTA at all**"*.

**SAI.** Recon đọc nhầm `src/pages/TournamentDetail.tsx` (trang CHI TIẾT một giải pro/livestream) thay vì `src/pages/Tournaments.tsx` (trang DANH SÁCH tại route `/tournaments`).

Kiểm chứng bằng đọc file trực tiếp:

- `src/pages/Tournaments.tsx:25` — `type Tab = "watch" | "community"`
- `src/pages/Tournaments.tsx:338-341` — tab thứ hai nhãn `{vi ? "Cộng đồng" : "Community"}` kèm `communityCount`
- `src/pages/Tournaments.tsx:145` — mặc định rơi về tab `community` khi không có nội dung watch
- `src/pages/Tournaments.tsx:65-111` — `FORMATS[]` khai báo cả 4 thể thức cộng đồng với `linkBase` `/tools/quick-tables`, `/tools/doubles-elimination`, `/tools/flex-tournament`, `/tools/team-match`
- `src/pages/Tournaments.tsx:459,553` — item danh sách `<Link to={`${linkBase}/${share_id}`}>` trỏ thẳng tới trang giải
- `src/pages/Tournaments.tsx:125` — tab đọc/ghi qua query param (đã URL-backed)

**Luồng khám phá THẬT của người chơi:**

`/tournaments` → tab **Cộng đồng** → 4 mục thể thức liệt kê giải đang chạy → `/tools/<format>/<share_id>` → form đăng ký → **tường đăng nhập**.

**Cái gì của recon vẫn ĐÚNG và vẫn là phát hiện chính:** sự bất đối xứng ở bước cuối. Social event cho khách đăng ký bằng OTP (`social_event_guest_register`); còn 4 thể thức giải ở `/tools/*` bắt buộc tạo tài khoản (`RegistrationForm.tsx:201` → `navigate("/login?redirect=...")`), không có đường khách. Đây là giả thuyết số 1 cho UX-07 — nhưng là **giả thuyết**, chưa có số, và `player_registration` journey hiện chỉ gắn ở social event nên đường giải hoàn toàn mù.

**Bài học lặp lại:** cụm UX-01..05 cũng có recon vòng 0 sai dữ kiện then chốt (tưởng các flow chưa phải stepped wizard), do `ui-ux-critic` bắt ở vòng sau. Lần này Cuong bắt ngay vòng 0. Panel vòng 1 nhận bản ĐÃ đính chính — nhưng vẫn phải tự kiểm chứng file, đừng tin recon.

---

## ⚠️ ĐÍNH CHÍNH LẦN 2 — bản đính chính ở trên CŨNG SAI (ui-ux-critic bắt, orchestrator kiểm chứng)

Bản đính chính lần 1 viết: *"`Tournaments.tsx:145` — mặc định rơi về tab `community` khi không có nội dung watch"*. Câu đó mô tả đúng chữ trong code nhưng **sai về hành vi thật**, vì nó tả một nhánh không bao giờ chạy.

```
src/pages/Tournaments.tsx:144  const hasWatchContent = tournaments.length > 0 || liveStreams.length > 0;
src/pages/Tournaments.tsx:145  const tab: Tab = userTab ?? (hasWatchContent ? "watch" : "community");
```

`useTournaments()` (`src/hooks/useTournamentData.ts:21-31`) là `select("*, organization:organizations(...)")` — **không lọc `status`, không `limit`**, nên nó đếm cả giải pro đã kết thúc từ các năm trước.

Kiểm chứng trên PRODUCTION (không suy đoán):
- `curl -A Googlebot https://www.thepicklehub.net/tournaments` → trả về nội dung PPA (4 lần) + MLP (2 lần)
- `curl https://www.thepicklehub.net/sitemap-tournaments.xml` → 11 `<url>`

→ `tournaments` KHÔNG rỗng trên prod → `hasWatchContent` **luôn true** → nhánh `"community"` ở `:145` là **code chết**. `/tournaments` **không bao giờ** mặc định mở tab Cộng đồng.

**Hệ quả UX thật:** người chơi nhận link Zalo "đăng ký giải đi anh" mở `/tournaments` và rơi vào danh sách phát sóng pro cũ, phải tự nhận ra có tab thứ hai. Đây là điểm rớt đầu tiên của UX-07, và nó là **1 dòng code**, không phải 4 ngày thiết kế lại.

**Bài học về quy trình (đáng ghi):** recon sai lần 1 (đọc nhầm file), orchestrator sửa nhưng sửa nửa vời — chép lại chữ trong code mà không hỏi nhánh đó có chạy không. `ui-ux-critic` bắt được vì nó truy ngược lên nguồn dữ liệu của biến điều kiện. Đây đúng là lý do panel tồn tại: **một agent sai, agent khác bắt; orchestrator cũng sai được và cũng phải bị bắt.** Cụm UX-01..05 cũng chính `ui-ux-critic` bắt recon sai — lặp lại lần thứ hai, nên coi đây là điểm yếu hệ thống của bước recon, không phải rủi ro ngẫu nhiên.
