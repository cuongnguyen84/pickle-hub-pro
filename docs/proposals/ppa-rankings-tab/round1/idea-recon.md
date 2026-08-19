# idea-recon — ppa-rankings-tab (2026-08-06)

## Prior art

**No PPA rankings tab or scrape job exists.** `/rankings` today is DUPR-only (not PPA/pro tour), and no worker touches `ppatour.com/rankings`.

- `src/pages/Rankings.tsx:35-338` — single page, all scope/format tabs are DUPR data. Scope model: `DuprScope` union (`vietnam` default + `open`/`junior` + 5 continents), grouped into `national`/`global`/`continent` rows (`src/content/dupr-rankings.ts:4326-4335`). `vietnam` is hardcoded as default everywhere (`useUrlBackedState` fallback at `Rankings.tsx:44`, `defaultFormatForScope` at `dupr-rankings.ts:4356-4358`, SSR default at `functions/_lib/render/rankings.ts:15-20,38-41`).
- `src/content/dupr-rankings.ts` (4360 lines) — static JSON snapshot scraped from dupr.com by a manual script (`scripts/parse-dupr.py`, comment at line 12), committed and refreshed by hand. This is the pattern a PPA static-snapshot approach would mirror, but a "job MỚI scrape tự động định kỳ" is explicitly the opposite of this file's model.
- `src/hooks/dupr/useVietnamRankings.ts` — the one live-RPC path (`dupr_leaderboard_vietnam`), only for the `vietnam` scope; not reusable as-is for PPA (different shape: rank/name/rating vs whatever PPA fields are).
- `src/content/blog/posts/world-pickleball-rankings-wpr-explained.ts` (commit `712bf549`) — **editorial explainer of PPA's WPR system**, EN+VI, no live ranking table/data, no ppatour.com scrape. Explains the 15%/50%/85% weighting formula in prose. Not overlapping with "add a live PPA rankings tab" — it's content, not data.
- `apple/ThePickleHub/Core/Rankings/RankingsRepository.swift:1-26` — native only implements `vietnam` scope via the same RPC; comment explicitly says "Global/continent scopes are a static DUPR.com snapshot on the web — deferred for native." No PPA anywhere in `apple/`.

## Touch surface (likely)

- `src/pages/Rankings.tsx` — new scope branch (`ppa` or similar), new scope-row group, table renderer, default-scope change
- `src/content/dupr-rankings.ts` OR a new `src/content/ppa-rankings.ts` — depends on whether PPA data is static-committed (matches this file's existing pattern) or DB-backed (matches `useVietnamRankings` pattern); Cuong's ask ("job tự động định kỳ") points toward DB-backed, i.e. a new hook + new RPC, not this file
- `functions/_lib/render/rankings.ts:21-122` — SSR default currently queries `dupr_leaderboard_vietnam` and hardcodes Vietnam copy/heading (lines 27-32, 60-68); making PPA the default tab means this function's default query/heading/JSON-LD all need to point at PPA data, or bot path silently keeps serving stale "Vietnam is default" content while the client shows PPA — a correctness split worth flagging, not fixing here
- `functions/_middleware.ts:583-658` — cache key `pr:v32:${pathname}`, **query string not part of key** (per CLAUDE.md) — so `?scope=ppa` deep link would return the same cached SSR HTML as `?scope=vietnam`; only the default (no-param) SSR path matters for bots
- New worker directory, e.g. `workers/ppa-rankings-scraper/` — no existing worker fetches `ppatour.com/rankings`; nearest siblings are `workers/pro-tour-scraper` (match results, Browser Rendering REST API + HMAC ingest) and `workers/news-fetcher` (cron RSS/HTML scrape, direct PostgREST writes)
- A new Supabase table (no `ppa_rankings*`/`ppa_tour_rankings*` table exists) + new RPC to read it + migration
- `src/App.tsx:572` area — Rankings route registration (referenced in `functions/_lib/render/rankings.ts:13`)

## Data

- **No PPA/WPR tables exist.** `grep pro_tour` migrations hit: `20260510160000_pro_tour_foundation.sql` (`pro_tour_watchlist`, `pro_tour_ingestion_logs` — both about match-result scraping, not rankings) and `20260510160002_pro_tour_system_profile.sql`. Nothing named `ppa_rankings`, `ppa_tour_rankings`, or `wpr_*`.
- `dupr_leaderboard_vietnam(p_format, p_limit)` RPC — SECURITY DEFINER, used by both web `useVietnamRankings` and `apple/RankingsRepository.swift`; unrelated to PPA but is the template for "RPC + SSR + native all read one function."
- `pro-tour-ingest` and `pro-tour-trigger-scrape` edge functions (`supabase/functions/`) — existing ingest pattern (dedupe on `(source_provider, external_match_id)`, service-role auth) but built for match results, not a rankings table upsert. Confirms Cuong's statement that this pipeline isn't reusable for rankings without a new table/RPC.

## Binding constraints found

- CLAUDE.md — cache key `pr:v32:${pathname}`, **query string not part of the key**; force-refresh only via `?nocache=1` (must be exactly `"1"`). Any SSR default-tab change requires a KV version bump or it serves stale HTML to bots.
- CLAUDE.md — Sitemaps: `/rankings` + `/vi/rankings` are already in `functions/sitemap-static.xml.ts:81-82` with `changefreq: daily, priority 0.9` — no new sitemap entry needed unless PPA gets its own sub-route.
- CLAUDE.md — bilingual blog checklist (4 files + barrel regen) applies only if this ships as a blog/landing page, not to the `/rankings` tab itself.
- CLAUDE.md — Workers: "Each worker has its own `wrangler.toml`. Deploy with `wrangler deploy` from inside the worker directory" — a new scrape job is a new worker dir, matching `pro-tour-scraper`/`news-fetcher` shape.
- `pro-tour-scraper/wrangler.toml` comment — Cloudflare Browser Rendering REST API is single-shot per page load (no click-through actions); if ppatour.com/rankings paginates/tabs client-side per format, this is the same limitation pro-tour-scraper already hit and worked around.

## Test coverage today

- `src/routes/__tests__/route-snapshot.test.ts` — route registration snapshot, would need updating if scope/default changes
- No test file targets `Rankings.tsx`, `dupr-rankings.ts`, `useVietnamRankings`, or `functions/_lib/render/rankings.ts` — zero existing coverage on this whole surface, gap applies equally to any PPA addition
- `workers/pro-tour-scraper/__fixtures__/` — one HTML fixture pattern for offline adapter tests; a new PPA scraper would need its own fixture(s) of `ppatour.com/rankings` HTML

## Bilingual surface

VI/EN strings for the Rankings page are all inline ternaries on `language === "vi"` inside `Rankings.tsx` (headings, scope labels, attribution copy) and inside `dupr-rankings.ts` (`labelEn`/`labelVi` per scope/format) — no separate i18n JSON file for this page. A PPA scope would follow the same inline pattern: new `labelEn: "PPA Tour"` / `labelVi: "PPA Tour"` (or a VN name) entries plus new copy blocks in the attribution section (`Rankings.tsx:320-333`) and SSR heading strings (`rankings.ts:27-32,60-68`).

## Unknowns worth asking Cuong

1. Storage model: static-snapshot file (manual refresh, like `dupr-rankings.ts`) vs DB table + scheduled worker (matches the literal ask "job mới scrape tự động định kỳ") — intake already answers this as DB-backed, but confirm the refresh cadence (news-fetcher = 2h, pro-tour-scraper = 6h) since ppatour.com/rankings likely updates weekly at most.
2. Does ppatour.com/rankings render rankings server-side in initial HTML, or client-hydrated (RSC/JS), determining whether a plain `fetch()` suffices or Browser Rendering REST API (like pro-tour-scraper) is required — nobody has scraped this specific page before.
3. SSR default-tab conflict: making PPA the default client-side tab while `renderRankings` SSR still defaults to Vietnam RPC data creates a bot-sees-different-default-than-user-sees split unless the SSR function is also rewritten — worth flagging before scoping the SSR work.
