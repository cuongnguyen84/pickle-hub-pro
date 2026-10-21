# Devil's-advocate brief — pro-rankings tab + full-roster player search

You cannot see the repo. Everything you need is below. Answer only from this.

## Product

A bilingual (Vietnamese/English) pickleball website. React 18 + TypeScript + Vite SPA,
hosted on Cloudflare Pages. Bot/crawler traffic is server-side rendered by a Cloudflare
Pages Function middleware (`functions/_middleware.ts`) that:

- lets non-bot requests fall straight through to the SPA (`if (!isBot) return next()`),
- for bot user-agents, renders route-specific HTML and caches it in a KV namespace under
  a pathname-only key `pr:v34:${pathname}`. Query string is NOT part of the cache key.
  Changing SSR output requires bumping the version prefix to invalidate stale HTML.

Two relevant routes already exist and are deployed on an open PR:

- `/rankings` (+ `/vi/rankings`) — amateur rankings from the site's own database.
- `/rankings/ppa-tour` (+ `/vi/rankings/ppa-tour`) — an *editorial excerpt*: a
  hand-committed static TypeScript module holding 25 men + 25 women rows
  (rank, name, country, points) plus a credit line, a `rel="nofollow"` link to the
  source, and a disclaimer that the site is not an official partner. Both the SPA page
  and the SSR renderer import the same static module. No database table, no cron, no
  scraper for this data.

## The proposed change

1. Replace a small text link on `/rankings` with a prominent two-item tab bar
   `[DUPR | WPR]` shown on both routes; clicking navigates between the two pathnames.
   Purely a client-side UI change unless the SSR renderers are edited.
2. Add a player-name search box on the pro-rankings page. The owner has explicitly
   decided the search must resolve **all ~2,075 players**, not just the 50 currently
   embedded.

## The third-party data source (all facts below independently verified today)

Public endpoint `https://www.ppatour.com/api/rankings/` (Next.js on Vercel):

- HTTP 200, `content-type: application/json`, `cache-control: public`,
  `x-vercel-cache: HIT`.
- **502,737 bytes raw / 66.6 KB gzipped.** Shape: `{ divisions: [ {key:"men", entries:[1324]},
  {key:"women", entries:[751]} ], source:"live" }` — 2,075 entries total.
- Each entry: `{rank, isTied, slug, name, points, prizeMoney, countryCode, headshot,
  profileUrl, hasLocalProfile}`. `headshot` is an image path/URL; 174 entries have
  `hasLocalProfile:true` (own-site athlete page), the other 1,901 have `profileUrl`
  pointing at a *different* company's site (`pickleball.com/players/<slug>`).
- **No `access-control-allow-origin` header** → a browser cannot fetch it cross-origin.
- **The endpoint ignores query parameters.** `?search=johns`, `?q=johns`,
  `?division=men&limit=10` all return the identical full 502,737-byte body. There is no
  server-side search or pagination.
- Measured gzip of reduced projections of the same data:
  `[rank,name,points,countryCode,division]` = 26.9 KB gz; names only = 14.9 KB gz;
  `[name,slug]` = 28.5 KB gz.

Their `robots.txt` (public): `User-Agent: * / Allow: /` with four `Disallow:` lines for
`/live/`, `/brackets/`, `/hero-preview/`, and one live-event path. The rankings API path
is not disallowed.

Their public terms page (last updated May 22, 2026) says, verbatim:

> "Don't scrape, mirror, or rebroadcast our content commercially without written permission.
> Don't bypass paywalls, ticket controls, or rate limits."

and:

> "All match footage, brackets data, photography, and tour branding are property of the
> Carvana PPA Tour or our broadcast partners. Personal, non-commercial sharing on social
> media is welcome with credit; commercial use requires a license."

Note: the property enumeration lists footage, *brackets* data, photography and branding —
rankings/points are not named in that sentence, though the acceptable-use sentence says
"our content" generally. A written-permission request was sent to their legal contact and
has not been answered. The site owner is a single individual, is the legal responsible
party, and has said he is willing to accept risk — he wants the price of each option
stated accurately, not decided for him.

## Candidate architectures to attack

- **(a) Static full copy** — commit the 2,075 rows (or a reduced projection) into the repo,
  either as a TS module bundled into the route's JS chunk, or as a JSON file in `public/`
  fetched at runtime.
- **(b) Runtime proxy** — a new Cloudflare Pages Function that fetches the upstream JSON
  per request and returns matches for a query string; nothing persisted.
- **(c) Direct client fetch** — dead on arrival, no CORS header (confirmed above).
- **(d) Search only the 50 embedded rows**, and for a miss, link out to the source site.
- **(e) Name→link index only** — store names/slugs, resolve a search into an outbound link
  to the player's page on the source (or partner) site; never republish rank or points.

## Engineering constraints

- A CI gate computes total gzipped JS in the build directory. It walks the build output and
  **only sums files ending in `.js`** — a `.json` file in `public/` is not counted by it.
  Remaining headroom against that gate is roughly 69 KB gz. Separate caps: any single route
  chunk ≤ 150 KB gz.
- The service-worker precache list is a strict filename whitelist (`*.{ico,png,svg}`,
  `fonts/*.woff2`, `assets/*.css`, and a named list of `assets/*.js` chunks). Arbitrary
  files in `public/` are not precached.
- Content-Security-Policy is `connect-src 'self' https: wss:` — permissive; CORS is the only
  browser-side blocker for (c).
- The site is operated by one person. There is no on-call rotation.

## What to answer

1. For each of (a), (b), (d), (e): name the specific production failure mode — mechanism,
   trigger, user-visible symptom. Not generic risk language.
2. Is (b) meaningfully different from (a) with respect to the quoted terms, or is that a
   distinction without a difference? Argue it concretely.
3. Which failure would a solo operator most plausibly *not notice* for weeks?
4. If one of these options is genuinely safe, say so plainly and briefly.
