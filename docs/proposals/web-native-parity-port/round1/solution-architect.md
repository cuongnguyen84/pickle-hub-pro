# Solution Architect — web↔native parity port (vòng 1, độc lập)

> Vòng 1. Chưa đọc output của `ui-ux-critic` / `risk-auditor`. Mọi kết luận dưới
> đây tự kiểm chứng bằng cách mở file trong repo, không dựa vào recon.

## 0. Những gì em tự kiểm chứng lại (và recon nói chưa đủ / nói lệch)

Recon đúng về bản đồ lệch. Nhưng có **6 phát hiện load-bearing** thay đổi cách
chia task, mà recon không có:

### 0.1 Cổng build RẺ — 38 giây, không phải giờ

```
cd apple && xcodegen generate && xcodebuild -scheme ThePickleHub \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -derivedDataPath <local> build CODE_SIGNING_ALLOWED=NO
→ ** BUILD SUCCEEDED **   ELAPSED_SECONDS=38
```

Đây là số em đo trong phiên này, không phải ước lượng. Hệ quả: ràng buộc "mỗi
task xong phải BUILD SUCCEEDED" **không phải chi phí đáng kể**. Có thể gate
từng task, thậm chí gate từng file, mà không mất đêm. Kế hoạch nào lập luận
"gộp task lại để đỡ build" là lập luận sai — không có chi phí để tiết kiệm.

### 0.2 BẪY: `/Volumes/CMBackup` KHÔNG được mount

`apple/README.md` ghi lệnh build với `-derivedDataPath /Volumes/CMBackup/picklehub-ios/DerivedData`.

```
$ ls /Volumes/     →  Macintosh HD          # chỉ có boot volume
$ df -h /          →  133Gi available       # đủ chỗ, không cần ổ ngoài
```

Agent nào chép lệnh trong README ra chạy sẽ hỏng ở bước đầu tiên, và (tệ hơn)
có thể hiểu nhầm thành "môi trường native hỏng" rồi bỏ cả nhánh việc. **Task 0
của bất kỳ phương án nào là chốt lệnh build dùng derivedDataPath cục bộ.**
Không sửa README (ổ đó là máy khác của Cuong), chỉ ghi lệnh đã chốt vào
báo cáo tổng kết.

Kiểm tra khác đã pass: `Config/Secrets.xcconfig` **có** (661 B, 22/07),
`ThePickleHub.xcodeproj` đã generate sẵn, `xcodegen` ở `/opt/homebrew/bin`,
Xcode 26.3, sim `iPhone 17 Pro` available.

### 0.3 Native là VI-ONLY THEO THIẾT KẾ — và điều này đụng luật cứng của em

```yaml
# apple/project.yml
settings.base.DEVELOPMENT_LANGUAGE: vi
```

```
$ grep -rln "LocalizedStringKey|NSLocalizedString|String(localized" apple/  → 0 file
$ find apple -name "*.lproj" -o -name "Localizable*"                        → 0 file
```

199 file Swift, **không một file localization nào**. Toàn bộ chuỗi hardcode
tiếng Việt (`"Giải đấu"`, `"Theo dõi"`, `"Cộng đồng"`, `"Chưa có giải chuyên nghiệp"`…).

Luật cứng của em nói: *mọi text người dùng thấy phải có VI và EN từ ngày đầu*.
Em **không** áp luật đó cho đêm nay, và đây là lý do — không phải né:

- Luật tồn tại để chặn *site song ngữ mục ruỗng* (thêm VI sau → không bao giờ thêm).
  Web ThePickleHub **là** site song ngữ, có hreflang, có sitemap VI/EN. Luật đúng ở đó.
- App native **không** song ngữ và chưa bao giờ song ngữ. Thêm chuỗi EN vào
  6 màn mới trong một app 199 file VI-only tạo ra app **nửa song ngữ** — đúng
  cái trạng thái mục ruỗng mà luật muốn chặn, chỉ là ở chiều ngược lại.
- Cách đúng để native song ngữ là **một task riêng**: migrate sang String Catalog
  (`.xcstrings`), quét 199 file, đặt `CFBundleLocalizations`. Ước lượng thật:
  **3–5 nửa-ngày**. Đó là task tự nó, không nhét lén vào đêm parity được.

**Quyết định:** chuỗi native mới đêm nay theo quy ước hiện có = **VI-only**.
**Cần Cuong phê chuẩn** — nếu anh muốn EN trong app, nó là roadmap item riêng,
và đêm parity này phải hoãn để không đào sâu thêm nợ.

### 0.4 Video native: `playbackURL` là CODE CHẾT, còn Home thì nhảy ra web

Đây là phát hiện có tỉ lệ giá-trị/công-sức cao nhất trong cả danh sách.

`apple/ThePickleHub/Core/Home/VideoModels.swift:40-46` — đã có sẵn:

```swift
/// AVPlayer-playable URL: Mux HLS when available, else the storage file.
var playbackURL: URL? {
    if let mux = muxPlaybackID?.nonEmpty {
        return URL(string: "https://stream.mux.com/\(mux).m3u8")
    }
    return videoFileURL
}
```

`apple/ThePickleHub/Features/Live/VideoPlayerScreen.swift:11-13` — đã có sẵn
`VideoPlayerScreen(url:title:)`, AVKit, HLS, resume progress qua `WatchProgressStore`,
PiP/AirPlay.

Nhưng `apple/ThePickleHub/Features/Home/HomeVideosSection.swift:3-4,15`:

```swift
/// "Sân đấu." — highlight videos. Tapping opens the web player (native player
/// is Phase 6).
    Button { onOpenWeb(WebRoutes.video(id: video.id)) } label: {
```

Comment nói "native player là Phase 6" — Phase 6 **đã xong từ lâu**, Feed đã
chơi video native (`FeedVideoPlayerView.swift`), player đã tồn tại, URL đã
tính sẵn. Chỉ có Home là chưa nối dây. Người dùng bấm video trên trang chủ app
→ bật Safari sheet.

Đây không phải "gap parity", đây là **defect nối dây**, sửa ~10 dòng. Recon xếp
nó vào ô "Minor" cuối bảng — em không đồng ý, nó phải là task số 1.

### 0.5 Social event: `free_perks` ĐÃ có trong payload, chỉ form không thu

`apple/ThePickleHub/Core/Social/SocialOrganizerRepository.swift:308,313`:

```swift
let free_perks: [String]?
...
let slots: [String]   // ponytail: native chưa hỗ trợ nhóm đăng ký (slots) — luôn rỗng; thêm SlotManager khi cần
```

Recon gộp "slots + free perks + weekly recurrence" thành một cục **M**. Sai —
đây là ba thứ có kích cỡ rất khác nhau:

| Thứ | Web nguồn | Kích cỡ thật | Vì sao |
|---|---|---|---|
| `free_perks` | `Step1Info.tsx:305` `PERK_PRESETS = ["Nước","Hoa quả","Khăn","Ăn nhẹ"]` | **XS** | payload native đã có field; chỉ thiếu 1 hàng chip toggle + ô nhập tự do |
| weekly repeat | `CreateSocialEvent.tsx:456-472`, `types.ts:83 repeat_weeks` | **S** | thuần client: loop N lần, cộng start/end +7 ngày mỗi vòng, clamp 0–12. Không có RPC/migration nào cả |
| slots (nhóm đăng ký) | `create-event/SlotManager.tsx` (~230 dòng, có `validateSlots`) | **M thật** | cần UI quản lý slot + validate tổng capacity + luồng ĐĂNG KÝ phải tôn trọng slot |

Tách ra thì hai phần rẻ (perks + repeat) chui vừa một task S và giao được ngay
đêm nay; phần đắt (slots) ghi nợ có ước lượng. Gộp cả cục thành M là cách chắc
chắn nhất để cuối đêm có một task dở dang.

### 0.6 Club invite: RPC ĐÃ TỒN TẠI, không cần migration

`src/hooks/useClubMembers.ts:7,177-180`:

```
//   - invite_club_member     (organizer-initiated, lands ACTIVE)
const { data, error } = await supabase.rpc("invite_club_member", { ... })
```

Native chỉ cần: 1 hàm gọi RPC + 1 sheet tìm profile. `SearchRepository.searchPlayers`
đã có (`Core/Search/SearchRepository.swift:56`, đang `private` — mở ra là xong).
Pattern "thêm người bằng định danh + enum kết quả" đã có sẵn để bắt chước:
`QuickTableRepository.addReferee(tableID:email:) -> AddRefereeOutcome`
(`Core/QuickTable/QuickTableRepository.swift:44`).

**Không migration. Không RLS mới.** Recon xếp S — đúng, và em xác nhận là S *thật*.

### 0.7 Dashboard nhỏ hơn recon nghĩ; parent tournament thì rủi ro hơn

- **Dashboard:** `QuickTableRepository.load(shareID:)` (`:123`) đã trả về
  `QuickTableDetail` gồm matches + courts — tức là **truy vấn đã có**. Và
  `OrientationLock.lockLandscape()` (`App/ThePickleHubApp.swift:59`) đã tồn tại
  cho màn trọng tài → chế độ TV xoay ngang tái dùng được nguyên. Web
  `TournamentDashboard.tsx` chỉ 145 dòng, phần nặng nằm ở `useDashboardData.ts`
  (308 dòng) mà native đã có tương đương cho quick-table. → **S/M, không phải M**,
  nếu cắt phạm vi còn quick-table.
- **Parent tournament:** migration `20260724153000_attach_quick_tables_to_parent.sql`
  — **ngày 24/07, tức 3 ngày trước**. Đây là tính năng web mới toanh, chưa có
  bằng chứng ai dùng. Port một tính năng 3 ngày tuổi sang native trước khi
  biết web có ai dùng không = xây phần suy đoán. **Nấc 1 của thang lười: bỏ.**
  Trước khi ai đó định làm, chạy `select count(*) from parent_tournaments;` — nếu
  < 5 dòng thật thì câu trả lời là không làm.

### 0.8 Push: KHÔNG kiểm chứng được sáng mai, dù có code xong

`supabase/functions/send-push-notification/index.ts` dùng **FCM V1** (JWT RS256 →
`firebase.messaging` scope). `push_tokens` có `platform CHECK IN ('ios','android','web')`.

`apple/ThePickleHub/App/ThePickleHub.entitlements` — **không có `aps-environment`**.
Không có `registerForRemoteNotifications` ở đâu trong `/apple` (recon đúng).

Đường đi native buộc phải là một trong hai:
- (a) thêm `FirebaseMessaging` SPM + `GoogleService-Info.plist` → `send-push-notification` không phải sửa;
- (b) APNs trực tiếp → phải sửa edge function để tách nhánh gửi.

Cả hai đều **chặn ở việc thủ công của Cuong**: tạo APNs Auth Key trong Apple
Developer portal, upload lên Firebase console, bật capability Push Notifications.
Agent không làm được.

Và quyết định: **simulator không nhận được push thật.** `xcrun simctl push` chỉ
tiêm payload cục bộ — nó test được UI xử lý notification, **không** test được
đường server→APNs→máy. Nghĩa là dù code xong hoàn hảo, **sáng mai Cuong không có
cách nào verify trên sim**. Ràng buộc cứng là "sáng mai Cuong test được".
→ Push **trượt tiêu chí nghiệm thu của chính đêm nay**. Không phải "khó quá",
mà là "làm xong cũng không chứng minh được". Ghi nợ.

### 0.9 Hạ tầng gate: `risk-tier.mjs` không tồn tại

```
$ ls scripts/agents/  → No such file or directory
```

Khớp memory `idea-pipeline-missing-scripts.md`. Không tự động phân tier được →
**phải gọi tier bằng tay và ghi vào proposal**. Xem §4.

---

## Tóm tắt kiến trúc

Không thêm hạ tầng nào: mọi việc đề xuất đều là thêm 1 `View` và/hoặc 1 hàm vào
`*Repository.swift` đã tồn tại, theo đúng pattern repository-per-domain của
`/apple` (24 repo). Trục chia task không phải cỡ S/M/L mà là **"Cuong verify
được trên simulator sáng mai hay không"** — tiêu chí này loại push (không test
được trên sim) và parent tournament (chưa có dữ liệu để nhìn), và nâng defect
nối dây video lên hàng đầu. Với cổng build 38 giây, mỗi task là **một commit
riêng đã BUILD SUCCEEDED**, để đêm chết ở task thứ n thì n−1 task trước vẫn
sạch và vẫn test được.

## Bảng task ứng viên (dùng chung cho cả 3 phương án)

Ký hiệu: `→` = file sửa, `+` = file tạo mới.

| # | Task | File native | Tái dùng | Giờ thật | Verify trên sim? |
|---|---|---|---|---|---|
| **T0** | Chốt lệnh build cục bộ (KHÔNG `/Volumes/CMBackup`) | — | — | 0.1 | n/a |
| **T1** | Video trang chủ chơi native | → `Features/Home/HomeVideosSection.swift`, → `Features/Home/HomeView.swift` | `VideoSummary.playbackURL:41`, `VideoPlayerScreen(url:title:)` | **0.5** | ✅ dữ liệu công khai, không cần login |
| **T2** | Màn `/videos` xem tất cả | + `Features/Home/VideosListView.swift`, → `Core/Home/HomeRepository.swift`, → `HomeView.swift` | `TLSegmented`, `VideoHighlightCard` (bỏ `private`), `highlightVideos(limit:)` | **1.0** | ✅ |
| **T3** | Tab Cộng đồng: lọc theo format + trạng thái | → `Features/Tournaments/TournamentsView.swift`, → `TournamentsViewModel.swift` | `MyTournament.format` / `.state` đã có → lọc thuần client, **0 thay đổi repo** | **1.0** | ✅ có giải cộng đồng công khai |
| **T4** | Form sự kiện: free perks + lặp hàng tuần | → `Features/Social/Organizer/SocialEventFormView.swift`, → `Core/Social/SocialOrganizerRepository.swift` | `EventPayload.free_perks` đã có; loop từ `CreateSocialEvent.tsx:456` | **1.5** | ⚠️ tạo dữ liệu prod — test bằng `status=draft` |
| **T5** | Club: mời thành viên bằng tìm kiếm | → `Features/Clubs/ClubManageView.swift`, → `Core/Clubs/ClubRepository.swift`, → `Core/Search/SearchRepository.swift` (mở `searchPlayers`) | RPC `invite_club_member` đã có; pattern `AddRefereeOutcome` | **1.0** | ✅ cần 1 club Cuong làm admin |
| **T6** | Bảng sân BTC (chỉ quick-table) | + `Features/Tools/DashboardView.swift`, → `Features/Bracket/QuickTableDetailView.swift` | `QuickTableRepository.load(shareID:)` đã trả matches+courts; `OrientationLock.lockLandscape()` | **2.5–3** | ⚠️ cần 1 QuickTable có lịch |
| **T7** | Push từ xa (nửa client) | → `App/ThePickleHubApp.swift`, + `Core/Notifications/PushRegistration.swift`, → `project.yml`, → `.entitlements` | — | **4–6** | ❌ **KHÔNG** |
| **T8** | Parent tournament + carousel Featured | + `Core/Tournaments/ParentTournamentRepository.swift`, + `Features/Tournaments/ParentTournamentView.swift`, → `TournamentsView.swift` | shape query từ `useParentTournament.ts` | **3** | ❌ chưa chắc có dữ liệu |
| **T9** | Màn giải pro native (thay SafariView) | `Features/Tournaments/TournamentDetailView.swift` + cây bracket mới | — | **6+** | ❌ |
| **T10** | Slots / nhóm đăng ký | `SocialEventFormView.swift` + luồng đăng ký | web `SlotManager.tsx` | **3–4** | ⚠️ |

Ba thứ recon liệt kê mà em **chủ động bác, không phải hoãn**:

- **Creator Studio (L).** `user_roles` có **2 dòng `creator`**. Xây studio native
  cho 2 người, trong đó có Cuong. Upload Mux từ điện thoại là luồng tệ hơn desktop.
  Đây là nấc 1 của thang lười — không cần tồn tại.
- **DUPR connect (S).** Đây là OAuth SSO. `SafariView`/`ASWebAuthenticationSession`
  **là** pattern native đúng cho SSO, không phải giải pháp tạm. Không phải gap.
- **`/khoi-phuc-dang-ky` (S).** Turnstile captcha cần web surface. Không phải gap.

Và một thứ em **cố ý không đề xuất** dù nó là S: **đổi email/mật khẩu trong
Account**. `supabase-swift` làm được trong 2 dòng, nhưng nó chạm auth → RED tier
(§4), và đổi email kích hoạt luồng `send-auth-email` hook. Không nhét một thay
đổi RED vào đêm autonomous để lấy một task S.

---

## Option A — Rộng-nông, ưu tiên theo giá trị người dùng

**Effort: ~1.5 nửa-ngày (6.0 giờ) · Files: xem T1–T5 · Data: KHÔNG migration, KHÔNG RLS, KHÔNG RPC mới**

Thứ tự: **T0 → T1 → T2 → T3 → T4 → T5** — rồi *dừng lại nhìn*. T6 chỉ chạm vào
nếu T1–T5 đều xanh và còn nhiều thời gian.

**How it works:** năm lát cắt độc lập, mỗi lát chạm 1–3 file, mỗi lát một commit
đã BUILD SUCCEEDED. Không lát nào phụ thuộc lát nào — bỏ bất kỳ lát nào ở giữa
thì các lát còn lại vẫn ship được. Ba lát đầu (T1–T3) thuần đọc, không ghi dữ
liệu prod, nên rủi ro làm bẩn dữ liệu bằng 0. Hai lát sau (T4, T5) có ghi, nên
xếp sau — nếu đêm hỏng thì hỏng ở phần rẻ nhất để mất.

**Wins:** phủ 4 bề mặt khác nhau (Home, Tournaments, Social, Clubs) → sáng mai
Cuong mở app là thấy đổi ở nhiều chỗ, cảm giác "app tiến lên" rõ. Sửa được một
defect thật (T1) chứ không chỉ thêm tính năng. Không chạm auth/payments/config.

**Loses:** không món nào *sâu*. Không có tính năng lớn nào để khoe. BTC vẫn
chưa có bảng sân. Slots vẫn nợ.

**Forecloses:** gần như không đóng cửa nào. T3 lọc thuần client — khi cần
server-side filter cho danh sách dài thì vứt đi viết lại, mất ~1 giờ. T2 tạo ra
màn danh sách video mà sau này nếu muốn nhét quảng cáo/phân trang thì phải sửa
lại — nhưng đó là sửa bình thường, không phải khoá.

## Option B — Ba việc rẻ rồi đi ngủ (bản rẻ)

**Effort: ~0.7 nửa-ngày (2.6 giờ) · Files: T1 + T2 + T3 · Data: KHÔNG**

**How it works:** chỉ **T0 → T1 → T2 → T3**. Toàn bộ là bề mặt người xem, toàn
bộ chỉ đọc, không ghi một dòng dữ liệu prod nào. Xong trước nửa đêm. Phần lớn
sản phẩm của đêm là **báo cáo tổng kết**: bảng 11 gap với ước lượng thật, ba
mục "bác bỏ có lý do" (Creator Studio / DUPR / recovery), và ba câu hỏi cần
Cuong quyết (§5).

Đây là bản "làm 30% rồi xem có ai dùng không" — cụ thể ở đây: *port ba thứ rẻ
nhất, rồi để Cuong tự nói cái nào anh thực sự nhớ khi dùng app*, thay vì em
đoán hộ.

**Wins:** rủi ro gần bằng 0. Không chạm dữ liệu ghi. Chắc chắn kịp deadline kể
cả khi có sự cố. Báo cáo — thứ Cuong nói rõ là muốn ("Viết báo cáo tổng kết") —
được viết bằng đầu óc còn tỉnh chứ không phải lúc 4 giờ sáng. Và nó tôn trọng
điều em thực sự chưa biết: **em không có dữ liệu nào nói người dùng native đang
đau ở đâu.** Cả 11 gap là suy luận từ diff mã nguồn, không phải từ hành vi.

**Loses:** không chạm bề mặt BTC nào cả (Social, Clubs, dashboard). Với intake
nói "port đầy đủ", giao 3/11 dễ bị đọc là làm chưa tới. Bỏ phí một cổng build
38 giây — năng lực có mà không dùng.

**Forecloses:** không cái gì. Đây là điểm mạnh chính của nó.

## Option C — Hẹp-sâu, đặt cược vào BTC

**Effort: ~1.5 nửa-ngày (6.0 giờ) · Files: T6 làm trọn (3 format + âm báo) + T1 · Data: KHÔNG**

**How it works:** T0 → T1 (rẻ, lấy đà) → rồi dồn cả đêm vào **T6 làm đủ**: cả
ba loại (quick-table, doubles-elimination, team-match), lưới sân, danh sách
lịch theo sân, chế độ TV xoay ngang, âm báo khi có trận mới (port
`useDashboardSound.ts`, 56 dòng). Luận điểm: BTC là người dùng đòn bẩy — một BTC
kéo theo 20 người chơi — nên một công cụ BTC dùng được ở sân đáng giá hơn năm
cải thiện nhỏ cho người xem.

**Wins:** giao được **một** thứ đủ sâu để dùng thật ở giải, không phải bản
demo. Đúng chỗ web đang mạnh hơn native nhất về mặt vận hành.

**Loses:** một điểm hỏng duy nhất. T6 là task duy nhất trong danh sách mà recon
**tự nghi ngờ là có nên tồn tại không** (câu hỏi #2: TV-mode có ý nghĩa trên
điện thoại không, hay bản chất nó là "chiếu ra màn hình ngoài"). Đặt cả đêm vào
món có dấu hỏi to nhất về nhu cầu là cược sai. Nếu 3 giờ sáng nó mới xong 70%
thì đó chính là **"task dở dang tệ hơn task chưa làm"** — điều Cuong cấm.

**Forecloses:** nếu làm dashboard native rồi Cuong bảo "cái này anh luôn mở trên
laptop cắm TV" thì mất trọn một đêm, không thu lại được gì.

---

## Khuyến nghị

**Option A**, cắt cứng ở T5, và **T6 chỉ được bắt đầu nếu T1–T5 đã xanh và đồng
hồ trước 02:00** — không thì ghi nợ.

**Vì sao C thua:** C dồn toàn bộ đêm vào đúng cái item mà recon tự đặt dấu hỏi
"cái này có phải use-case điện thoại không" (§0.7, recon câu hỏi #2). Xây sâu
trước khi biết có ai cần là ngược thứ tự. Thêm nữa T6 là task duy nhất có xác
suất thật để rơi vào trạng thái 70%-lúc-3-giờ-sáng, và ràng buộc của Cuong nói
rõ dở dang tệ hơn chưa làm. Trong A, T6 nằm **sau** vạch dừng — đúng chỗ của
một món chưa chắc ai cần.

**Vì sao B thua — và nó thua sát:** B là câu trả lời đúng nếu cổng build đắt
hoặc môi trường bấp bênh. Em đã đo: build 38 giây, secrets có, sim có, project
generate được. Trong điều kiện đó, T4 và T5 mỗi cái ~1 giờ, **không cần migration,
không cần RLS, không cần RPC mới** (RPC `invite_club_member` đã tồn tại — §0.6;
`free_perks` đã có trong payload — §0.5). Từ chối hai task 1 giờ, rủi ro thấp,
đã có sẵn đường ray backend, chỉ vì "an toàn hơn" là lười sai kiểu. Nhưng nếu
gặp bất kỳ chuyện lạ nào ở T1–T3 — build đỏ khó hiểu, test bundle vỡ, dữ liệu
prod không như tưởng — thì **rơi về B là đúng, không phải thất bại.**

Điều em **không** khuyến nghị dù đề bài nói "port đầy đủ": T7 (push), T8 (parent
tournament), T9 (giải pro native), T10 (slots), Creator Studio, DUPR connect,
recovery, đổi email/mật khẩu. Lý do từng cái ở §0.7–0.9 và bảng task. "Đầy đủ"
theo nghĩa 11/11 không đạt được trong một đêm bởi một người, và intake default #2
đã cho phép ghi nợ kèm ước lượng. Báo cáo tổng kết phải nói thẳng: **6/11 port,
5/11 ghi nợ có số giờ**, không được viết mơ hồ kiểu "đã port phần lớn".

---

## Increments

Nhánh: `feat/native-parity-2026-07-28`, **cắt từ `main`** (recon §5 đã xác nhận
không có việc native nào kẹt ở nhánh cũ). Không phải từ `docs/human-path-lessons`
đang đứng.

Mỗi bước = **1 commit**, đều đã BUILD SUCCEEDED trước khi commit.

1. **T0 — chốt lệnh build.** — verify: `xcodegen generate && xcodebuild ... -derivedDataPath <local> build` in `** BUILD SUCCEEDED **`. Ghi lệnh chính xác vào báo cáo. *(nếu bước này đỏ → dừng cả đêm, báo Cuong, không đoán mò)*
2. **T1 — video trang chủ chơi native.** — verify: sim, tab Home, bấm thẻ "Sân đấu" → `VideoPlayerScreen` push vào navigation stack, **không** có Safari sheet; video có `playbackURL == nil` vẫn rơi về web hop chứ không màn trắng. Xoá luôn comment sai "native player is Phase 6".
3. **T2 — màn xem tất cả video.** — verify: từ Home bấm "Xem tất cả" → danh sách; ba bộ lọc Tất cả/Dài/Ngắn ra số khác nhau; bấm 1 video chơi native.
4. **T3 — lọc tab Cộng đồng.** — verify: chip format lọc đúng, tổng các chip = số ở badge tab; lọc ra rỗng thì hiện `TLEmptyState` chứ không phải danh sách trắng.
5. **⏸️ ĐIỂM DỪNG-VÀ-NHÌN.** Ba task đã xong đều chỉ-đọc. Chạy `xcodebuild test` (bundle `ThePickleHubTests` — CI workflow *Apple tests* chạy nó cho mọi PR chạm `apple/**`, đừng để đỏ). Nếu có gì bất thường → **dừng ở đây, giao Option B, viết báo cáo.** Đây là bản giao hợp lệ, không phải thất bại.
6. **T4 — perks + lặp hàng tuần.** — verify: tạo 1 sự kiện `status=draft`, `repeat_weeks=2` → **3** hàng trong `social_events`, `start_at` cách nhau đúng 7 ngày, `free_perks` lưu đúng mảng. **Xoá dữ liệu test sau khi verify** (đây là DB prod). Lặp thất bại giữa chừng thì báo "đã tạo X/N" — không port `batchResumeIndex` retry của web, đánh dấu `// ponytail:` kèm đường nâng cấp.
7. **T5 — mời thành viên club.** — verify: sheet tìm kiếm ra profile, mời → thành viên hiện ACTIVE; mời người đã là thành viên → hiện thông báo, không crash; mời khi không phải organizer → lỗi RLS hiện thành message.
8. **T6 (chỉ khi trước 02:00 và 1–7 đều xanh) — bảng sân quick-table.** — verify: mở 1 QuickTable có lịch → lưới sân hiện trận đang chạy + trận kế; nút xoay ngang vào/ra sạch (`OrientationLock`). **Không** làm doubles-elim/team-match/âm báo. Nếu 90 phút chưa có màn chạy được → `git stash`, ghi nợ, không commit dở.
9. **Báo cáo tổng kết** `docs/proposals/web-native-parity-port/REPORT.md`: đã port / chưa port / vì sao, lệnh build đã chốt (§0.2), quyết định VI-only cần phê chuẩn (§0.3), ba câu hỏi §5.

**Mở PR, KHÔNG tự merge.** Xem §4.

---

## §4 — Cờ rủi ro (bắt buộc đọc)

**T1–T6 không chạm auth, không chạm payments, không chạm `supabase/config.toml`.**
Không migration, không thay đổi RLS, không RPC mới. Theo tiêu chí RED-tier thì
cả gói là **AMBER**: sửa client, dùng lại RPC/bảng đã tồn tại.

**Nhưng `scripts/agents/risk-tier.mjs` KHÔNG TỒN TẠI** trong repo (`ls scripts/agents/`
→ no such directory; khớp memory `idea-pipeline-missing-scripts.md`). Không có
cách chạy máy để phân tier. Đây là **tier gọi bằng tay của em**, phải ghi
nguyên văn vào proposal. Đừng để agent nào sau này báo cáo "risk-tier nói AMBER" —
không có gì nói cả.

Ba thứ vẫn cần Cuong biết:

1. **T4 ghi vào DB prod** (`social_events`). Vòng lặp `repeat_weeks` có thể tạo
   tới 13 sự kiện một lần bấm. Test bằng `status=draft`, dọn sau. Một agent
   test ẩu ở đây sẽ đẻ ra sự kiện rác published mà người dùng thật nhìn thấy.
2. **T5 gọi `invite_club_member`** — thao tác organizer, lands ACTIVE ngay
   (không phải pending). Mời nhầm = có người lạ trong club, phải xoá tay.
3. **Nếu ai đó trong đêm quyết định làm T7 (push):** nó chạm `.entitlements`,
   thêm dependency SPM, và cần Firebase console. Đó là **RED, cần Cuong ký duyệt
   rõ ràng**, và vẫn không verify được trên sim. Không tự ý làm.

**Ngân sách bundle:** `docs/perf-budgets.md` là ngân sách **JS của web** (CI gate,
1970 KB gz). T1–T6 **không thêm một byte JS nào** — toàn bộ là Swift trong
`/apple`. Không cần kiểm tra ngân sách, và đừng ai mất thời gian chạy nó. (T7
thì có: `FirebaseMessaging` làm phình *kích thước app iOS*, một loại ngân sách
khác, không phải cái CI đang gác.)

**SSR / sitemap / hreflang:** **không có route web công khai mới nào** trong bất
kỳ phương án nào. Không cần handler trong `functions/_lib/render/`, không vào
sitemap, không có cặp hreflang. Câu hỏi này đã trả lời trước và câu trả lời là
"không áp dụng" — màn native không được Googlebot crawl.

**File `*.legacy.tsx`:** không đụng. Không phương án nào chạm `src/pages/*.legacy.tsx`.

---

## §5 — Điều em không chắc

1. **Em không có dữ liệu hành vi người dùng native — một chút nào.** Cả 11 gap
   là suy ra từ diff mã nguồn. Em không biết có bao nhiêu người dùng app native
   (nó còn chưa lên App Store — memory `session-2026-07-27-seo-p1-idea.md` ghi
   URL Play Store 404 vì app Android chưa publish; trạng thái iOS em không xác
   minh được trong phiên này). Nếu native đang có ~20 người dùng thì **Option B
   mới là đúng và A là làm quá**. Đây là lỗ hổng lớn nhất trong phân tích của
   em và em không vá được nó từ trong repo.
2. **`parent_tournaments` có bao nhiêu dòng thật?** Em không truy vấn prod trong
   phiên này (PAT nằm ở `~/Downloads/secrets.local.md` — em không tự ý mở file
   secret). Nếu > 20 dòng thì T8 đáng cân nhắc lại và em đã bác vội. Câu truy
   vấn: `select count(*) from parent_tournaments;`
3. **T5 em chưa mở `src/components/social-events/ClubMembers.tsx`.** Em xác minh
   RPC `invite_club_member` tồn tại qua `useClubMembers.ts:177-180`, nhưng chưa
   đọc UI web để biết nó tìm profile bằng gì — tên hiển thị? username? email?
   `SearchRepository.searchPlayers` của native query `profiles`, có thể không
   khớp trường web dùng. **Việc đầu tiên của T5 là mở file đó**, không phải viết code.
4. **`VideoHighlightCard` đang `private` trong `HomeVideosSection.swift`.** T2 cần
   nó. Em giả định bỏ `private` là đủ, nhưng chưa kiểm có tên trùng ở chỗ khác
   trong module không. Rủi ro thấp, nhưng nó là cái sẽ làm build đỏ ở T2 chứ
   không phải ở T1 — tức là lỗi hiện ra muộn hơn chỗ gây ra.
5. **Thời gian của T6 là ước lượng yếu nhất trong bảng.** 2.5–3 giờ dựa trên
   `QuickTableDetail` đã có đủ dữ liệu. Em **chưa đọc** định nghĩa `QuickTableDetail`
   để xác nhận nó thật sự mang số sân + trạng thái trận theo hình dạng lưới sân
   cần. Nếu không, phải thêm truy vấn và T6 thành 4–5 giờ — tức là **vượt khỏi
   một đêm**. Đây chính là lý do T6 nằm sau vạch dừng chứ không nằm trong lõi.
6. **Quyết định VI-only (§0.3) là em tự quyết và nó trái với luật cứng viết
   sẵn của em.** Em cho rằng đây là cách đọc đúng ý định của luật, nhưng đây là
   loại quyết định người khác nên lật lại, không phải nuốt trôi. Nếu Cuong nói
   native phải song ngữ thì **đêm parity này sai đề** và việc đúng là làm String
   Catalog trước (3–5 nửa-ngày), không phải thêm 6 màn VI-only nữa.
