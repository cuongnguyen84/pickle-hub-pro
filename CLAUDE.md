# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**ThePickleHub** — bilingual Vietnamese-English pickleball platform. Tournament management, livestream, video replay, news, community. Solo-built by Cuong Nguyen. Target audience ~95% Vietnamese.

Website: https://www.thepicklehub.net

## Stack

- **Frontend:** React 18 + TypeScript + Vite + shadcn/ui + Tailwind CSS
- **Backend:** Supabase (project ref `ajvlcamxemgbxduhiqrl`)
- **Hosting:** Cloudflare Pages (project `pickle-hub-pro`, production branch `main`)
- **Mobile:** Capacitor (iOS + Android, App ID: `net.thepicklehub.app`)
- **Livestream:** Mux
- **Push:** Firebase Cloud Messaging
- **Email:** Resend
- **Analytics:** GA4, Google Search Console, Ahrefs Webmaster Tools

## Commands

```sh
npm run dev          # Dev server on port 8080
npm run build        # Production build
npm run build:dev    # Dev build with source maps
npm run lint         # ESLint check
npm run preview      # Preview production build locally
npm run test         # Run tests once (vitest)
npm run test:watch   # Run tests in watch mode
```

Run a single test file:
```sh
npx vitest run src/lib/social/__tests__/feed-formatters.test.ts
```

Deploy Supabase edge function:
```sh
supabase functions deploy <function-name> --project-ref ajvlcamxemgbxduhiqrl
supabase functions list --project-ref ajvlcamxemgbxduhiqrl
```

Verify SEO prerender (always use Googlebot UA, not browser):
```sh
curl -A "Googlebot/2.1" https://www.thepicklehub.net/tournament/<slug>
bash scripts/seo-verify.sh
```

## Architecture

### Routing: Bilingual URL Structure

Routes exist in two parallel trees — English (default) and Vietnamese (`/vi/*`):
- `/tournaments` ↔ `/vi/giai-dau` (bilingual slug pairs)
- `/live` ↔ `/vi/truc-tiep`
- Player profiles: `/nguoi-choi/:username` and `/u/:slug`

All `/vi/*` routes are wrapped in `<ViLanguageWrapper>` (`src/components/layout/ViLanguageWrapper.tsx`), which sets the i18n context and `<html lang>` to `"vi"` while mounted.

**`@/` alias** resolves to `src/`. All imports use this alias.

### I18n

`src/i18n/` — `I18nProvider` detects language by: (1) URL prefix `/vi/`, (2) localStorage, (3) sessionStorage geo-cache, (4) default English. Translations live in `src/i18n/vi.ts` and `src/i18n/en.ts`. Access via `const { t, language } = useI18n()`.

### Data Layer

- **Supabase client:** `src/integrations/supabase/client.ts` — import as `import { supabase } from "@/integrations/supabase/client"`
- **Generated types:** `src/integrations/supabase/types.ts` — do not edit manually
- **TanStack Query** for all server state; hooks live in `src/hooks/`
- **Auth context:** `useAuth()` from `src/hooks/useAuth.tsx` — provides `user`, `session`, `loading`, `signIn`, `signOut`

### SEO Prerendering

Bot crawlers are intercepted in **`functions/_middleware.ts`** (Cloudflare Pages Function). The middleware:
1. Detects bots via UA string
2. Calls render functions in `functions/_lib/render/` to build full HTML with JSON-LD schema + Open Graph tags
3. Caches HTML in KV namespace `PRERENDER_CACHE` (key prefix `pr:v1:`)
4. Falls through to the SPA for real users

React components in `src/components/seo/` handle client-side meta tags for non-bot paths.

**Critical:** Prerendering lives in Cloudflare Pages Functions — NOT in Supabase edge functions. The legacy `prerender-worker` Cloudflare Worker at `workers/` must be preserved; it serves production traffic.

### Sitemap

`/sitemap.xml` → `functions/sitemap.xml.ts` (Cloudflare Pages Function). Bilingual hreflang (`en`, `vi`, `x-default`). Additional per-type sitemaps: `sitemap-tournaments.xml.ts`, `sitemap-blog.xml.ts`, etc.

### Supabase Edge Functions

Located in `supabase/functions/`. All have `verify_jwt = false` in `supabase/config.toml` due to ES256/HS256 platform mismatch (see below). Functions verify auth internally via `supabase.auth.getUser()`.

**DO NOT** set `verify_jwt = true` on any function until Supabase resolves the ES256/HS256 mismatch on project `ajvlcamxemgbxduhiqrl`.

Function groupings:
- **User-facing:** `mux-create-livestream`, `delete-account`, `send-push-notification`, `invite-team-to-tournament`
- **Admin (internal role check):** `api-keys-list`, `api-keys-admin-generate`, `api-keys-admin-revoke`
- **Public OG images:** `og-*` (7 functions)
- **Event-driven:** `mux-webhook`, `send-auth-email`
- **Scheduled:** `auto-archive-tournaments`, `news-check`, `news-ingest`, `batch-view-events`, `mux-sync-assets`
- **Shared code:** `supabase/functions/_shared/`

### Mobile (Capacitor)

`capacitor.config.ts` — iOS and Android targets. See `MOBILE_BUILD_GUIDE.md` for build steps. PWA service worker (`src/pwa.ts`) skips registration inside the Capacitor WebView. Swipe navigation is handled in `src/hooks/useSwipeNavigation.ts`.

### User Roles

DB table: `user_roles`
- `viewer` — default
- `creator` — can create livestreams
- `admin` — full access (`thecuong@gmail.com`)

## Critical Architecture Notes

### Supabase JWT ES256/HS256 Workaround

Project `ajvlcamxemgbxduhiqrl` has a platform bug: Auth issues ES256 JWTs but the Edge Functions gateway verifies with HS256, causing all valid user tokens to 401. All edge functions use `verify_jwt = false` and call `supabase.auth.getUser()` internally instead.

### Legacy Pages

Several pages have `.legacy.tsx` variants (e.g., `Index.legacy.tsx`, `Blog.legacy.tsx`). These are accessible at `/legacy` routes for rollback and are safe to keep; they do not affect production traffic.

## Deployment Verification

```sh
# Verify edge function is deployed (source ≠ deployed)
supabase functions list --project-ref ajvlcamxemgbxduhiqrl

# Verify SEO prerender output
curl -A "Googlebot/2.1" https://www.thepicklehub.net/<path>

# DO NOT use Google Search Console URL Inspection Live Test — gives false negatives for schema
# Use: curl with Googlebot UA, or Google Rich Results Test
```

## Git Workflow

- Production branch: `main` (Cloudflare Pages auto-deploys)
- Feature branches deploy to preview URLs (`*.pickle-hub-pro.pages.dev`)
- Hotfix: can merge directly via CLI

## Environment Variables

Required in `.env`:
```
VITE_SUPABASE_URL=https://ajvlcamxemgbxduhiqrl.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon_key>
```
Optional: `VITE_SITE_URL=https://www.thepicklehub.net` (hardcoded fallback exists)

## Known Bugs (Not Fixed)

1. **Admin push "send to all users":** RLS on `push_tokens` only returns admin's own tokens via user JWT. Broadcast silently under-delivers. Fix: use service_role. Location: `src/pages/admin/AdminPushNotification.tsx`.
2. **Admin push missing confirm dialog:** No confirmation before broadcasting to all users.
3. **Red5 DB columns:** `livestreams.red5_server_url` and `livestreams.red5_stream_name` still exist (nullable, non-functional). Cleanup requires DROP COLUMN migration + type regen.

## Coding Standards

- **Bilingual content:** All user-facing text needs Vietnamese and English translations in `src/i18n/vi.ts` + `src/i18n/en.ts`.
- **Vietnamese comments OK** in code — Cuong is the sole maintainer.
- **Follow existing patterns:** Match the surrounding file's style.
- **Complete files only:** For Cloudflare Workers, Supabase edge functions, and config files, write the full file — not partial diffs.

## Response Style

- **Ngắn gọn, đi thẳng vào trọng tâm.** No preview/recap/summary unless asked.
- **Use Vietnamese** for conversation. **Use English** for code, commits, PR titles.
- **Automation first:** Run CLI commands, curl tests, file ops directly. Don't ask user to run commands manually unless UI interaction is required.
