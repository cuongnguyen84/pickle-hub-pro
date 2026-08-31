# wc-open-scraper

Cloudflare Worker feeding the **World Cup 2026 OPEN national-team** panel on
`/live`. Fetches the organizers' public delegations page
(`sporttora.com/pwc2026`), parses the OPEN draw with the unit-tested parser in
`src/lib/wc-open/parse.ts`, diffs against Supabase, and upserts only what
changed. The client repaints over Supabase Realtime.

Scope is **OPEN + national team only** — amateur/junior/senior/master are
filtered at the parser (entryId prefix `open_team_coed__`).

## Status: not deployed

The cron in `wrangler.toml` is commented out on purpose. This worker polls a
third-party site, so it ships only after the `/live` panel is approved. Even
then, `withinMatchWindow()` keeps it from fetching outside the Sep 3–6 match
window, so a 1-minute cron only fetches during play.

## Data source is best-effort

There is no public JSON API. The parser reads the Next.js RSC flight embedded
in the server-rendered HTML. If the organizers restructure that page,
`parseWcOpenDelegations` throws `ParseGuardError`, the worker sends a Telegram
alert, and it **keeps the last-good rows** instead of overwriting them. Re-point
the parser when that happens; do not loosen the guard.

## Enable after approval

```sh
cd workers/wc-open-scraper
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put SCRAPER_AUTH_SECRET
wrangler secret put TELEGRAM_BOT_TOKEN   # optional
wrangler secret put TELEGRAM_CHAT_ID     # optional
# uncomment [triggers] in wrangler.toml, then:
wrangler deploy
```
