# Brief — UI/UX second opinion: porting web features into a native SwiftUI iOS app

You are a senior product designer reviewing a mobile-first, Vietnamese-primary
sports app. Be specific and concrete: name the exact element and the exact fix.
No generic design platitudes. You cannot see the repo, so everything you need is
below.

## Product

**ThePickleHub** — pickleball platform for Vietnam. ~95% of users are Vietnamese;
Vietnamese is the primary language, English secondary. Two clients:

1. **Web** (React, mobile-first, PWA) — production, feature-complete, ~90 routes.
2. **Native iOS app** (`/apple`, pure SwiftUI, "The Line" design system) — a
   strict SUBSET of web. No feature exists native that doesn't exist on web.

The typical user: standing at a noisy outdoor court in Saigon, mid-tier phone,
4G, one-handed, between games, checking a score or registering for a session.
Sessions are short and interrupted. Users arrive from Facebook deep links to a
single page, not by browsing the IA.

**Task under review:** the solo founder wants to "port all missing web features
to the native app" and will hand-test on an iPhone tomorrow morning.

## Native app as it exists today

Tab bar (5 tabs): Home, Live, Social, Feed (Bảng tin), Tools.
Rankings / Tournaments / Search / Notifications / Profile are reached from icon
buttons in the Home top bar, not from the tab bar.

Design system (SwiftUI, dark theme, lime accent `TLColor.accent`, cream fg):
- `TLCard` — dark surface card, hairline border.
- `TLButton(kind: .green | .cream | .outline)` — `minHeight: 44`, full width.
- `TLIconButton(systemName:label:)` — 44×44, accessibility label is a REQUIRED
  init parameter (compile-time enforcement).
- `TLBadge` — mono-caps outlined pill.
- `TLSelect` — Menu-based picker, `minHeight: 44`.
- `TLSegmented` — capsule segmented control; selected segment = lime fill; 180ms
  cross-fade + light haptic; supports a leading status dot per segment;
  `.isSelected` trait set correctly. Currently used with 2–3 segments max.
- `TLSheet` / `TLDialog` — sheet body ALWAYS wrapped in a ScrollView, because at
  large Dynamic Type a fixed-detent sheet silently clips the confirm button.
- `TLEmptyState(icon:title:subtitle:actionTitle:action:)` — centered, uses
  `@ScaledMetric` for the icon.
- `TLErrorState(title:message:retry:)` — same layout, default title
  "Không tải được", retry button "Thử lại".
- `TLLoadingView(rows:)` — redacted skeleton rows (thumbnail + 2 text lines).
  House rule: skeleton OR spinner, never both.
- `SafariView` — `SFSafariViewController` sheet, used to "hop to web" for
  features not yet native.

Native auth: Google sign-in + phone OTP. The Supabase session lives in the
native keychain. **`SFSafariViewController` does NOT share that session** — it
shares cookies with Safari.app, where the user is usually signed out.

## The 11 gaps (web has, native lacks) — what you are reviewing

For each, say: port as-is / port but REDESIGN (say how) / DO NOT PORT (UX reason,
not effort). Then rank them for a court-side user.

1. **Remote push notifications.** Native only does local notifications (live
   match reminders scheduled on-device). No APNs registration at all. Web/PWA
   gets server push (new event at your club, match result to confirm, livestream
   starting).

2. **Pro tournament detail.** Native `TournamentDetailView` shows: status badge,
   serif title, date range, organiser name, description, then a single
   full-width lime button **"Xem trên web"** which opens the web page in a
   `SafariView`. All brackets, draws, schedule, registration live behind that
   button. Signed-out inside SafariView.

3. **Organizer TV-mode dashboard** (`/tools/dashboard/:type/:id` on web). Web
   behaviour: fullscreen via the Fullscreen API, a grid of **6 items per page**
   (court cards showing current match + score, plus live/next match cards),
   auto-rotating pages every **10 seconds**, keyboard nav (←/→ page, Space
   pause, Esc exit), and optional sound cues when a match ends. It is an
   at-a-glance display for a laptop plugged into a TV at the venue so players
   can see when they're up next.

4. **`/tournaments` tab structure.** Web has THREE top-level tabs — Featured
   (a carousel of "parent tournaments", i.e. multi-stage events: group stage →
   playoff), Watch (pro events), Community (user-created brackets). Featured is
   the DEFAULT. The Community tab then has a SECOND row of 4 format tabs
   (Quick Tables / Doubles Elim / Flex / Team Match) and a THIRD control for
   ongoing vs ended. Tabs are URL-controlled so they deep-link.
   Native has only `TLSegmented` with 2 segments: "Theo dõi" (Watch) /
   "Cộng đồng N" (Community, with a count). No format filter, no ongoing/ended
   split, no Featured/parent concept at all.

5. **Parent (multi-stage) tournament page** — the page a Featured card links to.
   Shows the stages of a multi-stage event and their status pills: Sắp diễn /
   Vòng bảng / Playoff / Hoàn thành.

6. **Social event slots + free perks + weekly recurrence** (organizer create/edit
   flow). "Slots" = registration groups within one session, e.g. "Nhóm 18:00–20:00
   trình 3.0–3.5" — a player picks which slot they register for. Perks = free
   items (water, shuttle-equivalent). Recurrence = "repeat this event weekly".
   Native organizer flow can create events but not these three.

7. **Club: invite a member by search.** Native club management can approve or
   remove existing requests only; it cannot search for a user and invite them.

8. **DUPR connect/disconnect.** DUPR is the international pickleball rating
   system. Native reads and displays the user's DUPR rating chip in the Home top
   bar. Tapping it when NOT connected opens `thepicklehub.net/dupr` in a
   `SafariView` — which, because of the cookie isolation above, renders a plain
   text page: heading "Cần đăng nhập" ("Sign-in required"), body "Anh đăng nhập
   ThePickleHub rồi quay lại trang này để kết nối DUPR" ("Sign in to
   ThePickleHub, then come back to this page"). There is no sign-in button on
   that page.

9. **Registration recovery** (`/khoi-phuc-dang-ky`) — a user who registered for
   an event as a guest recovers their registration. Protected by a Cloudflare
   Turnstile captcha.

10. **Public match permalink** (`/tran-dau/:slug`) — shareable, viewable logged
    out, exists mainly for SEO and for pasting into Facebook/Zalo groups. Native
    can create a match log but has no public permalink screen.

11. **Standalone "all videos" browse page.** Native only shows a partial video
    row inside the Home screen; native video playback itself already exists
    (AVKit, HLS, PiP, resume).

Related existing native behaviour worth judging: when a signed-out user taps
"Tạo" (create a club) or "Tham gia" (join a club), the app opens
`thepicklehub.net/login` in a `SafariView` instead of showing the native login
screen it already has.

## What I want from you

1. Which of the 11 must be **redesigned**, not ported 1:1, and exactly how — give
   the concrete iOS pattern (sheet, segmented, Menu filter, list, external
   display, share sheet, etc.).
2. Which should **not be ported at all** for UX reasons (not effort reasons).
3. The `/tournaments` 3-tab + 4-format + ongoing/ended structure on a 390pt-wide
   phone: what is the correct native information architecture? Be concrete about
   which control goes where.
4. TV-mode on a 6" phone: is there a real native answer, or is this inherently a
   non-phone feature? If there is a native answer, describe the exact screen.
5. Accessibility: VoiceOver, Dynamic Type (up to AX5), 44pt targets — name the
   specific risks in the ports you recommend.
6. Vietnamese microcopy for any new screen you propose, plus its empty, loading,
   error and offline states. Vietnamese runs ~20–30% longer than English —
   flag anywhere that breaks a button or a segmented control.
7. The biggest UX risk in this whole "port everything in one night" plan that I
   have not asked about.
