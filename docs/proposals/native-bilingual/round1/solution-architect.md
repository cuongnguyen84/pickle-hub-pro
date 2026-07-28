# solution-architect — native-bilingual (nguyên văn, vòng 1, 28/07)

Evidence gathered and verified. Writing the proposal.

## Tóm tắt kiến trúc

Đổi `apple/` sang song ngữ bằng **một `Localizable.xcstrings` duy nhất, key = chuỗi VI gốc**, không đụng tới 95% call site — vì `SWIFT_EMIT_LOC_STRINGS: "YES"` (`apple/project.yml:50`) **đã** trích được 755 key hôm nay mà không cần sửa một dòng Swift nào (em đã chạy thật `xcodebuild -exportLocalizations`, exit 0, repo sạch). Việc thật nằm ở **814 chuỗi VI không tự trích được** trong 112 file — chủ yếu là `String` thuần trong `Core/` và các helper func private trong view — cộng một **lỗi cấu hình phải sửa trước tiên**: `project.pbxproj:1277` ghi `developmentRegion = en` trong khi source language thật là VI. Trục quyết định không phải "key VI hay key semantic" (đã ngã ngũ: key VI), mà là **quét bao nhiêu bề mặt và ai duyệt bản dịch**.

### Bằng chứng em tự kiểm (không lấy từ recon)

| Điều | Kết quả thật |
|---|---|
| `xcodebuild -exportLocalizations -scheme ThePickleHub` từ CLI | **exit 0**, ra `en.xcloc`, `git status apple/` **sạch** — không cần Xcode GUI |
| Key tự trích được | **755** trans-unit; **655** có dấu tiếng Việt, 100 là rác kiểu `"  ·  "`, `"%@ %@"`, `"#"` |
| Interpolation | Tự thành format key. Có thật trong xliff: `"%lld / %lld đã đăng ký"`, `"%@ → %lld suất vào playoff"` → **axis 3 gần như miễn phí** |
| `accessibilityLabel` literal VI | **36/36 đã được trích** — overload `LocalizedStringKey` thắng. **Axis 4 miễn phí phần này** |
| `String(format:)` | Recon nói 41. Thật: **chỉ 1 chuỗi có chữ VI** (`Core/Social/SocialModels.swift:91`, `"Tự đánh giá %.1f"`). 40 cái còn lại là `%02d`/`%.2f` thuần số → **0 việc** |
| `Text(verbatim:)` / `NSLocalizedString` / `LocalizedStringKey` hiện có | **0 / 0 / 0** |
| Chuỗi VI **không** tự trích | **814**, trong **112 file**; median 4/file; 67 file ≤5; chỉ 8 file >20 |
| enum rawValue VI | Đúng 1 cái. `TeamMatchDetailView.swift:1366` dùng ở **duy nhất** dòng 1410 `Text($0.rawValue)` — chỉ hiển thị, **không persist** |
| XcodeGen 2.45.4 | Hỗ trợ `.xcstrings` từ 2.39.0 (CHANGELOG #1421), biết `text.json.xcstrings`, có `options.developmentLanguage` |

### Cái bẫy phải sửa trước mọi thứ khác

`apple/project.yml:13` đặt `DEVELOPMENT_LANGUAGE: vi` **dưới `settings.base`** — đó là build setting, chỉ nuôi `CFBundleDevelopmentRegion` trong Info.plist. Nó **không** set `developmentRegion` của pbxproj:

```
apple/ThePickleHub.xcodeproj/project.pbxproj:1277:   developmentRegion = en;
apple/ThePickleHub.xcodeproj/project.pbxproj:1279-1282:   knownRegions = ( Base, en, );
```

Hệ quả đã quan sát được trong log export: toolchain ghi chuỗi **tiếng Việt** vào `ThePickleHub/App/en.lproj/Localizable.strings`. Nếu bootstrap catalog trong trạng thái này, `.xcstrings` sẽ sinh ra với `sourceLanguage: "en"` chứa toàn tiếng Việt — máy locale EN sẽ nhận tiếng Việt làm "bản tiếng Anh", đúng cái kết quả mình muốn tránh. Fix là `options: developmentLanguage: vi` trong `project.yml` (khác chỗ với dòng 13 hiện tại), verify bằng `grep developmentRegion project.pbxproj` → `vi`.

---

## Option A — Quét trọn, Cuong duyệt trọn

**Effort: 11 nửa ngày** · **Data: none** (không migration, không RLS, không RPC — thuần client + Xcode config)

Files: `apple/project.yml` · `apple/ThePickleHub/App/Info.plist` · `apple/ThePickleHub/Resources/Localizable.xcstrings` (mới) · 112 file `.swift` chứa 814 chuỗi · `apple/Tests/UserFacingErrorTests.swift` · `apple/Tests/TournamentMutationErrorTests.swift` · `.github/workflows/apple-tests.yml`

**How it works.** Sửa `developmentLanguage: vi` + `knownRegions: [vi, en]`, thêm `CFBundleLocalizations` (`vi`, `en`) vào Info.plist — đây là thứ làm iOS hiện mục chọn ngôn ngữ per-app trong Settings, đúng ý Cuong ở intake. Bootstrap `Localizable.xcstrings` với `sourceLanguage: "vi"`. Sau đó quét 814 chuỗi theo **hai cơ chế, không phải một**:

- *Trong SwiftUI position:* đổi kiểu tham số của helper thành `LocalizedStringKey` là call site tự trích, **không sửa call site**. Đòn bẩy tập trung ở `apple/ThePickleHub/DesignSystem/Components/TLComponents.swift:30,84,97,129,168,191` và `TLStateViews.swift:34,35` (`let title: String` → `LocalizedStringKey`), cộng các helper private trong view: `field(_:)` 43 chỗ, `sectionHeader(_:)` 19, `note(_:)` 14, `toggleRow(_:)` 9, `labeled(_:)` 9 — mỗi cái sửa **một dòng signature** để cứu hàng chục call site.
- *Ngoài SwiftUI (220 chuỗi trong `Core/`):* bọc `String(localized:)`. Phần lớn nằm gọn trong computed property kiểu `var statusText: String` (`Core/Tools/ToolsModels.swift:14-18,33-37,60-64`) nên sửa tại chỗ tập trung, không rải rác.

Ba chỗ phải viết lại chứ không bọc được:
- `Features/Home/DuprHeaderChip.swift:79-81` — nối chuỗi `base + (d > 0 ? ", tăng \(...)" : ", giảm \(...)")`. Câu ghép từ mảnh thì không dịch được; phải thành 2 key câu trọn.
- `Core/Errors/UserFacingError.swift:24` — `"\(action) không thành công. \(detail)"` với `action` là chuỗi VI truyền từ call site. Phải cho `action` thành `String.LocalizationValue` hoặc key hoá cả câu.
- `TeamMatchDetailView.swift:1366` — bỏ `: String` khỏi `enum Mode`, thêm `var label: LocalizedStringKey`, sửa dòng 1410. Rẻ vì rawValue không hề được persist (em đã grep toàn repo: đúng 1 usage).

**Test.** `TournamentMutationErrorTests.swift:13-14,20-21` assert `contains("tải lại")` / `contains("trận phụ thuộc")` — nhưng ngay phía trên đã có `#expect(error == .versionConflict)`, tức assert chuỗi là **thừa**, xoá là xong, không mất coverage. `UserFacingErrorTests.swift:13-14` assert nguyên câu ghép; đổi sang assert cấu trúc (`hasPrefix(action)` + `contains(detail)`) thì test giữ nguyên ý nghĩa và độc lập locale. Đây là cách đúng: đừng ép locale trong test, hãy bỏ assert dựa vào bản dịch.

**Wins:** hết sạch nợ, EN 100%, không màn hình nào lộn ngôn ngữ.
**Loses:** ~4 nửa ngày trong đó là **Cuong ngồi duyệt ~1.400 chuỗi**, phần lớn là màn hình tổ chức giải mà hôm nay chưa có người dùng EN nào mở.
**Forecloses:** gần như không đóng cửa gì — nhưng khoá Cuong vào một mẻ dài, và mẻ dài của một người thì hay đứt giữa chừng.

---

## Option B — Chỉ lát cắt người xem (bản rẻ)

**Effort: 6 nửa ngày** · **Data: none**

Files: như A nhưng chỉ **88 file** (482 chuỗi); **bỏ hẳn 24 file organizer / 332 chuỗi** (`Features/Bracket/Create*`, `TeamMatch*`, `*DetailView`, `Features/Social/Organizer/*`, `Features/Clubs/ClubManage*`).

**How it works.** Cùng cơ chế A. Chuỗi của màn hình tổ chức giải **không điền giá trị EN** trong catalog → iOS fallback về source language, màn đó render tiếng Việt trọn vẹn ngay cả trên máy EN. Đây là hành vi có sẵn của String Catalog, không phải hack.

**Wins:** rẻ nhất, đúng tinh thần "làm 30% rồi xem có ai dùng không"; app chưa phân phối nên phần bị cắt là phần khó có người EN chạm tới nhất.
**Loses:** **lỗi trộn ngôn ngữ trong cùng màn**. Key gom theo nội dung chuỗi, nên `"Lưu"`, `"Huỷ"`, `"Chia sẻ"` dùng chung với bề mặt người xem sẽ hoá EN, còn phần nghiệp vụ vẫn VI → màn tổ chức giải thành nút tiếng Anh, nội dung tiếng Việt. Không sập, nhưng nhìn là biết làm dở.
**Forecloses:** không đóng cửa kỹ thuật nào (nâng lên A chỉ là quét thêm file). Nhưng đóng cửa **tâm lý**: một bề mặt "gần xong" hiếm khi được quay lại làm nốt.

---

## Option C — Quét trọn, duyệt phân tầng

**Effort: 8,5 nửa ngày** (trong đó Cuong ~1,5 thay vì ~4) · **Data: none**

Files: y hệt A.

**How it works.** Cơ chế và phạm vi quét **giống hệt A** — cả 814 chuỗi, không màn nào bị trộn. Khác ở chỗ **ai duyệt cái gì**: agent dịch toàn bộ, lấy thuật ngữ chuẩn từ `src/i18n/en.ts` (2.746 entry, đã là glossary thật: "Loại kép", "Chia bảng", "Đồng đội"…) và bảng copy 7 màn ở `docs/proposals/web-native-parity-port/round1/ui-ux-critic.md:182-259`. Cuong **duyệt tay** bề mặt người xem (~480 chuỗi: onboarding, login, home, tournaments, profile, live, feed); bề mặt tổ chức giải để state `needs_review` trong `.xcstrings` — vẫn hiển thị EN bình thường, nhưng đánh dấu rõ là bản nháp máy, nâng cấp dần khi có người dùng EN thật.

Ràng buộc giữ nguyên: xưng hô "bạn" hoặc bỏ chủ ngữ, tuyệt đối không đưa "Anh…" vào (native hiện sạch, đừng làm bẩn).

**Wins:** không trộn ngôn ngữ; tiêu ít nhất **tài nguyên khan hiếm thật sự là buổi tối của Cuong**; `needs_review` là hàng đợi công khai chứ không phải nợ ẩn.
**Loses:** ~330 chuỗi máy dịch lên sản phẩm mang tên Cuong mà chưa ai đọc lại.
**Forecloses:** không gì. Nâng lên A = duyệt nốt hàng đợi `needs_review`, không phải sửa code.

---

## Khuyến nghị

**Option C.**

**A thua** vì phần chênh ~4 nửa ngày của nó gần như toàn bộ là Cuong duyệt chuỗi cho `Features/Bracket/Create*` và `TeamMatch*` — 332 chuỗi thuộc màn hình tổ chức giải. App **chưa phân phối**, và người tổ chức giải hôm nay 100% là người Việt. Bỏ tiền của người khan hiếm nhất để mua chất lượng trên bề mặt chưa có độc giả là sai thứ tự.

**B thua** vì nó chỉ tiết kiệm ~2,5 nửa ngày so với C, mà đổi lại một khiếm khuyết nhìn thấy được: key gom theo nội dung chuỗi nên nút chung sẽ hoá EN giữa màn tiếng Việt. Với C, cơ chế đã xong trọn — thứ còn thiếu chỉ là chất lượng bản dịch, và chất lượng thì nâng được mà không cần đụng lại code. Cái rẻ đúng chỗ là **hoãn việc duyệt**, không phải hoãn việc quét.

Riêng con số: intake ghi 3–5 nửa ngày. Theo bằng chứng đếm được (814 chuỗi / 112 file, chưa kể dịch và verify hai locale), **ước lượng đó thấp gấp đôi**. C = 8,5. Nếu Cuong vẫn muốn khung 3–5 thì phải chọn B, chứ không phải làm A nhanh hơn.

### Nằm ngoài luật nào

- **Không chạm bundle JS.** `docs/perf-budgets.md:45` backstop 1970 KB gz — thay đổi thuần native, 0 KB, không cần lazy-load gì.
- **Không có route public mới** → không cần handler `functions/_lib/render/`, không sitemap, không hreflang.
- **Không RED-tier**: không auth, không payments, không `supabase/config.toml`. Lưu ý `scripts/agents/risk-tier.mjs` **hiện không tồn tại trong repo** (em đã kiểm) — khớp memory `idea-pipeline-missing-scripts`, nên phân tầng rủi ro phải ghi tay vào proposal.
- **Song ngữ từ ngày đầu**: thoả mãn, vì đây chính là việc đưa EN vào.

---

## Increments

1. **Config + catalog rỗng.** `project.yml` (`options.developmentLanguage: vi`, `knownRegions: [vi, en]`), `Info.plist` (`CFBundleLocalizations`), `Resources/Localizable.xcstrings` với `sourceLanguage: "vi"`. — *Verify:* `xcodegen generate && grep developmentRegion apple/ThePickleHub.xcodeproj/project.pbxproj` phải ra `vi` (hôm nay là `en`), và `knownRegions` chứa `vi`.
2. **Gỡ mìn test + enum + 3 chỗ nối chuỗi.** Xoá 2 assert thừa ở `TournamentMutationErrorTests.swift:13-14,20-21`, đổi `UserFacingErrorTests.swift:13-14` sang assert cấu trúc; `TeamMatchDetailView.swift:1366,1410`; `DuprHeaderChip.swift:79-81`; `UserFacingError.swift:24`. — *Verify:* `xcodebuild test` xanh, **154 tests baseline không giảm**.
3. **Đổi signature helper + DesignSystem sang `LocalizedStringKey`.** `TLComponents.swift`, `TLStateViews.swift`, và các helper private `field/sectionHeader/note/toggleRow/labeled`. — *Verify:* export lại, số trans-unit **755 → tăng rõ rệt** mà **không sửa call site nào**. Đây là điểm đo đòn bẩy có thật hay không.
4. **Viết gate chống thủng.** Script CI so chuỗi VI trong source với key đã trích, fail nếu còn chuỗi VI ngoài catalog (chính là script em đã chạy trong phiên này — nó ra đúng con số 814). Thêm vào `.github/workflows/apple-tests.yml`. — *Verify:* chạy trên HEAD hiện tại phải báo 814; sau khi quét xong phải về 0.
5. **⏸ Điểm dừng nhìn lại.** Tới đây cơ chế đã đứng, gate đã có, chưa dịch chữ nào. Nếu quỹ thời gian hụt, dừng ở đây vẫn là tài sản chứ không phải nửa vời — app vẫn VI-only, chạy y như cũ.
6. **Quét 482 chuỗi bề mặt người xem**, chia 3–4 PR theo feature dir. — *Verify:* gate ở bước 4 giảm dần, `xcodebuild test` xanh mỗi PR.
7. **Quét 332 chuỗi bề mặt tổ chức giải.** — *Verify:* gate về **0**.
8. **Dịch EN + import.** `xcodebuild -exportLocalizations -exportLanguage en` → dịch theo glossary `src/i18n/en.ts` → `-importLocalizations`. Bề mặt tổ chức giải để `needs_review`. — *Verify:* `.xcstrings` có đủ 2 locale, build xanh.
9. **Verify hai locale trên simulator.** `xcrun simctl spawn <id> defaults write -g AppleLanguages '("en-US")'` rồi chụp màn ~20 màn chính ở cả hai; kiểm mục chọn ngôn ngữ per-app đã hiện trong Settings. — *Verify:* screenshot cặp VI/EN, không màn nào trộn.

---

## Điều em không chắc

- **Bước 3 là canh bạc lớn nhất của ước lượng.** Em đo được 556/814 chuỗi **không** nằm ở vị trí đối số hàm (ternary, `return`, gán biến) — số này *không* được cứu bởi việc đổi signature. Em suy ra đòn bẩy signature cứu được cỡ 150–250 chuỗi, nhưng **chưa chứng minh bằng cách sửa thật rồi export lại đếm**. Nếu con số thật thấp hơn nhiều, C trượt từ 8,5 lên ~10 nửa ngày và khoảng cách với A hẹp lại — lúc đó nên chọn A. Bước 3 chính là chỗ đo, và nên đo **trước** khi cam kết phần còn lại.
- **Số 814 có dương tính giả.** Em chuẩn hoá interpolation `\(...)` sang `%` bằng regex; biểu thức lồng ngoặc sâu (ví dụ `Text("... \(String(format: "%.2f", d)) ...")`) có thể khớp trượt và bị đếm nhầm là "chưa trích". Em đã thấy vài ca nghi ngờ trong nhóm `Text( direct` (18 chuỗi). Sai số em đoán 5–10%, lệch về phía **overcount**, tức việc thật có thể nhẹ hơn một chút.
- **`String(localized:)` + interpolation trong Swift 5.0 language mode.** `project.yml:11` đang là `SWIFT_VERSION: "5.0"`. `String.LocalizationValue` interpolation cần Swift 5.9+ *compiler* (có, Xcode 26.3) chứ không phải language mode 5 — em tin là chạy được, nhưng **chưa compile thử một dòng**. Nếu vướng, fallback là `String(format: String(localized:), args)`, xấu hơn nhưng không chặn.
- **Số nhiều tiếng Anh.** VI không chia số nhiều nên key `"%lld người đã đăng ký"` là một dạng duy nhất; EN cần "1 player" / "2 players". String Catalog có plural variation per-language nên về cơ chế là ổn — nhưng em **chưa đếm** trong 136 key có format specifier thì bao nhiêu cái thật sự cần biến thể số nhiều EN. Em ước cỡ 40–60 (grep thô ra 44 chỗ interpolation đi kèm `người/trận/đội/suất`). Đây là công dịch, không phải công code.
- **`-importLocalizations` ghi ngược vào `.xcstrings`.** Em đã verify chiều **export** chạy thật từ CLI (exit 0). Chiều **import** vào một catalog đã tồn tại thì em chưa chạy, vì hôm nay chưa có `.xcstrings` nào để import vào. Nếu chiều này hỏng trên CLI, phương án dự phòng là sinh JSON `.xcstrings` bằng script — vẫn làm được nhưng thêm ~1 nửa ngày và mất tính "công cụ chính hãng".
- **Info.plist chưa có `*UsageDescription` nào.** Recon nói đúng, em xác nhận. Không phải việc của đợt này, nhưng khi App Store submit bắt thêm quyền camera/ảnh/thông báo thì các chuỗi đó **cũng phải song ngữ** — nên đưa vào cùng catalog (`InfoPlist.xcstrings`) ngay lúc thêm, đừng để lần sau.

Đường dẫn liên quan: `/Users/cm10/pickle-hub-pro/apple/project.yml`, `/Users/cm10/pickle-hub-pro/apple/ThePickleHub.xcodeproj/project.pbxproj`, `/Users/cm10/pickle-hub-pro/apple/ThePickleHub/App/Info.plist`, `/Users/cm10/pickle-hub-pro/apple/ThePickleHub/DesignSystem/Components/TLComponents.swift`, `/Users/cm10/pickle-hub-pro/apple/ThePickleHub/Core/Errors/UserFacingError.swift`, `/Users/cm10/pickle-hub-pro/apple/ThePickleHub/Features/Bracket/TeamMatchDetailView.swift`, `/Users/cm10/pickle-hub-pro/apple/ThePickleHub/Features/Home/DuprHeaderChip.swift`, `/Users/cm10/pickle-hub-pro/apple/Tests/UserFacingErrorTests.swift`, `/Users/cm10/pickle-hub-pro/apple/Tests/TournamentMutationErrorTests.swift`, `/Users/cm10/pickle-hub-pro/.github/workflows/apple-tests.yml`, `/Users/cm10/pickle-hub-pro/src/i18n/en.ts`
