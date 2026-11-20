# SEO-1 current production coverage evidence — 2026-11-20

## Source and scope

Live production Googlebot HTTP GETs and Search Console URL Inspection read-only API, domain property `sc-domain:thepicklehub.net`. The run reused `scripts/seo/index_coverage.py` sitemap, status, authentication and inspection functions with a separate temporary cache. No indexing requests or production writes were made. Raw evidence: `current-coverage-evidence.json`.

Observed UTC window: 2026-11-20T14:27:06.185370+00:00 to 2026-11-20T14:54:34.935525+00:00. GSC inspection is Google's last-known indexed state, not a live Google crawl; last crawl timestamps below intentionally remain visible.

Current sitemap: **11 segments, 3,575 entries, 3,575 unique URLs**. Twelve purposively selected URLs cover six VI/EN pairs: court directory, one court detail, blog directory, one fresh blog detail, tools directory, and quick tables. This is representative evidence, not full-site coverage. All 12 page responses have HTTP 200, one matching self canonical, expected html lang, and reciprocal `en`, `vi`, `x-default` hreflang links within the sampled pairs. No sampled page has a robots noindex meta directive.

## GSC indexed state

**11 indexed / 1 discovered, currently not indexed** across the 12 sampled URLs. Thirteen Inspection requests total (initial 12, one missing response retried once); no indexing submissions.

| URL path | Live HTTP | GSC state | Last crawl UTC |
| --- | --- | --- | --- |
| `/san` | 200 | INDEXED | 2026-11-10T18:24:24Z |
| `/vi/san` | 200 | INDEXED | 2026-11-10T18:24:24Z |
| `/san/tsa-newton` | 200 | INDEXED | 2026-11-11T12:17:38Z |
| `/vi/san/tsa-newton` | 200 | INDEXED | 2026-11-11T12:17:39Z |
| `/blog` | 200 | INDEXED | 2026-11-07T19:07:08Z |
| `/vi/blog` | 200 | INDEXED | 2026-09-05T07:18:22Z |
| `/blog/two-to-one-counter-pickleball-technique` | 200 | INDEXED | 2026-11-20T04:43:04Z |
| `/vi/blog/two-to-one-counter-pickleball-technique` | 200 | INDEXED | 2026-11-20T06:47:59Z |
| `/tools` | 200 | INDEXED | 2026-11-19T10:39:54Z |
| `/vi/tools` | 200 | INDEXED | 2026-11-19T23:28:57Z |
| `/tools/quick-tables` | 200 | DISCOVERED | Not reported |
| `/vi/tools/quick-tables` | 200 | INDEXED | 2026-09-04T09:51:38Z |

## Actionable findings

1. **Open: English quick tables is discovered but not indexed.** `/tools/quick-tables` returns 200 with correct self canonical/hreflang, but GSC reports `Discovered - currently not indexed`, no crawl timestamp or selected canonical. VI counterpart is indexed (last crawl September 4). Investigate page-specific content value, existing crawlable internal prominence and GSC trend before declaring a technical indexing defect. Reinspect on a weekly cadence; a correct HTTP response does not guarantee indexing.
2. **Low priority: avoidable internal redirect.** `/livestream` is linked from six sampled EN pages, responds 301 and resolves to `/live` with 200. Update shared navigation target to `/live` when touching it. This is not a broken URL.
3. **Unverified historical cohort:** the old “61 404 URLs” list was not available in repository CSV search. It cannot be reconstructed from aggregate coverage totals or proven resolved by this sample. Retain that roadmap item as requiring a current per-issue GSC export or actual URL inventory.

## Internal link checks and limits

Extracted 561 distinct same-origin HTTP href targets from the 12 server HTML responses; checked the first 180 in lexical order with query/fragment removed. **179 returned 200, one returned 301, zero observed 404/5xx** in that bounded sample. Link source pages are recorded for each checked URL in the JSON. The redirect was followed separately and reached 200. The 381 unchecked targets and browser-rendered JS-only links are outside this evidence. A 200 status alone does not rule out soft 404 or prove content quality.

The sitemap generation arrangement puts EN blog URLs in the static segment and VI blog URLs in the blog segment; the sampled article exists and is indexed in both languages. Segment names alone are not evidence of missing EN content. No 9/10 score or full SEO-1 completion is claimed from this audit.
