# Semantic Design Tokens (DS-01)

> Standardized 2026-07-16 from what "The Line" system already ships on both
> platforms (web `src/styles/the-line.css` `--tl-*` vars; Swift `TLColor`).
> This is the NAME list + meanings. DS-02 hand-writes the two token files to
> this list and adds the parity check; no codegen unless drift recurs
> (decision log 2026-07-14).

## Canonical semantic set

Names are web-form (`--tl-*`); the Swift twin is the camelCase of the stem
(`--tl-fg-2` ↔ `TLColor.fg2`).

### Color — foreground
| Token | Meaning |
|---|---|
| `fg` | primary text |
| `fg-2` | secondary text (labels, kickers) |
| `fg-3` | tertiary/hint text, inactive icons |
| `fg-4` | faintest text, disabled |

### Color — background & surfaces
| Token | Meaning |
|---|---|
| `bg` | page background |
| `bg-elev` | elevated card/sheet background |
| `surface` / `surface-2` | inset surfaces (score cells, pills, inputs) |
| `border` / `border-2` | default / stronger borders |
| `hairline` | thinnest separator |

### Color — status & accents
| Token | Meaning |
|---|---|
| `green` (+ `green-dim`, `green-glow`) | success, confirmed, winner |
| `live` | live indicator (red family) — only for actually-live states |
| `gold` (+ `gold-glow`) | highlights: third place, featured |
| `blue` (+ `blue-glow`) | informational accent |
| `accent-qt` / `accent-team` / `accent-elim` / `accent-flex` | per-tournament-format identity accents |
| `dim` | overlay/dim layer |

### Shape
| Token | Meaning |
|---|---|
| `radius` / `radius-lg` / `radius-xl` | control / card / sheet corner radii |

### Typography (roles, not tokens yet — DS-02 decides representation)
| Role | Current implementation |
|---|---|
| display/serif | Instrument Serif italic (team names, section titles) |
| mono-kicker | Geist Mono 10–11px uppercase letterspaced (labels, pills) |
| body | system/Geist sans |
| numeric | mono + `tabular-nums` (scores) |

## Parity status (2026-07-18 — DS-02 shipped)

- Canonical set exists on BOTH platforms; asserted by
  `src/lib/__tests__/design-token-parity.test.ts` (fails on a missing
  canonical token on either side, and on any undocumented Swift extra).
- Web legacy aliases `fg-1`/`bg-1`/`bg-2` DELETED; all call sites migrated
  to canonical names. `hairline` kept (canonical).
- Swift platform-local (documented, allowed by the parity test):
  - `accent`, `accentInk`, `accentText`, `accentDim` — deliberate dual-accent
    system (fill vs text legibility on paper), NOT pre-Line remnants as the
    2026-07-16 audit guessed. Canonical `green` maps to the text-legible
    variant, matching web's light-mode retune of `--tl-green`.
  - `duprTint`/`duprBorder` — DUPR brand chip; add to web IF web DUPR
    surfaces need them.
  - `uiBg`/`uiFg`/`uiFg3`/`uiAccent` — UIKit chrome handles (nav/tab bars),
    must stay `UIColor`-dynamic.
- Adding a token: meaning row here first → both files → the test's canonical
  list. The test bounces anything else.

## Rules

1. Components reference ONLY semantic tokens — no raw hex, no Tailwind
   palette colors in Line-styled surfaces (rule already stated in
   `DoublesEliminationBracket.tsx` header; now global).
2. New tokens require a meaning row here first; PRs adding a bare hex get
   bounced to this doc.
3. Light/dark: tokens are theme-resolved at the CSS-var/Asset-catalog layer;
   components never branch on theme.

## Touch targets (A11Y-02)

- Any control whose visual size is ≤20px MUST carry a ≥44px hit area:
  either an after-inset pseudo-element on the control
  (`relative after:absolute after:-inset-3 after:content-['']` — the shadcn
  Checkbox/RadioGroupItem/Switch primitives already do this) or a full-row
  wrapping label (`min-h-11 items-center cursor-pointer`).
- Contract test: `src/components/ui/__tests__/touch-targets.test.tsx` pins
  the primitive classes; Button sizes are pinned by `button-ds03.test.tsx`.
- Drag is never the only path: flex mobile uses tabs, quicktable manual
  group assignment uses tap-to-select (player row → group card).
