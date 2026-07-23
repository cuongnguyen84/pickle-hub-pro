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

1. **[this PR]** 301 `free-pickleball-bracket-generator` → `/tools`, audit-safe (no URL both 301 and 200 in any sitemap/SSR/feed).
2. Merge `how-to-create-pickleball-bracket` + `pickleball-bracket-templates` → one informational guide, no "generator" in title.
3. Re-angle `pickleball-round-robin-generator-guide` → informational, link `/tools/quick-tables`.
4. Upgrade `/tools` content to push pos 8 → top 3.
5. Make `tournament-organizer-hub` a pillar linking to every how-to + `/tools`.

## Success metric

Track GSC query "pickleball bracket generator": expect distinct ranking URLs
3 → 1, `/tools` consolidating impressions and improving position (target top 3),
`/tools` clicks recovering.
