# risk-auditor — native-bilingual (nguyên văn, vòng 1, 28/07)

## Verdict: 🔴 RED
Cuong bỏ ra 3–5 nửa ngày, merge một diff 151 file, và nhận về một app **45% vẫn tiếng Việt khi máy đặt EN**, kèm **nút xoá tài khoản chết cứng với người dùng EN** — mà không gate nào bắt được, vì `Apple tests` trên CI đã chết từ khi hết Actions budget.

Classifier: **không chạy được** — `scripts/agents/risk-tier.mjs` không tồn tại trong repo (khớp memory `idea-pipeline-missing-scripts`). Em cưỡng chế thủ công theo `docs/agent-idea-pipeline.md:119`: mọi file `apple/**` = RED tại merge, "không có ngoại lệ".

**Refine phạm vi (theo tiền lệ DS-03):** RED này là **thủ tục** (cổng `apple/**` cần Cuong duyệt tường minh) + **một lỗi chức năng thật** (xoá tài khoản). Blast radius lên 2000 user web = **0**, với điều kiện cổng phạm vi diff giữ được. Đây không phải RED kiểu "sập prod"; nói ngược lại là dối.

---

## Rủi ro cụ thể

| # | Mức | Cơ chế hỏng | Người dùng thấy gì | Giảm thiểu |
|---|-----|-------------|--------------------|------------|
| 1 | **Cao** | `apple/ThePickleHub/Features/Profile/AccountSettingsView.swift:103` — placeholder `TextField("Nhập XOÁ để xác nhận")` sẽ được dịch thành "Type DELETE…", nhưng guard vẫn là `.disabled(deleteText…uppercased() != "XOÁ")`. Chuỗi kiểm tra là literal cứng, không nằm cùng catalog entry với placeholder. | Máy đặt EN: gõ `DELETE` → nút "Delete permanently" **vĩnh viễn disabled**. Không xoá được tài khoản. App Store Guideline 5.1.1(v) bắt buộc có luồng này. | Thay so sánh chuỗi bằng so với `String(localized:)` cùng key, hoặc tốt hơn: bỏ magic-word, dùng hold-to-confirm. Thêm 1 test. |
| 2 | **Cao** | **976/1766 literal VI nằm ở vị trí kiểu `String`, không phải `LocalizedStringKey`** → Xcode **không trích xuất vào `.xcstrings`** và **không localize lúc runtime**. Hai nguồn chính: (a) computed property trong `ThePickleHub/Core/**` — `var label: String { self == .doubles ? "Đôi" : "Đơn" }`, `switch code { case "setup": return "Đang cài đặt" }` (181 literal riêng trong Core/); (b) tham số của chính design system: `TLEmptyState.title: String`, `TLPrimaryButton.title: String`, `TLTextField.placeholder: String` (`DesignSystem/Components/TLComponents.swift:30,84,201`, `TLStateViews.swift:34,66`) — bên trong làm `Text(title)` với `title: String` = verbatim. | Máy đặt EN: nút/tiêu đề dịch, còn toàn bộ nhãn trạng thái, empty state, thông báo lỗi, nút Đăng nhập/Mật khẩu **vẫn tiếng Việt**. UI lẫn lộn VI/EN — tệ hơn VI-only vì trông như đã xong. | Kế hoạch "tạo catalog rồi dịch" chỉ phủ 790/1766 (45%). 976 chuỗi còn lại cần **sửa code từng chỗ**. Phải tách giai đoạn: đổi API design system trước, rồi mới quét chuỗi. |
| 3 | **TB** | `Features/Bracket/DoublesElimRegistrationView.swift:222` — `if model.regMessage?.hasPrefix("Đăng ký thành công") == true { partner = nil; teamName = "" }`. Nguồn ở `DoublesElimDetailView.swift:100`. Chuỗi hiển thị đang bị dùng làm **tín hiệu điều khiển**. | Đăng ký đôi thành công nhưng form **không reset** → đăng ký trùng. | Đổi `regMessage: String?` thành enum `RegResult { case ok(Double?), failed(String) }`. Refactor bắt buộc. |
| 4 | **TB** | `Core/DoublesElim/DoublesElimRepository.swift:311` — fallback `?? "Đội"` đưa vào `DEAtomicCreateTeam(team_name: derived)` rồi **POST lên Supabase RPC**. Chuỗi VI duy nhất thực sự ghi xuống server. | Máy EN → DB có `team_name = "Team"`, người xem VI trên web thấy đội tên "Team". Data phụ thuộc locale người tạo. | Giữ `"Đội"` verbatim (không vào catalog), hoặc gửi `nil`. Đánh dấu `// ponytail: canonical, không dịch`. |
| 5 | **TB** | **203 literal VI có nội suy** (`"Còn \(slotsLeft) suất"`, `"\(minutes) phút trước"`, `"\(c) sân"`). VI không chia số nhiều, EN có. Chuỗi ghép mảnh (`"SẮP PHÁT" + " · " + time` ở `Features/Home/HomeView.swift:129`) không thể thành một key. | EN sai ngữ pháp ở đúng chỗ đếm số — hầu hết badge. | String Catalog plural variants; viết lại thành câu nguyên vẹn trước, không dịch mảnh. |
| 6 | **TB** | `Apple tests` workflow **đang fail 100%, mỗi run 4–7 giây, không step nào chạy, không log** (run 30338254618, 30338504050, 30327032561…). Signature hết Actions budget, khớp memory "Actions budget CẠN". | Không ai thấy gì. PR 151 file merge với gate đỏ vô nghĩa; baseline 154 test chỉ tồn tại trên máy Cuong. | Chạy `xcodebuild test` cục bộ lấy baseline thật, chạy lại sau mỗi lô. Đừng tin badge CI. |
| 7 | **Thấp** | 7 dòng test assert chuỗi VI nguyên văn, ở **4 file** chứ không phải 2 như recon nói: `Tests/UserFacingErrorTests.swift:13,23`, `Tests/TournamentMutationErrorTests.swift:11,18`, `Tests/MatchmakingTests.swift:89,90`, `Tests/DraftStoreTests.swift:21`. | Test đỏ cục bộ. | Assert key hoặc chạy test locale cố định. |
| 8 | **Thấp** | `Core/Social/Matchmaking.swift:277-289` — `scheduleToText()` sinh lịch thi đấu VI copy vào `UIPasteboard` để BTC dán vào **Zalo**. | BTC máy EN dán lịch tiếng Anh cho nhóm Zalo người Việt. | Ngôn ngữ UI ≠ ngôn ngữ người nhận. Chốt policy: chuỗi export giữ VI, hoặc cho chọn khi share. |
| 9 | **Thấp** | Chính tả không nhất quán tạo key trùng: `"Hủy"` (16) và `"Huỷ"` (13) là **hai key catalog khác nhau**. Tổng 1105 key distinct / 1766 lần dùng. | Dịch một biến thể sót biến thể kia → nút Cancel chỗ EN chỗ VI. | Chuẩn hoá chính tả **trước** khi sinh catalog. |
| 10 | **Thấp→TB** | `Mode` enum `TeamMatchDetailView.swift:1366`. **Recon gọi "logic-bearing" — sai.** Chỉ dùng ở `@State` (:1368) và `ForEach { Text($0.rawValue) }` (:1410). Không persist, không gửi server. | Ngược lại: `Text($0.rawValue)` = `Text(String)` → **verbatim**. Bỏ vào catalog xong picker **vẫn tiếng Việt**, im lặng. Ví dụ mẫu của rủi ro #2. | `enum Mode: CaseIterable` + computed `var label: LocalizedStringKey`. |

---

## Điều recon nói sai, đã kiểm lại

- **"~1000 literal"** → thật là **1766** (1105 distinct).
- **"2 file test assert VI"** → **4 file, 7 dòng**. `MatchmakingTests.swift:89-90` là assertion thật.
- **`TeamMatchDetailView.swift:1366` là logic-bearing** → không. Rủi ro chiều ngược lại (#10).
- **Intake "app chưa phân phối"** → **đúng, đã xác minh**: App Store `id6759968026` = `net.thepicklehub.app` v1.0.1 (min iOS 15) là app **Capacitor cũ**, khác `net.thepicklehub.app.dev` (min iOS 17) của `/apple`. Hai bundle ID khác nhau → PR này không chạm bản trên App Store.

## SLO bị đe doạ
**Không có.** Cả 7 SLO trong `docs/slo.md` đo web + edge functions + cron; `/apple` không nằm trong đường đo nào. Ngoại lệ đáng ghi: rủi ro #4 ghi dữ liệu sai ngôn ngữ vào bảng dùng chung — chất lượng dữ liệu, không phải mất mát.

## Ngân sách hiệu năng
- **Bundle: +0 KB → ~1822 / 1970 KB gz.** Diff không chạm `src/`, `functions/`, `workers/`. Coupling duy nhất là comment (`src/lib/quickTableResult.ts:5`, `src/lib/doublesElimResult.ts:6`, `src/lib/flexStats.ts:6`) — không vào build.
- **Vietnam p75: không ảnh hưởng.**

## SEO
- **Routes SSR bị ảnh hưởng: none.** Không bump `pr:v30`, không cần verify Googlebot.

## Kế hoạch rollback
- **Cơ chế:** `git revert` đủ. Không migration, không deploy, không submit App Store. ~10 phút.
- **Không revert được:** không có hạng mục nào — lý do refine RED xuống "thủ tục".
- **Ma sát thật:** nhánh `feat/native-t4-t5-supervised` đang mở, đụng **9 file Swift** trùng vùng mật độ VI cao nhất (`SocialEventFormView.swift` 48 literal, `ClubManageView.swift` 31, `DuprHeaderChip.swift`, `ClubRepository.swift`, `SocialOrganizerRepository.swift`). **Đóng hoặc merge nhánh đó trước khi bắt đầu.**

## Ước lượng 3–5 nửa ngày: không đứng vững
12–20 giờ cho 1766 literal = 24–41 giây/chuỗi, chưa tính: 976 chỗ sửa code, 203 chỗ viết lại plural, đổi API design system, refactor 2 chỗ control-flow, dịch + review EN, test tay hai ngôn ngữ.

## Phải verify trước khi merge
- [ ] `git diff --name-only main...HEAD | grep -vE '^(apple|docs)/'` → **rỗng**. Cổng cứng.
- [ ] `cd apple && xcodegen generate && xcodebuild test ...` → 154/154 **cục bộ** (CI đang chết).
- [ ] Chụp `AccountSettingsView` với `-AppleLanguages "(en)"`: gõ chuỗi placeholder → nút destructive **phải** bật.
- [ ] Đăng ký đôi locale EN → form reset (rủi ro #3).
- [ ] Tạo giải doubles-elim locale EN, trống tên đội → `doubles_elim_teams.team_name` **phải** là `"Đội"` (rủi ro #4).
- [ ] Đếm chuỗi còn VI khi chạy EN: screenshot 5 màn chính. Còn VI → #2 chưa xong.
- [ ] `grep -c 'Hủy\|Huỷ'` → chỉ còn một biến thể.

## Phản biện độc lập (GPT-5.6)
Chạy qua OpenAI Responses API (`codex` CLI từ chối `gpt-5.6` với tài khoản ChatGPT). Prompt: `docs/proposals/native-bilingual/external/risk-auditor-prompt.md`; reply: `docs/proposals/native-bilingual/external/risk-auditor-reply.md`.

**Đã xác minh và giữ lại:**
- *"Đừng sửa design system bằng cách đổi mọi `String` thành `LocalizedStringKey`"* — **đúng, em đã bỏ sót**. Kiểm chứng: `Features/Feed/Detail/ArticleDetailView.swift:56` truyền `TLPrimaryButton(title: readLabel)` với `readLabel` dựng từ dữ liệu server (`:90` `"Đọc toàn bộ tại \(news.source)"`); `Features/Tournaments/TournamentsView.swift:53` truyền `TLErrorState(message: message)` với message runtime. Đổi kiểu hàng loạt sẽ biến nội dung server thành key tra cứu catalog. **Phải tách API localized vs verbatim.**
- Plural/ngữ pháp EN — xác nhận 203 literal nội suy.
- Va chạm key một-chuỗi-nhiều-nghĩa — xác nhận bằng ca `"Hủy"/"Huỷ"` (dữ liệu thật, mạnh hơn ví dụ GPT).
- Kết luận "an toàn với sản phẩm live, không phải low-risk như một kế hoạch" — trùng độc lập.

**Bác bỏ / chỉnh:**
- *"`Đơn` cần dịch khác nhau"* — không đúng trong repo này (kiểm cả 7 chỗ, đều nghĩa "đánh đơn").
- *"Missing translations → mixed screens"* — đúng nhưng thiếu vế nặng hơn: 976 chuỗi không có mặt trong catalog để mà thiếu.
- GPT không thấy (không đọc repo): CI chết (#6), conflict nhánh t4-t5, số 1766/976/203, ba chỗ recon sai.

## Thực nghiệm tự chạy (không suy đoán)
Dựng project tối thiểu cùng settings, build + chạy sim:
- **xcodegen 2.45.4 xử lý `.xcstrings` đúng** (`text.json.xcstrings`, vào Resources). Không phải rủi ro.
- **Xcode 26.3** — String Catalog OK.
- Bundle chỉ có `en.lproj`, không `vi.lproj`, `CFBundleDevelopmentRegion = vi` — **đúng thiết kế**.
- Runtime: `Bundle.main.localizations == ["en", "vi"]` → **iOS hiện mục chọn ngôn ngữ per-app trong Settings. Cách Cuong chọn hoạt động được.**
- `String(localized: "Đăng nhập")` → `"Sign in"` dưới `AppleLanguages=(en)` ✓
- `Mode.random.rawValue` → `"Ngẫu nhiên"`, không đổi ✓

**Giới hạn nói rõ:** claim "`Text(variable)` không localize" chứng minh bằng type-system + tài liệu Apple, chưa chốt bằng ảnh runtime — vì vậy "screenshot 5 màn ở EN" nằm trong checklist verify.
