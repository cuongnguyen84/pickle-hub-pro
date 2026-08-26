## Tóm tắt kiến trúc

ARCH-02 và ARCH-03 không cân nhau nữa sau ARCH-04. ARCH-02 (Social Event/payment) là monolith thật, chưa test, không nhánh nào đè lên — làm được ngay. ARCH-03 (Team Match) đã bị ARCH-04 ăn mất phần scoring + realtime spectator; phần còn lại chủ yếu là chẻ hook, và nó nằm dưới 3 nhánh feature treo (tối đa 401 dòng chồng lấn) — refactor bây giờ = bắt Cuong rebase 2 lần vào đúng vùng đang chạm.

**Đề xuất một câu:** ARCH-02 giờ (chẻ lát theo template QA-08 `handler.ts`), ARCH-03 hoãn tới khi `feat/team-match-*` merge hoặc chết — và re-scope ARCH-03 xuống còn "reconcile 2 kênh realtime + chẻ `useTeamMatchMatches`", không phải 5d full-domain.

### Kiểm chứng claim (mở file thật)

- `RegistrationModal.tsx` = **1398 dòng**, gọi supabase trực tiếp trong JSX handler tại dòng **231** (`rpc get_event_slot_counts`), **376/473/518/652** (`functions.invoke`), **593** & **1314** (`rpc`) — 7 call inline, đúng là vi phạm boundary rule #3. Ngược lại `useRegistration.ts` (343d) có **0** call supabase, `useEventRegistrations.ts` **0**, `useTeamRegistration.ts` **3** — nghĩa là vi phạm tụ ở chính component modal, hook đã gần sạch. Extract có đích rõ.
- `cancel-registration/` và `reactivate-registration/` = **chỉ có `index.ts`**, không `handler.ts`. `create-payment-order/` có `handler.ts` (template QA-08). `cancel-registration` là state-transition có guard (`status='cancelled'` + chặn event đã start/cancelled) — đủ tiêu chuẩn rule edge #3 dù không phải money thuần.
- `useTeamMatch*` = **3150 dòng / 7 file**, lớn nhất `useTeamMatchMatches.ts` (1021). `TeamMatchView.tsx` = **0** call supabase trực tiếp — đã route qua hook, rule #3 đã tôn trọng sẵn ở đây. `useTeamMatchRealtime.ts` (150d) là kênh riêng, tách khỏi kênh `referee_live_state` của ARCH-04 → điểm reconcile duy nhất còn thật.

## Option A — ARCH-02 full giờ, defer ARCH-03 (recommended)

Effort: **12 half-days** (ship được ở half-day 7, phần đuôi deferrable) · Files: xem Increments · Data: none (không migration; RLS/RPC đã có từ DB-01)

How it works: Chẻ ARCH-02 thành 4 lát độc lập theo template `handler.ts`/`lib` của QA-08 (mục Increments). ARCH-03 đóng băng, chỉ ghi 1 dòng vào `architecture-boundaries.md` rằng phần realtime/scoring đã do ARCH-04 gánh, phần còn lại chờ nhánh treo. Không thêm `eslint-plugin-boundaries` (doc nói rõ "not before ARCH-02/03"; và ARCH-03 chưa xong nên điều kiện chưa thoả).

Wins: đánh đúng vùng nóng nhất (113 commit/3 tháng) và chưa test nhất; không nhánh nào đè ARCH-02 nên **0 rebase tax**; mỗi lát ship riêng, money/state-path có vitest trước khi động UI.
Loses: ARCH-03 vẫn treo trên giấy, roadmap Phase 4 chưa "done" trọn.
Forecloses: gần như không — chỉ hoãn, không khoá cửa nào. Nếu sau này muốn plugin boundaries thì ARCH-02 xong là bật được cho domain social.

## Option B — Cheap: ARCH-02 chỉ money/state-path + đóng ARCH-03 là "mostly done" (the cheap one)

Effort: **7 half-days** · Files: 2 edge handler + tests, RegistrationModal→hook · Data: none

How it works: Làm **chỉ Increment 1 + 2** của Option A (chẻ `cancel/reactivate` sang `handler.ts` + kéo 7 call inline của RegistrationModal về hook), rồi **dừng**. Không chẻ page-level (`SocialEventLive/Matchmaking/Roster`), không extract lib capacity nếu logic đã đủ nhỏ. ARCH-03 tuyên bố "phần lớn ARCH-04 đã hấp thụ" — chỉ mở 1 task nhỏ sau này: reconcile `useTeamMatchRealtime` với kênh `referee_live_state`, ghi doc, không chẻ hook.

Wins: rẻ nhất, khép money-path + boundary violation lớn nhất trong <4 ngày; thừa nhận ARCH-04 đã làm hộ 60% ARCH-03 thay vì giả vờ còn 5d.
Loses: 4 page SocialEvent* vẫn to (700-800 dòng) — layering "đẹp" chưa xong, nhưng chúng không vi phạm rule #3 (call đã ở hook), chỉ là file dài.
Forecloses: nếu về sau một feature lớn đụng `SocialEventLive.tsx` thì phải chẻ lúc đó — nhưng "chẻ khi có lý do thật" chính là điều đúng, không phải nợ.

## Option C — Cả hai tuần tự theo roadmap (để bác bỏ)

Effort: **24+ half-days** + rebase tax 2 lần · Files: toàn bộ ARCH-02 + 7 hook TeamMatch · Data: none, nhưng chạm publication realtime

How it works: đọc roadmap chữ đen, làm ARCH-02 rồi ARCH-03 full ngay đợt này, chẻ cả `useTeamMatchMatches` (1021d) và reconcile realtime.

Wins: Phase 4 "done" đúng bảng.
Loses: ARCH-03 đè đúng file mà `feat/team-match-event-discounts` (401d), `feat/mlp-captain-registration` (158d), `feat/web-referee-doubles-mlp` (76d) đang sửa → Cuong rebase 2 lần qua vùng phức tạp nhất, hoặc mình rebase hộ và nuốt conflict scoring. Reconcile realtime đụng publication = đúng gotcha "1 binding ngoài publication làm câm cả kênh" (memory 2026-07-07) — RED-adjacent, dễ page 2am.
Forecloses: khoá lịch Cuong ~2 tuần vào refactor nội bộ 0 giá trị user, trong khi SLO nói reliability > scope.

## Khuyến nghị

**Option A.** B thua vì bỏ dở Increment 3 (extract lib capacity/eligibility) — đó là đúng chỗ boundary doc bảo phải test, và slot/waitlist math là logic có branch đáng test; bỏ nó là để lại đúng loại nợ ARCH-01 muốn xoá. Nhưng nếu quỹ thời gian Cuong tuần này <4 ngày thì B là fallback hợp lệ, không phải sai. C thua rõ: nó ép rebase 2 lần vào vùng team-match đang có 3 nhánh sống và chạm publication realtime — chi phí thật cho 1 người vượt xa giá trị "tick xong Phase 4", và mâu thuẫn với `slo.md` (reliability > scope). Điểm mấu chốt cả A lẫn C né được mà C phạm: **ARCH-04 đã ăn phần đắt nhất của ARCH-03** (engine, live-state envelope, spectator, lockout) — làm ARCH-03 full bây giờ là trả tiền cho việc đã xong.

**eslint-plugin-boundaries: KHÔNG thêm đợt này.** Doc điều kiện hoá "nếu vi phạm tái diễn sau ARCH-02/03"; ARCH-03 chưa xong nên điều kiện chưa thoả, và plugin config-nặng cho 1 implementation = đúng thứ ponytail bỏ. Bật được sau khi ARCH-02 land nếu muốn ratchet cho riêng domain social.

## Increments

Theo template QA-08 (`handler.ts` Deno-free + injected store + vitest ở `_shared/__tests__/`):

1. **Edge: `cancel-registration` + `reactivate-registration` → `handler.ts`** (3 half-days). Tách `processCancelRegistration` / `processReactivateRegistration` qua store interface (`RegistrationStore`), guard state-transition (`active`↔`cancelled`) chuyển từ read-check-write sang guarded UPDATE nếu chưa. Test: `supabase/functions/_shared/__tests__/registration-handlers.test.ts` — cover chặn double-cancel, chặn event-đã-start. Verify: `npm run test` xanh + `curl` 2 endpoint với magic_token giả trả 200/409 đúng. **Ship riêng, 0 rủi ro UI.**
2. **Web: kéo 7 call inline của `RegistrationModal.tsx` vào hook** (4 half-days). `get_event_slot_counts` (rpc dòng 231) → `useEventRegistrations`; các `functions.invoke` order/claim (376/473/518/652) → `useRegistration`; rpc 593/1314 → hook tương ứng. RegistrationModal chỉ gọi hook, không `supabase.*`. Không đổi hành vi. Verify: manual — flow đăng ký 1 người + hiển thị slot capacity còn đúng; `grep supabase RegistrationModal.tsx` = 0.
3. **Web: extract capacity/eligibility math → `src/lib/eventRegistration.ts` + `__tests__`** (2 half-days). Chỉ logic có branch (slot còn/hết, waitlist eligibility, proxy/manual rule). Verify: `lib/__tests__/eventRegistration.test.ts`.
   → **Stop-and-look ở đây.** Increment 1-3 = boundary violation lớn nhất đã đóng, money/state-path có test. Xem có ai/feature nào cần hơn không.
4. **(Deferrable) Chẻ page `SocialEventLive/Matchmaking/Roster`** (3 half-days). Chỉ làm khi có feature thật đụng vào — chúng dài nhưng không vi phạm rule #3.

## Điều em không chắc

- **Scope cancel/reactivate có nằm trong ARCH-02 không** (recon câu hỏi #2). Em xếp nó vào vì là state-transition path chưa template và rẻ (Increment 1), nhưng nếu Cuong định nghĩa ARCH-02 = "money-path thuần" thì cắt Increment 1, ARCH-02 còn thuần web — cần Cuong chốt 1 câu.
- **Logic capacity thực sự sống ở đâu.** Em thấy rpc `get_event_slot_counts` + `event_capacity_rpc.test.sql` (DB-01) đã đẩy phần race xuống Postgres. Nếu math phía client đã mỏng (chỉ format số), Increment 3 co lại còn ~1 half-day hoặc bỏ — chưa mở đủ sâu `RegistrationModal` để khẳng định còn bao nhiêu branch đáng test.
- **ARCH-03 sau khi nhánh merge còn đúng bao nhiêu.** Em suy ARCH-04 ăn ~60% từ boundaries doc + `TeamMatchView` 0-call, nhưng chưa diff `feat/team-match-event-discounts` (401d) xem nó có tự chẻ hook không — nếu có thì ARCH-03 gần như tự đóng khi merge, mình chỉ còn reconcile realtime + doc. Cần re-recon sau khi nhánh đó land.
- **Reconcile 2 kênh realtime** (`useTeamMatchRealtime` vs `referee_live_state`) đụng publication — em flag là điểm rủi ro nhất của ARCH-03 tương lai (gotcha publication-drift), nhưng chưa mở `useTeamMatchRealtime.ts` để biết nó có cần đụng `supabase_realtime` publication thật hay chỉ subscribe. Không phải việc đợt này.
