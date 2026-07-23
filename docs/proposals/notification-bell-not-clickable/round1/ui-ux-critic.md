# ui-ux-critic — round 1 (nguyên văn; external prompt+reply ở external/ui-ux-critic-gpt56.md)

## Đánh giá tổng thể

Fix click là bắt buộc và đúng hướng — nhưng nếu chỉ vá pointer-events mà không sờ tới hai thứ khác, ta trả cho user một cái chuông *bấm được nhưng vẫn nói dối*: khi mạng 4G rớt gói, `NotificationList` hiện y hệt "Chưa có thông báo" như khi thật sự rỗng (hook nuốt lỗi). Với đúng người dùng ở sân — Android tầm trung, 4G chập chờn — đây là lỗi phá niềm tin ngang với lỗi không bấm được. Tôi và GPT-5.6 độc lập đều chốt: chọn **fix A** (đưa `tl-icon-btn` vào chính `Button`, bỏ div bọc) vì nó vừa sửa tương tác vừa trả lại visual parity với nút dark-mode cạnh nó; fix B chỉ là hotfix để lại lệch hình.

Lưu ý sửa mô tả trong task: `Button size="icon"` hiện là `h-11 w-11` = **44×44px** (đã lên DS-03), không phải 40×40. Nghĩa là bản thân button đã đạt 44px — vấn đề thuần là div bọc `.tl-icon-btn::after` chặn con trỏ, không phải thiếu hit-area trên button.

## Luồng người dùng

Deep-link từ Facebook → trang bất kỳ dùng `TheLineLayout` (homepage, /live, /tournament...) → user đã đăng nhập thấy chuông + badge số ở góc phải header. Task duy nhất: chạm chuông → mở panel (Popover desktop / Drawer mobile) → đọc top-10 thông báo trộn legacy+social → chạm 1 item → mark-read + điều hướng tới `link_url` → panel đóng. Exit: về đúng trận/giải vừa được báo. Hiện luồng đứt ngay bước 1 trên pointer; sau fix, mắt xích yếu tiếp theo là bước "đọc panel" khi fetch fail (thấy rỗng giả).

## Vấn đề tìm thấy

| # | Mức độ | Vấn đề | Sửa thế nào |
|---|--------|--------|-------------|
| 1 | Blocker | Chuông không bấm được bằng pointer (bug gốc). `.tl-icon-btn::after` trên div bọc nuốt click. | Ưu tiên **fix A**: bỏ `<div className={className}>` bọc ở `UnifiedNotificationBell.tsx:93,109`, truyền `className` xuống `Trigger`→`Button`. Cần đổi 2 call site `AppHeader.tsx:141,204` từ `hidden md:block`/`md:hidden` → `hidden md:inline-flex`/`inline-flex md:hidden` vì `block` phá `inline-flex` căn giữa của Button. |
| 2 | Blocker (bug liền kề, pre-existing — Cuong quyết scope) | Lỗi/offline giả trang thành "rỗng". `useUnifiedNotifications.ts` dùng `legacyRes.data ?? []` / `socialRes.data ?? []` — bỏ qua `res.error`. Fetch fail → query resolve `[]` → `NotificationList.tsx:72` render "Chưa có thông báo". User có thông báo chưa đọc, 4G rớt, thấy "không có gì". | Trong `queryFn`: nếu **cả hai** `res.error` (hoặc res chính lỗi) thì `throw` để React Query set `isError`. Thêm nhánh error vào `NotificationList` (copy ở dưới) + nút "Thử lại" gọi `refetch()`. "Chưa có thông báo" CHỈ hiện sau response thành công trả về 0 item. |
| 3 | Should | Bell lệch hình với nút dark-mode kề bên: bell = ghost 44px, không viền, bo 6px, hover bg-accent; dark-toggle = `tl-icon-btn` 36px, viền 1px, bo 8px. | Fix A tự giải quyết (Button thừa hưởng `.tl-icon-btn` 36px+viền+bo8). Nếu buộc chọn fix B thì phải kèm 1 pass restyle Button cho khớp — đừng để nguyên ghost 44px lồi ra khỏi box viền 36px. |
| 4 | Should (a11y) | Drawer mobile thiếu `DrawerTitle`. "Thông báo" ở `NotificationList.tsx:41` là `<span>` trần → dialog không có tên cho screen reader + Radix cảnh báo dev. | Bọc heading bằng `DrawerTitle` (shadcn `drawer.tsx` đã export). Style cho giống span cũ. Không thêm span ẩn trùng lặp. Không có mô tả thì bỏ `DrawerDescription` (đừng bịa filler). |
| 5 | Should (a11y) | Số chưa đọc chỉ có ở badge đỏ, không vào accessible name. `aria-label="Thông báo"` tĩnh (`UnifiedNotificationBell.tsx:47`) — SR không biết có mục chưa đọc. | `aria-label` động kèm số (copy ở dưới). Thêm `aria-hidden="true"` cho badge span (`:52`) để khỏi đọc trùng. **KHÔNG** dùng `aria-live` toàn cục cho realtime — thông báo đến liên tục sẽ nhiễu (YAGNI). |
| 6 | Should | Nút "Đánh dấu đã đọc" cao 28px (`NotificationList.tsx:48` `h-7`) < 44px touch target trên Drawer mobile. | `min-h-11` (giữ text nhỏ, chỉ nới hộp bấm). Kèm: disable khi `unreadCount===0`, đổi label "Đang xử lý…" khi `markAll.isPending`. |
| 7 | Nit | Drawer `max-h-[80vh]` + list `max-h-[60vh]` cố định (`UnifiedNotificationBell.tsx:98`, `NotificationList.tsx:55`) — phí chỗ / giật khi thanh trình duyệt mobile đổi chiều cao. | `max-h-[80dvh]` + `flex flex-col` cho content, list `min-h-0 flex-1 overflow-y-auto`, `pb-[max(1rem,env(safe-area-inset-bottom))]`. |
| 8 | Nit | Badge `text-[10px]` rất nhỏ; đỏ `--destructive` (4 70% 50%) trên chữ trắng cần verify ≥4.5:1. | Sau fix #5 số đã có trong label nên badge chỉ còn trang trí — chấp nhận được; vẫn nên đo contrast 1 lần. |

## Trạng thái màn hình

- **Empty:** `Chưa có thông báo` / `No notifications yet`. Giữ nguyên (đã có, `NotificationList.tsx:75`). Chỉ được render sau response thành công 0 item.
- **Loading:** 3 skeleton row (`:57-61`) — đúng, giữ. Skeleton hợp lý hơn spinner vì layout list biết trước chiều cao, không gây CLS.
- **Error:** *(hiện KHÔNG có — phải thêm)* `Không tải được thông báo` / `Couldn't load notifications`, phụ đề `Vui lòng thử lại.` / `Please try again.`, nút `Thử lại` / `Retry`.
- **Offline (PWA/Capacitor):** chỉ tách riêng nếu có tín hiệu offline chắc chắn (`navigator.onLine === false` / network status native): `Bạn đang ngoại tuyến` / `You're offline`, phụ đề `Kết nối mạng rồi thử lại.` / `Reconnect and try again.`, nút `Thử lại`. Nếu không có tín hiệu tin cậy thì DÙNG CHUNG state Error — đừng suy đoán "offline" từ timeout (server có thể chết chứ không phải mạng user). Nếu đã có cache cũ: giữ list, chỉ chèn banner mảnh phía trên `Không thể cập nhật thông báo.` + `Thử lại` thay vì thay cả màn.

## Accessibility (WCAG 2.1 AA)

Đã kiểm:
- **Keyboard:** Tab+Enter mở panel (RCA xác nhận sống) — sau fix pointer, cả hai path phải cùng chạy. Verify focus trả về nút chuông khi đóng (Radix Popover/vaul lo sẵn, xác nhận) và Android Back đóng Drawer trước khi rời trang.
- **Focus ring:** `Button` có `focus-visible:ring-2` (button.tsx:8) — OK; xác nhận fix A không đè mất bởi `.tl-icon-btn` (class này không set outline nên an toàn).
- **Name/Role/Value:** 2 lỗi — (a) Drawer thiếu accessible name (finding #4); (b) trạng thái chưa đọc không vào name (finding #5).
- **Touch target:** nút chuông 44px đạt; item list đủ cao; mark-all 28px KHÔNG đạt (finding #6).
- Còn lại clean ở mức đọc code.

## Copy đề xuất (VI / EN)

```
aria-label chuông:
  0 chưa đọc  → "Thông báo"                              / "Notifications"
  1 chưa đọc  → "Thông báo, 1 thông báo chưa đọc"        / "Notifications, 1 unread"
  n chưa đọc  → "Thông báo, {n} thông báo chưa đọc"      / "Notifications, {n} unread"
  badge 9+    → "Thông báo, hơn 9 thông báo chưa đọc"    / "Notifications, more than 9 unread"

Error state:
  Tiêu đề : "Không tải được thông báo"   / "Couldn't load notifications"
  Phụ đề  : "Vui lòng thử lại."          / "Please try again."
  Nút     : "Thử lại"                    / "Retry"

Offline state (chỉ khi có tín hiệu chắc):
  Tiêu đề : "Bạn đang ngoại tuyến"       / "You're offline"
  Phụ đề  : "Kết nối mạng rồi thử lại."  / "Reconnect and try again."
  Nút     : "Thử lại"                    / "Retry"

Banner cập-nhật-lỗi (khi vẫn còn cache):
  "Không thể cập nhật thông báo."        / "Couldn't refresh notifications."   [Thử lại / Retry]

Mark-all pending: "Đang xử lý…"          / "Marking…"
```
Copy VI trên là tiếng Việt tự nhiên, không phải dịch máy; đủ ngắn cho panel hẹp.

## Panel đa model

- **Đồng thuận Claude + GPT-5.6** (hai model độc lập cùng kết luận — tín hiệu mạnh):
  1. Chọn **fix A**, không phải fix B — visual parity là lý do phụ nhưng thực chất; fix B chỉ là hotfix để lại lệch hình + div "giả làm control".
  2. Lỗi/offline KHÔNG được normalize thành `[]`; empty và error là hai nghĩa khác nhau; "Chưa có thông báo" chỉ hiện sau success 0-item.
  3. Đưa số chưa đọc vào `aria-label`; **không** dùng `aria-live` toàn cục cho realtime.
  4. `DrawerTitle` thật thay cho span; không bịa `DrawerDescription`.
  5. Mark-all phải ≥44px, disable khi 0 chưa đọc, khóa khi pending.
  6. Copy error/offline: cả hai ra gần như trùng chữ ("Không tải được thông báo" / "Thử lại"); GPT thêm ý hay — đừng đổ lỗi cho mạng user khi chưa chắc là offline.

- **Bất đồng:** Không có bất đồng thực chất. Khác biệt nhấn mạnh duy nhất: GPT-5.6 đề xuất thêm **inline banner giữ cache cũ** khi refetch lỗi (thay vì thay cả màn error). **Chốt của tôi:** đồng ý về nguyên tắc nhưng để **v2** — panel chỉ giữ top-10 read-through, hiếm khi có "cache cũ đáng giữ" trong 1 phiên mở panel; làm full error state trước là đủ, thêm banner-giữ-cache sau nếu telemetry cho thấy refetch-fail-khi-đã-có-data xảy ra thật. Lý do: đúng bậc thang lazy — đừng dựng nhánh state thứ ba cho tình huống chưa đo được.

Các đường dẫn liên quan:
- `src/components/social/notifications/UnifiedNotificationBell.tsx`
- `src/components/social/notifications/NotificationList.tsx`
- `src/hooks/social/useUnifiedNotifications.ts`
- `src/components/layout/TheLineLayout.tsx` (:694 call site), `src/components/layout/AppHeader.tsx` (:141,:204)
- `src/styles/the-line.css` (:2828-2844 `.tl-icon-btn`)
- `docs/proposals/notification-bell-not-clickable/external/ui-ux-critic-gpt56.md` (prompt+reply nguyên văn)
