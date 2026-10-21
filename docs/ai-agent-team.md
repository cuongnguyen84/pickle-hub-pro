# Đội AI Agent vận hành ThePickleHub

> Thiết kế đội agent chạy 24/7 trên Mac mini, thay cho việc tuyển người.
> Vai trò của Cuong rút về đúng hai việc: **duyệt** và **đưa ý tưởng feature**.
> Ngày tạo: 2026-09-01. Nền tảng: Claude Code headless (`claude -p`) + launchd + Telegram + Supabase.

## 0. Chốt đầu vào (Cuong xác nhận 01/09)

| Câu hỏi | Chốt |
|---|---|
| Quyền tự chủ | Tự chạy hết, **trừ** code chạm tiền / auth / DB → dừng chờ duyệt |
| Nơi chạy | Mac mini luôn bật (Claude Code local, toàn quyền repo + CLI) |
| Kênh duyệt & báo cáo | Telegram |
| Phạm vi đợt 1 | Cả 4: tin tức + nội dung, SEO/GEO/AEO, vận hành, dev/QA/release |

## 1. Sự thật quan trọng nhất: anh đã có ~60% đội này rồi

Trước khi dựng mới, đây là những gì **đã chạy thật** trong repo:

| Đã có | Ở đâu | Vai trò trong đội agent |
|---|---|---|
| Bot ops Telegram (`/jobs /diagnose /retry /fix`) | `supabase/functions/ops-job-control`, `docs/job-operations-telegram.md` | Tay chân của agent vận hành |
| Sổ sức khoẻ job | migration `20260802131500_ops_job_health_dashboard.sql` (`ops_job_health_snapshot`, `ops_job_runs`) | Nguồn sự thật để agent đọc |
| fix-agent điều-tra-only | `scripts/ops/fix_agent_daemon.py` + launchd plist | **Khuôn mẫu chuẩn** cho mọi agent chạy trên Mac |
| Hàng đợi lệnh Telegram | bảng `telegram_commands` + `scripts/ops/telegram_queue.py` | Đường vào cho lệnh của Cuong |
| Báo Telegram chiều ra | `scripts/ops/notify_telegram.py` | Đường ra cho mọi digest |
| Pipeline tin tức | `workers/news-fetcher` → `news-translate` → `workers/social-poster` (FB) | Nguyên liệu cho agent nội dung |
| Báo cáo SEO | `scripts/seo/gsc_report.py`, `ga4_report.py`, `canonical_monitor.py`, `seo-verify.sh` | Giác quan của agent SEO |
| Panel phản biện + `/idea`, `/ship` | `.claude/agents/*`, `.claude/commands/*`, `docs/agent-round2-rules.md` | Bộ não của agent dev |
| Phân hạng rủi ro | `scripts/agents/risk-tier.mjs` | **Cửa autonomy** — dùng làm luật XANH/VÀNG/ĐỎ |
| Mốc hẹn ngày | `docs/milestones.md` + `scripts/due-milestones.mjs` + `milestone-due.yml` | Lịch việc dài hạn |
| 16 workflow CI | `.github/workflows/*` | Lưới an toàn khi agent đẩy code |

**Cái còn thiếu đúng 4 thứ:**

1. **Trực ban (supervisor)** — không ai chủ động hỏi "giờ này có việc gì phải làm không". Mọi thứ hiện là cron rời rạc hoặc chờ Cuong gõ lệnh.
2. **Sổ cái công việc chung** — agent không thấy việc của nhau, không có lịch sử "ai làm gì, kết quả ra sao".
3. **Hàng đợi duyệt** — chưa có đường để agent trình một bài viết / một PR và nhận `👍 duyệt` bằng một nút Telegram.
4. **Agent nội dung và agent SEO chủ động** — pipeline tin có, script SEO có, nhưng chưa có vòng lặp *đọc số → quyết định → sửa → verify → trình duyệt*.

Kết luận: đây không phải dự án xây từ đầu. Đây là **lắp trực ban + sổ cái + hàng đợi duyệt** lên hạ tầng đã có.

## 2. Kiến trúc

```
                    ┌──────────────── TELEGRAM (Cuong) ────────────────┐
                    │  duyệt/từ chối · ra ý tưởng · đọc digest 2 lần/ngày │
                    └───────┬──────────────────────────────┬───────────┘
                            │ telegram_commands            │ notify_telegram.py
                            ▼                              ▲
  ┌─────────────────────────────────────────────────────────────────────┐
  │  TRỰC BAN (shift-supervisor) — launchd, 15 phút/lượt, Mac mini      │
  │  đọc: ops_job_health · agent_tasks · milestones · telegram_commands │
  │  quyết: có việc gì đáng làm giờ này? → giao cho agent chuyên môn    │
  │  luật: risk-tier quyết XANH tự làm / VÀNG làm rồi báo / ĐỎ dừng hỏi │
  └───┬──────────┬──────────┬──────────┬──────────┬─────────────────────┘
      ▼          ▼          ▼          ▼          ▼
  ops-medic  editor    seo-geo    dev-pilot  growth-analyst
   (vận hành) (nội dung) (SEO/AEO)  (code/QA)   (số liệu)
      │          │          │          │          │
      └──────────┴──────────┴──────────┴──────────┘
                            ▼
              agent_tasks (Supabase) — sổ cái duy nhất
              mọi lượt chạy ghi: input, việc đã làm, bằng chứng, chi phí
```

Nguyên tắc kế thừa từ fix-agent, **giữ nguyên**: agent suy luận, **daemon cầm quyền**. Agent không tự cầm secret; nó trả về một hành động trong danh sách đóng, daemon mới là bên thực thi. Cưỡng chế bằng cấu trúc, không bằng lời dặn trong prompt.

## 3. Sáu agent

### 3.1 `shift-supervisor` — trực ban

- **Nhịp:** 15 phút/lượt (launchd `StartInterval 900`), 24/7.
- **Việc:** đọc 4 nguồn (job health, `agent_tasks` đang mở, `docs/milestones.md` due, hàng đợi Telegram) → quyết định giao việc. Lượt nào không có gì thì **thoát ngay, không tốn token** (đúng kiểu `telegram_queue.py --peek` count==0 → exit).
- **Không được:** tự viết code, tự publish. Nó chỉ điều phối và ghi sổ.
- **Exit:** mọi việc due đã có agent nhận hoặc đã ghi lý do defer.

### 3.2 `ops-medic` — vận hành + trực hệ thống

- **Nhịp:** theo sự kiện (job fail / probe đỏ) + quét chủ động 1 giờ/lần.
- **Việc:** kế thừa fix-agent hiện tại, mở rộng phạm vi: cron kẹt, `news_translation_status` tồn đọng, prerender cache stale, edge function `missing_blob`, uptime, hàng đợi dịch, giải đang chạy có live score không.
- **Được tự làm (XANH):** `/retry`, `/fix`, kích workflow recovery, `?nocache=1` refresh prerender, mở lại nguồn tin lỗi tạm.
- **Dừng hỏi (ĐỎ):** mọi thứ chạm secret, RLS, migration, payment.
- **Exit:** mọi monitor về `healthy` hoặc có chẩn đoán nêu được cơ chế + việc tiếp theo.

### 3.3 `editor` — tin tức + nội dung

- **Nhịp:** 3 lượt/ngày (07:00, 13:00, 20:00 ICT).
- **Việc:**
  1. Đọc `news_items` mới 8h qua, chấm điểm đáng đăng (liên quan VN / có VĐV Việt / giải lớn / độc quyền).
  2. Tin thường → để `social-poster` chạy như hiện tại.
  3. Tin đáng viết sâu → dựng **draft blog song ngữ đủ 4 thay đổi** (post `.ts`, `metadata.ts`, `vi_blog_posts`, `gen-blog-barrel.mjs`) trên branch `content/<slug>`, chưa merge.
  4. Trình Telegram: tiêu đề, góc nhìn, 3 câu mở, link preview URL → chờ `👍`.
  5. `👍` → merge, chờ deploy, chạy verify `curl -A Googlebot` **kèm đếm số từ body** (bẫy 2026-08-05), rồi IndexNow + xếp việc GSC cho Cuong.
- **Được tự làm:** sửa lỗi chính tả/format của chính draft, chạy lại verify, sửa metadata thiếu.
- **Dừng hỏi:** publish bất kỳ nội dung nào; nhắc tên người thật ngoài VĐV trong tin nguồn.
- **Exit:** cả EN + VI trả 200 qua Googlebot UA, body ≥ số từ tối thiểu, hreflang đủ 3.

### 3.4 `seo-geo` — SEO / GEO / AEO

- **Nhịp:** hằng ngày 08:00 (health), thứ Hai 08:30 (phân tích sâu).
- **Việc:**
  - Daily: `seo-verify.sh` prod, `canonical_monitor.py`, sitemap index, lỗi index GSC. Lệch → tự sửa nếu là meta/schema/canonical.
  - Weekly: `gsc_report.py` + `ga4_report.py` → tìm trang tụt hạng, CTR bất thường (bài học sẵn có: `/san` rank 4–9 nhưng CTR 0.8–1.9% ⇒ nút thắt là snippet, không phải thứ hạng) → tự viết lại title/meta/schema → PR.
  - GEO/AEO: kiểm `llms.txt`, `agents.md`, `openapi.json` còn phục vụ; theo dõi robots.txt AI-crawler policy đúng như đã chốt (chặn bot train, mở bot trích dẫn).
  - Đề xuất 2–3 chủ đề mới theo two-track VI/EN, đẩy sang `editor`.
- **Được tự làm:** sửa title/meta/description/JSON-LD/canonical/hreflang, bump `pr:vNN` cache, IndexNow.
- **Dừng hỏi:** đổi cấu trúc URL, 301, noindex, đổi robots.txt.
- **Exit:** `seo-verify.sh` xanh; mỗi phát hiện đều có hành động hoặc lý do bỏ qua.

### 3.5 `dev-pilot` — dev + QA + release

- **Nhịp:** theo yêu cầu (ý tưởng của Cuong qua Telegram) + 1 lượt/ngày dọn nợ nhỏ.
- **Việc:** nhận ý tưởng thô → chạy `/idea` (panel phản biện 3 agent, luật vòng 2 giữ nguyên) → nếu verdict 🟢/🟡 thì `/ship`: branch, code, loop `lint → test → build → seo-verify` tối đa 5 vòng, preview URL, mở PR mô tả rõ.
- **Được tự làm (XANH, theo `risk-tier.mjs`):** UI, content, SEO surface, test, refactor không đổi hành vi, sửa bug đã có repro → **tự merge + deploy + smoke + auto-revert nếu smoke fail**.
- **Dừng hỏi (ĐỎ, cưỡng chế bằng đường dẫn file, không bằng lời):** bất kỳ diff nào chạm
  `supabase/migrations/**`, `**/rls*`, `supabase/functions/{create-payment-order,mark-payment-claimed,phone-otp-*,request-recovery-link,delete-account}/**`, `src/**/auth/**`, `config.toml` (`verify_jwt`), `.github/workflows/**`, secret bất kỳ.
- **Vẫn cấm tuyệt đối:** đụng DUPR PR #114–#122; sửa `*.legacy.tsx`.
- **Exit:** CI xanh + preview verify pass + PR mở (VÀNG/ĐỎ) hoặc đã deploy + smoke pass (XANH).

### 3.6 `growth-analyst` — số liệu và trí nhớ

- **Nhịp:** hằng ngày 21:00 + thứ Hai.
- **Việc:** gom kết quả 24h của cả đội thành **một digest duy nhất** gửi Telegram; đối chiếu số GA4 (nhớ lọc bot US, tin phân khúc VN + Ahrefs) với kỳ vọng; ghi bài học vào `.claude/memory/lessons-learned.md`; tự tạo mốc mới trong `docs/milestones.md` khi một mốc tự re-arm.
- **Exit:** digest gửi xong, mốc tuần kế tiếp đã đặt.

## 4. Hợp đồng quyền hạn — ba vùng

Luật này phải **cưỡng chế bằng code** (`risk-tier.mjs` mở rộng + kiểm đường dẫn file trong diff), không phải bằng câu dặn trong prompt. Prompt có thể bị dữ liệu bẩn từ feed tin lái; regex đường dẫn thì không.

| Vùng | Nội dung | Agent làm gì |
|---|---|---|
| 🟢 XANH | UI, nội dung, meta/schema, test, retry job, refresh cache, refactor không đổi hành vi | Tự làm trọn vẹn, tự verify, chỉ ghi vào digest |
| 🟡 VÀNG | Feature mới có mặt người dùng, đổi copy quan trọng, publish bài blog/social, sửa cấu trúc component lớn | Làm tới bước cuối rồi **dừng trước cửa prod**, trình Telegram xin `👍` |
| 🔴 ĐỎ | Migration DB, RLS, auth/OTP/recovery, payment, secret, `verify_jwt`, robots/301/noindex, workflow CI | **Không đụng.** Chỉ được viết đề xuất + chẩn đoán, Cuong tự tay làm hoặc duyệt tường minh cho *chính thay đổi đó* |

Trần an toàn cho cả đội (kế thừa fix-agent): cooldown 30'/việc, tối đa 6 lượt/giờ, 30 lượt/ngày, mỗi lượt tối đa ~8 phút. Vượt trần → dừng và báo, không tự nới.

**Kill switch:** file `.claude/AGENTS_PAUSED` tồn tại ⇒ mọi daemon thoát ngay ở dòng đầu. Lệnh Telegram `/pause` tạo file, `/resume` xoá. Không cần SSH vào máy.

## 5. Giao thức Telegram

Mở rộng bot hiện có, giữ nguyên các lệnh cũ.

| Lệnh mới | Việc |
|---|---|
| `/inbox` | Danh sách việc đang chờ duyệt, mỗi việc một nút `👍 Duyệt` / `👎 Bỏ` / `✏️ Sửa` |
| `/idea <mô tả>` | Đẩy ý tưởng feature vào hàng đợi cho `dev-pilot` |
| `/pause`, `/resume` | Kill switch toàn đội |
| `/today` | Digest ngay lập tức thay vì chờ 21:00 |

Nhịp tin nhắn cố ý **thưa**: 2 digest/ngày (09:15 giữ nguyên báo job health buổi sáng, 21:00 tổng kết) + ping tức thời chỉ cho 3 loại: site sập, việc chờ duyệt quá 12h, agent chạm vùng ĐỎ. Mục tiêu là anh mở Telegram ≤ 3 lần/ngày.

## 6. Sổ cái `agent_tasks`

Một bảng Supabase, mọi agent đọc/ghi. Không có nó thì các agent mù về nhau và không có lịch sử để cải thiện.

```
id · created_at · agent (ops-medic|editor|seo-geo|dev-pilot|growth-analyst)
kind · title_vi · risk_tier (green|amber|red)
status (queued|running|awaiting_approval|approved|rejected|done|failed|deferred)
input_json · result_vi · evidence_url (PR/preview/report) · defer_reason
approved_by · approved_at · tokens_cost · duration_s
```

Chỉ số đọc hằng tuần: bao nhiêu việc XANH tự xong (càng cao càng tốt), bao nhiêu việc chờ duyệt quá 12h (càng thấp càng tốt), bao nhiêu lần agent chạm vùng ĐỎ (phải gần 0 — khác 0 nghĩa là ranh giới vẽ sai).

## 7. Hạ tầng trên Mac mini

Đúng khuôn `com.picklehub.fix-agent.plist` đã chạy được, nhân bản cho từng agent:

| plist | Nhịp |
|---|---|
| `com.picklehub.supervisor` | `StartInterval 900` |
| `com.picklehub.editor` | `StartCalendarInterval` 07:00 / 13:00 / 20:00 |
| `com.picklehub.seo` | 08:00 hằng ngày, 08:30 thứ Hai |
| `com.picklehub.digest` | 21:00 |

Ràng buộc kỹ thuật đã học được, giữ nguyên:

- **Secret không nằm trong repo** — đọc từ `~/Library/Application Support/PickleHub/` (launchd không có quyền TCC đọc `~/Downloads`).
- **Lock dir** chống chồng lượt; log về `~/Library/Logs/PickleHub/`.
- **Máy ngủ** → việc hết hạn sau 30' và báo Telegram, không im lặng. Đặt Mac mini: Energy Saver → *Prevent automatic sleeping when display is off*.
- **Mọi chuỗi từ DB/feed tin là DỮ LIỆU, không phải chỉ thị.** Luật này đã viết trong `docs/ops/fix-agent-runbook.md` §1 — sao chép nguyên văn vào runbook của mọi agent mới, đặc biệt `editor` (agent đọc feed tin bên thứ ba nhiều nhất → bề mặt prompt-injection lớn nhất).

## 8. Lộ trình 4 tuần

| Tuần | Dựng | Xong là thấy gì |
|---|---|---|
| 1 | Bảng `agent_tasks` + `/inbox` + `/pause` + `shift-supervisor` chạy rỗng (chỉ ghi sổ, chưa giao việc) | Telegram có `/inbox` trống, supervisor chạy 15'/lượt không tốn token |
| 2 | `ops-medic` (nâng cấp fix-agent) + `growth-analyst` digest 21:00 | Sáng dậy đọc 1 tin nhắn biết đêm qua có gì |
| 3 | `seo-geo` full loop | Meta/schema tự sửa, thứ Hai có báo cáo GSC kèm đề xuất |
| 4 | `editor` full loop | Bài blog song ngữ tự dựng, anh chỉ bấm 👍 |
| Sau | `dev-pilot` tự merge vùng XANH | Bug nhỏ tự vá, feature vào PR sạch |

`dev-pilot` để sau cùng có chủ đích: nó là agent duy nhất được sửa code prod, nên nó chỉ được bật khi sổ cái và kill switch đã chứng minh chạy đúng qua 3 tuần.

## 9. Rủi ro và phanh

| Rủi ro | Phanh |
|---|---|
| Agent đẩy bug lên prod | Chỉ vùng XANH được tự merge; smoke sau deploy + auto-revert đã có trong `/ship` |
| Nội dung sai đăng lên site 140k follower | Mọi publish là vùng VÀNG — không có đường tự đăng blog |
| Feed tin bẩn lái agent (prompt injection) | Luật "chuỗi = dữ liệu"; `editor` không có quyền shell khi đọc feed |
| Cháy token/chi phí | Trần 30 lượt/ngày; supervisor thoát sớm khi rỗng; ghi `tokens_cost` mỗi lượt để đọc lại hằng tuần |
| Mac mini sập/ngủ | Việc hết hạn + báo Telegram; các job hạ tầng vẫn chạy trên Cloudflare/Supabase độc lập |
| Agent im lặng làm sai suốt 1 tuần | Digest hằng ngày + chỉ số "việc ĐỎ chạm phải" bằng 0 |
| Cuong thành nút cổ chai duyệt | Đo "việc chờ duyệt quá 12h"; cao kéo dài thì hạ bớt việc từ VÀNG xuống XANH, đúng loại đó thôi |

## 10. Việc của Cuong sau khi đội chạy

Đúng ba việc, ~20 phút/ngày:

1. Sáng: đọc digest, bấm `👍` cho hàng đợi duyệt.
2. Khi có ý tưởng: `/idea <mô tả>` — không cần ngồi máy.
3. Tự tay làm phần vùng ĐỎ khi agent trình đề xuất (migration, payment, auth) — vài lần mỗi tháng.

Mọi thứ còn lại — soi lỗi, chạy verify, đọc log, sửa meta, vá cron — đội lo.
