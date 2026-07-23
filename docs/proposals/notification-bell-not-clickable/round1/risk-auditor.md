# risk-auditor — round 1 (nguyên văn; external prompt+reply ở external/risk-auditor-gpt56.md)

## Verdict: 🟡 AMBER
Cách sửa sai (Fix A quên đổi `md:block`→`md:inline-flex`, hoặc Fix A làm hỏng axe span lần nữa) khiến chuông ở AppHeader lệch icon hoặc smoke đỏ lại — nhưng mọi kịch bản đều revert được bằng `git revert` + redeploy, không mất/rò dữ liệu, không đụng native/migration/push.

Classifier said: AMBER (cả Fix A lẫn Fix B) · Em **giữ nguyên AMBER**, không nâng: đây là CSS/component client-only, không SSR, không DB, không auth, fully revertible. Không hạ xuống GREEN vì đây là element tương tác trên **mọi trang TheLineLayout cho toàn bộ ~2k user đã đăng nhập** và có đường làm hỏng thêm nếu Fix A ẩu.

## Rủi ro cụ thể

| # | Mức | Cơ chế hỏng | Người dùng thấy gì | Giảm thiểu |
|---|-----|-------------|--------------------|------------|
| 1 | TB | **Fix A** giữ nguyên `className="hidden md:block"` khi dời lên Button: `.md\:block{display:block}` override `inline-flex` của shadcn Button ở ≥768px → `items-center/justify-center` không còn tác dụng | Chuông desktop (AppHeader `:141`) lệch icon lên góc, badge unread lệch chỗ | Đổi `hidden md:block` → `hidden md:inline-flex`. `md:hidden` (`:204`) giữ nguyên vì base Button đã `inline-flex` |
| 2 | TB | **Fix A** dời `tl-icon-btn` lên Button ở TheLineLayout: `[data-theme="the-line"] .tl-icon-btn` (spec 0,2,0) thắng `.h-10.w-10` (0,1,0) → Button co từ 40px về 36px + có border/bg transparent → **thay đổi hình ảnh** | Chuông đổi kích thước/viền (thực ra khớp hơn với nút dark-toggle) | `visual.yml` snapshot sẽ đỏ → phải cập nhật baseline có chủ đích. **Fix B không có rủi ro này** (chỉ đổi pointer-events trên pseudo vô hình → snapshot xanh) |
| 3 | Thấp | **Fix A** làm lại phần Radix `asChild`/merge className qua `cn()` — nếu lỡ bọc lại `<span>` như trước sẽ tái sinh axe `aria-allowed-attr` (span role-less nhận `aria-haspopup`) | Smoke CI đỏ lại (lịch sử #447 chuông ARIA đỏ kinh niên) | Giữ đúng pattern hiện tại: `Trigger` là forwardRef Button, spread `{...props}`. Đã verify trong `UnifiedNotificationBell.tsx:38-49` |
| 4 | Thấp | **Fix B** mất 4px mở rộng hit-area của pseudo → tap target chuông = 40px (Button `size="icon"` = `h-10 w-10`) | Vùng bấm chuông nhỏ hơn 4px mỗi chiều | Chấp nhận được: **giống hệt** 2 chuông AppHeader đang chạy tốt (không có `tl-icon-btn`), trên ngưỡng WCAG 2.5.8 AA (24px). Không phải regression |

## SLO bị đe doạ
- Không SLO nào trong 7 SLO bị đe doạ trực tiếp. Đây là **sửa** một tính năng đã hỏng 2 tuần, không tạo rủi ro mới cho Availability/auth/registration/scoring/cron/latency/push. Bug hiện tại (chuông chết) không nằm trong SLO nào — chỉ là UX defect. Rủi ro duy nhất: Fix A ẩu làm smoke post-deploy đỏ → auto-revert kích hoạt (đúng như thiết kế, không phải incident).

## Ngân sách hiệu năng
- Bundle: **Fix B +~45 bytes CSS** (1 dòng, không gzip đáng kể) → không chạm trần 1970 KB. **Fix A ~neutral** (bỏ 1 `<div>`, đổi 1 class). Cả hai không thêm render work trên `/feed`, không waterfall mới.
- Vietnam p75 impact: **Không đáng kể.** Không thêm JS, không thêm network. Sửa CSS/DOM tĩnh.

## SEO
- Routes SSR bị ảnh hưởng: **none.** Chuông là client-only — `UnifiedNotificationBell` trả `null` khi `!user`, server-side render (bot, không login) không bao giờ render chuông. Không chạm `functions/_middleware.ts`, `_lib/render/`, sitemap, canonical/hreflang.
- Cần bump `pr:v30`? **Không** — SSR output không đổi.
- Verify: không cần curl Googlebot (không có surface SEO nào thay đổi).

## Kế hoạch rollback
- Cơ chế: `git revert <sha>` + redeploy Cloudflare Pages. Thuần CSS/component client.
- Thời gian khôi phục: ~3-5 phút (thời gian build + deploy CF Pages).
- Không revert được: **không có gì.** Không migration, không native `/apple` (chuông SwiftUI riêng, khác code path — đã verify recon), không push đã gửi, không Worker deployed.

## Phải verify trước khi merge
- [ ] Nếu chọn **Fix A**: `grep` xác nhận cả 2 call site AppHeader (`:141` `hidden md:block`, `:204` `md:hidden`) đã sửa `md:block`→`md:inline-flex`; chạy `visual.yml` và cập nhật baseline chuông có chủ đích.
- [ ] Nếu chọn **Fix B**: viết `[data-theme="the-line"] div.tl-icon-btn::after { pointer-events: none }` (scope theme để né tranh cãi specificity — đã chứng minh không cần nhưng zero-cost).
- [ ] **Test chống tái phát (BẮT BUỘC, không optional)** — bug sống im 2 tuần vì zero coverage. Thêm 1 test vào `tests/journeys.spec.ts` (project `journeys`, đã có auth storageState): vào trang TheLineLayout, `await bell.click()` (Playwright click THẬT — hit-test, sẽ throw "intercepts pointer events" như bug hiện tại), assert panel `[data-state="open"]`. Smoke KHÔNG cover được vì chạy logged-out, chuông = `null`.
- [ ] `npm run test` + `npm run lint` xanh; smoke preview xanh trước merge.

## Phản biện độc lập (GPT-5.6)
- **Đã xác minh trong repo (giữ lại):**
  - Fix A phải đổi `hidden md:block` → `hidden md:inline-flex`, không thì `md:block` override `inline-flex` làm icon lệch — khớp phân tích của em và RCA doc.
  - Fix B để tap target ở 40px inner Button (mất 4px expansion) — đúng, nhưng em thêm: bằng đúng chuông AppHeader đang chạy, trên ngưỡng AA.
  - Không có `<div class="tl-icon-btn">` nào khác (chỉ chuông; còn lại là `<button>`/`<a>`) — grep xác nhận.
  - Fix A không tái phát axe (Radix gắn aria-* lên Button thật) — xác nhận.
  - Smoke logged-out không bắt được → test phải ở project `journeys` — xác nhận với `playwright.config.ts`.
- **Bác bỏ:** GPT-5.6 tuyên bố dòng đầu **"Fix B không sửa được production, thua specificity"** — **SAI**. Specificity giải quyết **theo từng property**, chỉ giữa các rule khai báo **cùng** property. Rule themed hiện tại khai báo `content/position/inset`, KHÔNG khai báo `pointer-events`, nên `div.tl-icon-btn::after{pointer-events:none}` (specificity thấp hơn) không có đối thủ để thua. **Đã test trực tiếp trên Chromium headless** (repro tối giản, rule themed specificity cao hơn): `getComputedStyle(div,'::after').pointerEvents` = **`none`**, `elementFromPoint` tại tâm button = **`btn`** (không phải div). Fix B đúng như viết là chạy được. GPT-5.6 nhầm "rule specificity cao thắng element" thành "thắng property". Nguyên văn prompt + reply + adjudication ở `external/risk-auditor-gpt56.md`.

---

**Khuyến nghị chọn hướng (auditor, không chốt):** Fix B là hướng rủi ro thấp nhất mà vẫn diệt đúng cơ chế gốc (pseudo phantom nuốt pointer) — 1 dòng CSS, không đụng JSX, không visual diff, không rủi ro axe, không chạm 3 call site. Fix A là "purist" nhưng blast radius lớn hơn (3 file + audit display-class + baseline visual + soát lại axe). Cả hai đều AMBER và revert được; kèm test `journeys` là điều kiện merge cho cả hai.

Panel note: chạy đủ 2 model (risk-tier classifier + GPT-5.6), không one-model-down.

Lưu ý mâu thuẫn nội bộ ghi nhận bởi orchestrator: bảng rủi ro #4 ghi Button size=icon = `h-10 w-10` (40px) trong khi solution-architect đọc `button.tsx:33` ra `h-11 w-11` (44px) — cần đối chất vòng 2.
