# Song ngữ VI+EN cho app native `/apple` (String Catalog)

> Slug: `native-bilingual` · Ngày: `2026-07-28` · Trạng thái: `approved`
> **Cuong duyệt 28/07 (qua /ship, AskUserQuestion):** Option C · D3 = Region-default + toggle trong Profile (Tiếng Việt/English/Theo máy) · D4 = chuẩn 'Hủy'/'Xóa' (kiểu bộ gõ), PR chuẩn hoá riêng chạm cả `src/i18n` + `apple/` trước PR song ngữ · chấp nhận ước lượng 8,5–10 nửa ngày.
> Sinh bởi `/idea`. Panel 4 agent: `solution-architect` · `ui-ux-critic` (+GPT-5.6) ·
> `risk-auditor` (+GPT-5.6) · `pre-mortem`. Model ngoài: GPT-5.6 (ui-ux-critic qua codex CLI, risk-auditor qua OpenAI Responses API — codex CLI từ chối gpt-5.6 với tài khoản ChatGPT).
> Model thiếu key trong lần chạy này: `none`
>
> **Raw audit trail:** `round1/*.md` — output độc lập vòng 1 · `round2/*.json` — đối chất
> `external/*.md` — prompt gửi đi + reply GPT-5.6 · `debate.json` — ledger
> ⚠️ `scripts/agents/debate-ledger.mjs` + `risk-tier.mjs` không tồn tại trong repo — luật vòng 2 cưỡng chế thủ công, kết quả ghi trong `debate.json` (cả 3 rebuttal đều REFINE kèm bằng chứng đo thật, không có CONCEDE trắng → xanh).

---

## 0. 🔶 Cần anh quyết

| # | Vấn đề | Phía A | Phía B | Nếu chọn sai thì sao |
|---|--------|--------|--------|----------------------|
| D3 | **Control ngôn ngữ trong app** | Intake (anh, 28/07): chỉ theo iOS Settings, không toggle. risk-auditor đã thực nghiệm xác nhận cách này *hoạt động được* (iOS hiện mục per-app trong Settings). | ui-ux-critic (Blocker B3): entry thật là **deep-link từ Facebook** → mismatch ngôn ngữ ở frame đầu không tự phục hồi; iOS Settings là 4 bước ngoài app phải biết trước mới tìm ra. Đề xuất: **default theo Region** (`Region == VN → vi`, khác → en) + 1 hàng "Ngôn ngữ" trong Profile (Tiếng Việt / English / Theo máy). GPT-5.6 cũng đòi toggle nhưng default luôn-vi — critic bác (phá nhánh EN). Chi phí biên ~0 vì 14 formatter phải nhận `appLocale` dù thế nào (B4). | Chọn A: người VN để máy EN (phổ biến) thấy app toàn EN, không có đường sửa trong app. Chọn B: thêm ~½ ngày + một quyết định default mà sau này khó đổi. |
| D4 | **Chuẩn hoá chính tả "Hủy/Huỷ", "Xóa/Xoá" trước khi sinh catalog** (phát sinh vòng 2) | risk-auditor: chuẩn hoá trong `apple/` trước khi bootstrap catalog (nếu không, 1 nghĩa = 2 key, dịch sót một biến thể). | ui-ux-critic đo thật: `src/i18n/vi.ts` lệch y hệt ('Hủy' 14/'Huỷ' 12, 'Xóa' 19/'Xoá' 12) — không có chuẩn để quy về; chuẩn hoá chỉ trong `apple/` thì native và web chốt 2 chuẩn khác nhau (vi phạm "fix both web and native"), nhưng cổng cứng diff-chỉ-apple/ lại cấm đụng `src/`. Đề xuất: **anh chốt một biến thể** ('Huỷ/Xoá' theo Hoàng Phê vs 'Hủy/Xóa' theo bộ gõ — quyết định thương hiệu), ghi glossary, tách PR chuẩn hoá riêng chạy trên CẢ `src/` và `apple/` trước. | Không chốt: catalog sinh ra với key trùng nghĩa, nút Cancel chỗ EN chỗ VI; hoặc native/web vĩnh viễn hai chuẩn chính tả. |
| — | **Ước lượng thật** | Intake ghi 3–5 nửa ngày (từ memory). | Cả architect (đếm 814 chuỗi chưa trích) lẫn auditor (1766 occurrence, 976 phải sửa code) độc lập kết luận: **thấp gấp đôi**. Sau khi vòng 2 đo thật (bước 3 hết canh bạc), con số tin được là **~8,5–10 nửa ngày**, trong đó anh chỉ ~1,5 (duyệt dịch bề mặt người xem + allowlist key trùng). | Giữ khung 3–5 → phải chọn Option B (chỉ lát người xem, màn organizer trộn ngôn ngữ). |

---

## 1. Ý tưởng gốc

"đọc memory và làm song ngữ cho app native (/apple)" — O1 anh đã quyết 28/07 trưa (memory `native-bilingual-migration`).

**Làm rõ ở bước 0** (`00-intake.md`):

| Hỏi | Trả lời |
|---|---|
| Đổi ngôn ngữ | Theo iOS Settings (per-app language), không toggle trong app — *bị D3 thách thức, xem mục 0* |
| Phạm vi | Toàn bộ một mẻ |
| Ràng buộc | Không gấp; App Store submit RED-gated riêng |

---

## 2. Verdict — đọc cái này trước

| | |
|---|---|
| **Rủi ro** | 🔴 RED |
| **Khuyến nghị** | Option C (điều chỉnh sau vòng 2) — quét trọn, duyệt phân tầng, literal-key + gate + ~13 symbolic key |
| **Công sức** | ~8,5–10 nửa ngày (anh: ~1,5) |
| **Rủi ro lớn nhất** | Thêm `en` vào bundle **lật `Locale.current`** cho mọi máy để EN → đổi hành vi của code NGOÀI diff: DatePicker thành 12h AM/PM (ghi giờ sai 12 tiếng vào DB), collation đổi thứ tự seed Mexicano, tiền tệ đổi dấu phân cách cạnh mã VietQR — không telemetry native nào bắt được |
| **Auto-merge** | **Chặn — cần anh duyệt** (mọi file `apple/**` = RED tại merge, `docs/agent-idea-pipeline.md:119`) |

RED ở đây là **thủ tục + một lỗi chức năng thật** (nút xoá tài khoản chết với máy EN — Apple Guideline 5.1.1(v)), không phải "không revert được": `git revert` đủ, ~10 phút, không migration, không deploy, blast radius lên 2000 user web = 0 (auditor đã xác minh app trên App Store là bản Capacitor cũ, bundle ID khác).

---

## 3. Đã có sẵn gì (recon)

**Chưa có gì** — 0 file localization trong `apple/` lẫn `ios/` cũ. Web `src/i18n/{vi,en}.ts` (2.746 entry) là tiền lệ song ngữ duy nhất, dùng làm glossary.

**Sẽ đụng vào:** `apple/project.yml` + `project.pbxproj` (bẫy `developmentRegion = en` phải sửa trước tiên) · `Info.plist` (`CFBundleLocalizations`) · `Resources/Localizable.xcstrings` (mới) · ~112 file Swift (814 chuỗi chưa tự trích trong tổng 1766 occurrence / ~1306 distinct) · 4 file test assert chuỗi VI (không phải 2 như recon nói) · `.github/workflows/apple-tests.yml`.

**Ràng buộc:** Swift 5.0 (không phải 6 như memory), không có warnings-as-errors (memory sai); xcodegen 2.45.4 hỗ trợ `.xcstrings` (auditor đã thực nghiệm); Xcode 26.3 OK; **CI `Apple tests` đang chết 100% vì hết Actions budget** — baseline 154 test chỉ tồn tại local; nhánh `feat/native-t4-t5-supervised` đang mở đụng 9 file mật độ VI cao nhất → **đóng/merge trước khi bắt đầu**.

**Recon sai 3 chỗ, đã sửa trong panel:** ~1000 literal → thật 1766; 2 file test → 4 file 7 dòng; enum `Mode` "logic-bearing" → ngược lại, display-only nhưng `Text($0.rawValue)` = verbatim (không tự dịch).

---

## 4. Phương án (solution-architect)

Cả 3 option chung nền: một `Localizable.xcstrings`, `sourceLanguage: vi`, **key = chuỗi VI gốc** (chốt sau D1: + duplicate-gate + ~13 symbolic key cho chuỗi va chạm), tận dụng `SWIFT_EMIT_LOC_STRINGS` đã trích sẵn 755 key không sửa dòng code nào (architect chạy thật `xcodebuild -exportLocalizations`, exit 0, CLI thuần).

**Bẫy phải sửa trước mọi thứ:** `project.pbxproj:1277` đang là `developmentRegion = en` (dòng 13 `project.yml` đặt sai chỗ — build setting, không phải project option). Bootstrap catalog trong trạng thái này → `.xcstrings` sinh `sourceLanguage: en` chứa toàn tiếng Việt. Fix: `options.developmentLanguage: vi` + `knownRegions: [vi, en]`, verify `grep developmentRegion project.pbxproj` → `vi`.

### Option A — Quét trọn, anh duyệt trọn 1.400 chuỗi
Effort: 11 nửa ngày (anh ~4). Files: như C. Thua vì phần chênh toàn là anh ngồi duyệt chuỗi màn organizer chưa có người dùng EN nào mở.

### Option B — Chỉ lát người xem (bản rẻ)
Effort: 6 nửa ngày. Bỏ 24 file organizer (332 chuỗi) — iOS fallback về VI. Thua vì màn organizer sẽ **trộn ngôn ngữ** (nút chung "Lưu"/"Huỷ" hoá EN giữa màn VI) và bề mặt "gần xong" hiếm khi được làm nốt.

### Option C — Quét trọn, duyệt phân tầng ✅
Effort: 8,5–10 nửa ngày (anh ~1,5). Quét cả 814 chuỗi như A; agent dịch toàn bộ theo glossary `src/i18n/en.ts` + bảng copy 7 màn có sẵn; anh duyệt tay **bề mặt người xem** (~480 chuỗi); màn organizer để state `needs_review` trong catalog — vẫn hiển thị EN, đánh dấu là nháp máy, nâng dần. Xưng hô: "bạn" hoặc bỏ chủ ngữ, tuyệt đối không "Anh…".

### Increments (đã gộp kết quả vòng 2 + pre-mortem)

0. **Dọn đường:** đóng/merge `feat/native-t4-t5-supervised` (conflict 9 file); anh chốt D3 + D4; baseline local `xcodebuild test` (CI đang chết).
1. **Config + catalog rỗng:** `developmentLanguage: vi`, `knownRegions`, `CFBundleLocalizations`, `Localizable.xcstrings` sourceLanguage vi. — Verify: pbxproj ra `vi`.
2. **Gỡ mìn chuỗi-mang-logic** (danh sách chốt từ panel, mỗi cái có file:line): `AccountSettingsView.swift:103` "XOÁ" magic-word (so sánh với `String(localized:)` cùng key hoặc bỏ magic-word); `DoublesElimRegistrationView.swift:222` `hasPrefix("Đăng ký thành công")` → enum `RegResult`; `DoublesElimRepository.swift:311` `?? "Đội"` ghi Supabase → giữ verbatim ngoài catalog (cùng `?? "Sự kiện"` ở `ClubModels.swift:73`/`SocialModels.swift:29`); `TeamMatchDetailView.swift:1366` enum `Mode` → bỏ `: String`, thêm `var label: LocalizedStringKey`; `DuprHeaderChip.swift:79-81` + `UserFacingError.swift:24` câu ghép → key câu trọn (B2: 25 call site đổi sang câu kết quả hoàn chỉnh — sửa luôn bug VI sống `"verify không thành công."` ở `MatchProposalRepository.swift:94,101`); 4 file test assert VI → assert identity; `Matchmaking.swift:277` `scheduleToText()` xuất Zalo **giữ VI cố định** (ngôn ngữ người nhận ≠ UI). — Verify: `xcodebuild test` xanh, baseline không giảm.
3. **Đổi signature design system + helper sang `LocalizedStringKey`** — đã đo thật vòng 2 (patch + build + export + revert): +156 trans-unit (755→911) với 42 dòng / 22 file / 0 call site sửa; BUILD SUCCEEDED. Kèm: bỏ qua 4 component chết (TLButton/TLSelect/TLSheet/TLDialog — 0 call site production); `TLErrorState.message` giữ `String`, `TLEmptyState` thêm `subtitleVerbatim` (tách API verbatim — 4 dòng); ~14 chỗ `.uppercased()` → `.textCase(.uppercase)`; `ArticleDetailView.swift:56` → `Text(verbatim:)`. **Sửa CÙNG lúc 14 formatter ghim `vi_VN`** (B4 — nếu không sẽ đẻ key rác `"%@ · %@"` vào catalog): `Date.FormatStyle` components thay `dateFormat`, `weekdaySymbols` thay bảng thứ hardcode, `.formatted(.relative)` thay `"\(minutes) phút trước"`. Riêng chỗ **data-canonical giữ ghim**: `VietQR.swift` (amount), parser `en_US_POSIX`. — Verify: export +143~156 key; build xanh.
4. **Ba gate rẻ (pre-mortem + critic):** (a) job CI thứ hai chạy đúng 154 test kèm `-testLanguage en -testRegion US` + 1 dòng log khởi động in `preferredLocalizations`/`Locale.current` — bắt lớp lỗi "lật locale ngoài diff"; (b) script so `%` specifier giữa bản EN và key nguồn trong `.xcstrings` (chặn crash format-string); (c) duplicate-gate: fail khi một chuỗi VI xuất hiện ≥2 file ngoài allowlist anh duyệt — chính là chỗ ~13 key va chạm được nâng lên symbolic (`"Trực tiếp"` Live/Rally, `"Miễn phí"` Free/Waived là 2 Blocker chức năng; danh sách đủ trong `round2/ui-ux-critic.json`). Lưu ý giới hạn gate: **mù với chữ Việt do Foundation sinh runtime** — đó là lý do (a) và bước 8 bắt buộc.
5. **⏸ Điểm dừng nhìn lại** — cơ chế đứng, gate có, chưa dịch chữ nào; dừng ở đây vẫn là tài sản.
6. **Quét 482 chuỗi bề mặt người xem** (3–4 PR theo feature dir) → gate giảm dần.
7. **Quét 332 chuỗi organizer** → gate về 0 (0 = hết literal, KHÔNG có nghĩa hết chữ Việt runtime — xem 4c).
8. **Dịch EN + import** theo glossary; plural variant cho ~40–60 key đếm số (`%lld đội` → one/other); organizer để `needs_review`; thuật ngữ chốt: "Double Elimination" (KHÔNG "Doubles Elimination" — sửa `src/i18n/en.ts:222` trước ở PR web riêng), "Round Robin"/"Draw groups" tách 3 nghĩa "Chia bảng", badge BTC ngắn ("ORGANIZER", "AWAITING ORGANIZER"), "Watch" không phải "Following", "Highlights." giữ dấu chấm.
9. **Verify hai locale trên sim** (build CÓ KÝ — gotcha keychain): screenshot ~20 màn VI/EN, không màn nào trộn; mục Language per-app hiện trong Settings; checklist auditor mục 8 dưới.

---

## 5. UI/UX (ui-ux-critic + GPT-5.6)

**Tổng thể:** tiền đề "EN dài hơn VI" bị đảo — EN hầu hết ngắn hơn; tab bar không cần động. Ba thứ thật sự giết trải nghiệm: key trùng nghĩa (thu hẹp còn 13 key sau vòng 2), 25 lỗi ghép câu ngữ pháp VI (B2), 14 formatter ghim `vi_VN` (B4 — VoiceOver giọng EN đọc "Th 4" phonetic sai).

**Luồng:** entry thật = deep-link Facebook → mismatch ngôn ngữ ở frame đầu không tự phục hồi (gốc của D3).

**Blocker giữ sau vòng 2:** B2 ghép câu · B4 formatter · B7 knownRegions (điều kiện tồn tại của cơ chế) · B6 plural · B5 enum Mode · B1 thu hẹp thành "13 key symbolic + duplicate-gate" · B3 = D3 chờ anh. **Nên sửa** giữ nguyên bảng vòng 1 (N1 TLSegmented lineLimit, N2 DuprHeaderChip fixedSize, N3 hai dấu phân cách nghìn — bug VI sống, N6 badge, N7 a11y, N8 offline state, N12…). Copy đề xuất đầy đủ trong `round1/ui-ux-critic.md`.

**Trạng thái màn hình:** giữ skeleton (TLLoadingView đúng chuẩn); Error dùng câu B2; **Offline chưa tồn tại** → thêm `TLOfflineState` + tự retry `NWPathMonitor`.

**A11y:** touch target sạch; bảng xếp hạng `QuickTableDetailView.swift:669-675` 0 label (VoiceOver đọc "T" thành chữ cái); danh từ riêng VI trên màn EN gắn `accessibilitySpeechLanguage("vi-VN")` per-element; tương phản fg4 9pt → manual-test-backlog.

**Panel đa model:** đồng thuận thật (cross-vendor): symbolic key cho chuỗi đa nghĩa (hình dạng fix), "Double Elimination", "Highlights.", tab bar không đụng, tên app không dịch, App Store metadata viết riêng từng locale. Bất đồng: default toggle (D3 — 3 phía, chờ anh); GPT bỏ sót B2 hoàn toàn; GPT đoán "Following" sai; GPT đòi hardcode `en_US` — bác (ép ngày Mỹ lên user Úc/Sing).

---

## 6. Rủi ro (risk-auditor + GPT-5.6 + pre-mortem)

### Verdict: 🔴 RED
Classifier: không chạy được (`risk-tier.mjs` không tồn tại) — cưỡng chế tay theo `docs/agent-idea-pipeline.md:119`: mọi `apple/**` = RED tại merge. Auditor refine: RED thủ tục + 1 lỗi chức năng thật; không có hạng mục không-revert-được.

Bảng 10 rủi ro đầy đủ trong `round1/risk-auditor.md`. Đỉnh bảng:

| # | Mức | Cơ chế | Giảm thiểu |
|---|-----|--------|------------|
| 1 | Cao | "XOÁ" magic-word → xoá tài khoản chết trên máy EN → Apple reject 5.1.1(v) | Increment 2 + test + verify tay EN |
| 2 | Cao | 976/1766 literal ở vị trí `String` — catalog không phủ → app trộn VI/EN "tệ hơn VI-only vì trông như xong" | Increment 3 + gate 4c |
| 3 | Cao (pre-mortem #1) | Thêm `en` vào bundle lật `Locale.current` → hành vi đổi NGOÀI diff: DatePicker AM/PM ghi giờ lệch 12h vào `social_events.start_at` (không dấu vết), collation đổi seed Mexicano vòng 1, `1.500.000 đ`→`1,500,000 đ` cạnh VietQR, countdown parse `DateFormatter()` không ghim | Gate 4a (CI chạy 2 locale + log khởi động); rà `Locale.current|localizedCompare|\.formatted\(|DateFormatter\(\)` toàn `apple/` đối chiếu diff; DatePicker giờ: cân nhắc ghim 24h hoặc giữ `.environment(\.locale)` theo app-locale |
| 4 | TB | Format specifier drift trong bản dịch EN → crash `EXC_BAD_ACCESS` chỉ ở EN + nhánh validation hiếm | Gate 4b |
| 5 | TB | CI Apple tests đang chết (Actions budget) — mọi badge vô nghĩa | Baseline + verify local, increment 0 |

**SLO:** không SLO nào bị đe doạ (7/7 đo web). **Perf:** bundle +0 KB, không chạm `src/`. **SEO:** không route SSR, không bump `pr:v30`, không cần Googlebot verify.

**Rollback:** `git revert`, ~10 phút, không migration/deploy/App Store. Ma sát duy nhất: nhánh t4-t5 mở (increment 0).

**Phản biện GPT-5.6:** xác minh & giữ — tách API verbatim (dẫn tới thí nghiệm quyết định D2), plural, key đa nghĩa; bác — "Đơn" đa nghĩa (kiểm 7/7 site đều "đánh đơn"), "hỏng im lặng runtime" (compiler chặn 100%, architect chứng minh bằng build thật).

**Pre-mortem — khoảng hở hệ thống đáng ghi lessons-learned:** native lặp đúng bài "gate chỉ đo một nhánh" của web (chỉ đo locale VI); không luật nào bắt khai báo khi làm yếu assertion (3 test VI-literal sẽ đỏ rồi bị "sửa cho xanh" thành tautology — increment 2 phải sửa sang assert identity, nói rõ trong PR); native **zero telemetry** — "soak 30 phút" là test tay 1 người/1 máy/1 locale, đừng chiếm ô "soak clean".

---

## 7. Tranh luận trong panel

> Ledger cưỡng chế tay (script thiếu). Bảng đầy đủ: `debate.json`.

| ID | Chủ đề | Vòng 2 | Kết quả |
|----|--------|--------|---------|
| D1 | literal-VI key vs symbolic key | architect REFINE · critic REFINE | **RESOLVED hội tụ**: literal mặc định + duplicate-gate + ~13 symbolic key. Critic tự bác 2 ví dụ trụ cột của mình bằng số tự đếm (va chạm thật 0,8%), architect nhận cơ chế va chạm là thật. Tồn dư nhỏ: nghĩa của "Sân" ở `SocialHubView.swift:12` — rơi vào allowlist anh duyệt. |
| D2 | Đổi signature hàng loạt vs tách API | auditor REFINE · architect REFINE | **RESOLVED hội tụ bằng 2 thực nghiệm độc lập cùng kết quả**: compiler chặn 100% (không có hỏng im lặng), chỉ 3-4 call site runtime, đòn bẩy +143~156 key đo thật; giữ bước 3 + tách API 2 chỗ + bỏ 4 component chết + B4 sửa cùng lúc. |
| D3 | Toggle ngôn ngữ | không đưa vòng 2 | **OPEN_FOR_CUONG** (mục 0) |
| D4 | Chính tả Hủy/Huỷ (mới, phát sinh vòng 2) | không mở vòng 3 (luật một vòng) | **OPEN_FOR_CUONG** (mục 0) |

**Bất đồng bị giết ở vòng 2 (ảo):** cả D1 lẫn D2 — chết vì hai bên cùng ra đo thay vì cãi. Đáng ghi: số đếm "814 vs 1766" tưởng mâu thuẫn hoá ra khác đơn vị (architect đối soát ra 1767, khớp auditor).

**Bất đồng sống sót (thật):** D3, D4 — cùng dữ kiện, khác giá trị (UX-first vs làm-ít-nhất; thương hiệu chính tả). Đúng loại việc của anh.

**Nhượng bộ bị LOẠI:** không có. Cả 3 REFINE đều kèm bằng chứng mới (grep, typecheck, patch+build, schema .xcstrings).

**Đồng thuận có nghĩa (cross-vendor GPT-5.6 + Claude, độc lập):** tách API localized/verbatim; symbolic key cho chuỗi đa nghĩa; "Double Elimination". **Đồng thuận KHÔNG tính:** pre-mortem + risk-auditor cùng tìm ra "XOÁ" và `hasPrefix` — hai Claude cùng nhiệm vụ tìm-cái-hỏng, chỉ chứng minh chúng cùng là Claude; giá trị nằm ở chỗ mỗi bên tự trỏ được file:line.

---

## 8. Kế hoạch verify

**Tự động (native — thay cho suite web vì diff không chạm src/):**

- [ ] `git diff --name-only main...HEAD | grep -vE '^(apple|docs)/'` → rỗng (cổng cứng; ngoại lệ duy nhất nếu anh duyệt D4-PR-riêng và `en.ts:222`)
- [ ] `cd apple && xcodegen generate && xcodebuild build` exit 0
- [ ] `xcodebuild test` local 154/154 + job mới `-testLanguage en -testRegion US` (CI Actions budget đang chết — chạy local tới khi có budget)
- [ ] Gate duplicate-key + gate `%` specifier + gate literal-VI-ngoài-catalog về 0
- [ ] Export/import round-trip `.xcstrings` không mất entry

**Cuong phải tự làm:**

- [ ] Sim locale EN (build có ký): xoá tài khoản gõ đúng chuỗi hiển thị → nút bật; đăng ký đôi → form reset; tạo sự kiện → giờ picker đúng 18:00 không AM/PM lệch; tạo giải trống tên đội → DB ra `"Đội"` không phải `"Team"`
- [ ] Screenshot 5 màn chính EN — đếm chuỗi còn VI (bắt lớp Foundation-runtime mà gate mù)
- [ ] Settings → ThePickleHub → mục Language hiện ra
- [ ] Duyệt allowlist ~191 chuỗi trùng file + bản dịch bề mặt người xem

---

## 8b. Ghi chú thi hành (cập nhật dần trong /ship)

- **28/07 — PR chuẩn hoá chính tả** (`chore/vi-spelling-normalize`, 3fe3a3b4): 30 file, 162 dòng 1:1. QA phát hiện nợ có sẵn: **~25 chuỗi `Huỷ`/`Xoá` hardcode inline trong components web** (SubmitDuprDialog, useConfirm, CommentRow, admin pages… + 1 assertion `comment-moderation.test.ts:103`) — ngoài phạm vi, cần 1 PR quét riêng nếu muốn web thống nhất 100%.
- **Đính chính claim panel:** `MatchProposalRepository.swift:94,101` `action: "verify"/"dispute"` là payload RPC (`ActionBody`), KHÔNG phải UserFacingError → không phải bug VI sống như ui-ux-critic B2 ghi; không được dịch.
- **Recon đọc nhánh cũ:** main hiện tại đã Swift 6 + `SWIFT_TREAT_WARNINGS_AS_ERRORS: YES` (memory đúng, recon sai vì chạy trên `docs/human-path-lessons` sau main 6 commit).
- **Gate inc.4 đã dựng:** `scripts/native-i18n-gates.mjs` (duplicates/specifiers/coverage) + `apple/i18n-duplicate-allowlist.txt` (231 chuỗi, 13 va chạm đánh dấu phải-symbolic) + 2 bước mới trong `apple-tests.yml` (gates + full suite `-testLanguage en`). Coverage baseline: 2389 literal (đếm cả occurrence trùng — khác đơn vị với 814 chuỗi-chưa-trích của architect).
- Nhánh `feat/native-t4-t5-supervised` đã xác minh merged-via-#492; xoá remote bị classifier chặn — **Cuong xoá tay**: `git push origin --delete feat/native-t4-t5-supervised`.

## 9. Sau khi ship

- SHA: · PR: · Ngày:
- Khác kế hoạch:
- Học được (→ lessons-learned): native gate một-locale = bài "chỉ đo nhánh bot" lặp lại; khai báo tường minh khi làm yếu assertion; "soak" native = test tay, gọi đúng tên.
