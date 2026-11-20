# Public-route accessibility check — 2026-11-20

## Source and scope

Checked the local Vite application at `http://127.0.0.1:4175`, based on
`main` HEAD `f74724368456c110fd01e3a38da9d53d02567a70`, with the existing dirty
working tree. This is local evidence, not a verification of that clean commit,
the eventual merged tree, or production. The scoped patch from this check is:

- `src/styles/the-line.css`: two light-mode foreground overrides.
- `src/styles/__tests__/contrast.test.ts`: two regression tests.
- This audit record.

Other concurrent working-tree changes were preserved. No packages, application
data, backend settings, or scoring behavior were changed by this check.

## Method and results

Used installed system Chrome in headless mode through the existing Playwright
and `@axe-core/playwright` dependencies, with `wcag2a` and `wcag2aa` tags.
Each route used a fresh browser context with service workers blocked. The scan
waited 2.5 seconds after navigation and selected each theme through the root
class and `data-mode` attribute. Viewports were 390 × 900 and 1280 × 900.
Post-fix scans completed at approximately 20:42 +07:00.

| Route | 390 dark | 390 light | 1280 dark | 1280 light |
| --- | --- | --- | --- | --- |
| `/vi` | 0 / review | 0 / review | 0 / review | 0 / review |
| `/vi/social` | 0 | 0 | 0 | 0 |
| `/vi/tools` | 0 | 0 | 0 / review | 0 / review |
| `/vi/clubs` | 0 | 0 | 0 | 0 |

Numbers count serious/critical violations and any color-contrast violation
reported after the patch. “Review” means axe also returned an incomplete
color-contrast rule requiring manual assessment. All four routes rendered;
none were skipped. These results cover the public initial rendered state,
not authenticated flows, every interaction, or a full WCAG conformance audit.

## Reproduced defects and narrow fixes

| Location and mode | Before | After |
| --- | --- | --- |
| `/vi`, light, both widths: `.tl-ai-cta-go` | Text `#0e0f12` on `#516c1b`: axe reported 3.2:1 | Text `#ffffff` on the same green fill: 5.98:1 |
| `/vi/tools`, light, desktop: quick-tables `.tl-format-kicker` | Text `#00b96b` on `#fcfbf7`: axe reported 2.48:1 | Text `var(--tl-green)` (`#516c1b`): 5.78:1 |
| `/vi/tools`, light, desktop: doubles-elim `.tl-format-kicker` | Text `#e9b649` on `#fcfbf7`: axe reported 1.8:1 | Same readable semantic green text: 5.78:1 |

These small labels require at least 4.5:1. The changes affect only light-mode
text: the CTA fill remains unchanged, and format-card decorative accent colors
remain available for decoration. The label foreground also achieves 5.39:1 on
the hover background `#f5f3ee`. Browser computed styles confirmed the new CTA
foreground/fill and the new label foreground. Ratios above use the sRGB WCAG
relative-luminance calculation; axe re-scans no longer reported these defects.

## Remaining manual-review items

The incomplete rule was `color-contrast`; its presence is not a pass or a
confirmed defect. Desktop light-mode inspection identified:

- Homepage `.tl-ticker-head`: another element overlaps its background.
- Homepage `.tl-ai-cta-kicker`, `.tl-ai-cta-title`, `.tl-ai-cta-sub`: gradient
  background prevents automatic contrast determination.
- Homepage decorative arrow inside `.tl-dupr-guide-cta`: non-text character.
- Homepage discovery story tag: pseudo-element background.
- Tools quick-tables and doubles-elim `.tl-format-badge`: pseudo-element
  backgrounds.

The homepage returned no `h1` in the initial scan and needs a separate heading
structure review. No content or layout redesign was included in this patch.
No user-generated text or raw DOM snapshots are included in this report.

## Regression checks

- `npx vitest run src/styles/__tests__/contrast.test.ts`: 78 tests passed.
- `npx eslint src/styles/__tests__/contrast.test.ts`: passed.
- `git diff --check`: passed.
- Actual Chrome/axe re-scan of all 16 route/theme/viewport combinations:
  zero reported serious/critical or color-contrast violations, with the
  incomplete cases documented above.

This patch is ready for review; merge/deployment and post-deployment checking
are separate steps. It does not establish full WCAG AA compliance.
