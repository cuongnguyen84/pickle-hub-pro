# DUPR Integration — Memory / Handoff Notes

**Last updated:** 2026-05-29 (Sprint E shipped)
**Purpose:** Continuity file để bắt đầu conversation mới mà không mất context. Tổng hợp toàn bộ DUPR integration (Sprint A/B/C) + SEO sprints đã ship lên production.

> Đọc file này + `CLAUDE.md` + `docs/dupr-integration-roadmap.md` + `docs/seo-audit-2026-05-28.md` là đủ context để tiếp tục.

---

## 0. Trạng thái tổng quan

| Sprint | Scope | Status | Branch → main |
|---|---|---|---|
| **A** | Social: Vietnam Rankings + PlayerProfile gate + opt-in + onboarding username + PlayersNearRating + DuprChip | ✅ LIVE | merged |
| **B** | Quick Tables: rating_source enum + DUPR enforcement + auto-seed bracket | ✅ LIVE | merged |
| **C** | Mexicano DUPR-balanced pairing + RoundFairnessCard | ✅ LIVE | merged |
| **D** | Doubles Elimination: rating_source + per-player profile link + auto-seed + dupr-match-submit on score + soft public banner + SSR | ✅ LIVE | merged |
| **E** | Doubles Elimination workflow rework: Step 2 TheLine card refactor + min 40 + skip Step 3 for DUPR + open self-registration (status='registration_open' + 5 RPCs) + per-player DUPR in list + BTC remove team + BTC manual add team | ✅ LIVE | merged |
| **SEO 1-4** | sitemap gaps, hreflang, ItemList/BreadcrumbList JSON-LD, forum category SSR, 3 new sitemap segments | ✅ LIVE | merged |
| Blog | Bilingual launch post (vietnam-dupr-leaderboard-launch) | ✅ LIVE | merged |

Mọi thứ đã trên `main` + deploy production thành công.

---

## 1. DUPR existing infra (CÓ TRƯỚC khi em bắt đầu — đừng build lại)

Project đã có sẵn **DUPR RaaS stack hoàn chỉnh** (16 edge functions, 8 tables). KHÔNG phải build mới:

**Edge functions:** dupr-sso-callback, dupr-link, dupr-disconnect, dupr-refresh-user-token, dupr-partner-token, dupr-sync, dupr-match-submit, dupr-user-search, dupr-entitlements, dupr-event-eligibility, dupr-clubs, dupr-org-link-club, dupr-org-unlink-club, dupr-webhook, dupr-webhook-register, dupr-webhook-test-fire

**Schema:** profiles.dupr_id/dupr_singles/dupr_doubles/dupr_synced_at/dupr_connected_via, matches.dupr_*, dupr_user_tokens, dupr_user_entitlements, dupr_user_clubs, dupr_rating_history, dupr_match_submissions, dupr_webhook_events

**UI/hooks:** DuprConnectButton, DuprSsoModal, HeaderDuprBadge, useDuprConnection, useDuprEntitlements, useDuprClubs, useDuprUserSearch

**Webhook:** RATING events update profiles.dupr_* + history. Registered tại `https://ajvlcamxemgbxduhiqrl.supabase.co/functions/v1/dupr-webhook`.

---

## 2. Sprint A — Social DUPR (đã ship)

### Migrations applied production
- `20260528010000_dupr_leaderboard_vietnam_rpc.sql` — RPC `dupr_leaderboard_vietnam(p_format, p_limit)`
- `20260528020000_dupr_players_near_rating_rpc.sql` — RPC `dupr_players_near_rating(p_target_rating, p_window, p_exclude_user_id, p_limit)`
- `20260528030000_profiles_is_public_profile.sql` — column `is_public_profile BOOLEAN NOT NULL DEFAULT false` + backfill `true` cho onboarded users (Option A — giữ SEO). 24 rows backfilled.
- `20260528040000_rpcs_filter_is_public_profile.sql` — re-CREATE 2 RPCs trên + thêm `is_public_profile = true` gate + RPC `username_is_available(p_candidate)`.

### Files
- `src/content/dupr-rankings.ts` — thêm scope `"vietnam"` (group `"national"`) vào `DuprScope`, formats `"singles"`/`"doubles"`, helpers `getAvailableFormats(scope)` + `defaultFormatForScope(scope)`
- `src/hooks/dupr/useVietnamRankings.ts` — RPC wrapper
- `src/hooks/dupr/usePlayersNearRating.ts` — RPC wrapper
- `src/hooks/dupr/useDuprSeeds.ts` — shared hook (Sprint C cũng dùng)
- `src/components/dupr/DuprChip.tsx` — pill xanh tabular-nums + stale ◐ marker
- `src/lib/dupr/staleness.ts` — `isDuprStale(syncedAt)` >30d
- `src/components/social/PlayersNearRating.tsx` — widget sidebar
- `src/pages/Rankings.tsx` — branch scope vietnam (live RPC) vs static; `<VietnamRankingsTable>` sub-component
- `src/pages/PlayerProfile.tsx` — mount PlayersNearRating + filter `is_public_profile` (own-user bypass)
- `src/hooks/social/usePlayerProfile.ts` — filter `is_public_profile=true OR id=auth.uid()`
- `src/components/account/PublicProfileToggle.tsx` — opt-in switch trong Account
- `src/components/onboarding/steps/ProfileSetup.tsx` — user-pick username + real-time `username_is_available` check
- `functions/_lib/render/index.ts` — `renderRankings` async + ItemList JSON-LD top-25; `renderPlayer` filter is_public_profile
- `functions/sitemap-players.xml.ts` — filter `is_public_profile=true`, re-enabled trong index

### Privacy model
- Existing 24 onboarded → public (backfilled). New users → private default. Opt-in qua Account → "Hiển thị profile công khai".
- Bot crawl non-public profile → 404. Owner viewing own → always sees.

---

## 3. Sprint B — Quick Tables DUPR enforcement + Auto-seed (đã ship)

### Migration
- `20260528050000_quick_tables_rating_source.sql` — column `rating_source TEXT CHECK ('self'|'dupr'|'either') DEFAULT 'self'`. Backfill 91 tables → 'self'.

### Decisions (Cuong locked)
- ENUM `rating_source`: `self` (legacy) | `dupr` (bắt buộc SSO) | `either` (ưu tiên DUPR, vẫn cho self-report)
- Default min/max khi DUPR-required: NULL/NULL (no limit)
- User chưa SSO + dupr-required → block + show DuprConnectButton gate

### Files
- `src/pages/QuickTables.tsx` — radio rating source + min/max DUPR input (khi requires_skill_level)
- `src/hooks/useQuickTable.ts` — createTable post-RPC UPDATE rating_source + min/max (RPC `create_quick_table_with_quota` không đổi)
- `src/components/quicktable/RegistrationForm.tsx` (singles) + `DoublesRegistrationForm.tsx` — auto-fill DUPR, validate range, hide "Trình độ" section khi rating_source='dupr', block submit out-of-range
- `src/components/dupr/DuprEligibilityCheck.tsx` — 4 states card (loading/no-DUPR-gate/eligible-green/not-eligible-red) mount đầu cả 2 forms. Singles→doubles fallback (isApprox marker).
- `src/components/quicktable/DuprRequirementBanner.tsx` — public banner trên `/t/<share_id>`
- `src/lib/dupr/seedFromDupr.ts` — `fetchDuprSeeds` (singles→doubles fallback, isApprox), `rankBySeed`, `seedCoverage` (total/withDupr/stale/approx)
- `src/components/quicktable/BracketSetupDialog.tsx` — "Auto-seed theo DUPR" button + SeedExplainerCard
- `src/components/dupr/SeedExplainerCard.tsx` — coverage stats (exact/approx/no-DUPR) + warning banners
- `src/hooks/useTeamRegistration.ts` — decode Postgres error codes (22P02/23514/42501) thay vì generic "Failed to register"

### Bugs đã fix (root causes — quan trọng nhớ)
1. **DoublesRegistrationForm thiếu DUPR enforcement** — chỉ singles RegistrationForm có. Wire props + DuprEligibilityCheck cho cả 2.
2. **"Failed to register"** — `skill_rating_system` ENUM là **uppercase `'DUPR'`** (not `'dupr'`). Auto-fill set lowercase → 22P02 invalid enum. Fix dùng `'DUPR'`.
3. **SeedExplainerCard "1/6 có DUPR"** — table singles query `dupr_singles` nhưng VN players chỉ có `dupr_doubles`. Fix: singles→doubles fallback + "ước tính" label. Doubles giữ strict (no reverse fallback).
4. **DuprEligibilityCheck "chưa kết nối"** dù đã SSO — cùng singles fallback issue.
5. **Banner "Sẵn sàng chia bảng" vẫn hiện sau khi đã chia** — thiếu `table?.status === 'setup'` guard.

### Skipped (deferred)
- B1.6 admin override out-of-range registration (organizer manual-edit OK)
- B2.4 re-seed diff preview (auto-seed button re-clickable)

---

## 4. Sprint C — Mexicano DUPR-balanced (đã ship)

### Files
- `src/lib/matchmaking/balancedDoubles.ts` — `balancedPairing(4 players)` minimize |sumA-sumB|, `balancedScheduleEligible(players, 0.75)`, `averageFairness`
- `src/lib/matchmaking/index.ts` — MMRound.fairness, MMSchedule.balancedPairingApplied/duprCoverage, GenerateOptions.preferBalanced. `generateMexicano` gated ≥75% coverage, fallback random. `pairAvoidingRepeats` score = repeats*100 + diff.
- `src/components/matchmaking/RoundFairnessCard.tsx` — `<RoundFairnessCard>` (avg % + per-round pills) + `<MexicanoCoverageBanner>` (fallback explain)
- `src/pages/SocialEventMatchmaking.tsx` — fetch DUPR doubles, prefer over self_rated_level, checkbox "Ưu tiên cân bằng theo DUPR" (default ON), mount card + banner

### Untested (Cuong sẽ test sau)
Sprint C UI chưa test live — cần social event ≥4 checked-in players. Fixtures chưa tạo.

---

## 4b. Sprint D — Doubles Elimination DUPR (PR open 2026-05-29)

**Branch:** `feat/dupr-doubles-elimination` (4 commits, ~1577 lines).
**Preview:** https://feat-dupr-doubles-eliminatio.pickle-hub-pro.pages.dev
**Status:** Verified live via SSR curl + 32-team fixture; merge to main pending Cuong review.

### Council 4-voice review (2026-05-29) — important decisions

Cuong explicitly requested council before code. Skeptic + Pragmatist + Critic + Architect all
warned: DUPR SSO coverage in VN ≈ 0.7% (14/2090 profiles). 3/4 recommended Phase 1 only;
Cuong overrode with "build it and they will come" — ship full Phase 1+2+3 to attract DUPR
sign-ups. Guardrails applied from council outputs:

- Lowercase enum `'self'/'dupr'/'either'` — INTENTIONALLY different from `skill_rating_system`
  uppercase `'DUPR'` (Sprint B). Mixing caused 22P02 in Sprint B; comments in migration warn.
- Dual-mode team input (text legacy + profile link) — organizer can still type names like
  old workflow; member-search is opt-in per player slot.
- Auto-seed button gated ≥50% teams linked. Below threshold = disabled + tooltip.
- Banner SOFT language: "Khuyến nghị" / "Recommended", never "Yêu cầu". CTA links
  `mydupr.com/signup` so 95% VN audience without DUPR aren't filtered out.
- Submit DUPR is best-effort: failed POST does NOT block match completion. Toast surfaces
  outcome; error truncated to 500 chars into matches.dupr_submit_error for transparency.

### Migrations applied production

- `20260529100000_doubles_elimination_dupr_phase_1.sql`
    * tournaments: `rating_source TEXT CHECK ('self'|'dupr'|'either')` default `'self'`,
      `min_dupr_rating NUMERIC(3,2)`, `max_dupr_rating NUMERIC(3,2)`, cross-field range check.
    * teams: `player1_user_id` + `player2_user_id` (nullable, FK profiles ON DELETE SET NULL),
      `dupr_avg_rating NUMERIC(3,2)`, `dupr_seed_source TEXT CHECK ('exact'|'approx'|'none')`.
    * Partial indexes on player_user_ids.
- `20260529110000_doubles_elimination_dupr_phase_2.sql`
    * matches: `dupr_submitted BOOLEAN` default false, `dupr_match_code TEXT`,
      `dupr_submitted_at TIMESTAMPTZ`, `dupr_submit_error TEXT`. Partial idx on submitted=true.

### Files

- `src/lib/dupr/seedDoublesTeams.ts` — `computeTeamDuprSeeds()` one round-trip fetch
  profiles + per-team avg DUPR doubles (singles fallback per player → 'approx').
  `teamSeedCoverage()` stats shape compatible with existing `<SeedExplainerCard>`.
- `src/lib/dupr/submitDoublesEliminationMatch.ts` — idempotent submit helper. Calls
  `dupr-match-submit` edge fn with `internal_source='doubles_elim_match'`. Mirrors
  matchCode/submitted_at back onto `doubles_elimination_matches` row directly (edge fn
  matches-table mirror only fires for `internal_source IN ('match','club_match')`).
- `src/components/tournament/DoublesEliminationPlayerInput.tsx` — dual-mode per-slot input.
  Text mode default; 🔍 button opens `useDuprUserSearch` dropdown; pick result → bind
  profile id + green chip lock with DUPR badge + ✕ unlink button.
- `src/components/dupr/DuprRecommendationBanner.tsx` — soft banner. Renders only when
  `rating_source != 'self'` AND a min/max range exists. CTA to `mydupr.com/signup`.
- `src/hooks/useDoublesElimination.ts` — exported `RatingSource` + `DuprSeedSource` literal
  types. `createTournament` takes optional `duprOptions` (ratingSource, min/maxDuprRating);
  post-RPC UPDATE pattern from Sprint B preserves quota RPC untouched. `addTeams` accepts
  per-team profile ids + dupr_avg + seed_source. `generateBracket` adds `seedingStrategy:
  'manual' | 'random' | 'dupr'`. Dynamic-key update bug at line 535 (pre-existing) cleaned
  up while in the area.
- `src/pages/DoublesEliminationSetup.tsx` — Step 1 rating-source selector as 3 TheLine cards
  (kicker `◆ 01/02/03` + serif italic title + description, selected=green-glow). Sub-card
  "◆ Khoảng DUPR cho phép" framed with own kicker. Step 3 team cards = optional team_name
  + 2 PlayerInput slots + club + seed + computed avg/source line. Auto-seed button calls
  `computeTeamDuprSeeds`, re-orders, mounts SeedExplainerCard. `handleCreate` picks
  seeding strategy automatically (dupr if auto-seed ran, manual if any seed typed, else random).
- `src/pages/DoublesEliminationScoring.tsx` — TeamData/TournamentData/MatchData extended
  with DUPR mirror fields. `tryDuprSubmit()` invoked from BOTH `handleSaveGame` final-game
  and `handleEndMatchDirectly` (before navigation). Three toast paths: submitted / error /
  skipped. Status badge xanh/đỏ under match-ended trophy.
- `src/pages/DoublesEliminationView.tsx` — `<DuprRecommendationBanner>` mounted right below
  tournament name.
- `functions/_lib/render/index.ts` (`renderDoublesElimination`) — select DUPR fields, append
  `Khuyến nghị DUPR <range>.` to meta description, emit SportsEvent JSON-LD with
  `audience.audienceType`. Page stays noindex.
- `src/integrations/supabase/types.ts` — manual patch of new columns into Row/Insert/Update
  for 3 tables. Full regen ripples 66 pre-existing dynamic-key errors elsewhere → out of
  scope. Trailing `as const` restored after stripping stale CLI version notice trailer that
  origin/main shipped.

### Test fixture (live in DB)

Shared URL: https://www.thepicklehub.net/tools/doubles-elimination/dupr-test-32
- 32 teams: 16 DUPR-linked (random pair from 21 VN profiles with dupr_doubles + dupr_id)
  + 16 legacy text-only. Seeded 1..32 by avg desc.
- 16 R1 matches pre-generated (snake 1v32, 2v31, ...), 4 courts.
- Owner: thecuong@gmail.com (UUID 5040f0f2-f564-401c-9737-4b030b6371d7).
- `rating_source='dupr'`, min 3.00, max 4.50.
- Cleanup: `DELETE FROM doubles_elimination_tournaments WHERE share_id='dupr-test-32';`

### Risk notes for future conversations

- 32-team minimum makes UI tests painful — keep this fixture or rebuild via the script
  at `/tmp/build_fixture.py` shape (16 DUPR pairs + 16 legacy).
- Edge function `dupr-match-submit` accepts arbitrary `internal_source`. New value
  `'doubles_elim_match'` does NOT trigger matches-table mirror (that's for source IN
  ('match','club_match')). The helper writes back to doubles_elimination_matches directly.
- Auto-seed coverage threshold is 50% — if Cuong wants 30% or 70% in future, change in
  `DoublesEliminationSetup.tsx` `canAutoSeed` calc.
- Banner uses Sparkles icon + green-glow theme to match SeedExplainerCard family. If
  redesigning DUPR visual identity, update all 3 in sync (DuprRecommendationBanner,
  SeedExplainerCard, DoublesEliminationPlayerInput).

---

## 4c. Sprint E — Doubles Elimination self-registration (shipped 2026-05-29)

**5 commits on `main`:** `4202f85` E.1 → `26a8022` E.2 → `db3fb28` E.3 → `ccad2eb` E.4 → `8aadd40` E.5.

Cuong overrode the product-lens REFINE verdict (0.7% DUPR coverage warning) with "build it
and they will come" — full open-registration flow shipped to production. Council outputs
honored anyway via the soft-language banner, dual-mode preservation for non-DUPR flows,
and best-effort error handling on every RPC.

### What changed end-to-end

**Setup wizard** (`src/pages/DoublesEliminationSetup.tsx`):
- Min team count 32 → 40 across UI + i18n strings. DB CHECK constraint `team_count >= 40`
  added with `NOT VALID` (legacy 32-team tournaments stay valid; new INSERTs enforce 40).
- Step 2 fully refactored to TheLine pattern (per the make-interfaces-feel-better ECC
  skill blueprint):
    * Early rounds = 3-card grid (BO1 / BO3 / BO5) with mono kicker `◆ 01/02/03`, mono
      title 18px, sub-tagline, green-glow selected state, `role='radio'` + `aria-checked`.
    * Semifinals + Finals = new `<SegmentedFormatSelector>` component: 3-pill segmented
      control `[Same as early · BOx] [BO3] [BO5]`. The 'inherit' option surfaces the live
      derived format as a sub-label so the user sees the effective value without toggling.
    * Third place match = inline switch-style toggle pill (Bật / Tắt), `role='switch'`.
- State model collapsed `customSemifinals` + `customFinals` booleans → single
  `'inherit' | BestOfFormat` union per slot.
- When `rating_source === 'dupr'` Step 3 is SKIPPED entirely: step indicator drops to 2
  pills, Step 2 Continue button morphs to **"Mở đăng ký" + Trophy icon**, and
  `handleCreateRegistrationOpen()` creates the tournament at `status='registration_open'`
  (no teams, no bracket) then navigates to the share page. For `'self'` / `'either'` the
  manual team-list flow is unchanged.

**Schema** (`20260529120000_doubles_elimination_open_registration.sql` +
`20260529130000_doubles_elim_organizer_remove_team.sql` +
`20260529140000_doubles_elim_organizer_add_team.sql`):
- `tournaments.status` CHECK expanded to add `'registration_open'` between `setup` and
  `ongoing`. Default still `'setup'` so the manual flow is untouched.
- Two partial UNIQUE indexes on `teams(tournament_id, player1_user_id)` and
  `teams(tournament_id, player2_user_id)` WHERE NOT NULL — a profile cannot occupy two
  slots in the same tournament. Legacy text-only teams stay unaffected (player_user_ids
  are NULL there).
- Helper SECURITY DEFINER function `dupr_doubles_with_fallback(profile_id) → (rating, is_approx)`
  mirrors the seedFromDupr.ts singles-fallback policy so the RPCs share one definition.

**RPCs** (all SECURITY DEFINER, GRANT EXECUTE TO authenticated):
- `register_team_for_doubles_elimination(tournament_id, partner_user_id, team_name DEFAULT NULL)`
  — `auth.uid()` = player1. Validates status, capacity, dedupe (both players), DUPR
  presence + range. Computes dupr_avg + seed_source. Returns `{success, team_id, dupr_avg,
  seed_source, count, capacity}` or `{success: false, error: '<CODE>'}`.
- `cancel_doubles_elimination_team_registration(tournament_id)` — caller deletes their
  own team row (matches either player slot). Only valid during `registration_open`.
- `organizer_remove_team_from_doubles_elimination(tournament_id, team_id)` — creator-only,
  during `registration_open`. Drops the team row regardless of who's on it. Distinct
  from cancel above which is self-service.
- `organizer_add_team_to_doubles_elimination(tournament_id, p1_user_id, p2_user_id, team_name DEFAULT NULL)`
  — creator-only. Same dedupe + DUPR + range gates as `register_team_*` but pairs two
  arbitrary players (offline sign-up, BTC vouches for ghost partner, etc.).
- `close_doubles_elimination_registration(tournament_id)` — creator-only. Requires
  `count == capacity`. Assigns seeds 1..N by `dupr_avg_rating DESC NULLS LAST, team_name`
  (mirrors the auto-seed UI order). Flips status to `ongoing`. Frontend still calls
  `generateBracket(strategy='manual')` after this RPC so R1 matches read consistent seeds.

**Error codes returned + localized** (12 + 3 added in E.5):
`AUTH_REQUIRED, INVALID_PARTNER, INVALID_PLAYERS, SAME_PLAYER, TOURNAMENT_NOT_FOUND,
REGISTRATION_CLOSED, NOT_DUPR_TOURNAMENT, TOURNAMENT_FULL, ALREADY_REGISTERED,
MISSING_DUPR, OUT_OF_RANGE, NOT_OWNER, NOT_REGISTRATION_OPEN, NOT_FULL, TEAM_NOT_FOUND`.

**Frontend hook** (`src/hooks/useDoublesElimination.ts`):
- `TournamentStatus` extended with `'registration_open'`.
- `createTournament`'s `duprOptions` gains optional `initialStatus`; post-RPC UPDATE
  pattern same as existing DUPR field patches.
- 5 new RPC wrappers returned from the hook: `registerTeam`, `cancelTeamRegistration`,
  `organizerAddTeam`, `organizerRemoveTeam`, `closeRegistration`. All decode the
  `{success, error, ...}` JSON envelope and surface a flat result.

**Registration UI** (`src/components/tournament/DoublesEliminationRegistrationSection.tsx`,
~770 lines):
- Mounted on `DoublesEliminationView` when `tournament.status === 'registration_open'`
  via a status-aware section that swaps the regular bracket Tabs.
- `ProgressCard` — registered / capacity + progress bar, full-state copy.
- Conditional center surface (top to bottom checks):
    1. `isOrganizer` → info notice ("Bạn là BTC — quản lý danh sách bên dưới") +
       `<OrganizerAddTeamPanel>` collapsed button → expand to inline form with two
       `<PlayerSearchSlot>` components + optional team_name + Add button.
    2. not signed in → "Sign in to register".
    3. signed in but `!conn?.ssoConnected` → warn card with `<DuprConnectButton>`.
    4. user has a team → `<MyRegistrationCard>` with Cancel button.
    5. tournament full → "Waiting for organizer" notice.
    6. otherwise → `<RegistrationForm>` (DuprUserSearch dropdown + team_name).
- `RegisteredTeamsList` shows per-player DUPR pills via `usePlayerDuprRatings(teams)` hook
  (one round-trip fetch of profiles keyed on sorted user_id set). Format:
  `CM10 [3.57] / Henry Le [3.42]` with `avg 3.50` second line; `*` suffix on per-player
  pill when rating came from singles fallback. Organizer sees a `Trash2` delete button
  per row that calls `organizerRemoveTeam` after window.confirm.
- Organizer-only "Đóng đăng ký + tạo bracket" button rendered once at capacity; calls
  `closeRegistration` then `generateBracket(strategy='manual')`.
- `localizeError(code, vi)` maps all 15 error codes to VI/EN strings.

**types.ts** — manual patches for status string union + 5 new RPCs. Full regen still
out of scope because Supabase typegen ripples 66 pre-existing dynamic-key errors.

### What's NOT in Sprint E (intentional next-conversation work)

- Waitlist when capacity reached but more teams want in.
- Partner-invite flow (player1 invites player2 to a team; player2 confirms before the
  team row is created — current RPC binds both immediately).
- Registration deadline / auto-close at a fixed timestamp.
- Notifications when a slot opens (cancel) — push to anyone on a waitlist.
- Payment gate at registration (DUPR-gated paid events).
- Bracket re-seed after manual remove + manual add (currently seeds are only computed
  at `close_doubles_elimination_registration`; if BTC removes + adds mid-flow before
  closing, the next close call still recomputes correctly).
- Profile gender + birth_year migration to enable mens/womens + age-bracket filter
  (carries from Sprint D outstanding ideas — no progress in E).
- DUPR delta preview on scoring (still deferred from Sprint D outstanding).

### Known caveats / things to remember in next conversation

- Migration uses `NOT VALID` for the `team_count >= 40` check. If a future migration
  ever wants to validate it (e.g. once all legacy <40 tournaments are archived), run
  `ALTER TABLE … VALIDATE CONSTRAINT …`. Until then ALL existing rows that are <40 keep
  working as `ongoing`/`completed`; only NEW inserts are blocked.
- `Tournament.rating_source` is lowercase `'self' | 'dupr' | 'either'`. The
  `skill_rating_system` enum is uppercase `'DUPR'`. Mixing them caused Sprint B's 22P02.
  Comments in migration warn about it.
- The 2 existing 32-team tournaments (`dupr-test-32` was deleted; legacy
  `Giải Pickleball Xuân 2026` share_id `jezbma37` remains) are unaffected by the floor
  change.
- `OrganizerAddTeamPanel` and `RegistrationForm` use a shared `<PlayerSearchSlot>`
  pattern but each has its own state. Don't accidentally lift state above when adding
  features like waitlist (it would couple BTC operations to viewer state).
- `usePlayerDuprRatings` invalidates only on the set of user_ids changing (stable key).
  If profile DUPR updates while the page is open the list won't refresh until softReload
  runs (cancel/add team, the realtime channels don't poll profiles).

---

## 5. SEO Sprints (đã ship) — xem docs/seo-audit-2026-05-28.md

### Helpers mới (reusable cho future handlers) — `functions/_lib/utils.ts`
- `bilingualHreflang(enUrl, viUrl, xDefault?)` — `<link rel="alternate">` triplet
- `buildBreadcrumbJsonLd(crumbs)` — `@graph`-ready BreadcrumbList node
- `buildListJsonLd(name, items)` — (trong render/index.ts) ItemList cho list pages

### Đã làm
- **SEO-1:** sitemap-static thêm /rankings, /vi/rankings, /vi/privacy, /vi/terms, 4 /tools/*/new. hreflang triplet vào renderTournamentDetail/renderLive/renderVideo/renderForumPost/renderOrgDetail/renderBlog. `renderForumCategory` SSR (was bot 404). sitemap-tournaments status filter.
- **SEO-2:** locale-aware EN/VI meta + ItemList JSON-LD cho renderTournaments/Videos/News/Forum/LivestreamList (renderLivestreamList → async).
- **SEO-3:** BreadcrumbList @graph vào 6 detail handlers.
- **SEO-4:** sitemap-videos.xml (6 URLs), sitemap-livestreams.xml (16), sitemap-organizations.xml (3). Wired vào sitemap.xml index.
- **Cache:** KV key bumped `pr:v8` → `pr:v9` để invalidate stale prerender.

### Pitfall nhớ
- `videos` + `organizations` tables KHÔNG có `updated_at` (chỉ `created_at` + `published_at`). Query sai column → silent error → 0 URLs sitemap.
- KV cache key `pr:v{N}:${pathname}` — đổi SSR output PHẢI bump version, query string KHÔNG bypass cache (dùng `?nocache=1`).

---

## 6. Workflow notes (QUAN TRỌNG cho conversation mới)

### Git push (sandbox không xóa được .git lock)
Sandbox `.git/` của mount path bị stale lock + read-only. **KHÔNG push trực tiếp từ mount.** Thay vào đó:
```sh
cd /tmp && git clone https://cuongnguyen84:<GITHUB_PAT>@github.com/cuongnguyen84/pickle-hub-pro.git phh-clone
# copy edited files từ mount → clone, commit, push
```
Workflow: edit files ở mount (`/sessions/.../mnt/pickle-hub-pro/`), `npx tsc --noEmit` verify, rồi `cp` sang `/tmp/phh-clone`, commit + push origin/main. CF Pages auto-deploy từ main.

### Credentials
Đều ở file `secrets.local.md` (Cuong upload mỗi session). Chứa: SUPABASE_ACCESS_TOKEN, GITHUB_PAT, CLOUDFLARE_TOKEN, DUPR UAT keys, test users. **KHÔNG paste credentials vào file commit.**

### Supabase migrations
Apply qua Management API (không cần supabase CLI):
```sh
SQL=$(cat migration.sql); PAYLOAD=$(jq -Rs '{query: .}' <<< "$SQL")
curl -X POST -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  "https://api.supabase.com/v1/projects/ajvlcamxemgbxduhiqrl/database/query" -d "$PAYLOAD"
```
Migrations là immutable sau khi applied — đổi RPC phải tạo migration file MỚI (CREATE OR REPLACE).

### Deploy verify
- Poll CF deployments API (token + account `7888e97076d4eadd9a8fa409d11dc281`) cho status success
- Sandbox DNS đôi khi fail — dùng `curl --resolve www.thepicklehub.net:443:172.66.0.96`
- Bot view: `curl -A "Googlebot/2.1"`

### IndexNow (Bing/Yandex)
```sh
KEY="0c8f695e57d24623a239bd91164f95d6"  # public key, file ở /public/<KEY>.txt
curl -X POST "https://api.indexnow.org/indexnow" -H "Content-Type: application/json" \
  -d '{"host":"www.thepicklehub.net","key":"'$KEY'","keyLocation":"https://www.thepicklehub.net/'$KEY'.txt","urlList":[...]}'
```

### GSC indexing
Không có public Indexing API cho ranking/blog (chỉ JobPosting/BroadcastEvent). Cuong làm manual URL Inspection → Request Indexing.

---

## 7. Test fixtures convention
- **Tạo test tournaments dùng `is_doubles=true`** (Cuong yêu cầu — 95% giải VN là doubles). Singles dễ trigger bug fallback.
- Test profiles có DUPR: erne-king 5.57, do-hung 4.00, thecuong-685w 3.57 (Cuong), trungnguyen0706 3.56, pham-quang 3.50, sontx91 3.47, giang-truong-nguyen 3.42, ngochai-dinh86 3.39
- Để Cuong thấy form đăng ký (không phải organizer view), set table `creator_user_id` = user khác.
- Cleanup test tables: `DELETE FROM quick_tables WHERE share_id IN (...)` (cascade registrations/groups/matches).

---

## 8. Coverage stats production (2026-05-28)
- 2090 total profiles, 24 onboarded+non-ghost, 14 connected DUPR (SSO), 12 có dupr_doubles
- Vietnam leaderboard: 7 rows (sau filter onboarded + country VN + public + has-dupr)
- Số nhỏ vì DUPR SSO mới deploy — sẽ tăng khi nhiều người connect + opt-in.

---

## 9. Outstanding / next ideas (chưa làm)
- **Sprint E follow-ups**: waitlist, partner-invite confirmation, registration deadline
  auto-close cron, notifications on slot opens, paid registration.
- **Test Sprint D Doubles Elimination** live with a fresh fixture (scoring page submit
  DUPR end-to-end — needs ≥1 R1 match with 4 valid DUPR IDs).
- **Test Sprint C Mexicano** live (cần social event fixtures)
- **profiles.gender + birth_year** migration → enable mens/womens + age-bracket filter trên Vietnam leaderboard (hiện chỉ doubles/singles)
- **dupr-friend-suggest** cron (social-graph-ranker) — chỉ build khi connected users > 5k
- **DUPR delta preview** khi submit match score ("+0.03 → 4.32")
- B1.6 admin override + B2.4 re-seed diff (deferred)
- SEO: SportsClub schema cho /clb/:slug, FAQPage cho EN blog (cần refactor BLOG_POST_META carry faq)
- DUPR-aware follow suggestions, GA4 event tracking (dupr_seed_used, dupr_chip_clicked)

---

## 10. ECC skills consult pattern (Cuong setup)
Cuong muốn dùng skills từ github.com/affaan-m/ECC (246 skills, cloned /tmp/ECC) làm "hội đồng tư vấn" cho quyết định kiến trúc/UI/UX. Skills hữu ích đã dùng:
- `council` — 4-voice review (Architect/Skeptic/Pragmatist/Critic) cho go/no-go
- `product-lens`, `api-design`, `make-interfaces-feel-better`, `database-migrations`, `frontend-a11y`, `social-graph-ranker`, `security-review`, `architecture-decision-records`

Khi ra quyết định lớn → convene council hoặc consult relevant skill trước khi code.
