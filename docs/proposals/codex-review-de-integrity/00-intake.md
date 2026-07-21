# Intake — Codex review follow-up: registration integrity + funnel telemetry

Ngày: 2026-07-21 · Nguồn: Codex review của `docs/roadmap-status-2026-07-21.md`
(session `019f8272-c5ee-7a01-a458-f2fae6b9a3d6`)

## Bối cảnh

Codex review báo cáo roadmap và bắt được một loạt defect thật (đã kiểm chứng đọc file).
Hai cái cơ học đã vá thẳng ở **PR #427** (contract `AUTH_REQUIRED`, UNIQUE `team_match_games`).
Ba cái còn lại chạm **quyết định sản phẩm/kiến trúc** nên đưa vào panel — Cuong yêu cầu `/idea`.

## Ba vấn đề cho panel

### P1 — Advisory lock không phủ hết writer tiêu thụ sức chứa (capacity race còn hở)

PR #423 (`20260721010000`) thêm `pg_advisory_xact_lock('de_capacity:'||tournament_id)` vào
`register_team_for_doubles_elimination` (self-register). Nhưng:
- `organizer_add_team_to_doubles_elimination` (`20260529140000_doubles_elim_organizer_add_team.sql:60,102`)
  tự count-check-insert **không lấy cùng lock** — UI có gọi RPC này (`DoublesEliminationRegistrationSection.tsx:154`).
  → self-register đua với organizer-add vẫn tràn được.
- Close-registration RPC (`20260529120000:243,268`) count + đổi status không share lock; self-register
  check status TRƯỚC khi lấy lock (`20260721010000:60`) → về lý thuyết có thể thấy `registration_open`,
  chờ, rồi insert sau khi giải đã đóng.

DB-01 invariant thật (`20260716090000:8`): **mọi** write tiêu thụ sức chứa serialize trên CÙNG key.
UX-07 mới chỉ phủ 1 writer.

**Câu hỏi sản phẩm:** organizer thêm đội có nên bị chặn bởi cùng cap không, hay organizer được phép
vượt cap (họ là người tổ chức)? Nếu được vượt thì "race" này không phải bug mà là quyền. Cuong quyết.

### P2 — QuickTable KHÔNG có cap sức chứa ở bất kỳ tầng nào

Không chỉ thiếu ở INSERT — thiếu ở MỌI nơi:
- Singles: `useRegistration.ts:121` insert thẳng, RLS chỉ check `user_id=auth.uid()`
  (`20251225041737:53`), row mặc định `pending`. Approve chỉ update status (`useRegistration.ts:212,250`).
  Bracket-start chỉ check tối thiểu 6, đẩy MỌI approved đi tiếp (`RegistrationManager.tsx:299,915`).
- Doubles (mặc định — `useQuickTable.ts:168`): `useTeamRegistration.ts:141,160` browser-check + insert thẳng,
  RLS chỉ check ownership (`20260101135910:77`).
- Progress bar "Slots filled" **hard-code 25%** (`OpenRegistrationSection.tsx:51`), không đọc số thật.

→ vượt `player_count` được kể cả **tuần tự, không cần race**. Nhận định cũ "chỉ matter nếu mở guest path" SAI.

**Câu hỏi sản phẩm (quyết định cách enforce):**
- `player_count` cap **người ĐĂNG KÝ** (applicant) → enforce ở INSERT.
- hay cap **người ĐƯỢC NHẬN** (accepted) → enforce atomic ở approval / bracket-creation.
- Đăng ký hiện là "đơn xin" (`pending`) → nghiêng về vế thứ hai, nhưng Cuong quyết.

### P3 — Journey telemetry re-mint khi login → D5 đo KHÔNG được

`RegistrationForm.tsx:208` effect key `[tableId, user?.id]`. Anon vào → mint id A, bắn `auth_wall_viewed(A)`
→ login → `user?.id` đổi → effect chạy lại → `startJourney` mint id B (`journeys.ts:39` luôn mint mới)
→ `registration_complete(B)`. **A≠B nên wall→complete không join** — mà north-star metric
(`north-star-journeys.md:75`) đòi complete cùng `journey_id`.
Thêm nữa: chỉ singles form có instrument; **doubles form (mặc định) không có** (`DoublesRegistrationForm.tsx:276`);
DoublesElim chỉ hiện notice không CTA tracked (`:181`); TeamMatch anon không có CTA nào (`TeamMatchView.tsx:171,185`).

→ Codex: "near-zero `auth_wall_viewed`" hiện nghĩa là "near-zero tới nhánh singles đã instrument", KHÔNG
phải "bài toán ở thượng nguồn". **Đo hiện tại không đủ để quyết D5.**

Cuong đã xác nhận (2026-07-21): 0 đăng ký giải MLP Hà Nội là do **awareness thấp / chưa chạy truyền thông**,
không phải login wall. Điều này củng cố "chưa xây guest path", nhưng KHÔNG thay được việc đo cho đúng.

## Yêu cầu cho panel

- P1/P2: phân biệt rõ **bug** (mất toàn vẹn) vs **quyền sản phẩm** (organizer được vượt cap). Đừng biến
  một quyết định sản phẩm thành lỗi kỹ thuật, và đừng bỏ qua một lỗ mất toàn vẹn thật.
- P2: định lượng bao nhiêu chỗ đọc/ghi phải sửa cho mỗi phương án (INSERT-cap vs approval-cap), như cách
  ARCH-02 định lượng 83 read-site.
- P3: sửa re-mint là điều kiện TIÊN QUYẾT để mốc funnel ~02/08 có nghĩa. Nhưng cân: có đáng instrument
  cả 4 bề mặt đăng ký ngay, hay chỉ sửa join + nhánh doubles (mặc định) là đủ để đo?
- Tất cả: đối tượng ~95% VN mobile-first, song ngữ; native /apple cùng đợt nếu chạm UI.
- Nhắc D5 vẫn mở; kết quả panel này KHÔNG được claim đã giải D5 — nó chỉ làm cho việc đo D5 khả thi.

---

## Câu trả lời của Cuong (2026-07-21) — thu nhỏ phạm vi

**P1 — Organizer ĐƯỢC vượt cap.** → "race" giữa `organizer_add_team` và self-register **KHÔNG phải bug**, là quyền sản phẩm. Không thêm lock cho organizer-add. Chỉ còn residual nhỏ: self-register check status TRƯỚC khi lấy lock (`20260721010000:60`) nên về lý thuyết có thể insert sau khi close-registration đóng giải — panel đánh giá residual này đáng vá hay bỏ qua, KHÔNG mở rộng lock ra organizer.

**P2 — Không cap cứng, chỉ hiện số thật.** → KHÔNG enforce ở INSERT/approval. Việc còn lại: sửa progress bar hard-code 25% (`OpenRegistrationSection.tsx:51`) → hiện `đăng ký thật / player_count`, + cảnh báo nhẹ khi vượt. Không chặn ai. Đây là fix hiển thị, không phải fix toàn vẹn.

**P3 — Để panel cân.** → Đây là câu hỏi thiết kế THẬT còn lại. Panel định lượng chi phí mỗi bề mặt (singles đã có / doubles mặc định / DoublesElim / TeamMatch) và khuyến nghị cắt ở đâu để mốc funnel 02/08 đo được D5, rẻ nhất. Bắt buộc gồm: sửa join anon→login (không re-mint journey id) — không có cái này thì mọi instrument khác vô nghĩa.

**Trọng tâm panel giờ:** P3 (telemetry scope) là chính; P1 = residual nhỏ đánh giá vá/bỏ; P2 = fix hiển thị cơ học. Panel đừng thổi P1/P2 lại to — Cuong đã quyết.
