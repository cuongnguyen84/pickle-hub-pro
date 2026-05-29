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

## Phase 2 — projects (each spec runs in exactly one project)

| Project | File | Default | Notes |
|---|---|---|---|
| `desktop-chromium` | `smoke.spec.ts` | always | Phase 1 |
| `mobile-chromium` | `mobile.spec.ts` | always | Phase 1 |
| `ssr-bot` | `seo.spec.ts` | always | Phase 1 |
| `auth` | `auth.spec.ts` | **self-skips** w/o mint env | 2A — auth-gated, NON-mutating |
| `contract` | `contract/edge-contracts.spec.ts` | **self-skips** w/o Supabase env | 2E — Zod shape vs `src/contracts/` |
| `dupr-e2e` | `dupr-e2e.spec.ts` | **self-skips** unless `DUPR_E2E=1` | 2B — submits to DUPR UAT, then deletes |
| `visual` | `visual.spec.ts` | **self-skips** unless `VISUAL=1` | 2C — pixel diff, baselines in repo |

```bash
npm run e2e:smoke            # Phase 1 only (read-only, prod-safe)
npm run e2e:auth             # 2A — needs mint env (below)
npm run e2e:contract         # 2E — needs SUPABASE_URL + anon
npm run e2e:dupr             # 2B — sets DUPR_E2E=1, point at UAT preview
npm run e2e:visual:update    # 2C — capture/refresh baselines, then commit
npm run e2e:visual           # 2C — compare against committed baselines
```

### Env for 2A / 2B / 2E (set as GitHub Actions secrets)

```
SUPABASE_URL                https://ajvlcamxemgbxduhiqrl.supabase.co
SUPABASE_SERVICE_ROLE_KEY   service_role JWT  (mints sessions via admin API)
SUPABASE_ANON_KEY           anon/publishable key
```

Sessions are minted with `admin.generateLink(magiclink)` → `verifyOtp` (no
password stored anywhere). Role→user map + overrides in `tests/helpers/auth.ts`.

## Still not covered

- Member-log → opponent-confirm UI leg: `log_club_match` / `confirm_club_match`
  RPCs are **not in the current source tree** — add that leg to `dupr-e2e.spec.ts`
  once they ship. 2B currently validates the admin/organizer → DUPR submit path.

## CI pipeline

- `.github/workflows/playwright.yml` — smoke on every PR + push to main.
- `.github/workflows/lighthouse.yml` — 2D perf/a11y gate (PR + weekly cron).
- `.github/workflows/deploy-guard.yml` — 2F: auto-deploys changed edge
  functions + migration drift check on push to main.

All failures ping Telegram via `@Tphaisupport_bot`.
