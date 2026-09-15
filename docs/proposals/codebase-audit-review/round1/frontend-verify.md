# Fact-check vòng 1 — Frontend/UI claims (agent Explore, verbatim)

## CLAIM B1 — PARTIAL (denominator wrong, direction right)
```
find src/pages -name '*.tsx' ! -name '*.legacy.tsx' | wc -l        → 113
grep -rl 'isError' --include='*.tsx' src/pages | wc -l             → 7
grep -rl 'PageStates' --include='*.tsx' src/pages | wc -l          → 4
```
No `.legacy.tsx` files exist in `src/pages` (113 either way). So it's **7 of 113**, not 8 of 81. Canonical component confirmed: `src/components/states/PageStates.tsx:49` exports `ErrorState({ onRetry })`. DS-04 is real and documented (`docs/state-patterns.md:1`, `docs/roadmap-8.5-9.md:160`). Only 4 pages import it: `ClubLanding.tsx:19`, `SocialEventDetail.tsx:20`, `ViBlogPost.tsx:4` (uses `error`, not `isError`), plus one more via `PageStates`. Core finding stands, ratio is worse than claimed (6%, not 10%).

## CLAIM B2 — TRUE, all three
- `Live.tsx`: `src/pages/Live.tsx:100-102` destructures only `data`/`isLoading` with `= []` defaults. Hook `src/hooks/useLivestreamData.ts:41` does `if (error) throw error;` → on network failure `data` is undefined → `= []` → line 195 renders `items.length === 0` branch: "Không có trận trong mục này." Error is invisible.
- `News.tsx`: `src/pages/News.tsx:40` same pattern (`data: news = []`, no `isError`). Hook `src/hooks/useNewsItems.ts:41` throws. Renders "Không có tin trong mục này." at line 130.
- `TournamentDetail.tsx`: `src/pages/TournamentDetail.tsx:15` takes only `data`+`isLoading`. Hook `src/hooks/useTournamentData.ts:46` does `.single()` then `throw error`. Line 72 `if (!tournament)` renders `t.errors.notFound` = "Không tìm thấy trang" / "Page not found" (`src/i18n/vi.ts:3658`). A dead network is indistinguishable from a deleted tournament.

## CLAIM B3 — TRUE (undercounted)
```
grep -rEo 'language === "vi"' --include='*.ts' --include='*.tsx' src | wc -l   → 1067
grep -rEo "language === 'vi'"  --include='*.ts' --include='*.tsx' src | wc -l  →  619
                                                                combined → 1686
grep -rEo '\bt\.[a-zA-Z][a-zA-Z0-9_]*' --include='*.ts' --include='*.tsx' src | wc -l → 2010
```
Claimed 1017 ≈ the double-quoted subset (1067); true total is 1686. `t.` usage is 2010, not 991. Split-brain is worse than reported.

## CLAIM B4 — TRUE
```
find src \( -name '*.ts' -o -name '*.tsx' \) ! -name 'types.ts' | xargs wc -l | awk '$1>500 && $2!="total"' | wc -l → 81  (including types.ts → 82)
wc -l src/components/layout/TheLineLayout.tsx → 1154
```
Worst offenders: `types.ts` 9277, `src/i18n/vi.ts` 6037, `src/content/dupr-rankings.ts` 4360, `src/i18n/en.ts` 3051, `src/pages/admin/AdminDuprDashboard.tsx` 1727.

## CLAIM B5 — TRUE (files undercounted)
```
grep -rc 'invalidateQueries' … | sum → 294
grep -rl 'invalidateQueries' … | wc -l → 75
grep -rn 'queryKeys\|queryKeyFactory\|QUERY_KEYS' src → (no matches)
```
No key factory module exists. `"feed"` root hand-typed in 7 separate hook files: `useFollowingFeed.ts:89`, `useFeedNews.ts:60`, `useFeedHighlights.ts:33`, `useTrendingFeed.ts:46`, `useFeedEmbeds.ts:33`, `useFeedTimeline.ts:118`, `useFeedHappenings.ts:51` — plus pages invalidating it directly (`src/pages/admin/ProTourAdmin.tsx:225,228,231,503,506,512`, `src/pages/admin/AdminEmbeds.tsx:96`). 294 is exact; spread is 75 files, not 11.

## CLAIM B6 — TRUE
```
grep -rEo 'style=\{\{' --include='*.tsx' src | wc -l → 4222
```
4222 vs claimed 4219 — within rounding.

## CLAIM B7 — FALSE
Both tables exist in migrations AND in types.ts:
- `supabase/migrations/20260301120755_ec315411-*.sql:3` → CREATE TABLE public.audit_logs
- `supabase/migrations/20260305141227_a693882b-*.sql:3` → create table content_reports
- `src/integrations/supabase/types.ts:56` → audit_logs; `:876` → content_reports
Staleness claim refuted for both named tables.

## CLAIM B8 — TRUE
```
find src \( -name '*.ts' -o -name '*.tsx' \) | wc -l        → 839
… | xargs wc -l                                             → 201383 total
find src/pages -name '*.tsx' | wc -l                        → 113
```

## Summary
B2, B4, B6, B8 clean TRUE. B3 và B5 TRUE nhưng report ĐẾM THIẾU (1686 chứ không phải 1017; 75 file chứ không phải 11). B1 PARTIAL — đúng vấn đề, sai mẫu số (7/113). B7 FALSE — cả 2 bảng đều có trong types.ts.
