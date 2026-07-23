# pre-mortem — round 1 (nguyên văn)

## Pre-mortem: notification-bell-click-fix

**Bối cảnh đã verify:** bug gốc = `[data-theme="the-line"] .tl-icon-btn::after { inset:-4px }` (`src/styles/the-line.css:2838`) đè lên `<div className="tl-icon-btn">` bọc ngoài bell (`src/components/social/notifications/UnifiedNotificationBell.tsx:93` mobile, `:109` desktop). Pseudo nằm trên button trong paint order, `pointer-events:auto` mặc định → nuốt mọi click chuột. Chết âm thầm từ 2026-07-09, không một test/smoke nào chạm tới click chuông (recon: zero coverage). Ba câu chuyện dưới đây giả định fix đã ship và đã hỏng theo ba cơ chế khác nhau.

---

### Sự cố 1 — "Sửa xong chuông vẫn chết, nhưng lần này ai cũng tưởng đã fix"
**Xác suất:** cao · **Thời gian tới lúc phát hiện:** 4–10 ngày (hoặc không bao giờ, tự đóng bằng "chắc do cache")

Giả định fix đã ship: **Option A** — đưa `className` vào `Trigger`→`Button` (đúng pattern), nhưng lazy-diff **giữ nguyên** `<div className={className}>` bọc ngoài ở `UnifiedNotificationBell.tsx:93/109` vì xoá div phải sửa cả return của cả nhánh mobile lẫn desktop.

**Timeline**
- T+0: PR "fix(a11y): bell trigger clickable" merge. Diff cho thấy `className` giờ chảy qua `Trigger` (`:41`) và spread vào `Button` (`:48`) — panel gật đầu: "đúng sách giáo khoa asChild".
- T+0: dev verify bằng `button.click()` trong console → panel mở → tick done. (Đây chính là cái bẫy đã ghi trong `01-repro-rca.md`: `button.click()` LUÔN mở, chỉ click chuột thật mới chết.)
- T+3: Cuong lướt homepage, bấm chuông thật → vẫn chết. Nghĩ "chắc CF chưa purge / cache SW", hard-reload, vẫn chết, nhưng bận việc khác nên bỏ qua.
- T+8: một user nhắn Facebook "chuông vẫn ko bấm được" → mới mở lại.

**Cơ chế**
`UnifiedNotificationBell.tsx:93` (`<div className={className}>` **không bị xoá**) → `className="tl-icon-btn"` giờ nằm trên **cả** wrapper div **lẫn** Button (`:46` cn merge) → `the-line.css:2838` gắn `::after` vào **cả hai** element → div-cha vẫn là 36×36 box với `::after inset:-4px` phủ 44px, vẫn nằm trên Button con trong paint order → click chuột thật vẫn không bao giờ chạm `<button>`. Fix là **no-op**.

**Vì sao mọi gate vẫn xanh**
(a) diff *nhìn* đúng — reviewer đọc "className moved to Button" là ✅; (b) không có test click nào tồn tại để chuyển đỏ; (c) CI/lint/tsc xanh vì code hợp lệ; (d) dev tự-verify bằng `.click()` JS thay vì click chuột thật — đúng cái false-positive mà chính RCA đã cảnh báo nhưng không ai biến thành assertion.

**Ai báo, sau bao lâu:** User Facebook, ~8 ngày. Không alert, không test đỏ. Tệ hơn bản gốc: giờ có PR "đã fix" nên report lần hai bị nghi là lỗi cache của user.

**Vì sao khó sửa:** `git revert` vô nghĩa (fix vốn là no-op). Phải chẩn lại từ đầu — và người sửa lần hai đọc thấy "đã fix rồi" trong lịch sử nên mất thêm thời gian tin rằng nó thật sự chưa fix.

**Dấu hiệu sớm lẽ ra phải có:** assertion `elementsFromPoint(bellCenter)[0]` phải là `<button>` — RCA đã có sẵn công thức, chỉ thiếu ai đó biến thành test.

**Phòng được bằng gì:** 1 Playwright assertion `await bell.click()` rồi `expect(panel).toBeVisible()` — click thật của Playwright dispatch qua hit-test, no-op sẽ đỏ ngay.

---

### Sự cố 2 — "Chuông sống lại 12 ngày, rồi một PR CSS không liên quan giết nó lần nữa — vẫn không ai biết"
**Xác suất:** cao · **Thời gian tới lúc phát hiện:** 2–3 tuần (đúng bằng lần đầu)

Giả định fix đã ship: **Option A làm ĐÚNG** (xoá wrapper, className vào Button). Chuông thật sự sống lại.

**Timeline**
- T+0: fix đúng, chuông click được. Đóng ticket. **Vẫn không thêm test** ("bug CSS vặt, thêm test làm gì").
- T+12: một phiên khác chỉnh `the-line.css` — đổi `position: relative`, bọc lại header, hoặc thêm wrapper `<div className="tl-icon-btn ...">` mới quanh cụm nav-right → `::after` lại phủ lên Button → click chết lại.
- T+12 → T+33: chết âm thầm y hệt lần đầu. Không ai bấm chuông trong lúc dev, RUM không đo "click không mở panel".
- T+33: lại một user report.

**Cơ chế**
`the-line.css:2838` là quy tắc `::after` **toàn cục theo class**, không neo vào element cụ thể. Bất kỳ thay đổi nào khiến `tl-icon-btn` lại rơi lên một element-cha-của-button (class dùng chung ở 6 chỗ: `TheLineLayout.tsx:500,510,664,694,841,1010`) đều tái lập bug. Không có ràng buộc nào ghim "pseudo hit-area chỉ được sống trên `<button>`".

**Vì sao mọi gate vẫn xanh:** fix không để lại **regression sentinel**. CI xanh, soak 30' xanh (soak không bấm chuông), Lighthouse xanh (không đo click-to-open). Cơ chế hỏng nằm ở **chỗ nối CSS↔DOM**, không ở file bị sửa — diff review của PR-thứ-hai (chỉ đụng CSS) không có lý do nhìn tới bell.

**Ai báo, sau bao lâu:** User, ~3 tuần — đúng bằng khoảng im lặng của bug gốc.

**Vì sao khó sửa:** không mất dữ liệu, revert dễ. Cái mất là **niềm tin**: lần thứ ba chuông chết mà pipeline mù.

**Dấu hiệu sớm lẽ ra phải có:** đo lường "bell click → panel open rate". Backend đã có văn hoá watchdog (edge-blob-watchdog, uptime-ping) nhưng **không có watchdog nào cho tương tác frontend** — điểm mù có hệ thống.

**Phòng được bằng gì:** cùng 1 test ở Sự cố 1, đưa vào **smoke required** (không phải soak) → mọi PR đụng header/CSS đều phải qua nó.

---

### Sự cố 3 — "Sửa được chuông, nhưng nút hamburger và nút quay-lại co lại 36px trên mobile"
**Xác suất:** trung bình · **Thời gian tới lúc phát hiện:** rất lâu / có thể không bao giờ (chỉ lộ qua tỉ lệ mis-tap)

Giả định fix đã ship: **CSS-scope làm quá tay** — sửa thẳng `the-line.css:2838` thành `... .tl-icon-btn::after { ...; pointer-events: none; }` cho **mọi** `.tl-icon-btn`, không scope theo tag/element.

**Timeline**
- T+0: thêm `pointer-events:none` vào rule gốc. Chuông hết nuốt click → verify desktop → tick done.
- T+0: cùng dòng đó vô hiệu hoá **hit-area 44px** của tất cả nút `<button class="tl-icon-btn">` thật.
- T+n (nhiều tuần): người dùng mobile mis-tap nút hamburger/back nhưng không ai report — họ bấm lại lần hai, coi như tay run.

**Cơ chế**
`::after inset:-4px` được thêm bởi #300 đúng mục đích "36px visual, 44px effective hit area" phục vụ các button THẬT: `TheLineLayout.tsx:841` (hamburger ≤900px), `:500/:510` (back), `:1010` (mode toggle). `pointer-events:none` toàn cục → các nút này tụt hit-area từ 44px về 36px → dưới ngưỡng WCAG 2.5.5/2.5.8 → mobile khó bấm. Blast radius rơi vào 5 sibling dùng chung class.

**Vì sao mọi gate vẫn xanh:** CI xanh vì hit-area không phải lỗi build. Axe không bật rule target-size mặc định (bài học `lighthouse-ci-failing-repo-wide.md`: `incomplete`≠pass). Dev test desktop bằng chuột không cảm nhận được. Không gate nào đo kích thước vùng chạm trên viewport mobile.

**Ai báo, sau bao lâu:** gần như **không ai** — mis-tap không sinh report, chỉ sinh khó chịu ngầm trên đúng đối tượng 95% (mobile VN).

**Vì sao khó sửa:** revert dễ *nếu* phát hiện — nhưng nó không tự phát tín hiệu. Sửa đúng = scope lại selector (`div.tl-icon-btn::after` hoặc `.tl-icon-btn:not(button)::after`).

**Dấu hiệu sớm lẽ ra phải có:** check target-size ≥44px trên các control trong `tl-nav` ở viewport 375px. Không tồn tại.

**Phòng được bằng gì:** scope fix theo element (`div.` / `:not(button)`); kèm 1 assertion bounding-box ≥44 cho hamburger ở 375px.

---

## Xếp hạng

| # | Sự cố | Xác suất | Khó phát hiện | Ưu tiên |
|---|-------|----------|---------------|---------|
| 1 | Fix no-op (className kẹt trên cả div + Button) | cao | TB (report lần 2 bị đổ cho cache) | **P0** |
| 2 | Fix đúng nhưng CSS-regression tái phát, không sentinel | cao | cao (3 tuần, đúng bằng lần đầu) | **P0** |
| 3 | CSS quá tay giết hit-area 5 sibling button | TB | rất cao (không sinh report) | P1 |

## Rẻ nhất để chặn từ bây giờ

1. **Một Playwright assertion** (đưa vào smoke *required*, không phải soak): đăng nhập → `page.getByLabel('Thông báo').click()` → `expect(notif panel).toBeVisible()`. Bắt được cả ba sự cố.
2. **Scope selector theo element ngay trong fix**: `.tl-icon-btn:not(button)::after { pointer-events:none }` — chặn Sự cố 3 tại gốc.
3. **Assertion bounding-box** `hamburger.boundingBox().height >= 44` ở 375px — rẻ, chặn regression hit-area về sau.

## Khoảng hở của pipeline mà bài này lộ ra

Pipeline có watchdog *backend* dày (edge-blob-watchdog, uptime-ping, deploy-guard) nhưng **zero giám sát tương tác frontend** — không smoke nào click một control và assert kết quả UI. Hệ quả: một class-CSS-hỏng-hit-test sống 2 tuần, và bất kỳ fix nào cho nó cũng sẽ chết lại âm thầm vì không có gì đứng gác chỗ nối CSS↔DOM. Gate lẽ ra phải bắt = một smoke "click-and-assert" cho các control sinh-tồn (bell, hamburger, avatar menu). Feedback thẳng cho `/idea`: đừng chỉ fix pseudo-element — đóng luôn lỗ "không ai click thử trong CI".

Files load-bearing: `src/styles/the-line.css:2828-2844`, `src/components/social/notifications/UnifiedNotificationBell.tsx:41-49,93,109`, `src/components/ui/button.tsx:8,33,52`, `src/components/layout/TheLineLayout.tsx:500,510,664,694,841,1010`, `src/components/layout/AppHeader.tsx:141,204`.
