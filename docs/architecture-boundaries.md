# Module Boundaries & Dependency Rules (ARCH-01)

> Written 2026-07-16. Describes the boundaries the codebase already trends
> toward and makes them the rule, so ARCH-02..05 refactors and everyday PRs
> have one reference. Not a rewrite plan — new code follows this; existing
> violations are cleaned up opportunistically or under their ARCH task.

## Domains

The product decomposes into these feature domains (web `src/`, native
`apple/ThePickleHub/`, edge `supabase/functions/`):

| Domain | Web surfaces | Edge functions | Core tables |
|---|---|---|---|
| Tournament formats | `components/quicktable`, `components/teamMatch`, `components/tournament` (doubles-elim), flex | quota RPC callers | `quick_tables`, `team_match_*`, `doubles_elimination_*`, `flex_*` |
| Social events + payment | `components/social`, `pages/SocialEvent*` | `phone-otp-*`, `reactivate-registration`, `cancel-registration`, `create-payment-order`, `mark-payment-claimed` | `social_events`, `event_registrations`, `payment_orders`, `registration_secrets` |
| Matches + DUPR | `components/social/match`, `pages/matches` | `match-*`, `dupr-*`, `submit-match-score` | `matches`, `match_participants`, `dupr_*` |
| Feed/news/blog | `components/feed`, `pages/News*`, `content/blog` | `feed-generate`, `news-*` | `feed_items`, `news_items`, `blog_post_views` |
| Livestream/video | `components/live` | `mux-*` | `livestreams` |
| Community (clubs, chat, forum) | `components/club`, `components/chat` | notification/chat RPCs | `clubs`, `club_members`, `chat_*`, `forum_*` |
| Platform (auth, admin, ops) | `hooks/useAuth`, `pages/admin` | `send-push-notification`, cron/ops functions | `profiles`, `user_roles`, `push_tokens`, `ops_*` |

## Layering (web)

```
pages → components → hooks → lib → integrations
                       ↘  i18n, contracts, types ↙
```

Rules, in order of how often they get violated:

1. **Pure logic lives in `src/lib`, not in components.** Anything with a
   branch worth testing (scoring, capacity, eligibility, money math) is a
   pure function in `lib/` with a test in `lib/__tests__/`. The proven
   pattern: `refereeScoring.ts`, `teamMatchResult.ts` (QA-07 extracted it
   from two duplicated component copies — don't recreate that situation).
2. **Components never import from `pages/`.** Pages compose; components are
   composed. A component needing route context receives props.
3. **Direct `supabase.from(...)` calls belong in hooks (`src/hooks`) or
   repositories, not in JSX event handlers.** Existing violations (e.g.
   bracket propagation inside `DoublesEliminationBracket.tsx`) are tolerated
   until their ARCH task; new writes go through a hook/mutation.
4. **Cross-domain imports go through `lib/` or a hook, never by reaching
   into another domain's components.** If Feed needs match data, it uses a
   match hook, not `components/social/match/...` internals.
5. **`.legacy.tsx` siblings are rollback artifacts — never import from or
   edit them** except during a rollback (CLAUDE.md rule).
6. **i18n**: user-facing strings via `useI18n()`/dictionaries; no hardcoded
   bilingual ternaries in new code (existing ones migrate opportunistically).

## Layering (edge functions)

```
index.ts (transport: CORS, method, body parse, supabase-js adapters)
  → handler.ts (Deno-free domain logic over injected store interfaces)
  → _shared/ (auth, cors, cron-auth, validation — cross-function only)
```

Rules (all enforced or precedented by SEC-04/BE-01/QA-08):

1. Every function keeps `verify_jwt=false` + internal verification (ES256
   workaround — see CLAUDE.md); its auth flow is declared in
   `docs/edge-function-auth-registry.md` and CI-enforced.
2. CORS comes only from `_shared/cors.ts` presets — never widen a preset,
   never inline headers.
3. Money/state-transition logic goes in a Deno-free `handler.ts` with vitest
   coverage (`dupr-webhook`, `send-push-notification`,
   `create-payment-order`, `mark-payment-claimed` are the templates).
4. Multi-step invariants (capacity, uniqueness races) are enforced in
   Postgres — guarded UPDATE, unique constraint, or advisory-lock RPC —
   never by read-check-write across round-trips (DB-00/DB-01 lesson).
5. Scheduled functions authenticate via `requireCronRequest` +
   Vault-backed `cron_secret`.

## Layering (native)

- `Core/<Domain>/` repositories own all Supabase access; `Features/` views
  never call the client directly.
- Pure logic is a `static func` on the repository (testable without network)
  — `TeamMatchRepository.computeMatchResult` is the template; web and Swift
  twins stay case-for-case identical with mirrored test suites.

## Shared scoring core (ARCH-04 — DONE 2026-07-17)

Shipped across #357-359 (characterization per format), #365-368 (setup
shell: `SetupShell.tsx` + `setup-styles.ts`), and #369-376 (scoring
S1-S5). The shared core is:

- **Pure rules** in `src/lib/`: `doublesElimResult`, `quickTableResult`,
  `flexStats`, `teamMatchResult`, `refereeScoring` (engine: rally,
  side-out AND manual modes, best-of sets, `RefereeLiveState` envelope).
- **One scoring surface**: `RefereeScoringScreen` — setup (mode/target/
  sets/timeouts/coin toss), board, undo, timeouts, notes, DB-persisted
  resume (`referee_live_state` jsonb on the 3 match tables, realtime-
  published), contention lockout with foreign-claim latch, spectator
  live-follow. Formats are thin loaders/overlays wiring RefereeLoaded +
  claim/persist/finish callbacks (see `QuickTableRefereeScoring` — the
  template shape).
- The legacy manual scoreboard page (`MatchScoring.tsx`) is deleted;
  its route redirects to the QT referee screen.

What deliberately REMAINS per-format: match/bracket management (game
slots, save-game side-effects, propagation, DUPR submission) — those are
business rules, not duplication. New scoring features go in the engine +
screen, never in a format page.

## Dependency rule enforcement

Lightweight for now (solo repo): this document + review. If violations
recur after ARCH-02/03, add `eslint-plugin-boundaries` with the table above
as config — not before (the plugin is config-heavy and QA-02's lint-green
work comes first).
