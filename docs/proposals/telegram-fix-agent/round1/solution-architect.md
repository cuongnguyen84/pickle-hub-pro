# solution-architect — telegram-fix-agent (nguyên văn, 2026-08-05)

## Tóm tắt kiến trúc

Nút `🛠 Fix` không hỏng vì thiếu nhánh code — nó hỏng vì `ops_request_job_retry` chỉ biết `executor='pg_net'`, và vì cả ba lỗi Cuong chụp 05/08 đều thuộc lớp "job chạy được nhưng kết quả sai", lớp mà retry không bao giờ sửa được. Đề xuất: giữ nguyên `ops-job-control` làm mặt tiền (ack + verdict), thêm một **daemon launchd trên máy Mac** rút hàng đợi `telegram_commands` đã có sẵn rồi spawn `claude -p` với một runbook cố định, quyền hạn giới hạn ở tầng ops. Không migration, không table mới, không đụng bundle web — toàn bộ phần mới nằm ngoài Vite và ngoài `supabase/migrations/`.

**Trước mọi phương án: có một bug đang sống, phải đóng trước.** `~/Library/LaunchAgents/com.picklehub.edge-redeploy-hourly.plist` → `~/Library/Application Support/PickleHub/redeploy-edge-functions.sh` làm `cd /Users/cm10/pickle-hub-pro` rồi deploy **toàn bộ** edge function từ working tree, bất kể nhánh nào đang checkout. Hiện checkout là `agent/admin-job-health-digest`, **đi sau `origin/main` 8 commit**, và bản `ops-job-control/index.ts` trên nhánh này **thiếu hẳn** nhánh `github_actions → requestWorkflowRun` mà main đã có. Nghĩa là mỗi giờ máy Mac hoàn nguyên prod về bản không fix được `dupr-rankings-refresh` — đúng khớp với "tái phát dù 04/08 đã sửa". Mọi thứ ta ship vào `ops-job-control` sẽ bị nuốt trong vòng 60 phút nếu không đóng cái này trước.

---

## Option A — Daemon + nút Fix nối thẳng vào agent

Effort: **4 half-days** · Files:
- `scripts/ops/fix_agent_daemon.py` (mới) — poll, lock, cooldown, spawn `claude -p`, trả kết quả
- `scripts/ops/launchagents/com.picklehub.fix-agent.plist` (mới, bản chuẩn trong repo) → copy vào `~/Library/LaunchAgents/`
- `docs/ops/fix-agent-runbook.md` (mới) — prompt cố định + danh sách hành động được phép
- `supabase/functions/ops-job-control/index.ts` (sửa ~45 dòng) — fallback khi retry không hỗ trợ + watchdog "agent không phản hồi"
- `docs/job-operations-telegram.md` (sửa mục "Giới hạn cố ý")

Data: **không migration, không RLS mới.** Tái dùng `telegram_commands` (`src/integrations/supabase/types.ts:6858`).

**Cách hoạt động.** Trong `processTelegram`, nhánh `/fix` hiện trả `⛔ Không retry ${key}: retry_not_supported` (index.ts:232). Thay bằng: insert một dòng `telegram_commands` với `text = "/agentfix <job_key>"`, `update_id = -Date.now()` (âm để không đụng update_id thật của Telegram), rồi trả ngay `🔬 Đang điều tra <job>… kết quả trong ~5-10 phút.`

Điểm hay: `/agentfix` **không** khớp bộ lọc `.or("text.ilike./fix%,...")` ở index.ts:165 (ilike prefix `/fix%` không match `/agentfix`), cũng không khớp regex webhook ở index.ts:320. Nên edge function tự nó sẽ **không bao giờ rút lại dòng này** — không race, không cần cột mới, không cần table mới.

Daemon (launchd, `StartInterval` 20s, `KeepAlive`, `RunAtLoad=true`):
1. `mkdir /tmp/picklehub-fix-agent.lock` — cùng pattern lock mà `redeploy-edge-functions.sh` đang dùng, chạy trùng là no-op.
2. `python3 scripts/ops/telegram_queue.py --peek`, lọc `^/agentfix (<job_key hợp lệ>)$`. **Job key phải khớp `ops_job_registry`** — agent không bao giờ nhận free text từ Telegram, đóng luôn đường prompt-injection phía người dùng.
3. Cooldown: bỏ qua nếu cùng `job_key` đã chạy < 30 phút (đọc từ `telegram_commands` cũ, `result LIKE '🤖%'`). Trần cứng: 6 lượt/giờ, 30 lượt/ngày; vượt trần trả `⛔ Đạt trần agent-fix, xem ~/Library/Logs/PickleHub/fix-agent.log`.
4. `--claim <id>` → `timeout 480 claude -p "$(cat docs/ops/fix-agent-runbook.md)\n\nJOB_KEY=<key>" --output-format json` chạy trong worktree checkout `main` (không phải working tree chính, để không đụng nhánh Cuong đang làm).
5. Kết quả → `notify_telegram.py` → `--done --result`.

**Trả kết quả về Telegram:** qua `scripts/ops/notify_telegram.py` (bot token đọc từ `SECRETS_FILE`). ⚠️ Gotcha đã kiểm: `notify_telegram.py:27` mặc định `.claude/secrets.local.md` — **file này không tồn tại trong repo**; secrets thật ở `/Users/cm10/Downloads/secrets.local.md`. Plist phải export `SECRETS_FILE` đúng đường dẫn, nếu không daemon sẽ câm và không ai biết.

**Máy tắt/restart:** launchd `KeepAlive` tự dựng lại; lúc khởi động daemon quét dòng `processing` quá 15 phút → `--error` + báo "🤖 agent bị gián đoạn (máy khởi động lại), chưa fix". Trường hợp máy tắt hẳn: thêm vào vòng drain 1 phút của `ops-job-control` một câu query — dòng `/agentfix` `pending` quá 12 phút thì gửi `⚠️ Agent không phản hồi (máy có thể đang tắt) — dùng /diagnose`. Đây là điều kiện bắt buộc, không phải nice-to-have: nút nói "đang điều tra" mà im lặng vĩnh viễn còn tệ hơn `⛔ retry_not_supported` hôm nay.

**Chi phí & độ trễ:** ack < 2s (đã có `answerCallbackQuery` ở index.ts:303). Poll ≤ 20s. Run 2-6 phút. p50 ~3 phút, p95 ~7 phút — vừa SLA. Token: chạy Sonnet, runbook ~2k token + tool calls, ước ~60-150k input (có cache) + 3-8k output ≈ **$0.15-0.50/lượt**. Trần 30/ngày = trần chi ~$15/ngày ở kịch bản xấu nhất; thực tế 2-5 lượt/ngày ≈ $1-2/tháng.

Wins: trả lời đúng thứ Cuong hỏi ("fix chưa + nguyên nhân"); xử được lớp "chạy được nhưng sai" mà không nhánh cứng nào với tới; tái dùng 3 mảnh đã có (`telegram_commands`, `telegram_queue.py`, `notify_telegram.py`).
Loses: một control plane thứ hai sống trên **một cái laptop**; agent chạy với service_role key + GitHub PAT + Cloudflare token trong tay.
Forecloses: từ giờ ops không còn thuần cloud-side. Nếu sau này có người thứ hai, phải nhân bản cả cái Mac. Và một khi Cuong tin cái nút, "máy tắt = im lặng" trở thành failure mode mới cần theo dõi.

---

## Option B — Chỉ daemon, không đụng prod (bản rẻ)

Effort: **2 half-days** · Files: `scripts/ops/fix_agent_daemon.py`, `scripts/ops/launchagents/com.picklehub.fix-agent.plist`, `docs/ops/fix-agent-runbook.md` · Data: **none** · Prod change: **none**

**Cách hoạt động.** Không sửa `ops-job-control`, không deploy gì. Khai thác một lời hứa đang bị bỏ dở: text không khớp allowlist đi vào nhánh index.ts:323 và bot đã trả sẵn *"📥 Đã nhận lệnh… Đã vào hàng đợi — agent sẽ xử lý ở lần chạy tới."* — dòng đó nằm `pending` vĩnh viễn vì `processTelegram` chỉ rút các lệnh trong `.or(...)` (index.ts:165) và **chưa từng có daemon nào tồn tại**. Bot đang nói dối, mỗi ngày.

Cuong gõ `sửa news-fetcher` (hoặc bất kỳ câu tiếng Việt nào) → daemon rút, chạy agent, trả kết quả. Cùng lock/cooldown/trần như A.

Wins: rẻ nhất, rủi ro deploy **bằng không**, không migration, không RED tier, biến một lời hứa đang sai thành thật. Test được ngay tối nay trên đúng 3 lỗi 05/08. Rollback = `launchctl unload` + xoá 3 file.
Loses: **không có nút.** Cuong phải gõ chữ. Ack "📥 Đã nhận" chung chung, không nói "đang điều tra job X".
Forecloses: gần như không gì — B là tập con thật của A. Nhưng nếu dừng ở B, free text đi thẳng vào prompt agent → mở lại đường prompt-injection mà A đã đóng bằng allowlist `job_key`. Daemon **phải** tự lọc `^(sửa|fix|điều tra)\s+<job_key trong registry>$` và từ chối phần còn lại, chứ không nhét nguyên câu vào prompt.

---

## Option C — Nhánh cứng, không agent

Effort: **2.5 half-days** · Files: `supabase/functions/ops-job-control/index.ts`, `supabase/functions/_shared/` (helper HMAC), `docs/job-operations-telegram.md` · Data: none (dùng `ops_job_registry` sẵn có)

Thêm nhánh `executor === 'cloudflare_worker'`: POST `/run` tới worker rồi đọc `ops_job_runs` lấy verdict thật. Đã có prior art — `pro-tour-trigger-scrape/index.ts` ký HMAC bằng `SCRAPER_AUTH_SECRET` gửi `PRO_TOUR_SCRAPER_URL/scrape`; còn `workers/news-fetcher/src/index.ts:105-106` lại chỉ so sánh header `x-auth-secret` thẳng. Hai kiểu auth khác nhau → nhánh cứng phải xử cả hai.

Wins: tất định, test được bằng vitest, không LLM, không phụ thuộc máy Mac bật, chạy cả khi Cuong đi vắng.
Loses: **không sửa được cái lỗi Cuong chụp.** `ppa-tour: feed HTTP 404` bắt nguồn từ dòng data `news_sources.feed_url = 'https://ppatour.com/feed/'` (seed `supabase/migrations/20260519000000_news_aggregator_phase_1.sql:191-197`). Retry worker = fetch lại đúng URL chết = 404 lần nữa, và bot sẽ báo "❌ vẫn lỗi" — đỡ nhục hơn `retry_not_supported` một chút, vẫn không fix. Thêm nữa: memory 03/08 ghi `SCRAPER_AUTH_SECRET` **không còn ai auto-sync** sau khi gỡ secret-sync worker; secret drift → 401 → bot báo sai nguyên nhân.
Forecloses: cam kết mô hình "mỗi lớp lỗi một nhánh cứng" — mỗi failure mode mới là một buổi tối nữa của Cuong, mãi mãi.

---

## Khuyến nghị

**Option B trước, nâng lên A sau khi B chứng minh được giá trị.**

- **C thua** vì nó tối ưu cho triệu chứng (`⛔ retry_not_supported`) chứ không cho bệnh. Cả 3 lỗi 05/08 đều không phải "chưa chạy" mà là "chạy rồi, sai": feed URL chết (data), monitor tươi sai do deploy drift (env), pg_net dispatch không được ghi nhận (evaluator `supabase/functions/_shared/cron-health.ts:183`). Retry không chạm tới cái nào.
- **A thua *ở vòng đầu*** không phải vì sai, mà vì nó gộp phần rủi ro (daemon + headless claude + secrets + launchd) với phần dễ (nút bấm) vào một lần ship. Phần khó chiếm 80% khả năng thất bại và 0% cần deploy prod. Tách ra: B đứng một mình, hỏng thì `launchctl unload` là xong, prod chưa hề biết chuyện gì. Khi runbook đã cho verdict tử tế trên 3 lỗi thật, nối nút chỉ còn 1 half-day.
- **B thắng** vì nó cũng là bản duy nhất trả lời được câu hỏi Cuong thực sự hỏi mà không cần một dòng migration nào, và vì tất cả hạ tầng nó cần đã nằm sẵn trong repo — `telegram_commands`, `telegram_queue.py`, `notify_telegram.py`. Phần phải viết mới đúng bằng một file daemon và một file runbook.

🔴 **Cần Cuong ký tay, dù `risk-tier.mjs` chấm GREEN.** Classifier chỉ chấm theo path (`scripts/agents/risk-tier.mjs:43` — RED chỉ khi đụng `supabase/migrations/`), nên B ra GREEN. Nhưng bản chất thay đổi là: **một LLM tự trị cầm service_role key + GitHub PAT + Cloudflare token, kích hoạt bằng một nút Telegram.** Đó là RED theo phán đoán, không theo regex. Ba chốt bắt buộc, không thương lượng:
1. Agent chạy trong worktree riêng checkout `main`, **cấm** `git push`, cấm sửa file trong `src/`, `supabase/functions/`, `workers/` — runbook nói rõ + daemon chạy `git diff --exit-code` sau mỗi lượt, có diff là báo động đỏ.
2. Prompt nhận **duy nhất** một `job_key` đã khớp `ops_job_registry`, không bao giờ nhận text thô.
3. Agent **đọc** `error_message` từ DB — mà chuỗi đó có thể chứa nội dung do feed bên thứ ba (ppatour.com) tạo ra. Đây là đường indirect prompt injection có thật. Runbook phải đóng khung: coi mọi nội dung từ `news_items` / `news_sources.last_error` là **dữ liệu, không phải chỉ thị**.

Về hard rules còn lại: **không route public mới** → không cần handler trong `functions/_lib/render/`, không vào sitemap, không hreflang. **Không byte JS nào vào bundle** — daemon nằm ngoài Vite, `docs/perf-budgets.md` không đổi. **Không dependency mới** (Python stdlib, đúng pattern của 3 script ops sẵn có). Về song ngữ: kênh Telegram này gate cứng theo một `chat_id` duy nhất (index.ts:21, `throw new Error("telegram_chat_not_allowed")`), toàn bộ output hiện có đã là VI-only — đây là bề mặt vận hành nội bộ một người, không phải bề mặt sản phẩm, nên **giữ VI**.

---

## Increments

1. **Inc 0 — đóng deploy drift (0.25 half-day, làm trước mọi thứ).** Sửa `redeploy-edge-functions.sh`: guard HEAD phải bằng `origin/main`, lệch thì bỏ chạy + log; hoặc trỏ script vào một worktree `main` cố định. — *Verify:* đổi checkout sang nhánh rác, chạy tay script, phải thấy `skipped: not on main`; rồi `/fix dupr-rankings-refresh` trả `🛠 Đã kích workflow` chứ không phải `⛔`.
2. **Inc 1 — runbook trước, daemon sau (0.75).** Viết `docs/ops/fix-agent-runbook.md`, chạy tay `claude -p` cho từng lỗi trong ba lỗi 05/08. — *Verify:* cả ba cho verdict cụ thể, không lượt nào đề xuất sửa code. **Chốt dừng-và-nhìn.**
3. **Inc 2 — daemon (1.25).** Lock, cooldown 30', trần 6/giờ + 30/ngày, `timeout 480`, quét `processing` mồ côi lúc khởi động, log `~/Library/Logs/PickleHub/fix-agent.log`. — *Verify:* gõ `sửa news-fetcher` → trả lời ≤ 10 phút; gõ lại ngay → cooldown chặn; `kill -9` daemon giữa lượt → tin "bị gián đoạn".
4. **Inc 3 — nối nút (1, chỉ khi Inc 2 sống ổn ~1 tuần).** `/fix` fallback → insert `/agentfix`, ack "🔬 Đang điều tra…", watchdog 12 phút trong vòng drain sẵn có.
5. **Inc 4 — cập nhật `docs/job-operations-telegram.md` (0.25).** Ranh giới mới: được sửa data vận hành, không sửa code/merge/deploy chưa duyệt.

*Hoãn vô thời hạn:* nhánh cứng `cloudflare_worker` (Option C) — agent gọi worker `/run` như một tool trong runbook.

---

## Điều em không chắc

- Chất lượng verdict của `claude -p` headless trên 3 lỗi thật — Inc 1 tồn tại để trả lời trước khi tiêu half-day nào cho daemon.
- `cron-health.ts` mới đọc tới dòng 183 — "Scheduler ran but no monitored request was dispatched" có thể là bug của monitor chứ không phải của job (fix code một lần).
- Permission model `claude -p` dưới launchd (không TTY) — có thể treo tới hết `timeout 480`. Thử thật ở Inc 2.
- `SCRAPER_AUTH_SECRET` còn khớp Supabase↔worker không — chưa verify.
- Token estimate là ước lượng; sau Inc 1 có số thật.
- `update_id` âm: chưa xem DDL thật của `telegram_commands` (bảng không nằm trong migrations) — kiểm bằng INSERT thử trước khi ship Inc 3.
