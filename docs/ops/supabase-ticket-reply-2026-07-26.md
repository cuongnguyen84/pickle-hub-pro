# Reply draft for SU-429781 — send to support@supabase.com

_Status: FINAL, ready to send — written 26/07, live-repro section filled in at
~11:25 UTC._

---

Hi Tim,

We dug through `function_edge_logs` (via the Management API analytics endpoint) for
24–26 July and can now characterize the failure precisely. Three findings that
should help your escalation:

## 1. The blob 404s are per-edge-region, not global

Every mass incident is confined to a **single `x_sb_edge_region`**, while other
regions serve the same functions fine at the same minute. Bursts of
`sb_error_code=NOT_FOUND_FUNCTION_BLOB`, grouped by region (each row = one sweep
of all ~75 functions from one vantage point):

| UTC | region | distinct functions returning blob-404 |
|---|---|---|
| 24/07 01:12 | us-east-1 | 70 |
| 24/07 04:35 | us-west-1 | 67 |
| 24/07 19:41 | us-west-2 | 75 |
| 24/07 22:01 | us-east-2 | 75 |
| 25/07 00:16 | us-east-2 | 75 |
| 25/07 06:06 | us-west-1 | 75 |
| 25/07 10:06 | us-east-1 | 75 |
| 25/07 14:14 | us-west-1 | 75 |
| 25/07 20:45 | us-east-2 | 73 |
| 26/07 01:13 | us-east-1 | 68 |
| 26/07 04:45 | us-east-2 | 72 |
| 26/07 06:50–52 | ap-northeast-2 | 38 |
| 26/07 08:32 | ap-northeast-2 | 39 |
| 26/07 09:07 | us-east-1 | 73 |

This resolves your earlier observation ("143 successful requests in the same hour
as 18 failures"): the successes came from healthy regions. Our "73/75 fleet
outage" reports were sweeps from a single vantage point that happened to route to
a poisoned region. From that region's perspective the fleet IS down.

## 2. It reproduces with zero deploys from anyone

Between 24/07 17:42 and 26/07 07:07 UTC we pushed no code. The only deploys in
that window were our own hourly self-heal (`supabase functions deploy --use-api`
of all 75 functions, from GitHub Actions — that is the SupabaseCLI/VN + US
traffic you spotted; it is our watchdog, not a rogue machine). The cycle for two
days straight has been:

1. Self-heal redeploys all 75 functions → all regions serve 200.
2. **Within 30–90 minutes, with no further deploys**, some region starts
   returning NOT_FOUND_FUNCTION_BLOB for most of the fleet.
3. Next hourly sweep finds it, redeploys, goto 1.

So branching/GitHub-integration deploys are not required to trigger it (they were
the original trigger on 22/07, but the store has stayed unhealthy since).

## 3. Within one region it is per-function and flickers — consistent with a failing cold blob fetch

In the project's home region ap-northeast-1, on 26/07:

- `feed-generate` (pg_cron, hourly at :50) and `auto-cancel-unpaid-registrations`
  (hourly at :00) returned blob-404 on **every invocation from 01:00 to 06:50**
  — except a clean 200 window at 04:50/05:00 (right after a 04:46 heal), then
  404 again at 05:50 with no deploy in between.
- Meanwhile `social-caption` (invoked every 15–30 min, so never idle) executed
  normally in the same region the whole time.

Functions with steady traffic in a region never lose their blob; functions idle
for ~30–90 min in a region do, and then flicker between healthy/broken (which
also matches the short-lived 404s we reported on 23/07). Our working hypothesis:
an edge-runtime node evicts an idle function's blob from cache, the re-fetch
from the blob store fails (rather than "blob was never uploaded"), and the node
then serves NOT_FOUND_FUNCTION_BLOB until a new deploy rewrites the blob.
Redeploying identical source "fixes" it, which is why our self-heal works.

## 4. Live reproduction on 26/07, after this analysis

We deployed the whole fleet at 09:08 UTC, then verified every function healthy
in six regions (75 functions × us-east-1, us-west-1, eu-central-1,
ap-northeast-1, ap-northeast-2, ap-southeast-1, forced via the `x-region`
header) at 09:23–09:26 — all clean. With **zero further deploys**, poisoning
then recurred like clockwork:

- **09:31** — 27 functions blob-404 in **us-east-2** (23 min after deploy; the
  one region our warm-up sweep had NOT touched).
- **10:00** — 73 functions blob-404 in **us-east-1** (~28 min after the 09:31
  heal).
- **11:00** — 8 canary functions blob-404 in **us-east-1** again (~55 min after
  the 10:0x heal).

Each time, our watchdog redeployed and the region recovered within ~2 minutes.
This is fully consistent with the idle-eviction + failed-refetch model above,
and it is reproducible on demand: deploy, let a region sit idle 25–60 minutes,
probe it with `x-region`.

## Asks

1. Please pass the per-region evidence to the edge-runtime team — the blob
   store / node cache re-fetch path in at least us-east-1/2, us-west-1/2,
   ap-northeast-1/2 and eu-central-1 is what needs inspection, for functions
   idle longer than ~30–90 min in that region.
2. Example broken request: 26/07 08:34:13 UTC, OPTIONS
   `/functions/v1/mark-payment-claimed`, served by `ap-northeast-2`,
   `sb_error_code: NOT_FOUND_FUNCTION_BLOB` (real user, broke a payment flow).
3. We are redeploying 75 functions ~20×/day as a workaround (function versions
   are now ~500). Please confirm this is safe to continue until the fix.

Thanks,
Cuong
