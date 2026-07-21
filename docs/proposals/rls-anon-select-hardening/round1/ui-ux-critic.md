# ui-ux-critic — rls-anon-select-hardening (nguyên văn)

Panel đầy đủ 2 model (GPT-5.6 exit 0). Prompt + reply đã lưu vào `docs/proposals/rls-anon-select-hardening/external/`. Dưới đây là đánh giá UI/UX.

---

## Đánh giá tổng thể

Đây là fix bảo mật backend nhưng cơ chế của nó (REVOKE + column-GRANT) có mặt UX **cứng và dễ gãy**: privilege cột trong Postgres **không theo dòng** — bất kỳ `select('*')` nào chạm 1 cột bị revoke là **toàn bộ query lỗi `42501`**, kể cả đội trưởng đọc chính đội mình. Nghĩa là mọi `select('*')` trên `team_match_teams` (web + native) đều gãy trừ khi được thu hẹp cột hoặc chuyển sang RPC **trong cùng đợt ship**. Nếu chỉ ship migration mà quên vá client, người dùng court-side mở link Facebook sẽ thấy **danh sách đội trắng trơn không lời giải thích** (page vẫn load vì tournament đọc từ bảng khác). Fix này serve được user, nhưng chỉ khi vá-client và migration đi liền một PR.

## Luồng người dùng

- **Anon từ link FB → `/tools/team-match/:id`**: hook `useTeamMatchTeams` (`select('*')`) → lỗi cột → `teams` undefined → hiện tại code **nuốt lỗi** (không đọc `isError`), `displayTeams=[]` → tab Teams/Standings rỗng như thể "chưa có đội". Đây là điểm gãy chính cho user chính.
- **Đội trưởng đăng nhập**: `useUserTeam` (`select('*')` lọc `captain_user_id`) cũng gãy — vì privilege cột không theo dòng. Banner "bạn đã đóng phí / chờ BTC" (`TeamMatchPaymentSection:102` đọc `myTeam.payment_status` từ list) mất dữ liệu.
- **Đội trưởng share mã mời**: nút "Copy invite code" ở `TeamRosterManager:358-366`. Đã kiểm chứng: **không có route/input nào tiêu thụ `team_match_teams.invite_code`** — `/join/:code` (`JoinTeam.tsx`) đọc `quick_table_partner_invitations`, bảng khác. Mã này copy ra là ngõ cụt.
- **Native viewer**: list query xin `payment_status` cho mọi người → gãy → list native trắng.
- **Organizer**: dialog xoá giải (`MyTournaments:224` đếm `paidTeams`) và bảng chip đóng phí (`TeamMatchPaymentSection:207` khi `isOwner`) đều đọc `payment_status` → gãy cho cả organizer.

## Vấn đề tìm thấy

| # | Mức độ | Vấn đề | Sửa thế nào |
|---|--------|--------|-------------|
| 1 | **Blocker** | Public team list `select('*')` gãy cho anon → trang đội trắng. Migration mà không vá client = page hỏng cho user chính | Thu hẹp `useTeamMatchTeams`/`useTeamMatchTeam`/`TeamList` xuống cột an toàn (`id, tournament_id, team_name, status, seed, group_id, created_at`). Ship **cùng PR** với migration, không tách |
| 2 | **Blocker** | Native list xin `payment_status` cho mọi viewer → gãy toàn bộ decode list. App đã cài không vá được (Postgres bỏ cả query) | Bỏ hẳn `payment_status` khỏi `TeamMatchRepository.swift:44`. Ship native trước migration; version cũ cần app-update, không khôi phục grant để "đỡ" (tái mở lỗ) |
| 3 | **Blocker** | Organizer: đếm `paidTeams` (dialog xoá) + chip đóng phí đều gãy → mất cảnh báo "N đội đã đóng sẽ bị xoá" | RPC `SECURITY DEFINER` scoped organizer, trả về tổng hợp/roster. Lazy khi mở dialog/tab, **không** trên first paint |
| 4 | **Blocker** (luồng captain) | Banner đóng phí của chính đội trưởng mất dữ liệu (`payment_status` từ list) | Captain-scoped RPC trả `payment_status` + timestamp cho đội của mình; `TeamMatchPaymentSection` đọc từ RPC thay vì list |
| 5 | Nên sửa | `TeamMatchView` nuốt lỗi hook → query **fail** hiển thị y hệt **rỗng thật**. Sau migration lỗi này trầm trọng hơn | Đọc `isError` từng section, render inline error card (không toast) + nút "Thử lại". "Chưa có đội" chỉ hiện sau response thành công |
| 6 | Nên sửa (là dọn rác) | Nút "Copy invite code" ngõ cụt | **Xoá** nút + toast + prop `inviteCode`. Không xây RPC để giữ. Nút "Copy link" (share URL) đã có sẵn ở header, thừa sức thay thế |
| 7 | Nit | Nếu thêm chip "chưa đóng phí" tránh dùng đỏ | Đỏ = `--tl-live` trong The Line. Unpaid = chip outline trung tính; gold=chờ, green=đã xác nhận |

## Trạng thái màn hình

- **Empty (thật, danh sách đội)**: `Chưa có đội nào đăng ký.` / `No teams have registered yet.` — chỉ hiện sau response 200.
- **Loading**: `Đang tải danh sách đội…` / `Loading teams…`. Skeleton hàng đội, không spinner toàn trang (page vốn đã có tournament header render trước).
- **Error (list fail)**: inline card `Không tải được danh sách đội.` / `Couldn't load the team list.` + nút `Thử lại` / `Try again`. **Không** toast (biến mất quá nhanh court-side), **không** biến thành "0 đội".
- **Error (standings/matches phụ thuộc)**: `Không tải được bảng xếp hạng.` / `Không tải được lịch thi đấu.` — 1 nút "Thử lại" refetch chung query đội an toàn.
- **Offline (Capacitor/PWA, có cache)**: giữ nội dung cached + banner không chặn `Bạn đang ngoại tuyến. Dữ liệu có thể chưa được cập nhật.` / `You're offline. This information may be out of date.`
- **Offline (không cache)**: `Bạn đang ngoại tuyến. Kết nối mạng rồi thử lại.` / `You're offline. Connect to the internet and try again.`
- **Permission/session (RPC organizer/captain)**: `Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.` (không phải lỗi mạng chung chung).

## Accessibility (WCAG 2.1 AA)

- Nút "Thử lại" phải là `<button>` thật, ≥44px hit area (`docs/design-tokens.md` §Touch targets), có label rõ.
- Inline error card cần `role="status"`/`aria-live="polite"` để screen-reader court-side nghe được, thay vì list âm thầm rỗng.
- Chip trạng thái đóng phí: không dựa **chỉ** vào màu (đỏ/vàng/xanh) — kèm text ("Chưa đóng"/"Chờ xác nhận"/"Đã xác nhận"), đạt contrast ≥4.5:1. Lưu ý bài học `lighthouse-ci-failing-repo-wide` (chip `.count` từng fail 3.7:1) — chip mới phải qua axe color-contrast.
- Không có regression bàn phím/focus mới (chỉ đổi data-fetch + copy).

## Copy đề xuất (VI / EN) — sẵn dán

Chip đóng phí (chỉ hiện cho captain/organizer, gắn nhãn "Phí tham dự" để không lẫn với status đội `confirmed`):
- unpaid → `Phí tham dự: Chưa đóng` / `Entry fee: Unpaid`
- claimed → `Phí tham dự: Chờ BTC xác nhận` / `Entry fee: Awaiting organizer confirmation`
- confirmed → `Phí tham dự: Đã xác nhận` / `Entry fee: Confirmed`

Organizer roster:
- Loading `Đang tải tình trạng đóng phí…` / `Loading payment statuses…`
- Error `Không tải được tình trạng đóng phí.` / `Couldn't load payment statuses.`
- No permission `Bạn không có quyền xem thông tin đóng phí của giải này.`
- Nút `Xác nhận đã nhận phí` / `Confirm payment received`; đang chạy `Đang xác nhận…`; **không** đổi chip lạc quan trước khi RPC thành công.

Dialog xoá giải (đếm tách, không gộp `claimed` vào "đã đóng"):
- `Đã xác nhận: {{confirmed}} đội · Chờ xác nhận: {{pending}} đội. Khi xoá giải, toàn bộ dữ liệu đóng phí cũng sẽ bị xoá.`
- Giữ nút "Xoá giải đấu" **disabled** khi summary đang load/lỗi + nút "Thử lại" — tránh xoá mà mất cảnh báo phí.

## Panel đa model

- **Đồng thuận Claude + GPT-5.6** (tín hiệu mạnh, 2 model độc lập):
  1. **Xoá** nút copy invite-code, không cứu bằng RPC — mã dẫn tới ngõ cụt; giữ lại là giữ lời hứa gãy. Share dùng URL `/tools/team-match/:id` (Claude bổ sung: nút "Copy link" ở header **đã có sẵn**, không cần thêm action mới).
  2. **Degrade per-section, không chặn cả trang**: tournament header/rules/status vẫn hiện; lỗi nằm trong khối team-list dưới dạng inline card + "Thử lại", **không** toast, **không** biến lỗi thành "0 đội".
  3. **Ẩn hẳn `payment_status` khỏi viewer** (web đã ẩn — chỉ `isOwner` thấy chip; native theo parity): đây là thông tin tài chính, `claimed` chưa phải đã trả, hiện công khai gây hiểu nhầm + áp lực đội.
  4. **1 RPC organizer batched là chấp nhận được**, lazy khi mở tab/dialog, không first-paint; captain đọc đội mình qua captain-scoped RPC.
  5. Lỗi permission **không bao giờ** render thành empty-state hợp lệ.

- **Bất đồng**: Không có bất đồng thực chất. GPT-5.6 xếp mọi thứ ngang mức "fix"; Claude **nâng 4 mục lên Blocker** (public list, native list, organizer payment, captain banner) vì tất cả là **regression sống** cho user court-side/organizer nếu migration ship mà thiếu vá-client — không phải "nice-to-have". **Chốt: giữ Blocker cho 4 mục #1-4**, lý do: đặc thù Postgres column-privilege khiến "quên 1 select" = màn hình trắng thật, không phải xuống cấp nhẹ; đây là quyết định thứ tự ship (client trước/cùng migration), phải để Cuong thấy rõ mức độ.

Files liên quan: `docs/proposals/rls-anon-select-hardening/external/ui-ux-critic-gpt56-prompt.md`, `docs/proposals/rls-anon-select-hardening/external/ui-ux-critic-gpt56-reply.md`. Touch surface UX: `src/pages/TeamMatchView.tsx:113,246-298,314`, `src/hooks/useTeamMatchTeams.ts:54-116,592-612`, `src/components/teamMatch/TeamDetailSheet.tsx:133`, `src/components/teamMatch/TeamRosterManager.tsx:266-366`, `src/components/teamMatch/TeamMatchPaymentSection.tsx:101-218`, `src/pages/MyTournaments.tsx:224-231`, `apple/ThePickleHub/Core/TeamMatch/TeamMatchRepository.swift:44,426`.
