# DUPR Integration — Memory / Handoff Notes

**Last updated:** 2026-05-28
**Purpose:** Continuity file để bắt đầu conversation mới mà không mất context. Tổng hợp toàn bộ DUPR integration (Sprint A/B/C) + SEO sprints đã ship lên production.

> Đọc file này + `CLAUDE.md` + `docs/dupr-integration-roadmap.md` + `docs/seo-audit-2026-05-28.md` là đủ context để tiếp tục.

---

## 0. Trạng thái tổng quan

| Sprint | Scope | Status | Branch → main |
|---|---|---|---|
| **A** | Social: Vietnam Rankings + PlayerProfile gate + opt-in + onboarding username + PlayersNearRating + DuprChip | ✅ LIVE | merged |
| **B** | Quick Tables: rating_source enum + DUPR enforcement + auto-seed bracket | ✅ LIVE | merged |
| **C** | Mexicano DUPR-balanced pairing + RoundFairnessCard | ✅ LIVE | merged |
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
