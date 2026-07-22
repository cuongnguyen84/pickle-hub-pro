# solution-architect — round 1 (nguyên văn, 2026-07-21)

## Tóm tắt kiến trúc

Hai bài toán tách bạch về surface nên xử lý độc lập. **(a) Cơ chế mốc:** nguồn sự thật là một file Markdown task-list có ngày trong repo (sống sót qua context-wipe, greppable), đọc bằng một script ~30 dòng ở đầu phiên — cộng một GitHub Action cron ping Telegram để mốc "nổ" cả khi không phiên nào tình cờ khởi động. **(b) Thi hành ngay:** QA-04 trước (suite E2E xanh là bội số reliability, gate cho mọi merge sau), và điểm mấu chốt là gốc rễ chung của 3/4 nhóm flaky nằm ở `tests/helpers/supabase-admin.ts` — mint session per-test qua magiclink → verifyOtp bị vô hiệu hoá lẫn nhau khi worker chạy song song cùng email. Sửa một chỗ (mint một lần/role qua storageState) dập cả lớp, không phải vá từng spec.

---

# Track (a) — Cơ chế mốc

## Option A — File mốc + script due-check (bản rẻ, đủ dùng)
Effort: 1 half-day · Files: `docs/milestones.md` (mới), `scripts/due-milestones.mjs` (mới, ~30 dòng), 1 dòng trong `CLAUDE.md` · Data: none

**How it works:** `docs/milestones.md` là task-list, mỗi mốc một dòng:
```
- [ ] 2026-07-24 PERF-05 — VN p75 LCP/INP/CLS before/after (GA4 web_vital) · docs/roadmap-8.5-9.md PERF-05
- [ ] 2026-08-01 THELINE-HARD — check-theline.mjs Rule 4 advisory→hard (line ~162)
- [ ] 2026-08-02 UX-07-FUNNEL — đọc funnel organizer_tournament, decide guest-path vs close (D5)
- [ ] 2026-08-04 BADGE-TELEMETRY — đọc reg_count_badge_impression, giữ/bỏ QuickTable social-proof
```
`scripts/due-milestones.mjs` regex `- \[ \] (\d{4}-\d{2}-\d{2})`, in ra dòng nào `date <= today`, exit 3 nếu có mốc quá hạn. `CLAUDE.md` thêm đúng một dòng vào block "Critical Workflow Notes": *"Đầu mỗi phiên autonomous: `node scripts/due-milestones.mjs` — mốc nào due thì thực thi hoặc ghi lý do defer."* Đánh dấu `[x]` khi xong. Format vừa human-editable vừa parse bằng regex — không cần lib.

**Wins:** Zero infra, zero dependency, không phải bump budget. Mốc thành dữ liệu deterministic thay vì prose phải eyeball. Một `assert`-self-check trong script là đủ test. · **Loses:** Vẫn phụ thuộc phản xạ "phiên có khởi động và có đọc". Nếu tuần đó không phiên nào chạy (Cuong đi vắng), mốc vẫn trôi. · **Forecloses:** Gần như không — đây là substrate mà mọi option khác build lên trên.

## Option B — Option A + GitHub Action cron ping Telegram
Effort: +0.5 half-day · Files: thêm `.github/workflows/milestone-due.yml` · Data: none (reuse `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` đã có)

**How it works:** workflow `schedule:` chạy 1 lần/ngày, gọi chính `scripts/due-milestones.mjs`; nếu exit-code báo có mốc due, gửi Telegram cho Cuong (copy nguyên block `Notify Telegram` trong `.github/workflows/playwright.yml:131-149`). Cuong nhận ping → khởi phiên (trigger đã hoạt động thật qua `telegram_queue.py`). Cùng một file nguồn `docs/milestones.md`, không có tracker song song.

**Wins:** Mốc "nổ" ngay cả khi không phiên nào tự chạy — bịt đúng lỗ hổng "session-limit cutoff" mà intake §Ràng buộc nêu. Reuse hạ tầng Telegram + secrets có sẵn, thêm ~40 dòng YAML. · **Loses:** Vẫn cần một con người/phiên hành động sau khi nhận ping — không tự-thực-thi end-to-end. · **Forecloses:** Không.

## Option C — Harness scheduled routine tự khởi phiên (CronCreate)
Effort: 0.5 half-day setup nhưng chi phí vận hành cao · Files: ngoài repo (routine config của harness) · Data: none

**How it works:** dùng skill schedule của Claude Code để tự START một phiên vào ngày due, phiên đó chạy mốc.

**Wins:** Con đường duy nhất tự-thực-thi hoàn toàn, không cần Cuong. · **Loses:** Cấu hình sống **ngoài repo** — không greppable, không test được, không sống trong git history; đúng cái bẫy "kiến trúc thông minh cần người thứ hai vận hành". Khi nó misfire lúc 2am, không ai truy được vì sao, và một phiên autonomous tự chạy migration/PR mà không có mắt người ở mốc RED-adjacent (THELINE-HARD sửa gate) là rủi ro thật. · **Forecloses:** Kéo team vào phụ thuộc một scheduler đục — muốn bỏ phải tháo cả thói quen.

## Khuyến nghị Track (a): **A + B** (A land trước, đủ tự thân; B là increment insurance)
A một mình đã sửa đúng nguyên nhân gốc — mốc rơi vì chỉ sống trong `.claude/memory/`, giờ nó sống trong repo dạng dữ liệu + được một script ép đọc. B thêm ~40 dòng YAML tái dùng Telegram để phủ ca "zero phiên trong cửa sổ", chi phí gần bằng 0. **C thua** vì solo-op: một scheduler tự khởi phiên mà không kiểm chứng/test được trong repo, đụng vào mốc THELINE-HARD (sửa gate CI) mà không có mắt người — vi phạm trực tiếp "boring và legible thắng elegant và subtle". Nếu sau này Cuong xác nhận harness cron đáng tin và test được, có thể thêm C *lên trên* cùng file nguồn — không cần làm lại.

---

# Track (b) — Thi hành QA-04 & OPS-04

## Nguyên nhân gốc đã xác minh (đọc file, không đoán)

- **`/match/confirm` verifyOtp "expired" (auth.spec.ts:102):** không phải bug route. `loginAs` → `mintSessionForEmail` (`tests/helpers/supabase-admin.ts:64`) gọi `generateLink(magiclink)` → `verifyOtp` **mỗi test**. Magiclink token là single-use và bị token mới cùng email vô hiệu hoá; nhiều worker song song mint cùng `testuser103@picklehub.test` → token của test này bị test kia ghi đè trước khi verify → "invalid or has expired". Đây là **lớp lỗi chung** của mọi spec auth-gated, không riêng /match/confirm.
- **`/feed` title race (smoke.spec.ts:87):** assert title-không-rỗng sau `waitForTimeout(1500)` cố định; feed swap title trễ hơn 1.5s lúc CI chậm. Timeout cứng = flaky by design.
- **a11y filter-pill "execution context destroyed" (a11y.spec.ts:~224):** #426 đã sửa giá trị contrast (6.1:1). Lỗi còn lại là axe bị inject rồi trang client-navigate giữa chừng (tab mặc định /rankings có thể redirect). Không phải regression contrast — là race scan-vs-navigation.
- **DUPR SSO iframe (auth.spec.ts:76):** hard fail, **khác loại**. Test đòi `iframe[title="DUPR SSO"]` với `src` chứa `dupr.`. Có thể là artifact env preview (CSP `frame-src`/DUPR chặn iframe trong CI) **hoặc** bug prod thật. Chưa được kiểm chứng — không skip mù (bẫy "xanh giả" trong memory `lighthouse-ci-failing-repo-wide`).

## QA-04 — Option A (khuyến nghị): sửa gốc storageState trước, mở 10 journeys sau
Effort: stabilize 2.5 half-days + journeys 4-6 half-days (deferrable) · Files: `playwright.config.ts`, `tests/helpers/auth.ts`, `tests/auth.spec.ts`, `tests/smoke.spec.ts`, `tests/a11y.spec.ts`, `docs/manual-test-backlog.md` · Data: none

- **inc1 (1 hd) — storageState setup project:** thêm một Playwright *setup project* mint session một lần/role, lưu `playwright/.auth/<role>.json`; các test dùng `storageState` thay vì `loginAs`+mint per-test. Xoá sạch lớp verifyOtp-race (#3). Session TTL 1h > thời lượng CI run. Verify: chạy `smoke` + `auth` 5 lần liên tiếp, xanh cả 5.
- **inc2 (1 hd) — thay timeout cứng bằng điều kiện:** `/feed` chờ title đổi khác giá trị SSR ban đầu (không chờ 1.5s cố định); a11y chờ URL settle + không có navigation pending trước khi inject axe (`page.waitForURL`/`waitForLoadState` sau khi active-pill có số). Verify: 5× xanh.
- **inc3 (0.5 hd) — điều tra rồi mới xử DUPR SSO:** curl header CSP `frame-src` prod + click tay modal DUPR (test browser UI, cần Cuong). Nếu là chặn env-only → `test.fixme` kèm lý do + dòng trong `docs/manual-test-backlog.md`. Nếu CSP prod thật thiếu `dupr.` → đó là bug prod, mở PR riêng, **không** gộp vào QA-04. Verify: CI QA-04 xanh, không silent-skip một test có thể bắt bug thật.
- **inc4+ (4-6 hd, DEFERRABLE) — 10 journeys:** chỉ mở sau khi inc1-3 cho suite xanh ổn định. Đây là stop-and-look tự nhiên.

**Wins:** một diff ở helper dập 3/4 nhóm flaky (root-cause, không vá từng caller). · **Loses:** storageState làm session dùng chung giữa test — test nào cần state mutation per-test phải mint riêng (hiếm). · **Forecloses:** không.

## QA-04 — Option B (rẻ hơn nữa, không khuyến nghị): quarantine 4 nhóm, mở journeys ngay
Effort: 0.5 + journeys. Skip/serialize 4 nhóm flaky rồi lao vào 10 journeys. **Loses:** để nguyên magiclink-race thì 10 journeys mới cũng flaky y hệt — nợ dời tới, journeys viết trên nền lún. Bị loại.

## OPS-04 — Option A (khuyến nghị): uptime pinger + tái dùng errors-telegram-alert, KHÔNG động GA4
Effort: 0.5 half-day (bịt gap SLO-1) + 1 half-day optional · Files: `.github/workflows/uptime-ping.yml` (mới); optional `supabase/functions/errors-telegram-alert/index.ts` · Data: none mới

`docs/slo.md` §"Known gaps" nói rõ hai điều: (1) **chưa có uptime pinger độc lập** (SLO-1 mới chỉ deploy-time), (2) SLO 2/3/6 **cần BASE-02 funnel events queryable** — mà `scripts/seo/ga4_report.py` chưa query custom event. SLO-5 (cron) đã do `errors-telegram-alert` phủ.

- **inc1 (0.5 hd) — uptime pinger:** GH Action `schedule:` mỗi 5-15 phút curl `/` và `/feed`, non-200 → Telegram (copy block playwright.yml). Bịt đúng gap #1, self-contained, reuse secrets. Verify: giả lập non-200 → nhận ping.
- **inc2 (1 hd, optional) — SLO-burn từ SQL sẵn có:** thêm một truy vấn burn-rate vào cron `errors-telegram-alert` cho SLO đã nằm trong SQL (auth/registration error-rate từ bảng function đang đọc). **Không** mở rộng GA4 — đó là địa hạt PERF-05/funnel-read (mốc tương lai, cần ~1 tuần RUM). Deploy edge function → xác nhận deploy status (không phải RED-tier: không đụng auth/payment/`config.toml`).

**Wins:** đúng "option A" Cuong đã chốt, mỗi increment đứng một mình, không bump budget, không dependency mới. · **Loses:** SLO 2/3/6 vẫn đọc tay tới khi funnel events queryable — nhưng đó là chặn dữ liệu, không phải chặn code. · **Forecloses:** không.

## Thứ tự QA-04 vs OPS-04: **tuần tự, QA-04-stabilize trước, KHÔNG song song**
Solo-op → một việc một lúc. Reliability outranks scope: **QA-04 inc1-3 (2.5 hd) trước** — suite xanh là gate cho mọi merge sau, kể cả OPS-04. Rồi **OPS-04 inc1 (0.5 hd)** vì bịt gap SLO-1 rõ ràng, giá rẻ. **Rồi mới QA-04 inc4 (10 journeys)** — khối lớn, hoãn được. OPS-04 inc2 hoãn cùng nhóm. Hai track đụng surface khác nhau (`tests/` vs `.github/`+`supabase/functions/`), không conflict — nhưng interleave có kỷ luật, không mở hai nhánh cùng lúc.

---

## Increments (toàn cục, thứ tự landing)
1. **Milestone Option A** (`docs/milestones.md` + `scripts/due-milestones.mjs` + 1 dòng CLAUDE.md) — verify: chạy script hôm nay in ra PERF-05 (2026-07-24) sắp due, THELINE-HARD/UX-07/BADGE chưa due; assert-self-check xanh. *Land đầu vì nó bảo vệ chính 4 mốc còn lại của meta-task này.*
2. **QA-04 inc1** storageState — verify: `smoke`+`auth` 5× xanh liên tiếp.
3. **QA-04 inc2** bỏ timeout cứng (feed + a11y) — verify: 5× xanh.
4. **QA-04 inc3** điều tra + quarantine/patch DUPR SSO — verify: QA-04 CI xanh, DUPR có lý do ghi rõ.
5. **OPS-04 inc1** uptime pinger — verify: non-200 giả lập → Telegram.
6. **Milestone Option B** `.github/workflows/milestone-due.yml` — verify: chạy workflow_dispatch tay, nhận ping PERF-05.
7. **[STOP-AND-LOOK]** QA-04 inc4 (10 journeys) + OPS-04 inc2 — chỉ mở sau khi 1-6 xanh và Cuong review.

---

## Điều em không chắc
- **Harness CronCreate/schedule có tự-start phiên đáng tin & test được không** — em không verify được trong repo nên xếp Option C dưới cùng. Nếu nó thật sự reliable + có audit trail, khuyến nghị Track (a) sẽ nghiêng về thêm C lên trên A+B; nhưng gánh nặng chứng minh thuộc về C.
- **DUPR SSO là bug prod hay artifact env** — chưa click tay/chưa curl CSP `frame-src` prod. Quyết định quarantine-vs-fix ở inc3 treo ở kiểm chứng này; không skip trước khi biết.
- **SLO-3 registration-failure có thực sự nằm trong bảng SQL cron đọc được không** — `slo.md` nói "edge function logs", có thể chưa emit rows vào `client_errors`. Nếu chưa, OPS-04 inc2 phải thêm bước ghi counter trước, làm nó đắt hơn 1 hd — nên em để inc2 là optional/deferrable.
- **verifyOtp flake: chắc do race token song song hay do OTP TTL ngắn** — em tin ~85% là race (single-use token cùng email × parallel workers), chưa repro cục bộ. Dù nguyên nhân nào, fix storageState (mint một lần) đều dập, nên độ bất định này không đổi kế hoạch.

Files load-bearing: `tests/helpers/supabase-admin.ts` (gốc flake auth), `tests/helpers/auth.ts`, `.github/workflows/playwright.yml` (pattern Telegram để copy), `scripts/check-theline.mjs` (Rule 4, line ~162), `docs/slo.md` (SLO + known gaps), `supabase/functions/errors-telegram-alert/index.ts`.
