# Mốc tự động phiên sau — cơ chế mốc + thi hành QA-04/OPS-04 + 4 mốc hẹn ngày

> Slug: `auto-milestone-run-2026-07` · Ngày: `2026-07-21` · Trạng thái: `approved` (Cuong 2026-07-21)
>
> **Quyết định của Cuong (kênh chat, 2026-07-21):**
> - D1/D2/D5: GẬT thiết kế hội tụ (md-file + daily re-ping + heartbeat · OPS-04 v1 = uptime pinger · /done để sau).
> - D3: ủy quyền orchestrator → chọn **(X) fixme + monitor CSP riêng** (2/3 panel; fixme phải trỏ tới monitor; hasAuthEnv fail-hard trên main giữ nguyên).
> - Mục 0-①: GA4 10 dimensions + 4 metrics ĐÃ đăng ký xong 2026-07-21, verify Realtime thấy `reg_count_badge_impression`.
> - Mục 0-② đổi hướng: Settings không còn mục Code scanning (repo PRIVATE plan free — GitHub siết). Cuong duyệt **phương án A**: `security.yml` CodeQL thêm `upload: never` + fail-on-findings từ SARIF cục bộ — giữ nguyên gate, thêm vào scope gói ship.
> Sinh bởi `/idea`. Panel 4 agent: `solution-architect` · `ui-ux-critic` (+GPT-5.6) ·
> `risk-auditor` (+GPT-5.6) · `pre-mortem`. Model ngoài chính xác: xem `external/*.meta.json`.
> Model thiếu key trong lần chạy này: `none`
>
> **Raw audit trail**: `round1/*.md` · `round2/*.json` · `external/*.md` · `debate.json` · `debate-table.md`

---

## 0. 🔶 Cần anh quyết

Chỉ **một fork thật** (D3). D1/D2/D5 panel đã hội tụ sau vòng 2 — cần anh gật thiết kế hội tụ, không cần phân xử. D6 chỉ liên quan khi làm burn-alert (deferred).

| # | Vấn đề | Phía A | Phía B | Nếu chọn sai thì sao |
|---|--------|--------|--------|----------------------|
| **D3** | Dòng spec DUPR SSO (`tests/auth.spec.ts:76`) nếu điều tra xác nhận fail là env-only (CSP chặn iframe trong CI) | `architect`+`risk-auditor`: `test.fixme` kèm lý do + backlog + **monitor CSP riêng** | `ui-ux-critic`: KHÔNG fixme — chuyển hẳn thành integration-test/monitor, spec giữ fail-hard | Chọn A mà quên monitor → silent guard-death (pre-mortem sự cố 1). Chọn B → CI đỏ vĩnh viễn trên thứ env không sửa được, agent sau lại "sửa" bằng skip |
| **D1/D2/D5 — gật thiết kế hội tụ** | (a) Cơ chế mốc = `docs/milestones.md` + script due-check + daily Telegram re-ping tới khi `[x]` + watchdog heartbeat — KHÔNG GitHub Issue/state machine. (b) OPS-04 v1 = uptime pinger + sửa bug `alert_count:193`; burn-alert deferred. (c) `/done` từ điện thoại = nice-to-have, mặc định KHÔNG làm. | | | |
| **Việc chỉ anh làm được (2 thao tác UI, làm sớm):** | ① **GA4**: đăng ký custom dimensions cho journey-step + badge params (dimension KHÔNG hồi tố — mỗi ngày chưa đăng ký là 1 ngày mốc 02/08 & 04/08 mất data; đăng ký hôm nay → 02/08 có ~12 ngày). Agent không có quyền GA4 admin. ② **GitHub**: Settings → Security → bật lại Code scanning (codeql đang đỏ "not enabled" trên #431 — repo-config, không sửa bằng code được). | | | |

---

## 1. Ý tưởng gốc

> Mốc tự động phiên sau: QA-04 từ #431 · OPS-04 Telegram · PERF-05 ~24/07 · funnel UX-07 ~02/08 · telemetry badge ~04/08 · .tl-btn HARD 01/08.

**Làm rõ ở bước 0** (từ memory/docs, không hỏi lại — mọi quyết định từng mốc đã chốt ở các phiên trước, xem `00-intake.md`):

| Hỏi | Trả lời |
|---|---|
| Ai dùng | Pipeline agent + Cuong (operator duy nhất, đọc Telegram trên điện thoại) |
| Đau ở đâu | Mốc chỉ sống trong `.claude/memory` — đã từng rơi (soak #407/#409); không có gì "nổ" đúng ngày |
| Thành công = | 6 mốc thực thi đúng hạn ±1 ngày, có bằng chứng, không mốc nào bị quên |
| Ràng buộc | Mốc 3–6 là mốc tương lai (thiếu data/chưa tới ngày); phiên autonomous không được tự làm việc RED không có Cuong |

---

## 2. Verdict — đọc cái này trước

| | |
|---|---|
| **Rủi ro** | 🔴 **RED** (classifier: workflow CI mới + đụng `tests/auth*` = auth surface + `playwright.yml`; auditor giữ AMBER — xem mục 6, theo luật tier chỉ được nâng không được hạ → RED) |
| **Khuyến nghị** | Milestone A+B (md-file + due-check + daily ping + heartbeat) → QA-04 stabilize gốc-rễ (storageState, thắng D4 bằng bằng chứng) → OPS-04 uptime pinger. 4 mốc hẹn ngày vào `docs/milestones.md` **kèm cả predicate lẫn ngày** |
| **Công sức** | ~5 nửa ngày (milestone 1.5 · QA-04 stabilize 2.5 · OPS-04 0.5 · GA4-dims ~0) + deferred: 10 journeys 4–6, burn-alert 1 |
| **Rủi ro lớn nhất** | "Ổn định" E2E biến thành làm mù suite auth (skip-thành-green) — 3 tuần sau prod vỡ đúng chỗ suite canh mà không ai biết |
| **Auto-merge** | **Chặn — cần Cuong duyệt** (RED). Sau duyệt, từng increment vẫn qua đủ gate + review APPROVED cho phần RED theo luật bot-identity |

---

## 3. Đã có sẵn gì (recon)

**Prior art:** KHÔNG có cơ chế "đến ngày X làm Y" nào trong repo — chỉ có GH Actions cron cố định (6 workflow), không cái nào khởi phiên agent hay đọc roadmap. Gần nhất: Telegram command queue (`scripts/ops/telegram_queue.py`, Cuong-initiated). Mốc hiện chỉ sống trong `.claude/memory` — đã chứng minh rơi.

**Sẽ đụng vào:** `docs/milestones.md` + `scripts/due-milestones.mjs` + `.github/workflows/milestone-due.yml` (mới) · `tests/helpers/{supabase-admin,auth}.ts`, `tests/{auth,smoke,a11y}.spec.ts`, `playwright.config.ts` · `.github/workflows/uptime-ping.yml` (mới) · `supabase/functions/errors-telegram-alert/index.ts` (bug alert_count:193) · `scripts/check-theline.mjs` (Rule 4, tới 01/08) · `scripts/seo/ga4_report.py` (tới ngày mốc đọc).

**Ràng buộc đã ghi trong repo:** PR #431 hiện: smoke FAILURE (3 flaky + 1 hard fail DUPR SSO), codeql FAILURE ("Code scanning is not enabled" — repo settings). `check-theline.mjs` header: HARD sau 01/08 **if no false positives** (judgment call). UX-07 02/08 là decision gate (D5 proposal ux-06-07 chưa quyết). Funnel/badge chỉ nằm GA4; `ga4_report.py` chưa đọc được custom events.

---

## 4. Phương án (solution-architect)

### Track (a) — Cơ chế mốc: Option A+B (khuyến nghị) ✅

Effort: 1.5 nửa ngày · Files: `docs/milestones.md`, `scripts/due-milestones.mjs` (~30 dòng), `.github/workflows/milestone-due.yml` (~40 dòng), 1 dòng `CLAUDE.md` · Data: none

- **A:** `docs/milestones.md` mỗi mốc 1 dòng `- [ ] YYYY-MM-DD ID — mô tả + PREDICATE` (bài học pre-mortem: mốc phải mang **cả điều kiện lẫn ngày** — "flip .tl-btn SAU KHI dry-run sạch", không phải "flip ngày 01/08"). Script due-check chạy đầu mỗi phiên (1 dòng CLAUDE.md), exit 3 khi có mốc quá hạn. Xong thì tick `[x]`.
- **B:** workflow cron 1 lần/ngày chạy script; còn mốc due chưa `[x]` → Telegram ping Cuong (copy block `playwright.yml:131-149`) — **re-ping mỗi ngày tới khi done**, không fire-once. + heartbeat vào cron-health (vòng 2 adopt từ ui-ux-critic — watchdog không được tự chết âm thầm).
- **Option C (harness CronCreate tự khởi phiên): LOẠI** — config ngoài repo, không test/audit được, và autonomous executor không người canh đụng mốc RED = điều kiện nâng RED của risk-auditor.

### Track (b) — QA-04: Option A (khuyến nghị) ✅ — sửa gốc, không vá từng spec

Root cause đã xác minh (không đoán): 3/4 nhóm flaky = **magiclink single-use bị vô hiệu chéo** giữa worker song song cùng email cố định (`tests/helpers/auth.ts:25-33` × `supabase-admin.ts:64-95`). Effort stabilize: 2.5 nửa ngày.

1. **inc1** — Playwright setup-project mint 1 lần/role → `storageState` (thắng D4: setup VẪN chạy `generateLink→verifyOtp` thật mỗi run, fail-hard). Kèm 3 điều kiện D4: `hasAuthEnv` **fail-HARD trên main** (giết silent guard-death — pre-mortem sự cố 1), +1 canonical test tiêu thụ fresh magic-link full-flow, verify token-refresh qua wall-time > TTL. Verify: smoke+auth 5× xanh liên tiếp.
2. **inc2** — thay timeout cứng bằng wait-on-state (`/feed` title, a11y chờ URL settle trước inject axe). Verify: 5× xanh.
3. **inc3** — DUPR SSO: **điều tra trước** (curl CSP `frame-src` prod + click tay), xử theo quyết định D3 của anh.
4. **inc4 (DEFERRED)** — 10 journeys: chỉ mở sau khi 1-3 xanh ổn định + anh review.

Option B (quarantine rồi lao vào journeys): **loại** — journeys mới sẽ flaky y hệt trên nền lún.

### Track (c) — OPS-04: uptime pinger trước, burn-alert sau ✅

- **inc1 (0.5 hd):** `.github/workflows/uptime-ping.yml` curl `/` + `/feed` mỗi 5-15 phút → Telegram khi non-200. Bịt đúng gap slo.md:27 ("no independent uptime pinger"), không cần GA4, không bị chặn bởi gì. Nhân tiện sửa bug `alert_count` (index.ts:193, ternary chết).
- **inc2 (DEFERRED, bị chặn bởi funnel-queryable):** burn-alert theo spec hội tụ D2 — budget 30-ngày rolling (slo.md:6) + detection 24h là tầng riêng, state-transition dedup, recovery message bắt buộc, **volume-alert thô độc lập fingerprint** (pre-mortem sự cố 2: outage đa-fingerprint hiện tại = 0 alert), night-quiet 22:00-07:00, copy VI dòng-đầu-tải-đủ-nghĩa (P1/P2 bằng chữ).

### 4 mốc hẹn ngày → nội dung `docs/milestones.md` (mỗi mốc kèm predicate)

```
- [ ] 2026-07-24 PERF-05 — đọc p75 VN trước/sau perf; PREDICATE: ≥7 ngày RUM post-#417; report kèm n, cửa sổ cân, verdict ∈ {GIỮ, ROLLBACK, CHƯA ĐỦ MẪU}
- [ ] 2026-08-01 THELINE-HARD — Rule 4 advisory→hard; PREDICATE: dry-run HARD sạch trên changed-files ≥5 PR merged gần nhất + mọi PR đang mở; sửa before=0 khi rename (--find-renames) TRƯỚC khi flip
- [ ] 2026-08-02 UX-07-FUNNEL — đọc funnel organizer_tournament 14 ngày; PREDICATE: GA4 dims đã đăng ký + đủ n (ngưỡng pre-commit: BUILD nếu ≥100 unique gặp wall + ≥30% bỏ + ≥10 reg thêm; CLOSE nếu đủ mẫu dưới ngưỡng; BLOCKED nếu thiếu n)
- [ ] 2026-08-04 BADGE-TELEMETRY — đọc reg_count_badge_impression; PREDICATE: impression-only KHÔNG kết luận keep/kill (chỉ trả lời "badge có hiện không"); muốn keep/kill cần badge_click/holdout — verdict hợp lệ gồm CHƯA THỂ KẾT LUẬN
```

### Increments (thứ tự landing toàn cục)

1. Milestone A (md + script + CLAUDE.md) — verify: script in PERF-05 sắp due, 3 mốc kia chưa
2. **Cuong**: đăng ký GA4 custom dimensions + bật Code scanning (2 thao tác UI)
3. QA-04 inc1 storageState — verify: 5× xanh
4. QA-04 inc2 wait-on-state — verify: 5× xanh
5. QA-04 inc3 DUPR SSO theo quyết định D3
6. OPS-04 inc1 uptime pinger + fix alert_count — verify: giả lập non-200 → nhận Telegram
7. Milestone B workflow + heartbeat — verify: workflow_dispatch tay → nhận ping
8. **[STOP]** deferred: 10 journeys, burn-alert, mở rộng ga4_report.py (trước ngày mốc đọc)

---

## 5. UI/UX (ui-ux-critic + GPT-5.6)

### Đánh giá tổng thể
Thiết kế sống chết ở **dòng đầu notification Telegram** (lock-screen, một tay, ngoài sân) và nguyên tắc **"nhắc tới khi DONE, không phải tới khi ĐỌC"**. Hai mốc đọc-số (badge, funnel) theo spec gốc sẽ đẻ report không trả lời được câu hỏi của chính nó — đã vá bằng predicate trong milestones.md.

### Vấn đề chính (đầy đủ ở `round1/ui-ux-critic.md`)
| # | Mức | Vấn đề | Sửa |
|---|-----|--------|-----|
| 1 | Blocker | Badge: impression-only → keep/kill là ngụy biện | Verdict `CHƯA THỂ KẾT LUẬN` hợp lệ; cần badge_click/holdout mới quyết thật |
| 2 | Blocker | GA4 dims không hồi tố → mốc 02/08+04/08 mù nếu chờ | Đăng ký NGAY (mục 0) |
| 3 | Blocker | "Ổn định" bằng skip test thật | Flake→sửa determinism; broken→triage, không skip |
| 5 | Nên sửa | Dòng đầu alert phí preview | `🔴 P1 · <metric> <số> (ngưỡng <x>)` — severity bằng chữ, không chỉ emoji |
| 6 | Nên sửa | Report kết bằng "tùy Cuong" = decision fatigue | Bắt buộc 1 verb + ngưỡng pre-commit + sample size |
| 7 | Nit | `alert_count:193` ternary chết | Sửa trong OPS-04 inc1 |

### Copy (trích — đầy đủ trong round1)
Milestone due: `⏰ MỐC ĐẾN HẠN · UX-07` + hạn + câu hỏi quyết định + trạng thái. SLO: `🟠 P2 · LCP p75 VN 2,84s (ngưỡng 2,5s)` + Duy trì/Mẫu/Ảnh hưởng/Việc cần làm. Tiếng Việt; metric/event giữ English.

### Panel đa model
- **Đồng thuận Claude+GPT-5.6:** re-ping idempotent tới khi done · watchdog heartbeat · severity chữ P1/P2 · report cần sample size + pre-committed rule · impression-only không kết luận được · sửa determinism ≠ skip. (Tín hiệu mạnh: vendor khác, độc lập.)
- **Bất đồng nội bộ:** GPT muốn supergroup 2 topic + máy trạng thái ACK 3 bước → critic giữ 1 chat + 2 trạng thái open/done (YAGNI); GPT tự nhượng phần lớn.

---

## 6. Rủi ro (risk-auditor + GPT-5.6 + pre-mortem)

### Verdict: 🔴 RED (hiệu lực) — auditor giữ 🟡 AMBER, để anh biết cả hai

Classifier đường dẫn nói: **RED** (`milestone-due.yml`/`uptime-ping.yml`/`playwright.yml` = CI config; `tests/auth*` = auth surface). Auditor lập luận AMBER: mọi phần git-revertable nếu cơ chế chỉ là reminder và QA-04 giữ hợp đồng auth; 2 điều kiện nâng RED của auditor (autonomous-executor-merge, auth false-green) đều đã bị thiết kế hội tụ vô hiệu hóa ở vòng 2. Theo luật "auditor được nâng không được hạ" so với classifier → gói trình anh ở **RED, chặn auto-merge**. (Tiền lệ: mọi migration = RED tất định — phiên 2026-07-21c.)

| # | Mức | Cơ chế hỏng | Giảm thiểu (đã vào thiết kế) |
|---|-----|-------------|------------------------------|
| 1 | Cao | QA-04 false-green: skip/retry/mock làm mù detector SLO-2/3 → prod vỡ auth 3 tuần không ai biết (pre-mortem #1: rotate secret → hasAuthEnv fail-open → 10/10 skip vẫn xanh) | hasAuthEnv fail-HARD trên main · canonical magic-link test · grep-gate diff tests/** (trừ pattern hợp pháp) · setup fail-hard |
| 2 | Cao | Telegram chung 1 chat + sendTelegram không retry → spam→mute→nuốt alert cron thật; HOẶC outage đa-fingerprint = 0 alert (pre-mortem #2: chunk-error mỗi user 1 hash → không nhóm nào chạm ngưỡng 3) | volume-alert thô độc lập fingerprint · state-transition dedup · recovery bắt buộc (vào spec burn-alert deferred) |
| 3 | TB | .tl-btn HARD flip theo ngày bỏ quên vế "if no false positives" → PR đỏ oan vì rename (`before=0`) → agent sau gỡ luôn ratchet (pre-mortem #3) | predicate trong milestones.md: dry-run sạch + fix --find-renames TRƯỚC flip; `quality.yml:55` không có `\|\| true` — verified chặn merge thật |
| 4 | TB | 3 mốc đọc-số quyết trên n nhỏ/GA4 bẩn bot | predicate + ngưỡng pre-commit + verdict "CHƯA ĐỦ MẪU" hợp lệ |
| 5 | TB→Cao | Autonomous executor tự chạy mốc RED không người canh | Cơ chế chỉ REMINDER; loại Option C |

### SLO bị đe dọa
SLO 2 (auth), SLO 3 (registration) — rủi ro #1; SLO 5 (cron-health) — rủi ro #2 cross-contamination. Không đụng: SLO 1/4/6/7.

### Perf / SEO / Mobile
Bundle **+0 KB** (không file nào vào dist). VN p75: none. Route SSR: không · KHÔNG bump `pr:v30`. Capacitor: không đụng.

### Rollback
Milestone/pinger/.tl-btn: git revert, phút. `errors-telegram-alert`: cần redeploy function (~5-10 phút). **Không revert được:** auth false-green (không có "undo" cho user đã kẹt ngoài) → chặn ở must-verify, không phải ở rollback.

### Must-verify trước merge (rút gọn — đầy đủ ở round1/risk-auditor.md)
- Diff `tests/**` không chứa retry/catch-verifyOtp/mock-supabase/skip/fixme ngoài quyết định D3
- Stabilize = wait-on-state, không nới timeout
- Token-refresh từ session seeded qua wall-time > TTL (D4 điều kiện 3)
- codeql sửa ở repo Settings, KHÔNG gỡ check khỏi gate

### Phản biện độc lập (GPT-5.6)
Đã xác minh: shared-channel + no-retry (index.ts:39,61) · GA4 pollution false-alert/silence · false-green class · .tl-btn chặn gate (mạnh hơn GPT nghĩ — `quality.yml:55` verified). Bác bỏ: GPT mô hình burn theo cửa sổ 10-phút — sai với slo.md:6 (30-ngày); "storageState là shortcut xấu" — bị lật ở D4 bằng bằng chứng. GPT không bịa file nào.

---

## 7. Tranh luận trong panel

> Vòng 1 độc lập → vòng 2 đối chất (một vòng). Đồng thuận không phải mục tiêu.
> Luật cưỡng chế bởi `debate-ledger.mjs` — kết quả: **6 bất đồng · 1 RESOLVED_EVIDENCE · 5 OPEN** (trong đó 3 đã hội tụ thực chất qua REFINE, 1 fork thật, 1 deferred). Bảng đầy đủ: `debate-table.md`.

| # | Trạng thái | Tóm tắt |
|---|-----------|---------|
| D1 | 🔶 hội tụ | md-file + daily re-ping + heartbeat (cả 3 REFINE về cùng thiết kế; Issue/state-machine bị bỏ — YAGNI) |
| D2 | 🔶 hội tụ | Bất đồng cửa sổ là ẢO: 30-ngày = budget, 24h = detection — hai tầng (cả 3 cite slo.md) |
| D3 | 🔶 **fork thật** | fixme+monitor vs không-fixme → **mục 0** |
| D4 | ✅ RESOLVED | risk-auditor CONCEDE bằng `supabase-admin.ts:64-95` — storageState vẫn exercise verifyOtp thật; vector false-green thật là hasAuthEnv fail-open |
| D5 | 🔶 hội tụ | Đăng ký GA4 dims NGAY (architect tự thêm increment sau khi verify event đã bắn — `Tournaments.tsx:272`); code đọc defer |
| D6 | 🔶 deferred | GA4 làm 1 nguồn SLO-2? — chỉ cần quyết khi làm burn-alert |

**Bất đồng bị giết ở vòng 2 (ảo):** D2 (hai tầng đo — cả ba phía cùng thấy slo.md:3-6 nói budget ≠ detection) · D4 (risk-auditor đọc `mintSessionForEmail` thấy setup-project vẫn chạy verifyOtp thật + throw cứng → CONCEDE đúng luật, có file:line). Đây là vòng 2 làm đúng việc: bất đồng do thiếu thông tin chết, bất đồng thật (D3) sống.

**Cross-vendor đồng thuận đáng tin:** GPT-5.6 (2 lượt độc lập, 2 brief khác nhau) + các agent Claude cùng kết luận: re-ping-tới-khi-done, guard-liveness/watchdog, impression-only không kết luận được, sửa-determinism-không-skip. Hai-Claude-gật-nhau (risk-auditor × pre-mortem cùng lo false-green) được tính là MỘT tín hiệu, không phải hai — nhưng ở đây GPT-5.6 độc lập cũng tới cùng chỗ.

**Nhượng bộ bị LOẠI:** không có — ledger strict pass, CONCEDE duy nhất (D4) kèm bằng chứng hợp lệ.

**Recon sai được sửa:** không phát hiện recon sai dữ kiện vòng này (khác phiên UX-01..05).

---

## 8. Kế hoạch verify

**Tự động (mỗi increment):**
- [ ] `npx eslint <changed>` · `npx tsc -b --noEmit` · `npm run test` · `npm run build` + bundle budget
- [ ] QA-04: smoke+auth **5× xanh liên tiếp** (định nghĩa "ổn định" — không phải 1 lần xanh)
- [ ] QA-04: grep diff `tests/**` theo checklist must-verify (không skip/retry/mock lén)
- [ ] QA-04: 1 shard chờ > access-token TTL → token-refresh OK (D4 đk 3)
- [ ] Milestone: `node scripts/due-milestones.mjs` self-check; workflow_dispatch tay → nhận Telegram
- [ ] OPS-04: giả lập non-200 → nhận ping; deploy function → `supabase functions list` confirm
- [ ] `BASE_URL=<preview> ./scripts/seo-verify.sh` (không đổi SSR — chỉ cần pass nguyên trạng)

**Cuong phải tự làm:**
- [ ] Quyết D3 + gật D1/D2/D5 (mục 0)
- [ ] GA4 UI: đăng ký custom dimensions journey-step + badge params (SỚM — mỗi ngày chậm mất 1 ngày data mốc 02/08)
- [ ] GitHub Settings → Security → bật Code scanning
- [ ] Click tay modal DUPR SSO trên prod (input cho QA-04 inc3)
- [ ] Duyệt RED: review APPROVED trên PR đụng workflows/tests-auth (luật bot-identity 2026-07-21)

---

## 9. Sau khi ship

- SHA: · PR: · Ngày:
- Khác kế hoạch:
- Học được (→ `.claude/memory/lessons-learned.md`): mốc phải mang predicate lẫn ngày; guard-liveness là hạng gate chưa tồn tại (pass≠executed, im≠ổn, xanh≠ratchet-còn-sống)
