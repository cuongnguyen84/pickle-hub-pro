## Executive ranking

| Rank | Category | Likelihood | Impact | Concrete production failure |
|---|---|---:|---:|---|
| 1 | Deeper lazy-loading | High for sessions open during a deploy | Low–medium online; high offline or with unsaved state | Old page requests a lazy chunk removed by the new deploy, gets a real 404, then reloads or fails offline |
| 2 | Dependency swap | Medium–high | Medium | Mobile admin/rankings charts render blank, clipped, or with wrong values because the replacement does not preserve Recharts sizing/data semantics |
| 3 | Config chunking | Medium if chunk basename changes; otherwise low | High for uncached offline launches | React vendor chunk falls outside the precache whitelist; offline module loading fails before React mounts |
| 4 | Dead-code deletion | Low if verified | Low | No inherent failure. Only breaks if “dead” code was actually a deep-link target or side-effect registration |

---

## 1. Config chunking

### Specific failure: the new vendor filename stops matching the precache whitelist

The whitelist matches the emitted filename, not the modules inside it.

- `assets/vendor-react-ABC.js`: still precached.
- `assets/react-vendor-ABC.js`, `assets/vendor-react-dom-ABC.js`, or `assets/framework-ABC.js`: **not** precached.
- Moving `react-dom/client` into the existing `vendor-react-*` chunk is safe for this purpose.
- Moving it into `index-*` is also precached, although it may hurt initial-load size.
- Merely changing the contents/hash of `vendor-react-*` does not break the glob.

#### Trigger

A service worker installs or updates while the new React vendor chunk no longer matches `vendor-react-*.js`. The user then launches offline before that chunk has been fetched through a controlling service worker and placed in the runtime cache.

The especially bad sequence is:

1. User visits/installs while online.
2. First navigation is not yet SW-controlled.
3. The browser downloads the vendor chunk normally, but Workbox does not put it in its runtime Cache Storage.
4. SW installation omits it from precache because its name no longer matches.
5. User launches offline.

#### User-visible symptom

The cached HTML/entry begins loading, but its static import of the React vendor chunk fails. Because this happens while evaluating the entry module, React never mounts and `ChunkErrorBoundary` does not exist yet.

The user sees the shell or permanent **“Loading…”** screen. There will generally be a module-fetch error in the console, but no in-app recovery UI.

### User matrix

- **Fresh online user:** Works. The vendor chunk comes from the network.
- **Returning online user:** Works; if the SW controls the request, the catch-all rule runtime-caches it.
- **Returning offline user who previously loaded the chunk under SW control:** Usually works from runtime cache.
- **Freshly installed/visited PWA, then offline:** Highest-risk case; the chunk may be absent from Workbox caches.
- **Ordinary browser tab:** Same behavior if that origin is SW-controlled. Installation is not what determines caching.
- **Native Capacitor WebView:** Unaffected by the whitelist because SW is skipped. It works online; offline remote loading was already unsupported.

A SW update can worsen this: Workbox may remove the old precache entry during cleanup while the newly named replacement is not in the new precache.

### Can this reproduce the 2026-07-11 outage?

**Not by the same mechanism. That class is closed.**

The old outage required one URL to identify two different entry bodies:

```text
index-SAMEHASH.js → old content cached immutably
index-SAMEHASH.js → different content in the new deployment
```

The build-unique token prevents entry URL reuse across deployments. Tier 2 also prevents a missing JS request from returning and immutably caching SPA HTML.

A chunking change can still create a superficially similar “Loading…” screen, but the mechanism is different:

- missing offline vendor dependency;
- a real uncacheable 404 for an old chunk;
- or an actual module/runtime error caused by invalid chunk boundaries.

It cannot recreate the stale, immutable, same-entry-URL/different-content failure unless the build-unique naming fix is removed or broken.

### Approval verdict

Approve only if the emitted React chunk still matches `assets/vendor-react-*.js`, or update the SW whitelist in the same deployment. Inspect `dist/assets`, not just `manualChunks`.

Also, this work does **not** solve the 1800 KB aggregate target. It redistributes bytes and may add a small amount of wrapper overhead. CI will block only if that overhead pushes the total above 1970 KB.

---

## 2. Deeper lazy-loading

### Specific failure: an open old document requests a chunk that no longer exists

Every new dynamic-import boundary creates another URL embedded in the currently loaded entry/route graph.

#### Trigger

1. A user leaves the SPA open across a production deployment.
2. The old document has not yet loaded a newly lazy route/component.
3. The deployment changes or removes that chunk’s hash.
4. The user navigates to it.
5. The old dynamic import requests the old URL.
6. Cloudflare correctly returns a real uncacheable 404.

This is more likely as the number of lazy chunks increases.

### What the mitigations actually do

`lazyRetry()` does not eliminate the first failure. Unless its retry changes the URL, retrying the same dynamic import 1.5 seconds later normally requests the same missing old chunk and fails again.

The boundary then clears caches, unregisters the SW, and reloads. For an online user, that obtains the current HTML and current entry, after which the new chunk URL works.

So:

- **Online availability:** Mostly absorbed.
- **User experience and state preservation:** Not absorbed.
- **Offline behavior:** Not absorbed and potentially made worse.

### User-visible symptom

#### Online browser/PWA/native user

The route stalls for at least the retry interval, then the whole app reloads. Any unsaved form state, scroll position, modal state, or in-progress admin edit is lost.

A rankings navigation may look like: spinner → pause → complete app restart → home/current route reload.

#### Offline user

If the requested lazy chunk was never cached, both attempts fail. The boundary then deletes caches and unregisters the SW before trying to reload offline.

The result can be worse than the original failed route: an offline error page, blank standalone PWA window, or app that no longer opens offline until connectivity returns.

#### Native WebView

There is no SW to clear, but the remote document can still be stale across a deploy. Online reload recovery works. Offline recovery does not.

### Is this a real outage risk?

It is a real and predictable post-deploy edge, but not normally a fleet-wide outage. The mitigations turn most online cases into a disruptive reload rather than a permanent failure.

Do not lazy-load the minimal global error/recovery UI itself. Avoid moving components needed during initial mount behind extra dynamic imports unless the initial-load saving is material.

### Approval verdict

Approve incrementally, but treat every new boundary as an additional deploy-transition failure point. Test an old production tab against a new deployment, not only a fresh preview URL.

---

## 3. Dependency swap

### Specific failure: charts silently render blank on Vietnamese mobile

Replacing Recharts is not a byte-only change. The most likely concrete regression is failure to preserve its responsive-container behavior.

#### Trigger

The replacement chart initializes while its admin/rankings parent is:

- inside a hidden tab or accordion;
- still width `0`;
- being laid out in a narrow mobile WebView;
- or initially mounted before fonts/navigation/sidebar layout settles.

If the replacement does not observe later size changes, its canvas/SVG remains zero-width or uses a desktop fixed width.

#### User-visible symptom

On `/rankings` or an admin analytics page:

- headings and filters appear;
- the chart area is blank or only axes appear;
- bars/labels are clipped off-screen on a Vietnamese phone;
- rotating the phone or switching tabs does not repair it.

The app itself remains operational, so a generic smoke test that only checks route load will pass.

### Second concrete regression: data semantics change

Chart libraries differ in handling:

- Supabase numeric strings versus JavaScript numbers;
- `null`/missing values;
- sparse categories;
- single-point series;
- date/category sorting;
- tooltip payloads and event APIs.

If the adapter passes `"12"`/`null` data using Recharts assumptions, the replacement may produce `NaN`, drop categories, sort rankings lexicographically, or display an incorrect tooltip.

The user sees wrong rank order, missing bars, or `NaN`/empty tooltip values. On admin pages this causes the solo operator to make decisions using incorrect analytics.

### Scope and impact

- Public rankings regression: visible to real users, especially the 95% mobile population.
- Admin regression: fewer viewers, but operationally significant.
- SEO bots: unaffected because prerender never loads this JS.
- SW/native architecture: no special protection; both web and native receive the broken chart immediately.

A partial migration can also ship both Recharts and the replacement. Because 1930 KB is below the hard 1970 KB gate, an added library could still pass CI while missing the 1800 KB objective. That is not a user outage, but it makes the migration pointless.

### Approval verdict

Highest functional-regression surface. Require mobile-width visual assertions for admin and rankings, including hidden-tab mount, empty data, one row, null values, and numeric strings. Confirm Recharts is absent from `dist`, rather than merely adding another library.

---

## 4. Dead-code deletion

### Verdict: genuinely safe if it is actually unreachable

Deleting modules that have no imports, no `import.meta.glob` membership, no route-registry reference, and no side effects does not create a production failure. It is the cleanest way to reduce the aggregate gzip total.

### Specific misclassification failure

The concrete danger is deleting a module referenced only through a non-obvious runtime registry or used solely for initialization.

Examples:

- a deep-link route is registered by a string-keyed module map;
- a side-effect-only module registers a locale, chart plugin, or global handler;
- a rarely enabled admin feature dynamically resolves a module name.

#### Trigger

A user opens the affected deep link or enables the rare feature that CI and the route smoke never visit.

#### User-visible symptom

The route falls through to 404, displays an empty page, or throws “module not found” only when that feature is activated. If the deleted module was side-effect initialization, the page loads but the associated behavior is missing.

Static imports and standard `import.meta.glob` references should generally be caught by build/type checking. The meaningful review target is string-based registries and side-effect-only imports.

### Approval verdict

Approve verified dead-code deletion first. It directly reduces aggregate gzip size and does not alter chunk-loading topology. Do not call a module dead merely because coverage and search show no direct component import.

---

## Recommended order

1. **Verified dead-code deletion** — lowest production risk and directly reduces aggregate size.
2. **Small dependency swap behind chart parity tests** — largest likely byte reduction, but real UI regression surface.
3. **Config chunking with emitted-filename/SW audit** — useful for initial loading, not aggregate size.
4. **Deeper lazy-loading** — helps initial route cost but deliberately increases deploy-transition and offline failure points.

The mandatory config check is simple: if the build emits a critical static chunk that does not match any precache glob, either rename it back or add the exact glob before shipping.