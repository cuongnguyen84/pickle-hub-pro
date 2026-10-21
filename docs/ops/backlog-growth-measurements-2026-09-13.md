# T27–T30: measured results, 13 September 2026

Read-only queries, existing authenticated adapters, GA4 property 522556358 and
GSC domain property `sc-domain:thepicklehub.net`. No tracking configuration changed.
The analytics skill keeps segments, sample counts and uncertainty explicit.

## T27 / PERF-05B

GA4 `web_vital`, country Vietnam, device mobile, 4–10 September 2026.
Dimensions `customEvent:metric_name`, `customEvent:metric_rating`; metric eventCount.

| Metric | Good | Needs improvement | Poor | Total events | Good share |
|---|---:|---:|---:|---:|---:|
| LCP | 2557 | 214 | 208 | 2979 | 85.8% |
| INP | 1064 | 190 | 78 | 1332 | 79.9% |
| CLS | 787 | 50 | 26 | 863 | 91.2% |

Each measured event distribution has at least 75% good. This is not a direct
numerical p75 calculation, nor a count of distinct users. Verdict against the
old milestone's expectation: **MÂU THUẪN CrUX → điều tra**, because old July CrUX
described CLS as poor while this September VN/mobile GA4 sample is good.
Different time windows/populations mean this is not yet evidence that either
measurement is wrong. Follow-up: align dates/populations and check event sampling
and duplicate emission before interpreting a causal improvement.

Raw evidence: runtime reports `T27-ga4-vitals-20260913.json`.

## T28 / SEO-CLUSTER-READ

GSC exact-query, page breakdown, final data 14 August–10 September (28 days).

| Query | Page | Clicks | Impressions | Position |
|---|---|---:|---:|---:|
| pickleball bracket generator | /tools | 5 | 57 | 6.86 |
| same | /blog/how-to-create-pickleball-bracket | 0 | 1 | 45 |
| same | /tools/doubles-elimination | 0 | 2 | 31 |
| pickleball round robin generator | /tools | 0 | 6 | 32.5 |

Not a win: bracket query spans three URLs and /tools is above position 5.
Round-robin has only six impressions. Do not compare raw 28-day click totals
directly to the old 90-day baseline. Acceptance remains open pending index/
canonical/redirect checks; no speculative SEO code change made.

## T29 / WPR-REFRESH

GA4 Vietnam, 4–10 September: `wpr_search_no_result` 2 events / 1 user;
`wpr_source_click` 2 events / 2 users. These different events are not a denominator
for a no-match rate. No reminder email sent. Rankings constants still dated
2026-08-27; manual top-25 ×2 + VN comparison and permission-mail predicate remain
unverified, so the rankings milestone is NOT closed.

## T30 / SEO-SAN-W33

GSC `/san/` contains filter, 4–10 September: 100 clicks, 7144 impressions,
position 8.0. Previous week: 130 clicks, 7792 impressions. Clicks -23.1%,
impressions -8.3%. Telegram alert sent, receipt 3991. Row appended to
`seo-san-weekly.md`. Cause is not established; no attribution to PR #533.

Milestone ticks and re-arm must be committed with the evidence per repo policy.
This working tree has unrelated user edits; no blanket commit or milestone
completion was performed. Proposed next weekly read: 20 September 2026.
