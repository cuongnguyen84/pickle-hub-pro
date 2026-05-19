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

| Function | Schedule (cron) | Frequency | Purpose | Last modified |
|---|---|---|---|---|
| `auto-archive-tournaments` | `0 3 * * *` | Daily 03:00 ICT | Move tournaments older than N days from `ongoing` → `completed` so the list views don't grow unbounded. Also clears stale `live_referee_id` on matches that have been "in progress" for >12h (orphaned scoring sessions). | 2026-04-22 |
| `auto-cancel-unpaid-registrations` | `*/15 * * * *` | Every 15 min | Cancel registrations that have been in `pending_payment` status for >24h. Releases the seat back to the pool so a paying user can claim it. | 2026-03-09 |
| `news-check` | `0 */6 * * *` | Every 6 hours | Poll RSS feeds + scraper sources for new pickleball headlines. Lightweight check (no full ingest) to detect "is there anything new since last run?" | 2026-04-15 |
| `news-ingest` | `30 */6 * * *` | Every 6 hours, 30 min after `news-check` | Ingest, dedupe, classify, and write new articles found by `news-check` into `news_articles`. Offset by 30 minutes so the check has finished before ingest starts. | 2026-04-15 |
| `news-translate` | `30 0 * * *` | Daily 07:30 ICT | Drain pending EN news_items by calling Gemini Flash for EN→VI translation. Inserts VI siblings via parent_news_id. | 2026-05-19 |
| `batch-view-events` | `*/5 * * * *` | Every 5 min | Drain the in-memory `view_events` queue from the SPA (livestream + video views) and bulk-insert into `view_events`. Backpressure: if the queue is empty the function exits in <100ms. | 2026-02-28 |
| `mux-sync-assets` | `0 */4 * * *` | Every 4 hours | Reconcile Mux Asset state with our `livestreams` table. Picks up assets that finished after our `mux-webhook` retry budget exhausted, and marks abandoned livestreams as `ended`. | 2026-04-08 |

## How to change a schedule

Common gotchas:

- **Cron expressions in Supabase use UTC**, not ICT. The "Frequency" column
  above shows the human-readable equivalent in ICT (UTC+7), so a cron at
  `0 3 * * *` is "03:00 ICT" which is `0 20 * * *` UTC. Verify in the
  dashboard which timezone is being used before assuming.

- **Don't run `news-check` and `news-ingest` at the same minute** — they
  rely on the check having finished before ingest starts. Keep the
  30-minute offset.

- **`batch-view-events` should never run less often than 5 minutes** —
  the SPA queue is bounded; longer intervals cause user-visible drops in
  view counts during high-traffic moments (e.g. live PPA finals).

- **`auto-archive-tournaments` runs at 03:00 ICT** because that's the
  lowest-traffic window for the Vietnam audience — the migration touches
  thousands of rows and we don't want it competing with daytime queries.

## Inactive / removed schedules

When a cron is disabled or deleted, document it here instead of removing
the row above. This way `git blame` shows when + why each one was retired.

(none yet)

## Related

- `supabase/functions/<name>/index.ts` — the function handler the cron
  invokes. Open the file to see the body that runs on each tick.
- Supabase dashboard → Database → Cron Jobs (auth-gated) — the live
  schedule configuration. This file mirrors that view.
