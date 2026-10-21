# risk-auditor — telegram-fix-agent (nguyên văn, 2026-08-05)

## Verdict: 🔴 RED

**Kết cục xấu nhất thực tế:** một tin nhắn Telegram (do Cuong, do attacker chiếm tài khoản, hoặc do chính nội dung log/DB mà agent đọc phải) biến thành shell không giới hạn trên máy đang giữ service-role JWT + Supabase Management PAT (superuser SQL) + `gh` keyring mang danh tính `cuongnguyen84` + wrangler token — và không có một hành động nào trong số đó `git revert` được.

Classifier nói: RED (do file migration). Giữ RED nhưng đổi lý do: RED thật không nằm ở migration, mà ở **side effect ngoại vi không hoàn tác được** (Supabase deploy, wrangler deploy, workflow enable, UPDATE monitor, tin Telegram đã gửi) cộng **leo thang credential**. Kể cả bỏ hết migration ra khỏi diff thì vẫn RED.

## 🚨 Phát hiện chặn trên hết: sự cố production ĐANG SỐNG

`com.picklehub.edge-redeploy-hourly` (StartInterval 3600, loaded) chạy redeploy-edge-functions.sh: không git pull, không kiểm branch, không kiểm cây sạch — deploy đúng cái trên đĩa. Đo lúc 17:50: lần chạy 17:24→17:30 deploy 80 function từ cây stale; HEAD=4cc22d32, sau origin/main **41 commit**, 15 file edge function khác nội dung, trong đó:
- `send-auth-email` — Auth Hook, bị đè mất `b03741c0 Reject non-POST and malformed bodies` → SLO 2/3
- `mux-webhook` → SLO 1
- `news-rewrite` — bản CHƯA COMMIT trên đĩa được ship lên prod
- `workers/secret-sync/` vẫn còn trong cây local dù `a617268f` đã xoá vì heal-loop — "redeploy worker from main" đọc cây local sẽ hồi sinh đúng worker vừa bị gỡ.

Việc phải làm ngay: bootout LaunchAgent / đưa cây về origin/main; đối chiếu `supabase functions list` với origin/main, đặc biệt send-auth-email, mux-webhook, news-rewrite; đăng nhập thật 1 lần (OTP) verify Auth Hook.

> Ghi chú orchestrator: tại thời điểm auditor đo (17:50), orchestrator đang song song xử lý — 17:52 tree đã ff về origin/main, 17:56 guard HEAD==origin/main + tree sạch được thêm vào script (verify ABORT 17:57), 18:0x chạy redeploy sạch toàn bộ từ main. Mối nguy "18:24 deploy 41-commit-stale" không còn.

## Rủi ro chính

| # | Mức | Cơ chế |
|---|---|---|
| 1 | Cao | Webhook secret = SHA256(CRON_SECRET) — dẫn xuất từ secret dùng chung mọi cron caller; `from_id` được ghi nhưng KHÔNG BAO GIỜ kiểm. Hôm nay mở 6 lệnh allowlist; đề xuất biến nó thành prompt cho agent có shell. Fix 10 dòng (secret độc lập + kiểm from.id) nên làm dù bỏ đề xuất. |
| 2 | Cao | Prompt injection gián tiếp: agent đọc log/DB/nội dung scrape (news_items = nội dung web ngoài kiểm soát). "KHÔNG tự sửa code" là prompt text, không phải ranh giới cưỡng chế. Không mitigation nào ở tầng prompt. |
| 3 | Cao | Leo thang bắt buộc lên Management API: `ops_cron_monitors` chỉ GRANT SELECT cho service_role (20260715130000:65) → "sửa row monitor" buộc dùng PAT sbp_ (postgres superuser, bypass mọi GRANT/RLS), PAT nằm plaintext trong ~/Downloads/secrets.local.md và inline trong .claude/settings.local.json. Quyền nghe nhỏ thực chất cấp DROP TABLE. Nếu cần: viết RPC SECURITY DEFINER hẹp, đừng mở đường superuser. |
| 4 | Cao | Monitor tự làm mù chính nó (SLO 5): agent phán "monitor sai" rồi UPDATE last_activity_at → dashboard xanh, alert im, job vẫn chết. Mất cơ chế ĐO, không phải burn chỉ tiêu. Agent tuyệt đối không được ghi bảng monitor. |
| 5 | Cao | Không có rollback: một lượt chạy sinh nhiều side effect commit độc lập (deploy/enable/UPDATE/tin đã gửi); verify hỏng ở cuối không đảo được các bước trước. Đây là lý do RED chứ không phải AMBER. |
| 6 | TB | `telegram_queue.py::update_status` PATCH không có predicate `status=eq.pending` (không CAS) — 2 drainer cùng bảng, một CAS một không → row xử lý đúp. |
| 7 | TB | Backlog free-text: webhook insert MỌI text vào pending + hứa "agent sẽ xử lý", drain chỉ rút allowlist → tồn kho vô hạn; bật daemon là nuốt toàn bộ lịch sử. Trước khi bật: set skipped hàng loạt + chỉ nhận row mới hơn thời điểm khởi động. |
| 8 | TB | Không trần chi phí: không --max-turns, không timeout, không quota/ngày — đúng hình dạng bài học 12.4k phút Actions. |
| 9 | TB | Máy reboot giữa chừng: không transaction bắc qua 4 hệ thống; row kẹt processing vĩnh viễn hoặc replay mù. Cần lease TTL + reaper. |
| 10 | Thấp | Deploy tay từ máy đi vòng qua deploy-guard.yml. |

## SLO đe doạ
SLO 5 (mù cron = mất lớp phát hiện của mọi SLO khác — tệ nhất), SLO 2/3 (send-auth-email đè), SLO 4 (submit-match-score từng bị deploy bản cũ 17:29), SLO 1 (mux-webhook), SLO 7 (send-push-notification).

## Perf/SEO/Mobile
Bundle +0KB; không chạm SSR/sitemap/hreflang; không cần bump pr:v32. Mobile: không chạm shell — NHƯNG rủi ro #3/#5 chạm được push_tokens, event_registrations; native không revert qua app-store.

## Rollback
Không có cơ chế thống nhất; 15-40' NẾU biết state trước — agent không ghi state trước → thực tế không xác định. Theo checklist: không revert được ⇒ RED bất kể classifier.

## So với phương án thay thế (nhánh cứng cloudflare_worker)
Nhánh cứng thắng rõ: edge-function-repair.yml đã có đúng hình dạng (dispatch + validate registry + concurrency + timeout 15' + checkout cây sạch từ main). Thêm cloudflare_worker = 1 workflow tương tự + 1 else-if. Bảng so sánh: bề mặt prompt 0, nguồn deploy clean-checkout, có concurrency, timeout, audit = run log, rollback = re-dispatch SHA cũ, chi phí = Actions minutes.
Điểm yếu thật của nhánh cứng (GPT không biết): Actions hết budget = job chết 2s với steps:[], log not found — sau dispatch phải poll run, kết thúc <5s 0 step → đọc annotations báo `actions_budget_exhausted` (~20 dòng, vẫn rẻ hơn agent).
Yêu cầu gốc "trả lời cụ thể fix chưa + nguyên nhân" KHÔNG cần AI: map mã lỗi `retry_not_supported` → câu tiếng Việt là một object literal.

## Verify trước khi merge (trích)
- Gỡ/vô hiệu LaunchAgent trước 18:24 ✔ (orchestrator đã làm bằng guard + tree main)
- Đối chiếu functions list vs origin/main; login OTP thật 1 lần
- `SELECT count(*) FROM telegram_commands WHERE status='pending'` trước khi bật bất kỳ drainer nào
- Nếu vẫn theo agent: chứng minh có deny-rules cho secrets/Management API/gh — KHÔNG phải --dangerously-skip-permissions
- Webhook secret độc lập + kiểm from.id (POST giả chat_id đúng + from.id sai → phải bị từ chối)

## Phản biện GPT-5.6
Lưu tại external/risk-prompt.md + external/risk-openai.md (gọi thẳng OpenAI /v1/responses vì scripts/agents/ask-model.mjs không tồn tại).
- Giữ (verify được trong repo): webhook secret dẫn xuất; from_id không kiểm; free-text tồn kho vĩnh viễn; LaunchAgent phải gỡ trước; --dangerously-skip-permissions vô nghĩa phòng thủ; không rollback mạch lạc.
- Bác: (1) "conflict làm function không compile" — sai, UU duy nhất là lessons-learned.md, deploy sẽ THÀNH CÔNG và ship code cũ trong im lặng (tệ hơn GPT nghĩ); (2) "cần enforce update_id unique" — đã có sẵn upsert onConflict ignoreDuplicates; (3) "attacker dùng danh tính GitHub của Cuong kể cả approve" — đúng nhưng thiếu: ops-runbook §1b đã tách bot identity, vấn đề là keyring session vẫn trên máy.
- GPT sót: #3 (SELECT-only grant ép leo Management API), #4 (monitor tự mù SLO 5), #6 (claim không CAS), điểm yếu Actions-budget của nhánh cứng.

**Chốt:** 🔴 RED. Không merge dưới quyền tự chủ agent. Khuyến nghị: BỎ hướng agent, làm nhánh cứng + map lỗi tiếng Việt, gỡ LaunchAgent hôm nay như hotfix riêng.
