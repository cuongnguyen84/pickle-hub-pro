# risk-auditor — DS-03 (2026-07-18, nguyên văn)

Two key corrections to GPT's output:
- Theme is on `<html>` (`:root[data-theme="the-line"]`, the-line.css:16; main.tsx:5-6 confirms `index.html`). Radix Dialog portals to `document.body` = descendant of `<html>` → portaled dialogs DO inherit theme tokens. GPT's failure mode #4 is refuted for the current setup.
- RegistrationModal already gives every button an explicit `type` (main: lines 758, 950, 1028, 1036...). GPT's "default type=submit" is not a current bug — only a migration regression risk.

---

## Verdict: 🔴 RED
Bản migration `TLComponents.swift` mang một behavior-defect (focus/dismiss/selection sai trong Dialog/Sheet/Select native) ra App Store review — **không có nút revert**, kẹt nhiều ngày; ở web, chuẩn hoá Button/Dialog trong `RegistrationModal` làm mất `type=` hoặc disabled-semantics → double-submit → **overbook sự kiện có thu phí** (SLO 3).

Classifier said: RED · Em giữ RED. Refine phạm vi: **native `apple/.../TLComponents.swift` = RED cứng (không revert được)**; phần web (`src/components/ui/*.tsx`, `the-line.css`) = AMBER revert-được-bằng-`git revert`, nhưng chứa 1 hạng mục Cao (money path). Verdict tổng = RED vì lấy max.

## Rủi ro cụ thể

| # | Mức | Cơ chế hỏng | Người dùng thấy gì | Giảm thiểu |
|---|-----|-------------|--------------------|------------|
| 1 | Cao | Migration Button/IconButton trong `RegistrationModal.tsx` (main) làm rơi `type="button"`/`type="submit"` tường minh (hiện đủ ở dòng 758/950/1028/1036/1050/1145...) HOẶC dời disabled sang `aria-disabled`/`asChild`→`<a>`. `button.tsx:41` không set default type → button mới trong `<form>` (dòng 670/769/982) mặc định `type=submit`. | Bấm "resend OTP"/"back"/chọn slot lại submit đăng ký; double-tap gửi 2 request → server race confirm cả 2 → 2 slot cho 1 người, event over-capacity | Giữ nguyên `type` tường minh; thêm 1 test "rapid double-click = đúng 1 rpc call" (21 test hiện chỉ assert accessible-name + `.disabled`, KHÔNG cover single-request); root fix = idempotency/unique-constraint phía DB, không dựa disabled |
| 2 | Cao | `TLComponents.swift` thêm TLDialog/TLSheet/TLSelect/TLIconButton. `apple-tests.yml` chỉ compile + unit test scoring/scheduling — **0 UI/snapshot test**. SwiftUI compile qua được cả khi: nút confirm bị keyboard che, label VI clip dưới Dynamic Type, Sheet recreate mất selection, dismiss trước khi commit state | User native không hoàn tất được form đăng ký / không chạm được action trong sheet / mất data sau dismiss; bản lỗi kẹt App Store nhiều ngày | Tách release native SAU khi web ổn định; thêm snapshot/UI test có mục tiêu cho `DesignSystem/Components/`; test tay VI + Dynamic Type + VoiceOver trước submit |
| 3 | Cao | Thay field bằng TL Select giữ `onChange(event)` cũ trong khi Radix Select emit `onValueChange(value)` (controlled `value` vs uncontrolled `defaultValue`, thiếu `name`) | User chọn club/loại-event/slot nhìn thấy đúng, submit báo "thiếu trường bắt buộc" hoặc gửi giá trị cũ / tạo event sai giá trị | Test contract assert **object submit thực tế**, không chỉ pixel; pixel-diff + TS không bắt payload corruption |
| 4 | TB | Barrel eager import cả 8 component (Radix Dialog/Select/Sheet) vào graph gốc; headroom INITIAL chỉ ~15 KB | CI chặn (tốt); nếu path đo bị lọt → first paint chậm cho mobile VN | Giữ import tree-shakeable trực tiếp, lazy-load overlay theo route; bài học perf-js-gzip: verify bằng `dist/index.html`, không tin config manualChunks |
| 5 | TB | Ratchet DoD(b) đếm aggregate grep count: PR xoá 1 `.tl-btn` + thêm 1 chỗ khác → tổng không đổi, gate xanh; miss raw `<button>`, class multiline, wrapper đổi tên | Nhiều tháng sau app vẫn mixed button behavior dù CI xanh; lặp đúng bài học "Lighthouse đỏ toàn repo bị ignore" | Ratchet phải là ESLint AST-aware bắt violation **trên changed lines**, không dùng tổng; debt count báo riêng, không dùng làm proof |
| 6 | TB | Ba API song song sau DS-03: raw `.tl-btn` (113 file), shadcn `<Button>` (102 file), `<TLButton>` mới. Retrofit shadcn KHÔNG đụng `.tl-btn` — surface thật của themed screen | Bug sửa 1 nơi còn 2 nơi; nút khác chiều cao/loading/focus giữa các màn | Canonical component phải sở hữu `.tl-btn` (migrate/deprecate có kế hoạch), không standardize nhánh thiểu số |
| 7 | TB | IconButton generic không bắt buộc `aria-label`/`accessibilityLabel`; tooltip không phải accessible name trên touch | VoiceOver đọc chuỗi "button" không phân biệt được close/back/QR/share → không thao tác được flow đăng ký | Bắt buộc label là required prop cả 2 nền |
| 8 | TB | `visual.yml` là **advisory (continue-on-error, dòng 62)**, self-skip đến khi có baseline, baseline chụp từ **production** (`visual-baseline.yml:15`). Deploy tự động từ `main` → regression live TRƯỚC khi được chụp; chụp baseline mới = "bless" luôn trạng thái hỏng | Dialog overflow/spacing regression merge lúc 2am, deploy chạy tiếp, user thấy ngay, solo-op biết qua support chứ không qua CI | Với north-star screens: fixture tất định + baseline commit TRƯỚC migration, và check này phải **block merge**, không lấy live data làm oracle |

## SLO bị đe doạ
- **SLO 3 (Registration):** rủi ro #1 — double-submit/wrong-button trong RegistrationModal → registration insert sai/nhân đôi, overbook. Đây là incident, không phải rate.
- **SLO 6 (Latency VN p75):** rủi ro #4 — barrel eager kéo Radix vào INITIAL, ăn ~15 KB headroom.
- **SLO 1 gián tiếp:** nếu Dialog/theme regression làm màn đăng ký/hero không render đúng — nhưng availability shell vẫn 200.

## Ngân sách hiệu năng
- Bundle INITIAL: hiện ~265.2 KB / 280 KB (headroom ~15 KB). Nếu giữ import tree-shakeable + lazy overlay → +0. Nếu tạo barrel eager → có thể vượt 280 và CI chặn. **Verdict: an toàn NẾU không barrel; phải verify bằng `dist/index.html` (INITIAL gate), không tin manualChunks.**
- CSS: `the-line.css` 4154 dòng. Retrofit shadcn variant (thêm class TL vào cva) làm phình `.tl-*`/CSS parse cost mà INITIAL-JS gate KHÔNG đo. Cần theo dõi PERF-01 CSS budget riêng.
- Vietnam p75: trung tính nếu không barrel; label VI dài + Dynamic Type là rủi ro layout (CLS) native, không phải web bundle.

## SEO
- Routes SSR bị ảnh hưởng: **none**. Đã verify: `functions/_lib/render/` KHÔNG import `src/components/ui` — chỉ `blog-meta.ts` đọc `src/content/blog/metadata.ts`. Prerender bot phát HTML riêng, độc lập cây React.
- Cần bump `pr:v29`? **No** — SSR output không đổi. (Chỉ bump nếu vô tình sửa `functions/_lib/render/`.)
- Verify (chỉ cần nếu render/ bị đụng): `curl -A "Googlebot" https://www.thepicklehub.net/su-kien/<slug>` → expect 200 + title + og:image + hreflang.

## Kế hoạch rollback
- Web (`src/components/ui/*`, `the-line.css`): `git revert` + Cloudflare redeploy. Thời gian khôi phục: ~5-10 phút.
- Native (`TLComponents.swift`): **KHÔNG revert được** — ship qua App Store review, nhiều ngày, không nút revert. Bản hỏng kẹt store đến khi Apple duyệt bản fix.
- **Không revert được (lý do RED):** native build đã submit; và nếu double-submit đã tạo registration/payment thừa thì phải dọn data thủ công (không phải revert code).

## Phải verify trước khi merge
- [ ] Grep sau migration: mọi `<Button>`/`<button>` trong `RegistrationModal.tsx`, `QRPaymentStep`, TeamMatch payment vẫn có `type=` tường minh — `grep -n 'type="' src/components/social-events/RegistrationModal.tsx | wc -l` không giảm.
- [ ] Chạy `npm run test -- RegistrationModal.money-path` — 21 test xanh; NẾU đỏ = refactor đổi behavior, sửa refactor không sửa test.
- [ ] Thêm 1 test double-click → đúng 1 `rpc`/`invoke` call (coverage gap hiện tại).
- [ ] `node scripts/check-bundle-size.mjs` sau build: INITIAL ≤ 280 KB; verify entry graph bằng `dist/index.html`.
- [ ] Native: build `apple-tests.yml` xanh (compile) + test tay flow đăng ký trên simulator nhỏ, keyboard mở, VI + Dynamic Type + VoiceOver.
- [ ] Ratchet: xác nhận đếm theo changed-lines (AST), thử PR "xoá 1 + thêm 1 raw button" phải ĐỎ.

## Phản biện độc lập (GPT-5.6)
- **Đã xác minh trong repo (giữ lại):**
  - #1 double-submit/type: `button.tsx:41` không set default type; RegistrationModal dùng `<form onSubmit>` (main dòng 670/769/982). Cơ chế regression thật — nhưng code HIỆN TẠI đã kỷ luật (mọi button có `type`), nên đây là rủi ro *migration*, không phải bug sống.
  - #2 native no-rollback + `apple-tests.yml` 0 UI test — xác nhận (file chỉ chạy scoring/scheduling unit).
  - #3 Select onChange vs onValueChange, #5 ratchet aggregate-count, #6 barrel eager INITIAL, #7 three-API sprawl (113 vs 102 file), #9 IconButton thiếu aria-label, #8 visual.yml advisory (dòng 62, baseline từ prod) — tất cả khớp repo.
  - "SEO unchanged" — xác nhận đúng.
- **Bác bỏ / sửa:**
  - **Failure mode #4 (Dialog portal render ngoài theme): SAI với setup hiện tại.** `data-theme="the-line"` đặt trên `<html>` (`:root[data-theme]`, the-line.css:16; main.tsx:5-6 xác nhận ở `index.html`), Radix Portal portal vào `document.body` = con của `<html>` → dialog/sheet/select portaled VẪN thừa kế token theme. Chỉ thành rủi ro NẾU DS-03 dời data-theme xuống subtree — giữ làm guardrail, không phải finding.
  - GPT nói `.tl-btn` "~389 files" — số thật là **113 file** `.tsx` chứa `tl-btn` (recon 389 là grep rộng gồm cả css/chuỗi lặp). Không đổi kết luận (blast radius vẫn lớn), chỉ đính chính con số.
  - #1 mô tả "thường quên `type`" như thể đang xảy ra — không đúng: code hiện tại có `type` đầy đủ. Đã hạ khung thành rủi ro có điều kiện (migration làm rơi).

Panel chạy đủ 2 model (OPENAI_API_KEY có, exit 0). Prompt + reply nguyên văn: `external/risk-brief.md` + `external/risk-openai.md`.
