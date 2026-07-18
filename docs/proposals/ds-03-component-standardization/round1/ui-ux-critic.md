# DS-03 — UI/UX critic (round 1)

## Đánh giá tổng thể
DS-03 là refactor bề mặt đúng nghĩa: mọi màn user thấy có thể đổi pixel. Rủi ro thị giác THẬT nằm ở một điểm hẹp — `.tl-btn primary` (nền kem `--tl-fg`) và `<Button variant=default>` (nền lime `--primary`) KHÁC màu hoàn toàn; hợp nhất bằng codemod đoán-theo-tên sẽ lật 22–24 CTA từ kem sang lime mà không ai duyệt. Ngược lại `.tl-btn green` → `default` khớp lime 1:1 nên phần lớn hot-path an toàn. Hướng đi đúng là retrofit shadcn (Option A), gói 44px vào đúng đợt này, và migrate journey-screen theo thứ tự rủi ro tăng dần với SocialEventDetail đi CUỐI.

## Luồng người dùng
- **Player (deep-link reality):** link Facebook → `/social/:slug` (P1 `SocialEventDetail`, CTA `.tl-btn green` — `SocialEventDetail.tsx:490-513`) → tap mở `RegistrationModal` (P2–P4, toàn `<Button>` shadcn) → OTP/member → slot → QR/confirm. User băng qua ranh giới hai hệ component giữa dòng — nhưng vô hình vì green = default = cùng lime `#b5e853`. Payoff thị giác của việc hợp nhất P1↔P2 là NHỎ; giá trị thật là bỏ ranh giới hành vi (focus, disabled, loading khác nhau).
- **Organizer:** `/clb/:slug` → wizard `/clb/:slug/social/moi` (O2–O4 `CreateSocialEvent`, `.tl-btn` + raw `<button>`) → publish. Đây là màn nhiều raw button mã hoá next/back/submit → rủi ro hành vi cao nhất.

## Vấn đề tìm thấy
| # | Mức độ | Vấn đề | Sửa thế nào |
|---|--------|--------|-------------|
| B1 | Blocker | `.tl-btn primary` = nền KEM (`the-line.css:545-548`, `--tl-fg`) nhưng `<Button default>` = LIME (`the-line.css:33` `--primary`). Codemod map theo chữ "primary" sẽ lật 22–24 CTA kem→lime. | Bảng map tường minh, KHÔNG đoán: `tl-btn green`→`variant=default`; `tl-btn primary`→`variant=secondary`(kem); `tl-btn`(base)→`variant=outline`. Codemod từ chối suy từ tên. Thêm variant `secondary` = nền kem dưới theme. |
| B2 | Blocker | Touch target < 44px. `button.tsx:23` size default h-10=40px; `.tl-btn` ~43px (`the-line.css:534-535`). Đây là nơi DUY NHẤT đúng để đóng A11Y-02. | Default size → `h-11` (44px). Giữ `size="lg"` tái tạo ~50px của hot-path CTA (`SocialEventDetail.tsx:466-468` inline padding `14px 22px`). Gỡ inline style CHỈ sau khi `lg` khớp. IconButton render 44×44 dù glyph 20–24px. |
| B3 | Blocker (characterization) | Raw `<button>` mã hoá submit/next/back; swap JSX hàng loạt có thể biến nút Back thành submit form. `CreateSocialEvent.tsx:534-583`, `SocialEventDetail.tsx:490-513` (disabled = inline `opacity:0.5`+`cursor:not-allowed`, KHÔNG phải `:disabled`). | Migrate wizard theo từng bước O2→O3→O4, chạy full-flow test sau mỗi bước. Với mỗi nút ghi lại: element (button/a), `type`, handler, điều kiện disabled, analytics event. `type="button"` mặc định ngoài submit wrapper. |
| S1 | Nên sửa | Không có `IconButton`; hiện là `Button size="icon"` (`button.tsx:23`, 40px, không ép label). Nút close Dialog/Sheet hardcode `sr-only "Close"` tiếng Anh (`dialog.tsx:45-48`, `sheet.tsx:63-66`) trên bề mặt VI-primary. | Export `IconButton` bắt buộc `label`, hit-area 44×44. Đưa "Đóng"/"Close" qua localization layer, không hardcode. |
| S2 | Nên sửa | Select trigger `h-10` (`select.tsx:20`) → 44px; chưa có quy ước placeholder song ngữ. | Trigger `h-11`, label hiển thị, placeholder "Chọn…"/"Select…", z-index portal test bên trong Dialog/Sheet, typeahead với dấu tiếng Việt. |
| S3 | Nên sửa | Xung đột tên web↔Swift: `TLPrimaryButton` (`TLComponents.swift:19-20`) = LIME; web `.tl-btn primary` = KEM. | Chuẩn hoá tên theo VAI TRÒ trên cả hai: primary/default=lime, secondary/neutral=kem. Không port nghĩa legacy của web. Swift bổ sung TLIconButton/TLBadge/TLSelect/TLDialog/TLSheet + variant secondary/outline/destructive/disabled. |
| S4 | Nên sửa (không blocker) | Button chưa có `loading` prop; loading hiện làm thủ công trong RegistrationModal. | GIỮ hành vi loading hiện có (characterization). Nếu thêm `loading` tập trung: giữ nhãn có ngữ cảnh ("Đang đăng ký…"), `aria-busy`, width ổn định (không CLS). Đây là tiện ích, không phải điều kiện DoD. |
| S5 | Nên sửa | Badge truyền trạng thái CHỈ bằng màu (`badge.tsx:6-21`). | Trạng thái sự kiện phải kèm chữ: "Còn chỗ"/"Đã đầy"/"Đã huỷ", không chỉ xanh/đỏ. Kiểm contrast text trên nền lime/kem. |
| N1 | Nit | Hover khác: `.tl-btn` → `surface` (`the-line.css:542-543`), shadcn outline → `accent` (`button.tsx:14`). | Khớp hover có chủ đích, đừng nhận "gần giống". |
| N2 | Nit | `.tl-btn` radius 8px (`the-line.css:535`) vs shadcn rounded-md; `--tl-radius`=10px. | Xác nhận radius để tránh lệch góc khi swap. |
| N3 | Nit | Sheet chưa xử safe-area cho Capacitor (`sheet.tsx:32,60`). | `padding-bottom: max(var(--sheet-padding), env(safe-area-inset-bottom))` tập trung. |

## Trạng thái phải GIỮ NGUYÊN (characterization — refactor KHÔNG được đổi)
- **Button disabled:** opacity 0.5 + `cursor:not-allowed` (hot-path inline `SocialEventDetail.tsx:498-499`; shadcn `disabled:opacity-50 pointer-events-none` `button.tsx:8`).
- **Button loading:** hành vi submit RegistrationModal (chống double-submit).
- **variant destructive** màu (`button.tsx:13`).
- **outline hover** hiện tại.
- **Input iOS no-zoom:** `text-base` ≥16px — comment CRITICAL `input.tsx:5-9`, tuyệt đối giữ.
- **Dialog/Sheet:** kích thước, vị trí mobile, animation open/close, focus return về trigger, Escape + outside-click, safe-area.
- **CTA hot-path ~50px** (`SocialEventDetail.tsx:466-468`).
- **element/anchor semantics:** CTA đã-đăng-ký là `<a>` deep-link `/dang-ky/:token` (`SocialEventDetail.tsx:461-473`) — nếu chuyển `<Button asChild>` phải giữ anchor, không lồng interactive vào interactive.

## Thứ tự migrate an toàn
0. Ratchet gate CI TRƯỚC (đếm JSX `className` chứa `tl-btn` + raw `<button>` trong thư mục journey; tổng chỉ được giảm; fail nếu file đổi thêm occurrence mới) + baseline screenshot mobile mid-Android.
1. **Cập nhật 8 component chung** (44px, variant secondary kem, IconButton, loading nếu làm). Visual-regression cả theme Line lẫn non-Line — đổi 40→44px là blast-radius lớn nhất.
2. **ClubLanding — canary** (đã shadcn sẵn `ClubLanding.tsx:70,226,231,259`): test component mới không đổi semantics element.
3. **RegistrationModal** (P2–P4, đã shadcn `RegistrationModal.tsx:819..1385`): chốt hành vi đích — submit type, double-submit, pending label, focus Dialog, error association.
4. **CreateSocialEvent wizard** O2→O3→O4 (rủi ro hành vi CAO NHẤT, raw button): từng nút một, test full wizard sau mỗi bước.
5. **SocialEventDetail P1 CUỐI** (phơi nhiễm cao nhất): map CTA `variant=default size=lg`, giữ ~50px, verify full P1–P4.

## Accessibility (WCAG 2.1 AA)
- **2.5.5 Target Size:** cả `.tl-btn` (~43px) lẫn `Button` (40px) đều < 44px → B2 phải đóng trong đợt này.
- **4.1.2 Name/Role/Value:** IconButton + close Dialog/Sheet cần accessible name qua localization (S1), không hardcode "Close".
- **1.4.1 Use of Color:** Badge trạng thái không được chỉ dùng màu (S5).
- **1.4.3 Contrast:** text trên nền lime/kem phải ≥4.5:1 — kiểm khi thêm variant secondary.
- **Focus:** shadcn có `focus-visible:ring-2` (`button.tsx:8`); `.tl-btn` KHÔNG có focus ring → migrate sang shadcn là cải thiện a11y thực, giữ ring.
- Test bắt buộc: TalkBack (Android), 200% text, reduced-motion, cả VI lẫn EN.

## Copy đề xuất (VI / EN)
- Close (Dialog/Sheet, aria + sr-only): "Đóng" / "Close"
- Select placeholder mặc định: "Chọn…" / "Select…"
- Loading CTA đăng ký: "Đang đăng ký…" / "Registering…"
- Loading tạo sự kiện: "Đang tạo sự kiện…" / "Creating event…"
- Loading lưu nháp: "Đang lưu…" / "Saving…"
- Badge trạng thái: "Còn chỗ" / "Available", "Đã đầy" / "Full", "Đã huỷ" / "Cancelled"
- Nhất quán thuật ngữ (đừng lẫn): "Hủy" vs "Đóng", "Đăng ký" vs "Tham gia", "Tạo sự kiện" vs "Đăng sự kiện", "Xóa" vs "Gỡ" — dialog destructive phải nêu rõ đối tượng + hậu quả.
- Cảnh báo width: nhãn VI dài hơn EN ("Đăng ký tham gia", "Xác nhận đăng ký") — đừng `whitespace-nowrap` trên action modal; stack khi hẹp.

## Panel đa model
- **Đồng thuận Claude + GPT-5.6:** (1) chọn Option A — shadcn/Radix là nền React DUY NHẤT, thêm variant neutral/secondary + 44px, migrate bằng ratchet; (2) `.tl-btn primary` (kem) → `secondary`, KHÔNG phải `default`; green→default; base→outline; (3) giữ `size=lg` ~50px cho hot-path CTA; (4) thứ tự ClubLanding→RegistrationModal→CreateSocialEvent→SocialEventDetail (cuối); (5) IconButton bắt buộc accessible name 44×44; aria-label phải qua localization; (6) không đổi màu/hành vi/deep-link/focus; (7) tên web↔Swift theo vai trò, Swift không mirror `line`/`green`/nghĩa legacy `primary`.
- **Bất đồng / sắc thái:**
  - **Mức độ của map kem→lime.** GPT để nó là 1 dòng trong bảng map. TÔI nâng lên **Blocker (B1)**: đây là landmine thị giác lớn nhất của cả refactor, một codemod ngây thơ sẽ ship 24 CTA sai màu ra prod. Chọn: giữ Blocker — cần cổng chặn map-theo-tên, không chỉ ghi chú.
  - **`loading` prop.** GPT coi là hạng-nhất trong "contract". TÔI hạ xuống **S4 tuỳ chọn** (ponytail): DoD chỉ yêu cầu GIỮ hành vi loading hiện có; thêm API `loading` tập trung là nice-to-have, không phải điều kiện đóng DS-03 — đừng để nó nống scope 8-component thành 8-component-cộng-API-mới.
