## Khuyến nghị tổng thể

Dùng **GitHub Issue làm bản ghi bền vững**, nhưng dùng **Telegram làm bề mặt đánh thức và xác nhận**. Markdown chỉ là tài liệu tham chiếu, không phải cơ chế nhắc việc.

Luồng chuẩn:

1. Mỗi milestone có một GitHub Issue và một dòng trong `ops/milestones.yml`.
2. GitHub Actions chạy theo lịch, đọc `due_at` theo múi giờ `Asia/Ho_Chi_Minh`.
3. Đến hạn, Action gọi Telegram alerter để gửi tin nhắn.
4. Tin nhắn lặp lại cho tới khi milestone có trạng thái `done`, không chỉ tới khi Cuong đã đọc.
5. Trạng thái gửi/nhận/hoàn tất lưu trong Supabase để chạy lại không tạo tin trùng.
6. Existing cron-health phải theo dõi cả heartbeat của workflow milestone này.

---

# 1. Copy và format Telegram cho SLO alert

## Ngôn ngữ và severity

**Dùng tiếng Việt cho alert mới và chuyển dần hai alert cũ sang tiếng Việt.** Không nên để cùng một kênh ops có alert tiếng Anh lẫn tiếng Việt khi người xử lý chính là Cuong và 95% hoạt động là VI.

Dùng hai mức:

- **🔴 P1:** lỗi đang làm người dùng không thể dùng chức năng chính, hoặc error-budget burn rất nhanh. Gửi ngay cả ban đêm.
- **🟠 P2:** suy giảm hiệu năng/SLO cần điều tra trong ngày. Không đánh thức lúc 03:00.

Không dùng màu mà thiếu chữ `P1/P2`, vì emoji có thể hiển thị khác nhau và khó tìm kiếm.

## Template SLO breach — P2 Core Web Vitals

```text
🟠 *P2 \| SLO vượt ngưỡng*

*Chỉ số:* `LCP p75 · VN`
*Hiện tại:* `{{current_value}}`
*Ngưỡng:* `{{threshold}}`
*Duy trì:* `{{breached_windows}}/{{required_windows}} lần kiểm tra`
*Mẫu:* `{{sample_count}}` lượt đo trong `{{lookback}}`
*Bắt đầu:* `{{incident_started_at_ict}}`

*Ảnh hưởng:* Trang tải chậm với người dùng Việt Nam\.
*Việc cần làm:* Mở báo cáo, kiểm tra thay đổi gần nhất và quyết định rollback hoặc theo dõi tiếp\.

[📊 Mở báo cáo SLO]({{report_url}})
[🧾 Xem thay đổi gần đây]({{deployments_url}})
```

Ví dụ đã render:

```text
🟠 P2 | SLO vượt ngưỡng

Chỉ số: LCP p75 · VN
Hiện tại: 2,84 giây
Ngưỡng: 2,50 giây
Duy trì: 3/3 lần kiểm tra
Mẫu: 1.284 lượt đo trong 24 giờ
Bắt đầu: 24/07/2026 01:10 ICT

Ảnh hưởng: Trang tải chậm với người dùng Việt Nam.
Việc cần làm: Mở báo cáo, kiểm tra thay đổi gần nhất và quyết định rollback hoặc theo dõi tiếp.
```

Thay phần ảnh hưởng theo metric:

- LCP: `Trang tải chậm với người dùng Việt Nam.`
- INP: `Thao tác chạm hoặc nhập liệu phản hồi chậm.`
- CLS: `Nội dung dịch chuyển trong lúc người dùng thao tác.`
- Error rate: `Một phần yêu cầu của người dùng đang thất bại.`

## Template P1 error-budget breach

```text
🔴 *P1 \| SLO lỗi vượt ngân sách*

*Tỷ lệ lỗi:* `{{error_rate}}`
*Ngưỡng:* `{{threshold}}`
*Số lỗi:* `{{error_count}}/{{request_count}}` yêu cầu
*Duy trì:* `{{duration}}`
*Bắt đầu:* `{{incident_started_at_ict}}`

*Ảnh hưởng:* Người dùng có thể không hoàn tất được thao tác chính\.
*Làm ngay:* Kiểm tra deploy gần nhất và rollback nếu lỗi vẫn tiếp diễn\.

[🚨 Mở dashboard lỗi]({{error_dashboard_url}})
[↩️ Mở lịch sử deploy]({{deployments_url}})
```

## Recovery message

Mọi SLO incident phải có recovery; nếu không, Cuong không biết sự cố đã tự hết hay vẫn mở.

```text
✅ *SLO đã phục hồi*

*Chỉ số:* `{{metric_name}}`
*Hiện tại:* `{{current_value}}`
*Ngưỡng:* `{{threshold}}`
*Thời gian sự cố:* `{{incident_duration}}`
*Phục hồi lúc:* `{{recovered_at_ict}}`

[📊 Xem báo cáo sự cố]({{report_url}})
```

### Lưu ý MarkdownV2

Không nối trực tiếp dữ liệu động vào MarkdownV2. Tạo hàm `escapeTelegramMarkdownV2()` cho toàn bộ giá trị động; đặc biệt escape:

```text
_ * [ ] ( ) ~ ` > # + - = | { } . ! \
```

URL trong link cũng cần xử lý `)` và `\`. Nếu implementation hiện tại thường lỗi escape, chuyển toàn bộ ba loại alert sang Telegram HTML parse mode sẽ ít mong manh hơn.

---

# 2. Kiểm soát alert fatigue

## Không chia theo “số lượng alert type”

Ba loại alert chưa phải quá nhiều. Vấn đề là **bao nhiêu tin yêu cầu hành động và chúng có lặp vô ích hay không**.

Tách theo mức độ hành động, không tách theo loại kỹ thuật.

## Cấu trúc Telegram đề xuất

Tạo một Telegram supergroup riêng cho ops, ví dụ:

**`ThePickleHub Ops`**

Có hai topic:

1. **`🚨 Cần xử lý`**
   - P1 error-budget breach
   - Error spike có ảnh hưởng thật
   - Cron unhealthy
   - Milestone đã quá hạn và chưa hoàn tất

2. **`📊 Báo cáo & mốc việc`**
   - P2 Core Web Vitals
   - Recovery
   - Milestone đến hạn lần đầu
   - PERF/UX/telemetry report

Edge function hiện gửi một chat vẫn có thể giữ nguyên `chat_id`, nhưng thêm `message_thread_id` theo loại tin. Nếu bot hiện đang gửi private chat và chưa dùng topic, vẫn dùng một chat trong giai đoạn đầu, nhưng bắt buộc có prefix `P1`, `P2`, `MỐC VIỆC`.

Không tạo nhiều bot hoặc nhiều private chat; Cuong sẽ khó biết nơi nào là nguồn chính thức.

## Threshold và dedupe cho SLO

### Core Web Vitals

Không alert từ một cửa sổ 10 phút. Dữ liệu p75 dễ nhiễu và INP có thể rất ít mẫu.

Dùng:

- Phạm vi: người dùng Việt Nam.
- Lookback: rolling 24 giờ.
- Đánh giá mỗi giờ.
- Tối thiểu:
  - LCP/CLS: `>= 200` lượt đo hợp lệ.
  - INP: `>= 100` lượt đo hợp lệ.
- Mở incident khi vượt ngưỡng trong **3 lần đánh giá liên tiếp**.
- Recovery khi tốt lại trong **2 lần đánh giá liên tiếp**.
- Chỉ gửi một alert khi incident chuyển từ `healthy → breached`.
- Không gửi lại mỗi giờ.
- Nếu vẫn mở, gửi một reminder sau mỗi **24 giờ**, không phải 60 phút.
- P2 phát sinh từ 22:00–07:00 ICT được giữ lại và gửi lúc 07:00.
- Recovery không cần gửi ban đêm.

Ngưỡng:

- LCP p75 `> 2,5 giây`
- INP p75 `> 200 ms`
- CLS p75 `> 0,1`

### Error-rate SLO

Không để error-rate SLO gửi cùng một nội dung với error fingerprint spike.

- Error spike trả lời: **“Lỗi cụ thể nào đang lặp?”**
- Error-rate SLO trả lời: **“Tỷ lệ thất bại toàn hệ thống có đang vượt ngân sách?”**

Điều kiện tối thiểu đề xuất:

- Không tính cửa sổ nếu có dưới `100` eligible requests, trừ khi có ít nhất `10` lỗi.
- P1: error rate `>= 5%` trong hai cửa sổ 10 phút liên tiếp.
- P2: error rate vượt budget trong ba cửa sổ liên tiếp nhưng chưa đạt P1.
- Nếu một error spike thuộc cùng incident, SLO message chỉ thêm:
  `Lỗi nổi bật: {{fingerprint}} · {{count}} lần`
  thay vì gửi hai tin gần nhau.
- Dedupe theo khóa:
  `alert_type + metric + segment + incident_started_at`
- Recovery sau hai cửa sổ khỏe liên tiếp.

---

# 3. Cơ chế để milestone “nổ” đúng ngày

## Source of truth

Dùng ba lớp với vai trò khác nhau:

| Element | Vai trò |
|---|---|
| `ops/milestones.yml` | Máy đọc ngày, trạng thái và điều kiện hoàn thành |
| GitHub Issue | Audit trail, checklist, report và quyết định cuối |
| Telegram | Bề mặt Cuong thực sự nhìn thấy |

**Không dùng markdown thuần làm source of truth**, vì markdown không thể ACK, dedupe hoặc biết việc đã hoàn tất.

## Manifest cụ thể

```yaml
timezone: Asia/Ho_Chi_Minh

milestones:
  - id: PERF-05
    issue: 123
    due_at: "2026-07-24T08:00:00+07:00"
    kind: report
    owner: cuong
    completion_requires:
      - report_url
      - recommendation
      - decision

  - id: TL-BTN-HARD
    issue: 124
    due_at: "2026-08-03T09:00:00+07:00"
    kind: enforcement_gate
    owner: cuong
    completion_requires:
      - open_pr_check
      - hard_rule_pr
      - ci_green

  - id: UX-07
    issue: 125
    due_at: "2026-08-02T08:00:00+07:00"
    kind: decision_gate
    owner: cuong
    completion_requires:
      - report_url
      - decision
      - rationale

  - id: BADGE-READ
    issue: 126
    due_at: "2026-08-04T08:00:00+07:00"
    kind: decision_gate
    owner: cuong
    completion_requires:
      - report_url
      - decision
```

Tôi chọn `.tl-btn` vào **03/08**, không phải 02/08, để vừa đúng “sau 01/08” vừa không đụng ngày đọc UX-07.

QA-04 và OPS-04 là “do now”: tạo issue và gửi Telegram ngay khi merge cơ chế, không chờ scheduled date.

## Workflow

GitHub Actions chạy mỗi 30 phút:

```yaml
on:
  schedule:
    - cron: "*/30 * * * *"
  workflow_dispatch:
```

Action phải:

1. Ghi heartbeat bắt đầu vào Supabase.
2. Đọc manifest.
3. Tìm milestone `due_at <= now` và chưa `done`.
4. Kiểm tra delivery ledger để tránh tin trùng.
5. Gọi Telegram edge function.
6. Ghi `sent_at`, `telegram_message_id`.
7. Ghi heartbeat kết thúc.

GitHub schedule có thể trễ hoặc bỏ một lượt, nên không thiết kế “chỉ gửi nếu đúng phút”. Điều kiện phải là **đã đến hạn và chưa từng gửi**, nhờ đó lượt chạy sau tự bù.

Thêm job `milestone-dispatch` vào cron-health hiện có:

- Unhealthy nếu không có heartbeat thành công trong 90 phút.
- Alert:
  `Không thể kiểm tra milestone; lời nhắc theo ngày có thể bị trễ.`

## Trạng thái và escalation

Tách ba trạng thái:

- `due`: đến hạn, chưa được nhận.
- `acknowledged`: Cuong đã thấy nhưng chưa xong.
- `done`: có output/decision hợp lệ.

**ACK không được coi là hoàn tất.**

Lịch gửi:

- Đến hạn: gửi ngay.
- Chưa ACK sau 4 giờ trong khung 07:00–22:00: nhắc một lần.
- Đã ACK nhưng chưa done: nhắc mỗi ngày lúc 08:00.
- Quá hạn 48 giờ: chuyển sang topic `🚨 Cần xử lý`.
- Chỉ dừng khi `done`.

## Tin nhắn đến hạn

```text
⏰ *MỐC VIỆC ĐẾN HẠN · UX\-07*

*Hạn:* `02/08/2026 08:00 ICT`
*Việc cần quyết định:* Có xây luồng đăng ký khách hay đóng UX\-07\.
*Đầu ra bắt buộc:* Báo cáo funnel 14 ngày, khuyến nghị và quyết định cuối\.

*Trạng thái:* `CHƯA NHẬN`

[📊 Tạo hoặc mở báo cáo]({{report_url}})
[🧾 Mở issue UX\-07]({{issue_url}})

Trả lời: `/ack UX-07`
Hoàn tất: `/done UX-07 build` hoặc `/done UX-07 close`
```

Tin nhắc quá hạn:

```text
🔴 *MỐC VIỆC QUÁ HẠN · UX\-07*

*Quá hạn:* `2 ngày`
*Đã nhận:* `Có`
*Còn thiếu:* Quyết định `BUILD` hoặc `CLOSE` và lý do\.

Việc này sẽ tiếp tục được nhắc mỗi ngày cho tới khi có quyết định\.

[🧾 Hoàn tất UX\-07]({{issue_url}})
```

---

# 4. Thiết kế ba read-number report

## Format chung

Mỗi báo cáo có hai bề mặt:

1. **Telegram summary:** tối đa 10–14 dòng, đủ để quyết định.
2. **GitHub Issue/report artifact:** bảng đầy đủ, query version, dữ liệu và ghi chú chất lượng.

Ngôn ngữ chính: **tiếng Việt**. Giữ tên metric/event kỹ thuật bằng tiếng Anh trong code formatting.

Mọi report phải có:

- Khoảng thời gian và timezone.
- Segment.
- Denominator rõ ràng.
- Số lượng mẫu, không chỉ phần trăm.
- So sánh với baseline hoặc nhóm đối chứng.
- Ghi chú thiếu dữ liệu.
- Một khuyến nghị rõ: `BUILD`, `CLOSE`, `KEEP`, `KILL`, `ROLLBACK`, `KEEP CHANGE`.
- Một hành động tiếp theo, người chịu trách nhiệm và ngày thực hiện.

Không gửi report chỉ có dashboard link.

## PERF-05 report

Bắt buộc có:

- Khoảng `before` và `after` có độ dài bằng nhau.
- VN segment; mobile tách riêng nếu đủ mẫu.
- Deploy/change ID.
- LCP p75 trước/sau và delta.
- INP p75 trước/sau và delta.
- CLS p75 trước/sau và delta.
- Sample size từng metric.
- Tỷ lệ pageviews đạt “good”.
- Guardrail: error rate và conversion chính có xấu đi không.
- Kết luận: `GIỮ THAY ĐỔI`, `ROLLBACK`, hoặc `CHƯA ĐỦ MẪU`.

Telegram summary mẫu:

```text
📊 *PERF\-05 · Kết quả VN sau thay đổi*

*Khoảng đo:* 10–23/07 so với 24/07–06/08
*LCP p75:* `2,91s → 2,42s` \(`−16,8%`\) ✅
*INP p75:* `184ms → 179ms` \(`−2,7%`\) ✅
*CLS p75:* `0,08 → 0,08` \(`không đổi`\)
*Mẫu:* `8.421 / 8.907` pageviews
*Guardrail:* Error rate không tăng; conversion `+0,3 điểm %`

*Khuyến nghị:* `GIỮ THAY ĐỔI`
*Lý do:* LCP đã xuống dưới 2,5s, không làm xấu guardrail\.

[Đọc báo cáo đầy đủ]({{report_url}})
```

## UX-07 funnel decision report

### Các con số bắt buộc

Với mỗi funnel, dùng **unique users** làm số chính; event count chỉ dùng để kiểm tra telemetry.

1. `organizer_tournament` funnel:
   - Số user bắt đầu.
   - Số user tới bước login wall.
   - Số đăng nhập thành công.
   - Số hoàn tất đăng ký.
   - Conversion toàn funnel.
   - Drop-off tuyệt đối và phần trăm ở từng bước.

2. Login-wall funnel:
   - Số unique users thấy login wall.
   - Số chọn đăng nhập/đăng ký.
   - Số login thành công.
   - Số quay lại flow.
   - Số hoàn tất đăng ký.
   - Median time từ login wall tới completion nếu có.

3. Data-quality:
   - Tỷ lệ event thiếu `tournament_id`, `user_id/session_id`, source.
   - Các bước có số liệu tăng ngược bất hợp lý.
   - Event/version được dùng.

### Template hoàn chỉnh

```text
# UX-07 — Quyết định luồng đăng ký khách

## 1. Phạm vi đo

- Thời gian: `{{start_date}}–{{end_date}}`, Asia/Ho_Chi_Minh
- Segment: người dùng bắt đầu từ `organizer_tournament`
- Đơn vị chính: unique users
- Tổng số user đủ điều kiện: `{{eligible_users}}`
- Chất lượng dữ liệu: `{{data_quality_status}}`

## 2. Funnel organizer_tournament

| Bước | User | % từ bước trước | Rơi rụng |
|---|---:|---:|---:|
| Bắt đầu xem tournament | {{step_1_users}} | 100% | — |
| Bắt đầu đăng ký | {{step_2_users}} | {{step_2_rate}} | {{step_2_dropoff}} |
| Gặp login wall | {{login_wall_users}} | {{login_wall_rate}} | {{login_wall_dropoff}} |
| Đăng nhập thành công | {{login_success_users}} | {{login_success_rate}} | {{login_dropoff}} |
| Quay lại flow | {{return_users}} | {{return_rate}} | {{return_dropoff}} |
| Hoàn tất đăng ký | {{completed_users}} | {{completion_rate}} | {{final_dropoff}} |

Conversion toàn funnel: `{{overall_conversion}}`

## 3. Funnel login wall

- Thấy login wall: `{{wall_users}}`
- Bấm đăng nhập/đăng ký: `{{auth_start_users}}` (`{{auth_start_rate}}`)
- Đăng nhập thành công: `{{auth_success_users}}` (`{{auth_success_rate}}`)
- Quay lại flow: `{{return_users}}` (`{{return_rate}}`)
- Hoàn tất đăng ký: `{{completed_users}}` (`{{wall_to_complete_rate}}`)
- Bỏ cuộc sau login wall: `{{abandoned_users}}` (`{{abandonment_rate}}`)

Điểm rơi rụng lớn nhất: `{{largest_dropoff_step}}`

## 4. Ước lượng cơ hội

Nếu bỏ login wall trước bước đăng ký:

- User có thể được giữ lại trong 14 ngày: `{{recoverable_users}}`
- Số đăng ký hoàn tất ước tính: `{{estimated_extra_completions}}`
- Giả định sử dụng: `{{assumption}}`
- Độ tin cậy: `{{confidence}}`

## 5. Chất lượng dữ liệu

- Event thiếu identifier: `{{missing_identifier_rate}}`
- Event bị trùng: `{{duplicate_rate}}`
- Bước có số liệu bất hợp lý: `{{anomalies_or_none}}`
- Hạn chế: `{{limitations}}`

## 6. Khuyến nghị

Quyết định đề xuất: `BUILD` / `CLOSE`

Lý do:
1. {{reason_1}}
2. {{reason_2}}
3. {{reason_3}}

Hành động tiếp theo:
- Nếu BUILD: tạo scope guest-registration tối thiểu trước `{{date}}`.
- Nếu CLOSE: ghi rõ ngưỡng nào sẽ khiến quyết định được mở lại.

## 7. Quyết định của Cuong

- [ ] BUILD guest-registration path
- [ ] CLOSE UX-07
- Lý do cuối: {{final_reason}}
- Ngày quyết định: {{decision_date}}
```

### Rule quyết định đề xuất

Để tránh report kết thúc bằng “tùy cân nhắc”, pre-commit rule:

Đề xuất `BUILD` nếu cả ba đúng:

- Có ít nhất `100` unique users gặp login wall trong 14 ngày.
- Ít nhất `30%` bỏ cuộc từ login wall tới login thành công.
- Ước tính guest path có thể tạo thêm ít nhất `10` completed registrations trong 14 ngày.

Đề xuất `CLOSE` nếu:

- Đủ mẫu nhưng estimated uplift dưới ngưỡng trên; hoặc
- Login wall không phải top drop-off.

Nếu không đủ mẫu hoặc telemetry lỗi, không được giả vờ quyết định. Trạng thái là:

`BLOCKED — sửa telemetry và đọc lại vào ngày cụ thể`

UX-07 chỉ được đóng sau lần đọc lại hoặc khi Cuong chủ động chấp nhận đóng vì volume quá thấp.

## Telemetry badge report

Chỉ event `reg_count_badge_impression` **không đủ để kết luận badge có tạo social proof hiệu quả hay không**. Nó chỉ chứng minh badge đã được render/nhìn thấy.

Report tối thiểu:

- Eligible pageviews.
- Impression count.
- Unique users có impression.
- Impression rate = unique exposed / unique eligible.
- Breakdown theo mobile/desktop và page.
- Missing/duplicate rate.
- Conversion sau impression trong cùng session, nếu có identifier.
- So sánh với user không exposed hoặc experiment holdout, nếu có.
- Khuyến nghị `KEEP`, `KILL`, hoặc `RUN EXPERIMENT`.

Nếu chưa có control group hoặc `badge_click`, copy phải nói rõ:

```text
*Khuyến nghị:* `CHƯA THỂ KẾT LUẬN KEEP/KILL THEO HIỆU QUẢ`
Event hiện tại chỉ chứng minh badge được hiển thị, không chứng minh badge làm tăng đăng ký\.
*Việc cần làm:* Chạy holdout 50/50 hoặc thêm `badge_click` và conversion join trước khi quyết định\.
```

Không được diễn giải “nhiều impression” thành “badge hiệu quả”.

## GA4 implementation cần làm ngay

Script Python hiện tại phải được mở rộng, không yêu cầu Cuong mở GA4 UI trên điện thoại.

Cụ thể:

- Thêm GA4 Data API `runReport` cho event counts và event-scoped dimensions.
- Với funnel sequence, dùng `runFunnelReport` nếu property/API hỗ trợ đúng filter cần thiết.
- Đăng ký ngay các event parameters cần đọc dưới dạng GA4 custom definitions.
- Kiểm tra identifier dùng để nối các bước.
- Custom dimension đăng ký muộn thường không cho báo cáo lịch sử đầy đủ; không chờ tới ngày milestone mới kiểm tra.
- Nếu funnel cần raw ordered events mà Data API không đáp ứng, bật BigQuery export từ bây giờ. Export không hồi tố dữ liệu cũ.

Mỗi report script phải xuất:

- `summary.md`
- `details.csv`
- `query_metadata.json`

Trong đó `query_metadata.json` lưu property ID, date range, filters và script commit SHA.

---

# 5. End-user harm check

## A. Flip `.tl-btn` lint rule sang HARD

Vì rule kiểm tra **changed files**, branch cũ vẫn có thể bị vỡ CI khi merge/rebase sau ngày bật HARD. Không được chỉ đổi warning thành error theo đồng hồ mà không kiểm tra open PR.

### Quy trình cụ thể

**Trước 01/08:**

1. Chạy advisory rule trên:
   - default branch;
   - HEAD của mọi open PR;
   - changed files của từng PR.
2. Bot comment chính xác file và dòng vi phạm:
   ```text
   `.tl-btn` sẽ trở thành lỗi CI từ 03/08/2026.
   Vi phạm: `src/.../Component.tsx:42`
   Cách sửa: thay class/button bằng `{{approved_component_or_token}}`.
   ```
3. Cung cấp autofix/codemod nếu phép thay thế là cơ học.
4. Gắn label `tl-btn-hard-blocked` cho PR chưa sạch.

**Ngày 03/08:**

Chỉ merge PR bật HARD khi:

