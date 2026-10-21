# Risk brief — "PPA Tour rankings tab" on ThePickleHub

## The product (you cannot see this repo — everything you need is below)

ThePickleHub (https://www.thepicklehub.net) is a bilingual VI/EN pickleball
platform built and operated by ONE person (Cuong). ~2,000 real users, ~95%
Vietnamese. Revenue-bearing: paid tournament registrations, payment orders,
livestream. It is a commercial product.

Stack:
- Frontend: React 18 + TypeScript + Vite SPA, hosted on Cloudflare Pages.
- SEO prerender for bots: Cloudflare **Pages Functions** middleware
  (`functions/_middleware.ts`) sniffs bot user-agents and serves
  server-rendered HTML from per-route handlers in `functions/_lib/render/`.
  Human users get the SPA; Googlebot gets the SSR HTML. Two different
  code paths render the same URL.
- Prerender HTML is cached in Cloudflare KV under key `pr:v33:${pathname}`.
  **The query string is NOT part of the cache key.** Force-refresh of one
  path only via `?nocache=1` (value must be exactly "1").
- Backend: Supabase Postgres + PostgREST + Edge Functions (Deno).
- Scheduled scrapers: standalone Cloudflare Workers (`wrangler deploy`,
  deployed out-of-band — the git repo is NOT their deployment source of truth).
- Mobile: a native SwiftUI iOS app that reads the same Supabase RPCs.

Reliability policy (written, enforced): reliability outranks scope. Seven
SLOs: web availability 99.5%, auth 99%, registration 99%, scoring 99.5%
(zero lost-update incidents), cron 100% monitored-healthy, Vietnam mobile
p75 LCP<=2.5s / INP<=200ms / CLS<=0.1, push >=95%.

## The page today: /rankings and /vi/rankings

- React page `src/pages/Rankings.tsx` (~505 lines). A "scope" tab bar:
  `vietnam` (DEFAULT) + `open` + `junior` + 5 continents. Within each scope,
  format sub-tabs (men's/women's singles/doubles).
- `vietnam` scope = LIVE data from a Supabase RPC `dupr_leaderboard_vietnam`
  (top 100), sourced from ThePickleHub's own users who linked their DUPR
  account and opted into public visibility. This is first-party data.
- All other scopes = a static hand-committed JSON snapshot of dupr.com from
  2026-05-02 (`src/content/dupr-rankings.ts`, 4360 lines).
- Scope/format are URL-backed (`?scope=`, `?format=`) via a hook
  `useUrlBackedState`: it resolves the param ONCE on mount, otherwise falls
  back to a hardcoded default (`vietnam`), then mirrors the resolved value
  into the URL with `history.replace`.
- SSR handler `functions/_lib/render/rankings.ts`: for bots it calls the
  same `dupr_leaderboard_vietnam` RPC (top 25 doubles), and emits:
  - `<title>` "Vietnam DUPR Pickleball Rankings | ThePickleHub" (EN) /
    "Bảng xếp hạng DUPR Pickleball Việt Nam" (VI)
  - `<h1>` "Top 25 Doubles — Vietnam"
  - an `<ol>` of 25 `<a href="/nguoi-choi/{username}">` links to the
    players' own public profile pages on ThePickleHub
  - schema.org `ItemList` JSON-LD with those same 25 profile URLs
  - hreflang en/vi/x-default
  This SSR handler is the ONLY server-rendered page on the whole site that
  emits internal links into `/nguoi-choi/*` player profiles (verified by
  grep across `functions/_lib/render/`). Player profiles otherwise are
  reachable to crawlers only via `sitemap-players.xml`.
- `/rankings` and `/vi/rankings` are in `sitemap-static.xml` with
  `changefreq=daily, priority=0.9`.
- The native iOS app implements ONLY the `vietnam` scope (same RPC); its
  code comments say global/continent scopes are deferred.
- There is zero automated test coverage on `Rankings.tsx`,
  `dupr-rankings.ts`, or `functions/_lib/render/rankings.ts`.

## The proposed change (what Cuong asked for)

1. Add a new scope tab "PPA Tour" to `/rankings` + `/vi/rankings`.
2. **Make PPA the DEFAULT tab** — opening `/rankings` with no query param
   shows PPA first, replacing Vietnam as the default.
3. Data comes from a NEW automatic recurring scrape job (a new Cloudflare
   Worker on a cron, or a new Supabase cron edge function) pulling
   https://www.ppatour.com/rankings/. Cuong explicitly said the existing
   `pro-tour-scraper` worker (match results) is not reusable for this.
4. New Supabase table + new RPC to read it.
5. Scope: "all formats, as deep as possible", explicitly to serve as an
   SEO landing page.

## Facts I established by fetching ppatour.com myself just now (2026-08-06)

- `https://www.ppatour.com/robots.txt`: `User-Agent: * / Allow: /` with
  disallows only on `/live/`, `/brackets/`, `/hero-preview/`, and two event
  paths. `/rankings/` is NOT disallowed.
- `https://www.ppatour.com/about/terms/` contains, verbatim:
  > "Acceptable use — Don't scrape, mirror, or rebroadcast our content
  > commercially without written permission."
  > "Personal, non-commercial sharing on social media is welcome with
  > credit; commercial use requires a license."
- The rankings page is a Next.js app on Vercel, server-rendered (RSC flight
  data present in initial HTML) — a plain `fetch()` gets the data, no
  headless browser needed.
- There is an undocumented internal JSON endpoint
  `https://www.ppatour.com/api/rankings/` returning HTTP 200,
  `application/json`, 502,737 bytes (~65 KB gzipped), `server: Vercel`,
  `x-vercel-cache: MISS`, `cache-control: public`.
- That JSON contains exactly TWO boards: `men` (1,324 entries) and `women`
  (751 entries) — 2,075 rows total. Per-entry fields: `rank`, `isTied`,
  `slug`, `name`, `points`, `prizeMoney`, `countryCode`, `headshot`,
  `profileUrl`, `hasLocalProfile`. The page copy calls it
  "Rankings — combined men's and women's standings", i.e. the World
  Pickleball Ranking composite.
- There are NO Singles / Doubles / Mixed sub-boards on that page or in that
  endpoint. The premise "all formats (Men's/Women's × Singles/Doubles/Mixed)"
  does not match what the source actually publishes.
- Trimmed to 5 useful fields, all 2,075 rows = 217,815 bytes raw,
  43,890 bytes gzipped.

## Operational context / prior scars at this shop

- Bundle budget is CI-enforced. Measured today from the current build:
  INITIAL 225.2 KB gz (budget 280), CODE 1512.0 KB gz (budget 1800),
  **Total 1888.4 KB gz against a 1970 KB backstop = 81.6 KB of headroom
  left**, and the backstop "ratchets DOWN only".
- Vietnam mobile p75 is the release metric (global analytics is bot-polluted
  and is not an SLO input). A known-open finding: mobile CLS p75 is already
  ~0.67 against a 0.1 budget.
- Prior scraper incident: an MLP results scraper silently returned
  "0 matchups" after the source site changed its markup. Nobody noticed for
  days. The fix was an explicit empty-result guard that fails loud.
- Prior secret incident: a "secret-sync" automation loop repeatedly
  overwrote `SCRAPER_AUTH_SECRET` on a Worker, causing 401s. The sync
  automation was removed entirely; Worker secrets are now hand-synced and
  can silently drift.
- Job monitoring exists but is opt-in: a Postgres table `ops_job_registry`
  (job_key, executor ∈ cloudflare_worker|pg_net|github_actions, expected
  interval, grace) + `ops_job_runs`; Workers self-report by calling an RPC
  `ops_record_job_run` with status success/warning/failed. A 10-minute cron
  `errors-telegram-alert` pages Telegram when a job goes stale/failed. A new
  job appears on NO dashboard and pages NO alert unless (a) a migration
  inserts its registry row and (b) the worker code calls that RPC.
- Migrations are applied to production directly; there are no automatic
  down-migrations. `git revert` on a migration file does not un-run the SQL.
- Postgres GRANT is checked BEFORE RLS. A recurring bug at this shop (3
  recorded occurrences) is a new table with correct RLS but no GRANT →
  clients get `42501 permission denied` while it tested fine in the
  dashboard SQL editor (which runs as superuser).
- GitHub Actions minutes have run out before, killing every scheduled gate.
- One operator, no on-call rotation, Vietnam timezone.

## Your job

Find the specific way this change breaks production. Name the mechanism,
the trigger, and the user-visible symptom. Prioritise failures that this
particular architecture makes likely, not generic risk. Say plainly if some
part of it is genuinely safe. Also tell me if you think I am over-weighting
or under-weighting any of the facts above.
