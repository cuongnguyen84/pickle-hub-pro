# Pre-mortem: web-native-parity-port

Ba sự cố dưới đây **đã xảy ra**. Agent autonomous chạy đêm 27→28/07, commit lên
feature branch, `BUILD SUCCEEDED` trên iPhone 17 Pro sim. Sáng 28/07 Cuong mở app.
Mọi mắt xích trỏ tới file có thật trong repo.

Bối cảnh chung, dùng lại ở cả ba câu chuyện:

- **Cổng duy nhất của đêm nay là `xcodebuild` trả `BUILD SUCCEEDED`.** GitHub Actions
  hết ngân sách (lessons-learned 2026-07-27: job chết trong 2 giây, `steps: []`,
  log không nói gì) → không có CI, không có lint, không có smoke, không có
  deploy-guard, không có uptime-ping.
- **`apple/Tests/` có 19 file, không file nào chạm repository hay mạng.** Nặng nhất là
  `apple/Tests/TLComponentsRenderTests.swift` — nó chỉ khẳng định component
  design-system render ra chiều cao > 0 ở AX3. Một danh sách rỗng vẫn có chiều cao > 0.
- **Native gửi 0 dòng telemetry.** `grep -rn "client_errors" apple/` = 0 kết quả. Web có
  bảng `client_errors`; native tuyệt đối câm. Không có gì để soak, không có gì để query
  hồi cứu.
- **Native trỏ thẳng vào prod.** `apple/ThePickleHub/Core/Supabase/AppConfig.swift:5-13`
  dựng URL từ một `SupabaseProjectRef` duy nhất trong `Config/Secrets.xcconfig`.
  Không có staging. Mọi lần agent bấm "Tạo" trên simulator là một INSERT vào prod.
- **Fail-soft là văn hoá của `/apple`.** 143 chỗ nuốt lỗi (`try? await` 130 lần,
  `catch { return [] }` ở `Core/Tools/ToolsRepository.swift`,
  `Core/Chat/ChatRepository.swift`, `Core/Tournaments/CommunityRepository.swift:58`).
  Agent port sẽ copy đúng pattern đó vào mọi repository mới nó viết.

---

### Sự cố 1 — Mọi đăng ký cho 4 sự kiện giao lưu cuối tuần bị từ chối với `slot_not_found`; slot của 11 sự kiện cũ bị xoá trắng

**Xác suất:** cao · **Thời gian tới lúc phát hiện:** 2–5 ngày (tới khi một BTC nhắn Cuong "sao khách đăng ký không được")

**Timeline**

- **T+0 (01:40 đêm 27/07).** Agent nhận task "Social event slots (registration groups),
  free perks, weekly recurrence — M, pending" từ bảng gap của recon (§3). Nó mở
  `apple/ThePickleHub/Core/Social/SocialOrganizerRepository.swift:313` và thấy chỗ chờ sẵn:
  `let slots: [String]   // ponytail: native chưa hỗ trợ nhóm đăng ký (slots) — luôn rỗng`.
- **T+0h20.** Agent viết `struct NativeSlot: Encodable` (id, label, kind, capacity,
  courtCount, skillLevel, minPlayMonths), đổi `EventPayload.slots` sang `[NativeSlot]`,
  và — vì task nói "port đầy đủ" — thêm luôn `slots` vào `EventPatch`
  (`SocialOrganizerRepository.swift:339-354`), gỡ đúng dòng comment cảnh báo ở 352-353.
  Không viết `CodingKeys`.
- **T+1h.** Agent tự kiểm chứng: chạy sim, tạo một sự kiện test có 2 slot. RPC trả 200.
  Trong app, 2 slot hiện đúng. Agent ghi vào báo cáo: "slots — DONE, verified on sim".
- **T+7h (08:30 sáng).** Cuong mở app, vào một CLB, sửa một sự kiện **cũ** (sự kiện này
  có 3 slot do anh tạo trên web tuần trước), đổi mỗi giờ bắt đầu, bấm Lưu. Haptic
  thành công. Anh chuyển màn.
- **T+2 ngày.** BTC của một CLB nhắn Facebook: "khách bấm đăng ký thì báo lỗi, cả chục
  người rồi".

**Cơ chế**

Nhánh A — hình dạng JSON sai mà không ai từ chối:

`SocialOrganizerRepository.swift:295-321` (`EventPayload`, `Encodable` tự sinh) → Swift
sinh key theo **tên property**, nên `courtCount` / `skillLevel` / `minPlayMonths` lên
đường dây thành `"courtCount"`, `"skillLevel"`, `"minPlayMonths"` →
`supabase/migrations/20260521120000_social_event_slots.sql:84,93` — RPC chỉ kiểm
`jsonb_typeof(v_slots) <> 'array'`, không kiểm hình dạng phần tử → cùng file dòng 37-39,
CHECK constraint `social_events_slots_is_array` cũng chỉ kiểm array-ness → INSERT thành
công, 200 →
`supabase/functions/phone-otp-verify/index.ts:208-226` là **nơi duy nhất** validate slot
lúc đăng ký. Nó đọc `s?.id === slotId`; `id`, `label`, `kind`, `capacity` là một từ nên
khớp — nhưng `skill_level` thì `undefined`. Web `src/components/social/create-event/types.ts`
(`validateSlots`) bắt buộc `skill_level` khi `kind = "skill"` → **màn sửa sự kiện trên web
không cho lưu nữa**, và `RegistrationModal` hiện slot không có bậc trình.

Nhánh B — xoá trắng, cùng một commit:

`apple/ThePickleHub/Core/Social/SocialModels.swift:4-27` — `struct SocialEvent` **không có**
field `slots` → hai chuỗi select viết cứng cũng không liệt kê nó:
`Core/Social/SocialRepository.swift:10` và `Core/Social/SocialOrganizerRepository.swift:393` →
`apple/ThePickleHub/Features/Social/Organizer/SocialEventFormView.swift:72-97` (`hydrate`)
prefill từ `existing: SocialEvent`, nên state `slots` khởi tạo `[]` →
cùng file dòng 152-177 (`save()`) đóng gói `EventPatch` **giờ đã có `slots`** →
`SocialOrganizerRepository.swift:356` `client.from("social_events").update(patch)` →
PostgREST PATCH ghi `slots = '[]'` → cột JSONB của sự kiện cũ **mất sạch**.

Hậu quả tầng dưới của nhánh B: `phone-otp-verify/index.ts:199-207` rơi vào nhánh 1
("slots rỗng → cổng cũ theo `max_players`, bỏ qua `slot_id`") → giới hạn từng nhóm biến
mất, chỉ còn tổng. `event_registrations.slot_id` là **TEXT tự do, không FK**
(`20260521120000_social_event_slots.sql:46-53`) nên các đăng ký cũ giữ nguyên slot id mồ côi;
`get_event_slot_counts` (cùng file, dòng 162-177) vẫn GROUP BY id chết và trả ra những con
số trông rất hợp lý.

**Vì sao mọi gate vẫn xanh**

Không có gate nào nhìn được chỗ này, theo đúng nghĩa đen:

1. `BUILD SUCCEEDED` — Swift chỉ kiểm *hình dạng struct*, không kiểm *tên key JSON*. `Encodable`
   tự sinh là hợp lệ 100%.
2. Không có test Swift nào chạm `SocialOrganizerRepository` (`ls apple/Tests | grep -i social`
   = rỗng).
3. `create_social_event_with_payment` trả 200. `UPDATE` qua PostgREST trả **204 No Content,
   không body** → `try await ... .execute()` không ném. Ở tầng Swift, ghi hỏng và ghi đúng
   trông y hệt nhau.
4. **Agent tự verify bằng luồng TẠO, không phải luồng SỬA.** Nhánh B chỉ nổ khi sửa một
   sự kiện *đã có* slot — mà sự kiện agent vừa tạo thì slot do chính nó nhập vào state.
5. **Native không có luồng đăng ký cho người chơi.** `Features/Registration/` là magic-link
   (`/dang-ky/:magic_token`). `phone-otp-verify` — nơi duy nhất phát hiện được hình dạng slot
   sai — **không bao giờ được gọi từ /apple**. Kiểm trên native không thể chạm vào nó.
6. Cảnh báo duy nhất tồn tại là một **câu comment** ở `SocialOrganizerRepository.swift:352-353`.
   Lessons-learned 2026-07-22 đã chốt: comment "kept in sync" không phải cơ chế —
   `functions/_middleware.ts` tự nhận đồng bộ với `public/_headers` trong nhiều tháng trong
   khi thiếu 2 domain DUPR.

**Ai báo, sau bao lâu**

Không phải Cuong. Một BTC CLB, qua Facebook/Zalo, sau 2–5 ngày — đúng lúc mở đăng ký cho
buổi cuối tuần. Trước đó người chơi chỉ thấy một mã lỗi tiếng Anh và bỏ cuộc; không ai báo
cho tới khi BTC đếm sĩ số.

**Vì sao khó sửa**

`git revert` lấy lại code, **không lấy lại cột `slots`**. Không có bảng lịch sử, không có
trigger audit trên `social_events`. Đường phục hồi duy nhất là PITR trên project prod
`ajvlcamxemgbxduhiqrl` — nhưng khoảng thời gian hỏng trải dài nhiều ngày và trong khoảng đó
có hàng trăm ghi hợp lệ khác lên các bảng khác, nên không thể rollback toàn cục. Tái dựng
thủ công thì chỉ có `event_registrations.slot_id` — cho biết *id*, không cho biết `label`,
`capacity`, `skill_level`. Với sự kiện chưa ai đăng ký, dữ liệu **mất vĩnh viễn**.

**Dấu hiệu sớm lẽ ra phải có**

- Diff xoá một comment `ponytail:` đang cảnh báo về mất dữ liệu — đó là dấu hiệu mạnh nhất
  của cả đêm, và nó nằm ngay trong `git diff`.
- `EventPayload.slots` được khai `[String]` chứ không phải `[Slot]` là lời thú nhận rằng
  không bên nào thoả thuận hình dạng.
- Không có một test nào — Swift, pgTAP, hay Deno — khẳng định payload native decode được
  bằng cùng reader mà `phone-otp-verify` dùng.

---

### Sự cố 2 — Tab Giải đấu và mục "Giải nổi bật" trống trơn suốt 3 tuần; ai cũng tưởng cuối tháng ít giải

**Xác suất:** cao · **Thời gian tới lúc phát hiện:** 1–3 tuần, và nhiều khả năng chỉ lộ ra tình cờ

**Timeline**

- **T+0 (02:50 đêm).** Agent nhận hai mục M/S từ recon §3: `/tournaments` 3 tab (thêm
  carousel Featured parent-tournaments) và `/tools/quick-tables/parent/:shareId`. Nó đọc
  `src/hooks/useFeaturedParentTournaments.ts:47-70` để lấy shape query, và
  `src/hooks/useParentTournament.ts:11-23` để lấy shape row.
- **T+0h15.** Nó viết `Core/Tournaments/ParentTournamentRepository.swift` bằng cách copy
  khuôn `Core/Tournaments/CommunityRepository.swift` — nguyên xi cả `catch { return [] }`
  ở dòng 58.
- **T+0h40.** Nó mở rộng `TLSegmented` trong `Features/Tournaments/TournamentsView.swift`
  từ 2 lên 3 case. Build xanh.
- **T+6h.** Cuong mở tab Giải đấu. Tab "Nổi bật" hiện đúng empty-state có sẵn của app:
  "Chưa có giải nào". Cuối tháng 7 thì đúng là ít giải. Anh gật đầu, chuyển sang test
  màn khác.
- **T+3 tuần.** Có người hỏi tại sao giải của họ không lên app.

**Cơ chế**

`src/hooks/useFeaturedParentTournaments.ts:65` sắp xếp
`.order("event_date", { ascending: true, nullsFirst: false })` → **chính dòng này là bằng
chứng prod có row `event_date = NULL`**, nếu không đã không cần `nullsFirst` →
`src/integrations/supabase/types.ts:4243` xác nhận `event_date: string | null`, cùng với
`banner_url`, `description`, `location` →
agent port sang Swift muốn sort theo ngày nên khai `let event_date: String` (không optional)
và parse bằng helper ISO copy từ `CommunityRepository.swift:11-17` →
JSONDecoder gặp `null` ném `valueNotFound` cho **toàn bộ mảng**, không phải một phần tử →
`catch { return [] }` nuốt gọn →
`TournamentsView` render **cùng một empty-state** với trường hợp "thật sự chưa có giải".

Một mắt xích nữa làm nó tàng hình lâu hơn: `src/hooks/useParentTournament.ts:25-30`
(`SubEventPreview`) khai `name: string; status: string; share_id: string` — TypeScript
không kiểm lúc chạy nên không ai từng biết interface này có đúng không. Swift Codable
**kiểm lúc chạy**. Bản port trung thành với một interface chưa bao giờ bị thử.

**Vì sao mọi gate vẫn xanh**

- `BUILD SUCCEEDED` là điều kiện *cần* của Codable, không phải điều kiện *đủ*: nullability
  chỉ nổ khi có byte thật.
- `catch { return [] }` biến **lỗi** thành **dữ liệu**. Đây đúng lớp lỗi mà repo vừa học
  27/07 ở phía web (lessons-learned: `PGRST116` biến "không có bài" thành "lỗi kết nối";
  bài học chốt là *vắng mặt là dữ liệu, chỉ lỗi truyền tải thật mới ném*). Native đang mắc
  đúng lỗi đó, **ngược chiều**, ở 143 chỗ.
- `TLComponentsRenderTests.assertRenders` khẳng định `size.height > 0`. Một danh sách rỗng
  kèm empty-state có chiều cao > 0. Test xanh.
- Native gửi 0 dòng `client_errors`. Không có gì để soak, không có gì để query hồi cứu —
  khác hẳn web, nơi lessons-learned 2026-07-22 còn dựng được "soak hồi cứu" bằng cách query
  `client_errors` từ mốc deploy.
- **Cuong nghiệm thu bằng mắt.** Một màn trống *có chủ đích* và một màn trống *vì decode
  chết* là hai pixel giống hệt nhau. Nghiệm thu bằng mắt về mặt vật lý không phân biệt được.

**Ai báo, sau bao lâu**

Không ai, trong nhiều tuần. Người báo cuối cùng sẽ là một BTC hỏi "sao giải tôi không lên
app" — và câu đó dễ bị hiểu nhầm thành câu hỏi về `is_featured` chứ không phải về decoder.

**Vì sao khó sửa**

Sửa code thì 3 phút (đổi thành `String?`). Cái đắt là **không có cách nào biết nó đang
hỏng**, và cũng không có cách nào biết những section khác *đang không* hỏng. Sau lần này,
mọi mục trống trên native đều trở thành câu hỏi mở. Đó là dạng ăn mòn niềm tin mà
`git revert` không đụng tới: không phải "app hỏng" mà "app im lặng, và mình không biết khi
nào nó im lặng".

**Dấu hiệu sớm lẽ ra phải có**

- `nullsFirst: false` trong query web là chỉ báo nullability đọc-được-bằng-mắt, ngay trong
  file agent đã mở.
- `CommunityRepository.swift:33` đã khai `name: String?` cho `quick_tables.name` — dù cột
  đó `NOT NULL`. Tác giả native trước phòng thủ *quá tay* chỗ không cần; agent port lại
  phòng thủ *thiếu* chỗ cần. Không có luật, chỉ có thói quen.
- `catch { return [] }` không in gì cả — kể cả trong build DEBUG trên simulator, nơi in
  ra không tốn gì.

---

### Sự cố 3 — Sáng mở app: chỉ còn 4 tab và một nút "More" kiểu iOS mặc định; Bảng tin và Công cụ biến mất; màn Giải đấu vốn chạy tốt giờ trắng trơn

**Xác suất:** trung bình · **Thời gian tới lúc phát hiện:** 10 giây

**Timeline**

- **T+0 (04:10 đêm, gần cuối phiên).** Agent còn 2 mục L trong bảng gap: pro tournament
  detail và `/tools/dashboard`. Nó quyết định "port đầy đủ" nên thêm một tab thứ 6 cho
  Dashboard vào `Features/Shell/AppTabView.swift:7-33`.
- **T+0h25.** Nó thay thân `Features/Tournaments/TournamentDetailView.swift` — gỡ
  `SafariView(WebRoutes.tournament(...))` ở dòng 50-52 và cắm màn native mới vào.
- **T+0h50.** Ngân sách context cạn. Repository của màn mới mới xong phần khung, hàm fetch
  còn trả `[]`. Agent commit tất cả lên feature branch và viết báo cáo: "pro tournament
  detail — native shell landed, data layer partial".
- **T+4h (08:15).** Cuong `xcodegen && xcodebuild && simctl launch`. App mở. Thanh tab có
  Trang chủ, Trực tiếp, Social, Bảng tin, **More**. Bấm vào một giải → màn trống.

**Cơ chế**

Ba mắt xích, mỗi cái riêng lẻ đều vô hại:

1. `Features/Shell/AppTabView.swift:13-33` dùng **`TabView` hệ thống** với đúng 5
   `.tabItem`. Trên iPhone, `UITabBarController` (thứ SwiftUI bọc bên dưới ở
   deploymentTarget iOS 17, xem `apple/project.yml:8`) hiển thị tối đa 5 item; item thứ 6
   trở đi bị gom vào danh sách "More" do UIKit vẽ, **không** dùng token nào của The Line
   (`DesignSystem/`, `TLColor`). Compiler không có gì để nói.
2. Màn mới được đẩy bằng `.navigationDestination(item:)` — pattern chủ đạo của cả app
   (`Features/Tools/ToolsView.swift:139-178`, `Features/Search/SearchView.swift:60-62`,
   `Features/Tournaments/TournamentsView.swift:24`). Modifier này phải nằm trên
   **container**, không nằm trong hàng của `ForEach`/lazy stack. Đặt sai chỗ → SwiftUI
   không đăng ký destination → **chạm vào card không có gì xảy ra**. Không crash, không
   log Cuong nhìn thấy.
3. `TournamentDetailView.swift:50-52` trước đêm nay là một **web-hop chạy tốt** — mở
   `WebRoutes.tournament(slug:)` trong SafariView, hiển thị đầy đủ bracket + đăng ký. Gỡ nó
   ra và thay bằng một màn native mà tầng dữ liệu chưa xong = **parity âm**: hôm qua xem
   được, hôm nay không.

**Vì sao mọi gate vẫn xanh**

- Đây là loại sự cố mà `BUILD SUCCEEDED` **được thiết kế để không bắt**: cả ba mắt xích đều
  là hành vi runtime của UIKit/SwiftUI, không phải lỗi kiểu.
- `apple/project.yml:31-32` khai `sources: - path: ThePickleHub` — cả thư mục. File mới tự
  động vào target khi chạy xcodegen, nên **không có cơ chế "sót file khỏi target"** để dựng
  lỗi biên dịch cứu mình. Ngược lại: một màn nửa vời vẫn biên dịch trọn vẹn.
- Không có UI test. `apple/Tests/TLComponentsRenderTests.swift` chỉ mount component
  design-system, chưa từng mount `AppTabView`.
- `apple/ThePickleHub.xcodeproj` **không được track trong git** (`git ls-files` trả rỗng) —
  nên diff của PR không hề chứa tín hiệu "shell của app vừa đổi cấu trúc"; chỉ có
  `AppTabView.swift` với vài dòng thêm trông rất lành.
- Actions hết ngân sách nên cả `deploy-guard` lẫn `uptime-ping` đều không chạy — nhưng kể
  cả khi chạy, chúng đo web prod, không đo binary native.

**Ai báo, sau bao lâu**

Cuong, sau 10 giây, chính là kịch bản test sáng mai. Đây là sự cố **ít nguy hiểm nhất** trong
ba cái, dù nhìn thảm khốc nhất.

**Vì sao khó sửa**

Sửa dễ (`git revert` nguyên nhánh, hoặc gỡ tab thứ 6). Cái mất là **buổi test sáng mai** —
ràng buộc cứng duy nhất của intake (`00-intake.md:9,11`). Cả đêm công việc bị chặn sau một
màn hình hỏng ở tầng shell, và Cuong không có cách nào chạm tới 12 màn khác đã port đúng.
Chi phí thật không phải bug, mà là **không nghiệm thu được gì cả**.

**Dấu hiệu sớm lẽ ra phải có**

- Bất kỳ diff nào chạm `Features/Shell/` trong một task port là dấu hiệu tự nó — file đó là
  shell dùng chung, không phải chỗ để thêm tính năng.
- `simctl launch` + một ảnh chụp màn hình đầu tiên là toàn bộ chứng cứ cần thiết, và agent
  đã có sẵn vòng lặp đó trong memory `native-build-run-loop`. Nó dừng ở `xcodebuild` vì
  đó là điều intake yêu cầu.
- Gỡ một `SafariView` web-hop mà không có ai xác nhận màn thay thế chạy được là hành vi
  **xoá tính năng**, và nó nằm trong cùng một commit với hành vi **thêm tính năng**.

---

## Xếp hạng

| # | Sự cố | Xác suất | Khó phát hiện | Ưu tiên |
|---|---|---|---|---|
| 1 | Slots ghi sai hình dạng + bị xoá trắng trên prod | cao | rất cao (2–5 ngày, người ngoài báo, dữ liệu mất vĩnh viễn) | **P0** |
| 2 | Decode fail âm thầm → tab trống giả dạng "chưa có dữ liệu" | cao | rất cao (1–3 tuần, có thể không ai báo) | **P0** |
| 3 | Tab thứ 6 + nav chết + gỡ web-hop khi native chưa xong | TB | rất thấp (10 giây) | P2 |

Sự cố 3 trông tệ nhất nhưng là cái nhẹ nhất: nó tự tố cáo trong 10 giây, `git revert` chữa
được 100%, không có byte nào ở prod bị đụng.

**Tệ nhất là sự cố 1**, và không phải vì kịch tính. Nó là cái duy nhất trong ba cái để lại
**thiệt hại không hoàn nguyên được**: `git revert` khôi phục code, không khôi phục cột JSONB
đã bị ghi đè `[]`. Với những sự kiện chưa có ai đăng ký, cấu hình slot mất vĩnh viễn — không
PITR nào lấy lại được mà không cuốn theo mọi ghi hợp lệ khác cùng cửa sổ. Cộng thêm: nạn nhân
không phải Cuong mà là BTC các CLB, và cái họ mất không phải một màn hình mà là một buổi
đánh có 24 người tới cho 16 chỗ.

Sự cố 2 xếp ngang P0 vì lý do khác: nó **ăn mòn khả năng nghiệm thu**. Sau lần đầu tiên một
màn trống hoá ra là decode chết, mọi màn trống trên native đều trở thành nghi vấn, và không
có telemetry nào để trả lời. Đó là chi phí kéo dài qua mọi phiên sau.

---

## Rẻ nhất để chặn từ bây giờ

Ba việc, tổng khoảng 20 dòng.

**1. Một dòng trong mọi `catch` của repository — chặn sự cố 2.**

Trong `apple/ThePickleHub/Core/Tournaments/CommunityRepository.swift:58` và mọi
`catch { return [] }` / `try?` mà agent viết mới tối nay:

```swift
} catch { assertionFailure("decode \(Self.self): \(error)"); return [] }
```

`assertionFailure` chỉ nổ ở build DEBUG — tức đúng build Cuong chạy trên simulator sáng mai,
và đúng build agent chạy trong đêm. Release không đổi một byte. Bug decode chuyển từ "danh
sách trống" sang "crash ngay tại field sai, kèm tên field". Không thêm dependency, không thêm
file, không thêm hệ thống telemetry.

**2. Một guard trong `updateEvent` — chặn nhánh xoá trắng của sự cố 1.**

`apple/ThePickleHub/Core/Social/SocialOrganizerRepository.swift:356`. Giữ `slots` **ra khỏi**
`EventPatch` (đúng như comment 352-353 đang dặn), và nếu tối nay bắt buộc phải ghi slot thì
tách hàm riêng, đọc trước khi ghi:

```swift
/// Ghi slots RIÊNG. Từ chối ghi mảng rỗng đè lên cấu hình đang có — đó luôn là
/// bug hydrate, không bao giờ là ý định của BTC.
func updateSlots(id: UUID, slots: [NativeSlot]) async throws {
    struct Cur: Decodable { let slots: [AnyJSON] }
    let cur: Cur? = try? await client.from("social_events")
        .select("slots").eq("id", value: id).single().execute().value
    if slots.isEmpty, (cur?.slots.count ?? 0) > 0 { throw SlotGuard.refuseWipe }
    try await client.from("social_events").update(["slots": slots]).eq("id", value: id).execute()
}
```

Guard này rẻ hơn PITR vài bậc độ lớn và bắt đúng mọi biến thể của lỗi hydrate.

**3. Một test 15 dòng khoá hình dạng slot — chặn nhánh A của sự cố 1.**

`apple/Tests/SlotPayloadTests.swift`: encode một `NativeSlot` bằng `JSONEncoder`, assert tập
key **đúng bằng** `["id","label","kind","capacity","court_count","skill_level","min_play_months","notes"]`
— tức chính hợp đồng viết trong `20260521120000_social_event_slots.sql:15-25`. Chạy trong
target test có sẵn, không hạ tầng mới. Nó là điểm duy nhất trong toàn hệ thống nơi hình dạng
Swift và hình dạng mà `phone-otp-verify` đọc gặp nhau — hiện tại chúng chưa bao giờ gặp nhau
ở đâu cả.

**Và một luật không tốn dòng code nào:** *không commit nào được vừa gỡ một `SafariView`
web-hop vừa thêm màn native thay thế nó.* Thêm màn native trước, để web-hop nguyên đó, gỡ ở
commit sau khi Cuong xác nhận. Chặn nhánh 3 của sự cố 3 với chi phí bằng 0.

---

## Khoảng hở của pipeline mà bài này lộ ra

Nói thẳng, đây là feedback cho chính `/idea`:

1. **Định nghĩa "xong" của đêm nay là `BUILD SUCCEEDED`, và nó không đo được gì cả.**
   `00-intake.md:12` ghi ràng buộc là build xanh trên sim. Với Swift, build xanh chứng minh
   *hình dạng struct*, không chứng minh *tên key JSON*, không chứng minh *nullability*,
   không chứng minh *nav có đăng ký hay không*, không chứng minh *tab có bị gom vào More
   hay không*. Cả ba sự cố ở trên đều đi qua cổng này mà không chạm vào nó. Ràng buộc đúng
   phải là `simctl launch` + chạm được từng màn mới, ít nhất là một ảnh chụp màn hình cho
   mỗi màn port — đó chính là vòng lặp trong memory `native-build-run-loop`, chỉ là intake
   đã cắt mất nửa sau của nó.

2. **Không cổng nào của repo này từng đo native.** Bài học 27/07 vừa chốt: "Gate của repo này
   chỉ đo nhánh BOT" — web SPA có `tests/human-path.spec.ts` chạy trình duyệt thật từ 27/07.
   `/apple` chưa có phiên bản tương đương, và tệ hơn: nó **không gửi telemetry** (0 kết quả
   `client_errors`), nên cũng không có cả "soak hồi cứu" như cách web đã dùng ở
   lessons-learned 2026-07-22. Native hiện là vùng duy nhất trong hệ thống không có cả
   gate trước lẫn tín hiệu sau.

3. **Hợp đồng dữ liệu giữa native và edge function không có nơi nào để bị kiểm.** Hình dạng
   `slots` được định nghĩa bằng **comment SQL** (`20260521120000_social_event_slots.sql:15-25`),
   được viết bởi TypeScript (`src/components/social/create-event/types.ts`), được đọc bởi Deno
   (`phone-otp-verify/index.ts:208`), và giờ được ghi bởi Swift. Bốn cách diễn giải, không
   một assertion nào chung. `risk-auditor` sẽ không thấy vì không ràng buộc nào bị vi phạm;
   compiler không thấy vì mỗi bên tự nhất quán.

4. **`risk-tier.mjs` coi mọi file `apple/` là RED tại merge** (lessons-learned 2026-07-18,
   2026-07-20), nên tier của đêm nay sẽ RED vì *chạm thư mục*, không vì *cơ chế*. Một
   classifier luôn đỏ là một classifier bị học cách phớt lờ — đúng bài học "gate mà người ta
   học cách phớt lờ thì tệ hơn không có gate" (27/07). Nếu đêm nay RED, hãy chắc nó RED vì
   `updateEvent` ghi vào prod, không phải vì đường dẫn bắt đầu bằng `apple/`.

5. **Intake tự cho phép cái chính nó vừa cấm.** `00-intake.md:19` viết "không ship nửa vời",
   nhưng cơ chế duy nhất để cưỡng chế là agent tự đánh giá lúc 4 giờ sáng khi context đã cạn —
   tức đúng thời điểm nó ít có khả năng đánh giá đúng nhất. Luật cưỡng chế được thì phải ở
   tầng diff, không ở tầng ý chí: *một commit không được vừa xoá một đường đang chạy vừa thêm
   đường thay thế nó*.
