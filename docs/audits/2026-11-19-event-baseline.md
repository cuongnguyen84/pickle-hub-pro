# Roadmap 9 — baseline luồng sự kiện, 19/11/2026

Nguồn: Supabase Management API chỉ đọc, truy vấn tổng hợp
[baseline](../sql/social-event-baseline.sql). Cửa sổ 30 ngày trọn vẹn theo giờ
Việt Nam: từ 20/10/2026 00:00 đến trước 19/11/2026 00:00.

| Chỉ số | Kết quả | Giới hạn |
|---|---:|---|
| Bắt đầu đăng ký | Chưa đo | Cần GA4, đếm journey_id duy nhất theo contract. |
| Bản ghi đăng ký Social Event trong kỳ | 0 | Đếm theo registered_at; không phải mẫu số OTP hoặc số click. |
| Social Event đã qua giờ kết thúc theo lịch, hiện published hoặc completed | 0 | Nhóm theo end_at, trạng thái hiện tại. |
| Social Event trong nhóm trên có trận hoàn tất và đủ hai điểm số | 0 | Ảnh chụp hiện tại; không đo lần thử lưu điểm hoặc thời điểm công bố. |
| Social Event trong nhóm trên vừa completed vừa có điểm | 0 | Không tính tỷ lệ vì mẫu số bằng 0. |
| QuickTable được tạo trong kỳ | 49 | Số bản ghi tạo mới; chưa biết bao nhiêu bảng thật sự được dùng. |

Đối chiếu toàn kỳ: 27 Social Event, 107 bản ghi đăng ký. Social Event chưa
có mẫu để chọn lỗi UX theo funnel trong cửa sổ này. Đọc thêm QuickTable theo
số bảng có ít nhất một trận ghi điểm, số bảng hoàn tất và ban tổ chức quay
lại; phân biệt đóng thật với tự lưu trữ. Giữ Social Event làm luồng kiểm thử
có người dùng thử và lấy GA4/Edge Logs riêng nếu cần đánh giá OTP. Không cộng
hai loại bảng thành một funnel. Số ca lưu thành công/tổng lần thử, RUM và GA4
chưa được xác minh trong lần đọc này.

## QuickTable

Kết quả chỉ đọc production, cùng cửa sổ 20/10–18/11 giờ Việt Nam:

| Chỉ số | Kết quả |
|---|---:|
| Bảng được tạo | 49 |
| Bảng có trận lưu đủ hai điểm | 10/49 (20,4%) |
| Bảng có ít nhất một trận hoàn tất | 10/49 (20,4%) |
| Trận hoàn tất thuộc các bảng trong kỳ | 50 |
| Bảng hiện ở trạng thái hoàn tất | 5 |
| Bảng hiện ở trạng thái lưu trữ | 0 |
| Tài khoản tạo bảng trong kỳ | 34 |
| Trong số đó, tài khoản từng có bảng trước kỳ | 1/34 (2,9%) |

Đây là ảnh chụp theo ngày tạo bảng. Số trận và trạng thái được lấy tại thời
điểm truy vấn, không phải số lần chấm điểm xảy ra trong kỳ. Tỷ lệ 1/34 là tỷ
trọng người từng tạo bảng trước đó trong nhóm đang hoạt động, không phải tỷ
lệ giữ chân 30 ngày của một nhóm người mới. Các bản ghi đã xóa không được
tính. Tỷ lệ có điểm không tự giải thích lý do người tạo chưa chấm điểm.

Truy vấn: [số bảng và trận](../sql/quicktable-baseline.sql),
[người tạo từng dùng](../sql/quicktable-returning-creators.sql).

## Reconciliation — 2026-11-20

The first report above is a historical point-in-time snapshot from 2026-11-19;
it is retained as reported and must not be overwritten. A fresh read-only
reconciliation on 2026-11-20 observed the new complete-day cohort
**2026-10-21 00:00 through 2026-11-20 00:00 ICT**. The observable-stage query
ran at **2026-11-20T01:31:53Z**:

| Stage (current snapshot) | Tables |
|---|---:|
| Created, no non-BYE roster row | 14 |
| Roster, no matches | 0 |
| Matches, no saved score pair | 21 |
| At least one saved score pair, not completed | 5 |
| Current status completed | 5 |
| **Total classified** | **45** |

The same-window baseline query returned **45 created, 9 with score, 9 with a
completed match, 49 completed matches, 5 completed tables, 0 archived tables,
and 32 creators**. Its `completed_without_score` diagnostic was 1. The stage
query totals exactly 45, so its categories cover the current cohort once each.
The mismatch between 9 scored tables in the aggregate baseline and 5 in the
exclusive stage named `scored` is expected: the stage query gives `completed`
precedence, so completed tables with scores belong only to `completed`.

The prior 2026-11-19 snapshot reported 49 created, 50 completed matches, and
34 creators. A subsequent boundary-date query verified **5 tables on
2026-10-20** and **1 table on 2026-11-19** (Vietnam dates). Moving the creation
window forward one day therefore reconciles the table count exactly:
**49 - 5 + 1 = 45**. No deletion inference is needed or asserted. The earlier
boundary query also observed 3 creators, 1 scored table and 1 completed match
on 2026-10-20. The old report is retained as a historical capture and the new
one records the later rolling cohort; neither is an immutable transition log.
