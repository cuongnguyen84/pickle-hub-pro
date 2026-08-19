# ui-ux-critic — second opinion GPT-5.6 (nguyên văn)

- Ngày: 2026-08-05
- Model: `gpt-5.6-sol` qua OpenAI Responses API (`reasoning.effort=high`), 17.147 tokens
- Lý do không dùng `scripts/agents/ask-model.mjs`: script KHÔNG tồn tại trong repo
  (memory `idea-pipeline-missing-scripts`). Đã thử Codex CLI trước → `ERROR: You've hit
  your usage limit ... try again at Aug 8th` → fallback gọi thẳng Responses API bằng
  `OPENAI_API_KEY` (curl; urllib bị CERTIFICATE_VERIFY_FAILED trên máy này).

---

## PROMPT ĐÃ GỬI (nguyên văn)

````markdown
You are a senior product designer reviewing a conversational (Telegram bot) ops interface for a mobile-first bilingual (Vietnamese-primary) sports web app. Be specific and concrete. Name the exact element and the exact fix. No generic design platitudes. You cannot see the repo — everything you need is below. Answer in English; propose Vietnamese copy strings verbatim where copy is requested.

# Context

ThePickleHub (thepicklehub.net) — a Vietnamese pickleball platform, solo-built by one person, "Cuong". Backend = Supabase edge functions + Cloudflare Workers + GitHub Actions. There is an ops Telegram bot ("TPH AI Support") that is the ONLY interface for job operations on mobile. Cuong reads it on an iPhone, one-handed, often while at a pickleball court or in a taxi. He is the single authorized chat (chat allowlist of exactly one). There is also a web page /admin/jobs but he rarely opens it on mobile.

The bot today:
- Sends a 09:15 ICT morning digest of job health.
- `/jobs` returns a status block plus an inline keyboard: for up to 4 unhealthy jobs, a row of two buttons each: `🔎 <job_key>` and `🛠 Fix`.
- Pressing an inline button triggers `answerCallbackQuery` with text "Đang xử lý…" (a Telegram toast that vanishes after ~3s and leaves nothing in the chat scroll), then the command is processed SYNCHRONOUSLY inside the webhook handler (blocking, up to ~10s of polling), then one final message is sent.
- All bot messages from this function are sent as PLAIN TEXT (no parse_mode). The other function that sends the morning digest uses MarkdownV2 with escaping. Job keys contain hyphens (`dupr-rankings-refresh`, `auto-cancel-unpaid-registrations`) which are MarkdownV2-hostile.

# Actual current messages (verbatim, these are the strings Cuong sees)

Success:
  `✅ dupr-sync-daily đã chạy lại thành công (HTTP 200, dispatch #48211).`
Failure:
  `❌ Retry dupr-sync-daily vẫn lỗi: HTTP 500\n{"error":"..."}`
Business-level failure:
  `⚠️ Retry <job> trả HTTP 200 nhưng có lỗi nghiệp vụ:\n<raw json>`
No downstream answer yet:
  `⏳ <job> đã được dispatch (#48211), downstream chưa trả kết quả. Hệ thống vẫn theo dõi đúng lần chạy này.`
Unsupported job type — THE COMPLAINT THAT STARTED THIS:
  `⛔ Không retry news-fetcher: retry_not_supported`
Cooldown (pressing Fix twice within 10 min on the same job):
  `⛔ Không retry news-fetcher: cooldown`
Edge function redeploy path:
  `🛠 Đã khởi động recovery workflow cho <slug>. GitHub sẽ redeploy, probe lại runtime và báo kết quả qua Telegram.`
Diagnose:
  `🔎 <display name>\nState: failed\nSchedule: hourly\nLast: 2026-08-05T09:00:00Z\nReason: <error>`

Cuong's own words about the problem (translated): "One news-fetcher job errored, I pressed Fix but it just replied '⛔ Không retry news-fetcher: retry_not_supported', so it was NOT fixed. I need every Fix press to call an agent that handles it and tells me specifically whether the error is fixed and what the cause was."

# The proposed change

Pressing `🛠 Fix` no longer just calls a retry RPC. It enqueues a job for an AI coding agent (Claude Code, headless) running on Cuong's always-on Mac at home. The agent:
- Has read access to the whole repo, GitHub CLI, Supabase admin API, Cloudflare wrangler.
- MAY perform ops fixes: retry jobs, re-dispatch GitHub workflows, redeploy edge functions from `main`, fix wrong data in monitoring tables, re-enable disabled workflows.
- MAY NOT change application code. If the root cause is a code bug, it must report the cause and a proposed fix, and wait for Cuong's approval.
- Target latency: 5–10 minutes. The bot must acknowledge immediately ("investigating…") and then send a full result.

Real examples of what it will be asked to fix (all live on 2026-08-05):
1. `news-fetcher` warning: "ppa-tour: feed HTTP 404". Root cause is a static row in a database seed table: `feed_url = 'https://ppatour.com/feed/'` no longer exists. Fix = update the row or disable that source. This is a DATA fix, not a retry.
2. `dupr-rankings-refresh` failed: "older than eight days" — recurring even though it was fixed yesterday. Suspected root cause: a launchd job on Cuong's own Mac redeploys edge functions hourly from a STALE local git branch, reverting the fix every hour. Fix = a machine-level ops change plus an explanation.
3. `auto-cancel-unpaid-registrations` failed: "Scheduler ran but no monitored request was dispatched" — a monitoring/evaluator logic issue.

Note that in case 2, the honest answer is "I found the cause but the fix touches your machine's launchd config and a stale branch — approve?" — i.e. NOT fixed yet.

# What I need reviewed — be concrete, give exact strings

1. The immediate ACK message. What should it say and contain? Should it be a chat message or only the callback toast? Should it be edited in place later (Telegram `editMessageText`) or should the result be a new message? Trade-offs for a person who may be scrolling a chat with 30 other alerts.
2. The RESULT message structure. My proposed skeleton is: cause → actions taken → verification status → what's left for Cuong. Is that the right order for a phone screen where only ~6 lines are visible before scrolling? What should be in the first line so it's readable from a notification banner (Telegram notification preview shows roughly the first 2 lines)?
3. Concurrency / abuse states, each needs an exact bot reply:
   a. Cuong presses Fix twice on the SAME job within seconds.
   b. Cuong presses Fix on a DIFFERENT job while the agent is already working on one.
   c. The agent exceeds 10 minutes with no result.
   d. The agent crashes / the Mac is asleep / offline — nothing is listening to the queue.
   e. The agent finishes but concludes "cannot fix, needs code change" — this is NOT an error, it's a valid outcome. How should it look different from a failure?
4. Follow-up inline buttons on the result message. Candidates: "🔁 Chạy lại" (run again), "📄 Chi tiết" (full detail/log), "✅ Đóng" (acknowledge/close), "👍 Duyệt" (approve the proposed code fix). Which of these earn their place? Which are traps? Note that Telegram inline buttons remain clickable forever on old messages — a "🔁 Chạy lại" button on a 3-day-old message is a live foot-gun.
5. Should intermediate progress updates be sent during the 5–10 minutes (e.g. "đã xác định nguyên nhân, đang sửa…"), or is silence-then-result better? Consider: notification fatigue vs. anxiety about whether it's still alive.
6. How verbose should the technical detail be inline vs. hidden behind a "Chi tiết" button? Cuong is technical (he wrote the codebase) but is reading on a phone.
7. Anything about the current message set that you would change regardless of this feature.

Constraints:
- Vietnamese is the language of the bot. Copy must be natural Vietnamese, not translated English. Cuong is addressed informally ("anh" is used in existing copy).
- Plain-text messages are the safe default (MarkdownV2 escaping is a known footgun with hyphenated job keys). HTML parse_mode is available. Say which you'd use and why.
- Telegram messages cap at 4096 chars; the code currently truncates at 4000.
- Emoji-prefixed status lines are the established visual language: ✅ ⚠️ ❌ ⏳ 🛠 🔎 ⛔ 📊.
````

---

## TRẢ LỜI GPT-5.6 (nguyên văn)

## 1. Immediate acknowledgement

Use both mechanisms:

1. Answer the callback immediately so Telegram stops showing the spinner.
2. Send a persistent chat message after the queue record is created.

A toast alone is insufficient: it disappears and gives Cuong no evidence that a 5–10 minute task is still active.

### Callback toast

After successfully creating or finding the queue task:

```text
Đã nhận. Tôi sẽ báo kết quả trong chat.
```

If creating the queue task fails:

```text
Không thể nhận yêu cầu. Chưa có thao tác nào được thực hiện.
```

Do not perform agent work inside the webhook. The webhook should insert or deduplicate the task, answer the callback, send the ACK, and return.

### Persistent ACK

```text
⏳ Đã nhận xử lý news-fetcher
Yêu cầu đã vào hàng đợi. Agent sẽ điều tra, xử lý trong phạm vi được phép và xác minh kết quả.
Dự kiến có kết quả trong 5–10 phút. Anh không cần bấm lại.
Mã xử lý: FX-48212
```

This message should be a reply to the `/jobs` message so tapping the reply context returns to the original status block.

### Edit or send a new result?

Use a hybrid:

- Edit the ACK silently for progress.
- Send the final result as a new message, replying to the ACK.
- After sending the result, edit the ACK to show that the task ended.

Do not only edit the ACK into the result. An edit may be buried above 30 newer alerts and may not generate a useful notification.

Final ACK state:

```text
✅ Đã kết thúc xử lý news-fetcher
Kết quả: Đã sửa và xác minh.
Mã xử lý: FX-48212 · 09:48 ICT
Xem tin nhắn kết quả bên dưới.
```

For an outcome requiring approval:

```text
🛠 Đã kết thúc điều tra news-fetcher
Kết quả: Cần anh duyệt bước tiếp theo.
Mã xử lý: FX-48212 · 09:48 ICT
Xem tin nhắn kết quả bên dưới.
```

Also edit the original inline keyboard after acceptance. Replace `🛠 Fix` with `⏳ Đang xử lý`; that callback should only show the active-task toast. Telegram has no truly disabled inline button, so the server must still enforce deduplication.

---

## 2. Result message structure

The proposed cause → actions → verification → Cuong order is not ideal for a notification banner.

Use an adaptive order:

1. Outcome and job.
2. Verification, or required action if Cuong must act.
3. Cause.
4. Action taken or proposed.
5. Anything Cuong must do.
6. Task metadata.

The first line must say whether the job is fixed. Do not lead with “Agent đã hoàn tất” because that says nothing about the job.

### Fixed and verified

```text
✅ Đã sửa và xác minh — news-fetcher
Xác minh: lần chạy mới hoàn tất; cảnh báo “ppa-tour: feed HTTP 404” không còn.
Nguyên nhân: URL https://ppatour.com/feed/ của nguồn ppa-tour đã trả HTTP 404.
Đã làm: vô hiệu hóa nguồn ppa-tour trong bảng nguồn tin; không thay đổi code.
Anh không cần làm gì thêm.
Mã xử lý: FX-48212 · 09:42–09:48 ICT
```

If the agent updated the URL instead, the action line must say exactly that rather than using generic “đã sửa”.

### Cause found, but approval is required

```text
🛠 Cần anh duyệt — dupr-rankings-refresh chưa được sửa
Cần anh: duyệt dừng launchd đang redeploy từ nhánh local cũ.
Nguyên nhân: tác vụ launchd trên máy Mac chạy mỗi giờ và ghi đè edge function đã sửa trên main.
Đã làm: chỉ kiểm tra cấu hình và lịch sử deploy; chưa thay đổi launchd hoặc production.
Xác minh: bản deploy hiện tại vẫn chứa logic cũ; lỗi “older than eight days” có thể tái diễn.
Đề xuất: dừng launchd, đồng bộ checkout với main, rồi redeploy và chạy probe.
Mã xử lý: FX-48213
```

This is not a failure, so do not use `❌`.

### Code change required

```text
🛠 Cần sửa code — auto-cancel-unpaid-registrations chưa được sửa
Xác minh: scheduler đã chạy, nhưng evaluator vẫn báo “không có monitored request được dispatch”.
Nguyên nhân: logic evaluator coi trường hợp không phát sinh request là lỗi.
Đề xuất: phân biệt “không có việc cần dispatch” với “scheduler không dispatch được”, rồi bổ sung kiểm tra cho cả hai trường hợp.
Đã làm: chỉ điều tra; chưa thay đổi code hoặc production.
Cần anh: duyệt tạo PR cho đề xuất này.
Mã xử lý: FX-48214
```

Only say `Nguyên nhân:` when supported by evidence. Otherwise use:

```text
Nghi ngờ chính: <giả thuyết và bằng chứng>.
```

Or, if genuinely unknown:

```text
Nguyên nhân: Chưa xác định; bằng chứng hiện có chưa đủ để kết luận.
```

A successful retry does not prove the root cause. Say so explicitly:

```text
Nguyên nhân: Chưa xác định. Retry đã khôi phục job nhưng không chứng minh được nguyên nhân ban đầu.
```

### Outcome vocabulary

Use these consistently:

- `✅ Đã sửa và xác minh` — actual recovery plus business-level verification.
- `⚠️ Đã thay đổi nhưng chưa xác minh` — an action happened, but evidence is incomplete.
- `🛠 Cần anh duyệt` or `🛠 Cần sửa code` — valid investigation outcome.
- `❌ Chưa sửa được` — permitted remediation was attempted and the job remains broken.
- `❌ Xử lý bị gián đoạn` — agent infrastructure failed.
- `⏳` — still active or waiting.

HTTP 200 by itself must never qualify for the green outcome.

---

## 3. Concurrency and failure states

I would run only one production-changing agent task at a time. Different jobs should queue to avoid simultaneous deploy, database, or workflow changes.

### a. Same job pressed twice

Deduplicate on the server using the job plus the current incident/run identity. Do not create another chat message.

Callback toast:

```text
news-fetcher đang được xử lý. Anh không cần bấm lại.
```

The existing ACK remains the persistent status.

### b. Different job pressed while another is active

Callback toast:

```text
Đã xếp hàng dupr-rankings-refresh.
```

Persistent message:

```text
⏳ Đã xếp hàng dupr-rankings-refresh
Agent đang xử lý news-fetcher.
Vị trí: tiếp theo trong hàng đợi.
Tôi sẽ báo khi có kết quả; anh không cần bấm lại.
Mã xử lý: FX-48213
```

Do not claim a 5–10 minute result when another task is already ahead unless an actual estimate is available.

### c. More than 10 minutes, but the agent still has a heartbeat

Send one new notification at 10 minutes. Do not send recurring “still working” messages every few minutes.

```text
⏳ news-fetcher cần thêm thời gian
Đã hơn 10 phút; agent vẫn hoạt động.
Bước hiện tại: đang xác minh thay đổi dữ liệu.
Tôi sẽ tiếp tục theo dõi và báo kết quả. Anh không cần bấm lại.
Mã xử lý: FX-48212
```

The `Bước hiện tại` value must come from a real checkpoint, not generated filler.

### d. Mac asleep or offline before claiming the task

Detect this separately from a long-running task. For example, notify after two minutes without a consumer claim:

```text
⚠️ Chưa thể bắt đầu xử lý news-fetcher
Agent trên máy Mac chưa nhận yêu cầu sau 2 phút; máy có thể đang ngủ hoặc mất mạng.
Yêu cầu vẫn ở trong hàng đợi và sẽ tự chạy khi agent online.
Anh không cần bấm lại.
Mã xử lý: FX-48212
```

This copy assumes the queue actually persists and resumes automatically. If it does not, implement that before promising it.

After a defined expiry, for example 30 minutes:

```text
❌ Không thể bắt đầu xử lý news-fetcher
Agent trên máy Mac đã ngoại tuyến 30 phút. Yêu cầu đã hết hạn; chưa có thay đổi nào được thực hiện.
Anh hãy kiểm tra máy Mac rồi mở /jobs để tạo yêu cầu mới.
Mã xử lý: FX-48212
```

### Agent crashes after accepting the task

This is more dangerous because an operation may have partially completed. Do not blindly rerun it.

```text
❌ Xử lý news-fetcher bị gián đoạn
Agent mất kết nối lúc 09:48 ICT. Có thể một phần thao tác đã được thực hiện; trạng thái cuối chưa được xác minh.
Khi agent online, hệ thống sẽ kiểm tra trạng thái hiện tại trước khi tiếp tục. Anh đừng bấm lại.
Mã xử lý: FX-48212
```

The recovery worker must inspect current state before resuming any deploy, data update, or workflow dispatch.

### e. Code change required

Treat this as `needs_approval`, not `failed`. Use the `🛠 Cần sửa code` template above.

If approval creates a separate authorized coding task, define the scope narrowly:

- Create a branch and PR.
- Do not merge.
- Do not deploy.
- Do not change unrelated files.

If the policy means the agent may never modify application code, do not show an approval button. Instead use:

```text
Cần anh: tự sửa code theo đề xuất trên hoặc tạo một quy trình sửa code riêng.
```

---

## 4. Follow-up inline buttons

### `📄 Chi tiết`: keep

This is read-only and safe on an old message.

Use:

```text
📄 Chi tiết
```

On tap, send a reply containing the detail report. If the report is long, send a `.txt` file rather than producing several noisy messages.

Suggested detail structure:

```text
📄 Chi tiết xử lý FX-48212

Dòng thời gian:
...

Bằng chứng:
...

Thao tác đã thực hiện:
...

Kết quả xác minh:
...

Log đã rút gọn:
...
```

Redact tokens, cookies, authorization headers, environment values, and signed URLs.

### `🔁 Chạy lại`: remove

This is a live foot-gun on a three-day-old message. It can also rerun against a different incident than the one described by the message.

If a special case genuinely needs another verification, use a narrowly scoped, expiring button:

```text
🔎 Xác minh lại
```

The callback must verify:

- The task is still the latest task for that incident.
- The job state has not changed.
- The button is within its expiry.
- No active task already exists.

For an old button:

```text
Yêu cầu này đã hết hạn hoặc trạng thái đã thay đổi. Mở /jobs để kiểm tra lại.
```

### `✅ Đóng`: remove by default

“Đóng” can be mistaken for “incident resolved”. It adds no value unless it persists an acknowledgement and suppresses reminders.

If acknowledgement is needed, label it accurately:

```text
✅ Đã xem
```

It should only mark the message acknowledged and remove its keyboard. It must not mark the job healthy.

### `👍 Duyệt`: keep only when scoped

A generic `👍 Duyệt` is too vague. The label must name the operation:

```text
👍 Duyệt sửa launchd
```

or:

```text
👍 Duyệt tạo PR
```

Approval should require a second confirmation. The first press must not make the change.

Example:

```text
⚠️ Xác nhận duyệt thay đổi
Job: dupr-rankings-refresh
Sẽ làm: dừng launchd, đồng bộ checkout với main, redeploy và chạy probe.
Không làm: thay đổi code ứng dụng.
Phê duyệt hết hạn lúc 11:30 ICT.
```

Buttons:

```text
👍 Xác nhận
Hủy
```

Approval callbacks must be one-time, task-specific, incident-specific, and expiring. An old approval should return:

```text
Đề xuất này đã hết hạn hoặc trạng thái đã thay đổi. Mở /jobs để kiểm tra lại.
```

Put an approval button on its own row to reduce accidental taps. Put `📄 Chi tiết` on the next row.

---

## 5. Intermediate progress

Do not push routine stage notifications such as “đã đọc repo” or “đang kiểm tra logs”. That would create excessive alerts.

Instead:

- Edit the ACK at meaningful checkpoints, at most every two or three minutes.
- Send no notification for those edits.
- Send one new notification at 10 minutes if still active.
- Always send the final outcome as a new message.

Example edited ACK:

```text
⏳ Đang xử lý news-fetcher
Agent đã bắt đầu lúc 09:42 ICT.
Bước hiện tại: đã xác định nguyên nhân, đang kiểm tra cách sửa an toàn.
Cập nhật: 09:47 ICT
Mã xử lý: FX-48212
```

Do not show percentages. They would be fabricated for investigative work.

---

## 6. Inline technical detail versus “Chi tiết”

Keep the primary result to roughly 6–10 short lines and ideally below 1,000 characters.

Include inline:

- Fixed/not fixed.
- Verification evidence.
- Confirmed cause or explicitly labelled suspicion.
- Exact production action.
- Exact action required from Cuong.
- Task ID and time.

Move behind `📄 Chi tiết`:

- Raw JSON.
- Stack traces.
- Full GitHub Actions output.
- Supabase query results.
- Wrangler output.
- Commands and tool transcripts.
- Long URLs and request/response bodies.
- Investigation dead ends.

Do not blindly truncate at 4,000 characters. Truncation can remove the verification or approval requirement. Generate a bounded summary separately, store the full report, and provide it through `📄 Chi tiết`. If a detail message approaches the Telegram limit, split at headings or send a text file.

---

## 7. Rendering format

Use plain text with no `parse_mode` for ACKs, results, progress, and details.

Reasons:

- Agent evidence may contain arbitrary `<`, `>`, `&`, JSON, shell output, and URLs.
- A single unescaped value in HTML can reject the entire operational result.
- MarkdownV2 is already known to be fragile with hyphenated job keys.
- The emoji status line and labelled lines provide enough hierarchy on mobile.

Do not interpolate raw agent output directly into the summary. Normalize it into structured fields first.

HTML would only be worth adopting after there is one centrally tested `escapeHtml` function for every dynamic field plus a plain-text fallback. Do not mix ad hoc MarkdownV2, HTML, and plain-text templates across the two bot functions.

---

## 8. Changes to the current messages

### Rename the action button

Change:

```text
🛠 Fix
```

to:

```text
🛠 Xử lý
```

“Fix” promises success and is English inside a Vietnamese interface. “Xử lý” accurately covers remediation, investigation, and approval-required outcomes.

For stale `/jobs` messages, the callback must check the current incident identity. If the job is already healthy:

```text
Job này đã khỏe từ 09:48 ICT. Mở /jobs để xem trạng thái mới nhất.
```

If a newer incident exists:

```text
Trạng thái đã thay đổi. Mở /jobs để xử lý lần lỗi mới nhất.
```

### Never expose internal enum values

Replace:

```text
⛔ Không retry news-fetcher: retry_not_supported
```

with, only for a separate direct-retry action:

```text
⚠️ Không thể chạy lại news-fetcher trực tiếp
Job này không có cơ chế retry. Chọn “🛠 Xử lý” để điều tra nguyên nhân và xử lý theo cách phù hợp.
```

After the new agent flow launches, pressing `🛠 Xử lý` must never produce `retry_not_supported`.

Replace a cooldown enum with:

```text
⏳ Chưa thể chạy lại news-fetcher
Lần chạy lại gần nhất lúc 09:42 ICT. Có thể thử lại sau 09:52 ICT.
```

For an active agent task, use the deduplication copy instead of cooldown.

### Retry success

Current HTTP-only success overstates the result. Use:

```text
✅ Đã chạy lại và xác minh — dupr-sync-daily
Lần chạy mới vượt qua kiểm tra nghiệp vụ.
HTTP 200 · dispatch #48211
```

If only HTTP status is known, use a pending or unverified state instead.

### Retry failure

Do not dump raw JSON into the main alert:

```text
❌ Chạy lại dupr-sync-daily không thành công
HTTP 500. Chưa có thay đổi nào được xác nhận.
```

Add `📄 Chi tiết` for the body and logs.

### HTTP 200 with a business failure

```text
⚠️ dupr-sync-daily đã phản hồi nhưng chưa xử lý thành công
HTTP 200, nhưng kiểm tra nghiệp vụ phát hiện lỗi.
```

Again, put raw JSON behind `📄 Chi tiết`.

### Waiting for downstream

```text
⏳ Đang chờ kết quả dupr-sync-daily
Đã dispatch #48211. Hệ thống đang theo dõi đúng lần chạy này; anh không cần bấm lại.
```

### Edge-function recovery

The current wording is mostly correct, but the first line should clearly remain pending:

```text
⏳ Đang khôi phục <slug>
Đã khởi động GitHub workflow. Hệ thống sẽ redeploy, kiểm tra runtime và báo kết quả.
```

### Diagnose message

Localize the English labels and convert UTC timestamps to ICT:

```text
🔎 <display name>
Job: <job_key>
Trạng thái: Lỗi
Lịch: Mỗi giờ
Lần gần nhất: 16:00, 05/08/2026 (ICT)
Nguyên nhân: <error>
```

Avoid putting raw ISO UTC timestamps on the first phone screen.

---

## Required backend safeguards for this UX

The copy will only be trustworthy if the state model supports it:

- One active task per job incident, not merely per job key.
- A persistent task ID such as `FX-48212`.
- States such as `queued`, `claimed`, `running`, `needs_approval`, `fixed_verified`, `unverified`, `failed`, and `interrupted`.
- Agent heartbeat and current checkpoint.
- Queue consumer last-seen time.
- Incident fingerprint or monitored-run ID in every callback.
- One-time, scoped, expiring approval tokens.
- Verification before resuming an interrupted operation.
- No production-changing action directly from a stale Telegram callback.

The most important product change is that `🛠 Xử lý` represents an investigation task with a durable lifecycle—not a retry RPC with a more capable implementation behind it.