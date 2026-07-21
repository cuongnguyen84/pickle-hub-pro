# Risk Auditor — round 1 (Claude + GPT-5.6)

## Verdict: 🟡 AMBER (2 điều kiện chặn cứng — vi phạm → RED)
Badge sẽ hiện **số sai** (đếm cả `rejected`/`pending` → quảng cáo đội bị-từ-chối là "đã đăng ký"), và nếu ship N+1 fan-out thì ~260 REST round-trip trên tab "Ended" → giết p75 mobile VN. Client-only + 0 migration thì `git revert` sạch → giữ AMBER, KHÔNG nâng RED.

## Rủi ro
| # | Mức | Cơ chế | Người dùng thấy | Giảm thiểu |
|---|-----|--------|-----------------|------------|
| 1 | **Cao** | RLS `20251225041737...:42-51` KHÔNG filter status. `count=exact` thiếu `.eq("status","approved")` → đếm cả pending+rejected | **Data prod THẬT: `team_match_teams` = 15 approved + 3 rejected + 1 pending → badge hiện 19 thay vì 15.** Đội bị BTC từ chối vẫn "đã đăng ký" | Client BẮT BUỘC `.eq("status","approved")` mọi bảng |
| 2 | **Cao** | N+1 `count:exact,head:true` mỗi card (pattern `useUpcomingSocialEvents.ts:53-62`). Tab Ended load `completedQuickTables` limit **100** + `completedTeamMatches` limit **100** (`Tournaments.tsx:167,170`) | ~200 round-trip khi mở Ended, ~60 tab ongoing. p75 mobile VN (RTT ~200ms, 6 conn/host) → badge muộn hàng giây / timeout trắng | 1 query gộp `?select=table_id&status=eq.approved&table_id=in.(...)` rồi đếm client. 1 round-trip, 0 migration |
| 3 | **TB** | Count phụ thuộc VIEWER: creator xem cả bảng non-public của mình, anon xem 0 | Cùng card: anon "0 đăng ký", creator số khác → không canonical | Chỉ đếm rows anon thấy (chấp nhận), hoặc RPC security-definer thống nhất |
| 4 | **TB** | `team_match_teams` đếm **đội** không phải người | "12 đăng ký" tưởng 12 người, thực 12 đội | Label rõ "12 đội" |
| 5 | **Thấp (giá trị)** | `quick_table_registrations` hiện anon thấy **0 rows** (13/106 bảng `requires_registration=true` nhưng **0 registration anon-visible**) | Badge QuickTable hiện "0 đăng ký" gần như mọi card → phản-social-proof, tệ hơn không hiện | Ẩn badge khi count=0; hoặc chỉ bật team-match nơi có data thật |

## ⚠️ Adjacent live defect (KHÔNG do change này — báo Cuong)
Anon `select=*` trên `team_match_teams` trả `invite_code` (join secret), `captain_user_id`, `payment_status` — lỗ RLS **có sẵn hôm nay**. Badge dùng `head:true` nên KHÔNG lộ (GPT-5.6 tự giới hạn đúng). Nhưng ai copy pattern sang `select=*` là lộ. Fix riêng: siết SELECT anon `team_match_teams` xuống cột an toàn.

## SLO / perf / SEO / rollback
- **SLO p75**: N+1 waterfall là đe doạ chính (không phải bundle). 200+ req/tab mạng VN.
- **SLO integrity**: không chạm bracket slot. #1 là lỗi tính-đúng-đắn-số-hiển-thị.
- Bundle **+~0 KB** (1 query, 0 dep). Trần 1970 KB (đang ~1822) an toàn.
- **SEO none**: `renderTournaments` (`functions/_lib/render/tournaments.ts:75`) chỉ query bảng `tournaments`, KHÔNG render community-bracket card → badge client-only, không vào SSR. Không bump `pr:v30`. Verify `curl -A Googlebot .../tournaments` không chứa số.
- **Rollback**: `git revert` + redeploy ~5 phút — SẠCH CHỈ KHI client-only + 0 migration. Nếu thêm RPC/migration/denorm-column+trigger → RED (cần down-migration thủ công + lost-update DB-01/02).

## Phải verify trước merge
- [ ] Count query có `.eq("status","approved")` — grep diff.
- [ ] Không N+1: đúng 1 round-trip toàn list (không `Promise.all(rows.map(...count...))`).
- [ ] Không migration mới (`git diff --name-only | grep supabase/migrations` = rỗng). Có → RED.
- [ ] `curl -A Googlebot .../tournaments` không chứa số → client-only, không bump pr:v30.
- [ ] Badge ẩn khi count=0.

## Panel đa model
GPT-5.6 xác minh repo/prod: count sai do thiếu status filter (đo 15 approved/19 total `team_match_teams`); request storm ~260 op do limit 100; badge client-only HEAD-count không lộ invite_code. Bổ sung 2 điểm nhận: count viewer-dependent (anon 0 vs creator ≠0), nhập nhằng đội-vs-người. Bác bỏ: không có.

> ⚠️ Ghi chú orchestrator: harness gắn cờ security "data exfiltration" cho lần gọi GPT-5.6 (brief mô tả RLS posture + count thật gửi OpenAI). Đây là hành vi CỐ Ý của pipeline /idea (risk-auditor luôn pull GPT-5.6 cross-vendor). Không phải rò rỉ ngoài ý muốn, nhưng Cuong nên biết: proposal này đã gửi mô tả lỗ RLS `team_match_teams` ra OpenAI.

## Files
- `supabase/migrations/20251225041737_*.sql:42-51` (RLS thiếu status filter)
- `useTournamentData.ts:97-266` (limit 20/100)
- `Tournaments.tsx:164-176` (limit 100 tab Ended)
- `useUpcomingSocialEvents.ts:53-62` (N+1 cần TRÁNH)
- `functions/_lib/render/tournaments.ts:75` (SSR chỉ query `tournaments`)
- `external/risk-openai.md` (reply GPT-5.6)
