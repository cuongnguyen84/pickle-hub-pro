## Prompt sent

<task>
Repo: /Users/cm10/pickle-hub-pro, branch `seo-03-ci-validation` (PR #351), base `main`, HEAD = `41719bb6`. Working tree clean. This is round 2 of a review — round 1 found 4 findings, since claimed fixed in this HEAD commit.

Round 1 findings (claimed fixed, re-verify each against current code):
1. [P1] SPA-fallback false-green risk: the per-route canonical assertion could pass even when a route silently served the SPA shell fallback (which also carries a canonical tag, just the wrong one) instead of a real SSR render. Claimed fix: the assertion now checks canonical PATH equality against the specific sampled URL's own path (not just "a canonical tag exists"), so a prerender fallback serving the root/shell canonical now fails the check. Author explicitly considered also requiring "JSON-LD block count > 0" as a second belt-and-suspenders check and deliberately reverted it: `/clb/122-dinh-cong` (an organizations-segment page) is genuinely real, correctly SSR-rendered today with ZERO JSON-LD blocks (a known, separate schema gap in the organization SSR handler, called out as follow-up work) — requiring JSON-LD > 0 would falsely fail that legitimate page. Verify by reading the code: (a) the canonical-path-equality assertion is present and correctly compares pathnames (not full URLs, not just host, not case/trailing-slash mismatched) for the sampled SSR routes; (b) no JSON-LD-count assertion was reintroduced that would break on the zero-JSON-LD organizations page; (c) the path-equality check would in fact catch a route silently falling back to the SPA shell.
2. [P1] Silent empty segments: previously an empty child-sitemap urlset was treated identically to "fine, nothing to check". Claimed fix: an empty urlset now fails the test with an explanatory message, unless the segment's name is present in a `MAY_BE_EMPTY` allowlist, which is currently empty. Verify the allowlist mechanism exists in code, is genuinely empty right now, and the failure message is informative.
3. [P2] `@graph`/array JSON-LD walker: a `collectJsonLdNodes()`-style function was added that recurses into JSON-LD arrays and nested `@graph` structures at arbitrary depth, and handles an array-valued `@type`. Verify by reading the function against three concrete shapes: (a) top-level array `[{"@graph": [...]}]`, (b) `@graph` nested inside another `@graph`, (c) a node with `"@type": ["BlogPosting", "Article"]` — confirm required-fields validation reaches BlogPosting/NewsArticle nodes in all three shapes. You may use a quick standalone `node -e` snippet to trace the function's logic on these three inputs if that's faster than manual tracing, but do not run the project's full test suite/build/lint.
4. [P2] Regex robustness claims: attribute-order/whitespace tolerance via `\s*=\s*` around `=` on type/rel/href; a leading `\s` before `type=` so `data-type=` cannot false-match; `<title[^>]*>` instead of literal `<title>`; `<url[\s>]` (not just `<url>`) for sitemap `<url>` boundaries; optional CDATA handling on `<loc>`. Verify each of these five specific claims by reading the actual current regex/parsing code.

Do a full fresh review of the entire current branch diff vs main (`git diff main...seo-03-ci-validation` — read it once, in full) — do not just spot-check the 4 claimed fixes. Also look for anything not covered by round 1: other JSON-LD/canonical/sitemap parsing edge cases, timeout budget for the sweep test given real segment count, resource cleanup (page/context) across the per-segment loop, and any other correctness issue visible in the diff.
</task>

<scope_and_speed>
The author has already verified eslint is clean and the full Playwright spec is 8/8 green against production for this commit. Do NOT re-run the full test suite, `npm run build`, or the linter — that would waste time re-confirming things already verified. Do your review by reading `tests/seo.spec.ts` (and any other changed files) directly, using `git diff`/`git show`/`sed`/`rg` to read code, and small standalone `node -e`/`node -` snippets only to trace specific regex or function logic in isolation (not the project's test harness). This is a review-and-report task, not a build-verification task — prioritize finishing and writing the report over exhaustive tool exploration.
</scope_and_speed>

<action_safety>
This is a REVIEW-ONLY task with one narrow exception. Do NOT modify, fix, or refactor any source file in the repository. Do NOT run destructive git commands. The only file you are allowed to create is the single markdown report described below — nothing else, and do not commit it.
</action_safety>

<structured_output_contract>
Create the file docs/proposals/seo-03-ci-validation/external/codex-review-round2.md (relative to /Users/cm10/pickle-hub-pro; create the directory if needed) containing, in this order:
1. A "## Prompt sent" section with this exact task prompt reproduced verbatim.
2. A "## Review output" section with your full round-2 review findings, including explicit confirm/deny on each of the 4 round-1 items (with sub-parts a/b/c where listed).
Do not git add or git commit this file. Write this file as your last action, even if you have to shorten the exploration to get there.

Then, as your final response text (separate from the file), give:
1. A one-line verdict: "clean" or "findings".
2. Every NEW finding (i.e. anything still wrong), verbatim, each as its own bullet with an exact `file:line` reference.
3. A short explicit confirm/deny line for each of the 4 round-1 findings (and their sub-parts), stating whether the fix holds.
</structured_output_contract>

<grounding_rules>
Only report findings you can point to with an exact file path and line number, or an exact reproduction, from the actual current diff or repo state. Do not speculate about hypothetical bugs not visible in the code. If unsure whether something is a real bug, label it clearly as "possible / needs confirmation" rather than stating it as fact.
</grounding_rules>

## Review output

Review snapshot: branch `seo-03-ci-validation` at `41719bb6fbbfc82152c55d0bfb012a560f791f8f`, compared with `main`. I read the complete `main...seo-03-ci-validation` diff once in full, then inspected the changed files and relevant current sitemap, middleware, renderer, HTML-shell, Playwright-config, and workflow code. I did not run the project test suite, build, or linter.

Verdict: findings

### New findings

- [P1] `tests/seo.spec.ts:304` — The canonical-path fallback guard still false-greens the sweep's concrete root sample. `functions/sitemap-static.xml.ts:45` makes `/` the first URL of the static segment; the SPA shell has a non-empty title at `index.html:84`, root canonical at `index.html:88`, and zero JSON-LD, which `assertJsonLd()` accepts at `tests/seo.spec.ts:72`. Exact isolated reproduction produced `pathEqual: true` for the shell canonical and target `/`, while producing `pathEqual: false` for `/tournament/x`. Therefore the new pathname equality proves SSR only for non-root samples; if `renderHome()` times out or throws and `_middleware` returns the shell, the static segment still passes. This leaves round-1 item 1(c) partially unresolved.

- [P2] `tests/seo.spec.ts:25` — `extractCanonical()` still has no attribute-name boundary before `rel` or `href`, so noncanonical `data-*` attributes satisfy it. Exact probes returned `https://example.test/not-real` for `<link data-rel="canonical" href="...">` and `https://example.test/not-real-href` for `<link rel="canonical" data-href="...">`. Either malformed tag can satisfy both canonical presence and pathname equality, so the canonical gate can false-green even though no real `rel="canonical"`/`href` attribute pair exists. The round-1 whitespace/order claim holds, but this separate boundary bug remains at lines 25–26.

- [P2] `tests/seo.spec.ts:72` — `assertJsonLd()` still returns successfully when a page has zero JSON-LD blocks because its only validation is inside `for (const raw of blocks)`. That is required for the known zero-schema `/clb/...` sample if applied globally, but no route/segment-specific presence expectation replaces it: the fixed BlogPosting route calls the same vacuous helper at `tests/seo.spec.ts:161`, and every sitemap sample calls it at line 313. Exact reproduction with otherwise valid title/canonical HTML and no `<script type="application/ld+json">` yielded zero blocks and no validation. A regression deleting all BlogPosting/NewsArticle schema can therefore pass; the organization exception needs to remain scoped without making every schema-bearing surface optional.

### Round-1 re-verification

1. **[P1] SPA fallback — partial deny.**
   - **(a) Confirm:** `tests/seo.spec.ts:156-158` and `tests/seo.spec.ts:304-308` compare `new URL(canonical).pathname` directly with the fixed route path or sampled target pathname. They do not compare full URLs or hosts, and strict string equality catches case and trailing-slash differences.
   - **(b) Confirm:** no JSON-LD block-count assertion was reintroduced. `assertJsonLd()` only iterates the blocks it finds, and the sweep explicitly documents the zero-JSON-LD `/clb/:slug` exception at `tests/seo.spec.ts:310-313`.
   - **(c) Deny in part:** the equality check catches the SPA shell for every non-root sample because the shell pathname is `/`, but it does not catch the actual static-segment sample `/`; the exact false-green is the first new finding above.

2. **[P1] Silent empty segments — confirm.** `MAY_BE_EMPTY` exists at `tests/seo.spec.ts:267` as `new Set<string>([])`, so it is genuinely empty. A missing first URL asserts membership at lines 277–282 and fails now. The message identifies the segment and explains both likely generator/query breakage and the explicit allowlist action for a legitimately empty segment.

3. **[P2] `@graph`/array walker — confirm.** `collectJsonLdNodes()` at `tests/seo.spec.ts:47-59` recursively walks arrays and each encountered node's `@graph`, so both a top-level `[ { "@graph": [...] } ]` and an `@graph` inside another `@graph` reach the nested article node at arbitrary graph depth. Lines 81–89 normalize scalar or array-valued `@type` and validate every string type. Isolated traces of all three requested shapes reached `BlogPosting`/`NewsArticle` and identified the deliberately omitted `datePublished`, which would execute the required-field expectation and fail.

4. **[P2] Five regex claims — confirm, with a separate canonical-boundary finding.**
   - `tests/seo.spec.ts:25-26` and line 68 contain `\s*=\s*` around `=` for canonical `rel`/`href` and JSON-LD `type`, and the two canonical alternatives accept either attribute order.
   - `tests/seo.spec.ts:68` requires whitespace immediately before `type`, so `data-type=` does not match; an isolated probe extracted one block from `type \n =` and zero from `data-type=`.
   - `tests/seo.spec.ts:31` uses `<title[^>]*>`, so title attributes/whitespace are accepted.
   - `tests/seo.spec.ts:274` uses `<url[\s>]`, so `<url>`, `<url >`, and attributed `<url ...>` boundaries are accepted without matching `<urlset>`.
   - The same regex optionally consumes `<![CDATA[` before the sampled `<loc>` value; isolated plain, spaced-CDATA, and attributed-`<url>` inputs all produced the intended URL.
   - These five precise claims hold. They do not cure the missing `rel`/`href` attribute-name boundaries reported separately above.

### Additional review coverage

- Preview re-homing is applied to every new sweep follow-up fetch: child sitemaps go through `onBaseOrigin()` at `tests/seo.spec.ts:270`, and sampled page URLs go through it at line 286. Current sitemap-index entries are absolute; the helper preserves pathname/query while replacing scheme and host with `PLAYWRIGHT_BASE_URL`.
- The current index has 11 segments (`functions/sitemap.xml.ts:31-60`), producing at most 23 serial requests in the sweep (root index, 11 children, 11 pages). The 120-second test timeout is about 5.2 seconds per request on average and does not cover the sum of all individual request caps, but the supplied 8/8 production run is concrete evidence that the nominal budget works; there is no repository evidence establishing a current CI timeout bug. The `~10 segments` comment at `tests/seo.spec.ts:251` is stale but not a correctness defect.
- The sweep creates one API request context, not a page/context per segment, and disposes it after the loop at `tests/seo.spec.ts:315`; no accumulating per-segment resource leak is visible.
- Current child entries are all urlsets generated with the exact lowercase, non-namespaced `<url>`/`<loc>` form used by the parser. The integrity test separately checks child status and document shape. No additional current sitemap-structure bug was found.
- `docs/roadmap-8.5-9.md` only changes SEO-03's status/details. No independent documentation-format issue was found, although the remaining false-green findings mean the validation is not yet as complete as that description implies.

Targeted read-only checks: `git diff --check main...seo-03-ci-validation` passed; isolated `node` traces covered all three JSON-LD shapes, the five claimed regex behaviors, canonical `data-*` false matches, and root-versus-detail SPA-shell pathname equality.
