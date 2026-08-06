# Devil's advocate pass — risk-auditor → GPT-5.6

> Lưu NGUYÊN VĂN theo yêu cầu nhiệm vụ. Không biên tập, không cắt.
> Phần đánh giá / bác bỏ của risk-auditor nằm ở `round1/risk-auditor.md`,
> KHÔNG ở file này. Đọc file này như *input thô*, không phải kết luận.

- **Ngày:** 2026-08-06
- **Model trả lời:** `gpt-5.6-sol` (request gửi `gpt-5.6`)
- **Tokens:** 9635
- **Cách gọi:** `scripts/agents/ask-model.mjs` **KHÔNG TỒN TẠI** trong repo
  (`scripts/agents/` chỉ có `risk-tier.mjs`, `soak-watch.mjs` + test của chúng —
  đúng lớp lỗi đã ghi ở `.claude/memory/lessons-learned.md` mục 2026-08-04).
  Đã gọi thẳng `POST https://api.openai.com/v1/chat/completions` bằng `curl`
  với `OPENAI_API_KEY` có sẵn trong env. Panel KHÔNG chạy one-model-down.
- **Lưu ý:** GPT-5.6 KHÔNG đọc được repo. Mọi claim trong phần trả lời phải
  được đối chiếu file thật trước khi vào proposal.

---

## System prompt (nguyên văn)

```
You are a hostile staff SRE reviewing a change to a live product run by one person. Your job is to find the specific failure this change causes in production. Be concrete: name the mechanism, the trigger, the user-visible symptom. Reject generic risk language. If the change is genuinely safe, say so plainly and briefly.
```

---

## Prompt gửi đi (nguyên văn, self-contained)

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

## Trả lời (nguyên văn)

## Verdict

**Keep Method A. Do not move presence heartbeats into Postgres.**

Method B turns an approximate UI counter into one of the largest sustained database workloads in the product, and it fails exactly when Postgres/PostgREST fails. Method A has scaling cliffs, but they are isolated to Realtime and can be addressed with quota/capacity changes or by replacing the count with Mux’s concurrency metric.

Also: the current number is not “concurrent livestream viewers.” Because the homepage joins automatically, it is **concurrent visitors to any page that exposes the live stream**.

---

## 1. Method A — Supabase Realtime Presence

### What breaks first

There are three distinct limits.

#### A. Concurrent Realtime connections

The exact project limit cannot be derived from the Postgres Micro size. Realtime limits are plan/project-specific and can be raised separately. Check the project’s Realtime limits rather than assuming the Micro upgrade changed them.

A common default paid-project limit has historically been around **500 concurrent Realtime connections**. If that is this project’s configured limit, the first hard cliff is approximately 500 tabs, not 500 actual viewers, because:

- Homepage visitors connect without watching.
- Multiple browser tabs are separate connections.
- Admin watchers also connect.
- Other product Realtime usage shares the project quota.

**Trigger:** the project reaches its concurrent Realtime connection limit.

**Mechanism:** additional WebSocket/channel joins are rejected, time out, or repeatedly reconnect.

**What users see:**

- Existing clients generally retain a changing number.
- New clients get no presence state and usually display `0`, a stale initial value, a spinner, or no count depending on the hook’s error handling.
- The Mux video itself should continue playing unless the UI incorrectly gates playback on successful Presence subscription.
- The page should not inherently crash.

At 5,000 connections, this must be capacity-tested and the Realtime connection quota must explicitly support it. A Postgres compute upgrade does not accomplish that.

#### B. Presence fan-out is quadratic during audience transitions

Phoenix Presence sends a presence diff to every subscriber when a member joins, leaves, or changes tracked metadata.

At population \(N\):

- One join or leave causes approximately **N outbound deliveries**.
- Growing from zero to \(N\) causes roughly:

\[
N(N-1)/2
\]

diff deliveries, excluding initial state snapshots.

Examples:

- 500 arrivals: about **125,000** diff deliveries.
- 5,000 arrivals: about **12.5 million** diff deliveries.

That is **quadratic over a ramp**, not linear.

At steady state, if membership transitions happen at rate \(r\), delivery rate is approximately:

\[
rN
\]

If average residence time is ten minutes, arrivals and departures together are approximately \(2N/600\) per second:

- 500 present: about 1.67 transitions/s × 500 = **~833 deliveries/s**.
- 5,000 present: about 16.7 transitions/s × 5,000 = **~83,000 deliveries/s**.

That is before reconnect storms.

The applicable Supabase limit is the project’s **Realtime messages-per-second / Presence rate limit**, not Postgres capacity. If the project is configured around hundreds of messages per second, normal churn at 500 can already cross it.

**Trigger:** rapid audience ramp, normal churn at a large population, or a network event causing mass reconnects.

**Mechanism:** every presence diff is fanned out to every connected subscriber; the Realtime service throttles, queues, drops, or disconnects clients when the configured rate/capacity is exceeded.

**What users see:**

- Counts update late, freeze, or temporarily disagree across browsers.
- Reconnecting clients can show a lower count until they obtain a fresh state.
- Repeated channel errors may make the counter disappear or reset.
- Video remains usable unless the app couples video rendering to Presence state.

There is not necessarily one clean “everyone sees an error at 501” event. The connection limit is a hard admission cliff; message pressure is usually a degradation cliff.

#### C. Initial Presence state becomes large

Every new subscriber receives the current Presence state. The state includes metadata for each key:

- `joined_at`
- `user_id`
- `user_agent`
- `gated`
- Presence protocol overhead

At 5,000 entries, this can easily be hundreds of kilobytes or more. Long user-agent strings make it worse. Even if it remains within the service’s payload limit, every join requires the client to download, parse, allocate, and traverse the entire state.

**Trigger:** a new client joins a room containing thousands of presence keys.

**Mechanism:** an O(N) state snapshot approaches the Realtime payload limit or becomes expensive to serialize, transmit and parse.

**What users see:** slow initial count, missing count if subscription fails, or a temporary UI hitch on weaker phones. Again, the video need not fail.

Removing `user_agent` and other unnecessary per-presence metadata would materially delay this cliff.

### Does Presence survive the 2026-08-02 PostgREST outage?

**The public Presence channel should continue working.**

This channel does not use:

- PostgREST
- RLS authorization for a private channel
- Postgres reads
- Postgres writes

Realtime is a separate service, and Phoenix Presence state is maintained by Realtime, not by the application database. A PostgREST schema-cache retry loop does not inherently kill an already-running public Presence channel.

Exceptions:

- A whole-project restart will disconnect Realtime clients temporarily.
- A broader project/platform resource incident could affect both services.
- The admin hook’s profile/email queries will fail.
- Any new page functionality requiring Auth or REST may fail even while the count continues updating.

So during a repeat of the described outage, a visitor could plausibly see the Presence number working while login, profiles and other REST-backed content return errors.

---

## 2. Method B — Postgres heartbeat table

Assume:

- One heartbeat every 25 seconds.
- A 60-second active window.
- Each browser polls the count at the same 25-second interval.
- About 2–3 bucket rows per active viewer are retained in the query window.

### Write load

| Concurrent clients | Heartbeats/s | Heartbeats/min | Rows/events over 2 hours |
|---:|---:|---:|---:|
| 500 | 20/s | 1,200/min | 144,000 |
| 5,000 | 200/s | 12,000/min | 1,440,000 |

Those are separate HTTP requests if implemented directly from each browser.

At 5,000 viewers, this means approximately:

- **200 PostgREST write requests/s**
- Around **1.44 million insert/update operations per two-hour broadcast**
- Corresponding WAL for every write and index update
- Deletes and dead tuples when cleanup runs
- Autovacuum work after or during peak load

A rough WAL range of 0.5–2 KB per operation, depending on row/index layout and page effects, gives approximately **0.36–1.4 GB of WAL per hour at 200 writes/s**. This is only an order-of-magnitude estimate, but it is not a trivial background workload for a shared 1 GB instance.

### Read load

With a 60-second window, the count examines roughly:

- 500 viewers: approximately 1,000–1,500 recent rows.
- 5,000 viewers: approximately 10,000–15,000 recent rows.

If every client polls every 25 seconds:

| Concurrent clients | Count queries/s | Approximate recent-row visits/s |
|---:|---:|---:|
| 500 | 20/s | 20,000–30,000/s |
| 5,000 | 200/s | 2–3 million/s |

Each query also performs `COUNT(DISTINCT viewer_id)`, requiring deduplication through hashing, sorting, or an equivalent aggregate operation.

Combined at 5,000, the naive design produces approximately:

- **200 write requests/s**
- **200 count requests/s**
- **~400 PostgREST requests/s**
- Millions of index/row examinations per second

If the displayed count polls every ten seconds instead, the count side alone becomes **500 requests/s**.

### What breaks first

It is probably **not row-lock contention** if rows are keyed by `(livestream_id, viewer_id, bucket)`. Different viewers update different rows. There is no single shared counter row to serialize on.

The likely failure sequence is:

1. **PostgREST request queueing and database pool saturation**
2. **CPU and memory pressure from repeated distinct-count queries**
3. **I/O, WAL and checkpoint pressure**
4. **Bloat and autovacuum pressure from updates/deletes**
5. Cleanup becoming a new hot-path incident if its expiry predicate is not correctly indexed

On a 2-vCPU shared, 1 GB instance, 400 requests/s plus the existing application is not headroom. It is a load test against production.

A synchronized timer makes it worse: browser intervals tend to cluster around page-load and broadcast-start times, causing bursts instead of a smooth 200/s average.

### Bucket layout does not eliminate cleanup cost

If each interval creates a new bucket row, most heartbeats are inserts and cleanup must delete old rows.

If several heartbeats update the same bucket row, there are fewer inserts but more update-version churn and dead tuples.

The cleanup predicate needs an index whose leading columns support expiration, for example an index involving the timestamp/bucket suitable for:

```sql
WHERE bucket < cutoff
```

Otherwise this repeats the exact prior failure: an inline or frequent garbage collector sequentially scans a growing table because the primary key starts with identity columns rather than expiration time.

Cleanup should also delete in bounded batches. One giant delete after a large stream creates its own WAL, locking and vacuum spike.

### Interaction with the 2026-08-02 failure

Method B makes that incident **more likely and substantially worse**.

During the previous incident, PostgREST could not refresh its schema cache because the instance was resource-exhausted. Method B adds:

- Hundreds of REST requests per second at livestream prime time.
- Continuous database writes and WAL.
- Repeated aggregate queries.
- Cleanup and autovacuum work.
- A new production migration, which may itself trigger schema reload activity.

If `PGRST002` returns:

- Heartbeats stop.
- Count reads return 503.
- After the active-window timeout, the database contains no fresh viewers even though video playback continues.
- The UI shows `0`, a stale last value, an error, or no number, depending on client handling.
- Login and the rest of the REST-backed site are again competing with this synthetic heartbeat traffic.

Retries can make it self-amplifying if every browser retries failed heartbeat/count requests.

### Does Method B use less database resource?

**False.**

For the count itself:

- Method A: **zero Postgres queries and zero Postgres writes**
- Method B at 5,000: roughly **200 writes/s**, and naively another **200 reads/s**

There is no meaningful finite “factor” because the denominator for Method A’s database workload is zero. Method B adds approximately **1.44 million writes per two-hour stream**, versus none.

It may use less Realtime fan-out if designed around a centrally cached count, but it unquestionably uses much more database resource.

---

## 3. Accuracy by failure scenario

Both methods need a precise definition of “watching.” Neither currently proves that video is playing. Method A counts every homepage visitor while live, which is likely the largest systematic overcount.

### A. Phone locks its screen

**Presence:**

- Initially overcounts until the WebSocket is closed or misses enough heartbeats to time out.
- Then removes the viewer.
- Usually wrong high for roughly one server timeout period.

**Postgres heartbeat:**

- JavaScript timers are suspended.
- The row remains active until the freshness window expires.
- Then removes the viewer.
- Wrong high for \(N\) seconds.

They are similar. Whichever timeout window is longer overcounts longer.

### B. Laptop lid closes

Same shape:

- Presence overcounts until socket/heartbeat timeout.
- Postgres overcounts until the row becomes stale.

Neither detects physical departure immediately.

### C. Background tab

Browsers throttle background JavaScript timers.

**Presence:**

- The WebSocket may remain alive, but heartbeat timers can be delayed on aggressive mobile browsers.
- It can undercount if the server expires the connection even though the tab remains open.
- Reconnect may restore it later.

**Postgres:**

- The heartbeat timer is directly subject to throttling.
- It is likely to expire and undercount a still-open background tab.
- Increasing the freshness window avoids undercounting but increases departure overcounting.

Method B is not more accurate here; ordinary browser scheduling directly controls database truth.

### D. Flaky mobile network with repeated reconnects

**Presence:**

If each reconnect gets a new random presence key, the old key can remain until timeout while the new one joins.

- Temporary double-counting or multiple-counting.
- Then old entries disappear.
- During disconnected periods it may also undercount.

**Postgres:**

- With a stable anonymous `viewer_id`, repeated heartbeats dedupe better than random Presence keys.
- With a new anonymous ID per reconnect, old bucket rows and the new ID coexist until expiration, causing the same or worse overcount.
- Offline/retry queues can submit late heartbeats unless the server assigns or validates time.

Method B is only better if identity is stable and timestamps are server-controlled.

### E. Deliberate inflation

**Presence:**

A bot can open many WebSockets or track many clients. It eventually hits Realtime connection/rate limits. This inflates the number and can deny legitimate Presence joins, but does not write to Postgres.

**Postgres:**

An anonymous caller can invoke the REST endpoint directly and fabricate arbitrary `viewer_id` values. It does not need to run the player or honor the heartbeat interval.

Without strong server-side controls, an attacker can:

- Inflate the count by millions.
- Fill the table.
- Generate WAL.
- trigger cleanup/vacuum load.
- Consume PostgREST and database capacity.
- Cause a site-wide outage rather than merely a wrong counter.

An unauthenticated Edge Function can rate-limit, but IP-based limits are weak behind mobile NATs and botnets. This design recreates the security exposure already seen with permissive INSERT policies.

**Method B is more wrong and more dangerous under deliberate abuse.**

---

## 4. The admin “who is watching” hook is Method A’s hidden database cost

Yes. This is the real database cost currently attached to Method A, and it should be fixed independently.

An admin receives a sync after membership changes. With population \(N\) and average residence time \(D\), join plus leave events are approximately:

\[
2N/D
\]

At 500 viewers:

### Ten-minute average residence

- Approximately 1.67 syncs/s
- Two queries per sync: **~3.3 queries/s**
- If all 500 have IDs, up to **~1,000 result rows per sync**
- Approximately **1,667 returned rows/s**, or **~100,000 rows/minute**

### Thirty-minute average residence

- Approximately 0.56 syncs/s
- **~1.1 queries/s**
- Approximately **556 returned rows/s**

This multiplies by the number of open admin watchers.

There is also a concrete request-size failure. A `.in("id", userIds)` containing 500 UUIDs is roughly 18–20 KB before the rest of the URL and encoding. Depending on Cloudflare/PostgREST/proxy limits, this can fail with a request-URI/header-size error. At 5,000 IDs it is not a viable request at all.

**User-visible symptom for the admin:**

- The table flickers or lags.
- Profile/email enrichment fails while Presence count still works.
- The browser repeatedly issues expensive failed requests.
- During the schema-cache outage, the list loses names/emails or shows an error, while the raw Presence count can remain live.

Required fix:

- Do not query on every sync.
- Diff joined/left IDs.
- Fetch only newly joined IDs.
- Cache profiles in the admin client.
- Debounce/coalesce updates.
- Never send thousands of UUIDs in a GET `.in(...)`.
- Consider removing emails from live refresh entirely.

At 500, this hook can be more important to Postgres than Presence itself, because Presence itself has no database cost.

---

## 5. A practical third option

### Use Mux Data’s real-time concurrent-viewer metric, fetched centrally and cached

Since Mux already delivers the livestream, use its real-time audience/concurrency data rather than inventing an independent “tab alive” protocol.

Implementation:

1. A Cloudflare Worker or Supabase Edge Function queries Mux’s real-time metric at a controlled interval, such as every 10–30 seconds.
2. Cache the result at the edge.
3. Browsers read the cached scalar value.
4. Do not let each browser query Mux directly.
5. On failure, display the last value with an age limit, or hide the counter.

Advantages:

- Counts actual instrumented player sessions, not every homepage visitor.
- No heartbeat table.
- No Postgres writes, cleanup, WAL or autovacuum.
- No Phoenix Presence membership fan-out.
- One upstream query per interval rather than one query per viewer.

Specific failure mode:

- Mux analytics can be delayed.
- Ad blockers or failed player instrumentation can undercount.
- A Mux API outage or rate limit freezes the cached number.
- The metric may have different semantics from “socket connected.”
- The admin identity list cannot be produced from an aggregate metric.

For a public approximate viewer count, this is preferable. For the admin identity list, keep a separately limited Presence channel or redesign the requirement.

A Cloudflare Durable Object with WebSocket hibernation and coalesced count broadcasts is another option, but it is custom stateful infrastructure. It is not the first recommendation for a solo operator when Mux already has playback telemetry.

---

## 6. Rollback at 23:00

### Method A

Operationally reversible:

- Disable the Presence counter through a feature flag.
- Revert the client hook.
- Hide the displayed number.
- Disable the admin enrichment hook.

No application database state has to be repaired. Existing SPA sessions may require refresh unless the feature is remotely controlled, but the blast radius is limited to the counter.

### Method B

Not cleanly reversible through a Git revert:

- The production table remains.
- RLS policies and `anon` grants remain.
- RPCs/functions remain.
- Cleanup cron remains.
- Existing clients continue sending heartbeat traffic until refreshed.
- Rows and bloat remain after traffic stops.

Emergency containment requires an explicit database operation:

- Revoke `anon` execution/write access.
- Disable the Edge Function route.
- Unschedule cleanup.
- Switch the UI back to Presence or hide the count.

That is a manual production migration during the broadcast—the exact operational pattern that contributed to the prior incident.

---

## Required decision

Use **Method A for now**, with these changes:

1. Stop calling homepage visitors “viewers,” or only join after actual player start.
2. Check and raise the project’s Realtime concurrent-connection and message-rate limits before claiming 5,000 support.
3. Remove `user_agent` and unnecessary Presence metadata.
4. Fix the admin hook: diff, cache and debounce; never refetch all users on every sync.
5. Handle subscription failure by hiding the count, not blocking playback.
6. Load-test ramp, churn and reconnect storms—not just 5,000 idle sockets.

The decision flips away from Presence when sustained audience/churn makes Presence fan-out or state snapshots exceed affordable Realtime capacity. At that point, use **centrally cached Mux real-time concurrency**, not a browser-to-Postgres heartbeat table.
