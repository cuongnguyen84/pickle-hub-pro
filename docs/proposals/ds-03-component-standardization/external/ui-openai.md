## Recommendation: choose A, but do not add theme-named variants

Use the existing shadcn/Radix components as the single React implementation and migrate `.tl-*` call sites into them incrementally.

Do **not** add variants named `line`, `green`, or `line-primary`. Those names encode one theme and preserve the existing “primary means two different colors” problem.

Define a theme-independent contract:

```tsx
<Button variant="default">       // primary action; lime in The Line
<Button variant="secondary">     // neutral/cream action in The Line
<Button variant="outline">       // transparent/bordered action
<Button variant="destructive">
<Button variant="ghost">
<Button variant="link">
```

Under `[data-theme="the-line"]`:

- `default` → lime fill, dark text
- `secondary` → cream fill, dark text
- `outline` → transparent background, 1px semantic border
- `destructive` → destructive semantic tokens
- disabled/loading → shared semantic state tokens

If `secondary` is already used with a materially different meaning elsewhere, call the new variant `neutral` rather than `cream`. The variant should describe role, not color.

### Exact legacy mapping

| Legacy element | Standard replacement |
|---|---|
| `className="tl-btn green"` | `<Button variant="default">` |
| `className="tl-btn primary"` | `<Button variant="secondary">` |
| `className="tl-btn"` | `<Button variant="outline">` |
| Raw icon-only `<button>` | `<IconButton aria-label="…">` |
| `<a className="tl-btn green">` | `<Button asChild><a … /></Button>` |
| Inline ~50px hot-path CTA | `<Button size="lg">`, preserving current rendered dimensions initially |

Put this mapping in the migration guide and codemod rules. Do not infer `primary` from its legacy name: web `.tl-btn primary` maps to **secondary/neutral**, not default.

---

## Why A is the right choice

### Advantages

1. **The theme architecture is already correct.**  
   `bg-primary`, `bg-background`, `border-input`, and related semantic classes already resolve through `[data-theme="the-line"]`. Rebuilding this in `TLButton` would duplicate a working token layer.

2. **It removes the user-visible boundary in the north-star journeys.**  
   `SocialEventDetail`, `RegistrationModal`, `CreateSocialEvent`, and `ClubLanding` will use the same DOM behavior, focus treatment, sizes, disabled states, and loading states.

3. **Radix already handles the difficult primitives.**  
   Dialog, Sheet, and Select require focus management, escape handling, portals, keyboard navigation, and ARIA semantics. A parallel TL implementation would increase accessibility and maintenance risk.

4. **It minimizes runtime and CSS duplication.**  
   A new TL React library would leave shadcn in production because existing forms and modals still depend on it. The likely result would be three layers: shadcn, TL React, and legacy `.tl-*`.

5. **It gives A11Y-02 one enforcement point.**  
   Button, IconButton, Input, and Select can all receive the 44px minimum centrally.

### Costs and risks

- Updating the shared shadcn Button can cause broad layout changes, especially from `40px` to `44px`.
- Existing non-Line pages may depend on current shadcn sizing or `secondary` styling.
- `asChild` link buttons and raw form buttons cannot be migrated mechanically without checking behavior.
- The 4,100-line stylesheet cannot be deleted until references reach zero.
- Variant naming must be resolved before migration; otherwise legacy “primary” ambiguity will spread into the new API.

These are manageable with visual baselines, staged rollout, and the CI ratchet.

---

## Why not B: standalone `<TLButton>` components

A new TL component set would solve naming locally but create another permanent system.

Specific problems:

- `<TLDialog>` and `<TLSheet>` would either re-wrap Radix—duplicating shadcn—or reimplement accessibility behavior.
- Feature code would have to choose between `<Button>` and `<TLButton>`.
- Shared forms and modals would continue to use shadcn, so the original mid-flow handoff remains unless those are also rewritten.
- Future themes would force either conditionals in TL components or another token abstraction.
- Solo-maintainer review and test load doubles across eight primitives.

The separate SwiftUI app does not justify matching React class names. Native should share the **component contract and tokens**, not the implementation prefix.

---

## Why not C: formalize `.tl-btn`

A thin wrapper around `.tl-btn` would make migration easier initially, but it would preserve the wrong source of truth.

Specific problems:

- CSS classes cannot reliably enforce `type="button"`, disabled semantics, loading behavior, `aria-*`, or correct anchor handling.
- Dialog, Sheet, and Select still need React/Radix components, so the eight primitives would not actually share one model.
- `.tl-btn primary` would retain its misleading cream meaning.
- The theme would remain split between semantic component tokens and page-specific CSS.
- Developers could continue applying `.tl-btn` to arbitrary elements, bypassing the wrapper.

A temporary compatibility wrapper is acceptable only as migration infrastructure, not the destination.

---

# Component contract to establish first

Before changing journey screens, standardize all eight APIs.

## 1. Button

- Default minimum height: `44px`, for example `h-11`.
- Preserve a separate `size="lg"` for the current ~50px CTA.
- Variants: `default`, `secondary` or `neutral`, `outline`, `ghost`, `destructive`, `link`.
- Add a first-class loading state:

```tsx
<Button loading loadingText="Đang đăng ký…">
  Đăng ký
</Button>
```

Loading must retain width where possible, set `aria-busy`, and prevent repeated activation.

- Default native `type` should be explicitly decided. Prefer requiring or defaulting to `type="button"` outside a form-specific submit wrapper; accidental form submission is a major migration risk.

## 2. IconButton

Do not model this merely as `<Button size="icon">` at call sites. Export a constrained `IconButton` API that requires an accessible name:

```tsx
<IconButton
  icon={X}
  label="Đóng"
  onClick={onClose}
/>
```

Render a minimum `44 × 44px` target even if the visible glyph is 20–24px.

## 3. Input

- Minimum interactive height: 44px.
- Stable IDs connecting `Label`, description, and error.
- Error text via `aria-describedby`; invalid state via `aria-invalid`.
- Do not use placeholder text as the label.
- Support Vietnamese input methods without validation on every composition event.

## 4. Select

Use the existing Radix Select where the option list is controlled and modest. Preserve native `<select>` where platform-native behavior or very large lists are intentionally required; wrap it in the same visual API rather than forcing every case into Radix.

Standardize:

- 44px trigger
- visible label
- placeholder behavior
- error association
- keyboard/typeahead behavior
- portal z-index inside Dialog and Sheet

## 5. Card

Card should standardize surface, border, radius, and spacing only. It should not become clickable by default. Clickable cards need explicit link/button semantics and visible focus state.

## 6. Badge

Define semantic variants, not sports-specific colors:

- `neutral`
- `success`
- `warning`
- `destructive`
- optionally `info`

Do not communicate event status solely through color. Include Vietnamese status text such as “Còn chỗ”, “Đã đầy”, or “Đã huỷ”.

## 7. Dialog

Keep the Radix implementation. Standardize:

- title and description requirements
- close button and Vietnamese accessible label
- initial focus
- return focus to trigger
- destructive confirmation layout
- mobile viewport and keyboard behavior

## 8. Sheet

Keep the Radix implementation but make its role distinct from Dialog. Use Sheet for mobile navigation, filters, and supporting workflows—not interchangeably with confirmation dialogs.

Handle Capacitor safe-area insets centrally:

```css
padding-bottom: max(var(--sheet-padding), env(safe-area-inset-bottom));
```

---

# Safest migration order

## Phase 0: inventory and behavioral baselines

Before changing components:

1. Record exact legacy reference counts by variant:
   - `.tl-btn`
   - `.tl-btn green`
   - `.tl-btn primary`
   - raw `<button>` on the target screens
2. Capture mobile screenshots at representative widths, including a mid-tier Android viewport.
3. Add journey tests for:
   - registration trigger and successful submission
   - duplicate-submit prevention
   - modal open/close and focus return
   - CreateSocialEvent next/back/submit behavior
   - analytics events and navigation targets
4. Measure current CTA dimensions and modal layout.
5. Add the CI ratchet immediately, before migration begins.

The ratchet should detect JSX usage, not merely count text occurrences in CSS:

- no new `className` containing `tl-btn`
- no new raw `<button>` in journey-screen directories unless explicitly allowlisted
- total legacy count must be `<=` the stored baseline
- ideally fail if a changed file introduces any new legacy occurrence, even when another file removes one

## Phase 1: update the shared components

Implement the semantic cream/neutral variant, 44px sizing, loading state, and IconButton contract.

Do not immediately delete legacy CSS or globally replace every call site.

Run visual regression coverage across both The Line and non-Line themes. The height change is the highest blast-radius adjustment.

## Phase 2: `ClubLanding` as the canary

`ClubLanding` already uses shadcn Button, so it tests the modified standard component without changing element semantics.

Verify:

- 44px height does not wrap nearby content
- theme colors remain unchanged
- focus ring is visible
- links still navigate correctly
- no CLS is introduced by font/icon/loading changes

## Phase 3: `RegistrationModal`

It already uses shadcn exclusively. Standardize variants, loading, disabled behavior, Dialog focus, and error associations here.

This establishes the destination behavior for P2–P4 before touching the raw P1 trigger.

Pay particular attention to:

- submit button `type`
- double-submit protection
- pending-state labels
- close behavior while submitting
- keyboard visibility and scroll on Android
- focus return to the eventual `SocialEventDetail` trigger

## Phase 4: migrate the `CreateSocialEvent` wizard one step at a time

This is the **highest behavioral-risk screen** because raw buttons may encode submit, next, back, save-draft, validation, and navigation behavior.

Do not perform a blanket JSX replacement. For every button, record:

- current native element: `button` or `a`
- `type`
- handler
- disabled condition
- validation dependency
- analytics event
- whether it advances state or submits the form

Migrate O2, then O3, then O4, running the full wizard test after each step. A Back button must not accidentally become a form submit button.

## Phase 5: migrate `SocialEventDetail` last

`SocialEventDetail` is the **highest exposure-risk screen** and should not be the first experiment. Its P1 CTA is a hot-path entry point with inline sizing and a handoff into the modal.

Map it explicitly:

```tsx
<Button
  variant="default"
  size="lg"
  onClick={openRegistration}
>
  Đăng ký
</Button>
```

Preserve the current ~50px rendered height initially rather than reducing it to the new 44px default. Remove inline styles only after the standard `lg` size reproduces them.

Then verify the complete P1–P4 journey as one flow.

## Phase 6: long-tail ratchet migration

Prioritize by:

1. high-traffic screens
2. forms and purchase/registration actions
3. Dialog/Sheet content
4. icon-only controls
5. low-traffic informational pages

Delete each legacy variant only when its reference count is zero. Delete `.tl-btn` base last.

---

# What must not change during the refactor

Except for the deliberate 44px accessibility correction, preserve the following.

## Visual behavior

- `.tl-btn green` remains lime with dark text.
- `.tl-btn primary` remains cream/off-white with dark text.
- `.tl-btn` remains visually transparent with its 1px border; do not silently introduce a near-black fill if the difference is visible.
- Existing border radius, typography weight, icon size, icon/text gap, and full-width behavior.
- The P1 CTA’s current ~50px height.
- Disabled opacity and text contrast unless intentionally corrected for accessibility.
- Dialog and Sheet dimensions, mobile placement, and safe-area padding.
- No new text wrapping in Vietnamese CTA labels.
- No loading-spinner width shift that causes surrounding content movement.

For `outline`, match the old hover state deliberately. Do not accept shadcn’s current hover merely because it is “close.”

## Behavioral semantics

- `button` versus link behavior
- form submission and validation timing
- Back/Next behavior in the wizard
- disabled and loading conditions
- prevention of duplicate registration
- analytics event names and payloads
- route targets, query parameters, and deep links
- modal trigger, initial focus, Escape behavior, outside-click behavior, and focus return
- event propagation where controls sit inside clickable cards
- browser back behavior
- Capacitor keyboard and safe-area behavior

Using `Button asChild` must not introduce nested interactive elements. This is invalid:

```tsx
<Button>
  <a href="/event">...</a>
</Button>
```

Use:

```tsx
<Button asChild>
  <a href="/event">...</a>
</Button>
```

---

# Bilingual and copy traps

## Vietnamese expansion and wrapping

Even though Vietnamese is primary, labels with diacritics can be wider than terse English labels. Test at least:

- “Đăng ký tham gia”
- “Tiếp tục”
- “Quay lại”
- “Xác nhận đăng ký”
- “Hủy đăng ký”
- “Đang xử lý…”
- “Không thể hoàn tất đăng ký”

Do not lock button width based on English copy. Avoid `whitespace-nowrap` on modal actions unless the mobile layout stacks actions when needed.

## Loading labels

Do not replace a specific label with a generic spinner only. Preserve action context:

- “Đang đăng ký…”
- “Đang tạo sự kiện…”
- “Đang lưu…”

This helps screen-reader users and avoids ambiguity when multiple actions exist.

## Terminology consistency

Create a shared vocabulary for status and actions. Do not alternate casually between:

- “Hủy” and “Đóng”
- “Đăng ký” and “Tham gia”
- “Tạo sự kiện” and “Đăng sự kiện”
- “Xóa” and “Gỡ”

These words imply different outcomes. Destructive dialogs must state the object and consequence.

## Accessible names are localized copy

IconButton labels, Dialog titles, Select labels, and error messages must come through the same localization layer as visible text. Never ship English-only `aria-label="Close"` on a Vietnamese-primary surface. Use “Đóng” in VI and “Close” in EN.

Avoid building Vietnamese sentences by concatenating fragments. Word order and classifiers may differ between locales.

---

# Accessibility traps by primitive

- **Button:** accidental submit behavior, missing loading announcement, disabled buttons with insufficient explanation, and targets below 44px.
- **IconButton:** tooltip-only labeling, untranslated `aria-label`, or a 24px hit target around a 24px icon.
- **Input:** placeholder used as label, errors not referenced by `aria-describedby`, and composition-sensitive validation interrupting Vietnamese IME input.
- **Select:** missing visible label, inaccessible custom option rendering, broken typeahead with Vietnamese diacritics, and portal layering behind Dialog/Sheet.
- **Card:** making the entire card clickable while nesting buttons inside it; this creates ambiguous interaction and event propagation issues.
- **Badge:** color-only status communication and insufficient text contrast on lime/cream fills.
- **Dialog:** missing title, incorrect initial focus, failure to return focus to the trigger, and closing during a pending destructive action.
- **Sheet:** focus escaping into the page, body scrolling behind the sheet, close control below the safe area, and keyboard overlap in Capacitor.

Test keyboard navigation, TalkBack on Android, VoiceOver where applicable, 200% text sizing, reduced motion, and both languages.

---

# SwiftUI alignment

Do not mirror the web’s legacy naming. `TLPrimaryButton` already correctly represents the lime primary action from a product-role perspective.

Extend the SwiftUI contract to match semantic roles:

- `TLButton` or a revised `TLPrimaryButton` family:
  - primary/default: lime
  - secondary/neutral: cream
  - outline
  - destructive
  - disabled/loading
- `TLIconButton`
- `TLBadge`
- `TLSelect`
- `TLDialog`/confirmation abstraction
- `TLSheet` conventions

The web and SwiftUI implementations should share:

- semantic variant names
- token meanings
- minimum target sizes
- state behavior
- copy terminology
- accessibility expectations

They should not share implementation-specific names such as `line`, `green`, or the legacy web meaning of `primary`.

## Bottom line

Adopt **A**: shadcn/Radix becomes the sole React component foundation, extended with a semantic neutral/secondary variant and 44px interaction sizing. Use a CI ratchet to migrate incrementally. Start with `ClubLanding`, then `RegistrationModal`; migrate the `CreateSocialEvent` wizard carefully; move the high-exposure `SocialEventDetail` CTA last. Keep `.tl-*` only as temporary legacy compatibility until its reference count reaches zero.