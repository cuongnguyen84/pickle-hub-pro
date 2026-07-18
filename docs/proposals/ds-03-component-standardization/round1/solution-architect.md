# solution-architect — DS-03 (2026-07-18, nguyên văn)

Key finding: recon's "0 vs 389" is misleading — hai hệ button gần ngang nhau (113 file/400 chỗ `.tl-btn` vs 102 file/147 chỗ `<Button>`), và chúng lẫn nhau ngay trong cùng 1 journey screen (SocialEventDetail dùng cả 4 `tl-btn` lẫn 2 `<Button>`).

---

## Tóm tắt kiến trúc

DS-03 không phải re-skin — cả `.tl-btn` (CSS class) lẫn `<Button>` shadcn đã ăn cùng bộ `--tl-*` token dưới `[data-theme="the-line"]`, nên chúng gần trùng về hình. Vấn đề thật là **API**: một cái là chuỗi className bôi lên `<button>`/`<a>` bất kỳ, cái kia là React component có props. Toàn bộ ticket downstream (A11Y-02 44px, A11Y-04 axe/keyboard, DS-04 loading/disabled/empty state) đều cần **props và ref** — không thể gắn `aria-busy`, spinner, focus-management, hay disabled vào một CSS class. Vì vậy hướng đúng là **thăng `.tl-btn` thành variant của `<Button>`**, chuẩn hoá journey screens trước, rồi dựng ratchet gate đóng băng phần còn lại; KHÔNG codemod cả 113 file trong một PR.

Số liệu đã verify (không tin recon "0 vs 389"):
- `.tl-btn`: 400 chỗ / 113 file (148 `.green`, 30 `.primary`, còn lại base outline). 33 chỗ nằm trên `<a>/<Link>` → cần `asChild`.
- `<Button>` shadcn: 147 chỗ / 102 file. 12 file dùng CẢ HAI. Journey screens trộn lẫn: `SocialEventDetail.tsx` = 4 tl-btn + 2 Button.
- Under theme, `--primary` = optic-lime `#b5e853`; `tl-btn.primary` = fill `var(--tl-fg)` (off-white), `tl-btn.green` = `var(--tl-green)`. → mapping KHÔNG 1:1 với variant shadcn có sẵn; phải thêm variant TL riêng.
- Native (`apple/.../TLComponents.swift`, 70 dòng): có `TLCard/TLPrimaryButton/TLTextField`; thiếu Badge/Dialog/Sheet/Select/IconButton + thiếu biến thể secondary/outline/green cho button.

SSR/route: DS-03 là presentation-layer thuần — **không route mới, không sitemap/hreflang/`functions/_lib/render/` gì cả**. Bundle: không thêm dependency; thêm 2-3 variant vào `cva` = vài chục byte; đổi className string thành `<Button>` là net ~0 JS (Button đã import ở 102 file rồi). Không có RED-tier (không đụng auth/payments/`config.toml`).

---

## Option A — Big-bang unify: codemod cả 113 file `.tl-btn` → `<Button>`

Effort: **~13 nửa ngày** · Files: `src/components/ui/button.tsx` + ~113 file gọi + `TLComponents.swift` + gate · Data: none (presentation-only)

How it works: Thêm 3 variant TL vào `buttonVariants` (`tl` = outline/transparent, `tl-primary` = fg-fill, `tl-green` = green-fill), viết codemod jscodeshift đổi `className="tl-btn ..."` → `<Button variant="...">`, xử lý tay 33 chỗ `<a>/<Link>` thành `<Button asChild><Link/></Button>`. Xoá luôn khối CSS `.tl-btn` (dòng 533-554). Kết thúc còn **một** hệ button duy nhất.

Wins: sạch tuyệt đối, không còn hệ song song, ratchet gate thành trivial (grep `tl-btn` = 0). · Loses: 400 chỗ sửa / 113 file với **~0 test phủ component-usage** → bề mặt regression khổng lồ cho một người; codemod dễ vỡ ở anchor/`asChild`/nested-svg size; review một PR 113-file là bất khả thi, chẻ nhỏ thì mất tính "atomic" vốn là lý do duy nhất chọn A. · Forecloses: không đóng cửa gì về kiến trúc, nhưng đốt 6+ nửa ngày cho phần lẽ ra để ratchet gặm dần miễn phí.

---

## Option B — Thăng variant + chuẩn hoá journey screens + ratchet (the cheap one)

Effort: **~7 nửa ngày** · Files: `src/components/ui/button.tsx`, 4 journey file, `TLComponents.swift`, `scripts/check-theline.mjs` (+ baseline JSON) · Data: none

How it works:
1. **Web primitive** — thêm vào `button.tsx` 3 variant khớp pixel với `.tl-btn`: `tl` (transparent + `border`, radius 8), `tl-primary` (`bg` từ `--tl-fg`), `tl-green` (`--tl-green`, weight 600). Thêm `loading?: boolean` (render spinner + `aria-busy`, disable) và ép `min-h-11` (44px, dọn đường A11Y-02). Đây là "IconButton" luôn: bless `<Button size="icon">` là chuẩn, thêm ràng buộc `aria-label` bắt buộc qua type — **không đẻ component mới**.
2. **Native** — thêm vào `TLComponents.swift`: `TLButton` với enum style (`.primary/.outline/.green`) thay `TLPrimaryButton` cứng; `TLBadge`, `TLIconButton` (44pt min), `TLSelect` (Menu), `TLSheet`/`TLDialog` (`.sheet`/`.presentationDetents`). Tham chiếu token DS-02 (`TLColor.green/accent...`).
3. **Journey screens** — chuyển 4 file (`SocialEventDetail`, `ClubLanding`, `CreateSocialEvent`, `RegistrationModal`) sang 100% component chuẩn, dọn inline style (34/21/10/3) chỗ nào map được về token/variant.
4. **Ratchet gate** — mở rộng `check-theline.mjs`: một baseline count `.tl-btn` toàn repo (hiện 400) trong file JSON committed; CI fail nếu count TĂNG. Giảm thì cho phép (commit baseline mới). Phần 109 file cũ được grandfather, không đụng.

Wins: bề mặt regression = 4 file (verify bằng grep, không phải mắt); một PR/increment review được; `.tl-btn` bị đóng băng và chỉ đi xuống; mọi ticket downstream (DS-04/A11Y-02/04) có ngay component + props để bám vào. · Loses: hệ song song `.tl-btn` vẫn sống ở ~109 file (nhưng đã bị freeze, không rot thêm). · Forecloses: không đóng gì — có thể nâng lên Option A bất cứ lúc nào bằng cách chạy codemod trên baseline đang co lại.

---

## Option C — Bộ TL component standalone (`src/components/tl/`)

Effort: **~10 nửa ngày** · Files: thư mục `src/components/tl/*` mới + migration · Data: none

How it works: viết Button/Card/Badge/... TL riêng, không dùng shadcn, migrate dần.

Wins: kiểm soát API tuyệt đối. · Loses: tạo **hệ thứ BA** (shadcn + `.tl-btn` + `tl/`) trên một repo một người — chính thứ DS-03 sinh ra để diệt; bỏ phí radix a11y/focus-trap của shadcn, phải tự viết lại Dialog/Sheet focus-management. · Forecloses: khoá maintainer vào tự bảo trì primitive vô thời hạn. **Loại thẳng.**

---

## Khuyến nghị

**Option B.** Lý do quyết định, không phải khẩu vị: `.tl-btn` là ngõ cụt kỹ thuật cho toàn bộ chuỗi ticket kế tiếp — không thể gắn `loading`/`aria-busy`/focus/`disabled` vào một CSS class, nên A11Y-02/A11Y-04/DS-04 *bắt buộc* mọi thứ phải hội tụ về một component có props dù sớm hay muộn. B đưa đúng component đó vào đời **ngay bây giờ** và bắt journey screens dùng nó, đồng thời để ratchet gặm phần đuôi miễn phí thay vì trả 6 nửa ngày.

A thua vì "atomic" là giá trị duy nhất của nó, mà 113-file/400-chỗ với gần-zero test không thể review atomic được cho một người — rủi ro/lợi ích lệch hẳn, và B không đóng cửa lên A sau này. C thua vì nó nhân hệ thống lên 3 trên chính bài toán "giảm hệ thống", và vứt a11y có sẵn của radix.

---

## Increments

1. **Web `<Button>` variant bridge + native `TLButton`** (chưa đụng call-site). Verify: `<Button variant="tl|tl-primary|tl-green">` render khớp screenshot 3 dáng `.tl-btn`; `design-token-parity.test.ts` vẫn xanh; native preview 3 style. Acceptance đo được: một Storybook/preview cell phủ 3 variant × {default, loading, disabled, size=icon}.
2. **Chuẩn hoá 4 journey screens.** Verify: `grep -c "tl-btn\|style={{"` trong 4 file = 0 (hoặc ≤ số inline-style documented không map được token). Đây là DoD phần (a).
3. **Ratchet gate.** Verify: gate xanh ở baseline 400; thêm 1 chỗ `tl-btn` vào file test → CI đỏ; xoá → xanh. Đây là DoD phần (b). **← điểm dừng-và-nhìn:** sau đây quyết định có migrate tiếp 109 file hay để ratchet erode.
4. **6 component còn lại (Input/Select/Card/Badge/Dialog/Sheet) + IconButton bless** — thêm variant TL + native twin + ép 44px, không migrate hàng loạt. Verify: mỗi component có 1 preview cell + native twin compile.
5. **(deferred → DS-04/A11Y-02/04)** loading/empty/error states + axe tests, bám trực tiếp lên props đã có từ inc 1/4.

---

## Điều em không chắc

- **Delta pixel `tl-btn.primary` vs shadcn `default`**: đã confirm `--primary`=lime, `tl-btn.primary`=`--tl-fg` (off-white) → *phải* có variant `tl-primary` riêng, không tái dùng `default`. Nhưng chưa screenshot-diff `tl-btn.green` vs `bg-primary` (cả hai đều lime-ish) — nếu trùng thì `tl-green` có thể gộp vào `default`, bớt 1 variant. Cần soi mắt ở increment 1.
- **Anchor cost**: đếm được 33 chỗ `tl-btn` trên `<a>/<Link>` (cần `asChild`), nhưng chỉ trong 4 journey file mới thực sự phải sửa ở B — chưa tách con số đó riêng cho 4 file, có thể ít hơn nhiều.
- **IconButton**: intake liệt 8 component gồm "IconButton" nhưng repo chỉ có `Button size="icon"`. Em mặc định bless size thay vì đẻ component — nếu Cuong muốn component riêng (vd bắt buộc `aria-label` compile-time) thì +0.5 nửa ngày. Cần Cuong xác nhận.
- **Ratchet execution model**: `check-theline.mjs` hiện chạy *changed-files-only*; ratchet cần grep *toàn repo* — là lời gọi CI khác. Em chọn baseline-count toàn repo (một `grep`) cho đơn giản; nếu Cuong muốn per-file baseline (chống việc file A giảm che file B tăng) thì phức tạp hơn, nhưng YAGNI cho tới khi thấy lách thật.
