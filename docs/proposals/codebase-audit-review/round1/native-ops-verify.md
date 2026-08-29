# Fact-check vòng 1 — Native + Ops/CI claims (agent Explore, verbatim)

## C1 — PARTIAL (cả 3 vế TRUE; framing "ship blocker" nói quá)
- RPC call: `apple/ThePickleHub/Core/Chat/ChatRepository.swift:113` — `client.rpc("update_chat_nickname", …)` trong `updateDisplayName` (line 110).
- Migration untracked: `?? supabase/migrations/20260801111500_atomic_chat_nickname_update.sql` (cả `?? 20260801070000_news_rewrite_retry_policy.sql`).
- types.ts: zero hit `update_chat_nickname` (working tree lẫn HEAD).
- Bằng chứng đã áp prod: không có. Không doc nào nhắc RPC này; migration-drift.yml chạy lần cuối 28/07 và đang fail nên không có tín hiệu drift.
- Vì sao "ship blocker" nói quá: **`updateDisplayName` KHÔNG tồn tại ở HEAD** — cả caller Swift lẫn migration đều là working-tree change chưa commit, nên chưa có gì shippable tham chiếu RPC thiếu. Rủi ro thật: commit vế Swift mà không có vế SQL.

## C2 — TRUE
`apple/ThePickleHub/Features/Live/VideoPlayerScreen.swift`: một `AVPlayer` (line 88-89) đưa vào HAI `AVPlayerControllerView` — inline line 72 và trong `.fullScreenCover` line 52. fullScreenCover không unmount view trình bày → 2 AVPlayerViewController sống cùng lúc, mỗi cái (lines 135-137) bật `allowsPictureInPicturePlayback`, `canStartPictureInPictureAutomaticallyFromInline`, `updatesNowPlayingInfoCenter`. Đúng pattern blank-layer/PiP-conflict.

## C3 — TRUE (4 repository, 18 call site)
- `ToolsRepository.swift` — 6 (68, 130, 152, 213, 231, 244; trả `[]`/`[:]`)
- `ChatRepository.swift` — 7 (28, 43, 55, 69, 79, 88, 105)
- `CommunityRepository.swift` — 4 (80, 118, 143, 177; đều `return []`)
- `ClubRepository.swift` — 1 (63)
`assertionFailure` no-op trên Release → lỗi mạng thành data rỗng. Confirmed.

## C4 — FALSE (đúng dạng, số lệch ~2x)
`Localizable.xcstrings` working tree: 1851 key tổng, **1764** key EN state `needs_review`, **86** key không có/rỗng EN. HEAD: 1841/1764/76. Histogram: needs_review 1764, new 65, translated 2. Số claim ~851 và ~34 không khớp bất kỳ lát cắt nào — thực tế TỆ HƠN ~2x.

## C5 — PARTIAL (config TRUE, quan hệ nhân quả FALSE)
- Threshold: `vite.config.ts:377-379` → `thresholds: { statements: 83 }`, comment lock baseline 86.9% từ 2026-05-29.
- Coverage thực KHÔNG phải ~75%: run quality.yml thành công gần nhất trên main (04/08): `Statements : 85.92% (3247/3779)` — trên 83 thoải mái.
- "Đỏ kinh niên" đúng về thống kê thô (30 run gần nhất: 18 fail / 6 pass / 6 cancelled) nhưng KHÔNG phải do threshold: các step fail sample được là `Install deps` (dependabot eslint 10) và unit test fail vì **assertion** (run 30802285365: `Tests 4 failed | 1309 passed`, `posts missing from all.ts`, `descriptions that ship ellipsised`). Không tìm thấy lần fail nào do coverage-threshold.

## C6 — TRUE
Budget ở `.github/workflows/quality.yml:97` (`BUNDLE_BUDGET_KB: "1970"`) + default `scripts/check-bundle-size.mjs:38`. Lịch sử:

| Ngày | Commit | Giá trị | Message |
|---|---|---|---|
| 2026-05-29 | cc89995a | 1800 | ci(phase-3) bundle-size |
| 2026-05-30 | 65660150 | 1850 | lock baselines |
| 2026-06-29 | 39ef9984 | 1900 | feat(seo) /san/ |
| 2026-07-06 | 19a6777d | 1950 | "to unblock merges" |
| 2026-07-16 | f74e64df | 1970 | "creep hit the ceiling, blocking unrelated PRs" |

Dòng hiện tại tự thú: `# bumped from 1950 …; PERF-01 must set a real budget`. Arc 1850→1970 đúng, còn sót 2 bước trung gian.

## C7 — FALSE
16 workflow trong `.github/workflows/`. **8 workflow có cron đang BẬT**: dupr-refresh, edge-auth-parity, lighthouse, migration-drift, milestone-due, security, theline-audit, uptime-ping. Đúng MỘT workflow bị tắt schedule — `dupr-canary.yml:15-21` — và trạng thái ĐƯỢC ghi trong repo kèm ngày + lý do (UAT fixtures thiếu BASIC_L1). Thêm nữa `docs/cron-schedules.md` track đủ 12 pg_cron schedule kèm bảng "Inactive / removed". Vế "recorded nowhere" bị 2 file phản chứng.

## C8 — TRUE
230 file Swift, 47.820 dòng (~48k); 323 migration trên đĩa (321 tracked + 2 untracked từ C1).

## C9 — PARTIAL
- Untracked confirmed: `?? scripts/seo/.index_coverage.sqlite` (40KB, mtime 03/08), không gitignore.
- Vế "được tham chiếu như state cần thiết": yếu. Không file tracked nào tham chiếu; chỉ được nhắc trong `docs/proposals/seo-followup-checklist-v2/` (chính nó untracked) và mô tả một script `index_coverage.py` CHƯA tồn tại.
