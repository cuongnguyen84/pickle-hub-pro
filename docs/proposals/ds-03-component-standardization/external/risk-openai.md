## Verdict

**Reject DS-03 as written.** The open web strategy means there is no defined canonical component API, no reliable ratchet target, and no rollback boundary. Combining that with the paid-registration rewrite and an independently shipped native implementation creates several concrete production failures.

## Ranked failure modes

### 1. Paid registrations submit from the wrong button or submit twice

**Mechanism**

A standardized web `Button` that renders `<button>` without an explicit `type="button"` defaults to `type="submit"` inside a form. Icon buttons, “back,” OTP resend, slot selectors, and dialog controls can therefore invoke the registration form’s submit handler.

A second common failure is implementing disabled state as styling or `aria-disabled` while rendering through `asChild`, an `<a>`, or another element. That does not prevent click handlers or form submission.

**Trigger**

RegistrationModal is migrated wholesale, and a secondary control is replaced with the standardized Button/IconButton. Alternatively, pending/disabled state is moved into the component and is not applied synchronously during a double tap.

**User-visible symptom**

- Tapping “resend OTP,” “back,” a slot, or a close icon submits registration.
- A fast double tap sends two paid-registration requests.
- The known server race confirms both requests and overbooks the event.
- The user may see two confirmations or be charged/recorded twice.

**Why current controls are insufficient**

The 21 tests are valuable, but their stated contract only proves accessible names and selected `.disabled` states. They do not necessarily prove:

- every non-submit button has `type="button"`;
- only one network mutation occurs after a double click;
- `aria-disabled` actually suppresses activation;
- secondary buttons do not submit the form.

Do not “fix” these tests by changing the query or dropping `.disabled`. Add an assertion that rapid repeated activation produces exactly one registration request. The real containment is server-side idempotency or a uniqueness constraint; a disabled button is not a concurrency control.

---

### 2. Native ships a behavior defect that cannot be rolled back

**Mechanism**

`TLDialog`, `TLSheet`, `TLSelect`, and `TLIconButton` introduce presentation, focus, keyboard, dismissal, Dynamic Type, and accessibility behavior. The native CI only proves that the Swift compiles and unrelated scoring/scheduling logic still passes.

SwiftUI will happily compile components that:

- hide the confirmation action behind the keyboard;
- clip Vietnamese labels under larger Dynamic Type;
- lose selection when a sheet is recreated;
- dismiss before committing state;
- expose an image-only icon button to VoiceOver as merely “button”;
- present a sheet from an unstable or competing binding.

**Trigger**

The native standardization is accepted based on compile/unit CI and shipped in the same cycle, without testing the actual flows on small devices, with the keyboard open, Vietnamese localization, and accessibility sizes.

**User-visible symptom**

Users cannot complete a form, cannot reach a sheet action, lose entered data after dismissal, or cannot identify icon buttons with VoiceOver. The broken version then remains in the App Store for days while the fix is reviewed.

**Why this is especially bad**

Web and SwiftUI share no implementation here. Shipping them in one cycle provides no atomicity or rollback benefit; it only couples two independent blast radii. Native should be a separate release after web behavior stabilizes and should have at least targeted UI/snapshot coverage.

---

### 3. A selected value appears on screen but is absent or stale in the submitted payload

**Mechanism**

A native `<select>` and Radix Select do not have the same contract:

- DOM `onChange(event)` versus `onValueChange(value)`;
- uncontrolled `defaultValue` versus controlled `value`;
- empty-string/placeholder behavior;
- form participation requiring the correct `name`;
- ref and validation behavior.

A visual adapter can make the new Select look correct while failing to update the old form state or `FormData`.

**Trigger**

A create-event or registration field is mechanically replaced with standardized Select while retaining the existing event handler or omitting its `name`.

**User-visible symptom**

The user visibly chooses a club, event type, payment option, or slot, but submit reports “required field,” sends the previous value, or creates the event with the wrong value.

**Detection hole**

Pixel diffs will not catch payload corruption. TypeScript may not catch it if the adapter accepts broad callback types or converts events internally. This requires form-contract tests that assert the actual submitted object.

---

### 4. Dialogs, sheets, and select menus render outside the theme

**Mechanism**

Radix Dialog, Sheet, and Select content normally portal to `document.body`. If `data-theme="the-line"` is attached to a route or screen subtree rather than `html`/`body`, the portaled content is no longer a descendant of the theme selector. It receives default `--background`, `--primary`, and `--border` variables instead.

**Trigger**

Open a Dialog, Sheet, or Select dropdown from a themed page.

**User-visible symptom**

The page is The Line themed, but the modal or dropdown suddenly has default shadcn colors, wrong borders, unreadable contrast, or a bright white payment dialog in dark mode.

**Required decision**

Either put theme variables at a root that also contains portals, portal into the themed container, or copy the theme attribute to the portal root. This needs an explicit contract, not visual hope.

---

### 5. RegistrationModal becomes impossible to complete on a phone

**Mechanism**

The usual shadcn Dialog content is centered and does not automatically make an arbitrarily tall, multi-step form keyboard-safe and scrollable. A 1,398-line registration/OTP/QR flow can exceed the viewport. A focus trap combined with missing `max-height`/`overflow-y-auto` can leave controls below the visible region.

**Trigger**

Open the registration modal on a small phone, use Vietnamese text, display validation errors, or open the keyboard during the OTP/payment step.

**User-visible symptom**

The QR code, error text, or confirm button is below the viewport and cannot be reached. Focus may jump but the content does not scroll. The user abandons a paid registration.

This needs real-device viewport and keyboard tests, not desktop screenshots.

---

### 6. The ratchet passes while new legacy UI is still being added

**Mechanism**

A global grep count is not a “no new violations” gate. A PR can remove one `.tl-btn` and add one elsewhere while the total remains unchanged. It also misses:

- template-composed class names;
- aliases and wrapper components;
- raw `<button>` elements;
- multiline or dynamically generated classes;
- components renamed to evade the pattern.

Conversely, formatting or generated output can change counts without changing behavior.

**Trigger**

The ratchet is implemented as “current count must be <= baseline count,” which is the obvious implementation when the standard strategy is still undefined.

**User-visible symptom**

Months later the app still has mixed button behavior and styling despite CI being green. A newly added legacy button can lack disabled semantics or use old colors, while an unrelated deletion pays for it.

**Required implementation**

Define the canonical imports first, then detect newly introduced violations in the changed lines/files using an AST-aware ESLint rule. Keep a separately reported debt count, but do not use aggregate debt as proof that no new violation was added.

---

### 7. DS-03 standardizes components that themed users barely use

**Mechanism**

Retrofitting the shadcn `Button` does not affect the dominant `.tl-btn` implementation used across roughly 389 files. Creating a standalone TL component set without making it the sole owner of `.tl-btn` creates a third API:

1. raw `.tl-btn`;
2. shadcn `<Button>`;
3. new `<TLButton>`.

**Trigger**

The team chooses the lower-effort “retrofit shadcn” route to finish the eight-component checklist, or adds TL wrappers without a compatibility/deprecation plan.

**User-visible symptom**

Different screens continue to have different button heights, loading behavior, disabled behavior, and focus styling. Bugs get fixed in one implementation and remain in the other two.

This is not standardization; it is standardizing the minority path. The canonical component must either encapsulate the existing `.tl-btn` behavior during migration or deliberately replace it with a measured rollout.

---

### 8. Visual regression provides no pre-production protection

**Mechanism**

The pixel job is advisory, skips without baselines, and obtains baselines from production. With automatic deployment from `main`, the regression can already be live before it is captured. Capturing a new baseline then blesses the broken state.

**Trigger**

A dialog overflow, theme-portal, or spacing regression merges at 2am. The visual job fails or skips, but deployment proceeds.

**User-visible symptom**

Users see the defect immediately. The solo operator learns about it through support reports, not CI.

For the north-star screens, deterministic fixtures and committed baselines must be established before migration, and those checks must block merge. Live production data cannot be the oracle for a blocking visual contract.

---

### 9. An icon-only standardization silently removes accessible names

**Mechanism**

A generic IconButton API that accepts only an icon and tooltip often fails to require `aria-label` on web or `accessibilityLabel` in SwiftUI. Tooltips are not a reliable accessible name, especially on touch devices.

**Trigger**

Close, back, share, QR, and menu controls are replaced with standardized icon buttons.

**User-visible symptom**

Screen-reader users hear a sequence of indistinguishable “button” controls and cannot operate registration or event flows. Existing RegistrationModal tests only protect buttons they currently query by accessible name; they do not prove every new icon button is named.

Make the accessible label a required constructor prop on both platforms.

---

### 10. The component barrel consumes the remaining initial-JS budget

**Mechanism**

A convenience barrel that eagerly imports all eight implementations can pull Radix Dialog, Select, and Sheet code into the initial graph, particularly if modules have side effects or the root layout imports a registry. There is only about 15 KB gzipped headroom.

**Trigger**

The standardized component set is imported from the root application or a shared layout instead of being route-split.

**Symptom**

Best case: CI blocks the release because the initial bundle exceeds 280 KB. If the budget measurement misses a path or is bypassed, first paint regresses for mobile users.

This is containable: preserve direct/tree-shakeable imports and lazy-load route-specific overlays. The enforced budget is a genuine safeguard for the exact artifact it measures, but it does not cover CSS parse cost or later chunks.

## Genuinely safe parts

- **SEO should be unchanged.** The crawler HTML is generated by the separate Cloudflare Pages Function renderer, so a React-only component refactor does not alter that output unless the server renderer is separately edited.
- **Compile-time native failures are covered.** Signature and type errors will be caught; visual and interaction errors will not.
- **Card and Badge are comparatively low risk** if they remain semantic styling wrappers and do not introduce click handling, navigation, or layout clipping.
- **The existing RegistrationModal accessible-name and disabled-state tests are useful protection.** Keep them intact, but they are not sufficient protection against duplicate network submissions or accidental submit buttons.

## Minimum acceptable rollout

1. Choose one canonical web API before writing the ratchet.
2. Specify contracts for `type`, disabled behavior, loading, accessible labels, refs, form participation, controlled values, portals, and dismissal.
3. Add server-side idempotency for paid registration before touching its button tree.
4. Migrate low-risk screens first; migrate RegistrationModal last and separately.
5. Add deterministic blocking tests for the north-star journeys, including mobile viewport and actual submitted payloads.
6. Use an AST/diff-based ratchet, not aggregate grep counts.
7. Release web and native independently.
8. Add targeted SwiftUI UI/snapshot tests and manually exercise Vietnamese, Dynamic Type, VoiceOver, keyboard, and small-device cases before App Store submission.

As proposed, the most likely serious incident is not “some inconsistent spacing.” It is **a button or select contract changing inside the paid-registration flow, causing an unintended or duplicate registration while every advisory visual check remains non-blocking**.