# Idea Pipeline — từ ý tưởng đến production

> Anh chat một ý tưởng. Panel agent đa model phân tích. Ra một báo cáo có thể thi hành.
> Duyệt xong, pipeline tự code → verify → deploy → smoke → tự revert nếu gãy.
>
> Dựng ngày 2026-07-16. Kế thừa `docs/agent-loops-plan.md` (2026-07-06) — bản đó vạch 4 loop
> vận hành (content/SEO, dev/QA, pipeline, growth) nhưng chưa bao giờ được implement;
> `.claude/agents/` và `.claude/commands/` lúc đó vẫn trống. Bản này implement tầng 1 và
> thêm cái mà bản kia thiếu: **phân tầng rủi ro** để "auto to prod" không phải là đánh bạc.

---

## 1. Nó làm gì

```
Anh: /idea "thêm bảng xếp hạng CLB theo tháng"
  │
  ├─ Bước 0  Làm rõ ─────── AskUserQuestion, tối đa 3 câu đáng hỏi
  │
  ├─ Bước 1  Recon ──────── idea-recon (read-only)
  │                          "cái này đã có 70% ở src/pages/Rankings.tsx rồi"  ← thường dừng ở đây
  │
  ├─ Vòng 1  Panel ──────── CHẠY SONG SONG, ĐỘC LẬP, KHÔNG NHÌN THẤY NHAU
  │          ├─ solution-architect  (Claude Opus)      → 2–3 phương án + trade-off
  │          ├─ ui-ux-critic        (Claude + GPT-5.6) → giao diện, luồng, copy VI, a11y
  │          ├─ risk-auditor        (Claude + GPT-5.6) → SLO, perf, SEO, rollback, TIER
  │          └─ pre-mortem          (Claude, đọc repo)  → 3 postmortem sự cố chưa xảy ra
  │                                          ↓ ghi round1/*.md
  ├─ Bảng bất đồng ──────── debate.json: ai nói gì, mâu thuẫn ở đâu
  │
  ├─ Vòng 2  Đối chất ───── MỘT vòng. Mỗi agent đọc output 2 agent kia:
  │            CONCEDE (bắt buộc trích file:L42) | HOLD | REFINE
  │            → debate-ledger.mjs --strict  ← MÁY kiểm tra, không tin lời hứa
  │                                          ↓ ghi round2/*.json
  ├─ Tổng hợp ──────────── docs/proposals/<slug>/proposal.md
  │                          bất đồng còn mở → LÊN ĐẦU báo cáo (mục 0)
  │
  └─ Trình anh ─────────── 8 dòng trong chat + link raw

Anh: /ship <slug>
  │
  ├─ Gate tier ──────────── 🔴 RED → DỪNG, đợi anh duyệt tường minh
  ├─ Branch + code ──────── từng increment một
  ├─ qa-verifier ────────── lint→TheLine→tsc -b→vitest→build→bundle→e2e (≤5 vòng)
  │                          → chứng minh code CHẠY
  ├─ ui-ux-verifier ─────── chụp preview (mobile trước) → NHÌN → đối chiếu proposal
  │                          → chứng minh build ra ĐÚNG cái đã duyệt · FAIL = chặn merge
  └─ release-pilot ─────── baseline lỗi → PR → CI → merge → deploy → smoke
                            → SOAK 30 PHÚT (client_errors) → TỰ REVERT nếu đỏ
```

**Vì sao panel phải chạy song song:** chạy tuần tự thì agent sau bị mồi bởi kết luận của agent
trước, và anh nhận về ba bản sao của cùng một ý kiến thay vì ba ý kiến. Sự độc lập *là* sản phẩm.

**Vì sao tiêu chí thoát KHÔNG phải đồng thuận** — quyết định thiết kế quan trọng nhất ở đây:

LLM rất dễ đồng ý. Bắt hai agent tranh luận đến khi thống nhất thì chúng *sẽ* thống nhất — bằng
nhượng bộ, không phải bằng đúng. Anh nhận được đồng thuận giả, và tệ hơn: anh sẽ **tin nó**, vì nó
trông như đã qua tranh luận. Bất đồng mới là sản phẩm: `risk-auditor` nói RED trong khi `architect`
nói ship được chính là dòng đắt nhất trong cả báo cáo. Ép chúng hội tụ là trả tiền để xoá đi thứ
vừa mua.

Nên vòng 2 chỉ có một việc: **giết bất đồng ẢO** (agent B chưa thấy file X). Bất đồng THẬT — cùng
dữ kiện, khác đánh giá — phải sống sót và lên bàn của anh. Tiêu chí thoát là **mọi bất đồng đều có
địa chỉ**: hoặc `RESOLVED_EVIDENCE`, hoặc `OPEN_FOR_CUONG`. Bất đồng còn mở là kết quả *thành công*.

**Vì sao luật đối chất phải do máy cưỡng chế:** viết "chỉ nhượng bộ khi có bằng chứng" vào prompt
rồi tin model tuân thủ là tự lừa mình — đúng cái tính dễ đồng ý đang cần chặn cũng sẽ khiến nó đồng
ý với luật rồi lờ đi. `debate-ledger.mjs` bắt `CONCEDE` phải kèm `path/to/file.ts:L42`, regex loại
thẳng những lý do kiểu "nghe có lý / hợp lý / em đồng ý với", và **chặn `risk-auditor` CONCEDE trên
một RED** — hai agent kia không có thẩm quyền tranh luận hạ một thứ không revert được.

**Hai trục phòng thủ — đừng nhầm chúng với nhau.** Đây là chỗ dễ tự lừa mình nhất:

- **Độc lập (GPT-5.6).** Claude review đề xuất do Claude viết là tự chấm bài mình. Nếu Claude coi
  nhẹ một loại rủi ro nào đó thì cả bốn agent cùng coi nhẹ y hệt, cùng lúc, cùng tự tin — role-prompt
  không sửa được điểm mù chung, vì nó đổi *chỉ dẫn* chứ không đổi *người review*. GPT-5.6 không giỏi
  hơn Claude; nó **khác**, và khác là thứ duy nhất bắt được điểm mù chung. Cái giá: nó không thấy repo
  nên bịa được.
- **Căn cứ (`pre-mortem`).** Đọc repo, nên mọi mắt xích phải trỏ tới file thật. Cái giá: vẫn là Claude,
  nên không độc lập.

Không cái nào thay được cái kia — đó là lý do có cả hai. Và **skill không thay được trục thứ nhất**:
một "red-team skill" chạy trên Claude vẫn là Claude tự chấm bài mình, chỉ khác là mặc thêm cái áo.

Agent phải **xác minh từng claim của model ngoài trong repo trước khi đưa vào báo cáo**, ghi rõ cái
nào bị bác bỏ. Rủi ro thật của multi-model không phải bất đồng — là hallucination được mặc áo
"second opinion" rồi trôi thẳng vào báo cáo.

**Cảnh giác:** `risk-auditor` + `pre-mortem` cùng phe "tìm cái hỏng" nên sẽ gật đầu với nhau nhiều, và
điều đó *trông* như xác nhận mạnh. Không phải. Hai Claude đồng ý với nhau chỉ chứng minh chúng cùng là
Claude. Đồng thuận **có nghĩa** duy nhất là khi GPT-5.6 và một agent Claude tới cùng kết luận một cách
độc lập.

---

## 2. Guardrail — chỗ em phải nói thẳng với anh

Anh chọn **"full auto tới production"**. Em dựng theo hướng đó, nhưng không dựng đúng nghĩa đen,
và đây là lý do:

Repo này đã có một mạng lưới CI thật đáng nể cho một người: `quality.yml` (lint · TheLine ·
migration dup · auth registry · `tsc -b` · 25 suite Vitest · build · bundle budget),
`playwright.yml`, `pgtap.yml`, `deploy-guard.yml`, `security.yml`, `lighthouse.yml`, `visual.yml`.
Với mạng lưới đó, auto-merge **là** phòng thủ được — nhưng chỉ với những thay đổi mà **CI có thể
chứng minh là đúng, và `git revert` có thể hoàn tác**.

Một migration không nằm trong tập đó. `git revert` gỡ được code, không gỡ được cột đã DROP hay
policy RLS đã mở. Một push đã gửi 2000 người không rút lại được. Một Worker deploy ngoài PR gate
không có bằng chứng CI nào để dựa vào. Với những thứ đó, "auto" không phải là tự động hoá — là
bỏ chốt an toàn ở đúng chỗ duy nhất mà chốt đó có tác dụng.

Nên `scripts/agents/risk-tier.mjs` phân ba tầng:

| Tier | Là gì | Pipeline được làm gì |
|---|---|---|
| 🟢 **GREEN** | docs, tests, scripts, markdown | Auto-merge khi CI xanh |
| 🟡 **AMBER** | `src/**`, `functions/**`, blog, styling, edge function thường | Auto-merge khi CI **+ preview smoke + seo-verify** xanh, **+ smoke production sau deploy, tự revert nếu fail** |
| 🔴 **RED** | migration · RLS · `config.toml` · auth/payment/OTP function · `_middleware.ts` · `_lib/render/**` · `workers/**` · `_headers` (CSP) · native `android|ios|apple/**` · `*.legacy.tsx` · `.github/workflows/**` · build config | **DỪNG.** Anh duyệt tường minh. Không có ngoại lệ. |

Định nghĩa RED gọn lại đúng một câu: **không revert được.** Đó là toàn bộ tiêu chí.

Đường dẫn lạ → mặc định AMBER, không mặc định GREEN. Fail safe, không fail open.
`risk-auditor` được **nâng** tier (classifier đọc path, auditor đọc ý định), **không được hạ**.

Anh chỉnh được ranh giới trong `RULES` ở đầu `risk-tier.mjs` — mỗi rule có một trường `why`, và
rule nào không giải thích nổi thì sớm muộn cũng bị bỏ qua lúc vội. Nếu sau vài tháng anh thấy
một loại RED nào đó thực sự an toàn, hạ nó xuống có chủ đích còn hơn để pipeline tự nới trong lúc
chạy.

Thực tế: **hầu hết thay đổi là AMBER và sẽ tự lên prod.** RED không nhiều, nhưng đúng là những
lần anh muốn được hỏi.

---

## 3. Cài đặt

### 3.1 API key

Chỉ cần **một** key. Gemini đã bị bỏ khỏi panel (quyết định 16/7): nó không đọc được repo nên
bịa nhiều, sản lượng thật thấp so với chi phí một key + một model `-preview` sẽ bị deprecate.
Trục "độc lập" giao cho GPT-5.6, trục "có căn cứ" giao cho `pre-mortem` (đọc repo).

```sh
# ~/.zshrc — hoặc cùng chỗ với secrets hiện tại (~/Downloads/secrets.local.md, ngoài repo)
export OPENAI_API_KEY="sk-..."

# đã verify bằng API thật 2026-07-16, không phải đoán từ tài liệu
export OPENAI_MODEL="gpt-5.6"    # alias → gpt-5.6-sol. Không nằm trong /v1/models nhưng gọi được.
```

`ask-model.mjs` vẫn giữ hỗ trợ Gemini (`--provider gemini`) để dành — muốn dùng lại thì set
`GEMINI_API_KEY` + `GEMINI_MODEL="gemini-3.1-pro-preview"`, không phải sửa code.

**Tên model là dữ kiện, không phải thứ suy ra từ bài báo.** Lần đầu em đặt `gemini-3.1-pro`
theo kết quả search → 404; ID thật là `gemini-3.1-pro-preview`. Đúng cái bẫy em vừa dựng rào
chắn trong `risk-auditor`. Hỏi API, đừng hỏi blog:

```sh
node scripts/agents/ask-model.mjs --provider openai --list-models
```

Gõ sai tên model → script tự in danh sách thật thay vì ném 404 rồi để anh đi mò.

**Không dùng alias kiểu `*-latest`.** Alias tự cập nhật làm panel đổi hành vi âm thầm: tháng sau
một proposal ra kết luận khác, anh không phân biệt được do code đổi hay do vendor đổi model —
phá đúng thứ audit trail sinh ra để bảo vệ. Pin ID cụ thể. Mỗi lần gọi model ngoài, script ghi
`<out>.meta.json` kèm model ID chính xác + timestamp, để sáu tuần sau anh còn biết "GPT-5.6 nói
X" là bản nào.

Key **không bao giờ** vào repo. `ops-runbook.md` §2 là chuẩn hiện có — theo nó.

Thiếu key → script exit 3, agent chạy solo và **ghi rõ trong báo cáo là panel thiếu người**.
Không im lặng giả vờ đã có second opinion.

### 3.2 Test bridge

```sh
node scripts/agents/ask-model.mjs --provider openai --prompt "Reply with exactly: OK"
```

Đã chạy thật: `gpt-5.6` trả lời trong ~2s. Script tự retry 429/5xx (backoff 1.5s → 3s → 6s).
Với OpenAI nó thử `/v1/responses` trước rồi
fallback `/v1/chat/completions` — ép một bên bằng `OPENAI_API_MODE=responses|chat`.

### 3.3 Test classifier

```sh
node scripts/agents/risk-tier.mjs --files "src/pages/Feed.tsx"                    # → 🟡 AMBER
node scripts/agents/risk-tier.mjs --files "supabase/migrations/20260716_x.sql"    # → 🔴 RED
node scripts/agents/risk-tier.mjs --base origin/main --json                       # → diff hiện tại
```

### 3.4 Dùng ở đâu

**Claude Code CLI** (trong repo) — chạy được ngay, không cần cài gì thêm:

```sh
cd ~/pickle-hub-pro
claude
> /idea thêm bảng xếp hạng CLB theo tháng
> /ship club-monthly-rankings
```

Đây là nơi pipeline mạnh nhất: chạy được `npm run build`, `gh pr`, `git`, e2e thật.

**Cowork** (app này) — `.claude/agents/` được đọc tự động, gọi đích danh bằng tên:

```
Chạy agent idea-recon cho ý tưởng: bảng xếp hạng CLB theo tháng
```

Slash command `/idea` là tính năng CLI. Trong Cowork, cách tương đương là bảo em chạy đúng luồng
ở §1 — em có `Agent`, `Bash`, `Skill`. Muốn `/idea` gõ được ở cả hai chỗ thì đóng gói thành
plugin (`create-cowork-plugin`), nhưng nên đợi đã: chạy tay vài lần trước, sửa cho đúng, rồi
hẵng đóng gói. Đóng băng một thiết kế chưa qua thực chiến chỉ khiến sửa nó khó hơn.

---

## 4. Panel

| Agent | Model | Vai | Khác biệt thật sự nằm ở đâu |
|---|---|---|---|
| `idea-recon` | Sonnet | "đã có sẵn gì?" | Chỉ đọc. Cấm ý kiến. Output tốt nhất: "cái này có rồi, ở đây" |
| `solution-architect` | Opus | 2–3 phương án | Bắt buộc có "bản rẻ". Bắt buộc chốt một cái. "Đừng làm" là kết luận hợp lệ |
| `ui-ux-critic` | Opus + **GPT-5.6** | giao diện, luồng, copy VI, WCAG AA | Nói thay người dùng đứng ở sân, Android tầm trung, 4G, một tay |
| `risk-auditor` | Opus + **GPT-5.6** | rủi ro, SLO, perf, SEO, rollback | Đối kháng. Không cố làm feature xảy ra. Sở hữu tier |
| `pre-mortem` | Opus (đọc repo) | 3 postmortem của sự cố chưa xảy ra | Giả định ĐÃ hỏng. Bắt chuỗi hợp thành mà checklist không có ô để tick |
| `qa-verifier` | Sonnet | vòng lint→build→e2e | Chỉ báo cái đã chạy qua. ≤5 vòng rồi escalate |
| `release-pilot` | Opus | PR→CI→preview→merge→deploy→smoke→revert | Thiên vị mặc định là **dừng** |

Ba agent panel dùng skill `design:*` khi cần: `design-critique`, `accessibility-review`,
`ux-copy`. Không gọi hết cho có — gọi cái thay đổi được kết luận.

Luật vòng 2 nằm ở `docs/agent-round2-rules.md` (một nguồn, các agent trỏ vào).

### Plugin `engineering` — dùng 3, loại 7

Cài 2026-07-16. Chỉ 3 skill kiếm được chỗ; nối cả 10 là bloat, và một skill trùng việc
với checklist đã tinh chỉnh theo repo thì **tệ hơn là không có**.

| Skill | Nối vào | Vì sao nó thêm được thứ gì đó |
|---|---|---|
| `engineering:code-review` | `qa-verifier`, sau khi tool xanh | Tool chứng minh code **chạy**, không chứng minh **đúng**. `tsc` vui vẻ với N+1; ESLint không có ý kiến về race condition; 25 suite Vitest không biết RPC mới thiếu RLS check. Advisory, không chặn merge — nhưng finding security/data thì chép nguyên văn. |
| `engineering:debug` | `qa-verifier` khi kẹt ở vòng 3 | Tới lần thử thứ 3 thì agent không còn debug nữa, nó đoán nhanh. Skill ép lại đúng trình tự đã bỏ: reproduce → isolate → diagnose. |
| `engineering:incident-response` | `release-pilot`, **sau khi revert bắn** | Revert bắn = một sự cố thật, prod hỏng vài phút với người thật. Chế độ `postmortem` → append `.claude/memory/lessons-learned.md`. |

**`engineering:deploy-checklist` — LOẠI, có bằng chứng.** Nó bảo *"Deploy to staging and
verify"* (không có staging, chỉ preview), *"On-call team notified"* (Cuong **là** team),
*"Monitor error rates for 15 min"* (soak ở đây 30 phút + bắt signature mới — mạnh hơn hẳn).
Nối nó vào `release-pilot` không cộng thêm gì, mà **trung bình hoá xuống**: agent có thể đi
làm theo "deploy to staging" trong khi checklist thật biết về `pr:v26`, `verify_jwt`,
`BLOG_POST_META`, PR #114–122. Skill chung cạnh checklist tinh chỉnh là khoản lỗ ròng.

7 skill còn lại (`architecture`, `system-design`, `testing-strategy`, `tech-debt`,
`documentation`, `standup`) không nối — dùng tay khi cần, đừng nhét vào pipeline.

**MCP đi kèm plugin:** `datadog` + `pagerduty` không liên quan (anh dùng Telegram +
`client_errors`) → **đừng authorize**, mỗi connector là thêm một bề mặt. `github` MCP thì
`gh` CLI đã làm được và đã nằm trong allow-list của `settings.local.json` — không cần.

### Anh theo dõi ở đâu

Mỗi lần chạy để lại một thư mục — đọc được nguyên văn, không qua bản tổng hợp của em:

```
docs/proposals/<slug>/
  00-intake.md        # anh trả lời gì ở bước làm rõ
  round1/*.md         # output ĐỘC LẬP của từng agent, nguyên văn
  round2/*.json       # CONCEDE/HOLD/REFINE + bằng chứng trích dẫn
  external/*.md       # prompt GỬI ĐI + reply GPT-5.6 + .meta.json (pin model ID)
  debate.json         # ledger — máy đọc được
  proposal.md         # bản tổng hợp (mục 0 = thứ cần anh quyết)
```

`external/` chứa cả prompt gửi đi, không chỉ reply. Nếu một model ngoài đưa kết luận lạ, thường
là do brief gửi nó thiếu bối cảnh — không đọc được prompt thì không debug được panel.

Trong lúc chạy, `/idea` in tiến trình ra chat:

```
🔍 recon xong — Rankings.tsx đã có 60% việc này
✅ solution-architect — Option B, 3 nửa ngày
✅ ui-ux-critic — 2 blocker
✅ risk-auditor — 🔴 RED (migration)
⚔️ 2 bất đồng: D1 có cần migration · D2 tab riêng hay trong /feed
⚔️ vòng 2: D1 architect CONCEDE (20260515100000_*.sql:L42) · D2 cả hai HOLD → cần anh
```

Thấy agent đi sai hướng thì `Esc` cắt, sửa prompt, chạy lại — rẻ hơn nhiều so với đọc xong
báo cáo 8 trang rồi mới phát hiện.

---

## 5. Những chỗ agent bắt buộc phải biết

Đã nhúng vào từng agent, ghi lại đây để anh kiểm tra khi sửa:

- **`verify_jwt = true` trên function user-facing → 401 toàn bộ user.** Lỗi ES256/HS256 của
  Supabase vẫn còn sống. Không ai được "sửa" chỗ này (CLAUDE.md).
- **Blog = 5 thay đổi đồng thời.** Thiếu `BLOG_POST_META` → Googlebot ăn 404 trong khi SPA render
  hoàn hảo. Đây là kiểu lỗi im lặng cả tháng không ai biết.
- **`tsc --noEmit` không có `-b` → check 0 file, luôn pass.** Root tsconfig dùng `files: []` +
  project references. Nếu typecheck chạy nhanh bất thường, anh vừa chạy sai lệnh.
- **Bundle 1970 KB gz, còn ~20 KB.** Đã bump hai lần chống cháy. Không được bump lần ba để build
  pass — đó là quyết định của anh + `docs/perf-budgets.md`, không phải cách lách của agent.
- **Migration không revert được.** Là toàn bộ lý do RED tồn tại.
- **Không đụng `*.legacy.tsx`** ngoài rollback thật.
- **GA4 global bị bot datacenter Mỹ làm nhiễu** — chỉ tin segment Vietnam / Ahrefs. Và Ahrefs MCP
  trả `Insufficient plan` cho mọi tool: **không gọi** (quyết định 29/6/2026, `MEMORY.md`).
- **Verify SEO bằng `curl -A "Googlebot"`**, không dùng GSC Live Test (false negative).
- **PR #114–#122 (DUPR) không auto-merge.**

---

## 5b. Ba điểm chạm UI/UX — và vì sao cần ba

Trước đây giao diện chỉ được review **một lần**, ở `/idea`, lúc chưa có gì để nhìn.
`ui-ux-critic` đang phê bình một *ý tưởng*. Sau khi code xong không ai nhìn lại. Lighthouse
trả điểm số, `visual.spec.ts` so pixel với baseline cũ — không cái nào hỏi *"cái build ra có
đúng cái đã duyệt không, và nó có tốt không"*.

| Khi nào | Ai | Trả lời câu gì | Trạng thái |
|---|---|---|---|
| Lúc thiết kế (`/idea`) | `ui-ux-critic` + GPT-5.6 | "nên làm thế nào?" | ✅ |
| Sau khi code (`/ship`) | `ui-ux-verifier` + GPT-5.6 | "build ra có đúng cái đã duyệt không?" | ✅ mới thêm |
| Trên máy thật | **Cuong** | "dùng có sướng không?" | không agent nào thay được |

`preview-shots.mjs` chụp **mobile trước** (412×915, Pixel 7 — cùng device với e2e), locale
`vi-VN`, timezone `Asia/Ho_Chi_Minh`. Xem desktop trước là tái tạo đúng cái thiên lệch mà
panel sinh ra để chặn. Nó cũng bắt console error vào `manifest.json`: **một trang chụp lên
rất đẹp trong khi đang ném exception** — ảnh không cho anh thấy điều đó.

`ui-ux-verifier` FAIL → `release-pilot` không merge, ngang một CI check đỏ.

Lưu ý về `visual.spec.ts` sẵn có: nó gated sau `VISUAL=1`, chỉ chạy desktop-chromium,
baseline env-specific → **thực tế không chạy trong pipeline mặc định.** Anh đang có visual
regression trên giấy tờ nhiều hơn trên thực tế. `ui-ux-verifier` không thay thế nó (pixel
diff bắt được drift mà mắt bỏ qua), nhưng hiện nó là thứ duy nhất thật sự nhìn.

## 5c. Soak window — vì sao smoke một phát là không đủ

`release-pilot` trước đây deploy xong curl `/` một cái rồi coi như verified. Một mã 200 chứng
minh cái shell boot được, **một giây sau deploy**. Nó không chứng minh feature chạy. Regression
thật cần có user chạm vào route, cần đăng nhập, cần cái điện thoại chậm — chúng nổi lên sau
vài phút, không sau một giây.

```sh
node scripts/agents/soak-watch.mjs --baseline --out /tmp/soak-<slug>.json   # TRƯỚC merge
node scripts/agents/soak-watch.mjs --watch --baseline-file /tmp/soak-<slug>.json --minutes 30
```

Tín hiệu chính **không phải tỉ lệ lỗi.** Với ~2k user, rate rất nhiễu — spike gấp 2 trên nền
3 lỗi là vô nghĩa. Tín hiệu thật sự có nghĩa "deploy của anh làm gãy cái gì đó" là **signature
mới**: một message chưa từng xuất hiện trong 24h qua và bắt đầu xuất hiện sau khi SHA của anh
lên. Cụ thể, nhân quả, khó cãi.

Signature được chuẩn hoá (UUID → `<uuid>`, số → `<n>`) để cùng một bug không trông như 50 bug
khác nhau. Đã unit-test: ổn định qua UUID/số dòng, vẫn phân biệt được bug khác nhau.

Thấy signature mới → **dừng sớm, không đợi hết 30 phút.** Mỗi phút gom thêm bằng chứng là một
phút nữa user gặp lỗi.

Hạ tầng này anh **đã có sẵn** — `client_errors` (SEC-03, hardened 15/7) + spike detector 10
phút + Telegram alert. Pipeline chỉ đang không dùng nó.

**Giới hạn phải nói thẳng:** soak chỉ thấy lỗi **có ném exception**. Feature render ra, không
crash, và vô dụng — nút không ai với tới, luồng người ta bỏ giữa chừng, INP tăng 300ms — sinh
ra **0 client_errors** và một soak sạch tinh. "Soak 🟢" nghĩa là *30 phút không có gì gãy to*,
không phải *feature dùng tốt*. Đó là lý do vẫn cần mục 6.

## 6. Nó không làm được gì

Nói trước để anh không phát hiện lúc đã muộn:

- **Chạm.** `ui-ux-verifier` nhìn được ảnh tĩnh — nó không cảm được scroll giật, animation lỗi,
  nút quá nhỏ cho ngón cái, hay 4G ở sân bóng lúc 7h tối. Ảnh chụp bắt lỗi bố cục; nó không bắt
  được sản phẩm dùng khó chịu. Cả `qa-verifier` lẫn `ui-ux-verifier` đều có mục "Em KHÔNG verify
  được" và mục đó **bắt buộc có nội dung** — để một chữ PASS không âm thầm khiến anh tin rằng đã
  có ai đó thật sự dùng thử.
- **Login thật, thanh toán thật, push thật.** Cần anh.
- **Kill switch.** Chưa có. Nghĩa là lỗi tinh vi (không crash nhưng vô dụng) chỉ có `git revert`
  — và với migration thì revert không đủ. Đây là lỗ hổng lớn nhất còn lại; nó sẽ tự chạy qua `/idea`
  đúng quy trình vì bản thân nó là RED (cần migration + RLS).
- **Đo xem có ai dùng không.** Success metric ghi ở intake nhưng chưa ai quay lại đo sau 7 ngày.
- **GSC request indexing.** Không có public API cho blog/tournament (chỉ JobPosting + BroadcastEvent).
  Agent xếp hàng URL, anh bấm.
- **Biết người dùng có muốn thứ này không.** Panel phân tích được phương án; không thay được việc
  hỏi cộng đồng. `design:user-research` giúp thiết kế câu hỏi, không giúp trả lời hộ.
- **Deploy Worker.** Ngoài PR gate → không có bằng chứng CI → không auto.

---

## 7. Chạy thử tuần đầu

Đừng bật full auto ngay. Không phải vì em không tin thiết kế — mà vì tuần đầu là lúc anh còn
sửa được `RULES` rẻ, và niềm tin vào pipeline chỉ mất một lần duy nhất.

1. **Ngày 1–2:** chỉ chạy `/idea` trên 2–3 ý tưởng có thật. Đọc proposal. Panel có bắt được thứ
   anh sẽ tự bỏ sót không? Nếu ba agent chỉ nói cùng một điều bằng ba giọng → prompt sai, sửa
   trước khi cho nó chạm git.
2. **Ngày 3–4:** `/ship` một cái GREEN (docs) rồi một cái AMBER nhỏ (một component). Nhìn kỹ
   `release-pilot` ở bước post-deploy smoke.
3. **Ngày 5:** cố tình ship một thứ gãy (component throw) → xác nhận nó **tự revert**. Đây là
   bài test quan trọng nhất trong cả tuần. Auto-revert chưa từng chạy thật thì không phải là
   auto-revert, chỉ là một đoạn văn trong file markdown.
4. **Sau đó:** để AMBER tự chạy. RED vẫn hỏi anh. Vài tháng nữa xem lại `RULES` với dữ liệu thật.

---

## 8. File

```
.claude/agents/
  idea-recon.md · solution-architect.md · ui-ux-critic.md
  risk-auditor.md · qa-verifier.md · ui-ux-verifier.md · release-pilot.md
.claude/commands/
  idea.md · ship.md
scripts/agents/
  ask-model.mjs      # bridge OpenAI (+Gemini để dành), retry, --list-models
  risk-tier.mjs      # phân tầng GREEN/AMBER/RED từ đường dẫn file
  debate-ledger.mjs  # cưỡng chế luật đối chất, render bảng bất đồng
  preview-shots.mjs  # chụp preview (mobile trước) + bắt console error
  soak-watch.mjs     # baseline + soak 30p client_errors, bắt signature MỚI
docs/
  agent-idea-pipeline.md   # file này
  agent-round2-rules.md    # luật CONCEDE/HOLD/REFINE — nguồn duy nhất
  proposals/_TEMPLATE.md
  proposals/<slug>/        # audit trail mỗi lần chạy
```

Liên quan: `docs/agent-loops-plan.md` (4 loop vận hành — vẫn chưa implement, `/idea` không thay
thế nó), `CLAUDE.md`, `docs/slo.md`, `docs/perf-budgets.md`, `docs/ops-runbook.md`,
`.claude/memory/lessons-learned.md`.
