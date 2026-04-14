# CLAUDE.md

Project guide for AI assistants (Claude Code, Cowork, etc.) working on ThePickleHub.

## Project

**ThePickleHub** — bilingual Vietnamese-English pickleball platform. Tournament management, livestream, video replay, news, community. Solo-built by Cuong Nguyen. Target audience ~95% Vietnamese.

Website: https://www.thepicklehub.net

## Stack

- **Frontend:** React 18 + TypeScript + Vite + shadcn/ui + Tailwind CSS
- **Backend:** Supabase (project ref `ajvlcamxemgbxduhiqrl`)
- **Hosting:** Cloudflare Pages (project `pickle-hub-pro`, production branch `main`)
- **Mobile:** Capacitor (iOS + Android)
- **Livestream:** Mux
- **Push:** Firebase Cloud Messaging
- **Email:** Resend
- **Analytics:** GA4, Google Search Console, Ahrefs Webmaster Tools

## Critical Architecture Notes

### Supabase JWT ES256/HS256 Workaround

Project `ajvlcamxemgbxduhiqrl` has a platform issue: Auth service issues JWTs signed with ES256 (asymmetric), but Edge Functions gateway verifies with HS256 (symmetric). This causes gateway to reject all valid user JWTs with 401 "Invalid JWT".

**Workaround:** 4 user-facing functions have `verify_jwt = false` in `supabase/config.toml`:
- `mux-create-livestream`
- `delete-account`
- `send-push-notification`
- `invite-team-to-tournament`

These functions verify JWT internally via `supabase.auth.getUser()` (Auth API handles ES256 correctly).

**DO NOT** set `verify_jwt = true` on these functions until Supabase fixes the platform mismatch.

### SEO Prerender

SEO prerendering for bot crawlers is handled by **Cloudflare Pages Functions** (`functions/_middleware.ts` + `functions/_lib/render/`), NOT by Supabase edge functions. Cache key prefix: `pr:v1:` in KV namespace `PRERENDER_CACHE`.

The legacy `prerender-worker` Cloudflare Worker is still active and MUST be preserved. It serves production traffic for thepicklehub.net.

### Sitemap

Sitemap at `/sitemap.xml` is served by `functions/sitemap.xml.ts` (Cloudflare Pages Function), NOT by Supabase function. Supports bilingual hreflang (en, vi, x-default).

### Deployment Verification

When verifying SEO meta tags or schema on production:
- ✅ Use `curl` with Googlebot User-Agent
- ✅ Use Google Rich Results Test
- ❌ DO NOT use Google Search Console URL Inspection Live Test (gives false negatives for schema)

When verifying edge function deployments:
- Code in source ≠ deployed. Always explicitly confirm deploy status.
- Check with `supabase functions list --project-ref ajvlcamxemgbxduhiqrl`
- Or test via HTTP with anon key, observe status code

## Git Workflow

- Production branch: `main` (Cloudflare Pages auto-deploys from main)
- Feature work: create feature branch → push → PR → merge to main
- Feature branches deploy to preview URLs (`.pickle-hub-pro.pages.dev`), not production
- Hotfix: can merge directly via CLI if needed

## Environment Variables

Required in `.env`:
- `VITE_SUPABASE_URL=https://ajvlcamxemgbxduhiqrl.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY=<anon_key>`

Optional:
- `VITE_SITE_URL=https://www.thepicklehub.net` (has hardcoded fallback)

## User Roles (DB: `user_roles` table)

- `viewer` — default for all users (1669 rows)
- `creator` — can create livestreams (2 rows)
- `admin` — full access, including push notifications (1 row, thecuong@gmail.com)

Functions `mux-create-livestream` check for role IN ('creator', 'admin').
Function `send-push-notification` requires authenticated user but no specific role check.

## Supabase Edge Functions (25 active)

**User-facing (verify_jwt=false due to ES256 workaround):**
- `mux-create-livestream`, `delete-account`, `send-push-notification`, `invite-team-to-tournament`

**Authenticated admin (verify_jwt=false, internal role check):**
- `api-keys-list`, `api-keys-admin-generate`, `api-keys-admin-revoke`

**Backend-to-backend (service_role only):**
- `api-keys-generate`, `api-keys-revoke`

**Public (no auth):**
- `geo-check`, `og-*` (7 functions: doubles-elimination, flex-tournament, live, organization, quick-table, tournament, video)
- `sitemap` (legacy, Cloudflare Pages handles the production one)

**Event-driven:**
- `mux-webhook` (Mux → webhook)
- `send-auth-email` (Supabase Auth Hook)

**Scheduled/internal:**
- `auto-archive-tournaments`, `news-check`, `news-ingest`, `batch-view-events`, `mux-sync-assets`

## Known Bugs (Not Fixed)

1. **Admin push notification "send to all users":** Frontend queries `push_tokens` with user JWT, RLS only returns admin's own tokens. Broadcast silently under-delivers. Fix: use service_role or query `profiles` directly. Location: `src/pages/admin/AdminPushNotification.tsx`.

2. **Admin push notification missing confirm dialog:** Admin can accidentally spam notifications to all users with no confirmation step. UX risk.

3. **Red5 DB columns residual:** `livestreams.red5_server_url` and `livestreams.red5_stream_name` columns still exist in schema despite Red5 being retired. Nullable, non-functional. Cleanup requires migration to DROP COLUMN + regenerate types.

## Coding Standards

- **Code output:** Always write complete files for copy-paste. No snippets, no partial diffs. Especially for Cloudflare Worker, Supabase edge functions, config files.
- **Vietnamese comments OK** in code where Cuong is the sole maintainer.
- **Bilingual content:** All user-facing text should have Vietnamese and English translations.
- **Follow existing patterns:** Match the code style of surrounding files.

## Response Style

- **Ngắn gọn, đi thẳng vào trọng tâm.** No preview/recap/summary unless asked.
- **Use Vietnamese** for conversation with Cuong.
- **Use English** for code, commit messages, PR titles.
- **Automation first:** Run CLI commands, curl tests, file ops directly. Don't ask user to run commands manually unless it requires UI interaction.
- **Manual tests:** Only for browser UI verification (login flows, visual checks, user-facing features).
