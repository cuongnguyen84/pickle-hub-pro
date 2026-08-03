# Roadmap 9 — vận hành theo số đo (từ 04/08/2026)

> Kế nhiệm `docs/roadmap-8.5-9.md` (đóng sổ 03/08, scorecard:
> `docs/roadmap-8.5-9-scorecard.md`). **DRAFT do agent lập từ nợ audit + mốc đã hẹn —
> Cuong duyệt/sửa thứ tự trước khi coi là cam kết.** Khác chu kỳ trước: không còn
> khối lượng nền tảng lớn; chu kỳ này là (A) đọc số theo mốc rồi mới quyết build,
> (B) trả nợ có địa chỉ, (C) ứng viên feature chờ data. Nguyên tắc giữ nguyên:
> mốc mang cả PREDICATE lẫn ngày (`docs/milestones.md` là registry thật, file này
> là bức tranh); đo trước — build sau; RED cần Cuong duyệt tường minh.

## A. Đọc số theo mốc (đã hẹn, tự nhắc — không cần nhớ)

| Ngày | Mốc | Quyết định treo trên nó |
|---|---|---|
| 05/08 | PERF-05B — GA4 web-vitals VN theo metric_rating | Xác nhận/mâu thuẫn CrUX; INP lần đầu có số VN |
| 10/08 | SEO-SAN-W33 — tracker /san tuần (tự re-arm) | Alert sớm nếu #533 gây hại; nền cho CTR đọc 31/08 |
| 23/08 | SEO-CLUSTER-READ — 2 query bracket | THẮNG/THUA cụm bracket generator |
| 30/08 | CWV field-data (seo-followup mục 5) | **CLS 0.67 verdict** — nếu vẫn POOR sau #515 → PERF-CLS thành việc lớn nhất mục C |
| ~31/08 | CTR title VI/EN (seo-followup mục 4) | Baseline sạch 28 ngày sau #533 → sprint title hay không |
| chờ GSC | SEO 404 hygiene (seo-followup mục 3) | Cần: validation GSC ra kết quả + Cuong export 61 URL |

## B. Nợ kỹ thuật có địa chỉ (từ `docs/audits/close-03-2026-08.md`)

| ID | Effort | Việc | Kích hoạt khi |
|---|---|---|---|
| DEBT-01 | 0.5d | **Backstop total-gz còn 4.8%** (1881.5/1970 KB, mỗi bài blog ~10-15 KB) — quyết: nâng backstop có chủ đích HAY tách CONTENT khỏi backstop | Trước bài blog thứ ~6 kể từ 03/08, hoặc khi check-bundle đỏ |
| DEBT-02 | 1-2d | **react-router v6→v7** (2 moderate CVE; open-redirect có safeRedirect chắn, không dùng SSR-hydration) | Không gấp; gộp khi có đợt nâng deps |
| DEBT-03 | 0.5d | **Gỡ blanket `disableRules(["color-contrast"])`** page-wide + 2 theme states đúng key `tl-theme-mode` (gotcha 2 hệ theme đã doc trong audit) | Bất kỳ lúc nào — 2 bug nó giấu đã fix, chỉ còn dựng lại guard |
| DEBT-04 | 1d | **Test money-path**: RegistrationModal (70% miss) + LivestreamGateOverlay + seedFromDupr + wizard-reducer | Trước lần sửa lớn tiếp theo vào payment/registration |
| DEBT-05 | 0.5d | **CodeQL thêm `python`** vào languages (9 file .py cầm credential không gate nào quét) + cân nhắc CodeQL Action v3→v4 (deprecate 12/2026) | Cùng PR chỉnh security.yml lần tới |
| DEBT-06 | 0.5d | **geo-check rate-limit** (ip-api 45 req/min free — spam làm fail-open) — copy pattern newsletter-subscribe | Nếu thấy geo-check lỗi quota trong log |
| DEBT-07 | 0d (config) | **Bật lại Migration-drift + Milestone-due workflows** (đang MÙ) — và cân nhắc branch protection main (require quality+smoke; giờ gate đã xanh trung thực nên không còn chặn oan) | Khi Cuong xác nhận budget Actions chịu được (~2 workflow cron nhẹ) |
| DEBT-08 | 0.5d | Doc stale còn lại: CLAUDE.md §Known Bugs cập nhật theo audit; do-đợt-nào-tiện | Gộp PR docs bất kỳ |

## C. Ứng viên build — CHỜ DATA, chưa cam kết

| ID | Điều kiện mở | Việc |
|---|---|---|
| CAND-01 | CLS field 30/08 vẫn POOR | **PERF-CLS**: /idea với CLS attribution data (#502 đã thu) — ứng viên lớn nhất chu kỳ |
| CAND-02 | LCP lab 6.6s được field xác nhận chậm | First-load: mục tiêu số 1 là vendor-video 304 KB gz (lazy nhưng nặng nhất CODE) |
| CAND-03 | CTR đọc 31/08 cho thấy title là đòn bẩy | Sprint phân hoá title VI/EN (copy đã có sẵn trong `round1/ui-ux-critic.md` của proposal seo-followup-checklist-v2) |
| CAND-04 | Cuong muốn badge sống | Hạ `REG_BADGE_MIN` 4→1-2 hoặc thêm `badge_click`/holdout (BADGE-TELEMETRY 03/08: Σshown=0, đăng ký thưa) |
| CAND-05 | Organizer bật `requires_registration` nhiều lên (hiện 0/105 bảng 60 ngày) | Mở lại hồ sơ guest-path (UX-07 đóng vì bài toán thượng nguồn — nếu thượng nguồn đổi thì đọc lại funnel trước) |
| CAND-06 | P2 burn-alert kêu thường xuyên (nền 03/08 đã 1.3×) | Chỉnh `DEFAULT_BURN_CONFIG` hoặc điều tra nguồn lỗi client thật |

## D. Việc chỉ Cuong làm được (treo từ trước, không đổi)

- Duyệt 1818 bản dịch native (từ 28/07) · test iPhone 4 điểm · `docs/manual-test-backlog.md` mục 8-14 (gồm RED gate App Store)
- PR #497 (chính tả VI, mở 28/07): merge hoặc đóng
- Xoá 2 nhánh classifier chặn agent: `feat/seo-followup-checklist-v2`, `docs/seo-followup-checklist` (+ worktree `~/pickle-hub-pro-cwv`)
- GSC: theo dõi validation 3 nhóm coverage đang chạy; export 61 URL 404 khi xong
- Quyết DEBT-07 (budget Actions + branch protection)

## Không làm (đã quyết, đừng mở lại thiếu data mới)

- Guest-path OTP (UX-07 CLOSED 03/08 — 0 wall users) — chỉ mở lại qua CAND-05
- Vòng noindex thứ hai trên venues (luật 4 `docs/seo-followup-2026-08.md`)
- Thin-gate news/matches (increment-4 cũ — chính data của architect giết: 18% ≠ ≥70%)
- Formal usability sessions (BASE-07/UX-09 — Cuong đóng 22/07)
