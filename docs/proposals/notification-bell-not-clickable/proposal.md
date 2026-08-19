# Chuông thông báo không bấm được (click-dead bell)

> Slug: `notification-bell-not-clickable` · Ngày: `2026-07-23` · Trạng thái: `shipped`
> Sinh bởi `/idea`. Panel 4 agent: `solution-architect` · `ui-ux-critic` (+GPT-5.6) ·
> `risk-auditor` (+GPT-5.6) · `pre-mortem`. Model ngoài: xem `external/*.meta.json`.
> Model thiếu key trong lần chạy này: `none`
>
> **Raw audit trail**: `round1/*.md` · `round2/*.json` · `external/*.md` · `debate.json` · `01-repro-rca.md`
>
> ⚠️ **Ghi chú trung thực của orchestrator:** `scripts/agents/debate-ledger.mjs` và `scripts/agents/risk-tier.mjs` KHÔNG tồn tại trong repo (kiểm tra cả `origin/main`) dù lệnh `/idea` yêu cầu chạy chúng. Luật vòng 2 được cưỡng chế thủ công: mọi CONCEDE/REFINE đều kèm evidence file:line, không có concede trần nào. Tier verdict là của risk-auditor, không có classifier độc lập để đối chiếu.

---

## 0. 🔶 Cần anh quyết

Panel hội tụ về hướng fix (không còn bất đồng về code). Còn **2 quyết định vận hành + 1 scope**:

| # | Vấn đề | Phía A | Phía B | Nếu chọn sai thì sao |
|---|--------|--------|--------|----------------------|
| D2b | **Gate chống tái phát**: repo private free-plan **không có branch-protection required checks** (gh api trả 403 "Upgrade to GitHub Pro") — không test nào chặn merge được về mặt cơ học | `pre-mortem`: phải có gate cưỡng chế — tức nâng GitHub Pro hoặc đổi kỷ luật auto-merge (chờ checks xanh mới merge) | `risk-auditor`: chấp nhận backstop hiện có — journeys chạy mọi PR + Telegram alert khi đỏ trên main + người thật revert | Chọn B mà không ai đọc Telegram → sự cố "tái phát im lặng 3 tuần" của pre-mortem thành hiện thực lần 2 |
| D3 | **Bug liền kề**: hook nuốt lỗi → panel hiện "Chưa có thông báo" GIẢ khi 4G rớt/fetch fail (`useUnifiedNotifications.ts` `?? []`) | `ui-ux-critic` (+GPT-5.6): blocker-grade trust bug, đừng để rơi âm thầm | `risk-auditor`: đồng ý sửa nhưng TÁCH PR riêng (đổi hành vi React Query, cần test riêng) | Gộp vào hotfix → khó cô lập nguyên nhân nếu smoke đỏ; bỏ quên → user sân bãi tiếp tục thấy rỗng-giả |
| — | **A-later polish** (tuỳ chọn): co chuông về 36px viền 1px khớp nút dark-mode sibling | Làm sau khi B đã cầm máu (cả panel) | Không làm (chưa ai than 2 tuần nay) | Chỉ là thẩm mỹ — không có rủi ro chức năng |

**Khuyến nghị của orchestrator cho cả 3:** D2b → tối thiểu là kỷ luật "không auto-merge trước khi playwright.yml xanh" (miễn phí, làm được ngay); D3 → tách PR riêng ngay sau hotfix; A-later → để backlog thẩm mỹ.

---

## 1. Ý tưởng gốc

> "nút thông báo bell ring ko click vào được, ko mở ra cái gì"

**Làm rõ ở bước 0:**

| Hỏi | Trả lời |
|---|---|
| Ai dùng | Mọi user đã đăng nhập (bell = đường vào duy nhất xem thông báo trên web) |
| Đau ở đâu | Web mobile **và** desktop — bấm chuông không phản ứng gì hết, như chỗ chết |
| Thành công = | Bấm chuông mở panel thông báo trên cả 2 viewport |
| Ràng buộc | — (bug prod, càng nhanh càng tốt) |

---

## 2. Verdict — đọc cái này trước

| | |
|---|---|
| **Rủi ro** | 🟡 AMBER |
| **Khuyến nghị** | **Option B** — 1 dòng CSS scoped, chỉ chạm đúng surface đang hỏng, ship được ngay |
| **Công sức** | 1 nửa ngày (0.5 fix + 0.5 test journeys) |
| **Rủi ro lớn nhất** | Fix không kèm test → tái phát im lặng như 2 tuần qua (pre-mortem Sự cố 2) |
| **Auto-merge** | Được sau khi qua gate (AMBER) — nhưng xem D2b ở mục 0 |

**Root cause (verify runtime trên prod, không phải suy đoán):** `.tl-icon-btn::after { position:absolute; inset:-4px }` (`src/styles/the-line.css:2838`, thêm bởi PR #300 `c5428303` ngày **2026-07-09** để mở hit-area 44px cho các nút icon) nằm trên **div bọc** chuông (`TheLineLayout.tsx:694` truyền `className="tl-icon-btn"` → `UnifiedNotificationBell.tsx:93/109` áp vào `<div>` thay vì Button). Pseudo-element hit-test như element gốc (div) và đè trên button trong paint order → **mọi click chuột/chạm target vào div, event không bao giờ đi qua button** → Radix onClick không fire. Bằng chứng: click thật = chết; `button.click()` JS = panel mở; `elementsFromPoint` cho div xuất hiện TRÊN button; computed `::after` = 42×42 `pointer-events:auto`. Chi tiết: `01-repro-rca.md`.

- **KHÔNG phải regression #447** (PR ARIA hôm qua) — span cũ cũng nằm trong div bọc, chết y hệt. Hỏng từ 2026-07-09, đúng 2 tuần, không ai/không test nào phát hiện.
- Keyboard (Tab+Enter) vẫn sống — chỉ pointer chết. Nút dark-mode cùng class vẫn chạy vì ở đó class nằm trên chính `<button>`.
- Chỉ trang TheLineLayout dính (homepage…); 2 mount AppHeader không dùng class này nên vẫn tốt. Native /apple có bell SwiftUI riêng, không liên quan.

---

## 3. Đã có sẵn gì (recon)

**Prior art:** `UnifiedNotificationBell.tsx` là bell sống duy nhất (Popover desktop / Drawer mobile, Radix asChild đã đúng chuẩn sau #447). `NotificationBell.tsx` là dead code (Link tới /notifications, không ai import). Realtime mount 1 lần ở App.tsx qua `NotificationsRealtimeInitializer`.

**Sẽ đụng vào:** `src/styles/the-line.css` (1 dòng) + `tests/journeys.spec.ts` (1 test). KHÔNG đụng: component JSX, AppHeader, SSR/prerender, Supabase, native.

**Ràng buộc đã ghi trong repo:** `.tl-icon-btn` có 6 consumer — 5 là `<button>`/`<a>` thật đang DỰA vào `::after` để đạt hit-area 44px (back ×2, mode toggle ×2, hamburger); chỉ 1 là div bọc bell. Fix nào tắt pseudo toàn cục sẽ giết hit-area của 5 nút kia (pre-mortem Sự cố 3).

**Test coverage hiện tại: ZERO** — không test nào click chuông (smoke chạy logged-out nên bell = null).

---

## 4. Phương án (solution-architect)

### Option B — 1 dòng CSS scoped ✅ KHUYẾN NGHỊ

Effort: 0.5 nửa ngày (+0.5 test) · Files: `src/styles/the-line.css` · Data: none

```css
/* Bell mount wraps the button in a <div class="tl-icon-btn"> (UnifiedNotificationBell).
   Its ::after overlay would eat the real click. Real icon buttons are <button>,
   so the div. selector spares them — they keep the 44px hit-area. */
[data-theme="the-line"] div.tl-icon-btn::after { pointer-events: none; }
```

Selector chỉ match `<div>` bọc bell; 5 nút `<button>`/`<a>` thật giữ nguyên hit-area 44px. Button bên trong tự nó đã 44px (`button.tsx:33` `h-11 w-11`) nên bell không mất gì về a11y. Được: blast radius = đúng 1 surface hỏng, không visual diff, không rủi ro axe, ship ngay. Mất: để lại smell "className của button nằm trên div" + lệch hình pre-existing với sibling. Đóng cửa: không — Option A vẫn làm được sau, đè lên sạch.

Lưu ý kỹ thuật đã được kiểm bằng thí nghiệm (risk-auditor bác GPT-5.6): specificity resolve **theo từng property** — rule gốc không khai báo `pointer-events` nên rule mới không có đối thủ; đã test Chromium headless: `elementFromPoint` trả về button sau khi áp rule.

### Option A — Bỏ div bọc, className vào Button trigger

Effort: 1.5 nửa ngày · Files: `UnifiedNotificationBell.tsx`, `AppHeader.tsx:141` · Data: none

Root-cause "đúng sách" + trả visual parity (bell thành 36px viền 1px như dark-toggle). Nhưng: đụng cả 2 mount AppHeader **đang chạy tốt** (`hidden md:block` phải thành `md:inline-flex` — gotcha display-utility ship-broken-âm-thầm), buộc update baseline visual.yml, phải soát lại axe (#447), QA 3 surface × 2 viewport. Nếu làm ẩu (giữ div bọc, className nằm cả 2 nơi) → fix thành **no-op** (pre-mortem Sự cố 1). → Để làm PR polish riêng SAU hotfix, nếu Cuong muốn.

### Option C — `pointer-events:none` toàn cục cho `.tl-icon-btn::after` ❌ CẤM

Giết hit-area 44px của 5 nút thật → mobile mis-tap âm ỉ không ai report (pre-mortem Sự cố 3). Không làm.

### Khuyến nghị

**B.** Cả 3 agent hội tụ ở vòng 2 bằng bằng chứng repo (xem mục 7). A thua vì đổi rủi ro thật (3 file, 2 surface lành, baseline churn) lấy lợi ích thẩm mỹ; lợi thế a11y của A = 0 vì button đã 44px sẵn.

### Increments

1. **1 dòng CSS** vào `the-line.css` cạnh rule gốc (~:2840) — verify: click chuột thật trên preview mở panel; mode-toggle click mép -4px vẫn ăn.
2. **Test chống tái phát** vào `tests/journeys.spec.ts` (project journeys, authed qua auth-setup): mở trang TheLineLayout → `getByRole('button', {name: /Thông báo/}).click()` → expect panel visible. Playwright click thật đi qua hit-test → bắt được cả no-op lẫn tái phát. **Điều kiện merge, không optional.**
3. (Riêng, sau) PR sửa hook nuốt lỗi + error state (D3) · (Riêng, tuỳ chọn) PR polish A.

---

## 5. UI/UX (ui-ux-critic + GPT-5.6)

### Đánh giá tổng thể

Vòng 1 critic khuyến nghị A (parity); vòng 2 tự verify AppHeader + button.tsx rồi REFINE về "ship B tối nay, parity làm sau" — luận điểm a11y của A sụp khi xác nhận B giữ nguyên 44px. Phát hiện giá trị nhất của critic không phải hướng fix mà là **bug liền kề D3**: chuông sau fix vẫn "nói dối" khi mạng rớt.

### Vấn đề (đầy đủ ở `round1/ui-ux-critic.md`)

| # | Mức | Vấn đề | Sửa |
|---|-----|--------|-----|
| 1 | Blocker | Click chết (bug gốc) | Option B — hotfix này |
| 2 | Blocker-grade, pre-existing | Hook nuốt lỗi → "Chưa có thông báo" GIẢ khi fetch fail (`useUnifiedNotifications.ts` `?? []`, `NotificationList.tsx:72`) | **Tách PR riêng (D3)**: throw khi cả 2 res lỗi → error state + nút "Thử lại" |
| 3 | Should | Bell ghost 44px không viền lệch với dark-toggle 36px viền 1px | PR polish A-later (tuỳ chọn) |
| 4 | Should (a11y) | Drawer mobile thiếu `DrawerTitle` — dialog không tên với screen reader | Gộp vào PR D3 |
| 5 | Should (a11y) | Số chưa đọc không vào `aria-label` (tĩnh "Thông báo") | Gộp vào PR D3; KHÔNG dùng aria-live |
| 6 | Should | Nút "Đánh dấu đã đọc" 28px < 44px touch target | Gộp vào PR D3 (`min-h-11`) |
| 7-8 | Nit | `80vh`→`80dvh`, contrast badge | Backlog |

### Trạng thái màn hình + Copy (VI/EN) — cho PR D3

- **Error:** "Không tải được thông báo" / "Couldn't load notifications" · "Vui lòng thử lại." · nút "Thử lại"/"Retry"
- **Offline** (chỉ khi `navigator.onLine === false`): "Bạn đang ngoại tuyến" / "You're offline" — không suy đoán offline từ timeout
- **Empty** (chỉ sau success 0-item): "Chưa có thông báo" (giữ nguyên)
- aria-label động: "Thông báo, {n} thông báo chưa đọc" / 9+ → "hơn 9"

### Panel đa model

- Claude + GPT-5.6 đồng thuận: error ≠ empty; số chưa đọc vào aria-label; DrawerTitle thật; mark-all ≥44px.
- Bất đồng vendor đáng chú ý: GPT-5.6 (phía critic) ủng hộ A ở vòng 1 — nhưng critic Claude tự lật về B ở vòng 2 khi thấy fact mới; GPT-5.6 (phía auditor) claim "B không chạy được vì specificity" bị auditor **bác bằng thí nghiệm Chromium**. Bài học: đồng thuận cross-vendor vòng 1 về A tan khi fact repo vào cuộc — bằng chứng thắng đồng thuận.

---

## 6. Rủi ro (risk-auditor + GPT-5.6 + pre-mortem)

### Verdict: 🟡 AMBER

Classifier: **không chạy được** (`scripts/agents/risk-tier.mjs` không tồn tại trong repo) — tier là đánh giá của auditor, orchestrator không hạ.

| # | Mức | Cơ chế hỏng | User thấy gì | Giảm thiểu |
|---|-----|-------------|--------------|------------|
| 1 | Cao (nếu làm A ẩu) | className kẹt trên cả div lẫn Button → fix no-op, verify bằng `.click()` JS cho pass giả | Chuông vẫn chết, report lần 2 bị đổ cho cache | Chọn B; test Playwright click thật |
| 2 | Cao | Fix không kèm sentinel → PR CSS tương lai tái phát, im lặng 3 tuần nữa | Chuông chết lần 3 | Test journeys là điều kiện merge |
| 3 | TB | Scope CSS sai (toàn cục) giết hit-area 5 nút thật | Mobile mis-tap hamburger/back, không ai report | Selector `div.tl-icon-btn::after` (chỉ div) |
| 4 | Thấp | ~~B để tap target 40px~~ **SAI FACT, đã rút** — button = 44px (`button.tsx:33`) | — | — |

### SLO / Perf / SEO

- SLO: không SLO nào bị đe doạ — đây là sửa tính năng đã hỏng. Bundle: +~45 bytes CSS, không chạm trần 1970 KB. Vietnam p75: không đổi (zero JS mới).
- SEO: **không** — bell là client-only sau login, bot không bao giờ render. Không bump `pr:v30`, không cần curl Googlebot.

### Rollback

- `git revert` + CF Pages redeploy, ~3-5 phút. **Không có gì không revert được** (không migration, không native, không worker) → không phải RED.

### Phản biện độc lập (GPT-5.6)

- Đã xác minh: gotcha `md:block`→`md:inline-flex` nếu chọn A; smoke logged-out không cover bell; không còn `<div class="tl-icon-btn">` nào khác.
- **Bác bỏ:** claim "Fix B thua specificity, không chạy trên prod" — sai (specificity resolve theo property; rule gốc không khai báo pointer-events). Auditor chứng minh bằng repro Chromium headless. Nguyên văn ở `external/risk-auditor-gpt56.md`.

### Pre-mortem (3 sự cố — toàn văn ở `round1/pre-mortem.md`)

1. Fix no-op vì className nằm cả 2 nơi (nếu A ẩu) — chặn bằng Playwright click thật.
2. Tái phát im lặng vì không sentinel — chặn bằng test journeys + gate (D2b, mục 0).
3. CSS quá tay giết hit-area 5 nút sibling — chặn bằng selector scoped `div.`.

Khoảng hở hệ thống pre-mortem lộ ra: repo có watchdog backend dày nhưng **zero giám sát tương tác frontend** — không CI nào click một control và assert kết quả. Test journeys đầu tiên cho bell là viên gạch đầu.

---

## 7. Tranh luận trong panel

> ⚠️ `debate-ledger.mjs` không tồn tại trong repo — bảng dưới do orchestrator tổng hợp thủ công từ `round2/*.json`; mọi move đều có evidence file:line (đã kiểm từng cái). Cuong đối chiếu được với raw files.

| ID | Bất đồng | Vòng 1 | Vòng 2 | Kết quả |
|----|----------|--------|--------|---------|
| D1 | Fix A vs B | architect: B · critic (+GPT-5.6): A · auditor: lean B | architect REFINE (button.tsx:8,16,33) · critic REFINE (AppHeader:141,204 + button.tsx:33) · auditor HOLD-lean-B + CONCEDE fact 40px | **RESOLVED → B**; A-later = polish tuỳ chọn |
| D2 | Test ở smoke-required vs journeys | pre-mortem: smoke required · auditor: journeys | pre-mortem REFINE/CONCEDE placement (playwright.config.ts:47-50,104-109) · auditor REFINE (playwright.yml:4-7 + gh api 403) | **RESOLVED placement → journeys**; phần gate → **OPEN_FOR_CUONG (D2b, mục 0)** |
| D3 | (mới v2) Sửa hook nuốt lỗi trong hotfix? | — | critic HOLD (blocker-grade, phải lên bàn Cuong) · auditor: tách PR | **OPEN_FOR_CUONG (mục 0)** — cả 2 chấp nhận tách PR, khác ở ưu tiên |

### Bất đồng bị giết ở vòng 2 (ảo — thiếu thông tin)

- **D1**: chết bởi 2 fact — `button.tsx:33` (44px → lợi thế a11y của A = 0, risk #4 của auditor sai) và `AppHeader.tsx:141,204` (blast radius của A là thật). Critic tự mở file và tự lật — đúng cách vòng 2 phải chạy.
- **D2 phần placement**: chết bởi `UnifiedNotificationBell.tsx:89` (`!user → null`) + `playwright.yml:4-7` (workflow "smoke" thực chất chạy CẢ journeys trên mọi PR — tên gây hiểu lầm, cả 2 agent vòng 1 đều không thấy).

### Bất đồng sống sót (thật — cùng dữ kiện, khác đánh giá)

- **D2b**: gate cưỡng chế — fact mới của auditor (403 GitHub Pro) làm cả 2 lập trường vòng 1 vô nghĩa; giờ là quyết định tiền/kỷ luật của Cuong, không phải kỹ thuật.
- **D3**: mức ưu tiên của bug rỗng-giả — trust-bug (critic) vs risk-isolation (auditor). Điều chứng minh critic đúng: telemetry/report cho thấy user gặp panel rỗng khi có unread. Điều chứng minh auditor đúng: hotfix merge sạch trong 1 ngày không kéo scope.

### Nhượng bộ bị LOẠI

Không có — mọi CONCEDE đều kèm file:line (pre-mortem: playwright.config.ts; auditor: button.tsx:33).

### Ghi chú độc lập-vs-căn cứ

Đồng thuận có nghĩa duy nhất ở vòng 1 (GPT-5.6 + critic Claude cùng chọn A) đã **tan ở vòng 2 trước fact repo** — trong khi GPT-5.6 phía auditor còn bị bác bằng thí nghiệm. Nhắc lại đúng nguyên tắc của lệnh: 2 Claude gật nhau không phải bằng chứng, và cross-vendor cũng thua thực nghiệm.

---

## 8. Kế hoạch verify

**Tự động (trong /ship):**

- [ ] `npx eslint` các file đổi (CSS không cần, test .ts có)
- [ ] `npx tsc -b --noEmit`
- [ ] `npm run test` (unit không đổi — phải vẫn xanh)
- [ ] `npm run build` + `check-bundle-size.mjs` (+45 bytes, phải pass)
- [ ] Playwright journeys mới: bell click thật → panel mở (trên preview URL)
- [ ] Preview thủ công qua Chrome: click chuột thật vào chuông trên trang TheLineLayout → panel mở; click mép -4px của mode-toggle vẫn ăn (hit-area 5 nút thật còn nguyên)
- [ ] Post-deploy prod: lặp lại click thật trên www.thepicklehub.net (orchestrator đã có sẵn quy trình repro trong `01-repro-rca.md`)

**Cuong phải tự làm (agent không làm được):**

- [ ] Bấm chuông trên điện thoại thật (Safari iOS + Chrome Android) sau deploy — Drawer mở
- [ ] Quyết 3 mục ở **mục 0** (D2b gate, D3 scope, A-later)

---

## 9. Sau khi ship

- SHA: `9e77431a` (squash) · PR: #454 · Ngày: 2026-07-23
- **Verify prod:** merge → CF Pages deploy success → smoke `/` 200, `/feed` 200, Googlebot `/` 200 (title+og:image+hreflang en/vi/x-default), seo-verify 39/0. J11 (real-click chuông) PASS thật trên CI (`journeys.spec.ts:342`, không skip). Rule CSS live trong bundle preview + prod.
- **Khác kế hoạch:**
  - Option B đúng như đề xuất, không đổi. 1 dòng CSS + J11.
  - CI đỏ 2 check (Visual regression, Security/codeql) — **cả hai thuần GitHub artifact-storage-quota** (job chết ở bước upload, phần gate thực chất "Visual diff advisory" + "Gate on CodeQL findings" đều success). Cuong duyệt phương án A (merge vượt 2 đỏ quota). Không phải regression từ fix.
  - **Sự cố nền tảng chen ngang:** Supabase blob-loss (`NOT_FOUND_FUNCTION_BLOB`) đánh sập 68/76 edge function giữa lúc ship → làm đỏ contract test trong Playwright smoke. Vá tay bằng `functions deploy --use-api` (heal 0/76), re-run smoke → xanh. **Tái phát lần nữa GIỮA SOAK** → vá tay lần 2. Fix chuông KHÔNG liên quan; prod home/feed giữ 200 suốt.
- **Học được:** xem `.claude/memory/lessons-learned.md` — coupling quota↔self-heal.
