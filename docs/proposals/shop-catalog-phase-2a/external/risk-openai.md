# Devil's advocate — GPT-5.6 (unedited)

> Prompt: `external/risk-brief.md`. Model: gpt-5.6-sol. Reviewed and adjudicated by risk-auditor; see the proposal for what was rejected.

## Release verdict: Phase 2a does not currently deploy

The first failure is CI, not production:

- Phase 1 already produces **2054 KB gzipped JS** against a hard **1970 KB** limit.
- Deleting the prototype’s ~87 KB only gets the branch to roughly **1967 KB**, leaving about **3 KB** for all Phase 2a seller, moderation, and catalog code.
- Trigger: merge/build Phase 2a with `BUNDLE_STRICT=1`.
- Symptom: CI fails; nothing reaches production. Bypassing the gate merely exposes the failures below.

Remove the prototype and establish real headroom before adding Phase 2a. Three kilobytes is not headroom.

## 1. A public bucket destroys the draft/moderation boundary

**Mechanism:** In a Supabase public bucket, authorization is enforced when listing/uploading/managing objects, not when fetching a known public object URL. An uploaded photo is publicly retrievable before its product is approved.

**Trigger:** A seller uploads a photo for a draft, rejected, or suspended product. The URL is exposed through browser logs, moderation UI, copied links, analytics, a leaked `product_media` row, or later publication.

**Visible failure:** Anyone holding that URL can view the image despite the product being non-public. Rejecting or suspending the product does not revoke the URL.

Random path components reduce guessing; they do not provide access control. At 2,000 users, brute-force path discovery is not the likely failure. URL leakage and previously published URLs are.

There is a second boundary failure if Phase 2 copies the existing storage policy:

- `<auth.uid()>/...` proves only who uploaded the object.
- It does **not** prove that the object belongs to a particular shop or product.
- A seller who belongs to multiple shops—or a `support` member if catalog authorization remains role-blind—can upload under their UID and associate that object with the wrong shop unless the media-attachment write validates shop membership and role in the database.

Also, an upload followed by a failed/cancelled media-row insert leaves a **public orphan**. There must be a cleanup path based on unreferenced object age.

### Required fix

Do not put unapproved media directly at its eventual public URL. Use one of:

1. A private staging bucket, then copy/promote approved media to a public bucket under a new immutable object key; or
2. A controlled image-serving layer that checks publication state.

For a public catalog, staging-private/public-promoted is simpler. Media attachment must be an RPC or equivalent atomic authorization check that verifies:

- uploader has an allowed catalog role for that product’s shop;
- product belongs to that shop;
- object path/bucket belongs to the uploader or accepted upload session;
- the object is not already attached somewhere impermissible.

If bucket MIME and size restrictions are actually configured on the bucket, direct Storage REST uploads do **not** bypass them; those limits are server-enforced. If they exist only in the React upload component, direct REST calls bypass them immediately.

## 2. Takedown is not immediate; the bad photo can remain visible for 30 days

Suspending a product only fixes the live database response. It does not clear all the published copies.

### Surface-by-surface failure

| Surface | After suspension/deletion |
|---|---|
| SPA product data | Correct once its NetworkOnly REST query observes the new state, assuming public RLS filters it |
| Bot product HTML | Existing cached 200 remains for up to **6 hours** |
| Bot category/store HTML | Existing pages mentioning the product also remain for up to **6 hours** |
| Installed PWA image cache | `CacheFirst` can continue serving the photo for **30 days** |
| Native Capacitor shell | Does not use the PWA service worker, so it avoids that particular 30-day cache |
| Public Storage URL/CDN | Remains public until the object is deleted; CDN staleness after deletion is not specified here and therefore cannot be promised as immediate |

The KV failure is deterministic:

- Cache key is pathname only.
- Suspension makes the product renderer return 404.
- The old cache entry was a 200.
- New 404 responses are not written and there is no delete operation.
- `?nocache=1` bypasses only the read; it does not evict the old entry.

**What Cuong sees at 2am:** the admin UI says “suspended,” the normal SPA no longer shows the product, but Googlebot and social-preview crawlers still receive the cached product page, including its image URL. Users who previously loaded the image through the PWA can continue seeing it from local cache for as long as 30 days.

Deleting or overwriting the storage object does not cure the PWA case because `CacheFirst` does not contact the server while its cached response is valid.

### Required fix

A moderation takedown operation must perform all of these:

1. Atomically remove the product from public DB visibility.
2. Delete or revoke every public media object requiring takedown.
3. Purge exact KV keys for:
   - product route;
   - `/vi` product route;
   - affected category routes;
   - affected store routes;
   - any catalog/index route that embeds it.
4. Purge the storage/CDN object if the provider supports it.
5. Stop using long-lived `CacheFirst` for mutable or moderation-sensitive image URLs.

Use immutable, versioned public media keys and change the URL whenever content changes. For urgent removals, the service worker needs a shorter expiration or a network-revalidating strategy. Otherwise the honest takedown SLA is **up to 30 days on previously loaded PWAs**.

A global `pr:vNN` bump works for KV, but forcing a whole-site prerender cold cache for every product takedown is an operationally bad substitute for exact invalidation.

## 3. Approval races let sellers publish content the moderator never reviewed

Phase 1’s trigger pattern protects state columns, but it does not protect ordinary seller-authored fields such as title, description, or media.

**Mechanism:** The moderator approves product version A. The seller updates the title, description, variant, or media concurrently—or edits it after approval—while the product remains `approved`.

**Trigger:**

1. Cuong opens moderation for “Paddle A.”
2. Seller changes the description or replaces the photo.
3. Cuong approves based on the old screen.
4. The approved row now exposes the seller’s new, unreviewed content.

**Visible failure:** Public users see text or photos that Cuong never approved, while the audit log claims the product was approved.

This is more important than “two admins at once.” There is one admin, so multi-admin contention is theoretical here. Two browser sessions can duplicate actions, but the seller/moderator race is the real production race.

### Required fix

Use versioned moderation:

- Seller changes to moderated fields must either:
  - atomically return the product to `pending_changes`, hiding the changed version; or
  - create a new draft revision while the last approved revision remains public.
- Approval must be conditional, for example:
  `UPDATE ... WHERE id = ? AND state = 'pending' AND version = ?`
- If no row is returned, show “product changed; review again.”
- The approval event must record the exact revision/version approved.

For a live marketplace, separate draft and approved revisions are safer because editing an existing product need not make the current approved listing disappear.

## 4. The likely authorization precedent blocks emergency deletion while over-authorizing support users

There are two opposite failures in the supplied precedent.

### Admin cannot delete seller media

If Phase 2 copies the `clubs-logos` policy, update/delete requires the first folder component to equal `auth.uid()`.

**Trigger:** Cuong attempts to delete an abusive photo uploaded under the seller’s UID.

**Symptom:** The admin UI receives a Storage RLS/403 failure because Cuong’s UID does not match the object folder. `is_admin()` and AAL2 are irrelevant unless the storage policy explicitly includes an admin bypass.

Cuong then has to use the Supabase dashboard or a service-role operation during the incident. That is not an acceptable primary takedown path for the sole operator.

Add an explicit `is_admin()` bypass to the relevant storage management policies, while retaining AAL2 if that is the intended admin boundary.

### Support users become catalog editors

The existing shop update policy treats every `shop_members` row identically. If Phase 2 reuses `is_shop_member(shop_id)` for product and media writes:

**Trigger:** A user with role `support` calls the product/media REST endpoint directly, regardless of what controls the UI hides.

**Symptom:** They can modify products, variants, or media as if they were an owner or manager.

Authorization must be role-specific in SQL/RPCs, not UI-specific. Define exactly which of owner, manager, fulfillment, and support may create/edit products, alter inventory, and upload/delete media.

## 5. Public RLS must traverse the complete publication chain

A product being approved is not sufficient for public visibility. Its shop must also still be active, and child rows must inherit that decision.

The public condition needs to be equivalent to:

- product is approved and not suspended;
- owning shop is active;
- media/variant belongs to that publicly visible product;
- any per-row visibility/deletion flags also permit access.

If `product_media` or `product_variants` receives a broad anonymous `SELECT` policy, anonymous callers can enumerate draft/rejected product metadata directly through Supabase REST even if the React catalog never requests it.

**Trigger:** An anonymous user queries the table endpoint instead of using the SPA.

**Symptom:** Draft product titles, media paths, rejected listings, internal ordering, SKUs, or stock state are returned.

Test anonymous access directly against every table and view. Do not treat “there is no public UI for this state” as access control.

React normally escapes free text, so unsanitized descriptions are **not automatically an XSS vulnerability**. The actual XSS trigger would be rendering them with `dangerouslySetInnerHTML`, injecting them into SSR markup without escaping, or embedding them in an unescaped JSON/script block. Those renderers need explicit tests before launch.

## 6. Slug and SKU constraints can make routing ambiguous or enable seller collisions

The route `/shop/product/:slug` has no shop component. Therefore product slugs must be globally unique under the same normalization the router uses, ideally enforced case-insensitively in Postgres.

**Failure if uniqueness is only `(shop_id, slug)`:**

- Two shops create `pro-paddle`.
- `/shop/product/pro-paddle` matches more than one row.
- Users get the wrong product, a database “multiple rows” error, or nondeterministic routing.

For SKU:

- Global uniqueness lets one seller occupy another seller’s desired SKU and is usually unnecessarily restrictive.
- Product-only uniqueness permits duplicate SKUs across products in one shop, which complicates seller fulfillment/imports.
- A practical scope is generally `(shop_id, normalized_sku)`, while carts and orders must reference immutable `variant_id`, never SKU text.

These constraints must be database constraints, not pre-insert client checks; otherwise concurrent inserts pass the check and create duplicates.

## Phase 3 blocker: boolean inventory cannot support ordinary checkout semantics

A boolean can mean either:

- “at least one is available,” in which case concurrent buyers can all order and oversell; or
- “exactly one unit is available,” in which case an atomic compare-and-set allows only one purchase before manual restocking.

It cannot correctly represent quantities, cart quantity greater than one, reservations, cancellation/restock, partial fulfillment, or concurrent decrements.

This does not make a browse-only Phase 2a impossible. It does mean Phase 3 must add a real inventory model and transactional reservation logic. Do not let orders store only current product/variant references; they will also need immutable snapshots of title, SKU, price, seller, and selected options as they existed at purchase time.

## Rollback reality

A Git revert is not a rollback for this release.

After applying the migrations:

- tables, policies, triggers, seed rows, and storage configuration remain until a deliberate forward migration changes them;
- removing the migration file creates ledger/schema drift;
- uploaded public objects remain in Storage;
- URLs already shared or indexed cannot be “unpublished” without deleting/revoking the objects;
- bot HTML remains in the old KV prefix until TTL or a prefix bump;
- PWA image responses can remain on user devices for 30 days.

The safe rollback unit is a tested forward disablement migration plus application feature flags, media deletion/revocation procedures, and cache purge procedures. Never remove already-applied migration files from the ledger.

## Minimum go-live conditions

1. Remove prototype chunks and restore meaningful bundle headroom.
2. Apply Phase 1 and Phase 2 migrations to staging and execute the pgTAP suite; currently even Phase 1 is unexecuted.
3. Use private staging media and promote only approved assets to immutable public keys.
4. Add role-aware catalog authorization and an AAL2 admin storage-delete bypass.
5. Implement revision-based moderation with conditional approval.
6. Add exact KV invalidation and define a real image takedown strategy; 30-day `CacheFirst` is incompatible with urgent moderation.
7. Verify anonymous RLS for products, variants, and media using direct REST calls.
8. Enforce globally normalized product slugs and shop-scoped normalized SKUs in Postgres.
9. Preserve applied migration files and prepare forward rollback/disable migrations.

Without these, the concrete launch failure is: **a seller photo can become publicly reachable before approval, Cuong may be unable to delete it through the app, and after suspension cached copies can remain visible to bots for six hours and to previously loaded PWAs for thirty days.**
