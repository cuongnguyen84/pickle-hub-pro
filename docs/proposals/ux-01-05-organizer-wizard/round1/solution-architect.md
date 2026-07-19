# solution-architect — vòng 1 (2026-07-19)

> Nguyên văn output agent, không chỉnh sửa.

## Tóm tắt kiến trúc

Đau chính (bỏ dở → mất dữ liệu) được giải bằng **autosave localStorage** dùng chung một hook nhỏ, không migration, phủ được cả 5 flow lẫn bản native (@AppStorage) — chứ không phải bằng một "wizard framework" chung (TeamMatch 1348 dòng + DoublesElim 1420 dòng là form-một-trang, ép vào step-machine chung là refactor RED-risk vô cớ). Progressive disclosure (UX-03) làm bằng `<details>` gốc HTML / Collapsible có sẵn = **0 KB bundle**. Điểm căng thẳng thật — intake muốn cả 5 nhưng `journey-screens.md:59` nói "expand only from traffic/risk evidence" và BASE-02 chỉ đo được social — em giải bằng cách: đầu tư sâu (template + validation-recovery) chỉ vào social (flow duy nhất đã instrument + có payment + đã có draft DB), còn 4 flow bracket thì ship autosave + **thêm instrumentation trước** rồi mới quyết, thay vì đánh cược evening vào chỗ đang mù.

## Option A — Social sâu + tournament "đo trước, đắp sau" (khuyến nghị)

Effort: ~12 half-days (chia increment độc lập) · Data: **none** (localStorage; không migration/RLS)
Files:
- Thêm `src/hooks/useAutosaveDraft.ts` (hook chung: debounce serialize state → `localStorage[draft:<flow>:<scopeId>]`, trả `lastSavedAt` + `restore()`), `src/components/wizard/DraftRestoredBanner.tsx` (DS-04 pattern, VI+EN).
- Sửa: `src/pages/CreateSocialEvent.tsx`, `FlexTournamentSetup.tsx`, `QuickTableSetup.tsx`, `TeamMatchSetup.tsx`, `DoublesEliminationSetup.tsx` (wire hook + banner).
- Thêm `src/content/social-event-templates.ts` (2-3 preset prefill `FormState`) + chip UI trong `components/social/create-event/Step1Info.tsx`.
- UX-03: bọc phần advanced trong social/teammatch bằng `<details>` (rung-4, 0 KB).
- UX-05: mở rộng panel `missingFields` sẵn có (CreateSocialEvent.tsx:505-524) thành "recovery actions" + nút retry cho `batch_result=partial` (journey-screens.md flag O4).
- Instrumentation: mở rộng `src/lib/journeys.ts` — thêm `JourneyKind = "organizer_tournament"` với prop `tool` (flex|quicktable|teammatch|doubles); wire start/step/complete vào 4 setup page.
- Native: `useAutosaveDraft` ⇄ `@AppStorage` cùng key-scheme trong 5 view Swift + `SocialEventFormView` template picker.

How it works: autosave ghi state mỗi ~800ms sau thay đổi; khi mở lại wizard cùng scope (club slug / shareId) thấy draft → hiện `DraftRestoredBanner` (Khôi phục / Bỏ). Social nhận đủ UX-01..05. 4 bracket flow nhận UX-04 (autosave) + journey mới `organizer_tournament` → sinh funnel để lần sau quyết template/disclosure có bằng chứng.
Wins: giết pain data-loss cho **cả 5** ngay (đúng intake), nhưng chỉ đắp polish nơi đo được (đúng journey-screens.md). Không migration, không RLS, không đụng payment logic → không RED. Bundle ~0.
Loses: bracket flow chưa có template/disclosure trong đợt này. Autosave không cross-device.
Forecloses: gần như không — nếu sau này cần cross-device draft, hook che được sau một interface `load/save` mà không phá call-site.

## Option B — Chỉ autosave, cả 5 (bản rẻ / 30%)

Effort: ~7 half-days · Data: none
Files: `useAutosaveDraft.ts` + `DraftRestoredBanner.tsx` + wire vào 5 web page + native @AppStorage; mở rộng `missingFields` panel thành nudge "còn thiếu trước khi đăng" (UX-05-lite). Bỏ hẳn UX-02 template + UX-03 disclosure + instrumentation mới.
How it works: đúng như A nhưng dừng ở UX-04 + UX-05-lite. Không thêm journey, không template.
Wins: rẻ nhất, chạm đúng #1 pain, ship được trong một tuần evening. Rủi ro gần zero.
Loses: không đo thêm được gì ở 4 flow bracket (vẫn mù). Template/disclosure — thứ intake liệt kê — chưa có; nếu Cuong coi UX-02/03 là bắt buộc đợt này thì thiếu.
Forecloses: không. Đây là nền của A; A = B + phần đầu tư có bằng chứng.

## Option C — Wizardize cả 5 (đọc intent theo nghĩa đen, thua)

Effort: ~25-35+ half-days · Data: **migration draft-status cho 4 bảng + RLS + list "draft của tôi" + cron dọn**
How it works: shared wizard state-machine + step model, tách `TeamMatchSetup`/`DoublesEliminationSetup` giant-form thành nhiều step, template cho cả 5, draft lưu DB.
Wins: đồng nhất tuyệt đối, cross-device draft.
Loses: refactor 2 file ~1400 dòng đang phục vụ tạo giải LIVE = regression risk cao; RLS mới trên 4 bảng; cron dọn draft mồ côi; QuickTable vốn đã tạo row-trước-qua-shareId nên "DB draft" trùng lặp mô hình. Đổ hàng chục evening vào flow **không đo được lợi ích**.
Forecloses: khoá kiến trúc vào một wizard-framework mà solo-maintainer phải nuôi.

## Khuyến nghị

**Option A.** B thua vì bỏ luôn UX-02/03/05 mà intake có liệt kê, và không tạo được dữ liệu để lần sau khỏi đoán — nó là điểm dừng tốt *bên trong* A, không phải đích. C thua rõ: nó vi phạm `journey-screens.md:59` (đắp polish vào 4 flow đang mù), là thay đổi RED-adjacent (RLS 4 bảng), và refactor 2 form ~1400 dòng đang chạy production giải đấu — chi phí một-người không tương xứng với lợi ích không đo được. A giữ được cả hai đầu: pain thật (autosave) phủ cả 5 ngay, còn polish chỉ rót vào chỗ có instrument, và cài sẵn `organizer_tournament` để mở khoá quyết định tiếp theo bằng số thật.

Không có route public mới, cả 5 wizard đã `noindex` — **không đụng `functions/_lib/render/`, sitemap, hreflang**. Autosave chỉ ghi localStorage/@AppStorage trên máy chủ sự kiện (kể cả field bank của social/teammatch → dữ liệu ngân hàng của chính organizer trên máy của họ, không đẩy remote); **không thay đổi payment logic/RPC** nên không phải RED — nhưng vì chạm form payment config, đánh dấu để Cuong liếc qua.

## Increments

1. `useAutosaveDraft` + `DraftRestoredBanner` + wire vào **CreateSocialEvent** (đã instrument) — verify: bỏ dở → reload → banner khôi phục đúng state; funnel O2→O4 (BASE-02) không tụt. **Ship độc lập.**
2. Autosave vào 4 web flow còn lại + native @AppStorage 5 view — verify: self-check serialize/restore (assert round-trip) + thử tay mỗi flow. **Ship độc lập.**
3. Journey `organizer_tournament` vào 4 setup page + native — verify: GA4 (Vietnam segment) thấy start/complete có prop `tool`. **Ship độc lập.**
4. Social: templates.ts + `<details>` disclosure + UX-05 recovery/partial-retry — verify: chọn preset prefill đúng; retry batch tạo nốt copy thiếu.
5. **STOP-AND-LOOK:** đọc funnel `organizer_tournament` sau ~2 tuần. Chỉ khi flow bracket nào có drop-off thật mới làm template/disclosure cho nó — đây là cổng evidence mà journey-screens.md yêu cầu.

## Điều em không chắc

- **localStorage có đủ chữa pain không.** Nếu organizer thật sự bỏ dở rồi đổi thiết bị (điện thoại → laptop), chỉ DB draft mới cứu được — em chưa có số nào về hành vi này. Nếu Cuong biết đây là cross-device, cân nhắc nâng UX-04 lên DB cho *riêng social* (đã có draft status sẵn).
- **QuickTable pre-tạo row qua shareId** (QuickTableSetup.tsx:54-88): "draft" của nó gần như đã nằm ở DB (table rỗng). Cần kiểm có bao nhiêu empty table mồ côi đang tích — nếu nhiều, việc đúng có thể là resume từ DB thay vì localStorage cho riêng flow này.
- **Điểm drop-off thật của TeamMatch/DoublesElim chưa biết** — có thể là payment config (như social O3), có thể chỉ vì form dài 1400 dòng. Increment 3 tồn tại chính vì em không dám đoán; đừng làm UX-03 cho chúng trước khi có số.
- **State native có gom trong ObservableObject không** — em mới xác nhận 5 file Swift tồn tại, chưa đọc từng cái. Nếu state rải rác trong @State cục bộ thay vì một store, effort autosave native ở increment 2 có thể phình 1-2 half-days.

Files load-bearing đã đọc: `src/pages/CreateSocialEvent.tsx`, `src/pages/FlexTournamentSetup.tsx`, `src/pages/QuickTableSetup.tsx`, `src/components/tournament/SetupShell.tsx`, `src/lib/journeys.ts`, `docs/journey-screens.md`.
