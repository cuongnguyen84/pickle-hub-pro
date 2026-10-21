# Recon — shop-catalog-phase-2a

> Nguyên văn output của `idea-recon`, 2026-08-11. Đọc trên worktree sạch
> `feat/shop-production-phase-2a` @ `1fac6b4f`.

## Prior art

Phase 2a's own scaffolding already exists and is committed on
`feat/shop-production-phase-1` (commit `1fac6b4f`) — routes, nav placeholders,
isolation test, noindex, and pgTAP conventions are all sitting there waiting for
`ready: true`:

- `src/components/shop/ShopShell.tsx:80-84,155-159` — `SellerShell`/`AdminShopFrame`
  nav arrays already list `/seller/products` and `/admin/shop/products` with
  `ready: false`. Flipping that flag + adding the route is most of the nav work.
- `src/proto/shop/screens/S05Products.tsx`, `S06ProductNew.tsx`,
  `S07ProductEdit.tsx`, `B04Product.tsx` — prototype product list/create/edit/
  detail screens already exist (fixture-only, not importable —
  `src/lib/__tests__/shop-production-isolation.test.ts:43-49` forbids it).
- `src/lib/__tests__/shop-production-isolation.test.ts:21-28` — `PRODUCTION_DIRS`
  already anticipates `hooks/shop`, `lib/shop`, `pages/admin/shop`.
- `docs/proposals/shop-marketplace/production-implementation-map.md:45-46` — P2a
  scope is explicitly "Shop profile, categories, products, variants/SKU, media
  upload"; moderation queue is a **separate** line, P2b (`approve/reject/
  request-change, public discovery`), depending on P2a. **This idea's scope
  folds P2b into 2a — map and idea disagree on the split.**
- `production-implementation-map.md:76-81` — `product_categories`, `products`,
  `product_variants`, `product_media`, `inventory_movements` are explicitly
  **not yet created**, named only so nobody reinvents them. **No product tables
  exist in git anywhere.**

## Touch surface (likely)

- `src/App.tsx:71-81,786-791` — route list, `lazyRetry`, `RequireAuth` pattern
- `src/components/shop/ShopShell.tsx` — flip `ready` flags, add product nav
- `src/components/layout/BottomNav.tsx:49-54`, `src/components/layout/ChatFAB.tsx:44-51`
  — already prefix-match `/seller` and `/admin/shop`; no change needed if new
  routes nest under those prefixes
- `functions/_middleware.ts:83-87`, `public/robots.txt:18-21`,
  `functions/robots.txt.ts:21-24` — noindex covers `/seller`, `/shop/sell`
- `src/lib/__tests__/shop-production-isolation.test.ts:66-95` — needs new assertions
- `supabase/tests/shop_phase1_rls.test.sql` — sibling `shop_phase2a_rls.test.sql`
  expected by convention
- `supabase/migrations/` — new file after `20260805110000`

## Data

- Extend, don't reinvent: `public.shop_state`, `shops`, `shop_members`,
  `is_shop_member()`, the `shop.privileged_write` GUC guard pattern
  (`20260811090000...sql:153-168,197-225,340-371`)
- `audit_logs` resource_type CHECK **already reserves `'shop_product'`**
  (`...sql:674-681`) — no new audit table needed
- Slug precedent: `shop_slug_from_name()` + collision-suffix loop
  (`...sql:508-522,596-601`)
- Idempotent locking RPC precedent: `shop_application_decide()` `FOR UPDATE` +
  terminal-state early-return (`...sql:566-579`)

## Binding constraints found

- `.tl-btn` ratchet is **HARD** since 2026-08-01 (`scripts/check-theline.mjs:166-188`)
- GRANT-block-after-RLS: every table needs both a policy and a GRANT
- Idea's "đã chốt" (no category CRUD, no inventory_movements, approve=live)
  conflicts with the map's P2a/P2b split — flagged, not resolved

## Test coverage today

- `supabase/tests/shop_phase1_rls.test.sql` — 230 lines, 24 assertions, covers
  pilot/shop/application actors only. **Zero coverage for product/category/media
  actors.**
- `.github/workflows/pgtap.yml:29-46` — real command:
  `supabase db start` → `supabase test db --local supabase/tests` →
  `node scripts/qa/db-race.mjs`. `supabase/config.toml` has no port override.

## Unknowns worth asking Cuong

1. Idea folds product moderation into 2a; the map puts it in P2b — which supersedes?
2. **Media bucket privacy: every existing bucket (`clubs-logos`, `avatars`,
   `videos`, `thumbnails`, `forum-images`, `og-images`) is `public: true`; ZERO
   `createSignedUrl` calls exist repo-wide.** Private + signed URL is net-new.
3. Stock boolean concurrency: guarded UPDATE (shops/applications pattern) or a
   locking RPC like `shop_application_decide`?
