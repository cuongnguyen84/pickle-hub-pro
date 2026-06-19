# design-sync notes — ThePickleHub Design System

This repo is the **app** (`vite_react_shadcn_ts`), not a packaged design-system library. The DS is the shadcn/ui set under `src/components/ui/`. Synced as the **package** shape in **synth-entry** mode (no built component-library `dist/` — the converter synthesizes an entry from `src/components/ui`).

## Build gotchas (per-clone setup)

- **Self-package symlink (required).** PKG_DIR defaults to `node_modules/<pkg>`, which doesn't exist for a repo syncing itself. Recreate before building: `ln -sfn .. node_modules/vite_react_shadcn_ts`. It's gitignored (under `node_modules`), so re-run on every fresh clone.
- **`srcDir` scoping.** `cfg.srcDir = src/components/ui` keeps synth-entry/discovery to the shadcn set; without it, synth-entry pulls the whole app and discovers hundreds of stray PascalCase exports.
- **`cssEntry` is a hashed file.** `dist/assets/index-<hash>.css` (the compiled Tailwind + tokens). The hash changes on every app `npm run build`. **Before any re-sync, update `cfg.cssEntry` to the current file:** `ls dist/assets/*.css`. A stale path drops all utilities/tokens.
- Converter deps live in `.ds-sync/` (esbuild, ts-morph, @types/react); playwright chromium is installed for the render check.

## Curation decisions

- **31 top-level components** get cards; **110 sub-parts** (CardHeader, SelectItem, DialogContent, …) are excluded from the card list via `componentSrcMap: null` but remain importable on `window.PickleHubUI` (the bundle `export *`s every src file). Previews compose the sub-parts inside their parent.
- **`Toaster` excluded** — name collision: both `toaster.tsx` and `sonner.tsx` export `Toaster`, so `export *` left it ambiguous/undefined on the global ([BUNDLE_EXPORT]). It's a mount-once container, not a static card.
- **`.d.ts` props are hand-written** in `cfg.dtsPropsFor` — synth-entry + cva `VariantProps` can't be resolved by ts-morph, so auto-extraction yielded `[key: string]: unknown` for all 31. The hand-written bodies are the real API contract the design agent sees; keep them in sync if a component's props change.

## Theme + fonts

- **Dark-premium only.** Tokens at `:root` (no `.dark`, no light mode). Every preview wraps content in a `bg-background text-foreground` stage so light-on-dark text is visible (preview cards render on a white page by default).
- **Brand fonts** (Inter, JetBrains Mono) ship via a remote Google-Fonts `@import` in `.design-sync/brand-fonts.css`, wired into the `styles.css` closure through `cfg.tokensPkg` (the self-package symlink) + `cfg.tokensGlob`. `cfg.runtimeFontPrefixes` suppresses `[FONT_MISSING]` for the host/system-served families (`Geist`, `Instrument Serif`, `Cambria` are spurious preset entries, not used).
- **Overlays** (Dialog, AlertDialog, Sheet, Drawer, Popover, DropdownMenu, Tooltip, Select, Toast) use `cfg.overrides.<Name>.cardMode = "single"` + a viewport so the open state renders inside one card; `Table` uses `cardMode: "column"`.

## Known render warns

- None. All 31 render cleanly; if a re-sync prints a warn not listed here, it's new — inspect it.

## Re-sync risks (watch-list)

- **`cssEntry` hash drift** (highest risk): re-point `cfg.cssEntry` at the current `dist/assets/index-*.css` before re-syncing, or rebuild the app first.
- **Self-package symlink** must be recreated on a fresh clone (gitignored).
- **New shadcn components** added to `src/components/ui/` appear automatically (PascalCase synth discovery) — decide keep-vs-exclude in `componentSrcMap` and add `dtsPropsFor`.
- **Brand fonts load remotely** (Google Fonts `@import`) — an offline/CSP-blocked render falls back to system fonts. Self-host woff2 via `cfg.extraFonts` if that ever matters.
- **`dtsPropsFor` is hand-maintained** — it does not track upstream prop changes; revisit when components change.
