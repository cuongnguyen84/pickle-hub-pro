# Performance Budgets (PERF-01)

> Baselines re-measured 2026-07-17 (perf-js-gzip investigation).
> The CI guard (`quality.yml` → `scripts/check-bundle-size.mjs`) enforces the
> INITIAL, CODE, per-content-chunk, and total lines; the rest are review
> budgets until PERF-04/OPS-04 automate them.

## Measurement model (perf-js-gzip, approved by Cuong 2026-07-17)

`check-bundle-size.mjs` reports three numbers instead of one aggregate:

- **INITIAL** — gz the browser fetches on first paint: entry `<script>` +
  `modulepreload` links in `dist/index.html` + their recursive static imports.
  This is the number users feel; an aggregate stays flat while a lazy chunk
  silently becomes eager (recharts did exactly that — 107.8 KB gz preloaded on
  every page while every consumer was a lazy route).
- **CODE** — all JS except `assets/blog-post-*.js`. Blog posts are bilingual
  lazy content (~7.5 KB gz each, growing with every article); counting them as
  code made the budget creep per published post.
- **CONTENT** — the blog-post chunks, with a per-chunk cap so one bloated
  article still goes red.

STRICT mode also asserts **every initial-load chunk matches a PWA precache
glob** in `vite.config.ts` — a boot-critical chunk missing from precache
bricks installed PWAs on offline launch (the next-outage class identified by
the perf-js-gzip pre-mortem).

## Current baseline (2026-07-17, after recharts removal)

- INITIAL: **~265 KB gz**, 6 critical-path requests (was 372.5 with the
  recharts eager bug)
- CODE: **~1455 KB gz** (was 1576.8 with recharts)
- CONTENT: **353.2 KB gz** across 47 blog chunks (max single chunk ~15 KB)
- Total: **~1822 KB gz** (backstop unchanged at 1970)
- Entry chunk: ~102 KB gz (the old "~170 KB" line in this doc was stale)
- PWA precache: **~1.63 MB** (includes self-hosted Latin/Vietnamese fonts)

## Budgets

| Metric | Budget | Now | Owner |
|---|---:|---:|---|
| INITIAL first-paint gz (CI-enforced) | ≤ 280 KB | ~265 | every PR |
| CODE gz (CI-enforced) | ≤ 1800 KB | ~1455 | every PR |
| Per blog-post content chunk (CI-enforced) | ≤ 20 KB | 15 max | every PR |
| Total gz JS backstop (CI-enforced) | 1970 KB — ratchets DOWN only | ~1822 | deletion/dependency cuts |
| Any single route chunk gz | ≤ 150 KB (no grandfathers) | 136 max | every PR |
| PWA precache | ≤ 3 MB | 1.63 MB | hold |
| Homepage total transfer (clean desktop lab) | ≤ 3 MB | 0.84 MB | Lighthouse |
| Homepage media before user play | 0 bytes | 0 bytes | Lighthouse |
| Images on journey screens | responsive srcset + explicit dimensions; no >200 KB above-the-fold image | homepage compliant | PERF-04 |
| Mobile p75 (Vietnam RUM, GA4 `web_vital`) | LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1 | collecting since BASE-03 | PERF-05 validates |

## Rules

1. Budgets only ratchet DOWN after reductions land; any future bump needs a
   line here explaining what grew and which task pays it back.
2. A PR adding a dependency >20 KB gz to the INITIAL path needs a stated
   reason in the PR body.
3. New heavy features load behind `import()` at a route or interaction
   boundary by default (the Mux precedent).
4. A dependency swap must remove the old library from `dist` in the same PR
   (never ship both), and chart replacements must keep empty/sparse-data
   rendering covered by a unit test (perf-js-gzip lesson).

## History

- 2026-07-16: total guard 1900→1950→1970 (two stopgap bumps); CLOSE-01 clawed
  back 46.1 KB; PERF-02 split TeamMatchView to ~136 KB; PERF-03 precache
  7.8 MB→1.44 MB; PERF-06 split locale dictionaries.
- 2026-07-17 (perf-js-gzip): measurement split into INITIAL/CODE/CONTENT with
  precache-coverage guard; recharts removed (−107.8 KB INITIAL, −122 KB total);
  INITIAL budget set at 280 KB.
- 2026-07-21 (homepage transfer/CLS): clean desktop Lighthouse transfer
  13.6 MB → 0.84 MB; media 6.7 MB → 0 before interaction; image transfer
  5.6 MB → ~0.33 MB; desktop LCP 4.0–6.9s → 1.34–1.38s and Lighthouse CLS
  0.18–0.24 → 0.000 across three runs. A synchronous editorial anchor plus
  fixed section ordering removed the direct-observer CLS spike (previously
  0.91 desktop / 1.46 mobile). Self-hosted font subsets removed cold-run font
  stalls. Mobile simulated Lighthouse is now stable at 0.70, LCP 5.93–6.23s
  and CLS 0.000 across three runs; real-user p75 remains the release metric.
  PWA precache is 1.63 MB, still well below its 3 MB budget.
