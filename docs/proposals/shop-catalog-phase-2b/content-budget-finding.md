# Finding — blog CONTENT is spending the CODE budget

> Raised 2026-08-12 during P2b.0. **Not actioned in P2b**, by Product Owner
> instruction: `docs/perf-budgets.md` is not edited and the backstop is not
> raised as part of this phase. This file exists so the decision is taken
> deliberately later rather than rediscovered by whichever feature goes red next.

## What was observed

`scripts/check-bundle-size.mjs` reports four numbers. Three have budgets that
match their purpose. The fourth does not:

| Metric | Budget | Counts blog content? |
|---|---:|---|
| INITIAL | 280 KB | no |
| CODE | 1800 KB | **no — deliberately excluded** |
| per content chunk | 20 KB | yes (that is its job) |
| **Total gz backstop** | **1970 KB** | **yes** |

`perf-budgets.md` states why CODE excludes blog posts:

> Blog posts are bilingual lazy content (~7.5 KB gz each, growing with every
> article); counting them as code made the budget creep per published post.

The total backstop was never given the same treatment, so the creep simply moved
there.

## The numbers

| Date | CONTENT gz | chunks |
|---|---:|---:|
| 2026-07-17 (baseline in `perf-budgets.md`) | 353.2 | 47 |
| 2026-08-12 (measured on `feat/shop-production-phase-2b`) | **383.9** | **51** |

**+30.7 KB across four new articles.** P2a finished with 6.0 KB of headroom
against the 1970 KB backstop. Those four articles are, to within a rounding
error, the entire headroom P2b needed — and no one writing them was making a
performance decision.

The mechanism repeats indefinitely: every future post takes ~7.5 KB from
whichever feature ships next, and the feature pays for it in an optimisation
sprint that has nothing to do with the post.

## Why it was not "fixed" in P2b.0

The two obvious moves are both wrong:

- **Raising the backstop** — explicitly out of bounds, and it would hide the
  mechanism rather than answer it.
- **Renaming the content files** so the guard stops counting them (it only walks
  `.js`) — that frees 383.9 KB on paper while moving zero bytes, and it breaks
  the SSR barrel path CLAUDE.md warns about. Gaming the metric is worse than
  the metric being wrong.

P2b.0 instead freed 54.7 KB of real code bytes (hls.js light build + dead
player), which buys P2b room without touching this question.

## What a decision would look like

Three options, in order of how much they change:

1. **Ratchet the total against CODE + a separate CONTENT allowance.** The guard
   already computes both. A `BUNDLE_CONTENT_BUDGET_KB` with its own line, and a
   total that is the sum of two budgets rather than one number, keeps every byte
   counted while making a post's cost visible as a post's cost.
2. **Keep one total, but ratchet it explicitly per published post** — i.e.
   accept the creep and write it down each time, so it is a decision instead of
   a surprise.
3. **Leave it.** Valid only if blog publishing is about to stop, which it is
   not.

Option 1 is the recommendation. It is a change to `check-bundle-size.mjs` and to
`perf-budgets.md`, roughly an hour, and it needs a Product Owner line in the
budgets doc explaining what grew and which task pays it back — which is what
`perf-budgets.md` rule 1 already demands of any bump.

## Budgets P2b continues to run under, unchanged

- total ≤ **1970 KB** (currently 1909.3)
- INITIAL ≤ **280 KB** (currently 226.0)
- any single route chunk ≤ **150 KB**
- never raised by this phase
