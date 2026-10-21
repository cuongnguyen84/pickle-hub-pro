# idea-recon — shop-marketplace (2026-08-09, nguyên văn)

## Prior art

Nothing marketplace-specific exists — no `shops`, `products`, `orders`, `seller_applications` tables, no `/shop` routes, no seller-role concept anywhere in `src/`, `supabase/`, or `apple/`. The plan's own §21 slice (seller application + admin review + shop activation) is **0% built**, but the surrounding scaffolding it needs is 60-80% reusable:

- `src/lib/payment/vietqr.ts:1-56` — confirmed render-only image-URL builder exactly as plan §10 describes. No fetch, no webhook, no proof-of-payment. Matches plan verbatim.
- `supabase/functions/create-payment-order/handler.ts` + `mark-payment-claimed/handler.ts` — Deno-free, unit-testable core with injected store, idempotent insert via reference-code retry loop, guarded `UPDATE ... WHERE flag=false` race-safe claim, `PHUB-XXXXXX` reference codes. This is the closest existing pattern for "server-authorized state transition, atomic, auditable" that §9/§14 asks for — a seller-application submit/approve routine should follow this exact shape (pure handler + thin `index.ts` wrapper).
- `supabase/migrations/20260101135910_..._btc_manage_team` (`btc_manage_team(_team_id, _action, _notes)`, lines ~319-360) — `SECURITY DEFINER` + `FOR UPDATE` row lock + permission check (`creator_user_id != auth.uid() AND NOT is_admin()`) + approve/reject/remove single RPC with optional notes. This is the nearest existing analog to "admin approve/reject/request-changes with required reason" — closer than `AdminNews.tsx` (which is pure moderation toggle, no approval workflow) or `match-proposal/index.ts` (approve/reject/dispute action dispatch with `rejection_reason` column, `supabase/migrations/20260516070000_match_proposals.sql:52`).
- `supabase/functions/notification-send/index.ts` is a **skeleton, unimplemented** (comment: "BLOCKED: notifications table schema decision"). Real notify pattern in prod is direct `supabase.functions.invoke("send-push-notification", {...})` from inside another function (`mark-payment-claimed/index.ts:131-139`) plus in-app rows via `useNotifications.ts`/`useUnifiedNotifications.ts`. Plan §16 "reuse existing notification conventions" → reuse `send-push-notification` invoke pattern, not `notification-send`.
- `supabase/functions/_shared/admin-aal.ts` — `adminSessionAalOk()` exists and is the required gate for admin approve/reject edge functions (per plan §14 "Admin MFA... high-risk actions require explicit server-side authorization").
- `.claude/memory/lessons-learned.md:8-35` — mandatory GRANT block after every new-table RLS migration (checked *before* RLS by Postgres); this bit every prior new-table migration (`vi_blog_posts`, `videos`/`tournaments`/`organizations`/`livestreams`).
- No private storage bucket + signed-URL pattern exists anywhere (`videos`, `thumbnails`, `avatars`, `forum-images`, `og-images`, `clubs-logos` are all `public = true`). KYC-document storage (plan §14) would be the **first** private bucket + `createSignedUrl` usage in the repo — net-new pattern, not reuse.
- `docs/adr/001-mobile-platform-direction.md` — Capacitor iOS is transitional/production-only-fixes; `/apple` SwiftUI is long-term but only "new committed functionality." Shop has no native mandate in this ADR; web-first for a brand-new feature is consistent with existing direction (unlike the "fix both web and native" rule, which is scoped to *fixes*, not new features).

## Touch surface (likely)

- `src/App.tsx:739-758` — admin route block to extend with `/admin/shop/...` (mirrors existing `/admin/disputes`, `/admin/reports` registration style); lazy route group needed per plan §11.
- `src/components/admin/AdminLayout.tsx:48-75` — `navItems`/`mobileTabItems` arrays to add a Shop entry.
- `src/routes/__tests__/route-snapshot.json` + `.test.ts` — will need updated fixtures for any new route.
- `src/components/layout/BottomNav.tsx:1-55` — confirms 5-slot mobile nav (Home/Live/CalendarPlus/Wrench-Tools/Newspaper-News), hidden on `/admin`, `/creator`, `/embed`. Plan's "no 6th slot" constraint is accurate against this file.
- `supabase/functions/_shared/admin-aal.ts`, `_shared/cron-auth.ts` (pattern reference), `_shared/auth.ts` (`jsonResponse`) — shared helpers new seller/admin edge functions will import.
- New: `supabase/functions/seller-application-submit/`, `supabase/functions/seller-application-review/` (or similar) following the `create-payment-order` handler/index split.
- `functions/_middleware.ts` + `functions/_lib/render/` — will need a `renderShop`/product SSR handler eventually (not needed for §21 slice — application+review+empty shop only; plan §20 Phase 1 full does include public product pages + SSR).

## Data

- No existing tables to reuse directly; `seller_applications`, `seller_application_documents`, `shops`, `shop_members`, `shop_audit_events` are all new (plan §13).
- Closest existing append-only audit shape: none found identical — `ops_record_dispatches` (untracked migration `20260805110000`) and `news_origins.pipeline_status`/`attempts`/`last_error` (news editorial pipeline, `20260731090000_news_editorial_pipeline.sql`) are the nearest state-machine-with-retry-columns precedent, not a direct audit-log table match.
- `is_admin()` / `has_role()` conventions — grep confirms wide use (20+ migrations); new RLS must call these, not invent new admin checks.
- Migration naming: two live conventions — legacy autogenerated UUID-suffixed and newer human-readable (`20260731090000_news_editorial_pipeline.sql`). New shop migrations should use the human-readable style (current practice).
- GRANT block is mandatory (lessons-learned) — the single most likely first-PR mistake.

## Binding constraints found

- `CLAUDE.md` — "80 active edge functions, count enforced by `npm run auth:registry`" → new seller/admin functions must go through this registry check.
- `CLAUDE.md` "Supabase JWT ES256/HS256 Workaround" — any new user-facing seller-application edge function needs `verify_jwt = false` + internal `supabase.auth.getUser()`, same as `mux-create-livestream`/`invite-team-to-tournament`.
- `.claude/memory/lessons-learned.md:8-35` — GRANT block required before RLS.
- `docs/proposals/shop-marketplace-plan.md:26-35` (§0 hard constraints) — no 6th bottom-nav slot (confirmed structurally true against `BottomNav.tsx`), no global `seller` role (`app_role` currently viewer/creator/admin), no public bucket/loose RLS for KYC docs (no private-bucket precedent exists — genuinely new ground).
- `docs/adr/001-mobile-platform-direction.md` — no native commitment for new features; Capacitor fix-only, SwiftUI opt-in for new work.

## Test coverage today

- `supabase/tests/rls_auth_matrix.test.sql` (pgTAP, `plan(23)`) — blanket "every policied table has RLS enabled" + behavioral probes. Would need new assertions per new shop table but harness/pattern exists.
- `supabase/tests/notification_insert_rls.test.sql` — RLS assertion style reference (uses `pg_policies` catalog directly).
- No E2E/Playwright coverage exists for any approval workflow; plan §19's E2E vertical slice has zero existing analog to adapt from.
- `src/routes/__tests__/route-snapshot.test.ts` — will catch missing `/admin/shop*` registration.

## Unknowns worth asking Cuong

1. Intake says admin-created shop for the first 1-3 known sellers is a valid MVP path — is the self-serve `seller_applications` submit/resubmit UI in scope for the *first* PR, or should slice 1 start as an admin-only "create shop directly" tool (smaller diff, since real sellers are known already)?
2. Private KYC-document bucket is genuinely new (no signed-URL precedent in repo) — confirm bucket name/retention expectations before migration.
3. `notification-send` is an unfinished skeleton — confirm bypassing it entirely for the proven `send-push-notification` invoke + direct `notifications` table insert pattern, per plan §16.
