# Performance Budgets (PERF-01)

> Baselines measured 2026-07-16 (CI bundle guard + build output).
> The CI guard (`quality.yml` BUNDLE_BUDGET_KB) enforces the total-JS line;
> the rest are review budgets until PERF-04/OPS-04 automate them.

## Current baseline (2026-07-16)

- Total gzipped JS: **1903.8 KB** (guard at 1970 after two stopgap bumps:
  1900→1950→1970; CLOSE-01 preview deletion clawed back 46.1 KB)
- Entry chunk: ~170 KB gz (locale dictionaries split out by PERF-06)
- Largest route chunk: `TeamMatchView` ~241 KB (known lever, PERF-02)
- `vendor-video` (Mux/HLS) 1.07 MB and charts 411 KB are already lazy
- PWA precache: **~7.8 MB / 379 entries** (broken globIgnores — PERF-03)

## Budgets

| Metric | Budget | Now | Owner |
|---|---:|---:|---|
| Total gz JS (CI-enforced) | hold at 1970 — splitting redistributes but does not shrink the sum (PERF-02 measurement); reductions come from deletion (CLOSE-01 preview pages, done: 1950→1903.8) or dependency cuts | 1903.8 | deletion/dependency cuts |
| Entry chunk gz | ≤ 170 KB (no growth) | ~170 | every PR |
| Any single route chunk gz | ≤ 150 KB (no grandfathers — TeamMatchView split to ~136 KB by PERF-02) | 136 max | every PR |
| PWA precache | ≤ 3 MB | **1.44 MB** (PERF-03 done) | hold |
| Images on journey screens | responsive srcset + explicit dimensions; no >200 KB above-the-fold image | unaudited | PERF-04 |
| Mobile p75 (Vietnam RUM, GA4 `web_vital`) | LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1 | collecting since BASE-03 | PERF-05 validates |

## Rules

1. The CI guard only ratchets DOWN after this document's reductions land;
   any future bump needs a line here explaining what grew and which task
   pays it back (see 2026-07-16 entries).
2. A PR adding a dependency >20 KB gz to the entry path needs a stated
   reason in the PR body.
3. New heavy features load behind `import()` at a route or interaction
   boundary by default (the Mux/charts precedent).
