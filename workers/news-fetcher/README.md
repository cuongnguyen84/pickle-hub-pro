# news-fetcher

Cloudflare Worker that pulls pickleball news from the active sources in
`news_sources` and writes deduped rows into `news_items`.

## Triggers

- **Scheduled cron** — `0 */2 * * *` UTC (every 2 hours).
- **HTTP POST `/run`** — manual trigger for admin tooling and smoke tests.
  Requires header `X-Auth-Secret: $SCRAPER_AUTH_SECRET`.

## Secrets (set via `wrangler secret put`)

| Name | Purpose |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | PostgREST writes to `news_items`, reads `news_sources`. |
| `SCRAPER_AUTH_SECRET` | Gate the `/run` endpoint. |

## Deploy

```bash
cd workers/news-fetcher
npm install
CLOUDFLARE_API_TOKEN=$CLOUDFLARE_TOKEN \
CLOUDFLARE_ACCOUNT_ID=7888e97076d4eadd9a8fa409d11dc281 \
  wrangler deploy

# One-time secrets (paste value when prompted, or pipe via stdin):
echo -n "$SUPABASE_SERVICE_ROLE_KEY" | wrangler secret put SUPABASE_SERVICE_ROLE_KEY
echo -n "$SCRAPER_AUTH_SECRET"        | wrangler secret put SCRAPER_AUTH_SECRET
```

## Smoke test

```bash
curl -X POST \
  -H "X-Auth-Secret: $SCRAPER_AUTH_SECRET" \
  https://news-fetcher.<account>.workers.dev/run | jq

# Expected: { ok: true, results: [ { source_id, fetched, inserted, ... } ] }
```

Each `results` row reports `fetched` (items in the feed window),
`inserted` (rows newly written), `skipped_dup` (already in DB), and
`skipped_old` (older than `MAX_AGE_DAYS`, currently 30).

## Adding a new source

Insert a row into `news_sources` (active=true, feed_type='rss' or 'atom').
Next cron tick (or manual `/run`) picks it up automatically — no worker
redeploy needed.

## Per-source observability

`news_sources` carries operational state:

- `last_fetched_at` — every attempt, success or failure
- `last_success_at` — only on success
- `last_error` — last failure reason, truncated to 500 chars

Phase 5 (monitoring) will surface this in the admin UI.

## What this worker does NOT do

- **Image self-hosting.** We store the source's CDN URL in `image_url`
  as-is. If any source starts blocking referer / hotlinking, Phase 4
  will copy to Supabase Storage.
- **Vietnamese translations.** Worker writes EN rows only. A separate
  `news-translate` edge function (Phase 3) listens on inserts and
  produces VI rows via Claude Haiku.
- **Long-form content body.** Only the summary (≤ 300 chars) is stored.
  Article bodies stay on the source; we link out with attribution.
