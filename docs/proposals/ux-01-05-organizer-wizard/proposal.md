# Cụm UX-01..05 — Organizer wizard (checklist · templates · disclosure · autosave · validation)

> Slug: `ux-01-05-organizer-wizard` · Ngày: `2026-07-19` · Trạng thái: `shipped`
> **Cuong duyệt 2026-07-19 (kèm "duyệt RED"):** D4 = SHIP dashboard "Bản nháp" cùng autosave · D3 = preset TĨNH cấm bank fields ("nhân bản buổi cũ" để đợt sau kèm guard) · lỗ hổng EditSocialEvent bank prefill = fix TRƯỚC, PR riêng.
> Sinh bởi `/idea`. Panel 4 agent: `solution-architect` · `ui-ux-critic` (+GPT-5.6) ·
> `risk-auditor` (+GPT-5.6) · `pre-mortem`. Model ngoài chính xác: xem `external/*.meta.json`.
> Model thiếu key trong lần chạy này: `none`
>
> **Raw audit trail** (đọc để kiểm tra bản tổng hợp này có trung thực không):
> `round1/*.md` — output độc lập vòng 1 · `round2/*.json` — đối chất
> `external/*.md` — prompt gửi đi + reply GPT-5.6 (+ `.meta.json` pin model ID) · `debate.json` — ledger

---

## 0. 🔶 Cần anh quyết

| # | Vấn đề | Phía A | Phía B | Nếu chọn sai thì sao |
|---|--------|--------|--------|----------------------|
| D4 | Section "Bản nháp" trên club dashboard có ship CÙNG autosave đợt đầu không | `ui-ux-critic`: BẮT BUỘC — entry point duy nhất vào wizard là nút "Tạo sự kiện mới" (`vi.ts:4865`); organizer bỏ dở không bấm nút "MỚI" để mong khôi phục → vòng bỏ-dở→quay-lại không khép | `solution-architect`: KHÔNG — restore tự hiện khi mở lại wizard cùng scope; dashboard section = discoverability, thêm ~1-1.5 nửa ngày, ship 30% rồi đo | Chọn A thừa: +1.5 nửa ngày cho thứ có thể ít ai dùng. Chọn B thiếu: organizer nghĩ mất dữ liệu nên không bao giờ quay lại → autosave không cứu được completion đúng như metric anh chọn |
| D3 | Chốt ranh giới UX-02: đợt này CHỈ preset tĩnh (cấm bank fields)? | Cả panel hội tụ qua REFINE: preset tĩnh whitelist (tên/giờ/giá/thể lệ), TUYỆT ĐỐI không bank trio; "nhân bản từ buổi cũ" = feature riêng đợt sau kèm guard xác-nhận-STK | (không còn phía đối — cần anh xác nhận scope vì ledger không cho tự chốt REFINE-hội-tụ) | Nếu sau này ai đó thêm "clone từ buổi cũ" mà quên guard → kịch bản P0 của pre-mortem: 3 tuần tiền sân vào STK người đã rời CLB |

**⚠️ NGOÀI CỤM — lỗ hổng prod ĐANG SỐNG (pre-mortem phát hiện ở vòng 2, đã verify file:line):** manager mới của CLB mở `EditSocialEvent` sửa buổi cũ → form prefill nguyên `bank_account_number` của chủ nhiệm cũ từ `event_payment_config` (`EditSocialEvent.tsx:171-175`) → save/re-publish → tiền người chơi tiếp tục chảy vào STK người đã rời CLB. `club_managers` cho MỌI manager quyền UPDATE (`20260521130000_club_managers.sql:212-227`). **Fix độc lập, nên làm trước cụm này:** hiển thị + bắt xác nhận tên chủ STK khi bank đến từ prefill (~0.5 nửa ngày).

---

## 1. Ý tưởng gốc

"cụm UX-01..05 (organizer wizard)" — 5 task roadmap Phase 3: UX-01 checklist/status, UX-02 templates 5 format, UX-03 progressive disclosure, UX-04 draft autosave, UX-05 pre-publish validation.

**Làm rõ ở bước 0:**

| Hỏi | Trả lời |
|---|---|
| Ai dùng | Organizer (CLB), cả 5 flow tạo: social event + QuickTable + TeamMatch + DoublesElim + Flex |
| Đau ở đâu | Bỏ dở giữa wizard — mất dữ liệu vì không autosave, kẹt ở payment config |
| Thành công = | Tỉ lệ hoàn thành O2→O4 (funnel BASE-02) tăng |
| Ràng buộc | Web + native SwiftUI cùng đợt; không deadline cứng |

---

## 2. Verdict — đọc cái này trước

| | |
|---|---|
| **Rủi ro** | 🔴 RED cả cụm (vì native + payment-adjacent) — nhưng per-increment: web autosave 🟢, UX-03/05 🟡, native 🔴 |
| **Khuyến nghị** | Option A (bản refined sau vòng 2) — autosave localStorage cả 5 flow, KHÔNG migration, polish theo bằng chứng |
| **Công sức** | ~13-15 nửa ngày (web ~9-10, native ~4-5), chia 6 increment ship độc lập |
| **Rủi ro lớn nhất** | Native ship qua App Store không có nút revert + UX-03 ẩn field payment mà state còn sót → giải sai phí/QR |
| **Auto-merge** | Web increments: được sau gates. Native PR: **Chặn — cần Cuong duyệt** (classifier + auditor cùng RED) |

🔴 RED nghĩa là: **không revert được bằng `git revert`.** Ở đây: binary iOS qua App Store review. KHÔNG có migration nào trong phương án khuyến nghị (đã né toàn bộ enum/RLS).

---

## 3. Đã có sẵn gì (recon)

**Đã tồn tại một phần đáng kể — và recon vòng 0 có MỘT LỖI được vòng 2 sửa:**

- `CreateSocialEvent`: 2-step wizard + `validateStep1/2` + panel `missingFields` (một nửa UX-05) + DB draft thủ công + weekly-repeat (một phần UX-02/04 cho social).
- **Recon nói "TeamMatch/DoublesElim là form 1 trang khổng lồ" — SAI** (ui-ux-critic bắt, architect tự verify rồi CONCEDE): TeamMatch = wizard 5 bước (`TeamMatchSetup.tsx:21,95-103`), DoublesElim 3 bước, QuickTable 2 bước. Chỉ Flex là 1 trang (211 dòng). → UX-03 là **consolidation**, không phải build mới.
- 4 flow tournament: KHÔNG có draft state DB (enum `quick_table_status`/`team_match_status` không có 'draft' — và **ADD VALUE enum không revert được**; doubles/flex TEXT). Row tạo ngay `registration_open`.
- Instrumentation: `journeys.ts` chỉ có social; 4 flow tournament mù hoàn toàn — metric anh chọn hiện KHÔNG đo được ở đó.
- Native: đủ 5 màn tạo SwiftUI trên main; nhánh local `feat/mlp-captain-registration` (19 commit creation chưa merge) đụng cùng file → phải đồng bộ trước.
- Ràng buộc văn bản: `journey-screens.md:51` — "expand only from traffic/risk evidence"; O3 bank-config friction là drop-off có tên.

---

## 4. Phương án (solution-architect, refined sau vòng 2)

### Option A — Autosave local-first cả 5 + polish có bằng chứng (KHUYẾN NGHỊ)

Effort: ~13-15 nửa ngày · Data: **none** (không migration, không RLS, không enum)

Cách hoạt động: hook `useAutosaveDraft` (debounce ~750ms + blur + `visibilitychange` → `localStorage[draft:<flow>:<scopeId>]`, kèm `schema_version`); mở lại wizard cùng scope → tự khôi phục + banner "Đã khôi phục bản nháp trên thiết bị này" + "Bắt đầu lại". Native: `@AppStorage` cùng key-scheme. Social giữ nút "Lưu nháp" DB như hiện tại (không autosave DB). Publish không đổi — vẫn là DB-write đơn hiện có, autosave không bao giờ chạm DB → toàn bộ lớp rủi ro RLS-leak/enum/publish-race/orphan-rows **không tồn tại**.

Được: giết pain #1 (mất dữ liệu) cho cả 5 flow, đúng intake. Mất: không cross-device (nhãn nói thật "trên thiết bị này"). Đóng cửa gì: không — nếu cần cross-device sau, thêm 1 bảng chung `organizer_drafts` (ý GPT-5.6), không đụng bảng tournament.

### Option B — Chỉ autosave (7 nửa ngày)

Nền của A, bỏ UX-02/03/05 + instrumentation. Thua vì: bỏ phần intake liệt kê, và không sinh dữ liệu để lần sau khỏi đoán.

### Option C — Wizardize cả 5 + DB draft (25-35+ nửa ngày)

Migration 4 bảng + RLS + refactor 2 form lớn đang phục vụ giải live. Thua rõ: enum không revert, RLS leak (risk #1), đổ evening vào chỗ không đo được. Cả 3 finder + GPT-5.6 (2 brief độc lập) cùng bác.

### Khuyến nghị

**Option A với thứ tự đã chốt qua đối chất (D1 RESOLVED):** architect tự đảo increment — instrument TRƯỚC autosave tournament (chi phí hoán đổi ~0, mua được khả năng nhìn thấy hồi quy). Ràng buộc kèm: không claim "tăng completion" cho 4 flow tournament trước khi funnel live.

### Increments (mỗi cái ship độc lập)

1. **Autosave social** — `useAutosaveDraft` + `DraftRestoredBanner` + wire `CreateSocialEvent` (+ i18n copy bảng §5) — verify: điền dở → kill tab → mở lại → khôi phục đúng; funnel O2→O4 không tụt. ~2 nửa ngày.
2. **Instrument 4 flow tournament** — `JourneyKind organizer_tournament` + prop `tool`, wire 4 setup page — verify: GA4 VN segment thấy start/complete. ~1.5 nửa ngày.
3. **Autosave 4 flow tournament (web)** — wire hook, KHÔNG DB write — verify: round-trip mỗi flow + fail-loud khi `QuotaExceededError` (chip không được xanh dối). ~2 nửa ngày.
4. **UX-03 consolidation (3 việc đã chốt ở D2) + UX-05 recovery** — unify step-header cả 5 flow, Dreambreaker collapse 5→4, payment branching "Miễn phí/Có thu phí" tường minh (kèm guard: validate theo payment mode đã persist + clear state khi ẩn field), panel missingFields → Alert semantic + mỗi dòng = nút nhảy-tới-field, retry cho weekly-repeat partial. ~3-4 nửa ngày.
5. **UX-02 templates static** — `social-event-templates.ts` preset tĩnh, whitelist field, CẤM bank trio (chờ anh chốt D3). ~1 nửa ngày.
6. **Native (PR riêng, RED-gated)** — @AppStorage autosave 5 view + đồng bộ nhánh mlp trước + test tay simulator. ~4-5 nửa ngày.

(D4 — dashboard "Bản nháp" — nếu anh chọn ship cùng: +1.5 nửa ngày vào increment 1.)

---

## 5. UI/UX (ui-ux-critic + GPT-5.6)

### Đánh giá tổng thể

Thứ cứu completion: **UX-04 autosave + UX-05 payment/recovery**; UX-03 = consolidation 2 ngôn ngữ wizard đang đá nhau; UX-02 để cuối. Chỗ rơi thật: đang điền bước 2 thì bị gọi ra sân, khoá màn hình, 20 phút sau mở lại → state React bay sạch.

### Vấn đề chính (đầy đủ ở `round1/ui-ux-critic.md`)

| # | Mức | Vấn đề | Sửa |
|---|-----|--------|-----|
| 1 | Blocker | DB-draft cho 4 bảng tournament = sai kiến trúc cho pain local | localStorage local-first (ĐÃ thành consensus) |
| 2 | Blocker | 2 ngôn ngữ wizard: `WizardProgress` vs `stepKickerStyle` | 1 step-header chung cả 5 flow |
| 3 | Nên sửa | Payment "optional đọc như bắt buộc" (O3 drop-off có tên) | Hỏi tường minh "Sự kiện này có thu phí không?" Miễn phí/Có thu phí |
| 4 | Nên sửa | Dreambreaker chiếm 1 step TeamMatch | Collapse thành toggle trong bước Thể thức (5→4) |
| 5 | Nên sửa | Panel missingFields: hardcode string + emoji + màu raw (`CreateSocialEvent.tsx:512`) | Alert semantic + i18n + mỗi dòng = nút nhảy-tới-field |
| 7-8 | Nit | Checkbox 16px + nút Quay lại ~40px < 44px | `<Checkbox>` + Button ghost |

### Trạng thái màn hình & copy

Đầy đủ bảng copy VI/EN trong `round1/ui-ux-critic.md` (quy tắc: **Nháp/Bản nháp/Lưu nháp**; autosave = "Đã lưu **trên thiết bị** lúc HH:MM" — không nói dối cross-device). Last-saved indicator: sticky bottom action bar, reserve height, `aria-live="polite"`. Offline: publish disable + "Không có kết nối — thử lại khi có mạng".

### Panel đa model

- Claude + GPT-5.6 đồng thuận (độc lập): local-first không enum; thứ tự UX-04→05→03→02; nhãn "trên thiết bị"; sticky bar; hợp nhất wizard; Dreambreaker collapse; resume ở dashboard.
- Bất đồng nội bộ: vị trí UX-01 (critic thắng nội bộ → thành D4 với architect, lên mục 0); IndexedDB vs localStorage → localStorage thắng (payload nhỏ, GPT cũng nhận).

---

## 6. Rủi ro (risk-auditor + GPT-5.6 + pre-mortem)

### Verdict: 🔴 RED cả cụm — per-increment sau vòng 2:

Classifier đường dẫn nói: **RED** (5 file Swift; web-only = AMBER "shared hook"). Auditor vòng 1 RED với 3 lý do; sau khi localStorage-only được chốt, auditor REFINE:

| Increment | Tier | Điều kiện |
|---|---|---|
| Autosave social + tournament (web, localStorage) | 🟢 | Không INSERT/UPDATE nào vào bảng tournament; fail-loud QuotaExceededError |
| UX-05 recovery | 🟡→🟢 | Presentation-only trên validation publish hiện có |
| UX-03 consolidation | 🟡 | Payment: validate server-side theo mode đã persist, clear state khi ẩn (risk #4) |
| UX-02 static templates | 🟡 (money-path, không hạ) | Static + CẤM bank trio; nếu thành "clone từ buổi cũ" → RED |
| Native | 🔴 | Tách PR, Cuong duyệt tay, đồng bộ nhánh mlp, test simulator |

**Nếu đổi sang DB-draft ở bất kỳ flow nào → RED trở lại nguyên vẹn** (3 rủi ro vòng 1 đã verify: RLS `quick_tables is_public DEFAULT true` leak draft; enum ADD VALUE không revert; publish race ghi đè fee/QR — chi tiết `round1/risk-auditor.md`).

### SLO & Perf & SEO

- SLO 4 (scoring/tiền): chỉ bị đe doạ nếu DB-autosave — phương án chốt né hết. SEO: không route mới, wizard đã noindex, không bump `pr:v29`. Bundle: vào CODE budget (~345 KB headroom), không đụng INITIAL.

### Rollback

- Web: `git revert` + Pages rollback ~10 phút. **Không revert được: binary iOS** — lý do RED của increment 6 và của cả cụm.

### Phản biện độc lập (GPT-5.6)

- Xác minh đúng: QuickTable `is_public` leak (finding mạnh nhất), enum irreversible, sitemap whitelist không bảo vệ quick_tables.
- Bác bỏ: GPT nói `is_public=false` làm chủ draft không đọc được — SAI, có policy `creator_user_id = auth.uid()` sẵn (hallucination do brief thiếu 1 policy; auditor bắt được và ghi rõ).

---

## 7. Tranh luận trong panel

> Vòng 1 độc lập → vòng 2 đối chất (một vòng). Đồng thuận không phải mục tiêu.
> Cưỡng chế bởi `debate-ledger.mjs` — exit 0, không nhượng bộ nào bị loại.

| # | Chủ đề | Vòng 2 | Trạng thái |
|---|--------|--------|------------|
| D1 | Autosave trước hay instrument trước | architect REFINE (đảo increment) · risk-auditor REFINE (gate an toàn → gate claims) · pre-mortem **CONCEDE** (localStorage giết cơ chế sự cố 2/3) | ✅ RESOLVED_EVIDENCE |
| D2 | UX-03 làm ngay hay chờ evidence | architect **CONCEDE** (`TeamMatchSetup.tsx:21` — đã là wizard 5 bước, recon sai) · critic REFINE (3 việc ngay, mở rộng mới cần gate) | ✅ RESOLVED_EVIDENCE |
| D3 | Ranh giới bank trong templates | 2 REFINE hội tụ + 1 HOLD — ledger không cho tự chốt | 🔶 OPEN_FOR_CUONG |
| D4 | Dashboard "Bản nháp" ship cùng autosave? | Cả hai HOLD có căn cứ | 🔶 OPEN_FOR_CUONG |

(Bảng đầy đủ: `node scripts/agents/debate-ledger.mjs docs/proposals/ux-01-05-organizer-wizard/debate.json --markdown`)

### Bất đồng bị giết ở vòng 2 (ảo — thiếu thông tin)

- **D1**: pre-mortem CONCEDE khi thấy Option A không ghi DB (`solution-architect.md:9,47`) — sự cố 2/3 của nó mất cơ chế; nó tự nói "giữ gate lúc này chỉ là quán tính". Vòng 2 làm đúng việc.
- **D2**: architect CONCEDE khi tự mở code thấy recon vòng 0 sai — các flow đã là stepped wizard.

### Bất đồng sống sót (thật — cùng dữ kiện, khác đánh giá)

- **D4**: cả hai phía đọc cùng code, khác đánh giá hành vi organizer. Cái chứng minh phía nào đúng: sau khi ship increment 1, đo tỉ lệ restore-banner-hiện / draft-được-khôi-phục — nếu thấp trong khi autosave có lưu, critic đúng (người dùng không quay lại qua nút "Tạo mới").

### Nhượng bộ bị LOẠI

Không có — ledger strict pass ngay lần đầu.

### Ghi chú trung thực về đồng thuận

"localStorage local-first, không enum" được cả 2 agent Claude + GPT-5.6 (trong 2 brief RIÊNG, không thấy nhau) cùng kết luận — đây là loại đồng thuận có nghĩa (cross-vendor). Ngược lại risk-auditor + pre-mortem cùng gật về DB-draft risk là 2 Claude cùng phe tìm-cái-hỏng — trọng lượng thấp hơn, và quả nhiên cả hai cùng phải rút khi tiền đề DB-write biến mất.

---

## 8. Kế hoạch verify

**Tự động (mỗi increment):**

- [ ] `npx eslint <changed>` · `node scripts/check-theline.mjs` (ratchet .tl-btn — HARD sau 2026-08-01) · `npx tsc --noEmit`
- [ ] `npm run test` — thêm: round-trip serialize/restore cho `useAutosaveDraft` (jsdom), fail-loud quota test
- [ ] `npm run build` + bundle gates (INITIAL không đổi, CODE trong budget)
- [ ] `npm run e2e:smoke` trên preview; cân nhắc thêm a11y spec cho wizard sau khi step-header hợp nhất
- [ ] Post-deploy: `/`, `/feed`, wizard render

**Cuong phải tự làm:**

- [ ] Increment 1: điền dở wizard trên điện thoại thật → khoá màn hình 5 phút → mở lại → khôi phục đúng (đúng ca thật ngoài sân)
- [ ] Increment 4: tạo event CÓ phí rồi đổi sang miễn phí → publish → xác nhận không còn dấu vết phí/QR cũ
- [ ] Increment 6 (native): 5 màn tạo trên simulator + máy thật sau đồng bộ nhánh mlp; App Store submit vẫn theo RED-gate checklist backlog mục 8
- [ ] Quyết D3 + D4 (mục 0) và lỗ hổng EditSocialEvent bank prefill (việc tách riêng)

---

## 9. Sau khi ship

- **SHA/PR (4 PR, cùng ngày 2026-07-19):**
  - #406 `fix(payment)` bank prefill confirm guard (việc-tách-riêng từ mục 0) — merged trước cụm.
  - #407 `0cd79c22` — PR1: autosave 5 wizard + card "Bản nháp" ClubManage + journey organizer_tournament.
  - #408 `71227258` — PR3 native: DraftStore.swift + autosave 5 màn SwiftUI (83 native tests pass; RED merge theo duyệt trước của Cuong trong /ship).
  - #409 `45d18743` — PR2: StepHeader hợp nhất, TeamMatch 5→4, fee-mode radio + clear-state, panel recovery jump-to-field, batch retry, 3 template tĩnh.
- **Khác kế hoạch:**
  - CodeQL chặn bank-trio-vào-localStorage (js/clear-text-storage) → loại bank fields khỏi draft ở CẢ web lẫn native (nhất quán ranh giới D3) — organizer nhập lại 3 field khi restore. Proposal ban đầu chấp nhận lưu local, thực tế siết hơn.
  - Kicker "Bước n/3" của QuickTable nằm ở QuickTables.tsx (create wizard), không phải QuickTableSetup.tsx như spec — StepHeader áp vào chỗ đúng.
  - Native CreateQuickTableView dùng key `draft:quicktable:new` (1 sheet) thay vì theo shareId như web.
  - Panel recovery dùng div role=alert tự dựng thay vì component Alert shadcn; StepHeader giữ tiền tố "◆".
  - Nits #7/#8 (checkbox 16px, nút Quay lại 40px) deferred — không thuộc increment 4.
  - Thứ tự increment thực tế: autosave social + tournament + native đi TRƯỚC instrumentation-đọc-số (journey đã wire trong #407 nhưng chưa có 2 tuần data) — đúng D1 resolution, ràng buộc "không claim completion metric cho tournament flows" vẫn giữ.
  - release-pilot chết giữa chừng vì session limit → merge/deploy/smoke làm tay; smoke main đỏ 1 lần do deploy-race flake (precedent 2026-07-18), rerun xanh. Soak 30' chính quy KHÔNG chạy — thay bằng smoke rerun + prod curl sạch.
- **Metric:** funnel organizer_tournament bắt đầu có số từ 2026-07-19; đọc sau ~2 tuần trước khi quyết template/disclosure mở rộng cho bracket flows (cổng evidence §4 increment 5).
- **Học được:** xem `.claude/memory/lessons-learned.md` entry 2026-07-19.
