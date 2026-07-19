# State patterns (DS-04)

> 2026-07-19. Canonical surface for each page-level state. New/edited screens
> use these; existing screens migrate opportunistically when touched (no
> big-bang rewrite of the ~85 legacy spinner/empty sites).

| State | Canonical surface | Notes |
|---|---|---|
| **Loading (page)** | `<LoadingState />` from `@/components/states/PageStates` inside the page layout | Centered spinner + `role="status"` + sr-only i18n label. Skeletons (`@/components/ui/skeleton`) stay preferred for list/card geometry — LoadingState is for whole-page waits. |
| **Loading (boot)** | `<LoadingState fullScreen />` | Route Suspense fallback (App.tsx) + auth wrappers. No chrome yet. |
| **Empty** | `.tl-empty` block (`<h3>` + `<p>`), strings via `useI18n()` keys | Already the de-facto standard (43 files). `.tl-empty-card` for the mark+CTA flavor. Don't hardcode `language === "vi" ? … : …` ternaries in new code — add i18n keys. |
| **Error (query)** | `<ErrorState onRetry={refetch} />` wrapped in the page layout, `noindex` on the layout | Data hooks must **throw** on Supabase error (see `useSocialEvent`/`useClub`), never `return null` — returning null renders a false "not found". `role="alert"` + retry `<Button variant="outline">`. |
| **Error (mutation)** | Toast (`src/hooks/_mutationErrors.ts`) | Unchanged — mutations keep toasting. |
| **Not found** | `<EntityNotFound entity=… />` | Reserved for a genuinely missing slug (`data == null` without error). |
| **Offline** | `<OfflineBanner />` — already mounted globally in App.tsx | Do not add per-page offline UI. react-query refetches on reconnect by default. |
| **Permission (route)** | `RequireAuth` / `ConditionalAuth` redirect to `/login?redirect=…` | No inline "access denied" pages for whole routes. |
| **Permission (inline)** | Per-feature sign-in gate card with `<Button>` CTA | Keep feature-specific copy, but strings via i18n keys. |

Rules of thumb:

- A query that can fail must have a visible failure state — 9 of 144 query
  sites had one before DS-04. When touching a page, wire `isError` +
  `refetch` to `ErrorState`.
- Never reuse the 404 surface for errors: "not found" tells the user to give
  up; "network error" tells them to retry. The hook-throws convention keeps
  the two separable.
- All three shared components live in one file:
  `src/components/states/PageStates.tsx` (tests:
  `src/components/states/__tests__/page-states.test.tsx`).
