# DS-03 — Chuẩn hoá 8 component (web + native SwiftUI)

> Slug: `ds-03-component-standardization` · Ngày: `2026-07-18` · Trạng thái: `shipped` — PR #403 squash `39db6490`, 2026-07-18
> Sinh bởi `/idea`. Panel 4 agent: `solution-architect` · `ui-ux-critic` (+GPT-5.6) ·
> `risk-auditor` (+GPT-5.6) · `pre-mortem`. Model ngoài chính xác: xem `external/*.meta.json`.
> Model thiếu key trong lần chạy này: `none`
>
> **Raw audit trail**: `round1/*.md` · `round2/*.json` · `external/*.md` (+`.meta.json`) · `debate.json` / `debate-table.md`

---

## 0. 🔶 Cần anh quyết

Panel đối chất xong hội tụ về MỘT phương án chung ở cả 3 mục dưới (không còn hai phe đối đầu),
nhưng theo luật ledger, REFINE-hội-tụ không tự đóng được bất đồng — anh gật thì thành quyết định:

| # | Vấn đề | Đề xuất thống nhất của panel | Nếu chọn khác thì sao |
|---|--------|------------------------------|------------------------|
| D2 | Native "cùng đợt" nghĩa là gì | **Code native merge cùng increment với web** (git-revertable, đúng intake của anh). **RED chỉ neo vào bước SUBMIT App Store** — bị chặn tới khi có: snapshot test `DesignSystem/Components` ở `.dynamicTypeSize(.accessibility3)`, `TLSheet` luôn bọc `ScrollView`, test tay VI/Dynamic Type/VoiceOver trên máy nhỏ | Submit sớm không guard → bug UI native (vd sheet cắt mất nút Xác nhận ở cỡ chữ lớn) kẹt App Store nhiều ngày, không có nút revert |
| D3 | Double-submit money-path còn là rủi ro Cao không | **Hạ Cao→Thấp** — risk-auditor tự mở file kiểm chứng bằng chứng của pre-mortem: UNIQUE `payment_orders.registration_id`, handler idempotent, advisory lock DB-01/01c, unique index registrations, OTP single-use → double-tap tệ nhất = 1 click thừa bị server từ chối. Web tier = AMBER (còn risk Select payload) | Giữ Cao → tốn effort chống một cơ chế không tồn tại trong repo, trong khi risk thật (Select `onValueChange`) bị loãng |
| D4 | API Button | **1 variant MỚI duy nhất `tl-primary`** (fill kem `--tl-fg` — không variant sẵn nào thay được, `secondary` dưới theme là nền TỐI #131416); `green→default` (#b5e853 khớp 1:1) và `base→outline` TÁI DÙNG. Bảng map tường minh bắt buộc (chặn codemod đoán-tên lật ~30 nút kem→lime). Residual: `loading` prop — hai bên đổi chỗ cho nhau ở vòng 2; mặc định DEFER sang DS-04, thêm ngay nếu increment nào đụng spinner | Map `primary→secondary` → 30 nút kem thành nền tối (regression thị giác); đẻ đủ 3 variant mới → thêm bề mặt chưa test không cần thiết |

D1 (thiết kế ratchet gate) đã ĐÓNG bằng bằng chứng — không cần anh quyết (xem mục 7).

---

## 1. Ý tưởng gốc

"DS-03 (chuẩn hoá 8 component Button/Input/Card/Dialog…" — từ roadmap Phase 2, chạy `/idea` sau khi DS-02 (#401) merge.

**Làm rõ ở bước 0:**

| Hỏi | Trả lời |
|---|---|
| Platform | Web + native SwiftUI CÙNG ĐỢT |
| Chiến lược web | Để panel đề xuất (retrofit shadcn vs bộ TL riêng) |
| Thành công = | CẢ HAI: (a) 5–8 màn journey chỉ dùng component chuẩn, đo bằng grep/test; (b) gate CI ratchet cho phần còn lại |

---

## 2. Verdict — đọc cái này trước

| | |
|---|---|
| **Rủi ro** | 🔴 **RED** — nhưng đã thu hẹp phạm vi ở vòng 2: RED cư trú DUY NHẤT ở bước **submit App Store native**; phần web = AMBER (revert được bằng `git revert`) |
| **Khuyến nghị** | Option B — thăng `.tl-btn` thành variant của `<Button>` (chỉ 1 variant mới `tl-primary`), chuẩn hoá 4 màn journey, ratchet changed-files; KHÔNG codemod 113 file |
| **Công sức** | ~7 nửa ngày (web + native components; không tính đợt test tay trước native submit) |
| **Rủi ro lớn nhất** | Native submit một build chứa Dialog/Sheet/Select mới chưa từng qua UI test nào (CI native hiện 0 snapshot test) — vì vậy submit bị RED-gate |
| **Auto-merge** | Web increments: được sau khi qua gate. **Native submit: Chặn — cần anh duyệt + checklist test tay** |

Classifier `risk-tier.mjs`: AMBER ("user-facing component"). Auditor nâng lên RED (neo native submit) — theo luật, verdict auditor thắng.

---

## 3. Đã có sẵn gì (recon)

- **shadcn components KHÔNG bypass token** — chúng đã ăn `--tl-*` qua CSS-var override (`[data-theme="the-line"]` redefine `--primary`, `--background`…). Hệ song song thật là **`.tl-btn` CSS class** (400 chỗ/113 file — architect đã đếm lại, recon "389 file" là grep rộng) vs `<Button>` shadcn (147 chỗ/102 file); 12 file dùng cả hai, `SocialEventDetail` trộn 4 tl-btn + 2 Button ngay trong 1 màn.
- Native đã có `TLCard`/`TLPrimaryButton`/`TLTextField` (`TLComponents.swift`, 70 dòng); thiếu Badge/Dialog/Sheet/Select/IconButton. **Bẫy tên:** Swift `TLPrimaryButton` = lime, web `.tl-btn primary` = KEM.
- `check-theline.mjs` chạy changed-files (hex + title); `theline-audit.yml` full-tree nhưng đã bị `|| true` — chính là số phận của mọi gate full-tree.
- Token layer DS-02 vừa xong (#401): parity test 54 assertions web↔Swift.
- 0 test component-usage; `apple/Tests` 0 UI/snapshot test; Playwright **không có WebKit** (chỉ chromium) — điểm mù iOS Safari.
- IconButton chưa tồn tại — chỉ `Button size="icon"`.

---

## 4. Phương án (solution-architect)

### Option A — Big-bang codemod 113 file `.tl-btn` → `<Button>` (~13 nửa ngày)
Sạch tuyệt đối nhưng 400 chỗ sửa với ~0 test phủ = bề mặt regression khổng lồ; review bất khả thi cho 1 người. **Bác.**

### Option B — Thăng variant + journey screens + ratchet (~7 nửa ngày) ⭐
1. `button.tsx` thêm variant `tl-primary` (kem); `green→default`, `base→outline` tái dùng (soi mắt pixel ở inc.1); ép `min-h-11` (44px, đóng luôn phần Button của A11Y-02); bless `size="icon"` + bắt buộc `aria-label` qua type.
2. Native: `TLButton` (enum `.primary/.outline/.green`) thay `TLPrimaryButton` cứng; thêm `TLBadge`, `TLIconButton` (44pt), `TLSelect`, `TLSheet`/`TLDialog` — **`TLSheet` luôn bọc `ScrollView`** (chặn sự cố pre-mortem #3).
3. Chuẩn hoá 4 màn journey theo thứ tự an toàn của ui-ux-critic: `ClubLanding` (canary) → `RegistrationModal` → `CreateSocialEvent` → `SocialEventDetail` (cuối — P1 nhạy nhất).
4. Ratchet gate changed-files (tái dùng `targetFiles()` của `check-theline.mjs:42-65`): file đã đổi không được TĂNG `.tl-btn`/raw `<button>`; **report-only 2 tuần rồi mới enforce** (D1 — đã đóng bằng bằng chứng).

### Option C — Bộ TL component standalone
Tạo hệ thứ BA + vứt a11y có sẵn của radix. **Loại thẳng.**

### Khuyến nghị
**Option B.** `.tl-btn` là ngõ cụt cho A11Y-02/04 + DS-04 (không gắn được props/ref/aria vào CSS class) — mọi thứ phải hội tụ về component có props dù sớm hay muộn; B làm đúng phần bắt buộc ngay, để ratchet gặm phần đuôi miễn phí.

### Increments
1. **Variant bridge web + `TLButton` native** (không đụng call-site). Acceptance: preview cell 3 dáng × {default, disabled, size=icon} khớp screenshot `.tl-btn`; parity test DS-02 xanh; **bảng map tường minh commit vào docs** (D4).
2. **4 màn journey** theo thứ tự canary→…→SocialEventDetail. Acceptance: `grep -c "tl-btn\|style={{"` trong 4 file = 0 (hoặc ≤ danh sách inline-style documented không map được); **21 test money-path xanh nguyên vẹn**; giữ nguyên `type=` tường minh mọi button (`grep -c 'type="'` không giảm); thêm 1 test "double-click submit = đúng 1 rpc/invoke call" (ràng buộc mới của risk-auditor, không ai phản đối).
3. **Ratchet gate** (report-only). Acceptance: chạy trên 3 PR gần nhất không liên quan → xanh cả 3 (tiêu chí chống-flap của pre-mortem); thêm 1 `.tl-btn` vào file đổi → đỏ.
4. **6 component còn lại + native twins** (Input/Select/Card/Badge/Dialog/Sheet). Acceptance: mỗi cái 1 preview cell; native compile + snapshot test `.dynamicTypeSize(.accessibility3)`; **Dialog/Sheet: nút X phải là `DialogPrimitive.Close`** (chặn sự cố pre-mortem #1); Select migration phải có test assert payload submit thật (risk #3).
5. **Enforce ratchet** sau 2 tuần report-only sạch.

**Native App Store submit** — NGOÀI các increment trên, RED-gate riêng: chỉ sau khi web ổn định + snapshot tests + checklist test tay (VI, Dynamic Type AX3, VoiceOver, máy nhỏ, bàn phím mở) — thêm vào `docs/manual-test-backlog.md`.

---

## 5. UI/UX (ui-ux-critic + GPT-5.6)

- **3 Blocker:** B1 bảng map tường minh (kem≠lime — sau vòng 2 chốt: `tl-primary` mới thay vì `secondary`); B2 44px ngay tại DS-03 (`h-11` default, `lg` giữ ~50px hot-path); B3 raw `<button>` trong wizard `CreateSocialEvent.tsx:534-583` mã hoá submit/next/back — migrate phải giữ `type` từng nút.
- Copy: aria-label/close phải qua i18n ("Đóng" — hiện `dialog.tsx:45-48`/`sheet.tsx:63-66` hardcode "Close"); Select placeholder bilingual.
- Giữ nguyên (characterization): disabled hot-path đang là inline `opacity:0.5` (`SocialEventDetail.tsx:498-499`); `Input` `text-base` ≥16px chống zoom iOS; CTA đã-đăng-ký là `<a>` deep-link `/dang-ky/:token` (đừng lồng interactive); focus ring shadcn (migrate từ `.tl-btn` là CẢI THIỆN a11y).
- **Đồng thuận cross-vendor (Claude + GPT-5.6, độc lập):** retrofit shadcn, không xây bộ mới; thứ tự migrate canary-first; IconButton bắt buộc accessible name 44×44.

## 6. Rủi ro (risk-auditor + GPT-5.6 + pre-mortem)

### Verdict: 🔴 RED (phạm vi sau vòng 2: chỉ bước native submit; web = AMBER)
- **Còn đứng (Cao):** Select `onChange(event)`→`onValueChange(value)` payload corruption — test phải assert object submit thật, không chỉ pixel. **Native 0 UI test** trước submit.
- **Đã hạ (Cao→Thấp, D3):** double-submit money-path — server đã phòng thủ đủ tầng (UNIQUE, idempotent, advisory lock, OTP single-use).
- **TB:** barrel eager import ăn INITIAL headroom ~15KB (giữ import trực tiếp, verify `dist/index.html`); `visual.yml` đang advisory + baseline chụp từ prod — với journey screens cần baseline commit TRƯỚC migration; 3-API sprawl nếu không có bảng map + ratchet.
- **Pre-mortem 3 sự cố:** gate flap → bị `|| true` (chặn bằng D1-resolution); TLSheet cắt dưới ở Dynamic Type (chặn bằng ScrollView + snapshot AX3); kẹt modal iOS Safari khi X không còn là `DialogPrimitive.Close` (chặn bằng 1 project WebKit Playwright + test "X đóng được Dialog" — **bổ sung khuyến nghị: thêm WebKit project là việc đáng làm độc lập với DS-03**).
- **Pre-mortem tự bác 3 cơ chế** (không dựng chuyện): 2-payment-order (UNIQUE+idempotent), CSS phình đỏ bundle gate (gate chỉ đếm .js), native invisible-on-light (TLColor dynamic đủ cặp).
- SEO: **không đụng** — `functions/_lib/render/` độc lập cây React, không bump `pr:v29`.
- Rollback: web = `git revert` (~5-10 phút); native = không có nút revert → RED-gate ở submit.
- **GPT-5.6 devil's-advocate:** 8/10 failure mode xác minh khớp repo; 1 bị bác bằng chứng (Radix portal vẫn ăn theme vì `data-theme` ở `<html>` — chỉ thành rủi ro nếu dời xuống subtree, giữ làm guardrail); 1 đính chính số (113 file, không phải 389).

## 7. Tranh luận trong panel

Bảng đầy đủ: `debate-table.md` (sinh bởi `debate-ledger.mjs --strict`, exit 0).

- **Đóng bằng bằng chứng:** D1 ratchet — solution-architect CONCEDE trước `theline-audit.yml:27` (số phận `|| true` của mọi gate full-tree) + `targetFiles()` có sẵn. Chốt: changed-files + report-only 2 tuần; regex trước, ESLint AST nếu lộ lách.
- **Hội tụ chờ anh gật (OPEN_FOR_CUONG):** D2, D3, D4 — xem mục 0.
- **Nhượng bộ bị loại:** không có (0 CONCEDE thiếu bằng chứng).
- **Đồng thuận có nghĩa** (GPT-5.6 vendor khác + Claude độc lập cùng kết luận): retrofit shadcn; ratchet phải fail theo changed-file; IconButton bắt buộc label. Hai-Claude-gật-nhau (risk+pre-mortem về native) được đối trọng đúng cách: pre-mortem cầm bằng chứng LẬT một risk Cao của risk-auditor (D3) — panel không đồng phục.

## 8. Kế hoạch verify

- [ ] Mỗi increment: `npx eslint` · `check-theline` · `tsc --noEmit` · `npm run test` (coverage ≥83%) · build + `check-bundle-size` (INITIAL ≤280KB, verify `dist/index.html`) · `e2e:smoke`
- [ ] Inc.1: screenshot-diff 3 dáng button (đặc biệt green vs default — cần soi mắt); parity DS-02 xanh
- [ ] Inc.2: 21 test money-path nguyên vẹn; `grep 'type="'` không giảm; test double-click=1-call mới; test tay đăng ký trên điện thoại (append `docs/manual-test-backlog.md`)
- [ ] Inc.3: gate xanh trên 3 PR không liên quan gần nhất; đỏ khi thêm `.tl-btn` vào file đổi
- [ ] Inc.4: native `xcodebuild` + snapshot AX3; Dialog X = `DialogPrimitive.Close` (test WebKit nếu đã thêm project)
- [ ] Native submit (RED): checklist test tay đầy đủ + anh duyệt tường minh

## 9. Sau khi ship

- Roadmap: DS-03 → done; mở đường DS-04 (state layer bám props), A11Y-02 (còn phần non-Button), A11Y-04 (axe trên 4 màn đã chuẩn).
- Ratchet baseline giảm dần → cân nhắc codemod phần đuôi khi count đủ nhỏ (Option A trở thành rẻ).
- Đề xuất ngoài scope đáng làm riêng: thêm Playwright WebKit project (điểm mù iOS Safari là lỗ hổng pipeline độc lập với DS-03).


---

## 10. Shipped — khác gì so với kế hoạch (2026-07-18)

- **PR #403 (`39db6490`)** gộp inc.1-4; inc.5 (enforce ratchet) hẹn sau 2026-08-01 nếu 2 tuần report-only sạch. **Native App Store submit CHƯA làm** — RED-gate giữ nguyên, checklist trong docs/manual-test-backlog.md.
- Lệch kế hoạch:
  1. `aria-label` bắt buộc qua type cho `size="icon"`: 61/71 site hiện thiếu → ép type sẽ nổ scope. Chuyển sang ratchet + A11Y-04 dọn dần.
  2. Inline style layout-only (flex/gap) KHÔNG convert — không vi phạm token, audit 2026-07-09 đã xếp churn-giá-trị-thấp.
  3. CTA hot-path SocialEventDetail thấp hơn bản cũ ~5-8px (45px vs 53px, radius 9.25 vs 8) — ui-ux-verifier ghi nhận, vẫn ≥44px; chờ mắt Cuong.
  4. Hex trong D4 ghi `#b5e853` — thực tế `--primary` theme render `#5E7D1F` cả cũ lẫn mới (parity đúng, hex trong doc nhầm nguồn).
  5. qa-verifier bắt 1 regression cosmetic (letter-spacing 0.04→0.06 do specificity `.tl-caps`) — fix bằng inline style giữ characterization.
- Release: release-pilot DỪNG ở risk-tier (mọi file `apple/` = RED tại merge) — đúng luật của nó; merge tiến hành trên duyệt trực tiếp của Cuong trong phiên (proposal RED trình rõ, D2 chốt "merge cùng đợt, RED neo ở submit"), sau khi xác nhận CI không có đường tự động lên App Store. Smoke main đỏ 1 lần vì deploy-race asset 404 (flake đã biết) — prod verify tay lành, rerun xanh.
