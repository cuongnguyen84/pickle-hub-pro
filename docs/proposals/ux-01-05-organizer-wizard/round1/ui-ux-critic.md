# ui-ux-critic — vòng 1 (2026-07-19)

> Nguyên văn output agent, không chỉnh sửa. GPT-5.6 brief/reply: `../external/ui-brief.md`, `../external/ui-openai.md`.

GPT-5.6 responded (saved to `ui-openai.md`) and independently converged on most of my read.

## Đánh giá tổng thể

Cụm UX-01..05 tấn công đúng chỗ đau — nhưng recon vòng 0 sai một dữ kiện quyết định: **4/5 flow tạo ĐÃ là wizard nhiều bước** (TeamMatch 5 bước, DoublesElim 3 bước, QuickTable có step, Social 2 bước; chỉ Flex là 1 trang). Nên UX-03 "chunk form 1400 dòng thành bước" phần lớn đã xong; việc thật của UX-03 là hợp nhất **hai ngôn ngữ wizard đang đá nhau** và gỡ vài bước thừa (Dreambreaker). Thứ cứu completion rate thật là **UX-04 (autosave) + slice "resume trên dashboard" của UX-01 + fix bước payment (UX-05)**; UX-02 templates là nice-to-have, để cuối. Autosave phải là **localStorage im lặng (local-first)**, không phải DB draft cho 4 bảng tournament — organizer VN mất sóng giữa chừng cần cứu-dữ-liệu tức thì, không cần cross-device.

## Luồng người dùng

Thực tế deep-link: organizer vào từ `/clb/:slug` (tab events) → CTA "Tạo" → wizard (`/clb/:slug/social/moi` hoặc setup tournament). **Chỗ rơi:** đang điền bước 2/3 thì có người gọi ra sân đánh, khóa màn hình, 20 phút sau mở lại → **state React bay sạch, về bước 1 trống**. Đây là nguyên nhân O2→O4 rụng, và không một task nào ngoài UX-04 chạm tới nó.

Exit hiện tại: publish → `navigate(/social/:slug)`. Không có đường "quay lại sửa nháp" từ dashboard cho tournament (chỉ social có DB draft mà cũng không có entry point resume rõ ràng). Vòng lặp bỏ-dở → quay-lại chưa khép.

## Đánh giá từng task & thứ tự triển khai

| Thứ tự | Task | Tác động O2→O4 | Ghi chú |
|---|---|---|---|
| 1 | **UX-04** autosave local-first | **Mover chính** | Chặn mất dữ liệu — nỗi đau gốc. Rẻ (localStorage ~30 dòng, không migration). |
| 2 | **UX-05** validation + recovery + fix payment | **Mover chính** | O3 là "most abandonment surface". Fix "payment optional đọc như bắt buộc" nằm ở đây. |
| 2.5 | **UX-01 (slice resume)** | Cao — khép vòng | Chỉ phần "Bản nháp" trên club dashboard. Ship CÙNG UX-04, nếu không autosave lưu xong không ai tìm lại được. |
| 3 | **UX-03** hợp nhất wizard + gỡ bước thừa | Trung bình | KHÔNG phải greenfield. Hợp nhất 2 style + Dreambreaker → collapse. |
| 4 | **UX-01 (slice unify step indicator)** | Nhất quán | Phần còn lại của UX-01. |
| 5 | **UX-02** templates | Nice-to-have | Giảm thời gian điền, không cứu bỏ-dở. Đo usage sau khi autosave đã live. |

## Vấn đề tìm thấy

| # | Mức độ | Vấn đề | Sửa thế nào |
|---|--------|--------|-------------|
| 1 | Blocker | **UX-04 = DB draft cho 4 bảng tournament** sẽ tốn migration (enum `quick_table_status`/`team_match_status` + TEXT doubles/flex) + RLS + native, và round-trip mạng trên 4G — sai kiến trúc cho nỗi đau "mất dữ liệu local". | Autosave = **localStorage local-first**, key `draft:<flow>:<clubId>:<draftId>`, debounce ~750ms + on blur + on `visibilitychange`. Lưu `schema_version` để bỏ payload cũ. Server draft (nếu cần cross-device sau) = **1 bảng chung `organizer_drafts`**(user_id, club_id, flow_type, payload_json, schema_version, updated_at) + RLS chủ sở hữu, KHÔNG thêm `draft` vào 4 enum. |
| 2 | Blocker | **Hai ngôn ngữ wizard trong cùng sản phẩm:** Social dùng `WizardProgress` (2 chấm + "Bước 1/2" trong shadcn `Card`); 3 tournament flow dùng `stepKickerStyle` "◆ Bước 1/3" + `surfaceCard`. Không nhất quán = UX-03 thật. | Một component step-header duy nhất cho cả 5: `Bước {n}/{total} · {tên bước}` + 1 thanh progress. Header tap được → `TLSheet` liệt kê full step (✓ = hợp lệ, không phải đã-thăm). Xóa `WizardProgress` 2-chấm. Flex 1 trang → KHÔNG hiện "Bước 1/1". |
| 3 | Nên sửa | **"Payment optional đọc như bắt buộc"** — bank fields ẩn/hiện theo `price_vnd === 0` (ngầm định). Organizer không biết event miễn phí thì bỏ trống. | Thay input giá ngầm bằng **lựa chọn tường minh** đầu bước Phí: "Sự kiện này có thu phí không?" → `Miễn phí` / `Có thu phí`. Free → ẩn hẳn bank trio + hiện "Không cần thông tin ngân hàng." Paid → hiện, chỉ 3 trường bắt buộc; "Hạn thanh toán trước — Không bắt buộc". |
| 4 | Nên sửa | **Dreambreaker chiếm 1 full step** trong TeamMatch (5 bước) → luật niche trông như bắt buộc. | TeamMatch 5→4 bước. Dreambreaker → toggle trong bước **Thể thức** (mặc định tắt), bật mới lộ field con. Luật quyết định step-vs-disclosure: chỉ là step khi (a) đa số organizer phải quyết, (b) nhiều field bắt buộc, (c) là mốc setup thật. |
| 5 | Nên sửa | **Panel `missingFields` (UX-05 đã có một nửa)** dùng string VI/EN hardcode inline + emoji ⚠️ + màu raw Tailwind `amber-50/amber-900` (`CreateSocialEvent.tsx:512`) và `blue-50/blue-900` (`Step2Payment.tsx:184`) — vi phạm design-tokens rule semantic-only. | Thay bằng `Alert` component (variant warning/error), icon design-system không emoji, token semantic, i18n key. **Mỗi dòng thiếu là 1 button** nhảy tới đúng field + focus (= "direct recovery actions" của UX-05). |
| 6 | Nên sửa | **Chưa có entry point resume nháp.** Social có DB draft nhưng dashboard không hiện; tournament không có gì. | Section "Bản nháp" trên đầu tab events club dashboard. Card: tên flow · "Đã chỉnh sửa lúc HH:MM" · "Còn thiếu: …" · `[Tiếp tục thiết lập]` · overflow `Xóa bản nháp`. Nháp local-only gắn nhãn "Trên thiết bị này". |
| 7 | Nit | **Checkbox prepayment là raw `<input type=checkbox>` h-4 w-4** (`Step2Payment.tsx:193`) — 16px < 44px touch target. | Dùng `<Checkbox>` component, wrap label vùng bấm ≥44px. |
| 8 | Nit | **Nút "Quay lại" raw `<button>` 11px** (`CreateSocialEvent.tsx:550`) — target ~40px. | py cao hơn để ≥44px, hoặc `Button variant="ghost"`. |

## Trạng thái màn hình

- **Empty (dashboard chưa có nháp):** không hiện section "Bản nháp". Wizard mới mở = form trống, KHÔNG prompt restore.
- **Loading:** wizard là form tĩnh → không spinner cho autosave. `permission.state === "loading"` giữ `LoadingState` (đúng). Autosave dùng inline spinner nhỏ trong action bar, không toast.
- **Restore:** tự khôi phục + banner dismissible "Đã khôi phục bản nháp trên thiết bị này." kèm secondary "Bắt đầu lại". KHÔNG bắt chọn mỗi lần.
- **Error (autosave local fail — quota):** "Chưa thể lưu thay đổi. Vui lòng thử lại." — không phá state.
- **Error (publish fail 4G):** giữ state local, "Chưa thể đăng. Vui lòng kiểm tra các mục bên dưới." / "Không có kết nối — thử lại khi có mạng."
- **Offline:** localStorage sống qua mất-sóng. Publish khi offline: disable + thông báo, KHÔNG fail âm thầm. KHÔNG ghi "Sẽ đồng bộ khi có mạng" trừ khi có queue thật.

**Vị trí "last-saved" trên 390px:** trong **sticky bottom action bar, ngay trên nút Back/Tiếp tục/Đăng**. 1 dòng, 12–13px, `--tl-fg-3`, mono-kicker. **Reserve chiều cao** chống nút nhảy. `aria-live="polite"`. Không toast mỗi lần lưu.

## Accessibility (WCAG 2.1 AA)

- Touch target: checkbox 16px + nút "Quay lại" ~40px < 44px (issue #7, #8). Còn lại Button DS-03 đã 44px.
- Step indicator: `WizardProgress` có `role="progressbar"` — ổn, nhưng chấm inactive contrast thấp; khi hợp nhất đảm bảo tên bước là text, không chỉ chấm màu.
- Panel missing-fields: emoji ⚠️ là tín hiệu duy nhất → thay `Alert` `role="alert"` + icon `aria-label`.
- Autosave live region: `aria-live="polite"`, debounce.
- Recovery links: mỗi dòng lỗi thành button nhảy + `focus()` field đích.

## Copy đề xuất (VI / EN)

Quy tắc: **Nháp** (badge) · **Bản nháp** (danh từ) · **Lưu nháp** (hành động server) · autosave local ≠ server.

| Dùng cho | VI | EN |
|---|---|---|
| Badge | Nháp | Draft |
| Section/tiêu đề | Bản nháp | Drafts |
| Nút lưu server | Lưu nháp | Save draft |
| Lưu server xong | Đã lưu bản nháp | Draft saved |
| Autosave local đang lưu | Đang lưu trên thiết bị… | Saving on this device… |
| Autosave local xong | Đã lưu trên thiết bị lúc {HH:mm} | Saved on this device at {HH:mm} |
| Khôi phục local | Đã khôi phục bản nháp trên thiết bị này. | Draft restored on this device. |
| Tiếp tục | Tiếp tục thiết lập | Continue setup |
| Xóa nháp | Xóa bản nháp | Delete draft |
| Bắt đầu lại | Bắt đầu lại | Start over |
| Chưa lưu | Có thay đổi chưa được lưu. | You have unsaved changes. |
| Lưu fail | Chưa thể lưu thay đổi. Vui lòng thử lại. | Changes couldn't be saved. Please try again. |
| Dialog thoát | Thoát mà không lưu? / Các thay đổi chưa lưu sẽ bị mất. | Leave without saving? / Your unsaved changes will be lost. |
| Error summary | Còn {count} mục cần kiểm tra trước khi đăng. | Check {count} items before publishing. |
| Publish fail | Chưa thể đăng. Vui lòng kiểm tra các mục bên dưới. | Couldn't publish. Check the items below. |
| Payment hỏi | Sự kiện này có thu phí không? | Is this a paid event? |
| Free / Paid | Miễn phí / Có thu phí | Free / Paid |
| Free helper | Không cần thông tin ngân hàng. | No bank information is needed. |
| Deadline optional | Hạn thanh toán trước — Không bắt buộc | Prepayment deadline — Optional |
| Offline publish | Không có kết nối — thử lại khi có mạng | No connection — try again when online |

## Panel đa model

- **Đồng thuận Claude + GPT-5.6** (hội tụ độc lập):
  1. Thứ tự **UX-04 → UX-05 (kèm branching payment) → UX-03 → UX-02**; UX-01 thu hẹp.
  2. **Autosave local-first**, KHÔNG thêm `draft` vào 4 enum tournament. GPT bổ sung: nếu cần server-sync sau này → **1 bảng `organizer_drafts` chung**, không đụng bảng tournament thật.
  3. Nhãn nói thật **"Đã lưu trên thiết bị lúc HH:MM"** (cả hai model tự nhận ra vấn đề trung thực cross-device).
  4. Indicator trong **sticky bottom bar, reserve height**.
  5. **Hợp nhất 2 style wizard**; **Dreambreaker bỏ step riêng** (5→4 bước).
  6. **Fix panel missing-fields**: bỏ màu raw + emoji, Alert semantic, mỗi dòng = link nhảy-tới-field.
  7. Resume nháp sống ở **club dashboard**.

- **Bất đồng nội bộ panel UI:**
  1. *Vị trí UX-01.* GPT xếp toàn bộ UX-01 cuối. **Tôi tách UX-01 làm hai:** slice "Bản nháp resume trên dashboard" ship **cùng UX-04**; slice "unify step indicator" để sau. **Chốt: theo tôi** — resume là mảnh khép vòng bỏ-dở→quay-lại.
  2. *IndexedDB vs localStorage.* GPT ưu tiên IndexedDB sau abstraction. **Chốt: localStorage** cho payload nhỏ; nâng IndexedDB chỉ khi payload phình vài chục KB.

**Files liên quan:** `src/pages/CreateSocialEvent.tsx` (L512, L550), `src/components/social/create-event/Step2Payment.tsx` (L184, L193), `WizardProgress.tsx`, `src/pages/{TeamMatchSetup,DoublesEliminationSetup,QuickTableSetup,FlexTournamentSetup}.tsx`, `src/components/tournament/setup-styles.ts`.

**Lưu ý cho orchestrator:** recon vòng 0 ("form 1 trang khổng lồ, không step") **SAI** — TeamMatch/DoublesElim/QuickTable đã là stepped wizard. Điều này hạ UX-03 từ "build lớn" xuống "consolidate + lấp 2 lỗ", cần phản ánh vào ước tính effort.
