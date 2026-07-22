# Apple hardening handoff — 2026-07-21

> Đây là memory bền vững để tiếp tục sau khi context bị xoá. Phiên mới phải đọc
> toàn bộ file này và `apple/docs/SESSION_HANDOFF.md` trước khi sửa code.

## Mục tiêu

Xử lý tuần tự bốn nhóm ưu tiên đã xác nhận trong audit native iOS:

1. CI + App Store privacy blocker.
2. Đồng bộ auth/session lifecycle.
3. Sửa thuật toán Doubles Elimination bracket và bổ sung invariant tests.
4. Transaction hoá các mutation có nguy cơ làm mất hoặc sai dữ liệu.

Không mở rộng sang Swift 6 migration, đại tu UI, tăng coverage toàn app hoặc
refactor mọi singleton trong workstream này, trừ khi đó là điều kiện bắt buộc
để hoàn thành một task ở trên.

## Trạng thái baseline đã xác minh

- Audit date: 2026-07-21, timezone Asia/Ho_Chi_Minh.
- Repo root: `/Users/cm10/pickle-hub-pro`.
- Apple root: `/Users/cm10/pickle-hub-pro/apple`.
- Branch/HEAD lúc lưu memory: `main` / `ba462a01`. Không giả định vẫn còn đúng;
  luôn chạy `git branch --show-current` và `git status --short` trước khi làm.
- XcodeGen 2.45.4, Xcode 26.3 (17C529), deployment target iOS 17.
- `xcodebuild test` đã pass: 90/90 tests.
- App coverage theo `xccov`: 3.33% (1,795/53,847 executable lines).
- Build với `SWIFT_STRICT_CONCURRENCY=complete` vẫn thành công ở Swift 5 nhưng
  phát sinh nhiều warning sẽ thành lỗi trong Swift 6. Đây chưa phải workstream
  hiện tại.
- Production Swift: 176 file, khoảng 35,171 dòng; test: 13 file.
- Chưa có source change từ audit. `apple/skills-lock.json` đã là untracked file
  của người dùng trước workstream; không sửa/xoá/add file này nếu không được yêu
  cầu rõ ràng.
- `.xcodeproj` được sinh từ `project.yml` và bị git-ignore. Không chỉnh trực tiếp
  project file.

## Nguyên tắc thực thi sau context reset

1. Làm đúng thứ tự Task 1 → 4. Chỉ một task `in_progress` tại một thời điểm.
2. Trước mỗi task: kiểm tra branch, `git status`, diff liên quan và đọc lại các
   file trong mục “Điểm vào code”. Giữ nguyên mọi thay đổi không thuộc task.
3. Viết test tái hiện lỗi trước hoặc cùng patch khi khả thi.
4. Không commit, push, deploy migration hoặc sửa trạng thái production nếu người
   dùng chưa yêu cầu rõ trong phiên đó.
5. Sau mỗi task: chạy verification tương ứng, cập nhật checkbox và nhật ký ở cuối
   file này, rồi báo kết quả trước khi sang task tiếp theo.
6. Nếu task cần quyết định sản phẩm làm thay đổi luật giải đấu, dừng ở phương án
   bảo toàn dữ liệu an toàn nhất và nêu rõ quyết định; không tự đổi thể thức.
7. Task 4 cần sửa backend nằm ngoài `apple/`. Nếu workspace vẫn chỉ cho ghi
   `/apple`, yêu cầu mở workspace tại repo root hoặc cấp quyền ghi có phạm vi cho
   migrations/tests cần thiết. Không mô phỏng transaction chỉ bằng nhiều request
   client nối tiếp.

## Task 1 — CI và privacy manifest

**Trạng thái:** `[x] hoàn tất (2026-07-21)`

### Lỗi đã xác nhận

- `.github/workflows/apple-tests.yml:29` dùng `actions/checkout@v7`; tại ngày
  audit, release chính thức mới nhất là v6.0.2. Workflow có thể dừng ngay ở bước
  checkout.
- Không có `PrivacyInfo.xcprivacy` trong app target.
- App trực tiếp dùng `UserDefaults` trong `ThemeStore`, `DraftStore`,
  `LiveReminderStore`, `WatchProgressStore` và `AppTabView`.

### Công việc

- Đổi checkout sang major hợp lệ hiện hành; kiểm tra lại release chính thức tại
  thời điểm sửa. Ưu tiên `actions/checkout@v6` hoặc pin full SHA nếu repo áp dụng
  chính sách supply-chain tương ứng.
- Tạo `ThePickleHub/App/PrivacyInfo.xcprivacy` và bảo đảm XcodeGen đưa file vào
  resources của app target.
- Khai báo chính xác required-reason category cho `UserDefaults`. `CA92.1` là
  ứng viên phù hợp với app preferences tại ngày audit nhưng phải kiểm tra lại
  tài liệu Apple hiện hành trước khi ghi.
- Không bịa khai báo collected-data/tracking. Kiểm kê hành vi app và SDK; đặt
  `NSPrivacyTracking`/collected-data theo thực tế và ghi chú quyết định nếu cần
  xác nhận từ product/legal.
- Cân nhắc pin version XcodeGen trong CI, nhưng không để việc này chặn blocker.

### Điểm vào code

- `/Users/cm10/pickle-hub-pro/.github/workflows/apple-tests.yml`
- `apple/project.yml`
- `apple/ThePickleHub/App/Info.plist`
- `apple/ThePickleHub/Core/Theme/ThemeStore.swift`
- `apple/ThePickleHub/Core/Drafts/DraftStore.swift`
- `apple/ThePickleHub/Core/Live/LiveReminderStore.swift`
- `apple/ThePickleHub/Core/Live/WatchProgressStore.swift`

### Hoàn thành khi

- Workflow dùng action checkout tồn tại.
- Privacy manifest có trong built app resources và `plutil -lint` pass.
- Full unit tests pass.
- Nếu có thể tạo archive cục bộ, privacy report/validation không báo thiếu
  required reason do code của app.

## Task 2 — Auth/session lifecycle

**Trạng thái:** `[x] hoàn tất (2026-07-21)`

### Lỗi đã xác nhận

`SessionStore.bootstrap()` chỉ đọc `client.auth.currentSession` một lần.
`currentSession` là local session không validation và store không consume
`client.auth.authStateChanges`. Khi session hết hạn/revoked hoặc user đăng xuất
từ nơi khác, Supabase có thể phát `.signedOut` nhưng Root UI vẫn giữ signed-in.

### Công việc

- Đánh dấu state owner phù hợp với UI isolation, ưu tiên `@MainActor` cho
  `SessionStore`.
- Tạo một auth-event listener dài hạn, idempotent; không tạo task trùng khi
  `bootstrap()` chạy lại.
- Ánh xạ ít nhất `initialSession`, `signedIn`, `signedOut`, `tokenRefreshed` và
  các event user/session liên quan của supabase-swift 2.48.0 vào `State`.
- Giữ cold-launch offline không bị màn hình `.unknown` vô hạn.
- Hủy listener đúng lifecycle và làm sạch state gắn với user khi signed out.
- Tách event-to-state reducer hoặc auth abstraction đủ nhỏ để unit test không
  cần backend thật.

### Điểm vào code

- `apple/ThePickleHub/Core/Auth/SessionStore.swift`
- `apple/ThePickleHub/Features/Root/RootView.swift`
- `apple/ThePickleHub/Core/Supabase/SupabaseManager.swift`
- Supabase API đang resolve trong DerivedData: kiểm tra signature thực tế của
  `authStateChanges`, không dựa vào trí nhớ.

### Test bắt buộc

- Initial session nil → signed out.
- Initial/signed-in session → đúng user identity.
- Token refresh giữ signed in và cập nhật identity nếu cần.
- Signed out/session invalidation → signed out.
- Bootstrap nhiều lần không tạo nhiều listener.

### Hoàn thành khi

- Unit tests mới và toàn bộ suite pass.
- Không còn đường auth event phổ biến khiến UI giữ trạng thái signed-in cũ.
- Strict-concurrency warning mới không tăng; lý tưởng là giảm tại SessionStore.

## Task 3 — Doubles Elimination bracket correctness

**Trạng thái:** `[x] hoàn tất (2026-07-21)`

### Lỗi đã xác nhận

- Wizard cho phép `2...128` đội và manual flow chỉ yêu cầu tối thiểu hai đội.
- `generateInitialBracket` tạo `r1Count = n / 2`, `r2Count = r1Count / 2`, nhưng
  không biểu diễn đầy đủ BYE khi R1 hoặc R2 có số participant lẻ.
- `checkAndAssignR3` yêu cầu cả R1 và R2 không rỗng; `checkAndGeneratePlayoff`
  yêu cầu R3 không rỗng.
- Ví dụ đã phân tích: 2/3/5 đội có thể bị kẹt không sinh playoff; 6/7 đội có thể
  làm một hoặc nhiều đội biến mất khỏi đường bracket.
- Không có test cho full initial graph hoặc invariant “mọi đội có đúng một đường
  đi hợp lệ”. Tests hiện tại chỉ kiểm tra result helper/advance target nhỏ.
- Manual flow còn cho chọn `teamCount` nhưng repository thực tế dùng
  `max(teams.count, 2)`, nên giá trị step 1 không được enforce với danh sách.

### Cách làm

1. Đọc implementation web tương ứng và schema/migrations trước khi thay đổi để
   hiểu luật nghiệp vụ hiện hành; không mặc định comment “faithful port” nghĩa là
   thuật toán đúng.
2. Tách việc lập initial bracket thành pure planning function, không phụ thuộc
   Supabase. Mỗi match/source/BYE phải biểu diễn rõ ràng và validate được trước
   khi insert.
3. Viết invariant/property-style tests cho mọi `n` từ 2 đến 128:
   - mọi team xuất hiện đúng một lần tại entry graph hoặc explicit BYE;
   - mọi `winner_of`/`loser_of` trỏ tới source tồn tại;
   - không có participant active bị mất giữa R1/R2/R3/playoff;
   - số slot/match ở mỗi vòng hợp lệ;
   - 2, 3, 4, 5, 6, 7, 8, 9 và power-of-two boundaries có test cụ thể.
4. Nếu chưa thể chứng minh hỗ trợ mọi số đội mà không đổi luật sản phẩm, áp dụng
   guard an toàn ở UI **và repository** để chỉ cho phép tập số đội đã được test;
   không chỉ disable UI vì registration có thể đóng với số đội thực tế ít hơn
   capacity.
5. Tách phần insert khỏi planner. Transaction/idempotency của insert được hoàn
   thiện ở Task 4, nhưng Task 3 phải bảo đảm plan đúng trước khi ghi.

### Điểm vào code

- `apple/ThePickleHub/Features/Bracket/CreateDoublesElimView.swift`
- `apple/ThePickleHub/Core/DoublesElim/DoublesElimRepository.swift`
- `apple/ThePickleHub/Core/DoublesElim/DoublesElimModels.swift`
- `apple/ThePickleHub/Features/Bracket/DoublesElimDetailView.swift`
- `apple/Tests/DoublesElimResultTests.swift`

### Hoàn thành khi

- Regression tests đỏ trước/sát patch và xanh sau patch.
- Dải số đội được công bố là hợp lệ đều thỏa invariant.
- Không tournament nào có thể chuyển `ongoing` với graph không hợp lệ.
- Full suite pass.

## Task 4 — Transaction và toàn vẹn dữ liệu

**Trạng thái:** `[x] hoàn tất — toàn bộ scope đã xác định, bao gồm Team Match
create/generator/reset, đã transaction hoá, verify và deploy database production
thành công (2026-07-22)`

### Phạm vi và thứ tự ưu tiên

Task này cần audit migrations/RPC/constraints ở repo root trước khi viết SQL.
Không kết luận constraint thiếu chỉ từ iOS code. Tuy nhiên, nhiều request client
riêng biệt chắc chắn không cùng một DB transaction.

Ưu tiên triển khai theo thứ tự:

1. **Flex score/stat recompute:** hiện update match, xóa hai bảng stats rồi insert
   lại từ snapshot client cũ. Failure sau delete làm mất standings; hai referee
   có thể last-write-wins.
2. **Doubles Elimination close registration + bracket creation:** RPC đóng đăng
   ký/chuyển status chạy trước client-side bracket insert. Failure để giải ongoing
   nhưng không có bracket.
3. **Score correction + downstream propagation** cho Doubles Elimination và
   QuickTable: sửa winner cũ không invalidate score/winner/advancement phía sau.
4. **QuickTable score + group stats**, rồi `setupRoster` nhiều bước.
5. **TeamMatch ensure-games/check-then-insert** và các lifecycle mutation còn lại.

### Yêu cầu thiết kế

- Dùng transactional Postgres RPC cho một business mutation; client gọi một RPC,
  không giả transaction bằng chuỗi REST call.
- Thêm idempotency/unique constraints thích hợp và version hoặc optimistic
  concurrency cho scoring.
- Với score correction: hoặc từ chối nếu downstream đã thi đấu, hoặc invalidate
  toàn bộ dependency trong cùng transaction. Chọn policy sau khi đối chiếu product
  behavior web; phải có auditability và thông báo UI rõ ràng.
- RPC trả typed result/error code; iOS không nuốt lỗi bằng `try?` cho mutation.
- Viết migration forward-only, pgTAP/integration tests và rollback reasoning.
- Chạy dry-run/drift checks theo convention của repo trước khi đề xuất deploy.
  Không deploy production nếu chưa được người dùng cho phép trong phiên đó.

### Điểm vào code iOS

- `apple/ThePickleHub/Core/Flex/FlexRepository.swift:122-177`
- `apple/ThePickleHub/Core/DoublesElim/DoublesElimRepository.swift:101-210`
- `apple/ThePickleHub/Core/DoublesElim/DoublesElimRepository.swift:510-645`
- `apple/ThePickleHub/Core/DoublesElim/DoublesElimRepository.swift:757-774`
- `apple/ThePickleHub/Core/QuickTable/QuickTableRepository.swift:251-327`
- `apple/ThePickleHub/Core/QuickTable/QuickTableRepository.swift:768-858`
- `apple/ThePickleHub/Core/TeamMatch/TeamMatchRepository.swift:1088-1121`

### Hoàn thành tối thiểu trong ngân sách hiện tại

- Hoàn thành atomic RPC + tests cho ba mục ưu tiên đầu.
- iOS dùng RPC mới và có error UI/rollback hợp lý.
- Không còn đường sửa score tạo bracket với participant, winner và downstream
  result mâu thuẫn cho các format đã chuyển đổi.
- Các mutation ít rủi ro hơn chưa chuyển phải được ghi thành follow-up rõ ràng,
  không tuyên bố toàn bộ Task 4 hoàn tất.

## Verification chuẩn

Chạy từ `apple/`:

```sh
xcodegen generate
xcodebuild test \
  -project ThePickleHub.xcodeproj \
  -scheme ThePickleHub \
  -destination 'platform=iOS Simulator,id=<AVAILABLE_UDID>' \
  CODE_SIGNING_ALLOWED=NO
```

Tìm simulator khả dụng bằng `xcrun simctl list devices available`; không hardcode
UDID từ phiên audit. Với concurrency regression, chạy thêm:

```sh
xcodebuild build \
  -project ThePickleHub.xcodeproj \
  -scheme ThePickleHub \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /tmp/picklehub-strict-audit \
  CODE_SIGNING_ALLOWED=NO \
  SWIFT_STRICT_CONCURRENCY=complete
```

Sau Task 4, chạy thêm test/migration commands theo hướng dẫn ở repo root và chỉ
dùng credential từ secret store hiện có; không in token/key ra log.

## Các finding không thuộc 4 task — để backlog

- Search `.or(...)` chỉ escape `%`/`_`; club search không escape PostgREST grammar.
- Realtime chat dùng API deprecated và start/stop chưa idempotent.
- GoogleSignIn pin 7.1.0 trong khi audit thấy official latest 9.2.0.
- `Package.resolved` nằm trong ignored `.xcodeproj`; CI resolution chưa hoàn toàn
  reproducible.
- Các file lớn cần tách sau hardening: `TeamMatchDetailView.swift` 1,613 dòng,
  `QuickTableDetailView.swift` 1,237 dòng, `TeamMatchRepository.swift` 1,209 dòng.

Đã đóng sau Task 4 ngày 2026-07-22: shared `ImagePipeline` cho toàn bộ năm
PhotosPicker upload; `ArticleWebView` static/sandboxed với CSP và navigation
policy; các mutation user-triggered trong messages, notifications, club, match,
forum và live bracket scoring không còn nuốt lỗi.

## Nhật ký thực thi

Ghi mỗi lần hoàn tất hoặc bị chặn theo mẫu; không xoá lịch sử:

```text
YYYY-MM-DD — Task N — completed|partial|blocked
- Files/migrations:
- Tests/verification:
- Quyết định quan trọng:
- Việc còn lại:
```

2026-07-21 — Task 1 — completed
- Files/migrations: thêm `apple/ThePickleHub/App/PrivacyInfo.xcprivacy`; không
  cần sửa `project.yml` vì source tree hiện có khiến XcodeGen tự đưa manifest
  vào Resources. Workflow được giữ ở `actions/checkout@v7` vì v7.0.1 đã là
  release chính thức ngày 2026-07-20 và toàn repo dùng major tag cho actions.
- Tests/verification: `plutil -lint` pass trên source, Debug app và Release
  archive; manifest trong cả hai app bundle khớp source; `xcodegen generate`
  xác nhận `PrivacyInfo.xcprivacy in Resources`; full suite pass 90/90; unsigned
  device archive tại `/tmp/ThePickleHub-Task1-Privacy.xcarchive` thành công.
- Quyết định quan trọng: khai báo `CA92.1` cho `UserDefaults` chỉ nằm trong app;
  `NSPrivacyTracking=false`; collected-data dựa trên các write path thực tế của
  native app tới Supabase. Dữ liệu/required reasons của Google Sign-In và các
  dependency được giữ trong manifest riêng của từng SDK, không khai báo trùng.
- Việc còn lại: trước lần submit kế tiếp, product/legal phải đối chiếu privacy
  manifest với App Store Connect privacy answers và privacy policy công khai;
  signed App Store validation/upload không chạy trong task này. Không còn việc
  code-level nào của Task 1.

2026-07-21 — Task 2 — completed
- Files/migrations: cập nhật `apple/ThePickleHub/Core/Auth/SessionStore.swift`
  với reducer độc lập SDK, identity ổn định và một auth listener dài hạn;
  bật `emitLocalSessionAsInitialSession` trong
  `apple/ThePickleHub/Core/Supabase/SupabaseManager.swift`; thêm
  `apple/Tests/SessionStoreTests.swift`. Không có migration/backend change.
- Tests/verification: targeted `SessionStoreTests` pass 6/6; full suite pass
  96/96 (89 Swift Testing + 7 XCTest); build với
  `SWIFT_STRICT_CONCURRENCY=complete` pass và không phát sinh warning tại
  `SessionStore` hoặc test mới.
- Quyết định quan trọng: `SessionStore` được cô lập bằng `@MainActor`;
  bootstrap dùng local Keychain identity làm fallback tức thời để launch
  offline không kẹt `.unknown`, rồi để stream Supabase cập nhật/huỷ session.
  Các event có session nhưng thiếu identity, `.signedOut` và `.userDeleted`
  đều invalidate UI state; external Google auth được dọn khi chuyển sang
  signed-out. Listener chỉ khởi tạo một lần và bị cancel trong `deinit`.
- Việc còn lại: không còn việc code-level của Task 2; kiểm thử thủ công revoke
  session trên thiết bị thật có thể được thêm vào release smoke checklist.

2026-07-21 — Task 3 — completed
- Files/migrations: thêm pure planner
  `apple/ThePickleHub/Core/DoublesElim/DoublesElimBracketPlanner.swift`; cập nhật
  `DoublesElimRepository.swift`, `DoublesElimModels.swift`,
  `CreateDoublesElimView.swift` và nhãn trong `ToolsView.swift`; thêm
  `apple/Tests/DoublesElimBracketPlannerTests.swift`. Không có migration ở Task 3.
- Tests/verification: regression suite ban đầu đỏ vì planner/guard chưa tồn tại;
  targeted property/invariant tests pass 7/7 sau patch; kiểm tra mọi `n` từ
  2...128, các case 2/3/4/5/6/7/8/9 và biên 16/32/64/128, source integrity,
  loser coverage và invariant mọi đội kết thúc ở playoff hoặc eliminated. Full
  suite pass 103/103 (96 Swift Testing + 7 XCTest); strict-concurrency build
  pass, chỉ còn warning baseline đã ghi nhận ngoài phạm vi Task 3.
- Quyết định quan trọng: web hiện hành và DB constraint đều yêu cầu tối thiểu
  40 đội, nên luồng tạo mới native enforce 40...128 và bắt declared count khớp
  chính xác roster; planner vẫn chứng minh được 2...128 để hỗ trợ legacy và edge
  cases. R1/R2 BYE là node explicit; R1 BYE hoàn tất lúc insert, R2 BYE tự hoàn
  tất khi loser source resolve. R3 rỗng là hợp lệ khi candidate pool đã là lũy
  thừa của 2. Playoff không còn floor/truncate active roster; count sai invariant
  sẽ fail closed thay vì làm mất đội.
- Việc còn lại: transaction giữa close-registration/status và match insert vẫn
  thuộc Task 4 như kế hoạch. Web vẫn có client-side generator cũ; Task 4 nên
  centralize close + bracket creation trong RPC để hai client dùng cùng một
  mutation atomic và không lệch logic BYE.

2026-07-21 — Task 4 — partial (minimum scope completed)
- Files/migrations: thêm ba migration forward-only
  `20260722010000_atomic_flex_score.sql`,
  `20260722020000_atomic_doubles_registration_close.sql` và
  `20260722030000_atomic_bracket_score_correction.sql`; thêm pgTAP
  `supabase/tests/atomic_tournament_mutations.test.sql`. Flex, Doubles
  Elimination và QuickTable có `score_version`; close registration DE có
  `generation_key`/unique partial index và tạo seed + bracket trong cùng RPC.
  Cập nhật generated Supabase types và các caller score Flex/QuickTable cùng
  caller close-registration trên web. Native thêm typed RPC envelope/error,
  chuyển ba repository sang RPC atomic, giữ màn giải đã load khi lỗi và hiển
  thị alert có thể hành động; thêm
  `apple/Tests/TournamentMutationErrorTests.swift`.
- Tests/verification: local migration replay từ đầu bằng `supabase db reset`
  pass; targeted pgTAP mới pass 51/51 và full pgTAP pass 157/157. Web production
  build pass; Vitest pass 1,133, skip 10. XcodeGen + targeted native tests pass
  4/4; full native suite pass 107/107 (100 Swift Testing + 7 XCTest); simulator
  build thường pass. `db push --dry-run` xác nhận chỉ ba migration mới đang chờ
  và không ghi production; strict drift fail đúng vì ba migration chưa có trong
  production ledger. Strict-concurrency build riêng bị chặn ở dependency bên
  thứ ba trên Xcode 26.2 (`GTMAppAuth` không resolve `AppAuth`/
  `GTMSessionFetcher`, `swift-crypto` không resolve module C), trước khi compile
  app target; không có lỗi source app trong build thường. Optional legacy
  `scripts/qa/db-race.mjs` không chạy được vì máy không có executable `psql`.
- Quyết định quan trọng: mỗi mutation lấy lock theo tournament/table/group,
  đọc lại state DB và dùng optimistic concurrency thay vì snapshot client.
  Correction chỉ thay participant ở dependency chưa thi đấu; nếu downstream đã
  bắt đầu thì fail closed bằng `DOWNSTREAM_LOCKED`, không xoá kết quả đã chơi.
  Close-registration DE idempotent sau retry, không chuyển `ongoing` trước khi
  toàn bộ graph R1/R2/R3 hợp lệ. Không deploy production trong phiên này.
- Việc còn lại: chuyển mọi completion/correction path DE còn ghi trực tiếp trên
  web (`useDoublesElimination`, `DoublesEliminationBracket`,
  `DoublesEliminationScoring`) sang RPC và tách live-score draft khỏi committed
  result; đưa DE manual-create, R3 assignment và playoff generation vào mutation
  server. Sau đó xử lý Flex group/count mutations, QuickTable `setupRoster` +
  playoff generation, TeamMatch ensure-games và các lifecycle mutation còn lại.
  Chạy lại strict-concurrency khi dependency/Xcode module-resolution được sửa,
  rồi xin phê duyệt riêng trước khi apply ba migration production. Vì các mục
  này còn mở, không tuyên bố toàn bộ Task 4 hoàn tất.

2026-07-22 — Task 4 — partial (priority mutations completed locally)
- Files/migrations: mở rộng Task 4 thành tám migration forward-only từ
  `20260722010000_atomic_flex_score.sql` đến
  `20260722080000_atomic_team_match_scoring.sql`. Ngoài ba migration đầu, đã
  thêm atomic DE lifecycle/create, Flex create/count/standings config,
  QuickTable roster setup/playoff creation và Team Match ensure-games + batch
  scoring/aggregate/playoff propagation. Thêm năm pgTAP suite chuyên biệt:
  `doubles_elimination_create_atomic`, `doubles_elimination_lifecycle_atomic`,
  `flex_management_atomic`, `quick_table_lifecycle_atomic` và
  `team_match_scoring_atomic`. Web và native đã chuyển các caller tương ứng sang
  RPC; Team Match thêm `score_version`, batch score và loại bỏ chuỗi client
  game → match aggregate → next match → third-place → ensure-games.
- Tests/verification: migration replay sạch bằng `supabase db reset`; full pgTAP
  pass 326/326; ESLint các file web liên quan và `tsc --noEmit` pass; Vitest pass
  1.133, skip 10; production web build pass. `xcodegen generate` và full native
  suite pass 107/107 (100 Swift Testing + 7 XCTest). `git diff --check` pass.
  `supabase db push --dry-run` **không chạy được tới bước so sánh remote** vì môi
  trường không có `SUPABASE_ACCESS_TOKEN`; không ghi production.
- Quyết định quan trọng: server là nguồn duy nhất tính winner/aggregate và xếp
  participant downstream; score commit dùng optimistic version. Correction chỉ
  được thay winner/loser khi final/third-place phụ thuộc chưa có status, lineup,
  score hoặc live activity; nếu đã bắt đầu trả `DOWNSTREAM_LOCKED` và rollback
  toàn bộ. Team Match lấy tournament lock để hai semifinal không tranh cùng slot,
  còn game seeding dùng unique `(match_id, order_index)` và retry idempotent.
- Việc còn lại: Team Match organizer lifecycle diện rộng vẫn có các chuỗi REST
  nhiều bước ở create (quota RPC rồi template/options update), round-robin/group/
  single-elimination generation, reset và delete; cần thiết kế RPC riêng trước
  khi có thể đánh dấu Task 4 hoàn tất tuyệt đối. Tám migration hiện chỉ local;
  phải chạy remote dry-run/drift với credential hợp lệ và xin phê duyệt riêng
  trước khi deploy production. Helper web legacy `teamMatchAdvancement.ts` không
  còn caller production nhưng được giữ tạm cùng regression tests cho tới khi
  generator Team Match được transaction hoá.

2026-07-22 — Task 4 — local implementation complete (production pending)
- Files/migrations: thêm `20260722090000_atomic_team_match_create.sql` và
  `20260722100000_atomic_team_match_lifecycle.sql`. RPC mới transaction hoá
  quota + toàn bộ metadata + templates khi tạo giải; round-robin phẳng/chia
  bảng; main + repechage bracket; single-elimination + trận hạng ba; start cả
  vòng; reset schedule/group stage. Delete tournament vẫn là một câu `DELETE`
  có FK cascade trong cùng transaction nên không cần bọc thêm RPC.
- Callers: web và native cùng dùng các RPC mới. Client chỉ còn tính lựa chọn
  ghép cặp/seed rồi gửi một plan; database lock tournament, validate toàn bộ
  plan, tạo node/link/game và cập nhật lifecycle trong một transaction. Main +
  repechage được gửi chung khi đủ seed; recovery thêm repechage muộn cũng kiểm
  tra không trùng đội với main. Helper production chết
  `teamMatchAdvancement.ts` và test riêng của helper đã được xoá sau khi không
  còn caller.
- Tests/verification: fresh `supabase db reset` pass; full pgTAP pass 398/398
  (suite Team Match lifecycle 72/72); TypeScript `tsc --noEmit`, ESLint các
  caller, Vitest 1.119 pass + 10 skip, production web build và `git diff
  --check` đều pass. `xcodegen generate` + full iOS pass 107/107.
- Rollout preflight: sau khi người dùng cung cấp credential local,
  `DRIFT_STRICT=1` xác nhận local có 302 migration, production ledger có 292 và
  chênh lệch đúng 10 migration Task 4 `20260722010000`…`20260722100000`; không
  có migration production lạ thiếu file local. `supabase db push --dry-run`
  kết nối production thành công và liệt kê đúng 10 file sẽ apply. Không deploy
  production; việc còn lại duy nhất là xin phê duyệt rõ trước khi chạy push thật.

2026-07-22 — Task 4 — production database rollout complete
- Sau phê duyệt rõ của người dùng, chạy `supabase db push --yes` và apply đúng
  10 migration `20260722010000`…`20260722100000` lên project production đã
  linked. CLI hoàn tất không lỗi; các NOTICE trigger cũ không tồn tại trong
  migration DE là nhánh idempotent có chủ đích, không làm rollout thất bại.
- Hậu kiểm độc lập: `DRIFT_STRICT=1` báo local 302 / production 302 và in-sync;
  `supabase db push --dry-run` báo remote up to date. Query Management API xác
  nhận 19/19 RPC public thuộc Task 4 tồn tại, cả 19 cho `authenticated` execute
  và cả 19 đã revoke `anon`.
- Phạm vi rollout này chỉ là database migrations theo phê duyệt. Không commit,
  push branch, deploy web hay phát hành iOS; caller mới vẫn cần đi qua quy trình
  source-control/release bình thường.

2026-07-22 — Native release gate + post-Task-4 hardening — local gate completed
- Files: thêm shared `Core/Images/ImagePipeline.swift` và typed upload payload;
  chuyển avatar, club logo và forum images sang downscale/re-encode có giới hạn,
  MIME/extension nhất quán, strip metadata và propagate upload error. Harden
  `ArticleWebView` bằng JavaScript-off, non-persistent store, CSP, HTTPS policy,
  system external links và document-state chống reload mất scroll. Thêm
  `UserFacingError` và đưa các mutation user-triggered còn lại sang do/catch với
  rollback/success-only state và lỗi có ngữ cảnh.
- Tests/verification: targeted hardening tests pass 9/9; full native suite pass
  116/116; strict-concurrency simulator build pass và `WKNavigationDelegate`
  async policy khớp protocol; web Vitest pass 1.122 + 10 skip, `tsc --noEmit`,
  ESLint caller thay đổi và production build đều pass. Unsigned Release archive
  và Development-signed Release archive đều thành công; privacy manifest trong
  archive lint pass và khớp source. `git diff --check` pass.
- Release gate local: archive ký bằng Apple Development, Team `5S49Q7AB7M`,
  bundle `net.thepicklehub.app.dev`, version `0.1.0 (1)`. Đây không phải artifact
  App Store Distribution và chưa upload/validate App Store Connect.
- External gates còn lại: máy không có Apple Distribution certificate hay App
  Store Connect API key; production bundle/version chưa được cấu hình trong
  project; hai iPhone vật lý đang offline nên chưa chạy device smoke. Product/
  legal vẫn phải reconcile privacy answers/policy; Supabase PAT từng được đưa
  qua chat phải được rotate ngoài repo. Không deploy web hoặc phát hành iOS trong
  lần gate này.
