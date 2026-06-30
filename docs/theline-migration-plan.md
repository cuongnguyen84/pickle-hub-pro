# The Line migration plan — one theme for the whole site

**Decision (2026-06-19):** standardize the entire site on the **The Line** theme
(`data-theme="the-line"`, `src/styles/the-line.css`, `TheLineLayout`). Retire the
legacy **default** theme (`src/index.css` teal palette + `MainLayout` / `AppHeader`
/ default `BottomNav` / `MatchFAB`).

This doc is the inventory + phased plan. No code changes yet.

---

## 1. Current reality (measured, not assumed)

- `src/index.css` (teal `--background` / `--primary`) is the **root** theme, imported in `main.tsx`.
- The Line is a **scoped override**: `TheLineLayout` pins `data-theme="the-line"` on `<html>` while mounted, restores the previous theme on unmount.
- **81 / 127 page files already use `TheLineLayout`.** The non-The-Line pages are far fewer than first feared — only **32** real pages (excluding `.legacy.*` and `/preview/*`), and they fall into a handful of clusters that share a shell:

| Cluster | Count | Chrome | Notes |
|---|---|---|---|
| Admin | 16 | `AdminLayout` (own shell, default tokens) | internal, low traffic |
| Creator | 8 | `CreatorLayout` (own shell, default tokens) | creator dashboard |
| Public, stuck on `MainLayout` | 3 | `MainLayout` | `WatchVideo`, `Notifications`, `BlogPost` |
| Embeds | 2 | none (bare iframe) | **stay bare — out of scope** |
| Redirects / auth / utility | ~3 | none / trivial | `AuthCallback`, `ResetPassword`, `ShareRedirect`, `QuickTableRedirects`, `ForumCategory`, `ParentTournamentPage` |

- `MainLayout` is **nearly dead**: only 3 pages import it; `AppHeader` only 2 files.
- `BottomNav` (hardcodes `#00b96b`) lives in `App.tsx`, `AdminLayout`, `CreatorLayout`, `ChatFAB`.
- **~13 files hardcode `#00b96b`** outside the token (BottomNav, ChatFAB, comment inputs, `Tools`, `Tournaments`, `BracketLab`, `MyTournaments`, preview lists).
- `glass-card` (a default-theme utility) used in ~10 files.
- **Bonus:** `/preview/the-line/watch/:id` and `/preview/the-line/blog/:slug` already exist → The Line versions of `WatchVideo` and `BlogPost` are already built as previews. Migrating those is **promote**, not rebuild.

**Conclusion:** "drop the default theme" is really **4 work streams**, not 81 page rewrites:
(A) promote 3 stuck public pages, (B) re-theme `AdminLayout`, (C) re-theme `CreatorLayout`, (D) make The Line the root theme + kill the teal `index.css` defaults.

---

## 2. Phased plan

> **Principle: structure before color.** Migrate layouts onto The Line tokens FIRST
> (keep the current green). Do the Variant B accent/font retune only AFTER everything
> is on one system. Never change layout and palette in the same PR. One cluster = one PR.

### Phase 1 — Retire dead default chrome  ·  DONE (PR #236)
- **Correction:** the "3 stuck public pages" (`WatchVideo`, `Notifications`, `BlogPost`)
  were a false positive — they already render inside `TheLineLayout` (migrated in earlier
  sprints; only their comments still mention MainLayout). Nothing to promote.
- `MainLayout` and `MatchFAB` were **dead** (zero JSX usage) → deleted; dropped the
  MainLayout re-export from the layout barrel.
- `AppHeader` kept: still used by the App-level `ErrorBoundary` crash fallback
  (re-theme to The Line tokens in Phase 4/5).

### Phase 2 — Re-theme `AdminLayout` → The Line tokens  ·  DONE (PR #237)
- Covers all 16 admin pages by setting `data-theme="the-line"` + importing the-line.css. No per-class swaps.
- **KEY UNLOCK found here:** the-line.css's token block was `[data-theme="the-line"]`
  (specificity 0,1,0), tying with index.css `:root` (0,1,0); index.css loads later
  so `:root` won and shadcn `--primary`/`--background` stayed teal even with the pin
  set. Fixed by `:root[data-theme="the-line"]` (0,2,0). The home page hid the bug
  because it styles with `.tl-*` classes (the `--tl-*` namespace), not raw shadcn
  tokens. **This fix makes the documented token-remap actually win on ALL the-line
  pages** — it's the foundation every later phase depends on.
- Recipe (now proven, reused by every shell): (1) `import "@/styles/the-line.css"`,
  (2) `data-theme="the-line"` pin useEffect (mirror TheLineLayout, restore on unmount).

### Phase 3 — Re-theme `CreatorLayout` → The Line tokens  ·  DONE (PR #238)
- One shell (281 lines) covers all 8 creator pages. Same proven recipe as P2.
- Its mobile nav already uses tokens (`bg-background-elevated`) so it recolored
  for free; no shared `BottomNav` change was needed here (that `#00b96b` lives in
  the default `BottomNav` component, handled in cleanup/P5).
- **GOTCHA (learned in P2):** the recipe is TWO things, not one:
  1. `import "@/styles/the-line.css";` in the shell (it is code-split per layout;
     without the import the rules never load and the pin matches nothing →
     page silently falls back to the default teal palette), AND
  2. the `data-theme="the-line"` pin useEffect (mirror `TheLineLayout`).
  Both `bg-background` and the teal accent are dark, so a missing import looks
  like "almost themed" — only the accent gives it away. Always verify the accent
  is green, not just that the background is dark.

### Phase 4 — Make The Line the ROOT theme  ·  risk: HIGH · ~1.5–2 days
- The strategic core. Two options to evaluate:
  - **(a)** Retune `src/index.css` defaults to The Line palette (so `bg-background`, `text-primary`, shadcn all become The Line), or
  - **(b)** Apply `data-theme="the-line"` at the app root and drop the scoped pin.
- Hunt + migrate the ~13 hardcoded `#00b96b`.
- **Re-sync the claude.ai/design DS afterward** — it was built from the teal `index.css` tokens (see `.design-sync/NOTES.md`), so it goes stale here.
- Highest blast radius → do it LAST, after shells prove the recipe.

### Phase 5 — Cleanup  ·  risk: low · ~0.5 day
- Delete dead default chrome, audit `glass-card` (10 files), remove orphaned teal CSS.

### Phase 6 (optional, later) — Variant B retune
- Apply the accent (optic-lime + amber), dual fill/text token, 2-register headings,
  VN-safe serif, light-mode harden on the now-unified system. See `mockups/taste-landing-b.html`.

**Total to single-theme (Phases 1–5): ~4.5–6 focused days** (AI does the bulk; human reviews visual diffs + native). Variant B is additive on top.

---

## 3. Cross-cutting risks
- **Native (Capacitor):** `BottomNav` + chrome ship to iOS/Android webview. Test status bar, safe-area, tab colors after Phases 1/3.
- **Visual regression:** the `visual` Playwright project baselines need re-approval per migrated cluster. The human eyeball pass is the time sink, not the code.
- **Light mode:** partially built (`[data-mode="light"]` block + ~7 overrides). Harden per shell as we migrate.
- **VN diacritics on Instrument Serif** at display sizes — test on real content (defer to Phase 6 if it blocks).
- **Design-sync drift:** Phase 4 invalidates the synced (teal) DS → schedule a re-sync.

## 4. Out of scope
- Embed pages (`EmbedLive`, `EmbedVideo`) stay chrome-less by design.
- Pure redirects (`ShareRedirect`, `QuickTableRedirects`, `AuthCallback`, `ResetPassword`).

## 5. Open decisions (need Cuong)
1. Phase 4 approach: retune `index.css` (a) vs root `data-theme` (b)?
2. Do admin/creator dashboards get the FULL The Line editorial chrome (ticker/serif headers), or just the **tokens** (colors/fonts) on a calmer dashboard layout? (Recommendation: tokens only — editorial chrome is wrong for a data dashboard.)
3. Bundle Variant B retune into this effort, or ship single-theme first then retune?
