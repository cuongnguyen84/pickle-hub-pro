## Bảng bất đồng — auto-milestone-run-2026-07

| # | Chủ đề | Các phía | Vòng 2 | Trạng thái | Kết luận |
|---|--------|----------|--------|------------|----------|
| D1 | Cơ chế mốc: artifact + vòng đời — file markdown trong repo (tick [x]) hay GitHub Issue + /done qua Telegram; watchdog heartbeat | **solution-architect**: docs/milestones.md là source of truth duy nhất + scripts/due-milestones.mjs đọc đầu phiên + cron Telegram ping<br>**ui-ux-critic**: Telegram = bề mặt đánh thức, GitHub Issue = bản ghi bền, vòng đời open/done qua /done trong telegram_queue, nh<br>**risk-auditor**: GH Actions schedule CHỈ mở issue (idempotent). GREEN chỉ khi reminder/issue; RED nếu autonomous executor tự ch | **solution-architect**: REFINE<br>**ui-ux-critic**: REFINE<br>**risk-auditor**: REFINE | 🔶 OPEN_FOR_CUONG | **cần Cuong quyết** |
| D2 | OPS-04 v1: phạm vi + cửa sổ đo — uptime pinger tối thiểu hay SLO state machine; burn 30-ngày hay 24h | **solution-architect**: inc1 = uptime pinger GH Action (0.5 hd, bịt gap SLO-1 duy nhất slo.md nêu). inc2 OPTIONAL = burn-rate từ SQL s<br>**ui-ux-critic**: State machine: chỉ alert healthy→breached (rolling 24h, eval giờ, 3 lần liên tiếp, min-sample), night-quiet, r<br>**risk-auditor**: Burn PHẢI theo cửa sổ 30-ngày rolling (slo.md); ratio 10-phút/24h là đo sai. Dedup state-transition, nguồn ser | **solution-architect**: REFINE<br>**ui-ux-critic**: REFINE<br>**risk-auditor**: REFINE | 🔶 OPEN_FOR_CUONG | **cần Cuong quyết** |
| D3 | QA-04: DUPR SSO hard-fail — test.fixme sau điều tra env-only (kèm monitor), hay cấm fixme hoàn toàn | **solution-architect**: Điều tra trước (curl CSP + click tay). Env-only → test.fixme kèm lý do + backlog. Bug prod → PR riêng.<br>**risk-auditor**: CẤM skip/fixme trên auth, /match/confirm, DUPR SSO trong mọi PR stabilize; grep-gate skip\|fixme = fail.<br>**ui-ux-critic**: Hard-fail phải triage product-or-stale, KHÔNG skip. | **solution-architect**: REFINE<br>**risk-auditor**: REFINE<br>**ui-ux-critic**: REFINE | 🔶 OPEN_FOR_CUONG | **cần Cuong quyết** |
| D4 | QA-04: chiến lược session auth — storageState mint 1 lần/role, hay user+magic-link mới mỗi test | **solution-architect**: Root cause = magiclink single-use bị vô hiệu chéo giữa worker song song cùng email cố định. Fix: setup project<br>**risk-auditor**: User+link MỚI mỗi test, consume 1 lần, fail ngay. storageState nằm trong grep cảnh giác false-green — E2E mất  | **solution-architect**: REFINE<br>**risk-auditor**: CONCEDE (`tests/helpers/supabase-admin.ts:64-95 — mintSessionForEmail `) | ✅ RESOLVED_EVIDENCE | storageState setup-project THẮNG bằng bằng chứng: setup vẫn exercise verifyOtp thật mỗi run + fail-hard. Kèm 3 điều kiện gộp từ hai phía: (1) hasAuthEnv chuyển fail-HARD trên main (không fail-open); (2) thêm 1 canonical test nối tiếp tiêu thụ fresh magic-link full-flow; (3) must-verify token-refresh từ session seeded qua wall-time > TTL trước khi coi race đã dập. |
| D5 | GA4 chuẩn bị cho mốc funnel (02/08) + badge (04/08): đăng ký custom dimensions ngay hay chờ ngày mốc | **solution-architect**: KHÔNG mở rộng GA4 bây giờ — địa hạt mốc tương lai, cần ~1 tuần RUM.<br>**ui-ux-critic**: BLOCKER làm NGAY: custom dimensions không hồi tố — chưa đăng ký thì 02/08-04/08 không có lịch sử, mốc mù. Mở r | **solution-architect**: REFINE<br>**ui-ux-critic**: HOLD | 🔶 OPEN_FOR_CUONG | **cần Cuong quyết** |
| D6 | GA4 có được làm MỘT nguồn đo SLO-2 burn không (phát sinh vòng 2, chưa đối chất — chỉ liên quan khi làm OPS-04 inc2 burn-alert, hiện deferred) | **solution-architect**: slo.md:11 định nghĩa nguồn SLO-2 = 'GA4 funnel events (BASE-02) + client_errors auth-tagged rows' — blanket-ba<br>**risk-auditor**: Nguồn đo auth/registration = Supabase server-side, không phải GA4 (GA4 bot pollution → false-alert/false-silen |  | 🔶 OPEN_FOR_CUONG | **cần Cuong quyết** |

### 🔶 Cần anh quyết (5)

**D1 — Cơ chế mốc: artifact + vòng đời — file markdown trong repo (tick [x]) hay GitHub Issue + /done qua Telegram; watchdog heartbeat**

- `solution-architect`: docs/milestones.md là source of truth duy nhất + scripts/due-milestones.mjs đọc đầu phiên + cron Telegram ping 1 lần/ngày khi có mốc due (A+B, ~1.5 hd). Đánh dấu [x] khi xong. Không GitHub Issue, không state machine.
- `ui-ux-critic`: Telegram = bề mặt đánh thức, GitHub Issue = bản ghi bền, vòng đời open/done qua /done trong telegram_queue, nhắc mỗi ngày 08:00 ICT tới khi done, watchdog heartbeat vào cron-health. Đồng thuận GPT-5.6.
- `risk-auditor`: GH Actions schedule CHỈ mở issue (idempotent). GREEN chỉ khi reminder/issue; RED nếu autonomous executor tự chạy có quyền merge.

**D2 — OPS-04 v1: phạm vi + cửa sổ đo — uptime pinger tối thiểu hay SLO state machine; burn 30-ngày hay 24h**

- `solution-architect`: inc1 = uptime pinger GH Action (0.5 hd, bịt gap SLO-1 duy nhất slo.md nêu). inc2 OPTIONAL = burn-rate từ SQL sẵn có. KHÔNG GA4, KHÔNG alert-UX mới.
- `ui-ux-critic`: State machine: chỉ alert healthy→breached (rolling 24h, eval giờ, 3 lần liên tiếp, min-sample), night-quiet, recovery bắt buộc, copy VI, sửa bug alert_count:193.
- `risk-auditor`: Burn PHẢI theo cửa sổ 30-ngày rolling (slo.md); ratio 10-phút/24h là đo sai. Dedup state-transition, nguồn server-side. Pre-mortem bổ sung: cần volume-alert thô độc lập fingerprint.

**D3 — QA-04: DUPR SSO hard-fail — test.fixme sau điều tra env-only (kèm monitor), hay cấm fixme hoàn toàn**

- `solution-architect`: Điều tra trước (curl CSP + click tay). Env-only → test.fixme kèm lý do + backlog. Bug prod → PR riêng.
- `risk-auditor`: CẤM skip/fixme trên auth, /match/confirm, DUPR SSO trong mọi PR stabilize; grep-gate skip|fixme = fail.
- `ui-ux-critic`: Hard-fail phải triage product-or-stale, KHÔNG skip.

**D5 — GA4 chuẩn bị cho mốc funnel (02/08) + badge (04/08): đăng ký custom dimensions ngay hay chờ ngày mốc**

- `solution-architect`: KHÔNG mở rộng GA4 bây giờ — địa hạt mốc tương lai, cần ~1 tuần RUM.
- `ui-ux-critic`: BLOCKER làm NGAY: custom dimensions không hồi tố — chưa đăng ký thì 02/08-04/08 không có lịch sử, mốc mù. Mở rộng ga4_report.py trước ngày mốc.

**D6 — GA4 có được làm MỘT nguồn đo SLO-2 burn không (phát sinh vòng 2, chưa đối chất — chỉ liên quan khi làm OPS-04 inc2 burn-alert, hiện deferred)**

- `solution-architect`: slo.md:11 định nghĩa nguồn SLO-2 = 'GA4 funnel events (BASE-02) + client_errors auth-tagged rows' — blanket-ban GA4 mâu thuẫn chính SLO doc. GA4-segment-VN + min-count là input HỢP LỆ bên cạnh client_errors; cái bị cấm là GA4-global-bot-polluted làm nguồn DUY NHẤT.
- `risk-auditor`: Nguồn đo auth/registration = Supabase server-side, không phải GA4 (GA4 bot pollution → false-alert/false-silence; CLAUDE.md xác nhận pollution).


