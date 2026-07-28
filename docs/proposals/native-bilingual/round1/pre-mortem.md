# pre-mortem — native-bilingual (nguyên văn, vòng 1, 28/07)

## Pre-mortem: native-bilingual (VI+EN String Catalog, 151 file / ~1000 chuỗi)

Feature đã ship ba tuần trước. Ba chuyện dưới đây đã xảy ra.

---

### Sự cố 1 — "Lịch Mexicano ra cặp khác nhau cho cùng một danh sách, và một sự kiện bị đặt lúc 6 giờ sáng thay vì 6 giờ chiều"

**Xác suất:** cao · **Thời gian tới lúc phát hiện:** 3 tuần → không bao giờ (phát hiện do tình cờ)

**Timeline**

- **T+0** — PR merge. `apple/project.yml` thêm `en` vào danh sách localization của bundle. Không ai coi đó là thay đổi hành vi; đó là dòng cấu hình bắt buộc để `.xcstrings` hoạt động.
- **T+0** — CI `apple-tests` xanh, 154/154. Soak tay 30 phút trên máy Cuong: sạch.
- **T+2 ngày** — một BTC ở Đà Nẵng dùng iPhone để tiếng Anh (máy mua ở Sing, chưa bao giờ đổi) tạo sự kiện giao lưu 18:00. Picker giờ giờ đây có bánh xe AM/PM. Anh ta chỉnh phút, vô tình để AM. Lưu. Không có cảnh báo nào — 6:00 AM là một giờ hợp lệ.
- **T+2 ngày** — 9 người đăng ký. Trang web hiển thị "06:00" đúng như DB ghi. Không ai đọc kỹ.
- **T+9 ngày** — cùng BTC bấm "Xếp cặp". Vòng 1 ra một bộ cặp. Anh copy vào Zalo. Một BTC phụ (máy VI) mở cùng sự kiện, bấm "Tạo lại", ra bộ cặp **khác**. Hai người cãi nhau về "app lỗi", rồi bỏ qua — thuật toán có shuffle mà, khác là bình thường.
- **T+21 ngày** — vẫn không ai báo.

**Cơ chế**

`apple/project.yml:13` — `DEVELOPMENT_LANGUAGE: vi`, không có `knownRegions`/`CFBundleLocalizations`. Hệ quả **hôm nay**: `Bundle.main.preferredLocalizations` luôn = `["vi"]` cho mọi người dùng, kể cả người để iOS tiếng Anh — vì iOS giao nhau ngôn ngữ ưa thích của user với danh sách localization **có trong bundle**. Do đó `Locale.current` của mọi user hiện tại có language = `vi`.

Thêm `en` vào bundle → với user để iOS tiếng Anh, `Locale.current` lật sang `en`. **Đó không phải thay đổi chuỗi. Đó là thay đổi tham số ngầm của mọi API nhạy locale trong app** — và không file nào dưới đây nằm trong diff 151 file:

- `apple/ThePickleHub/Core/Social/Matchmaking.swift:143` — `$0.name.localizedCompare($1.name)` là tie-break khi seed vòng 1. Đối chiếu `:151` (`let roster = r == 1 ? seeded : shuffle(seeded, &rng)`) và `:153` (`attempts = r == 1 ? 1 : 30`): **vòng 1 hoàn toàn tất định, seed không đụng tới nó**. Khi cả roster không ai có DUPR (`level == nil` → `-.infinity` bằng nhau, `:141-142`), thứ tự vòng 1 do *duy nhất* collation quyết định. Collation VI xếp Đ sau D như một chữ riêng, Ă ngay sau A; collation EN gộp Đ vào D, Ơ vào O. Cùng roster, hai thứ tự, hai bộ cặp.
- `apple/ThePickleHub/Features/Social/Organizer/SocialEventFormView.swift:262-263` — hai `DatePicker(displayedComponents: .hourAndMinute)`. Locale EN → giao diện 12 giờ + AM/PM. `:99-104` `composeIso` lấy `.hour` từ đó và ghi thẳng vào `start_at`/`end_at` (`:288-289`). Chọn nhầm AM = ghi sai 12 tiếng vào DB.
- `apple/ThePickleHub/Features/Bracket/CreateTeamMatchView.swift:369` — `.environment(\.locale, Locale(identifier: "vi_VN"))`. Đây là DatePicker **duy nhất** trong 5 cái được ghim locale. Sau khi lật, 4 cái đổi, 1 cái không. Sự lệch đó chính là dấu vân tay của cơ chế — và nó bị đọc thành "lỗi cosmetic".
- `apple/ThePickleHub/Features/Bracket/TeamMatchPaymentSheet.swift:104,138` + `apple/ThePickleHub/Features/Registration/PlayerRegistrationView.swift:143` — `.formatted()` đổi dấu phân cách: `1.500.000 đ` → `1,500,000 đ`. Trong khi đó `apple/ThePickleHub/Core/Payment/VietQR.swift:21` mã hoá `String(max(0, amountVnd))` — không theo locale. Màn hình và mã QR giờ viết số tiền theo hai quy ước khác nhau, trên đúng cái màn hình người ta chuyển khoản.
- `apple/ThePickleHub/Core/TeamMatch/TeamMatchModels.swift:50-56` — `eventStartDate` parse `"yyyy-MM-dd"` bằng `DateFormatter()` **không set `locale`, không set `calendar`**. Đồng hồ đếm ngược phụ thuộc nó. So sánh với `apple/ThePickleHub/Core/Tournaments/TournamentModels.swift:62-68` — chỗ đó ghim `en_US_POSIX` + gregorian + UTC đầy đủ. Cùng repo, hai chuẩn, và chuẩn lỏng là chuẩn đang bị lật.
- `apple/ThePickleHub/Features/Home/HomeLiveSection.swift:80` — `.formatted(date: .omitted, time: .shortened)` → "8:30 PM" đứng cạnh `apple/ThePickleHub/Features/Live/LiveComponents.swift:21-22` hardcode `"HÔM NAY"`/`"MAI"` và `:7` ghim `vi_VN` cho `"HH:mm"`. Một màn hình, hai đồng hồ, hai ngôn ngữ.

**Vì sao mọi gate vẫn xanh**

1. **Panel/review đọc diff.** Sáu file trên không có trong diff. Không có dòng nào để nhìn.
2. **CI đã đổi locale mà workflow không nói gì.** `.github/workflows/apple-tests.yml:58-64` chạy `xcodebuild test` không có `-testLanguage`/`-testRegion`. Runner `macos-15` là `en_US`. **Trước migration**, bundle chỉ có `vi` → test chạy ở `vi_US`. **Sau migration**, cùng một dòng lệnh y hệt bắt đầu chạy ở `en_US`. Locale dưới chân test đã đổi, và không có gì trong log nói ra.
3. **Test duy nhất có thể thấy collation lại mù có cấu trúc.** `apple/Tests/MatchmakingTests.swift:10` sinh tên `"Player \($0)"`, `:18` `"P\($0)"`, `:86` `"N\($0)"` — toàn ASCII. Collation VI và EN **giống hệt nhau trên ASCII**. 154/154 xanh, xanh thật, và không thể đỏ.
4. **Soak 30 phút chạy trên nhánh không có gì xảy ra.** Máy Cuong để tiếng Việt. Với `vi`, `Locale.current` không đổi một chút nào. Soak đã quan sát đúng cái phiên bản không hỏng.
5. **Test tay củng cố kết luận sai.** Build cài lên sim phải **có ký** (gotcha keychain), CI thì `CODE_SIGNING_ALLOWED=NO` (`apple-tests.yml:64`) — hai artifact khác nhau. Phiên test tay chỉ có một build cài được, và nó chạy VI.

**Ai báo, sau bao lâu**

Không ai. Đường báo khả dĩ nhất là một người chơi nước ngoài (hoặc Việt kiều để máy EN) chụp màn hình "6:00 AM" ném vào nhóm Zalo, và BTC đổ cho người đó "xem nhầm". Đường thứ hai: hai BTC cùng sự kiện so lịch vòng 1 và thấy khác nhau — nhưng thuật toán *có* shuffle, nên "khác nhau" là kỳ vọng, không phải tín hiệu. Native **không có crash/error reporting nào** (grep `Sentry|Crashlytics|client_errors` trong `apple/` = 0), nên không có kênh telemetry nào để phát hiện.

**Vì sao khó sửa**

`git revert` gỡ được code, không gỡ được dữ liệu. Các dòng `social_events.start_at` bị ghi lệch 12 tiếng **không có dấu hiệu nào** phân biệt với BTC gõ nhầm — và 6 giờ sáng là giờ tập pickleball hoàn toàn hợp lý ở Việt Nam, nên không có heuristic "giá trị vô lý" nào bắt được. Muốn khoanh vùng phải join theo thời điểm tạo × thiết bị, mà app không ghi locale của client vào đâu cả. Còn revert thì là revert 151 file.

**Dấu hiệu sớm lẽ ra phải có**

Một dòng log lúc khởi động in `Bundle.main.preferredLocalizations` + `Locale.current.identifier`. Trước migration nó in `["vi"] / vi_US` cho **mọi** máy; sau migration nó in `["en"] / en_US` cho một nhóm. Thay đổi đó đáng lẽ là điều đầu tiên nhìn thấy. Hoặc, rẻ hơn: trước khi merge, grep `Locale.current|localizedCompare|\.formatted\(|DateFormatter\(\)` trên toàn `apple/` và đối chiếu với danh sách 151 file — mọi kết quả **ngoài** danh sách là một site sẽ đổi hành vi mà không ai review.

---

### Sự cố 2 — "Người dùng để máy tiếng Anh không xoá được tài khoản, và người phát hiện là Apple chứ không phải chúng ta"

**Xác suất:** cao · **Thời gian tới lúc phát hiện:** tới lúc submit App Store (nhiều tuần)

**Timeline**

- **T+0** — merge. Diff có `AccountSettingsView.swift`, dòng 99 đổi, dòng 103 không đổi.
- **T+0** — CI xanh, panel duyệt, soak sạch.
- **T+11 ngày** — một người chơi để máy EN vào Cài đặt tài khoản → "Delete account?" → gõ `DELETE` → nút "Delete permanently" vẫn xám. Thử lại. Thoát app. Bỏ cuộc. Không email.
- **T+3 tuần** — submit App Store. Reviewer của Apple, đọc app bằng tiếng Anh, đi đúng luồng Guideline 5.1.1(v) bắt buộc kiểm. Rejected.

**Cơ chế**

`apple/ThePickleHub/Features/Profile/AccountSettingsView.swift:99`
```swift
TextField("Nhập XOÁ để xác nhận", text: $deleteText)
```
Tham số đầu của `TextField` là `LocalizedStringKey`. Bộ trích xuất tự động bắt được, dịch thành "Type DELETE to confirm".

`apple/ThePickleHub/Features/Profile/AccountSettingsView.swift:103`
```swift
}.disabled(deleteText.trimmingCharacters(in: .whitespaces).uppercased() != "XOÁ")
```
`"XOÁ"` ở đây là một `String` thuần trong biểu thức. Nó **không phải** `LocalizedStringKey`, nên không có công cụ nào trích xuất nó, không có warning nào, không có lỗi biên dịch nào. Ranh giới của bộ trích xuất là **ranh giới kiểu**, không phải ranh giới ngữ nghĩa. Nó cắt đôi mọi chỗ mà một chuỗi vừa là *hướng dẫn* vừa là *mật khẩu*.

Cách nhau **bốn dòng**, cùng file, cùng màn hình, cùng nằm trong diff. Reviewer nhìn thấy 99 đổi và 103 không đổi, và đọc điều đó là **đúng** — vì dòng 103 không trông giống chuỗi hiển thị, nó trông giống một hằng số.

Site thứ hai cùng lớp, cùng PR: `apple/ThePickleHub/Features/Bracket/DoublesElimRegistrationView.swift:222`
```swift
if model.regMessage?.hasPrefix("Đăng ký thành công") == true { partner = nil; teamName = "" }
```
Bên sản xuất nằm ở file khác: `apple/ThePickleHub/Features/Bracket/DoublesElimDetailView.swift:100`. Chuỗi đó **bắt buộc** phải được dịch, vì `DoublesElimRegistrationView.swift:61` render nó qua `Text(msg)` — và `Text(String-variable)` bind vào overload **không** localize, nên đây đúng là loại chuỗi mà migrator phải tự tay tìm. Dịch bên sản xuất, sót bên tiêu thụ ở file cách đó 160 dòng → sau khi đăng ký thành công, ô đối tác và tên đội **không bao giờ được clear**. BTC bấm "Xác nhận đăng ký" lần nữa với đối tác cũ còn nguyên trên màn hình.

**Vì sao mọi gate vẫn xanh**

1. **Không có test nào chạm màn hình này.** 19 file trong `apple/Tests/` — không có test account/settings, không có test đăng ký đôi loại trực tiếp.
2. **Compiler câm.** Cả hai vế đều type-check. `apple/project.yml` không có key `SWIFT_TREAT_WARNINGS_AS_ERRORS` nào (recon đã đính chính ghi chép memory nói ngược lại) — mà ở đây kể cả có cũng vô ích, vì không có warning nào để nâng cấp.
3. **Soak ở tiếng Việt là soak ở ngôn ngữ nguồn.** Với `vi`, `"Nhập XOÁ để xác nhận"` resolve về chính nó, và `!= "XOÁ"` khớp. **Toàn bộ lớp lỗi này không tồn tại ở ngôn ngữ phát triển.** Cái test duy nhất ai cũng chạy là cái test duy nhất không thể đỏ.
4. **Cổng App Store bị chính intake tuyên bố là không liên quan.** `docs/proposals/native-bilingual/00-intake.md:9`: *"App Store submit vẫn RED-gated riêng, song ngữ không phải điều kiện chặn."* Người reviewer duy nhất trên đời đọc app này bằng tiếng Anh đã được khai báo là ngoài phạm vi thay đổi này.
5. **Bản kiểm kê bề mặt của chính plan là điểm mù của plan.** `idea-recon.md:20-31`: 640 `Text` + 129 `Button` + 73 `Label` + 77 `navigationTitle` + 47 `accessibilityLabel` + 16 `alert` = **982**, so với "~1000 chuỗi" ở intake. Bảng đó **không có dòng nào** cho "string literal dùng trong biểu thức". Con số cộng gần khít nên trông như đã kiểm kê đủ.

**Ai báo, sau bao lâu**

Apple App Store Review, ở lần submit — tức là nhiều tuần sau, và nằm chắn ngay trên đường găng của đúng cái việc mà migration này được tuyên bố là độc lập. Người dùng thật sẽ không báo: người muốn xoá tài khoản là người đang muốn rời đi, họ không viết email hỗ trợ.

**Vì sao khó sửa**

Bản fix là một dòng. Cái đắt là: (a) một lần reject reset hàng đợi review; (b) nó chứng minh **lớp lỗi tồn tại**, nên phải rà lại toàn bộ 151 file tìm mọi chỗ "chuỗi được so sánh chứ không được hiển thị" — và không có grep nào bắt trực tiếp được, vì pattern là *"một literal KHÔNG phải tham số đầu của Text/Button/Label/…"*. Đó là một grep phủ định, phải viết riêng.

**Dấu hiệu sớm lẽ ra phải có**

Chính bảng đếm ở `idea-recon.md:20-31`. Nó nói "982 chuỗi hiển thị / ~1000 tổng". Câu hỏi lẽ ra phải hỏi: *18 chuỗi còn lại ở đâu, và chúng làm gì?* Câu trả lời là: chúng là logic.

---

### Sự cố 3 — "App văng ngay khi mở màn chia bảng, chỉ trên máy tiếng Anh, chỉ khi có đội chưa đủ người"

**Xác suất:** trung bình · **Thời gian tới lúc phát hiện:** tới ngày thi đấu đầu tiên có BTC dùng máy EN

**Timeline**

- **T+0** — merge. ~360 chuỗi mà bộ trích xuất không thấy (xem sự cố 2) được chuyển tay/bằng LLM sang `String(localized:)`, bản EN được sinh hàng loạt.
- **T+0** — build ok. Xcode in vài warning validation trong String Catalog. `xcodebuild test` log ~4000 dòng. Xanh.
- **T+18 ngày** — giải MLP ở sân. BTC (máy EN) mở sheet chia bảng khi roster mới đăng ký được 5/6 người mỗi đội. App văng. Mở lại, văng lại. BTC chuyển sang dùng web trên điện thoại, chậm gấp ba, giải trễ 40 phút.
- **T+18 ngày** — Cuong nhận tin nhắn Zalo: *"app bị văng ở màn chia bảng"*. Không có stack trace, không có báo cáo crash, không tái hiện được trên máy Cuong.

**Cơ chế**

`apple/ThePickleHub/Features/Bracket/TeamMatchDetailView.swift:1347` `private var violations` — kiểm tra ràng buộc roster. Bên trong:

- `:1353` — `issues.append("\(members.count)/\(rosterSize) người")` — 2 tham số nguyên
- `:1356` — `issues.append("\(males) nam / \(females) nữ (cần \(half)/\(half))")` — **4 tham số nguyên trong một chuỗi**

Đây là `String` thuần, không phải `Text` → bộ trích xuất không thấy → thuộc nhóm phải chuyển tay. Swift hạ `\(Int)` thành `%lld`. Bản dịch EN viết tay hoặc do LLM sinh rất tự nhiên ra `"%d M / %d F (need %d/%d)"` — hoặc gộp lại thành `"%lld M / %lld F (need %lld each)"`, tụt một specifier. Trường hợp một: `%d` đọc 32 bit của một tham số 64 bit → số sai, và nếu có `%@` phía sau thì engine format dereference một con trỏ rác → `EXC_BAD_ACCESS`. Trường hợp hai: số tham số khai báo không khớp số tham số truyền → cùng kết cục.

Điều làm nó sống được ba tuần: **cả hai dòng nằm trong nhánh validation chỉ chạy khi roster CHƯA sẵn sàng.** `:1353` nằm trong `if members.count != rosterSize`, `:1356` nằm trong `if males != half || females != half`. Roster đủ và cân → nhánh không chạy → không crash. Mọi lần mở thử trên giải đã setup xong đều êm.

**Vì sao mọi gate vẫn xanh**

1. **Ngôn ngữ nguồn miễn nhiễm có cấu trúc với lớp lỗi này.** Với `vi`, app dùng chuỗi **nguồn**, mà specifier của chuỗi nguồn do compiler viết ra — luôn đúng. Lỗi chỉ tồn tại trong biến thể đã dịch. Soak 30 phút trên máy VI không thể chạm tới nó, không phải vì may, mà vì nó ở nhánh khác của cùng một cơ chế.
2. **Validation của String Catalog là warning, và warning không phải error.** `apple/project.yml` không có `SWIFT_TREAT_WARNINGS_AS_ERRORS`; `.github/workflows/apple-tests.yml:58-64` không truyền `-warnAsError` và không grep log.
3. **Không có test render nào chạy qua catalog.** `apple/Tests/TLComponentsRenderTests.swift:28-38` truyền literal VI **thẳng** vào component (`TLButton(title: "Xác nhận đăng ký", …)`) và chỉ assert `size.height > 0 && isFinite`. Nó render chuỗi nguồn, không bao giờ đi qua catalog, và về nguyên tắc không thể nhìn thấy ngôn ngữ nào.
4. **Ba test duy nhất trong repo có thể phát hiện migration đều đỏ vì lý do SAI trước, nên chúng bị "sửa" ngay từ commit đầu tiên:**
   - `apple/Tests/UserFacingErrorTests.swift:13-14,20-21`
   - `apple/Tests/TournamentMutationErrorTests.swift:11,18`
   - `apple/Tests/MatchmakingTests.swift:89-90` (`#expect(text.contains("Vòng 1"))`)

   Cả ba assert literal tiếng Việt. Dưới CI đã lật sang `en_US` (xem sự cố 1), chúng đỏ. Bản sửa nhanh nhất để chúng xanh lại — assert bằng `String(localized:)` ở cả hai vế, hoặc ghim test về `vi` — chính là bản sửa biến chúng thành tautology. **Việc đầu tiên migration làm là vô hiệu hoá ba cảm biến duy nhất nó có.**
5. **Không có crash reporting.** `grep -rn "Sentry|Crashlytics|client_errors" apple/` = 0. Web có `client_errors`, native không có gì. Crash trên máy user là dữ liệu không tồn tại.

**Ai báo, sau bao lâu**

BTC, tại sân, đúng ngày thi đấu, bằng tin nhắn Zalo không có log. Đây là kiểu báo cáo tệ nhất: áp lực thời gian cao nhất, thông tin ít nhất.

**Vì sao khó sửa**

Crash trong format string không cho stack trace nào gọi tên chuỗi. Điều kiện tái hiện là **giao** của hai thứ không ai ghi lại: locale của thiết bị × trạng thái roster chưa đủ. Cuong không thể tái hiện vì máy để VI và giải test đã setup đủ đội. Revert được (chuỗi là chuỗi), nhưng revert = revert 151 file, tức mất trọn mẻ.

**Dấu hiệu sớm lẽ ra phải có**

Warning của Xcode ngay lúc build đầu tiên. Nó đã in ra. Không có gì đọc nó.

---

## Xếp hạng

| # | Sự cố | Xác suất | Khó phát hiện | Ưu tiên |
|---|---|---|---|---|
| 1 | `Locale.current` lật → collation / DatePicker 12h / số tiền / countdown | **cao** | **rất cao** — sai dữ liệu âm thầm, không exception, không telemetry, và "khác nhau" bị đọc là kỳ vọng của thuật toán shuffle | **1** |
| 2 | "XOÁ" là mật khẩu nhưng hướng dẫn đã dịch | **cao** | trung bình — chắc chắn bị bắt, nhưng bởi Apple, muộn, và trên đường găng | **2** |
| 3 | Format specifier drift → crash chỉ ở EN + roster chưa đủ | trung bình | cao — nhưng crash **ồn**, nên một khi chạm là biết ngay | **3** |

Sự cố 1 đứng đầu không phải vì nặng nhất mà vì nó **ghi sai vào database và không để lại dấu vết nào để tìm lại**. Sự cố 3 thảm khốc hơn tại chỗ nhưng tự tố cáo. Một crash làm mất 40 phút; một `start_at` sai 12 tiếng làm BTC mất niềm tin vào chỗ họ nhập giờ — và `git revert` không lấy lại được cái đó.

---

## Rẻ nhất để chặn từ bây giờ

1. **Một dòng log lúc khởi động** (`print(Bundle.main.preferredLocalizations, Locale.current.identifier)`), và **một job CI thứ hai** trong `.github/workflows/apple-tests.yml` chạy đúng lệnh cũ kèm `-testLanguage en -testRegion US`. Không viết test mới — chỉ chạy 154 test hiện có lần thứ hai ở EN. Chi phí: 6 dòng YAML + ~8 phút runner. Nó bắt sự cố 1 và 3 ngay lập tức, và nó khiến "sửa cho xanh lại" ba test VI-literal trở thành một quyết định phải nói ra thay vì một thao tác im lặng.
2. **Một script ~20 dòng đọc `.xcstrings` (là JSON thuần, không cần simulator)**, so chuỗi specifier `%` của mỗi giá trị `en` với key nguồn, thứ tự và số lượng phải trùng. Chặn sự cố 3 tại commit.
3. **Một grep phủ định chạy tay một lần trước merge:** liệt kê mọi string literal trong 151 file **không** đứng ở vị trí tham số đầu của `Text`/`Button`/`Label`/`navigationTitle`/`alert`/`TextField`/`accessibilityLabel`. Đó chính xác là tập hợp "chuỗi mang logic". Danh sách đó ngắn (~18 chuỗi theo phép trừ ở `idea-recon.md:20-31`) và phải được đọc bằng mắt từng cái. Chặn sự cố 2.

Không cần thêm framework test, không cần snapshot, không cần locale switcher trong app.

---

## Khoảng hở của pipeline mà bài này lộ ra

**1. Gate của repo này chỉ đo *cấu hình* mà nó tình cờ đang chạy, và không ai khai báo cấu hình đó là gì.** `apple-tests.yml` chưa bao giờ nói nó chạy ở locale nào. Hôm nay là `vi_US` do tai nạn (bundle chỉ có `vi`). Sau migration là `en_US`, cũng do tai nạn. Không có dòng nào trong repo ghi lại sự thật đó, nên không có gì để so sánh khi nó đổi. Đây **đúng cùng hình dạng** với bài học đã ghi ở `.claude/memory/lessons-learned.md:478` — *"Gate của repo này chỉ đo nhánh BOT"*. Web đã học rồi và đã có `tests/human-path.spec.ts`. Native chưa học: nó vẫn chỉ đo **một** nhánh (VI), và bây giờ chuẩn bị có hai.

**2. `/idea` không có bước "diff này đổi hành vi của file NÀO NGOÀI diff".** Cả recon lẫn risk-auditor đều làm việc trên tập file bị chạm. Sự cố 1 hoàn toàn nằm ngoài tập đó — nguyên nhân là một dòng trong `project.yml`, hậu quả ở sáu file không ai mở. Cần một bước tường minh: *"thay đổi này đổi giá trị toàn cục nào (locale, timezone, feature flag, bundle config)? grep mọi consumer của giá trị đó, kể cả ngoài diff."*

**3. Không có gate nào bảo vệ chính test suite.** Ba test có khả năng bắt được migration đều đỏ vì lý do sai trước, và cách sửa nhanh nhất là cách làm chúng mù. Không có luật nào bắt phải nói ra khi một assertion bị làm yếu đi. Đối chiếu `lessons-learned.md:480` — *"Chứng minh test SỐNG bằng cách cho nó đỏ"*: ở đây điều ngược lại xảy ra, test đỏ thật rồi bị làm cho xanh, và không có ai phải giải thích.

**4. Native không có tầng telemetry nào.** Web có `client_errors`, có soak hồi cứu bằng cách query từ mốc deploy. Native có **zero**. Nghĩa là với `/apple`, "soak 30 phút" không phải là một phiên bản yếu hơn của soak web — nó là một *loại* bằng chứng khác hẳn: một người, một thiết bị, một locale, một tập dữ liệu. Nên gọi đúng tên nó là "test tay" và đừng để nó chiếm ô "soak clean" trong checklist ship.

**5. `risk-tier.mjs` xếp mọi file `apple/` là RED tại merge** — mà một PR chạm 151 file `apple/` thì tier RED không còn phân biệt được gì. Khi mọi thứ là RED, RED không mang thông tin. Mẻ này cần tách theo *loại* thay đổi (config bundle vs chuỗi hiển thị vs chuỗi mang logic), không phải theo thư mục — và chính cái tách đó là thứ sẽ khiến sự cố 2 lộ ra khi review.
