# Devil's advocate reply — gpt-5.6-sol (2026-08-06)

> Called directly via the OpenAI Responses API: `scripts/agents/ask-model.mjs` referenced by the risk-auditor workflow does NOT exist in this repo (only `risk-tier.mjs` and `soak-watch.mjs` are under `scripts/agents/`).
> Prompt sent verbatim: `risk-gpt56-prompt.md`. System prompt as specified in the workflow.

---

## Verdict

**Do not ship this as specified.** The immediate production failure is a data-model mismatch: the existing UI requires a scope plus a discipline format, while the PPA source publishes only two composite boards.

### Primary break: the new default has no valid format

**Mechanism:** `Rankings.tsx` models every scope as one of the existing formats—men’s/women’s singles/doubles. The PPA endpoint has only `men` and `women` composite standings. It has no singles, doubles, or mixed dimension.

**Trigger:** Change the hardcoded default scope from `vietnam` to `ppa` while retaining the current format state and sub-tabs.

**User-visible symptom:** A visit to `/rankings` or `/vi/rankings` will do one of two wrong things:

- Filter PPA rows by a nonexistent discipline and show an empty/error state; or
- Ignore the format and show the same composite board under misleading labels such as “Men’s Doubles.”

Because PPA becomes the default, this affects every no-query visit rather than an obscure tab. “All formats” cannot be implemented from this source. The requirement must be changed to exactly **Men’s Composite** and **Women’s Composite**, with the normal format tabs hidden for PPA.

## Other architecture-specific failures

### 1. Humans and Google will see different default pages

**Mechanism:** Humans use React; bots use `functions/_lib/render/rankings.ts`. Changing the React fallback does not change the SSR handler.

**Trigger:** Deploy the frontend default change without a corresponding SSR and cache deployment.

**Symptom:** Google’s result remains titled “Vietnam DUPR Pickleball Rankings,” but a user clicking it lands on PPA standings. The requested PPA SEO landing page does not exist for Googlebot.

Updating the handler alone is insufficient:

- Existing HTML is cached under `pr:v33:${pathname}`. Unless the cache version is bumped or both paths are explicitly refreshed, bots continue receiving the old Vietnam HTML.
- If SSR starts honoring `?scope=`, the cache is definitively wrong because query strings are absent from the key. The first bot request for `/rankings?scope=ppa` or `/rankings?scope=vietnam` populates the same `/rankings` cache entry, and subsequent scope URLs receive that board.

**Required fix:** Bump the prerender cache namespace, refresh both `/rankings` and `/vi/rankings`, and either:
- Keep SSR canonical and independent of query parameters; or
- Include normalized scope/format in the KV key.

### 2. Replacing the SSR list removes the site’s only HTML links to player profiles

**Mechanism:** The current Vietnam SSR `<ol>` is the only rendered internal link path into `/nguoi-choi/*` outside the player sitemap.

**Trigger:** Replace that list with PPA rows/profile URLs to make the SSR page PPA-first.

**Symptom:** ThePickleHub’s player profiles lose their only ordinary internal HTML links and become sitemap-only crawl targets. That is likely to reduce discovery and internal-link equity for the first-party profiles the site already ranks.

This is not an outage, but it directly undermines the SEO goal. Preserve a server-rendered Vietnam section or add internal player links elsewhere before removing it.

### 3. A standalone Worker can be absent while the web release is “successful”

**Mechanism:** Pages deploys do not deploy standalone Workers. The repository is not the Worker deployment source of truth.

**Trigger:** Merge and release the UI/migration before manually deploying the Worker, or deploy the Worker without its Supabase write secret.

**Symptom:** PPA becomes the default but its table is empty. Users see an empty/error page while the normal web deployment reports success.

Do not switch the default until production has a verified fresh snapshot. Use a feature flag or database readiness check rather than coordinating this by memory.

### 4. The scraper will fail silently unless monitoring is explicitly wired

**Mechanism:** A new job is invisible unless a migration inserts `ops_job_registry` and the executor calls `ops_record_job_run`.

**Trigger:** PPA changes the undocumented endpoint/schema, Vercel blocks the job, or the Worker’s manually managed secret drifts.

**Symptom:** The default rankings freeze at an old date for days, with no dashboard failure and no Telegram page—the exact class of failure already experienced with “0 matchups.”

A production implementation needs:

- Registry row in the migration.
- Success/warning/failure reports from every run.
- Schema validation for both boards.
- Nonzero and plausible-count guards.
- An atomic snapshot swap that retains the last good data.
- A visible `updated_at` and a stale-data state.
- One observed successful monitored production run before enabling the tab.

Do not truncate or mark the current snapshot active until the complete replacement has passed validation.

### 5. Supabase permissions can make only production clients fail

**Mechanism:** SQL editor tests run as superuser. RLS does not compensate for missing table privileges, and the RPC also needs appropriate execution privileges.

**Trigger:** Deploy the table/RPC with RLS policies but omit `GRANT SELECT` for an invoker RPC/table read, or omit the intended `GRANT EXECUTE` on the function.

**Symptom:** Real anonymous/authenticated visitors get `42501 permission denied`; the operator’s SQL test still passes. Since PPA is the default, `/rankings` appears broken immediately.

The release test must call the production RPC with the same anon/authenticated JWT used by the SPA, not from the dashboard editor.

### 6. A naïve RPC request may silently stop at 1,000 rows

**Mechanism:** Supabase/PostgREST commonly has a 1,000-row API limit. The source contains 2,075 rows.

**Trigger:** Implement the RPC as a `SETOF` query and fetch it once without ranges/pagination.

**Symptom:** “As deep as possible” ends at 1,000 rows. Depending on ordering, users may get men’s ranks 1–1,000 and no women at all.

Use explicit pagination, or return a deliberate scalar JSON payload after verifying response-size behavior. The UI should still paginate or virtualize rather than rendering all 2,075 entries at once.

### 7. Rendering all rows and headshots will worsen the already-failed mobile experience

**Mechanism:** A default page rendering 2,075 React rows and potentially hundreds of remote headshots creates a large DOM, image fan-out, and layout shifts.

**Trigger:** “As deep as possible” is interpreted as fetch-and-render everything on initial load.

**Symptom:** Delayed interaction, scrolling jank, and further CLS on Vietnam mobile. Images without reserved dimensions are an especially direct CLS mechanism.

Fetch the first page only, paginate or virtualize, reserve image dimensions, and do not make remote headshots part of LCP.

## Commercial scraping is a release blocker

`robots.txt` only establishes that the URL is technically crawlable. It does not override the quoted terms, which explicitly prohibit commercial scraping, mirroring, and rebroadcasting without permission.

**Mechanism:** ThePickleHub automatically copies and republishes the complete rankings on a commercial SEO landing page.

**Trigger:** PPA enforces its terms through an API/IP block, changes the undocumented endpoint, or sends a takedown demand.

**Symptom:** The scraper starts returning 403 or malformed data, the new default becomes stale, and the sole operator must perform an emergency rollback. Attribution does not cure the licensing problem.

Written permission or a license is required before deployment. The fact that the endpoint is public, returns `cache-control: public`, and needs no browser makes ingestion technically easy—not authorized.

## Facts being over- or under-weighted

### Under-weighted

- **The source mismatch:** It makes “all formats” impossible, not merely risky.
- **The dual React/SSR paths plus `v33` KV cache:** This is the most likely reason the SEO feature appears deployed to humans but not to Google.
- **Out-of-band Worker deployment and opt-in monitoring:** These create a believable silent-empty/stale default page.
- **The commercial-use prohibition:** Robots permission is irrelevant to the explicit license restriction.
- **The existing CLS of ~0.67:** The site is already outside policy; rendering the complete ranking cannot be accepted without measured pagination/virtualization.

### Over-weighted or not directly relevant

- **The 43.9 KB gzipped dataset versus the Vite bundle budget:** If data comes from Supabase at runtime, it does not consume the bundle backstop. It matters only if someone imports another generated snapshot into the frontend bundle.
- **GitHub Actions minutes:** Irrelevant if the job runs in Cloudflare or Supabase and monitoring does not depend on Actions.
- **iOS scope:** The app is safe if the existing Vietnam RPC and semantics remain untouched. An additive PPA table/RPC does not require an iOS release.
- **Plain `fetch()` feasibility:** It reduces scraper complexity but says nothing about source stability or permission.

## Minimum shippable version

1. Obtain written commercial-use permission.
2. Change the product scope to two boards only: PPA Men’s Composite and Women’s Composite.
3. Keep Vietnam as default until a fresh monitored production snapshot exists.
4. Register and instrument the job, with schema/count guards and atomic last-good snapshots.
5. Test RPC access using actual client roles and paginate past PostgREST limits.
6. Update both SSR locales, bump the KV namespace, and define correct query-cache behavior.
7. Preserve server-rendered internal links to ThePickleHub player profiles.
8. Paginate/virtualize the browser list and measure Vietnam mobile vitals.
9. Then switch the default behind a reversible flag; do not rely on reverting the migration.

Adding a non-default, correctly labelled two-board PPA tab could be technically safe after those controls. The requested default “all formats” implementation is not.