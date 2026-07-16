## Prompt sent

<task>
Repo: /Users/cm10/pickle-hub-pro, branch `seo-03-ci-validation` (PR #351), base `main`. Working tree clean, one commit.

Review the full diff of this branch vs `main` (`git diff main...seo-03-ci-validation` from inside /Users/cm10/pickle-hub-pro). This is SEO-03: extends `tests/seo.spec.ts` (Playwright, run by `playwright.yml` against a Cloudflare preview deploy on PRs and against prod on `main`) with:
1. A canonical assertion on the fixed SSR routes (asserts canonical pathname === the route's own path).
2. JSON-LD helpers: every `application/ld+json` block on a page must `JSON.parse` successfully; a required-fields map (headline, datePublished) is enforced only for BlogPosting/NewsArticle nodes — other schema.org types are parse-only by design (e.g. SportsEvent.startDate depends on user-entered data and would flake the gate if required).
3. A new sweep test: for each child sitemap listed in `/sitemap.xml`, fetch its first `<loc>` entry as Googlebot and assert HTTP 200 + non-empty `<title>` + a canonical tag + that all JSON-LD on the page parses. Empty child urlsets (zero `<url>` entries) are skipped rather than failed. Sitemap `<loc>` values are absolute prod URLs (`https://www.thepicklehub.net/...`) and get re-homed onto `PLAYWRIGHT_BASE_URL` via the existing `onBaseOrigin()` helper before fetching.

The same commit also flips the SEO-03 line from pending to done in `docs/roadmap-8.5-9.md`.

Author already verified: eslint clean, full spec run 8/8 green against production.

Focus your scrutiny on:
1. Regex/parsing robustness of whatever extracts canonical `<link>` href, `<title>`, and `application/ld+json` block contents, and whatever extracts `<loc>` from the sitemap XML — check behavior under attribute reordering (e.g. `rel` after `href`), extra whitespace/newlines inside tags, self-closing vs not, and CDATA-wrapped values if any sitemap or HTML uses them.
2. `assertJsonLd`-style handling of `@graph` arrays and top-level JSON-LD arrays (`[{...}, {...}]`) — does the required-fields check correctly walk into nested graph nodes to find BlogPosting/NewsArticle entries, or could it silently skip required-field validation on a node buried in a `@graph`?
3. False-red risk on Cloudflare preview runs specifically: sitemap `<loc>` entries are prod-absolute (`https://www.thepicklehub.net/...`). Verify `onBaseOrigin()` is actually applied to every fetch in the new sweep test (not just some), and that it correctly rewrites scheme+host to the preview's `PLAYWRIGHT_BASE_URL` for every sitemap segment type (static, blog, tournaments, matches, events, news, players, venues, livestreams, organizations), including any edge case like a `<loc>` that's already relative or a trailing-slash mismatch.
4. `test.setTimeout` (or equivalent Playwright timeout config) budget for the new sweep test versus the worst-case number of child sitemap segments times per-fetch latency — is there a real risk of timeout on CI given the number of segments this sweep will hit.
5. Whether skipping empty urlsets silently masks a genuinely broken segment (e.g. a segment that SHOULD have URLs but returns an empty urlset due to a query/generation bug) — does the test distinguish "legitimately empty right now" from "broken and returning nothing" in any way, or is every empty urlset treated identically as fine.
6. Any other correctness issue visible in the diff (e.g. resource leaks from unclosed page/context objects across the sweep's per-segment loop, incorrect assumption about sitemap index structure, etc).
</task>

<action_safety>
This is a REVIEW-ONLY task with one narrow exception. Do NOT modify, fix, or refactor any source file in the repository. Do NOT run destructive git commands. The only file you are allowed to create is the single markdown report described below — nothing else, and do not commit it.
</action_safety>

<structured_output_contract>
After completing the review, create the file docs/proposals/seo-03-ci-validation/external/codex-review-round1.md (relative to /Users/cm10/pickle-hub-pro; create the directory if it does not exist) containing, in this order:
1. A "## Prompt sent" section with this exact task prompt reproduced verbatim.
2. A "## Review output" section with your full review findings.
Do not git add or git commit this file.

Then, as your final response text (separate from the file), give:
1. A one-line verdict: "clean" or "findings".
2. Every finding, verbatim, each as its own bullet with an exact `file:line` reference (path relative to repo root).
3. If clean, state explicitly which of the 6 focus areas above you checked and confirmed clean.
</structured_output_contract>

<grounding_rules>
Only report findings you can point to with an exact file path and line number, or an exact reproduction (e.g. a concrete sitemap segment/URL and what the regex/parser does with it), from the actual diff or current repo state. Do not speculate about hypothetical bugs not visible in the code. If unsure whether something is a real bug, label it clearly as "possible / needs confirmation" rather than stating it as fact.
</grounding_rules>

## Review output

Review snapshot: commit `93b465a5` (the requested one-commit branch state). The branch advanced to `41719bb6` after these findings were recorded; this round-one report intentionally preserves the findings against the reviewed snapshot.

Verdict: findings

- [P1] `tests/seo.spec.ts:258` — The sweep can accept the repository's real SPA fallback instead of an SSR bot rendering. It only checks that some canonical exists, while `assertJsonLd()` at `tests/seo.spec.ts:42` treats zero JSON-LD blocks as success. On a prerender exception or the middleware's eight-second render timeout, `functions/_middleware.ts:541` falls through to `next()`; the resulting SPA shell has a non-empty title at `index.html:84` and the root canonical at `index.html:88`, but no JSON-LD. Exact reproduction against the current `index.html` produced title `ThePickleHub – Pickleball Asia: Live, Brackets &amp; News`, canonical `https://www.thepicklehub.net/`, and zero JSON-LD blocks, so every assertion at lines 253–259 passes for an arbitrary sampled detail URL. A broken preview prerender can therefore leave this bot-render gate green.

- [P1] `tests/seo.spec.ts:246` — Every child with no regex-detectable first `<loc>` is silently treated as a legitimate empty segment; there is no expected-nonempty allowlist or other distinction. This masks a concrete current failure mode: for `/sitemap-news.xml`, a Supabase query error is only logged at `functions/sitemap-news.xml.ts:62`, converted to `rows = []` at line 66, and returned as an HTTP-200 empty urlset at line 126. The pre-existing integrity test also accepts that response because it is 200 and contains `<urlset>`, and the new sweep then continues here. It would even accept an empty `/sitemap-static.xml`, although that segment has a fixed non-empty URL list at `functions/sitemap-static.xml.ts:44`. Thus query/generation regressions can erase an entire SEO segment without failing CI.

- [P2] `tests/seo.spec.ts:57` — The required-field walker handles an immediate top-level array and a root object's immediate `@graph`, but it is not recursive and it only recognizes string-valued `@type`. Exact reproductions: `[{"@graph":[{"@type":"BlogPosting","headline":"x"}]}]` and `{"@graph":[{"@graph":[{"@type":"BlogPosting","headline":"x"}]}]}` both omit `datePublished` yet perform no required-field assertion; `{"@type":["BlogPosting"],"headline":"x"}` is also skipped even though an array-valued `@type` is valid JSON-LD. A BlogPosting/NewsArticle buried in a nested graph can therefore silently evade the advertised validation.

- [P2] `tests/seo.spec.ts:45` — The regex-based extraction does not reliably mean “every `application/ld+json` block.” Exact reproduction: `<script type = "application/ld+json">{not-json}</script>` is validly formatted HTML, but the regex extracts zero blocks because it requires `type=` with no whitespace, so `assertJsonLd()` passes instead of reporting invalid JSON. Conversely, `data-type="application/ld+json"` is mistaken for a real `type` attribute. The other new/used parsers have the same lexical coupling: `extractCanonical()` at line 25 misses `<link rel = "canonical" href = "…">`, the title regex at line 253 misses `<title >News</title>`, and the first-URL regex at line 245 skips `<url >…</url>` or a CDATA-wrapped `<loc>`. Attribute reordering, newlines between attributes, and self-closing canonical links do work, and the current generators use exact tags with no CDATA, but a harmless serializer/formatter change can produce false reds while the JSON-LD and child-URL cases can produce false greens.

Checks completed without an additional finding:

- Preview re-homing: `onBaseOrigin()` is used for every child and sampled-page fetch in the sweep. All 11 current absolute segment URLs (static, blog, news, tournaments, matches, events, players, videos, livestreams, organizations, venues) rewrite to the preview scheme/host; query and trailing slash are preserved. A relative `<loc>` is returned unchanged and Playwright resolves it against the configured `baseURL`.
- Timeout: the current index has 11 segments, so the maximum is 23 serial requests (root + 11 child sitemaps + 11 sampled pages). The 120-second budget is about 5.2 seconds per request on average. It does not cover the sum of all individual 20-second page caps, but that is an outage envelope rather than evidence of an ordinary preview false red; the repository contains no latency evidence establishing a real CI timeout risk.
- Resource/index assumptions: the success path disposes its single request context after the loop and creates no per-segment browser page or context. Current children are all urlsets generated without namespaces on `<url>`/`<loc>` and without CDATA; there is no current nested child sitemap index to recurse through.

Validation performed: full branch diff and relevant current sitemap/render/workflow code inspected; focused in-memory reproductions run for regex behavior, JSON-LD traversal, SPA-shell acceptance, and all segment URL rewrites; `git diff --check main...seo-03-ci-validation` passed. The full Playwright suite was not rerun because the prompt already supplies the author's 8/8 production run and this review did not need to create test artifacts.
