## Verdict

### Fix B as written does **not fix production**

```css
div.tl-icon-btn::after { pointer-events: none }
```

loses the specificity contest:

- Existing: `[data-theme="the-line"] .tl-icon-btn::after` → specificity **0,2,1**
- Proposed: `div.tl-icon-btn::after` → specificity **0,1,2**

The existing rule still wins, regardless of source order. `pointer-events` remains `auto`.

- **Trigger:** Any real mouse/touch click on the The Line bell.
- **Mechanism:** The wrapper div’s `::after` remains the top hit-tested box.
- **User-visible symptom:** Bell still does nothing; programmatic `button.click()` still works.

A specificity-correct version would be:

```css
[data-theme="the-line"] div.tl-icon-btn::after {
  pointer-events: none;
}
```

Based on the supplied consumer audit, there is no other current `<div class="tl-icon-btn">`, so that corrected rule is surgically safe for existing consumers.

However, it removes the intended enlarged target from this bell. The clickable element becomes the inner shadcn button’s **40×40px** box, not 44×44px. The wrapper’s transparent pseudo-element no longer contributes to hit testing.

### Fix A is the correct durable fix, with one required class correction

Moving `className` to the actual button makes the pseudo-element part of the button, so clicks on the enlarged area dispatch to the button correctly. It also preserves the intended enlarged target.

Do **not** move this class unchanged:

```tsx
hidden md:block
```

At desktop width, `md:block` overrides the Button’s `inline-flex`. Then `items-center justify-center` no longer applies.

- **Trigger:** Logged-in desktop users at the `md` breakpoint or above using the AppHeader bell.
- **Mechanism:** Trigger becomes `display:block` rather than flex.
- **User-visible symptom:** Bell icon can appear left/baseline aligned instead of centered in its square button.

Change it to:

```tsx
hidden md:inline-flex
```

The mobile call site can remain:

```tsx
md:hidden
```

Its base display still comes from the Button’s `inline-flex`.

Removing only the wrapper and passing the class directly to the existing `Trigger` button does not introduce the previous axe failure: Radix continues applying `aria-haspopup` and `aria-expanded` to a real button, not a role-less span.

**Recommendation:** Ship Fix A with `hidden md:block` changed to `hidden md:inline-flex`. Add one authenticated Playwright pointer-click test; the logged-out smoke project cannot detect this regression because the bell renders `null`.
---

## Adjudication by risk-auditor (verified against repo + live Chromium)

**REJECTED — GPT-5.6's headline claim ("Fix B does not fix production, loses specificity contest").**
CSS specificity is resolved *per property*, only among rules that declare the *same* property.
The existing `[data-theme="the-line"] .tl-icon-btn::after` rule declares `content/position/inset`
but NOT `pointer-events`, so there is no competing `pointer-events` declaration for the
lower-specificity `div.tl-icon-btn::after` to lose to. Verified empirically in headless Chromium
(minimal repro with both rules present, themed rule higher specificity):
- `getComputedStyle(div,'::after').pointerEvents` = **`none`** (Fix B applied despite lower specificity)
- `elementFromPoint` at the button's center = **`btn`** (clicks now reach the button)
GPT-5.6 conflated "the higher-specificity rule wins the element" with "wins the property." Fix B
as literally written works. (I still recommend scoping it `[data-theme="the-line"] div.tl-icon-btn::after`
for readability + to make the point moot — zero cost, not because it's required.)

**ACCEPTED — everything else GPT-5.6 raised, all cross-checked in repo:**
- Fix A `hidden md:block` → must become `hidden md:inline-flex` (else `md:block` overrides Button
  `inline-flex`, `items-center/justify-center` stop applying, bell icon mis-centers on desktop). Confirmed.
- Fix B leaves the bell tap target at the inner Button's 40×40px (`size="icon"` = h-10 w-10), losing
  the 4px `::after` expansion. Confirmed — but this is identical to the already-working AppHeader bells
  and above the WCAG 2.5.8 AA 24px floor, so not an a11y regression.
- No other `<div class="tl-icon-btn">` exists (grep: only the bell wrapper; all others are `<button>`/`<a>`). Confirmed.
- Fix A does not re-break axe (Radix applies aria-* to a real Button, not a role-less span). Confirmed.
- Smoke (logged-out) cannot catch this — bell renders `null` when `!user`; regression test must live in
  the authenticated `journeys` project. Confirmed against playwright.config.ts.
