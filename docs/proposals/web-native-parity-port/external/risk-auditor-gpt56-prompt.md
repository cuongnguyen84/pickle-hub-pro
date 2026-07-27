# Hostile SRE review brief — "port full web feature set to native iOS in one overnight autonomous run"

You cannot see the repo. Everything you need is below. Be concrete.

## The product
ThePickleHub — a bilingual (Vietnamese/English) pickleball platform, ~2000 real users, ~95% in Vietnam.
Run by ONE person (Cuong). Web: React SPA on Cloudflare Pages. Backend: a SINGLE Supabase project
(ref `ajvlcamxemgbxduhiqrl`) — Postgres + PostgREST + Edge Functions. There is NO staging Supabase
project. Prod is the only database.

Native iOS app lives at `/apple` — SwiftUI, XcodeGen-generated project, bundle id for dev builds is
`net.thepicklehub.app.dev`. It is NOT in the App Store yet (never submitted). It talks directly to
the SAME production Supabase project using the anon key (`apple/Config/Secrets.xcconfig` contains
`SUPABASE_PROJECT_REF = ajvlcamxemgbxduhiqrl`). Confirmed by reading `Core/Supabase/AppConfig.swift`.

## The proposed change
An autonomous agent runs overnight (~8 hours, no human in the loop, no mid-run review) and ports
"all missing web features" into the native app. Code is committed to a feature branch, NOT merged
to main, NOT submitted to App Store. Cuong opens the app on a simulator next morning and tests.

Confirmed gap list to be ported (from a repo inventory diff done earlier today):
1. Remote push notifications (APNs/FCM) — currently native has ONLY local `UNUserNotificationCenter`
   notifications. Zero APNs code, zero `registerForRemoteNotifications`, no Firebase SPM package in
   `project.yml`, no `GoogleService-Info.plist` in the repo, no `aps-environment` entitlement (the
   entitlements file has only `com.apple.developer.associated-domains`). Size: L.
2. Pro tournament detail screen (currently the native app opens a `SafariView` to the web page).
   Involves bracket rendering + tournament registration (a write). Size: L.
3. Organizer "TV mode" courtside dashboard. Size: M.
4. Tournaments list: 3-way tab layout + format/status sub-tabs (currently 2 tabs). Read-only. Size: M.
5. Parent/multi-stage tournament page. Read-only. Size: S/M.
6. Social event "slots" (registration groups), free perks, weekly recurrence. WRITES to
   `event_registrations`, `social_events`, `event_payment_config`. Size: M.
7. Club: invite member by search (writes to club membership). Size: S.
8. Creator Studio (livestream create via a Mux edge function, video upload). Size: L.

## Facts I have already verified in the repo

**Native already writes to prod heavily.** 98 `.insert()/.update()/.upsert()/.delete()` call sites
across `apple/`, plus ~45 distinct `.rpc(...)` calls, touching ~57 prod tables including
`event_registrations`, `payment_orders`, `profiles`, `quick_table_matches`, `team_match_games`,
`clubs`, `user_roles`. The repository-per-domain pattern means new features add a new
`*Repository.swift` that calls PostgREST directly.

**Capacity/integrity guards live in RPCs, not in the table.** Migration
`20260716090000_db01_atomic_event_capacity.sql` ("DB-01") and `20260717200000_db01c_member_capacity_lock.sql`
("DB-01c") fixed an event-overbooking race by taking a Postgres advisory lock
(`pg_advisory_xact_lock('event_capacity:' || event_id)`) INSIDE specific SECURITY DEFINER RPCs
(`social_event_guest_register`, `register_event_as_member`, `reactivate_registration`). There is NO
trigger and NO constraint on `event_registrations` enforcing capacity. The RLS INSERT policy is
literally:
```sql
CREATE POLICY "event_registrations_insert_self" ON public.event_registrations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND profile_id = auth.uid());
```
i.e. any logged-in user may insert a registration row into any event, any status, any time, with no
capacity, slot, or event-state check. Only the RPC path enforces those.

**RLS organizer/admin checks are OR'd with a global admin bypass.** e.g.
```sql
CREATE POLICY "event_registrations_update_organizer" ON public.event_registrations
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.social_events e
               WHERE e.id = event_registrations.event_id AND e.created_by = auth.uid()))
  WITH CHECK (... same ...);
```
DELETE policy is the same shape. There is exactly ONE admin account in `user_roles` — and it is
Cuong's own account, which is also the account used to log in to the dev build during testing.

**No CI is running.** GitHub Actions budget is exhausted as of today: the last 100 workflow runs on
every branch including `main` failed in ~5 seconds with zero steps executed. That includes
`.github/workflows/apple-tests.yml`, which normally runs `xcodebuild test` on macos-15. Also dead:
the 10-minute uptime pinger and a deploy guard. Local toolchain IS available though (Xcode 26.3,
xcodegen 2.45.4, iPhone 17 Pro simulator), and `apple/Tests/` has 19 XCTest files (pure-logic tests:
scoring engines, bracket planners, deep-link parsing, standings).

**Push delivery pruning.** The `send-push-notification` edge function sends via FCM HTTP v1 and only
deletes a stored token when the FCM response is HTTP 404 or contains `errorCode === "UNREGISTERED"`.
`push_tokens` RLS allows SELECT/DELETE only where `auth.uid() = user_id`. There is a stated SLO:
"Push — admin broadcast delivered to live tokens >= 95% sent/total after prune".

**Other stated SLOs** (30-day windows): web availability 99.5%; auth round-trip 99%; registration
OTP->insert 99%; scoring save + bracket propagation 99.5% with ZERO lost-update incidents (a lost
bracket slot is an incident, not a rate); cron 100% monitored-healthy; Vietnam mobile p75 LCP <= 2.5s.

**Rollback reality.** `apple/*.xcodeproj` is gitignored and regenerated by XcodeGen from
`project.yml` with `sources: [path: ThePickleHub]` (whole directory), so new Swift files join the
target automatically. DB restore exists but is coarse: the tested procedure is "restore whole DB to
a NEW Supabase project" (~4 min), not point-in-time row recovery on the live project. Storage
objects are not included in DB backups.

## What I want from you
Name the specific failures this overnight run produces in production, with mechanism + trigger +
what a real user sees. In particular, judge these and tell me if I am wrong:

1. Is my "new native write path bypasses the DB-01 advisory-lock RPC and overbooks a real event"
   concern the sharpest one, or is there a worse one I am missing?
2. APNs/FCM: what exactly is impossible to complete or verify overnight without Apple Developer
   portal access, and what irreversible state (if any) leaks into prod if the agent tries anyway?
   Consider the simulator specifically.
3. What breaks that I have NOT listed? Think about: Supabase rate limits / auth throttling from an
   agent hammering login during an 8-hour loop; realtime channels; Mux; storage buckets; the single
   admin account; anything that leaves durable state a `git revert` cannot undo.
4. Anything on my list that is actually a non-issue and I should drop.

Be brief and specific. If a concern is generic risk language, say so and cut it.
