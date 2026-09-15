# Searchable file and folder index

| Folder/file | Purpose and important contents | Depends on | Used by |
|---|---|---|---|
| `src/main.tsx` | Web boot, telemetry, render, PWA init | React, error/RUM/PWA libs | browser entry |
| `src/App.tsx` | Providers, shell, lazy route registry, chunk boundary | pages/hooks/layout/router/query | entire web app |
| `src/pages/` | Public and authenticated route screens | components/hooks/lib | `App.tsx` |
| `src/pages/admin/` | Admin moderation, users, analytics, jobs, content, integrations | admin auth/layout, Supabase | admin routes |
| `src/pages/creator/` | Organization video/live/tournament management | creator hooks, Mux Edge boundary | creator routes |
| `src/pages/shop/` | Closed-pilot seller flow/import | shop client/hooks/RPCs | shop routes |
| `src/pages/embed/` | Minimal live/video embed views | media hooks/player | embed routes |
| `src/pages/redirects/` | Legacy canonical route adapters | router | old inbound links |
| `src/components/ui/` | shadcn/Radix primitives | Tailwind/Radix/CVA | all feature UI |
| `src/components/layout/` | App header/nav/chat/shell/language wrapper | auth/i18n/router | `App.tsx`, pages |
| `src/components/states/` | loading/error/empty/offline patterns | UI primitives/i18n | routes and suspense |
| `src/components/seo/` | dynamic metadata and schema components | route/content data | public pages |
| `src/components/chat/` | livestream chat, nickname, moderation controls | chat hooks/auth/realtime | watch/embed/admin |
| `src/components/video/` | Mux player, gates, video cards | Mux SDK/hooks | live/video pages |
| `src/components/quicktable/` | quick-table registration/group/schedule/bracket/referee UI | quick-table hooks/libs | quick-table pages |
| `src/components/teamMatch/` | team setup/roster/groups/lineups/scoring/playoffs | team-match hooks/RPCs | team-match pages |
| `src/components/tournament/`, `tournaments/` | general and doubles tournament UI | tournament hooks/auth | tournament pages |
| `src/components/flex/` | flex entity/group/match/stat UI | flex hook | flex pages |
| `src/components/social/` | player/feed/match social UI | `hooks/social`, social lib | feed/profile/match |
| `src/components/social-events/` | club event registration/payment/live operations | event hooks/Edge functions | social-event pages |
| `src/components/shop/` | pilot marketplace shell/shared UI | shop contracts/hooks | seller/admin/shop |
| other `src/components/<domain>/` | feature UI for account, clubs, forum, rankings, search, venues, news, payments, etc. | matching hooks/libs | corresponding pages |
| `src/hooks/useAuth.tsx` | auth context/session/cache purge | Supabase/query | all protected features |
| `src/hooks/useConfirm.tsx` | promise confirm context | shared dialog | destructive UI actions |
| `src/hooks/social/` | feed/follows/comments/kudos/notification hooks | social tables/RPC/realtime | social pages/components |
| `src/hooks/shop/` | shop pilot application/product/import hooks | shop client/schema | shop pages |
| `src/hooks/dupr/` and `useDupr*.ts` | DUPR link/sync/eligibility/clubs | Edge functions/RPC | account/events/admin |
| `src/hooks/useQuickTable*.ts` | quick-table query/mutation/referee orchestration | quick-table tables/RPC/libs | quick-table UI |
| `src/hooks/useTeamMatch*.ts` | team match tournament/team/match/standing lifecycle | team-match tables/RPC | team-match UI |
| `src/hooks/useDoublesElimination.ts` | doubles lifecycle and atomic scoring | doubles tables/RPC | doubles UI |
| `src/hooks/useFlexTournament.ts` | flex CRUD/scoring/stats/generation | flex tables/RPC | flex UI |
| `src/hooks/useLivestreamData.ts` | public live/replay queries | public view/logo helper | home/live/watch |
| `src/hooks/useChatMessages.ts`, `useLivePresence.ts` | chat and live presence | Realtime/chat tables/auth | live watch/chat |
| remaining `src/hooks/` | domain query/mutation adapters | Supabase/query/i18n | matching components/pages |
| `src/lib/round-robin.ts` | circle scheduling/court/time ordering | pure TypeScript | quick/team/flex tools |
| `src/lib/doubles-bracket-utils.ts`, `doubles-elimination/` | bracket IDs/seeds/win requirement | pure TypeScript | doubles engine |
| `src/lib/edgeInvoke.ts` | resilient Edge Function invocation | Supabase client | creator/feature actions |
| `src/lib/auth/`, `auth-config.ts` | redirect and auth helpers | Capacitor/browser | auth/deep links |
| `src/lib/pwa/`, `src/pwa.ts` | SW registration/cache policy | Workbox/Capacitor | boot/auth |
| `src/lib/image-utils.ts` | external/image URL normalization and policy | browser URL APIs | media/content/shop |
| other `src/lib/<domain>/` | pure policy/formatting/domain utilities | minimal dependencies | hooks/components |
| `src/integrations/supabase/client.ts` | singleton typed public client | environment + supabase-js | all web data access |
| `src/integrations/supabase/types.ts` | generated public schema/RPC/types | migration output | TypeScript clients |
| `src/integrations/supabase/shop-client.ts`, `shop-schema.ts` | temporary hand-written shop contract and one narrow cast; remote-generated types do not yet contain the migration | Supabase + shop migration | pilot shop hooks |
| `src/i18n/` | provider, dictionaries, standalone translation helpers | React/local storage/router | UI |
| `src/routes/` | route contract tests/snapshots | `App.tsx` source | CI |
| `src/proto/shop/` | compile-time gated design prototype/screens/fixtures | React UI | prototype build only |
| `src/contracts/`, `src/types/` | cross-feature DTO/type contracts | TypeScript | hooks/components |
| `supabase/migrations/` | canonical schema, policies, RPCs, triggers/indexes | Postgres/Supabase | every client |
| `supabase/functions/<slug>/` | privileged/external API handler | `_shared`, server secrets, DB | web/native/workers/providers/cron |
| `supabase/functions/_shared/` | auth/CORS/cron/API/DUPR/news validation helpers | Deno/Supabase | Edge Functions |
| `supabase/functions/auth-registry.json` | machine-enforced handler auth classification | handler inspection | auth registry CI |
| `supabase/config.toml` | local/deploy Edge config, project id | Supabase CLI | deployment |
| `supabase/tests/` | database/RLS/RPC tests | local Supabase | CI/manual verification |
| `functions/_middleware.ts` | crawler vs SPA request decision | render utilities | Cloudflare Pages |
| `functions/_lib/render/` | route-specific server HTML | Supabase/public data, SEO helpers | middleware |
| `functions/sitemap-*.ts`, `rss.xml.ts` | discovery feeds | public Supabase data | crawlers |
| `functions/og/`, Supabase `og-*` | share image proxy/generation | public data/cache | social crawlers |
| `workers/news-fetcher/` | acquire/normalize news sources | news Edge APIs | scheduled Worker |
| `workers/pro-tour-scraper/` | scrape tour source data | pro-tour ingest | admin/scheduled Worker |
| `workers/social-poster/` | distribute published news to social pages | Graph APIs/news data | scheduled Worker |
| `workers/edge-blob-watchdog/` | monitor Edge invocation blob anomalies | HTTP/ops | operations |
| `apple/ThePickleHub/App/` | SwiftUI composition/lifecycle | Core/Features | native app |
| `apple/ThePickleHub/Core/` | domain models/repository protocols/clients for auth, media, tournament families, social/club, feed, messaging, venues, shop and more | networking/Supabase | native features |
| `apple/ThePickleHub/Core/Shop/` | catalogue API/DTOs, repository/cache, cart, orders/payment, analytics and media policy | several Supabase contracts absent from included migrations | native shop features |
| `apple/ThePickleHub/Features/` | native views/view models by domain | Core/DesignSystem | native shell |
| `apple/ThePickleHub/Features/Shop/`, `DesignSystem/Shop/` | home/search/category/product/store/wishlist/cart/checkout/orders and shop UI | Core Shop | native navigation |
| `apple/ThePickleHub/DesignSystem/` | native components/tokens | SwiftUI | native features |
| `apple/Tests/` | native repository/contract/UI logic tests | protocols/mocks | Xcode tests |
| `android/`, `ios/` | Capacitor artifacts; runtime config uses remote `server.url`; Android is minimal/incomplete here and iOS contains stale synced web assets | hosted web, `dist`, Capacitor | wrapper builds |
| `tests/` | Playwright auth/smoke/journey/a11y/mobile/SEO/visual tests | deployed/local app | CI |
| `scripts/` | architecture gates, bundle/migration/auth/SEO/ops scripts | Node/Supabase | CI/operators |
| `public/` | static assets, headers, redirects, SW/manifest | Vite/Pages | deployed site |
| `docs/` | audits, operations, product/architecture history | source evidence | engineers/agents |

Excluded from architectural reasoning: `node_modules/`, `dist/`, `playwright-report/`, `test-results/`, and generated bundle files inside Capacitor projects.

Generated Capacitor files may be inspected to detect artifact drift or association metadata, never as the source for current React behavior.
