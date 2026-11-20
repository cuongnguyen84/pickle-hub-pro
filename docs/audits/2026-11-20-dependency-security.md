Warning: fs was declared with const; use let for reassignable variables.
# Dependency security baseline — 20/11/2026

Scope: production dependency tree from `npm audit --omit=dev`; versions verified
after a clean `npm ci` from the lockfile.

| Package | Before | After | Dependency path | Status |
|---|---:|---:|---|---|
| dompurify | 3.4.15 | 3.4.18 | isomorphic-dompurify → dompurify | Patched. |
| postcss-selector-parser | 6.1.4 | 6.1.6 | tailwindcss/postcss-nested | Patched within the existing `^6` ranges. `@tailwindcss/typography` separately pins 6.0.10, but it is a development/build dependency and excluded from the production audit. |
| undici | 7.28.0 | 7.30.2 | jsdom → undici | Patched within jsdom's `^7.25.0` range; development/test dependency. |
| zod | 3.25.76 | 3.25.76 | direct dependency | **Open high advisory.** npm offers 4.6.7 only as a major upgrade. Kept v3 pending a compatibility migration and regression pass. |

The current application uses Zod in browser forms and a shared DUPR response
contract. Repository search found no `z.array()` validators; the present
schemas are scalar/object/union checks with bounded strings and enums. This
narrows the known application path for the oversized constrained-collection
advisory; it does not remove the package advisory or prove all consumers safe.

Before a Zod major upgrade:

1. Inventory schema validators and consumers across frontend, tests and Edge
   Functions; review Zod v4 migration changes.
2. Upgrade in an isolated change, then run form, contract, Edge Function and
   production-build checks. Add regression coverage for bounded collection
   input if such validation is introduced.
3. Re-run the authenticated production-tree audit. Until then, report one
   remaining high dependency advisory and do not label SEC-1 fully passed.

The npm lock-only update also refreshed compatible esbuild platform packages
from 0.28.1 to 0.28.2 and pruned an unused optional peer entry. `npm ci` from the
updated lockfile completed successfully; review these generated lockfile
changes as part of the pull request.
