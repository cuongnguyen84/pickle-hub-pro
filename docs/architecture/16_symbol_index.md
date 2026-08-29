# Major symbol lookup index

| Symbol | File | Purpose | Key dependencies |
|---|---|---|---|
| `App` | `src/App.tsx` | provider/router/shell root | router, query, auth, all lazy pages |
| `lazyRetry` | `src/App.tsx` | retrying dynamic import wrapper | React lazy |
| `ChunkErrorBoundary` | `src/App.tsx` | stale chunk cache recovery with reload cap | Cache/SW APIs |
| `AuthProvider`, `useAuth` | `src/hooks/useAuth.tsx` | session/user context and cache purge | Supabase Auth, Query Client |
| `ConfirmProvider`, `useConfirm` | `src/hooks/useConfirm.tsx` | async global confirmation | React context/dialog |
| `I18nProvider`, `useI18n` | `src/i18n/index.tsx` | language context/dictionaries | route/storage state |
| `RequireAuth` | `src/components/auth/RequireAuth.tsx` | login/role UX gate and admin MFA | auth/admin/creator hooks |
| `useAdminAuth` | `src/hooks/useAdminAuth.ts` | reads admin role | `user_roles`, auth |
| `useCreatorAuth` | `src/hooks/useCreatorAuth.ts` | creator/admin and organization lookup | roles/profiles/auth |
| `supabase` | `src/integrations/supabase/client.ts` | typed browser backend client | env, supabase-js |
| `Database`, `Tables`, `Enums` | `src/integrations/supabase/types.ts` | generated DB type contract | migrations |
| `useLivestreams`, `useLivestream` | `src/hooks/useLivestreamData.ts` | public live/replay read models | `public_livestreams`, query |
| `MuxPlayer` | `src/components/video/MuxPlayer.tsx` | live/VOD playback adapter | Mux Player |
| `useLivePresence` | `src/hooks/useLivePresence.ts` | concurrent viewer presence | Supabase Realtime |
| `useChatMessages` | `src/hooks/useChatMessages.ts` | chat query/send/realtime | chat tables/auth |
| `useLivestreamGate` | `src/hooks/useLivestreamGate.ts` | preview/login gate state | auth/system settings/timers |
| `useQuickTable` | `src/hooks/useQuickTable.ts` | quick-table reads/create/playoff logic | tables/RPC/query |
| `useQuickTableMutations` | `src/hooks/useQuickTableMutations.ts` | atomic score/schedule/CRUD commands | scoring RPC, round-robin |
| `generateCircleMethodMatches` | `src/lib/round-robin.ts` | deterministic round-robin pairings | pure data |
| `scheduleMatches` | `src/lib/round-robin.ts` | court/time/display schedule | pairings/court config |
| `useTeamMatch` | `src/hooks/useTeamMatch.ts` | tournament create/update/list | team-match tables/quota RPC |
| `useTeamMatchMatches` | `src/hooks/useTeamMatchMatches.ts` | match/game reads | team-match tables |
| `useTeamMatchMatchManagement` | `src/hooks/useTeamMatchMatches.ts` | atomic round/bracket/score commands | lifecycle RPCs/query |
| `useTeamMatchStandings` | `src/hooks/useTeamMatchStandings.ts` | standings and playoff/repechage seeding | matches/teams/groups |
| `useTeamMatchTeams` | `src/hooks/useTeamMatchTeams.ts` | team registration/approval/roster | team tables/RPC |
| `useDoublesElimination` | `src/hooks/useDoublesElimination.ts` | doubles lifecycle/create/read/actions | doubles tables/RPC |
| `scoreDoublesEliminationMatchAtomic` | same | optimistic atomic scoring | score RPC |
| `advanceDoublesEliminationLifecycle` | same | idempotent R3/playoff advance | lifecycle RPC |
| `matchWinsNeeded` | `src/lib/doubles-elimination/matchWinsNeeded.ts` | best-of to wins required | pure number logic |
| `useFlexTournament` | `src/hooks/useFlexTournament.ts` | flex entity/group/match/stat workflow | flex tables/RPC |
| `useRefereeManagement` | `src/hooks/useRefereeManagement.ts` | format-neutral referee UI orchestration | `referee-helpers` |
| `setRefereePin`, `redeemRefereePin` | `src/lib/referee-helpers.ts` | scoped referee capability RPC adapters | Supabase RPC |
| `useEventLive` | `src/hooks/useEventLive.ts` | social-event live state | events/matches/realtime |
| `useRegistration` | `src/hooks/useRegistration.ts` | event guest/user registration | OTP/registration APIs |
| `useUnifiedNotificationsRealtime` | `src/hooks/social/useUnifiedNotifications.ts` | merge/update notification systems | legacy/social notification tables |
| `useFeedTimeline` | `src/hooks/social/useFeedTimeline.ts` | social feed RPC query | feed RPC/query |
| `useDeepLinkHandler` | `src/hooks/useDeepLinkHandler.ts` | Capacitor/web inbound routing | Capacitor App/router/auth |
| `usePushNotifications` | `src/hooks/usePushNotifications.ts` | permission/token/event lifecycle | Capacitor/FCM/Supabase |
| `initializeGoogleAuth` | `src/hooks/useNativeGoogleAuth.ts` | native social-login setup | Capgo plugin |
| `initPwa` | `src/pwa.ts` | conditional service-worker registration | Workbox/Capacitor |
| `initErrorReporter` | `src/lib/errorReporter.ts` | boot/runtime error ingestion | `log-client-event` |
| `initWebVitalsRum` | `src/lib/webVitalsRum.ts` | route/surface Web Vitals | web-vitals/Edge logging |
| `invokeWithBlobRetry` | `src/lib/edgeInvoke.ts` | resilient Edge invoke decoder | Supabase functions |
| `normalizeImageUrl` family | `src/lib/image-utils.ts` | safe/canonical media URLs | URL/provider rules |
| `getAuthUser` | `supabase/functions/_shared/auth.ts` | verified Edge request user | Supabase Auth |
| `requireCronRequest` | `supabase/functions/_shared/cron-auth.ts` | cron/shared-secret gate | headers/Vault secret |
| `ThePickleHubApp` | `apple/ThePickleHub/App/ThePickleHubApp.swift` | native composition root | repositories/session/router |
| `AppTabView` | `apple/ThePickleHub/Features/Shell/AppTabView.swift` | native tab shell | feature roots |
| `DeepLink` | `apple/ThePickleHub/Core/Networking/DeepLink.swift` | native URL parser/destination model | Foundation |
| `RemotePushService` | `apple/ThePickleHub/Core/Notifications/RemotePushService.swift` | APNs/push registration/events | notifications/backend |
| `SupabaseShopPublicAPI` | `apple/ThePickleHub/Core/Shop/SupabaseShopPublicAPI.swift` | native catalogue/search/product/shop RPC adapter | shop RPCs absent from included migrations |
| `SupabaseShopRepository` | `apple/ThePickleHub/Core/Shop/SupabaseShopRepository.swift` | maps shop DTOs into native models/cache | public API, image policy |
| `SupabaseShopCartRepository` | `apple/ThePickleHub/Core/Shop/ShopCartRepository.swift` | native cart CRUD/view | absent cart table/RPC migrations |
| `SupabaseShopOrderRepository` | `apple/ThePickleHub/Core/Shop/ShopOrderRepository.swift` | order creation/list/payment state | absent order table/RPC migrations |
| `shopFrom`, `shopRpc` | `src/integrations/supabase/shop-client.ts` | temporary facade over one unsafe client cast | hand-written shop shapes |
| `useBulkProductImport` | `src/hooks/shop/useBulkProductImport.ts` | spreadsheet parse/enrich/media/publish workflow | XLSX, Edge enrichment, unresolved product/media contracts |

Database state-machine symbols are RPC functions rather than classes: `score_quick_table_match_atomic`, `create_quick_table_playoff_atomic`, `generate_team_match_round_robin_atomic`, `generate_team_match_brackets_atomic`, `score_team_match_games_atomic`, `score_doubles_elimination_match_atomic`, `advance_doubles_elimination_lifecycle`, `score_flex_match_atomic`, and `update_flex_group_standings_atomic`. Find their latest definitions in `supabase/migrations/`.

`leaderboard-compute` and `notification-send` are registered slugs, not implemented services; both handlers return skeleton status only.
