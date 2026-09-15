# ThePickleHub Shop — Native iOS Parallel Development Plan

**Date:** 2026-08-11  
**Native stack:** SwiftUI  
**Web source of truth:** `docs/proposals/shop-marketplace/production-implementation-map.md`, especially D1–D4  
**Design reference:** the approved web prototype and `shop-marketplace-screen-tasks.md`  

## 1. Objective

Develop the buyer-facing Shop experience in the native iOS app in parallel with the web marketplace without duplicating business rules or coupling native delivery to unfinished web UI.

The web/Supabase implementation owns the marketplace domain, state transitions, RLS and public API contracts. Native iOS consumes those contracts and owns platform navigation, presentation, accessibility, caching and Apple-platform interactions.

## 2. Scope decision

### Native MVP

- Buyer discovery: B01–B07.
- Buyer transactions and support: B08–B15, only as their Phase 3 contracts become stable.
- Native deep links, notifications and authentication gates for buyer journeys.
- Shared Shop components, loading/empty/error/offline states and analytics events.

### Web-only for the first native release

- Seller surfaces S01–S10.
- Administrator surfaces A01–A05.
- Seller onboarding, product editing, moderation and dispute operations.

Seller/Admin routes may open the web experience from iOS when needed. Native implementations should be reconsidered only after real usage shows a clear mobile operational need.

### Explicitly excluded until separately approved

- Payment-provider integration and public marketplace launch (Phase 4).
- Internal buyer/seller chat.
- Multi-seller checkout.
- Client-side ownership of price, inventory, moderation, payment or order state transitions.

## 3. Parallel delivery model

Native work follows the server contract, not the completion percentage of web pages.

| Native stream | Can start when | Must wait for | Deliverable |
| --- | --- | --- | --- |
| N0 Architecture | Immediately | Nothing | Feature structure, repository protocols, fixtures, feature flag, navigation proposal |
| N1 Design foundation | Immediately | Nothing | Native tokens and reusable buyer components |
| N2 Discovery UI | Immediately with fixtures | Final public query shapes | B01–B07 SwiftUI screens using mock repositories |
| N3 Discovery integration | P2b API/RLS contract frozen | Approved public rendition and public catalogue | Real catalogue, search, PDP and store data |
| N4 Buyer intent | Wishlist contract frozen | Phase 3a | B07 persistence and authentication behavior |
| N5 Commerce | Cart/order RPCs frozen | Phase 3a security and idempotency verification | B08–B10 cart and checkout |
| N6 Post-purchase | Order/support contracts frozen | Phase 3b | B11–B15 orders, return, dispute and verified review |
| N7 Launch hardening | Preview environment stable | Phase 4 approval for real payment | End-to-end, performance, accessibility and release gates |

## 4. Contract gates

No native stream connects to production data until its gate passes.

### Gate C0 — Shared conventions

- Stable identifiers use UUIDs; slugs are navigation/display inputs, not ownership keys.
- VND is represented as integer minorless amounts, never floating point.
- Timestamps are UTC and decoded explicitly.
- Public and authenticated error codes have documented user-safe meanings.
- Pagination, sorting, filters and nullability are specified.
- Web and iOS analytics event names are reconciled.

### Gate C1 — Public catalogue (unlocks N3)

- Public Shop/Product/Variant/Media DTOs are frozen or exposed by versioned RPCs/views.
- Only active shops and approved/publishable products are readable anonymously.
- PDP reads only the approved public media rendition from D1.
- Unpublish, reject and suspend make the rendition unreachable.
- Variant availability, price range and inventory language are server-derived.
- Approved contact channels satisfy D2; outbound URLs contain no buyer PII.
- Search/filter/sort semantics and result counts are real, not client-derived guesses.
- Clean database reset and full pgTAP suite pass with assertion count recorded.

### Gate C2 — Buyer identity and wishlist (unlocks N4)

- Anonymous versus authenticated behavior is specified.
- Wishlist mutation is idempotent.
- Cross-user reads/writes fail under RLS.
- Account deletion and product unpublish behavior are defined.

### Gate C3 — Cart and checkout (unlocks N5)

- One-shop-per-checkout invariant is enforced on the server.
- Price, availability, seller and shipping terms are revalidated at commitment time.
- Cart mutations and order creation are idempotent.
- Concurrent inventory mutation is protected server-side.
- Expired, changed-price, unavailable and suspended-shop responses have stable error codes.
- No client can set payment/order status directly.

### Gate C4 — Orders and support (unlocks N6)

- Order and fulfillment state machines are documented and guarded server-side.
- Cancellation, return, dispute and review eligibility are server-authorized.
- Actor, next action and deadlines are present where the UI promises them.
- Notifications deep-link to stable native destinations without embedding PII.

### Gate C5 — Payment and launch (unlocks N7 release)

- Product Owner explicitly approves the provider and production migration/deployment.
- Payment initiation and reconciliation are server-owned.
- Native return/callback and interrupted-payment recovery are specified.
- “Submitted”, “awaiting reconciliation” and “paid” remain distinct states.

## 5. Native architecture

Additive target structure:

```text
ThePickleHub/
  Core/Shop/
    ShopModels.swift
    ShopRepository.swift
    SupabaseShopRepository.swift
    ShopError.swift
    ShopRoutes.swift
  Features/Shop/
    ShopRootView.swift
    ShopHomeView.swift
    ShopSearchView.swift
    ShopCategoryView.swift
    ProductDetailView.swift
    StoreDetailView.swift
    WishlistView.swift
    CartView.swift
    CheckoutView.swift
    OrdersView.swift
    OrderDetailView.swift
    Support/
    Components/
  DesignSystem/Shop/
    ShopTokens.swift
    ShopComponents.swift
Tests/Shop/
```

Implementation rules:

- Views depend on a `ShopRepository` protocol; fixtures and Supabase use separate implementations.
- Server responses map into explicit native DTO/domain models; do not mirror generated TypeScript types manually screen by screen.
- State transitions use RPCs/edge functions. Native never writes protected status columns.
- Reuse `TLColor`, `TLType`, `TLSpacing`, `TLRadius`, shared state views, haptics and image pipeline.
- Use structured concurrency and cancellation for search, pagination and image loading.
- Keep cart/order mutation state separate from presentation state so retries remain safe.

## 6. Screen mapping and native priority

| Web task | Native treatment | Priority | Dependency |
| --- | --- | --- | --- |
| B01 Shop home | Native | P0 | Fixture now; C1 to integrate |
| B02 Search | Native | P0 | Fixture now; C1 to integrate |
| B03 Category | Native | P0 | Fixture now; C1 to integrate |
| B04 Product detail | Native | P0 | Fixture now; C1 to integrate |
| B05 Variant selector | Native sheet/inline adaptive UI | P0 | Variant semantics from P2a |
| B06 Store detail | Native | P0 | C1 |
| B07 Wishlist | Native | P0 | C2 |
| B08 Cart | Native | P0 for commerce release | C3 |
| B09 Checkout | Native | P0 for commerce release | C3/C5 |
| B10 Order success | Native status screen | P0 for commerce release | C3/C5 |
| B11–B12 Orders | Native | P0 post-purchase | C4 |
| B13–B15 Support/review | Native after core order flow | P1 | C4 |
| S01–S10 Seller | Web handoff initially | Deferred | Web P1/P2a |
| A01–A05 Admin | Web only | Deferred | Web P1/P2b/P3b |

## 7. UX adaptation for iOS

The native app preserves the information hierarchy and trust rules of the prototype, not its desktop/web chrome.

- No sixth tab. During pilot, expose Shop from Home and a deep link; decide any permanent tab replacement using actual usage data.
- Shop gets its own `NavigationStack`; cart and search remain reachable from its toolbar.
- Product media uses native paging and zoom; variant selection uses a bottom sheet on compact widths.
- The PDP keeps seller identity, delivery/return terms and the D2 contact disclosure near the commitment action.
- Sticky commerce actions respect safe areas and keyboard presentation.
- All touch targets are at least 44×44 pt and support Dynamic Type, VoiceOver and Reduce Motion.
- Preserve The Line tokens and lime action hierarchy in light and dark mode.
- Never show unsupported ratings, sold counts, discounts, inventory numbers or delivery promises.

## 8. Proposed iterations

### Iteration N0 — Foundation and contract pack

1. Create the Shop feature flag and pilot-entry behavior.
2. Define repository protocols and fixture-backed models for B01–B07.
3. Create a contract matrix mapping Swift fields to Supabase views/RPCs.
4. Define deep-link routes for shop, product, store, cart and order.
5. Add unit tests for money, URLs, state decoding and error mapping.

**Exit:** Native screens can be developed without importing web fixtures or reaching production tables.

### Iteration N1 — Buyer design foundation

1. Map commerce semantic tokens onto the existing iOS DesignSystem.
2. Build product card, price, seller identity, verification, stock, wishlist, quantity and policy components.
3. Cover loading, empty, error, offline, disabled, unavailable and success states.
4. Validate at supported iPhone/iPad sizes, Dynamic Type and both color schemes.

**Exit:** Component previews/tests are approved before composing screens.

### Iteration N2 — Fixture-backed discovery

1. B01 Shop home.
2. B02 search with debounce/cancellation.
3. B03 category/filter/sort.
4. B04 PDP and B05 variant selector, including variant-to-media mapping from finding P13.
5. B06 store and B07 wishlist shell/auth gate.

**Exit:** The six critical buyer states can be reviewed on a real device with deterministic fixtures.

### Iteration N3 — P2b integration

1. Freeze C1 with the web team.
2. Implement `SupabaseShopRepository` public reads.
3. Add pagination, caching, refresh and offline fallback.
4. Enforce D1 media and D2 contact behavior.
5. Run anonymous/authenticated negative-path integration tests.

**Exit:** Browse → search/category → PDP → contact shop works against preview data.

### Iteration N4 — Phase 3a commerce

1. Integrate wishlist and cart.
2. Enforce one-shop cart UX before checkout.
3. Implement checkout review and idempotent order submission.
4. Model changed-price, stock conflict, seller suspension and network interruption recovery.
5. Keep real payment disabled until C5.

**Exit:** A preview buyer can create exactly one valid order without client-owned trust decisions.

### Iteration N5 — Phase 3b post-purchase

1. Orders list/detail and status timeline.
2. Cancellation, return and dispute entry points.
3. Verified review eligibility/composer.
4. Push notification and deep-link coverage.

**Exit:** Every state shows actor, next action and deadline where supplied by the server.

### Iteration N6 — Release hardening

1. Contract tests against preview Supabase.
2. UI tests for the primary buyer funnel and interruption recovery.
3. VoiceOver, Dynamic Type, Reduce Motion and color-contrast pass.
4. Image/memory/network performance budgets.
5. Analytics parity and privacy review.
6. Payment-provider flow only after explicit C5 approval.

## 9. Cross-team operating cadence

### At every web schema/RPC change

- Update the production implementation map first.
- Record added/removed/renamed fields and semantics in a contract changelog.
- Provide one success fixture and all documented error fixtures.
- Run clean-reset pgTAP before declaring a contract ready.
- Notify native whether the change is additive or breaking.

### Twice-weekly contract review

- Web: report current phase, migration/RPC changes and failing gates.
- Native: report fixture parity, integration blockers and ambiguous states.
- Product Owner: approve/revise the next critical screen, not all 37 at once.

### Merge discipline

- Web and iOS changes remain in their respective trees.
- Native code never imports prototype TypeScript or web CSS.
- Shared truth lives in documented contracts and server tests.
- A breaking contract change updates web, contract fixtures and native decoding tests in the same coordination window.

## 10. Immediate next actions

### Web team

1. Finish P2a variants/inventory currently in progress.
2. Complete product media, submit-for-review and the moderation transition/security layer.
3. Publish the candidate C1 DTO/RPC shapes before starting P2b UI.
4. Obtain Product Owner approval of the six critical prototype screens.

### Native team

1. Begin N0 immediately.
2. Start N1 and fixture-backed B01–B05 in parallel with the remainder of P2a.
3. Do not connect public catalogue reads until P2b passes C1.
4. Do not start production cart/checkout integration until Phase 3a passes C3.

### Product Owner

1. Review B04, S02, S06, B09, A03 and B12/B14 using the existing checklist.
2. Resolve the still-open marketplace policy/payment/operator decisions before their gates.
3. Decide permanent Shop navigation only after the pilot produces usage evidence.

## 11. Definition of native readiness

A native Shop phase is ready only when:

- Its server contract gate passes and is backed by security tests.
- Normal, loading, empty, offline, permission, unavailable and server-error states are covered.
- No protected state transition is implemented as a direct table write.
- Vietnamese copy fits at accessibility text sizes without hiding the primary action.
- VoiceOver order, labels and announcements are verified.
- Deep links and authentication recovery return to the intended Shop destination.
- The web and native clients show the same price, variant, seller and order meaning for the same server record.

