# Technical debt and architecture risks

This file identifies candidates; it does not authorize refactoring.

| Debt/risk | Verified evidence | Consequence |
|---|---|---|
| Multiple tournament engines duplicate concepts | four table families, hooks, referee and scoring UIs | fixes to scoring/auth/UX must be repeated carefully; premature unification could erase format rules |
| Monolithic route composition root | `src/App.tsx` is ~831 lines and imports shell/cross-cutting behavior | route parity and entry-bundle coupling |
| Web/Capacitor/native SwiftUI duplication | `src/`, `android/`/`ios/`, and `apple/` | DTO, deep-link, auth and feature drift |
| Historical migrations obscure current definitions | many `CREATE OR REPLACE FUNCTION` revisions | reviewing an early migration can produce wrong behavior assumptions |
| Mixed validation/form patterns | Zod/RHF and imperative controlled forms coexist | inconsistent client errors and duplicated normalization |
| Client-local joined interfaces | hooks redefine nullable join/view shapes | generated schema changes may not produce compile errors everywhere |
| Legacy and canonical route aliases | explicit redirect components and EN/VI mirroring | SEO/canonical/route snapshot drift |
| Two notification/social generations | legacy notifications/follows/comments and `social_*` tables unified in hooks | duplicate state and migration complexity |
| Service-role-heavy Edge architecture | auth registry shows privileged clients across most handlers | high review burden for every new input/auth branch |
| Generated native web artifacts in repository | `ios/App/App/public/assets` contains compiled bundles | noisy search/graphs and stale artifact risk |
| Large feature components | team match, livestream, admin/creator forms | high coupling and difficult isolated testing |
| Shop prototype plus pilot implementation | `src/proto/shop` and real `pages/shop`, plus active migration work | contract duplication and bundle/build-flag complexity |
| Shop contract is ahead of canonical schema | hand-written web types, Swift public/cart/order APIs and media buckets reference absent migrations; base `products` migration named by an ALTER is missing | cannot reproduce or security-review shop backend from repository alone |
| Broken/unknown enrichment rate-limit dependency | `product-import-enrich` uses missing `rate_limits` and ignores its errors | rate-limit behavior depends on undocumented remote state or silently does nothing |
| Placeholder Edge Functions look deployable | `leaderboard-compute` and `notification-send` are registered/configured but return `status:skeleton` | name/config can mislead callers and operators about capability |
| Capacitor remote wrapper plus stale local artifact | `server.url` points to production while `ios/App/App/public` contains an older bundle and Android tree is minimal | source-of-runtime and rollback ambiguity |

Refactoring candidates, only when separately authorized: route registry extraction with snapshot preservation; shared tournament scoring/referee primitives without merging domain state machines; generated cross-client DTO contracts; consistent server/client schema validation; pruning or excluding generated artifacts from analysis; and breaking large screens along existing hook/component boundaries.
