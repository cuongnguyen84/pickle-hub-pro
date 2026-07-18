# DS-03 Component Standardization — UI strategy brief

## Product
ThePickleHub: bilingual (Vietnamese-primary, ~95% VI) pickleball platform. Mobile-dominant, mid-tier Android on 4G, plus a Capacitor native shell and a SEPARATE native SwiftUI iOS app (`/apple`). React 18 + Vite + Tailwind + shadcn/ui on web. Perf p75 targets (VN segment): LCP <=2.5s, INP <=200ms, CLS <=0.1.

## The situation
The web app has TWO parallel "component" systems live in production at once, for the same 8 primitives (Button, IconButton, Input, Select, Card, Badge, Dialog, Sheet):

1. **shadcn/ui React components** (`src/components/ui/*.tsx`) — Radix wrappers using Tailwind SEMANTIC classes (`bg-primary`, `bg-background`, `border-input`). They are NOT hardcoded: a theme layer `[data-theme="the-line"]` in CSS re-maps `--primary`, `--background`, `--radius` etc, so the same components recolor to the "The Line" dark/lime theme automatically. `<Button>` has ~0 direct call sites on Line-themed page bodies but is used heavily inside modals/forms.

2. **Hand-rolled CSS utility classes** `.tl-*` in `src/styles/the-line.css` (4100+ lines). The dominant one is `.tl-btn` — a plain CSS class applied via `className="tl-btn green"` on raw `<button>`/`<a>` elements, used in **389 tsx files**. Repo-wide variant counts: `tl-btn` (base, transparent + border) ~212, `tl-btn green` (lime fill) ~140, `tl-btn primary` (CREAM/off-white fill) ~24.

### The visual divergence that matters
- `.tl-btn green` = lime fill `#b5e853`, dark text. shadcn `<Button variant="default">` = `bg-primary` which under the theme is ALSO `#b5e853`. So green -> default maps 1:1, colors already match.
- `.tl-btn primary` = CREAM fill (`--tl-fg` #f5f3ee, off-white) with dark text. shadcn has NO cream variant. Nothing maps to it.
- `.tl-btn` (base) = transparent + 1px border. shadcn `variant="outline"` = border + `bg-background` (near-black under theme). Near-identical on this theme; hover differs slightly (surface vs accent).
- Heights: `.tl-btn` computes ~43px, `<Button size=default>` = 40px (h-10). Neither meets the 44px touch-target minimum (a separate task A11Y-02 depends on THIS work). The hot-path CTA overrides padding via inline style to ~50px.

### The two north-star user journeys literally hand off between the two systems mid-flow
- Player journey: `SocialEventDetail` (P1 entry, uses raw `.tl-btn green` + inline styles + raw `<button>`) -> opens `RegistrationModal` (P2-P4, uses shadcn `<Button>` exclusively).
- Organizer journey: `CreateSocialEvent` wizard (O2-O4, uses raw `.tl-btn` classes + raw `<button>`).
- `ClubLanding` uses shadcn `<Button>`.
So a user tapping the green CTA on the event page (tl-btn) and then seeing buttons inside the registration modal (shadcn) is crossing a system boundary without knowing it.

### Native SwiftUI side (`/apple`)
Has `TLCard`, `TLPrimaryButton` (lime fill — note: named "primary" but it's the LIME one, opposite of web's cream `.tl-btn primary`), `TLTextField`. MISSING: TLBadge, TLDialog/Sheet equivalents, TLSelect, TLIconButton, and button secondary/outline/destructive/disabled variants. Token parity web<->Swift already enforced by a test (DS-02, done).

## Constraints
- Solo maintainer. Refactoring 389 files at once is high-risk; a CI "ratchet" gate (no new raw `.tl-btn`, count only decreases) is the intended migration mechanism.
- Rule already enforced: components reference ONLY semantic tokens, no raw hex.
- Definition of done requires: (a) the 5-8 journey screens measurably use ONLY standard components, (b) a CI ratchet gate for the rest.

## The strategic question I want your take on
Given shadcn components that already theme correctly via CSS-var override, AND a hand-rolled `.tl-*` CSS-class system used ~389x wider — to standardize the 8 base components, should we:
(A) RETROFIT shadcn — add "The Line" variants to the existing shadcn components (e.g. a cream `line-primary` variant, a `line`/`green` variant, bump to 44px), and migrate `.tl-btn` call sites to `<Button variant=...>`, then delete `.tl-btn`?
(B) BUILD a NEW standalone set of TL React components (`<TLButton>` etc) parallel to shadcn?
(C) FORMALIZE the CSS-class system (keep `.tl-btn`, document variants, add a React thin wrapper, leave shadcn for non-themed surfaces)?

Name the exact tradeoffs. Which do you pick and why? What is the safest migration ORDER for the journey screens (which screen is riskiest to touch first)? What must NOT change visually/behaviorally during the refactor? Where are the copy/bilingual and accessibility traps in standardizing these 8 primitives?
