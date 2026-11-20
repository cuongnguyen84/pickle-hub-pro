# ThePickleHub — roadmap tổng thể lên 9/10

Ngày bắt đầu: 19/11/2026. Mục tiêu: trung bình ít nhất 9/10 trên 15 hạng mục
scorecard, không hạng mục nào dưới 8.5. Đây là roadmap triển khai, không phải
tuyên bố đạt điểm ngay khi code merge. Mỗi hạng mục cần evidence riêng: code,
CI, production data, quan sát người dùng hoặc kiểm thử thực.

## Quy tắc điều phối

- Lead chia task, review mọi diff, chạy gate, merge và xác minh sau deploy.
  Coding agent chỉ sửa phạm vi được giao, không tự merge/deploy.
- Mỗi task có agent code; các task chờ quan sát/cohort có agent theo dõi riêng.
  Chờ dữ liệu không chặn task code độc lập.
- Không đổi UX chỉ từ tỷ lệ QuickTable 10/49 có điểm. Phân biệt bảng demo/thử,
  bảng có ý định tổ chức thật, abandon do trở ngại và bảng chưa tới ngày diễn ra
  bằng tín hiệu có nguồn; không đoán từ tên, số điểm hoặc completion.
- Telemetry không chứa PII; tổng commit lấy từ DB/server. Analytics dùng cho
  hành trình và phân nhóm, có deduplication và thuộc tính platform/locale/market.
- Merge sau khi CI bắt buộc xanh. Không dùng production write để thay migration
  review. Luôn xác nhận hành vi sau deploy.
- Chỉ nâng điểm khi có evidence. Không biến WAITING thành PASS vì thiếu mẫu.

## Baseline

Scorecard 19/11/2026: 114/150 (7.6/10), mục tiêu 135/150. QuickTable production
20/10–18/11 ICT: 49 bảng tạo, 10 có điểm, 50 trận hoàn tất, 5 bảng completed,
0 archived, 34 người tạo; 1/34 có bảng từ trước kỳ. Đây là ảnh chụp cohort tạo
bảng, không phải bằng chứng abandon hay retention.
Chi tiết: [baseline](audits/2026-11-19-event-baseline.md),
[SQL bảng/trận](sql/quicktable-baseline.sql),
[SQL cohort người tạo](sql/quicktable-returning-creators.sql).

## Crosswalk scorecard

| Hạng mục | Hiện tại | Mục tiêu | Roadmap |
|---|---:|---:|---|
| Product và định vị | 8.0 | 9.0 | UX-1, UX-2, RET-1 |
| UI và visual consistency | 7.5 | 9.0 | UI-1 |
| UX và task completion | 7.0 | 9.0 | UX-1, UX-2, NATIVE-1 |
| Accessibility | 6.5 | 9.0 | A11Y-1, A11Y-2, A11Y-3 |
| Codebase maintainability | 7.5 | 9.0 | ARCH-1, QA-1 |
| Architecture/API | 8.0 | 9.0 | DB-2, ARCH-1, QA-1 |
| Database | 8.5 | 9.5 | DB-1, DB-2 |
| Security/privacy | 8.0 | 9.0 | SEC-1..4, AN-1 |
| QA/testing | 8.5 | 9.5 | A11Y-2..3, QA-1, DB-2 |
| Web performance | 7.5 | 9.0 | PERF-1..2 |
| CI/CD and operations | 8.5 | 9.0 | OPS-1..2 |
| SEO/content | 8.0 | 9.0 | SEO-1 |
| Apple/native | 7.0 | 8.5 | NATIVE-1 |
| Analytics/growth | 7.0 | 9.0 | UX-1, UX-3, RET-1, AN-1 |
| Commerce/revenue | 6.5 | 8.5 | REV-1 |

Điểm đích cộng thành 135/150. Điểm hiện tại cần baseline lại theo evidence mới
trước khi tính delta, vì scorecard trước là đánh giá cục bộ và vài finding đã
được sửa/merge sau đó.

## Giai đoạn 0 — bảo mật và truy cập

| ID | Hạng mục | Việc | Tiêu chí hoàn tất |
|---|---|---|---|
| SEC-1 | Dependencies | Xác minh advisory và reachability hiện tại; vá high trước, lập tương thích riêng cho Zod major; thêm regression tests. | Không còn high/critical reachable trong production tree hoặc có ngoại lệ owner + hạn hết hạn. |
| SEC-2 | CodeQL | Bật JavaScript/TypeScript và Python. | CI phân tích cả hai ngôn ngữ; không finding mới ngoài baseline có lý do. |
| SEC-3 | DUPR | Xác minh cấu hình production; nếu token thật được lưu bền vững, kiểm tra encryption, rotation, revocation, webhook và quyền. | Evidence hiện trạng theo môi trường, không còn secret plaintext lưu lâu dài. |
| SEC-4 | Security audit | Đối chiếu audit tháng 7 với code, migration và deploy; cập nhật executive summary stale. | Mỗi finding có trạng thái hiện tại, cách xác minh và bằng chứng. |
| A11Y-1 | Contrast | Bật lại axe color-contrast toàn trang trên light/dark; sửa violation và incomplete thay vì disable rule. | Không còn violation/incomplete chưa giải thích trên trang mục tiêu; CI kiểm tra hai theme. |
| A11Y-2 | QuickTable | Test mobile accessible name, focus, keyboard và nút vào/sửa điểm; giữ localized labels. | Không icon-only button thiếu tên; keyboard/mobile checks pass. |
| A11Y-3 | Journey coverage | Bổ sung staging test account/dữ liệu cho organizer wizard; thống kê test skip và nguyên nhân. | Registration + organizer publish có CI evidence không bị skip trong pipeline tích hợp. |

## Giai đoạn 1 — UX và phân loại ý định

| ID | Hạng mục | Việc | Tiêu chí hoàn tất |
|---|---|---|---|
| UX-1 | Phân loại QuickTable | Định nghĩa measurement privacy-safe cho start/create/first committed score/completion và repeat; dùng cờ test/demo rõ ràng nếu có, không suy đoán. | Analytics đối soát với server/DB, dedupe đúng, test/admin có classification provenance, không PII. |
| UX-2 | Rà journey | Kiểm tra create/publish/first score trên mobile và các trạng thái loading/error/empty; chỉ sửa finding tái hiện được. | Mỗi finding có reproduction, expected behavior, fix nhỏ, regression test và xác minh task. |
| UX-3 | Social Event | Đối soát organizer publish/registration GA4 với DB; thêm server-side publication timestamp/transition event nếu cần. | Funnel chính xác theo commit, không PII, có timestamp từ draft→published và mẫu production. |

| UI-1 | Visual system | Rà các trang/flows chính theo design tokens, hierarchy, responsive states, visual regression; sửa inconsistency quan sát được. | Không raw styling drift ở các màn sửa; visual regression và mobile layout pass. |

Không thay luồng nghiệp vụ dựa riêng vào 10/49. Nếu cohort chưa đủ, xác minh
bằng task observation có phân biệt bảng thử với giải thật; không coi lời nhận
xét chủ quan là kết quả định lượng.

## Giai đoạn 2 — dữ liệu, kiến trúc, QA và vận hành

| ID | Hạng mục | Việc | Tiêu chí hoàn tất |
|---|---|---|---|
| DB-1 | Schema/drift | Dựng baseline read-only schema/ledger; xử lý lịch sử drift không dùng db push --include-all. | Drift phân loại, cách reconcile an toàn được review, không đột biến schema ngoài quy trình. |
| DB-2 | Score/payment atomicity | Ưu tiên scoring, bracket propagation, OTP registration và payment; test concurrency, retry, idempotency. | pgTAP/integration chứng minh không overbook, mất điểm, double charge/transition. |
| ARCH-1 | Module boundaries | Tách thao tác DB khỏi page trong scoring/payment khi chạm đến; không refactor đại trà. | Logic/repository có test; component điều phối UI. |
| QA-1 | E2E | Bao phủ registration, organizer publish, score save, completion và recovery trên staging. | Happy path, retry/idempotency và negative paths chạy CI; skip được thống kê và giải thích. |
| OPS-1 | Recovery | Lặp restore drill, xác nhận dữ liệu, đo RTO/RPO. | Báo cáo thời gian thực tế và kiểm tra toàn vẹn sau phục hồi. |
| OPS-2 | Release controls | Thiết kế drift monitor an toàn; xác minh Actions workflows và branch protection. | Cảnh báo actionable, trạng thái protection có bằng chứng, không false-red do lịch sử đã biết. |

## Giai đoạn 3 — hiệu năng, SEO và native

| ID | Hạng mục | Việc | Tiêu chí hoàn tất |
|---|---|---|---|
| PERF-1 | Core Web Vitals | Đọc p75 theo trang/thị trường/cỡ mẫu; sửa CLS/LCP/INP theo attribution thật. | Mobile VN p75: LCP ≤2.5s, INP ≤200ms, CLS ≤0.1 với sample size ghi rõ. |
| PERF-2 | Bundle | Đo route-level initial cost và tải video; chỉ tối ưu khi RUM hoặc lab representative chỉ tác động. | Budget xanh, before/after rõ, không metadata IDE trong artifact. |
| SEO-1 | GSC | Làm mới coverage, 61 URL 404, CTR cohort 28 ngày, /san tracker và parity VI/EN. | URL lỗi có disposition, internal links không trỏ 404, báo cáo GSC/CWV theo cohort. |
| NATIVE-1 | Thiết bị thật | Test auth/deep links, locale, push, offline scoring, paid registration, VoiceOver/large text, draft restore trên thiết bị. | Ghi build/device/OS/date; không P1; evidence thiết bị được lưu. |

## Giai đoạn 4 — giữ chân và thương mại

| ID | Hạng mục | Việc | Tiêu chí hoàn tất |
|---|---|---|---|
| RET-1 | Organizer retention | Theo dõi cohort event thật, repeat tournament/event; loại test/admin bằng tín hiệu rõ. | Ít nhất 30 ngày sau khi instrumentation xác minh; activation/return đối soát DB. |
| AN-1 | Analytics | Đối soát event với commit rows, xác minh GA4 production và privacy. | Dedupe đúng, không PII, DB là nguồn tổng; delivery prod được kiểm tra. |
| REV-1 | Shop | Chạy validation packet trước khi tăng đầu tư hoặc mở index. | 5 buyer tasks; cohort 20 buyer/2 seller; ≥8 checkout, ≥5 đơn hợp lệ, ≥3 paid/delivered, seller cancel ≤1; tiếp tục 30 ngày repeat. |

## Workstream tracker — việc phụ thuộc thời gian/đầu vào ngoài agent

Một tracker agent duy trì [evidence tracker](audits/9-score-evidence-tracker.md),
cập nhật mỗi tuần và mở follow-up khi đủ điều kiện:

- Retention 30 ngày sau khi event pipeline merge và verified.
- GSC CTR 28 ngày; cần Search Console property/export.
- Shop 14 ngày demand + 30 ngày repeat; cần seller, buyer, đơn thật và account
  owner cho phát hành.
- iPhone/Android thật, signed build và tài khoản test cho native journey.
- Field CWV đủ mẫu; không dùng Lighthouse lab để thay thế.

Mỗi lần ghi: ngày, nguồn, sample size, PASS/FAIL/WAITING, blocker, owner, ngày
đo tiếp và evidence link. Các task code độc lập tiếp tục trong thời gian chờ.

## Điều phối

1. Ưu tiên song song nhưng không chồng file: agent security xử lý CodeQL và
   dependency remediation; agent a11y xử lý contrast guard và QuickTable tests.
2. Lead review từng diff, chạy gates và merge từng PR nhỏ.
3. Sau khi instrumentation contract được review, giao agent cho QuickTable
   start/create/first committed score/completion; không PII.
4. Tiếp theo chia từng ticket DB/architecture/QA. Không giao hai agent cùng
   migration hoặc component. Mọi PR đều có tests.
5. Tracker agent tiếp tục theo dõi GSC/CWV/native/shop/retention và cập nhật
   evidence. Không bịa kết quả hoặc ghi production.

## Re-score

Chấm lại khi code gates xanh, evidence mới có cho từng hạng mục và WAITING được
báo riêng. Mục tiêu ≥9.0/10 trung bình, không hạng mục nào dưới 8.5. Nếu thiếu
mẫu hay đầu vào thực địa, báo điểm tạm và để tracker tiếp tục.
