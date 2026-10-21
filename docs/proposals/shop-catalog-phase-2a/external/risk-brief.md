# Brief: shop marketplace "Phase 2a — production catalog"

You cannot see the repo. Everything you need is below. Be concrete.

## The product

ThePickleHub — a Vietnamese pickleball site. ~2,000 registered users, ~1,669
with role `viewer`, 2 `creator`, 1 `admin` (the sole operator, Cuong). Solo-run.
Stack: React 18 + Vite SPA on Cloudflare Pages; Supabase Postgres + Storage +
Edge Functions; SEO prerender for bots implemented as a Cloudflare Pages
Function middleware writing rendered HTML into a KV cache; Capacitor mobile
shell (iOS/Android) that loads the live remote URL; vite-plugin-pwa service
worker (skipped inside the native WebView).

## What already shipped (Phase 1, on a branch, NOT applied to any database)

A closed-pilot seller onboarding flow:
- `shop_pilot_members` (admin-managed allowlist), `shops`, `shop_members`
  (roles: owner/manager/fulfillment/support), `shop_applications`,
  `shop_application_events`.
- All writes that change state go through `SECURITY DEFINER` RPCs that set a
  transaction-local GUC `shop.privileged_write='on'`; BEFORE UPDATE triggers
  pin privileged columns (`status`, `owner_user_id`, `slug`, `state`,
  `verified_*`) back to OLD values for everyone else.
- Public read of `shops` is `USING (state = 'active')` with `GRANT SELECT ... TO anon`.
  Owner/member update policy is `USING (is_shop_member(id))` — **role-blind**:
  any member row, including `support`, satisfies it.
- `shops.intro` and `shops.name` are free text; only `name` has a length CHECK
  (3–120). No sanitisation, no HTML policy.
- 24 pgTAP assertions were written for this migration. **The migration has never
  been applied to any database and the tests have never been executed.**

## What Phase 2a proposes to add

Categories (fixed seed in the migration, no CRUD), `products`,
`product_variants` (SKU), `product_media`, moderation state machine
(approve / reject / request-changes / suspend), seller catalog UI, admin
moderation UI, and — the new thing — a **public** buyer-facing catalog.

Product-owner decisions already locked:
- Approving a product publishes it immediately (no separate `published` state).
- Inventory is a boolean per variant (in stock / out of stock). No counts.
- Categories are seeded, never edited from a UI.

Planned public routes: `/shop`, `/shop/category/:slug`, `/shop/product/:slug`,
`/shop/store/:slug`, plus `/vi/...` mirrors. Seller (`/seller/*`) and admin
(`/admin/shop/*`) routes are `noindex` + robots-disallowed already.

This is the first time seller-authored content (product titles, descriptions,
photos) becomes readable by anonymous users. Phase 1 was entirely private.

## Facts I have verified in the repo, with numbers

1. **Bot SSR + KV cache.** A middleware detects crawler user-agents, renders
   HTML server-side and stores it in KV under key `pr:v34:${pathname}` — the
   query string is not part of the key. Default TTL 21600s (6 hours).
   The write is guarded by `if (PRERENDER_CACHE && response.status === 200)`.
   Consequence already recorded in the repo's lessons file: when a page later
   starts returning 404, the old 200 HTML is **not** overwritten and survives
   to TTL. `?nocache=1` bypasses the *read* only. There is no
   `PRERENDER_CACHE.delete()` call anywhere in the repo. The only global purge
   is bumping the `pr:vNN` key prefix, which invalidates every cached page on
   the site at once.
   Unmatched paths fall through to a real `404` renderer — so if a new public
   route ships without a matching SSR handler, crawlers get a 404 while human
   visitors see a perfectly rendered SPA page.

2. **Storage.** Every existing bucket is `public: true`. There are zero
   `createSignedUrl` calls in the entire repo. The closest precedent
   (`clubs-logos`) is:
   - bucket public, 2 MB limit, MIME allow-list jpeg/png/webp
   - `SELECT` policy: `USING (bucket_id = 'clubs-logos')` — anyone, including anon
   - `INSERT`/`UPDATE`/`DELETE` policies: `TO authenticated` with
     `(storage.foldername(name))[1] = auth.uid()::text`
   - **no admin bypass clause in any of the four policies**
   Client uploads use path `<auth.uid()>/<timestamp>-<random>.<ext>` and
   `getPublicUrl()`.

3. **Service-worker caching.** `vite.config.ts` runtime caching includes
   `^https://<project>.supabase.co/storage/` → **CacheFirst, 30 days,
   200 entries**, plus a generic `\.(png|jpg|jpeg|webp|avif|svg|gif)$` →
   CacheFirst, 30 days, 150 entries. The Supabase REST origin is `NetworkOnly`.

4. **Bundle budget.** CI runs `check-bundle-size.mjs` with `BUNDLE_STRICT=1`
   and a hard total-gzipped-JS backstop of **1970 KB**. I built the Phase 1
   branch and measured: INITIAL 225.9 KB (budget 280), CODE 1670.0 KB
   (budget 1800), **Total 2054.0 KB — 84 KB over the 1970 backstop, i.e. the
   gate is already red before Phase 2a adds anything.** I attributed ~87 KB gz
   of that to 32 lazy chunks belonging to a 37-screen *design prototype*
   (`src/proto/shop/**`) that exists only on this branch and is not on `main`.

5. **Web-vitals.** Vietnam-segment p75 CLS is currently poor (~0.64 measured
   across the site); the SLO target is ≤ 0.1. LCP target 2.5s.

6. **Admin.** The single admin account requires TOTP (AAL2); `is_admin()`
   returns false without it. There is exactly one admin, one operator, no
   on-call rotation.

7. **Migrations.** The repo's own rule: a migration cannot be undone by
   `git revert`. A previous incident is on record where reverting a squashed
   merge deleted a migration file from the ledger while the schema stayed
   applied in production, producing permanent drift.

## What I want from you

Name the specific failure Phase 2a causes in production, with mechanism →
trigger → what the user (or Cuong at 2am) actually sees. Focus especially on:

- The first-ever public exposure of user-generated rows and images.
- Media: private-vs-public boundary for draft / rejected / suspended products,
  path guessability, cross-shop upload, orphans, bypassing MIME/size limits by
  calling the Storage REST API directly.
- Takedown: what it actually takes to make a bad product/photo disappear from
  every surface (SPA, bot KV HTML, service-worker cache, storage CDN), and how
  long each surface stays stale.
- Concurrency: two admins moderating at once; seller editing a product while a
  moderator approves it; SKU/slug uniqueness scope.
- Anything about this plan that quietly makes Phase 3 (cart/checkout/orders)
  impossible or very expensive to build correctly.
- Rollback: what is genuinely not revertible.

If a risk is theoretical rather than real for a 2k-user site with one operator,
say so and drop it. I would rather have five findings I can act on than twenty
I have to triage.
