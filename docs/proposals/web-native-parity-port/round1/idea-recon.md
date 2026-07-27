# Recon — web↔native (/apple) parity map

Not "does this exist" (recon agent for a single feature) — this is a full-repo
inventory diff between web prod (src/pages/) and native /apple (SwiftUI). No
opinions below, just what's there.

## 1. Web inventory (src/App.tsx MIRRORED array + literal routes)

~90 routes total. User-facing, non-admin/non-SEO-only groups:
- **Home/discovery**: `/`, `/live`, `/live/:id`, `/videos`, `/watch/:id`, `/tournaments`, `/tournament/:slug`, `/org/:slug`, `/rankings`, `/search`, `/news`, `/news/:slug`, `/blog`, `/blog/:slug`
- **Social/community**: `/social`, `/social/:slug`(+roster/matchmaking/live), `/clubs`, `/clb/:slug`(+manage/edit/create-event/edit-event), `/san`(venues, +submit/city/detail), `/tim-ban-choi`, `/tin-nhan`, `/forum`(+category/post/new)
- **Match**: `/match`, `/match/new`, `/match/confirm`(+:code), `/tran-dau/moi` (check-in wizard), `/tran-dau/:slug` (public match permalink)
- **Tools/brackets**: `/tools`, `/tools/quick-tables`(+parent/:shareId, setup, view), `/tools/team-match`(+new/score/view), `/tools/doubles-elimination`(4 sub-routes), `/tools/flex-tournament`(3), `/tools/dashboard`(picker + `/tools/dashboard/:type/:id` TV-mode display)
- **Account**: `/account`, `/account/my-tournaments`, `/dupr`, `/notifications`, `/onboarding`, `/nguoi-choi/:username`, `/dang-ky/:magic_token`, `/khoi-phuc-dang-ky`, `/join/:inviteCode`
- **Static/legal**: `/privacy`, `/terms`, `/advertise`, `/affiliate-disclosure` (skip for parity — legal text)
- **Admin-only** (skip — 19 routes under `/admin/*`, desktop workflow)
- **Creator-only** (7 routes under `/creator/*`: overview, videos, video form, livestreams, livestream form, settings, tournaments)
- **Embeds/redirects/SEO-only** (skip): `/embed/live/:id`, `/embed/video/:id`, legacy quick-table/match-scoring redirects

## 2. Native inventory (/apple)

Tab shell = `apple/ThePickleHub/Features/Shell/AppTabView.swift`: Home, Live, Social, Feed (Bảng tin), Tools. Rankings/Tournaments/Profile/Search/Notifications reached from Home toolbar.

`Features/` has 17 feature dirs, `Core/` has 24 `*Repository.swift` files (repository-per-domain pattern, all Supabase PostgREST + RPC calls). Confirmed present and functionally deep: Bracket (QuickTable/TeamMatch/DoublesElim/Flex incl. referee scoring engine, MLP repechage, settings sheets), Clubs, Feed (with native AVPlayer video), FindPlayers, Forum, Home, Live (native HLS/AVKit player, live chat), Match (log/confirm), Messages, Notifications (local only), Profile/Onboarding, Rankings, Registration (magic-link + deep links), Search, Social (organizer suite: roster/matchmaking/live/create-edit), Tournaments, Venues.

## 3. Gap table (web has, native missing/partial)

| Feature (web source) | Native touch surface | Size | Status |
|---|---|---|---|
| Creator Studio: livestream create/manage, video upload, creator analytics (`src/pages/creator/*`, 7 files) | new `Features/Creator/`, `Core/Creator/CreatorRepository.swift`; hits `mux-create-livestream` edge fn | **L** | Deliberately web-only per memory (`native-port-session-2026-07.md`) |
| Remote push notifications — device receives server-sent push (`send-push-notification`, `notification-send` edge fns, `push_tokens` table) | `ThePickleHubApp.swift:11` only implements local `UNUserNotificationCenterDelegate`; no `registerForRemoteNotifications`/APNs token registration anywhere in `/apple` | **L** | Confirmed still missing — grepped, no APNs/FCM wiring |
| Pro tournament detail `/tournament/:slug` | `Features/Tournaments/TournamentDetailView.swift:51` opens `SafariView(WebRoutes.tournament(...))` — no native bracket/registration screen | **L** | Confirmed still web-hop |
| `/tools/dashboard` + `/tools/dashboard/:type/:id` (organizer TV-mode courtside display, sound cues) | no `Dashboard`/`TVMode` matches anywhere in `/apple` | **M** | Confirmed missing (worth asking — TV-mode is external-display use case, may not fit phone) |
| `/tournaments` 3-way tabs (Featured parent-tournaments carousel / Watch / Community) + Community's format×status sub-tabs (`src/pages/Tournaments.tsx`) | `TournamentsView.swift` has only 2 `TLSegmented` tabs (Watch/Community), community list not sub-tabbed by format/ongoing-ended; no `ParentTournament` type anywhere native | **M** | Confirmed — `TLSegmented` only 2 cases |
| `/tools/quick-tables/parent/:shareId` (parent/multi-stage tournament page) | none | **S/M** | Confirmed no `ParentTournament*` in native grep |
| Social event slots (registration groups), free perks, weekly recurrence | `Core/Social/SocialOrganizerRepository.swift` has a `ponytail:`-style pending marker per memory | **M** | Per memory, still pending — not re-verified this session |
| Club: invite member by search (vs. current approve/remove-only) | `Features/Clubs/ClubManageView.swift` | **S** | Per memory, still pending |
| `/dupr` connect/disconnect flow | `AppTabView.swift:104` opens `WebRoutes.dupr` via `SafariView`; native only reads the DUPR chip (`ProfileRepository.duprChip()`) | **S** | Deliberate web-hop per memory |
| `/khoi-phuc-dang-ky` (recovery, Turnstile captcha) | none | **S** | Deliberate — captcha needs a web surface |
| Account: change email/password (`src/pages/Account.tsx`) | `Features/Profile/AccountSettingsView.swift` — need to confirm exact coverage; memory says deliberately left to web | **S** | Per memory, deliberate |
| `/tran-dau/:slug` public match permalink (SEO/sharable, viewable logged-out) | `Features/Match/MatchLogView.swift` covers *creating* a match log, not the public permalink page | **S** | Deliberate (SEO surface) per memory |
| `/videos` standalone browse-all page | folded into `Home/HomeVideosSection.swift` (partial list only) | **S** | Minor — stale code comment there still says "native player is Phase 6" even though `VideoPlayerScreen.swift`/`FeedVideoPlayerView.swift` already play natively |

Native-only (web doesn't have): none found — native is a subset, not a superset.

## 4. Prior-art memory check

`.claude/memory/native-port-session-2026-07.md` (2026-07-07 audit) already ran
this exact comparison once and listed the same 6 "còn lại" items + 6 "deliberately
web" items. Re-verified this session via grep/read — **all 6 "còn lại" items are
still genuinely missing today** (2026-07-27, 20 days later, no native commits
against those paths since). `native-mlp-state.md` / `team-match-settings-chat.md`
pending items (repechage, team settings/chat) are now **done** — confirmed
files exist (`Bracket/TeamMatchSettingsSheet.swift`, repechage commit `90cd7ed2`
already on `main`).

## 5. Native branches — nothing dangling

`/apple` is not a separate git repo; it's a normal path inside pickle-hub-pro.
`feat/native-ios-phase-1` has 0 commits ahead of `main` on `apple/`.
`feat/mlp-captain-registration` / `backup/native-2026-07-18` show 19 commits
"ahead" of `main` on `apple/` by `git log main..branch`, but `git diff main
branch -- apple/` is empty except `project.yml` dependency-resolution churn —
i.e. already squash-merged into main under different commit hashes. **No
recoverable native work is sitting on old branches.** New port work should
branch from `main`.

## 6. Reusable native infrastructure

- Auth: `Core/Auth/` + `Features/Auth/LoginView.swift`, `PhoneAuthView.swift`
- Supabase client + repository pattern: `Core/Supabase/`, one `*Repository.swift` per domain (24 total) — new features should add a repository here, not inline networking
- Theme/design tokens: `DesignSystem/`, `Core/Theme/` (`TLColor`, `TLSegmented` etc.)
- Deep links: `Core/Networking/DeepLink.swift` (universal links + `thepicklehub://` scheme)
- Web-hop pattern for deliberately-web features: `SafariView` + `WebRoutes` (used for DUPR connect, pro tournament detail, admin, creator)
- Native video: `VideoPlayerScreen.swift` (AVKit, HLS, resume progress, PiP/AirPlay) — reusable for any new video surface
- Local notifications: `Core/Live/LiveReminderStore.swift` + `ThePickleHubApp.swift` `UNUserNotificationCenterDelegate` — remote push would need to extend this, not replace it

## 7. Binding constraints

- `.claude/memory/fix-both-web-and-native.md` — every feature fix/update must ship to BOTH web and native in the same task, no "later" unless Cuong says so explicitly
- `.claude/memory/native-app-is-apple-folder.md` — native = `/apple` (SwiftUI); `/ios` is the legacy Capacitor webview shell, out of scope
- `.claude/memory/native-build-run-loop.md` — verification loop is `xcodegen → xcodebuild → simctl` on iPhone 17 Pro, bundle `net.thepicklehub.app.dev`

## 8. Unknowns worth asking Cuong

1. Which of the "deliberately web-only" items (Creator Studio, admin, DUPR connect, recovery captcha, match permalink) should now be reconsidered as native ports, vs. staying web-hop — the task says "port đầy đủ" (port everything) which conflicts with prior deliberate decisions.
2. Is `/tools/dashboard` (TV-mode courtside display) even meaningful on a phone, or is it inherently a "cast to external screen" feature that should stay web/out of scope for native?
3. Priority order — remote push (APNs infra, no existing pattern) and pro-tournament detail (bracket rendering from scratch) are both L-size infra builds; which should lead?
