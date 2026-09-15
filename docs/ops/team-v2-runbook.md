# Đội agent v2 — vận hành và phát triển ThePickleHub

Ngày triển khai: 2026-09-11. Chủ sản phẩm đã cho phép thay đội cũ và gửi báo cáo
Telegram. Đây là tài liệu cho implementation v2, thay thế các mô tả lịch chạy
trong `docs/ai-agent-team.md` và `docs/ops/site-admin-duties.md` sau cutover.

Bản sửa 2026-09-13: thay wildcard `%` trong URL hàng đợi bằng `*` của PostgREST
để tránh HTTP 500 từ proxy; thêm circuit breaker chung khi Claude hết hạn mức
hoặc chưa đăng nhập. Giám sát và Telegram tiếp tục; model đợi 6 giờ trước khi thử
lại. Không tự mua hạn mức hay tăng ngân sách. Đã xác nhận lỗi tài khoản bằng lời
gọi thực tế trả `You're out of usage credits`, 0 input/output token, cost 0.

## Những gì v2 thực thi

- Một supervisor, lịch kiểm tra mỗi phút; phép đo site/job/shop/live/dịch/recovery
  mỗi 5 phút. Quét đầy đủ thêm security, CI, nội dung, moderation, GSC và GA4 mỗi ngày.
- Chín vai trò trong `scripts/ops/team_roles.json`, mỗi vai trò phân tích một lần
  mỗi ngày, rải tối đa một lượt AI định kỳ mỗi tick. Editorial có nguồn tin và
  bản VI; Growth có GA4 segment Vietnam và GSC; thiếu nguồn được báo là unknown.
- Thứ Ba/Năm/Bảy sau 08:00 ICT: tự xếp việc viết bản nháp nội dung song ngữ vào
  checkout riêng, tránh trùng bài VI gần nhất; thiếu nguồn thì viết đề cương cần
  xác minh. Việc do anh giao được ưu tiên trước việc nội dung định kỳ.
- SQLite WAL là sổ cái DUY NHẤT của đội v2 trên máy này: tasks, runs, outbox,
  heartbeat, lịch chạy, dự toán chi phí và bằng chứng. Không sửa schema production.
- Việc từ Telegram được ghi bền vững vào sổ cục bộ trước khi ACK hàng đợi cũ.
  `telegram_commands.status=done` ở bước này chỉ nghĩa đã chuyển việc; trạng thái
  thực thi nằm trong tasks và được báo theo mã T. Sự cố giữa ghi/ACK không tạo trùng.
- Yêu cầu engineering/editorial tạo bản nháp thật trong detached worktree từ HEAD.
  Model chỉ có file tools giới hạn; không shell, web, MCP, hooks hay cấu hình tự
  chạy của repo. Không cấp thông tin đăng nhập DB/Telegram cho tiến trình model.
  Draft code chỉ src TS/TSX/CSS; draft nội dung chỉ docs/agent-drafts Markdown.
  Auth, payment, registration, scoring, DUPR, contracts, integrations bị chặn.
- Controller kiểm phạm vi file, symlink, số lượng, kích thước và `git diff --check`.
  Bản patch, SHA256, commit gốc, worktree và báo cáo được giữ để QA/review.
  **Chưa tự chạy mã/test do model sinh, chưa tự commit/push/merge/deploy.**
- Báo cáo tổng hợp 08:00 và 21:00 ICT; cảnh báo thay đổi site/shop; phản hồi từng
  yêu cầu và bộ giám sát heartbeat riêng. Model phân tích không được nói đã sửa.

## Hạ tầng đã giữ lại và đã thay

Installer chỉ nghỉ hưu bốn lịch `com.picklehub.chief`, `.content`, `.opssweep`,
`.xuly`. Plist đã cài được chuyển vào bản sao lưu, nên không tự bật lại khi login.
Source và báo cáo cũ còn nguyên để đối chiếu; không xóa lịch sử, secret hay dữ liệu.

Giữ nguyên `com.picklehub.edge-redeploy-hourly`, `com.picklehub.fix-agent` và toàn
bộ cron Cloudflare/Supabase/GitHub. Fix-agent là adapter recovery cũ có quota riêng,
không nằm trong quota AI của v2. Không tuyên bố `/xuly team pause` dừng cloud cron.

Hai lịch mới: `com.picklehub.team-v2` (60 giây) và
`com.picklehub.team-v2-watchdog` (300 giây). Runtime dùng snapshot ở Application
Support, không bị đổi mã khi người dùng checkout branch khác trong repo. Collector
cần source repo để đọc metadata/checks; runtime snapshot không thay snapshot sản phẩm.

## Lệnh Telegram

Giữ webhook/menu cũ; mọi lệnh mới đi qua prefix `/xuly` đã được backend hỗ trợ.
Không cài webhook thứ hai hoặc dùng getUpdates cạnh tranh với webhook hiện tại.

| Lệnh | Tác dụng |
|---|---|
| `/xuly team status` | Tình trạng đo, vai trò, việc mở |
| `/xuly team inbox` | Các việc mở/chờ xem xét |
| `/xuly team report 12` | Báo cáo của run 12, tối đa một tin Telegram |
| `/xuly team pause` | Ngừng khởi chạy tác vụ v2 mới, vẫn nhận lệnh điều khiển |
| `/xuly team resume` | Tiếp tục tác vụ v2 |
| `/xuly team cancel T12` | Huỷ việc đang chờ hoặc bản nháp T12; giữ bằng chứng |
| `/xuly engineering <việc>` | Chuẩn bị code/đề xuất trong checkout riêng |
| `/xuly editorial <việc>` | Chuẩn bị bài Markdown có nguồn trong checkout riêng |
| `/xuly commerce <việc>` | Phân tích nghiệp vụ từ bundle đã đo |
| `/xuly growth <việc>` | Phân tích số liệu, đề xuất cải tiến có thước đo |
| `/xuly <việc>` hoặc `/idea <việc>` | Mặc định giao Engineering chuẩn bị draft/đề xuất |

Các prefix role khác trong team_roles.json cũng được hỗ trợ. Việc chưa làm được
giữ `needs_review`, không tự retry một patch đã chạy dở. `/viec` cũ chỉ thấy hàng
đợi trung chuyển nên dùng `/xuly team inbox` để xem sổ mới. Lệnh `/bo XL-n` chỉ hủy
trước khi trung chuyển; không được hiểu là đã hủy task T-n đang xử lý.

Bot xác thực cả chat ID lẫn sender ID. Chat riêng dùng chính owner ID; group phải
có TELEGRAM_ADMIN_ID cấu hình rõ. Văn bản quote hoặc câu "anh đã duyệt" không cấp
quyền production; v2 chưa có executor cho merge, publish hoặc xác nhận tiền.

## Trần và trạng thái

Mỗi model call có max-budget-usd 0.75. Tổng đội v2 tối đa 12 lượt và 9 USD theo giá
API quy đổi trong cửa sổ 24 giờ. Đây là số quy đổi do CLI trả, **không phải hóa đơn
thuê bao Claude Max**. Quota dành cả cho lời gọi thất bại/timeout để không đánh giá
thấp chi phí chưa biết. Tác vụ mới chờ đến khi có ngân sách, không tự tăng trần.

Phân tích tối đa 300 giây; draft tối đa 600 giây. Hết hạn sẽ dừng cả process group.
Control loop chạy tuần tự nên lệnh pause đến trong lúc model chạy có thể đợi lượt
hiện tại kết thúc. Nó không phải nút hủy tức thì một process đang chạy.
CLI pause ghi cờ ngay cả khi supervisor đang giữ lock; cờ không giết process.

Task: queued → running → awaiting_review; kiểm tra đạt mới có thể đóng resolved.
Lỗi/gián đoạn → needs_review. Findings được resolve khi collector tương ứng đo
thành công và không còn thấy vấn đề. Collector lỗi không tự xóa findings cũ.

Outbox: pending → sending → sent (có Telegram message_id). Timeout/gián đoạn sau
gửi → uncertain; không tự gửi lại vì Telegram có thể đã nhận. HTTP 429 retry tối đa
5 lần; lỗi khác ghi failed. Mọi trạng thái đều có trong CLI status/SQLite.

## Vận hành cục bộ

```sh
python3 scripts/ops/team_supervisor.py status
python3 scripts/ops/team_supervisor.py sweep --full
python3 scripts/ops/team_supervisor.py digest --send
python3 scripts/ops/team_supervisor.py pause
python3 scripts/ops/team_supervisor.py resume
python3 -m unittest discover -s scripts/ops -p test_team.py -v
```

Sổ/báo cáo/runtime: `~/Library/Application Support/PickleHub/team-v2/` (0700;
DB và reports 0600). Backup SQLite nhất quán sau mỗi tick tại team-backup.sqlite3.
Đây là backup cùng máy, chưa thay thế backup ngoài máy hoặc backup DB sản phẩm.
Logs tại `~/Library/Logs/PickleHub/team-v2*.log`.

Đọc production dùng adapter credential hiện có, chỉ allowlist các phép GET và
RPC health đã biết. Service-role hiện vẫn ở lớp controller; chưa tạo DB role chỉ
đọc riêng. Cần chuyển sang credential hạn quyền khi triển khai tầng dữ liệu tiếp.

## Cài đặt, cập nhật và khôi phục

Installer từ chối thay lịch nếu agent cũ đang chạy. Backup có plist và source cũ
đúng trạng thái lúc cài, gồm các thay đổi chưa commit. Nếu bootstrap thất bại,
installer nạp lại những lịch cũ đã dừng.

```sh
python3 scripts/ops/team_install.py install
python3 scripts/ops/team_supervisor.py pause
# Đợi current run kết thúc, rồi:
python3 scripts/ops/team_install.py rollback
```

Rollback chỉ khôi phục lịch cũ, không reset repo, xóa tasks hoặc hoàn tác thay đổi
sản phẩm. Muốn phát hành runtime mới: pause, đợi idle, rollback rồi install bản
đã test. installation.json ghi snapshot/runtime chính xác đang dùng.

## Phần cần triển khai tiếp, không coi là đã tự động hóa

1. QA thực thi trong sandbox và approval gắn đúng patch/commit; sau đó mới bật PR,
   merge/publish cho phạm vi đã duyệt. Hiện agent tạo patch và giữ chờ review.
2. DB role chỉ đọc theo nghiệp vụ; sổ việc/approval trên Supabase khi cần nhiều
   máy, với kiểm thử RLS và chiến lược chuyển dữ liệu SQLite.
3. Monitor ngoài máy cho heartbeat đội; watchdog hiện chỉ phát hiện supervisor
   chết khi chính máy và mạng vẫn hoạt động. Site uptime cloud giữ nguyên.
4. Commerce đối soát giao dịch đầy đủ, fulfillment và hồ sơ Zalo; Sports check
   đăng ký/sức chứa/bracket theo lịch giải; Support thêm inbox CSKH thật.
5. Native crash/review Store, restore drill sản phẩm định kỳ, DB/storage/cost API.
6. Funnel và cohort retention: GA4 snapshot có VN events/totals, chưa chứng minh
   event semantics hay dựng funnel có thứ tự. Dữ liệu thiếu không tính bằng 0.

Đây là rollout vận hành an toàn đang dùng thực tế, không phải tuyên bố toàn bộ
lộ trình sáu tuần hoặc mọi nhiệm vụ kinh doanh đã tự động hoàn tất.
# Update 13 September 2026: Codex and Telegram queue

Provider selection is now available through `/xuly team provider codex` or
`/xuly team provider claude`, without an AI call. Current selection is Codex,
verified with a live runtime probe. Codex is report-only, read-only and ephemeral;
it does not yet use the Claude isolated-worktree edit path. Subscription cost
is unknown, not free; the same conservative reservation and 12-call cap remain.
Blocked tasks now receive a deduplicated explanation, and start messages are
sent after budget reservation. See [incident report](team-v2-telegram-incident-2026-09-13.md)
for T47/T48 status and verified Telegram receipts. Earlier Claude-only statements
below describe the initial deployment.
