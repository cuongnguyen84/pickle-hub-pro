# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**ThePickleHub** — bilingual Vietnamese-English pickleball platform. Tournament management, livestream, video replay, news aggregator, community feed. Solo-built by Cuong Nguyen. Target audience ~95% Vietnamese.

Website: https://www.thepicklehub.net

## Stack

- **Frontend:** React 18 + TypeScript + Vite + shadcn/ui + Tailwind CSS + vite-plugin-pwa
- **Backend:** Supabase (project ref `ajvlcamxemgbxduhiqrl`)
- **Hosting:** Cloudflare Pages (project `pickle-hub-pro`, production branch `main`) + Cloudflare Workers for scheduled scrapers
- **Mobile:** native SwiftUI iOS app in `/apple` (app ID `net.thepicklehub.app`). Capacitor retired 2026-08-24 — the iOS wrapper was replaced on the App Store by native 2.0.3, and the Android wrapper never shipped. There is no Android app.
- **Livestream:** Mux
- **Push:** Firebase Cloud Messaging (FCM, registered natively by `/apple`)
- **Email:** Resend
- **AI translation:** Google Gemini (EN → VI for news)
- **Analytics:** GA4, Google Search Console (read via Chrome when needed), Ahrefs Web Analytics (free script in `index.html`, data since 2026-07-04 — read the dashboard via Chrome at app.ahrefs.com/web-analytics). _Ahrefs MCP tools ALL return "Insufficient plan" (even `web-analytics-*`); do not call them._ GA4 caveat: heavily polluted by US datacenter bot traffic — trust the Vietnam segment / Ahrefs numbers instead.

## Commands

```sh
npm run dev        # Vite dev server on port 8080
npm run build      # Production build
npm run build:dev  # Dev mode build with source maps
npm run lint       # ESLint check
npm run preview    # Preview production build locally
npm run test       # Vitest single run
npm run test:watch # Vitest watch mode
```

Regenerate Supabase types (canonical command — `--schema public` is REQUIRED; without it older CLI runs silently dropped tables):

```sh
npx supabase gen types typescript --project-id ajvlcamxemgbxduhiqrl --schema public > src/integrations/supabase/types.ts
```

Mobile — the app lives in `/apple` (SwiftUI). Build loop: `xcodegen` → `xcodebuild` → `simctl`.

## Critical Workflow Notes

### Mốc hẹn ngày

Đầu mỗi phiên autonomous: `node scripts/due-milestones.mjs` — mốc nào due thì thực thi theo PREDICATE trong `docs/milestones.md` hoặc ghi lý do defer vào dòng mốc; xong tick `[x]` cùng commit với bằng chứng.

### New blog post checklist (EN + VI bilingual)

Every new blog post requires **4 simultaneous changes** in the same push, or bots will 404 / VI won't render / hreflang breaks:

1. `src/content/blog/posts/<slug>.ts` — full BlogPost with content.en AND content.vi
2. `src/content/blog/metadata.ts` — prepend BlogPostMetadata entry at top of array. **Single SEO source of truth** (SEO-02): `BLOG_POST_META` (SSR `<title>` = `metaTitleEn`) and `EN_BLOG_SLUGS` (sitemap) are GENERATED from it — never hand-edit `functions/_lib/render/blog-meta.ts` or `functions/_lib/static-blog-slugs.ts`.
3. Supabase `vi_blog_posts` INSERT — VI HTML version with `alternate_en_slug` pointing back to the EN slug. Required for `/vi/blog/<vi-slug>` route + reciprocal hreflang.
4. `node scripts/gen-blog-barrel.mjs` — regenerates `src/content/blog/posts/all.ts`. That barrel is the ONLY loader the SSR bot path can use (Pages Functions cannot use `import.meta.glob`); skip it and Googlebot gets the shell with no article body. Missed on 2026-08-05 (`hong-kong-slam-2026-preview` served 71 words instead of 1518) — caught by `src/content/blog/__tests__/blog-barrel.test.ts`, fixed in #546.
5. **GEO check on the opening paragraph** (rule since 2026-08-14, validated by blind passage-citation testing — full method in the `picklehub-builder` skill). AI search cites PASSAGES, not pages; the opening must survive being extracted standalone:
   - Name **"ThePickleHub"** once, naturally, in the opening (EN + VI) — "This ThePickleHub guide covers...", "lịch giải do ThePickleHub cập nhật..." — so an AI answer can attribute the snippet ("theo ThePickleHub..."). One mention; don't stuff. Never the spaced variant "The Pickle Hub" in prose (entity dilution; alternateName-only).
   - **Front-load the answer**: names + dates + places + numbers in the first two sentences. No throat-clearing intros ("Trong những năm gần đây...") — a passage that promises the answer loses to one that contains it.
   - **Entity + year together**: "Ho Chi Minh City Open 2026 (6–9/8/2026)", not "(6–9/8)".
   - Calendar/list/living posts: add a visible **"last updated: <date>"** dateline in the opening AND bump `updatedDate` in the post + metadata.ts (feeds dateModified schema). Refresh stale statuses (completed events must say completed).
   - No pronoun-dependent openings ("chúng tôi", "công ty này") and no unverifiable superlatives without a number/source in the same passage.

After `git push main` and Cloudflare deploy succeeds, **immediately request indexing**:
- Google: open GSC URL Inspection → paste EN URL + VI URL → "Request Indexing". No public Google Indexing API for blog posts (only JobPosting + BroadcastEvent).
- Bing: IndexNow POST via `functions/api/indexnow.ts` (or direct `https://api.indexnow.org/indexnow?url=<URL>&key=<KEY>`). Requires `<KEY>.txt` at root.

Verify via `curl -A "Googlebot"` returning 200 with correct title + og:image + hreflang en/vi/x-default tags before declaring done. Append `?nocache=1` — without it the prerender KV serves the pre-deploy HTML and the check passes on stale content. Assert the body is actually present (word count), not just the tags: the 2026-08-05 miss had perfect tags and an empty article.

## Critical Architecture Notes

### Supabase JWT ES256/HS256 Workaround

Project `ajvlcamxemgbxduhiqrl` has a platform issue: Auth service issues JWTs signed with ES256 (asymmetric), but Edge Functions gateway verifies with HS256 (symmetric). This causes gateway to reject all valid user JWTs with 401 "Invalid JWT".

**Workaround:** user-facing functions have `verify_jwt = false` in `supabase/config.toml`. They verify JWT internally via `supabase.auth.getUser()` (Auth API handles ES256 correctly).

Key examples: `mux-create-livestream`, `delete-account`, `send-push-notification`, `invite-team-to-tournament`.

**DO NOT** set `verify_jwt = true` on these functions until Supabase fixes the platform mismatch.

### SEO Prerender (Cloudflare Pages Functions)

SEO prerendering for bot crawlers is handled by `functions/_middleware.ts` + `functions/_lib/render/`, NOT by Supabase edge functions.

- Cache key: **`pr:v<N>:${pathname}`** in KV namespace `PRERENDER_CACHE`. **Do not trust a version number written here** — this line said `pr:v34` while production had been on `v53` for weeks. Read the current value from the source instead:

  ```sh
  grep -n 'const cacheKey' functions/_middleware.ts
  ```

  Bump `<N>` in the same commit as any change to SSR output, or cached HTML serves the pre-change version for the full TTL. The number carries no meaning beyond being different from the deployed one, so when two open branches both bump it, take the higher and move on. Add a one-line comment above the constant saying what changed — that comment block is the real changelog.

  The query string is **not** part of the key. To force-refresh a single path after changing content or og:image, request it once with **`?nocache=1`** — the value must be exactly `1` (`_middleware.ts` compares `=== "1"`); any other value silently serves the cached copy.
- Per-route handlers: `renderBlog`, `renderViBlog`, `renderTournament`, `renderMatch` (`match-seo.ts`), `renderSocialEvent`, `renderRankings`, `renderLive`, `renderNews`, etc.
- `BLOG_POST_META` in `functions/_lib/render/blog-meta.ts` is the SSR truth table for blog posts — missing entry = bot 404. Since SEO-02 (`ce6a0fa`) it is **generated at module load** from `src/content/blog/metadata.ts`; do not hand-edit it, add the metadata entry instead.

The legacy `prerender-worker` Cloudflare Worker is still active and **MUST be preserved**. It serves production traffic for thepicklehub.net.

### Sitemaps (split, bilingual hreflang)

Root `/sitemap.xml` is a sitemap index served by `functions/sitemap.xml.ts` referencing segment sitemaps:

- `sitemap-static.xml`, `sitemap-blog.xml`, `sitemap-tournaments.xml`, `sitemap-matches.xml`, `sitemap-events.xml`, `sitemap-news.xml`
- `sitemap-players.xml`, `sitemap-venues.xml`, `sitemap-livestreams.xml`, `sitemap-organizations.xml` are **enabled** in the index (venues: /san detail + /san/khu-vuc/<city> hub pairs; players: profiles with real content only — DUPR-linked, a synced DUPR rating, or a bio ≥30 chars; see `hasIndexableSubstance()` in `functions/sitemap-players.xml.ts`)

`xhtml:link` hreflang (en, vi, x-default) is emitted only by the segments that genuinely have two URLs per entity: **blog, events, venues, static**. **news emits `vi` + `x-default` only** — since C3 (`20260825120000_indexnow_news_vi_only.sql`) EN news articles are noindex and out of the sitemap, so `sitemap-news.xml` is 100% VI (919 URLs on 2026-09-04) and has no EN half to point at; do not "restore" it. **tournaments, matches, players, livestreams, videos, organizations emit none, deliberately** — those entities are single-canonical (one URL serves both locales via the SPA language toggle), so `singleCanonicalHreflang()` in `functions/_lib/utils.ts` returns `""` and the sitemaps carry no `xhtml:link`. Google's rule: if only one URL is indexed across all locales, omit hreflang. Adding it back re-triggers Ahrefs' "no return-tag" + "referenced for more than one language" — the exact regression batches 6 and 9 fixed on 2026-05-28. `/vi/org/*`, `/vi/tournament/*` and `/vi/watch/*` additionally 301 to the EN path (`_middleware.ts` rule 1d).

⚠️ **PostgREST caps every response at 1000 rows** and does it silently — `.limit(5000)` returns exactly 1000 rows, HTTP 200, `error = null`. sitemap-news served 500 of 709 EN articles that way for months (fixed 2026-08-23, #644). Any sitemap whose table can pass 1000 rows must use `fetchAllRows()` from `functions/_lib/sitemap-helpers.ts`, with a unique tie breaker in the ORDER BY. news + matches + venues already do, and `functions/__tests__/sitemap-row-cap.test.ts` holds them there; the rest still use a bare `.limit(5000)` and are only safe while they stay under the cap (2026-08-25 counts: blog 68, events 27, livestreams 29, organizations 3, players 40 after its DB-side filters, tournaments 15, videos 6 — versus venues at 896 and growing ~100/month, which is why it was moved).

News URLs are pushed to IndexNow by the `indexnow-news-hourly` pg_cron job (migration `20260823060000`), not by `functions/api/indexnow.ts` — that endpoint covers static routes + blog only.

### News Aggregator (Phase 1-5)

Multi-source pickleball news pipeline:

1. **Fetch:** `workers/news-fetcher/` Cloudflare Worker scrapes/RSS sources on a cron schedule, writes to Supabase `news_items` table
2. **Translate:** `news-translate` edge function calls Google Gemini for EN→VI translations, status tracked in `news_translation_status`
3. **Display:** `/news/:slug` (EN) and `/vi/news/:slug` (VI) routes — page = `src/pages/NewsArticle.tsx`, SSR = `renderNews` in `functions/_lib/render/`
4. **Feed surface:** news items appear in `/feed` Trending via `useFeedNews` hook + `FeedNewsCard` component
5. **Moderation:** admin UI `/admin/news` (page `src/pages/admin/AdminNews.tsx`) with RLS rules in migration `20260519020000_news_admin_rls.sql`

Source migrations: `20260519000000_news_aggregator_phase_1.sql`, `20260519010000_news_translation_status.sql`, `20260519010100_news_translate_rpc_and_cron.sql`.

### Feed Scoring

`/feed` timeline uses Postgres RPCs with progressive scoring:

- `feed_timeline` — base RPC (migration `20260514120000`)
- `feed_timeline_scored` — recency-weighted scoring (migration `20260515100000`)
- `feed_timeline_cluster_diversity` — penalty to demote same-cluster posts in a row (migration `20260515110000`)

Client tracks viewed posts via `useFeedViewedTracking` hook + session shuffle to avoid serving identical orders on refresh.

### Workers (Cloudflare Workers, separate from Pages Functions)

- `workers/news-fetcher/` — scheduled news source ingestion → `news_items`
- `workers/pro-tour-scraper/` — PPA/MLP/APP/PPA Tour Asia scraper, has `__fixtures__` for offline tests
- Legacy `prerender-worker` (deployed standalone, no source in this repo) — still serves production prerender traffic

Each worker has its own `wrangler.toml`. Deploy with `wrangler deploy` from inside the worker directory.

### PWA

`vite-plugin-pwa` config in `vite.config.ts`:

- Service worker is registered **manually** in `src/pwa.ts` (kept manual after the Capacitor retirement — `injectRegister: null` lets us control ordering against the chunk-error recovery)
- Navigation requests use `NetworkFirst` with 3s timeout — `index.html` is **excluded** from precache so users always get the freshest shell after deploy
- Runtime cache rules for Supabase REST/storage, Mux images, Google avatars, Google Fonts — see `vite.config.ts` for full list

### Deployment Verification

When verifying SEO meta tags or schema on production:
- ✅ Use `curl` with Googlebot User-Agent (`curl -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" "https://www.thepicklehub.net/<path>"`)
- ✅ Use Google Rich Results Test
- ❌ DO NOT use Google Search Console URL Inspection Live Test (gives false negatives for schema)

When verifying edge function deployments:
- Code in source ≠ deployed. Always explicitly confirm deploy status.
- Check with `supabase functions list --project-ref ajvlcamxemgbxduhiqrl`
- Or test via HTTP with anon key, observe status code

## Git Workflow

- Production branch: `main` (Cloudflare Pages auto-deploys from main)
- Feature work: create feature branch → push → PR → merge to main
- Feature branches deploy to preview URLs (`<branch>.pickle-hub-pro.pages.dev`), not production
- Hotfix: can merge directly via CLI if needed
- DUPR integration PRs (PR1-PR7, #114-#122) are intentionally held out of main pending design review — do not auto-merge

## Environment Variables

Required in `.env`:
- `VITE_SUPABASE_URL=https://ajvlcamxemgbxduhiqrl.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY=<anon_key>`
- `VITE_SUPABASE_PROJECT_ID=ajvlcamxemgbxduhiqrl`

Optional:
- `VITE_SITE_URL=https://www.thepicklehub.net` (has hardcoded fallback)

## User Roles (DB: `user_roles` table)

- `viewer` — default for all users (~1669 rows)
- `creator` — can create livestreams (2 rows)
- `admin` — full access, including push notifications and news moderation (1 row, thecuong@gmail.com)

Function `mux-create-livestream` checks for role IN ('creator', 'admin').
Function `send-push-notification` verifies the JWT internally and requires the admin role (service-role bearer bypasses for internal cron/webhook calls).

### Admin 2FA (TOTP, since 2026-07-30)

The admin role requires an **aal2 session** (TOTP via Supabase MFA) once the user has a verified factor — self-activating, enforced in `is_admin()`/`has_role()` (migrations `20260730090000` + `20260730100000` sweep) and in admin-privileged edge functions via `_shared/admin-aal.ts`. UI gate: `AdminMFAGate` (wraps `AdminLayout` + `RequireAuth requiredRole="admin"`). Lost authenticator → delete the row in `auth.mfa_factors` to unlock.

## Supabase Edge Functions (82 active — count enforced by `npm run auth:registry`)

Browse: `supabase/functions/`. Categories:

- **User-facing (verify_jwt=false, ES256 workaround):** `mux-create-livestream`, `delete-account`, `send-push-notification`, `invite-team-to-tournament`
- **Authenticated admin (verify_jwt=false, internal role check):** `api-keys-list`, `api-keys-admin-generate`, `api-keys-admin-revoke`
- **Backend-to-backend (service_role only):** `api-keys-generate`, `api-keys-revoke`
- **Public (no auth):** `geo-check`, `og-*` (9 functions: doubles-elimination, flex-tournament, image-club, image-match, image-social-event, live, organization, quick-table, tournament, video), `video-thumbnail-proxy`, `newsletter-subscribe`
- **Event-driven:** `mux-webhook` (Mux → webhook), `send-auth-email` (Supabase Auth Hook), `mark-payment-claimed`
- **Scheduled/internal cron:** `auto-archive-tournaments`, `auto-cancel-unpaid-registrations`, `news-check`, `news-ingest`, `news-translate`, `batch-view-events`, `mux-sync-assets`, `leaderboard-compute`, `match-expire`, `dupr-sync`, `pro-tour-ingest`, `pro-tour-trigger-scrape`, `feed-generate`
- **Domain-specific:** `match-create`, `match-confirm`, `submit-match-score`, `cancel-registration`, `reactivate-registration`, `create-payment-order`, `phone-otp-send`, `phone-otp-verify`, `request-recovery-link`, `dupr-link`, `send-blog-blast`, `notification-send`

## Known Bugs (Not Fixed)

- **B14 — `delete-account` returns success while all 13 of its cleanup steps fail.** 10 × missing `service_role` GRANT (all pre-Shop tables), 2 tables that no longer exist, 1 renamed column. Accounts are deleted only by `ON DELETE CASCADE`; the loop is decorative. 🔴 **Do NOT grant the missing permissions as an isolated fix** — the loop runs before `auth.admin.deleteUser` with no transaction, so granting them turns a harmless no-op into a real partial deletion. Full record: [`docs/defects/b14-delete-account-cleanup-noop.md`](./docs/defects/b14-delete-account-cleanup-noop.md)

## Coding Standards

- **Code output:** Always write complete files for copy-paste. No snippets, no partial diffs. Especially for Cloudflare Worker, Supabase edge functions, config files.
- **Vietnamese comments OK** in code where Cuong is the sole maintainer.
- **Bilingual content:** All user-facing text should have Vietnamese and English translations.
- **Follow existing patterns:** Match the code style of surrounding files. `.legacy.tsx` rollback siblings: all retired as of 2026-08-03 (CLOSE-03 audit — 0 files remain); if one reappears it is a 14-day rollback window — do not edit it unless rolling back.

## Response Style

- **Ngắn gọn, đi thẳng vào trọng tâm.** No preview/recap/summary unless asked.
- **Use Vietnamese** for conversation with Cuong.
- **Use English** for code, commit messages, PR titles.
- **Automation first:** Run CLI commands, curl tests, file ops directly. Don't ask user to run commands manually unless it requires UI interaction.
- **Manual tests:** Only for browser UI verification (login flows, visual checks, user-facing features).
