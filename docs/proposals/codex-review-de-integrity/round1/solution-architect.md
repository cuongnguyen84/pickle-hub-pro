# Solution Architect — Codex review follow-up (telemetry + residual)

Agent: `solution-architect` · 2026-07-21 · Đã tự mở kiểm chứng: `journeys.ts`,
`journeys.test.ts`, `quicktable/RegistrationForm.tsx:196-219`, `OpenRegistrationSection.tsx`,
`useTournamentData.ts:83-139`, `useTeamRegistration.ts` (doubles → `quick_table_teams`),
`20251225041737…sql` (RLS: anon đọc được registrations của table public),
`20260721010000_ux07_de_registration_capacity_lock.sql` (status đọc :66 trước lock :78).

## Tóm tắt kiến trúc

Trọng tâm là **làm cho việc ĐO D5 khả thi**, không phải mở guest path. Ba thay đổi client
nhỏ trên bề mặt đã có (`journeys.ts` thêm 1 helper idempotent, tách `JourneyKind` mới cho
nhánh giải, gắn tracking vào form doubles mặc định) đủ để funnel 02/08 join được anon→login.
Hai việc phụ tách hẳn: P2 là fix hiển thị thuần client (count thật thay hard-code 25%), P1 là
một migration 3 dòng re-check status dưới lock — hoặc bỏ qua. Không route mới, không dep mới,
không chạm auth/payments/config → không RED-tier; native không cần đụng vì không sửa UI web.

---

## P3 — Telemetry (trọng tâm)

### P3(a) — Re-mint bug: journey id đổi ở anon→login

**Root cause đã xác minh:** không phải storage (sessionStorage sống qua cả email/password SPA
lẫn OAuth reload). Là `startJourney` (`journeys.ts:44`) LUÔN mint mới, và caller gọi nó lại khi
component remount sau khi quay về từ `/login`. Deps `[tableId, user?.id]` chỉ là một trigger;
remount là trigger thứ hai. Sửa ở deps thôi KHÔNG đủ — form unmount khi navigate `/login` rồi
remount khi quay lại, effect chạy lại, mint lại.

#### Option A — `startJourneyOnce(kind)` idempotent trong `journeys.ts` (khuyến nghị)
Effort: 0.5 nửa ngày · Files: `src/lib/journeys.ts`, `src/lib/__tests__/journeys.test.ts`,
`src/components/quicktable/RegistrationForm.tsx:209` · Data: none

How it works: thêm hàm 5 dòng — đọc active id trong sessionStorage; có thì trả lại, không thì
`startJourney`. Caller đổi `startJourney(...)` → `startJourneyOnce(...)`. `startJourney` giữ
nguyên → contract test `journeys.test.ts:81-85` ("restart mint id mới") KHÔNG bị phá, vì ta
THÊM hàm chứ không sửa hàm cũ. Journey sống qua login vì id đã nằm trong sessionStorage; remount
sau login reuse đúng id đó; `registration_complete` (`:366`) join được.

Wins: fix tại NGUỒN (nơi mọi surface sẽ route qua), 1 hàm dùng lại cho doubles ở P3(c) · Loses:
edge case — nếu anon mở journey ở table X rồi bỏ sang table Y CHƯA đóng journey, Y reuse id của X.
Hiếm (completeJourney xoá id sau mỗi lần đăng ký xong; 1 table/lần) · Forecloses: không.

#### Option B — sửa deps caller thành `[tableId]`, bỏ `user?.id`
Effort: 0.25 nửa ngày · Files: chỉ `RegistrationForm.tsx` · Data: none
How it works: bỏ `user?.id` khỏi deps. Wins: diff nhỏ nhất · Loses: **KHÔNG fix remount** — form
unmount/remount qua `/login` round-trip vẫn mint lại. Chỉ che được nhánh in-SPA không remount.
Forecloses: để lại bug thật → loại.

**Khuyến nghị P3(a): Option A.** B thua vì nó chỉ vá trigger deps mà bỏ trigger remount — chính
là đường login mà D5 cần đo. A đặt guard ở hàm mint dùng chung nên doubles (P3c) hưởng luôn.

Self-check: thêm 1 test `startJourneyOnce reuses active id, mints when none` trong `journeys.test.ts`.

### P3(b) — JourneyKind collision (recon lòi ra, Codex không thấy)

**Đã xác minh:** `player_registration` dùng chung cho Social Event OTP (contract north-star
`:53-59`) và QuickTable ad-hoc. Cùng key sessionStorage `journey_player_registration_id` → hai
luồng đè active id lẫn nhau; funnel D5 trộn hai bộ event dưới chung denominator.

#### Option A — tách kind mới `tournament_registration` (khuyến nghị)
Effort: gộp vào P3(a), ~0.25 nửa ngày · Files: `src/lib/journeys.ts` (thêm 1 dòng union),
các surface QuickTable · Data: none
How it works: thêm `"tournament_registration"` vào `JourneyKind` union; đổi mọi call QuickTable
(`RegistrationForm.tsx`, doubles ở P3c) từ `'player_registration'` → `'tournament_registration'`.
Key sessionStorage tách hẳn (`journey_tournament_registration_id`), funnel D5 sạch.
Wins: sửa cả collision storage LẪN trộn funnel một phát; đúng ngữ nghĩa (đây là đăng ký GIẢI,
không phải Social Event) · Loses: phải nhớ cập nhật `north-star-journeys.md` (doc, ngoài code) ·
Forecloses: không.

#### Option B — giữ kind, thêm prop `surface` để lọc trong GA4
Effort: 0.1 nửa ngày · Data: none
How it works: thêm `{ surface: 'quicktable' }` vào mọi event. Wins: diff bé nhất · Loses: KHÔNG
sửa collision key sessionStorage — Social Event và QuickTable journey vẫn không cùng active được
trong 1 tab; denominator vẫn trộn ở tầng id. Prop chỉ lọc được ở event, không cứu id. → loại.

**Khuyến nghị P3(b): Option A.** Đây là điều kiện để funnel 02/08 SẠCH. B thua vì collision là
lỗi storage thật, không phải nhiễu analytics lọc được sau.

### P3(c) — Instrument tới đâu (câu hỏi chi phí cốt lõi)

Định lượng từng bề mặt (đã tự mở file xác minh trạng thái):

| Surface | Trạng thái hiện tại | Chi phí instrument | Traffic |
|---|---|---|---|
| **Singles** `quicktable/RegistrationForm.tsx` | Đủ event, có bug re-mint | 0 thêm — fix ở P3(a/b) | thấp |
| **Doubles (MẶC ĐỊNH** `useQuickTable.ts:168`) `DoublesRegistrationForm.tsx` | có `handleLoginClick:276`, 0 tracking | **~1 nửa ngày** (~15 dòng: import + startJourneyOnce + auth_wall_viewed/click + complete on team insert) | **cao nhất trong nhóm** |
| **DoublesElim** `tournament/DoublesEliminationRegistrationSection.tsx:181` | anon = `NoticeCard` text tĩnh, KHÔNG CTA | ~1.5–2 nửa ngày (**THÊM UI**: nút login anon + VI/EN + **native /apple parity**) | 1 giải từng dùng, 2 đội |
| **TeamMatch** `pages/TeamMatchView.tsx:173` | `canRegister && user`, anon 0 CTA | ~1.5–2 nửa ngày (**THÊM UI** anon CTA + native) | ~0 anon |

#### Option A — chỉ Singles (fix) + Doubles (mặc định) (khuyến nghị)
Effort: ~1 nửa ngày (trên nền P3 a/b) · Files: `DoublesRegistrationForm.tsx` · Data: none
How it works: gắn cùng bộ event vào form doubles bằng `startJourneyOnce('tournament_registration')`,
bắn `auth_wall_viewed`/`auth_wall_click` (đã có `handleLoginClick`), `registration_complete` khi
insert `quick_table_teams` thành công (`useTeamRegistration.ts:161`). Không đụng UI hiển thị.
Wins: phủ đúng hai nhánh QuickTable có lưu lượng; 0 UI mới → 0 native → rẻ nhất mà vẫn đo được D5 ·
Loses: không đo được DE/TeamMatch · Forecloses: không — thêm sau nếu awareness lên.

#### Option B — cả 4 bề mặt
Effort: ~4–5 nửa ngày + native · How it works: A + xây CTA login anon cho DE và TeamMatch.
Wins: phủ hết · Loses: **xây chính cái guest-CTA mà D5 chưa quyết có nên xây**; traffic DE/TeamMatch
≈0 nên data quá thưa để đọc — tốn công đo cái không ai chạm. Forecloses: không.

#### Option C — chỉ fix Singles, không đụng Doubles
Effort: 0 thêm · Loses: Doubles là format MẶC ĐỊNH — bỏ nó thì "near-zero auth_wall_viewed" vẫn
là artifact của việc chỉ instrument nhánh phụ. → loại, đúng cái Codex cảnh báo.

**Khuyến nghị P3(c): Option A.** Cuong xác nhận awareness thấp là ràng buộc thật → mọi bề mặt đều
thưa, bề mặt lưu lượng ~0 (DE/TeamMatch) instrument bằng UI mới là đầu tư ngược. Đo D5 = "wall có
làm rớt người ở bề mặt người ta thực sự tới không" → Singles + Doubles (mặc định) phủ đúng đó.
B thua vì bắt xây guest-CTA trước khi quyết D5; C thua vì bỏ nhánh mặc định.

---

## P2 — Progress bar (fix hiển thị, Cuong: KHÔNG cap cứng)

Đã xác minh: `player_count` (`useTournamentData.ts:89`) là SỨC CHỨA, không phải count đăng ký;
hook `useOpenRegistrationTables` không join `quick_table_registrations`. Count thật = query MỚI.
RLS cho phép anon đọc registrations của table public (`20251225041737:42-49`) → query count chạy
được cho khách. **Cảnh báo hai nguồn:** singles đếm `quick_table_registrations`, doubles đếm
`quick_table_teams` (`useTeamRegistration.ts:161`) — count khác bảng theo `is_doubles`.

#### Option A — count per-card trong `OpenRegistrationCard` (khuyến nghị)
Effort: ~1 nửa ngày · Files: `OpenRegistrationSection.tsx` (+ hook nhỏ `useQuickTableRegisteredCount`
trong `useTournamentData.ts`) · Data: none (count query, `head:true`)
How it works: bar 25% chỉ sống Ở CARD NÀY. Card tự query `count` (react-query keyed `[table.id,
is_doubles]`), `select('*',{count:'exact',head:true})` trên bảng đúng theo format, loại status
`rejected`. Width = `min(count/player_count,1)*100%`; nếu `count > player_count` hiện badge cảnh báo
nhẹ (VI "Vượt sức chứa" / EN "Over capacity"), không chặn. 3–6 count query/màn — không đáng kể.
Wins: KHÔNG đụng `useOpenRegistrationTables` (được đọc ở `Tools.tsx:19` + `Tournaments.tsx:165` —
2 chỗ đó KHÔNG có progress bar, thêm count vào hook = query thừa cho chúng) · Loses: mỗi card 1
query thay vì batch · Forecloses: không.

#### Option B — thêm `registered_count` vào `useOpenRegistrationTables`
Effort: ~1.5 nửa ngày · Data: none
How it works: hook batch count cho mọi table. Loses: đụng 3 read-site; Tools/Tournaments gánh
query đếm mà chúng không hiển thị bar; hai nguồn (singles/doubles) làm batch rối. → loại.

**Khuyến nghị P2: Option A.** Bar chỉ ở 1 component; nhét count vào hook dùng chung là bơm chi phí
vào 2 trang không cần. Per-card query là lazy đúng chỗ. Nhãn "Đã đăng ký/Slots filled" đã song ngữ;
chỉ thêm badge cảnh báo song ngữ.

---

## P1 — Residual close-registration (Cuong: KHÔNG mở lock ra organizer)

Đã xác minh khe hở: `20260721010000:66` đọc `_t.status` TRƯỚC lock `:78`; sau lock chỉ re-check
capacity `:83-88`, **không re-check status**. Cửa sổ thật hẹp: cần một cancellation giải phóng slot
SAU khi close lật status + gán seed, TRƯỚC khi một self-register (đã qua pre-lock status check =
`registration_open`) tới capacity-recheck. Thiệt hại = 1 đội `seed=NULL`, không UNIQUE backstop.

#### Option A — re-check status sau lock (khuyến nghị, biên độ mỏng)
Effort: 0.5 nửa ngày · Files: migration mới `20260721050000_de_recheck_status_under_lock.sql`
(CREATE OR REPLACE, lặp lại body verbatim như bản trước, thêm 3 dòng re-SELECT status ngay sau
`pg_advisory_xact_lock` → nếu ≠ `registration_open` trả `REGISTRATION_CLOSED`) · Data: RPC update
How it works: đóng đúng invariant DB-01 (mọi write tiêu thụ sức chứa serialize + đọc lại điều kiện
DƯỚI lock). Không đụng organizer-add (Cuong đã quyết organizer được vượt cap). Migration auto-apply.
Wins: xoá một class "ghost team seed=NULL" mà sau này debug rất tốn công; đồng bộ DB-01 · Loses: một
migration cho window chưa từng fire · Forecloses: không.

#### Option B — bỏ qua
Effort: 0 · How it works: ghi nhận residual, không vá. Wins: 0 công · Loses: để hở một khe integrity
thật (dù hẹp); nếu guest path sau này bỏ bước tạo account, đăng ký dồn lại → window rộng ra.

**Khuyến nghị P1: Option A, nhưng ưu tiên THẤP NHẤT trong lô.** Chi phí biên gần bằng 0 (3 dòng
trong hàm đã lock sẵn) và nó xoá một lỗi câm khó chẩn. Không phải RED (plpgsql RPC, không chạm
auth/payments/`config.toml`). Nếu phải cắt để ship P3 trước 02/08 thì defer được — không mở rộng lock.

---

## Native

Đã xác minh recon: 0 telemetry trong 189 file `.swift`. D5 web-only theo thiết kế.
**Kết luận: KHÔNG cần native cho việc ĐO.** Phương án khuyến nghị (P3 A: chỉ Singles+Doubles web,
0 UI mới) không sửa UI web nào → theo memory "fix both web and native", KHÔNG có UI để port. Xây
telemetry native = dự án hạ tầng riêng, không justify để đo D5. Chính lý do này củng cố việc BỎ
DE/TeamMatch: chúng đòi CTA anon MỚI → mới là thứ bắt native parity.

## Bundle / SSR / RED

- **Bundle:** 0 dep mới. Tất cả dùng pattern sẵn (react-query, `journeys.ts`, supabase count).
  Không đụng `docs/perf-budgets.md`.
- **SSR/route:** không route public mới. Telemetry + progress bar là client-only trên route đã có
  → không cần handler `functions/_lib/render/`, không đụng sitemap/hreflang.
- **RED-tier:** không. Không chạm auth/payments/`supabase/config.toml`. P1 là migration RPC
  (auto-apply, đã được Cuong uỷ quyền áp prod).
- **Song ngữ:** nhãn bar đã VI+EN; badge "Vượt sức chứa/Over capacity" thêm song ngữ ngày 1.

---

## Increments (ship riêng được)

1. **P3(a)+(b) — join fix + kind mới** (0.75 nửa ngày). `startJourneyOnce` + test; đổi Singles
   sang `tournament_registration`. Verify: chạy `npm run test` (test journeys xanh); DevTools
   Network lọc GA — anon→login→submit trên 1 table cho ra CÙNG `journey_id` ở `auth_wall_viewed`
   và `registration_complete`. **Điểm dừng-nhìn tự nhiên:** merge cái này trước, chưa cần đụng gì khác.
2. **P3(c) — instrument Doubles mặc định** (1 nửa ngày). Verify: đăng ký doubles anon phát đủ
   `auth_wall_viewed`/`auth_wall_click`/`registration_complete` cùng `journey_id`, kind
   `tournament_registration`.
3. **P2 — progress bar count thật** (1 nửa ngày). Verify: card hiện `count/player_count` đúng số
   thật (so DB); tạo table vượt sức chứa → badge cảnh báo, KHÔNG chặn.
4. **P1 — re-check status dưới lock** (0.5 nửa ngày, ưu tiên thấp, defer được). Verify: `curl`/psql
   không cần; đọc lại migration là diff verbatim + 3 dòng; test race thủ công tuỳ chọn.

Tổng đường khuyến nghị: **~3.25 nửa ngày** (1–4) hoặc **~2.75** nếu defer P1.
Đã CẮT: instrument DoublesElim + TeamMatch (~3–4 nửa ngày + native) và mọi việc native.

## Điều em không chắc

- **P2 nên đếm status nào.** "Đã đăng ký" nên gồm `pending` hay chỉ `approved`? Recon không chốt
  ngữ nghĩa denominator. Em mặc định "mọi row trừ `rejected`" cho khớp nhãn "đăng ký", nhưng nếu
  Cuong muốn bar phản ánh "được nhận" thì đổi filter (1 dòng). Cần Cuong xác nhận.
- **Doubles `registration_complete` fire ở đâu chính xác.** Em định gắn sau insert
  `quick_table_teams` thành công (`useTeamRegistration.ts:161`), nhưng doubles có luồng pair-request
  (đội 1 người chờ ghép) — "complete" là lúc tạo đội hay lúc đủ 2 người? Ảnh hưởng định nghĩa mẫu số
  D5. Chưa đọc hết state machine pairing; cần soi `useTeamRegistration.ts:230-260` trước khi code.
- **P1 window có thật đạt được không.** Em suy luận từ đọc 3 hàm (register/close/cancel) rằng cancel
  không lock; chưa dựng race harness xác nhận thứ tự thời gian thực sự chèn được. Nếu Cuong muốn chắc
  chắn trước khi bỏ công, cần 1 harness — nhưng chi phí vá (3 dòng) < chi phí chứng minh, nên em
  nghiêng vá thẳng.
- **north-star-journeys.md drift.** Tách kind mới đúng về code nhưng làm doc contract lệch thêm; em
  chưa đọc toàn bộ doc đó để biết có chỗ nào hard-depend vào `player_registration` = QuickTable không.
