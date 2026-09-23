# Rủi ro — ARCH-02 + ARCH-03 refactor (risk-auditor, round 1)

## Verdict: 🟡 AMBER (cả hai task)
Kịch bản xấu nhất thực tế: refactor UI/hook lỡ tay đổi thứ tự gọi hoặc cách bắt lỗi
`{data,error}` của một RPC đăng ký → user trả tiền nhưng không có bản ghi đăng ký
(paid-but-unregistered), hoặc score referee ghi thành công nhưng spectator không thấy
cập nhật (kênh realtime câm). Không có test UI/hook nào bắt được cả hai.

Classifier nói: AMBER. Em GIỮ AMBER cho cả hai — **không hạ xuống GREEN, không nâng lên
RED** — vì cả hai đều revert được (Cloudflare Pages rollback + git revert edge function),
và invariant tiền/chỗ nằm ở tầng DB (advisory lock), không nằm ở tầng refactor.

**Điều kiện chuyển RED (per-sub-change):**
- Bất kỳ **migration** nào đi kèm (ví dụ vá advisory-lock cho member path) → phần migration
  đó KHÔNG git-revert được, phải áp prod-first + verify theo ops-runbook §1. Đúng quy trình
  thì vẫn AMBER; làm ẩu (đổi tên/tạo lại bảng đã publish realtime) thì RED.
- Nếu ARCH-03 rename/recreate `team_match_matches`/`team_match_games` mà quên
  `ALTER PUBLICATION supabase_realtime ADD TABLE` → RED (silent, không revert bằng git).

## Rủi ro cụ thể

| # | Mức | Cơ chế hỏng | Người dùng thấy gì | Giảm thiểu |
|---|-----|-------------|--------------------|------------|
| 1 | Cao | **Member-path overbooking đã tồn tại.** `register_event_as_member` (migration `20260522180000_authed_user_skip_otp.sql`, dòng ~54) chỉ có `SELECT COUNT(*) >= max_players THEN RAISE event_full` — comment tự nhận "race-safe re-count" nhưng KHÔNG có `pg_advisory_xact_lock`. DB-01 (`20260716090000`) chỉ vá `guest_register` + `reactivate`, bỏ sót member path. `db-race.mjs` cũng chỉ test 2 path kia. | 2 club-member đăng ký slot cuối cùng đồng thời → cả hai `event_full`-check pass → event vượt sức chứa +1; organizer thấy active > max; guest sau bị chặn oan; phải xoá/hoàn tay. Đây là SLO 4 class (lost/overbooked slot = incident). | Thêm `pg_advisory_xact_lock(hashtext(p_event_id::text))` trước COUNT+INSERT giống DB-01; thêm member path vào `db-race.mjs`. Đây là **bug độc lập**, không do refactor gây ra — nhưng ARCH-02 sờ đúng vùng này với zero net → phải vá TRƯỚC hoặc tách PR riêng. |
| 2 | Cao | **Error-propagation regression qua ranh giới hook mới.** `supabase.rpc()` resolve `{data:null, error}` — KHÔNG throw. Hôm nay RegistrationModal bắt inline (`RegistrationModal.tsx:600 if(error){...return}`). Nếu hook trích ra quên `if(error) throw` hoặc đổi return shape, caller `mutateAsync`/try-catch coi đăng ký thất bại là thành công rồi đi tiếp `create-payment-order`/QRPaymentStep. | Trạng thái paid-but-unregistered: user thấy màn thanh toán/thành công nhưng không có registration row; hoặc chiều ngược lại: RPC commit chiếm slot nhưng UI báo lỗi → slot bị giữ ma. SLO 3 (registration). | Characterization test kiểu ARCH-04 TRƯỚC refactor: assert `{data:null, error:'event_full'}` ⇒ KHÔNG gọi create-payment-order và KHÔNG gọi mark-payment-claimed. Giữ nguyên call order + arg names (`p_slot_id: undefined` khi `hasSlots`) + `if(error) throw`. |
| 3 | Cao | **Publication drift → kênh realtime câm toàn bộ.** `useTeamMatchRealtime.ts` hôm nay OK (2 kênh riêng, suffix `Date.now()_random` — đã áp lesson #4). Rủi ro: refactor gộp thêm binding `.on(postgres_changes,{table:X})` vào cùng một channel, hoặc migration rename/recreate bảng, mà X không nằm trong `supabase_realtime`. Y hệt sự cố `chat_room_settings` 2026-07-07: 1 binding ngoài publication làm câm CẢ channel. | Referee lưu điểm OK (DB write không mất) → nhưng spectator/tab khác không nhận invalidate, thấy điểm cũ mãi tới khi F5. Đây là scoring **propagation** fail, không phải save fail — SLO 4 rìa. Silent, không log lỗi. | KHÔNG gộp bảng lạ vào 1 channel; giữ mỗi bảng một channel. Trước merge: verify mọi bảng bound đều có trong publication (`SELECT ... pg_publication_tables WHERE pubname='supabase_realtime'`). Thêm smoke 2-client: referee tab ghi điểm, spectator tab thấy đổi. |
| 4 | TB | **Chi phí rebase nhánh treo (ai trả?).** `origin/feat/team-match-event-discounts` (401 dòng, đè `useTeamMatch.ts`/`TeamMatchSetup.tsx`/`TeamMatchView.tsx`/`components/teamMatch/index.ts`) + `feat/mlp-captain-registration` (158 dòng, stale 2026-07-09, cùng file) đè đúng vùng ARCH-03. ARCH-03 land trước ⇒ hai nhánh rebase gần trọn; land sau ⇒ recon ARCH-03 stale. | Không phải break production trực tiếp, nhưng conflict resolution thủ công trên vùng money/scoring dễ tái nhập bug. Cuong (solo) trả toàn bộ chi phí này. | Cuong CHỐT sequencing trước khi bắt đầu ARCH-03: merge/abandon 2 nhánh kia trước, hoặc dời ARCH-03 sau. Đây là câu hỏi mở #1 của recon — phải trả lời, không được bỏ lửng. |
| 5 | Thấp | **Double-submit nếu bỏ guard.** RegistrationModal dùng `setSubmitting(true)` chặn double-click. Refactor bỏ guard ⇒ double-click gửi 2 lần. Advisory lock chặn double-count slot nhưng có thể tạo 2 hàng/2 payment order. | User bấm 2 lần lúc mạng lag → 2 registration/2 QR. | Giữ `submitting` guard trong hook; test double-invoke handler. |

## SLO bị đe doạ
- **SLO 3 (Registration ≥99%):** rủi ro #2 (error-propagation) và #1 (member overbooking → guest sau bị `event_full` oan).
- **SLO 4 (Scoring, zero lost-slot):** rủi ro #1 là overbooked-slot incident class; rủi ro #3 là propagation fail (score save vẫn OK, hiển thị sai).
- Không đụng SLO 1/2/5/6/7 (availability, auth, cron, latency, push) — refactor không sờ các surface đó.

## Ngân sách hiệu năng
- Bundle: refactor thuần (di chuyển code giữa file) → +0 KB ròng kỳ vọng. Baseline 1903.8 / 1970 KB (headroom ~66 KB, nhưng entry ≤170 và route ≤150 là trần cứng hơn).
- Cảnh báo: `TeamMatchView` là route chunk lớn nhất (~136 KB sau PERF-02). ARCH-03 tách hook/view có thể **redistribute** chunk — bài học PERF-02 ghi rõ "split không giảm tổng bundle". Verify không phá trần route ≤150 KB. Không thêm dependency mới.
- Vietnam p75: không thêm render/waterfall mới nếu giữ nguyên hành vi. Trung tính.

## SEO
- Routes SSR bị ảnh hưởng: **none.** `/su-kien` (social event) và team-match không có handler trong `functions/_lib/render/` được refactor này đụng; không sờ `_middleware.ts`, sitemap, blog-meta.
- Cần bump `pr:v29`? **Không** — không đổi output SSR.
- (Không cần chạy seo-verify cho change này.)

## Mobile shell (Capacitor)
- Không giả định service worker (SW skip trong native WebView theo `src/pwa.ts`). Realtime channel chạy qua WS Supabase, native OK.
- Lưu ý native song hành: memory ghi "fix cả web + native /apple". Nếu team-match/registration đã port sang native SwiftUI, đổi RPC signature/arg phía web mà không đồng bộ native → native gọi RPC cũ. Không thuộc scope web refactor nhưng Cuong cần biết.

## Kế hoạch rollback
- **ARCH-02 (UI/hook):** git revert + Cloudflare Pages rollback → vài phút. Edge handler (cancel/reactivate) revert commit + redeploy from main.
- **ARCH-03 (UI/hook):** git revert + Pages rollback → vài phút.
- **KHÔNG revert được bằng git:**
  - Bất kỳ migration nào (vá member-lock, đổi realtime publication) — no auto down-migration (ops-runbook §4.3). Phải viết forward-fix. → phần migration là RED-handling: áp prod-first + verify per §1.
  - Nếu ARCH-03 rename/recreate bảng đã publish realtime mà quên re-add publication → silent, chỉ phát hiện khi spectator báo, sửa bằng forward `ALTER PUBLICATION`.

## Phải verify trước khi merge
- [ ] `npm run test` xanh + **characterization tests mới** cho RegistrationModal/useRegistration/useTeamRegistration (kiểu ARCH-04) — gate BẮT BUỘC, không refactor vùng money zero-net.
- [ ] `node scripts/qa/db-race.mjs` xanh **và** bổ sung member-path race case (hiện đang hở).
- [ ] `SELECT * FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename IN ('team_match_matches','team_match_games');` → 2 rows, sau bất kỳ đụng migration nào.
- [ ] Smoke realtime 2-client: referee ghi điểm ở tab A → tab B (spectator) thấy đổi không cần F5.
- [ ] Diff RPC signatures: `git diff` xác nhận KHÔNG đổi tên RPC / arg names (`register_event_as_member`, `social_event_guest_register`, `social_event_reactivate_registration`).
- [ ] `supabase functions list` xác nhận cancel/reactivate deploy đúng version sau khi split handler.
- [ ] Cuong chốt sequencing 2 nhánh treo (event-discounts, mlp-captain) trước khi bắt ARCH-03.

## Phản biện độc lập (GPT-5.6, gpt-5.6, one-model panel OK — key present)
Prompt + reply lưu ở `docs/proposals/arch-02-03-refactor/external/risk-openai-round1.md`.
- **Đã xác minh trong repo (giữ):**
  - Error-propagation `{data,error}` không throw → paid-but-unregistered (rủi ro #2). Khớp code `RegistrationModal.tsx:600`.
  - Member-path `register_event_as_member` thiếu advisory lock = live overbooking bug độc lập với refactor (rủi ro #1). **Em đã tự verify trong migration TRƯỚC khi hỏi GPT** — grep xác nhận không có `pg_advisory`/`FOR UPDATE`/`LOCK`.
  - Realtime câm toàn channel khi thêm binding bảng ngoài publication (rủi ro #3). Khớp memory `chat_room_settings 2026-07-07`.
  - Ship 2 PR riêng, ARCH-03 rủi ro refactor cao hơn, combined = reject. Khớp đánh giá độc lập của em.
  - Cả hai AMBER, không intrinsic RED. Khớp.
- **Bác bỏ / hạ độ tin:**
  - GPT nêu ví dụ bảng `team_match_lineups` bị gộp vào channel — **tên bảng này chưa verify tồn tại**, GPT tự nhận là ví dụ minh hoạ (không assert). Giữ cơ chế, bỏ tên bảng cụ thể.
  - GPT ngụ ý luồng registration→payment là một chuỗi tuyến tính "continue to create-payment-order". Thực tế member-path lưu registration rồi hiện QRPaymentStep (bước riêng) — cơ chế paid-but-unregistered vẫn đúng nhưng qua UI step, không phải call chain trực tiếp. Điều chỉnh mô tả cho khớp code.
  - Không có claim nào của GPT dựng trên code nó bịa ra — nó hedge cẩn thận ("nếu chỉ move 2 binding không đổi thì concern này không thật"). Không có hallucination phải loại.
