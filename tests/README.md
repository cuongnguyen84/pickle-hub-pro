# Playwright E2E tests — Phase 1

Read-only smoke + mobile + SEO bot view checks. No login required.
Safe to run against production.

## Run locally

```bash
npm i                           # install @playwright/test
npx playwright install --with-deps  # download Chromium
npm run e2e                     # run all tests
npm run e2e:ui                  # interactive UI mode
```

## Target a different URL

```bash
PLAYWRIGHT_BASE_URL=https://dupr-uat-review.pickle-hub-pro.pages.dev \
  npm run e2e
```

## What this catches

- **Title undefined regression** (the `/dupr` bug we hit 2026-05-29)
- **CSP blocked resources** — Playwright runs real Chromium, CSP enforced exactly like user's browser
- **Mobile layout breaking** (375x812 viewport)
- **Blog post not in SSR meta dict** — Googlebot UA fetch + meta tag check
- **JS console errors in production** — any page that crashes silently

## What it doesn't catch (yet)

- Auth-gated flows (DUPR modal interactive, log match, confirm). Defer
  to Phase 1B with a seeded test user password.
- Backend RPC contract drift. Defer to Phase 2 contract tests.
- Visual diff regressions. Defer if needed; Phase 1 catches layout via
  `boundingBox()` assertions, not pixel-diff.

## CI pipeline

GitHub Actions `.github/workflows/playwright.yml` runs on every PR + push
to main. Failure pings Telegram via the existing bot.
