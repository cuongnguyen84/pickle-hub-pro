# PR1075 production follow-up — 2026-11-20

Raw evidence: `post1075-production-variants.json` (UTC timestamps, complete HTTP headers, extracted SSR navigation). Read-only public GET probes; no purge, configuration update, or deployment command.

Initial `/tools` and `/vi/tools` Googlebot responses returned 200 with `X-Prerender-Cache: HIT` and the old `/livestream` links. Adding a unique arbitrary query parameter also returned HIT with the old links. This does not isolate deployment because middleware's KV key is `pr:v150:${url.pathname}` and excludes the query string.

The existing `?nocache=1` diagnostic returned `X-Prerender-Cache: MISS` with the corrected `/live` (EN) and `/vi/live` (VI) navigation. This establishes that the active renderer contains the PR1075 fix. The middleware normally writes successful render output back into the same KV key even for a nocache read. Immediately afterward, exact-path GETs for both languages returned HIT with canonical live links. These reads therefore warmed the two entries through ordinary server behavior; no manual KV purge/write API was used.

Root cause: stale application prerender KV HTML shared across releases, not a demonstrated route or artifact mismatch. `Cache-Control: no-store` and `CF-Cache-Status: DYNAMIC` do not bypass the application's own KV cache. No duplicate header code change is needed.

`deploy-guard.yml` handles Supabase function deployment/migration drift, not Cloudflare Pages publishing. Its success cannot alone prove this SSR change reached production. The MISS render plus subsequent exact-path HIT is direct production proof for these two pages only; other cached paths may retain legacy navigation until expiry or invalidation. A release-level prerender cache revision/invalidation policy remains an operational follow-up if immediate site-wide freshness is required.

Native PR1077 proof remains unchanged: actual parser simulator tests, 15 passed, no failures/skips; no signing or physical device validation claimed.
