# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**ThePickleHub** — bilingual Vietnamese-English pickleball platform. Tournament management, livestream, video replay, news aggregator, community feed. Solo-built by Cuong Nguyen. Target audience ~95% Vietnamese.

Website: https://www.thepicklehub.net

## Stack

- **Frontend:** React 18 + TypeScript + Vite + shadcn/ui + Tailwind CSS + vite-plugin-pwa
- **Backend:** Supabase (project ref `ajvlcamxemgbxduhiqrl`)
- **Hosting:** Cloudflare Pages (project `pickle-hub-pro`, production branch `main`) + Cloudflare Workers for scheduled scrapers
- **Mobile:** Capacitor (iOS + Android, app ID `net.thepicklehub.app`)
- **Livestream:** Mux
- **Push:** Firebase Cloud Messaging (FCM via Capacitor)
- **Email:** Resend
- **AI translation:** Google Gemini (EN → VI for news)
- **Analytics:** GA4, Google Search Console, Ahrefs Webmaster Tools

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

Mobile (Capacitor) — see [MOBILE_BUILD_GUIDE.md](./MOBILE_BUILD_GUIDE.md). Common commands:

```sh
npx cap sync ios     # Sync web assets to iOS
npx cap sync android # Sync web assets to Android
npx cap open ios     # Open Xcode
npx cap open android # Open Android Studio
```

## Critical Workflow Notes

### New blog post checklist (EN + VI bilingual)

Every new blog post requires **4 simultaneous changes** in the same push, or bots will 404 / VI won't render / hreflang breaks:

1. `src/content/blog/posts/<slug>.ts` — full BlogPost with content.en AND content.vi
2. `src/content/blog/metadata.ts` — prepend BlogPostMetadata entry at top of array
3. `functions/_lib/render/index.ts` — add row to `BLOG_POST_META` dict (line ~764). Missing = Googlebot/Bingbot get 404 even though SPA renders fine.
4. Supabase `vi_blog_posts` INSERT — VI HTML version with `alternate_en_slug` pointing back to the EN slug. Required for `/vi/blog/<vi-slug>` route + reciprocal hreflang.

After `git push main` and Cloudflare deploy succeeds, **immediately request indexing**:
- Google: open GSC URL Inspection → paste EN URL + VI URL → "Request Indexing". No public Google Indexing API for blog posts (only JobPosting + BroadcastEvent).
- Bing: IndexNow POST via `functions/api/indexnow.ts` (or direct `https://api.indexnow.org/indexnow?url=<URL>&key=<KEY>`). Requires `<KEY>.txt` at root.

Verify via `curl -A "Googlebot"` returning 200 with correct title + og:image + hreflang en/vi/x-default tags before declaring done.

## Critical Architecture Notes

### Supabase JWT ES256/HS256 Workaround

Project `ajvlcamxemgbxduhiqrl` has a platform issue: Auth service issues JWTs signed with ES256 (asymmetric), but Edge Functions gateway verifies with HS256 (symmetric). This causes gateway to reject all valid user JWTs with 401 "Invalid JWT".

**Workaround:** user-facing functions have `verify_jwt = false` in `supabase/config.toml`. They verify JWT internally via `supabase.auth.getUser()` (Auth API handles ES256 correctly).

Key examples: `mux-create-livestream`, `delete-account`, `send-push-notification`, `invite-team-to-tournament`.

**DO NOT** set `verify_jwt = true` on these functions until Supabase fixes the platform mismatch.

### SEO Prerender (Cloudflare Pages Functions)

SEO prerendering for bot crawlers is handled by `functions/_middleware.ts` + `functions/_lib/render/`, NOT by Supabase edge functions.

- Cache key: **`pr:v6:${pathname}`** in KV namespace `PRERENDER_CACHE` (bump version when changing SSR output to invalidate stale HTML)
- Per-route handlers: `renderBlog`, `renderViBlog`, `renderTournament`, `renderMatch` (`match-seo.ts`), `renderSocialEvent`, `renderRankings`, `renderLive`, `renderNews`, etc.
- `BLOG_POST_META` dict in `functions/_lib/render/index.ts` is the SSR truth table for blog posts — missing entry = bot 404

The legacy `prerender-worker` Cloudflare Worker is still active and **MUST be preserved**. It serves production traffic for thepicklehub.net.

### Sitemaps (split, bilingual hreflang)

Root `/sitemap.xml` is a sitemap index served by `functions/sitemap.xml.ts` referencing segment sitemaps:

- `sitemap-static.xml`, `sitemap-blog.xml`, `sitemap-tournaments.xml`, `sitemap-matches.xml`, `sitemap-events.xml`, `sitemap-news.xml`
- `sitemap-players.xml` and `sitemap-venues.xml` exist but are **currently disabled** in the index (see comments in `sitemap.xml.ts` re Ahrefs orphan URL fixes — re-enable when directory pages ship)

All segments support `xhtml:link` hreflang (en, vi, x-default).

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

- Service worker is registered **manually** in `src/pwa.ts` so we can skip registration inside Capacitor native WebView (mobile app uses live remote URL, not a precached shell)
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
Function `send-push-notification` requires authenticated user but no specific role check (UI gates by admin role).

## Supabase Edge Functions (51 active)

Browse: `supabase/functions/`. Categories:

- **User-facing (verify_jwt=false, ES256 workaround):** `mux-create-livestream`, `delete-account`, `send-push-notification`, `invite-team-to-tournament`
- **Authenticated admin (verify_jwt=false, internal role check):** `api-keys-list`, `api-keys-admin-generate`, `api-keys-admin-revoke`
- **Backend-to-backend (service_role only):** `api-keys-generate`, `api-keys-revoke`
- **Public (no auth):** `geo-check`, `og-*` (9 functions: doubles-elimination, flex-tournament, image-club, image-match, image-social-event, live, organization, quick-table, tournament, video), `sitemap` (legacy — Cloudflare Pages handles production), `video-thumbnail-proxy`, `newsletter-subscribe`
- **Event-driven:** `mux-webhook` (Mux → webhook), `send-auth-email` (Supabase Auth Hook), `mark-payment-claimed`
- **Scheduled/internal cron:** `auto-archive-tournaments`, `auto-cancel-unpaid-registrations`, `news-check`, `news-ingest`, `news-translate`, `batch-view-events`, `mux-sync-assets`, `leaderboard-compute`, `match-expire`, `dupr-sync`, `pro-tour-ingest`, `pro-tour-trigger-scrape`, `feed-generate`
- **Domain-specific:** `match-create`, `match-confirm`, `submit-match-score`, `cancel-registration`, `reactivate-registration`, `create-payment-order`, `phone-otp-send`, `phone-otp-verify`, `request-recovery-link`, `dupr-link`, `send-blog-blast`, `notification-send`

## Known Bugs (Not Fixed)

1. **Admin push notification "send to all users":** Frontend queries `push_tokens` with user JWT, RLS only returns admin's own tokens. Broadcast silently under-delivers. Fix: use service_role or query `profiles` directly. Location: `src/pages/admin/AdminPushNotification.tsx`.

2. **Admin push notification missing confirm dialog:** Admin can accidentally spam notifications to all users with no confirmation step. UX risk.

3. **Red5 DB columns residual:** `livestreams.red5_server_url` and `livestreams.red5_stream_name` columns still exist in schema despite Red5 being retired. Nullable, non-functional. Cleanup requires migration to DROP COLUMN + regenerate types.

## Coding Standards

- **Code output:** Always write complete files for copy-paste. No snippets, no partial diffs. Especially for Cloudflare Worker, Supabase edge functions, config files.
- **Vietnamese comments OK** in code where Cuong is the sole maintainer.
- **Bilingual content:** All user-facing text should have Vietnamese and English translations.
- **Follow existing patterns:** Match the code style of surrounding files. Many pages have `.legacy.tsx` siblings used for 14-day rollback windows — do not edit legacy files unless rolling back.

## Response Style

- **Ngắn gọn, đi thẳng vào trọng tâm.** No preview/recap/summary unless asked.
- **Use Vietnamese** for conversation with Cuong.
- **Use English** for code, commit messages, PR titles.
- **Automation first:** Run CLI commands, curl tests, file ops directly. Don't ask user to run commands manually unless it requires UI interaction.
- **Manual tests:** Only for browser UI verification (login flows, visual checks, user-facing features).
