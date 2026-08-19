# Pre-mortem: live-viewer-count-comparison

**Giả định kịch bản (dữ kiện, không phải giả thuyết):** Cách B (heartbeat 3 bước — ô nóng / đếm người / ai rời đi) đã thay thế Supabase Realtime Presence trên production ba tuần trước. Nó đã hỏng. Dưới đây là ba bản tường thuật về **chuyện đã xảy ra**.

Mọi mắt xích đều trỏ tới file có thật trong repo hôm nay. Nơi nào Cách B "sẽ làm gì", tôi giả định nó **sao chép pattern sẵn có trong nhà** — vì đó là đường ít kháng lực nhất và là đường repo này đã đi 3 lần (`view_events` → `view_counts` → `view_event_rate_limits`).

---

## Sự cố 1 — "Chung kết Giải VĐQG: cả site 503 lúc 21:47, đếm viewer là ngòi nổ"

**Xác suất:** Trung bình · **Thời gian tới lúc phát hiện:** ~4 phút (rất ồn) · **Thời gian tới lúc chẩn đoán đúng:** ~50 phút

### Timeline (giờ VN)

- **T+0 — 20:30.** Stream chung kết lên sóng. Peak ~2.600 concurrent (cao gấp ~8 lần bất kỳ đêm nào từ khi Cách B lên).
- **T+18′ — 20:48.** Bảng đếm hoạt động bình thường. Chat mượt. Không có gì bất thường trong `/admin/jobs`.
- **T+62′ — 21:32.** Chat bắt đầu trễ 5–10 giây. Vài người bình luận "chat lag". Không ai coi là sự cố.
- **T+77′ — 21:47.** REST 503 rải rác. Trang chủ trắng. Đăng nhập fail. Người đang xem thì vẫn xem được (Mux CDN không đi qua Supabase) — nên **không ai rời đi**, và mỗi tab vẫn tiếp tục bắn heartbeat.
- **T+80′ — 21:50.** Cuong mở `postgrest_logs`, thấy `PGRST002 Could not query the database for the schema cache. Retrying` — giống hệt outage 02/08. Áp playbook cũ: restart project qua Management API.
- **T+88′ — 21:58.** Restart xong. Site sống lại **9 phút**.
- **T+97′ — 22:07.** 503 quay lại. Đây là chỗ playbook 02/08 gãy: lần trước restart là thuốc; lần này nguồn tải vẫn còn nguyên trên 2.600 tab đang mở.
- **T+110′ — 22:20.** Deploy hotfix tắt heartbeat ở client. Cloudflare Pages build ~4′. **Không ăn thua** — SW dùng `NetworkFirst` cho navigation, nhưng 2.600 tab đang xem live thì không ai reload giữa trận chung kết. Client cũ vẫn bắn.
- **T+126′ — 22:36.** Cuong `REVOKE EXECUTE` RPC đếm/ghi heartbeat khỏi `service_role` caller (đúng hơn: xoá edge function). Ghi heartbeat chết. Site hồi trong 90 giây.
- **T+150′ — 23:00.** Trận kết thúc. Số người xem hiển thị suốt 40 phút cuối: 0.

### Cơ chế

`supabase/migrations/20260113014818_*.sql:31-48` → trigger `increment_view_count()` UPSERT vào `view_counts` **một dòng duy nhất cho mỗi target**. Hôm nay vô hại: `useIntervalViewCounter.ts:69-74` chỉ tick 1 event/30s và **có trần 20 event/session** (`maxEventsPerSession`, dòng 43). Một livestream 4 giờ = tối đa 20 lần chạm dòng đó trên mỗi tab.

`supabase/migrations/20260715160000_view_event_rate_limits.sql:74-87` → pattern "ô nóng" của nhà: `INSERT ... ON CONFLICT (identity_hash, window_start) DO UPDATE`. Cách B sao chép đúng pattern này cho bước 1 ("ô nóng") vì nó đã ở đó và nó đúng ngữ nghĩa fixed-window.

→ **Cách B bỏ trần session.** Bắt buộc phải bỏ: một bộ đếm *concurrent* mà tắt sau 10 phút thì không còn là concurrent. Heartbeat 10s, không trần.

→ 2.600 viewer × 6 heartbeat/phút = **260 write/giây, tất cả đập vào cùng một tuple** `(livestream_id, bucket_start)` của ô nóng. Postgres tuần tự hoá UPDATE trên cùng một dòng: mỗi transaction phải đợi transaction trước commit. Mỗi kẻ đang đợi **giữ một connection**.

→ Pool PostgREST trên compute Micro (nâng lên `ci_micro` tối 02/08, memory `incident-2026-08-02-pgrst002-outage`) cạn. Từ giây đó, **mọi** query REST của toàn site xếp hàng sau hàng đợi lock của bộ đếm viewer: giải đấu, feed, profile, đăng nhập.

→ `supabase/migrations/20260715160000_view_event_rate_limits.sql:71-72` → mỗi lần gọi còn chạy thêm `DELETE FROM ... WHERE window_start < now() - interval '2 days'` **trên hot path**. Với 260 call/giây, GC nội tuyến này tự nó là 260 DELETE/giây, sinh WAL và dead tuple.

→ Khối lượng WAL tăng vọt kéo theo `useChatMessages.ts:168` — chat đăng ký `postgres_changes` trên `chat_messages`. Realtime và Postgres dùng chung một instance Micro. Chat trễ 5–10s ở T+62′ **là dấu hiệu sớm của sự cố 503**, chỉ là không ai đọc nó như vậy.

→ PostgREST mất connection lành → truy vấn lại schema cache → `PGRST002` retry loop, chính xác cái failure mode **tự khuếch đại, không tự hồi** của 02/08.

### Vì sao mọi gate vẫn xanh

1. **Không có gate nào chạy ở concurrency > 1.** Vitest, Playwright smoke, soak — tất cả đều một máy, một tab. Lock convoy trên một tuple là hiện tượng **chỉ tồn tại khi có đồng thời**. 260 write/giây không phải là thứ pipeline này biết đo.
2. **`soak-watch.mjs` mù đúng loại lỗi này.** `docs/ops-runbook.md:365-368` tự khai: "*it only sees browser errors, so an edge-function 500 that never reaches a browser is invisible*". 503 từ PostgREST đi vào `catch` của client và bị nuốt (pattern `useIntervalViewCounter.ts:88-93` chỉ `console.error`) → không có `client_errors` row → soak 30 phút sạch tinh.
3. **`risk-tier.mjs` chấm RED nhưng RED sai trục.** `docs/ops-runbook.md:337-341`: RED = "*git revert does not undo it*". Migration nào cũng RED. Không có trục nào hỏi "**cái này thêm bao nhiêu write/giây tỉ lệ thuận với số người dùng đồng thời?**". Một migration thêm cột và một migration thêm 260 write/s vào cùng một tuple nhận cùng một verdict.
4. **Deploy guard đỏ kinh niên nên không ai đọc.** Memory `deploy-guard-migration-drift-chronic`: gate này ĐỎ trên mọi commit main từ 04/08 với 10 file drift. Tín hiệu bằng không.
5. **Soak chạy lúc 15:00 với 3 viewer.** Không giờ nào trong ngày làm việc giống 21:47 đêm chung kết.

### Ai báo, sau bao lâu

Cuong tự thấy — anh đang cầm điện thoại theo dõi chat của chính buổi stream mình vận hành. ~4 phút sau T+77′. Song song: bình luận Facebook "web sập rồi". Phát hiện nhanh; **chẩn đoán** mới là chỗ mất 50 phút, vì triệu chứng (`PGRST002`) trùng khít với một sự cố có thật đã có playbook, và playbook đó lần này **sai**.

### Vì sao khó sửa

- `git revert` **không dập được tải**. Nguồn tải nằm trên 2.600 tab của người khác, đang xem live, không reload. Deploy client-side là công cụ sai.
- Đòn bẩy duy nhất là server-side, và Cách B (như mọi tính năng trong repo này) **không có kill switch**. Việc đã làm — xoá/thu hồi quyền edge function — là phá hoại có kiểm soát, không phải rollback.
- `system_settings` đã tồn tại và đã được đọc runtime (`useSystemSettings` trong `WatchLive.tsx:47`) — một cờ ở đó sẽ biến 50 phút thành 30 giây. Không ai nghĩ cần.
- Restart project **phải do Cuong tự chạy** (classifier chặn agent POST /restart, memory 02/08) → mỗi vòng thử-sai tốn thêm một round-trip người.

### Dấu hiệu sớm lẽ ra phải có

Chat trễ 5–10s ở T+62′, tức **15 phút trước** khi 503 đầu tiên xuất hiện. Nó nằm trong màn hình của chính Cuong. Không có gì biến "chat lag" thành một tín hiệu — không alert, không dashboard, và nó không thuộc SLO nào trong `docs/slo.md`. Cái đáng lẽ phải tồn tại: một con số "write/giây vào bảng ô nóng" trong digest Telegram sáng, và một ngưỡng.

---

## Sự cố 2 — "Chung kết hiển thị 41 người đang xem trong khi thực tế ~2.600 — sai suốt 3 tuần, phát hiện vì một nhà tài trợ hỏi"

**Xác suất:** Cao · **Thời gian tới lúc phát hiện:** 21 ngày

### Timeline (giờ VN)

- **T+0 — ngày 1.** Cách B lên prod. Trên máy Cuong, trên preview, trên soak: 1 viewer → hiện 1. Chính xác tuyệt đối.
- **T+2 ngày.** Stream đầu tiên có khán giả thật (~180 người). Hiển thị đỉnh: 23. Không ai đối chiếu với gì cả — **Presence đã bị gỡ, không còn nguồn thứ hai để so.**
- **T+9 ngày.** Một buổi stream giải phong trào: số người xem **giảm** từ 31 xuống 19 trong khi chat sôi động nhất. Cuong nghĩ "trận chán, người ta bỏ đi". Ghi chú tinh thần, không ghi ticket.
- **T+16 ngày.** Trên iPhone, Cuong để app chạy nền 2 phút rồi mở lại → thấy số nhảy 27 → 12 → 27. Cho là "realtime nó thế".
- **T+21 ngày.** Ban tổ chức một giải hỏi con số người xem để làm báo cáo tài trợ. Cuong tra: đỉnh 41. Đối chiếu hoá đơn băng thông Mux của buổi đó: hàng nghìn phiên phát. **Lệch hai bậc độ lớn.** Mới biết đã sai 3 tuần.

### Cơ chế

Bốn thứ vô hại gặp nhau. Không cái nào ném exception.

**(a) Danh tính bị gộp — CGNAT.** Bước 2 "đếm người" = `COUNT(DISTINCT identity)` trong ô nóng. Cách B dựng identity đúng như hàng xóm của nó: `supabase/functions/batch-view-events/index.ts:85` → `user ? 'user:'+user.id : 'ip:'+clientIp`, với IP lấy từ `supabase/functions/_shared/view-events.ts:116-125` (`cf-connecting-ip`).

95% khán giả là người Việt, phần lớn xem trên 4G Viettel/VNPT/Mobifone — **CGNAT**: hàng nghìn thuê bao chia nhau một dải IP public nhỏ. `DISTINCT ip` gộp cả một pool NAT thành **một người xem**.

Presence không bao giờ dính lỗi này vì nó đánh khoá theo **tab**, không theo danh tính: `src/hooks/useLivePresence.ts:75` → `viewer_${uniqueChannelSuffix()}`, và comment ngay trên đó (dòng 74) nói thẳng: "2 account hay 2 tab đều là 2 viewer".

**(b) Đếm trùng ngược chiều — nhiều bề mặt cùng trang.** `useLivePresence.ts:133-154` có registry refcount để hero + card + watch page dùng chung **một** connection. Một hook heartbeat viết theo lối thông thường (mount → `setInterval`, như `useIntervalViewCounter.ts:56-96`, hook này **không** có refcount) sẽ bắn 2 lần từ cùng một tab khi cả `LiveBroadcastHero.tsx:146-152` lẫn `WatchLive.tsx:75` cùng sống.

→ **User đăng nhập bị đếm dư, user ẩn danh bị đếm thiếu.** Hai sai số ngược dấu triệt tiêu nhau một phần. Kết quả không phải 0, cũng không phải một triệu — nó là **một con số hợp lý**. Con số hợp lý thì không ai kiểm tra. Đây là lý do trung tâm khiến sự cố sống được 3 tuần.

**(c) Rate limit biến khán giả đông thành khán giả ít.** Nếu heartbeat tái dùng `consume_view_event_rate_limit` (RPC đã có sẵn, đúng ngữ nghĩa fixed-window — không có lý do gì viết cái thứ hai), thì `batch-view-events/index.ts:19` `ANONYMOUS_EVENT_LIMIT = 600` / 10 phút **trên mỗi identity hash**. Với CGNAT, identity hash = cả một pool nhà mạng. 600 heartbeat/10 phút cho toàn bộ thuê bao Viettel đang xem = cạn trong vài giây.

→ Từ đó về sau: 429 (`index.ts:101-107`). Heartbeat rớt. Bước 3 "ai rời đi" thấy hết heartbeat → **đánh dấu đã rời**.

→ **Càng đông người xem, con số càng nhỏ.** Chính xác là hiện tượng T+9 ngày, và nó trông y hệt "người ta bỏ đi".

**(d) Im lặng tuyệt đối.** `useIntervalViewCounter.ts:88-93` — cái khuôn mà heartbeat sẽ được đúc theo — bắt lỗi rồi chỉ `console.error`. `src/lib/errorReporter.ts:105,121` chỉ hook `window.addEventListener("error")` và `"unhandledrejection"`. **Một lỗi đã bị catch thì vĩnh viễn không bao giờ thành một dòng `client_errors`.**

→ Không có `client_errors` → ngân sách OPS-04 (`docs/slo.md:30-37`, 3000 row/30 ngày) không hao → không Telegram. Và ngay cả khi có: P2 burn bị **chặn trong khung giờ yên lặng 22:00–07:00 ICT** (`docs/slo.md:36-37`) — tức là **đúng khung giờ livestream prime time** của platform này.

**(e) Phụ, nhưng làm số nhảy múa.** iOS Safari/PWA đóng băng `setInterval` khi tab chạy nền hoặc khoá màn hình. Người xem vẫn đang nghe → heartbeat ngắt → quá TTL → "đã rời". Mở khoá → quay lại. Presence không dính vì heartbeat của nó nằm ở tầng websocket phía server, không phải một `setInterval` trong JS.

### Vì sao mọi gate vẫn xanh

1. **Unit test mock trọn bộ Supabase client.** `src/hooks/__tests__/useLivePresence.core.test.ts:29-58` thay `supabase.channel/getChannels/removeChannel` bằng fake. Test tương đương cho Cách B sẽ kiểm **phép toán đếm** — và phép toán đúng. Cái sai là **đầu vào**: identity. Không test nào trong repo có hai IP.
2. **CI, Playwright, soak đều chạy từ một địa chỉ.** 1 client → 1 identity → đếm ra 1 → khớp kỳ vọng. Gate xác nhận đúng cái trường hợp duy nhất mà bug không tồn tại.
3. **Soak sạch vì không có gì ném ra.** `docs/ops-runbook.md:361-363`: soak bắt **signature lỗi mới**, không bắt volume, và "*a clean soak means nothing threw that never threw before — not that anyone used the feature*". Ở đây không những không ai dùng, mà kể cả có dùng thì 429 cũng nằm trong `catch`.
4. **Panel duyệt vì đề bài là "đủ đúng và đủ nhanh".** Trên bàn duyệt, "1 người xem → hiện 1" trông đúng nghĩa đen. Không ai đặt tên cho CGNAT vì nó không phải một hạng mục trong checklist nào.
5. **Không có gate nào đối chiếu số mới với một nguồn độc lập.** Và không thể có: Mux Data **chưa từng được tích hợp** ở bất cứ đâu trong `src/` hay `supabase/functions/` — repo chỉ dùng `mux_playback_id`/`mux_stream_key` ở `CreatorLivestreamForm.tsx:134-136`. Gỡ Presence = **xoá nguồn sự thật duy nhất còn lại**.

### Ai báo, sau bao lâu

**21 ngày**, và không phải do hệ thống — do một câu hỏi của con người từ bên ngoài (ban tổ chức xin số liệu tài trợ). Không alert nào nổ, không exception nào ném, không test nào đỏ, không dòng log nào bất thường. Nếu không ai hỏi, nó còn chạy tiếp.

### Vì sao khó sửa

- **Revert thì dễ**: Presence quay lại trong một deploy, 5 phút. Đây là phần rẻ.
- **Dữ liệu thì không.** Nếu Cách B lưu lịch sử ô nóng (nó sẽ lưu — "ô nóng" có lịch sử là analytics miễn phí, không ai xoá thứ trông có giá trị), thì 3 tuần số liệu người xem trong bảng đó **sai và không thể tính lại**: không tồn tại nguồn ground truth nào để backfill. Chỉ có thể **xoá**, không thể **sửa**.
- **Con số đã ra khỏi hệ thống.** Nó đã nằm trong báo cáo gửi ban tổ chức, có thể trong deck gọi vốn (memory `fundraising-valuation-notes`). Cái này `git revert` không lấy lại được.
- Sửa gốc cũng không tầm thường: đếm đúng sau CGNAT **bắt buộc** phải có một khoá per-tab do client sinh, tức là đúng thứ Presence đã cho miễn phí ở `useLivePresence.ts:75`.

### Dấu hiệu sớm lẽ ra phải có

Có sẵn, đã hiển thị, và bị đọc sai: **số người xem đi xuống trong khi tốc độ chat đi lên** (T+9 ngày). Hai đại lượng đó chưa bao giờ được vẽ cạnh nhau nên nghịch lý không thành hình. Rẻ đến mức đáng xấu hổ: log cả hai vào cùng một dòng, mỗi 5 phút, cho một stream.

---

## Sự cố 3 — "Cron dọn dẹp chưa từng chạy một lần nào: 34 ngày sau, trang chủ chậm dần rồi tắc"

**Xác suất:** Cao · **Thời gian tới lúc phát hiện:** 34 ngày (và phát hiện nhầm chỗ)

### Timeline (giờ VN)

- **T+0.** Migration Cách B áp lên prod qua Management API query endpoint (đường Cuong đã cho phép, memory `supabase-prod-sql-workflow`). Bảng ô nóng được tạo. Khối `cron.schedule(...)` cho job dọn dẹp **âm thầm không tạo được job** (job cần `v_command` dựng từ Vault như pattern ở `20260715130000_ops_cron_health.sql:261,299,333` — một bản sao lệch là một job không tồn tại, hoặc một job 401 mãi mãi).
- **T+0 + 5 phút.** Deploy guard đỏ. **Nó vốn đã đỏ từ 04/08 với 10 file drift** (memory `deploy-guard-migration-drift-chronic`). Dòng đỏ thứ 11 không phân biệt được với 10 dòng kia.
- **T+1 ngày.** `/admin/jobs` xanh toàn bộ. Đúng — nó hiển thị **roster**, mà roster là danh sách viết tay (`supabase/migrations/20260804120000_ops_monitoring_coverage_expansion.sql:17-23`). Job không có trong roster thì không có trạng thái để mà đỏ.
- **T+8 ngày.** Bảng ô nóng ~30 triệu dòng (hoặc 30 triệu dead tuple nếu là upsert). Truy vấn đếm còn 40ms. Không ai để ý.
- **T+19 ngày.** Trang chủ chậm thấy được trên 4G. LCP p75 mobile trượt. `web_vital` RUM có ghi nhận — nhưng `docs/slo.md` mục "Known gaps" ghi rõ **per-SLO burn wiring vẫn thủ công**. Không ai chạy tay.
- **T+31 ngày.** Truy vấn đếm ~1,8s. Trang chủ (`LiveBroadcastHero.tsx:146-152`) và mọi live card (`LiveCardWithPresence.tsx:44`) đều gọi nó → **mọi khách vào trang chủ đều trả giá, không chỉ người đang xem live.**
- **T+34 ngày — 20:15, có stream.** Cuong thấy trang chủ ì, chạy `DELETE FROM <bảng ô nóng> WHERE bucket_start < now() - interval '1 day'` để "dọn nhanh". 40 triệu dòng. WAL burst + transaction dài + autovacuum không theo kịp → **site chậm rồi 503 ngay giữa buổi stream.** Việc dọn dẹp chính là thứ gây outage.

### Cơ chế

`supabase/migrations/20260715160000_view_event_rate_limits.sql:71-72` → pattern của nhà là **GC nội tuyến trên hot path**: mỗi lần gọi RPC đều `DELETE ... WHERE window_start < now() - interval '2 days'`. Cách B sao chép.

`supabase/migrations/20260715210000_view_event_rate_limits_window_index.sql:1-12` → **lần trước đội đã quên index đỡ cho chính DELETE đó**, phải vá bằng một migration đi sau. Comment trong file viết sẵn kịch bản này: "*the primary key is (identity_hash, window_start), whose leading column is identity_hash, so a window_start-only predicate cannot use it — the delete degrades to a sequential scan as the table grows... exactly where a scan hurts under load*".

→ Bảng ô nóng khoá `(livestream_id, bucket_start, identity_hash)`. Vị từ chỉ theo `bucket_start` **lại** không dùng được leading column. **Cùng một cái bẫy, cùng một file làm chứng, lần thứ hai.**

`docs/cron-schedules.md:82-85` → cron Supabase chạy **UTC**, không phải ICT. Một job dọn "03:00" viết tay ở ICT thực tế chạy 10:00 sáng — giữa giờ có traffic.

Memory `cron-auth-gate` + `docs/cron-schedules.md:30` → tiền lệ đã có: `auto-archive-tournaments` **được ghi trong bảng lịch như đang hoạt động, nhưng không hề có pg_cron job nào**. Tài liệu ≠ đã lên lịch. Repo này đã mắc đúng lỗi đó một lần.

`docs/slo.md` SLO 5 → "*expand roster when new crons land*" — một **bước thủ công của con người**. Bỏ qua bước đó thì `ops_cron_alert_state` không có dòng nào, và trạng thái `never_ran` không thể bắn cho một monitor không tồn tại. **Hệ thống giám sát cron không phát hiện được cron mà nó không biết là có.**

### Vì sao mọi gate vẫn xanh

1. **Gate lẽ ra bắt được nó — migration drift — đã đỏ sẵn 30 ngày.** Một gate đỏ vĩnh viễn là một gate tắt. Memory `deploy-guard-migration-drift-chronic` còn ghi thêm: **cấm** vá bằng cách chèn ledger mù, vì có file thật sự chưa áp. Nghĩa là repo đã biết trước "một migration trong danh sách có thể chưa chạy thật" và vẫn không có cách nào chỉ ra là cái nào.
2. **CI không thi hành ràng buộc "cron mới → phải vào roster".** Không có test nào so `cron.schedule` trong migration với `INSERT INTO ops_cron_monitors`. `edge-auth-parity` làm đúng loại đối chiếu này cho edge function (`docs/ops-runbook.md:224-231`) — cron **không** có bản tương đương.
3. **Soak 30 phút không thể thấy một rò rỉ 34 ngày.** Ở phút 30 bảng có ~50 nghìn dòng và mọi thứ nhanh.
4. **Không có exception nào.** Truy vấn chậm dần không phải lỗi. Không `client_errors`, không đỏ.
5. **Panel duyệt vì có cleanup trong thiết kế.** Có trong file migration. Không ai kiểm chứng nó **đang chạy trên prod** — mà đó chính là khác biệt giữa `docs/cron-schedules.md` và thực tế mà tiền lệ `auto-archive-tournaments` đã dạy.

### Ai báo, sau bao lâu

Không ai, trong 34 ngày. Cuối cùng phát hiện qua **triệu chứng sai chỗ** (trang chủ chậm), rồi cách xử lý phản xạ cho triệu chứng sai chỗ đó biến rò rỉ chậm thành outage giữa giờ stream. Đường phát hiện thay thế cũng có thể là email cảnh báo dung lượng đĩa của Supabase — cũng là bên ngoài, cũng không phải gate nào.

### Vì sao khó sửa

- Revert code chặn được **nguồn ghi mới**, không đụng được **40 triệu dòng đã có**.
- Bản thân việc dọn là thao tác nguy hiểm nhất trong toàn bộ câu chuyện: DELETE hàng loạt sinh WAL burst; `VACUUM FULL` lấy `ACCESS EXCLUSIVE` → truy vấn đếm bị chặn → trang chủ 503. Đúng cách là batch + off-peak, và off-peak của platform này là 03:00–05:00 sáng.
- **Không biết chắc cái gì đã áp.** Sổ ledger `schema_migrations` đã lệch 10 dòng; muốn biết job dọn có tồn tại không phải đi soi `cron.job` bằng tay.
- Cuong phải tự chạy phần lớn thao tác prod (classifier chặn agent) → mỗi vòng đều là round-trip người.

### Dấu hiệu sớm lẽ ra phải có

**Một con số: số dòng trong bảng ô nóng.** Digest Telegram buổi sáng đã tồn tại và đã chạy hằng ngày — nó báo cáo *sức khoẻ cron*, không báo cáo *kích thước bảng*. Một job dọn chết im lặng thì không có gì để báo; một bảng phình 30 triệu dòng thì có. Đo cái quan sát được, đừng đo cái được cho là đang chạy.

---

## Xếp hạng

| # | Sự cố | Xác suất | Khó phát hiện | Ưu tiên |
|---|---|---|---|---|
| 1 | **#2 — Đếm sai âm thầm (CGNAT + rate limit + lỗi bị nuốt)** | Cao | Rất cao — 21 ngày, phát hiện bởi người ngoài, không alert/exception/test nào chạm tới | **P1** |
| 2 | **#3 — Cron dọn chưa từng chạy** | Cao | Cao — 34 ngày, gate duy nhất có thể bắt thì đã đỏ kinh niên | **P2** |
| 3 | **#1 — Outage đêm chung kết** | Trung bình | Thấp — 4 phút | **P3** |

**Vì sao #1 xếp cuối dù nó đắt nhất trong một đêm:** nó ồn. Ồn thì được sửa. Sự cố #2 giao một con số **hợp lý và sai** cho ban tổ chức, nhà tài trợ, và có thể cho slide gọi vốn, trong ba tuần — và không có nguồn sự thật nào để tính lại. Outage thì `git revert` + restart là xong; niềm tin vào con số thì không.

**Cảnh báo về xác suất kết hợp:** ba sự cố này **không loại trừ nhau**. #2 và #3 gần như chắc chắn cùng tồn tại (chung một lần triển khai), và #3 làm truy vấn đếm chậm dần, tức là nó **nạp đạn** cho #1: bảng càng phình thì ngưỡng concurrent gây convoy càng thấp. Đêm chung kết ở tuần thứ 5, không phải tuần thứ 1.

---

## Rẻ nhất để chặn từ bây giờ

1. **Chạy song song (shadow mode) 2 tuần, log cả hai số.** Giữ nguyên `useLivePresence` (nó ghi 0 byte vào DB — chi phí thật sự bằng không), cho Cách B chạy cạnh, và log `{presence_count, hotcell_count, chat_msgs_5m}` mỗi 5 phút cho mỗi stream đang live. Lệch > 20% = bug. Đây là **liều thuốc duy nhất** cho sự cố #2 và nó là thứ rẻ nhất trong danh sách này, vì nguồn đối chiếu độc lập không tồn tại ở nơi nào khác (Mux Data chưa tích hợp).
2. **Một cờ kill switch trong `system_settings`, đọc phía server trước khi ghi.** Bảng và hook đã có (`useSystemSettings`, dùng ở `WatchLive.tsx:47`). Biến 50 phút xử lý sự cố #1 thành 30 giây, và không phụ thuộc vào việc client chịu reload.
3. **Đừng nuốt lỗi flush.** Ở `catch` của heartbeat, báo 429/5xx về `log-client-event` thay vì `console.error`. Một dòng. Nó là điều kiện tiên quyết để `soak-watch.mjs`, ngân sách client-error, và alert Telegram **có bất kỳ khả năng nào** nhìn thấy sự cố #2. Hiện tại cả ba đều mù về mặt cấu trúc.

*(Thêm nếu vẫn quyết ship: một assert trong CI so danh sách `cron.schedule` trong `supabase/migrations/` với `INSERT INTO ops_cron_monitors` — đúng khuôn `edge-auth-parity` đã có sẵn cho edge function.)*

---

## Khoảng hở của pipeline mà bài này lộ ra

Phản hồi cho chính `/idea`:

1. **Không gate nào chạy ở concurrency > 1.** Vitest, Playwright, soak — tất cả một tab, một IP, một danh tính. Một tính năng mà **rủi ro duy nhất là tính đồng thời** sẽ qua 100% cổng. Cả sự cố #1 (lock convoy) lẫn #2 (CGNAT) đều sống trong đúng điểm mù này, và điểm mù này không được đặt tên ở đâu.
2. **`risk-tier.mjs` chỉ có một trục: revert có hoàn tác được không.** Không có trục "khối lượng ghi tỉ lệ thuận với số người dùng đồng thời". Migration thêm cột và migration thêm 260 write/giây vào cùng một tuple → cùng verdict RED. Verdict không phân biệt được thứ cần load test với thứ không.
3. **`soak-watch.mjs` mù cấu trúc với lỗi đã bị catch.** Tự tài liệu thừa nhận (`docs/ops-runbook.md:365-368`). Vì repo này ở đâu cũng dùng khuôn `catch { console.error }` (`useIntervalViewCounter.ts:88-93` là điển hình), **bất kỳ tính năng nào hỏng theo kiểu "degrade lặng lẽ" đều vô hình với toàn bộ pipeline.** Không phải yếu điểm của soak — là yếu điểm của giả định rằng soak đo được thứ gì đó.
4. **Deploy guard đỏ 30 ngày = một gate đã tắt.** Còn tệ hơn không có gate: nó vẫn chiếm ô "đã kiểm tra" trong bảng checklist. Bất kỳ vòng `/idea` nào coi CI xanh/đỏ là dữ liệu cần biết gate nào đang mù, và biết trước khi duyệt.
5. **Không có bước "đối chiếu số mới với nguồn độc lập" trong pipeline.** Cách B thay thế một hệ thống đo lường bằng hệ thống khác. Không cổng nào hỏi: *thứ mới có ra cùng đáp số với thứ cũ không, trên traffic thật, trước khi gỡ thứ cũ?* Thiếu câu hỏi này thì mọi sự cố hạng "đếm sai âm thầm" đều lọt — và đó là hạng ăn mòn niềm tin.
6. **Panel duyệt theo tiêu chí do người đề xuất đặt ra.** Ở đây tiêu chí là "đủ đúng và đủ nhanh". Không ai hỏi *đúng theo thước đo nào* — và nếu ta gỡ thước đo cũ đi thì câu hỏi đó vĩnh viễn không có đáp án.
