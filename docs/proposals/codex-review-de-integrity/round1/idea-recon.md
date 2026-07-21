# Recon vòng 0 — Codex review follow-up (telemetry + capacity residual)

Agent: `idea-recon` · 2026-07-21 · read-only · 38 tool call. Ghi nguyên văn.

## P3 — telemetry mechanism (câu hỏi chịu lực)

- `src/lib/journeys.ts:44-52` — `startJourney` mint `crypto.randomUUID()`, ghi sessionStorage key `journey_<kind>_id` (`:29`). `trackJourneyStep`/`completeJourney` đọc cùng key (`:31-37`,`:87`,`:101`). **sessionStorage SỐNG qua full-page reload/nav trong cùng tab** — chỉ mất khi đóng tab.
- Login round-trip cả 2 đường:
  - Email/password: `Login.tsx:204-241` `signIn()` in-SPA → effect `:56-66` `navigate(postLoginTarget(...))` — router nav, không reload document. sessionStorage nguyên.
  - OAuth: `Login.tsx:127-163` `signInWithOAuth` → nav off-origin ra Google/Apple → về `AuthCallback.tsx` (document load thật, cùng tab) → `navigate(redirectTo)` (`:107-108`). 
  - **Kết luận: journey id SỐNG qua cả hai round-trip.** Bug KHÔNG phải storage — là logic ứng dụng.
- Root cause xác nhận `RegistrationForm.tsx:208-219`: effect key `[tableId, user?.id]` gọi vô điều kiện `startJourney('player_registration')` (`:209`) mỗi lần dep đổi, gồm anon→auth → đè id đã dùng cho `auth_wall_viewed`(`:211`) trước khi `registration_complete`(`:366`) bắn. `handleLoginClick`(`:196-200`) bắn `auth_wall_click` rồi `navigate('/login?redirect=...')`.
- `journeys.ts` không có guard chống double-`startJourney`; `journeys.test.ts:81-85` khẳng định "restart mint id mới" là hành vi ĐÚNG của module cho một journey mới thật — module không sai, điều kiện re-run của caller mới sai.
- **Contract mismatch (không hỏi nhưng CHẶN)**: `docs/north-star-journeys.md:53-59` định nghĩa `player_registration` = `player_registration_started/verification_requested/submit_attempted/completed/failed`, entry `/social/:slug` Social Event (OTP/member). Nhưng `RegistrationForm.tsx` bắn `auth_wall_viewed`/`auth_wall_click`/`registration_complete` — **bộ event KHÁC dùng chung cùng `JourneyKind` string cho luồng KHÁC** (QuickTable, không phải Social Event). `journeys.test.ts` pin tên north-star, KHÔNG pin tên QuickTable — 0 test cho event names/dedup thật của QuickTable.

## P3 — 4 bề mặt, trạng thái instrument

| Surface | File | Import journeys | Trạng thái |
|---|---|---|---|
| Singles | `RegistrationForm.tsx` | có (`:2`) | Đủ: startJourney+auth_wall_viewed(`:209-211`)+auth_wall_click(`:196-197`)+registration_complete(`:366`) — nhưng có bug re-mint |
| Doubles (MẶC ĐỊNH, `useQuickTable.ts:168`) | `DoublesRegistrationForm.tsx` | **KHÔNG** | `handleLoginClick`(`:276-279`) nav /login, 0 tracking |
| DoublesElim | `DoublesEliminationRegistrationSection.tsx:181-184` | **KHÔNG** | Anon là `NoticeCard` text tĩnh — KHÔNG có nút, KHÔNG onClick, KHÔNG CTA để gắn |
| TeamMatch | `TeamMatchView.tsx` | **KHÔNG** | `canRegister`(`:173`) gated `&& user` — anon KHÔNG có register CTA nào (`:185-186`) |

## P1 — residual (Cuong: KHÔNG mở lock ra organizer-add)

- `20260721010000:60-66` đọc `_t` (status) TRƯỚC `pg_advisory_xact_lock`(`:78-80`). Sau lock chỉ re-check capacity(`:83-88`) — **status KHÔNG re-check sau lock**.
- `close_doubles_elimination_registration`(`20260529120000:215-269`) không lock, chỉ chạy khi `_count >= team_count`(`:247-250`, else NOT_FULL) — tức chỉ fire khi bàn ĐÃ đầy.
- Cửa sổ thật: vì close chỉ chạy lúc đầy, self-register đua vào bình thường bị capacity-recheck dưới lock từ chối (vẫn đầy). Khe hở lý thuyết HẸP hơn "mọi close race": cần một **cancellation**(`cancel_..._team_registration` cũng không lock, `:176-201`) giải phóng slot SAU khi close lật status `'ongoing'` + gán seed(`:252-266`) nhưng TRƯỚC khi self-register cũ (đã qua pre-lock status check là `'registration_open'`) tới capacity-recheck. KHÔNG có UNIQUE/CHECK backstop.
- Thiệt hại nếu trúng: seed đã gán(`:252-266`) trước insert thừa → đội trễ `seed=NULL`, vắng trong pass đó. Bracket gen là bước frontend riêng(`:268-269`).

## P2 — progress bar

- `OpenRegistrationSection.tsx:59` hard-code `width:'25%'`.
- `table.player_count`(`useTournamentData.ts:83-95,103`) là **sức chứa cấu hình lúc tạo**, KHÔNG phải count đăng ký thật (render nơi khác cùng card là "{player_count} players" `:44-47`).
- Count đăng ký thật KHÔNG có trong query này. `useOpenRegistrationTables`(`:97-136`) không join/count `quick_table_registrations`. Progress bar thật cần **query count MỚI**, không phải đọc field sẵn.
- Grep "25%"/"Slots filled" khác: chỉ 1 hit `DoublesEliminationList.tsx:247` — skeleton shimmer, KHÔNG liên quan.

## Native

- Có view đăng ký Swift (`PlayerRegistrationView.swift`, `DoublesElimRegistrationView.swift`, `QuickTableRegistrationViews.swift`). Grep 189 file `.swift` cho `analytics|journey|trackevent|ga4`: **0 match**. Telemetry D5 hiện web-only theo thiết kế, không phải thiếu sót của task.

## Unknowns cho Cuong
1. Instrument DoublesElim = THÊM UI (hiện chỉ text tĩnh, không CTA), không phải wiring. Xác nhận scope trước khi báo giá.
2. `player_registration` JourneyKind bị DÙNG CHUNG cho 2 luồng contract-lệch (Social Event OTP vs QuickTable ad-hoc) — cần báo chủ `north-star-journeys.md` dù ngoài scope.

---

## ⚠️ ĐÍNH CHÍNH — P2 progress bar là DEAD CODE (risk-auditor bắt, orchestrator kiểm chứng)

Recon phần P2 mô tả `OpenRegistrationSection.tsx:59` (hard-code 25%) như thể nó HIỂN THỊ trên list. SAI.

Kiểm chứng (`grep -rn OpenRegistrationSection src/`):
- Chỉ 1 kết quả ngoài chính file: `src/components/quicktable/index.ts:4` — barrel re-export.
- **KHÔNG có caller render nào** trong toàn `src/`. Home bỏ nó ở commit `ae641d93` (thay bằng The Line editorial). `Index.legacy.tsx` cũng không dùng.

→ "Sửa hard-code 25%" = **0 thay đổi người dùng thấy**. Nếu Cuong muốn count đăng ký thật thì đó là **FEATURE MỚI** trên `Tournaments.tsx`, không phải "vá bug hiển thị". P2 như intake mô tả **không tồn tại**.

Bài học lặp lại (lần 3 trong chuỗi phiên): recon mô tả một thứ như đang chạy mà không kiểm caller. critic vòng 1 cũng xây critique trên tiền đề này. risk-auditor bắt vì nó grep caller trước khi tin. Cùng mô-típ "cổng tín hiệu xanh sai".
