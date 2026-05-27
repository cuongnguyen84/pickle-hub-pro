# DUPR Integration Roadmap — Social, Bracket, Round-Robin

**Author:** Claude (Cowork session với Cuong)
**Date:** 2026-05-27
**Status:** Sprint A approved (2026-05-27) — Locked decisions ở Section 7
**Skills consulted:** ECC `council`, `product-lens`, `api-design`, `frontend-patterns`, `make-interfaces-feel-better`, `database-migrations`, `frontend-a11y`, `social-graph-ranker`, `architecture-decision-records`, `security-review`

---

## 0. TL;DR

Mặc dù Cuong nói "hiện tại chỉ có DUPR submit/sync", thực ra repo đã có nguyên một **DUPR RaaS stack hoàn chỉnh** (16 edge functions, 8 tables, 5 hooks, 5 UI components, partner SSO + webhook). Cái thiếu **không phải plumbing** — mà là **3 surface layers** chưa khai thác DUPR data đã có sẵn:

1. **Social layer** — profile page công khai, leaderboard, "find partner near my rating", DUPR badge trên feed, DUPR-aware follow suggestions.
2. **Bracket seeding layer** — auto-seed single-elim / doubles-elim từ `profiles.dupr_doubles`, snake-seed group stage, transparent seed explainer.
3. **Round-robin matching layer** — Mexicano/RR auto-pull DUPR rating cho `MMPlayer.level`, balanced partner rotation theo combined-DUPR, "fairness score" hiển thị.

Đề xuất ship theo 3 sprints, bắt đầu từ Social (low-risk, high-visibility) → Bracket (medium risk, partnership demo value) → Round-Robin (highest engineering complexity).

---

## 1. State hiện tại (audit codebase)

### 1.1 Edge functions DUPR (16 — đã deploy)

| Function | Mục đích | State |
|---|---|---|
| `dupr-sso-callback` | Nhận DUPR SSO postMessage, persist user_token | ✅ Production |
| `dupr-link` | Manual rating entry (pre-SSO fallback) | ✅ Production |
| `dupr-disconnect` | Unlink + unsubscribe RATING webhook | ✅ Production |
| `dupr-refresh-user-token` | Refresh 7-day access token | ✅ Production |
| `dupr-partner-token` | Service-role token vending | ✅ Production |
| `dupr-sync` | Backfill match_participants.dupr_rating_* | ✅ Cron daily |
| `dupr-match-submit` | Create/update/delete match trên DUPR | ✅ Production (PR4) |
| `dupr-user-search` | Merge DUPR partner + internal profiles | ✅ Production |
| `dupr-entitlements` | Fetch + cache user entitlements 24h | ✅ Production |
| `dupr-event-eligibility` | Gate Premium events theo PREMIUM_L1 | ✅ Production |
| `dupr-clubs` | Cache user club memberships 24h | ✅ Production |
| `dupr-org-link-club` | Link organization → DUPR club | ✅ PR5 |
| `dupr-org-unlink-club` | Unlink org club | ✅ PR5 |
| `dupr-webhook` | Receive RATING events từ DUPR | ✅ Production |
| `dupr-webhook-register` | One-time webhook registration | ✅ Admin |
| `dupr-webhook-test-fire` | Demo helper synth RATING event | ✅ Admin |

### 1.2 Schema (Supabase)

```
profiles.dupr_id, dupr_singles, dupr_doubles, dupr_synced_at,
          dupr_connected_via, dupr_profile_url, dupr_last_error
matches.dupr_match_id, dupr_hashed_match_code, dupr_sync_status,
        dupr_submitted_at, dupr_sync_attempted_at, dupr_sync_error
match_participants.dupr_rating_before, dupr_rating_after
dupr_user_tokens (access + refresh + revoked_at)
dupr_user_entitlements (BASIC_L1, PREMIUM_L1...)
dupr_user_clubs (DIRECTOR / ORGANIZER / PLAYER)
dupr_rating_history (snapshot mỗi lần update)
dupr_match_submissions (audit trail)
dupr_webhook_events (raw payload archive)
dupr_partner_tokens (service token cache)
dupr_sync_runs (cron run log)
organizations.dupr_club_id, dupr_club_name, dupr_club_role
```

### 1.3 UI components (5)

- `DuprConnectButton`, `DuprSsoModal` — onboarding
- `DuprEntitlementGate` — gate premium content
- `DuprReconnectBanner` — token expired UX
- `HeaderDuprBadge` — header chip showing rating
- `OrganizationDuprClubCard` — org-level club link

### 1.4 Hooks (5)

- `useDuprConnection`, `useDuprEntitlements`, `useDuprClubs`
- `useDuprUserSearch`, `useOrganizationDuprClub`

### 1.5 Logic primitives có sẵn (chưa wired vào DUPR)

- `src/lib/matchmaking/index.ts` — Mexicano + RR generator, accepts `MMPlayer.level: number | null`
- `src/lib/quick-table-utils.ts::distributePlayersToGroups()` — snake-distribution by `seed`
- `src/lib/quick-table-playoff.ts` — bracket generator
- `src/hooks/useDoublesElimination.ts` — doubles-elim
- `src/hooks/useFlexTournament.ts` — flex format
- `src/hooks/useTeamMatch.ts` — team league

**Quan sát then chốt:** Mexicano sẵn nhận `level`, distributor sẵn nhận `seed`. Cái thiếu chỉ là **adapter layer** đọc `profiles.dupr_doubles` → tiêm vào.

---

## 2. Gap analysis — REVISED sau audit 2026-05-27

### 2.1 Social layer

**Em đã assume sai ở Section 1 — sau khi audit kỹ:**

| Surface | Reality |
|---|---|
| Player profile `/nguoi-choi/:username` | ✅ **ĐÃ CÓ production** — page 185 dòng, PlayerHeroCard 413 dòng, DuprRatingChart, MatchHistoryTabs, JSON-LD Person + DUPR ratings, SSR `renderPlayer` (functions/_lib/render/index.ts:1271+) |
| Onboarding flow | ✅ **ĐÃ CÓ** — `ProfileSetup → DuprLinkStep → VenueSelectStep → SuggestedFollowsStep` |
| Onboarding generate username | ⚠️ **AUTO-generate hiện tại** (slugify display_name) — Cuong muốn USER PICK → cần đổi |
| `sitemap-players.xml` | ✅ **File đã có** (`functions/sitemap-players.xml.ts`) — currently disabled trong sitemap.xml index, re-enable + filter `is_public_profile` |
| Feed MATCH card DUPR | ✅ **ĐÃ CÓ** — FeedMatchCard.tsx:501 hiển thị `DUPR {p.dupr_doubles.toFixed(2)}` |
| Feed BLOG/NEWS card author DUPR | ❌ **CHƯA CÓ** — FeedBlogCard, FeedNewsCard không có author DUPR chip |
| `profiles.is_public_profile` | ❌ **COLUMN KHÔNG TỒN TẠI** — hiện tại MỌI profile (`onboarding_completed_at IS NOT NULL AND is_ghost=false`) đều public |
| Account opt-in toggle | ❌ **CHƯA CÓ** — Account.tsx không có public-profile toggle |
| Vietnam scope Rankings | ❌ **CHƯA CÓ** — `dupr-rankings.ts` chỉ có open/junior/5 continents, không có `vietnam` |
| "Players near my rating" widget | ❌ **CHƯA CÓ** |
| RPC `dupr_leaderboard_vietnam` | ❌ **CHƯA CÓ** |
| RPC `dupr_players_near_rating` | ❌ **CHƯA CÓ** |

### 2.2 Bracket seeding — chưa wire DUPR

| Surface | Hiện tại | Cần |
|---|---|---|
| QuickTable group stage | Manual `seed` field | Auto-fetch DUPR cho mỗi registered player → snake seed |
| Doubles-elim bracket | `seed` field nhập tay | Auto-seed + override toggle |
| Bracket UI explainer | Không | Tooltip "Seed #3 = avg DUPR 4.12 (Player A 4.20 + Player B 4.04)" |
| Re-seed sau khi roster đổi | Manual | Button "Re-seed by DUPR" + diff preview |

### 2.3 Round-Robin / Mexicano matching — chưa wire DUPR

| Surface | Hiện tại | Cần |
|---|---|---|
| Mexicano Round 1 seed | Đọc `MMPlayer.level` nhưng UI không inject | UI gọi `dupr-user-search` → tiêm `level = dupr_doubles` |
| Partner balance (doubles) | Random shuffle | Combined-DUPR balance: minimize \|teamA_sum - teamB_sum\| |
| Sit-out fairness | Round-robin rotation | Cân thêm theo DUPR khi roster lẻ |
| Fairness display | Không | Card "Round 1 fairness: 92% (max diff 0.18)" |

---

## 3. Đề xuất kiến trúc

### 3.1 Layer A — Social

#### 3.1.1 Public player profile

**Route:** `/player/:identifier` (EN) + `/vi/player/:identifier` (VI). `identifier` = username slug hoặc DUPR ID.

**Data flow:**
```
SSR (functions/_lib/render/player.ts)
  → supabase.from('profiles').select(...).eq('username', slug).single()
  → meta tags (og:title = "Cuong Nguyen — DUPR 4.32 doubles | ThePickleHub")
  → JSON-LD Person + SportsAction schema

Client (src/pages/PlayerProfile.tsx)
  → useDuprConnection({ targetUserId }) → cached rating
  → useDuprRatingHistory(userId, 90d) → recharts line chart
  → useRecentMatches(userId) → match_participants join
```

**Schema additions:**
```sql
-- migration: profiles.username slug + is_public flag
ALTER TABLE profiles
  ADD COLUMN username TEXT UNIQUE,
  ADD COLUMN is_public_profile BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN profile_bio TEXT;

CREATE INDEX idx_profiles_public_dupr_doubles
  ON profiles (dupr_doubles DESC NULLS LAST)
  WHERE is_public_profile = true AND dupr_doubles IS NOT NULL;
```

**Privacy:** opt-in `is_public_profile`. Default OFF. Settings page có toggle + preview.

#### 3.1.2 Leaderboard — augment `/rankings` hiện tại

**Quyết định 2026-05-27 (Cuong):** KHÔNG tạo route `/leaderboard` mới. Thay vào đó augment `src/pages/Rankings.tsx` thêm scope `"vietnam"` (group = `"national"`) bên cạnh `"open"`, `"junior"`, và 5 continents. Lý do: tránh phân mảnh SEO (`/rankings` đã có meta + sitemap), UI nhất quán (cùng `tl-rank-scopes` row), reuse `tl-rank-scope-row` pattern.

**Khác biệt với static rankings hiện tại:**
- Static scopes (open/junior/continents) → vẫn đọc từ `src/content/dupr-rankings.ts`
- Mới: scope `"vietnam"` → đọc từ Supabase RPC `dupr_leaderboard_vietnam`, chỉ counted consented users (SSO DUPR + `is_public_profile = true`)

**RPC:**
```sql
CREATE FUNCTION public.dupr_leaderboard_vietnam(
  p_format TEXT DEFAULT 'doubles', -- 'singles' | 'doubles'
  p_gender TEXT DEFAULT NULL,      -- 'M' | 'F' | NULL = all
  p_age_bracket TEXT DEFAULT NULL, -- '19+' | '35+' | '50+' | '65+'
  p_limit INT DEFAULT 100
) RETURNS TABLE (
  rank BIGINT,
  user_id UUID,
  username TEXT,
  full_name TEXT,
  avatar_url TEXT,
  dupr_rating NUMERIC,
  dupr_synced_at TIMESTAMPTZ,
  matches_30d INT,
  rating_30d_delta NUMERIC
) ...
-- Pre-filter: country='VN' (profiles.country), is_public_profile=true,
--             dupr_doubles/singles NOT NULL.
-- Whitelist columns — KHÔNG return email, phone, dupr_last_error.
```

**SSR cached 1h** trong KV (`pr:v6:rankings:vietnam:doubles:mens`). Cache invalidated khi `dupr-webhook` RATING event hit user có `is_public_profile=true`.

**Sub-format mapping cho Vietnam scope:** giữ nguyên 4 formats hiện có (`mens-singles`, `womens-singles`, `mens-doubles`, `womens-doubles`) — yêu cầu thêm `profiles.gender` filter trong RPC.

**Empty state:** "Chưa có VĐV Việt Nam nào kết nối DUPR công khai. Bạn có thể là người đầu tiên — kết nối DUPR và bật profile công khai trong Settings."

#### 3.1.3 DUPR badge on Feed

Augment `FeedPostCard` + `FeedNewsCard`:
```tsx
<Avatar />
<div>
  <span>{post.author.full_name}</span>
  {post.author.dupr_doubles && (
    <DuprChip rating={post.author.dupr_doubles} format="doubles" />
  )}
</div>
```
`<DuprChip>` reuses `HeaderDuprBadge` styling — DRY.

#### 3.1.4 "Players near my rating" widget

Trên `/feed` + `/player/:id`:
```sql
CREATE FUNCTION public.dupr_players_near_rating(
  p_target_rating NUMERIC,
  p_window NUMERIC DEFAULT 0.3,
  p_exclude_user_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 10
) RETURNS SETOF profile_summary ...
```

UI: horizontal scroller, "Players within ±0.3 DUPR" → tap → `/player/:id`.

#### 3.1.5 Suggestions theo social-graph-ranker pattern

Áp dụng skill `social-graph-ranker` math:
```
B(candidate) = w_rating · gauss(|candidate_DUPR - me_DUPR|, σ=0.4)
             + w_geo    · same_city_bonus
             + w_mutual · mutual_followers_count
             + w_recent · recently_played_together
```

Edge function `dupr-friend-suggest` (new) — daily cron precompute top 10 cho mỗi active user, cache trong `feed_friend_suggestions`.

### 3.2 Layer B — Bracket Seeding

#### 3.2.1 Auto-seed adapter

**New util** `src/lib/dupr/seedFromDupr.ts`:
```ts
export async function fetchDuprSeeds(
  userIds: string[],
  format: 'singles' | 'doubles'
): Promise<Map<string, number | null>> {
  const { data } = await supabase
    .from('profiles')
    .select(`id, ${format === 'singles' ? 'dupr_singles' : 'dupr_doubles'}`)
    .in('id', userIds);
  return new Map(data.map(p => [p.id, p[`dupr_${format}`] ?? null]));
}

export function rankBySeed(
  players: Player[],
  seeds: Map<string, number | null>
): RankedPlayer[] {
  return [...players]
    .map(p => ({ ...p, dupr: seeds.get(p.id) ?? null }))
    .sort((a, b) => {
      // Players with DUPR rank first (descending), then alphabetical
      if (a.dupr != null && b.dupr == null) return -1;
      if (a.dupr == null && b.dupr != null) return 1;
      if (a.dupr != null && b.dupr != null) return b.dupr - a.dupr;
      return a.name.localeCompare(b.name);
    })
    .map((p, idx) => ({ ...p, seed: idx + 1 }));
}
```

#### 3.2.2 Wire vào QuickTable + Doubles-elim

`BracketSetupDialog.tsx` thêm toggle:
```tsx
<Switch
  label={t('Auto-seed by DUPR rating')}
  checked={autoSeed}
  onCheckedChange={async (v) => {
    setAutoSeed(v);
    if (v) {
      const seeds = await fetchDuprSeeds(playerIds, 'doubles');
      const ranked = rankBySeed(players, seeds);
      setSeededPlayers(ranked);
    }
  }}
/>
{autoSeed && (
  <SeedExplainerCard
    players={seededPlayers}
    coverage={seededPlayers.filter(p => p.dupr).length / seededPlayers.length}
  />
)}
```

**Coverage banner:** "8/12 players have DUPR. 4 sẽ seed cuối nhóm theo alphabetical."

#### 3.2.3 Snake distribution unchanged

`distributePlayersToGroups` đã đúng. Chỉ cần pass `seed` đã computed từ DUPR thay vì hỏi user.

#### 3.2.4 Re-seed flow

Sau khi confirm roster:
- Button "Re-seed by DUPR" → fetch lại + diff preview
- Confirm dialog: "Player X moves from Group A → Group B"

### 3.3 Layer C — Round-Robin / Mexicano

#### 3.3.1 Inject DUPR vào MMPlayer

`src/hooks/useMexicanoSchedule.ts` (new):
```ts
export function useMexicanoSchedule({ userIds, rounds, courtCount }) {
  const seeds = useDuprSeeds(userIds, 'doubles');
  const players: MMPlayer[] = userIds.map(id => ({
    id,
    name: nameMap.get(id) ?? 'Player',
    level: seeds.get(id) ?? null,
  }));
  return useMemo(
    () => generateSchedule({ players, rounds, courtCount, format: 'mexicano' }),
    [players, rounds, courtCount]
  );
}
```

Mexicano hiện tại đã rank theo `level` nếu có. Không thay đổi core logic.

#### 3.3.2 Combined-DUPR partner balance (doubles RR)

`src/lib/matchmaking/balancedDoubles.ts` (new):
```ts
// Given 4 players, return pairing that minimizes |sumA - sumB|
export function balancedPairing(
  p: [MMPlayer, MMPlayer, MMPlayer, MMPlayer]
): { teamA: [MMPlayer, MMPlayer]; teamB: [MMPlayer, MMPlayer]; fairness: number } {
  const options: [number, number][][] = [
    [[0,1],[2,3]], [[0,2],[1,3]], [[0,3],[1,2]],
  ];
  let best = options[0];
  let bestDiff = Infinity;
  for (const opt of options) {
    const sumA = (p[opt[0][0]].level ?? 0) + (p[opt[0][1]].level ?? 0);
    const sumB = (p[opt[1][0]].level ?? 0) + (p[opt[1][1]].level ?? 0);
    const diff = Math.abs(sumA - sumB);
    if (diff < bestDiff) { bestDiff = diff; best = opt; }
  }
  return {
    teamA: [p[best[0][0]], p[best[0][1]]],
    teamB: [p[best[1][0]], p[best[1][1]]],
    fairness: 1 - Math.min(bestDiff / 2, 1), // 1 = perfectly balanced
  };
}
```

Plug vào Mexicano khi tất cả 4 players của 1 court có DUPR.

#### 3.3.3 Fairness display

`<RoundFairnessCard>`:
```tsx
<Card>
  <h4>Round {round}</h4>
  <Progress value={avgFairness * 100} />
  <p>Avg DUPR diff per court: {avgDiff.toFixed(2)}</p>
</Card>
```

#### 3.3.4 DUPR-missing fallback

Nếu < 50% players có DUPR, default về random shuffle + banner "Most players have no DUPR — using random pairing. Connect DUPR for balanced matches."

---

## 4. Council review (4 voices)

Áp dụng ECC `council` skill — convene 4 advisors challenge proposal trước khi anh approve.

### 4.1 Architect (correctness, long-term)

> **Đồng ý ship Social trước.** Bracket/RR adapter là pure functions → testable in isolation. Schema additions (`username`, `is_public_profile`) là nullable, không break existing rows. RPC `dupr_leaderboard` cần materialized view hoặc proper index — partial `WHERE is_public_profile = true` đã propose là đúng.
>
> **Lo ngại:** `dupr_friend_suggest` cron precompute scale O(N²). Với ~1700 users hiện tại OK, nhưng nếu lên 50k cần on-demand RPC + cache layer.
>
> **Yêu cầu:** thêm migration `username` UNIQUE NULLS NOT DISTINCT (Postgres 15+) hoặc partial unique index, không default UUID slug — buộc user pick để encourage profile completion.

### 4.2 Skeptic (challenge premise)

> **Câu hỏi quan trọng:** thực sự 95% user Việt Nam có connect DUPR chưa? Nếu coverage < 30%, leaderboard sẽ trống lỏng và "auto-seed by DUPR" sẽ là banner failure 70% thời gian.
>
> **Đề xuất:** trước khi build, query `SELECT COUNT(*) FILTER (WHERE dupr_id IS NOT NULL)::float / COUNT(*) FROM profiles` — nếu < 25%, ưu tiên Onboarding nudge thay vì Social UI.
>
> **Cảnh báo:** "Players near my rating" có thể tạo creepy stalking vibe. Default privacy = OFF, opt-in mới hiện trong widget. Skip notification "X người gần rating của bạn ở Đà Nẵng" — sai signal.

### 4.3 Pragmatist (ship fast, user impact)

> **Ship Layer A (Social) trong 1 week** — value visible ngay (profile + leaderboard + chip). Reuse `HeaderDuprBadge`, không cần design system mới.
>
> **Layer B (Bracket) tuần 2** — value chỉ thấy khi có tournament. QuickTable đã có 100+ tables / tháng → impact real.
>
> **Layer C (RR matching) tuần 3-4** — complexity cao nhất. Combined-DUPR balance là nice-to-have, không phải must-have. Pragma: ship Mexicano level injection (1h work) trước, balance algo sau.
>
> **Skip:** social-graph friend suggest cron. Build khi có ≥ 5000 active connected users. Hiện tại YAGNI.

### 4.4 Critic (edge cases, failure modes)

> **Edge cases chưa đề cập:**
> 1. **Stale DUPR:** `dupr_synced_at` > 30 days → seed có thể sai. Cần badge "DUPR 4.12 (synced 45d ago)" + warn khi auto-seed dùng stale data.
> 2. **Webhook duplicate:** `dupr_webhook_events` không có unique constraint trên `(client_id, timestamp, dupr_id)`. Spam webhook → spam history rows.
> 3. **Privacy leak:** `dupr_leaderboard` RPC có whitelist column? Đảm bảo không trả `email`, `phone`, `dupr_last_error`.
> 4. **i18n:** "Seed #3 = avg DUPR 4.12" — tiếng Việt là "Hạt giống #3 = DUPR trung bình 4.12"? Cần Vietnamese pickleball glossary check.
> 5. **GDPR/PDPL:** public profile mặc dù opt-in vẫn cần explicit consent + right-to-delete flow → leverage `delete-account` đã có.
> 6. **Rate limit DUPR partner API:** `dupr-friend-suggest` cron nếu chạy daily cho 1700 users x batch search có thể vượt quota. Cần `subscription-info-limits-and-usage` check trước.

---

## 5. Roadmap (3 sprints, prioritized)

### Sprint A — REVISED scope sau audit 2026-05-27 (chỉ build cái thật sự thiếu)

**Bỏ khỏi Sprint A (đã có production):** PlayerProfile page, SSR renderPlayer, hooks social, profile schema base, sitemap-players file, FeedMatchCard DUPR chip, onboarding flow base.

| # | Task | Files | Risk |
|---|---|---|---|
| A1 | Migration: `profiles.is_public_profile BOOLEAN NOT NULL DEFAULT false` + backfill (xem decision dưới) | `supabase/migrations/20260528000000_profiles_is_public_profile.sql` | **High** — backfill chính sách quyết định SEO impact |
| A2 | Update `usePlayerProfile` hook + SSR `renderPlayer` (line 1325) filter `is_public_profile = true` | `src/hooks/social/usePlayerProfile.ts`, `functions/_lib/render/index.ts` | Med |
| A3 | Account page: opt-in toggle "Hiển thị profile công khai" + preview link | `src/pages/Account.tsx`, `src/components/account/PublicProfileToggle.tsx` (mới) | Med (i18n + consent copy) |
| A4 | Update `sitemap-players.xml.ts` filter `is_public_profile = true` + re-enable trong sitemap index | `functions/sitemap-players.xml.ts`, `functions/sitemap.xml.ts` | Low |
| A5 | Onboarding `ProfileSetup`: thay auto-username slug bằng user-pick input (validate uniqueness real-time, suggest từ display_name) | `src/components/onboarding/steps/ProfileSetup.tsx` | Med |
| A6 | RPC `dupr_leaderboard_vietnam(format, gender, age_bracket, limit)` whitelist columns | `supabase/migrations/20260528010000_dupr_leaderboard_vietnam_rpc.sql` | Low |
| A7 | Update `dupr-rankings.ts` thêm `"vietnam"` vào `DuprScope` union + scope meta + group `"national"` | `src/content/dupr-rankings.ts` | Low |
| A8 | Hook `useVietnamRankings(format, gender, ageBracket)` wrap RPC | `src/hooks/dupr/useVietnamRankings.ts` | Low |
| A9 | Augment `Rankings.tsx`: render `"vietnam"` scope from hook (vs static const) | `src/pages/Rankings.tsx` | Med |
| A10 | Augment SSR `renderRankings` (`functions/_lib/render/index.ts:1132`) — khi scope=vietnam đọc Supabase service-role | `functions/_lib/render/index.ts` | Med |
| A11 | RPC `dupr_players_near_rating(target, window, exclude, limit)` | `supabase/migrations/20260528020000_dupr_near_rating_rpc.sql` | Low |
| A12 | Component `<PlayersNearRating>` (dùng trên PlayerProfile sidebar + Feed) | `src/components/social/PlayersNearRating.tsx` (mới) | Low |
| A13 | Augment `FeedBlogCard`, `FeedNewsCard` — show author DUPR chip nếu có | `src/components/social/feed/FeedBlogCard.tsx`, `FeedNewsCard.tsx` | Low |
| A14 | Component `<DuprChip>` (extract pattern từ `HeaderDuprBadge`, reuse cho A12 + A13) | `src/components/dupr/DuprChip.tsx` (mới) | Low |
| A15 | Pre-flight SQL: coverage % connected DUPR users + count public-ready profiles | run via supabase CLI | Low |
| A16 | Blog post bilingual: announce Vietnam leaderboard + opt-in profile feature | `src/content/blog/posts/...` | Low |

**DoD Sprint A:** (1) Vietnam scope tại `/rankings` hiện top-100 VN consented users với filter mens/womens/age, (2) PlayerProfile gated theo `is_public_profile=true`, (3) Account page có opt-in toggle hoạt động, (4) Onboarding buộc user pick username + check uniqueness real-time, (5) Sitemap chỉ emit public profiles, (6) Feed Blog/News có DUPR chip author byline, (7) `<PlayersNearRating>` hoạt động trên PlayerProfile.

**Critical decision A1 (Cuong cần chốt trước khi em viết migration):**
- **Option a:** `is_public_profile DEFAULT false` + backfill `true` cho users có `onboarding_completed_at IS NOT NULL` → giữ SEO + indexed pages, default opt-OUT cho user mới.
- **Option b:** `is_public_profile DEFAULT false` + KHÔNG backfill → strict opt-in cho mọi user, rớt indexed pages cũ (Google sẽ deindex `/nguoi-choi/*` cũ).
- **Option c:** `is_public_profile DEFAULT false` + backfill conditional `true` chỉ cho users có `dupr_id IS NOT NULL` → reward connected users, opt-in cho rest.
- **Em recommend Option a** — giữ SEO/indexed pages hiện tại, banner thông báo "Profile của bạn đang công khai. Bạn có thể tắt tại Account → Privacy".

### Sprint B — Bracket seeding (Week 2, ~2-3 days)

| Task | Files |
|---|---|
| Util `seedFromDupr.ts` (fetchDuprSeeds + rankBySeed) | `src/lib/dupr/seedFromDupr.ts` + tests |
| Augment `BracketSetupDialog.tsx` — toggle Auto-seed by DUPR | `src/components/quicktable/BracketSetupDialog.tsx` |
| Component `<SeedExplainerCard>` | `src/components/dupr/SeedExplainerCard.tsx` |
| Augment `DoublesEliminationSetup` (nếu có) | `src/components/...` |
| Re-seed button + diff preview | `src/components/dupr/ReseedDialog.tsx` |
| Edge case: stale DUPR badge (`dupr_synced_at` > 30d) | `src/components/dupr/DuprChip.tsx` (`stale` prop) |
| Tests: `seedFromDupr.test.ts` covering missing DUPR, ties, NULL | `src/lib/dupr/__tests__/seedFromDupr.test.ts` |

**DoD Sprint B:** organizer create 16-player bracket, click "Auto-seed by DUPR", thấy snake distribution chính xác, coverage banner đúng, re-seed sau roster change diff đúng.

### Sprint C — RR / Mexicano matching (Week 3-4, ~4-5 days)

| Task | Files |
|---|---|
| Hook `useDuprSeeds(userIds, format)` shared | `src/hooks/dupr/useDuprSeeds.ts` |
| Hook `useMexicanoSchedule` inject DUPR levels | `src/hooks/useMexicanoSchedule.ts` |
| Util `balancedPairing` (4-player combined-DUPR balance) | `src/lib/matchmaking/balancedDoubles.ts` + tests |
| Plug `balancedPairing` vào Mexicano sub-router (chỉ khi 4/4 có DUPR) | `src/lib/matchmaking/index.ts` |
| Component `<RoundFairnessCard>` | `src/components/matchmaking/RoundFairnessCard.tsx` |
| Fallback banner "Most players no DUPR — using random pairing" | `src/components/matchmaking/CoverageBanner.tsx` |
| Settings: Mexicano "prefer balanced pairing" toggle (default ON) | `src/pages/quickTable/Settings.tsx` |
| Tests: balanced pairing edge cases (NULLs, all equal, lopsided) | `src/lib/matchmaking/__tests__/balancedDoubles.test.ts` |

**DoD Sprint C:** Mexicano 8-player + 12-player schedules với DUPR injected, fairness display correct, NULL coverage gracefully fallback.

### Sprint D — Polish + analytics (deferred, optional)

- DUPR-aware follow suggestions (cron `dupr-friend-suggest`) — chỉ khi connected users > 5k
- Notification "DUPR rating went up +0.08 after last match" (push)
- DUPR delta preview on match-score-entry screen
- GA4 event tracking `dupr_seed_used`, `dupr_chip_clicked`, `leaderboard_filter_applied`

---

## 6. Risks + mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Coverage DUPR < 30% → Social + Bracket UX nghèo | Medium | High | Query trước Sprint A. Nếu thấp, run pre-launch onboarding nudge campaign 2 tuần. |
| DUPR partnership UAT thay đổi schema | Low | High | Mọi field parse trong `_shared/dupr-client.ts` defensive `??`, không break nếu DUPR thêm field. |
| Privacy backlash khi launch public profile | Medium | Med | Default OFF, opt-in modal có preview, blog post bilingual giải thích. |
| Stale DUPR seed gây bracket unfair | Med | Med | Badge "synced 45d ago", warn dialog khi auto-seed dùng > 50% stale. |
| Webhook spam ratings | Low | Low | Add unique index `(client_id, dupr_id, message->>'matchId')` lên `dupr_webhook_events`. |
| Rate limit DUPR partner API | Med | Med | Cache aggressive (entitlements 24h, clubs 24h, user-search 5min), pre-flight `subscription-info-limits-and-usage`. |

---

## 7. Locked decisions (Cuong, 2026-05-27)

| # | Question | Decision |
|---|---|---|
| 1 | Thứ tự sprint | **Social trước** (Sprint A) |
| 2 | Username convention | **Buộc user pick** (modal first-load, không auto-generate) |
| 3 | Public profile default | **Opt-in** (default OFF) |
| 4 | Leaderboard scope | **Augment `/rankings` thêm scope "Vietnam"** (KHÔNG tạo `/leaderboard` mới) |
| 5 | Mexicano balance | **Smart default** (ON khi coverage > 50%, banner khi thấp hơn) |
| 6 | DUPR Partnership status | **OK — proceed** |

Open follow-ups Cuong cần confirm sớm:
- **Coverage query** — em sẽ chạy `SELECT COUNT(*) FILTER (WHERE dupr_id IS NOT NULL)::float / NULLIF(COUNT(*),0) FROM profiles` ngay khi anh approve Sprint A để biết tỉ lệ user đã connect DUPR. Nếu < 5%, Sprint A vẫn ship nhưng leaderboard sẽ có copy "Be the first" thay vì gating launch.
- **`profiles.gender` migration** — hiện tại schema chưa có. Sprint A cần ADD COLUMN nullable + onboarding flow xin gender (cần cho mens/womens filter của leaderboard).
- **`profiles.country`** — default 'VN' OK nhưng cần check trùng tên cũ không (em sẽ verify).

---

## 8. Skills used (audit trail)

Theo ECC `architecture-decision-records` skill, ghi lại skills consulted:

- **`product-lens`** — validate "why before build" via Mode 1 Diagnostic. Anti-goal: KHÔNG build full social network, chỉ surface DUPR trên primitive social moments.
- **`council`** — 4-voice review (Section 4). Architect approved, Skeptic flagged coverage risk, Pragmatist sized sprints, Critic listed 6 edge cases.
- **`api-design`** — RPC naming `dupr_leaderboard`, `dupr_players_near_rating` follow snake_case + verb-less pattern.
- **`frontend-patterns`** — hook composition (`useDuprSeeds` reusable across Bracket + RR + Mexicano).
- **`make-interfaces-feel-better`** — DuprChip optical alignment (rating number `tabular-nums`), SeedExplainerCard layered shadow not flat.
- **`database-migrations`** — all schema additions nullable + concurrent indexes, separate schema vs data migrations.
- **`frontend-a11y`** — leaderboard rows semantic `<table>`, `<DuprChip>` has `aria-label="DUPR doubles rating 4.32"`.
- **`social-graph-ranker`** — math formula áp dụng cho friend-suggest (Section 3.1.5).
- **`security-review`** — RPC column whitelist (no email/phone leak), RLS on `dupr_user_tokens` strict per Critic point 3.

---

## 9. Next action

**Em cần Cuong:**
1. Trả lời 6 open questions (Section 7).
2. Approve roadmap thứ tự Sprint A → B → C.
3. Confirm anh muốn em start Sprint A ngay (build migration + RPC + PlayerProfile page) trong cùng cowork session, hay chỉ dừng ở proposal này.

**Sau khi anh approve:** em sẽ chuyển sang implementation, viết migration files thực, viết PR draft, test với `npm run test`, lint, push branch `feat/dupr-social-layer-a` để Cloudflare deploy preview URL.
