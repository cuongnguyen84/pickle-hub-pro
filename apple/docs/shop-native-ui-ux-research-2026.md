<!-- Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4 -->

# ThePickleHub Shop — Native UI/UX Research 2026

**Research date:** 2026-08-11  
**Target:** SwiftUI buyer experience, iPhone and iPad  
**Compatibility baseline:** iOS 17  
**Reference:** two public social screenshots supplied by the Product Owner  

## 1. Executive recommendation

Build Shop as a native, image-led sports catalogue with an editorial/utilitarian hierarchy. Preserve the reference's clarity and commerce rhythm, but do not copy its visual identity or reproduce its assets.

Use current Apple frameworks in three layers:

1. **Baseline — iOS 17:** SwiftUI navigation, Observation, content-unavailable states, sensory feedback, adaptive grids and native sheets.
2. **Enhancement — iOS 18+:** product-card-to-PDP zoom navigation transitions where Reduce Motion permits.
3. **Enhancement — iOS 26+:** system Liquid Glass navigation, toolbar grouping, bottom-aligned search, scroll-edge legibility and minimized tab behavior. Use custom glass only for a small number of floating controls.

Do not raise the deployment target merely to obtain the newest appearance. Compile with the newest stable SDK, use availability branches, and retain an intentional The Line fallback on iOS 17–18.

## 2. Hallmark study — extracted design DNA

### Source and limits

The screenshots appear to show public reference apps inside a simulator and social-media capture. The diagnosis extracts transferable structure only. Product imagery, brand marks and distinctive artwork are not reusable assets. Exact colors, fonts and motion cannot be authoritatively identified from static screenshots.

### Surface

- **Paper:** very light, neutral-cool white with subtly elevated white cards.
- **Ink:** near-black primary text, cool gray secondary text.
- **Accent footprint:** restrained; roughly 5–10%, concentrated in active navigation, quantity controls and primary actions.
- **Image behavior:** product photography carries the color. UI chrome deliberately stays quiet.
- **Shape language:** continuous rounded rectangles, moderate radii, circular icon controls.
- **Depth:** faint tonal separation and minimal shadow, not layered glass cards.

### Type

- **Display role:** soft geometric sans, semibold/bold.
- **Body role:** neutral or soft geometric sans.
- **Label role:** small neutral sans; occasional tracked uppercase microcopy.
- **Pairing:** one sans family with weight/size contrast.
- **Portable interpretation:** keep ThePickleHub's Geist for commerce UI, Geist Mono for price/status data, and reserve roman Instrument Serif for rare editorial moments such as buying guides. Avoid italic commerce headings.

### Structure

Closest macrostructure: **catalogue index / product-led F6**, followed by a **single-product detail** surface.

Shop Home rhythm:

```text
compact identity/actions
→ promotional media strip
→ horizontal product spotlight
→ brand/category shortcuts
→ popular catalogue
→ persistent app navigation
```

Product Detail rhythm:

```text
compact navigation
→ dominant product media
→ quantity + price commitment summary
→ product identity + trust signal
→ structured facts
→ selectable attributes
→ safe-area primary action
```

Component archetypes:

- Home: search-led catalogue with horizontal discovery rails.
- Product card: media-first tile; title/price below; favorite and add actions separated.
- PDP: immersive media header with progressive disclosure below.
- Variant selector: contextual sheet on iPhone, inline panel or inspector on iPad.
- Commerce action: one persistent commitment bar with price and action.

### Motion

Motion is not visible in the static captures. Recommended interpretation:

- Product tile → PDP: spatial zoom transition.
- Variant change: crossfade product media; no bouncing card-scale effect.
- Add to cart: short haptic plus local state confirmation.
- Sheets: system presentation and dismissal motion.
- Loading: stable skeleton geometry or reserved image boxes; no indefinite decorative shimmer when Reduce Motion is enabled.

### Rhythm

- Generous product-media space; medium-density metadata.
- Strong section-title-to-content contrast.
- Horizontal rails create pace without turning the page into a dashboard.
- PDP uses one-column disclosure on iPhone and can become media/detail split on wide iPad windows.
- Repetition is controlled by varying section composition, not by alternating arbitrary card colors.

### Transferable DNA

> A light, image-led sports catalogue with quiet chrome, geometric type, restrained accent, horizontal discovery rails, dominant product media and a single persistent commerce action. Trust and variant information sit close to commitment; motion preserves spatial context rather than decorating the page.

## 3. Recommended technology stack

### Tier A — adopt now

| Technology | Minimum | Shop use | Decision |
| --- | --- | --- | --- |
| SwiftUI + Swift 6 | Existing | Entire feature | Adopt |
| Observation (`@Observable`) | iOS 17 | Screen/repository state with granular invalidation | Adopt |
| `NavigationStack` | iOS 16 | Shop-local navigation and deep links | Adopt |
| `ContentUnavailableView` | iOS 17 | Empty search, offline, unavailable and permission states | Adopt |
| `sensoryFeedback` | iOS 17 | Favorite, variant validity, cart success/error | Adopt sparingly |
| `presentationDetents` | iOS 16 | Variant/filter/quantity sheets | Adopt |
| `containerRelativeFrame` / adaptive `LazyVGrid` | iOS 17 | Responsive product rails and iPad grid | Adopt |
| `scrollTargetBehavior` | iOS 17 | Predictable media and category snapping | Adopt where it aids control |
| `contentMargins` | iOS 17 | Readable adaptive scroll layouts | Adopt |
| `symbolEffect` | iOS 17 | Small state confirmation on wishlist/cart icons | Optional and restrained |
| `accessibilityRotor` | Existing | Jump among PDP sections, filters or order milestones | Adopt for long surfaces |
| `ViewThatFits` / `AnyLayout` | iOS 16 | Adapt commerce bars and fact rows without device checks | Adopt |
| PassKit Apple Pay | Provider-dependent | Physical-goods checkout | Architecture-ready; Phase 4 gate |

### Tier B — progressive enhancement

| Technology | Minimum | Shop use | Decision |
| --- | --- | --- | --- |
| `matchedTransitionSource` + `.navigationTransition(.zoom)` | iOS 18 | Product card → PDP spatial continuity | Adopt behind availability and Reduce Motion |
| Liquid Glass system chrome | iOS 26 SDK/runtime | Navigation, toolbar, tabs, sheets and search | Prefer automatic system adoption |
| `glassEffect` / `.buttonStyle(.glass)` | iOS 26 | Floating media controls or a compact transient action | Very limited use |
| `ToolbarSpacer` | iOS 26 | Group search/cart/more actions semantically | Adopt on iOS 26 |
| `scrollEdgeEffectStyle` | iOS 26 | Keep toolbar controls legible over product media | Adopt where automatic behavior is insufficient |
| `tabBarMinimizeBehavior` | iOS 26 | More vertical catalogue space while scrolling | Pilot only; preserve navigation clarity |
| Search tab role/bottom search | iOS 26 | Reachable Shop search | Consider inside a future Shop shell, not as a sixth global tab |
| Tab bottom accessory | iOS 26 | Persistent mini-cart summary | Evaluate; avoid competing with global tab bar |
| Background extension effect | iOS 26 | Edge-to-edge imagery beside iPad sidebar | Use only on rich media, not plain catalogue lists |

### Tier C — watch, do not depend on yet

Apple's WWDC26 material describes Xcode 27 and 2027 OS releases. Relevant items include updated Liquid Glass, toolbar priority/overflow, swipe actions beyond `List`, reorderable containers, improved `AsyncImage` HTTP caching and lazy `@State` initialization. These are valuable future enhancements but should not define the 2026 Shop architecture.

Plan extension points now:

- Keep image loading behind the existing image pipeline so native `AsyncImage` caching can be evaluated later without rewriting screens.
- Keep toolbar actions semantic so future priority/overflow behavior can adopt them naturally.
- Model saved lists and seller inventory editors as reorderable data, but do not add 2027-only APIs to the buyer MVP.

## 4. Liquid Glass policy

Liquid Glass is a functional navigation/control layer, not the Shop's content-card style.

### Use it for

- System navigation bars and toolbars.
- Search presentation.
- Sheets, popovers and transient controls.
- A media-overlay close, favorite or share control when it floats over photography.
- Potential compact cart accessory, after interaction testing.

### Do not use it for

- Every product card.
- Product facts, seller panels or policy blocks.
- Large background panels or decorative gradients.
- Price labels and stock chips merely to look current.
- Stacked glass-on-glass surfaces.

### Accessibility requirements

- Respect Reduce Transparency and Increase Contrast automatically through system materials.
- Prefer regular glass where text is present; clear glass belongs only over rich media with tested contrast/dimming.
- Never encode availability, verification or error using translucency/color alone.
- Test content beneath controls across bright, dark and multicolor product photography.

## 5. Commerce UX decisions

### Shop entry and navigation

- Do not add a sixth global tab.
- Pilot Shop as a prominent Home destination plus universal/deep links.
- Give Shop its own `NavigationStack` and preserve back-stack state.
- Keep search and cart reachable from the Shop toolbar.
- On iPad, adapt by window width rather than device identity; use a split presentation only when it materially helps browsing.

### Shop Home

- Begin with search and category access above the fold; avoid a large marketing hero.
- Use one campaign banner only when real campaign data exists.
- Show sections justified by real data: new listings, recently viewed, saved, category picks or verified shops.
- Avoid “bestseller”, “trending” and numeric social proof until server data supports each claim.
- Use lazy horizontal rows and lazy grids to control memory and power.

### Product detail

- Make product imagery dominant but keep product title, price range and seller identity discoverable without excessive scrolling.
- Variant choice must update image, SKU, price and availability together.
- Preserve selected variant when opening/dismissing the variant sheet.
- Keep delivery and return terms near Add to Cart/Contact Shop.
- Use a native share sheet and native link-opening disclosure for approved external contact channels.
- A zoom transition should reinforce “this card became this product”, not slow down repeated browsing.

### Checkout and Apple Pay

- Physical goods must use Apple Pay or another external payment method, not StoreKit in-app purchase.
- If Apple Pay becomes available, use the system-provided PassKit button and sheet; never redraw the button.
- Collect required variant information before showing Apple Pay.
- Prefer Apple Pay-provided contact/shipping information where appropriate.
- Keep seller identity explicit in the payment summary because ThePickleHub is a marketplace intermediary.
- Do not require account creation before purchase unless marketplace trust/security rules truly require it.
- Distinguish order submitted, awaiting reconciliation and paid.

## 6. Motion and feedback specification

| Interaction | Feedback | Constraint |
| --- | --- | --- |
| Open PDP | iOS 18 zoom; standard push fallback | Disable spatial zoom for Reduce Motion |
| Choose variant | 160–220 ms crossfade + selection haptic | Image changes as soon as color/material is determined |
| Favorite | SF Symbol state change + light impact | No confetti or card bounce |
| Add to cart | Success haptic + cart badge/count update | No blocking toast over primary content |
| Invalid combination | Inline reason + error haptic after commitment attempt | Never haptic on every exploratory tap |
| Refresh | Native refresh control | No custom spinner choreography |
| Order state | Timeline update + accessible announcement | Motion never substitutes for text |

## 7. Performance technology and budgets

Use Instruments 26 during development rather than treating performance as a release-only audit. Apple's SwiftUI instrument exposes long view updates and a Cause & Effect graph for unnecessary invalidations.

Shop-specific policy:

- `LazyVStack`/`LazyVGrid` for large catalogues.
- Granular observable state per product/cart item; toggling one favorite must not invalidate the entire catalogue.
- Keep frequently changing geometry/timers out of broad environment objects.
- Decode and resize product media off the main actor using the existing image pipeline.
- Request server/CDN renditions near the rendered pixel size.
- Cancel stale search and image tasks.
- Reserve image aspect ratios to prevent layout movement.
- Profile scroll, variant change and cart badge updates on a real lower-tier supported device.

Proposed measurable gates:

- No orange/red SwiftUI body update tracks during ordinary catalogue scrolling.
- No full-grid invalidation for a single wishlist/cart mutation.
- No visible hitch during product-card → PDP transition after media is cached.
- Memory remains bounded across repeated browse/PDP/back cycles.
- Offline and slow-network paths remain interactive and cancellable.

## 8. Accessibility technology

- Dynamic Type with semantic styles and custom fonts using `relativeTo:`.
- VoiceOver grouping for product cards: identity and price read before actions.
- Separate accessibility actions for Favorite and Add to Cart instead of hiding them inside one combined tap target.
- Custom rotors for PDP sections and long order timelines when beneficial.
- `accessibilitySortPriority` only when natural source order cannot match the visual order.
- Announce result-count changes, cart mutations and order-state changes without repeatedly interrupting exploration.
- Honor Reduce Motion, Reduce Transparency, Increase Contrast, Button Shapes, Bold Text and Differentiate Without Color.
- Test Vietnamese at large accessibility sizes and long seller/product names.

## 9. Recommended build order

1. **Baseline components on iOS 17:** product card, price, seller identity, media pager, variant selector, stock/policy states, sticky commerce action.
2. **Fixture-backed B01–B05:** verify hierarchy and accessibility on devices before API integration.
3. **Performance instrumentation:** establish catalogue and PDP traces before adding live network complexity.
4. **iOS 18 spatial enhancement:** card-to-PDP zoom with motion fallback.
5. **P2b API integration:** public catalogue and approved media/contact contracts.
6. **iOS 26 polish pass:** system chrome, toolbar grouping, search ergonomics and scroll-edge treatment.
7. **Phase 3 commerce:** cart/order state and later PassKit, behind their server contract gates.

## 10. Technology choices to reject

- A custom Flutter-like design system inside SwiftUI.
- Third-party UI/navigation frameworks without a demonstrated missing platform capability.
- Home-screen bento dashboards for a linear shopping journey.
- Glassmorphism across content cards.
- Perpetual shimmer, parallax or 3D tilt on product grids.
- Decorative spring motion on every control.
- Device-name branching instead of adaptive layout.
- Hard-coded status/count/rating claims.
- StoreKit for physical products.
- WebView checkout as the default merely because web already exists; use it only as an explicitly designed interim handoff.

## 11. Sources

- [Apple — What’s new in SwiftUI (WWDC26)](https://developer.apple.com/videos/play/wwdc2026/269/)
- [Apple — What’s new in SwiftUI (WWDC25)](https://developer.apple.com/videos/play/wwdc2025/256/)
- [Apple — Build a SwiftUI app with the new design](https://developer.apple.com/videos/play/wwdc2025/323/)
- [Apple — SwiftUI updates](https://developer.apple.com/documentation/updates/swiftui)
- [Apple HIG — Materials](https://developer.apple.com/design/human-interface-guidelines/materials)
- [Apple — Liquid Glass technology overview](https://developer.apple.com/documentation/TechnologyOverviews/liquid-glass)
- [Apple HIG — Motion](https://developer.apple.com/design/human-interface-guidelines/motion)
- [Apple — Optimize SwiftUI performance with Instruments](https://developer.apple.com/videos/play/wwdc2025/306/)
- [Apple HIG — Apple Pay](https://developer.apple.com/design/human-interface-guidelines/apple-pay)
- [Apple — Apple Pay planning](https://developer.apple.com/apple-pay/planning/)
- [Apple — App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple — Accessible navigation](https://developer.apple.com/documentation/swiftui/accessible-navigation)

