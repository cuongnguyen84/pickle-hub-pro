# External integration inventory

Inventory derived from environment lookups, imports, Edge handlers and Worker configuration.

| System | Purpose and where used | Authentication | Failure handling / files |
|---|---|---|---|
| Supabase | Database, Auth, RPC, Storage, Realtime for all clients | public anon key + user JWT; service role server-only | client errors/Query retries; `src/integrations/supabase/`, `supabase/`, `apple/Core/Supabase` |
| Cloudflare Pages | Static SPA, middleware-rendered crawler HTML, sitemaps/RSS/OG proxies | deployment environment/service credentials | SPA fallback and renderer fallbacks; `functions/`, `public/_redirects`, `vite.config.ts` |
| Cloudflare Workers | News fetch, tour scraper, social poster, blob watchdog | worker secrets and signed/service calls | retry/logging per worker; `workers/*/src/index.ts`, `wrangler.toml` |
| Mux | Live stream creation, ingest, playback, replay assets | `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, signed `MUX_WEBHOOK_SECRET` | webhook reconciliation + cron asset sync; Mux Edge Functions, `MuxPlayer.tsx`, creator/live pages |
| DUPR | Player identity/rating, clubs, entitlement, match submission, rankings | client credentials, partner/user tokens, encrypted token keys, webhook shared key | token refresh, sync logs, idempotent webhooks/submissions; `dupr-*` functions, `src/lib/dupr/`, hooks |
| Resend | Auth, registration and recovery email | `RESEND_API_KEY`; inbound auth hook signature | provider errors and channel fallback; `send-auth-email`, `send-event-registration-email`, recovery |
| Mailchimp | Newsletter/audience and blog blast | API/audience IDs and webhook secret | generic public responses, rate limits; newsletter/blog functions |
| Zalo OA/ZNS | OTP/recovery messaging and OA integration | OA token, app id/secret, template IDs | ZNS→email/eSMS fallback, cron token refresh; phone/recovery/zalo functions |
| eSMS.vn | SMS OTP fallback | API key/secret/brand/type/base URL | send logs, rate limits, dev-mode behavior; `phone-otp-send` |
| Firebase Cloud Messaging | Web/native push delivery | `FCM_SERVICE_ACCOUNT_JSON` | stale-token/provider handling; `send-push-notification`, push hooks/services |
| Google/Capgo social login | Native Google authentication | native OAuth configuration | browser/deep-link fallback; `useNativeGoogleAuth.ts`, Capacitor config |
| GoogleSignIn iOS | Google authentication in the standalone SwiftUI app | client IDs/URL callbacks from native config | callback handled in `ThePickleHubApp.swift`; package pinned in `apple/project.yml` |
| Google Analytics 4 | Product/marketing event tracking | public measurement configuration in page/runtime | defensive `dataLayer`; `src/utils/ga.ts`, tracking hooks |
| Gemini | News translation/rewrite, social captions, import enrichment | `GEMINI_API_KEY`, optional model | strict output/schema validation and retry policy; news/shared validation, caption/import functions |
| Gemini grounded Google Search | Product-import source URL discovery | same Gemini API key | results are subsequently fetched only through HTTPS/public-address validation; `product-import-enrich` |
| Turnstile | Public OTP/recovery human challenge | public site key + server secret | fail closed when required; registration/recovery UI and functions |
| Telegram | Ops/error/job alerts and commands | bot token, chat/admin IDs, webhook secret | dedup and job state; ops/error functions, docs runbooks |
| GitHub API | Operational issue/workflow dispatch | `GITHUB_OPS_TOKEN`/`GITHUB_TOKEN`, repository | recorded dispatch/retry state; `ops-job-control` |
| Facebook/Instagram Graph APIs | Automated news/social publishing | page/user access tokens, IG user ID | post log/idempotency/comment retry; `workers/social-poster` |
| External news sources | Acquire pickleball news/feed embeds | worker source configuration/API keys | normalized origins, dedup, claim/retry pipeline; news Worker/functions/tables |
| Pro-tour websites | Scrape professional tour results/watchlist | signed worker endpoint | fixtures, ingest logs, admin retry; `workers/pro-tour-scraper`, `pro-tour-*` |
| Google Drive/external images | Creator thumbnails and content media | public share URLs only | URL conversion/proxy/allowlist and fallback images; creator forms, `image-utils.ts` |
| IndexNow | Notify search engines of changed public URLs | deployment key/config | bounded endpoint response; `functions/api/indexnow.ts` |
| ip-api.com | Country lookup for optional geo blocking | no key | `geo-check` sends validated client IP over plain HTTP, is limited by provider availability/rate, and treats failure as unknown/not blocked |
| Apple APNs + Firebase iOS SDK | Native push registration/routing | APNs entitlement plus Firebase configuration | `RemotePushService.swift`, `ThePickleHubApp.swift`, Firebase 12.9.0 |

Server credentials are read only in Edge Functions/Workers. Values prefixed `VITE_` are compiled into client assets and must be considered public.

## Unverified/external backend dependency

The SwiftUI shop and React bulk-import code reference a larger shop API/schema than the included migrations define. This is not a named third-party vendor, but operationally it is an external dependency on remote Supabase state: `shop_public_*`, cart/order/media RPCs/tables and shop media buckets cannot be derived from this repository. Validate that remote contract before changing or releasing shop clients.
