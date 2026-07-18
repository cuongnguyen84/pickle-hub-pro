# idea-recon — DS-03 (2026-07-18, nguyên văn)

## Prior art

**This exact recon already scoped once**: `docs/proposals/ds-03-component-standardization/00-intake.md` — Cuong already answered platform (web+native same cycle), left "shadcn-variant vs standalone TL components" strategy open for the panel, and set DoD (journey screens use standard components + CI ratchet gate). `round1/`, `round2/`, `external/` subdirs exist but are **empty** — no proposal content written yet.

**Branch mismatch (blocking)**: current checkout `fix/tiny-chart-codex-findings` does **not** contain DS-02 (`main@d43fe5dd`, PR #401, merged same day). `git merge-base --is-ancestor d43fe5dd HEAD` → false. Consequence: `src/lib/__tests__/design-token-parity.test.ts` does not exist on this branch, `--tl-fg-1/bg-1/bg-2` legacy aliases are not yet deleted here, and Swift `TLColor.swift` is missing 12 canonical tokens (green/gold-glow/blue/dim/hairline/accent-*). Any DS-03 work must start from a branch that includes `main` up to `d43fe5dd` (or later).

**Web components (8 asked)**: `src/components/ui/button.tsx`, `input.tsx`, `select.tsx`, `card.tsx`, `badge.tsx`, `dialog.tsx`, `sheet.tsx` exist as standard shadcn/radix wrappers using **Tailwind semantic classes** (`bg-primary`, `bg-background`, `border-input`...), never `--tl-*` directly. No `IconButton` — only `Button size="icon"`. Theming happens one layer down: `[data-theme="the-line"]` in `src/styles/the-line.css:16-40` redefines `--primary`, `--background`, `--radius` etc. so shadcn components already re-skin correctly under the theme — they are NOT bypassing tokens, they inherit via CSS-var override.

**Parallel component system**: `the-line.css` (4154 lines) also ships ~150+ page-specific `.tl-*` classes (`tl-blog-card`, `tl-chat-msg`, `tl-bracket-row`...), plus a handful of reusable-looking ones: `.tl-btn` (line 533, used in 389 tsx files via className string) and `.tl-card` (used in 1 file only). These are hand-rolled CSS classes, not React components — two systems co-exist, not merged. `tl-btn` is the dominant real-world "Button" on Line-themed screens, not `<Button>`.

## Touch surface (likely)
- `src/components/ui/{button,input,select,card,badge,dialog,sheet}.tsx` — the 7 files (8th, IconButton, doesn't exist yet)
- `src/styles/the-line.css:533-554` — `.tl-btn` rules, and the ~389-site className string usage across `src/pages/`, `src/components/`
- `apple/ThePickleHub/DesignSystem/Components/TLComponents.swift` (70 lines) — has `TLCard`, `TLPrimaryButton`, `TLTextField` already; no TLBadge/TLDialog/TLSheet/TLSelect/TLIconButton
- `scripts/check-theline.mjs` — advisory raw-hex rule + hard `TheLineLayout title` rule, changed-files only; a DS-03 ratchet gate extends this file
- Journey screens (per `docs/journey-screens.md`): `src/pages/SocialEventDetail.tsx` (792 lines, 34 inline `style={{`, 1 raw hex), `src/components/social-events/RegistrationModal.tsx` (1398 lines, 3 inline style, 0 hex), `src/pages/ClubLanding.tsx` (351 lines, 21 inline style, 0 hex), `src/pages/CreateSocialEvent.tsx` (604 lines, 10 inline style, 1 hex) — O2-O4 all live in this one file (wizard steps)

## Data
- No new tables needed — this is presentation-layer only. Existing DS-01/02 token doc (`docs/design-tokens.md`) is the schema for names.

## Binding constraints found
- `docs/design-tokens.md` "Rules" — "Components reference ONLY semantic tokens — no raw hex, no Tailwind palette colors in Line-styled surfaces... PRs adding a bare hex get bounced to this doc."
- `docs/proposals/ds-03-component-standardization/00-intake.md` — DoD is two-part: (a) journey screens measurably use only standard components (grep/test), (b) CI ratchet gate for the rest of the app; web strategy (retrofit shadcn vs new TL set) explicitly deferred to the proposal.
- `CLAUDE.md` — "Many pages have `.legacy.tsx` siblings... do not edit legacy files unless rolling back" — currently **0** `.legacy.tsx` files exist repo-wide, so this rule is inert but must be respected if any appear mid-work.
- `docs/architecture-boundaries.md:32-45` — pure logic in `src/lib`, components never import from `pages/`, domains don't reach into each other's component internals — applies to how shared Button/Card/etc. get consumed by domain components.

## Test coverage today
- `src/lib/__tests__/design-token-parity.test.ts` (main only, 54 assertions) — checks token **names** match between CSS and Swift, does not touch component usage/consumption.
- Zero tests assert which components a page renders (no "SocialEventDetail uses `<Button>` not raw `<button>`" style check).
- `apple/Tests/` — 11 files, all scoring/scheduling engine logic; **zero** UI/snapshot tests for `DesignSystem/Components/`.
- `scripts/check-theline.mjs` runs in CI on changed files only — advisory hex check, no component-usage check.

## Unknowns worth asking Cuong
- Branch base: should DS-03 branch off current `fix/tiny-chart-codex-findings` (missing DS-02) or off `main` — need DS-02's token additions before Swift TLButton/TLBadge/etc. can reference the full canonical set.
- Web strategy is explicitly left open in the intake doc ("để panel đề xuất") — this recon doesn't resolve it, just confirms both `<Button>`(shadcn) and `.tl-btn`(CSS class) are live in prod simultaneously at meaningfully different scale (0 vs 389 sites).
