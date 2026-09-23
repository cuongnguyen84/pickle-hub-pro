# Recon: CodeQL backlog (28 open alerts)

Source: `gh api repos/cuongnguyen84/pickle-hub-pro/code-scanning/alerts?state=open&per_page=100`
(28 total confirmed via `--jq 'length'`). Repo: `cuongnguyen84/pickle-hub-pro`.

**Correction to the brief:** 7 alerts are rule `js/stack-trace-exposure`, but only
**4 of those 7 are Supabase edge functions** (`supabase/functions/`) — the other 3 are
Cloudflare Worker source files under `workers/*/src/index.ts`, which are a separate
deploy surface (not `supabase/config.toml`-gated, no `verify_jwt`).

## Alert table

| # | rule | file:line | surface |
|---|------|-----------|---------|
| 48 | js/stack-trace-exposure | `supabase/functions/pro-tour-ingest/index.ts:495` (sink; source at :158) | edge fn, `verify_jwt=false`, backend-to-backend (called by pro-tour-scraper worker w/ HMAC, not public UI) |
| 36 | js/stack-trace-exposure | `workers/social-poster/src/index.ts:730` | Cloudflare Worker, not an edge function |
| 35 | js/stack-trace-exposure | `workers/secret-sync/src/index.ts:254` | Cloudflare Worker |
| 21 | js/stack-trace-exposure | `workers/pro-tour-scraper/src/index.ts:643` | Cloudflare Worker |
| 20 | js/stack-trace-exposure | `supabase/functions/send-blog-blast/index.ts:556` (source :544) | edge fn, `verify_jwt=false`, called from Supabase webhook/admin, not anonymous-public |
| 18 | js/stack-trace-exposure | `supabase/functions/news-translate/index.ts:390` (source :140-143) | edge fn, `verify_jwt=false`, cron/internal (`news-check` → `news-translate`) |
| 17 | js/stack-trace-exposure | `supabase/functions/_shared/auth.ts:56` (3 flows — sources: `dupr-webhook-test-fire/index.ts:135`, `dupr-partner-token/index.ts:52`, `dupr-webhook-register/index.ts:77`) | shared helper used by **37 functions**; the 3 actual leaking call sites are DUPR admin/test-fire endpoints |
| 47/46/45 | js/incomplete-multi-character-sanitization | `functions/_lib/utils.ts:225-227` (`on*=` attr stripper, 3 regex variants) | Cloudflare Pages Function (SSR/prerender lib), not edge fn |
| 5 | js/incomplete-multi-character-sanitization | `supabase/functions/send-blog-blast/index.ts:59` (`<script` strip) | edge fn |
| 8/7/6 | js/incomplete-multi-character-sanitization | `workers/news-fetcher/src/index.ts:444` (`<style`/`<script` strip) | Worker |
| 9 | js/bad-tag-filter | `workers/news-fetcher/src/index.ts:446` (`</script >` regex) | Worker |
| 2 | js/double-escaping | `workers/news-fetcher/src/index.ts:444` (`&` re-escape) | Worker |
| 23 | js/incomplete-url-substring-sanitization | `src/lib/url-utils.ts:12` (`googleusercontent.com` includes-check) | frontend |
| 22 | js/incomplete-url-substring-sanitization | `functions/_lib/utils.ts:92` (same check, duplicated) | Pages Function |
| 16/15 | js/xss-through-dom | `AdminViBlogEditor.tsx:400` (src input `slug` state → `<a href>` at L400), `:295` (`coverImageUrl` input → `<img src>`) | frontend, admin-only page |
| 14 | js/xss-through-dom | `EditLivestreamDialog.tsx:115` (`thumbnailUrl` input → `<img src>`) | frontend, admin-only |
| 13 | js/insecure-randomness | `CreateGhostProfileModal.tsx:149` (`Math.random()` feeding username-candidate generation) | frontend |
| 12 | js/insecure-randomness | `ProfileSetup.tsx:247` (same `Math.random()` pattern) | frontend |
| 11/10 | js/incomplete-sanitization | `supabase/functions/dupr-user-search/index.ts:156` (ILIKE escape misses `\`) | edge fn |
| 24 | js/overly-large-range | `src/lib/auth/safeRedirect.ts:35` (`/[ -\s]/` char class) | frontend |
| 4 | js/incomplete-multi-character-sanitization | `src/lib/pro-tour/adapters/mlp-event-scraper.ts:543` (`<script` strip) | frontend/scraper lib |
| 1 | js/tainted-format-string | `src/content/blog/index.ts:36` (`console.error` template with `slug`) | frontend, log-only sink |

## Prior art

- **No shared "safe error response" helper exists.** The `json`/`jsonResponse` sink pattern
  (`return new Response(JSON.stringify(body), {status, headers})`) is copy-pasted verbatim in
  at least 6 places: `supabase/functions/pro-tour-ingest/index.ts:494`,
  `supabase/functions/news-translate/index.ts:389`, `supabase/functions/_shared/auth.ts:55`,
  `workers/social-poster/src/index.ts:729`, `workers/secret-sync/src/index.ts:253`,
  `workers/pro-tour-scraper/src/index.ts:642`. Each independently does
  `err instanceof Error ? err.message : String(err)` then puts `msg` straight in the body.
- `supabase/functions/_shared/client-errors.ts` has a `sanitizeClientErrorUrl` /
  `text()` truncation pattern but it's purpose-built for ingesting *client-reported* errors
  into `client_errors` table (via `log-client-event`), not for sanitizing outgoing
  error responses. Nearest existing convention, not directly reusable.
- `normalizeImageUrl`'s `googleusercontent.com` substring check is duplicated in two
  files (`src/lib/url-utils.ts` and `functions/_lib/utils.ts`) — same alert, same bug, not shared.
- `.github/workflows/security.yml` — CodeQL job (`javascript-typescript`, autobuild)
  runs on PR to main, push to main, and weekly cron (Mon 03:00 UTC). No CodeQL config file
  (`.github/codeql/*.yml`) anywhere in the repo — default query pack, no path exclusions,
  no alert dismissals/suppressions found (checked `.github/` for `dismiss`/`suppress`/`ignore`).

## Constraints found

- **CLAUDE.md — ES256/HS256 workaround:** ALL edge functions have `verify_jwt = false`
  (confirmed: every `[functions.*]` block in `supabase/config.toml` sets it), so
  "public" vs "internal" is **not** determined by that flag — it's determined by which
  functions do their own internal auth check vs none. Do NOT flip any `verify_jwt` to true.
- **BE-03 (memory, done):** all edge functions pinned to `supabase-js@2.89.0` — confirmed,
  `grep supabase-js@ supabase/functions/*/index.ts | sort -u` returns exactly one version.
- **Deploy-guard (`.github/workflows/deploy-guard.yml:60-66`):** any diff under
  `supabase/functions/_shared/**` triggers "redeploying ALL functions" — touching
  `_shared/auth.ts` (used by 37 functions, includes alert #17) redeploys the entire
  edge-function fleet on merge to main, not just the touched function.
- CLAUDE.md lists `send-blog-blast`, `news-translate` as "Event-driven"/"Scheduled/internal
  cron" category, not "Public (no auth)" — matches finding above that the stack-trace-exposure
  alerts are mostly not on the anonymous-public surface the brief assumed.

## Test coverage today

- `supabase/functions/_shared/__tests__/` covers `auth.ts` indirectly via
  `payment-handlers.test.ts`, `dupr-webhook-handler.test.ts`, `send-push-handler.test.ts`,
  `dupr-validation.test.ts`, `token-crypto.test.ts`, `cron-health.test.ts`, `dupr-parser.test.ts`
  — none assert on response body shape/error-message redaction.
- No test found asserting an edge function response does NOT contain `err.message`/stack text.
- `pgtap.yml`, `edge-auth-parity.yml` workflows exist but scope is auth/RLS parity, not
  error-body content.

## Unknowns worth asking Cuong

- 3 of the "7 public edge function" stack-trace alerts are actually Cloudflare Workers
  (separate deploy path, no `supabase/config.toml`) — confirm whether backlog scope is
  edge functions only or includes `workers/*`.
- `_shared/auth.ts:56` is shared by 37 functions; touching it forces a full-fleet redeploy
  per `deploy-guard.yml` — confirm that's acceptable for this backlog item vs fixing only
  the 3 leaking call sites in place.
