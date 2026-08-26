## Recommended route shape

Use one route record per logical page, but allow explicit VI overrides:

```tsx
type LocalizedRoute = {
  path: string;
  en: React.ReactNode;
  vi?: React.ReactNode; // defaults to `en`
};

const localizedRoutes: LocalizedRoute[] = [
  {
    path: "blog/:slug",
    en: <BlogPost />,
    vi: <ViBlogPost />,
  },
  {
    path: "news",
    en: <News />,
    vi: <News language="vi" />,
  },
  {
    path: "news/:slug",
    en: <NewsArticle language="en" />,
    vi: <NewsArticle language="vi" />,
  },
  {
    path: "feed",
    en: <Feed />,
  },
  // ...
];
```

Render the English routes at their existing paths and the VI versions under one persistent `/vi` parent:

```tsx
<Route path="/vi" element={<ViLanguageWrapper />}>
  {localizedRoutes.map(route => (
    <Route
      key={route.path}
      path={route.path}
      element={route.vi ?? route.en}
    />
  ))}

  <Route path="*" element={<NotFound />} />
</Route>

{localizedRoutes.map(route => (
  <Route
    key={route.path}
    path={`/${route.path}`}
    element={route.en}
  />
))}

<Route path="*" element={<NotFound />} />
```

`ViLanguageWrapper` must render `<Outlet />`. Handle any root/index route explicitly so `/vi` versus `/vi/` behavior is unchanged.

Do **not** derive the VI component exclusively by prefixing the EN route. The route path is shared; the rendered element is not always shared.

---

# 1. User behaviors that can regress

## Severity 0 — indexed VI deep links stop matching or render the wrong page

### A. Special VI components get flattened

Affected elements:

- `/vi/blog/:slug` → must remain `<ViBlogPost />`
- `/vi/news/:slug` → must remain `<NewsArticle language="vi" />`
- `/vi/news` → must remain `<News language="vi" />`

Failure mode: a Facebook/Zalo link opens a route that technically matches but displays EN content, requests the wrong content store, or reports a valid VI slug as missing.

**Exact fix:** give each route record an optional `vi` element override. Add route-level tests that assert component identity, not only that the URL matches.

### B. A mirrored URL disappears or changes spelling

A missing route, extra slash, changed case, redirect, or path normalization can break indexed URLs.

**Exact fix:**

- Compare the generated VI path list against a checked-in snapshot of the current 63 paths.
- Assert exact string equality, including dynamic segments.
- Do not introduce `<Navigate>` redirects to canonicalize `/vi/*`.
- Do not generate `/vi/` from `/` unless that is exactly today’s URL behavior.
- Crawl the production route manifest before and after and compare all 63 VI paths.

### C. The 66 EN-only routes become exposed under `/vi`

A broad construction such as “prefix every route in the app” could accidentally create:

- `/vi/admin/*`
- `/vi/creator/*`
- `/vi/auth/*`
- `/vi/clb/*`

This changes access paths and may create indexable duplicate pages.

**Exact fix:** generate the VI subtree only from `localizedRoutes`, not from the full application route array. Keep admin, creator, auth, `/clb/*`, and the global catch-all in a separate `nonLocalizedRoutes` collection.

---

## Severity 1 — SPA navigation displays the wrong language

The current omissions create several real failures:

- EN page → SPA navigate to `/vi/feed`: feed can remain English.
- Wrapped VI page → `/vi/feed`: old wrapper unmounts and resets language to EN.
- Hard-load `/vi/feed` → SPA navigate to `/feed`: context can remain VI because no wrapper cleanup runs.
- The same applies to `/vi/rankings` and `/vi/social/:slug/live`.

A hard refresh hides these failures, so deep-link-only testing will not catch them.

**Exact fix:** make the `/vi` parent own language synchronization for all its children. It should remain mounted during `/vi/a` → `/vi/b` navigation and reset only when leaving the `/vi` subtree.

Longer term, replace cleanup-based language control with a location-driven synchronizer:

```tsx
function UrlLanguageSync() {
  const { pathname } = useLocation();
  const language = /^\/vi(?:\/|$)/.test(pathname) ? "vi" : "en";

  useEffect(() => {
    setLanguageFromUrl(language);
    document.documentElement.lang = language;
  }, [language]);

  return null;
}
```

Mount that inside the router but outside `<Routes>`. Do not reset language in effect cleanup; derive the next language from the next URL. This avoids transient `en` updates during VI-to-VI route changes.

If `setLanguageFromUrl` loads dictionaries asynchronously, it must discard stale responses. A slow VI load must not overwrite EN after the user has already switched back.

---

## Severity 1 — live-scoring state or connectivity is disrupted

Uniform wrapping changes context on entry to `/vi/social/:slug/live`. That context update can rerender the entire live page.

Possible user-visible failures:

- WebSocket/SSE reconnects because its effect depends on `language` or translated callback identities.
- The current score resets because score state is initialized in a component affected by a key or remount.
- Pending optimistic scoring actions disappear.
- Audio, wake lock, fullscreen, timers, or vibration subscriptions restart.
- The page pauses while the VI dictionary downloads on 4G.
- A language-dependent API query refetches and temporarily replaces the live score.

**Exact fix:** audit `SocialEventLive` and its descendants for effects keyed by:

- `language`
- `t`
- translated labels
- the full i18n context value

The score transport subscription should be keyed only by stable event/court identifiers, not locale. Keep score state and socket ownership above localized presentation where possible.

---

## Severity 1 — initial bundle or route-chunk size increases

A config refactor can accidentally turn route-level lazy imports into eager imports. That matters on mid-tier Android and 4G even though URLs and rendered components remain correct.

**Exact fix:** preserve the existing `React.lazy` boundaries. Store lazy component references or element factories in the route config; do not eagerly import all 63 page modules merely to populate the array. Compare:

- initial JS transfer size
- `/vi/social/:slug/live` route chunk
- `/vi/feed` route chunk
- time to usable content under a throttled 4G profile

---

## Severity 2 — component lifecycle changes between VI routes

A single `/vi` parent remains mounted during `/vi/news` → `/vi/feed`. That differs from individually wrapping every route, where wrappers may unmount and remount.

For language state, persistence is desirable. However, if `ViLanguageWrapper` contains more than language synchronization—analytics, subscriptions, page state, or suspense boundaries—the lifecycle change may alter behavior.

**Exact fix:** restrict `ViLanguageWrapper` to locale and `<html lang>` synchronization plus `<Outlet />`. Move page-specific analytics and subscriptions into page components.

---

## Severity 2 — route precedence or catch-all behavior changes

React Router v6 ranks routes, but an incorrectly nested `*` can still swallow VI routes or make `/vi/admin/*` render the global page rather than the intended VI 404.

**Exact fix:**

- Put `path="*"` as the last child of the `/vi` parent.
- Keep the global `path="*"` outside that parent.
- Test static, dynamic, and splat routes separately.
- Verify `/vi/nonexistent` renders `NotFound`, while `/vi/admin/foo` does not expose the EN admin page.

---

# 2. Should the three routes be wrapped uniformly?

## Product behavior: uniform wrapping is a correctness fix

The URL prefix is the clearest locale contract. `/vi/feed`, `/vi/rankings`, and `/vi/social/:slug/live` should render VI regardless of the route the user came from.

The current behavior is internally inconsistent and produces both wrong-language entry and wrong-language exit. Unless there is documented evidence that these URLs intentionally preserve the previous language, wrapping them is the correct result.

## Shipping risk: highest for `SocialEventLive`

Before enabling it, test these exact transitions without refreshing:

1. `/feed` → `/vi/feed`
2. `/vi/news` → `/vi/feed`
3. hard-load `/vi/feed` → `/feed`
4. `/rankings` → `/vi/rankings`
5. `/vi/news` → `/vi/social/:slug/live`
6. `/social/:slug/live` → `/vi/social/:slug/live`
7. `/vi/social/:slug/live` → `/social/:slug/live`
8. rapid EN → VI → EN switching while the dictionary is still loading

For the live page, verify:

- WebSocket/SSE connection count does not increase.
- No disconnect occurs solely because locale changes.
- Current score and optimistic updates survive the language change.
- Timer, serving side, court state, and player order remain unchanged.
- Wake lock, audio cues, fullscreen, and vibration remain active.
- Locale changes do not refetch the authoritative score unnecessarily.
- No full-page fallback or blank state appears while loading the dictionary.
- Frame rate and input latency remain acceptable on a representative Android device.

For `Feed` and `Rankings`, verify that changing language does not unexpectedly reset:

- scroll position inside a virtualized list
- selected ranking filters
- pagination/infinite-query state
- cached API results
- followed-event state

If the live page fails these checks, do not preserve the wrong-language behavior. Instead, fix its subscription/state ownership so an i18n context update is presentation-only.

---

# 3. LanguageSwitcher, scroll restoration, and focus

## LanguageSwitcher

The route declaration refactor should not inherently affect the switcher because it performs a string transform. The risk is route coverage: it will still generate `/vi/...` for routes that have no VI mirror.

For example, if the switcher is visible on `/admin/foo`, it may navigate to `/vi/admin/foo`, which should now be a VI 404.

**Exact fix:** either hide/disable `LanguageSwitcher` on nonlocalized routes or give it an explicit `hasLocalizedMirror(pathname)` check based on the same route manifest. Do not generate mirrors for admin/auth merely to satisfy the switcher.

Also tighten prefix detection:

```ts
const isViPath = /^\/vi(?:\/|$)/.test(pathname);
```

Using `/^\/vi/` also treats paths such as `/vietnam` as VI.

Preserve query strings and hashes in both directions:

```tsx
const { pathname, search, hash } = location;

const targetPath = isViPath
  ? pathname.slice(3) || "/"
  : `/vi${pathname}`;

navigate(`${targetPath}${search}${hash}`);
```

Confirm the root behavior against production first: `/` → `/vi/` and `/` → `/vi` are not byte-identical.

## Scroll restoration

If the generated route navigates to the same pathname using the same PUSH/REPLACE/POP type, `<ScrollToTop>` behavior should remain unchanged. A parent `/vi` wrapper does not itself create a navigation.

The regression appears only if the refactor adds redirects or locale-normalization navigations.

**Exact fix:** do not use `<Navigate>` to enter `/vi`, remove trailing slashes, or canonicalize generated paths. Test:

- PUSH `/news` → `/vi/news`: scroll to top.
- PUSH `/vi/news` → `/vi/feed`: scroll to top.
- Browser Back: native scroll position is restored.
- Query-only navigation: preserve today’s behavior, since the effect is keyed only on `pathname`.

## Focus handling

Focus should still move to `#main-content` on pathname PUSH/REPLACE. The parent wrapper must not remove, duplicate, or rename that element.

**Exact fix:**

- Ensure every generated route still renders exactly one `id="main-content"`.
- Ensure `ViLanguageWrapper` renders `<Outlet />` without adding another `<main>`.
- Do not gate the outlet behind dictionary loading; otherwise `<ScrollToTop>` may attempt focus before `#main-content` exists.
- Verify the focused element after navigation with an integration test, not only a visual check.

---

# 4. `/vi/<nonexistent>` 404

Fix it in the same refactor.

A `/vi/...` URL should determine locale even when the final route is not found. Showing an English 404 after SPA navigation from a VI page is a visible and confusing inconsistency, and the nested `/vi` structure makes the fix small.

**Exact fix:**

```tsx
<Route path="/vi" element={<ViLanguageWrapper />}>
  {/* 63 generated VI routes */}
  <Route path="*" element={<NotFound />} />
</Route>

<Route path="*" element={<NotFound />} />
```

This produces a VI-context 404 for:

- `/vi/nonexistent`
- `/vi/admin/nonexistent`
- `/vi/blog/bad-slug` if the route itself does not handle missing content

It does not create a VI mirror for any EN-only page.

Preferably, make `NotFound` read `useI18n().language` and ensure the central URL-language synchronizer handles the locale. Also set:

```html
<html lang="vi">
```

for the VI 404.

---

## Minimum release gate

Automate these checks before merging:

1. Exact snapshot of all 63 EN paths and all 63 byte-identical `/vi` paths.
2. Explicit component assertions for VI blog and news routes.
3. Assertions that the 66 EN-only routes have no VI mirror.
4. SPA transition tests for all three formerly unwrapped routes.
5. `/vi/nonexistent` renders a VI `NotFound`.
6. Language switching preserves `search` and `hash`.
7. PUSH focuses `#main-content`; POP preserves native scroll restoration.
8. Live scoring maintains one connection and retains score state during locale changes.
9. Initial and live-route JS chunk sizes do not increase unexpectedly.