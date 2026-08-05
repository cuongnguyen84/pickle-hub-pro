# Nút 🛠 Fix gọi agent xử lý và trả lời cụ thể

> Slug: `telegram-fix-agent` · Ngày: `2026-08-05` · Trạng thái: `shipped` (2 giai đoạn, Cuong duyệt tường minh 05/08)
> Sinh bởi `/idea`. Panel 4 agent: `solution-architect` · `ui-ux-critic` (+GPT-5.6) ·
> `risk-auditor` (+GPT-5.6) · `pre-mortem`. Model thiếu key trong lần chạy này: `none`
> (Codex CLI hết quota → cả 2 agent external gọi thẳng OpenAI Responses API).
>
> **Raw audit trail:** `round1/*.md` · `round2/*.json` · `external/*.md` · `debate.json`

---

## 0. 🔶 Cần anh quyết

Panel đối chất xong đã **hội tụ** trên D1/D2 (xem §7) — không còn bất đồng OPEN. Nhưng có 3 quyết định nằm ngoài thẩm quyền panel:

| # | Vấn đề | Lựa chọn | Nếu chọn sai thì sao |
|---|--------|----------|----------------------|
| Q1 | **Nguồn tin ppa-tour feed 404** (đã verify: mọi đường /feed đều 404, site bỏ RSS) | (a) tắt nguồn + việc-cần-làm hiển thị vĩnh viễn trong /jobs cho tới khi có URL mới; (b) để nguyên cảnh báo ⚠️ kêu mỗi 2h | Tắt câm = mất tin PPA vô hạn không ai nhớ (postmortem #3: 5 tuần) |
| Q2 | **PAT sbp_ superuser nằm plaintext trong allow-rule `.claude/settings.local.json:20`** + `Read(//Users/cm10/**)` quá rộng, không có block deny | Duyệt hotfix riêng: rotate PAT, gỡ allow-rule, thu hẹp Read, thêm deny | Mọi phiên Claude Code (kể cả phiên đang chạy) đều cầm superuser prod — độc lập với đề xuất này |
| Q3 | **Giai đoạn 2 (agent điều-tra-only)** có làm không, sau khi Giai đoạn 1 chạy? | Làm theo hình dạng opcode (RED, cần anh duyệt riêng khi đến lúc) / không làm | Không làm = lớp lỗi "chạy được nhưng kết quả sai" tiếp tục cần anh tự điều tra |

---

## 1. Ý tưởng gốc

> "lỗi 1 job news fetcher, anh bấm fix nhưng chỉ trả lời như này, vậy là chưa được fix. Anh cần mỗi khi bấm fix gọi 1 agent xử lý và trả lời cụ thể cho anh lỗi được fix chưa và nguyên nhân"

| Hỏi | Trả lời |
|---|---|
| Ai dùng | Cuong (admin, kênh Telegram 1 người) |
| Đau ở đâu | Bấm Fix nhận `⛔ retry_not_supported` — enum nội bộ, không sửa gì, không nói phải làm gì |
| Thành công = | Mỗi lần bấm: biết rõ "đã fix chưa + nguyên nhân + việc còn lại", trong 5-10 phút |
| Ràng buộc | Chạy trên máy Mac luôn bật; sửa ops không sửa code; ack ngay |

## 2. Verdict — đọc cái này trước

| | |
|---|---|
| **Rủi ro** | 🔴 RED (risk-auditor + risk-tier.mjs đồng thuận; RED áp vào phần agent + worker; Giai đoạn 1 tự nó là AMBER) |
| **Khuyến nghị** | **Giai đoạn 1 (không AI):** nhánh fix cứng cho `cloudflare_worker` + map mọi enum sang tiếng Việt + nút 🛠 ngay trên tin cảnh báo + đếm sản lượng nguồn tin + 3 vá bảo mật. **Giai đoạn 2 (tùy chọn, sau):** agent điều-tra-only 0-credential trả opcode. |
| **Công sức** | Giai đoạn 1: ~3 nửa ngày · Giai đoạn 2: +3 nửa ngày |
| **Rủi ro lớn nhất** | Nếu đi thẳng agent-có-quyền-ghi: LLM cầm service_role + PAT superuser kích bằng 1 tin Telegram, side effect không rollback được |
| **Auto-merge** | **Chặn — cần Cuong duyệt** (RED) |

## 3. Điều panel đồng thuận (đa model — bằng chứng thật)

1. **Câu hỏi gốc của anh KHÔNG cần AI để trả lời.** `⛔ retry_not_supported` xấu vì code trả enum thay vì câu tiếng Việt + hành động. Map enum → câu chỉ việc là một object literal. (risk + GPT-5.6, architect concede)
2. **Nhưng nhánh cứng không được phép báo ✅ giả:** retry nguồn feed chết = 404 lần nữa. Spec bắt buộc: chỉ ✅ khi run mới thật sự đổi kết quả; lỗi data (ppa-tour) phải trả "việc của anh + đề xuất cụ thể". (architect, giữ sau concede)
3. **Điểm vào phải là tin cảnh báo:** tin ⚠️/❌ hiện KHÔNG có nút — phải gõ /jobs mới thấy Fix. Thêm reply_markup vào alert. (ui-ux Claude + GPT-5.6 đồng thuận 12 điểm — xem round1)
4. **Nếu sau này có agent, chỉ MỘT hình dạng được chấp nhận:** agent env sạch 0 credential, không tool mạng, đọc bundle chẩn đoán, trả `{opcode, args}` thuộc danh sách đóng; daemon (cầm key) thực thi opcode qua code có sẵn. Ranh giới hình credential, không hình luật-trong-prompt. (risk REFINE, architect concede, pre-mortem tương thích)
5. **Deny-list bổ sung trong daemon:** không `active=false`, không `ops_record_job_run(status='success')`, không `functions delete` — "tắt thứ đang kêu" là cách rẻ nhất để hết lỗi giả. (pre-mortem, giữ)
6. **Đã xử lý ngay trong phiên (không chờ proposal):** guard HEAD==origin/main + tree sạch cho hourly redeploy (root cause dupr tái phát — sự cố SỐNG do panel phát hiện), redeploy sạch 80/80, migration ghi dispatch cho match-expire/auto-cancel.

## 4. Giai đoạn 1 — spec (3 nửa ngày, ship trước)

**PR A — bot + alert (AMBER):**
- `errors-telegram-alert`: `sendTelegram()` nhận `replyMarkup`; tin incident gắn `[🛠 Xử lý] [🔎 Chi tiết]`.
- `ops-job-control`:
  - Map enum → tiếng Việt (retry_not_supported/cooldown/cron_job_unavailable/dispatch_failed — copy trong round1/ui-ux-critic.md).
  - Nhánh `executor==='cloudflare_worker'`: dispatch workflow mới `worker-job-rerun.yml` (khuôn edge-function-repair.yml: APPROVED registry, concurrency, timeout 15', checkout main sạch) → gọi worker `/run` → đọc `ops_job_runs` lấy verdict THẬT → báo về theo format phán quyết (✅ ĐÃ SỬA chỉ khi run mới success; ❌ kèm nguyên nhân + việc của anh).
  - Sau dispatch: poll run; kết thúc <5s với 0 step → đọc annotations → báo `⛔ Actions hết budget` (bài học lessons-learned:468).
  - `jobsText()`: thêm `📰 Nguồn tin: x/y active` (khuôn facebookCountsToday).
  - Đổi nhãn `🛠 Fix` → `🛠 Xử lý`; /diagnose Việt hoá + giờ ICT.
- **3 vá bảo mật (làm dù mọi thứ khác bị bác):** (1) webhook secret độc lập (random, thôi dẫn xuất từ CRON_SECRET) + kiểm `from.id == <id Cuong>`; (2) `telegram_queue.py` PATCH thêm `&status=eq.pending` (CAS); (3) dọn backlog free-text pending trước khi bất kỳ drainer nào bật.

**PR B — độc lập (Q2, chờ anh duyệt):** rotate PAT sbp_ + dọn `.claude/settings.local.json`.

## 5. Giai đoạn 2 — agent điều-tra-only (tùy chọn, RED, cần duyệt riêng)

Chỉ theo hình dạng đã hội tụ: daemon launchd poll `telegram_commands` → dựng bundle chẩn đoán bằng /diagnose + log (env sạch) → `claude -p` 0-credential, cwd scratch, không mạng → agent trả `{opcode, args}` (opcode = đúng tập hành động Giai đoạn 1 đã có nhánh code) + văn bản giải thích nguyên nhân → daemon thực thi opcode, verify qua snapshot refresh, gửi tin theo format ui-ux (ACK cố định, kết quả tin mới, phán quyết dòng 1). Điều kiện mở (structural, không phải "chạy êm 1 tuần"): action enum đóng ✚ 0 credential trong tiến trình agent ✚ dòng sản lượng đã live.

Giá trị thêm so với Giai đoạn 1: câu "nguyên nhân" do agent điều tra thật thay vì template — đúng phần anh hỏi mà nhánh cứng chỉ trả lời được một phần.

## 6. Không làm

- Daemon tự trị có quyền ghi (Option A/B nguyên bản của architect) — architect đã tự rút sau bằng chứng credential.
- Agent sửa `news_sources`/monitor/ops_job_runs trực tiếp — mọi biến thể.
- Nút 🔁 Chạy lại, ✅ Đóng, duyệt-2-bước, tin tiến độ giữa chừng (đồng thuận ui-ux 2 model).

## 7. Ledger đối chất

`debate-ledger.mjs` không tồn tại trong repo (memory: idea-pipeline-missing-scripts) — cưỡng chế thủ công bởi orchestrator, mọi CONCEDE đều kèm bằng chứng file:dòng đã verify:

| ID | Chủ đề | architect | risk-auditor | pre-mortem | Kết quả |
|----|--------|-----------|--------------|------------|---------|
| D1 | Agent AI hay nhánh cứng | **CONCEDE** (settings.local.json:11/:20; repair-workflow sẵn có → daemon rút, nút không gọi agent) | **REFINE** (giữ RED; chấp nhận duy nhất điều-tra-only/0-credential/opcode-đóng) | — | HỘI TỤ: Giai đoạn 1 không AI; Giai đoạn 2 opcode-only nếu anh duyệt |
| D2 | Agent tự ghi gì | **CONCEDE** (GRANT SELECT-only → "sửa monitor" = leo superuser) | **HOLD** (ranh giới hình credential: 0 key, 0 Management API, 0 ghi monitor) | **REFINE** (nhượng nửa monitor; deny-list chuyển tầng: cấm `ops_record_job_run(status='success')` vì RPC SECURITY DEFINER đã GRANT là đường xanh-giả thật; duyệt-đích-danh không thay được deny-list) | HỘI TỤ: agent 0 credential; deny-list nằm trong daemon |

Bất đồng mới phát sinh vòng 2 (đã gộp vào spec §4/§5): nhãn duyệt phải từ bảng ánh xạ cố định (pre-mortem + risk cùng chỉ ra độc lập — nhưng cùng là Claude, trọng số vừa phải); worktree-diff không phải ranh giới (risk); điều kiện mở Inc-agent phải structural (risk).

## 8. Việc đã làm ngay trong phiên /idea này (bằng chứng: log + prod)

1. Root cause dupr tái phát = hourly redeploy từ working tree stale → guard + tree về main + redeploy sạch 80/80 (18:03).
2. Migration `20260805110000` (đã áp prod): match-expire/auto-cancel ghi `ops_cron_dispatches` đúng pattern.
3. ppa-tour: verify 404 thật mọi biến thể URL — CHƯA tắt nguồn (chờ Q1).


---

## 9. Ship log (05/08)

- PR #549 squash-merge → main `940d399e` (CI 7/7 xanh, QA PASS, release-pilot từ chối merge RED đúng luật → Cuong ra lệnh merge trực tiếp trên kênh user).
- Migration ppa-tour + secrets TELEGRAM_WEBHOOK_SECRET/TELEGRAM_ADMIN_ID đã áp/set TRƯỚC merge; 3 function deploy từ main@940d399e (lần deploy đầu bị dính tree cũ do pull fail câm — bắt được và redeploy đúng trong vài phút, xem lessons-learned 05/08); install_webhook trả webhook_installed:true (secret độc lập + kiểm from.id đã LIVE).
- Q2: allow-rule chứa PAT đã gỡ, Read thu hẹp, deny Downloads/.ssh/.aws thêm vào settings.local.json. Rotate PAT sbp_ vẫn chờ Cuong (dashboard).
- Còn tay Cuong: load launchd daemon (classifier chặn), bấm thử nút 🛠 Xử lý trên alert thật, rotate PAT.
