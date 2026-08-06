# ui-ux-critic — second opinion GPT-5.6 (nguyên văn) — **KHÔNG LẤY ĐƯỢC**

- Ngày: 2026-08-06
- Đường gọi đã thử: `codex exec --model gpt-5.6-sol --sandbox read-only` (đường duy nhất
  còn dùng được — `scripts/agents/ask-model.mjs` KHÔNG tồn tại trong repo, xem memory
  `idea-pipeline-missing-scripts`; `OPENAI_API_KEY` không có trong env).
- **Kết quả: THẤT BẠI. Panel chạy one-model-down.** Không có ý kiến độc lập của GPT-5.6
  cho vòng 1 của proposal này. Mọi kết luận trong `round1/ui-ux-critic.md` là của Claude,
  KHÔNG có xác nhận chéo từ vendor khác — đọc với trọng số tương ứng.
- Lỗi trả về (nguyên văn, 2 lần liên tiếp, kể cả với prompt "reply with OK"):

```
ERROR: You've hit your usage limit. Upgrade to Pro (https://chatgpt.com/explore/pro),
visit https://chatgpt.com/codex/settings/usage to purchase more credits or try again
at Aug 8th, 2026 12:00 PM.
```

- Hạn mức mở lại: **2026-08-08 12:00**. Nếu Cuong muốn ý kiến thứ hai trước khi quyết,
  chạy lại đúng lệnh dưới đây sau mốc đó và dán reply vào cuối file này.

```sh
codex exec --model gpt-5.6-sol --sandbox read-only \
  "$(cat docs/proposals/live-viewer-count-comparison/external/ui-ux-critic-gpt56.prompt.md)"
```

---

## PROMPT ĐÃ GỬI (nguyên văn — đã gửi thật, bị từ chối ở tầng hạn mức)

````markdown
# Brief: concurrent live-viewer counting — Realtime Presence vs Postgres heartbeat table

## Context (you cannot see the repo; everything you need is here)

A solo-operated bilingual (Vietnamese/English) pickleball web product, ~2000 registered
users. React 18 SPA on Cloudflare Pages + Supabase (Postgres + PostgREST + Realtime +
Edge Functions). Postgres compute is a **Micro instance (~2 vCPU shared, ~1 GB RAM,
~$10/month)**, upgraded from the default nano tier on 2026-08-02 immediately after an
outage (details below). One operator, no on-call rotation, no pager.

The product runs occasional livestreams (Mux). Peak observed audience is in the low
hundreds; the operator wants headroom to ~5000. Livestreams run 22:00–00:00 Vietnam
time — i.e. the operator is asleep or alone when peak load happens.

## Method A — what is deployed today (Supabase Realtime Presence)

- Each browser tab that lands on a page showing a live stream joins one Supabase
  Realtime (Phoenix) channel, topic `livestream_presence:<livestream_id>`, presence
  key `viewer_<random>`.
- On `presence: sync` the client reads `channel.presenceState()` and counts keys
  (excluding keys prefixed `admin_watcher_`). That count is the displayed
  "concurrent viewers".
- Join is `channel.track({joined_at, user_id, user_agent, gated})`.
- Leave detection is entirely the Realtime server's presence protocol: graceful
  `untrack()`/socket close, or heartbeat timeout. Client heartbeat interval is 25 s,
  push timeout 10 s (supabase-js / realtime-js 2.110.7 defaults; the app sets no
  custom realtime options).
- **Zero Postgres writes and zero Postgres reads for the count.** The channel is a
  public channel (no RLS-authorized private channel), so it does not touch the DB.
- Client-side refcounting shares ONE channel across multiple components on the same
  page (homepage hero + watch page).
- **Surfaces that open the channel:** the homepage hero opens it for EVERY homepage
  visitor whenever a stream is live — not just people who clicked into the stream —
  plus the watch page itself.
- A separate admin-only hook joins the SAME topic with key `admin_watcher_<random>`
  to render a "who is watching" table (display name, avatar, email, joined_at).
  On EVERY `presence: sync` event it runs two Postgres queries: a `profiles` SELECT
  with `.in("id", userIds)` for all current viewers, and a SECURITY DEFINER RPC that
  reads emails for those same ids. There is no debounce and no diffing.

Known historical bug in this path (already fixed): the channel topic once contained a
per-client random suffix, so every client was alone in its own room and everyone saw
"1 viewer". Also, `supabase-js` dedupes channels by topic, so registering a callback
after `.subscribe()` on a reused topic throws.

## Method B — what the operator is proposing (Postgres "hot bucket")

Three steps, operator's own words translated:
1. **"hot cell"** — a time-bucketed row/table recording that a viewer is active now.
2. **"count people"** — count distinct viewers in the current hot bucket.
3. **"who left"** — detect departure by absence of a fresh heartbeat.

Concretely this means: every viewer client UPSERTs a heartbeat row (say every 20–30 s)
into a new Postgres table keyed by (livestream_id, viewer_id, bucket); the displayed
count is `COUNT(DISTINCT viewer_id)` over the last N seconds; stale rows are deleted
by a cleanup job. Viewers are largely **anonymous** (no login required to watch), so
any write path would have to be reachable by the `anon` Postgres role or an
unauthenticated edge function.

The operator's stated goal, verbatim: "just accurate enough and fast enough" — and
he explicitly asks **which method is more convenient and uses LESS database
resource**.

## Prior art in this same codebase you should weigh

- There is already a *cumulative lifetime view count* system (a different feature) that
  writes to Postgres. It was built with: client-side batching (1 event accumulated per
  30 s, flushed every 60 s, hard cap 20 events per session), a server-side dedupe
  window, and an atomic rate-limit RPC backed by a `view_event_rate_limits` table keyed
  by a SHA-256 identity hash. Within two months that rate-limit table needed an extra
  btree index because its inline garbage collector (`DELETE ... WHERE window_start <
  now() - interval '2 days'`) ran on the hot path against a primary key whose leading
  column was the hash, so the GC degraded to a sequential scan.
- On 2026-08-02, 22:00–23:30 Vietnam time — **during livestream prime time** — the whole
  site went down for 90 minutes. PostgREST entered a self-sustaining
  `PGRST002 "Could not query the database for the schema cache. Retrying"` loop at about
  10 retries/second; one schema-cache query took 139 seconds. REST returned 503, Auth
  returned 504, nobody could log in. `pg_stat_activity` showed the DB nearly idle — the
  *instance* was resource-exhausted, not the queries. Contributing load was believed to
  be a `NOTIFY pgrst, 'reload schema'` from a migration applied at peak, plus a newly
  shipped ops stack (an admin dashboard polling an RPC every 60 s, a cron running every
  minute, another every 5 minutes). The loop does not self-heal; the only fix was
  restarting the project via the management API, which the operator had to do by hand.
- A recent security hole in the same product: a table had an INSERT policy that let
  authenticated users forge paid event registrations. Closed by dropping the policies
  and revoking the grant.
- Postgres migrations here are applied to production **before** the code merges, and a
  `git revert` therefore does not un-apply schema.

## What I want from you

For EACH method, name the specific failure that shows up in production, the trigger,
and what a real user sees on screen. Be concrete and quantitative where you can:

1. Method A: what breaks first as concurrent viewers go 50 → 500 → 5000? Which
   Supabase Realtime quota or Phoenix Presence property is the actual cliff, and what
   is the shape of the growth (linear? quadratic?) in messages delivered? What does a
   viewer see at the cliff — a frozen number, a wrong number, a missing number, a
   broken page? Does Presence keep working during the PostgREST/schema-cache outage
   described above, or die with it?
2. Method B: quantify the write and read load at 500 and 5000 viewers on that Micro
   instance. Where does it break — WAL, autovacuum/bloat, connection pool, PostgREST
   request rate, lock contention on the bucket rows? What is the interaction with the
   2026-08-02 failure mode — does Method B make that outage more or less likely, and
   what does a viewer see during it? Is "less database resource" true or false, and
   by roughly what factor?
3. Accuracy: which method reports a *more wrong* number, and in which direction, for
   (a) a phone that locks its screen, (b) a laptop lid closed, (c) a tab in the
   background, (d) a user on a flaky mobile network reconnecting repeatedly,
   (e) someone deliberately inflating the count?
4. The admin "who is watching" list described above already issues two Postgres
   queries per presence sync with no debounce. At 500 viewers with normal churn,
   estimate the query rate and row volume, and say whether that is the real DB cost
   hiding in Method A.
5. Is there a third option that is cheaper than both and that a solo operator can
   actually run? If so, name it precisely, and name its failure mode too.
6. Rollback: which method can be undone at 23:00 during a live broadcast by one tired
   person, and which cannot?

Reject generic risk language. If one of these methods is simply the right answer, say
so plainly and briefly, and say what would have to change for that to flip.
````

---

## REPLY NHẬN VỀ (nguyên văn)

_(rỗng — xem lỗi hạn mức ở đầu file)_
