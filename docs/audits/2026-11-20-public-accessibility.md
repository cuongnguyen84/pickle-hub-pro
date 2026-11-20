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

## Appendix: manual review of incomplete contrast cases

Follow-up on 2026-11-20, approximately 20:54–21:00 +07:00, used system Chrome
computed styles for each previously incomplete element at both widths and in
both themes. This remained the same local dirty working tree, with one
additional scoped story-tag foreground override and one regression test.
The earlier CTA and format-label fixes were left unchanged.

| Previously incomplete element | Manual evidence | Result in inspected state |
| --- | --- | --- |
| Homepage ticker heading | Opaque background: light `#f5f3ee`, text `#3a3933`, 10.45:1; dark `#0f1012`, text `#c7c3bb`, 10.83:1. Three horizontal hit-test samples returned the heading as the top painted element. Its 6px decorative dot is a separate flex child. A cropped browser screenshot showed unobscured heading text. | Contrast passes for the loaded blog ticker state; no overlay repair needed. Other ticker content states were not forced. |
| AI CTA kicker | The first background layer is an **opaque constant-color gradient**, clipped to the padding box. Its border gradient is behind this layer and does not appear beneath the text. Light `#516c1b` on `#f5f3ee`: 5.39:1; dark `#b5e853` on `#0f1012`: 13.26:1. | Passes; no gradient suppression or style change. |
| AI CTA title | Same opaque interior; light `#08090a`: 17.97:1, dark `#f5f3ee`: 17.17:1. | Passes. |
| AI CTA description | Same opaque interior; light `#3a3933`: 10.45:1, dark `#c7c3bb`: 10.83:1. | Passes. |
| DUPR guide decorative arrow | Inherited `#0e0f12` on opaque `#ece7d8`: 15.50:1. The arrow is `aria-hidden`; the link also has text. Hover swaps the same colors, preserving the ratio. | Passes for this non-text decoration. |
| Tools format badges | Own opaque background: light `#eeebe1`, text `#605d56`, 5.51:1; dark `#131416`, text `#93908a`, 5.79:1. The card pseudo-element is only a 3px stripe at its left edge. Desktop badge left edges were at least 485px from the card's left edge, so this stripe cannot be the backdrop beneath badge text. | Passes; retained native pseudo-element decoration. |
| Homepage story tags | Before follow-up fix, light text `#fcfbf7` on `rgba(0,185,107,.9)` failed: alpha compositing over any possible opaque image gives only 2.29–3.04:1. A cropped browser screenshot confirmed the light text on green. This is a real failure hidden behind an axe incomplete result. | Fixed as described below. |

The added rule is scoped to `[data-theme="the-line"][data-mode="light"]
.tl-story-tag` and changes only its foreground to `var(--tl-fg)` (`#08090a`).
The existing 90% green fill, image, blur, spacing, and dark mode are unchanged.
For this foreground, the green fill composited over black is the worst-case
background: 6.32:1. Over white it is 8.41:1. Since every image channel falls
between those endpoints, the text remains above 4.5:1 for all opaque image
backgrounds, including the current gradient and its overlay. The regression
uses a conservatively rounded-down darkest fill `#00a660` to protect this
bound. Existing dark text on the same fill already passes.

This appendix resolves the inspected contrast incompletes through explicit
style/layer analysis rather than removing them from axe output. Dynamic feed
content, alternate ticker states, the missing homepage `h1`, interaction
coverage, and full WCAG conformance remain outside this result.

Follow-up verification: 79/79 contrast tests, scoped ESLint, and
`git diff --check` passed. A further system-Chrome/axe run completed all 16
combinations with zero reported serious/critical/color-contrast violations;
axe still marks the same contrast rule incomplete where it cannot infer
background layers. Post-fix browser computed style and a cropped screenshot
confirmed the story-tag foreground is `rgb(8,9,10)` on the unchanged
`rgba(0,185,107,.9)` fill. No axe rule was disabled.
