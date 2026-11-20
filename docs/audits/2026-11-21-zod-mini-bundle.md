# Zod runtime bundle reduction — 21 November 2026

## Scope and source

Measured against reviewed remote main `a7230d0cd8455c2b5c017f5a18ce5351020dadb1`, including the owner-added AI tools from #1093 and the subsequent #1097 blog refresh. The existing CODE budget is 1935 KiB; this change does not modify that budget, exclusions, dependencies, bundler configuration, chunk policy, or feature set.

Six production files imported the fluent `zod/v4` facade: three team forms, venue creation, ghost-profile creation, and the shared DUPR response contract. These callers use object/string/number/boolean/enum/union validation already supported by the installed Zod Mini API. Replacing the facade allows unused fluent constructors to be tree-shaken. Team creation and registration now share one schema builder; social form schema builders are directly testable without mounting network-enabled components.

## Measurement

Fresh isolated archive; lockfile installed with npm 10.8.2 and Node 20.20.2. Both builds use the same lockfile, machine, environment, `npm run build`, and repository `scripts/check-bundle-size.mjs`.

| Measured gzip metric | Before | After | Change |
| --- | ---: | ---: | ---: |
| CODE (all eligible JavaScript chunks) | 1932.1 KiB | 1914.4 KiB | −17.7 KiB |
| INITIAL | 228.8 KiB | 228.8 KiB | unchanged at reported precision |
| Total JavaScript | 2793.2 KiB | 2775.6 KiB | −17.6 KiB |
| Blog content | 861.2 KiB | 861.2 KiB | unchanged at reported precision |

These are local comparative measurements, not Linux CI or production performance claims. The build still reports its existing large video chunk warning. No production deployment is performed by this evidence collection.

## Behavior verification

`team-social-form-schemas.test.ts` compares the actual production Mini schemas against test-only copies of the previous classic schemas. More than 1,000 input mutations compare both parsed output and complete rejection issues, including limits, optional/null distinctions, numeric coercion, integer validation, defaults, unknown-key stripping, phone syntax, bilingual messages, and all DUPR success/error envelope variants. A real React Hook Form resolver call verifies errors remain field-addressable and valid submission values remain coerced/defaulted.

Existing resolver compatibility tests remain in place. Validation passed: TypeScript, scoped ESLint, production build, whitespace diff check, and the full repository test suite (335 files / 5 skipped; 5,328 tests / 69 skipped). Screenshots, UI layout, database policy, privacy behavior, and scoring are outside this patch's claims.
