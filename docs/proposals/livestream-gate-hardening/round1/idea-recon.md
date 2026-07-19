# idea-recon — livestream-gate-hardening (2026-07-20)

## Prior art
- `src/hooks/useLivestreamGate.ts:40-110` — gate logic (countdown, localStorage `pkl_preview_seen_<id>`), only ticks while `isPlaying`, applies to `WatchLive.tsx` only.
- `src/components/video/LivestreamGateOverlay.tsx` — the login/signup CTA overlay, already exists, plain `<a href>` links (no click tracking).
- `src/components/video/MuxPlayer.tsx:22,204-223` — `onPlayStateChange` fires on native `onPlay`/`onPause`; forwardRef exposes `play()`/`pause()` via `useImperativeHandle` (line 160).
- `src/pages/WatchLive.tsx:75-80` — gate-pause effect deps `[isGated]` only, confirmed single-shot; lines 253-254 (mobile) and 302-303 (desktop) both pass `ref={playerRef}` — same ref object, confirms the dual-MuxPlayer-shared-ref bug.
- `src/pages/WatchLive.tsx:106-109` — `useIntervalViewCounter` called unconditionally, no `isGated`/`isPlaying` guard.
- `src/pages/embed/EmbedLive.tsx` — full file, zero auth/gate code, zero `useAuth`/`useLivestreamGate` import; view counter also unconditional (lines 19-23).
- `src/components/home/HomeLivePlayer.tsx:55-57` — same single-shot gate-pause pattern as WatchLive.
- `src/hooks/useLivePresence.ts` — mature shared-refcount presence impl with retry/dedupe already hardened (comment block lines 7-16 documents a prior prod bug fixed 2026-07-08); tracks from mount (line 188 `acquire`), no `gated` field in payload (lines 94-98).
- `apple/ThePickleHub/Features/Live/LiveComponents.swift` — no `gate`/`auth`/`paywall` string hits; native iOS player has **no login gate at all** (out of scope per proposal, but note it exists unguarded).
- `src/lib/journeys.ts` — existing north-star conversion-tracking pattern (`trackEvent` + `journey_id` + `auth_state` + `source_route`), used today only for `player_registration` / `organizer_event` / `organizer_tournament`. No livestream-gate journey kind exists yet — this is the closest reusable pattern for "conversion tracking on login/signup click."

## Touch surface (likely)
- `src/pages/WatchLive.tsx` — dual-ref bug (mobile :254 / desktop :303), gate-pause effect (:75-80), unconditional view counter call (:106-109)
- `src/components/home/HomeLivePlayer.tsx:55-57` — same gate-pause pattern
- `src/pages/embed/EmbedLive.tsx` — needs gate; currently no `useAuth`/`useSystemSettings`/`useLivestreamGate` wiring
- `src/hooks/useLivestreamGate.ts` — reload-reset via localStorage is the mechanism itself (by design), "re-pause liên tục" fix likely lives in the consumer effect, not here
- `src/hooks/useIntervalViewCounter.ts` — shared by video AND livestream (both `WatchVideo.tsx` and `EmbedVideo.tsx` also call it) — any gating logic added here must not silently break video view counting
- `src/hooks/useLivePresence.ts` — no `gated` concept in tracked payload (:94-98) or in `countViewers` filter (:35-36)
- `src/components/video/LivestreamGateOverlay.tsx` — CTA links, target for conversion tracking
- `src/lib/journeys.ts`, `src/utils/ga.ts` — reusable trackEvent pattern if adding a journey kind

## Data
- `view_events` table (migration `20251221153808...`, columns: `target_type`, `target_id`, `organization_id`, `viewer_user_id`, `created_at`) — no `is_replay`/gated column; `is_replay` computed server-side in `batch-view-events/index.ts:147` from livestream status, not passed by client.
- `batch-view-events` edge function (`supabase/functions/batch-view-events/index.ts`) — shared video+livestream endpoint, server-side rate limit (`consume_view_event_rate_limit` RPC) + 30s dedup window; accepts whatever client enqueues, has no concept of "was actually playing."
- Realtime presence channel `livestream_presence:<id>` (`useLivePresence.ts:45`) — payload today: `joined_at`, `user_id`, `user_agent`; admin viewer list reads via `useLiveViewerList.ts` → `src/pages/admin/AdminLivestreamViewers.tsx`.
- System settings columns `require_login_livestream`, `livestream_gate_applies_to`, `livestream_preview_seconds` — added in migration `20260213015900_98de9c42...sql` (ALTER, not CREATE), read via `useSystemSettings()`.

## Binding constraints found
- `CLAUDE.md` ES256/HS256 workaround: `batch-view-events` is not in the `verify_jwt=false` user-facing list; check `supabase/config.toml` before assuming its auth path works the same as `mux-create-livestream` if touching auth there.
- `CLAUDE.md` Coding Standards — `.legacy.tsx` siblings exist for 14-day rollback; do not edit legacy files.
- `.claude/memory/lessons-learned.md:247-256` — `useLivePresence` in `LiveBroadcastHero.tsx` opens one Realtime channel per homepage visitor; flagged scaling concern, adjacent if touching presence.
- `.claude/memory/lessons-learned.md:121` — prior bug class: presence/chat channel-name collisions on fast re-subscribe (`Date.now()` suffix); relevant if touching `useLivePresence` connect/retry logic.

## Test coverage today
- **Zero** unit/component tests for `WatchLive`, `useLivestreamGate`, `LivestreamGateOverlay`, `useIntervalViewCounter`, `useLivePresence`, `EmbedLive`.
- `tests/visual.spec.ts:41` — QA-05 visual baseline only captures `/live` (hub/list), not `/live/:id` or `/embed/live/:id` — no visual regression coverage for gate overlay states.

## Bilingual surface
- `LivestreamGateOverlay.tsx` uses `t.live.previewEnded`, `t.live.signupToWatch`, `t.live.loginToWatch`, `t.live.createAccount` — VI/EN in `src/i18n` `t.live.*` namespace. New gate-state copy (embed) goes same namespace.

## Unknowns worth asking Cuong
- `useIntervalViewCounter` shared with plain video (`WatchVideo.tsx`, `EmbedVideo.tsx`) — "only count when actually playing" apply to video too, or livestream-only?
- `/embed/live/:id` gate: iframe context can't navigate to `/login` cleanly — needs embed-appropriate UX (open new tab?).
- Conversion tracking: reuse `journeys.ts` `JourneyKind` pattern (touches `docs/north-star-journeys.md` contract) or lighter one-off `trackEvent` in `LivestreamGateOverlay`?
