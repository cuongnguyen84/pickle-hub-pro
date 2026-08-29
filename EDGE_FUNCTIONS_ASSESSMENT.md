# Supabase Edge Functions — Security & Code Quality Assessment

**Scope:** `/Users/cm10/pickle-hub-pro/supabase/functions` (80 deployed edge functions + `_shared/`)
**Date:** 2026-08-09
**Method:** full read of ~30 function entry points across all domains (dupr, og, news, match, api, send, ops, mux, phone, feed, pro, payment, notifications), all shared modules, `auth-registry.json`, the registry drift-check script, `supabase/config.toml`, plus targeted greps across all 80 functions.

---

## Overall Score: **8 / 10**

Strong security baseline: uniform fail-closed authentication, centralized crypto for third-party tokens, an automated auth-registry drift guard, and rate limiting on every sensitive flow. The gap to 10 is consistency — non-uniform validation, unbounded request bodies on most endpoints, CORS wildcards on admin surfaces, and no dependency lockfile.

---

## 1. Security Issues & Findings

### High (actionable, but not exploitable as-shipped)

**S-1. Wildcard CORS on every function, including admin surfaces.**
Every function returns `Access-Control-Allow-Origin: *` (13 presets in `_shared/cors.ts`, all `*`). Impact is *limited* because auth is carried in the `Authorization` header (not cookies), so this is not a classic CSRF hole. But admin functions (`api-keys-admin-generate`, `api-keys-admin-revoke`, `api-keys-list`, `send-push-notification`, `dupr-match-submit`, `news-rewrite`) should restrict origins to the app domain as defense-in-depth.

**S-2. Unbounded `req.json()` on most endpoints.**
Only **5 of 80** functions enforce a body-size limit: `batch-view-events`, `dupr-webhook` (`readBoundedBody` in `./security.ts`), `feed-generate`, `log-client-event`, `video-thumbnail-proxy`. Every other POST (`match-proposal`, `dupr-sso-callback`, `news-check`, `mark-payment-claimed`, `add-registration-direct`, etc.) parses the full body with no cap. A malicious client can exhaust function memory (request-body DoS). Mitigation is one shared bounded-body helper.

**S-3. `og-*` functions (11) read data with the service role and no auth.**
`og-tournament`, `og-image-match`, `og-image-player`, `og-doubles-elimination`, etc. create a service-role client and fetch by `slug` with zero credential checks (only a user-agent crawler check on `og-tournament`). These are public OG endpoints so the data is public anyway, but routing them through the service role means a malformed input is one slug collision away from leaking internal fields, and there's no rate limiting on an expensive Satori/image-render path. Prefer RLS-safe reads or the anon key.

**S-4. `SUPABASE_SERVICE_ROLE_KEY` used as a shared secret.**
`api-keys-generate`, `api-keys-revoke` and `notification-send` compare the presented bearer token byte-for-byte against `SUPABASE_SERVICE_ROLE_KEY`. This means anyone holding the service key can mint API keys, and the service key is also the platform's own credential — conflating "caller identity" with "platform secret." Consider a dedicated per-tenant secret with a hash lookup (as `news-check`/`news-ingest` already do correctly via `api_keys` table SHA-256 hashes).

**S-5. `delete-account` implements its own auth rather than using `_shared/auth.ts`.**
It's correct (verifies `auth.getUser()` with the user's token before service-role cleanup) but is the only function that hand-rolls this instead of using `getAuthUser()`; it also returns raw `error.message` to the client and has no rate limit, so it's a good target for consolidation + throttling.

### Low / by-design (monitored)

- **L-1. `social-caption` / `news-social-caption`** share `SOCIAL_POSTER_SECRET` via `X-Auth-Secret` (fail-closed, but a static shared secret — rotate-able, no expiry).
- **L-2. `dupr-webhook`** has no DUPR signature to verify (clientId is public by design); it mitigates by re-fetching authoritative rating from the partner API. Documented and reasonable.
- **L-3. `match-proposal`** reads `body.team_a_player_ids as string[]`, `body.team_a_scores as number[]` without type validation (see C-4).
- **L-4.** Vietnamese-language comments embedded in code (e.g., `errors-telegram-alert` "Nút hành động…") — not a security issue, but a maintenance hygiene item.

---

## 2. Code Quality / Consistency Issues

**C-1. No `deno.lock`** anywhere in the repo. All 80 functions import unpinned remote deps (`https://esm.sh/@supabase/supabase-js@2.89.0` mostly, plus `npm:@vercel/og@0.6.5`, `npm:react@18.3.1`). Without a lockfile, transitive supply-chain drift is invisible. Recommend `deno task bundle`/lockfile + CI integrity check.

**C-2. No validation library.** Zero `zod` (or similar) usage. Every function hand-rolls `as`-casts, regexes, and `Number()` coercion with slightly different error vocabularies. A shared `validation.ts` (or zod in `_shared/`) would remove an entire class of drift.

**C-3. CORS-preset proliferation.** `cors.ts` exports ~13 presets that mostly differ in name only (all `*`). This looks like an attempt to encode intent but adds confusion. Collapse to 2–3 real presets (public, cron, webhook).

**C-4. Response-shape inconsistency.**
- `{ error, code, details? }` — the modern `_shared` style (most functions)
- `{ error: "Missing authorization header" }` — plain string, no `code` (`delete-account`)
- `{ success: true, message, warnings }` — `delete-account`
- `{ ok: true, cancelled_count, errors }` — `auto-cancel-unpaid-registrations`
- raw `Response` strings — some legacy paths

Unify on one error envelope (error/code/details) plus one success envelope.

**C-5. Duplicated logic instead of reuse.** `match-proposal` **inlines `mintPartnerToken`** with the explicit comment *"inlined to avoid touching _shared"* while `_shared/dupr-client.ts` already has `partnerFetch`/`getDuprEnv`. This is the documented codebase philosophy violated in practice. Should call `_shared/dupr-client.ts`.

**C-6. Testability is uneven.** The Deno-free `handler.ts` pattern (business logic, no Deno imports, vitest-covered) exists in only **4** of 80 functions (`create-payment-order`, `dupr-webhook`, `mark-payment-claimed`, `send-push-notification`). The other 76 mix Deno transport + logic in `index.ts`, which is untested. 11 test suites exist but only under `_shared/__tests__/`.

**C-7. Inconsistent documentation depth.** Modern functions carry excellent header contracts (auth model, secrets, idempotency notes, DUPR spec citations). `delete-account` and `send-blog-blast` predate that style and have minimal/inconsistent headers.

**C-8. No per-function rate limits.** Rate limiting exists where it matters (OTP 3/15min, recovery-link 5/24h, `log-client-event` 60/120 per 10min, `batch-view-events` 120/600, `newsletter-subscribe` IP-hash), but is ad hoc rather than a shared `_shared/rate-limit.ts` — so new functions can silently ship without it.

---

## 3. Strengths

- **Auth-registry drift guard** (`auth-registry.json` + `scripts/check-edge-auth-registry.mjs`): every function's auth model is declared and machine-verified against `config.toml`. Current state: `80 source / 80 registry / 80 config — 0 errors, 0 warnings`. This is genuinely best-in-class.
- **Uniform internal JWT verification.** Because the gateway sets `verify_jwt = false` (ES256/HS256 workaround), every function that needs a user calls `getAuthUser()` (`_shared/auth.ts`) → `auth.getUser()` internally. Sampled 21 such functions; all correct.
- **Fail-closed webhook auth everywhere sampled:** Mux (HMAC + 5-min timestamp tolerance), Supabase Auth Hook HMAC (`send-auth-email`), cron secret (`requireCronRequest`, 15 functions), `x-webhook-secret` for Mailchimp blast, and `send-blog-blast` refuses to run (503) when the secret is unset — including a documented fix for a past open-trigger bug.
- **Crypto done right:** `token-crypto.ts`/`dupr-token-keyring.ts` (AES-256-GCM envelope + keyring + AAD, with `TOKEN_ENCRYPTION_ROLLOUT.md`), hashed OTPs with constant-time compare, SHA-256-hashed API keys.
- **Rate limiting + idempotency on sensitive flows** (OTP, recovery links, dedup keys in `feed-generate`/`pro-tour-ingest`, `ON CONFLICT DO NOTHING`).
- **Defense-in-depth on DUPR compliance** documented explicitly (`dupr-match-submit` gating: global admin OR `is_club_organizer`, entitlements check, no "confirmed opponent" bypass).
- **Consistent production hygiene:** JSON-structed logging (`logEvent`), Vietnamese/English dual copy support, thorough per-function header docs.

---

## 4. Prioritized Recommendations

| # | Priority | Action | Where |
|---|----------|--------|-------|
| 1 | **High** | Add a shared bounded-body reader (`readBoundedBody`) and apply to every `req.json()` call site | `_shared/`, all POST handlers |
| 2 | **High** | Introduce a shared `validation.ts` (zod or similar) and migrate the hand-rolled `as`-casts (`match-proposal` payloads, `dupr-sso-callback`, `news-*`) | `_shared/`, high-risk handlers |
| 3 | **High** | Add `deno.lock` + CI integrity check for the functions bundle | repo root / CI |
| 4 | **Med** | Replace service-key-as-shared-secret in `api-keys-generate/revoke` + `notification-send` with the hashed `api_keys` pattern `news-check` already uses | those 3 functions |
| 5 | **Med** | Restrict CORS to the app origin on admin functions (`api-keys-admin-*`, `api-keys-list`, `send-push-notification`, `dupr-match-submit`, `news-rewrite`) | `cors.ts` + those functions |
| 6 | **Med** | Delete the inlined `mintPartnerToken` in `match-proposal` and route through `_shared/dupr-client.ts` | `match-proposal/index.ts:689` |
| 7 | **Med** | Unify response envelopes (`{error, code, details}` / `{ok, data}`) and document in `_shared/README` | all functions |
| 8 | **Low** | Promote the `handler.ts` Deno-free pattern (with vitest) to the next 5–10 highest-risk functions (match flows, payments, dupr) | functions |
| 9 | **Low** | Add a shared `rate-limit.ts` helper so new functions get throttling by default | `_shared/` |
| 10 | **Low** | Backfill header-doc style + JSON logging to the 4–5 legacy functions (`delete-account`, `send-blog-blast`) | those functions |

---

## Appendix A — Auth model census (grep-verified across all 80)

| Pattern | Count | Functions |
|---------|-------|-----------|
| `getAuthUser` (internal JWT via `auth.getUser()`) | 21 | dupr/match/api/admin/notification/news-rewrite/og-tournament etc. |
| `requireCronRequest` (x-cron-secret, fail-closed) | 15 | feed-generate, ops-job-control, zalo-token-refresh, auto-cancel-unpaid-registrations, match-expire, ops-edge-health, news-translate, ops-job-digest, news-rewrite, dupr-sync, errors-telegram-alert, feed-embeds-sync, mux-sync-assets, leaderboard-compute, auto-archive-tournaments |
| `adminSessionAalOk` (admin + MFA aal2) | 11 | api-keys-list, dupr-org-unlink-club, pro-tour-trigger-scrape, dupr-org-link-club, dupr-match-submit, send-push-notification, news-rewrite, submit-match-score, api-keys-admin-generate, dupr-user-search, api-keys-admin-revoke |
| `magic_token` (guest social-event flows) | 8 | add-registration-direct, cancel-registration, create-payment-order, mark-payment-claimed, phone-otp-verify, reactivate-registration, request-recovery-link, submit-match-score |
| Custom shared-secret headers (webhook/cron) | 7 | auto-cancel-unpaid-registrations, feed-embeds-sync, match-expire, ops-job-control, send-blog-blast, send-event-registration-email, social-caption |
| service-key-as-secret (`=== SUPABASE_SERVICE_ROLE_KEY`) | 3 | api-keys-generate, api-keys-revoke, notification-send |
| Unauthenticated public (by design: OG + newsletter + geo) | ~13 | og-* (11), newsletter-subscribe, geo-check |

## Appendix B — Domain census (81 dirs incl. `_shared`)

dupr **17** · og **11** · news **5** · match **5** · api **5** · send **4** · ops **3** · mux **3** · pro **2** · phone **2** · feed **2** · auto **2** · zalo/video/submit/social/request/reactivate/notification/newsletter/mark/log/leaderboard/invite/geo/errors/delete/create/cancel/batch/add · **_shared** · **+1** each

## Appendix C — Environment facts

- `project_id = "ajvlcamxemgbxduhiqrl"` in `supabase/config.toml`; `verify_jwt = false` for all functions (84 matches incl. comments).
- 336 migrations in `supabase/migrations/` (2025-12-21 → 2026-08-05), incl. `20260730100000_admin_aal2_sweep.sql` defining `public.is_admin()`.
- `supabase/rollback/` contains a one-off DB export (`2026-07-27-vi-hcmc-open.sql`).
- 11 vitest suites in `_shared/__tests__/`.
