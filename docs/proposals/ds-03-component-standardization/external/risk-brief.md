# Devil's-advocate brief — DS-03 design-system standardization

## Context (self-contained; you cannot see the repo)

ThePickleHub is a bilingual (Vietnamese/English) pickleball web+mobile product, ~2000 real
users, ~95% Vietnamese, run by ONE solo developer. Stack: React 18 + TypeScript + Vite +
shadcn/ui + Tailwind, hosted on Cloudflare Pages (auto-deploys from `main`). Native mobile app
is a SEPARATE SwiftUI codebase (`apple/`, iOS via App Store review), NOT a Capacitor webview
for the design system in question. There is a Capacitor shell too but the DS components here are
native SwiftUI.

## The proposed change (DS-03)

Standardize 8 base UI components across BOTH platforms in the SAME cycle:
Button, IconButton, Input, Select, Card, Badge, Dialog, Sheet.

- Web: the 8 live as shadcn/radix wrappers (`src/components/ui/*.tsx`) using Tailwind SEMANTIC
  classes (`bg-primary`, `bg-background`, `border-input`). A theme layer `[data-theme="the-line"]`
  in a 4154-line `the-line.css` redefines the CSS variables so shadcn re-skins under the theme.
  Separately there are ~150 hand-rolled `.tl-*` CSS classes; notably `.tl-btn` is used as a
  className string in ~389 `.tsx` files and is the DOMINANT real-world button on themed screens
  — the React `<Button>` is barely used on themed pages. So there are TWO parallel button
  systems in prod at very different scale.
- Native: `TLComponents.swift` (70 lines) has TLCard, TLPrimaryButton, TLTextField. DS-03 adds
  TLBadge/TLDialog/TLSheet/TLSelect/TLIconButton and standardizes the existing ones.

The web strategy (retrofit shadcn variants vs a new standalone TL component set) is LEFT OPEN —
the panel proposes it.

## Definition of done (two parts)
(a) 5-8 screens on two "north-star" user journeys use ONLY the standard components, provable by
    grep/test. Journey screens include a 1398-line RegistrationModal (the paid-event registration
    + OTP + QR-payment money path), SocialEventDetail (792 lines, 34 inline styles), a create-event
    wizard, a club landing page.
(b) A CI "ratchet" gate for the REST of the app — a lint-style check that fails a PR if it adds a
    non-standard component, count only allowed to go down.

## Guardrails / facts that matter
- Visual regression CI exists (Playwright pixel-diff) but is ADVISORY (continue-on-error) — it
  NEVER blocks a merge; live data makes it flaky. It self-skips until baselines are committed, and
  baselines are captured from PRODUCTION.
- Native CI compiles + runs unit tests on macOS, but has ZERO UI/snapshot tests — only
  scoring/scheduling engine logic. A compile break is caught; a visual/behavior regression is not.
- The money-path (RegistrationModal) has 21 jsdom characterization tests that query buttons BY
  ACCESSIBLE NAME and assert `.disabled` state (double-submit guard: submit disabled until a slot
  is picked). A registration double-submit can OVERBOOK a paid event (a confirmed race exists in
  this codebase's history).
- A first-paint JS budget is CI-enforced: INITIAL gzipped ~265 KB against a 280 KB ceiling
  (~15 KB headroom). A separate per-page CSS concern: the 4154-line CSS file.
- SEO for bot crawlers is server-side prerendered by Cloudflare Pages Functions in a SEPARATE
  code path (`functions/_lib/render/`), independent of the React component tree.
- Rollback reality: web = `git revert` + redeploy (minutes). Native = App Store review (days,
  no revert button). A shipped bad native build is stuck until Apple approves the next one.
- Solo operator, no on-call rotation, changes can land at 2am.

## Your task

Large-blast-radius design-system refactor (8 base components, web+native same cycle) on a
production solo-dev app: what failure modes does the "plan-shaped hole" usually hide? Be
concrete — name the mechanism, the trigger, the user-visible symptom. Reject generic risk
language. Where the change is genuinely safe, say so plainly. Rank by expected damage.
