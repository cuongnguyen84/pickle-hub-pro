# ThePickleHub Shop — Marketplace Product & Implementation Plan

> **Status:** Planning only — not approved for implementation yet  
> **Audience:** Claude Code and future implementation agents  
> **Product owner:** Cuong / ThePickleHub  
> **Prepared:** 2026-08-09  
> **Locale:** Buyer market is Vietnam; the existing EN/VI route model must remain supported  
> **Design inputs:** Hallmark v1.1.0 + UI/UX Pro Max review

---

## 0. Instructions for Claude Code

This document is a product and architecture handoff, not permission to implement every phase at once.

Before writing code:

1. Read the repository's current `AGENTS.md` and other applicable local instructions.
2. Inspect the current route, auth, admin, The Line design, Supabase migration, RLS, storage, SSR and test conventions.
3. Check the worktree and preserve unrelated user changes.
4. Produce a file-level implementation plan for **Phase 0 and one vertical slice of Phase 1 only**.
5. List every file to create, modify or delete. Do not delete or replace production route/component trees without explicit approval.
6. Stop for product-owner approval before applying migrations or integrating a real payment provider.
7. Do not interpret this document as authorization to deploy, register with external services, contact sellers, create payment accounts or change production data.

Hard constraints:

- Do not mark an order as paid merely because a VietQR image was displayed or scanned.
- Do not add a sixth item to the current five-slot mobile bottom navigation.
- Do not introduce a global `seller` app role as the ownership model.
- Do not expose seller identity documents or bank details through public buckets or permissive RLS.
- Do not invent marketplace metrics, testimonials, seller logos, ratings or stock.
- Do not build automatic seller payouts before the legal and payment-responsibility model is approved.
- Every destructive or financial state transition must be server-authorized, atomic and auditable.

---

## 1. Product decision

Build **ThePickleHub Shop** as a curated, multi-vendor pickleball marketplace for buyers in Vietnam.

Any authenticated user may apply to sell, but no applicant can publish products until an administrator approves the shop. The marketplace should initially optimize for trust, product discovery and reliable order handling—not feature parity with Shopee.

### Core promise

> Find pickleball gear that fits how you play, from sellers ThePickleHub has verified.

### Primary users

1. Vietnamese pickleball players buying equipment.
2. Small and medium Vietnamese pickleball retailers applying to sell.
3. ThePickleHub administrators reviewing shops, products and disputes.

### Initial product categories

- Paddles
- Balls
- Shoes
- Bags
- Clothing
- Grips and accessories
- Training equipment
- Used gear

### What the first release is not

- A general-purpose marketplace.
- A social-shopping or livestream-commerce product.
- A wallet, escrow provider or banking product.
- A dropshipping automation platform.
- An AI recommendation product.
- An auction platform.

---

## 2. Why the MVP is trust-first

The strongest current marketplace patterns converge on five foundations:

1. Seller verification and visible shop status.
2. Accurate descriptions, photos, inventory and origin location.
3. Shipping, return and refund terms shown before purchase.
4. Transaction-linked reviews and reputation.
5. A structured dispute process with administrator intervention.

eBay's marketplace guidance treats accurate listings, item location, delivery expectations and clear return terms as essential buyer-trust inputs. Its buyer-protection model covers missing items, damaged items and items that do not match their listings.

Baymard's marketplace research emphasizes product discovery and category-specific filtering. If a product attribute is displayed in the product list, shoppers generally expect to be able to filter by it.

Therefore, do not prioritize livestream commerce, loyalty points, AI recommendations or sponsored listings before the foundations above work reliably.

---

## 3. Design direction — Hallmark

### Selected tone

**Sport-performance + utilitarian**

The Shop must feel like a native part of ThePickleHub, not an embedded third-party storefront.

### Preserve from the existing product

- React 18, Vite, TypeScript and Tailwind conventions.
- Existing shadcn/Radix primitives.
- The Line theme and semantic tokens.
- Inter for normal interface text.
- JetBrains Mono for SKU, order codes, inventory numbers and tabular prices where appropriate.
- Existing court-green accent and restrained vermillion status color.
- Current bilingual route strategy.
- Existing auth, admin MFA and admin layout patterns.
- Existing safe-area and native-container behavior.

### Structural direction

Use a **Catalogue / Product Grid** structure. Do not lead with a large marketing hero.

Recommended shop landing order:

1. Search and category entry.
2. Compact category shortcuts.
3. Relevant filters and sorting.
4. Product catalogue.
5. Verified stores.
6. Buying guides from existing editorial content.
7. Seller application CTA.

Product grid:

- Desktop: 3–4 columns depending on available width.
- Tablet: 2–3 columns.
- Mobile: prefer 2 columns for compact cards; fall back to 1 column when translated names or actions cannot fit cleanly.
- Every media slot reserves dimensions using `aspect-ratio` or explicit width/height.
- Do not require horizontal carousel gestures to discover core inventory.
- Product cards must not contain nested ambiguous click targets.

### Visual rules

- Use semantic design tokens; do not add raw colors inside individual components.
- Prices use tabular figures.
- One primary CTA per screen or sheet.
- Sale styling must not overpower product title, price or seller identity.
- Use Lucide icons consistently; do not use emoji as structural icons.
- Avoid decorative gradients, neon effects, fake browser chrome and glass effects without functional purpose.
- Headings remain roman, never italic display headings.
- Motion communicates state only and respects `prefers-reduced-motion`.

### Hallmark anti-slop requirements

- No generic hero → three cards → CTA composition.
- No invented counts, ratings, discounts or testimonials.
- No repeated identical cards when content types need different hierarchy.
- No mobile horizontal overflow at 320, 375, 414 or 768 px.
- All actionable controls meet at least a 44×44 px touch target.
- Interactive components include default, hover, focus, active, disabled, loading, error and success states where applicable.

---

## 4. UI/UX Pro Max review

### Accepted recommendations

- Mobile-first validation at 375 px, then 768, 1024 and 1440 px.
- Minimum 44×44 px web touch targets.
- Product images reserve space to keep CLS below 0.1.
- Lazy-load non-critical images and split Shop routes from the main bundle.
- Full-screen filter sheet or bottom sheet on mobile.
- Mobile filter action says `Xem N sản phẩm`, remains sticky and applies all selected filters together.
- Desktop filters may update results immediately without disorienting scroll jumps.
- Seller application uses real labels, inline recovery guidance and autosaved drafts.
- Errors use text and icon, not color alone, and are announced to assistive technology.
- Checkout and seller onboarding have visible progress and predictable back/cancel behavior.
- Keyboard order follows visual order.
- Icon-only controls have accessible names.
- Skeletons or stable placeholders are used when content takes longer than approximately 300 ms.
- Route-level `React.lazy` is used for Shop, Seller and Shop Admin surfaces.

### Rejected recommendations

UI/UX Pro Max returned a vibrant/cyberpunk direction using Orbitron and JetBrains Mono as the general interface. Reject this direction because it conflicts with The Line, reduces commerce readability and makes the Shop feel like a separate product.

Also reject:

- Scroll-snap for the catalogue.
- Animated decorative patterns.
- High-chroma block layouts across all sections.
- Community-member showcases on the Shop landing page.
- Hover-only product controls.

---

## 5. Feature scope

### P0 — required for MVP

#### Buyer

- Shop landing and category pages.
- Search with useful empty, loading, offline and error states.
- Category-specific filters.
- Sort by relevance, newest, price ascending and price descending.
- Product detail with variants, inventory, seller, fulfillment and return information.
- Store detail page with verification status and policies.
- Wishlist.
- Cart grouped by seller.
- One-seller-per-checkout.
- Vietnamese delivery address.
- COD and a deliberately limited manual-payment path.
- Order detail and status history.
- Cancellation request according to order state.
- Return/refund request.
- Dispute escalation.
- Verified-purchase review after completion.

#### Seller

- Seller application and draft saving.
- Legal/contact identity fields.
- Private supporting-document upload.
- Pickup and return addresses.
- Bank payout information, private to authorized roles.
- Marketplace-policy acceptance with version and timestamp.
- Application status and administrator feedback.
- Shop profile and policies.
- Product, variant, media and inventory management.
- Order queue and order detail.
- Confirm, pack and ship actions.
- Tracking-code entry.
- Return/refund response.
- Basic sales and fulfillment summary.

#### Administrator

- Shop overview.
- Seller-application queue.
- Application detail and document viewer.
- Approve, reject and request-changes actions with a required reason.
- Suspend and reactivate shop.
- Product moderation queue.
- Order lookup.
- Return and dispute queue.
- Append-only audit history for every decision.
- Restricted-product and restricted-brand controls.

### P1 — after MVP reliability

- Shop coupons.
- Inventory-safe flash sales.
- Follow a store.
- Product questions and seller answers.
- Compare up to three paddles.
- Paddle finder based on level, play style and budget.
- Related products.
- Starter bundles.
- Seller analytics.
- Low-stock alerts.
- GHN/GHTK or another approved carrier integration.
- CSV product import.
- Push notifications for order state changes.

### P2 — only after marketplace liquidity exists

- Livestream commerce connected to current live infrastructure.
- Creator affiliate attribution.
- Sponsored listings with clear labels.
- Loyalty and referral programs.
- Personalized recommendation ranking.
- Seller subscriptions.
- Automated payouts and delivery-dependent fund release.

---

## 6. Seller onboarding and approval

### Application flow

```text
Authenticated user
  → Create draft
  → Business/contact identity
  → Pickup and return addresses
  → Bank/payout details
  → Upload supporting documents
  → Accept marketplace policies
  → Review and submit
  → Admin review
      ├─ Needs changes → applicant edits and resubmits
      ├─ Rejected → reason shown; appeal path if policy allows
      └─ Approved → shop activated
                      → first product submitted
                      → first product reviewed
                      → selling enabled
```

### Application states

```text
draft
submitted
under_review
needs_changes
approved
rejected
withdrawn
```

### Shop states

```text
pending_activation
active
restricted
suspended
closed
```

### Ownership model

Do not add `seller` to the global `app_role` enum. Use explicit marketplace ownership:

- `shops.owner_user_id`
- `shop_members.shop_id`
- `shop_members.user_id`
- `shop_members.role` with a marketplace-scoped enum such as `owner`, `manager`, `fulfillment`, `support`

This supports one user managing multiple shops and one shop having multiple staff members.

---

## 7. Buyer discovery and filters

### Global filters

- Price range.
- Brand.
- New or used.
- Rating, once statistically meaningful.
- In stock.
- Verified store.
- Ships from province/city.
- Fast shipping, only when backed by real SLA data.
- Promotion, only when the reference price is legitimate.

### Paddle-specific filters

- Weight.
- Thickness.
- Face material.
- Core material.
- Shape.
- Grip length.
- Grip circumference.
- Skill level.
- Play style: control, all-court or power.
- Certification where applicable and evidence-backed.

### Shoes and clothing

- Gender/unisex.
- Size.
- Width.
- Surface type.
- Color.
- Material.

### Used gear

- Condition grade.
- Actual-item photos required.
- Defect disclosure.
- Original purchase date when known.
- Remaining warranty when evidence exists.

Applied filters must remain visible and individually removable. Mobile filters must display the result count before application when technically feasible.

---

## 8. Cart and checkout model

### MVP decision: one seller per checkout

The cart may contain items from several shops, but the UI groups items by shop and creates a separate checkout/order for each shop.

Reasons:

- Shipping fees and fulfillment times differ.
- Return policies and pickup addresses differ.
- Refund ownership stays understandable.
- Settlement is much simpler.
- The platform does not need multi-party payment splitting in MVP.

### Checkout sequence

```text
Cart group
  → Delivery address
  → Shipping method
  → Payment method
  → Order review
  → Create order atomically
  → Payment/COD confirmation
  → Order detail
```

Requirements:

- Revalidate price, variant, stock, shop state and shipping availability on the server.
- Never trust totals submitted by the client.
- Reserve or decrement stock atomically.
- Use idempotency keys for order and payment creation.
- Persist an immutable snapshot of product name, SKU, variant, unit price, seller and policy version in each order item.
- An expired reservation must release stock safely.
- Prevent duplicate checkout on retry or double-tap.

---

## 9. Order state machine

Normal path:

```text
pending_payment
  → paid | cod_confirmed
  → seller_confirmed
  → packed
  → shipped
  → delivered
  → completed
```

Exceptional paths:

```text
pending_payment → payment_expired
pending_payment → cancelled
seller_confirmed → cancellation_requested → cancelled | seller_confirmed
delivered → return_requested → return_approved → returned → refunded
delivered → disputed → resolved_buyer | resolved_seller | partially_refunded
```

Rules:

- Define allowed transitions in one server-side source of truth.
- Client UI may request a transition but must not directly write the resulting status.
- Every transition records actor, previous state, next state, reason and timestamp.
- Refund and dispute outcomes require idempotency.
- Seller confirmation and shipping have explicit SLA timestamps.
- Automatic jobs must be retry-safe and observable in the existing operations framework.

---

## 10. Payment plan

### Existing capability

`src/lib/payment/vietqr.ts` is a render-only helper that constructs a VietQR image URL. It does not fetch bank data, verify a transfer or receive a payment webhook.

Therefore:

- Displaying a VietQR image is not payment proof.
- Scanning a VietQR image is not payment proof.
- A client callback is not payment proof.
- Only a trusted provider callback or authorized manual reconciliation may transition an order to `paid`.

### Suggested stages

#### Closed pilot

- COD.
- Optional direct seller VietQR with clearly labeled manual confirmation.
- One seller per order.
- No automatic payout.
- Restrict pilot to a small set of approved sellers.

#### Public launch

- Select a Vietnamese payment provider that supports signed callbacks/webhooks, refunds, reconciliation and the approved marketplace responsibility model.
- Evaluate MoMo Business and other locally supported providers.
- Store provider event IDs and enforce uniqueness.
- Verify webhook signatures server-side.
- Keep raw sensitive provider payloads out of general logs.

#### Future marketplace settlement

Only after legal and finance approval:

- Platform commissions.
- Seller balances.
- Scheduled payouts.
- Refund allocation.
- Chargeback allocation.
- Negative balance handling.
- Delivery-dependent release.

Do not assume Stripe Connect is available or contractually suitable for a Vietnam-based marketplace merely because its architecture is a useful reference.

---

## 11. Route plan

### Public buyer routes

```text
/shop
/shop/search
/shop/category/:slug
/shop/product/:slug
/shop/store/:slug
/shop/cart
/shop/checkout/:shopId
/shop/order/:orderCode
/shop/sell
```

### Seller routes

```text
/seller
/seller/application
/seller/products
/seller/products/new
/seller/products/:id/edit
/seller/orders
/seller/orders/:id
/seller/settings
```

### Admin routes

```text
/admin/shop
/admin/shop/applications
/admin/shop/applications/:id
/admin/shop/stores
/admin/shop/stores/:id
/admin/shop/products
/admin/shop/orders
/admin/shop/disputes
```

### Route integration requirements

- Mirror public routes under `/vi` using the repository's existing route convention.
- Preserve route-snapshot tests.
- Lazy-load buyer, seller and admin Shop route groups.
- Require authentication for checkout, order history, seller and admin surfaces.
- Require admin authorization for every `/admin/shop` route and repeat authorization server-side.
- Public product and store pages receive SSR metadata, canonical URLs, hreflang and structured data.
- User-specific cart/order data must never be emitted into cacheable public SSR HTML.

---

## 12. Navigation plan

The current mobile bottom navigation already contains five primary destinations. Do not add Shop as a sixth item.

### MVP discovery points

- A Shop entry in the mobile menu/Explore surface.
- A Shop section on the homepage.
- Shop results in global search.
- Contextual Shop links from buying-guide editorial content.
- A desktop navigation entry created by grouping lower-priority editorial destinations under `Khám phá`, subject to product-owner approval.

Do not silently remove Home, Live, Social, Feed or Tools from mobile navigation. Replacing a slot is a separate product decision based on measured Shop usage after launch.

---

## 13. Proposed data model

Names are proposals; Claude Code must compare them with current repository conventions before creating migrations.

### Seller and shop

```text
seller_applications
seller_application_documents
shops
shop_members
shop_addresses
shop_policies
shop_bank_accounts
```

### Catalogue

```text
product_categories
product_category_attributes
products
product_variants
product_attribute_values
product_media
inventory_movements
```

### Buyer intent

```text
wishlists
wishlist_items
carts
cart_items
```

### Transaction

```text
orders
order_items
order_status_history
payments
payment_events
shipments
shipment_events
```

### Trust and support

```text
returns
return_events
disputes
dispute_events
reviews
review_media
product_reports
shop_audit_events
```

### Later phases

```text
shop_follows
product_questions
product_answers
coupons
coupon_redemptions
seller_balances
payouts
```

### Data invariants

- Store VND amounts as integer values, never floating point.
- Store timestamps in UTC.
- Order items retain an immutable purchase-time snapshot.
- Review rows reference a completed order item.
- A user can review an order item only once unless an explicit revision model is added.
- Inventory changes are append-only movements plus a safely maintained current balance.
- Product slugs and shop slugs are unique and collision-safe.
- Public products must belong to an active shop.
- Unapproved or suspended shops cannot publish or receive new orders.
- Financial, order, dispute and audit records are not hard-deleted.

---

## 14. RLS and security requirements

Treat every marketplace table as denied by default.

### Public reads

Anonymous/public users may read only:

- Active shops' public fields.
- Published products and public variants.
- Public categories and filter attributes.
- Approved public reviews without private order metadata.

### Buyer access

Buyers may read only their own:

- Cart and wishlist.
- Addresses.
- Orders, payment summaries, shipments, returns and disputes.

### Seller access

Authorized shop members may access only the shops assigned through `shop_members`. Role-sensitive writes must distinguish owner, manager, fulfillment and support capabilities.

Sellers must not access:

- Other shops' orders or buyers.
- Full payment credentials.
- Other applicants' documents.
- Internal administrator notes.
- Platform-wide reports.

### Administrator access

Use existing `is_admin()`/admin-role conventions and Admin MFA. High-risk actions require explicit server-side authorization even when the UI is admin-gated.

### Sensitive data

- Seller documents go into a private storage bucket.
- Use short-lived signed URLs after authorization.
- Bank details should be encrypted or tokenized according to the selected provider and threat model.
- Avoid placing CCCD, bank data, phone numbers or addresses in logs, analytics, URLs or push payloads.
- Add rate limits to application submission, review creation, checkout and dispute endpoints.
- Sanitize seller-generated rich text; prefer constrained structured fields over arbitrary HTML.

### RPC/edge function boundaries

Use server-side RPCs or edge functions for:

- Submit/resubmit seller application.
- Approve/reject/request changes.
- Publish/unpublish product when moderation rules apply.
- Reserve inventory and create order.
- Apply order-state transition.
- Handle payment webhook.
- Request/approve return.
- Resolve dispute.

Each routine must define authorization, idempotency, locking and failure behavior.

---

## 15. SEO and structured data

Public catalogue surfaces should be indexable only when they contain useful, approved content.

### Product pages

- Unique title and description.
- Canonical URL.
- EN/VI hreflang when both versions exist.
- `Product` JSON-LD.
- `Offer` data only when price and availability are current.
- `AggregateRating` only when backed by real eligible reviews.
- Image dimensions and useful alt text.

### Store pages

- Store name, description, location and verified status.
- Public policies.
- Paginated product links.
- No public identity-document details.

### Thin and unsafe surfaces

- Noindex internal search permutations unless an SEO strategy explicitly approves selected landing facets.
- Noindex cart, checkout, account, order, seller and admin routes.
- Avoid unbounded faceted URLs in sitemaps.
- Suspended/unpublished products return the approved repository behavior, not stale cacheable product data.

---

## 16. Notifications

Reuse existing notification conventions where safe.

Notify:

- Applicant: submitted, needs changes, approved, rejected.
- Admin: new application and escalated dispute.
- Seller: new paid/COD order, cancellation request, return request and dispute.
- Buyer: seller confirmation, shipment, delivery, cancellation outcome, refund and dispute outcome.

Rules:

- Push and email contain no sensitive document or payment details.
- Every notification has a deep link to an authorized route.
- Delivery must be retry-safe and deduplicated.
- Notification failure never rolls back the underlying order transition.

---

## 17. Analytics and success criteria

Do not invent launch targets. Establish baselines during the closed pilot, then let the product owner approve thresholds.

### Buyer funnel events

```text
shop_view
shop_search
shop_filter_apply
product_view
wishlist_add
cart_add
checkout_start
order_created
payment_confirmed
order_completed
return_requested
dispute_opened
review_submitted
```

### Seller funnel events

```text
seller_apply_start
seller_apply_step_complete
seller_apply_submitted
seller_apply_needs_changes
seller_apply_approved
first_product_submitted
first_product_published
first_order_confirmed
first_order_completed
```

### Operational metrics

- Search zero-result rate.
- Product-view-to-cart rate.
- Checkout completion rate by payment method.
- Payment reconciliation failures.
- Oversell incidents.
- Seller confirmation time.
- On-time shipment rate.
- Cancellation, return and dispute rates.
- Administrator application-review time.
- Refund completion time.

Privacy requirement: do not send order contents, addresses, phone numbers, payment references or seller-document data to general analytics.

---

## 18. Accessibility and performance acceptance criteria

### Accessibility

- Normal text contrast is at least 4.5:1; large text/UI graphics meet applicable 3:1 requirements.
- Full keyboard access for search, filters, cart, checkout, seller forms and admin queues.
- Visible, immediate `:focus-visible` indicator.
- Meaningful product images have descriptive alt text; decorative media use empty alt text.
- Variant selection exposes selected, unavailable and disabled states semantically.
- Errors are linked to fields and announced.
- Order progress is understandable without color.
- Dialogs/sheets restore focus to their trigger on close.
- Reduced-motion mode removes nonessential spatial animation.
- Text remains operable at 200% zoom.

### Mobile

- Verify at 320, 375, 414 and 768 px.
- No horizontal page scroll.
- Primary actions are not hidden behind the existing bottom navigation or safe area.
- Touch targets are at least 44×44 px with at least 8 px practical separation.
- Filter and variant sheets have a visible close/back escape.

### Performance

- Shop route code is split from initial application load.
- Use responsive AVIF/WebP where supported and an explicit fallback.
- Hero/first visible product imagery is intentionally prioritized; below-fold imagery is lazy-loaded.
- Image dimensions/aspect ratios prevent layout shifts.
- Catalogue rendering remains responsive for large result sets; use pagination or cursor loading before considering virtualization.
- Measure before optimizing with React Profiler and existing web-vital instrumentation.
- Slow and offline states provide recovery rather than indefinite spinners.

---

## 19. Test strategy

### Database and RLS

- Anonymous user cannot read draft products or private shop fields.
- Buyer cannot read another buyer's order.
- Seller cannot read another shop's order or documents.
- Seller staff permissions match assigned role.
- Suspended shop cannot publish or accept new orders.
- Non-admin cannot approve a seller application.
- Storage policies prevent public KYC access.

### State machines

- Every allowed order transition succeeds once.
- Every illegal transition fails.
- Repeated idempotent request does not duplicate order, payment, refund or inventory movement.
- Concurrent checkout cannot oversell a variant.
- Payment webhook replay does not duplicate effects.
- Cancellation/return race resolves deterministically.

### Frontend

- Route parity for EN and VI.
- Catalogue filters and URL state.
- Seller filter sheet behavior at mobile widths.
- Variant unavailable/disabled behavior.
- Cart grouping by seller.
- Checkout double-submit protection.
- Seller autosave and resume.
- Admin approval reason requirement.
- Accessibility checks using existing axe/Playwright setup.

### E2E vertical slice

```text
User applies as seller
→ Admin requests changes
→ User resubmits
→ Admin approves
→ Seller creates product
→ Product becomes public
→ Buyer adds it to cart
→ Buyer creates COD order
→ Seller confirms and ships
→ Buyer sees delivered order
→ Buyer submits verified review
```

No test should require a real financial transfer in CI.

---

## 20. Delivery phases

### Phase 0 — decisions and compliance

- Confirm marketplace operator legal entity.
- Confirm Ministry of Industry and Trade registration path.
- Approve seller agreement and marketplace rules.
- Approve restricted-product policy.
- Select closed-pilot sellers.
- Decide COD/manual-payment boundaries.
- Produce threat model and data-retention schedule.

**Exit:** legal, financial and security responsibilities are documented.

### Phase 1 — seller and catalogue vertical slice

- Seller application schema and private documents.
- Admin review queue.
- Shop activation.
- Product/variant/media/inventory schema.
- Seller product editor.
- Public Shop, category and product pages.
- SSR/SEO foundation.

**Exit:** one approved seller can publish one real product safely; no checkout yet.

### Phase 2 — buyer transaction

- Cart grouped by seller.
- Address and shipping model.
- COD/manual-payment checkout.
- Atomic order creation and inventory reservation.
- Buyer/seller order views.
- Notifications.

**Exit:** closed-pilot order completes without manual database edits.

### Phase 3 — trust and operations

- Verified-purchase reviews.
- Cancellation, returns, refunds and disputes.
- Admin order/dispute tools.
- SLA monitoring and operational alerts.
- Analytics funnel.

**Exit:** support can resolve the main failure cases through product UI.

### Phase 4 — payment provider and public launch

- Signed webhook integration.
- Reconciliation and refund workflow.
- Provider failure monitoring.
- Compliance approval.
- Load, security and accessibility audit.
- Controlled rollout.

**Exit:** public launch criteria signed off by product owner.

### Phase 5 — growth

- Carrier integration.
- Product comparison and paddle finder.
- Coupons and bundles.
- Seller analytics.
- Affiliate, livestream commerce and sponsored listings only after measurement supports them.

---

## 21. Initial implementation slice for Claude Code

When authorized, begin with one reviewable vertical slice:

1. `seller_applications` and private application documents.
2. Applicant create/edit/submit/resubmit flow.
3. Admin list/detail/request-changes/approve/reject flow.
4. Creation of an approved but empty `shop` record.
5. Audit events and notifications.
6. RLS, storage-policy and integration tests.

Do **not** include products, checkout or payments in the same first PR unless the product owner explicitly expands scope.

Expected implementation artifacts after repository inspection:

- One or more timestamped Supabase migrations.
- Generated Supabase TypeScript types using the repository's normal process.
- Lazy-loaded seller application route(s).
- Lazy-loaded admin shop application route(s).
- Reusable state badge and decision form.
- Server-authorized submit and moderation routines.
- Unit/RLS/E2E tests proportional to the change.
- Documentation of required storage bucket and environment configuration.

---

## 22. Decisions that still require product-owner approval

Claude Code must not silently choose these:

1. Marketplace legal/operator entity.
2. Platform commission and seller fees.
3. Whether individuals without a registered business may sell.
4. Required KYC documents for each seller type.
5. Used-product policy.
6. Counterfeit and trademark enforcement policy.
7. Return windows and who pays return shipping.
8. Default seller-confirmation and shipping SLAs.
9. COD scope and fraud controls.
10. Payment provider.
11. Whether the platform or seller is merchant of record.
12. Seller payout schedule.
13. Data-retention periods for KYC and financial records.
14. Which existing desktop navigation item moves into `Khám phá` if Shop becomes top-level.

---

## 23. Legal launch gate for Vietnam

Because third-party sellers can list and transact, ThePickleHub Shop is expected to resemble a website/application providing e-commerce services rather than only a business selling its own goods.

Before public launch, obtain qualified Vietnamese legal review and complete the applicable Ministry of Industry and Trade process. The official registration guidance for a website/application providing e-commerce services describes submission of business registration/investment documents, operating plan, application and other supporting materials.

Required policy surfaces should include at least:

- Marketplace operating rules.
- Seller terms.
- Buyer terms.
- Payment policy.
- Delivery policy.
- Return and refund policy.
- Complaint and dispute-resolution process.
- Privacy and personal-data policy.
- Restricted/prohibited goods policy.
- Seller identity and contact disclosures required by law.
- Process for regulator requests and removal of unlawful listings.

This section is a launch gate and product requirement, not legal advice.

---

## 24. Research references

- Baymard Institute — Marketplace UX benchmark: <https://baymard.com/ux-benchmark/collections/marketplace>
- Baymard Institute — E-commerce filter UI research: <https://baymard.com/learn/ecommerce-filter-ui>
- eBay — Selling practices policy: <https://www.ebay.com/help/selling/protecting-selling/seller-protection-policy?id=4346>
- eBay — Money Back Guarantee: <https://www.ebay.com/help/eBay/protects/sellers?id=4210>
- eBay — Seller protections: <https://www.ebay.com/help/selling/selling-policies/selling-policies?id=4345>
- Stripe — Platforms and marketplaces architecture: <https://docs.stripe.com/connect>
- Stripe — Marketplace payment types: <https://docs.stripe.com/connect/marketplace/tasks/accept-payment>
- Stripe — Connected-account onboarding: <https://docs.stripe.com/connect/marketplace/tasks/onboard>
- MoMo for Business: <https://business.momo.vn/>
- Vietnam Ministry of Industry and Trade — E-commerce service registration process: <https://online.gov.vn/Huong-Dan/Quy-trinh-dang-ky-website-cung-cap-dich-vu-TMDT-RxS4BRCybW>
- Vietnam E-commerce Management Portal: <https://online.gov.vn/Gioi-thieu>

---

## 25. Definition of success for the first implementation PR

The first PR is successful when:

- An authenticated user can save and submit a seller application.
- Uploaded identity documents are not publicly accessible.
- A non-admin cannot read or decide another user's application.
- An MFA-authorized admin can request changes, approve or reject with a reason.
- The applicant sees the latest status and administrator-facing feedback intended for them.
- Approval creates or activates exactly one shop even when the request is retried.
- Every decision is auditable.
- EN/VI route behavior and existing app navigation continue to pass tests.
- Existing product functionality is unchanged.
- No payment, order or payout functionality is accidentally implied or enabled.

---

## 26. Benchmark synthesis — what to adopt and what to avoid

This section records the second research pass requested by the product owner. It covers Shopee Vietnam, Amazon Seller Central, Etsy, Shopify Shop/Product Network, eBay and Baymard's marketplace UX research. The goal is to combine proven patterns, not copy any competitor's visual design.

### Benchmark matrix

| Product | Strong pattern to adopt | Pattern to avoid or improve |
| --- | --- | --- |
| Shopee Vietnam | Familiar Vietnamese seller language; explicit listing rules; category, media, variation, weight and inventory requirements; strong local-commerce expectations | Dense screens, promotional noise, misleading cheapest-variant pricing and unclear variation boundaries must not be reproduced |
| Amazon Seller Central | Category-first product creation; structured tabs; variant matrix; bulk editing for price/SKU/stock | High cognitive load and seller jargon; ThePickleHub should progressively disclose advanced fields |
| Etsy | Low-friction shop setup; save/resume; seller story and shop identity; first-listing activation | Do not let a seller believe the shop is live before verification and moderation finish |
| Shopify Shop | Saved products, order tracking, follow store and verified-purchase reviews | Do not add loyalty/cash mechanics before the transaction foundation is reliable |
| Shopify Product Network | Persistent `Sold by`; per-seller shipping/return policy; fulfillment and support ownership remain visible | Multi-store checkout can fragment confirmation and support; MVP should create clearly separated seller orders |
| eBay | Buyer protection, seller standards, return handling and evidence-driven disputes | Avoid overly complex policy branching in the first release; use one clear baseline marketplace policy |
| Baymard | Category-specific filters, applied-filter visibility, mobile result counts, clear product-list information and low-friction checkout | Avoid generic filters, hidden costs, premature account walls and disorienting live updates in mobile filter sheets |

### Product principles derived from the benchmark

1. **Seller identity never disappears.** Every product card, product page, cart group, checkout summary and order displays who sells the item.
2. **A variant is not a different product.** A seller cannot insert an unrelated low-price accessory as a variant merely to lower the displayed catalogue price.
3. **Displayed prices are honest.** A price range appears only when valid variants genuinely differ. If a selected variant changes price, announce and visibly update it before Add to cart.
4. **The selected variant remains stable.** Media, SKU, price, stock and review filtering update together; the seller never changes when a variant changes.
5. **Shipping and returns are visible before checkout.** Users should not have to open legal pages to discover basic delivery cost, origin or return window.
6. **Review trust is relational.** A published review is linked to a real buyer, order and product/variant; seller staff and related parties cannot review their own products.
7. **Seller forms are progressive.** Required information is requested at the moment it becomes meaningful; advanced inventory/policy controls remain available without overwhelming first-time sellers.
8. **Recovery beats dead ends.** Every rejection, invalid listing, payment failure and shipping problem shows a specific next action.

---

## 27. Experience architecture and screen inventory

The initial complete product contains 29 distinct screens/surfaces. Claude Code should implement these incrementally, but must preserve the intended connections between them.

### Buyer surfaces

| ID | Route/surface | Job to be done |
| --- | --- | --- |
| B01 | `/shop` | Enter the marketplace and find a relevant product quickly |
| B02 | `/shop/search` | Search, filter and compare catalogue results |
| B03 | `/shop/category/:slug` | Browse a category using category-specific attributes |
| B04 | `/shop/product/:slug` | Decide whether a specific product/variant is right |
| B05 | Variant selector sheet | Select an available variant without ambiguity |
| B06 | `/shop/store/:slug` | Evaluate a seller and browse its products |
| B07 | Wishlist/save surface | Save products for later and return to them |
| B08 | `/shop/cart` | Review items grouped by seller before checkout |
| B09 | `/shop/checkout/:shopId` | Provide address, shipping and payment for one seller |
| B10 | Order success | Know exactly what happened and what happens next |
| B11 | Buyer orders list | Find an order by status, seller or date |
| B12 | `/shop/order/:orderCode` | Track fulfillment and access support actions |
| B13 | Return request | Request a return with evidence and understand next steps |
| B14 | Dispute detail | Communicate through a structured, auditable case |
| B15 | Review composer | Review a delivered product/variant as a verified buyer |

### Seller surfaces

| ID | Route/surface | Job to be done |
| --- | --- | --- |
| S01 | `/shop/sell` | Understand requirements and start selling |
| S02 | `/seller/application` | Complete and submit seller verification |
| S03 | Application status | Fix missing information or understand the decision |
| S04 | `/seller` | See what requires attention today |
| S05 | `/seller/products` | Find and manage product/listing status |
| S06 | `/seller/products/new` | Create a complete, valid product |
| S07 | `/seller/products/:id/edit` | Update product, variants, media and stock safely |
| S08 | `/seller/orders` | Prioritize orders by fulfillment deadline |
| S09 | `/seller/orders/:id` | Confirm, pack, ship or respond to a buyer issue |
| S10 | `/seller/settings` | Maintain shop profile, policies, staff and addresses |

### Administrator surfaces

| ID | Route/surface | Job to be done |
| --- | --- | --- |
| A01 | `/admin/shop` | Monitor marketplace health and urgent queues |
| A02 | `/admin/shop/applications` | Triage seller applications consistently |
| A03 | `/admin/shop/applications/:id` | Verify evidence and make an auditable decision |
| A04 | `/admin/shop/products` | Review listings and reported products |
| A05 | `/admin/shop/disputes` | Resolve buyer/seller disputes using evidence |

---

## 28. Buyer screen specifications

### B01 — Shop home

**Primary job:** start with a category, search query or trusted recommendation.

**Information hierarchy:**

1. Compact header: back/home context, `Shop`, search trigger, wishlist, cart count.
2. Full-width search field: `Tìm vợt, bóng, giày hoặc thương hiệu`.
3. Category shortcuts with icons and text.
4. `Phù hợp với bạn` only when based on explicit signals; otherwise use `Được quan tâm` and disclose ranking basis.
5. `Shop đã xác minh` strip.
6. Editorial buying guides sourced from existing ThePickleHub content.
7. Seller CTA: `Bạn có shop pickleball? Đăng ký bán hàng`.

**Interactions:**

- Search focuses immediately when the search field is tapped.
- Cart and wishlist display numeric badges only when non-zero.
- Category shortcuts are normal links and support open-in-new-tab on web.
- Product sections use `Xem tất cả`, never carousel-only discovery.

**States:**

- First visit: categories + popular/curated products.
- Returning user: recently viewed, then saved/followed-shop updates.
- Empty catalogue: do not render fake cards; show categories being onboarded and seller CTA.
- Offline: cached categories/recent products with an offline banner and retry.

**Acceptance:** useful products/categories appear without scrolling through a marketing hero.

### B02/B03 — Search and category results

**Primary job:** narrow a catalogue to a manageable set.

**Desktop layout:**

```text
Breadcrumb / title / result count
Search query                              Sort
┌──────── filter rail ───────┐ ┌──────── product grid ─────────┐
│ Applied filters            │ │ card card card                 │
│ Price                      │ │ card card card                 │
│ Category attributes        │ │ ...                            │
└────────────────────────────┘ └────────────────────────────────┘
```

**Mobile layout:**

```text
Back · Search field · Cart
Result count
[Lọc] [Sắp xếp]  applied-filter chips
2-column product grid
```

`Lọc` opens a full-height sheet with:

- A clear title and Close button.
- Expandable filter groups.
- Selected-value count per group.
- `Xóa tất cả` secondary action.
- Sticky primary action `Xem N sản phẩm`.

**Product card content:**

- Stable media ratio.
- Wishlist control with accessible label.
- Product name, maximum two lines.
- Selected/default price or honest range.
- Seller name and verification badge.
- One relevant commerce signal: shipping origin, condition or delivery estimate—not a row of badges.
- Rating only when the review count is non-zero.

**Behavior:**

- Filters are encoded in URL query parameters for share/back/refresh.
- Browser Back restores result position and filters.
- Applied filters remain removable above the results.
- Desktop may update immediately; mobile applies after the user confirms.
- New results preserve the title/filter context and announce count changes politely.
- Use pagination or cursor loading with a visible `Xem thêm`; do not create an endless list without position recovery.

**Zero results:** explain which filters caused the empty set, provide removable suggestions and preserve the query.

### B04 — Product detail

**Primary job:** answer fit, trust, total cost and delivery questions before purchase.

**Above the fold:**

```text
Breadcrumb
Media gallery       Product name
                    rating + verified-purchase count
                    price / selected-variant price
                    sold by [verified shop]
                    condition
                    variant selectors
                    stock + delivery summary
                    [Add to cart] [Buy now]
```

Mobile places media first and uses a sticky bottom action area that clears the existing app bottom navigation/safe area.

**Required blocks in order:**

1. Media gallery with selected-variant media.
2. Product title and honest price.
3. Seller identity and verification.
4. Variant selection and availability.
5. Delivery origin, estimated range and fee/status.
6. Returns summary.
7. Product highlights.
8. Category specification table.
9. Full description and disclosures.
10. Seller card.
11. Verified-purchase reviews.
12. Related products.

**Trust rules:**

- Never show `Đã bán`, countdown or scarcity unless backed by correct data.
- `Chỉ còn N` appears only under a product-approved threshold and current inventory.
- A verification badge opens an explanation of what ThePickleHub verified—and what it did not guarantee.
- Used products must show actual-item images and disclosed defects before Add to cart.
- Seller policies are accessible without leaving the purchase context.

### B05 — Variant selector

Use inline controls for one small option set; use a bottom sheet when combinations or mobile space require it.

**Content:** selected media thumbnail, product title, current price, stock, variation groups and quantity.

**Rules:**

- Disabled combinations remain visible but marked `Hết hàng`.
- Selecting one option filters impossible combinations in the other groups.
- Price, SKU, media and stock update atomically.
- Add to cart remains disabled until required options are selected, with specific helper text.
- Never use unrelated add-ons as variants.
- Close/Back preserves the previous valid selection.

### B06 — Store detail

**Header:** shop avatar/logo, name, verification, location, joined date, response/fulfillment facts when meaningful, Follow and Contact.

**Tabs:** `Sản phẩm`, `Giới thiệu`, `Chính sách`, `Đánh giá shop` only when the data exists.

**Rules:**

- Do not expose private owner identity documents.
- Display seller legal/contact disclosures required for the approved seller type.
- Suspended shops show a safe status page; products cannot be purchased.
- Contact opens platform messaging/support context where possible, not an exposed personal phone number by default.

### B07 — Wishlist

- Saved-product list with latest price and availability.
- Explicitly label price changes; never manufacture urgency.
- Removed/unpublished products remain as a compact unavailable record long enough for user comprehension, then can be dismissed.
- Moving to cart revalidates seller, variant and stock.

### B08 — Cart

**Primary job:** review seller-separated commitments before checkout.

```text
Cart
┌ Shop A · verified ─────────────────────┐
│ item · variant · qty · price           │
│ shipping estimate                     │
│ subtotal              [Checkout Shop A]│
└────────────────────────────────────────┘
┌ Shop B ────────────────────────────────┐
│ ...                                    │
└────────────────────────────────────────┘
```

**Rules:**

- Each seller group has its own selection state, subtotal and checkout action.
- Explain once: `Mỗi shop được thanh toán và giao riêng`.
- Quantity changes are optimistic only when rollback is safe and clearly communicated.
- Out-of-stock/price-changed items are isolated with a repair action, not silently removed.
- Delete supports Undo rather than an unnecessary confirmation dialog.
- Checkout button says the selected seller and total where space allows.

### B09 — Checkout

Prefer a single scannable page with editable sections for MVP; do not create a long forced wizard unless payment-provider requirements justify it.

**Sections:**

1. Seller/order identity.
2. Delivery address.
3. Shipping option and estimate.
4. Payment method.
5. Items and immutable price summary.
6. Seller/marketplace policy links.
7. Final total.
8. Primary `Đặt hàng` action.

**Behavior:**

- Prefill saved address but make editing obvious.
- Use Vietnamese province/district/ward data from an approved maintained source.
- Phone uses `inputmode="tel"`; postal/amount fields use appropriate input modes.
- Show all mandatory fees before the final action.
- Final action changes to a loading state and cannot be double-submitted.
- If stock/price changes, return the user to the affected summary item and require reconfirmation.
- On recoverable payment failure, keep the order/address and provide Retry/change method.
- Never clear the cart before durable order creation succeeds.

### B10 — Order success

**Must answer:**

- Was the order created?
- Is payment complete, COD, or awaiting manual confirmation?
- Which shop fulfills it?
- When is the next expected update?
- Where can the buyer track/get help?

Actions: `Theo dõi đơn`, `Tiếp tục mua sắm`; no confetti requirement.

### B11/B12 — Orders list and detail

Orders list groups by meaningful status: `Cần thanh toán`, `Đang xử lý`, `Đang giao`, `Hoàn tất`, `Đã hủy/Hoàn tiền`.

Order detail hierarchy:

1. Human-readable status and next step.
2. Delivery timeline.
3. Seller and contact-support entry.
4. Items/variants.
5. Address and shipping.
6. Payment summary.
7. Cancellation/return/dispute actions permitted by state.
8. Audit-friendly status history.

Do not show disabled actions without explaining why or when they become available.

### B13/B14 — Return and dispute

Return request:

- Select item(s).
- Select standardized reason.
- Explain eligibility immediately.
- Add details and evidence.
- Choose requested resolution when policy allows.
- Review and submit.

Dispute detail uses a case timeline, not free-form chat alone:

- Claim.
- Seller response.
- Evidence from each party.
- Administrator request.
- Decision and financial/return action.

Every deadline is shown in Vietnam time and includes the consequence of missing it.

### B15 — Verified review composer

- Open only for delivered/completed eligible order items.
- Show the exact product and purchased variant.
- Rating required; text/media optional according to policy.
- Neutral prompt: never ask specifically for a positive rating.
- Explain public display name.
- One review per order item, with an explicit edit policy.
- Seller reply is visually distinct from buyer content.

Shopify's current Shop review model restricts reviews to purchasers and links imported reviews to customer, order and product IDs. ThePickleHub should follow the same trust principle.

---

## 29. Seller screen specifications

### S01 — Sell landing

This is an operational onboarding page, not a marketing funnel.

**Must show before Start:**

- Who may apply.
- Documents and information required.
- Review process and indicative steps without inventing an SLA.
- Core seller obligations.
- Current fee state: actual approved fees or `Chưa thu phí trong pilot`; never vague hidden fees.
- What verification means.
- Link to seller terms and restricted goods.

Primary action: `Bắt đầu đăng ký`. Secondary: `Tiếp tục hồ sơ` when a draft exists.

### S02 — Seller application

Use six autosaved steps:

```text
1. Loại người bán
2. Thông tin liên hệ/pháp lý
3. Thông tin shop
4. Địa chỉ lấy và trả hàng
5. Thanh toán và tài liệu
6. Kiểm tra và gửi
```

**Persistent shell:** `Bước X/6`, section title, save state (`Đã lưu`/`Đang lưu`/`Chưa lưu được`), Exit and Continue.

**Step 1 — seller type:** individual/household/business choices only if approved legally. Each choice reveals its document requirements.

**Step 2 — identity:** legal name, ID/business number, tax information where applicable, authorized representative and contact. Explain why each sensitive field is required.

**Step 3 — shop:** proposed name, slug preview, description, category focus, public contact method and logo. Check name availability without reserving misleadingly forever.

**Step 4 — addresses:** pickup, return and operational location; allow `same as pickup`.

**Step 5 — payout/documents:** bank-account holder match guidance, upload checklist, file status and secure replacement. Never show a permanent public document URL.

**Step 6 — review:** grouped summary with Edit links, versioned agreement checkbox and submit.

**Validation:**

- Validate normal fields on blur.
- Validate document type/size immediately before upload.
- Preserve valid fields after any failure.
- Error summary links to the first invalid field on submit.
- Browser Back does not discard the draft.

### S03 — Application status

Status drives the entire page:

- `draft`: completion checklist and Continue.
- `submitted/under_review`: read-only submitted snapshot, withdrawal rules and what happens next.
- `needs_changes`: administrator requests grouped by step, highlighted Edit actions and resubmit.
- `approved`: confirmation, shop activation checklist and Create first product.
- `rejected`: clear reason category, allowed appeal/reapply path and policy link.

Never use a generic red `Rejected` banner without a recovery explanation.

### S04 — Seller dashboard

**First screen question:** what must the seller do today?

Order content:

1. Attention queue: new orders, fulfillment deadlines, returns and document issues.
2. Compact operational stats: orders awaiting action, low-stock variants, current-period completed revenue only when reconciled.
3. Recent orders.
4. Product/listing issues.
5. Setup checklist for new shops.

No vanity charts in MVP. Each metric links to the filtered operational list behind it.

### S05 — Products list

Desktop uses a table; mobile uses product rows/cards.

Columns/signals:

- Thumbnail/name.
- Listing status: draft, pending review, active, needs changes, restricted, archived.
- Variant/SKU count.
- Price/range.
- Inventory summary.
- Last updated.
- Context menu.

Filters: status, category, stock condition and search by name/SKU.

Bulk operations begin with archive/activate only after authorization and validation; avoid broad destructive bulk editing in MVP.

### S06/S07 — Product create and edit

Use a sectioned editor with sticky completion/status rail on desktop and a step navigator on mobile:

```text
1. Category
2. Basic information
3. Media
4. Product attributes
5. Variants, price and inventory
6. Shipping
7. Returns and disclosures
8. Preview and submit
```

#### 1. Category

- Searchable category picker.
- Recently used categories.
- Category locks the attribute schema.
- Changing category after data entry warns which attributes will be lost.

#### 2. Basic information

- Vietnamese product name first; optional English translation.
- Brand with `Không có thương hiệu` as an explicit value, not blank ambiguity.
- Condition.
- Concise highlights and structured description.
- Inline listing-policy hints.

#### 3. Media

- Drag/reorder with keyboard-accessible Move controls.
- One designated cover image.
- Per-image upload/progress/error/retry.
- Variant media assignment.
- Actual-item image requirement for used goods.
- Minimum quality checks warn rather than silently reject where possible.

#### 4. Attributes

Category-driven fields; paddle examples include thickness, weight range, face/core material, shape, grip and play style. Display values become filter facets, so controlled vocabularies are preferred over uncontrolled free text.

#### 5. Variants

- Up to the approved number of option axes.
- Generate variant combinations visibly.
- Matrix columns: image, option values, SKU, price, compare-at price if legitimate, stock, status.
- Bulk apply price/stock values with preview and Undo where safe.
- Prevent duplicate SKUs.
- Prevent unrelated variant values.
- Catalogue card price is the selected default or an honest min–max range; never show only a bait minimum.

#### 6. Shipping

- Package weight and dimensions.
- Pickup location.
- Available shipping services.
- Handling time.
- Validation explains whether values affect fees or eligibility.

#### 7. Returns/disclosures

- Marketplace baseline policy plus approved seller-specific options.
- Warranty.
- Authenticity/certification evidence when claimed.
- Used-condition defects.

#### 8. Preview

- Mobile and desktop buyer preview using the real component.
- Validation checklist grouped into Errors and Recommendations.
- `Lưu bản nháp` secondary action.
- `Gửi duyệt` or `Xuất bản` primary action according to moderation state.

**Autosave and concurrency:**

- Display last saved time.
- Warn if another session changed the product.
- Never overwrite a newer server version silently.
- Leaving with an upload or unsaved mutation shows a precise warning.

### S08/S09 — Seller orders

Order list defaults to `Cần xử lý`, not all orders. Each row shows deadline, payment state, shipping method, buyer-safe name, item count and total.

Order detail action changes by state:

- New order: Confirm or Cancel with reason.
- Confirmed: Pack and arrange shipment.
- Packed: Add/confirm tracking.
- Shipped: View tracking; no false editable status.
- Return/dispute: Respond by deadline and upload evidence.

Shipping action must never be a client-only status toggle. Show the exact consequence before irreversible transitions.

### S10 — Seller settings

Sections:

- Public profile.
- Legal information, with controlled edit/reverification.
- Pickup/return addresses.
- Shipping settings.
- Return/warranty policies.
- Bank/payout information.
- Staff and roles.
- Notification preferences.
- Close shop.

Sensitive changes may require reauthentication and administrator review. Bank details are masked after save.

---

## 30. Administrator screen specifications

### A01 — Shop admin overview

Prioritize queues, not decorative charts:

- Applications awaiting review.
- Applications waiting beyond the approved internal SLA.
- Products reported/requiring review.
- Orders with payment reconciliation issues.
- Open returns/disputes by deadline.
- Suspended shops and recent high-risk audit events.

Each count links to the filtered queue. Never show a metric if the query definition is unclear.

### A02 — Application queue

Table fields:

- Applicant/shop.
- Seller type.
- Submitted/resubmitted date.
- Completeness/evidence flags.
- Risk/manual-review signals.
- Assigned reviewer if introduced.
- Status.

Filters persist in the URL. The queue supports keyboard navigation and does not expose document details until the authorized detail view opens.

### A03 — Application review

Three-column desktop composition, stacked on mobile/tablet:

```text
Applicant summary | Evidence/document viewer | Decision rail
```

Content:

- Submitted snapshot, not mutable live fields.
- Field-by-field comparison on resubmission.
- Secure document viewer with expiry/error state.
- Internal notes clearly separated from applicant-visible requests.
- Audit timeline.

Decision rail:

- `Yêu cầu bổ sung`: select affected step/field and write actionable request.
- `Phê duyệt`: confirmation summarizing what will be activated.
- `Từ chối`: required policy reason, applicant-visible explanation and reapply/appeal setting.

Destructive/high-impact decisions require explicit confirmation but not a typed magic phrase unless the threat model justifies it.

### A04 — Product moderation

- Preview exactly what buyers see.
- Show structured data and seller evidence side-by-side.
- Highlight validation/policy flags without treating automated flags as verdicts.
- Actions: approve, request changes, restrict/unpublish, restore.
- Require reason and audit every action.
- Product removal communicates impact on carts and open orders before confirmation.

### A05 — Dispute resolution

- Neutral case header and deadline.
- Order/payment/shipping facts.
- Buyer claim and evidence.
- Seller response and evidence.
- Internal notes.
- Allowed policy outcomes generated from state, not arbitrary free-form status.
- Decision preview lists refund, return, inventory and notification consequences.
- Final action is idempotent and audit logged.

---

## 31. Shared component specification

Claude Code should build reusable components around real product semantics, not a generic page-builder abstraction.

### Core components

- `ShopHeader`
- `ShopSearchField`
- `CategoryShortcut`
- `ProductCard`
- `ProductPrice`
- `SellerIdentity`
- `VerificationBadge`
- `FilterRail`
- `FilterSheet`
- `AppliedFilterChips`
- `ProductMediaGallery`
- `VariantSelector`
- `StockStatus`
- `DeliverySummary`
- `PolicySummary`
- `CartSellerGroup`
- `OrderStatusTimeline`
- `ReviewCard`
- `SellerApplicationStepper`
- `AutosaveIndicator`
- `DocumentUploader`
- `ListingStatusBadge`
- `VariantMatrix`
- `ModerationDecisionForm`
- `EvidenceViewer`

### Component-state rule

Every interactive component must define:

```text
default
hover
focus-visible
active/pressed
disabled
loading
error
success/confirmed
```

Only implement states that make semantic sense, but do not leave asynchronous actions without loading/error/success behavior.

### Copy voice

- Direct Vietnamese first; avoid English seller jargon when a stable Vietnamese term exists.
- State cause + recovery: `Ảnh vượt quá 10 MB. Chọn ảnh nhỏ hơn hoặc nén ảnh rồi thử lại.`
- Avoid blame: use `Chưa thể xác minh` rather than `Bạn nhập sai`.
- Buttons name the action: `Gửi hồ sơ`, `Lưu bản nháp`, `Xác nhận đã đóng gói`.
- Never use `OK` as the only action label for a consequential step.

---

## 32. Navigation and responsive behavior by surface

### Buyer Shop

- Use the existing product shell and safe-area logic.
- Mobile Shop subheader may be sticky but must not stack into an excessively tall two-header layout.
- Sticky Add to cart/Buy now clears the global bottom navigation.
- Cart uses a badge in Shop header/menu; do not add Shop to bottom nav without product-owner approval.

### Seller Center

- Desktop: left navigation with attention counts and a compact top context bar.
- Mobile: top bar + menu/drawer; do not add a second five-item persistent bottom bar on top of the application bottom nav.
- Product editor uses single-column steps on mobile, not a horizontally overflowing variant table.

### Admin Shop

- Extend the existing AdminLayout patterns.
- Admin mobile exposes high-frequency queue links through the existing More/drawer strategy rather than crowding the current admin tabs.
- Evidence viewer becomes a full-screen authorized sheet on narrow screens.

---

## 33. Prototype and design-validation requirement

The plan is now screen-detailed, but visual quality cannot be guaranteed from prose alone. Before production implementation, Claude Code should create a non-production prototype or isolated preview for these six critical screens:

1. B02 Search/category results at 375 and 1440 px.
2. B04 Product detail at 375 and 1440 px.
3. B09 Checkout at 375 px.
4. S02 Seller application at 375 and 1024 px.
5. S06 Product editor with variants at 375 and 1440 px.
6. A03 Admin application review at 768 and 1440 px.

The product owner should review screenshots before the components are wired to irreversible migrations/payment flows.

### Prototype review checklist

- Can a first-time user identify the single primary action in five seconds?
- Is seller identity visible at every commercial commitment point?
- Can the user understand price, variant, shipping and return terms without hunting?
- Does browser Back preserve work and context?
- Are empty, error, slow, offline and permission-denied states represented?
- Is every mobile action reachable above safe areas and the global bottom nav?
- Does Vietnamese copy fit without truncating primary actions into two lines?
- Does the UI remain recognizably ThePickleHub rather than Shopee/Amazon imitation?
- Does keyboard and screen-reader order match the visual hierarchy?
- Are all displayed claims backed by real data?

---

## 34. Updated research references

In addition to Section 24:

- Shopee Vietnam — Product listing rules: <https://help.shopee.vn/portal/4/article/77246>
- Shopee Vietnam — Inventory product setup: <https://help.shopee.vn/portal/1/article/97568-H%C6%B0%E1%BB%9Bng-d%E1%BA%ABn-Thi%E1%BA%BFt-l%E1%BA%ADp-s%E1%BA%A3n-ph%E1%BA%A9m-kho>
- Shopee Vietnam — Seller registration overview: <https://shopee.vn/blog/cach-dang-ky-ban-hang-tren-shopee/>
- Etsy — Listing variations: <https://help.etsy.com/hc/en-us/articles/115015664047-How-to-Add-Variations-for-Your-Listings>
- Shopify Shop — Customer experience: <https://help.shopify.com/en/manual/online-sales-channels/shop/customer-experience>
- Shopify Shop — Verified purchase reviews: <https://help.shopify.com/en/manual/online-sales-channels/shop/product-reviews>
- Shopify Shop — Review eligibility and integrity: <https://help.shopify.com/en/manual/online-sales-channels/shop/product-reviews/merchant-guidelines>
- Shopify Shop — Products and catalogue status: <https://help.shopify.com/en/manual/online-sales-channels/shop/manage-shop-store/products-and-collections>
- Shopify Product Network — Multi-store customer experience: <https://help.shopify.com/en/manual/promoting-marketing/shopify-product-network/customer-experience>

---

## 35. Quality bar and meaning of “best experience”

No document can honestly guarantee a perfect marketplace before observing real users, sellers, payment failures, delivery problems and support cases. For this project, “best experience” means:

1. The interface is simpler than the broad marketplaces because it is pickleball-specific.
2. Product attributes help players make a better equipment decision, not merely browse more inventory.
3. Seller identity, price, variants, stock, shipping and returns remain unambiguous.
4. Every failure has a safe recovery path.
5. Mobile Vietnamese usage is the default design constraint, not a desktop adaptation.
6. Trust signals are earned from verified data rather than promotional decoration.
7. The first release is observed through analytics, support evidence and moderated usability tests.
8. Improvements are driven by task success, time-to-complete, error rate and user confidence—not feature count.

Before public launch, run moderated tests with at least these cohorts:

- First-time pickleball buyer.
- Experienced player comparing paddle specifications.
- Small shop owner creating their first listing on a phone.
- Shop operator processing several orders on desktop.
- Administrator reviewing an incomplete or suspicious seller application.
- Buyer requesting a return after receiving the wrong variant.

Record where users hesitate, backtrack, misread seller/variant/price, or require facilitator help. Revise the prototype before calling the experience complete.
