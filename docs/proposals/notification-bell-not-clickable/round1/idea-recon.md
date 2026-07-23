# idea-recon — notification-bell-not-clickable (nguyên văn)

## Prior art / component map

- `src/components/social/notifications/UnifiedNotificationBell.tsx` — the **only live bell**. Renders via `Popover` (desktop) or `Drawer` (mobile, `useIsMobile()` matchMedia `max-width: 767px`) from shadcn/Radix. Trigger = `Button` (`variant="ghost" size="icon"`) wrapped in `PopoverTrigger asChild` / `DrawerTrigger asChild`. Panel content = `NotificationList` (`src/components/social/notifications/NotificationList.tsx`).
- Mounted twice in `src/components/layout/AppHeader.tsx:141` (`className="hidden md:block"`) and `:204` (`className="md:hidden"`, gated `{user && ...}`), and once in `src/components/layout/TheLineLayout.tsx:694` (`className="tl-icon-btn"`).
- `src/components/notifications/NotificationBell.tsx` is a **dead/legacy component** — it's a `<Link to="/notifications">` wrapped Bell button, not imported by any header per grep (only self + barrel `src/components/notifications/index.ts`). Not the one users see.

## Click → open flow

- `UnifiedNotificationBell.tsx:76` local `open` state drives `Popover`/`Drawer` `open`/`onOpenChange`. Radix owns the actual toggle-on-click via `PopoverTrigger`/`DrawerTrigger asChild` cloning the child.
- Unread count: `useUnifiedUnreadCount()` from `src/hooks/social/useUnifiedNotifications.ts` (React Query over `notifications` + `social_notifications` tables).
- Realtime: subscription is **not** in the bell — mounted once app-wide via `NotificationsRealtimeInitializer`, referenced in `src/App.tsx` and `src/pages/Notifications.tsx`. Comment at `UnifiedNotificationBell.tsx:69-74` confirms this is deliberate (two bell instances would double the channel count).

## Recent history on this file

```
git log --oneline -15 -- src/components/social/notifications/UnifiedNotificationBell.tsx
375cd764 fix(a11y): notification bell trigger ARIA + scroll-guard false red (#447)
```
Only one commit in the last 15 touches this file — 375cd764, ~1 day before the report.

**Diff detail (375cd764):** Before, both `PopoverTrigger`/`DrawerTrigger` wrapped the `Trigger` component in a bare `<span>`:
```
-            <span><Trigger unread={unread} highlight={highlight} /></span>
+            <Trigger unread={unread} highlight={highlight} />
```
and `Trigger` gained `forwardRef` + prop-spread (`{...props}`, `ref={ref}`) so Radix's `asChild`/`Slot` clones onto the `Button` element directly instead of the `span`.

**Analysis of that diff (nghi vấn, chưa verify runtime):** Radix `asChild` clones its *single child element* and merges `onClick`/`ref`/`aria-*` onto it via `cloneElement`. In the old code the child was the `<span>`, so the `span` received `onClick` — clicking anywhere inside it (including the nested `Button`) would still bubble and fire, so this shouldn't by itself have broken clicking (it was flagged as an ARIA-only bug, `aria-haspopup`/`aria-expanded` on a role-less span, in the commit message). In the new code, `Trigger` is a `forwardRef` component receiving `{...props}` including `onClick`/`ref`, which it explicitly spreads onto the inner `Button` (`UnifiedNotificationBell.tsx:42-49`). This is the textbook-correct `asChild` pattern and should work. **No obvious click-eating regression visible in this diff on inspection alone** — flagging it as "prior suspect, not confirmed" per the task, but nothing in the diff itself explains total click-dead behavior on both mobile and desktop.

## Other things checked, ruled out at code-read level

- `Button` (`src/components/ui/button.tsx:47-51`) and `Popover`/`Drawer` primitives (`src/components/ui/popover.tsx`, `drawer.tsx`) are stock shadcn/Radix, no pointer-events/z-index/aria-hidden overrides found.
- No `tabIndex={-1}` or `pointer-events-none` on the Trigger/Button/wrapper divs in `UnifiedNotificationBell.tsx` or the two header call sites (`AppHeader.tsx:141,204`, `TheLineLayout.tsx:694`).
- `AppHeader.tsx:141` and `:204` pass `UnifiedNotificationBell` directly, no extra wrapping `<span>`/overlay div at the call site.
- No overlapping full-screen overlay component found near these header mounts in this pass (not exhaustively checked against every global overlay — e.g. PWA install banner, cookie consent — those weren't traced here).

## Test coverage today

- **Zero.** No file matches `*bell*`/`*Bell*` under `src/**/__tests__` or `tests/`. `grep -i "bell\|notification"` across `tests/smoke.spec.ts` and `tests/journeys.spec.ts` returns nothing — the bell click is not exercised by smoke or the 10-journey e2e suite. `375cd764`'s own smoke fix only addressed the axe `aria-allowed-attr` scan and an unrelated scroll-guard check, not an actual click-and-verify-panel-opens assertion.
- `src/lib/social/__tests__/notification-formatters.test.ts` covers formatting logic only, not the bell UI.

## Constraints found

- `CLAUDE.md` has no bell-specific rule. Nearest relevant note: `*.legacy.tsx` convention — `NotificationBell.tsx` (legacy) is **not** suffixed `.legacy.tsx` despite being dead code, so it's not flagged by that convention; don't assume it's the active one from naming alone.
- MEMORY.md, session `2026-07-22e`: "smoke đỏ kinh niên = SW phantom reload first-install (#448) + chuông ARIA (#447)" — i.e. 375cd764 was framed purely as an ARIA/axe fix for CI red, not as a functional click fix. No prior mention of a real click-not-working user report before this one.

## Native /apple

- Has its own bell surface, unrelated code path: `apple/ThePickleHub/Features/Shell/AppTabView.swift`, `apple/ThePickleHub/Core/Notifications/NotificationModels.swift`, `apple/ThePickleHub/Features/Live/LiveComponents.swift`. Not in scope (bug is web-only) — noted per instructions only.

## Unknowns worth asking Cuong

1. Is the bug reproducible on `main` production right now (post-375cd764 deploy), or on the current `ops/blob-watchdog-and-ticket`/`csp-drift-fix` branch state before it reaches prod? Deploy status of 375cd764 wasn't verified (`curl` prod HTML for the click handler wasn't run — read-only code recon only).
2. Repro is "both mobile and desktop" — does it happen for a logged-out user too, or only signed-in (bell is `null` when `!user`, so logged-out users would see no bell at all, not a dead one — worth confirming report is from an authed session)?
3. Any browser console errors reported by the user (React error, hydration mismatch, or a CSP violation — this worktree is named `csp-drift-fix`, suggesting a live CSP investigation elsewhere in the repo that wasn't traced here for correlation)?
