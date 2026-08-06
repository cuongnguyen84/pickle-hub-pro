# Recon — live-viewer-count-comparison

## Prior art
- `src/hooks/useLivePresence.ts:1-252` — **THIS IS "cách hiện tại"**: concurrent viewer count via Supabase Realtime **Presence**, not a DB table. One shared channel per livestream (topic `livestream_presence:<id>`, presence key = per-tab random `viewer_<suffix>`), refcounted across mounted components (hero + card + watch page share one socket connection). On `presence:sync` event, counts `Object.keys(channel.presenceState())` (minus `admin_watcher_*` keys) — this is join AND leave detection already, for free, via Realtime's own presence protocol (heartbeat/timeout is handled server-side by Supabase Realtime, not app code). Zero DB writes for the count itself.
- `src/hooks/useLiveViewerList.ts:1-168` — admin-only variant on the *same* presence channel/topic, enriches with `profiles` (display_name/avatar) + `admin_get_profile_emails` RPC. This is effectively "who is watching + when they joined" already built.
- `src/components/home/LiveBroadcastHero.tsx:151,222-229`, `src/components/content/LiveCardWithPresence.tsx:45,61` — consumers rendering `concurrentViewers`.
- `src/pages/WatchLive.tsx:5,75` — main watch page wires `gated` state into presence (viewers stuck at login gate are tracked but can be filtered from the visible count).
- `src/pages/admin/AdminLivestreamViewers.tsx:33` + `src/components/admin/ViewerListTable.tsx` — admin UI for the viewer list above.
- **Separate, unrelated system — do not conflate:** `src/hooks/useIntervalViewCounter.ts` + `supabase/functions/batch-view-events/` + `supabase/functions/_shared/view-events.ts` + table `view_events`/`view_counts` (migration `20260113014818`) is a **cumulative "total views" counter** (YouTube-style lifetime count, video AND livestream), client batches 1 event/30s capped at 20/session, flushed every 60s, deduped server-side by 30s window + IP/user, rate-limited via `consume_view_event_rate_limit` RPC. Trigger `increment_view_count()` on `view_events` insert bumps `view_counts.count` (upsert). This is NOT concurrent-viewer count — it never decrements, has no "who left" concept. `useBatchViewCounts.ts` reads it. Confirmed via `sed -n '7249,7333p' src/integrations/supabase/types.ts`.
- **Native (apple/):** no concurrent-viewer / presence implementation found. `grep -rln "Presence"` under `apple/ThePickleHub` → zero hits. `apple/ThePickleHub/Features/Live/LiveView.swift:76` only has a comment "no fabricated viewers/scores" — implies native currently shows no live viewer count at all, or pulls it server-side (not verified beyond grep — recon budget didn't extend to reading full LiveView.swift/ChatViewModel).
- Mux: only `mux_playback_id`/`mux_stream_key` referenced in `CreatorLivestreamForm.tsx:134-136` (admin config), no Mux Data/engagement API usage anywhere in `src/` or `supabase/functions/`.

## Data
- **Presence path (current concurrent count):** no table. Supabase Realtime in-memory channel state only — server-side ephemeral, keyed by socket connection, GC'd on disconnect. No RLS applies (not a Postgres object).
- **Cumulative views path (separate, unrelated to "who's watching now"):** `view_events` (append-only, RLS: insert=anyone, select=creator-of-org or admin), `view_counts` (aggregate, RLS: public select, trigger-only write), `view_event_rate_limits` (rate limiting), RPC `get_view_count`, `get_top_content`, `get_org_views_over_time`. Trigger: `trigger_increment_view_count` (migration `20260113014818_...sql:44-48`).
- Known incident already documented in the presence hook itself: 2026-07-08 topic-collision bug (per-client topic suffix meant every client saw only itself) — comment at `useLivePresence.ts:8-11`; fixed by making topic fixed and suffix only on the presence key.

## Cuong's 3-step model vs. what exists
1. **"Ô nóng" (hot bucket)** — no direct equivalent; closest analog is the Realtime channel *topic* itself (`livestream_presence:<id>`) acting as the single hot bucket per livestream — no time-bucketing/sharding exists.
2. **"Đếm người" (count)** — exists: `countViewers()` in `useLivePresence.ts:41-43`, driven by `presence:sync`.
3. **"Ai rời đi" (who left)** — exists implicitly: Realtime presence protocol removes a key from `presenceState()` on leave/timeout automatically; app code never writes a "left" event, it just re-reads state on next `sync`.

So Cách A (hiện tại) already *is* a working, close-to-real-time, zero-DB-write join/count/leave pipeline — just implemented via Supabase Realtime Presence rather than a Postgres hot-bucket table. Any "Cách B" 3-bước design should be evaluated **as an alternative to Realtime Presence**, not as something new the DB needs.

## Constraints found
- `CLAUDE.md` — Supabase JWT ES256/HS256 workaround only affects Edge Functions gateway auth, not Realtime (Realtime auth token flow is separate) — likely irrelevant to this comparison but worth naming as "checked, doesn't apply."
- `CLAUDE.md` — compute tier is Micro (per memory, prod PGRST002 outage 2026-08-02 was schema-cache related, not load-related) — relevant to "resource cost" framing: any DB-polling alternative (Cách B with a table) adds write/read load on a Micro instance that a stateless Realtime channel does not.
- No `docs/slo.md` / `docs/perf-budgets.md` numbers found specific to viewer-count latency (not grepped exhaustively for this recon — worth a follow-up read before writing the comparison verdict).

## Test coverage today
- `src/hooks/__tests__/useLivePresence.core.test.ts`, `useLivePresence.gated.test.ts` — cover sync/count, CHANNEL_ERROR retry, gated re-track.
- `src/lib/__tests__/view-events.test.ts` — covers the *separate* cumulative-view pipeline (parsing/dedup), not concurrent count.
- No test found for `useLiveViewerList.ts` specifically (admin list) or for cross-tab/cross-topic collision regression beyond the code comment.

## Unknowns worth asking Cuong
1. "Cách A hiện tại" trong đề bài — Cuong có đang nói đúng cơ chế Presence này, hay Cuong nghĩ hệ thống đang dùng `view_events`/`view_counts` (cumulative) để suy ra viewer đang xem? Recon xác nhận đây là 2 hệ thống khác nhau — cần Cuong confirm đang so sánh Presence vs. mô hình 3-bước, không phải view_counts vs. 3-bước.
