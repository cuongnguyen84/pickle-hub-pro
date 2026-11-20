# Vietnam mobile field vitals — 20/11/2026

Read-only GA4 Data API, property 522556358, window **23/10–19/11/2026**
inclusive (28 complete property-calendar days), timezone Asia/Saigon. API request
and response are saved in [rating evidence](../performance/2026-11-20/vietnam-mobile-ratings.json)
and [route evidence](../performance/2026-11-20/vietnam-mobile-route-ratings.json).
No configuration changes or production writes; service-account credentials
were loaded locally and never printed.

## Observed event sample

Filters: country = Vietnam, deviceCategory = mobile, eventName = web_vital.
Dimensions: customEvent:metric_name and customEvent:metric_rating; metric:
eventCount. Route query adds customEvent:route.

| Metric | good | needs-improvement | poor | Total events | good share |
|---|---:|---:|---:|---:|---:|
| LCP | 2,329 | 561 | 150 | 3,040 | 76.61% |
| INP | 1,766 | 129 | 41 | 1,936 | 91.22% |
| CLS | 577 | 209 | 37 | 823 | 70.11% |

CLS has the clearest improvement signal in this event sample. Do not present
these shares as numeric p75 values or as CrUX results. The differing sample
counts are reported separately, not combined into a single CWV score.

## Route-level CLS diagnostic

| Normalized route | Total CLS events | good | needs-improvement | poor |
|---|---:|---:|---:|---:|
| /news/:id | 248 | 118 | 106 | 24 |
| /live/:id | 183 | 138 | 39 | 6 |
| /blog/:id | 151 | 137 | 14 | 0 |
| /san/:id | 89 | 86 | 3 | 0 |
| / | 47 | 34 | 10 | 3 |
| /auth/callback | 30 | 2 | 25 | 3 |
| /tools/quick-tables/:id | 8 | 1 | 7 | 0 |

Investigate news layout shifts first: it has both the largest CLS sample and
130/248 non-good events. Auth callback has 28/30 non-good events, but should
be handled as a separate short-lived navigation surface. QuickTable n=8 is
too small to generalize. Route counts describe where events occurred, not the
DOM cause. No UI change is justified until attribution/reproduction.

## Numeric percentile and instrumentation limits

Metadata confirms metric_name, metric_rating, metric_id, route, market_segment
and device_class custom dimensions exist. It also confirms cls_shift_target
and cls_load_state are registered. **No metric_value custom metric or dimension
is registered** in the inspected GA4 metadata. Data API cannot reconstruct
numeric p75 from this report. Average/sum eventValue cannot substitute for a
percentile; CLS value is additionally scaled by 1000 in the generic value field.

Source src/lib/webVitalsRum.ts emits metric_value and metric_rating using
web-vitals attribution observers, with default observer reporting options;
it excludes webdriver and development, samples at rate 1 and marks document
navigation scope. Analytics still has consent/adblock/missing-gtag and delivery
bias. This query counts events, not deduplicated navigation/metric IDs; no
assertion is made that the counts equal unique users or CrUX page loads.
country/deviceCategory are GA4 dimensions, not custom market_segment/device_class.
Global acquisition reports are not a substitute for this segment.

## Next actions / PERF-1 remains open

1. Query CLS attribution (cls_shift_target + cls_load_state) for /news/:id;
   reproduce the dominant shift on a representative mobile page before fixing.
2. Preserve route/locale/app-surface segmentation and define sufficient sample
   rules before declaring individual low-traffic routes passed.
3. Obtain raw event-level numeric metric_value through an authorized existing
   raw export or implement reviewed privacy-safe distribution collection.
   Registering only an aggregate numeric custom metric would not itself
   reconstruct historical p75.
4. Independently read current CrUX if available, labeling origin versus URL,
   form factor, geography limitations and collection interval.
5. Re-read after a clean 28-day post-fix window; do not label PERF-1 complete
   from rating shares alone.

## News attribution and reproduction follow-up

Same segment/window, added cls_shift_target and cls_load_state dimensions with
route=/news/:id and metric_name=CLS. [Raw evidence](../performance/2026-11-20/news-cls-attribution.json).
Largest source target footer: 110 events (28 good/71 needs-improvement/11 poor);
longform body: 99 (65/23/11). Both predominantly report load state complete.
A shifted target is the victim, not necessarily the initiating element.

System Chrome mobile 390x844, public article
/vi/news/thoi-gian-lam-quen-vot-pickleball-theo-pickleball-union-05500de5,
with image requests delayed 2.5s: observed footer shift 0.2310 and body shift
0.09522. Body moved y475→675.25, exactly the loaded image height 200.25px.
This concretely reproduces an unreserved article image shifting text. Footer
shift also occurs during initial data rendering and is a separate contribution;
fixing the image alone does not prove all news CLS is resolved.

Minimal local fix: reserve news image 16:9 aspect ratio (cover, current max-height
retained), preserve reserved space on CDN failure instead of collapsing figure.
Requires reviewed preview/browser before-after validation and field follow-up.
No production deployment by this task.

## Preview before/after validation

Local Vite preview at 127.0.0.1:4175, Chrome headless, same production article,
held all image requests until article DOM and fonts had settled; then released
them and observed layout-shift entries. Baseline mode overrides only aspect
ratio to auto, matching old loaded-image geometry. Error handling remains the
patched handler in both modes; baseline failure-collapse behavior is covered
by the regression rationale, not presented as a measured old error result.

| Viewport | Media natural size | Unreserved image height before→loaded | Reserved image height before→loaded | Image-release CLS before→after |
|---|---|---|---|---|
| 390×900 | 1024×576 (16:9) | 0→200.25px | 200.25→200.25px | 0.096448→0 |
| 1280×900 | 1024×576 (16:9) | 0→471.375px | 471.375→471.375px | 0.065918→0 |

For the fixed version, simulated image errors preserve figure heights
202.25px mobile and 473.375px desktop. Text Y stays 677.25px/1087.8125px
before/after load and after error. Content max-width 880px with padding keeps
this image below max-height 480px in the measured desktop layout. Non-16:9
sources are intentionally displayed with cover crop inside the fixed ratio;
representative image already is 16:9. No claim that every source has this ratio.

Added news-article-media.test.tsx: checks reserved aspect ratio, max-height,
error visibility and retained figure/body. Focused Vitest 1/1, ESLint pass.
This isolates image-loading CLS, not initial fetch/skeleton/footer movement.
