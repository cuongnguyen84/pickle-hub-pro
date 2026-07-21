# Rủi ro — Codex review follow-up (telemetry D5 + progress bar + capacity residual)

Agent: `risk-auditor` · 2026-07-21 · read-only. Mọi claim load-bearing đã tự kiểm chứng trong repo.

## Verdict: 🟡 AMBER (P2 + P3) — nhưng 🔴 RED nếu gói kèm migration P1

Kết cục tệ nhất hiện thực: sửa telemetry nửa vời → **D5 đo ra một con số funnel SAI** (join gãy hoặc trộn 2 luồng), Cuong quyết continue-or-close guest-path 02/08 dựa trên số rác. Đo sai tệ hơn không đo.

Classifier said: **RED** · Lý do RED **chỉ** đến từ 1 file: `supabase/migrations/<new>.sql` (migration = không git-revert được). Bỏ P1 ra khỏi gói → 5 file còn lại đều AMBER (app source + 1 hook shared). **Em không hạ RED của migration; em khuyến nghị KHÔNG đưa migration vào gói này** (xem P1). Nếu vẫn làm P1 → toàn PR là RED, cần Cuong duyệt tay.

## Rủi ro cụ thể

| # | Mức | Cơ chế hỏng | Người dùng / Cuong thấy gì | Giảm thiểu |
|---|-----|-------------|----------------------------|------------|
| 1 | **Cao** | Đổi JourneyKind KHÔNG tự sửa re-mint. `startJourney` (`journeys.ts:44`) luôn mint mới; effect `RegistrationForm.tsx:208` gọi vô điều kiện. Đổi tên kind vẫn A→B. | `auth_wall_viewed(A)` không join `registration_complete(B)` → funnel D5 vẫn gãy sau khi tưởng đã fix | Fix caller: **start-if-absent theo tableId** (resume), không chỉ sửa dep array |
| 2 | **Cao** | OAuth (`Login.tsx:127`, `AuthCallback.tsx`) là **document load thật** → unmount+remount màn đăng ký. Effect keyed `[tableId]` vẫn chạy lại lúc mount → `startJourney` vô điều kiện đè id đã sống trong sessionStorage | Với user login bằng Google/Apple (đa số VN), join vẫn gãy dù đã bỏ `user?.id` khỏi deps | startJourney phải **đọc id hiện có cho tableId này trước khi mint**; chỉ mint khi vắng hoặc khác tableId |
| 3 | **Cao** | `player_registration` JourneyKind DÙNG CHUNG sessionStorage key với Social Event modal (`RegistrationModal.tsx:282` vs `RegistrationForm.tsx:209`). Nếu fix bằng "guard đừng mint nếu đang active" trên key CHUNG → id Social Event bỏ dở (`S`) chặn QuickTable mint id mới; QuickTable bắn `auth_wall_viewed(S)`, `completeJourney` xoá `S` phá luôn journey Social Event | Trộn 2 funnel khác contract vào 1 journey_id → cả D5 lẫn north-star player đều nhiễu | **Tách kind riêng** `quicktable_registration` — an toàn vì `kind` KHÔNG phải GA4 dimension (emit `journeys.ts:65` chỉ gửi `journey_id`+event name). Dashboard cũ đọc theo EVENT NAME, không đọc kind → 0 ảnh hưởng |
| 4 | **TB** | P2 progress bar `OpenRegistrationSection.tsx:59` `width:'25%'` nằm trong component **KHÔNG được render ở đâu** (home đã bỏ nó ở `ae641d93`; `/tournaments` render card riêng, chỉ text `{player_count} players`, không có bar) | Sửa xong = 0 thay đổi user thấy. Công vô ích | Xác nhận surface thật trước khi làm; nếu muốn hiện count thật → là feature MỚI trên `Tournaments.tsx`, không phải "sửa hardcode" |
| 5 | **TB** | Nếu thêm count-query vào `useOpenRegistrationTables`: hook `useTournamentData.ts` `if (error) throw error` → query lỗi làm **sập cả danh sách giải**, không chỉ mất bar. `quick_table_registrations` không có `GRANT SELECT ... TO anon` tường minh trong migration (RLS ≠ GRANT — lessons-learned) | Anon vào `/tournaments`: hoặc bar ra 0% giả (nếu anon không đọc được), hoặc `permission denied` làm trắng list | Verify GRANT trên prod trước; count phải **1 aggregate** không phải N query/20 table; đặt count ở query TÁCH BIỆT để lỗi count không giết list |
| 6 | **Thấp→TB** | P1: status re-check-after-lock KHÔNG đóng hết race. `close_doubles_elimination_registration` (`20260529120000:215`) **không lấy** `pg_advisory_xact_lock` → close vẫn chạy song song với register đang giữ lock. Fix 2 dòng chỉ giảm cửa sổ, không guarantee | 1 đội `seed=NULL`, vắng 1 pass bracket-gen — hồi phục được bằng chạy lại gán seed | Đóng thật cần lock cả `close` + `cancel` → migration rộng hơn = rủi ro hơn phần thưởng. **Khuyến nghị bỏ P1** |
| 7 | **Thấp** | Native (/apple) 0 telemetry (`.swift` grep 0 match journey/analytics). D5 web-only | Nếu chạm UI thêm CTA web mà không đo native, kết luận D5 lệch — user native có thể hành xử khác (auth state, deep-link, OAuth friction) | D5 phải dán nhãn "QuickTable singles, web instrumented sessions", KHÔNG suy ra funnel toàn sản phẩm |

## SLO bị đe doạ
- **SLO 3 (Registration 99%)**: CHỈ nếu ship P1 migration. `CREATE OR REPLACE` hỏng thân hàm → mọi đăng ký doubles-elimination 500. Đây là lý do downside migration > residual nó vá.
- **SLO 1 (Availability `/`, list)**: rủi ro #5 — count-query lỗi kéo sập danh sách `/tournaments`.
- SLO 2/4/5/6/7: không chạm.
- **Không phải SLO nhưng là mục tiêu của cả task**: tính đúng đắn của D5 — số funnel sai dẫn quyết định sản phẩm sai. Không nằm trong 7 SLO nhưng là rủi ro chính.

## Ngân sách hiệu năng
- Bundle: P3 tái dùng `journeys.ts` (thêm 1 string kind + tách effect) ~+0.1 KB; P2 count-query 0 KB JS. Tổng **~1822 / 1970 KB không đổi thực chất**. PASS.
- Vietnam p75: P3 không thêm render. P2 count nếu làm ẩu (N query cho 20 table trên `/tournaments`, mobile 4G) = 20 round-trip → hại INP/LCP. Bắt buộc 1 aggregate. Với 1 aggregate: không đáng kể.

## SEO
- Routes SSR bị ảnh hưởng: **none**. Không chạm `functions/_middleware.ts`, `_lib/render/`, sitemap, blog-meta.
- Cần bump `pr:v30`? **Không** — không đổi SSR output.
- Verify: không cần (không phải thay đổi SEO).

## Kế hoạch rollback
- **P2 + P3 (app code)**: `git revert` + redeploy Cloudflare Pages. Khôi phục ~5 phút. Revert được hoàn toàn.
- **P1 (migration)**: KHÔNG git-revert được. Cần down-migration `CREATE OR REPLACE` khôi phục thân hàm `20260529120000`. Đây là điều khiến P1 = RED. Thời gian khôi phục: phải viết + áp migration ngược = 15–30 phút + nguy cơ hàm ngược cũng sai.
- Không revert được: chỉ P1. **Đó là lý do khuyến nghị bỏ P1 khỏi gói này.**

## Khuyến nghị cắt phạm vi (nói thẳng)
1. **BỎ P1** (rủi ro #6). Residual cần 3 writer đồng thời trên path dùng đúng 1 lần ở prod, damage 1 seed=NULL hồi phục được, và fix tối thiểu KHÔNG đóng thật race (close không share lock). Migration để vá cái này mang downside SLO-3 lớn hơn chính residual. Nếu Cuong vẫn muốn: làm ĐÚNG (lock cả close+cancel) trong một DB release có test riêng, không phải follow-up vội.
2. **P2**: xác nhận surface thật TRƯỚC. Component chứa hardcode 25% là dead code — sửa nó = 0 giá trị. Nếu muốn count thật, đó là feature nhỏ trên `Tournaments.tsx` + verify GRANT anon + 1 aggregate + query tách để không sập list.
3. **P3 là việc chính, đáng làm — nhưng fix ĐÚNG chỗ**: (a) tách kind `quicktable_registration` (an toàn 0 dashboard impact), (b) start-if-absent theo tableId để sống qua cả OAuth remount. Chỉ instrument nhánh doubles mặc định (`DoublesRegistrationForm.tsx` hiện 0 tracking) nếu muốn denominator có nghĩa; DoublesElim + TeamMatch cần THÊM UI (không có CTA) → hoãn, ngoài scope đo tối thiểu.

## Phải verify trước khi merge
- [ ] `node scripts/agents/risk-tier.mjs --files "<diff commit thật>"` — dùng file trong DIFF, không phải working tree (untracked `apple/`, `scripts/agents/` gây RED giả — lessons-learned 2026-07-20).
- [ ] Test navigation OAuth thật: anon → `auth_wall_viewed(A)` → login Google → về màn → `registration_complete` phải mang **cùng A**. Email/password (in-SPA, không unmount) và OAuth (document load, remount) test RIÊNG — bug chỉ lộ ở OAuth.
- [ ] Nếu làm P2 count: `curl` anon count `quick_table_registrations` cho 1 public table trên prod → confirm không `permission denied` (RLS ≠ GRANT).
- [ ] Unit test `journeys.ts`: start-if-absent KHÔNG mint đè khi id cùng kind+table đã tồn tại; VÀ tách kind → Social Event journey không bị QuickTable xoá key.
- [ ] Grep xác nhận không thêm PII vào event mới (hiện `{format,rating_system}` — enum, sạch; giữ vậy).

## Phản biện độc lập (GPT-5.6)
- **Đã xác minh trong repo (giữ lại):**
  - Đổi kind KHÔNG sửa re-mint — đúng, `startJourney` vô điều kiện (`journeys.ts:44`). Fix phải chạm caller.
  - Bỏ `user?.id` khỏi deps VẪN chưa đủ vì OAuth remount → effect mount chạy lại đè id. Cần resume semantics. Đúng (OAuth = document load, `AuthCallback.tsx`). Lưu ý: email/password là in-SPA không unmount → chỉ OAuth mới trúng lỗi mount này.
  - Progress bar là dead code — trùng khớp phát hiện độc lập của em.
  - RLS ≠ GRANT; count lỗi throw → **sập cả list** không chỉ mất bar — đúng (`useTournamentData.ts` `throw error`).
  - start-if-absent trên key chung ghép 2 surface, `completeJourney` xoá `S` phá Social Event — đúng, key dùng chung đã verify.
  - **Catch mạnh nhất (khác blind-spot Claude):** status-recheck-under-lock KHÔNG đóng hết race vì `close_...` không lấy cùng advisory lock → **đã verify**: `20260529120000:215` không có `pg_advisory_xact_lock`. Điều này biến "fix 2 dòng" thành mitigation-không-hoàn-chỉnh → củng cố khuyến nghị bỏ P1.
  - Native/web bias thật → D5 phải gắn nhãn phạm vi.
- **Bác bỏ:** không có claim nào hallucinate. GPT-5.6 để claim ở dạng điều kiện ("nếu wired vào /tournaments", "nếu effect vẫn gọi...") và mọi điều kiện đều đúng khi đối chiếu code. Điều chỉnh nhỏ duy nhất: GPT nói "OAuth trip qua /login có thể unmount" — với email/password KHÔNG unmount (in-SPA), nên lỗi mount-remint chỉ áp path OAuth, không phải mọi login.

## Panel chạy đủ 2 model
`OPENAI_API_KEY` có mặt; GPT-5.6 đã phản biện (58s, 5791 chars). Không one-model-down.
