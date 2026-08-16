# Cron Schedules

> **Purpose:** Track every Supabase scheduled function (cron) outside the
> Supabase dashboard so the schedules are version-controlled and reviewable.
> Without this file, the only source of truth was the dashboard UI — a
> change there left no audit trail in git.

## How to update this file

When you change a schedule in the Supabase dashboard:

1. Update the matching row below (cron expression, schedule comment, last
   modified date).
2. Commit the change in the same PR as any related function code change.
3. If the function is new, add a row + an entry in the "How to change"
   section if its schedule has special considerations.

When in doubt, the dashboard is the runtime source of truth — this file is
documentation. Mismatch ⇒ the dashboard wins; bring this file back in sync.

## Active schedules

Cron-only Edge Functions with `verify_jwt=false` must fail closed inside the
handler. The dashboard/pg_cron caller sends `x-cron-secret: <CRON_SECRET>`;
deploying a gated function and updating its scheduled caller must be one
coordinated operation.

| Function | Schedule (cron) | Frequency | Purpose | Last modified |
|---|---|---|---|---|
| `auto-archive-tournaments` | `0 3 * * *` | Daily 03:00 ICT | Move unfinished community tournaments created more than 30 days ago to `completed` across Quick Tables, Team Match, Flex, and Doubles Elimination. | 2026-08-13 |
| `auto-cancel-unpaid-registrations` | `0 * * * *` | Hourly | Cancel registrations that have been in `pending_payment` status for >24h. Releases the seat back to the pool so a paying user can claim it. | 2026-07-15 |
| `feed-embeds-sync` | `20 * * * *` | Hourly at :20 | Refresh curated Instagram embed metadata and ingest newly published reels. | 2026-07-15 |
| `feed-generate` | `50 * * * *` | Hourly at :50 | Generate idempotent milestone, leaderboard, pro-tour, and recap cards. | 2026-07-15 |
| `news-check` | `0 */6 * * *` | Every 6 hours | Poll RSS feeds + scraper sources for new pickleball headlines. Lightweight check (no full ingest) to detect "is there anything new since last run?" | 2026-04-15 |
| `news-ingest` | `30 */6 * * *` | Every 6 hours, 30 min after `news-check` | Ingest, dedupe, classify, and write new articles found by `news-check` into `news_articles`. Offset by 30 minutes so the check has finished before ingest starts. | 2026-04-15 |
| `news-translate` | `*/30 * * * *` | Every 30 minutes | Drain pending EN news_items by calling Gemini Flash for EN→VI translation. Inserts VI siblings via parent_news_id. | 2026-07-15 |
| `mux-sync-assets` | `0 */4 * * *` | Every 4 hours | Reconcile Mux Asset state with our `livestreams` table. Picks up assets that finished after our `mux-webhook` retry budget exhausted, and marks abandoned livestreams as `ended`. | 2026-04-08 |
| `dupr-sync` | `0 20 * * *` | Daily 03:00 ICT | Backfill rating snapshots into recent match participants. | 2026-07-15 |
| `match-expire` | `0 21 * * *` | Daily 04:00 ICT | Expire pending match confirmations older than seven days. | 2026-07-15 |
| `errors-telegram-alert` | `*/10 * * * *` | Every 10 min | Scan browser error spikes and run the OPS-00 cron health checks below. | 2026-07-15 |
| pg_cron → Worker: `x-poster-drain-5min` | `*/5 * * * *` | Every 5 min | Drain the hand-approved `x_posts` queue via social-poster `/x/run`: publish at most one post (throttled to one per 90 min by the Worker). The link-reply pass in the same tick is dormant — `link_url` is pinned NULL by CHECK `x_posts_no_link_url` because X bills a post containing a URL at $0.200 vs $0.015. | 2026-08-16 |
| pg_cron → Worker: `x-draft-daily` | `20 23 * * *` | Daily 06:20 ICT | Turn fresh English `news_items` into `x_posts` rows at `status='draft'` via social-poster `/x/draft` (Gemini through `social-caption` in `x_en` mode). Cannot publish: the drain only reads `approved`. | 2026-08-16 |
| Database retention: `dupr-webhook-events-retention-daily` | `15 19 * * *` | Daily 02:15 ICT | Delete callback-ledger rows older than 30 days; this job runs SQL directly rather than invoking an Edge Function. | 2026-07-15 |

SEC-04 standardized `auto-cancel-unpaid-registrations`, `dupr-sync`,
`feed-embeds-sync`, `feed-generate`, and `news-translate` on the Vault-backed
`cron_secret`/`x-cron-secret` contract. The duplicate legacy
`news-translate-every-30m` production job was removed; the canonical
`news-translate-daily-7am-ict` job remains active every 30 minutes despite
its historical name.

## OPS-00 monitored schedules

The first monitoring wave deliberately covers three cadence classes. Alert
thresholds are stored per monitor as `expected interval + grace`, not as one
global stale threshold.

| Monitor | Source | Expected | Grace | Alert after |
|---|---|---:|---:|---:|
| Mux asset reconciliation | Supabase `pg_cron` → `pg_net` | 4h | 2h | 6h |
| DUPR daily rating backfill | Supabase `pg_cron` → `pg_net` | 24h | 2h | 26h |
| DUPR weekly rankings refresh | GitHub Actions scheduled workflow | 7d | 1d | 8d |

`errors-telegram-alert` evaluates each monitor every ten minutes and sends a
deduplicated Telegram incident plus one recovery message. States are distinct:

- `never_ran`: no scheduler execution or instrumented dispatch exists after
  the initial alert window.
- `stale`: the latest scheduler/workflow activity exceeded its own threshold.
- `ran_failed`: scheduler, transport, HTTP, or workflow execution failed.
- `partial_success`: HTTP succeeded but the job reported item/business errors.
- `caller_auth_failed`: the Edge Function caller received HTTP `401` or `503`.

For `pg_net` jobs, `ops_cron_dispatches` persists request IDs and response
status/body before `net._http_response` retention removes them. The caller
commands read `cron_secret` from Vault at runtime; no shared secret is stored
in `cron.job.command` or a migration. The weekly monitor reads the latest
scheduled run from GitHub's public Actions API.

## How to change a schedule

Common gotchas:

- **Cron expressions in Supabase use UTC**, not ICT. The "Frequency" column
  above shows the human-readable equivalent in ICT (UTC+7), so a cron at
  `0 3 * * *` is "03:00 ICT" which is `0 20 * * *` UTC. Verify in the
  dashboard which timezone is being used before assuming.

- **Don't run `news-check` and `news-ingest` at the same minute** — they
  rely on the check having finished before ingest starts. Keep the
  30-minute offset.

- **`batch-view-events` is not a cron job.** The SPA batches events in memory
  and POSTs them directly to the Edge Function every 60 seconds. Do not add a
  dashboard schedule for it; an empty scheduled call cannot drain browser
  memory and only produces a 400 response.

- **`auto-archive-tournaments` runs at 03:00 ICT** because that's the
  lowest-traffic window for the Vietnam audience — the migration touches
  thousands of rows and we don't want it competing with daytime queries.

## Inactive / removed schedules

When a cron is disabled or deleted, document it here instead of removing
the row above. This way `git blame` shows when + why each one was retired.

| Job | Removed | Reason |
|---|---|---|
| `news-translate-every-30m` | 2026-07-15 | Duplicate production schedule; SEC-04 retained the canonical job with the same 30-minute cadence. |

## Related

- `supabase/functions/<name>/index.ts` — the function handler the cron
  invokes. Open the file to see the body that runs on each tick.
- Supabase dashboard → Database → Cron Jobs (auth-gated) — the live
  schedule configuration. This file mirrors that view.
