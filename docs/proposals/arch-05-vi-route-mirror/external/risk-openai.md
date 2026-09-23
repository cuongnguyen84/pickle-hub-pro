## Verdict: reject the naïve “map the EN config twice” implementation

The mirror is not a path-only transformation. Reusing the same `element` while merely prefixing `path` produces concrete production failures.

### Primary failure: VI URLs render English for real users after SPA navigation

**Mechanism:** The duplicated config uses the EN element and omits `ViLanguageWrapper`.

**Trigger:** A user navigates client-side from an EN page to an ordinary `/vi/*` page. This includes navigation inside the live Capacitor app.

**Symptom:** The URL is `/vi/...`, but i18n remains `"en"` and the page renders English. There is no reload, so the mount-time `getInitialLanguage()` does not run.

This will be largely invisible to current monitoring:

- Bot prerendering is independent and still emits correct VI HTML.
- A hard-load smoke test of `/vi` runs the mount-time language detection and passes.
- Only an in-session SPA transition exposes the failure.

### Routes that fail even on hard-load

If the VI entry is literally generated from the EN config:

- `/vi/blog/:slug` renders `BlogPost`, not `ViBlogPost`.
  - **Symptom:** wrong article component/content under an indexed VI URL.
- `/vi/news/:slug` renders `<NewsArticle language="en"/>`.
  - **Symptom:** English article even though hard-load detection selected Vietnamese, because the explicit prop wins.
- The six VI auth variants lose their VI-specific `ConditionalAuth`/`RequireAuth` composition unless represented as overrides.
  - **Symptom:** logged-out users get the page/failed API state instead of the intended auth redirect or conditional experience.

These failures can occur after the bot received correct prerendered VI HTML; the client bundle then mounts the wrong route element for a human user.

## Single `/vi/*` wrapper has a different failure surface

A parent wrapper can be safe, but only if implemented correctly and the per-route component/prop/auth exceptions remain explicit.

Specific failure modes:

1. **`ViLanguageWrapper` does not render `<Outlet />`**
   - **Trigger:** Any `/vi/*` navigation.
   - **Symptom:** every VI route renders only the wrapper or a blank page.

2. **Nested `<Routes>` has no inner `*` route**
   - The outer `/vi/*` route already matches unknown VI URLs, so the top-level `path="*"` is bypassed.
   - **Trigger:** `/vi/typo`, or any valid VI child accidentally omitted during migration.
   - **Symptom:** blank layout / “no routes matched” instead of the NotFound page.

3. **Old per-page language wrappers remain under the new global wrapper**
   - **Trigger:** Navigate from a doubly wrapped normal VI route to one of the three previously unwrapped routes while staying under `/vi/*`.
   - **Mechanism:** The child wrapper unmounts and its cleanup restores `"en"`; the persistent parent wrapper’s effect does not rerun.
   - **Symptom:** `/vi/rankings`, `/vi/feed`, or `/vi/social/:slug/live` switches to English.

If all child wrappers are removed and one parent wrapper owns language state, wrapping those three formerly unwrapped routes is a behavior change, but the supplied facts do not establish a user-visible regression from that change. In fact, it would fix their current SPA-navigation language gap. Do not invent a failure there; verify whether their omission is still required.

## What is actually safe

- React Router v6 ranked matching means declaration order is not a concern here.
- Prefixing paths does not inherently change the byte-identical public URLs.
- The Cloudflare bot prerender path will not break merely because React Router declarations changed.
- A config-array solution is safe if it models VI overrides explicitly: VI element/component, language prop, language-wrapper policy, and auth composition. It is not safe if it maps the same EN `element` twice.
- A parent-wrapper solution is safe if it uses the correct `Outlet`/descendant routing structure, includes a VI NotFound fallback, removes duplicate wrappers, and preserves the `ViBlogPost`, `NewsArticle language="vi"`, and auth exceptions.

At minimum, block deployment without SPA-navigation tests from EN to a normal VI route, `/vi/blog/:slug`, `/vi/news/:slug`, the three wrapper exceptions, all six auth variants, and an unknown `/vi/*` URL.