# SEO — "bracket generator" cluster intent map

Roadmap topical authority, Sprint 1. Goal: stop the `/tools` money page from
being cannibalized by transactional blog posts targeting the same intent, then
build informational supporting content that links UP to `/tools`.

## The problem (GSC, last 28 days)

Query **"pickleball bracket generator"** had 3 of our URLs ranking at once:

| URL | Intent | GSC position | Note |
|-----|--------|--------------|------|
| `/tools` | transactional (hub / money page) | pos 8–9 | 44 + 82 + 14 impressions, losing clicks 2 weeks running |
| `/blog/free-pickleball-bracket-generator` | transactional (duplicate of money page) | pos 13 | dilutes the signal → **301'd to `/tools` (this PR)** |
| (informational how-to variants) | informational | — | keep, re-angle to support `/tools` |

Two transactional URLs for one intent split clicks and confuse Google about the
canonical answer. The fix is one transactional URL (`/tools`) + informational
posts that funnel to it.

## Intent assignment

| URL | Target intent | Action |
|-----|---------------|--------|
| `/tools` | transactional | **canonical money page** — improve content, push pos 8 → top 3 |
| `/blog/free-pickleball-bracket-generator` | transactional (dup) | **301 → `/tools`** (Sprint 1, this PR) — removed from sitemap/rss/indexnow/related-posts |
| `/blog/how-to-create-pickleball-bracket` + `/blog/pickleball-bracket-templates` | informational | merge into 1 guide, drop "generator" from title, strong link to `/tools` |
| `/blog/pickleball-round-robin-generator-guide` | informational | re-angle informational, link to `/tools/quick-tables` |
| `/blog/tournament-organizer-hub` | informational (pillar) | make pillar, link down to how-tos + across to `/tools` |

## Sprint 1 steps (each its own PR)

1. **[done — #449]** 301 `free-pickleball-bracket-generator` → `/tools`, audit-safe (no URL both 301 and 200 in any sitemap/SSR/feed).
2. **[done — this PR]** Merge `how-to-create-pickleball-bracket` + `pickleball-bracket-templates` → one informational guide, no "generator" in title.
3. Re-angle `pickleball-round-robin-generator-guide` → informational, link `/tools/quick-tables`.
4. Upgrade `/tools` content to push pos 8 → top 3.
5. Make `tournament-organizer-hub` a pillar linking to every how-to + `/tools`.

## GSC re-read 2026-07-26 (last 90 days, before step 2)

Numbers the remaining steps are aimed at — all four URLs, plus the two money
queries broken down by page:

| URL | Clicks | Impr. | Avg pos | Read |
|-----|--------|-------|---------|------|
| `/tools` | 20 | 503 | 11.3 | the money page; every "generator" query lands here best |
| `/blog/pickleball-round-robin-generator-guide` | 1 | 51 | 59.6 | 100% transactional "round robin generator" queries at pos ~60 → step 3 |
| `/blog/how-to-create-pickleball-bracket` | 1 | 32 | 51.5 | also only "generator" impressions — its informational query set is empty |
| `/blog/pickleball-bracket-templates` | 0 | 5 | 6.8 | effectively dead → merged away in step 2 |

Query "pickleball bracket generator" still splits across **6 URLs** (`/tools` 54
impr, `how-to-create` 15, `best-pickleball-tournament-software-2025` 7,
`/tools/doubles-elimination` 5, plus 2 already-301'd). Query family
"round robin" splits across 7 (`/tools` 40, round-robin guide 39, VI twin 13).

Also surfaced: `pickleball-ballbrackets.net`-style competitor brand queries send
133 impressions / 0 clicks to `/tools` — a possible "pickleballbrackets.net
alternative" page, out of scope for Sprint 1.

## Success metric

Track GSC query "pickleball bracket generator": expect distinct ranking URLs
3 → 1, `/tools` consolidating impressions and improving position (target top 3),
`/tools` clicks recovering.
