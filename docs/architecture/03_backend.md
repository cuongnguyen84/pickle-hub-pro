# Backend architecture

## Supabase boundary

The browser client in `src/integrations/supabase/client.ts` uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, persists and refreshes sessions, and supplies generated `Database` types. `shop-client.ts` is not a schema-scoped generated client: it is one deliberate cast around the same client because remote-generated types do not yet include the shop migration. The native app uses `supabase-swift` through `apple/ThePickleHub/Core/Supabase/` and domain repositories.

Postgres is the primary source of truth. The canonical history is `supabase/migrations/`; `src/integrations/supabase/types.ts` is a generated consumer contract, not a migration source. The schema uses tables, public/security views, enums, RLS policies, triggers, storage policies, and numerous `SECURITY DEFINER` RPCs.

## API boundaries

| Boundary | Used for | Security authority |
|---|---|---|
| `.from(table/view)` | ordinary CRUD/read models | RLS and grants |
| `.rpc(name)` | atomic workflows, authorization helpers, aggregates | function grants + internal checks |
| `.functions.invoke(name)` | privileged writes and third-party APIs | handler auth registry and shared helpers |
| Realtime channels | chat, presence, notifications/live state | channel/table policies plus hook filters |
| Storage API | images/media uploads | bucket/object policies |
| Cloudflare Pages Functions | SEO HTML, sitemaps, OG proxies | public read-only service client |

## Authentication and authorization

Supabase Auth provides email/password and OAuth/native flows. `supabase/functions/_shared/auth.ts` derives users with `auth.getUser()` rather than trusting request IDs. Most Edge Functions have `verify_jwt=false` because of a documented gateway algorithm compatibility workaround; each function is classified in the strict `supabase/functions/auth-registry.json`. The registry is validated by `scripts/check-edge-auth-registry.mjs`.

Roles are rows in `user_roles` (`admin`, `creator`, and application-specific role checks). Ownership commonly derives through `profiles.organization_id`, creator IDs, captain IDs, club manager/member tables, magic registration tokens, or referee PINs. Helper RPCs such as `is_admin`, `has_role`, `is_creator`, and feature-specific `can_edit_*` functions centralize policy checks.

## RPC model

RPCs fall into four families:

- authorization/read models (`is_admin`, `get_public_profile`, analytics/feed functions);
- quota/atomic creation (`create_*_with_quota`, `*_atomic`);
- tournament lifecycle/scoring (`score_*_atomic`, bracket/round generation, standings);
- guest capability flows (registration magic tokens, partner invitations, referee PIN redemption).

Scoring RPCs lock rows, validate expected `score_version`, recompute winners/standings, and propagate bracket destinations within one transaction. See migrations dated `20260722*` and `20260727*`.

## Storage and Realtime

Storage migrations define `avatars`, `videos`, `thumbnails`, `og-images`, `clubs-logos`, and `forum-images`, with different owner/creator/public policies. React shop code additionally references `shop-product-media-draft`, and Swift constructs public URLs for `shop-product-media`; no migration for either bucket exists in this snapshot. Realtime channels drive chat, viewer Presence, notifications and selected live/event updates. `presence_heartbeats` is a persisted table/RPC path, not the same thing as Realtime Presence. Presence is ephemeral while `view_events`/`view_counts` persist aggregate views.

`public_livestreams` is the anonymous stream-metadata boundary. Its latest recreation (`supabase/migrations/20260218031231_4d223ff8-f1aa-44e7-8607-c3c9d7523de3.sql`) is a default owner/definer view, not `security_invoker`: it intentionally bypasses base-table RLS and exposes a fixed projection while excluding `mux_stream_key` and the internal Mux live-stream ID. Every future projection change requires an explicit public-data review.

## Edge Functions and shared utilities

Every deployed handler lives at `supabase/functions/<slug>/index.ts`. Shared controls include:

| Utility | Purpose |
|---|---|
| `_shared/auth.ts` | bearer parsing and verified user derivation |
| `_shared/cors.ts` | allowlisted CORS and common response handling |
| `_shared/cron-auth.ts` | cron/Vault secret authentication |
| handler-local checks plus DB `api_keys` | API-key/service authentication; no `_shared/api-auth.ts` exists |
| handler-specific code and DB limiter RPC/tables | bounded public ingress; no generic `_shared/rate-limit.ts` exists |
| `_shared/dupr-*` | DUPR client/token/crypto helpers |
| `_shared/news-*` | editorial fetching/translation/rewrite validation |

The definitive per-function matrix is `05_edge_functions.md`; `auth-registry.json` remains the machine-enforced source for credentials.

## Environment variables

Public build variables are limited to `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SITE_URL`, `VITE_TURNSTILE_SITE_KEY`, `VITE_ZALO_OA_URL`, DUPR public configuration, and the prototype flag. Server-only variables discovered in handlers include Supabase service role, cron/internal secrets, Mux, DUPR credentials/encryption keys, Resend/Mailchimp, eSMS/Zalo, FCM, Turnstile, Gemini, Telegram, social APIs, GitHub ops, and worker signing secrets. See `.env.example`, `supabase/config.toml`, and each worker's `wrangler.toml`; never expose non-`VITE_` values to the browser.

## Failure handling and observability

Handlers normally reject unsupported methods, validate/authenticate before initializing privileged work, return JSON with explicit HTTP status, and log redacted context. Client invocation retries malformed/blob transport responses through `src/lib/edgeInvoke.ts`. Client errors and Web Vitals are sent through bounded ingestion (`log-client-event`, `client_errors`, rate-limit tables). Cron/job state is recorded in `ops_cron_*`/`ops_job_*` and surfaced through admin pages and Telegram alerts.

## Contract drift in this snapshot

The generated public type exposes 130 tables, five views, 201 RPCs and 26 enums. It intentionally excludes the shop-onboarding migration; `shop-schema.ts` supplies hand-written shapes. Shop callers also reference product/media/cart/order tables, buckets and RPCs that are not defined by any included migration. `product-import-enrich` references a generic `rate_limits` table that is absent (only specialized client-error, newsletter and view-event limiter tables exist). These are repository/deployment-contract drift, not capabilities that can be proven from the included database source.
