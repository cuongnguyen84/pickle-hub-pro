<!-- Hallmark · pre-emit critique: P4 H4 E4 S5 R4 V3. Self-review of report presentation, not project scores. -->
# Đánh giá dự án ThePickleHub — 09/09/2026

Snapshot: nhánh `feat/shop-production-phase-1`, HEAD `bd0e6a2c`, bao gồm các thay đổi chưa commit có sẵn trong workspace. Điểm phản ánh snapshot này, không mặc định là bản đang chạy production.

Dự án có nền tảng sản phẩm và vận hành khá đầy đủ, nhưng snapshot hiện tại chưa vượt các điều kiện phát hành của chính repo. Rủi ro lớn nhất nằm ở quyền ghi dữ liệu, khôi phục đăng ký và độ tin cậy của deployment/test. UI có bản sắc rõ hơn mức độ hoàn thiện của một số luồng nghiệp vụ phía sau.

## Phạm vi và phương pháp

- Ba agent chuyên trách: database/RLS/security; backend/Edge Functions/workers; CI/CD/QA/operations/native. Agent chính kiểm tra frontend/UI/UX/hiệu năng, thực thi kiểm tra và đối chiếu các phát hiện liên lớp.
- Agent backend chạm giới hạn sử dụng trước khi gửi báo cáo cuối. Các phát hiện đã gửi được agent chính đọc code đối chiếu và tổng hợp; không coi phần chưa gửi là đã đánh giá xong.
- Kiểm kê 339 migration, 81 Edge Function entrypoint, 22 file SQL test, 17 workflow và 40 file Swift test. Bao phủ các lớp chính, truy vết sâu các luồng có rủi ro; không khẳng định đã kiểm tra từng dòng của mọi module.
- Graphify được dùng để định hướng quan hệ mã nguồn; truy vấn rộng trả 2.184 node và bị giới hạn đầu ra. Kết luận bên dưới dựa trên source hiện tại, không dựa riêng vào graph hay các báo cáo cũ.
- Hallmark hỗ trợ nhận xét cấu trúc/typography; Front-End Checklist hỗ trợ kiểm tra accessibility và trạng thái. MCP checklist không có trong phiên, nên dùng code, Chrome và axe trực tiếp. Nhận xét về thẩm mỹ được tách khỏi lỗi chức năng.
- Chỉ kiểm tra cục bộ, đọc source và đọc dữ liệu công khai khi render. Browser harness chặn POST/PUT/PATCH/DELETE và analytics, dùng session khách mới. Không đăng nhập, sửa DB, gửi thông báo, đăng bài hay deploy.
- Thang điểm: 0–3 thiếu nền tảng; 4–5 còn rủi ro lớn; 6–7 có thể sử dụng nhưng còn nợ đáng kể; 8–9 chặt chẽ và có bằng chứng vận hành; 10 đòi hỏi kiểm chứng rất cao. Điểm là đánh giá chuyên môn, không phải chỉ số đo tự động hay chứng nhận security.
- Không lấy trung bình đơn giản: backend, database và security có phần rủi ro giao nhau. Các điều kiện chặn release có ý nghĩa hơn một điểm tổng hợp đẹp.

## Bảng điểm theo component

| Component | Điểm /10 | Điểm mạnh | Điều kéo điểm xuống |
|---|---:|---|---|
| UI / visual design | 7.5 | The Line có bản sắc, bố cục editorial bất đối xứng, ảnh và typography rõ | Header mất nút menu ở 320px; kiểu chữ/token còn phân tán |
| UX / hành trình sử dụng | 6.0 | Có trạng thái tải/lỗi, deep-link fallback, luồng đăng ký và khôi phục | Điều hướng mất locale; lỗi tìm kiếm bị báo thành không có kết quả; bulk import phục hồi chưa tốt |
| Accessibility / i18n | 5.5 | Radix, label/autocomplete, skip link, kiểm tra contrast và reduced motion | Chặn zoom; upload không dùng được bằng bàn phím; native i18n gate đỏ |
| Frontend React / TypeScript | 6.0 | Lazy routes, React Query, shared components, xóa cache khi sign-out | Typecheck đang lỗi; page/hook lớn; xử lý lỗi và giao dịch nhiều bước không đồng đều |
| Performance / PWA | 7.0 | Initial JS trong budget, chia chunk, font tự host, precache có chọn lọc | Tổng gzip JS vượt budget CI; chưa đo RUM/Core Web Vitals hiện tại |
| Backend / nghiệp vụ | 5.5 | Shared auth, atomic RPC cho capacity/scoring, nhiều kiểm thử | Khôi phục đăng ký vượt xác minh chủ sở hữu; OTP/secret chưa atomic xuyên suốt |
| Edge Functions / Workers | 5.5 | Có cron auth, health tracking, retry/claim, deploy repair | OTP attempts không atomic; rủi ro đăng bài lặp; watchdog có đường trigger công khai |
| Supabase / database | 5.9 | RLS, pgTAP, transaction locks, migration checks và restore drill | Thiếu migration tạo products; một số policy bảo vệ hàng nhưng bỏ sót cột nghiệp vụ |
| Security / phân quyền | 4.0 | MFA admin, column grants PII, token private, auth helper | Vượt ranh giới tổ chức, tự xác minh trận, chuyển participant, sửa/xóa ảnh người khác |
| Dependencies / supply chain | 4.5 | Lockfile, Dependabot, CodeQL | Audit còn high; xlsx đọc file người dùng; dependency gate chỉ cảnh báo |
| CI/CD | 6.0 | Có nhiều gate và deployment drift/repair | Deploy chạy độc lập quality; bỏ config-only change; preview có thể fallback production |
| Automated QA | 6.0 | 1.497 test đạt, SQL/race tests, visual và journey suites | Có test lỗi; nhiều suite đã viết chưa được CI gọi; coverage có phạm vi hẹp |
| Observability / operations | 6.5 | Error collector, SLO, cảnh báo, tài liệu restore drill | Cooldown watchdog chặn repair đa region trong tình huống đã tái hiện |
| Native iOS / SwiftUI | 7.0 | Swift 6, Keychain/session structure, tests, release preflight | i18n duplicates gate lỗi; chưa chạy simulator/archive trong đợt audit |
| Capacitor / Android | 4.0 | Có source config và hướng dẫn build | Config native lưu trong repo bị lệch; Android/build pipeline chưa đầy đủ; có thể là target legacy |
| SEO kỹ thuật | 7.0 | Bot renderer, canonical/hreflang, noindex cho route riêng tư | Title bị lặp brand; SPA/bot là hai implementation cần giữ parity; chưa kiểm tra index thực tế |
| Kiến trúc / bảo trì / tài liệu | 6.5 | Phân lớp khá rõ, tài liệu kiến trúc và runbook nhiều | Một số file 1.000–1.700 dòng, nhiều client/theme; schema bootstrap thiếu làm giảm khả năng tái lập |

UI/UX là đánh giá heuristic trên source và 5 trang công khai được render, không phải nghiên cứu usability với người dùng. Điểm native không đại diện cho chất lượng binary đang phát hành.

## Kết quả kiểm tra thực thi

| Kiểm tra | Kết quả | Ý nghĩa và giới hạn |
|---|---|---|
| `npm test -- --reporter=dot` | 137 file: 136 đạt, 1 lỗi; 1.497 test đạt, 1 lỗi, 10 skip | Lỗi export `isFacebookPostingWindow`; không thể gọi suite hiện tại là xanh |
| `npx tsc --noEmit -p tsconfig.app.json` | Lỗi | Thiếu `ShopProductRow`, kiểu `ProductInsert[]` không phù hợp, test import export không tồn tại |
| `npm run lint` | 1 error, 82 warnings | Error `UUID_RE` không sử dụng; tổng warnings có cả `.codex/worktrees` cục bộ, không coi 82 là số warning của clean CI |
| Vite production build | Đạt, khoảng 6,48 giây | Output tại `/tmp/picklehub-audit-20260909-build`; Vite build không thay thế typecheck |
| Bundle dùng helper của repo | Initial 226,2 KiB / 280; code 1.694,2 / 1.800; tổng 2.078,1 / 1.970 | Tổng vượt khoảng 108,1 KiB; đo gzip tĩnh, không phải LCP thực tế |
| Kiểm tra migration trùng | 339 migration, không trùng version/content | Không chứng minh replay thành công |
| `npm audit --omit=dev --json` | 8 package findings: 4 high, 4 moderate | Số package npm báo, không phải 8 exploit đã chứng minh |
| `npm audit --json` | 20 package findings: 9 high, 11 moderate | Gồm dev dependencies; không có critical trong kết quả audit này |
| Native i18n duplicates | Lỗi, 30 chuỗi ngoài allowlist | Gate CI hiện tại sẽ dừng trước native tests |
| Native format specifiers | Đạt, 1.996 catalog entries | Không chứng minh mọi literal đã dịch |
| Native coverage diagnostic | 354 literal VI chưa vào catalog | Chỉ báo cần phân loại; mặc định không chặn vì ngưỡng Infinity |
| Native plist / script syntax | 3 plist và bash syntax đạt | Chưa chạy Xcode build/simulator/archive |
| Watchdog mock offline | 50 probes; phát hiện region hỏng; 0 repair dispatch | Tái hiện lỗi cooldown khi workflow schedule chạy trước đó 5 phút |
| Browser 5 route × 5 viewport | 25 lượt tải, không có uncaught page error, không có document overflow | Viewport 320/375/414/768/1440; kiểm tra sâu vẫn phát hiện menu bị cắt do overflow bị che |
| axe trên 5 route ở 375px | Cả 5 có rule `meta-viewport` | Không có vi phạm khác trong tập rule WCAG A/AA đã chạy ở trạng thái đã render; không phải chứng nhận accessibility |
| Điều hướng VI → Live | Tái hiện `/vi`, `lang=vi` → `/live`, `lang=en` | Lỗi locale thực tế |
| Giả lập search API 503 | UI hiển thị “Tìm thấy 0 kết quả”, “Thử từ khóa khác” | Lỗi phân biệt failure và empty state đã tái hiện |

Browser routes: `/vi`, `/vi/social`, `/vi/san`, `/vi/rankings`, `/login`. Chặn request ghi cũng chặn RPC dùng POST dù RPC có thể chỉ đọc; vì vậy không dùng tình trạng thiếu dữ liệu của các trang đó để kết luận backend hỏng. Chromium đi qua Chrome cài sẵn vì Playwright browser bundle chưa có. Không giả định kiểm tra viewport tương đương kiểm thử thiết bị thật.

## Phát hiện ưu tiên cao

P1 = cần xử lý trước khi mở rộng/phát hành các luồng liên quan. P2 = nên lên kế hoạch sửa sớm. Đây là ưu tiên kỹ thuật của audit, không phải CVSS. Các phát hiện DB là kết luận từ migration/policy trong repo; cần đối chiếu trạng thái triển khai trước khi kết luận production bị ảnh hưởng.

### S1 · P1 · CAPTCHA bị dùng như bằng chứng sở hữu đăng ký

Khi không gửi được link qua Zalo/email, `request-recovery-link` nhận số điện thoại và CAPTCHA hợp lệ rồi trả trực tiếp `magic_token`. CAPTCHA không chứng minh người gọi sở hữu số điện thoại. Token đó là quyền quản lý/hủy đăng ký của người khác, nếu đăng ký còn hợp lệ và đủ điều kiện hủy.

Bằng chứng: [nhánh trả token](/Users/cm10/pickle-hub-pro/supabase/functions/request-recovery-link/index.ts:293), [resolve token ở cancel-registration](/Users/cm10/pickle-hub-pro/supabase/functions/cancel-registration/index.ts:77), [cập nhật hủy](/Users/cm10/pickle-hub-pro/supabase/functions/cancel-registration/index.ts:140). Agent backend đã báo tái hiện handler bằng mock hoàn toàn cục bộ; agent chính xác nhận đường source. Không thử với đăng ký thật.

Sửa: yêu cầu OTP hoặc danh tính đã xác minh có quyền sở hữu; khi mất kênh gửi thì chuyển sang hỗ trợ, không trả capability token chỉ vì CAPTCHA đạt. Thêm negative test “biết số điện thoại + giải CAPTCHA nhưng không có quyền sở hữu”.

### S2 · P1 · Creator có thể tự gán tổ chức khác

Policy UPDATE profile chỉ giữ `id = auth.uid()`, không bảo vệ `organization_id`. Helper quyền mới nhất dùng chính cột này kết hợp role creator để cho quản trị tổ chức. Người đã có role creator có đường vượt ranh giới tổ chức bằng việc sửa profile của mình. Cùng lớp quyền ghi rộng còn cho phép sửa những trường cần do hệ thống xác minh như rating/verification nếu không có ACL triển khai bổ sung.

Bằng chứng: [profile UPDATE policy](/Users/cm10/pickle-hub-pro/supabase/migrations/20251221153808_1fd33e01-b473-4bd8-a664-cb09ce5b5f0b.sql:251), [user_can_admin_organization](/Users/cm10/pickle-hub-pro/supabase/migrations/20260730100000_admin_aal2_sweep.sql:86), [consumer quyền Storage](/Users/cm10/pickle-hub-pro/supabase/migrations/20260428000001_fix_videos_storage_admin_bypass.sql:65).

Sửa: allowlist cột self-service; cập nhật tổ chức/rating/verified qua RPC có kiểm tra vai trò. Audit đã tìm trigger liên quan trên toàn cây migration, chưa có UPDATE guard cho các cột này. Row-level security không tự tạo column-level security; hướng dẫn chính thức giải thích cần quản lý quyền theo cột riêng. [Supabase column privileges](https://supabase.com/docs/guides/database/postgres/column-level-security).

### S3 · P1 · Tự đặt trận ở trạng thái đã xác minh

Recorder được INSERT/UPDATE toàn hàng `matches`, bao gồm trạng thái xác minh. Edge submit tin `verification_status='verified'` hoặc `confirmation_status='confirmed'` để cho participant submit. Đường ghi trực tiếp bỏ qua luồng đối thủ xác nhận. Tác động chắc chắn ở độ tin cậy dữ liệu nội bộ; tác động DUPR còn phụ thuộc integration và điều kiện bên ngoài.

Bằng chứng: [matches policy và grants](/Users/cm10/pickle-hub-pro/supabase/migrations/20260503131017_bet1_social_layer.sql:161), [Edge kiểm tra trạng thái](/Users/cm10/pickle-hub-pro/supabase/functions/dupr-match-submit/index.ts:250). Không thấy UPDATE trigger bảo vệ trạng thái trong migration tree.

Sửa: khóa direct write vào trạng thái xác minh, chuyển trạng thái qua transaction/RPC kiểm tra đủ xác nhận; invalidation khi điểm hoặc thành viên thay đổi.

### S4 · P1 · Participant tự chuyển sang trận khác

Policy `match_participants_self_confirm` chỉ giữ `player_id`, không giữ bất biến `match_id`, `team`, `position`. Người đã có một hàng tham gia có thể chuyển nó sang trận khác rồi được xem là participant. Edge kiểm tra participant dùng cho nhánh create/update/delete của trận đã xác minh.

Bằng chứng: [participant UPDATE](/Users/cm10/pickle-hub-pro/supabase/migrations/20260503131017_bet1_social_layer.sql:201), [authorization và dispatch](/Users/cm10/pickle-hub-pro/supabase/functions/dupr-match-submit/index.ts:255).

Sửa: self-confirm chỉ được sửa các cột xác nhận của mình; kiểm tra riêng quyền create/update/delete ở Edge. Đây là lỗi khác với S3: S3 sửa trạng thái trận, S4 sửa tư cách thành viên.

### S5 · P1 · Tài khoản bất kỳ có quyền sửa/xóa ảnh blog

UPDATE/DELETE của bucket `og-images` chỉ kiểm tra bucket, không kiểm tra owner hoặc admin. Uploader còn dùng tên theo slug và `upsert:true`, nên tên object có thể đoán được từ bài viết.

Bằng chứng: [Storage policies](/Users/cm10/pickle-hub-pro/supabase/migrations/20260415000001_create_og_images_bucket.sql:34), [đặt path và upload](/Users/cm10/pickle-hub-pro/src/hooks/useOgImageUpload.ts:35). Không tìm thấy migration sau thay hai policy này.

Sửa: giới hạn editor/admin hoặc chủ sở hữu được phép; thêm test người B không overwrite/delete ảnh người A.

### DB1 · P1 · Migration không đủ để dựng database từ đầu

Migration bulk import ALTER `public.products`, viện dẫn migration `20260811120000` không có trong cây hiện tại. Không có CREATE TABLE products trong 339 migration. Một DB dựng chỉ từ repo sẽ thiếu relation tại bước này; duplicate checker vẫn đạt vì không kiểm tra dependency schema.

Bằng chứng: [ALTER products và comment dependency](/Users/cm10/pickle-hub-pro/supabase/migrations/20260824120000_shop_products_bulk_import.sql:4). Đây là suy luận dependency tĩnh chắc chắn theo migration tree, chưa có kết quả replay thực thi do Docker daemon không hoạt động.

Sửa: khôi phục migration bootstrap thực tế cùng RLS/grants/constraint cần thiết, rồi chạy replay sạch và pgTAP; không che lỗi bằng việc bỏ qua ALTER khi bảng vắng mặt.

### CI1 · P1 · Deploy không chờ quality; bỏ sót config-only change

Edge deploy chạy trực tiếp khi push main, độc lập workflow quality. Không có quan hệ chờ quality thành công trong workflow. Branch protection ngoài GitHub chưa được kiểm tra nên không kết luận mọi merge đều vượt gate. Diff để xác định function chỉ xét `supabase/functions/**`; thay đổi riêng `supabase/config.toml` không được đưa vào danh sách deploy.

Bằng chứng: [trigger](/Users/cm10/pickle-hub-pro/.github/workflows/deploy-guard.yml:17), [diff](/Users/cm10/pickle-hub-pro/.github/workflows/deploy-guard.yml:58), [deploy](/Users/cm10/pickle-hub-pro/.github/workflows/deploy-guard.yml:94).

Sửa: deploy đúng commit/artifact đã vượt required checks; kiểm tra branch protection; đưa config thay đổi vào deployment detection và xác minh auth parity sau deploy.

### QA1 · P1 · Có E2E test nhưng CI chưa chạy các suite quan trọng

Workflow gọi `e2e:smoke`, script chọn đúng bốn project. Auth, journeys, a11y, contract, mobile-webkit có trong config nhưng không tìm được workflow gọi tương ứng. Install WebKit không đồng nghĩa thực thi WebKit tests.

Bằng chứng: [lệnh trong workflow](/Users/cm10/pickle-hub-pro/.github/workflows/playwright.yml:143), [script chọn project](/Users/cm10/pickle-hub-pro/package.json:18), [project definitions](/Users/cm10/pickle-hub-pro/playwright.config.ts:63).

Sửa: ánh xạ từng journey rủi ro với một CI job thực thi thực sự, dữ liệu seed và môi trường test phù hợp; report skipped tests như một giới hạn, không như pass.

### OPS1 · P1 · Watchdog đa region có thể bị cooldown chặn liên tục

Watchdog lấy workflow run gần nhất, bất kể đó là schedule hay repair, rồi cooldown 30 phút. Workflow uptime lại chạy mỗi 10 phút. Khi schedule đều, repair từ probe region khác có thể luôn bị chặn. Probe trong workflow không chỉ định `x-region`, nên không chứng minh region hỏng đã được kiểm tra/sửa.

Bằng chứng: [cooldown](/Users/cm10/pickle-hub-pro/workers/edge-blob-watchdog/src/index.ts:117), [schedule 10 phút](/Users/cm10/pickle-hub-pro/.github/workflows/uptime-ping.yml:21). Agent QA tái hiện offline: 50 probes, phát hiện `phone-otp-send@ap-southeast-1` hỏng, workflow schedule trước đó 5 phút, 0 dispatch.

Sửa: cooldown theo repair thực sự hoặc trạng thái sửa chữa có scope region; re-probe đúng region sau repair. Thêm test schedule gần đây không ngăn repair một region hỏng.

### DEP1 · P1 · xlsx có advisory và nằm trên đường nhập file

Repo dùng `xlsx@0.18.5`; `XLSX.read` đọc file người dùng trước khi giới hạn số dòng. Dependency này thuộc phạm vi bị ảnh hưởng bởi prototype pollution và ReDoS theo advisory của nhà cung cấp. Không chạy file khai thác trong audit.

Bằng chứng ứng dụng: [đọc spreadsheet](/Users/cm10/pickle-hub-pro/src/hooks/shop/useBulkProductImport.ts:84), [dependency lock](/Users/cm10/pickle-hub-pro/package-lock.json:14034). Nguồn nhà cung cấp: [CVE-2023-30533](https://cdn.sheetjs.com/advisories/CVE-2023-30533), [CVE-2024-22363](https://cdn.sheetjs.com/advisories/CVE-2024-22363).

`npm audit` hiện chỉ advisory vì `continue-on-error` và `|| true`: [security workflow](/Users/cm10/pickle-hub-pro/.github/workflows/security.yml:37). Sửa dependency bằng nguồn/bản được duy trì hoặc thư viện thay thế, giới hạn file trước parse, cô lập parsing khỏi UI thread, và thêm gate dependency có ngoại lệ được giải thích. Không giả định `npm audit fix` đủ để xử lý package này.

## Các lỗi backend, quyền riêng tư và frontend cần sửa tiếp

| ID / mức | Vấn đề có bằng chứng | Tác động / hướng sửa |
|---|---|---|
| BE1 · P2 | [OTP attempts read-modify-write](/Users/cm10/pickle-hub-pro/supabase/functions/phone-otp-verify/index.ts:153) và bỏ qua lỗi tăng counter | Request đồng thời có thể ghi đè cùng giá trị, cho nhiều lần đoán hơn giới hạn. Dùng phép tăng/check atomic và fail closed; TTL không thay thế attempt limit. |
| BE2 · P2 | [Ghi registration secret thất bại nhưng vẫn trả thành công](/Users/cm10/pickle-hub-pro/supabase/functions/phone-otp-verify/index.ts:345) | Token trả về không có trong DB; người dùng tưởng đăng ký quản lý được nhưng link vô hiệu. Commit registration+secret cùng transaction hoặc có cơ chế recovery rõ ràng. |
| BE3 · P2 | [Facebook post thành công](/Users/cm10/pickle-hub-pro/workers/social-poster/src/index.ts:367), [lưu log thất bại chỉ console.error](/Users/cm10/pickle-hub-pro/workers/social-poster/src/index.ts:735), pending có thể reclaim | Có cửa sổ đăng bài trùng khi lần post trước thành công nhưng không ghi được trạng thái. Cần lưu/reconcile external ID và trạng thái chưa xác định trước retry. |
| BE4 · P2 | [Watchdog fetch gọi run cho mọi request](/Users/cm10/pickle-hub-pro/workers/edge-blob-watchdog/src/index.ts:50) | Nếu endpoint được expose công khai theo code này, GET có thể tạo nhiều probe và kích hoạt control plane khi phát hiện sự cố. Tách health read-only khỏi repair có auth. Chưa kiểm tra exposure deployment. |
| SEC6 · P2 | [search_players không lọc profile private](/Users/cm10/pickle-hub-pro/supabase/migrations/20260706120000_profiles_pii_column_lockdown.sql:85), khác [lời hứa trong UI](/Users/cm10/pickle-hub-pro/src/components/account/PublicProfileToggle.tsx:87) | Hồ sơ “ẩn” vẫn có thể xuất hiện qua RPC công khai. Áp dụng privacy predicate ở DB/read model, không chỉ lọc ở UI. |
| SEC7 · P2 | [search_players hỗ trợ exact phone và grant anon](/Users/cm10/pickle-hub-pro/supabase/migrations/20260706120000_profiles_pii_column_lockdown.sql:95) | Cho phép kiểm tra số điện thoại đã biết để nhận danh tính; cần quyết định quyền lookup theo phone, auth và rate limit. Không trả trực tiếp phone vẫn chưa loại được oracle này. |
| SEC8 · P2 | [Applicant đọc hàng shop_applications của mình](/Users/cm10/pickle-hub-pro/supabase/migrations/20260811090000_shop_phase1_seller_onboarding.sql:317), [SELECT toàn bảng](/Users/cm10/pickle-hub-pro/supabase/migrations/20260811090000_shop_phase1_seller_onboarding.sql:387) | `internal_note` không được bảo vệ chỉ nhờ bỏ khỏi view. Giới hạn base-table column privileges hoặc tách bảng private. Migration ghi chưa apply production: chưa kết luận đã lộ trên prod. |
| FE1 · P1 gate | [Thiếu ShopProductRow và kiểu insert sai](/Users/cm10/pickle-hub-pro/src/hooks/shop/useBulkProductImport.ts:182), [test import export đã mất](/Users/cm10/pickle-hub-pro/src/lib/__tests__/social-poster-multi-page.test.ts:5), [UUID_RE unused](/Users/cm10/pickle-hub-pro/supabase/functions/product-import-enrich/index.ts:57) | Snapshot không vượt type/lint/test. Sửa và chạy lại gate, không dùng build xanh làm bằng chứng thay thế. |
| FE2 · P2 | [Insert products trước upload ảnh](/Users/cm10/pickle-hub-pro/src/hooks/shop/useBulkProductImport.ts:179); chỉ xóa state sau upload xong | Upload một ảnh thất bại thì rows đã lưu nhưng UI báo batch lỗi; bấm lại insert lại cùng slug có thể xung đột, hoặc tạo trùng nếu schema không chặn. Giữ product ID và retry bước ảnh, báo partial success. Schema products thiếu nên chưa kết luận constraint deployed cụ thể. |
| QA2 · P2 | [Coverage chỉ trên file được test import, loại functions/workers/scripts khỏi coverage](/Users/cm10/pickle-hub-pro/vite.config.ts:389) | Threshold statements 83% không đại diện toàn hệ thống; không có branch/function gate tương đương. Báo rõ coverage theo component và đường nghiệp vụ rủi ro. Không đồng nghĩa các nhóm bị loại coverage hoàn toàn không có tests. |
| CI2 · P2 | [Preview không sẵn sàng thì fallback production](/Users/cm10/pickle-hub-pro/.github/workflows/playwright.yml:75) | PR có thể xanh do kiểm tra bản production cũ. Lighthouse/visual có cơ chế tương tự; gắn preview với commit và fail rõ khi preview không có. |
| PERF1 · P2 | [Strict budget CI 1.970 KiB](/Users/cm10/pickle-hub-pro/.github/workflows/quality.yml:96), build hiện tại 2.078,1 KiB | Initial/code budgets đạt nhưng tổng fail. Xử lý tăng trưởng content/bundle có chủ đích, không chỉ tăng trần để xanh. Vendor video và xlsx là lazy chunks; không gọi tổng bundle là tải ban đầu. |

## UI, UX, accessibility và SEO

| ID / mức | Bằng chứng | Nhận xét và hướng sửa |
|---|---|---|
| UX1 · P2 | [BottomNav luôn dùng item.path](/Users/cm10/pickle-hub-pro/src/components/layout/BottomNav.tsx:133); [VI wrapper reset locale khi unmount](/Users/cm10/pickle-hub-pro/src/components/layout/ViLanguageWrapper.tsx:25) | Đã bấm từ `/vi` sang Live: URL `/live`, html lang `en`. Dùng localized route thống nhất giữa desktop và bottom nav. |
| UX2 · P2 | [Search không nhận error từ query](/Users/cm10/pickle-hub-pro/src/pages/Search.tsx:32), [rỗng là noResults](/Users/cm10/pickle-hub-pro/src/pages/Search.tsx:195) | Đã giả lập API 503: UI báo không có kết quả/thử từ khóa khác. Phân biệt lỗi một nguồn, lỗi toàn bộ và rỗng thật; có retry. |
| UI1 · P2 | [Back + brand + mobile auth](/Users/cm10/pickle-hub-pro/src/components/layout/TheLineLayout.tsx:480), [responsive pills](/Users/cm10/pickle-hub-pro/src/styles/the-line.css:2962), [menu](/Users/cm10/pickle-hub-pro/src/components/layout/TheLineLayout.tsx:841) | Ở `/vi/rankings`, viewport 320px: menu có x=327,375 và right=363,375, nằm hoàn toàn ngoài viewport. Thu gọn auth/header ở màn nhỏ; test bounding box/hit target. Root scrollWidth vẫn 320 do che overflow, nên test scrollWidth đơn thuần bỏ lọt lỗi. |
| A11Y1 · P2 | [viewport meta](/Users/cm10/pickle-hub-pro/index.html:11) | `maximum-scale=1.0,user-scalable=no` bị axe báo trên cả 5 trang. Cho phép zoom để người dùng thị lực kém tăng kích thước nội dung. |
| A11Y2 · P2 | [Bulk import upload là div onClick](/Users/cm10/pickle-hub-pro/src/pages/shop/BulkImport.tsx:115), input `display:none` | Không có button/keyboard handler/focusable input cho vùng chọn file. Dùng button native hoặc label+input có cơ chế focus phù hợp. Phát hiện từ code; chưa vào seller bằng tài khoản thật. |
| I18N1 · P2 | [NAV_ITEMS](/Users/cm10/pickle-hub-pro/src/components/layout/TheLineLayout.tsx:68) | VI navigation còn Tournaments, Bracket Lab, Rankings, Stories và Social. Cần quyết định glossary rõ ràng và nhất quán; không coi mọi từ tiếng Anh là lỗi, nhưng đây là ma sát cho người chỉ đọc VI. |
| SEO1 · P3 | [VenuesList tự nối brand](/Users/cm10/pickle-hub-pro/src/pages/VenuesList.tsx:144), [DynamicMeta nối thêm lần nữa](/Users/cm10/pickle-hub-pro/src/components/seo/DynamicMeta.tsx:32) | Browser title thực tế: “Tìm sân Pickleball | ThePickleHub | ThePickleHub”. Chỉ một lớp chịu trách nhiệm suffix. |

Nhận xét visual: light theme có màu giấy ấm, accent xanh gắn với pickleball, kết hợp serif/sans/mono và trang chủ có card chính lớn + cột phụ. Đây là điểm mạnh thấy trực tiếp trong ảnh desktop/mobile. Bố cục trang chủ không phải mẫu hero + ba feature-card lặp lại. Tuy vậy nhãn bottom nav 9px/uppercase dày tracking khá nhỏ, và nhiều nút nổi làm vùng dưới mobile chật; đây là nhận xét thiết kế, chưa phải lỗi chức năng đã chứng minh.

Đối chiếu Hallmark, chỉ trong mẫu đã xem:

- `major — Italic headers`: [tl-serif mặc định italic](/Users/cm10/pickle-hub-pro/src/styles/the-line.css:126), dùng trong [heading trang chủ](/Users/cm10/pickle-hub-pro/src/pages/Index.tsx:519). Có thể giữ serif nhưng dùng roman, nhấn bằng weight/màu. Đây là quy ước của Hallmark, không phải bằng chứng người dùng không thích thiết kế.
- `major — Mid-render token improvisation`: [font/màu inline trong BottomNav](/Users/cm10/pickle-hub-pro/src/components/layout/BottomNav.tsx:208), nhiều họ font ngoài primitive token. Đưa typography và semantic colors về một nơi để dễ bảo trì.
- `minor — Arbitrary z-index`: [BottomNav dùng z-index 9999](/Users/cm10/pickle-hub-pro/src/components/layout/BottomNav.tsx:102). Chuẩn hóa lớp overlay, drawer, toast, nav.

Hallmark visual sample: 0 critical · 2 major · 1 minor. Không dùng mức “critical” thẩm mỹ như mức độ lỗ hổng bảo mật. Không thực hiện redesign.

## Native và khả năng bảo trì

Native SwiftUI có cấu trúc repository/session, Keychain, Swift 6 và 40 file test. CI cấu hình kiểm thử locale và Release build. Tuy nhiên [duplicates gate](/Users/cm10/pickle-hub-pro/.github/workflows/apple-tests.yml:63) hiện lỗi 30 chuỗi trước bước chạy test. Format specifier gate đạt 1.996 entries nhưng không thay thế coverage dịch thuật; script coverage mặc định cho qua ở ngưỡng Infinity: [native-i18n-gates](/Users/cm10/pickle-hub-pro/scripts/native-i18n-gates.mjs:112).

Capacitor source có `cleartext:false`, `allowMixedContent:false`, nhưng [iOS generated config](/Users/cm10/pickle-hub-pro/ios/App/App/capacitor.config.json:7) còn giá trị true và wildcard Google. [Android security template](/Users/cm10/pickle-hub-pro/android/app/src/main/res/xml/network_security_config.xml.template:12) cũng cho cleartext. Không tìm thấy AndroidManifest/app build.gradle trong Android checkout hoặc workflow build tương ứng. Cần xác định target này còn phát hành hay legacy, rồi kiểm tra generated config/artifact. Không suy luận binary đang trên store có lỗ hổng chỉ từ file này.

Frontend có các page/hook lớn: QuickTableView khoảng 1.700 dòng, AdminDuprDashboard 1.727, RegistrationModal 1.382, TheLineLayout 1.162; stylesheet The Line 4.374 dòng. Số dòng không tự là bug, nhưng làm ownership/state và việc sửa regression khó hơn. Nên tách theo nghiệp vụ ổn định, giữ contract tests tại ranh giới thay vì chia file chỉ để giảm số dòng.

## Những nền tảng tốt cần giữ

- Lazy routes, React Query với retry có giới hạn, prefetch theo route, self-hosted fonts và PWA precache có chọn lọc. [App query configuration](/Users/cm10/pickle-hub-pro/src/App.tsx:250).
- Sign-out xóa React Query và cache nhạy cảm. [Auth lifecycle](/Users/cm10/pickle-hub-pro/src/hooks/useAuth.tsx:36).
- Edge shared auth thực sự xác minh bearer qua Auth API; không kết luận `verify_jwt=false` tự nó là lỗ hổng. [getAuthUser](/Users/cm10/pickle-hub-pro/supabase/functions/_shared/auth.ts:37). Cron helper từ chối khi thiếu secret và sai method.
- RLS/SECURITY DEFINER search_path regression tests, allow/deny auth matrix, pgTAP và race harness. [SQL security tests](/Users/cm10/pickle-hub-pro/supabase/tests/sec05_hardening.test.sql:11), [pgTAP workflow](/Users/cm10/pickle-hub-pro/.github/workflows/pgtap.yml:52).
- Capacity/scoring đã có transaction/advisory lock; nên mở rộng cùng tiêu chuẩn đó cho OTP/registration secret. [Atomic capacity](/Users/cm10/pickle-hub-pro/supabase/migrations/20260716090000_db01_atomic_event_capacity.sql:41).
- CodeQL gate có baseline và logic kiểm tra, không chỉ upload SARIF. [Security workflow](/Users/cm10/pickle-hub-pro/.github/workflows/security.yml:81).
- Có SLO, error collector/dedup và restore drill ghi nhận ngày 22/07 đối chiếu 127 bảng; runbook nêu rõ DB backup không bao gồm Storage object. Đây là bằng chứng tài liệu lịch sử, không phải restore đã chạy lại hôm nay. [Ops runbook](/Users/cm10/pickle-hub-pro/docs/ops-runbook.md:255).
- Có bot renderer và noindex cho token/private routes; vẫn cần đồng bộ với SPA và không dùng noindex như authorization. [Middleware](/Users/cm10/pickle-hub-pro/functions/_middleware.ts:38).

## Thứ tự xử lý đề xuất

1. Chặn các đường vượt quyền S1–S5. Viết regression tests với hai người dùng/hai tổ chức và các direct table writes, không chỉ test UI happy path. Đối chiếu ACL/policy thực tế trước rollout.
2. Khôi phục migration bootstrap products, replay DB sạch, chạy pgTAP/race harness; đưa type/lint/test/native gates hiện tại về xanh.
3. Ràng buộc deploy với checks của đúng commit, sửa detection config, bỏ preview fallback có thể tạo xanh giả; thực thi các suite auth/journey/a11y/WebKit cần thiết.
4. Sửa watchdog cooldown, OTP atomicity, registration+secret transaction và reconcile social-post state; xử lý dependency parser file có advisory.
5. Sửa menu 320px, giữ locale trong bottom nav, error state tìm kiếm, zoom, upload bằng bàn phím; sau đó xử lý thống nhất token/glossary và budget tăng trưởng.

Điều kiện để chấm lại cao hơn: có bằng chứng pass của các gate đúng snapshot, negative tests tái hiện rồi chặn được các đường vượt quyền, migration replay sạch, preview/deploy cùng commit, kiểm chứng các journey thật bằng dữ liệu thử và kiểm tra native artifact mục tiêu. Số test tăng thêm tự nó không đủ nếu chưa phủ các đường này.

## Giới hạn còn lại và artifacts

Không có DB management token trong environment/DB MCP, Docker daemon chưa chạy; chưa thực thi pgTAP/replay hoặc đọc pg_policies/ACL của deployed database. Chưa kiểm tra GitHub branch protection, CI run mới nhất, cấu hình dashboard Cloudflare/Supabase, auth providers thực tế, secret rotation, billing, tải cao, E2E có đăng nhập, thanh toán thật, nội dung người dùng thật hoặc native store binary. Security findings ở đây là defect/đường rủi ro có bằng chứng trong source, không phải báo cáo đã khai thác production.

Artifact tạm ngoài repo: `/tmp/picklehub-audit-20260909-build`, `/tmp/picklehub-audit-20260909-ui.cjs`, `/tmp/picklehub-audit-20260909-focus.cjs`, `/tmp/picklehub-audit-20260909-ui-results.json`, ảnh chụp có prefix `/tmp/picklehub-audit-`. Chúng không chứa session đăng nhập. Báo cáo này là file duy nhất được chủ động thêm vào repo; không sửa source, migration hay workflow của người dùng.
