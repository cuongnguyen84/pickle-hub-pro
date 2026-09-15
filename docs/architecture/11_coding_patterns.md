# Coding patterns observed in this repository

## Organization and naming

- Route components use PascalCase files in `src/pages`; admin/creator/shop pages use corresponding subfolders.
- Feature UI is grouped under `src/components/<domain>`; reusable primitives are `components/ui`.
- Hooks use `use<Domain><Operation>` names and often colocate query and mutation interfaces in the hook file.
- Pure business algorithms live in `src/lib/<domain>` or a named utility (`round-robin.ts`, `doubles-bracket-utils.ts`).
- Supabase Edge Functions use kebab-case directory slugs with one `index.ts`; shared code stays under `_shared`.
- Migrations are timestamp-prefixed SQL and frequently carry design/invariant comments.

## Components and hooks

Pages orchestrate; components render focused feature sections; hooks perform remote work. Complex pages lazy-load infrequent dialogs (`TeamMatchView.tsx`). Hooks return data/actions plus `isLoading`/`isPending` flags. `useCallback` stabilizes imperative actions; provider values are memoized when fan-out is large (`useAuth.tsx`).

TanStack Query keys are arrays beginning with a domain noun. Mutations invalidate related keys after success. Query functions throw Supabase errors rather than returning error-bearing data. Toasts translate expected user failures; `console.error` includes a hook/component prefix for diagnostics.

## Database access

- Reads use typed `.from(...).select(...)` chains, explicit filters and deterministic `.order()`.
- Public content prefers views such as `public_livestreams`.
- Multi-row lifecycle changes and scoring call atomic RPCs.
- Optimistic score writes fetch/pass `score_version` and handle conflict errors.
- Generated `Tables<>`, `TablesInsert<>`, `TablesUpdate<>`, `Enums<>` types are reused; local interfaces model joins/views where generated types are too nullable.
- A service-role client is created only server-side; browser clients never carry the service key.
- The shop pilot is an explicit exception to generated typing: `shop-client.ts` casts once to a narrow hand-written builder and `shop-schema.ts` defines temporary row/RPC names. This is a transitional pattern, not the default for new domains.

## Forms and validation

Both React Hook Form + Zod and controlled `useState` forms are present. Dialog forms commonly normalize inputs, validate required/resource constraints, set a pending flag, call one hook mutation, show a toast, close, then invalidate. Server handlers repeat all security/business validation because client validation is UX only.

## Error handling and logging

- Frontend query errors are thrown; screens use shared loading/empty/error states.
- Edge handlers return structured JSON and explicit status codes, reject method/auth before privileged access, and redact secret material.
- Transport oddities from Edge Functions use `invokeWithBlobRetry` (`src/lib/edgeInvoke.ts`).
- Lazy chunks retry once and then enter a capped cache-clearing boundary (`src/App.tsx`).
- Client telemetry initializes before render (`src/main.tsx`) and is bounded server-side.

## Styling/i18n

Tailwind utilities plus The Line CSS tokens are the dominant style. `cn()` merges conditional classes. shadcn/Radix components provide accessibility behavior. User-facing bilingual copy generally comes from `useI18n`; public routes often have mirrored EN/VI definitions and crawler renderers. Literal Vietnamese remains in some legacy/domain screens, so do not assume full dictionary coverage.

## Tests and contracts

Vitest tests sit in `__tests__` near code; Playwright journeys are in `tests/`; Swift tests are under `apple/Tests`. Route snapshots, edge-auth registry, migration drift/duplicates, bundle budgets, image policy and schema parity are treated as executable architecture gates (`package.json`, `scripts/`).
