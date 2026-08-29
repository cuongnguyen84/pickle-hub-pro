# Round 5 — Technical prompt: make shop logo + cover banner publicly visible

_Drafted with independent review by Codex CLI (17/08). PO order: "sửa nốt tải logo và banner lên cho shop"._

## Context (ground truth — verified against the codebase, do not re-litigate)

Seller upload of shop logo + cover ALREADY WORKS up to machine verification:

- Table `public.shop_profile_media` (migration `20260811220000_shop_media_ordering_profile.sql`): one row per `(shop_id, purpose ∈ logo|cover)`. Columns: `draft_path`, `rendition_source_path`, `public_path` (NULL until published), `focal_y` (cover framing 0–1), `version`, `verified_at`. Constraint `public_path IS NULL OR verified_at IS NOT NULL`. RLS public SELECT only when shop active AND `public_path IS NOT NULL`.
- Client: `profileMediaTarget` in `src/hooks/shop/useMediaUpload.ts` → RPCs `shop_profile_media_upload_init` / `shop_profile_media_finalize`. UI: `ShopProfileMediaSection` + `ProfileSlot` in `src/components/shop/MediaEditor.tsx`, mounted in `src/pages/shop/SellerShopSettings.tsx`.
- `shop_profile_media_finalize` (latest body: migration `20260816120000`) verifies real bytes via `storage.objects` metadata (WebP or JPEG) and sets `verified_at`. Works.
- Buckets are the SAME as product media: draft `shop-product-media-draft`, public `shop-product-media` (from `shop_media_limits()`). The existing helper `publicMediaUrl()` in `src/lib/shop/publicCatalog.ts` therefore already builds correct public URLs for profile media — do NOT write a new helper.
- Draft key shape: `<shop_id>/profile/<purpose>/<media_id>/v<version>/original` and `.../rendition.webp`. Rendition bytes may be JPEG despite the `.webp` key (iOS Safari fallback) — always sniff bytes, never trust the extension.

**The gap — three missing pieces:**

1. **No publish leg.** `shop_profile_media_publish_commit(_media_id, _public_path)` exists (service_role only, the ONLY place `public_path` is set) but has ZERO callers. There is no `shop_profile_media_publish_prepare`. The edge function `supabase/functions/shop-media-lifecycle/index.ts` handles only PRODUCT publish. Product pattern to mirror: `product_publish_prepare` is called with the CALLER'S OWN JWT (authz decided in Postgres) → returns a copies plan `{media_id, source, target}` → edge fn downloads the rendition from the draft bucket, sniffs bytes (`inspectWebp`/`inspectJpeg`, max 1 MB, max 2048 px), uploads to the public bucket with `upsert: true` and the SNIFFED content type → only then calls commit with the service role. Client trigger for products: `usePublishProduct` in `src/hooks/shop/useProductModeration.ts` invokes the edge fn with `{action: "publish", product_id}`.
2. **`shop_public_shop(_slug)` returns no image fields.** Latest definition: migration `20260813120000_shop_p2b_shop_slug_history.sql` (SECURITY DEFINER, jsonb with `found` / `shop{slug,name,intro,region,verified,verified_at,shipping_note,return_note,primary_category_slug,product_count}` / `contacts`, plus `redirect_to` slug-history fallback).
3. **`src/pages/shop/ShopStore.tsx` renders no images.** Header (~line 85): `<ShopMonogram name={shop.name} size={72}/>` + h1 + verified pill. Client type `PublicShopResult` in `src/hooks/shop/usePublicShop.ts`.

Also relevant:

- `shop_media_referenced_objects()` (migration `20260814110000`) is the orphan-sweep allowlist. For product media it includes the DETERMINISTIC pending publish target for every verified row, with a comment requiring prepare's target expression and the allowlist expression to stay literally identical (guarded by `supabase/tests/shop_media_reconcile.test.sql`). For profile media it currently lists only live `public_path`.
- `product_publish_commit` DELETEs pending cleanup jobs for the target key before flipping the pointer (republish-after-unpublish race). `shop_profile_media_publish_commit` does NOT — and `shop_profile_media_revoke(_shop_id)` (shop leaves `active`) enqueues `public_path` cleanup, so the same race exists on suspend → reactivate → republish of the same version key.
- Seller UI copy is now FALSE: `MediaEditor.tsx` says "Trang shop công khai chưa mở, nên chưa ai ngoài shop nhìn thấy" and "Ảnh sẽ hiện trên trang shop công khai khi trang đó mở" — the public shop page has been live since rounds 1–4.

## Work items

### 1. One new migration (timestamp AFTER `20260816120000`)

File: `supabase/migrations/<new-latest-timestamp>_shop_profile_media_publish.sql` (name at your discretion, content:)

a. **`shop_profile_media_publish_prepare(_shop_id UUID) RETURNS JSONB`** — mirror `product_publish_prepare`:
   - Authz: `is_shop_manager(_shop_id) OR is_admin()`, else `insufficient_privilege`.
   - Require `shops.state = 'active'`, else refuse (Vietnamese error message, matching house style).
   - Copies plan for ALL rows of the shop with `verified_at IS NOT NULL`: `{media_id, source: rendition_source_path, target}` where target is exactly
     `shop_id::text || '/profile/' || purpose || '/' || id::text || '/v' || version::text || '/live.webp'`
     (immutable per version; satisfies the `public_path LIKE shop_id/%` constraint).
   - Raise `invalid_parameter_value` when there is nothing verified to publish.
   - Return `{shop_id, draft_bucket, public_bucket, copies}` like the product prepare.
   - `REVOKE ALL FROM PUBLIC; GRANT EXECUTE TO authenticated, service_role;`

b. **`CREATE OR REPLACE shop_profile_media_publish_commit`** (SAME signature `(UUID, TEXT)` — do NOT add parameters; a new overload is the 42725 trap that broke the approval flow before):
   - Keep existing checks (row exists, `verified_at NOT NULL`, path scope).
   - ADD: `_public_path` must EQUAL the deterministic key derived from the row's CURRENT `purpose`/`version` (same expression as prepare). This closes the stale-plan race: prepare for v1, seller re-uploads + re-finalizes to v2, delayed v1 commit must fail, not overwrite the live pointer.
   - ADD: refuse when the owning shop's `state <> 'active'` (prepare-then-suspend window).
   - ADD: DELETE pending `shop_media_cleanup_jobs` for `(public_bucket, _public_path)` with `state <> 'done'` in the same transaction as the pointer update — mirror `product_publish_commit`'s comment and behavior.

c. **`CREATE OR REPLACE shop_media_referenced_objects()`** — add a `UNION ALL` arm: the deterministic pending target for every `shop_profile_media` row with `verified_at IS NOT NULL`, using the LITERALLY identical expression as prepare (the reconcile test reads both).

d. **`CREATE OR REPLACE shop_public_shop(_slug TEXT)`** — copy the `20260813120000` body verbatim and ONLY ADD three keys inside the `shop` object: `logo_path`, `cover_path`, `cover_focal_y` (subselects from `shop_profile_media` where `shop_id = _s.id AND purpose = ... AND public_path IS NOT NULL`; `cover_focal_y` from the cover row; all null when absent). SECURITY DEFINER bypasses RLS, so the `public_path IS NOT NULL` filter in the query IS the security boundary. Do not rename/remove any existing key; keep the suspended-shop anti-enumeration branch byte-identical.

No other RLS/policy changes. No edits to historical migrations.

### 2. Edge function: `supabase/functions/shop-media-lifecycle/index.ts`

New action `publish_profile` with body `{action: "publish_profile", shop_id}`:

- Same auth model as `publish`: forward the caller's `Authorization` header to `shop_profile_media_publish_prepare` via an anon-key client (Postgres decides); service-role client for storage copy + commit.
- Factor the existing per-item download → byte-sniff (WebP/JPEG magic, `inspectWebp`/`inspectJpeg`, ≤ 1 MB, ≤ 2048 px) → public-bucket upsert loop into ONE shared function used by BOTH `publish` and `publish_profile`. Upload with the SNIFFED content type (`image/webp` or `image/jpeg`).
- Commit per item with `shop_profile_media_publish_commit(media_id, target)`. Copy first, commit second — a failed commit leaves an orphan the reconcile sweep collects, never a broken page.
- Partial failure semantics: logo and cover are independent rows — a failed cover must not roll back a committed logo; the failed item stays verified and retryable.
- Keep the logging discipline of the file: paths yes, URLs/tokens never. Write the complete file (house rule: full files, no snippets).

### 3. Client trigger: seller settings

- Add a `usePublishProfileMedia(shopId)` mutation (pattern: `usePublishProduct` in `useProductModeration.ts`, including the lazy `import("@/integrations/supabase/client")` gotcha noted there) invoking `shop-media-lifecycle` with `{action: "publish_profile", shop_id}`.
- In `ProfileSlot` (`src/components/shop/MediaEditor.tsx`): after finalize completes successfully, automatically attempt publish once, then refetch. When a row is `verified_at && !public_path`, show honest Vietnamese status + a retry button that calls the same mutation. A publish failure must NOT present as an upload failure — verification success and publication failure are distinct states.
- Fix the stale copy: remove "Trang shop công khai chưa mở…" and "…khi trang đó mở"; replace with accurate Vietnamese (e.g. logo/ảnh bìa hiện trên trang shop công khai sau khi đưa lên xong).

### 4. Client type

`src/hooks/shop/usePublicShop.ts` — extend `PublicShopResult.shop` with:

```ts
logo_path: string | null;
cover_path: string | null;
cover_focal_y: number | null;
```

### 5. Render on `/shop/:slug` (`src/pages/shop/ShopStore.tsx`)

Use `publicMediaUrl` from `src/lib/shop/publicCatalog.ts`.

**Cover.** When `cover_path` is non-null: full-width banner at the top of the store header card, ~120 px tall mobile / 160 px desktop, `object-fit: cover`, vertical framing `object-position: 50% ${clamp01(cover_focal_y ?? 0.5) * 100}%` (clamp defensively), rounded to the card radius with no spill, `alt=""` (decorative). When null: render NO banner wrapper or placeholder — current layout unchanged.

**Logo.** When `logo_path` is non-null: replace `ShopMonogram` in the same 72 px slot with an `<img>` (72×72, rounded, `object-fit: cover`, alt = shop-logo text with the shop name). When null: keep the monogram fallback exactly as today. Do not redesign the rest of the header.

### 6. pgTAP

One new test file in `supabase/tests/` covering at least:

- Published logo + cover → `shop_public_shop` returns `logo_path`, `cover_path`, `cover_focal_y`.
- Verified-but-unpublished → all three null (NOT exposed).
- No profile media → all three null; every pre-existing key of the contract still present.
- Suspended/nonexistent shop → responses remain indistinguishable (anti-enumeration intact).
- Prepare refuses non-manager; refuses inactive shop; returns the deterministic targets for verified rows.
- Commit refuses a stale/wrong target key (version mismatch); deletes a pending cleanup job for the committed target; refuses when the shop is no longer active.
- `shop_media_referenced_objects()` contains the pending profile targets (update `shop_media_reconcile.test.sql` so the identical-expression guard covers the profile arm too).

Existing suites must stay green.

## Non-goals (do NOT do)

- Logo on `ProductCard`, PDP, search or category results.
- Admin moderation queue / human approval for profile media — `verified_at` machine verification is the gate by design.
- New buckets, new URL helpers, new npm dependencies, broad RLS/policy changes, media-system refactors.

## Constraints

- Exactly ONE new migration file, latest timestamp; historical migrations untouched.
- Total gz JS backstop headroom is **9.7 KB** — the client diff must stay tiny (an `<img>`+banner, one small mutation, type fields).
- Vitest coverage ≥ 83 %.
- Honest Vietnamese user-facing copy; English code/comments per surrounding style; complete files for the edge function.
- Commit locally with clean messages. **Do NOT push** — the orchestrator pushes and applies the migration to prod.

## Local verification (run all, report results)

```sh
supabase db reset          # supabase start alone does NOT apply all migrations
npx supabase test db --local supabase/tests/<new-file>.test.sql   # plus the full pgTAP suite
npm run test
npm run build
node scripts/check-bundle-size.mjs
```

## Acceptance criteria

1. A manager or admin can publish all verified logo/cover rows of an active shop via `publish_profile`.
2. A non-manager gets no copy plan and cannot publish another shop's profile media.
3. Publishing is refused while the shop is not `active` (both in prepare and in commit).
4. Prepare runs under the caller's JWT; only the copy and commit use service-role authority.
5. The edge function derives every source/target path from the database plan — never from client input.
6. WebP and JPEG bytes are both accepted by magic-byte inspection even at a `.webp` key; the public object is uploaded with the sniffed MIME type.
7. Non-image bytes, oversized files (> 1 MB) and oversized dimensions (> 2048 px) are rejected before commit.
8. Public targets are exactly `<shop_id>/profile/<purpose>/<media_id>/v<version>/live.webp`.
9. `shop_media_referenced_objects()` includes verified profile pending targets via the literally identical expression as prepare, and the reconcile test guards it.
10. Commit deletes any pending cleanup job for the target key in the same transaction as the pointer update.
11. Commit refuses a target that does not match the row's CURRENT version (stale-plan race closed); retries are idempotent (same key, upsert).
12. `shop_public_shop` adds `logo_path`, `cover_path`, `cover_focal_y` without removing or renaming any existing key.
13. `shop_public_shop` never exposes verified-but-unpublished media.
14. Suspended shops keep the existing anti-enumeration behavior byte-for-byte.
15. A shop with a published cover shows a responsive banner (~120/160 px, cover-fit, focal position honored, card radius).
16. No banner DOM at all when there is no published cover.
17. A published logo renders in the existing 72 px slot; the monogram remains the fallback.
18. After a successful finalize, publish is attempted automatically and the seller UI refreshes.
19. Verified-but-unpublished media shows an honest status and a working retry; publish failure is never presented as an upload failure.
20. The stale "trang shop công khai chưa mở" copy is gone, replaced with accurate Vietnamese.
21. New pgTAP passes; all existing pgTAP suites pass after `supabase db reset`.
22. `npm run test` passes with coverage ≥ 83 %; `npm run build` succeeds; `check-bundle-size.mjs` stays within budget.
23. Work is committed locally and NOT pushed.

## Review notes (from independent Codex review — respect during implementation)

- **Stale prepare/commit race** is the one real correctness hole in a naive port: close it with the deterministic-key equality check in commit (AC 11), not with a signature change (a second overload of the same function name is the known 42725 failure mode in this repo).
- **Partial multi-item failure:** storage and Postgres are not one transaction — publish logo and cover as independent items; never claim atomicity across them.
- **Finalize/publish UI ordering:** trigger publish only after finalize resolves; guard against a stale query response overwriting newer `verified_at`/`public_path` state.
- **SECURITY DEFINER leakage:** the `public_path IS NOT NULL` filter inside `shop_public_shop` is the only wall — RLS does not apply there.
- **Cleanup race:** the pending-job DELETE belongs in the same DB transaction as the pointer flip (function body = one transaction; keep it that way).
