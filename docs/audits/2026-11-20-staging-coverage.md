# A11Y-3 / QA-1: staging coverage gate

## Findings

- `auth-setup` mints viewer, connected viewer and admin sessions sequentially. Local runs without mint credentials skip; CI already fails unless the explicit `PLAYWRIGHT_ALLOW_NO_AUTH=1` escape hatch is used.
- Organizer cases O2/J5/J6 also need `PLAYWRIGHT_ORGANIZER_CLUB_SLUG`, pointing to a club managed by the fixed admin test account. Having Supabase credentials alone does not enable those cases.
- P1/J1 discover live events. P2/J2/J3 additionally need an event with enabled registration; a quiet, ended or full production event inventory legitimately leaves those checks skipped. P2 uses the first discovered event, which may be closed even when a later event is open.
- Weekly `playwright-full.yml` previously ran auth, journeys and contract against production, without a11y. No dedicated staging fixture configuration existed in that workflow. Preview frontend URLs alone do not establish database isolation: the existing journey comments explicitly describe previews sharing production data.
- A repository-level name-only check (`gh variable list --json name` and `gh secret list --json name`, filtered to `STAGING_`) on 2026-11-20 returned no staging variable or secret names. No credential values were read. Environment-scoped or externally provisioned configuration is not covered by this check.

## Implemented evidence

`scripts/playwright-coverage.mjs` reads Playwright's JSON report and writes `playwright-report/coverage-manifest.json`. Each of the eight cases (P1/P2/O2, J1/J2/J3/J5/J6) records static prerequisite eligibility, executed/skipped/not-run state, attempt statuses and skip annotations. Event eligibility without a configured fixture is explicitly labeled runtime discovery; static eligibility does not imply live content exists. Normal production reporting remains informational.

With `PLAYWRIGHT_COVERAGE_REQUIRED=1`, preflight requires all credential names, a managed club slug, a relative `/social/<slug>` fixture route, an explicit HTTPS staging origin outside the production domain, and an explicitly declared staging database URL matching the supplied Supabase URL. Backend URLs must be canonical HTTPS hosted `<20-character-project-ref>.supabase.co` origins. The known production project `ajvlcamxemgbxduhiqrl` is explicitly forbidden even when both declared URLs match. Custom proxies, localhost/IPs, non-HTTPS URLs, embedded credentials, ports, paths, queries and fragments are rejected. These checks also run **inside auth setup before the first session mint**, so invoking Playwright directly cannot bypass them. The result check fails any missing, skipped or non-passing mandatory case, including a missing report. Environment values and credentials are not serialized into the manifest.

Before minting sessions, preflight also performs a credential-free HTML GET to staging with redirects forbidden. It requires exactly one Supabase preconnect build marker matching the expected staging backend. `vite.config.ts` derives this marker and the frontend client from `VITE_SUPABASE_URL`; a production, mismatched or missing marker fails closed. This verifies the HTML build configuration, **not the actual executing frontend's runtime backend pairing**. A stale/mixed JS deployment or proxy cannot be independently ruled out by the marker; runtime pairing remains explicitly unverified and this check must not be used to authorize staging write journeys without stronger deployment/runtime evidence.

Manually dispatch **Playwright full** with `staging_coverage=true` to enable the dedicated `staging-coverage` job. Configure these repository variables and secrets first:

| Kind | Names |
| --- | --- |
| Variables | `STAGING_PLAYWRIGHT_BASE_URL`, `STAGING_PLAYWRIGHT_ORGANIZER_CLUB_SLUG`, `STAGING_PLAYWRIGHT_EVENT_PATH` |
| Secrets | `STAGING_SUPABASE_URL`, `STAGING_SUPABASE_ANON_KEY`, `STAGING_SUPABASE_SERVICE_ROLE_KEY` |

Use a genuinely isolated staging frontend/database pair; origin restrictions and the matching HTML build marker enforce the known isolation prerequisites, not runtime deployment provenance. Reuse the existing fixed role accounts from `tests/helpers/auth.ts` on that staging database. The admin must manage the fixture club. The fixture event must remain visible, with registration enabled, enough capacity, and a future registration deadline. Provision and maintain these fixtures through the team's staging process; this change does not create any event or registration.

For local inspection, use the same existing `SUPABASE_*`, `PLAYWRIGHT_ORGANIZER_CLUB_SLUG` and `PLAYWRIGHT_BASE_URL` variables, plus `PLAYWRIGHT_STAGING_BASE_URL`, `PLAYWRIGHT_STAGING_SUPABASE_URL`, `PLAYWRIGHT_EVENT_PATH`, and `PLAYWRIGHT_COVERAGE_REQUIRED=1`. Run:

```sh
node scripts/playwright-coverage.mjs --preflight
npx playwright test --project=a11y --project=journeys --grep '(P1 |P2 |O2 |J1 |J2 |J3 |J5 |J6 )'
node scripts/playwright-coverage.mjs
```

Do not use production credentials or treat a preview URL as staging isolation. The optional fixture override only activates in required staging mode; production discovery behavior is unchanged. Registration tests stop before submission. Organizer tests cover local draft restoration and validation, not publishing. This gate therefore closes the silent-skipped-green evidence gap for those existing UI cases; it does **not** complete A11Y-3/QA-1's registration submission, organizer publish, score persistence, completion or recovery acceptance criteria. Those still need isolated staging write fixtures and tests.

## Validation

Run `node --test scripts/playwright-coverage.node-test.mjs` for missing prerequisites, production refusal, invalid fixture paths, skipped/absent/failed cases, nested JSON reports and retries. A live staging success is not claimed until the configured job actually runs and uploads its manifest.
