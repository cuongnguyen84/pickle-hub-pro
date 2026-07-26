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
3. **[done]** Re-angle `pickleball-round-robin-generator-guide` → informational, link `/tools/quick-tables`.
4. **[done]** Upgrade `/tools` content to push pos 8 → top 3.
5. **[done]** Make `tournament-organizer-hub` a pillar linking to every how-to + `/tools`.

### Step 3/5 also closed two leaks the earlier steps missed

- **VI half of step 1.** `/vi/blog/cong-cu-tao-bracket-pickleball-mien-phi-2026`
  is a transactional duplicate of `/vi/tools` with **no `alternate_en_slug`**, so
  step 1 (which walked EN slugs and their VI aliases) never saw it. GSC 90d: 0
  clicks / 5 impressions. Row → `status='merged'`, URL 301s to `/vi/tools`, and
  the 5 VI posts linking to it now link to `/vi/tools` directly.
- **11 dead VI internal links.** Published `vi_blog_posts` linked to VI slugs
  that never existed (`/vi/blog/tournament-organizer-hub`,
  `/vi/blog/luat-pickleball-day-du`, …) or that only 301. All rewritten to the
  live VI target; the audit query
  (`href="/vi/blog/x"` with no published row `x`) is now **0**.

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

### What step 4 actually changed on `/tools`

The page ranked ~11 for `pickleball bracket generator` while its SSR title said
"Free Pickleball Tournament Tools" — the head term appeared in neither the SERP
title nor the bot-visible `<h1>` (`buildHtml` emits `<h1>{title}</h1>`).

- Title → `Free Pickleball Bracket Generator | ThePickleHub` (48 bytes), meta
  description rewritten around the same term plus "round robin scheduler".
- New "Round robin generator for club play" section — the second money cluster
  (`round robin generator [free]`, 40 impressions to `/tools`) had no dedicated
  copy on the page at all.
- FAQ: 5 Q&As, rendered **both** in the bot body and in `ToolsSeoContent.tsx`
  for humans, with a matching `FAQPage` node in the JSON-LD `@graph`. Google
  requires FAQ markup to match visible answers, so all three read from one
  constant (`TOOLS_FAQ_EN` / `TOOLS_FAQ_VI`).
- Organizer-guide list now links the merged bracket guide, the re-angled round
  robin guide and the pillar, closing the cluster loop back from the money page.
- Prerender cache key bumped `pr:v30 → pr:v31` (docs/prerender-cache-log.md).

## ✅ FIXED (#467) — EN posts had no crawlable body

Measured on prod with `curl -A Googlebot` after the step-2 deploy:

| URL | total HTML | `<main>` body | FAQ schema |
|-----|-----------|---------------|------------|
| `/blog/how-to-create-pickleball-bracket` | 5.8 KB | **0.9 KB** | no |
| `/blog/pickleball-round-robin-generator-guide` | 5.8 KB | **0.9 KB** | no |
| `/blog/tournament-organizer-hub` | 5.9 KB | **0.9 KB** | no |
| `/vi/blog/cach-tao-bracket-pickleball` | 14.7 KB | 8.4 KB | yes |
| `/tools` | 6.9 KB | 2.1 KB | no (added in step 4) |

`renderBlogPost` builds `bodyContent` as `breadcrumb + relatedBlogLinks` only
(`functions/_lib/render/blog.ts:115`) — the post's own sections never reach the
bot. `renderViBlogPost` (line 212) serves the full `content_html` from Supabase
plus a `FAQPage` node, which is why the VI twins are 9× larger.

So on the SSR path every English post is title + meta + 3 links. That is a
plausible mechanical explanation for the symptom this whole cluster was
chasing: the EN guides rank 50–60 and earn **zero** informational-query
impressions, while the same content in Vietnamese ranks and earns some. It is
not a cannibalization problem alone — Google cannot see the English bodies.

**Fixed in #467.** `scripts/gen-blog-barrel.mjs` generates `posts/all.ts` (the
SPA's `import.meta.glob` is Vite-only, so the Pages Function needs its own
list), and `functions/_lib/render/blog-body.ts` renders sections + FAQ +
`FAQPage`/`HowTo` schema. The barrel exports **loaders**: `_middleware.ts` runs
for every request, and static imports would construct all 46 posts at worker
startup — esbuild's lazy `__esm()` wrappers mean a request pays only for the
post it renders. Body per post 0.9 KB → 7.5–16.9 KB; bundle 220 KB → 585 KB
gzipped against a 3 MB floor.

## ✅ FIXED (#467 follow-up) — two thirds of SERP titles shipped truncated

`buildHtml` truncates titles at **60 UTF-8 bytes** and descriptions at 160
(`functions/_lib/html.ts`), and the truncated string is what the SERP *and* the
bot-visible `<h1>` show. Vietnamese diacritics cost 2-3 bytes each, so VI copy
that looks short in characters ships mangled. This sprint shipped one live
example before catching it: `Cách tổ chức giải vòng tròn Pickleball | Lịch &
Luật 2026` is 70 bytes and prod served `…Pickleball | Lịch…`.

Audit on 2026-07-26:

| Source | Over budget |
|--------|-------------|
| `src/content/blog/metadata.ts` (46 posts) | **63 of 92 titles**, **55 of 92 descriptions** |
| Supabase `vi_blog_posts` (52 published) | **39 titles**, **50 descriptions** |

All 118 metadata strings and all 50 Supabase rows were rewritten on 2026-07-26
— keyword kept at the front, tail trimmed. Counts are now **0 over budget on
both sides**, and both halves are guarded:

- `src/content/blog/__tests__/seo-byte-budget.test.ts` is a hard gate (not a
  ratchet), and also fails on post-file ↔ metadata.ts drift — which is how the
  pass found 5 titles and ~30 descriptions where the SPA and the SSR path were
  already serving *different* copy.
- Migration `20260726120000_vi_blog_seo_byte_budget.sql` adds CHECK constraints
  on `vi_blog_posts.meta_title` (≤60 B) and `meta_description` (≤160 B), so the
  admin CMS and the Gemini translation path cannot reintroduce it. Verified by
  attempting an over-length write: rejected with 23514.

## Success metric

Track GSC query "pickleball bracket generator": expect distinct ranking URLs
3 → 1, `/tools` consolidating impressions and improving position (target top 3),
`/tools` clicks recovering.
