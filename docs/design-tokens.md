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

## Parity status (2026-07-16)

- Web has, Swift lacks: `fg-1`/`bg-1`/`bg-2` aliases (web-only legacy — DS-02
  should DELETE the aliases rather than port them), `hairline`, `blue`,
  format accents (`accent-qt/team/elim/flex`), `green-dim/glow` variants.
- Swift has, web lacks: `accentInk`, `accentText`, `uiBg/uiFg/uiAccent`
  (pre-Line remnants — candidates for deletion), `duprTint/duprBorder`
  (domain tokens; add to web IF web DUPR surfaces need them, else Swift-local).
- DS-02 acceptance: every token in the canonical set exists on both
  platforms with the same meaning; anything outside the set is deleted or
  documented as platform-local; a checklist test (or small script) asserts
  the name list matches both files.

## Rules

1. Components reference ONLY semantic tokens — no raw hex, no Tailwind
   palette colors in Line-styled surfaces (rule already stated in
   `DoublesEliminationBracket.tsx` header; now global).
2. New tokens require a meaning row here first; PRs adding a bare hex get
   bounced to this doc.
3. Light/dark: tokens are theme-resolved at the CSS-var/Asset-catalog layer;
   components never branch on theme.
