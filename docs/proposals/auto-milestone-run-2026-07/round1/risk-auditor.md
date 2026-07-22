# risk-auditor — round 1 (nguyên văn, 2026-07-21)

Phát hiện quan trọng khi verify: `check-theline.mjs` chạy trong `quality.yml:55` (gate BẮT BUỘC) **không** có `|| true` — nên flip Rule 4 sang HARD sẽ chặn merge thật.

## Verdict: 🟡 AMBER (gói tổng)
Kết cục xấu nhất thực tế: một session autonomous chạy theo lịch, không có Cuong, "ổn định" E2E auth bằng cách retry/skip/mock → CI xanh vĩnh viễn nhưng **mất detector cho SLO 2 (auth) và SLO 3 (registration)** → OTP/magic-link hỏng trong prod, user thấy "Email link is invalid or has expired", không ai biết trong nhiều ngày.

Classifier said: gói = docs GREEN, nhưng đó là vì nó đọc list gộp thành 1 filename. Khi tách file: `playwright.yml` = **RED** (CI gate), `errors-telegram-alert` = **AMBER** (edge function), `check-theline.mjs`/`ga4_report.py` = GREEN operator script. **Em giữ gói ở AMBER** — không phần nào thực sự non-revertable NẾU cơ chế chỉ là reminder/issue và QA-04 giữ nguyên hợp đồng auth. Gói **nâng lên RED** chỉ khi dính 1 trong 2 điều kiện ở cuối.

Tier từng phần:

| Phần | Tier | Lý do |
|------|------|-------|
| Cơ chế mốc | 🟢 GREEN | *chỉ khi* là GH-issue/reminder. 🔴 RED nếu option D (session autonomous tự chạy có quyền merge) |
| QA-04 (#431) | 🟡 AMBER | thay đổi revertable, nhưng chứa đường false-green tệ nhất gói |
| OPS-04 Telegram | 🟡 AMBER | edge function redeploy (không phải git revert thuần) + rủi ro mute kênh + nguồn đo GA4 sai |
| .tl-btn HARD | 🟡 AMBER-thấp | verified chặn `quality.yml` gate bắt buộc; revert 1 dòng |
| 3 mốc đọc-số | 🟢 GREEN (prod) / 🟡 AMBER (chất lượng quyết định) | read-only, không đụng runtime; rủi ro là quyết định sai từ nhiễu |

## Rủi ro cụ thể

| # | Mức | Cơ chế hỏng | Người dùng / operator thấy gì | Giảm thiểu |
|---|-----|-------------|-------------------------------|------------|
| 1 | **Cao** | QA-04: "ổn định" `auth.spec.ts:102` (`verifyOtp expired`) + `:76` (DUPR SSO) bằng retry-until-pass / catch verifyOtp / mock supabase auth / skip `/match/confirm`. E2E không còn exercise auth thật → SLO 2/3 mất detector | Prod: magic-link hết hạn/consume 2 lần/redirect sai → user không login/confirm match được; CI vẫn xanh, không ai biết | Sửa hẹp: user+link mới mỗi test, consume 1 lần, wait-on-observable (không sleep), FAIL ngay lần auth hỏng đầu, KHÔNG catch/mock/skip verifyOtp. DUPR SSO tách thành integration-test có monitor riêng, không blanket-skip |
| 2 | **Cao** | OPS-04 dồn SLO-burn alert vào **cùng 1 `TELEGRAM_CHAT_ID`** với error-spike + cron-health (verified: `errors-telegram-alert/index.ts:39,183,333` gửi chung 1 chat). Burn alert lặp mỗi 10 phút nếu không có dedup riêng | Cuong nhận spam SLO → **mute kênh** → khi Mux/DUPR cron chết thật (SLO 5) hoặc error-spike thật, alert bị nuốt chung. `sendTelegram` (line 61) **không retry/queue** → burst gặp Telegram 429 làm rớt luôn alert cron-health đang gửi cùng lúc | Dedup theo state-transition (alert khi VÀO burn, recovery khi ra), gộp nhiều SLO vào 1 message, interval nhắc có giới hạn. Cân nhắc chat/topic Telegram riêng cho SLO vs incident |
| 3 | **TB** | OPS-04 đo SLO 2/3 từ GA4 funnel (slo.md dòng 12-13) mà GA4 bị bot US pollution (CLAUDE.md). Bot tạo auth-start không complete → tỷ lệ giả tụt; hoặc bot inflate denominator → tỷ lệ giả cao | **False-alert:** báo "auth outage" khi user VN vẫn login OK → Cuong đuổi bóng ma. **False-silence:** user VN login hỏng thật nhưng bot giữ tỷ lệ >99% → **không alert, user kẹt ngoài** | Đo server-side (Supabase edge logs `registration_insert_failed`/`otp_lookup_failed`), KHÔNG dùng GA4 làm nguồn duy nhất. Nếu buộc dùng GA4: chỉ segment VN + min-count + tính trễ ingestion + nhãn "telemetry-derived" |
| 4 | **TB** | `.tl-btn` HARD: `check-theline.mjs` chạy ở `quality.yml:55` **không** `|| true` (verified — khác `theline-audit.yml:27` có `|| true`). Flip Rule 4→hard: `now > before` trên bất kỳ .tsx đổi → exit 1 → **quality gate bắt buộc ĐỎ** | Hotfix production khẩn phải thêm 1 `.tl-btn` vì Button chưa cover → CI chặn merge; solo-op phải debug/bypass lint giữa lúc incident → **tăng MTTR** | Trước flip: chạy trial trên changed-files của N PR gần nhất, ghi trial-log 0 false-positive. Escape hatch tường minh (env skip). Rollback = revert 1 dòng advisory→hard |
| 5 | **TB** | 3 mốc đọc-số quyết định trên n nhỏ: PERF-05 (1 tuần RUM VN mobile của ~2k user), funnel organizer 2 tuần (vài chục organizer), badge impression 2 tuần. Không control day-of-week/device-mix/release đồng thời | Quyết định sai: giữ regression / revert cải tiến / build feature không ai cần / giết badge hữu ích — dựa trên nhiễu | Report BẮT BUỘC kèm: raw unique-user count, cửa sổ before/after cân, filter VN+mobile+route, ngưỡng "insufficient evidence" → kết luận "inconclusive" thay vì "worked/failed" khi thiếu n. Badge: impression ≠ giá trị; cần metric downstream (đăng ký) |
| 6 | **TB→Cao** | Cơ chế option D: session autonomous tự khởi động đúng ngày, **không có Cuong**, standing-instruction "chạy roadmap tự động" → tự làm việc mà memory ghi rõ là RED-gated (merge cần consent người thật) | Bất kỳ rủi ro #1/#2/#4 xảy ra không người canh; hoặc tệ hơn — session tự merge thay đổi lẽ ra phải chờ Cuong | Cơ chế = GH Actions `schedule` **chỉ mở issue** (idempotent, UTC, `issues:write`, alert nếu workflow chính fail). KHÔNG auto-launch executor. Issue ≠ hoàn thành mốc |

## SLO bị đe doạ
- **SLO 2 (Auth 99%)** — rủi ro #1: E2E false-green xoá detector; rủi ro #3: GA4 false-silence che outage auth thật.
- **SLO 3 (Registration 99%)** — rủi ro #1 (`/match/confirm` OTP) + #3 (đo sai nguồn).
- **SLO 5 (Cron 100% monitored-healthy)** — rủi ro #2: mute kênh Telegram chung → cron death của Mux(4h+2h)/DUPR(24h+2h)/GitHub(7d+1d) không được thấy. Cross-contamination nguy hiểm nhất: OPS-04 làm hỏng chính detector của SLO khác.
- **Không đe doạ:** SLO 1 (availability), SLO 4 (scoring), SLO 6 (latency), SLO 7 (push).

## Ngân sách hiệu năng
- Bundle: **+0 KB** → ~1822 / 1970 KB. Không file nào trong gói vào `dist` runtime. Headroom ~148 KB không bị đụng.
- Vietnam p75 impact: **none**.

## SEO
- Routes SSR bị ảnh hưởng: **none**. Không bump `pr:v30`. Verify: không cần (loại trừ có căn cứ).

## Mobile shell (Capacitor)
- **Không đụng.** Không app-store review, không regression native ẩn.

## Third-party blast radius
- **Telegram** (mới, qua OPS-04): API down/429 lúc 2am → `sendTelegram` return `false`, không retry → alert rớt câm (rủi ro #2). FCM/Mux/Resend/Gemini không đụng.
- **GA4**: nguồn đọc cho 4 mốc — nguồn đo bẩn (rủi ro #3/#5).
- **Supabase**: OPS-04 thêm query mỗi 10 phút — tải không đáng kể.

## Kế hoạch rollback
- **Cơ chế mốc (issue/reminder):** git revert workflow YAML. GREEN, phút.
- **QA-04 (`playwright.yml`):** git revert đủ về mặt cơ khí. **NHƯNG** false-green không có rollback — phải chặn ở must-verify, không phải ở rollback.
- **OPS-04 (`errors-telegram-alert`):** **không phải git revert thuần** — cần `supabase functions deploy` bản trước. ~5-10 phút.
- **.tl-btn HARD:** revert 1 dòng, CI-only. Phút.
- **Không revert được:** *chỉ khi* chọn option D và session autonomous đã merge một RED không người duyệt → điều khiến gói thành RED nếu đi hướng đó.

## Phải verify trước khi merge
- [ ] QA-04: diff `#431` (và mọi PR "stabilize E2E" theo sau) KHÔNG chứa: `test.retry`, `.catch(` quanh verifyOtp, mock `@/integrations/supabase`, `test.skip`/`test.fixme` trên auth/`/match/confirm`/DUPR SSO, hay storageState pre-seed thay cho magic-link thật. Grep: `git diff origin/main -- 'tests/**' | grep -nE 'retry|skip|fixme|mockResolved|storageState|catch'`
- [ ] QA-04: xác nhận stabilize sửa **race** bằng wait-on-state, KHÔNG nới timeout che race.
- [ ] codeql "Code scanning is not enabled": xác nhận là repo-config (bật CodeQL default setup ở Settings), KHÔNG "fix" bằng cách gỡ check khỏi required gate. Độc lập với QA-04.
- [ ] OPS-04: alert SLO tính burn theo **cửa sổ 30-ngày rolling** (slo.md dòng 5), KHÔNG theo ratio 10-phút. Có dedup state-transition riêng, gộp message.
- [ ] OPS-04: nguồn đo auth/registration = Supabase edge logs server-side, không phải GA4 global.
- [ ] .tl-btn: trial-log 0 false-positive trên changed-files của ≥5 PR merged gần nhất, ghi ngày, trước khi flip.
- [ ] Cơ chế: xác nhận là GH-issue/reminder-only; nếu bất kỳ ai đề xuất scheduled autonomous executor có quyền merge → **RED, dừng, hỏi Cuong**.

## Phản biện độc lập (GPT-5.6)
Prompt + reply lưu ở `external/risk-auditor-gpt56-{prompt,reply}.md`.

**Survived checking:** shared-channel Telegram suppression + sendTelegram không retry (verified index.ts:39,61-88,183,333); GA4 bot pollution false-alert/false-silence (verified CLAUDE.md + slo.md:12-13); QA-04 false-green class (khớp lessons-learned chuỗi xanh-giả); .tl-btn HARD chặn hotfix — **mạnh hơn GPT nghĩ**: em xác nhận `quality.yml:55` không `|| true`; option D unsafe / GH-issue an toàn nhất (khớp RED-gate consent model).

**Bác bỏ / chỉnh:** GPT mô hình SLO như cửa sổ ngắn ("re-alert mỗi 10 phút") — sai một phần: slo.md dòng 5 = error-budget **30-ngày rolling**; nếu OPS-04 implement burn theo 10-phút là **đo sai phép đo**. GPT liệt kê "pre-seeded storage state" như shortcut QA-04 sẽ dùng — không xác minh được, giữ làm watch-item. GPT không bịa file/function nào — không có RED dựng trên hallucination.
