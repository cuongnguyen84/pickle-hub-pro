# Phase 2b — Admin moderation + public Shop

> Branch `feat/shop-production-phase-2b` · worktree `.claude/worktrees/shop-p2b`
> Base `afdb9a0a` (P2a Product Owner acceptance PASS locally) · written 2026-08-12
>
> Nothing in this document is deployed, merged, pushed, or applied to a remote
> database. The status vocabulary from `production-implementation-map.md`
> applies: `UI parity complete` · `data layer complete` · `security verified
> locally` · `preview ready for Product Owner` · `production deployment pending
> approval`. The phrase "production ready" is not used.

---

## 0. What the Product Owner has to decide

Two of these block writing code; the rest can be answered while P2b is built.

| # | Decision | Blocks | Default if unanswered |
|---|---|---|---|
| **Q1** | Should the pilot allowlist gate **reads**, not just seller actions? Today a `support` member and a shop member who is not on the allowlist can both read their own shop's drafts, because `products_select_member` grants it. §3.2 has the evidence. | Nothing in P2b — but it changes the RLS both the admin queue and the public read model sit on, so it is cheaper to answer now than after P2b.2. | Keep P2a behaviour. Membership gates reads; the allowlist gates actions. |
| **Q2** | **Slug redirects.** `product_slug_update` and `shop_slug_update` change a URL with no forwarding. Once the PDP is public and indexed, every slug change is a 404 for buyers and a dropped ranking. §9 offers three options. | **P2b.6.** A public PDP without an answer here ships a known link-rot bug. | Option A (slug history table + 301) — the only one that does not lose the link. |
| Q3 | Category taxonomy ownership: `product_categories` is seeded from the prototype's list. Public category pages make that list an SEO surface — who owns adding/renaming, and does renaming change the slug? | P2b.4 category pages; not the build, only the content. | Slugs frozen once public; names editable. |
| Q4 | Is `/shop` allowed to be indexed while the catalogue is nearly empty? An indexed marketplace with three products invites a thin-content assessment. | P2b.6 sitemap + robots. | Ship the routes indexable but keep `/shop` out of the sitemap until N products are approved; N is Q4's real content. |

**Q1 and Q2 are the only two that change what gets built.** Everything else in
this proposal proceeds under the stated default.

### Documents named in the brief that do not exist

`docs/proposals/shop-marketplace-plan.md` and
`docs/proposals/shop-marketplace-product-owner-test-cases.md` are **not in the
repository**. `production-implementation-map.md` cites both in its header, so
they existed at some point outside git or were never committed. Nothing in this
proposal depends on them; where the map summarises them, the map is used. This
is recorded rather than worked around silently.

### `/idea` tooling, again

`scripts/agents/` contains only `risk-tier.mjs` and `soak-watch.mjs`.
`debate-ledger.mjs` and `ask-model.mjs` still do not exist — the same gap
`shop-marketplace/proposal.md` recorded on 2026-08-09. No round-2 panel
artefacts are fabricated here and no replacement framework is invented. The
review is inline, in this document, and its conclusions are traceable to
file:line evidence.

---

## 1. Scope

### In

| # | Checkpoint | Deliverable |
|---|---|---|
| 0 | **Performance** | Bundle attribution + headroom. **DONE** — §2 |
| 1 | Moderation backend | Server operations for queue, approve, reject, request-changes, unpublish, contact moderation, audit |
| 2 | Admin moderation UI | `/admin/shop/products`, `/admin/shop/products/:id`, contact moderation |
| 3 | Public read model | Public wrappers, query shapes, indexes, pagination |
| 4 | Discovery | `/shop`, `/shop/search`, `/shop/category/:slug` |
| 5 | PDP + shop page + contact CTA | `/shop/product/:slug`, `/shop/store/:slug`, D2 CTA |
| 6 | SEO / prerender | Metadata, JSON-LD, sitemap, canonical, slug redirects |
| 7 | QA + completion | Test pack, responsive/a11y, Product Owner script |

### Out

Cart, checkout, orders, COD, VietQR, payment, payout, returns, disputes,
reviews, Phase 3.

**Saved products / wishlist is OUT.** The brief made this conditional on the
implementation map confirming it. The map does not:
`production-implementation-map.md` §1 puts "Wishlist, cart, one-shop checkout,
idempotent order creation, inventory" in **P3a**. Prototype B07 exists, but B07
depends on B08's cart to be useful ("move to cart" is half its content), and
building a saved list in P2b would either ship a dead-end button or drag cart
into P2b. Not built, not stubbed.

### Deliberately not decided here

Whether the public Shop gets a nav entry. `shop-marketplace-plan.md` §0's hard
constraint "no 6th slot in the bottom nav" is quoted in the approved proposal
and survives. P2b routes are reachable by URL and by the seller/admin surfaces;
where discovery entry points live is a separate change.

---

## 2. Checkpoint P2b.0 — performance (DONE)

Two commits, both landed before any feature code.

| | Total gz | INITIAL | CODE | Headroom |
|---|---:|---:|---:|---:|
| P2a base `afdb9a0a` | 1964.0 | 226.0 | 1580.1 | 6.0 |
| after `6210ece1` | **1909.3** | 226.0 | 1525.4 | **60.7** |

Freed **54.7 KB gz**. Target was 30 minimum / 40 preferred. Backstop stays
**1970 — not raised**.

### Attribution, before touching anything

Per-module, decoded from sourcemaps across all 418 chunks
(`vite build --sourcemap`, mappings decoded to attribute generated bytes back
to source modules):

| Area | gz | Note |
|---|---:|---|
| app routes + shared | 901.2 | 319 chunks, long tail, no single offender |
| blog content | 383.9 | 51 per-slug lazy chunks |
| **video stack** | **297.1** | hls.js 511.9 KB min + media-chrome 185.0 + mux-embed 91.8 + mux-player 47.5 + playback-core 44.9 + mux-video 18.1 |
| admin | 82.2 | 25 chunks |
| vendor-ui | 81.7 | |
| locale en+vi | 68.5 | both ship; the site is bilingual |
| seller (P2a) | 46.6 | 13 chunks |

Findings from the audit list the brief required:

- **Duplicate modules: none.** 0 KB across 0 modules — nothing is emitted into
  two chunks. The barrel-import waste this audit usually finds is not present.
- **Accidental eager imports: none.** INITIAL is 226.0 KB over 6 requests, 54 KB
  under budget; every heavy surface is behind a route or interaction boundary.
- **Prototype residue: none** in the production artifact (guard in
  `check-bundle-size.mjs` greps emitted JS for four prototype string literals).
- **Icons / date utils / charts:** lucide-react 37.7 KB min tree-shaken,
  date-fns 32.0, charts already removed by perf-js-gzip.
- **Dead feature code:** one item, below.

So the entire opportunity was the video stack, and the long tail was already clean.

### What was done

1. **`src/components/video/HlsPlayer.tsx` was dead** — exported from
   `components/video/index.ts`, imported by nobody, 362 lines. Deleted: −1.8 KB.
   Its real value is that it was the last direct `hls.js` importer in `src/`.

2. **hls.js → light build.** With `HlsPlayer` gone, the only importer of
   `hls.js` is `@mux/playback-core`, by bare specifier. A `resolve.alias` in
   `vite.config.ts` catches that import too, so one small copy ships instead of
   one large one: **−52.9 KB**.

The light build drops subtitles/CEA-708, alternate audio, EME/DRM, CMCD and
interstitials. Verified unused rather than assumed:

| Dropped | Evidence it is unused |
|---|---|
| captions | zero `caption`/`subtitle`/`texttrack` references in `src/components/video`, `WatchLive`, `WatchVideo`; zero `generated_subtitles` anywhere |
| DRM | no `drm_configuration` in any edge function. `mux-create-livestream` takes `playback_policy: "public" \| "signed"`; **signed is a JWT on the URL, not Widevine/FairPlay** |
| alt audio | single-track match video |
| CMCD | Mux Data analytics rides on `mux-embed`, which is untouched |

**Proven in a browser, not by reading `dist`.** A Playwright harness mounted the
real `<mux-player>` element through this alias against a live Mux HLS asset:
`currentTime` reached 0.57s, zero player errors, zero console errors, while
asserting `subtitleTrackController` and `emeController` were *absent* — i.e. the
light build is what decoded the video. The harness was removed after the run;
the reproduction is in the commit message of `6210ece1`.

**The failure mode is silent**, which is the whole reason there is a guard:
light keeps `hls.subtitleTracks` and friends and simply reports nothing, so
captions enabled later would look wired up and play without them.
`src/components/video/__tests__/hls-light-build.test.ts` pins the alias and
fails the moment caption or DRM configuration appears in `src/` or
`supabase/functions/`. Both assertions proven red first.

### Rejected, with numbers

| Option | gz | Why not |
|---|---:|---|
| Drop `@mux/mux-player-react`, use raw hls.js + native controls | ~110 | Removes Mux Data analytics, the player UI, thumbnails. Removing working features is out of bounds. |
| Move blog post bodies to fetched `.json` | ~384 | `check-bundle-size.mjs` only walks `.js`, so this "frees" 384 KB by renaming files. That is gaming the metric, and it breaks the SSR barrel path CLAUDE.md warns about. |
| Move `dupr-rankings.ts` (37.8 KB min) out of JS | ~9 | Same objection, one twentieth the payoff. |
| Ship one locale | ~34 | The product is bilingual. |

### The structural finding, for the record

`perf-budgets.md` separated CODE from CONTENT *because* "counting them as code
made the budget creep on each post" — but the **total backstop still counts
blog content**. CONTENT has grown 353.2 → 383.9 KB (47 → 51 chunks) since
2026-07-17: **+30.7 KB of a code budget consumed by four articles**, which is
almost exactly the headroom P2b needed. Every future post takes ~7.5 KB from
whatever feature ships next.

This is not fixed here, and the backstop is not raised. It is flagged because
the next feature after P2b will hit it again, and the honest fix — excluding
CONTENT from the total the same way it is excluded from CODE, or ratcheting the
total against a CODE-only line — is a budget decision, not an engineering one.

---

## 3. Security closure carried into P2b

### 3.1 What was proven

`product_public_projection(_id, _as_seller)` goes on a public route in P2b, so
its second argument stops being an internal detail: a plain boolean, from a
client, into a `SECURITY DEFINER` function. `shop_p2b_projection_authz.test.sql`
(25 assertions, commit `bd42302b`) states the rule rather than listing examples:

> `projection(id, true)` succeeds **iff** the caller can already `SELECT` that
> product row under RLS.

Six actors are asked both questions in the same session and the answers
compared. It holds for all six, and it keeps holding for roles nobody has added
yet. Also pinned: anon cannot borrow the flag; an unknown id and a forbidden id
return the *same* error so the error code is not an oracle; approve / publish /
active-shop are three independent conditions each sufficient to remove the
product; an admin at aal1 is refused.

One thing the test found that is better than what was asked for: the state
"no longer approved but still flagged public" is **unrepresentable** — the
`products_publish_requires_approval` CHECK refuses it. There is no such row for
the projection to have to filter.

Proven red first by replacing the in-function authorization with `NULL` on the
local database: exactly 5 assertions went red, then restored to green.

### 3.2 What is open — Q1

The brief asked for proof that a `support` member and a non-pilot member are
**denied** `_as_seller=true`. They are not denied, and the test records that as
observed behaviour:

```sql
-- 20260811120000_shop_phase2a_catalog.sql:299
CREATE POLICY "products_select_member" ON public.products
  FOR SELECT TO authenticated
  USING (public.is_shop_member(shop_id) OR public.is_admin());
```

No pilot check, no role check. The projection is therefore **exactly as
permissive as the table**, not more — passing `true` buys nothing that
PostgREST would not already serve from `/rest/v1/products`. Tightening only the
function would be theatre.

If Q1 comes back "reads should be gated too", the change is
`products_select_member` first and the projection second, and it lands before
P2b.2 because the admin queue reads the same policy.

### 3.3 What P2b adds regardless — the separate public API

The brief's preferred architecture is right and is adopted: **the public route
never calls a function that accepts a privilege flag.** P2b.3 ships

- `product_public_view(_slug text)` — no boolean, no id-guessing, resolves the
  slug and returns the public projection or "not found";
- `product_seller_preview(_id uuid)` — the authorised path, unchanged
  semantics;

both delegating to the one canonical projection so there is still a single
derivation. `product_public_projection(_id, _as_seller)` stays as the internal
implementation. This removes the escalation class at the API edge instead of
defending it, which matters more once the function is reachable by anyone.

---

## 4. Dependency graph

```
P2b.0 bundle  ── DONE
   │
P2b.1 moderation backend ─────┐
   │                          │
P2b.2 admin UI                │   (P2b.3 needs P2b.1's contact + publish
   │                          │    lifecycle to know what is public)
   └──────────► P2b.3 public read model ◄─┘
                     │
        ┌────────────┴────────────┐
   P2b.4 discovery           P2b.5 PDP + shop + contact CTA
        └────────────┬────────────┘
                P2b.6 SEO / prerender
                     │
                P2b.7 QA + completion
```

P2b.4 and P2b.5 are parallelisable but share the card component from P2b.3, so
they are sequenced 4 → 5 to avoid two card implementations.

---

## 5. Route + screen map

| Prototype | Production route | Component | State |
|---|---|---|---|
| A04 `/proto/shop/admin/products` | `/admin/shop/products` | `pages/admin/shop/AdminShopProducts.tsx` | new |
| A04 detail | `/admin/shop/products/:id` | `pages/admin/shop/AdminShopProductReview.tsx` | new |
| — | `/admin/shop/contacts` | `pages/admin/shop/AdminShopContacts.tsx` | new (no prototype; follows A03's shape) |
| B01 `/proto/shop/home` | `/shop` | `pages/shop/ShopHome.tsx` | new |
| B02 `/proto/shop/search` | `/shop/search` | `pages/shop/ShopSearch.tsx` | new |
| B03 `/proto/shop/category/:slug` | `/shop/category/:slug` | `pages/shop/ShopCategory.tsx` | new |
| B04 + B05 `/proto/shop/product/:slug` | `/shop/product/:slug` | `pages/shop/ProductDetail.tsx` | new |
| B06 `/proto/shop/store/:slug` | `/shop/store/:slug` | `pages/shop/ShopStore.tsx` | new |
| B07 wishlist | — | — | **P3a, not built** |

`/shop/sell` (Phase 1) already exists and keeps its `Disallow` in both robots
files; the `Disallow: /shop/sell` prefix does **not** match `/shop/search` or
`/shop/store`, so the new public routes are crawlable without editing robots.

Route conventions honoured: `lazyRetry`, one `MIRRORED` entry per bilingual
route (never a hand-written `/vi` pair — ARCH-05), `route-snapshot.json`
updated, admin routes behind `RequireAuth requiredRole="admin"` inside
`AdminMFAGate`. Buyer routes keep the global BottomNav; `/admin/shop/*` stays on
the existing hide-lists.

---

## 6. Data, RPC and RLS

### 6.1 No new state machine

P2a already built the moderation state machine, the guarded transitions, and the
RLS P2b consumes (map §11 D3). P2b adds **no second machine**. `product_decide`
and `shop_contact_decide` exist and are tested; P2b.1 extends them where the
brief requires something P2a did not build, and nowhere else:

| Need | P2a today | P2b.1 |
|---|---|---|
| approve / reject | `product_decide` | reuse |
| request changes with structured targets | `product_edit_sections()` exists and the seller side resolves deep links | **add** the moderator side: `requested_targets jsonb` on the decision, validated against `product_edit_sections()` so a target is always a real section, never a DOM index |
| unpublish / suspend | status transitions + `products_publish_requires_approval` | **add** revocation enqueue so the public rendition becomes unreachable, not merely unlinked (D1) |
| queue | RLS exists, no list RPC | **add** `product_moderation_queue(...)` with server-side counts + cursor |
| contact moderation | `shop_contact_decide` | reuse; **add** the queue read |
| idempotency | client-token pattern from `product_create` / `product_submit` | reuse verbatim |
| audit | `product_submission_events` (seller-readable) + `log_audit_event` (admin) | reuse both; moderation events go to the admin log, not the seller's history |

Every new transition keeps the P2a shape: admin AAL2, row lock, expected
version, guarded `UPDATE`, one append-only event, replay returns the first
answer. `log_audit_event` has **two overloads** and an ambiguous call raises
42725 — the P2a lesson; new calls are explicitly cast.

### 6.2 Public read model

Public wrappers (§3.3) plus list queries that never call the projection per
card. A card needs ~8 fields; the projection builds the whole PDP payload
including variants and media, so calling it per row is an N+1 with a JSON
builder attached.

| Surface | Shape |
|---|---|
| discovery / category / search | one indexed query over a `products × shops × primary media` join, keyset pagination on `(sort_key, id)`, filters pushed down |
| PDP | one `product_public_view(slug)` |
| shop page | shop header + the same card query filtered by shop |
| facet counts | separate aggregate query, not a second full scan per facet |

Indexes to add in P2b.3, each justified by a query in the plan:

- `products (status, is_published, category_slug, <sort>) WHERE status='approved' AND is_published` — partial, because the public reader never looks at anything else
- `products (shop_id) WHERE status='approved' AND is_published`
- text search: **not** `ILIKE '%q%'`. Vietnamese needs unaccented matching, so a
  generated `search_doc tsvector` column + GIN, with `unaccent`. The exact
  choice is measured in P2b.3 against a seeded dataset and the `EXPLAIN` output
  recorded; if `pg_trgm` beats it for short queries at our size, that is what
  ships, with the plan as evidence.

Seed dataset for query shape only, torn down completely (P2a's teardown lesson:
rows *and* bytes).

### 6.3 Contact channels (D2)

Public read is `approved AND is_public AND shop.state='active'`, enforced in
SQL. Changing a channel's normalised value returns it to `pending` — already the
P2a behaviour. Admin can approve / reject / disable per channel with a
seller-visible reason and a separate internal note. Account email and account
phone are never exposed. Unsafe URLs cannot be approved: the scheme allowlist is
checked server-side at decision time, not only at entry.

---

## 7. The "Liên hệ shop" CTA (D2)

P2b has no cart, so the PDP must not pretend otherwise.

- Primary CTA is **Liên hệ shop** when an approved public channel exists.
- With no approved channel, the PDP says so plainly. No disabled "Thêm vào giỏ",
  no fake checkout, no "coming soon" that implies a date.
- Supported: business phone, Zalo, Messenger — per the P2a contract.
- The outbound URL is **derived server-side** from the normalised value. The
  client never concatenates a link, so a malicious stored value cannot become
  one.
- No buyer PII in the URL — not a name, not a phone, not the product.
- Leaving-ThePickleHub is stated before the jump; `rel="noopener noreferrer"`,
  `target="_blank"`.
- Analytics records channel *type* + product id + shop id. Never the number,
  never the URL.
- Not called chat. Messaging is not built, so it is not implied.
- ≥44px target; the ChatFAB does not overlap it.

---

## 8. SEO / prerender

Public Shop pages need real SSR, not post-hydration metadata.

New renderers under `functions/_lib/render/`: `renderShopProduct`,
`renderShopStore`, `renderShopCategory`, `renderShopHome` — following the
existing `renderTournament` / `renderVenueDetail` shape, wired in
`functions/_middleware.ts`.

- Cache key `pr:v34:${pathname}` → **bump to `pr:v35`** when the shop renderers
  land, because SSR output changes.
- `?nocache=1` (exactly `1`) to force-refresh one path.
- **The legacy `prerender-worker` stays untouched.** It still serves production
  traffic.
- Metadata: title, description, canonical, robots, OG, Twitter, absolute image
  URLs from the approved rendition path (never a signed URL — D1).
- JSON-LD: `Product` + `Offer` with the real variant price and a truthful
  `availability`; `BreadcrumbList`; `Store`/`Organization` on the shop page only
  where the data supports it.
- **No** `aggregateRating`, **no** `review` — there are no reviews. Emitting an
  empty or invented rating is a manual-action risk and a lie.
- Unavailable product: `410` for a deleted slug with no successor, `404` for one
  that never existed, `301` for a renamed one (§9).
- `sitemap-shop.xml` added to the index, listing **approved + published in an
  active shop only**. Drafts and pending products can never enter it — the
  sitemap query is the same predicate as the public read.
- IndexNow on approve/unpublish, following the existing convention.

Cache invalidation must follow approve, price change, unpublish, suspend and
slug change. The `?nocache=1` path exists; P2b.6 wires the transitions to it so
a suspended product does not sit in KV looking alive.

---

## 9. Slug redirects — Q2

`product_slug_update` / `shop_slug_update` change the URL and nothing forwards.
While the catalogue is private this is invisible. The moment the PDP is indexed
it is link rot plus a ranking reset, and it is not recoverable after the fact
because the old slug is gone from the database.

| Option | Cost | What it buys |
|---|---|---|
| **A. Slug history table + 301** (recommended) | one table, one lookup in the renderer, one index | old links keep working forever; ranking transfers |
| B. Freeze slugs once published | ~zero | sellers cannot fix a typo in a public URL |
| C. Do nothing, document it | zero | every rename is a silent 404 |

A is recommended and assumed. If the Product Owner picks B or C, P2b.6 records
it as a **known limitation before public launch**, not as an oversight.

---

## 10. Bundle plan for P2b

Headroom after P2b.0 is 60.7 KB. Budget for P2b's own code:

| Checkpoint | Allowance gz |
|---|---:|
| P2b.2 admin UI | 12 |
| P2b.3 shared read model + card | 6 |
| P2b.4 discovery / search / category | 14 |
| P2b.5 PDP + shop + contact | 14 |
| P2b.6 SEO (Pages Functions — **not in the client bundle**) | 0 |
| reserve | 14 |

Every route lazy; admin split from buyer so a buyer never downloads the
moderation console. INITIAL must not move — it is measured at every checkpoint,
not only at the end. If a checkpoint exceeds its allowance: attribute, optimise,
and if still red, stop and report the delta. **The backstop is not edited.**

---

## 11. Test plan

Per checkpoint, and each must show at least one red-before-green:

| Checkpoint | Red-before-green |
|---|---|
| P2b.1 | an authorization/RLS failure + an invalid-transition failure |
| P2b.2 | a UI regression (permission-denied / stale-row state) |
| P2b.3 | a projection assertion — an unpublished row visible in a list query |
| P2b.4–5 | a QA regression at 375px + a contact-channel leak |
| P2b.6 | a draft product reaching the sitemap |

Full gate at completion: `supabase db reset` (ledger parity), all pgTAP, storage
integration, unit/component, `tsc -b`, eslint, build, `BUNDLE_STRICT=1`,
prototype artifact guard, `build:proto`, Q01–Q04, seller QA, admin + buyer P2b
QA, SEO/schema, prerender, query-plan evidence, full teardown.

Responsive/a11y at 320 / 375 / 390 / 414 / 768 / 1440 with **real Playwright
context viewports and `window.innerWidth` asserted at every size** — the P2a
lesson: a gate that reports "375px clean" from a 1280px window is worse than no
gate. `.tl-shop-header` must stay opaque; a translucent header makes axe unable
to determine contrast, which reads as a pass.

---

## 12. Observability

`log_audit_event` (explicitly cast — 42725) for every moderation decision, with
the shop id, product id, from/to status and the decision, and **never** the
internal note body, a storage path or a signed URL. Journey instrumentation via
`src/lib/journeys.ts` for the buyer path (`shop_discovery`: view → search →
PDP → contact) and the moderator path.

Queue health matters once real submissions arrive: oldest-pending age is the
number that says a moderator has stopped looking. That belongs to the deployment
checklist, not to P2b's code.

---

## 13. Rollback

Every P2b object is additive: new tables/columns for slug history and requested
targets, new functions, new routes, new renderers. No P2a object is altered
destructively.

- **App code**: `git revert` disables every screen. The routes are new, so
  reverting cannot orphan an existing link.
- **SSR**: reverting the renderer registration returns the paths to the SPA
  shell; bump `pr:v` again to clear KV.
- **Database**: reverse SQL ships in the PR body, `DROP` in dependency order.
- **The one-way door**: an approved product that has been publicly indexed. A
  revert removes the route; it does not remove the URL from Google. That is what
  §9 and the sitemap predicate are for, and it is the reason nothing is indexed
  before the Product Owner says so.

---

## 14. Deployment prerequisites — unchanged and still open

P2b completion is not deployment. The three P2a blockers are untouched:

1. **The media cleanup worker and its cron are not deployed.** Until they are,
   revoked objects stay addressable by anyone holding a URL. P2b makes this
   *worse* in kind, not in code: unpublish and suspend become buyer-visible
   promises that the bytes are gone.
2. **`shop_pilot_members` is empty.**
3. Admin moderation UI — this is what P2b.2 builds.

Plus, for P2b specifically: cron secret in vault, queue health alert, migrations
applied in order, `gen types` re-run and `shop-schema.ts` + `shop-client.ts`
deleted, admin AAL2 tested against the real project, media revocation tested,
public visibility tested, SEO verified with `curl -A "Googlebot"` **and a word
count on the body** (the 2026-08-05 miss had perfect tags and an empty article),
rollback rehearsed, Product Owner final acceptance.

None of it happens without a separate instruction.
