# Visual gate classification — 20 November 2026

Resolver proof: workflow44773469452, exact head36b345aadff19ecfeb079f58871bc0cf43d60b76,
verified https://14ad82bd.pickle-hub-pro.pages.dev at16:40:56UTC, then ran both
visual projects. Actual Cloudflare deployment14ad82bd-011c-4c01-9f9f-2d035f2d760f
was created16:26:08, deployed16:40:24. Project config permits all preview branches
and paths (includes*, excludes empty); this was a real build queue, not watch-path
exclusion. No preview trigger, baseline approval or deployment config mutation.

The job is green because existing screenshot comparisons are advisory, not
because pixel acceptance passed. Raw log has28 failed cases. Downloaded artifact
14649122639 (visual-diff,22.8MB) and parsed every case:

- 24 pixel mismatches: home,rankings,blog-index,tournaments,live,clubs,news,tools,
 feed,home-vi,rankings-vi,news-vi, each desktop/mobile.
- 4 missing baselines: shop-home and shop-sell, each desktop/mobile. They produced
 actual screenshots but no expected image; they are not pixel regressions.

[Machine-readable case classification](2026-11-20-visual-failure-classification.json)
is from raw test log, not inferred from green status. No auth/staging fixture
skip caused these28 failures; all routes are anonymous public visual cases.

Representative artifact inspection:

| Route | Observed difference | Classification / unresolved work |
|---|---|---|
| Home desktop | Expected Week30, July live replay card, old widgets; actual Week47, AI bracket CTA and changed story ticker. | Old baseline plus live/unmasked content and source UI changes; not an OPS code regression. Review intended current layout before recapture. |
| Tools mobile | Expected no-signup copy and old social-centred nav; actual sign-in copy, tools/nav/assistant changes; live totals28→54 and0→8. | Product changes and unmasked aggregates. Must verify intended copy/nav and use deterministic fixtures for a useful visual gate. |
| Clubs desktop | Live club order/text/metadata, widgets and serif metrics differ; public club content renders rather than auth/error page. | Volatile data plus font environment; cannot approve all differences as harmless without scope-specific review. |
| Shop sell mobile | Actual seller landing renders, expected image absent. | Missing reviewed baseline; no automated overwrite authorized. |

Baseline history read-back: home-visual-linux.png last changed2026-07-20,
commitcbd098bbd38a21f5830b7202fc312093c2155888. That age explains why current
product layout is not frozen by this expectation; it does not certify current UI.

Additional bounded font reproduction on exact preview /clubs, system Chrome
1280×720 with150ms network latency: declared family Instrument Serif, but after
document.fonts.ready a warm reload used CDP platform font Times-Italic,
isCustomFont=false,23glyphs. Source index.html uses font-display:optional for
Instrument Serif/Latin Inter/GeistMono. Waiting for fonts.ready does not establish
that optional faces were actually used. This demonstrates an environment/first
paint factor, not proof that every CI pixel difference is font-only. A separate
font/readiness review should establish intended first-paint behavior and actual
rendered-font evidence before changing test setup or application font policy.

Next work: review four missing Shop baselines; deterministic content fixtures
for volatile public data; explicit rendered-font readiness policy; compare
reviewed current layout rather than wholesale July baseline regeneration.
Do not loosen screenshot thresholds or treat resolver correctness as UI9/10.
